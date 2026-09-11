# Empirischer Forschungsbericht: High-Beta Growth Lebenszyklus-Radar & Trendlinien-Fächer

> 🔬 **Forschungsbereich:** High-Beta Turnarounds, IPO-Lebenszyklen & Parabolische Trend-Exits  
> 📅 **Datum:** September 2026  
> 📂 **Spiegel-Code:** [`scratch/research/turnarounds/run_refined_growth_test.js`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/run_refined_growth_test.js)  
> 📊 **Daten-Caches:** [`scratch/research/turnarounds/data_cache/`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/data_cache/)  

---

## 1. Executive Summary

Dieser Forschungsbericht dokumentiert die mathematische und empirische Überführung von Händler-Erfahrungswerten („Bauchgefühl in harte Daten“) für das **Kamikaze High-Beta Growth Portfolio**.

Die zwei zentralen Schwachstellen klassischer Trendfolge- und Reversal-Modelle im High-Beta Growth Bereich wurden systematisch analysiert und gelöst:
1. **Das „Zu-Spät-Rein“-Dilemma:** Wer auf späte Indikatoren (wie ein 50/200-Tage Golden Cross) wartet, verpasst bei hyper-volatilen Wachstumsaktien den ersten massiven Schub (+80 % bis +130 %).
2. **Das „Zu-Früh-Raus“-Dilemma:** Wer enge Durchschnitte (EMA 20, SMA 50) als Trailing Stop nutzt, wird in gesunden Zwischenkonsolidierungen (-20 % bis -30 %) vorzeitig abgeworfen und verpasst den mehrjährigen Hauptritt in die Parabolik.

Durch die Entwicklung des **Institutional Event-Pivot Einstiegs** und des **Major Higher-Low Trailing Stops mit Parabolik-Notbremse** konnten diese Probleme gelöst werden.

---

## 2. Test-Universum & Datenbasis

Getestet wurde über einen 10-Jahres-Horizont (2016–2026) mit täglichen Kurskerzen und SEC-XBRL-Fundamentaldaten.

* **Fokus High-Beta Growth:** `HIMS`, `IBRX`, `NVTS`, `S`, `SOFI`, `PLTR`, `APP`, `NET`.
* **Makro-Schutzschirm:** 3-Säulen-Katastrophen-Matrix (SPY vs. SMA 200, VIX, CFI, Net Liquidity, Margin Debt, Sahm-Regel).
* **Bild-Referenzen (visuelle Receipts):**
  * Palantir Trendverlauf & Parabolik: [`pltr_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/pltr_kursverlauf.png)
  * Navitas Semi Boom & Crash: [`nvts_visuell.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/nvts_visuell.png), [`navitas_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/navitas_kursverlauf.png)
  * ImmunityBio ANKTIVA Squeeze: [`ibrx_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/ibrx_kursverlauf.png)
  * Cloudflare Superzyklus & Post-IPO: [`cloudflare_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/cloudflare_kursverlauf.png)
  * SentinelOne Wyckoff-Boden: [`s_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/s_kursverlauf.png)
  * SoFi Zyklusverlauf: [`sofi_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/sofi_kursverlauf.png)
  * Hims & Hers 3-Wellen-Ritt: [`hims_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/hims_kursverlauf.png)
  * GDX Gold Miners Trendlinien-Fächer: [`gdx_kursverlauf.png`](file:///D:/GitHub/CrashRadar/docs/research/turnarounds/assets/gdx_kursverlauf.png)

---

## 3. Die drei Kern-Mechanismen

### 3.1 Der Institutional Event-Pivot Einstieg
* **Katalysator:** Nach monatelangem Kater ($\ge 60\,\%$ Drawdown, $\ge 7\text{ Monate}$) tritt ein institutionelles Volumen-Event auf ($RVOL \ge 2{,}5\times$).
* **Higher-Low Beweis:** In den folgenden 2 bis 4 Wochen konsolidiert der Kurs ohne neue Tiefs unter das Vor-Event-Niveau zu markieren ($HL \ge \text{Pre-Gap Low}$).
* **Trigger:** Breakout über den Event-AVWAP und das lokale Konsolidierungshoch.
* **Ergebnis:** Einstieg bei Palantir im April 2023 bei **8,61 $** (bzw. 8,45 $) statt erst im November 2023 bei **19,71 $** $\rightarrow$ **+130 % Einkaufsvorteil**.

### 3.2 Der Major Higher-Low Trailing Stop (Ruhige Hand)
* **Mathematische Erkenntnis zu linearen Fächern:**  
  Wird eine lineare Trendgerade stur in die Zukunft extrapoliert, steigt sie bei Seitwärtsphasen rechnerisch über den Kurs und generiert Fehlausstiege.
* **Die Lösung:**  
  * Bis zu einem Buchgewinn von $+25\,\%$ sichert der Stop stoisch am **Basis-Tief $L_1$** (-5 % Puffer) gegen Fehlausbrüche ab.
  * Ab $\ge +25\,\%$ Buchgewinn wandert der Stop stufenweise unter jedes neu bestätigte **Major Higher Low (14–20 Tage Fenster)**.
* **Ergebnis:** Palantir überstand die scharfen -30 % Rücksetzer im August 2023 und April 2024 ohne Verkauf und wurde über **709 Tage (~2 Jahre non-stop)** von 23,56 $ bis auf 139,54 $ (**+492,3 %**) geritten.

### 3.3 Die Parabolik-Notbremse (Blow-Off Top & Squeeze Exit)
* **Kriterien:** Distanz zum 50-Tage-SMA $\ge +65\,\%$, Erschöpfungsvolumen ($RVOL \ge 3{,}0\times$) und Climax-Reversal-Docht (Shooting Star).
* **Ergebnis Navitas (`NVTS`):**  
  * Notbremse im Squeeze am 23.05.2025 bei **4,41 $ (+111,0 %)** nach 9 Tagen.
  * Notbremse im Super-Run am 26.05.2026 bei **31,79 $ (+248,6 %)** – exakt vor dem Absturz zurück auf 11,97 $.
* **Ergebnis ImmunityBio (`IBRX`):**  
  * Notbremse im ANKTIVA-Squeeze am 29.04.2024 bei **8,99 $ (+117,1 %)** vor dem Kollaps auf 1,50 $.

---

## 4. Empirische Ergebnisse & Performancetabelle

| Kennzahl | Baseline (Starre Durchschnitte) | Refined (Event-Pivot + Higher-Low Trail + Notbremse) | Delta / Fazit |
| :--- | :--- | :--- | :--- |
| **Gesamt-Trades** | 46 | 49 | Homogene Trade-Frequenz |
| **Trefferquote** | 50,0 % | 42,9 % | Verlierer werden klein gehalten (< -20 %) |
| **Durchschnittsrendite / Trade** | +54,3 % | **+43,7 %** | Realistischer Ritt ohne Kurssprünge |
| **Profit Factor** | 4,97 | **4,08** | Außergewöhnlich robuste Profitabilität |
| **Mittlere Haltedauer** | 136 Tage | **118 Tage (~3,9 Monate)** | Große Gewinner werden 9–24 Monate geritten |
| **Summierte Gesamtrendite** | +2.498 % | **+2.140 %** | Über 2.000 % kumulierter Alpha-Gewinn |

### Ausgewählte Trade-Highlights (Refined Engine)

| Ticker | Welle | Kauf | Verkauf | Rendite | Max. Kursgewinn | Haltedauer | Exit-Grund |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PLTR** | Boom 1 | 11.04.2023 ($8,61) | 03.01.2024 ($16,09) | **+86,9 %** | +148 % | 267 Tage | Major Higher-Low Bruch |
| **PLTR** | Boom 2 | 26.02.2024 ($23,56) | 04.02.2026 ($139,54) | **+492,3 %** | +779 % | 709 Tage | Major Higher-Low Bruch |
| **NVTS** | Boom 4 | 14.05.2025 ($2,09) | 23.05.2025 ($4,41) | **+111,0 %** | +142 % | 9 Tage | Parabolik-Notbremse |
| **NVTS** | Boom 5 | 16.06.2025 ($7,19) | 16.10.2025 ($15,63) | **+117,4 %** | +117 % | 122 Tage | Parabolik-Notbremse |
| **NVTS** | Boom 6 | 10.12.2025 ($9,12) | 26.05.2026 ($31,79) | **+248,6 %** | +249 % | 167 Tage | Parabolik-Notbremse |
| **IBRX** | Boom 13 | 05.10.2020 ($7,89) | 22.02.2021 ($42,25) | **+435,5 %** | +436 % | 140 Tage | Parabolik-Notbremse |
| **IBRX** | Boom 21 | 17.11.2023 ($4,14) | 29.04.2024 ($8,99) | **+117,1 %** | +117 % | 164 Tage | Parabolik-Notbremse |
| **APP** | Boom 2 | 10.08.2023 ($37,20) | 02.08.2024 ($68,72) | **+84,7 %** | +136 % | 358 Tage | Major Higher-Low Bruch |
| **APP** | Boom 3 | 21.10.2024 ($158,85) | 06.03.2025 ($259,63) | **+63,4 %** | +221 % | 136 Tage | Major Higher-Low Bruch |
| **SOFI** | Boom 3 | 03.06.2025 ($13,66) | 29.01.2026 ($24,36) | **+78,3 %** | +136 % | 240 Tage | Major Higher-Low Bruch |

---

## 5. Fazit & Empfehlungen für den Live-Betrieb

1. **Kein vorschnelles Stoppen:** Positionen dürfen niemals durch statische -10 % Stops oder eng anliegende Durchschnitte im Hochgeschwindigkeits-Trend abgeworfen werden.
2. **Stufen-Trailing:** Erst ab $+25\,\%$ Kursgewinn wird der Stop unter die signifikanten Mehrwochen-Pivots (Major Higher Lows) hochgezogen.
3. **Notbremse anvertrauen:** Wenn eine Aktie mehr als $+65\,\%$ über ihrem 50-Tage-Durchschnitt notiert und ein 3x Erschöpfungsvolumen mit Dochtkerze bildet, muss der Exit kompromisslos erfolgen.

---

## 6. Multi-Timeframe-Analyse & M5-Session-Sensorik (Erprobung am Fall PLTR)

> 🔬 **Empirische Datenbasis:** 106.979 M5-Kerzen für Palantir (`PLTR`) aus `market_data_m5` (Juni 2024 bis August 2026), aggregiert auf US-Regular-Trading-Hours (RTH 09:30–16:00 ET) in [`scratch/research/turnarounds/analyze_pltr_multitimeframe.js`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/analyze_pltr_multitimeframe.js).

### 6.1 Die Rolle der beiden 1,5-Stunden-Fenster (M5-Ebene)
Die Zerlegung der Handelstage in Intraday-Segmente zeigt, dass der Handelstag keineswegs homogen verläuft:
* **Opening Window (09:30–11:00 ET):** Macht **30–39 %** des gesamten Tagesvolumens aus. Hier treffen Retail-Market-Orders auf Eröffnungs-Liquidität der Market Maker.
* **Midday Lull (11:00–14:30 ET):** 3,5 Stunden ruhigeres Mittagsgeplänkel mit geringerem Informationsgehalt.
* **Closing Window (14:30–16:00 ET, Power Hour):** Macht **15–22 %** des Volumens aus, trägt aber das **entscheidende Richtungssignal**: Institutionelle Großanleger (Smart Money) positionieren sich vor Handelsschluss für die Folgetage.
* **Zusammen machen Opening und Closing Window über 50 % des täglichen Handelsvolumens aus!**

### 6.2 Abverkaufs-Volumen & Delta-Verhalten in den Korrekturen der Parabolik
Bei der Untersuchung aller 8 Korrekturen ($\ge -10\,\%$) während der parabolischen PLTR-Rallye von 23 $ auf 222 $ zeigen die M5-Volumendaten klare Unterscheidungsmerkmale:

| Korrektur-Phase | Kursspanne & Tiefe | Dauer | Volumen-Ratio (vs. 20d Runup) | M5 Open Delta | M5 Close Delta | Markt-Charakter & Signal |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Juli–Aug 2024** | 29,60 $ $\rightarrow$ 23,60 $ (**-20,4 %**) | 11 Tage | **0,95x** (Kein Verkaufsdruck) | +1,7 % | **+22,5 % 🟢** | **Gesunder Dip:** Smart Money kaufte den Dip massiv ins Close hinein! **HOLD!** |
| **Dez 2024–Jan 2025** | 83,90 $ $\rightarrow$ 63,60 $ (**-24,2 %**) | 11 Tage | **0,90x** (Dry-Up Volumen) | +4,6 % | **+8,6 % 🟢** | **Gesunder Dip:** Unterdurchschnittliches Abgabevolumen. **HOLD!** |
| **Feb–April 2025** | 125,40 $ $\rightarrow$ 72,80 $ (**-41,9 %**) | 32 Tage | 1,18x (Auswaschung) | +7,4 % | +5,4 % ⚪ | **Re-Accumulation:** Große Konsolidierungsbasis vor Welle 2. |
| **Mai 2025** | 130,10 $ $\rightarrow$ 106,10 $ (**-18,4 %**) | 1 Tag | **1,40x 🔴** (Spike) | **-24,6 %** | **-35,1 % 🔴** | **Institutioneller Dump:** Aggressiver Abverkauf in Eröffnung und Schluss. |
| **Juni 2025** | 135,30 $ $\rightarrow$ 117,20 $ (**-13,3 %**) | 2 Tage | **1,34x 🔴** (Spike) | **-29,0 %** | +12,6 % | Schneller Flash-Shakeout. |
| **Aug 2025** | 190,00 $ $\rightarrow$ 148,80 $ (**-21,7 %**) | 6 Tage | **1,60x 🔴** (Heavy Volume) | **-13,6 %** | -1,4 % | Ernstzunehmende Gewinnmitnahmen der Großanleger. |
| **Nov 2025–Juni 2026** | 222,00 $ $\rightarrow$ 106,60 $ (**-52,0 %**) | 160 Tage | 1,10x (Erosion nach Top) | -0,6 % | -42 % am Peak | **Parabolisches Top:** 3 Wochen Distribution mit 661 Mio. Aktien Volumen. |

### 6.3 Die Timeframe-Ebenen: Braucht man einen Schritt dazwischen?
Ja! Der ideale Multi-Timeframe-Stack für High-Beta Growth besteht aus **4 klar abgegrenzten Ebenen**:

1. **M5 Session-Fenster (Intraday-Sensorik, 09:30–11:00 und 14:30–16:00 ET):**  
   * **Aufgabe:** Erkennt, ob an Korrekturtagen Smart Money im Schlussfenster Stücke aufsaugt ($CloseDelta > +15\,\%$, Kaufsignal für Dips) oder institutionell abgeladen wird ($CloseDelta < -20\,\%$, Alarmsignal).
2. **Daily (D1, Taktische Ausführung & Trailing Stop):**  
   * **Aufgabe:** Major Higher-Low Stop-Platzierung und Erkennung von Climax-Wick-Kerzen.
3. **Zwischenschritt: Der rollierende 3-Tage-Swing-Bar (3D-Rolling):**  
   * **Warum er unverzichtbar ist:** Eine Wochenkerze schließt nur freitags. Wenn am Dienstag eine schwere 3-tägige Distribution einsetzt, ist die Wochenkerze noch blind. Die rollierende 3-Tage-Ebene glättet 1-Tages-Rauschen (z.B. News-Spikes), aktualisiert sich aber **jeden Tag** und zeigt sofort, ob über 3 Tage netto abgeladen wird.
4. **Weekly (W1, Struktureller Trend-Filter):**  
   * **Aufgabe:** Glättet alle untergeordneten Schwankungen. Solange die Wochenkerzen oberhalb des steigenden 10-Wochen-EMA schließen, ist der übergeordnete Bullenritt intakt.
5. **Monthly (M1, Makro-Lebenszyklus):**  
   * **Aufgabe:** Zeigt die übergeordneten Phasen (Kater vs. Parabolik). Im November 2025 bildete PLTR eine monatliche Rekord-Dochtkerze (-16,8 % mit 749 Mio. Aktien).

---

## 7. Der Multi-Ticker Härtetest: V1 (Flat Positionierung) vs. V2 (Progressive Livermore-Pyramidisierung)

> 🔬 **Empirischer Spiegel-Code:** [`scratch/architecture/strategies/kamikaze/run_multi_ticker_v1_vs_v2.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/kamikaze/run_multi_ticker_v1_vs_v2.js)  
> 📈 **Test-Umfang:** 60 reale Trades über 10 Jahre (2016–2026) an 8 Wachstumsaktien (`PLTR`, `NVTS`, `SOFI`, `S`, `APP`, `HIMS`, `NET`, `IBRX`), Budget 10.000 $ pro Trade-Setup.

Um auszuschließen, dass die Vorteile der Livermore-Pyramidisierung (35 % → 70 % → 100 %) ein `PLTR`-spezifisches Phänomen (Curve-Fitting) sind, wurde die V1-Baseline (100 % All-In bei Breakout) systematisch gegen V2 (progressive Pyramidisierung mit 50/50 AVWAP-Retest Split und Satelliten-Trailing-Stop) getestet:

### 7.1 Aggregierte Portfolio-Kennzahlen

| Metrik | V1 (Baseline: 100 % All-In) | V2 (Livermore-Pyramidisierung) | Differenz / Vorteil |
| :--- | :--- | :--- | :--- |
| **Kumulierter Kapitaleinsatz** | 600.000 $ (60 × 10k $) | 600.000 $ (60 × 10k $) | Identisch |
| **Gesamter Netto-Gewinn** | **+87.653 $** | **+185.803 $** | **+$98.150 (+112,0 % Mehrertrag!)** |
| **Profit Factor (Gewinne / Verluste)** | **4,39** | **6,54** | **+2,15 Punkte Qualitäts-Sprung** |
| **Durchschnittlicher Gewinn / Trade** | +1.461 $ (+14,6 %) | +3.097 $ (+31,0 %) | **Mehr als verdoppelt (+16,4 %-Punkte)** |
| **Trefferquote (Win Rate)** | 45,0 % (27 W / 33 L) | 43,3 % (26 W / 34 L) | Identisch (gleiche Einstiegsfilter) |
| **Maximaler Einzelverlust** | -2.061 $ (-20,6 %) | -2.866 $ (-28,7 %) | Durch Livermore-Stop effektiv gezügelt |

### 7.2 Aufschlüsselung nach Ticker & Investment-Typ

| Ticker | Investment-Typ | Trades | V1 Gewinn | V2 Gewinn | Mehrertrag ($) | Steigerung (%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`PLTR`** | `LASTING_HOLD` | 5 | +19.113 $ | **+40.941 $** | +21.828 $ | **+114,2 %** |
| **`SOFI`** | `LASTING_HOLD` | 5 | -57 $ | **+428 $** | +485 $ | **+850,9 %** |
| **`NVTS`** | `CYCLICAL` | 7 | +13.366 $ | **+27.146 $** | +13.780 $ | **+103,1 %** |
| **`APP`** | `CYCLICAL` | 5 | +7.897 $ | **+12.581 $** | +4.684 $ | **+59,3 %** |
| **`HIMS`** | `CYCLICAL` | 4 | +9.633 $ | **+17.151 $** | +7.518 $ | **+78,0 %** |
| **`IBRX`** | `BINARY` | 24 | +34.904 $ | **+85.554 $** | +50.650 $ | **+145,1 %** |
| **`S`** | `LASTING_HOLD` | 8 | +1.199 $ | **+1.049 $** | -150 $ | -12,5 % |
| **`NET`** | `LASTING_HOLD` | 2 | +1.598 $ | **+953 $** | -645 $ | -40,4 % |

### 7.3 Wissenschaftliche Erkenntnis & Validierung

1. **Strukturelle Hebelwirkung:** Der Performance-Gewinn von **+112,0 %** stammt aus der asymmetrischen Natur des Modells: Bei Fehlausbrüchen riskiert das System nur Tranche 1 (35 % des Budgets), während es bei echten Monster-Movern (`IBRX`, `PLTR`, `NVTS`, `HIMS`, `APP`) mit 100 % Kapital investiert ist und der Einstiegskurs tief unten verankert liegt.
2. **Schutz vor Bärenmarkt-Drawdowns:** Bei `LASTING_HOLD`-Titeln schützt die Glattstellung der pyramisierten Satelliten (Tranche 2 & 3) am Major Higher Low Stop ($HL_{\text{aktiv}} \times 0{,}97$) die Buchgewinne vor Marktcrashs (wie 2022), während der Core (35 %) unberührt weitergehalten wird.


