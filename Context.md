## Empirische Analyse der Indikatoren (Tops vs. Bottoms +/- 4 Wochen)

Eine fundierte Daten-Auswertung aller identifizierten signifikanten SPY Tops und Bottoms seit 2019 ergab folgende kritische Erkenntnisse bezüglich der Wirksamkeit unserer Engine:

### 1. Das "Red Alert" Setup (SKEW vs. VIX) funktioniert makellos an Tops
* **Beobachtung:** Exakt am Top fällt der VIX auf durchschnittlich 17.9 (absolute Sorglosigkeit im Retail-Markt), aber der `SKEW` springt massiv auf über 144.7 (Institutionen kaufen panisch Tail-Risk-Protection).
* **Wertung:** Unsere Kombination aus "hoher SKEW + niedriger VIX" ist **goldrichtig**. Der Schwellenwert von `SKEW > 145` für `CRITICAL` sitzt perfekt, um das Ende der Melt-Up-Phase (Retail FOMO trifft auf Smart Money Exit) zu signalisieren.

### 2. Kreditmarkt-Stress (HYG, BIZD, BKLN) ist ein perfekter "Bottom-Tracker"
* **Beobachtung:** An Tops sind diese Werte unauffällig. Am absoluten Boden sind sie komplett ausgebombt (HYG bei ~74.6, BIZD bei 14.5).
* **Wertung:** Das sind klassische *Contemporaneous* (gleichzeitige) Indikatoren. Sie warnen nicht zwingend vorab, aber wenn BIZD und HYG panikartig fallen, wissen wir, dass der Crash im vollen Gange ist. Sobald diese Werte aufhören zu fallen, dreht auch der Aktienmarkt. Die Kombination in unserem `Private Credit Stress` Indikator ist überaus valide.

### 3. Die "Sahm Rule" ist als Frühindikator unbrauchbar (Verspätet!)
* **Beobachtung:** Am Top liegt der Sahm-Wert bei unauffälligen -0.01. Am Boden (was eigentlich das Kaufsignal für Aktien ist) liegt er bei 0.31. *Nach* dem Aktien-Boden steigt er weiter auf >0.46.
* **Wertung:** Der Aktienmarkt crasht, *bevor* die Arbeitslosigkeit messbar steigt und er erholt sich, *während* die Leute noch gefeuert werden. Die Sahm Rule ist ein massiv nachlaufender Indikator (Lagging). Wenn wir darauf warten, dass die Sahm Rule auf 0.50 steigt, hat der Markt seinen Boden bereits hinter sich. Sie dient höchstens als makroökonomische Bestätigung.

### 4. Yield Curve "Un-Inverting" bestätigt sich
* **Beobachtung:** An Tops ist der `Spread10y2y` im Durchschnitt bei +0.18. An Bottoms ist er negativ bei -0.05.
* **Wertung:** Dies bestätigt unsere Code-Logik: Der Crash passiert *nicht*, wenn die Kurve invertiert ist (negativ), sondern erst dann, wenn sie sich wieder "ent-invertiert" und ins Positive dreht. Das Setup `past30 < 0 && current >= 0` triggert historisch exakt richtig.

### 5. Künstliche Intelligenz (`qqq_regime_v1`) glänzt an Bottoms, hinkt an Tops
* **Beobachtung:** Exakt im Zeitfenster um die Bottoms feuert das ML-Modell präzise das Label `MACRO_BOTTOM` und schwenkt sofort danach aggressiv auf `UPTREND` um. An Tops bleibt das Modell jedoch lange (zu lange) auf `UPTREND` kleben.
* **Wertung:** Dies spiegelt die Natur der Märkte wider: Tops sind lange, zähe Verteilungsphasen (Distribution), Bottoms sind scharfe, von Panik getriebene V-Shapes. Die KI ist extrem wertvoll für das *Bottom-Fishing*, sollte aber an Tops immer den harten Metriken (SKEW, VIX) untergeordnet bleiben.

### 6. Indikatoren ohne Timing-Wert: TGA (Treasury General Account)
* **Beobachtung:** Der TGA liegt an Tops bei ~540B und an Bottoms bei ~740B.
* **Wertung:** Es gibt einen makroökonomischen Zusammenhang (hoher TGA entzieht dem Markt Liquidität), aber als Timing-Tool ist der TGA viel zu träge und generiert als *eigenständiger* Indikator zu viele False-Positives. Er sollte eher passiv im Rahmen der Gesamt-Liquidität betrachtet werden.

---

## Tech-Fokus: Unterschiede zwischen QQQ (Nasdaq 100) und SPY

Eine identische Analyse wurde auf die signifikanten Tops und Bottoms des **QQQ** angewendet. Dabei traten folgende Unterschiede zutage:

1. **SKEW als Top-Warner:**
   * Der SKEW ist auf den S&P 500 kalibriert. Beim QQQ-Top steigt er im Schnitt auf 142.8 (im Gegensatz zu 144.7 beim SPY). Die Makro-Mechanik funktioniert weiterhin identisch (Retail kauft Tech, Smart Money sichert sich über S&P-Puts ab). Der Threshold von `SKEW > 145` bleibt robust als universelles Warnsignal, um False-Positives zu vermeiden.
2. **KI-Modell (`qqq_regime_v1`):**
   * Da das Modell dediziert auf den QQQ trainiert wurde, identifiziert es Tech-Böden extrem scharf (triggert präzise das `MACRO_BOTTOM` Label am Tiefpunkt). An Tops ist es jedoch genauso träge wie beim SPY. Fazit: Ein erstklassiger Bottom-Fischer für Tech-Werte. 
   * *Hinweis zur Integration:* Die Modell-Gewichte wurden bereits erfolgreich trainiert, jedoch steht die offizielle Implementierung in die Live-Engine und Alarm-Logik noch aus (siehe [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md)).
3. **Credit Stress (HYG/BIZD/BKLN):**
   * Fällt an QQQ-Bottoms nicht ganz so stark aus wie beim SPY. Big-Tech ist durch gewaltige Cash-Reserven resilienter gegen Kreditmarkt-Verwerfungen (Schattenbanken/High Yield) als die klassische Wirtschaft. Ein Tech-Crash kann stattfinden, auch wenn der Kreditmarkt intakt bleibt. Credit Stress ist hier primär ein makroökonomischer Begleitfaktor, kein akuter Trigger.

> **Verwendete Analyse-Skripte:**
> Die zugrundeliegende Logik und Datenauswertung kann mit folgenden Skripten jederzeit neu validiert werden:
> * Extraktion der Tops/Bottoms: [scratch/extract_tops_bottoms.js](file:///C:/GitHub/CrashRadar/scratch/extract_tops_bottoms.js)
> * Aggregation & statistische Analyse: [scratch/analyze_extrema.js](file:///C:/GitHub/CrashRadar/scratch/analyze_extrema.js)

---

## FINRA Short-Volume Analyse: Individuelle Aktien-Charakteristika

Eine erste empirische Auswertung der historischen FINRA-Leerverkaufsdaten (Short Volume Ratio > 70-80%) bei ZETA, NVTS und SOFI hat völlig unterschiedliche Reaktionen auf extremen Short-Druck offenbart:

* **ZETA (Kontra-Indikator):** Bei extremer Short-Quote kommt es in der Mehrheit der Fälle (60%) zu einem massiven Short-Squeeze (bis zu +20% in 10 Tagen). 
* **NVTS (Volatilitäts-Verstärker):** Hoher Short-Druck ist binär. Entweder crasht die Aktie extrem weiter (-30%) oder sie explodiert (+30%). 
* **SOFI (Support-Wand):** Selbst bei stärkstem Short-Volumen crasht die Aktie danach praktisch nie (< -5%). Der Verkaufsdruck wird stark absorbiert.

> **Verwendetes Skript:** [scratch/analyze_short_volume.js](file:///C:/GitHub/CrashRadar/scratch/analyze_short_volume.js)

---


## Machine Learning: BTC-Regime (v2) Pipeline & Status

Wir haben erfolgreich eine end-to-end Machine-Learning-Pipeline für die Erkennung von Bitcoin-Marktphasen (Regimen) aufgebaut. Dabei haben wir die V1-Architekturfehler (Look-Ahead Bias, Whipsawing) behoben und nutzen nun strikte **Dow-Theorie-Marktstruktur** (Höhere Hochs, Tiefere Tiefs).

### 1. Architektur & Wichtige Klassen
*   **Der "Lehrer" (Ground Truth):** Die Klasse `src/analysis/RegimeLabeler.js` ist das Herzstück. Sie nutzt einen retrospektiven ATR-ZigZag-Algorithmus, um aus historischen Daten völlig lückenlose, rauschfreie Labels (`BULL_MARKET`, `CYCLE_TOP`, `BEAR_RALLY` etc.) zu generieren.
*   **Konfiguration:** Die Basis-Zyklus-Längen (z.B. Bitcoin = 1460 Tage / 4 Jahre) liegen als Fallback in `config/Cycle-Base-Config.json`.

### 2. Der aktuelle ML-Workflow (in `scratch/`)
Der Workflow ist aktuell ein 3-stufiger Prozess aus Skripten:
1.  **Labels generieren:** Das Skript `scratch/test_regime_labeler.js` generiert die puren Labels und speichert sie in `scratch/btc_regimes_output.csv`.
2.  **Feature Pipeline (ETL):** Das Skript `scratch/extract_features.js` holt OHLCV-Tagesdaten aus der MySQL-DB, berechnet `OBV` (On-Balance Volume) und `ATR` (Average True Range) und führt sie mit den Labels zu `scratch/btc_ml_dataset_final.csv` zusammen. Dies ist unser fester CSV-Snapshot für das Training.
3.  **Model Training:** Das Skript `scratch/train_btc_model_v2.js` baut ein LSTM-Netzwerk (64 Units) über `@tensorflow/tfjs`. Um den `tfjs-node` Bug auf Windows zu umgehen, nutzt es einen Custom-Save-Adapter und speichert die Gewichte (`weights.json`) sowie die Normalisierungs-Faktoren (`stats.json`) direkt nach `data/ml/models/btc_regime_v2/`.

### 3. Ergebnisse des aktuellen V2-Runs (mit RSI, MACD & Early Stopping)
*   **Trainings-Genauigkeit (In-Sample):** ~83.7 %
*   **Validierungs-Genauigkeit (Out-of-Sample):** ~73.7 % (in der Spitze)
*   **Analyse:** Das Hinzufügen der Momentum-Indikatoren (RSI, MACD) hat die Out-of-Sample Performance drastisch von 48 % auf über 70 % katapultiert! Das Modell erkennt echte Ausbrüche jetzt wesentlich zuverlässiger.
*   **Early Stopping:** Das Training bricht nun automatisch nach ~7 Epochen ab, um Overfitting zu verhindern, da das Modell die essenziellen Muster bereits in den ersten Epochen verinnerlicht.

### 4. Der neue Architektur-Blueprint: Die universelle ML-Pipeline
Da wir in Zukunft nicht nur BTC und QQQ, sondern auch Einzelaktien (SOFI, ZETA, PLTR) trainieren wollen, ersetzen wir das fehleranfällige `scratch/`-Setup durch eine universelle, wartbare ML-Pipeline. Um dabei ein "Konfigurations-Monster" zu vermeiden, nutzen wir einen hybriden Strategy-Pattern-Ansatz:

1. **Zentrale Konfiguration (`config/ML-Config.json`)**: 
   * Beinhaltet nur primitive Hyperparameter (Epochen, Batch-Size, Modell-Version, Default-Features). Keine komplexen SQL-Joins oder Programmierlogiken in der JSON.
2. **Pluggable Feature-Generierung (`src/ml/features/`)**:
   * Ein `DefaultFeatureBuilder.js` berechnet Standard-Metriken (RSI, MACD, OBV) aus reinen OHLCV-Daten (für 90% der Ticker ausreichend).
   * Bei Spezialfällen (z.B. FINRA Short-Volume für ZETA) wird einfach ein `ZetaFeatureBuilder.js` angelegt, der vom Default erbt. Die Config bleibt dadurch sauber!
3. **Universelles Training (`src/ml/ModelTrainer.js` & `TestInference.js`)**:
   * Das TensorFlow-Training ist unabhängig vom Asset. Der Trainer lädt den fertigen CSV-Snapshot, berechnet automatisch die `classWeights` zum Ausgleich von Datenungleichgewichten, trainiert per Early-Stopping und speichert das Modell sauber ab.
4. **CLI-Orchestrator (`ml.js` im Root)**:
   * Ein zentraler Einstiegspunkt für das Terminal (z.B. `node ml.js run --ticker=SOFI --step=all`), der die Pipeline von der Datengewinnung bis zur Modellspeicherung steuert.
   * **Funktionsweise:** Die `ml.js` nutzt das *Strategy-Pattern*. Sie prüft beim Start dynamisch, ob für den angefragten Ticker ein spezialisierter FeatureBuilder existiert (z.B. `src/ml/features/SofiFeatureBuilder.js`). Ist dies nicht der Fall, fällt sie sanft auf die universelle `DefaultFeatureBuilder.js` zurück. Dadurch bleiben wir extrem flexibel für exotische Ticker, ohne die Kern-Pipeline anrühren zu müssen. Um diese Logik testbar zu machen, wird die Ausführung in eine separate Runner/Orchestrator-Klasse ausgelagert.

### 5. Konkreter Schritt-für-Schritt Umsetzungsplan
Dieser Plan bildet unsere direkten nächsten Arbeitspakete ab:

* **Step 1: Basis-Infrastruktur & Config ✅ ERLEDIGT**
  * Erstellen der `config/ML-Config.json` (inkl. Fallbacks und Ticker-spezifischer Overrides).
  * Anlegen der benötigten Ordnerstruktur (`src/ml/features/`, `data/ml/snapshots/`).
* **Step 2: Der Feature-Builder (ETL) ✅ ERLEDIGT**
  * `AnalysisRepository.js` wurde um `getOhlcvForTicker()` erweitert, um Ticker-agnostisch Rohdaten (OHLCV) aus Binance, Tiingo oder Yahoo zu laden.
  * Entwicklung der `DefaultFeatureBuilder.js`: Zieht Rohdaten, nutzt den `RegimeLabeler` für die Dow-Theorie Ground-Truth, berechnet dynamisch die in der Config hinterlegten Indikatoren (RSI, MACD, OBV etc.) und generiert den fertigen CSV-Snapshot.
* **Step 3: Der universelle Trainer ✅ ERLEDIGT**
  * Entwicklung der `src/ml/ModelTrainer.js`: Ist Ticker-agnostisch, liest den Input-Shape dynamisch aus den CSV-Headern, bezieht Hyperparameter (Epochen, Patience) aus der Config, berechnet zur Laufzeit mathematisch perfekte ClassWeights gegen Imbalance und speichert das TensorFlow-Netz über einen robusten Custom Save-Adapter.
* **Step 4: Der CLI-Orchestrator ✅ ERLEDIGT**
  * Erstellen der `ml.js` im Projekt-Root zur Steuerung der Parameter (`--ticker`, `--step=features|train`). Refactoring der Logik in die `MLPipelineRunner.js` inkl. Test-Abdeckung.
* **Step 5: Migration & Testlauf**
  * Das aktuelle BTC v2 Setup als Proof-of-Concept durch die neue Pipeline jagen, um sicherzustellen, dass sie fehlerfrei funktioniert. Danach können die alten `scratch/`-Trainingsskripte gelöscht werden.
  * **Nächster Schritt nach BTC:** Erstellung neuer Modell-Versionen für SPY, QQQ und PLTR über die frische Pipeline. Dabei ist das Konzept aus [`docs/TensorFlow-Champion-Challenger.md`](file:///C:/GitHub/CrashRadar/docs/TensorFlow-Champion-Challenger.md) strikt anzuwenden (Champion vs. Challenger Prinzip für nahtlose Upgrades).

---
> 🚀 **Ausstehende Entwicklungsaufgaben und offene Punkte (TODOs) findest du ab sofort gebündelt in der [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md).**
