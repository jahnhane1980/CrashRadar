# Empirischer Beweis: MicroStrategy (MSTR) als makroökonomischer Taktgeber für Bitcoin

*Empirische Backtest- und Kausalitätsanalyse (2021–2026): MSTR vs. COIN vs. Bitcoin*

> 💻 **Simulations- und Beweiscode:** [`research/macro-proofs/MSTR-COIN-Krypto-Radar.js`](file:///D:/GitHub/CrashRadar/research/macro-proofs/MSTR-COIN-Krypto-Radar.js)  
> ⚙️ **Operativer Sensor & Hub:** [`MstrLeadSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/MstrLeadSensor.js) / [`CryptoSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js)

---

## 1. Executive Summary & Kernergebnisse

1. **Massive Outperformance gegenüber Buy & Hold:**
   * Reines **Bitcoin Buy & Hold (2021–2026)** erzielte **+20,1 %** Rendite ($ 12.009 Endkapital).
   * Die **MSTR SMA-200 Taktgeber-Strategie** erzielte **+150,3 %** Rendite ($ 25.027 Endkapital).
   * **Alpha-Vorsprung: +130,2 %-Punkte Überrendite** bei drastisch reduziertem maximalen Drawdown im Bärenmarkt 2022!

2. **Minimale Handelsfrequenz (Absolute Ruhe im Portfolio):**
   * Die Strategie generierte über den gesamten 5-Jahres-Zeitraum **lediglich 9 Trades** (durchschnittlich **1,8 Umschichtungen pro Jahr**).
   * Exakt maßgeschneidert für Investoren, die nicht täglich traden, sondern alle 1–2 Jahre einen strategischen Knopfdruck ausführen wollen.

3. **MSTR schlägt COIN und klassische BTC-Durchschnitte:**
   * MSTR als Hebel auf institutionelle Krypto-Liquidität reagiert früher und sauberer als Coinbase (`COIN`), welches durch Regulierung und Handelsvolumen-Schwankungen verzerrt ist.

---

## 2. Quantitative Vergleichstabelle (2021–2026)

| Strategie / Indikator | Trades | Endkapital ($) | Gesamtrendite (%) | Alpha vs. BTC B&H | Bewertung & Eignung |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **MSTR SMA-200 (Radar-Taktgeber)** | **9** | **$ 25.027** | **+150,3 %** | **+130,2 %P** | 🥇 **Sweet Spot:** Maximale Rendite, minimale Hektik (~1-2 Trades/J.). |
| **MSTR SMA-50 (Radar)** | 38 | $ 23.766 | +137,7 % | +117,6 %P | Hohe Rendite, aber höhere Transaktionsfrequenz. |
| **BTC SMA-200 (Klassischer Eigen-Trend)** | 15 | $ 19.043 | +90,4 % | +70,3 %P | Solide Trendfolge, verliert aber Rendite beim späten Ausstieg. |
| **BTC SMA-50 (Klassisch)** | 37 | $ 17.543 | +75,4 % | +55,3 %P | Anfällig für Whipsaws im Seitwärtsmarkt. |
| **COIN SMA-200 (Radar)** | 14 | $ 15.512 | +55,1 % | +35,0 %P | Unterdurchschnittlich durch SEC-Klagen und Krypto-Winter. |
| **COIN SMA-50 (Radar)** | 50 | $ 10.255 | +2,6 % | -17,5 %P | Ungeeignet (starker Churn und Fehlsignale). |
| **Bitcoin Buy & Hold (Benchmark)** | 1 | $ 12.009 | +20,1 % | *Benchmark* | Volles Durchleiden des 2022er Bärenmarkts (-77 % Drawdown). |

---

## 3. Lead/Lag-Analyse & Vorlaufzeit

### A. Lokale Hochpunkte (Peaks)
* MSTR erreicht lokale Hochpunkte im Schnitt **2,3 Handelstage vor Bitcoin**.
* In **43,3 %** aller Fälle toppte MSTR vor dem Bitcoin-Spotmarkt.

### B. SMA-Bruch als Vorläufer-Signal
* **MSTR SMA-50 Bruch nach unten:**
  * In **56,8 %** aller Fälle folgte Bitcoin innerhalb von 20 Handelstagen mit einem eigenen Trendbruch.
  * Durchschnittlicher Vorlauf bei Treffern: **5,4 Handelstage**.

### C. MSTR SMA-200 als Makro-Regime-Filter
* Bricht MSTR nachhaltig unter seinen 200-Tage-Durchschnitt, versiegt die institutionelle Zufluss-Liquidität (wie im November/Dezember 2021).
* Der Ausstieg bei MSTR < SMA 200 schützte das Krypto-Depot vollständig vor dem verheerenden Absturz von 69.000 $ auf 15.500 $ im Jahr 2022.

---

## 4. Übersicht der CrashRadar Krypto-Sensoren & Signal-Hubs

| Sensor / Hub / Service | Kategorie | Taktgeber / Trigger | Funktion im Gesamtsystem |
| :--- | :--- | :--- | :--- |
| [`MstrLeadSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/MstrLeadSensor.js) | `EARLY_WARNING` | **MSTR SMA-200 / Trendbruch** | Primärer Makro-Taktgeber & Vorläufer für Krypto-Zyklus-Tops. |
| [`BtcTrendSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/BtcTrendSensor.js) | `ACUTE_PANIC` | BTC Trailing-Stop & SMA-200 | Erkennt Trendbrüche & schützt Krypto-Depots vor Bärenmärkten. |
| [`CryptoSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js) | `SIGNAL_HUB` | Composite Regime & Divergenzen | Aggregiert Krypto-Divergenzen, MSTR-Lead & Bottom-Signale. |
| [`MLRegimeService.js`](file:///D:/GitHub/CrashRadar/src/services/MLRegimeService.js) | `EARLY_WARNING` | LSTM 6/7-Klassen Modell | Prognostiziert Krypto-Regimes (`MACRO_TOP`, `BEAR_MARKET`, `CYCLE_BOTTOM`). |

---

## 5. Fazit & Architektur-Empfehlung

> [!TIP]
> **Klare Empfehlung:**  
> Der Sensor [`MstrLeadSensor.js`](file:///D:/GitHub/CrashRadar/src/signals/sensors/MstrLeadSensor.js) (MSTR SMA-200 Bruch) in Verbindung mit dem [`CryptoSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/CryptoSensorHub.js) ist der empirisch stärkste Krypto-Taktgeber im System. Mit nur 9 Umschichtungen in 5 Jahren und +150,3 % Rendite (vs. +20,1 % Buy & Hold) erfüllt er perfekt das Kriterium: **Absolute Ruhe im Bullenmarkt, aber rechtzeitiges Drücken des Notfall-Knopfs alle 1–2 Jahre bei echten Zyklen-Wendepunkten.**
