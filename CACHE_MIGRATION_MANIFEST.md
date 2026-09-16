# Cache-to-Database Migration Manifest

Dieses Dokument dient als zentrale Steuer- und Tracking-Zentrale für die Überführung aller flüchtigen JSON-Dateien aus `data/cache/` in die relationale MySQL-Datenbank (**TiDB Cloud**).

Es dokumentiert exakt:
1. Welche Cache-Dateien bereits vollständig in welche DB-Tabelle überführt wurden.
2. Welche Skripte aktuell noch auf diese Cache-Dateien zugreifen und umgebaut werden müssen.
3. Welche Dateien nach dem Skript-Umbau sicher gelöscht werden können.

---

## 1. Bereits in die DB überführte Cache-Bestände

| Quell-Pfad / Muster | Dateien | Datensätze | Ziel-Tabelle (MySQL) | Primärschlüssel (PK) | Migrations-Tool | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `data/cache/sec_13f/<CIK>/*.json` | **252** | 14.882 pos. | `fund_13f_holdings` | `(cik, report_date, cusip, put_call)` | [`tools/import_historical_13f_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_historical_13f_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/strategies/ark_filings/13f_*.json` | **39** | 8.431 pos. | `fund_13f_holdings` | `(cik, report_date, cusip, put_call)` | [`tools/import_historical_13f_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_historical_13f_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/strategies/ark_filings/trust_*.json` | **10** | 1.321 pos. | `fund_trust_holdings` | `(cik, report_date, issuer_name)` | [`tools/import_ark_trust_holdings_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_ark_trust_holdings_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/strategies/fundamentals_master.json` | **1** | 933 Quartale (29 Ticker) | `company_fundamentals` | `(symbol, date, period)` | [`tools/import_fundamentals_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_fundamentals_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/strategies/fundamentals/*.json` | **8** | 232 Quartale (8 Ticker) | `company_fundamentals` | `(symbol, date, period)` | [`tools/import_fundamentals_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_fundamentals_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/turnarounds/parsed_fundamentals_master.json` | **1** | 470 Quartale (20 Ticker) | `company_fundamentals` | `(symbol, date, period)` | [`tools/import_fundamentals_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_fundamentals_to_db.js) | ✅ In DB (Bereit für Skript-Umbau & Löschung) |
| `data/cache/strategies/prices/*.json` (36 Ticker) | **36** | 89.341 volle OHLCV-Bars | `market_data_yahoo` | `(symbol, record_date)` | [`tools/import_full_ohlcv_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_full_ohlcv_to_db.js) | ✅ In DB (100% volles OHLCV, keine NULLs) |
| Yahoo Finance API Backfill (56 Ticker) | **56** Ticker | 137.907 volle OHLCV-Bars | `market_data_yahoo` | `(symbol, record_date)` | [`tools/backfill_missing_yahoo_ohlcv.js`](file:///D:/GitHub/CrashRadar/tools/backfill_missing_yahoo_ohlcv.js) | ✅ In DB (100% volles OHLCV, 2014–2026) |
| `data/cache/macro/fiscaldata_*.json` | **3** | 26.655 Zeilen | `fiscal_auctions` & `fiscal_tga` | CUSIP / Datum | DB war bereits vollständiger | 🗑️ **Bereits direkt gelöscht (38,2 MB frei)** |
| `data/cache/macro/fred_*.json` | **12** | 10.195 Beobachtungen | `econ_fred` | `(series_id, observation_date)` | [`tools/import_macro_fred_to_db.js`](file:///D:/GitHub/CrashRadar/tools/import_macro_fred_to_db.js) | ✅ In DB (133.947 Zeilen in DB) |
| `data/cache/dalio_cycles/*.json` | **17** | 44.712 Beobachtungen | `econ_fred` | `(series_id, observation_date)` | [`tools/import_dalio_cycles_to_fred.js`](file:///D:/GitHub/CrashRadar/tools/import_dalio_cycles_to_fred.js) | ✅ In DB (168.114 Zeilen in DB über 72 Serien) |

* **Gesamtstand Schritt A (13F & Trust):** **301 Cache-Dateien** mit **24.634 Positionen** in `fund_13f_holdings` (23.709 Zeilen) und `fund_trust_holdings` (1.321 Zeilen).
* **Gesamtstand Schritt B (Fundamentaldaten):** **10 Cache-Dateien** mit **1.301 konsolidierten Quartalen** über **41 Ticker** in `company_fundamentals` (1.367 Zeilen). Schema um `filing_date`, `yoy_revenue_growth_pct`, `gross_profit`, `operating_cash_flow` und `eps` erweitert.
* **Gesamtstand Schritt C (Aktienkurse & Marktdaten):** **101 Symbole** mit **283.969 Tageskerzen** (2014–2026) in `market_data_yahoo`. Alle 92 Aktien/ETFs liegen mit 100% vollständigem OHLCV ohne NULL-Werte vor.
* **Gesamtstand Schritt D & E (Makro- & Zyklen-Caches):** **3 FiscalData-Dateien (38,2 MB) + 26 Turnaround-Dateien (108,3 MB) sofort gelöscht (insg. 146,5 MB)**. **29 FRED- & Zyklen-Dateien (54.907 Beobachtungen)** vollständig in `econ_fred` (168.114 Zeilen über 72 Serien) überführt. S&P 500 reicht nun bis 1970 zurück, Rezessionen bis 1854. Die echten Simulations- & Forschungs-Artefakte verbleiben legitim im Cache.

---

## 2. Betroffene Skripte & Notwendige Anpassungen

Bevor die migrierten Cache-Dateien gelöscht werden können, müssen folgende Skripte so umgebaut werden, dass sie aus der Datenbank statt aus dem Dateisystem lesen:

### A. 13F & Trust-Filings
| Skript | Bisheriger Zugriff | Zukünftiger Zugriff (DB) | Status |
| :--- | :--- | :--- | :--- |
| [`tools/build_ark_historical_watchlist.js`](file:///D:/GitHub/CrashRadar/tools/build_ark_historical_watchlist.js) | Liest 49 Dateien aus `data/cache/strategies/ark_filings/*.json` | SQL-Query auf `fund_trust_holdings` (2014–2017) und `fund_13f_holdings` (ab 2017) | ⏳ Offen für Refactoring |
| [`tools/fetch_historical_13f_cache.js`](file:///D:/GitHub/CrashRadar/tools/fetch_historical_13f_cache.js) | Speichert XML-Parsing direkt in `data/cache/sec_13f/` | Speichert direkt via `SecEdgar13FAdapter` in `fund_13f_holdings` | ⏳ Offen für Refactoring |
| [`tools/fetch_ark_historical_13f.js`](file:///D:/GitHub/CrashRadar/tools/fetch_ark_historical_13f.js) | Speichert Downloads in `data/cache/strategies/ark_filings/` | Kann durch Standard `SecEdgar13FFetchAdapter` ersetzt werden | ⏳ Veraltet (kann archiviert werden) |

### B. Fundamentaldaten
| Skript | Bisheriger Zugriff | Zukünftiger Zugriff (DB) | Status |
| :--- | :--- | :--- | :--- |
| [`simulations/MuzzledCathieWoodSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/MuzzledCathieWoodSimulation.js) | Liest `data/cache/strategies/fundamentals_master.json` | `SELECT * FROM company_fundamentals WHERE symbol IN (...)` | ⏳ Offen für Refactoring |
| [`simulations/KamikazeGrowthSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/KamikazeGrowthSimulation.js) | Liest `data/cache/strategies/fundamentals_master.json` | `SELECT * FROM company_fundamentals WHERE symbol IN (...)` | ⏳ Offen für Refactoring |
| [`simulations/TurnaroundSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/TurnaroundSimulation.js) | Liest `data/cache/turnarounds/parsed_fundamentals_master.json` | `SELECT * FROM company_fundamentals WHERE symbol IN (...)` | ⏳ Offen für Refactoring |
| [`simulations/GrowthLifecycleSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/GrowthLifecycleSimulation.js) | Liest `data/cache/turnarounds/parsed_fundamentals_master.json` | `SELECT * FROM company_fundamentals WHERE symbol IN (...)` | ⏳ Offen für Refactoring |
| [`tools/fetch_and_cache_fundamentals.js`](file:///D:/GitHub/CrashRadar/tools/fetch_and_cache_fundamentals.js) | Schreibt in `data/cache/strategies/fundamentals_master.json` | Schreibt via `YahooFinanceAdapter` / Storage direkt in DB | ⏳ Offen für Refactoring |
| [`src/core/repositories/AnalysisRepository.js`](file:///D:/GitHub/CrashRadar/src/core/repositories/AnalysisRepository.js#L137) | Query selektiert bisher kein `filing_date`, `yoy_revenue_growth_pct` | SQL-Query um neue Spalten `filing_date`, `yoy_revenue_growth_pct`, `gross_profit`, `operating_cash_flow`, `eps` und `endDate` erweitert | ✅ Abgeschlossen |

### C. Aktienkurse (Marktdaten)
| Skript | Bisheriger Zugriff | Zukünftiger Zugriff (DB) | Status |
| :--- | :--- | :--- | :--- |
| [`simulations/SevenSlotGuruSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/SevenSlotGuruSimulation.js#L18) | Liest/Cached in `data/cache/historical_prices/` | Liest direkt via MySQL-Pool aus `market_data_yahoo` | ✅ Abgeschlossen (Kein Disk-Cache mehr) |
| [`simulations/SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/SatelliteCoreSimulation.js#L16) | Liest/Cached in `data/cache/historical_prices/` | Liest über `AnalysisRepository.getOhlcvForTicker()` aus DB | ⏳ Nächster Task (Paket 2) |
| [`simulations/RunStrategyStressTests.js`](file:///D:/GitHub/CrashRadar/simulations/RunStrategyStressTests.js#L14) | Liest aus `data/cache/historical_prices/` | Liest über `AnalysisRepository.getOhlcvForTicker()` aus DB | ⏳ Offen für Refactoring |
| [`simulations/MuzzledCathieWoodSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/MuzzledCathieWoodSimulation.js#L18) | Liest aus `data/cache/historical_prices/` | Liest über `AnalysisRepository.getOhlcvForTicker()` aus DB | ⏳ Offen für Refactoring |
| [`tools/cache_historical_prices_2014_2026.js`](file:///D:/GitHub/CrashRadar/tools/cache_historical_prices_2014_2026.js#L11) | Schreibt in `data/cache/strategies/prices/` | Veraltet (ersetzt durch DB-Backfill) | ⏳ Veraltet (kann archiviert werden) |
| Research-Skripte (`research/turnaround-studies/*.js`) | Lesen aus `data/cache/turnarounds/*_daily.json` | Lesen direkt aus `market_data_yahoo` via DB-Pool | ⏳ Offen für Refactoring |

### D. Makro- & Zyklen-Skripte
| Skript | Bisheriger Zugriff | Zukünftiger Zugriff (DB) | Status |
| :--- | :--- | :--- | :--- |
| [`research/dalio-cycles/validate_dalio_thesis.py`](file:///D:/GitHub/CrashRadar/research/dalio-cycles/validate_dalio_thesis.py) | Liest 8 JSON-Dateien aus lokalem Pfad | Liest aus `econ_fred` (MySQL) via mysql-connector / sqlite-Export | ⏳ Offen für Refactoring |
| [`research/dalio-cycles/test_3_of_4_system.py`](file:///D:/GitHub/CrashRadar/research/dalio-cycles/test_3_of_4_system.py) | Liest 9 JSON-Dateien aus lokalem Pfad | Liest aus `econ_fred` (MySQL) via mysql-connector / sqlite-Export | ⏳ Offen für Refactoring |

---

## 3. Zur Löschung vorgemerkte Dateien (nach Skript-Umbau)

### Bereits gelöscht:
* `data/cache/macro/fiscaldata_auctions.json` (27,94 MB) – 🗑️ Gelöscht
* `data/cache/macro/fiscaldata_tga.json` (5,85 MB) – 🗑️ Gelöscht
* `data/cache/macro/fiscaldata_tga_recent.json` (4,44 MB) – 🗑️ Gelöscht
* `data/cache/turnarounds/*_sec_facts.json` (**23 Dateien**, 101,65 MB) – 🗑️ Gelöscht
* `data/cache/turnarounds/sofi_*.htm` (**3 Dateien**, 6,64 MB) – 🗑️ Gelöscht
*(Insgesamt **29 Dateien mit 146,52 MB** bereits freigegeben).*

### Vorgemerkt zur Löschung nach Skript-Umbau:
* `data/cache/sec_13f/` (**252 Dateien** vollständig löschen)
* `data/cache/strategies/ark_filings/` (**49 Dateien** vollständig löschen)
* `data/cache/strategies/fundamentals_master.json` (**1 Datei** löschen)
* `data/cache/strategies/fundamentals/` (**8 Dateien** vollständig löschen)
* `data/cache/turnarounds/parsed_fundamentals_master.json` (**1 Datei** löschen)
* `data/cache/strategies/prices/` (**39 Dateien** vollständig löschen)
* `data/cache/historical_prices/` Root (**82 Dateien** vollständig löschen)
* `data/cache/historical_prices/daily_10y/` (**48 Dateien** vollständig löschen)
* `data/cache/historical_prices/prices_10y/` (**48 Dateien** vollständig löschen)
* `data/cache/turnarounds/*_daily.json` (**39 Dateien** vollständig löschen)
* `data/cache/macro/fred_*.json` (**12 Dateien** vollständig löschen)
* `data/cache/dalio_cycles/` (**17 Dateien** vollständig löschen)

**Insgesamt nach Skript-Umbau löschbar:** **595 Cache-Dateien (~61 MB)**!

### Bleibt legitim im Cache erhalten (Berechnungs-Artefakte nach AGENTS.md):
* `data/cache/macro/capacity_model_results.json`
* `data/cache/macro/full_21y_backtest_results.json`
* `data/cache/macro/grand_prix_all_indicators_results.json`
* `data/cache/macro/projection_results.json`
* `data/cache/portfolio_compass/adr*.json`
* `data/cache/turnarounds/*_m5_rth_aggregated.json` (5 Intraday-M5-Dateien)
* `data/cache/turnarounds/*.json` (11 Simulations- & Studien-Logs)

---

## 4. Nächste Schritte (Backlog)

* [x] **Schritt A: 13F & Trust-Filings** (Erfolgreich in `fund_13f_holdings` und `fund_trust_holdings` überführt)
* [x] **Schritt B: Fundamentaldaten** (Erfolgreich in `company_fundamentals` überführt, Schema erweitert)
* [x] **Schritt C: Aktienkurse (Marktdaten)**
  * [x] **Stufe C.1:** 36 Cache-Dateien mit 100% vollem OHLCV in `market_data_yahoo` eingespielt (89.341 Zeilen)
  * [x] **Stufe C.2:** 56 Ticker mit 10-Jahres-OHLCV via Yahoo-API nachgeholt (137.907 Zeilen)
* [x] **Schritt D: Redundante Makro-Caches**
  * [x] **3 FiscalData-Dateien (38,2 MB)** sofort gelöscht
  * [x] **12 FRED-Serien (10.195 Zeilen)** in `econ_fred` eingespielt
* [x] **Schritt E.1: Bereinigung `turnarounds/` Rohdateien**
  * [x] **23 SEC-Facts Rohdateien + 3 SoFi-HTMLs (108,29 MB)** sofort gelöscht
* [x] **Schritt E.2: Bereinigung / Import `dalio_cycles/`**
  * [x] **17 Serien (44.712 Beobachtungen)** in `econ_fred` eingespielt
* [ ] **Schritt F: Refactoring der Consumer-Skripte** (Umstellung auf DB-Zugriff)
  * [x] **Paket 1:** `src/core/repositories/AnalysisRepository.js` um `filing_date`, `yoy_revenue_growth_pct`, `gross_profit`, `operating_cash_flow`, `eps` und `endDate` erweitert (7/7 Tests grün)
  * [ ] **Paket 2:** Simulationen auf DB umstellen
    * [x] `simulations/SevenSlotGuruSimulation.js`: Umgestellt auf `market_data_yahoo`
    * [ ] `simulations/SatelliteCoreSimulation.js`: Umstellen auf `market_data_yahoo` (NÄCHSTER SCHRITT)
  * [ ] **Paket 3:** `simulations/MuzzledCathieWoodSimulation.js` & `KamikazeGrowthSimulation.js` (Kurse & Fundamentaldaten auf DB umstellen)
  * [ ] **Paket 4:** `tools/build_ark_historical_watchlist.js` & Research-Skripte auf DB umstellen
* [ ] **Schritt G: Sicheres Löschen der 595 vorgemerkten Cache-Dateien**

---

## 5. Übergabe-Protokoll & Aktueller Stand (Session-Checkpoint)

* **Aktueller Arbeitsstand:**
  1. Alle Datenbestände (13F, Fundamentaldaten, Aktienkurse, Makrodaten, Dalio-Zyklen) sind vollständig in der relationalen TiDB Cloud MySQL migriert.
  2. 29 Rohdateien (146,52 MB) wurden bereits physisch gelöscht.
  3. `AnalysisRepository.js` stellt alle neuen Spalten und Filteroptionen per SQL bereit (Tests 100% grün).
  4. `SevenSlotGuruSimulation.js` liest Kurse nun direkt via SQL aus `market_data_yahoo` und benötigt keinen Disk-Cache mehr.
* **Exakter nächster Task bei Wiederaufnahme:**
  * **Schritt F / Paket 2:** In [`simulations/SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/SatelliteCoreSimulation.js) die Funktion `getHistoricalPrices` analog auf `market_data_yahoo` umstellen.
  * Danach folgt die Umstellung von [`simulations/MuzzledCathieWoodSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/MuzzledCathieWoodSimulation.js).
* **Repository-Zustand:**
  * Tests: 721 Tests bestanden, 0 Fehler.
  * Sandbox: Absolut sauber (`tools/sandbox_watchdog.js` 0 Warnungen).
