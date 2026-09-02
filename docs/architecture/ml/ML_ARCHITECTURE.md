# CrashRadar: Machine Learning Architektur & Pipeline Blueprint

Dieses Dokument beschreibt die Architektur der universellen Machine-Learning-Pipeline (`ml.js`), um sicherzustellen, dass zukünftige Erweiterungen (neue Ticker, neue Features) das bestehende System nicht brechen.

## Der Architektur-Blueprint: Die universelle ML-Pipeline

Um das harte Coding einzelner Aktien zu vermeiden, wurde eine modulare "Strategy-Pattern" Architektur implementiert, die über eine zentrale JSON-Datei gesteuert wird.

### 1. Das Gehirn (`config/ML-Config.json`)
Sämtliche Modell-Architekturen sind in dieser JSON-Datei entkoppelt.
* **Fallbacks & Overrides:** Es gibt ein universelles `fallback` (z.B. 4 Label-Klassen, RSI, MACD). Möchte man für Einzelaktien eine andere Architektur (z.B. 7 Klassen mit Volumen-Indikatoren), definiert man in der JSON einfach einen Override für diesen Ticker.
* **Vorteil:** Die Node.js-Skripte beinhalten keinerlei "If Ticker === XYZ" Logik mehr. Alles ist rein konfigurationsgesteuert.

### 2. Feature Building via Strategy-Pattern (ZIEL-ARCHITEKTUR / TODO)
* **Aktueller Status (Ist-Zustand):** Momentan werden alle Features (RSI, MACD, etc.) monolithisch und zentral in der Datei `src/services/MLRegimeService.js` (Methode `buildFeatures()`) berechnet.
* **Geplante Architektur (Soll-Zustand `src/ml/features/`):** Die Transformation der rohen OHLCV-Daten in ML-lesbare Features soll künftig ein dynamischer Builder übernehmen.
* **Die Standard-Strategie:** Existiert für einen Ticker kein eigener Code, greift die Pipeline automatisch auf eine `DefaultFeatureBuilder.js` zurück. Diese baut die grundlegenden Indikatoren.
* **Spezialisierung:** Benötigt eine bestimmte Aktie (z.B. SOFI) spezielle Berechnungen (z.B. FINRA Short-Volume), erstellt man einfach eine `SofiFeatureBuilder.js`. Die Pipeline erkennt diese zur Laufzeit automatisch und nutzt die Spezial-Strategie anstelle des Defaults.

### 3. Universelles Training (`src/ml/ModelTrainer.js` & `TestInference.js`)
* Das TensorFlow-Training ist unabhängig vom Asset. Der Trainer lädt den fertigen CSV-Snapshot.
* Er berechnet automatisch die `classWeights` zum Ausgleich von Datenungleichgewichten im Training (z.B. seltene Tops vs. häufige Uptrends).
* Trainiert wird mit Early-Stopping zur Vermeidung von Overfitting.

### 4. CLI-Orchestrator (`ml.js` im Root)
Ein zentraler Einstiegspunkt für das Terminal (z.B. `node ml.js run --ticker=SOFI --step=all`), der die Pipeline von der Datengewinnung bis zur Modellspeicherung orchestriert.
* **Funktionsweise:** Die `ml.js` prüft beim Start dynamisch, ob für den angefragten Ticker ein spezialisierter FeatureBuilder existiert. Ist dies nicht der Fall, fällt sie sanft auf die universelle `DefaultFeatureBuilder.js` zurück. Dadurch bleibt das System extrem flexibel für exotische Ticker, ohne die Kern-Pipeline anrühren zu müssen.
