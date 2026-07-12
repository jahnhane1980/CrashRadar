# CrashRadar: ML Feature Research & Hypothesen

> [!WARNING]
> **[STATUS: ZU VERIFIZIERENDES EXPERIMENT]**
> Die in diesem Dokument beschriebenen Konzepte sind derzeit theoretische Hypothesen zur Verbesserung unserer ML-Modelle. Es muss durch Backtesting und Evaluierung erst noch verifiziert werden, ob diese Features in der Praxis tatsächlich einen quantifizierbaren Vorteil (höhere Konfidenz, weniger Bias) beim Training generieren.

Dieses Dokument sammelt theoretische Konzepte und Feature-Ideen, die in zukünftige `<Ticker>FeatureBuilder` (siehe `ML_ARCHITECTURE.md`) integriert werden könnten, um die Schwächen des aktuellen LSTMs (insbesondere bei hochvolatilen Growth-Aktien) zu beheben.

---

## 1. Das Leptokurtische Modell (Fat Tails) vs. Z-Scores
**Quelle:** Samir Varma, PhD (Quantitativer Trading-Ansatz)

* **Die Hypothese / Das Problem:** 
  Finanzmärkte weisen "Fat Tails" (extrem seltene, aber heftige Ausschläge) auf. Wir nutzen aktuell den `Volume_Z_Score` als Feature. Eine Z-Score-Normalisierung zwingt die Daten jedoch mathematisch in eine Normalverteilung. Dadurch werden extreme Crash- oder Squeeze-Ausschläge (Fat Tails) als Ausreißer behandelt und vom Netz potenziell unterschätzt oder abgeschnitten. Dies könnte den starken "Bias" bei unseren Einzelaktien-Modellen erklären.
* **Die experimentelle Lösung (Feature Engineering):** 
  Wir testen den Wechsel von Z-Score auf **Robust Scaling** (basierend auf Median und Quartilsabständen) oder **Quantile-Transformationen**. Das Ziel ist es, dem Modell die extremen "Fat Tail"-Ausschläge als harte, mathematische Signale zu übergeben, ohne dass die Annahme einer Normalverteilung diese verzerrt.

## 2. Struktur-Anker: Abstand zu gleitenden Durchschnitten (SMA)
**Quelle:** Samir Varma, PhD

* **Die Hypothese / Das Problem:** 
  Das LSTM betrachtet derzeit prozentuale Tagesrenditen (`Log_Return_EMA3`) und den Abstand zu 52-Wochen-Hochs/Tiefs. In stark schwankenden, seitwärts laufenden Bärenmärkten verliert das Modell gelegentlich den übergeordneten Makro-Trend und stuft Bewegungen fälschlicherweise als `BULL_CORRECTION` ein.
* **Die experimentelle Lösung (Feature Engineering):** 
  Wir führen den **Abstand zur 200-Tage-Linie (SMA-200)** und zur **50-Tage-Linie (SMA-50)** als explizite prozentuale Features ein (z.B. `Dist_SMA200`). Dies dient als Schwerkraft-Anker für das LSTM (z.B. "Solange der Kurs signifikant unter dem SMA-200 liegt, ist ein `UPTREND` mathematisch stark zu pönalisieren").

## 3. Post-Processing: Fraktionales Kelly-Modell
**Quelle:** Samir Varma, PhD

* **Die Hypothese / Das Problem:** 
  Aktuell gibt unser Modell eine Klassifikation (z.B. `DOWNTREND` mit 85% Konfidenz) aus. Dies ist für eine automatisierte Steuerung oder klare Handlungsanweisungen oft zu abstrakt.
* **Die experimentelle Lösung (System-Integration):** 
  Wir erweitern die finale Bot-Ausgabe in `ml.js` um das **fraktionale Kelly-Modell**. Das Modell berechnet aus der Konfidenz der Vorhersage und den historischen Trefferquoten des Netzes eine optimale, risikoadjustierte Positionsgröße.
  * *Beispiel-Output:* Statt nur "Warnung: DOWNTREND (85%)" berechnet die Engine einen strikten Sicherheitsfaktor: "Empfohlenes Exposure nach fraktionalem Kelly (Faktor 0.3): Max. 15% Aktien, 85% Cash/T-Bills."
# CrashRadar: ML Feature Research & Hypothesen

> [!WARNING]
> **[STATUS: ZU VERIFIZIERENDES EXPERIMENT]**
> Die in diesem Dokument beschriebenen Konzepte sind derzeit theoretische Hypothesen zur Verbesserung unserer ML-Modelle. Es muss durch Backtesting und Evaluierung erst noch verifiziert werden, ob diese Features in der Praxis tatsächlich einen quantifizierbaren Vorteil (höhere Konfidenz, weniger Bias) beim Training generieren.

Dieses Dokument sammelt theoretische Konzepte und Feature-Ideen, die in zukünftige `<Ticker>FeatureBuilder` (siehe `ML_ARCHITECTURE.md`) integriert werden könnten, um die Schwächen des aktuellen LSTMs (insbesondere bei hochvolatilen Growth-Aktien) zu beheben.

---

## 1. Das Leptokurtische Modell (Fat Tails) vs. Z-Scores
**Quelle:** Samir Varma, PhD (Quantitativer Trading-Ansatz)

* **Die Hypothese / Das Problem:** 
  Finanzmärkte weisen "Fat Tails" (extrem seltene, aber heftige Ausschläge) auf. Wir nutzen aktuell den `Volume_Z_Score` als Feature. Eine Z-Score-Normalisierung zwingt die Daten jedoch mathematisch in eine Normalverteilung. Dadurch werden extreme Crash- oder Squeeze-Ausschläge (Fat Tails) als Ausreißer behandelt und vom Netz potenziell unterschätzt oder abgeschnitten. Dies könnte den starken "Bias" bei unseren Einzelaktien-Modellen erklären.
* **Die experimentelle Lösung (Feature Engineering):** 
  Wir testen den Wechsel von Z-Score auf **Robust Scaling** (basierend auf Median und Quartilsabständen) oder **Quantile-Transformationen**. Das Ziel ist es, dem Modell die extremen "Fat Tail"-Ausschläge als harte, mathematische Signale zu übergeben, ohne dass die Annahme einer Normalverteilung diese verzerrt.

## 2. Struktur-Anker: Abstand zu gleitenden Durchschnitten (SMA)
**Quelle:** Samir Varma, PhD

* **Die Hypothese / Das Problem:** 
  Das LSTM betrachtet derzeit prozentuale Tagesrenditen (`Log_Return_EMA3`) und den Abstand zu 52-Wochen-Hochs/Tiefs. In stark schwankenden, seitwärts laufenden Bärenmärkten verliert das Modell gelegentlich den übergeordneten Makro-Trend und stuft Bewegungen fälschlicherweise als `BULL_CORRECTION` ein.
* **Die experimentelle Lösung (Feature Engineering):** 
  Wir führen den **Abstand zur 200-Tage-Linie (SMA-200)** und zur **50-Tage-Linie (SMA-50)** als explizite prozentuale Features ein (z.B. `Dist_SMA200`). Dies dient als Schwerkraft-Anker für das LSTM (z.B. "Solange der Kurs signifikant unter dem SMA-200 liegt, ist ein `UPTREND` mathematisch stark zu pönalisieren").

## 3. Post-Processing: Fraktionales Kelly-Modell
**Quelle:** Samir Varma, PhD

* **Die Hypothese / Das Problem:** 
  Aktuell gibt unser Modell eine Klassifikation (z.B. `DOWNTREND` mit 85% Konfidenz) aus. Dies ist für eine automatisierte Steuerung oder klare Handlungsanweisungen oft zu abstrakt.
* **Die experimentelle Lösung (System-Integration):** 
  Wir erweitern die finale Bot-Ausgabe in `ml.js` um das **fraktionale Kelly-Modell**. Das Modell berechnet aus der Konfidenz der Vorhersage und den historischen Trefferquoten des Netzes eine optimale, risikoadjustierte Positionsgröße.
  * *Beispiel-Output:* Statt nur "Warnung: DOWNTREND (85%)" berechnet die Engine einen strikten Sicherheitsfaktor: "Empfohlenes Exposure nach fraktionalem Kelly (Faktor 0.3): Max. 15% Aktien, 85% Cash/T-Bills."

## 4. Kausalitäts-Brücke: FINRA Short-Volume & SEC Fundamentaldaten
**Quelle:** Historischer FINRA-Backtest (2021-2022) & EDGAR 13F/10-Q Korrelationsanalyse

* **Die Hypothese / Das Problem:**
  LSTMs zeigten einen massiven Bias (SOFI = Dauer-Bullish, NVTS = Dauer-Bearish). Hohes Off-Exchange Short-Volume (>65%) wirkt je nach Aktie komplett unterschiedlich: Bei ZETA löst es einen Squeeze aus, bei NVTS verstärkt es den Crash. Ohne Fundamentaldaten versteht das Netz diese Divergenz nicht und prägt sich stur den historischen Kursverlauf des jeweiligen Tickers ein (Rauschen statt Intelligenz).
* **Die experimentelle Lösung (Occam's Razor & Separation of Concerns):**
  Es wäre ein architektonischer Fehler (Bloat), das neuronale Netz mit abstrakten Bilanzen (Institutional Ownership, Dilution Risk) zu füttern. Ein dediziertes Netz pro Ticker (z.B. `LSTM_ZETA`) lernt die Mechanik der Aktie vollautomatisch, wenn man es **strikt minimal** hält: Nur Preis-Action und **FINRA Short-Volume**.
  
  **Das Concept-Drift Problem:** Wenn sich the Bilanzen plötzlich ändern (ZETA verliert Inst. Ownership, NVTS stoppt Verwässerung), würde das minimale LSTM stur falsche Squeezes vorhersagen. 
  **Die Architektur-Brücke:** Um das zu verhindern, lagern wir die Fundamentaldaten komplett in die `TradeSetupEngine` aus.
  1. **Das ML-Modell** bleibt winzig und liefert nur das rohe Signal (basierend auf Short-Volume).
  2. **Die TradeSetupEngine** agiert als Security-Guard. Sie feuert einen Fetcher, der quartalsweise `Institutional_Ownership` (aus 13F) und `Dilution_Risk` (aus 10-Q) prüft. 
  3. Sagt das LSTM "ZETA Squeeze", aber die TradeSetupEngine sieht in der DB, dass die Inst. Quote von 80% auf 30% gefallen ist, wirft sie ein **VETO** und blockiert den Trade. 
  
  So kombinieren wir ein blitzschnelles, fittes ML-Modell mit absoluter fundamentaler Sicherheit gegen Bilanz-Strukturbrüche.
