import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';
import { FinanceExpert } from '../services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../strategies/GoldSpyDcaStrategy.js';
import { StrategyNotificationService } from '../services/StrategyNotificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SNAPSHOT_PATH = path.resolve(__dirname, '../../data/daily_intelligence.json');

/**
 * PortfolioStrategyRunner
 * 
 * Täglicher Ausführungs-Runner für die CrashRadar SignalEngine:
 * 1. Lädt historische Timeline aus der Datenbank via FinanceExpert.
 * 2. Initialisiert PortfolioStrategyEngine und registriert alle aktiven Strategien.
 * 3. Führt Makro-Sensoren (KatastrophenMatrix, GoldSniper, TreasuryCapacity, BottomSniper) aus.
 * 4. Führt evaluateDaily() für jede Strategie aus (inkl. Broker-Sync).
 * 5. Erzeugt den aggregierten Tages-Snapshot (daily_intelligence.json) und speichert ihn lokal ab.
 * 6. Versendet Benachrichtigungen (Anti-Spam debounced oder via --send-ntfy).
 * 7. Pusht optional per gesichertem Webhook an Cloudflare D1 (CF_SNAPSHOT_WEBHOOK_URL).
 */
export class PortfolioStrategyRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.isTest = Boolean(options.test);
    this.dependencies = dependencies;
    this.expert = dependencies.expert || null;
    this.engine = dependencies.engine || null;
    this.notificationService = dependencies.notificationService || null;
    this.snapshotPath = options.snapshotPath || DEFAULT_SNAPSHOT_PATH;
  }

  async run() {
    try {
      Logger.info('[PortfolioStrategyRunner] Starte Portfolio-Strategie Engine Lauf...');
      const dbUrl = this.isTest ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL) : process.env.DATABASE_URL;

      if (!this.expert && !this.dependencies.timeline) {
        if (!dbUrl) {
          throw new Error('Missing DATABASE_URL in environment.');
        }
        this.expert = new FinanceExpert(dbUrl);
      }

      // 1. Timeline laden
      let timeline = this.dependencies.timeline;
      if (!timeline) {
        Logger.info('[PortfolioStrategyRunner] Lade Marktdaten-Timeline via FinanceExpert...');
        const startDate = this.options.startDate || '2022-01-01';
        timeline = await this.expert.getDailyGroupedData(startDate, { bypassMemoryGuard: true });
      }

      if (!timeline || timeline.length === 0) {
        throw new Error('[PortfolioStrategyRunner] Keine Timeline-Daten für Strategie-Auswertung vorhanden.');
      }

      const todayStr = this.options.dateOverride || (timeline[timeline.length - 1].date) || new Date().toISOString().split('T')[0];
      Logger.info(`[PortfolioStrategyRunner] Auswertungs-Tag: ${todayStr} (Historie: ${timeline.length} Tage)`);

      // 2. PortfolioStrategyEngine initialisieren und Strategien registrieren (falls noch nicht injiziert)
      if (!this.engine) {
        this.engine = new PortfolioStrategyEngine();
        const goldSpy = new GoldSpyDcaStrategy();
        this.engine.registerStrategy(goldSpy);
      }

      // 3. Ausführung aller registrierten Strategien
      const brokerStates = this.options.brokerStates || {};
      const evalResults = await this.engine.evaluateAll({
        date: todayStr,
        timeline,
        brokerStates
      });

      Logger.info(`[PortfolioStrategyRunner] Makro-Regime: ${evalResults.macroSignalContext.regime} | Katastrophen-Matrix: ${evalResults.macroSignalContext.katastrophenMatrix.status} | Gold-Sniper: ${evalResults.macroSignalContext.goldSniper.signal}`);

      for (const [sId, sRes] of Object.entries(evalResults.strategyResults)) {
        Logger.info(`  • [${sId}] Status: ${sRes.status} | Aktion: ${sRes.trancheAction || sRes.action || 'HOLD'} | Grund: ${sRes.reason}`);
      }

      // 5. Daily Intelligence Snapshot erstellen und lokal persistieren
      const snapshot = this.engine.buildDailySnapshot(todayStr, evalResults.macroSignalContext);
      this.saveSnapshot(snapshot);

      // 6. Benachrichtigungen versenden (Anti-Spam debounced oder erzwungen via --send-ntfy)
      let dispatchedAlerts = [];
      if (!this.isTest || this.options.sendNtfy || this.dependencies.notificationService) {
        if (!this.notificationService) {
          this.notificationService = new StrategyNotificationService();
        }
        const forceSend = Boolean(this.options.sendNtfy);
        dispatchedAlerts = await this.notificationService.dispatchStrategyAlerts(evalResults, {
          forceSend
        });
        if (dispatchedAlerts.length > 0) {
          Logger.info(`[PortfolioStrategyRunner] ${dispatchedAlerts.length} Strategie-Alert(s) versendet.`);
        }
      } else {
        Logger.info('[PortfolioStrategyRunner] Test-Modus aktiv: Benachrichtigungs-Versand standardmäßig übersprungen.');
      }

      // 7. Optional: Push an Cloudflare D1 Webhook, falls URL konfiguriert ist
      const cfWebhookUrl = process.env.CF_SNAPSHOT_WEBHOOK_URL;
      if (cfWebhookUrl && !this.isTest) {
        await this.pushSnapshotToCloudflare(snapshot, cfWebhookUrl);
      }

      Logger.info('[PortfolioStrategyRunner] Portfolio-Strategie Engine Lauf erfolgreich beendet.');
      return {
        evalResults,
        snapshot,
        dispatchedAlerts
      };
    } catch (error) {
      Logger.error('[PortfolioStrategyRunner Error]', error.message || error);
      throw error;
    } finally {
      if (this.expert && typeof this.expert.close === 'function') {
        try { await this.expert.close(); } catch (e) {}
      }
    }
  }

  saveSnapshot(snapshot) {
    try {
      const dir = path.dirname(this.snapshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
      Logger.info(`[PortfolioStrategyRunner] Snapshot gespeichert unter: ${this.snapshotPath}`);
    } catch (e) {
      Logger.error(`[PortfolioStrategyRunner] Fehler beim Speichern des Snapshots: ${e.message}`);
    }
  }

  async pushSnapshotToCloudflare(snapshot, webhookUrl) {
    try {
      const secret = process.env.CF_SNAPSHOT_SECRET || '';
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Snapshot-Secret': secret
        },
        body: JSON.stringify(snapshot)
      });
      if (response.ok) {
        Logger.info('[PortfolioStrategyRunner] Snapshot erfolgreich an Cloudflare D1 gepusht.');
      } else {
        Logger.warn(`[PortfolioStrategyRunner] Cloudflare Push fehlerhaft (Status ${response.status}): ${await response.text()}`);
      }
    } catch (e) {
      Logger.error(`[PortfolioStrategyRunner] Fehler beim Cloudflare Push: ${e.message}`);
    }
  }

  cleanup() {
    if (this.expert && typeof this.expert.close === 'function') {
      try { this.expert.close(); } catch (e) {}
    }
  }
}
