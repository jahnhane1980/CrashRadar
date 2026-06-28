# Architektur-Blueprint: ML Trading-System (Node.js & TiDB)

Dieses Dokument beschreibt den technischen Stack und die Daten-Pipeline für die Entwicklung und Validierung eines Machine-Learning-basierten Handelssystems (z. B. für Bitcoin-Zeitreihen) unter Verwendung eines JavaScript/TypeScript-Ökosystems.

---

## 1. Der Tech-Stack

### Core & Laufzeitumgebung
* **Runtime:** Node.js (v24+ / v26) – Ermöglicht eine performante, asynchrone Datenverarbeitung.
* **Sprache:** TypeScript – Bietet Typsicherheit bei der Arbeit mit komplexen mehrdimensionalen Arrays (Tensoren).

### Daten-Infrastruktur (Single Source of Truth)
* **Datenbank:** **TiDB** (NewSQL)
    * *Rolle:* Langzeitspeicherung von rohen OHLCV-Marktdaten, berechneten Features und Vorhersage-Logs.
    * *Vorteil:* Nutzt die TiFlash-Engine für ultraschnelle, analytische SQL-Abfragen (OLAP) über Millionen von Zeilen.

### Daten-Pipeline & Feature Engineering (Lokal in Node.js)
* **`danfojs-node`:** Das Gegenstück zu Pythons *Pandas*. Wird verwendet, um Daten effizient in DataFrames zu laden, zu bereinigen und für das ML-Modell zu normalisieren.
* **`technicalindicators` (npm):** Berechnet mathematische Features wie RSI, MACD oder ATR (Volatilität) direkt in Node.js.

### Machine Learning Kern
* **`@tensorflow/tfjs-node`:** Native C++ Bindings für TensorFlow in Node.js (nutzt CPU/GPU voll aus).
    * *Modell-Architektur:* **LSTM (Long Short-Term Memory)** – Ein rekurrentes neuronales Netzwerk, das speziell für sequenzielle Zeitreihendaten und Mustererkennung über Zeitintervalle hinweg geeignet ist.

---

## 2. Der geplante Ansatz (Die Daten-Pipeline)

Um den Netzwerk-Flaschenhals zu minimieren und maximale Performance beim Training zu erzielen, wird ein **Hybrid-Ansatz** für das Datenmanagement gewählt:

### Phase 1: Data Ingestion & Extraction (TiDB ➔ Lokal)
1. Rohe Bitcoin-Kerzen-Daten liegen persistent in **TiDB**.
2. Das Node.js-Backend feuert eine optimierte SQL-Abfrage an die TiFlash-Engine ab, um den benötigten historischen Zeitraum zu extrahieren.
3. Die Daten werden lokal auf dem Server als temporäres File (CSV) oder direkt im RAM in ein `danfojs-node` DataFrame geladen.

### Phase 2: Feature Engineering & Preprocessing
1. **Feature-Berechnung:** Das DataFrame wird mit technischen Indikatoren angereichert (z. B. Volatilitätsfilter).
2. **Normalisierung:** Transformation der Werte auf eine Skala zwischen `0` und `1`, da neuronale Netze extreme Preissprünge nativ schlecht verarbeiten können.
3. **Data Splitting:** Strikt chronologische Trennung der Daten (In-Sample für Training/Optimierung, Out-of-Sample für die Validierung), um *Data Leakage* (Zukunftsvorschau) zu verhindern.

### Phase 3: Modell-Training & Strikte Validierung (Local Compute)
1. **Lokales Training:** TensorFlow.js trainiert das LSTM-Modell vollständig isoliert im lokalen Speicher, ohne die Datenbank während der Epochen zu belasten.
2. **Permutationstests (Schutz vor Overfitting):** * Implementation einer TypeScript-Validierungsklasse.
    * Shuffeln (Permutieren) der historischen Daten, um zu überprüfen, ob das Modell auf reinem Rauschen (Data-Mining-Bias) ähnliche Ergebnisse erzielt hätte. Ein niedriger P-Wert (< 1%) ist das Ziel.

### Phase 4: Speicherung & Live-Inferenz
1. Das fertige Modell (`model.json` + Weights) wird lokal oder in einem Cloud-Speicher abgelegt.
2. Im Live-Betrieb holt sich Node.js neue Ticks aus TiDB, füttert das lokale Modell und schreibt die generierten Vorhersagen (`predicted_regime`, `confidence`) zurück in TiDB für das anschließende Order-Management.

---

## 3. Datenfluss-Diagramm
TiDB dient als performanter Datenspeicher, von dem aus große Mengen an historischen BTC-Daten effizient abgefragt werden.

* Die Daten verlassen die Datenbank nur einmal vor dem Trainingsprozess, um als lokale Datei oder im Arbeitsspeicher abgelegt zu werden, damit der Netzwerk-Flaschenhals eliminiert wird.
* Danfo.js und die Technical Indicators verarbeiten die Daten sequenziell und berechnen die mathematischen Inputs für das Modell.
* TensorFlow.js führt das rechenintensive Training (die Epochen) lokal durch, ohne jemals wieder die Datenbank zu kontaktieren.
* Die Ergebnisse (Metriken, P-Werte und finale Gewichtungen) werden am Ende für das spätere System-Monitoring wieder zurück in TiDB dokumentiert.