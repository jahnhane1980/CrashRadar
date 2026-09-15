# ADR-008: LCLOR-Schockgrenzen-These (Bankreserven-Kipppunkt bei entleertem RRP-Puffer)

* **Status:** Entwurf / Bereit für Testaufbau  
* **Datum:** 2026-09-15  
* **Autor:** CrashRadar Intelligence Engine (Modus Code-Buddy)  
* **Bereich:** [`docs/research/DailyPortfolioCompass/`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/)  
* **Geplantes Test-Skript:** `scratch/research/DailyPortfolioCompass/test_adr008_lclor_bank_reserves.js`  
* **Geplanter Ergebnis-Datensatz:** `scratch/research/DailyPortfolioCompass/adr008_test_results.json`  
* **Referenz-Komponenten:** [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js), [`LiquiditySensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/LiquiditySensorHub.js), [`BankReservesIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BankReservesIndicator.js), [`FinanceExpert.js`](file:///D:/GitHub/CrashRadar/src/services/FinanceExpert.js)

---

## 1. Kontext & Ausgangsbeobachtung

In [ADR-007](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/ADR-007-Fiskal-Schutzschild-These.md) wurde empirisch nachgewiesen, dass ein fiskalisches Vorwahl-Schutzschild vor US-Wahlen Markteinbrüche unterdrückt, nach der Wahl jedoch bei leerem RRP-Puffer ($< \$50\text{ Mrd.}$) ein gefährliches Liquiditäts-Vakuum hinterlässt.

Die aktuelle Bestandsaufnahme unserer Datenbank (Stand September 2026) zeigt eine hochbrisante Zuspitzung im Notenbank-Plumbing:
1. **RRP-Fazilität:** Notiert bei nur noch **$5.25 Mrd.** (Faktisch entleert).
2. **Bankreserven (`WRESBAL`):** Sind auf **2.991 Mrd. $** gefallen – und haben damit erstmals wieder die psychologische und operative Marke von **$3.000 Mrd.** unterschritten.
3. **LCLOR-Konzept der Federal Reserve:** Die Fed definiert das *Lowest Comfortable Level of Reserves (LCLOR)* als das Mindestmaß an Reserven, das Geschäftsbanken zur Erfüllung von Liquiditätsvorschriften (LCR) und täglichen Abrechnungen benötigen (geschätzt auf 10,0 % bis 11,0 % des US-BIP, aktuell ca. $3.000 bis $3.150 Mrd.).

Sobald der RRP-Puffer leer ist, kann das Finanzministerium neue Staatsanleihen (Kupon-Emissionen) nicht mehr aus Geldmarktfonds-Liquidität absorbieren. Jeder Cent neuer Anleihen wird ab sofort **direkt den Reserven der Geschäftsbanken entzogen**.

---

## 2. Entscheidung & Formulierung der Forschungs-Hypothese (Ohne Bias)

> ### 🎯 Haupt-Hypothese:
> **„Teil A (Die LCLOR-Gefahrenzone):**  
> Fällt die Summe der Bankreserven (`WRESBAL`) unter die LCLOR-Grenzschwelle ($< \$3.000\text{ Mrd.}$ bzw. $< 10.5\%$ des US-BIP), während gleichzeitig der Geldmarktfonds-Puffer (`RRPONTSYD`) unter $\$50\text{ Mrd.}$ verharrt, verliert der Geldmarkt seine elastische Pufferfunktion für Treasury-Emissionen und QT.  
>  
> **Teil B (Der Illiquiditäts-Kipppunkt):**  
> In dieser LCLOR-Gefahrenzone führen makroökonomische Refinanzierungsereignisse (Auktions-Tails, Quartalsend-Steuertermine oder Anleihe-Neuemissionen) mit einer Wahrscheinlichkeit von $> 75\%$ innerhalb von 30 bis 60 Handelstagen zu einem signifikanten Liquiditäts-Schock im S&P 500 (Drawdown $\ge -8.0\%$), sofern die Federal Reserve nicht interveniert (Zinssenkungen, QT-Stopp oder Notfall-Fazilitäten wie `BORROW` / BTFP).“

### Null-Hypothese ($H_0$):
Bankreserven unter $3.000 Mrd. $ bei leerem RRP haben keinen statistisch signifikanten Einfluss auf die Häufigkeit oder Tiefe von Aktienmarkt-Korrekturen; der Markt absorbiert Treasury-Emissionen unabhängig vom Reserves-Niveau ohne erhöhten Drawdown.

### Alternativ-Hypothese ($H_1$):
Das Zusammentreffen von `WRESBAL < 3.0T` und `RRP < 50B` verdoppelt das Drawdown-Risiko im S&P 500 gegenüber dem historischen Normalzustand signifikant und markiert das operative Ende eines stabilen Bullenmarkts.

---

## 3. Test-Design & Validierungs-Kriterien (2004–2026)

### A. Testkorpus
* **Historischer Zeitraum:** 2004–2026 (gesamte Historie der FRED- und Fed-Daten in der Datenbank).
* **Betrachtete Zeitreihen:**
  * `WRESBAL` (Reserve Balances with Federal Reserve Banks, wöchentlich/täglich).
  * `RRPONTSYD` (Overnight Reverse Repurchase Agreements).
  * `BORROW` (Fed Emergency Borrowing / Discount Window / BTFP).
  * `SPY` (S&P 500 Kursverlauf & Drawdowns).
  * `NFCI` (Chicago Fed Financial Conditions Index).

### B. Regime-Klassifikation
1. **Regime 1: Überpufferte Liquidität** (`RRP >= $500 Mrd.` ODER `WRESBAL >= 12.0% BIP`).
2. **Regime 2: Moderater Puffer** (`RRP $50 - $500 Mrd.` UND `WRESBAL 10.5% - 12.0% BIP`).
3. **Regime 3: LCLOR-Gefahrenzone** (`RRP < $50 Mrd.` UND `WRESBAL < $3.000 Mrd.` bzw. `< 10.5% BIP`).

### C. Historische Fallstudien zur Prüfung
* **September 2019 (Repo-Krise):** Reserven fielen unter $1.400 Mrd. (damaliges LCLOR), Repo-Spike auf 10 %, Fed musste über Nacht Not-QE starten.
* **März 2023 (Regionalbanken-Krise):** Reserven fielen durch QT scharf ab, Silicon Valley Bank kollabierte, Fed intervenierte mit BTFP (`BORROW` sprang auf $150 Mrd.+).
* **Spätsommer / Herbst 2026:** Aktuelle Konstellation (`WRESBAL` bei $2.991 Mrd., `RRP` bei $5.3 Mrd.).

### D. Erfolgs- & Falsifikations-Kriterien
* **Verifikation:** Die These gilt als bestätigt, wenn:
  1. Die durchschnittliche 60-Tage-Fehlschlag- bzw. Korrekturquote in Regime 3 mindestens **2x höher** ist als in Regime 1.
  2. Mindestens **80 % der historischen Liquiditäts-Paniken** (Repo 2019, SVB 2023) in Regime 3 aufgetreten sind.
* **Falsifikation:** Die These gilt als widerlegt, wenn Aktienmärkte in Regime 3 über 60 Tage mit $> 65\%$iger Wahrscheinlichkeit neue Allzeithochs ohne nennenswerte Korrektur ($\le -4\%$) markieren.

---

## 4. Geplante Skript-Architektur

Das Skript `test_adr008_lclor_bank_reserves.js` wird folgende Schritte ausführen:
1. Laden aller Handelstage (2004–2026) via [`FinanceExpert.js`](file:///D:/GitHub/CrashRadar/src/services/FinanceExpert.js).
2. Berechnung des täglichen Verhältnisses von `WRESBAL` zu `NetLiquidity` und US-BIP.
3. Erkennung aller Episoden, an denen das Regime 3 aktiviert wurde.
4. Messung der Forward-Drawdowns (T+10, T+30, T+60, T+90) und Notfallkredite (`BORROW`).
5. Persistierung in `adr008_test_results.json`.
