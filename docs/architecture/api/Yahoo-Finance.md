# Yahoo Finance API - Rohstoffe, Futures & Währungsindizes

> 🏛️ **Dokumenten-Typ:** Schnittstellen-Spezifikation (System Architecture & Ingestion)  
> 📁 **Bereich:** `docs/architecture/api/`  
> ⚙️ **Konfiguration:** [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json)  
> 🗄️ **MySQL-Zieltabelle:** `market_data_yahoo`  

---

## 1. Rolle & Verwendungszweck im System

Yahoo Finance wird in CrashRadar über die Node.js-Bibliothek `yahoo-finance2` als autarker Provider für Marktsegmente genutzt, die weder über Tiingo noch über Binance abgedeckt werden:
1. **Rohstoff-Futures:** Echtzeitnahe und historische Settlement-Preise für Gold, Öl und Kupfer.
2. **Währungsindizes:** Der US-Dollar-Index (DXY) als globaler Liquiditäts- und Refinanzierungsanker.
3. **Kredit- & Debt-Proxies:** High-Yield- und BDC-Tracker zur Stresstest-Analyse.

---

## 2. Abgerufene Ticker & Messgrößen

Die folgenden Ticker werden im nächtlichen EOD-Lauf über den `TimeSeriesFetcher` automatisch aktualisiert:

| Symbol / Ticker | Anlageklasse | Beschreibung & Verwendung im System |
| :--- | :--- | :--- |
| **`DX-Y.NYB`** | Währung | **US Dollar Index (DXY):** Wichtigster Liquiditäts- und Devisenanker; invertierte Korrelation zu Risiko-Assets. |
| **`GC=F`** | Rohstoff | **Gold Futures (Comex):** Tägliche Benchmark für Krisen-Hedges und die `GoldSpyDcaStrategy`. |
| **`CL=F`** | Rohstoff | **Crude Oil WTI (Nymex):** Frühwarnsystem für geopolitischen Öl-Stress & Stagflations-Regimes (`MacroLiquiditySensorHub`). |
| **`HG=F`** | Rohstoff | **Copper Futures (Comex):** „Dr. Copper“ als weltweiter Frühindikator für konjunkturelle Industrie-Nachfrage. |
| **`HYG`** | Kredit | **iShares iBoxx $ High Yield Corporate Bond ETF:** Kreditmarkt-Stresstests und Renditedivergenzen. |
| **`BIZD`, `BKLN`, `ARCC`** | Kredit | **Private Credit & BDCs:** Frühindikatoren für Liquiditäts- und Ausfallrisiken im US-Mittelstand. |

---

## 3. Technische Umsetzung & Speicherung

* **Adapter-Aufruf:** Über die `Storage.js` Schnittstelle mit Methode `chart`.
* **Parameter & Paginierung:** Keine API-Keys erforderlich (öffentlicher Scrape-Endpunkt).
* **MySQL-Schema (`market_data_yahoo`):**
  * `symbol` (VARCHAR, PK)
  * `record_date` (DATE, PK)
  * `open`, `high`, `low`, `close` (DECIMAL)
  * `volume` (BIGINT / DECIMAL)
  * `ON DUPLICATE KEY UPDATE close=VALUES(close), volume=VALUES(volume)`
* **Repository-Anbindung:** [`AnalysisRepository.js`](file:///D:/GitHub/CrashRadar/src/core/repositories/AnalysisRepository.js) stellt die Daten für Sensor-Hubs und Indikatoren-Pipelines bereit.
