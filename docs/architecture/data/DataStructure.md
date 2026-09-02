# Datenstruktur & ER-Modell 

## 1. Relationales Schema (Analytischer Fokus)

Das Schema ist strikt relational aufgebaut, um hochperformante Zeitreihen- und Analytics-Queries (z.B. Moving Averages) direkt via SQL auszuführen. Paginierungsdaten und API-Metadaten werden separiert.

```mermaid
erDiagram
    sync_locks ||--o| sync_states : "controls"
    sync_states {
        varchar job_id PK
        varchar provider "binance|fred|tiingo|fiscal"
        json cursor_data "Paginierungsmarker (z.B. last_timestamp)"
        timestamp updated_at
    }
    sync_locks {
        varchar lock_key PK
        timestamp expires_at
    }

    market_data_binance {
        varchar symbol PK
        varchar interval_type PK
        bigint open_time PK
        decimal open
        decimal high
        decimal low
        decimal close
        decimal volume
        decimal quote_asset_volume
        int trades
        decimal taker_buy_base_asset_volume
        bigint close_time
    }

    market_data_tiingo {
        varchar symbol PK
        date record_date PK
        varchar resolution "1min|5min|daily" PK
        decimal open
        decimal high
        decimal low
        decimal close
        decimal volume
    }

    econ_fred {
        varchar series_id PK
        date observation_date PK
        decimal value
    }

    fiscal_tga {
        date record_date PK
        decimal open_balance
        decimal close_balance
    }

    fiscal_auctions {
        date auction_date PK
        varchar cusip PK
        varchar security_type
        decimal total_accepted
        decimal high_yield
    }
```

## 2. Tabellen-Definitionen & Indizes

### Orchestrierung & State
**`sync_locks`**
- `lock_key` (VARCHAR 100, PK)
- `expires_at` (TIMESTAMP)

**`sync_states`**
- `job_id` (VARCHAR 100, PK)
- `provider` (VARCHAR 50)
- `cursor_data` (JSON) - z.B. `{"lastCloseTime": 1690000000}`
- `updated_at` (TIMESTAMP)

### Nutzdaten-Tabellen
**`market_data_binance`**
- *Primary Key:* `(symbol, interval_type, open_time)`
- *Datentypen:* `DECIMAL(36,18)` für alle Preis/Volumen-Werte. `open_time` als `BIGINT`.
- *Verhalten:* `ON DUPLICATE KEY UPDATE close=VALUES(close), volume=VALUES(volume)`

**`econ_fred`**
- *Primary Key:* `(series_id, observation_date)`
- *Verhalten:* Fehlende Werte (`.` in der API) werden vom Mapper auf SQL `NULL` gesetzt.

## 3. ACID-Transaktionen
Um Inkonsistenzen bei CI-Abbrüchen zu verhindern, werden Insert-Batches immer mit dem State gekoppelt:
```sql
START TRANSACTION;
INSERT INTO market_data_binance (...) VALUES (...) ON DUPLICATE KEY UPDATE ...;
UPDATE sync_states SET cursor_data = '...' WHERE job_id = '...';
COMMIT;
```
