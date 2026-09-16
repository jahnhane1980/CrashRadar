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
* 🗑️ **[`src/analysis/TradeSetupEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/TradeSetupEngine.js)**  
  *(Die 205-Zeilen-Klasse zur Orchestrierung der 14 Setup-Indikatoren und Tranchen-Logik).*
* 🗑️ **[`tests/analysis/TradeSetupEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/TradeSetupEngine.test.js)**  
  *(Der zugehörige Unit-Test für Tranchen-Skalierung, Confluence und Asset-Ableitung).*

#### 📄 Dokumentation
* 🗑️ **[`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md)**  
  *(Die V2-Spezifikation der 5-Stufen State Machine und das gesamte Verzeichnis [`docs/architecture/trading-engine/`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/)).*

---

### 2. Dateien, die ANGEPASST werden müssen

#### 💻 Sourcecode
* ✏️ **[`src/analysis/IndicatorEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/IndicatorEngine.js)**:
  * Import von `TradeSetupEngine` entfernen (`L11`).
  * Instanziierung `this.tradeSetupEngine` im Konstruktor entfernen (`L37`).
  * In `_evaluateState()` den Aufruf `this.tradeSetupEngine.evaluate()` entfernen (`L44`).
  * `tradeActions` aus der Rückgabe bzw. Weitergabe an `NotificationManager` entfernen oder bereinigen (`L60`, `L69`, `L81`, `L87`).
* ✏️ **[`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js)**:
  * In `generateReport()`: Den Block `📈 TRADE ACTIONS (Execution Planer)` (`L60-L75`) entfernen.
  * In `getAlerts()`: Die Schleife über `tradeActions` bereinigen (nur noch Makro-Status melden).
  * In `getDailyStatusReport()`: Den ungenutzten Parameter `tradeActions` aus der Signatur entfernen.
* ✏️ **[`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json)**:
  * Das Array `"tradeSetupIndicators": [...]` (`L313-L484`) leeren oder entfernen.

#### ❓ Muss [`index.js`](file:///D:/GitHub/CrashRadar/index.js) angepasst werden?
* **Funktional: Nein!**  
  `index.js` importiert `TradeSetupEngine` nicht direkt. Bei Option `-c, --check-indikator` ruft `index.js` den [`IndicatorAnalysisRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/IndicatorAnalysisRunner.js) auf. Da dieser über die bereinigte `IndicatorEngine` läuft, funktioniert der CLI-Befehl weiterhin fehlerfrei (er liefert dann das reine Makro-Wetter und die Makro-Ampeln).

#### 🧪 Tests & Fixtures
* ✏️ **[`tests/analysis/IndicatorEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/IndicatorEngine.test.js)**:
  * Assertion `expect(customEngine.tradeSetupEngine.indicators.length).toBe(0)` (`L101`) und `tradeSetupIndicators: []` (`L95`) anpassen/entfernen.
* ✏️ **[`tests/analysis/GoldenMaster.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/GoldenMaster.test.js)**:
  * Import von `TradeSetupEngine` (`L5`) und Testfall 2 (`sollte TradeSetupEngine exakt identisch zur Golden-Master Baseline filtern`, `L39-L65`) entfernen. Der Test für die `MacroRegimeEngine` bleibt 100 % erhalten.

#### 📄 Dokumentation & Roadmap
* ✏️ **[`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md)**:
  * Im Mermaid-Diagramm `trading-engine/<br>(Portfolio State Machine)` (`L19`) entfernen.
  * Abschnitt `### C. ⚙️ Trading & Execution Engine` (`L63-L66`) entfernen.
* ✏️ **[`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md)**:
  * Kapitel `2.6 Trading & Execution Engine (Portfolio State Machine & ML)` (`L211-L214`) entfernen oder als obsolet streichen (da die moderne [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) diese Aufgabe übernommen hat).
* ✏️ **[`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)**:
  * Zeile `TradeSetupEngine.js <-- Bottom-Finder...` (`L232`) aus dem Verzeichnisbaum entfernen.
* ✏️ **[`docs/architecture/ml/Makro-ML.md`](file:///D:/GitHub/CrashRadar/docs/architecture/ml/Makro-ML.md)**:
  * Erwähnung `Ensemble ["Ensemble-Synthese (TradeSetupEngine)"]` (`L120`) und Kapitel 10.1 (`L246-L248`) neutralisieren.
* ✏️ **[`docs/research/methodology-audits/Architecture-Audit.md`](file:///D:/GitHub/CrashRadar/docs/research/methodology-audits/Architecture-Audit.md)** & **[`docs/architecture/strategies/Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md)**:
  * Kurze Textverweise auf `TradeSetupEngine` bereinigen.

---

### Empfohlener Fahrplan für den Umbau (Gemäß Code-Buddy Regel 1 & 3)

Wenn du den Rückbau freigibst, führe ich folgende Schritte autonom und fließend durch:

1. **Schritt 1 (Code & Config bereinigen):**
   * Bereinigung von [`src/analysis/IndicatorEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/IndicatorEngine.js) und [`src/services/NotificationManager.js`](file:///D:/GitHub/CrashRadar/src/services/NotificationManager.js).
   * Bereinigung von [`config/Indicator-Pipeline-Config.json`](file:///D:/GitHub/CrashRadar/config/Indicator-Pipeline-Config.json).
2. **Schritt 2 (Löschen):**
   * Löschen von [`src/analysis/TradeSetupEngine.js`](file:///D:/GitHub/CrashRadar/src/analysis/TradeSetupEngine.js), [`tests/analysis/TradeSetupEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/TradeSetupEngine.test.js) und [`docs/architecture/trading-engine/`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/).
3. **Schritt 3 (Tests synchronisieren & verifizieren):**
   * Anpassung von [`GoldenMaster.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/GoldenMaster.test.js) und [`IndicatorEngine.test.js`](file:///D:/GitHub/CrashRadar/tests/analysis/IndicatorEngine.test.js).
   * Ausführung der gesamten Test-Suite via Vitest (`npm test`), um sicherzustellen, dass 100 % aller verbleibenden Tests grün sind.
4. **Schritt 4 (Doku & Index-Pflege):**
   * Bereinigung der Querverweise in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md), [`ROADMAP.md`](file:///D:/GitHub/CrashRadar/ROADMAP.md) und den übrigen Dokumenten.

Soll ich mit diesem Fahrplan starten?
