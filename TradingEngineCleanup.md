Hier ist die vollständige, transparente Analyse aller Dateien, die vom Ausbau der **Trading Engine / TradeSetupEngine** betroffen sind.

---

### 🔍 Wichtiger Transparenz-Befund vorab (Indikatoren)

> [!NOTE]
> Du hast angemerkt: *„Die Indikatoren sollen bleiben, Macroengine verwendet sie ja.“*  
> **Der Code-Befund dazu:**  
> Im Projekt gibt es zwei Gruppen von Indikatoren:
> 1. **Makro-Indikatoren (Topf A, 21 Stück):** Werden von der [`MacroRegimeEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/MacroRegimeEngine.js) genutzt (z. B. `TreasuryCapacity`, `YieldCurve`, `MarginDebt`, `KatastrophenMatrix`, `GoldSniper`, `PanicCapitulation` etc.). Diese bleiben zu 100 % in Betrieb.
> 2. **Setup-Indikatoren (Topf B, 14 Stück):** Wurden bisher **ausschließlich** von der `TradeSetupEngine.js` geladen (z. B. `GoldVolumeClimax`, `GdxSellingClimax`, `BitcoinDivergence`, `CryptoCycleDivergence`, `TechCycleRadar` etc. – Ausnahme: `BtcTrailingStopIndicator`, der auch in der `PortfolioStrategyEngine` verwendet wird).  
> 
> **Konsequenz:** Alle Indikatoren-Dateien in `src/analysis/indicators/` bleiben natürlich erhalten und kompilierbar. Die 13 reinen Setup-Indikatoren werden nach dem Ausbau der `TradeSetupEngine` im täglichen Lauf lediglich nicht mehr automatisch getriggert, bis sie ggf. künftig in neue SensorHubs überführt werden.

---

### 1. Dateien, die KOMPLETT GELÖSCHT werden können

#### 💻 Sourcecode & Tests
* ✅ **GELÖSCHT:** `src/analysis/TradeSetupEngine.js`
* ✅ **GELÖSCHT:** `tests/analysis/TradeSetupEngine.test.js`

#### 📄 Dokumentation
* ✅ **GELÖSCHT:** `docs/architecture/trading-engine/TradingEngine.md` *(und gesamtes Verzeichnis `docs/architecture/trading-engine/` entfernt).*
* ✅ **REFERENZEN BEREINIGT:** Querverweise in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md), [`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md) und [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md) wurden auf [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) umgestellt bzw. entfernt.

---

### 2. Dateien, die ANGEPASST werden müssen

#### 💻 Sourcecode & Konfiguration
* ✅ **[`src/analysis/IndicatorEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/IndicatorEngine.js)**:
  * Import von `TradeSetupEngine` entfernt (`L11`).
  * Instanziierung `this.tradeSetupEngine` im Konstruktor entfernt (`L37`).
  * In `_evaluateState()` den Aufruf `this.tradeSetupEngine.evaluate()` entfernt (`L44`).
  * `tradeActions` aus der Rückgabe bzw. Weitergabe an `NotificationManager` entfernt (`L60`, `L69`, `L81`, `L87`).
* ✅ **[`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js)**:
  * In `generateReport()`: Den Block `📈 TRADE ACTIONS (Execution Planer)` entfernt.
  * In `getAlerts()`: Polymorphe Signatur ohne zwingende `tradeActions` eingeführt.
  * In `getDailyStatusReport()`: Ungenutzten Parameter bereinigt.
* ✅ **[`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json)**:
  * Das Array `"tradeSetupIndicators": []` geleert.
* ✅ **[`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json)**:
  * Die 10 Mappings von Setup-Indikatoren auf Notification-Topics bereinigt.

#### ❓ Muss [`index.js`](file:///D:/GitHub/CrashRadar/index.js) angepasst werden?
* **Funktional: Nein! (Erfolgreich live verifiziert)**  
  `index.js` importiert `TradeSetupEngine` nicht direkt. Bei Option `-c, --check-indikator` ruft `index.js` den [`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js) auf. Da dieser über die bereinigte `IndicatorEngine` läuft, funktioniert der CLI-Befehl weiterhin fehlerfrei (er liefert das reine Makro-Wetter und die Makro-Ampeln). Alle CLI-Pfade (`-c`, `-g`, `-s`, `--t212-sync`) wurden erfolgreich getestet.

#### 🧪 Tests & Fixtures
* ✅ **[`tests/analysis/IndicatorEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/IndicatorEngine.test.js)**:
  * Assertion `expect(output).toContain('TRADE ACTIONS')` entfernt.
  * `tradeSetupIndicators: []` und `customEngine.tradeSetupEngine` Assertion bereinigt.
* ✅ **[`tests/services/NotificationManager.test.js`](file:///D:/GitHub/CrashRadar/tests/services/NotificationManager.test.js)**:
  * Testfall 1 an den reinen Makro-Report ohne Trade Actions angepasst.
* ✅ **[`tests/analysis/GoldenMaster.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/GoldenMaster.test.js)**:
  * Import von `TradeSetupEngine` und Testfall 2 entfernt. MacroRegimeEngine Golden Master Test bleibt zu 100 % grün.
* ✅ **[`tests/index.test.js`](file:///D:/GitHub/CrashRadar/tests/index.test.js)**:
  * Testabdeckung für alle CLI-Pfade inklusive `-g` und `--t212-sync` erweitert.

#### 📄 Dokumentation & Roadmap (Kapitel 2.4)
* ✅ **[`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md)**:
  * Im Mermaid-Diagramm `trading-engine/<br>(Portfolio State Machine)` entfernt.
  * Abschnitt `### C. ⚙️ Trading & Execution Engine` entfernt und Folgekapitel renummeriert.
* ✅ **[`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md)**:
  * Kapitel `2.6 Trading & Execution Engine` entfernt (abgedeckt durch [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) in Kapitel 3).
* ✅ **[`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md)**:
  * Kapitel 10 bereinigt und Verweise direkt auf [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) umgestellt.
* ✅ **[`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)**:
  * Zeile `TradeSetupEngine.js <-- Bottom-Finder...` (`L232`) aus dem Verzeichnisbaum entfernt.
* ✅ **[`docs/research/ml-lab/ML_FEATURE_RESEARCH.md`](file:///D:/GitHub/CrashRadar/docs/research/ml-lab/ML_FEATURE_RESEARCH.md)**:
  * Verweise auf `TradeSetupEngine` als Veto-Instanz (`L79`, `L81`, `L82`) neutralisiert und auf Radar/Filter umgestellt.
* ✅ **[`docs/architecture/ml/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md)**:
  * Erwähnung `Ensemble ["Ensemble-Synthese (TradeSetupEngine)"]` (`L120`) und Kapitel 10.1 (`L246-L248`) neutralisiert.
* ✅ **[`docs/research/methodology-audits/Architecture-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Architecture-Audit.md)** & **[`docs/architecture/strategies/Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md)**:
  * Kurze Textverweise auf `TradeSetupEngine` bereinigt.

---

### Status des Fahrplans (Gemäß Code-Buddy Regel 1 & 3)

* ✅ **Schritt 1 (Code & Config bereinigt):**
  * Bereinigung von [`src/analysis/IndicatorEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/IndicatorEngine.js) und [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js).
  * Bereinigung von [`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json) und [`config/Notification-Config.json`](file:///D:/GitHub/CrashRadar/config/Notification-Config.json).
* ✅ **Schritt 2 (Gelöscht):**
  * Löschen von [`src/analysis/TradeSetupEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/TradeSetupEngine.js), [`tests/analysis/TradeSetupEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/TradeSetupEngine.test.js) und [`docs/architecture/trading-engine/`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/).
* ✅ **Schritt 3 (Tests synchronisiert & verifiziert):**
  * Anpassung von [`GoldenMaster.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/GoldenMaster.test.js), [`IndicatorEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/IndicatorEngine.test.js), [`NotificationManager.test.js`](file:///D:/GitHub/CrashRadar/tests/services/NotificationManager.test.js) und [`index.test.js`](file:///D:/GitHub/CrashRadar/tests/index.test.js).
  * Ausführung der gesamten Test-Suite via Vitest (`npm test`): 114 Test-Dateien bestanden, 962 Tests grün, 0 Fehler.
* ✅ **Schritt 4 (Doku & Index-Pflege):**
  * Bereinigung aller Querverweise in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md), [`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md), [`Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md), [`Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md), [`ML_FEATURE_RESEARCH.md`](file:///D:/GitHub/CrashRadar/docs/research/ml-lab/ML_FEATURE_RESEARCH.md), [`Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md), [`Architecture-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Architecture-Audit.md) und [`Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md).

---

### 🎉 Fazit: Rückbau zu 100 % abgeschlossen

Der gesamte Rückbau der obsoleten Trading Engine und der TradeSetupEngine wurde vollständig, rückstandsfrei und verifiziert abgeschlossen. Alle Kernsysteme (MacroRegimeEngine, DailyPortfolioCompass, SensorHubs, PortfolioStrategyEngine und Indikatoren) laufen fehlerfrei.
