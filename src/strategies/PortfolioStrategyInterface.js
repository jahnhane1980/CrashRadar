import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PortfolioStrategyInterface
 * 
 * Reiner, leichtgewichtiger Kontrakt für alle Portfoliostrategien in CrashRadar (Kamikaze, Gold-SPY, MCW, 7-Slot, Satellite).
 * 
 * ARCHITEKTUR-PRINZIP:
 * - KEINE Vererbung von schweren Basisklassen.
 * - KEIN starres Bucket-Management (jede Strategie modelliert ihre Asset-Welt autonom).
 * - Einhalten des Command-/Interface-Musters für die Ausführung durch die PortfolioStrategyEngine.
 * 
 * Verbindliche Schnittstelle:
 * - getId(): string
 * - getName(): string
 * - getVersion(): string
 * - evaluateDaily(context): object
 * - getSnapshot(date): object
 */
export class PortfolioStrategyInterface {
  getId() {
    throw new Error(`[PortfolioStrategyInterface] Methode getId() muss implementiert werden.`);
  }

  getName() {
    throw new Error(`[PortfolioStrategyInterface] Methode getName() muss implementiert werden.`);
  }

  getVersion() {
    return '1.0.0';
  }

  evaluateDaily(context) {
    let id = 'Strategie';
    try { id = this.getId(); } catch (e) {}
    throw new Error(`[PortfolioStrategyInterface] Methode evaluateDaily(context) muss von ${id} implementiert werden.`);
  }

  getSnapshot(date) {
    let id = 'Strategie';
    try { id = this.getId(); } catch (e) {}
    throw new Error(`[PortfolioStrategyInterface] Methode getSnapshot(date) muss von ${id} implementiert werden.`);
  }

  /**
   * Validiert zur Laufzeit, ob ein Objekt oder eine Strategie-Instanz den Kontrakt erfüllt.
   * @param {Object} instance 
   * @returns {boolean}
   */
  static validate(instance) {
    if (!instance || typeof instance !== 'object') {
      throw new Error('[PortfolioStrategyInterface] Strategie-Instanz muss ein gültiges Objekt sein.');
    }
    const requiredMethods = ['getId', 'getName', 'evaluateDaily', 'getSnapshot'];
    for (const method of requiredMethods) {
      if (typeof instance[method] !== 'function') {
        throw new Error(`[PortfolioStrategyInterface] Strategie '${instance.constructor?.name || 'Unbekannt'}' verletzt den Kontrakt: Methode '${method}' fehlt.`);
      }
    }
    const id = instance.getId();
    if (!id || typeof id !== 'string') {
      throw new Error(`[PortfolioStrategyInterface] getId() muss einen nicht-leeren String liefern (erhalten: '${id}').`);
    }
    return true;
  }

  /**
   * Optionaler Manifest-Loader für Strategien mit JSON-Manifest in config/strategies/<id>.json
   * @param {string} manifestIdOrPath - z.B. 'KAMIKAZE_GROWTH' oder 'gold-spy.json'
   * @returns {Object}
   */
  static loadManifest(manifestIdOrPath) {
    let resolvedPath = manifestIdOrPath;
    const aliases = {
      'satelite': 'satellite',
      'satellite': 'satellite',
      '7-slot-guru': 'seven-slot-guru',
      'seven-slot-guru': 'seven-slot-guru',
      'mcw': 'muzzled-cathie-wood',
      'muzzled-cathie-wood': 'muzzled-cathie-wood'
    };

    if (!path.isAbsolute(resolvedPath) && !resolvedPath.endsWith('.json')) {
      const normalized = manifestIdOrPath.toLowerCase().replace(/_/g, '-');
      const key = aliases[normalized] || normalized;
      resolvedPath = path.resolve(__dirname, '../../config/strategies', key + '.json');
    }
    if (!fs.existsSync(resolvedPath)) {
      const basename = path.basename(resolvedPath, '.json').toLowerCase();
      if (aliases[basename]) {
        const alt = path.resolve(path.dirname(resolvedPath), aliases[basename] + '.json');
        if (fs.existsSync(alt)) {
          resolvedPath = alt;
        }
      }
    }
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`[PortfolioStrategyInterface] Manifest-Datei nicht gefunden: ${resolvedPath}`);
    }
    try {
      const raw = fs.readFileSync(resolvedPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`[PortfolioStrategyInterface] Fehler beim Parsen des Manifests ${resolvedPath}: ${err.message}`);
    }
  }
}
