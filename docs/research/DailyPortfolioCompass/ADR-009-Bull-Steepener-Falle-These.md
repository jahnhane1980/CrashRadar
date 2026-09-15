# ADR-009: Bull-Steepener-Falle-These (Zinskurven-Entinversion 10Y-2Y vs. Rezessions-Lag)

* **Status:** Entwurf / Bereit für Testaufbau  
* **Datum:** 2026-09-15  
* **Autor:** CrashRadar Intelligence Engine (Modus Code-Buddy)  
* **Bereich:** [`docs/research/DailyPortfolioCompass/`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/)  
* **Geplantes Test-Skript:** `scratch/research/DailyPortfolioCompass/test_adr009_bull_steepener_trap.js`  
* **Geplanter Ergebnis-Datensatz:** `scratch/research/DailyPortfolioCompass/adr009_test_results.json`  
* **Referenz-Komponenten:** [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js), [`YieldCurveIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/YieldCurveIndicator.js), [`FinanceExpert.js`](file:///D:/GitHub/CrashRadar/src/services/FinanceExpert.js)

---

## 1. Kontext & Ausgangsbeobachtung

Die Zinsstrukturkurve zwischen 10-jährigen und 2-jährigen US-Staatsanleihen (`T10Y2Y`) verzeichnete zwischen Sommer 2022 und 2024/2025 die **längste und tiefste Inversion der modernen Wirtschaftsgeschichte** (Tiefpunkt bei bis zu $-1.08\%$).

Im Spätsommer 2026 hat sich diese Inversion aufgelöst: Der Spread `T10Y2Y` notiert in unserer Datenbank aktuell bei **+0.33 %** (wieder im positiven Bereich).

**Der psychologische Trugschluss der Finanzmärkte:**  
Finanzmedien und Privatanleger interpretieren die Rückkehr einer positiven Zinskurve stereotyp als „Entwarnung“ („Die Rezession ist abgesagt, die Kurve hat sich normalisiert“). 

**Die historische Wirklichkeit der letzten 40 Jahre:**  
Aktienmärkte crashen fast **nie während der Inversion**. Die Inversion ist lediglich das seismische Warnsignal. Der tatsächliche Bärenmarkt und die heftigsten Kurseinbrüche entfesseln sich historisch **erst nach der Entinversion** (*Disinversion*), wenn die Zinskurve durch sinkende Kurzfristzinsen schlagartig steiler wird (*Bull Steepener*), weil die Notenbank wegen einbrechender Konjunktur panisch die Leitzinsen senken muss.

---

## 2. Entscheidung & Formulierung der Forschungs-Hypothese (Ohne Bias)

> ### 🎯 Haupt-Hypothese:
> **„Teil A (Die Erleichterungs-Bull-Trap):**  
> Nach einer anhaltenden Zinskurven-Inversion ($T10Y2Y < 0.0\%$ für mindestens 180 Kalendertage) führt der erstmalige Durchbruch der Zinskurve in den positiven Bereich ($T10Y2Y > +0.10\%$) in den ersten 0 bis 60 Handelstagen häufig zu einer trügerischen Erleichterungs-Rallye (Peak-Bildung nahe oder an Allzeithochs).  
>  
> **Teil B (Der unvermeidliche Bärenmarkt-Lag):**  
> Diese Phase ist jedoch eine systematische Bull Trap. In einem Zeitfenster von **60 bis 250 Handelstagen nach der Entinversion** tritt mit einer historischen Wahrscheinlichkeit von $> 85\%$ ein zyklischer Bärenmarkt oder eine schwere Korrektur von mindestens $-15.0\%$ bis $-30.0\%$ im S&P 500 ein, insbesondere wenn der 10Y-Realzins (`DFII10`) über $1.80\%$ verharrt oder die Arbeitsmarkt-Frühindikatoren (`SahmRule` $> 0.30$ bzw. Initial Claims Ausbruch) anspringen.“

### Null-Hypothese ($H_0$):
Die Zinskurven-Entinversion besitzt keinen statistisch signifikanten prädiktiven Wert für nachfolgende Markteinbrüche; eine Rückkehr in den positiven Zinsbereich führt im Mittel zu nachhaltig positiven Mehrjahres-Renditen im S&P 500.

### Alternativ-Hypothese ($H_1$):
Jede historische Entinversion seit 1990/2000 markiert mit einem Time-Lag von 3 bis 9 Monaten den Beginn einer Rezession bzw. eines signifikanten Bärenmarktes (Trefferquote $\ge 80\%$).

---

## 3. Test-Design & Validierungs-Kriterien (1990–2026)

### A. Testkorpus
* **Historischer Zeitraum:** 2004–2026 (Datenbank-Timeline) sowie historische Auswertung der Makro-Peaks seit 2000.
* **Kern-Metriken:**
  * Datum des Nulldurchbruchs von $T10Y2Y$ (von negativ auf $\ge +0.10\%$).
  * Vorlaufdauer der vorangegangenen Inversion (Tage $< 0$).
  * Forward Performance SPY nach Entinversion: T+30, T+60, T+120, T+180, T+250 Tage.
  * Maximaler Drawdown (Peak-to-Trough) innerhalb von 250 Handelstagen nach dem Signal.
  * Realzins (`DFII10`) und Arbeitsmarkt-Status (`SahmRule`, `ICSA`) am Signal-Tag.

### B. Historische Validierungs-Episoden
1. **Dotcom-Crash 2000/2001:** Inversion 2000 -> Entinversion Dezember 2000 / Januar 2001 -> S&P 500 Einbruch -40 % bis 2002.
2. **Finanzkrise 2007/2008:** Inversion 2006/2007 -> Entinversion Juni 2007 -> Markthoch Oktober 2007 -> Großer Crash -55 % bis März 2009.
3. **Corona & Repo-Krise 2019/2020:** Inversion Sommer 2019 -> Entinversion Oktober 2019 -> Crash Februar/März 2020 (-35 %).
4. **Aktuelle Disinversion 2024–2026:** Inversion 2022–2024 -> Entinversion -> Aktueller Spread +0.33 % (Laufendes Signal).

### C. Erfolgs- & Falsifikations-Kriterien
* **Verifikation:** Die These gilt als bestätigt, wenn:
  1. In mindestens 80 % der historischen Entinversions-Episoden innerhalb von 250 Tagen ein Drawdown von $\ge -15.0\%$ eintritt.
  2. Das Rendite-Risiko-Verhältnis (Sharpe/Calmar) eines 1-Jahres-Kaufs direkt am Entinversions-Tag signifikant negativ gegenüber dem Allzeit-Durchschnitt ist.
* **Falsifikation:** Wenn der S&P 500 nach Entinversion in über 50 % der Fälle ohne eine Korrektur $> -10\%$ um mehr als $+15\%$ zulegt (echtes "Soft Landing").

---

## 4. Geplante Skript-Architektur

Das Skript `test_adr009_bull_steepener_trap.js` wird:
1. Alle Nulldurchgänge von `T10Y2Y` seit 2004 (bzw. 2000) algorithmisch isolieren.
2. Filter anwenden: Vorherige Inversionsdauer mind. 90 Tage.
3. Die maximale Rendite (Runup) und den maximalen Verlust (Drawdown) über die Folgehorizonte (30d, 60d, 120d, 250d) tabellieren.
4. Den genauen Zeitversatz (Lag in Tagen) vom Entinversionstag bis zum Korrekturtief ermitteln.
5. In `adr009_test_results.json` speichern.
