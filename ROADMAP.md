# CrashRadar Roadmap & Offene TODOs

Dieses Dokument bündelt alle aktuell noch offenen Entwicklungsaufgaben und Architekturerweiterungen für die CrashRadar-Engine.

## 1. Integration der bestehenden Tech-KI (`qqq_regime_v1`)
* **Problem:** Laut `docs/Analyse.md` existieren die Gewichte des auf den Nasdaq 100 (QQQ) trainierten Modells zwar im Ordner `data/ml/models/qqq_regime_v1/`, jedoch wird in der Live-Umgebung (`index.js` & `IndicatorEngine.js`) aktuell standardmäßig nur das Bitcoin-Netzwerk (`btc_regime_v1`) geladen.
* **Ziel:** Das QQQ-Netzwerk muss offiziell in den täglichen Analyse- und Warn-Workflow eingebaut werden.
* **Aufgaben:**
  * Anpassung der `index.js`, um neben den Krypto-Kerzen auch Nasdaq-Daten (QQQ) zu laden und an eine eigene Instanz des `MLRegimeService` (z.B. `new MLRegimeService('qqq_regime_v1')`) zu verfüttern.
  * Erweiterung der `IndicatorEngine`, um spezifische Tech-Markt-Alarme (Push-Benachrichtigungen via Ntfy) auszulösen, wenn das Modell ein `MACRO_TOP` oder `MACRO_BOTTOM` für den QQQ prognostiziert.

## 2. ML-Training für hochvolatile Einzelaktien
* **Problem:** Wie in der "Out-of-Distribution"-Analyse festgestellt wurde, liefert ein auf Indizes (QQQ) trainiertes neuronales Netz bei extrem volatilen Einzelaktien nur unbrauchbare Konfidenzwerte (z.B. bei Palantir).
* **Ziel:** Für die neu in die Konfiguration aufgenommenen Einzelwerte (`S`, `SOFI`, `ZETA`, `SOUN`, `LUMN`, `NVTS`) müssen dedizierte, auf ihre jeweilige Volatilitäts-Charakteristik zugeschnittene LSTM-Modelle trainiert werden.
* **Aufgaben:**
  * Ausführen des ML-Retrain-Skripts (`npm run ml:retrain`) für jeden der neuen Ticker.
  * Als Basis dient hierbei die frisch ermittelte "Ground-Truth" aus der `config/ML-Cycles-Config.json`.
  * Wichtig: Beim Training müssen lange Leerlaufphasen rigoros aus dem Training ausgeschlossen (`UNKNOWN`) werden, um die Mathematik des LSTMs nicht zu zerstören.
  * Resultat: Speicherung der neuen Modelle (z.B. `s_regime_v1`, `sofi_regime_v1`) im Verzeichnis `data/ml/models/`.

## 3. Engine-Integration der neuen Einzelaktien-Modelle
* **Problem:** Trainierte Modelle auf der Festplatte generieren keinen Mehrwert, solange der Bot sie nicht abfragt.
* **Ziel:** Aktive Überwachung der Einzelaktien durch die neuen ML-Modelle im täglichen Cron-Job.
* **Aufgaben:**
  * Analog zur anstehenden `qqq_regime_v1`-Integration müssen auch die neuen Einzelaktien-Modelle in die `IndicatorEngine` / `MLRegimeService` eingebunden werden.
  * Sicherstellen, dass zielgerichtete Ntfy-Alarme gefeuert werden können, falls das Netz beispielsweise ein `MACRO_BOTTOM` bei SOFI oder ZETA erkennt.

## 4. FINRA Short-Volume: Ursachenforschung & Feature-Erweiterung
* **Problem:** Eine empirische Auswertung extremer FINRA-Leerverkaufsdaten (Short Volume Ratio > 70-80%) offenbarte gravierende Verhaltensunterschiede bei Einzelaktien:
  * **ZETA:** Fungiert als Kontra-Indikator (60% Wahrscheinlichkeit für massive Short-Squeezes bis +20%).
  * **NVTS:** Wirkt als reiner Volatilitäts-Verstärker (Aktie crasht entweder extrem weiter oder explodiert).
  * **SOFI:** Zeigt sich als absolute Support-Wand (absorbiert Verkaufsdruck, crasht fast nie).
* **Ziel:** Das neuronale Netz soll künftig selbstständig interpretieren können, *warum* 80% Short-Volume bei ZETA ein Kaufsignal, bei NVTS aber ein Risiko darstellt.
* **Aufgaben:**
  * **Forschung:** Analysieren, woher die Divergenz stammt (z.B. Free-Float-Anteil, Institutionelle Quote, ausstehende Wandelanleihen, fundamentale Bewertung).
  * **Code-Anpassung:** Die identifizierten Gründe in mathematische "Features" übersetzen und die Methode `buildFeatures()` im `src/services/MLRegimeService.js` entsprechend erweitern (neben den bisherigen RSI, MACD und Tagesrenditen).
  * **Retraining:** Modelle mit den neuen Features neu anlernen, um die Vorhersage-Konfidenz signifikant zu steigern.


## 5. Konsolidierung der Scratch-Skripte (Research & Scraping)
* **Problem:** Nach der Löschung veralteter ML-Altlasten verbleiben im Ordner `scratch/` noch zahlreiche Research-Skripte (`analyze_*.js`) und API-Test-Skripte (`scrape*`, `test*`). Diese bergen wertvolles Wissen, sind aber durch die Weiterentwicklung der Architektur (z.B. Datenbankumstellung auf MySQL, neue `AnalysisRepository`) teilweise funktionsunfähig.
* **Ziel:** Erhalt und Wiederherstellung der Forschungs-Infrastruktur, um Erkenntnisse (z.B. SKEW/VIX Analysen) in Zukunft problemlos validieren und reproduzieren zu können.
* **Aufgaben:**
  * **Repair & Refactor:** Anpassung der verbliebenen `analyze_*.js` Skripte an die aktuelle `AnalysisRepository`-Logik, damit Datenbankzugriffe wieder funktionieren.
  * **Aufräumen & Strukturieren:** Auslagern in dedizierte Unterordner (z.B. `scratch/research_archive/` und `scratch/api_playground/`), um die Projektübersichtlichkeit im Root zu bewahren.
  * **Priorität:** Niedrig (Housekeeping)

## 6. Veto-Logik & CRITICAL Alarms: Priorisierung klären (ERLEDIGT)
* **Status:** Erfolgreich implementiert in `docs/VETO_LOGIC.md` und `test_engine.js`. Panik-Indikatoren überschreiben nun erfolgreich träge KI-Böden, während KI-Tops ungestört bleiben.

## 7. Deep-Dive: Gold (GC=F) & Gold-Miner (GDX) als ultimative Wendepunkt-Indikatoren
* **Problem:** Gold spielt in Crash-Szenarien eine Doppelrolle: Bei Tops bricht es oft nach oben aus (Smart Money Flucht in Sicherheit) und bei Böden bricht es nach oben aus (Liquiditäts-Injektionen der FED nach Margin-Call-Flush). Diese Ambivalenz hat uns dazu gezwungen, das bisherige `Gold (SMA 50 Ausbruch)`-Veto auf ein bloßes `WARNING` abzuschwächen, da es in der Live-Engine zu Fehlalarmen an Tops führte.
* **Ziel:** Eine messerscharfe Logik entwickeln, um anhand von Preis-Volumen-Aktion (Volume Climax) bei Gold und dem Miner-ETF GDX exakte Marktböden "ohne Panik" (wenn der VIX nicht mehr extrem ausschlägt) zu identifizieren.
* **Aufgaben:**
  * **Empirische Untersuchung:** Erstellung eines dedizierten Research-Skripts (ähnlich zu `scratch/analyze_extrema.js`), das isoliert die Volumenspikes von Gold & GDX an den historischen Wendepunkten (2020, 2022, etc.) auswertet.
  * **Divergenz-Analyse:** Wie in der `Analyse.md` beschrieben, toppt der GDX historisch 1-11 Tage *vor* physischem Gold. Diese Vorlauf-Divergenz mathematisch als `TRIGGER`-Alarm abbilden, um Tops zu untermauern.
  * **Boden-Fischer:** Entwicklung eines spezifischen `Gold Volume Climax`-Vetos für Marktböden. Statt nur einen "Ausbruch über den SMA 50" zu werten, muss das **Volumen** integriert werden (z.B. massiver Verkaufsdruck -> Drehung -> starkes Volumen nach oben), um das absolute Ende der Liquidations-Kaskade zu signalisieren.
  * **Entscheidung über ML:** Abwägen, ob die Preis-Volumen-Logik von Gold in ein kleines, separates LSTM-Modell gegossen wird, oder ob eine hart codierte Heuristik (Thresholds) in der `IndicatorEngine` robuster und weniger anfällig für Makro-Overfitting ist.

## 8. Aufbau des "Alternative Labor Market" Divergenz-Trackers
* **Problem:** Offizielle BLS-Arbeitsmarktdaten (z.B. NFP, Unemployment Rate, Sahm Rule) sind massiv lagging, werden durch das Birth-Death-Modell nach oben verzerrt und kaschieren Schwäche durch einen Überhang an Teilzeit-Jobs. Sie signalisieren eine Krise oft erst, wenn der Aktienmarkt bereits lange gecrasht ist.
* **Ziel:** Etablierung eines Echtzeit-Sensors, der die Divergenz zwischen der geschönten offiziellen Berichterstattung und dem tatsächlichen, ungeschönten Stress in der echten Wirtschaft misst, um eine Makro-Edge (Vorwarnsystem) zu generieren. Er wird bewusst *nicht* als harter Veto-Trigger eingesetzt, sondern als kontinuierliches makroökonomisches Dashboard.
* **Aufgaben / Status:**
  * **API-Integration (FRED) [ERLEDIGT]:** Die hochfrequenten Metriken `ICSA` (Erstanträge), `JTSLDL` (JOLTS Layoffs) und `PAYEMS` (Nonfarm Payrolls) wurden bereits erfolgreich in die `Database-Fetcher-Config.json` integriert.
  * **Hinweis zu ADP:** Der Indikator `ADPCHGA` (ADP Employment Report) wurde aus der Architektur gestrichen, da die FRED-API hier dauerhaft `400 Bad Request` Fehler wirft (höchstwahrscheinlich aufgrund entzogener Lizenzen für kostenlose API-Nutzung). Als Ersatz dient `PAYEMS`.
  * **WARN-Notices Pipeline (Der 60-Tage Alpha) [OFFEN]:** Implementierung von nativen Scraping-Fetcher-Strategien (Strategy Pattern) *direkt in unserem System* für die staatlichen Warn-Portale der "Big 4" (Kalifornien, Texas, New York, Florida). Wir lagern dies **nicht** auf Serverless-Dienste aus, sondern binden die Scraper als festen Bestandteil in die Node.js-Backend-Architektur (Database Fetcher) und unsere eigene Datenbank ein.
  * **Challenger, Gray & Christmas [OFFEN]:** Direkte Integration des Parsings für die monatlichen Entlassungsreports.
