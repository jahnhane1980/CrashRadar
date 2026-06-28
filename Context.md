# Aktueller Projektstatus & Fahrplan

## Forschungsprojekt: Machine Learning (Bitcoin PoC)
*Ziel: Erforschung eines neuronalen Netzes (LSTM) zur probabilistischen Erkennung von Marktphasen (Regime Classification), primär fokussiert auf die Identifikation von Makro-Böden und Erholungsphasen bei Bitcoin.*

### 1. Architektur & Tech-Stack (Geplant)
* **Ökosystem:** Node.js (v24+) & TypeScript (Homogen zum restlichen Projekt).
* **ML-Core:** `@tensorflow/tfjs-node` (C++ Bindings für CPU/GPU).
* **Data Preprocessing:** `danfojs-node` (Pandas-Äquivalent für JS) und `technicalindicators`.
* **Datenquelle:** Um den TiDB Freetier zu schonen und Latenzen beim Training zu eliminieren, lesen wir die historischen BTC-Daten für das Training primär aus performanten, **lokalen CSV-Dateien** direkt in den Arbeitsspeicher (RAM).

### 2. Das Datenmodell (Features & Target)
* **Eingabedaten (Features):** Absoluter Verzicht auf nackte Rohpreise (Non-Stationary Data). Das Modell wird ausschließlich mit **stationären Werten** trainiert: prozentuale Tagesrenditen (Returns) und normalisierte technische Oszillatoren (RSI, MACD, Volatilitäts-Bänder). Historische Daten reichen dank Yahoo Finance lückenlos bis September 2014 zurück, was uns 3 komplette Makro-Zyklen (inklusive 2014/15) liefert.
* **Das Ziel (Target / Y):** Keine Preisvorhersage (Regression)! Das LSTM arbeitet als **Phasen-Erkenner (Regime Classification)**. 
    * Wir nutzen den **Hardcoded "Ground Truth" Ansatz**: Wir definieren manuell über exakte Datumsbereiche, wann historisch eine Marktphase vorlag. Das Netz lernt so die Signatur (MACD, Volatilität) echter Makro-Wendepunkte, anstatt durch algorithmische Rausch-Tiefs (z.B. Corona-Crash) verwirrt zu werden.
    * **Die 4 Kategorien (Labels):**
      1. `MACRO_TOP`: Die absolute Euphorie- und Verteilungsphase (z.B. Nov 2021).
      2. `MACRO_BOTTOM`: Das absolute Tal der Tränen / Kapitulation (z.B. Dez 2018, Nov 2022).
      3. `UPTREND`: Gesunde Bullenmarkt-Stufen (Höhere Hochs).
      4. `DOWNTREND`: Bärenmarkt-Abtrieb und Dead Cat Bounces (Niedrigere Hochs).

### 3. Validierung & Overfitting-Schutz
Da ML im Finanzmarkt extrem anfällig für "Auswendiglernen" (Overfitting) ist, gelten strikte Regeln:
* **Strict Splitting:** Chronologische Trennung der Daten (In-Sample für Training, Out-of-Sample für Validierung) – niemals zufälliges Mischen, um Zukunfts-Leaks (Data Leakage) zu verhindern.
* **Permutationstests:** Die Validierungs-Pipeline wird das Feature-Rauschen "shuffeln", um über P-Werte zu verifizieren, dass das Modell tatsächlich logische Marktzusammenhänge erlernt hat und keinen Data-Mining-Bias aufweist.

### 4. PoC Status: Erfolgreich Abgeschlossen (Juni 2026)
Das Machine Learning Proof of Concept wurde erfolgreich validiert und demonstriert.
* **Tech-Stack Anpassung:** Wir nutzen `@tensorflow/tfjs` (pure JS) anstatt `tfjs-node`, um C++ Kompilierungsfehler unter Windows zu umgehen. Das Modell wird über einen *Custom IO Adapter* nativ als `weights.json` gespeichert.
* **Erweiterte Ground Truth:** Das Lexikon wurde um den Zyklus 3 ergänzt (inklusive des historischen BTC-Peaks am 06. Oktober 2025 bei 124.752 $ als `MACRO_TOP` und dem darauffolgenden Bärenmarkt als `DOWNTREND`).
* **Inferenz-Ergebnisse (Live-Simulation):**
  Das LSTM wurde erfolgreich auf 14-Tage-Sequenzen trainiert. Eine anschließende Live-Simulation (bei der das Modell pro Tag immer nur die vorherigen 14 Tage als Kontext bekam) zeigte beeindruckende Ergebnisse:
  1. **Frühwarnsystem (Zyklus 3 Top):** Bereits am 16.09.2025 (3 Wochen vor dem absoluten 124k Peak) löste das Modell bei 116k $ einen massiven `DOWNTREND` Alarm aus (>67% Wahrscheinlichkeit), bedingt durch eine bärische Divergenz im Momentum.
  2. **Top-Erkennung (Zyklus 2 Top):** Beim All-Time-High im Nov 2021 sprang die `MACRO_TOP` Wahrscheinlichkeit auf über 17 % (das 6-fache des statistischen Durchschnitts).
  3. **Bottom-Erkennung (FTX Crash):** Beim Kapitulations-Boden im Nov 2022 schlug der `MACRO_BOTTOM` Indikator mit fast 17 % stark an.
* **Fazit:** Das Modell funktioniert hervorragend als adaptiver "Risiko-Radar". Anstatt Preise zu prophezeien, erkennt es fundamentale Strukturbrüche in der Marktmechanik, *bevor* große Preiseinbrüche passieren.

### 5. Strategie zur Live-Integration (Fahrplan)
Das ML-Modell soll künftig nicht als isoliertes Skript, sondern als aktiver Kern-Kompass in den CrashRadar integriert werden.

* **Synergie (Gewichtung):** Das ML-Modell ersetzt keine klassischen Indikatoren (RSI, Fear & Greed), sondern fungiert als übergeordneter "Makro-Kompass". Ein RSI-Kaufsignal wird im Live-Betrieb vom System nur freigegeben, wenn das ML-Modell keinen starken `DOWNTREND` (Dead Cat Bounce) signalisiert, sondern auf `UPTREND` oder `MACRO_BOTTOM` steht.
* **Architektur (Dateien vs. DB):** 
  * Das berechnete Netzwerk-Gehirn (`weights.json`, `model.json`) verbleibt zwingend im Dateisystem für Ladezeiten im Millisekunden-Bereich.
  * Für die Live-Daten verzichten wir auf die große CSV-Datei. CrashRadar zieht sich stattdessen im täglichen Cronjob die exakt letzten 14 Tageskerzen performant per SQL aus der **TiDB**, normalisiert sie im RAM und füttert das Modell für die tagesaktuelle Prognose.
* **Lifecycle & Zukunfts-Training:**
  * Das Modell trainiert sich *nicht* blind selbst (Schutz vor Rauschen). 
  * Wenn künftig ein neuer Makro-Boden vom Markt bestätigt wird (z. B. Ende 2026), wird dieses eine historische Datum manuell in die CrashRadar-Konfiguration (`CYCLES` Ground Truth) eingetragen.
  * Ein manueller Trigger (z. B. `npm run ml:retrain`) veranlasst das System, alle Daten aus der TiDB zu ziehen, das Modell mit dem aktualisierten Lexikon neu zu trainieren und die `weights.json` zu überschreiben.

### 6. Datei- und Asset-Referenz (PoC Sandbox)
Damit die Überführung in das Live-System reibungslos klappt, hier die exakten Pfade der erstellten PoC-Assets:
* **Rohdaten (Veraltet):** Historische CSV-Dateien wurden entfernt, da wir jetzt 100% nativ auf die TiDB zugreifen.
* **Gespeichertes Modell:** `data/ml/models/btc_regime_v1/` (Enthält `weights.json` und `stats.json`)
* **Die PoC-Skripte (im `scratch/` Ordner):**
  1. `scratch/ml_data_pipeline.js`: Zieht die Yahoo-Finance Rohdaten ab 2014.
  2. `scratch/apply_hardcoded_labels.js`: Wendet unser "Ground Truth" Lexikon auf die Daten an.
  3. `scratch/train_model.js`: Das eigentliche TensorFlow LSTM Training mit Custom-IO Speicher-Logik.
  4. `scratch/simulate_live_inference.js`: Der Live-Test-Simulator (Zeitreise).

### Nächste Entwicklungsschritte (Aktualisierter, detaillierter Fahrplan)

**Phase 1: Konfiguration & Architektur**
- [x] **Auslagerung der Labels:** Anlage der `config/ML-Cycles-Config.json`, um das Hardcoded Ground-Truth-Lexikon (Zyklen) aus dem Skript zu lösen.
- [x] **Service-Erstellung:** Anlage des `src/services/MLRegimeService.js`. Dieser übernimmt zwei Aufgaben:
      1. *Live-Inferenz:* Laden der `weights.json`, RAM-Normalisierung (RSI, MACD) der aktuellen TiDB-Tagesdaten, Prognose-Rückgabe.
      2. *Training:* Logik für das Neulernen des Netzwerks.

**Phase 2: Der Retrain-Prozess & Automatisierung**
- [x] **Runner-Erstellung:** Anlage des `src/runners/MLRetrainRunner.js`. Zieht alle Historien-Daten aus der TiDB, wendet die Labels an, trainiert das Modell und speichert es in `data/ml/models/`.
- [x] **NPM Skript:** Eintrag `"ml:retrain": "node src/runners/MLRetrainRunner.js"` in die `package.json` hinzufügen.
- [x] **GitHub Action (Yearly Retrain & Auto-Commit):** Anlage der `.github/workflows/yearly-retrain.yml`. 
      *Trigger:* Läuft 1x jährlich per Cron (z. B. am 1. Januar) **oder** bei Bedarf manuell per Knopfdruck (`workflow_dispatch`), wenn wir die Config geupdatet haben.
      *Ablauf:* Zieht TiDB-Daten -> Führt `npm run ml:retrain` aus -> Führt `git commit` und `git push` für das Verzeichnis `data/ml/models/` aus. So sichert sich das Repository seine Gehirn-Updates selbst.

**Phase 3: Live-Integration**
- [x] **TiDB Live-Feed:** Anpassung der Inferenz, sodass der Service täglich performant die letzen 14 Zeilen aus `market_data_binance` liest.
- [x] **Signal-Fusion:** Verknüpfung des ML-Regime-Outputs mit der `IndicatorEngine.js` (z. B. Blockieren von Fake-Kaufsignalen, wenn ML auf `DOWNTREND` steht).
