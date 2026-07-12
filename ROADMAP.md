# CrashRadar Roadmap & Offene TODOs

Dieses Dokument bündelt alle aktuell noch offenen Entwicklungsaufgaben und Architekturerweiterungen für die CrashRadar-Engine. 
*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*


## 1. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Extreme FINRA-Leerverkaufsdaten wirken sich je nach Aktie massiv unterschiedlich aus (z.B. bei ZETA als Kontra-Indikator, bei NVTS als Volatilitäts-Verstärker). Die detaillierten empirischen Erkenntnisse dazu liegen in der `docs/ML_EVALUATIONS.md`.
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* extrem hohes Short-Volume bei einer Aktie ein Kaufsignal, bei einer anderen aber ein Risiko darstellt.
* **Aufgaben / Status:**
  * **Forschung [OFFEN]:** Analysieren, woher die Divergenz in der FINRA-Wirkung stammt (z.B. Free-Float-Anteil, Institutionelle Quote, ausstehende Wandelanleihen, fundamentale Bewertung).
  * **Code-Anpassung [OFFEN]:** Die final identifizierten Short-Volume-Metriken als mathematische "Features" in die neuen Ticker-spezifischen Builder einbauen.
  * **Retraining [OFFEN]:** Modelle mit den neuen Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.


## 2. Aufbau des "Alternative Labor Market" Divergenz-Trackers
* **Problem:** Offizielle BLS-Arbeitsmarktdaten (z.B. NFP, Unemployment Rate, Sahm Rule) sind massiv lagging, werden durch das Birth-Death-Modell nach oben verzerrt und kaschieren Schwäche durch einen Überhang an Teilzeit-Jobs. Sie signalisieren eine Krise oft erst, wenn der Aktienmarkt bereits lange gecrasht ist.
* **Ziel:** Etablierung eines Echtzeit-Sensors, der die Divergenz zwischen der geschönten offiziellen Berichterstattung und dem tatsächlichen, ungeschönten Stress in der echten Wirtschaft misst, um eine Makro-Edge (Vorwarnsystem) zu generieren. Er wird bewusst *nicht* als harter Veto-Trigger eingesetzt, sondern als kontinuierliches makroökonomisches Dashboard.
* **Aufgaben / Status:**
  * **Hinweis zu ADP:** Der Indikator `ADPCHGA` (ADP Employment Report) wurde aus der Architektur gestrichen, da die FRED-API hier dauerhaft `400 Bad Request` Fehler wirft (höchstwahrscheinlich aufgrund entzogener Lizenzen für kostenlose API-Nutzung). Als Ersatz dient `PAYEMS`.
  * **WARN-Notices Pipeline (Der 60-Day Alpha) [OFFEN]:** Implementierung von nativen Scraping-Fetcher-Strategien (Strategy Pattern) *direkt in unserem System* für die staatlichen Warn-Portale der "Big 4" (Kalifornien, Texas, New York, Florida). Wir lagern dies **nicht** auf Serverless-Dienste aus, sondern binden die Scraper als festen Bestandteil in die Node.js-Backend-Architektur (Database Fetcher) und unsere eigene Datenbank ein.
  * **Challenger, Gray & Christmas [ERLEDIGT]:** Direkte Integration des Parsings für die monatlichen Entlassungsreports, inkl. TiDB Storage und Backtest/Indikator-Implementierung in der MacroRegimeEngine.

## 3. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

## 4. Rework der ML-Modelle für hochvolatile Einzelaktien (Growth: SOFI, ZETA, NVTS)
* **Status:** Die dedizierten LSTM-Modelle wurden bereits erfolgreich trainiert (basierend auf der 7-Klassen Architektur inkl. `Log_Return_EMA3` und `Volume_Z_Score`).
* **Problem:** Bei der Evaluierung zeigten sich massive, aktienspezifische Bias-Probleme (z.B. starker Bull-Bias bei SOFI, Dauer-Bear-Bias bei NVTS). Die detaillierten historischen Evaluierungs-Ergebnisse und Trefferquoten sind im Labor-Tagebuch dokumentiert (`docs/ML_EVALUATIONS.md`).
* **Fazit & Aufgaben:** 
  * LSTMs memorieren bei diesen hochvolatilen Titeln oft nur die historische Grundstimmung (Rauschen). 
  * **Rework:** Um echte Kausalität herzustellen, müssen die Modelle zwingend mit den FINRA Short-Volume Daten als neuem Feature (siehe Punkt 1) grundlegend neu trainiert werden. Eine Engine-Integration findet erst statt, wenn dieses Bias-Problem gelöst ist.
  * **Feature-Experimente:** Für die strategische Erforschung weiterer Features (z.B. Fat Tails vs. Z-Scores, SMA-Distanzen) zur Behebung dieser Biases, siehe die neuen Forschungshypothesen in `docs/ML_FEATURE_RESEARCH.md`.

## 5. Tech-Sektor Rotation & Infrastruktur-Mauer (Beweisführung)
* **Problem:** Es fehlen für die essenziellen Behauptungen zur Sektor-Rotation noch die empirischen Code-Beweise.
* **Aufgabe [OFFEN]:** Korrelation von DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden, bevor echter Code in die Engine wandert.
