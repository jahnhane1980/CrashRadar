# CrashRadar Roadmap & Offene TODOs

Dieses Dokument bündelt alle aktuell noch offenen Entwicklungsaufgaben und Architekturerweiterungen für die CrashRadar-Engine. 
*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*


## 1. GOLD & GDX Push-Benachrichtigungen
* **Problem:** Die bestehenden Indikatoren (GDX Selling Climax, GDX vs Gold Divergenz) sind live in der Engine, aber es ist unklar, ob im Ernstfall ein harter Push-Alarm ausgelöst wird. Zudem blockiert das statische 14-Tage-Debouncing in Crash-Phasen (z.B. zwischen Climax und Breakout) essenzielle Alarme.
* **Aufgabe:** 
  * Die getAlerts-Methode in der IndicatorEngine.js prüfen und sicherstellen, dass ein Gold-Ausbruch oder eine GDX-Capitulation einen **sofortigen Ntfy-Push-Alarm** aufs Handy generiert.
  * **Dynamisches Debouncing:** Das System so umbauen, dass in Peacetime (ruhiger Markt) ein 14-Tage-Debounce gilt, im "Crisis Mode" (z.B. VIX Spike oder CRITICAL Warnungen) das Debouncing aber dynamisch auf 1-5 Tage reduziert wird, um keine schnellen V-Shape-Böden zu verpassen.


## 2. Refactoring & Modularisierung der JS-Dateien (insb. IndicatorEngine.js)
* **Problem:** Die Datei `IndicatorEngine.js` (und potenziell weitere Core-Dateien) ist massiv gewachsen (weit über 1.200 Zeilen) und enthält sämtliche Indikatoren als hartkodiertes Array. Das erschwert die Wartbarkeit, Übersichtlichkeit und Testabdeckung erheblich.
* **Ziel:** Dringende Überprüfung des Umfangs aller JavaScript-Dateien und anschließendes Architektur-Refactoring, um die Code-Basis sauber, modular und zukunftssicher zu halten.
* **Aufgaben:**
  * **Code-Audit:** Alle großen Dateien im `src/`-Ordner identifizieren und auf Überladung prüfen.
  * **Modularisierung:** Einzelne Indikatoren aus der `IndicatorEngine.js` in separate Dateien/Klassen auslagern (z.B. in einen Ordner `src/analysis/indicators/`).
  * **Registry-Pattern:** Die Engine so umbauen, dass sie Indikatoren dynamisch lädt oder via Registry registriert bekommt, anstatt alles monolithisch abzuarbeiten.


## 3. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus (z.B. bei ZETA als Kontra-Indikator, bei NVTS als Volatilitäts-Verstärker). Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
* **Aufgaben:**
  * **Forschung:** Analysieren, woher die Divergenz stammt (z.B. Free-Float-Anteil, Institutionelle Quote, ausstehende Wandelanleihen, fundamentale Bewertung).
  * **Architektur-Refactoring (Voraussetzung):** Die monolithische Methode `buildFeatures()` in der `src/services/MLRegimeService.js` auflösen und in das geplante Strategy-Pattern (`<Ticker>FeatureBuilder.js`) überführen (siehe `docs/ML_ARCHITECTURE.md`).
  * **Code-Anpassung:** Die identifizierten Short-Volume-Metriken als mathematische "Features" in die neuen Ticker-spezifischen Builder einbauen.
  * **Retraining:** Modelle mit den neuen Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.


## 4. Rework der ML-Modelle für hochvolatile Einzelaktien (Growth: SOFI, ZETA, NVTS)
* **Status:** Die dedizierten LSTM-Modelle wurden bereits erfolgreich trainiert (basierend auf der 7-Klassen Architektur inkl. `Log_Return_EMA3` und `Volume_Z_Score`).
* **Problem:** Bei der Evaluierung zeigten sich massive, aktienspezifische Bias-Probleme (z.B. starker Bull-Bias bei SOFI, Dauer-Bear-Bias bei NVTS). Die detaillierten historischen Evaluierungs-Ergebnisse und Trefferquoten sind im Labor-Tagebuch dokumentiert (`docs/ML_EVALUATIONS.md`).
* **Fazit & Aufgaben:** 
  * LSTMs memorieren bei diesen hochvolatilen Titeln oft nur die historische Grundstimmung (Rauschen). 
  * **Rework:** Um echte Kausalität herzustellen, müssen die Modelle zwingend mit den FINRA Short-Volume Daten als neuem Feature (siehe Punkt 3) grundlegend neu trainiert werden. Eine Engine-Integration findet erst statt, wenn dieses Bias-Problem gelöst ist.
  * **Feature-Experimente:** Für die strategische Erforschung weiterer Features (z.B. Fat Tails vs. Z-Scores, SMA-Distanzen) zur Behebung dieser Biases, siehe die neuen Forschungshypothesen in `docs/ML_FEATURE_RESEARCH.md`.


## 5. Aufbau des "Alternative Labor Market" Divergenz-Trackers
* **Gesamtstatus:** **[TEILWEISE IMPLEMENTIERT]** – Es wird bisher nur ein Teil der Daten (via FRED-API) geholt. Die komplexen Scraping-Pipelines fehlen noch komplett.
* **Problem:** Offizielle BLS-Arbeitsmarktdaten (z.B. NFP, Unemployment Rate, Sahm Rule) sind massiv lagging, werden durch das Birth-Death-Modell nach oben verzerrt und kaschieren Schwäche durch einen Überhang an Teilzeit-Jobs. Sie signalisieren eine Krise oft erst, wenn der Aktienmarkt bereits lange gecrasht ist.
* **Ziel:** Etablierung eines Echtzeit-Sensors, der die Divergenz zwischen der geschönten offiziellen Berichterstattung und dem tatsächlichen, ungeschönten Stress in der echten Wirtschaft misst, um eine Makro-Edge (Vorwarnsystem) zu generieren. Er wird bewusst *nicht* als harter Veto-Trigger eingesetzt, sondern als kontinuierliches makroökonomisches Dashboard.
* **Aufgaben / Status:**
  * **API-Integration (FRED) [ERLEDIGT]:** Die hochfrequenten Metriken `ICSA` (Erstanträge), `JTSLDL` (JOLTS Layoffs) und `PAYEMS` (Nonfarm Payrolls) wurden bereits erfolgreich in die `Database-Fetcher-Config.json` integriert. (Dies ist der einzige Teil, der bisher funktioniert).
  * **Hinweis zu ADP:** Der Indikator `ADPCHGA` (ADP Employment Report) wurde aus der Architektur gestrichen, da die FRED-API hier dauerhaft `400 Bad Request` Fehler wirft (höchstwahrscheinlich aufgrund entzogener Lizenzen für kostenlose API-Nutzung). Als Ersatz dient `PAYEMS`.
  * **WARN-Notices Pipeline (Der 60-Tage Alpha) [OFFEN]:** Implementierung von nativen Scraping-Fetcher-Strategien (Strategy Pattern) *direkt in unserem System* für die staatlichen Warn-Portale der "Big 4" (Kalifornien, Texas, New York, Florida). Wir lagern dies **nicht** auf Serverless-Dienste aus, sondern binden die Scraper als festen Bestandteil in die Node.js-Backend-Architektur (Database Fetcher) und unsere eigene Datenbank ein.
  * **Challenger, Gray & Christmas [OFFEN]:** Direkte Integration des Parsings für die monatlichen Entlassungsreports.

## 6. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

## 7. Fraktales Execution-Modul (Anti-Slippage Engine)
* **Ziel:** Trennung von Makro-Signal (Crash-Vorhersage) und Trade-Ausführung (Execution). Die `IndicatorEngine.js` liefert künftig nur noch die "Erlaubnis" zum Verkauf (Daily Timeframe).
* **Umsetzung:** Ein neues Execution-Modul muss konzipiert werden, das bei vorliegendem Crash-Signal auf einen Intraday-Zeitrahmen (z.B. 5-Minuten oder 15-Minuten Chart) wechselt und den Verkauf optimiert. Es verkauft entweder noch *vor* dem Daily Close (z.B. 15:55 Uhr) oder wartet am Folgetag gezielt auf eine kurzfristige Markterholung (Mean-Reversion-Spike), um massive Overnight-Gaps (wie am Black Monday 2024) zu vermeiden.



