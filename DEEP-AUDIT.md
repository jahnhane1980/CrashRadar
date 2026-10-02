Befund 1
- Prinzip-Verletzung: ACID (Isolation) & State Management (TOCTOU)
- Kritikalität: CRITICAL
- Ort: `src/services/TimeSeriesFetcher.js` / Funktionen `runTask`, `fetchViaPackage`, `fetchViaHttp`
- Mechanistisches Fehlerszenario: Das Lesen des Persistenz-Cursors (`await this.storage.getSyncState(task.id)`) und das Zurückschreiben der Ergebnisse (`await this.storage.insertDataAndState`) erfolgt ohne transaktionale Klammerung auf Applikationsebene. Werden zwei `runTask`-Instanzen für denselben Task zeitgleich ausgelöst (z.B. manueller Backfill parallel zum Cronjob), lesen beide Thread-Kontexte exakt denselben alten Cursor-Status. Beide feuern redundante HTTP-Requests mit demselben `startValue` ab und führen zu massiven `ON DUPLICATE KEY UPDATE` Kollisionen (TiDB Deadlocks) sowie extremer API-Sättigung/Rate-Limit-Bans.
- Lauffähiger Fix:
```javascript
// Vollständiger Ersatz für TimeSeriesFetcher.js, runTask (ca. Z. 121-132)
  async runTask(task) {
    Logger.info(`\n--- Starting task: ${task.id} ---`);
    const provider = this.config.providers[task.provider];
    
    if (!provider) throw new Error(`Provider '${task.provider}' not found in config`);
    
    // Atomarer Task-Level Lock-Guard vor jedem State-Read
    const lockKey = `sync_lock_${task.id}`;
    const lockAcquired = await this.storage.acquireLock(lockKey, 300);
    if (!lockAcquired) {
      Logger.warn(`[Lock] Task ${task.id} läuft bereits. Ausführung übersprungen.`);
      return;
    }

    try {
      if (provider.type === PROVIDER_TYPES.PACKAGE) {
        await this.fetchViaPackage(task, provider);
      } else if (provider.type === PROVIDER_TYPES.HTTP) {
        await this.fetchViaHttp(task, provider);
      }
    } finally {
      await this.storage.releaseLock(lockKey);
    }
  }
```

Befund 2
- Prinzip-Verletzung: Fail-Fast vs. Silent Swallowing (Resilience)
- Kritikalität: HIGH
- Ort: `src/core/adapters/fetch/SqueezeMetricsFetchAdapter.js` (Z. 91-94) & `AaiiFetchAdapter.js` (Z. 82-85)
- Mechanistisches Fehlerszenario: Treten bei Package-Providern Netzwerk- oder Parsing-Fehler auf, fängt der `catch`-Block im Adapter die Exception ab, loggt sie lediglich unauffällig in die Konsole und gibt stattdessen ein leeres Array `[]` zurück. Der Orchestrator (`fetchViaPackage` in `TimeSeriesFetcher.js`) prüft auf `newData.length > 0`, findet ein leeres Array, verarbeitet dieses stillschweigend und markiert den Task als erfolgreich abgeschlossen. Der Fehler erreicht niemals die injizierte `ErrorRegistry`, kritische Ntfy-Alarme bleiben aus, und Datenlücken in den Zeitreihen fallen im Downstream-Betrieb nicht auf.
- Lauffähiger Fix:
```javascript
// Vollständiger Ersatz für Z. 91-94 in src/core/adapters/fetch/SqueezeMetricsFetchAdapter.js
        } catch (error) {
            Logger.error(`[SqueezeMetricsFetchAdapter] Fehler beim Abruf von DIX: ${error.message}`);
            throw error; // Fail-Fast Propagation zum Orchestrator
        } finally {
```
```javascript
// Vollständiger Ersatz für Z. 82-85 in src/core/adapters/fetch/AaiiFetchAdapter.js
        } catch (e) {
            Logger.error(`[AaiiFetchAdapter] Fehler beim Abruf von AAII Sentiment: ${e.message}`);
            throw e; // Fail-Fast Propagation zum Orchestrator
        }
```

Befund 3
- Prinzip-Verletzung: SRP, Flow Control & Memory-Management
- Kritikalität: HIGH
- Ort: `src/core/adapters/fetch/SqueezeMetricsFetchAdapter.js` (Z. 16-41)
- Mechanistisches Fehlerszenario: Der Adapter erzwingt einen ineffizienten und blockierenden Data-Pipeline-Bypass. Die API-Antwort wird via `responseType: 'text'` erst vollständig in den V8-Heap geladen. Anschließend wird dieser String per synchronem `fs.writeFileSync` auf die Disk weggeschrieben, was die Node.js Event-Loop und damit sämtliche parallelen Tasks (und deren Heartbeats) blockiert. Unmittelbar danach wird dieser Dateiinhalt wieder mittels `fs.createReadStream` vom Datenträger geparst. Das provoziert bei IOPS-Limiterung oder großen Files synchrone Lock-Stalls und V8-OOM-Crashes.
- Lauffähiger Fix:
```javascript
// src/core/adapters/fetch/SqueezeMetricsFetchAdapter.js - Modifikation der Imports (Z. 1-4) und Fetch-Logik (Z. 16-41)
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { Logger } from '../../Logger.js';

export class SqueezeMetricsFetchAdapter {
    constructor() {}

    async fetch(task, provider, startDate, requestManager) {
        Logger.info(`[SqueezeMetrics] Hole Daten für Task: ${task.id} (Zeitraum ab: ${startDate || 'Beginn'})`);
        const records = [];
        const url = 'https://squeezemetrics.com/monitor/static/DIX.csv';
        
        try {
            const text = await requestManager.fetch(url, task.provider, {
                responseType: 'text',
                headers: {
                    'User-Agent': 'CrashRadar-Bot/1.0',
                    'Accept': 'text/csv,text/plain,*/*'
                }
            });

            // Direkter In-Memory-Stream ohne blockierende File-I/O
            const parser = Readable.from([text]).pipe(
                parse({
                    columns: header => header.map(column => column.trim().toLowerCase()),
                    skip_empty_lines: true,
                    trim: true
                })
            );

            let totalParsedRows = 0;
            for await (const row of parser) {
                totalParsedRows++;
                if (row.date && (row.date.includes('<html') || row.date.includes('<!doctype'))) {
                    throw new Error("Fehler: API liefert HTML anstelle von CSV. Möglicherweise Cloudflare/WAF Blockade.");
                }
                const recordDate = row.date;
                if (!recordDate || typeof recordDate !== 'string' || !recordDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
                if (startDate && recordDate < startDate) continue;

                const price = parseFloat(row.price) || 0;
                const dix = parseFloat(row.dix) || 0;
                const gex = parseFloat(row.gex) || 0;

                if (price > 0) {
                    records.push({ record_date: recordDate, price, dix, gex });
                }
            }

            if (totalParsedRows > 0 && records.length === 0) {
                throw new Error(`Silent Fail: ${totalParsedRows} Zeilen geparst, aber 0 gültige Datensätze.`);
            }

            Logger.info(`[SqueezeMetrics] ${records.length} Datensätze ab ${startDate || 'Anfang'} extrahiert.`);
            return records.sort((a, b) => a.record_date.localeCompare(b.record_date));

        } catch (error) {
            Logger.error(`[SqueezeMetricsFetchAdapter] Fehler beim Abruf von DIX: ${error.message}`);
            throw error;
        }
        // Der finally-Block mit fs.unlinkSync (Z. 93-103) entfällt komplett.
    }
}
```

Befund 4
- Prinzip-Verletzung: Open/Closed Principle (OCP) & Dependency Inversion (DIP)
- Kritikalität: MEDIUM
- Ort: `src/core/adapters/storage/StorageAdapterFactory.js` (Z. 16-31) und `src/core/adapters/fetch/FetchAdapterFactory.js` (Z. 12-23)
- Mechanistisches Fehlerszenario: Beide Factories binden statisch und hartcodiert alle vorhandenen Adapter-Klassen ein (`const adapters = { ... }`). Neue Provider können nicht per Konfiguration oder Dependency-Injection zur Laufzeit integriert werden, sondern erfordern direkte Modifikationen am Kern-Code der Factory. Dies verhindert die modulare Erweiterbarkeit (z.B. via dynamisch ladbare Plugins) und sorgt unweigerlich für wiederkehrende Git-Merge-Konflikte am Architektur-Flaschenhals.
- Lauffähiger Fix:
```javascript
// Vollständiger Ersatz für src/core/adapters/storage/StorageAdapterFactory.js
import { Logger } from '../Logger.js';

export class StorageAdapterFactory {
  static #adapters = new Map();

  static register(providerName, adapterInstance) {
    if (this.#adapters.has(providerName)) {
      Logger.warn(`[StorageAdapterFactory] Adapter für ${providerName} wird überschrieben.`);
    }
    this.#adapters.set(providerName, adapterInstance);
  }

  static getAdapter(providerName) {
    const adapter = this.#adapters.get(providerName);
    if (!adapter) {
      throw new Error(`No storage adapter registered for provider: ${providerName}`);
    }
    return adapter;
  }
}
// Registrierung wird in die Bootstrapping-Phase (index.js / Runner) delegiert.
// Exakt gleiches Refactoring ist für FetchAdapterFactory.js erforderlich.
```
