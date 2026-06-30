# CrashRadar - Indicator Engine Architektur

Die `IndicatorEngine` verarbeitet und evaluiert alle gesammelten Finanz- und Makrodaten. Hierbei wird konzeptionell zwischen zwei Ebenen der Datenkombination und Ausgabe unterschieden:

### 1. Engine-Ebene (Reporting & Benachrichtigung): Individuelle Darstellung
Die Engine selbst berechnet aktuell keinen globalen Aggregat-Score ("Super-Score" über alle Metriken). 
* Wenn Reports oder Alerts generiert werden (`generateReport`, `getAlerts`), durchläuft die Engine die Indikatorenliste sequenziell.
* Jeder Indikator wird einzeln evaluiert und triggert für sich sein eigenes Signal (CRITICAL, WARNING, OK).
* In Zusammenfassungen wie dem `DailyStatusReport` werden die ausgelösten Fehler und Warnungen lediglich pro Kategorie gezählt, um einen groben Tagesstatus zu definieren, ohne sie komplex zu verschmelzen.
* **Grund:** Maximale Transparenz im Reporting. Der Nutzer sieht sofort, welches spezifische Setup gefeuert hat.

### 2. Indikator-Ebene (Logik): Komplexe Verknüpfungen (Meta-Indikatoren)
Innerhalb der einzelnen Indikator-Regeln findet bereits eine tiefe Kombination verschiedener Metriken und Assets statt. Viele Indikatoren sind "Meta-Indikatoren", die nur triggern, wenn mehrere spezifische Bedingungen zusammenkommen:

* **Red Alert (Bullenmarkt-Stirbt-Signal):** Kombiniert `SKEW` (Panik der Profis), `ShortVolumeRatio` (Retail Capitulation) und `Put/Call Ratio` (Melt-Up Phase).
* **Panik-Kapitulation:** Sucht gleichzeitig nach `VIX` Spikes, `CBOE` Optionsvolumen-Spikes und bestätigt diese über eine bullische Divergenz im `RSI` gegenüber dem reinen Preis (`SPY`).
* **Central Bank Policy Error:** Vergleicht die Leitzinsentwicklung (`DFF`) mit den Inflationserwartungen (`T10YIE`) und integriert den US-Dollar (`DXY`) als Störfaktor-Filter.
* **Divergenzen (Bitcoin/Makro & Gold/GDX):** Analysieren die relative Performance zweier sich normalerweise synchron bewegender Datensätze, um Warnungen bei Abweichungen (Liquiditätsentzug) zu generieren.

**Fazit:** 
Komplexe, multikausale Kombinationen finden in CrashRadar direkt **in der Logik der spezifischen Indikatoren** statt. Im Output und Monitoring werden diese jedoch bewusst als **diskrete Einzel-Signale** behandelt, um das Rauschen zu minimieren und die Ursache eines Alarms sofort identifizierbar zu machen.

---

# ML-Modell & Labeling: Update-Strategie

Dieses Dokument beschreibt, wie das Machine Learning Modell (LSTM für Regime Classification) des CrashRadar weiter lernt und aktualisiert wird.

## Kein "blindes" Auto-Learning
Das Modell trainiert sich **nicht** vollautomatisch im täglichen Live-Betrieb (Cronjob) selbst. Finanzmärkte sind extrem verrauscht; ein Auto-Learning würde schnell zu einem Overfitting auf kurzfristiges Rauschen führen (Data-Leakage / Bias). Wir nutzen stattdessen den **"Hardcoded Ground Truth"**-Ansatz.

## Hardcoded Ground Truth (Lexikon)
Die Labels (`MACRO_TOP`, `MACRO_BOTTOM`, `UPTREND`, `DOWNTREND`) definieren wir fest über historische Zeiträume (Datum A bis Datum B).
*   Diese Zyklen werden in einer dedizierten Konfigurationsdatei (z. B. `config/ML-Cycles-Config.json`) gepflegt.

## Der Trigger (Human in the Loop)
Wenn der Markt in Zukunft einen neuen Makro-Wendepunkt eindeutig bestätigt (z.B. ein signifikantes neues "Tal der Tränen" nach einem Bärenmarkt), pflegen wir diese Datums-Range manuell in die Konfiguration ein. Das Modell lernt also erst dann, wenn *wir* den Ground Truth um eine neue Phase erweitern.

## Der Retrain-Prozess (GitHub Action & `npm run ml:retrain`)
Nach einem Update der Konfiguration wird der Retrain-Prozess entweder manuell als Workflow in den GitHub Actions (`workflow_dispatch`) angestoßen, oder er läuft ohnehin völlig automatisch durch den hinterlegten Cronjob (`yearly-retrain.yml`) einmal im Jahr ab. Die GitHub Action führt dabei den Befehl `npm run ml:retrain` aus, welcher folgende Schritte autonom erledigt:
1. Es zieht sich die komplette Historie der Bitcoin-Kurse aus der TiDB.
2. Es berechnet die stationären Features (RSI, MACD, Renditen).
3. Es mappt die Zyklen aus der Konfiguration auf die Daten (Labeling).
4. Es trainiert das neuronale Netz (`@tensorflow/tfjs`) komplett neu über alle Epochen.
5. Es überschreibt nativ die gespeicherten Netz-Gewichte (`weights.json` und `model.json`) im Dateisystem (unter `data/ml/models/`).
