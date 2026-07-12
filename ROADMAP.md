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

## 5. Rework der ML-Modelle für hochvolatile Einzelaktien (Growth: SOFI, ZETA, NVTS)
* **Status:** Die dedizierten LSTM-Modelle wurden bereits erfolgreich trainiert (basierend auf der 7-Klassen Architektur inkl. `Log_Return_EMA3` und `Volume_Z_Score`).
* **Problem:** Bei der Evaluierung zeigten sich massive, aktienspezifische Bias-Probleme (z.B. starker Bull-Bias bei SOFI, Dauer-Bear-Bias bei NVTS). Die detaillierten historischen Evaluierungs-Ergebnisse und Trefferquoten sind im Labor-Tagebuch dokumentiert (`docs/ML_EVALUATIONS.md`).
* **Fazit & Aufgaben:** 
  * LSTMs memorieren bei diesen hochvolatilen Titeln oft nur die historische Grundstimmung (Rauschen). 
  * **Rework:** Um echte Kausalität herzustellen, müssen die Modelle zwingend mit den FINRA Short-Volume Daten als neuem Feature (siehe Punkt 1 im TODO) grundlegend neu trainiert werden. Eine Engine-Integration findet erst statt, wenn dieses Bias-Problem gelöst ist.
  * **Feature-Experimente:** Für die strategische Erforschung weiterer Features (z.B. Fat Tails vs. Z-Scores, SMA-Distanzen) zur Behebung dieser Biases, siehe die neuen Forschungshypothesen in `docs/ML_FEATURE_RESEARCH.md`.

## 6. Tech-Sektor Rotation & Infrastruktur-Mauer (Beweisführung)
* **Problem:** Es fehlen für die essenziellen Behauptungen zur Sektor-Rotation noch die empirischen Code-Beweise.
* **Aufgabe [OFFEN]:** Korrelation von DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden, bevor echter Code in die Engine wandert.

## 7. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.
