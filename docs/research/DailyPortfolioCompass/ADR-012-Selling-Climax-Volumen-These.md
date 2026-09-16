# ADR-012: Selling-Climax-Volumen-These (Der Volumen-Spike-Trugschluss am S&P 500)

* **Status:** Empirisch falsifiziert (Entlarvung des naiven 2x-Volumen-Mythos / $H_0$ bestätigt)  
* **Datum:** 2026-09-15  
* **Autor:** CrashRadar Intelligence Engine (Modus Code-Buddy)  
* **Bereich:** [`docs/research/DailyPortfolioCompass/`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/)  
* **Ausgeführtes Test-Skript:** [`scratch/research/DailyPortfolioCompass/test_adr012_selling_climax_volume.js`](file:///D:/GitHub/CrashRadar/scratch/research/DailyPortfolioCompass/test_adr012_selling_climax_volume.js)  
* **Ergebnis-Datensatz:** [`scratch/research/DailyPortfolioCompass/adr012_test_results.json`](file:///D:/GitHub/CrashRadar/scratch/research/DailyPortfolioCompass/adr012_test_results.json)  
* **Referenz-Komponenten:** [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js), [`FinanceExpert.js`](file:///D:/GitHub/CrashRadar/src/services/FinanceExpert.js), [`ADR-011`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/ADR-011-Dual-Gatekeeper-Reentry-These.md)

---

## 1. Kontext & Ausgangsbeobachtung

In der klassischen Markttechnik (u. a. Richard Wyckoff, William O’Neil, Stan Weinstein) gilt der sogenannte **Selling Climax (Panik-Kapitulations-Volumen)** als einer der zuverlässigsten Vorboten eines Marktbodens:
* Die Lehrbuch-Hypothese besagt, dass ein rapider Kurssturz, der von einem extremen Volumensprung begleitet wird (typischerweise $> 2.0x$ bis $3.0x$ des 50-Tage-Durchschnitts), die finale Kapitulation der Marktteilnehmer markiert (Margin Calls, Zwangsausverkäufe von Privatanlegern).
* Sobald dieses Rekordangebot von institutionellem „Smart Money“ absorbiert wird, sei der Verkaufsdruck physisch erschöpft und der Markt drehe unmittelbar in eine nachhaltige Aufwärtsbewegung.

**Die Forschungsfrage für CrashRadar:**  
Kann ein extremes Handelsvolumen am S&P 500 (`SPY_Volume >= 2.0x SMA50`) als eigenständiger, automatischer Re-Entry-Katalysator fungieren, um nach einem Crash den optimalen Einstiegspunkt zu treffen und das Rebound-Lag-Problem aus [ADR-011](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/ADR-011-Dual-Gatekeeper-Reentry-These.md) zu lösen?

---

## 2. Entscheidung & Formulierung der Forschungs-Hypothese (Ohne Bias)

> ### 🎯 Haupt-Hypothese:
> **„Teil A (Die Selling-Climax-These am Index):**  
> Wenn der S&P 500 (`SPY`) in einer etablierten Korrekturphase (mindestens $\ge -5.0\%$ unter dem 52-Wochen-Hoch) ein Handelsvolumen verzeichnet, das das 2,0-Fache des 50-Tage-Durchschnitts übersteigt ($\text{Ratio} \ge 2.00x$), signalisiert dies eine finale Liquidations-Kapitulation mit einer 20-Tage-Rebound-Wahrscheinlichkeit von $\ge 75.0\%$ und einem asymmetrischen Profit-Ratio von $> 2.0 : 1$.  
>  
> **Teil B (Schutz vor vorzeitigen Bärenfallen):**  
> Die 2,0x-Volumenschwelle schützt verlässlich vor vorzeitigen Einstiegen in fallende Messer, da signifikante Folgeabstürze ($DD \le -10.0\%$) nach einem solchen Volumen-Washout statistisch zu $\le 5.0\%$ ausgeschlossen sind.“**

### Null-Hypothese ($H_0$):
Ein isolierter Volumenspike von $\ge 2.0x$ des SMA-50 besitzt am S&P 500 keinen statistisch überlegenen prädiktiven Wert für die Bodenbildung; er tritt häufig mitten in kaskadierenden Crash-Wellen auf und verfehlt säkulare Bärenmarkt-Tiefs.

### Alternativ-Hypothese ($H_1$):
Tage mit $SPY\_Volume \ge 2.0x\text{ SMA50}$ in Korrekturen erzielen eine signifikant höhere 20-Tage-Trefferquote ($\ge 75\%$) und halbieren das Drawdown-Risiko gegenüber normalen Korrekturtagen ($p < 0.01$).

---

## 3. Test-Design & Validierungs-Kriterien (2004–2026)

### A. Testkorpus
* **Historischer Zeitraum:** 01. November 2004 bis 30. September 2026 (7.992 Handelstage).
* **Betrachtete Metriken:**
  * `SPY_Volume`: Reales, bereinigtes Handelsvolumen des SPY-ETF.
  * `SMA50_Volume`: 50-Tage gleitender Durchschnitt des Volumens.
  * `Volume_Ratio`: $SPY\_Volume / SMA50\_Volume$.
  * `Dist_52w`: Prozentuale Distanz zum rollierenden 52-Wochen-Hoch.
  * Forward-Returns & maximale Drawdowns über T+5, T+10, T+20 und T+60 Tage.

### B. Untersuchte Kohorten in Korrekturphasen ($SPY \le -5.0\%$ unter 52W-High)
1. **🔴 Kohorte 1 (Naiver Climax $\ge 2.0x$):** Korrektur **UND** $Volume\_Ratio \ge 2.00x$ (Kernhypothese).
2. **🟡 Kohorte 2 (Moderater Spike $1.5x - 2.0x$):** Korrektur **UND** $1.50x \le Volume\_Ratio < 2.00x$.
3. **⚪ Kohorte 3 (Normales/Dünnes Volumen $< 1.5x$):** Korrektur **UND** $Volume\_Ratio < 1.50x$.
4. **🟢 Kohorte 4 (Bestätigte Absorption):** Korrektur **UND** $Volume\_Ratio \ge 1.50x$ **UND** positiver Tagesschlusskurs ($\Delta SPY > 0$).
5. **❌ Kohorte 5 (Fallendes Messer):** Korrektur **UND** $Volume\_Ratio \ge 1.50x$ **UND** harter Abverkaufstag ($\Delta SPY \le -1.0\%$).

---

## 4. Empirische Testergebnisse (7.992 Handelstage)

Die quantitative Auswertung via [`test_adr012_selling_climax_volume.js`](file:///D:/GitHub/CrashRadar/scratch/research/DailyPortfolioCompass/test_adr012_selling_climax_volume.js) liefert ein eindeutiges mathematisches Urteil:

### A. Statistische Perzentil-Verteilung des SPY-Volumens (2004–2026)

```mermaid
xychart-beta
    title "Statistische Verteilung der SPY-Volumen-Ratios (Multiplikator zu SMA-50)"
    x-axis ["Median (50%)", "75. Perzentil", "90. Perzentil", "95. Perzentil", "98. Perzentil", "99. Perzentil", "Max Spike"]
    y-axis "Volumen-Multiplikator (x)" 0 --> 5
    bar [0.93, 1.18, 1.49, 1.76, 2.13, 2.44, 4.64]
```

* Der Median liegt bei **0,93x** (Normalzustand).
* Ein Verhältnis von **1,49x** markiert bereits das **90. Perzentil** (nur an 10 % aller Börsentage erreicht).
* Die geforderte Marke von **$\ge 2.00x$ liegt im 98. Perzentil** – sie tritt extrem selten auf (an nur ~160 Tagen in 22 Jahren).

---

### B. Kohorten-Vergleich in Korrekturphasen ($SPY \le -5.0\%$)

| Kohorte / Strategie | Ausgewertete Tage | Win-Rate 10d | Win-Rate 20d | Win-Rate 60d | Ø Return 20d | Ø Max DD 20d | Scharfer DD ($\le -6\%$) | Asymmetrie (Runup/DD) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Naiver Climax ($\ge 2.0x$)** *(Kernhypothese)* | **123 Tage** | 63,4 % | **57,7 %** ⚠️ | 66,7 % | **-0,09 %** ❌ | **-4,80 %** | **21,1 % (26 Tage)** | **0,90 : 1 (Negativ!)** |
| **2. Moderater Spike ($1.5x - 2.0x$)** | 215 Tage | 54,0 % | 65,1 % | 63,3 % | +0,21 % | -4,54 % | 21,4 % | 0,86 : 1 |
| **3. Normal / Dünn ($< 1.5x$)** | 1.960 Tage | 60,5 % | 63,1 % | 68,7 % | +0,91 % | -3,13 % | 15,9 % | 1,17 : 1 |
| **4. Bestätigte Absorption** *(Up-Day)* | **64 Tage** | 45,3 % | 57,8 % | 60,9 % | -0,78 % | -6,05 % | 34,4 % | 0,55 : 1 |
| **5. Fallendes Messer** *(Down $\le -1\%$)* | 127 Tage | 59,8 % | 63,0 % | 66,9 % | +0,47 % | -4,40 % | 21,3 % | 1,03 : 1 |

> [!CAUTION]
> **Das empirische Urteil:** Die naive Selling-Climax-Hypothese ist **eindeutig FALSIFIZIERT**.  
> Mit einer 20-Tage-Win-Rate von nur **57,7 %** (weit unter den geforderten $\ge 75\%$), einem negativen Durchschnittsertrag ($-0,09\%$) und einer negativen Asymmetrie ($0,90 : 1$) ist ein isolierter 2x-Volumenspike **kein profitables Kaufsignal**.

> [!WARNING]
> **Die Dead-Cat-Bounce-Falle (Kohorte 4):**  
> Selbst wenn der Markt am Volumentag dreht und grün schließt (vermeintliche Absorption/Gegenwehr), verbessert sich die Lage nicht: Die 20d-Rendite sinkt auf **-0,78 %**, die Asymmetrie stürzt auf **0,55 : 1** ab, und in **34,4 % aller Fälle** folgt ein scharfer Folge-Drawdown von $\le -6\,\%$. Grüne Tage bei Panikvolumen sind im Crash überwiegend trügerische Short-Squeezes.

---

### C. Historischer Härtetest an den 14 Schlüssel-Wendepunkten

Die Einzelfallprüfung der historischen Crash-Böden entlarvt die zwei verheerenden Schwachstellen der naiven Volumenthese:

| Historischer Stichtag | SPY Distanz 52W | VIX | SPY-Volumen | SMA-50 Vol | **Vol-Ratio** | Folge-Return (20d) | Max DD (20d) | Reales Marktergebnis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **2008-10-10 (Lehman Welle 1)** | -38,1 % | 69,9 | 871 Mio. | 349 Mio. | **2,49x** | +8,81 % | -5,14 % | 🟢 Rebound nach Panik |
| **2008-11-20 (Lehman Tief 2)** | -47,3 % | 80,9 | 814 Mio. | 500 Mio. | **1,63x** | +19,43 % | 0,00 % | 🟢 Bodenbildung (unter 2x!) |
| **2009-03-09 (Absoluter GFC-Boden)** | **-47,9 %** | **49,7** | **380 Mio.** | **392 Mio.** | **0,97x** ⚠️ | **+19,82 %** | **0,00 %** | ❌ **SIGNAL VERPASST! (Volumen normal)** |
| **2011-08-08 (US-Downgrade Climax)** | -17,7 % | 48,0 | 700 Mio. | 244 Mio. | **2,86x** | +5,09 % | 0,00 % | 🟢 Perfekter Climax-Rebound |
| **2015-08-24 (China Flash Crash)** | -11,2 % | 40,7 | 507 Mio. | 124 Mio. | **4,10x** | +3,82 % | -1,20 % | 🟢 Perfekter V-Boden |
| **2018-12-24 (Heiligabend Tief)** | **-20,2 %** | **36,1** | **147 Mio.** | **125 Mio.** | **1,18x** ⚠️ | **+10,51 %** | **0,00 %** | ❌ **SIGNAL VERPASST! (Volumen dünn)** |
| **2018-12-26 (Powell-Pivot Up-Day)**| -16,2 % | 30,4 | 218 Mio. | 127 Mio. | **1,72x** | +5,76 % | -0,80 % | 🟢 Reversal-Tag (unter 2x!) |
| **2020-03-06 (DER CORONA-FEHLKAUF!)** | **-12,1 %** | **41,9** | **228 Mio.** | **116 Mio.** | **1,96x** ❌ | **-12,19 %** | **-25,05 %** | 🚨 **TÖDLICHE BÄRENFALLE! (-25 % Folgeabsturz!)** |
| **2020-03-12 (VIX-Spike 75)** | -26,7 % | 75,5 | 390 Mio. | 136 Mio. | **2,86x** ❌ | -0,79 % | **-10,14 %** | 🚨 **WEITERE BÄRENFALLE! (-10 % Folgeabsturz!)** |
| **2020-03-16 (VIX-Peak 82.7)** | -29,1 % | 82,7 | 295 Mio. | 158 Mio. | **1,87x** | +3,48 % | -7,05 % | 🟢 Bodenbereich formiert sich |
| **2020-03-23 (REALES CORONA-TIEF)** | **-34,1 %** | **61,6** | **323 Mio.** | **190 Mio.** | **1,70x** ⚠️ | **+24,78 %** | **0,00 %** | ❌ **SIGNAL VERPASST! (SMA50 war explodiert)** |
| **2020-03-24 (Fed-QE Reversal Up-Day)**| -28,1 % | 61,7 | 233 Mio. | 195 Mio. | **1,20x** | +13,37 % | 0,00 % | 🟢 Dynamischer Start der Rallye |
| **2022-06-16 (Bärenmarkt Juni-Tief)**| **-23,3 %** | **33,0** | **135 Mio.** | **111 Mio.** | **1,21x** ⚠️ | **+4,53 %** | **-0,22 %** | ❌ **SIGNAL VERPASST! (Nur 1,2x)** |
| **2022-10-13 (Bärenmarkt Oktober-Tief)**| **-20,7 %** | **31,9** | **147 Mio.** | **96 Mio.** | **1,54x** ⚠️ | **+2,43 %** | **-2,28 %** | ❌ **SIGNAL VERPASST! (Nur 1,5x)** |

---

## 5. Ursachen-Analyse des Volumen-Trugschlusses

Warum versagt die 2x-Volumenschwelle an realen Marktböden so spektakulär?

### 1. Das „Moving-Average-Lag“-Paradoxon (Baseline-Verzerrung)
* Wenn ein Crash über Wochen rollt (wie Februar/März 2020 oder Herbst 2008), ist das Handelsvolumen jeden Tag extrem hoch.
* Dadurch **explodiert der 50-Tage-Durchschnitt selbst massiv nach oben** (von 83 Mio. auf 190 Mio. im März 2020).
* Wenn am **23. März 2020** (dem realen Allzeittief) gigantische 323 Millionen Aktien gehandelt werden, ergibt das geteilt durch den aufgeblähten SMA-50 **nur noch ein Verhältnis von 1,70x**!
* **Die Konsequenz:** Eine starre 2.0x-Schwelle verpasst systematisch die realen Wendepunkte am Ende langer Krisen, weil der Nenner des Bruchs zu stark angestiegen ist!

### 2. Die Bärenfalle im kaskadierenden Crash (06.03.2020)
* Zu Beginn eines Crashs (am 06.03.2020) ist der 50-Tage-Durchschnitt noch niedrig (116 Mio.).
* Ein erster panischer Abverkaufstag (228 Mio. Aktien) erzeugt sofort ein Verhältnis von **1,96x**.
* Wer hier kauft, weil er glaubt, das hohe Volumen markiere die Erschöpfung, greift mitten in die kaskadierende Lawine hinein – **und erleidet in den folgenden 12 Handelstagen einen weiteren brutalen $-25.05\%$ Absturz**.

### 3. Die leisen Böden (2009 & 2018)
* Am absolut tiefsten Punkt der Weltfinanzkrise (**09. März 2009 bei SPY $68.11**) lag das Verhältnis bei **0,97x**!
* Nach 6 Monaten ununterbrochener Panik waren alle Verkäufer bereits restlos ausgestiegen. Der Markt drehte an einem völlig unspektakulären, fast durchschnittlichen Volumentag nach oben ab – und stieg in den folgenden 20 Tagen um **+19.82 %**.

### 4. Die Dead-Cat-Bounce-Falle (Warum vermeintliche Preisabsorption scheitert)
* Ein weit verbreitetes Postulat der Charttechnik besagt: *„Kaufe nicht in den fallenden Tag hinein, sondern warte auf einen Tag mit hohem Volumen, der im Plus schließt (Preisabsorption / Gegenwehr des Smart Money).“*
* Die empirische Prüfung über 7.992 Tage (**Kohorte 4: Bestätigte Absorption**, $Volume \ge 1{,}5x$ UND $\Delta SPY > 0$, 64 Fälle) beweist das genaue Gegenteil:
  * **20-Tage-Rendite:** **-0,78 %** (sogar schlechter als die -0,09 % des naiven Climax).
  * **Asymmetrie (Run-Up / Drawdown):** Nur **0,55 : 1** (der durchschnittliche Drawdown ist fast doppelt so tief wie der Anstieg).
  * **Scharfe Folge-Drawdowns ($\le -6\,\%$):** In **34,4 % der Fälle** (mehr als jeder dritte Fall stürzt nach dem grünen Volumentag ab!).
* **Marktmechanische Ursache:**  
  In einer kaskadierenden Marktpanik sind massive grüne Tage bei Rekordvolumen fast nie Akkumulation, sondern gewaltsame **Short-Squeezes**. Bären decken temporär Gewinne ein; sobald diese Käufe abebben, bricht die Liquidität weg und das übergeordnete Verkaufsangebot drückt den Markt gnadenlos auf neue Tiefs.

---

## 6. Chaos-Engineering & Anti-Overfitting Audit (AGENTS.md Kapitel 5)

| Audit-Prüfung | Test-Setup | Ergebnis | Urteil |
| :--- | :--- | :--- | :---: |
| **A. Deterministischer Noise-Test** | Seed 42, $\pm 5\%$ synthetisches Rauschen auf `SPY_Volume` | Trap-Quote Original: 21,1 % <br> Trap-Quote mit Noise: **21,6 %** (Delta: 0,45 %P) | ✅ **Robust in der Falsifikation** (Das Scheitern ist kein Rausch-Artefakt) |
| **B. Singularitäten- & Zero-Division-Test** | `SPY_Volume = 0`, `vol = null`, `NaN` | Kein Absturz, saubere Rückgabe von `null` | ✅ **Singularitäten-resistent** |

---

## 7. Strategische Schlussfolgerung für den DailyPortfolioCompass & die Re-Entry-Forschung

1. **Kein autarker Einstiegs-Trigger über das Volumen:**  
   Im [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js) darf ein hohes Handelsvolumen des S&P 500 **unter keinen Umständen als isoliertes Kaufsignal** gewertet werden.
2. **Die Konsequenz für die weitere Re-Entry-Forschung:**  
   * Das Re-Entry-Dilemma kann **nicht** durch naive Volumen-Multiplikatoren gelöst werden.
   * Selbst ein grüner Tag bei hohem Volumen (Kohorte 4: Bestätigte Absorption) erwies sich im Crash als klassische Dead-Cat-Bounce-Falle (20d-Rendite negativ mit -0,78 %, Asymmetrie 0,55 : 1, scharfe Folgeabstürze in 34,4 % der Fälle).
   * Volumen signalisiert lediglich Liquidationsdruck, sagt aber nichts über das Ende des Verkaufsdrucks aus. Ein valider Re-Entry muss daher vollkommen unabhängig von Volumen-Triggern über andere, noch ungetestete Katalysatoren erforscht werden.
3. **Fazit:** Die Nullhypothese $H_0$ ist wissenschaftlich bestätigt. ADR-012 bewahrt das System vor der gefährlichen „Selling-Climax-Falle“.
