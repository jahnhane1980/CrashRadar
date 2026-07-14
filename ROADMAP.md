# CrashRadar Roadmap & Offene TODOs

Dieses Dokument bündelt alle aktuell noch offenen Entwicklungsaufgaben und Architekturerweiterungen für die CrashRadar-Engine. 
*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*


## 1. Aufbau des "Alternative Labor Market" Divergenz-Trackers
* **Problem:** Offizielle BLS-Arbeitsmarktdaten (z.B. NFP, Unemployment Rate, Sahm Rule) sind massiv lagging, werden durch das Birth-Death-Modell nach oben verzerrt und kaschieren Schwäche durch einen Überhang an Teilzeit-Jobs. Sie signalisieren eine Krise oft erst, wenn der Aktienmarkt bereits lange gecrasht ist.
* **Ziel:** Etablierung eines Echtzeit-Sensors, der die Divergenz zwischen der geschönten offiziellen Berichterstattung und dem tatsächlichen, ungeschönten Stress in der echten Wirtschaft misst, um eine Makro-Edge (Vorwarnsystem) zu generieren. Er wird bewusst *nicht* als harter Veto-Trigger eingesetzt, sondern als kontinuierliches makroökonomisches Dashboard.
* **Aufgaben / Status:**
  * **Hinweis zu ADP:** Der Indikator `ADPCHGA` (ADP Employment Report) wurde aus der Architektur gestrichen, da die FRED-API hier dauerhaft `400 Bad Request` Fehler wirft (höchstwahrscheinlich aufgrund entzogener Lizenzen für kostenlose API-Nutzung). Als Ersatz dient `PAYEMS`.
  * **WARN-Notices Pipeline (Der 60-Day Alpha) [OFFEN]:** Implementierung von nativen Scraping-Fetcher-Strategien (Strategy Pattern) *direkt in unserem System* für die staatlichen Warn-Portale der "Big 4" (Kalifornien, Texas, New York, Florida). Wir lagern dies **nicht** auf Serverless-Dienste aus, sondern binden die Scraper als festen Bestandteil in die Node.js-Backend-Architektur (Database Fetcher) und unsere eigene Datenbank ein.
  * **Challenger, Gray & Christmas [ERLEDIGT]:** Direkte Integration des Parsings für die monatlichen Entlassungsreports, inkl. TiDB Storage und Backtest/Indikator-Implementierung in der MacroRegimeEngine.

## 2. Architektur-Review der Indikatoren & Notifications
* **Problem:** Es besteht der Verdacht, dass die aktuelle Pipeline ineffizient ist. Möglicherweise werden Daten doppelt geladen/ausgewertet oder Logiken überschneiden sich unnötig zwischen Engine und Notification-Schicht.
* **Ziel:** Kritische Prüfung der aktuellen Architektur auf Effizienz, Redundanz und saubere Trennung der Zuständigkeiten (Separation of Concerns).
* **Aufgaben [OFFEN]:** Datenfluss der Indikatoren und Alarme analysieren. Überlegen, ob dies wirklich die "beste Lösung" ist oder ob ein Refactoring der Architektur ansteht, um Mehrfachauswertungen zu eliminieren.

## 3. Code-vs-Theorie Audit (Abgleich mit Analyse.md)
* **Problem:** Über die vielen Entwicklungs-Iterationen könnten Divergenzen zwischen der Theorie und der Praxis entstanden sein.
* **Ziel:** Ein systematischer, lückenloser Abgleich der theoretischen Fundamente aus der `docs/Analyse.md` mit der tatsächlichen Code-Basis (hauptsächlich `src/analysis/`).
* **Aufgaben [OFFEN]:** 
  * Identifikation von Indikatoren/Logiken im Code, die *nicht* in der `Analyse.md` dokumentiert sind.
  * Identifikation von Konzepten in der `Analyse.md`, die im Code *fehlen* oder *abweichend* implementiert wurden.
  * Entscheidung: Code an die Theorie anpassen, oder die Theorie (Doku) an die neue Code-Realität angleichen?

## 4. Error Handling, Logging & Console-Cleanup
* **Problem:** Die aktuelle Console-Ausgabe ist unübersichtlich. Zudem ist das Error Handling nicht konsequent genug zwischen "Fatal" und "Non-Fatal" getrennt. Fällt z.B. ein Scraper aus, wird das im Rauschen begraben, anstatt proaktiv gemeldet zu werden.
* **Ziel:** Ein professionelles, dreistufiges Error- & Logging-Framework.
* **Aufgaben [OFFEN]:**
  * **Console-Cleanup:** Unnötige Konsolenausgaben entfernen und saubere, strukturierte Logs etablieren.
  * **Kritische Fehler (Fatal):** Harte Exceptions werfen und den Lauf abbrechen (`exit`), wenn ein Fortsetzen absolut unmöglich ist oder die Datenintegrität zerstört.
  * **Wichtige Warnungen (Non-Fatal):** Fehler, die den Lauf nicht stoppen dürfen (z.B. geändertes HTML bei einem Scraper), werden gesammelt. Am Ende des Durchlaufs wird ein gesammelter Error/Warning-Report verschickt (z.B. Email/Ntfy), damit wir sofort wissen, dass wir den Code anpassen müssen.

## 5. Rework & Integration der ML-Modelle für Einzelaktien (Growth: SOFI, ZETA, NVTS)
* **Problem Historie:** Anfängliche LSTM-Modelle zeigten massive, aktienspezifische Biases (z.B. Dauer-Bullish bei SOFI, Dauer-Bearish bei NVTS), da sie nur auf Preis-Action trainiert waren und Rauschen memorierten (dokumentiert in `docs/ML_EVALUATIONS.md`).
* **Erreichtes Rework [Juli 2026]:** 
  * Das Bias-Problem wurde erfolgreich gebrochen! Die Modelle wurden mit erweiterten Daten (FINRA Short-Volume und fundamentalen Time-Series-Daten wie `Inst_Ownership` und `Dilution_Risk_Flag`) neu trainiert. Die Trefferquoten sind signifikant gestiegen (z.B. SOFI auf 58%).
  * **Tooling:** Es wurde ein dediziertes Evaluierungs-Skript geschaffen, um Modelle fortlaufend gegen ungesehene Test-Sets zu prüfen: [evaluate.js](file:///C:/GitHub/CrashRadar/scratch/tools/evaluate.js).
* **Der aktuelle Plan (Noch offen) - Pipeline-Integration & Wachhund:**
  * Jetzt da die ML-Signale belastbar sind, müssen sie in die `TradeSetupEngine` integriert werden.
  * *Neu anzulegen:* `src/analysis/indicators/MlRegimeRadarStockIndicator.js` als generischer Indikator pro Ticker.
  * *Neu anzulegen:* Eine `config/Fundamental-Veto-Config.json` zur Definition harter Schwellenwerte.
  * *Die Veto-Logik (Guard):* Obwohl das ML-Netz jetzt klüger ist, darf es niemals blind feuern. Wirft das LSTM ein Kaufsignal, prüft der Wachhund die Bilanz-Daten (z.B. Verwässerung) in der Datenbank auf Strukturbrüche und wirft notfalls ein hartes VETO.

## 6. Tech-Sektor Rotation & Infrastruktur-Mauer (Beweisführung)
* **Problem:** Es fehlen für die essenziellen Behauptungen zur Sektor-Rotation noch die empirischen Code-Beweise.
* **Aufgabe [OFFEN]:** Korrelation von DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden, bevor echter Code in die Engine wandert.

## 7. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

## 8. Datensynchronisation mit "datacenter" (Supabase)
* **Problem:** Das "datacenter"-Projekt hat eigene exklusive Datensätze (z.B. KI-basierte News/SEC-Analysen, QRA-Estimates, Sector Rotation), die aktuell in der CrashRadar MySQL-Datenbank nicht abgebildet werden. 
* **Aufgabe [OFFEN]:** Überprüfung des Datenbestands in Supabase. Es muss evaluiert werden, welche exklusiven Daten aus dem "datacenter" in CrashRadar (z.B. für neue ML-Features) genutzt werden sollen und ob diese direkt in Supabase verbleiben oder in die MySQL-DB migriert werden.
* **Hinweis zu M5-Candles:** Aktuell ziehen wir die 5-Minuten-Kerzen nicht standardmäßig ins CrashRadar-Modell. Das `datacenter` holt diese über den **Polygon.io API Service** (`PolygonIoService.js`). Der Fetch-Job (`sync-m5.yml`) läuft dort **einmal täglich um 06:37 Uhr UTC (Dienstag bis Samstag)** via GitHub Actions, fragt über den `M5Controller` historische "5 minute" Aggregates von Polygon ab und speichert sie direkt in der Supabase-Tabelle `market_m5_candles`.
* **Hinweis zu Optionsdaten (AlphaVantage):** Das `datacenter` nutzt die AlphaVantage-API (`AlphaVantageOptionService.js`) gezielt für Optionsdaten (Volume-to-Open-Interest Ratio und Put-Call-Ratio). Da der Free-Tier auf 25 Calls/Tag limitiert ist, könnten wir durch das Abschalten oder Konsolidieren von redundanten Daten-Fetches (z.B. unserer alten `market_data_pcr` Tabellen in CrashRadar) das API-Kontingent entlasten und effizienter nutzen.
* **M5-Mapping für CrashRadar:** Da die M5-Tabelle in Supabase nicht über den Ticker-String, sondern über die `ticker_id` referenziert wird, hier das Mapping für die essenziellen CrashRadar-Assets, die bereits M5-Daten aufgebaut haben:
  * **Broad Market ETFs:** `SPY` (ID: 13 & 27), `QQQ` (ID: 28)
  * **Einzelaktien (AI/Growth):** `SOFI` (ID: 12), `PLTR` (ID: 26), `NVTS` (ID: 25), `S` (ID: 2), `SOUN` (ID: 4)
  * **Themen-ETFs:** `IGV` (ID: 6), `CIBR` (ID: 5)
