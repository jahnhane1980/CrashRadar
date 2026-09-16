# Stand der Dokumentations-Entschlackung (DOC_CLEANUP.md)

## 📌 Letzte Status-Meldung & Nächster Schritt (Exakter Wortlaut)

Damit ist **Säule 1 (`docs/architecture/`) vollständig sauber, schlank und zu 100 % link-valide (0 tote Links über alle 29 Dateien)**! 🚀

---

## 🏛️ Start von Säule 2: `docs/research/` (46 Dateien in 7 Ordnern)

Ein repo-weiter Scan aller 46 Research-Dateien hat gezeigt, dass die Forschungsinhalte extrem tiefgehend und wertvoll sind, aber über die Monate einige tote Links und fragmentierte Kleinst-Dateien entstanden sind.

Gehen wir Ordner für Ordner vor, beginnend mit **`docs/research/dalio-cycles/`**:

---

### Befund zu `docs/research/dalio-cycles/` (4 Dateien, 239 Zeilen gesamt)

Im Ordner liegen aktuell 4 fragmentierte Dateien:
1. [`These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/These.md) (82 Zeilen): Zusammenfassung von Dalios Schulden-Video & Formulierung der Hauptthese.
2. [`Daten_zur_These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Daten_zur_These.md) (63 Zeilen): Kurz- vs. Langfristiger Schuldenzyklus & Status-Quo-Standort (Spätzyklus Stage 5).
3. [`Backtest_3_von_4_Regel.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Backtest_3_von_4_Regel.md) (41 Zeilen): Backtest der "3 von 4 ROT"-Bedingung (1970–2026).
4. [`Empirische_Auswertung_Dalio_These.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/Empirische_Auswertung_Dalio_These.md) (53 Zeilen): Auswertung von Zinskurven-Inversions-Lags (Ø 12,2 Mo. Rezession, Ø 15,7 Mo. S&P Tief) und Zinslastquote ($\frac{\text{Zinsen}}{\text{Steuern}} > 33\,\%$).  
   *(Enthält einen toten Link auf `file:///D:/GitHub/CrashRadar/These.md`)*

### Bewertung & Empfehlung:
Alle 4 Dokumente behandeln dieselbe zusammenhängende Studie (Theorie $\rightarrow$ Daten $\rightarrow$ Backtest $\rightarrow$ Auswertung). Einzeln sind sie mit 40–80 Zeilen stark zersplittert.

**Konkreter Vorschlag:**
* **Zusammenführen in 1 Master-Studie:**  
  [`docs/research/dalio-cycles/Ray-Dalio-Schuldenkrisen-Studie.md`](file:///D:/GitHub/CrashRadar/docs/research/dalio-cycles/)
  * *Kapitel 1:* Dalios Modell, Schuldenzyklen & Hypothesenbildung
  * *Kapitel 2:* Kurz- vs. Langzeit-Zyklen & Diagnose des aktuellen Spätzyklus (Stage 5)
  * *Kapitel 3:* Die 3-von-4-Regel & Historischer 56-Jahre-Backtest (1970–2026)
  * *Kapitel 4:* Empirische Evaluierung der Lags, staatliche Zinslastquote & Net-Liquidity-Synthese
* Die 4 fragmentierten Ursprungsdateien nach dem Merge löschen.
* Den Eintrag in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md) auf diese neue, gebündelte Master-Studie aktualisieren.

Soll ich die 4 Dalio-Dateien zu dieser einen Master-Studie zusammenführen?

---

## 🛠️ Was bisher bearbeitet und abgeschlossen wurde

### 1. Schritt 1: Archiv- & Dubletten-Bereinigung (Abgeschlossen)
* **6 obsolete Archiv-Dateien gelöscht** (1.695 Zeilen Altlasten entfernt):
  * `docs/architecture/strategies/guru-archive/7-Slot-Guru-Konsens-System-v2.1-Archive.md`
  * `docs/architecture/strategies/kamikaze-archive/01-Post-Ipo-Growth-Engine-archive.md`
  * `docs/architecture/strategies/kamikaze-archive/02-Turnaround-Framework-archive.md`
  * `docs/architecture/strategies/kamikaze-archive/03-Stock-Radar-Interface-archive.md`
  * `docs/architecture/strategies/kamikaze-archive/Kamikaze-Growth-v1.1-archive.md`
  * `docs/research/DailyPortfolioCompass/ADR-Thesen-Synthese-Archive.md`
* **Ordner-Konsolidierung:**
  * Leere Verzeichnisse `guru-archive/` und `kamikaze-archive/` gelöscht.
  * `docs/architecture/strategies/kamikaze/Kamikaze-Master-Drehbuch.md` direkt in `docs/architecture/strategies/Kamikaze-Growth.md` integriert und den 23-Zeilen-Stub sowie den Unterordner `kamikaze/` gelöscht.

### 2. Schritt 2: Säule 1 – `docs/architecture/` (Vollständig abgeschlossen)
* **Block 1 (APIs, Data & Database):**
  * `docs/architecture/api/Yahoo-Finance.md` von einem 20-Byte-Stub zu einer vollwertigen Spezifikation (Futures, DXY, Rohstoffe, `market_data_yahoo`) ausgebaut.
  * Veraltete `../../scripts/`-Pfade in `Binance.md`, `Fiscaldata.md`, `Stlouisfed.md` und `Tiingo.md` bereinigt.
  * `docs/architecture/database/Macro-Calendar-Events.md` nach `docs/architecture/data/Macro-Calendar-Events.md` verschoben und den 1-Dateien-Ordner `database/` aufgelöst. Alle 7 repo-weiten Verweise aktualisiert.
  * `docs/architecture/data/System-Overlap-Datacenter-CrashRadar.md` gemäß Nutzer-Order **strikt unangetastet als eigenständiges Abgrenzungsdokument** belassen. Geplante Adapter (`PolygonFetchAdapter.js`, `GrowthStockRadar.js`) als Code ohne tote Klick-Links formatiert.
* **Block 2 (Signale & Single-Asset-Radar):**
  * Tippfehler korrigiert: `M5Candels.md` $\rightarrow$ `M5Candles.md` (via `git mv`).
  * `M5Candles.md` gestrafft: Fremde `datacenter`-Pfade durch native CrashRadar-Autarkie ersetzt und 120 Zeilen redundante JSON-Tasks kondensiert.
  * `docs/architecture/signals/Makrowetter-Audit-und-Refactoring.md` als abgeschlossenes Audit nach `docs/research/methodology-audits/Makrowetter-Audit.md` überführt.
  * Querverweise in `SingleAssetTrading.md`, `Single-Asset-Radar-Architecture.md` und `docs/README.md` aktualisiert.
* **Block 3 (Makro-Systeme & Machine Learning):**
  * `docs/architecture/macro/ScenarioChecklistService-Gap-Analyse.md` via `git mv` nach `docs/research/methodology-audits/ScenarioChecklist-Audit.md` überführt.
  * `docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`: Veraltete FRED Release-IDs in Tabelle 3 korrigiert (`192` für JOLTS, `46` für PPI) und Referenzen auf die gelöschte `Macro-Scenarios-Config.json` bereinigt.
  * `docs/architecture/macro/Checkliste-Goldilocks-Szenarios.md`: Header als operative Referenz-Checkliste (Musterzyklus September 2026) gekennzeichnet.
  * `docs/architecture/macro/Derivate-OpEx-Kalender-Konzept.md`: Service-Link auf [`DerivativesSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/DerivativesSensorHub.js) aktualisiert.
  * `docs/architecture/ml/ML_ARCHITECTURE.md`: Veralteten `TODO`-Status entfernt und die real vorhandenen Strategy-Pattern Builder ([`src/ml/features/`](file:///D:/GitHub/CrashRadar/src/ml/features/): `DefaultFeatureBuilder.js`, `FinraFeatureBuilder.js`, `NVTS`, `PLTR`, `S`, `SOFI`, `ZETA`) sowie [`ModelEvaluator.js`](file:///D:/GitHub/CrashRadar/src/ml/ModelEvaluator.js) dokumentiert.
* **Block 4 (Portfoliostrategien & Signaldienst):**
  * Alle 6 Strategien (`7-Slot-Guru-Konsens-System.md`, `Gold-GDX.md`, `Gold-SPY.md`, `Kamikaze-Growth.md`, `Muzzled-Cathie-Wood.md`, `Satelite.md`) verifiziert – 100 % intakt, 0 tote Links.
  * `docs/architecture/signal-service/Investment-Signaldienst.md`: 11 tote Links bereinigt:
    * Strategie-Vertrag auf [`PortfolioStrategyInterface.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyInterface.js) verlinkt.
    * Noch ungebaute V2-Klassen (`BrokerAdapterInterface.js`, `InteractiveBrokersAdapter.js`, `BrokerReconciliationService.js`, `SnapshotExporterService.js`, `TelegramService.js`) als Code-Text formatiert.
    * Veraltete Indikator-Links auf [`MarketBottomSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/MarketBottomSensorHub.js), [`CryptoSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js) und [`BtcTrendSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/BtcTrendSensor.js) umgestellt.
* **Ergebnis Säule 1:** **Alle 29 Markdown-Dateien in `docs/architecture/` sind zu 100 % link-valide (0 tote Links).**

### 3. Qualitätssicherung, Index & Wissensgraph
* **Index-Konsistenz:** [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md) vollständig gepflegt und überprüft (0 fehlende Links).
* **Testsuite:** Vitest-Lauf mit **91/91 Testdateien bestanden**, 722 Tests grün, 1 Test übersprungen.
* **Watchdog:** [`tools/sandbox_watchdog.js`](file:///D:/GitHub/CrashRadar/tools/sandbox_watchdog.js) meldet sauberen Zustand.
* **Wissensgraph:** `python -m graphify update .` erfolgreich ausgeführt (3.487 Nodes, 4.713 Edges, 319 Communities synchronisiert).

---

## 🎯 Nächster Schritt bei Fortsetzung:
Sobald die nächste Session startet:
1. Freigabe der Zusammenführung von `docs/research/dalio-cycles/` (4 Dateien $\rightarrow$ `Ray-Dalio-Schuldenkrisen-Studie.md`).
2. Anschließende Bereinigung der verbleibenden Research-Ordner (`DailyPortfolioCompass/`, `macro-proofs/`, `strategies/`, `turnarounds/`).
