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
