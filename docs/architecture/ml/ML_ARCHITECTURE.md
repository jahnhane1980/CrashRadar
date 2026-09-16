# CrashRadar: Machine Learning Architektur & Pipeline Blueprint

Dieses Dokument beschreibt die Architektur der universellen Machine-Learning-Pipeline (`ml.js`), um sicherzustellen, dass zukünftige Erweiterungen (neue Ticker, neue Features) das bestehende System nicht brechen.

## Der Architektur-Blueprint: Die universelle ML-Pipeline

Um das harte Coding einzelner Aktien zu vermeiden, wurde eine modulare "Strategy-Pattern" Architektur implementiert, die über eine zentrale JSON-Datei gesteuert wird.

### 1. Das Gehirn (`config/ML-Config.json`)
Sämtliche Modell-Architekturen sind in dieser JSON-Datei entkoppelt.
* **Fallbacks & Overrides:** Es gibt ein universelles `fallback` (z.B. 4 Label-Klassen, RSI, MACD). Möchte man für Einzelaktien eine andere Architektur (z.B. 7 Klassen mit Volumen-Indikatoren), definiert man in der JSON einfach einen Override für diesen Ticker.
* **Vorteil:** Die Node.js-Skripte beinhalten keinerlei "If Ticker === XYZ" Logik mehr. Alles ist rein konfigurationsgesteuert.

### 2. Feature Building via Strategy-Pattern (✅ Vollständig implementiert)
* **Architektur ([`src/ml/features/`](file:///D:/GitHub/CrashRadar/src/ml/features/)):** Die Transformation der rohen OHLCV-Daten in ML-lesbare Features wird über ein modulares Strategy-Pattern gesteuert.
* **Die Standard-Strategie:** Existiert für einen Ticker kein eigener Builder, greift die Pipeline automatisch auf [`DefaultFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/DefaultFeatureBuilder.js) zurück. Diese berechnet die grundlegenden Indikatoren (RSI, MACD, ATR, SMA-Abstände, OBV).
* **Spezialisierte Builder:** Benötigen bestimmte Wachstums- oder Einzeltitel spezielle Berechnungen (z. B. FINRA Short-Volume, Float-Metriken), greift die Pipeline nahtlos auf spezialisierte Klassen zu:
  * [`FinraFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/FinraFeatureBuilder.js): Basis-Builder für FINRA-Short-Volume und Reg-SHO Kennzahlen.
  * Ticker-Builder: [`SOFIFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/SOFIFeatureBuilder.js), [`PLTRFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/PLTRFeatureBuilder.js), [`NVTSFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/NVTSFeatureBuilder.js), [`SFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/SFeatureBuilder.js), [`ZETAFeatureBuilder.js`](file:///D:/GitHub/CrashRadar/src/ml/features/ZETAFeatureBuilder.js).

### 3. Universelles Training & Evaluierung ([`src/ml/ModelTrainer.js`](file:///D:/GitHub/CrashRadar/src/ml/ModelTrainer.js) & [`src/ml/ModelEvaluator.js`](file:///D:/GitHub/CrashRadar/src/ml/ModelEvaluator.js))
* Das TensorFlow-Training ist unabhängig vom Asset. Der Trainer lädt den fertigen CSV-Snapshot.
* Er berechnet automatisch die `classWeights` zum Ausgleich von Datenungleichgewichten im Training (z.B. seltene Tops vs. häufige Uptrends).
* Trainiert wird mit Early-Stopping zur Vermeidung von Overfitting.
* Die Evaluierung erfolgt über [`ModelEvaluator.js`](file:///D:/GitHub/CrashRadar/src/ml/ModelEvaluator.js) mit Confusion Matrix und Genauigkeitsmetriken.

### 4. CLI-Orchestrator (`ml.js` im Root)
Ein zentraler Einstiegspunkt für das Terminal (z.B. `node ml.js run --ticker=SOFI --step=all`), der die Pipeline von der Datengewinnung bis zur Modellspeicherung orchestriert.
* **Funktionsweise:** Die `ml.js` prüft beim Start dynamisch, ob für den angefragten Ticker ein spezialisierter FeatureBuilder existiert. Ist dies nicht der Fall, fällt sie sanft auf die universelle `DefaultFeatureBuilder.js` zurück. Dadurch bleibt das System extrem flexibel für exotische Ticker, ohne die Kern-Pipeline anrühren zu müssen.
