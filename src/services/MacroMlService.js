import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MacroMlService
 *
 * Führt Inferenz auf dem trainierten multivariaten Makro-ML-Modell (XGBoost) aus.
 * Liest die JSON-Baumstruktur direkt in JavaScript ein – ohne externe C++ Bindings oder Python.
 */
export class MacroMlService {
  constructor(modelName = 'macro_regime') {
    this.modelName = modelName;
    this.modelDir = path.join(__dirname, '..', '..', 'data', 'ml', 'models', this.modelName);
    this.model = null;
    this.metadata = null;
    this.trees = [];
    this.featureNames = [];
    this.baseMargin = 0.0;
  }

  _initModelData(modelObj, metaObj = null) {
    this.model = modelObj;
    this.metadata = metaObj;
    this.featureNames = this.model.learner.feature_names || [];
    const baseScoreStr = (this.model.learner.learner_model_param?.base_score || '0.5')
      .replace('[', '')
      .replace(']', '');
    const baseScore = parseFloat(baseScoreStr);
    this.baseMargin = Math.log(baseScore / (1 - baseScore));
    this.trees = this.model.learner.gradient_booster?.model?.trees || [];
  }

  /**
   * Lädt das XGBoost JSON-Modell und die Metadaten asynchron in den Arbeitsspeicher
   */
  async loadModel() {
    if (this.model) return;

    try {
      const modelPath = path.join(this.modelDir, 'macro_regime_model.json');
      const metaPath = path.join(this.modelDir, 'macro_regime_meta.json');

      if (!fsSync.existsSync(modelPath)) {
        throw new Error(`Modell-Datei nicht gefunden: ${modelPath}`);
      }

      const modelRaw = await fs.readFile(modelPath, 'utf8');
      const model = JSON.parse(modelRaw);

      let metadata = null;
      if (fsSync.existsSync(metaPath)) {
        const metaRaw = await fs.readFile(metaPath, 'utf8');
        metadata = JSON.parse(metaRaw);
      }

      this._initModelData(model, metadata);
      Logger.info(`[MacroMlService] XGBoost Makro-Modell geladen (${this.trees.length} Bäume, ${this.featureNames.length} Features).`);
    } catch (error) {
      Logger.error(`[MacroMlService] Fehler beim Laden des Makro-Modells:`, error.message);
      throw error;
    }
  }

  /**
   * Lädt das XGBoost JSON-Modell und die Metadaten synchron in den Arbeitsspeicher
   */
  loadModelSync() {
    if (this.model) return;

    try {
      const modelPath = path.join(this.modelDir, 'macro_regime_model.json');
      const metaPath = path.join(this.modelDir, 'macro_regime_meta.json');

      if (!fsSync.existsSync(modelPath)) {
        throw new Error(`Modell-Datei nicht gefunden: ${modelPath}`);
      }

      const modelRaw = fsSync.readFileSync(modelPath, 'utf8');
      const model = JSON.parse(modelRaw);

      let metadata = null;
      if (fsSync.existsSync(metaPath)) {
        const metaRaw = fsSync.readFileSync(metaPath, 'utf8');
        metadata = JSON.parse(metaRaw);
      }

      this._initModelData(model, metadata);
      Logger.info(`[MacroMlService] XGBoost Makro-Modell synchron geladen (${this.trees.length} Bäume, ${this.featureNames.length} Features).`);
    } catch (error) {
      Logger.error(`[MacroMlService] Fehler beim synchronen Laden des Makro-Modells:`, error.message);
      throw error;
    }
  }

  /**
   * Berechnet den kontinuierlichen Crash-Risiko-Score (0.0 bis 1.0) für einen gegebenen Feature-Vektor
   *
   * @param {Object} featureValues - Key-Value-Map der Indikatoren (z. B. { Spread_10Y_2Y_Current: 0.5, TGA_Balance_B: 935.0, ... })
   * @returns {Object} { probability, riskPct, regime, topDrivers }
   */
  predict(featureValues = {}) {
    if (!this.model || this.trees.length === 0) {
      this.loadModelSync();
    }

    let rawMargin = this.baseMargin;

    for (const tree of this.trees) {
      let node = 0;
      const left = tree.left_children;
      const right = tree.right_children;
      const splits = tree.split_conditions;
      const indices = tree.split_indices;
      const defLeft = tree.default_left;

      while (left[node] !== -1) {
        const featIdx = indices[node];
        const featName = this.featureNames[featIdx];
        const rawVal = featureValues[featName];
        const val = (rawVal === '' || rawVal === undefined || rawVal === null) ? NaN : Number(rawVal);
        const thresh = splits[node];

        if (isNaN(val)) {
          node = defLeft[node] === 1 ? left[node] : right[node];
        } else if (val < thresh) {
          node = left[node];
        } else {
          node = right[node];
        }
      }

      const leafValue = splits[node];
      rawMargin += leafValue;
    }

    // Sigmoid-Aktivierung: Logistischer Crash-Score
    const probability = 1 / (1 + Math.exp(-rawMargin));
    const riskPct = Math.round(probability * 1000) / 10; // Auf 1 Nachkommastelle runden (z. B. 73.4 %)

    // Regime-Einteilung
    let regime = 'NORMAL';
    if (riskPct >= 65.0) {
      regime = 'ACUTE_CRASH_RISK';
    } else if (riskPct >= 30.0) {
      regime = 'ELEVATED_RISK';
    }

    return {
      probability,
      riskPct,
      regime,
      topDrivers: this.metadata?.top_drivers?.slice(0, 5) || []
    };
  }
}
