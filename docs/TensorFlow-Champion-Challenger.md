# TensorFlow Champion-Challenger: Test-Dimensionen

## 1. Die Label-Architektur (Zielvorgaben)
* **Zeit-Fenster vs. Struktureller Bruch:** Starre Lookaround-Fenster (z. B. 120 Tage) im Vergleich zur "Break of Market Structure" (BOS) Logik (z. B. Bruch des letzten Hochs + Golden Cross).
* **4 vs. 5 Klassen:** Das Basis-Setup (Top, Bottom, Uptrend, Downtrend) im Vergleich zu einem erweiterten Modell mit der zusätzlichen Klasse **"Base" (Akkumulationsphase)** für monatelange Seitwärtsphasen.

## 2. Die Preis- und Basis-Dimension (Fundament)
* **Rendite-Berechnung:** Prozentuale Renditen im Vergleich zu **Logarithmischen Renditen (Log Returns)** für mathematische Symmetrie und einen stabileren Gradientenabstieg.
* **Kurs-Glättung:** Täglicher Roh-Close-Preis im Vergleich zu einem schnellen exponentiellen Durchschnitt (z. B. EMA 3 oder EMA 5), um das tägliche Rauschen auszufiltern.

## 3. Die Volumen-Dimension (Institutioneller Treibstoff)
* **Volumen-Z-Score:** Aktuelles Tagesvolumen normalisiert gegen den gleitenden Durchschnitt (z. B. SMA 50).
* **Short Volume Ratio:** Tägliches Short-Volumen im prozentualen Verhältnis zum Gesamtvolumen (Fokus auf Kapitulations-Tiefs oder Squeeze-Potenzial).
* **Volumendivergenz (OBV):** On-Balance-Volume zur Erkennung von stiller Akkumulation oder Distribution in längeren Seitwärtsphasen.

## 4. Die Makro-Struktur-Dimension (Kontext)
* **Zyklus-Position:** Prozentualer (normalisierter) Abstand zum 52-Wochen-Hoch und 52-Wochen-Tief.
* **Durchschnitte:** Prozentualer Abstand des aktuellen Kurses zum SMA 50 und SMA 200.
* **Trend-Dynamik:** **SMA 200 Slope** (Steigung bzw. erste Ableitung der 200-Tage-Linie) zur Erkennung von abflachenden Abwärtstrends.

## 5. Evaluierungs-Metriken (Für das ungelabelte Holdout-Set)
* **F1-Score:** Ausbalancierung von Präzision (Trefferquote) und Recall (Wie viele echte Böden wurden vom Modell übersehen?).
* **Profit Factor:** Bruttogewinn geteilt durch Bruttoverlust (Zielwert > 1.5).
* **Maximaler Drawdown (MDD):** Der höchste temporäre Wertverlust des Systems, um das Risiko in schwierigen Marktphasen zu bewerten.