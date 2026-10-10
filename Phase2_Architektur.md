### Block 1: Heartbeat-Erneuerung (Resilience)

**SQL-Query & Methodensignatur in `src/core/Storage.js`**

```javascript
// src/core/Storage.js
class Storage {
  /**
   * Verlängert die Gültigkeit eines aktiven Locks in der Datenbank.
   * @param {string} key - Der eindeutige Lock-Schlüssel.
   * @param {number} ttlSeconds - Die neue Time-To-Live in Sekunden.
   * @returns {Promise<boolean>} True, wenn der Lock erfolgreich verlängert wurde.
   */
  async renewLock(key, ttlSeconds) {
    const query = `
      UPDATE system_locks 
      SET expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND) 
      WHERE lock_key = ? AND expires_at > NOW()
    `;
    const [result] = await this.db.execute(query, [ttlSeconds, key]);
    return result.affectedRows > 0;
  }
}
```

**Runner-Lifecycle-Hook mit Heartbeat**

```javascript
// src/runners/BaseRunner.js
async function runWithHeartbeat(taskKey, ttlSeconds, taskLogic) {
  let heartbeatInterval;
  try {
    const locked = await storage.acquireLock(taskKey, ttlSeconds);
    if (!locked) throw new Error(`Could not acquire lock for ${taskKey}`);

    const intervalMs = (ttlSeconds / 2) * 1000;
    heartbeatInterval = setInterval(async () => {
      try {
        const renewed = await storage.renewLock(taskKey, ttlSeconds);
        if (!renewed) {
          console.warn(`[Heartbeat] Lock renewal failed for ${taskKey}`);
        }
      } catch (err) {
        console.error(`[Heartbeat] Error renewing lock ${taskKey}:`, err);
      }
    }, intervalMs);

    await taskLogic();
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    await storage.releaseLock(taskKey);
  }
}
```

### Block 2: Auflösung der OCP-Verletzung (Architektur)

**Interface-Klassen für isolierte Adapter**

```javascript
// src/core/adapters/BaseFiscalAdapter.js
class BaseFiscalAdapter {
  async process(data) {
    throw new Error("Method 'process' must be implemented.");
  }
}

// src/core/adapters/FiscalTgaAdapter.js
class FiscalTgaAdapter extends BaseFiscalAdapter {
  async process(data) {
    // Spezifische TGA-Verarbeitungslogik
  }
}

// src/core/adapters/FiscalAuctionsAdapter.js
class FiscalAuctionsAdapter extends BaseFiscalAdapter {
  async process(data) {
    // Spezifische Auctions-Verarbeitungslogik
  }
}

// src/core/adapters/FiscalBuybacksAdapter.js
class FiscalBuybacksAdapter extends BaseFiscalAdapter {
  async process(data) {
    // Spezifische Buybacks-Verarbeitungslogik
  }
}
```

**Bootstrapping in `index.js`**

```javascript
// index.js (Bootstrapping)
import { StorageAdapterFactory } from './src/core/StorageAdapterFactory.js';
import { FiscalTgaAdapter } from './src/core/adapters/FiscalTgaAdapter.js';
import { FiscalAuctionsAdapter } from './src/core/adapters/FiscalAuctionsAdapter.js';
import { FiscalBuybacksAdapter } from './src/core/adapters/FiscalBuybacksAdapter.js';

const adapterFactory = new StorageAdapterFactory();

adapterFactory.register('fiscal_tga', new FiscalTgaAdapter());
adapterFactory.register('fiscal_auctions', new FiscalAuctionsAdapter());
adapterFactory.register('fiscal_buybacks', new FiscalBuybacksAdapter());
```

### Block 3: Zerschlagung der God-Class "TimeSeriesFetcher" (Architektur)

**Schnittstellen und Data Flows**

```javascript
// src/services/CursorManager.js
class CursorManager {
  async getStartDate(taskId) { /* Lese Cursor aus DB */ }
  async updateCursor(taskId, lastValidDate) { /* Schreibe Cursor in DB */ }
}

// src/services/ResponseNormalizer.js
class ResponseNormalizer {
  normalize(rawPayload) { /* ... */ }
  
  handleError(error, context) {
    return { data: [], status: 'partial_failure', error: error.message };
  }
}

// src/services/TaskOrchestrator.js
class TaskOrchestrator {
  constructor(cursorManager, apiFetcher, responseNormalizer, storageAdapter) {
    this.cursorManager = cursorManager;
    this.apiFetcher = apiFetcher;
    this.responseNormalizer = responseNormalizer;
    this.storageAdapter = storageAdapter;
  }
  
  async execute(taskId) {
    const startDate = await this.cursorManager.getStartDate(taskId);
    let normalizedData;

    try {
      const rawData = await this.apiFetcher.fetch(taskId, startDate);
      normalizedData = this.responseNormalizer.normalize(rawData);
    } catch (error) {
      normalizedData = this.responseNormalizer.handleError(error, { taskId, startDate });
    }

    if (normalizedData.data.length > 0) {
      await this.storageAdapter.process(normalizedData.data);
      const lastDate = normalizedData.data[normalizedData.data.length - 1].date;
      await this.cursorManager.updateCursor(taskId, lastDate);
    }
  }
}
```

### Block 4: Datenbankschema-Migration (Data Integrity)

**TiDB `ALTER TABLE`-Statements**

```sql
ALTER TABLE market_data MODIFY COLUMN close_price DECIMAL(18,6);
ALTER TABLE market_data MODIFY COLUMN open_price DECIMAL(18,6);
ALTER TABLE market_data MODIFY COLUMN high_price DECIMAL(18,6);
ALTER TABLE market_data MODIFY COLUMN low_price DECIMAL(18,6);
```

**Backfill-Skript & Date Cast**

```sql
-- Bereinigung der String-Formate auf striktes YYYY-MM-DD
UPDATE market_data 
SET trade_date_str = CONCAT(
    SUBSTRING_INDEX(trade_date_str, '-', 1), '-',
    LPAD(SUBSTRING_INDEX(SUBSTRING_INDEX(trade_date_str, '-', 2), '-', -1), 2, '0'), '-',
    LPAD(SUBSTRING_INDEX(trade_date_str, '-', -1), 2, '0')
)
WHERE trade_date_str NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- Umstellung Datentyp
ALTER TABLE market_data MODIFY COLUMN trade_date DATE;
ALTER TABLE economic_indicators MODIFY COLUMN release_date DATE;

-- Finaler Cast
UPDATE market_data SET trade_date = STR_TO_DATE(trade_date_str, '%Y-%m-%d');
```

### Block 5: Datenintegrität bei FRED-Revisionen (Cursor-Strategie)

**`revisionLookback`-Logik im `CursorManager`**

```javascript
// src/services/CursorManager.js
class CursorManager {
  constructor(db, revisionLookbackDays = 30) {
    this.db = db;
    this.revisionLookbackDays = revisionLookbackDays;
  }

  async getStartDate(taskId) {
    const query = `SELECT last_sync_date FROM cursors WHERE task_id = ?`;
    const [rows] = await this.db.execute(query, [taskId]);
    
    if (rows.length === 0 || !rows[0].last_sync_date) {
      return '1900-01-01';
    }

    const lastDate = new Date(rows[0].last_sync_date);
    lastDate.setDate(lastDate.getDate() - this.revisionLookbackDays);
    
    return lastDate.toISOString().split('T')[0];
  }
}
```

**Mechanismus (`ON DUPLICATE KEY UPDATE`)**

Der `CursorManager.getStartDate()` subtrahiert den `revisionLookbackDays`-Parameter vom letzten bekannten Sync-Datum. Dadurch ruft der API-Fetcher eine überlappende Zeitreihe ab (die letzten N Tage werden redundant abgefragt). 

Im Adapter sichert das `ON DUPLICATE KEY UPDATE` basierend auf dem Unique Key (Datum + Metrik-ID) die Integrität ab:

```sql
INSERT INTO fred_series (series_id, obs_date, value)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE value = VALUES(value);
```

Ursprünglich fehlende oder unfertige Werte (`.`, erfasst als `null`) werden bei einem erneuten Insert des Datums atomar durch die mittlerweile revidierten, finalen Werte von FRED überschrieben.
