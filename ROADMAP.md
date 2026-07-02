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


