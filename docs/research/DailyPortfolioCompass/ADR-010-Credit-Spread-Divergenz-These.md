# ADR-010: Credit-Spread-Divergenz-These (High-Yield HYG vs. SPY-Allzeithoch)

* **Status:** Entwurf / Bereit für Testaufbau  
* **Datum:** 2026-09-15  
* **Autor:** CrashRadar Intelligence Engine (Modus Code-Buddy)  
* **Bereich:** [`docs/research/DailyPortfolioCompass/`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/)  
* **Geplantes Test-Skript:** `scratch/research/DailyPortfolioCompass/test_adr010_credit_spread_divergence.js`  
* **Geplanter Ergebnis-Datensatz:** `scratch/research/DailyPortfolioCompass/adr010_test_results.json`  
* **Referenz-Komponenten:** [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js), [`FinanceExpert.js`](file:///D:/GitHub/CrashRadar/src/services/FinanceExpert.js)

---

## 1. Kontext & Ausgangsbeobachtung

Der Anleihemarkt gilt an der Wall Street als das „Smart Money“, da institutionelle Fixed-Income-Investoren fundamentale Zahlungsströme, Bonitäten und Insolvenzrisiken deutlich genauer und konservativer einpreisen als dividenden- und wachstumsfokussierte Aktieninvestoren.

Besonders High-Yield Corporate Bonds („Junk Bonds“, abgebildet über den ETF `HYG` sowie `BIZD` / `BKLN`) reagieren hochgradig empfindlich auf restriktive Finanzierungsbedingungen (wie aktuell 2,55 % 10Y-Realzins und $100 Ölpreis).

**Die aktuelle Marktbeobachtung (September 2026):**  
Während der S&P 500 (`SPY`) bei **$764** notiert und damit nur rund $-1.7\%$ unter seinem Allzeithoch steht, verharrt der High-Yield-Markt (`HYG`) bei **$78.60** und zeigt eine deutliche relative Schwäche gegenüber dem Aktienmarkt.

**Die Kernaussage:**  
Wenn Aktien neue Höchststände erklimmen, während der Hochzins-Kreditmarkt bereits abverkauft wird oder keine Bestätigung liefert (*Bearish Credit Divergence*), deutet dies auf eine latente Refinanzierungskrise im Unternehmenssektor hin, die sich mit zeitlicher Verzögerung in die Aktienbewertungen frisst.

---

## 2. Entscheidung & Formulierung der Forschungs-Hypothese (Ohne Bias)

> ### 🎯 Haupt-Hypothese:
> **„Teil A (Die Credit-Divergenz an Hochpunkten):**  
> Wenn der S&P 500 (`SPY`) innerhalb von $\le 2.0\%$ an seinem Allzeithoch oder 52-Wochen-Hoch notiert, während gleichzeitig High-Yield-Unternehmensanleihen (`HYG`) mehr als $\ge 3.0\%$ unter ihrem 52-Wochen-Hoch verharren (oder die relative Stärke $\text{Ratio} = HYG / SPY$ unter ihren 50-Tage-Durchschnitt fällt), liegt eine institutionelle Risikoaversion im Kreditmarkt vor.  
>  
> **Teil B (Der Aktienmarkt-Spillover):**  
> Eine solche bearishe Credit-Divergenz an Aktien-Höchstständen führt mit einer Wahrscheinlichkeit von $\ge 70.0\%$ innerhalb der nachfolgenden 45 bis 60 Handelstage zu einer scharfen Marktkorrektur von mindestens $-6.0\%$ bis $-12.0\%$ im S&P 500. Die Warnung des Kreditmarktes hat eine durchschnittliche Vorlaufzeit von 10 bis 30 Handelstagen vor dem Einsetzen des VIX-Spikes.“

### Null-Hypothese ($H_0$):
Divergenzen zwischen HYG und SPY an Allzeithochs sind statistisches Rauschen; Aktienmärkte können über längere Zeiträume neue Allzeithochs markieren, selbst wenn High-Yield-Bonds schwächeln.

### Alternativ-Hypothese ($H_1$):
Das Scheitern von High-Yield-Bonds an Aktien-Hochpunkten ist einer der zuverlässigsten ex-ante Frühwarnindikatoren für Aktienkorrekturen (Signifikanz $p < 0.01$).

---

## 3. Test-Design & Validierungs-Kriterien (2007–2026)

### A. Testkorpus
* **Historischer Zeitraum:** April 2007 bis September 2026 (gesamte HYG-Historie in der Datenbank, 7.100+ Handelstage).
* **Untersuchte Variablen:**
  * `SPY` (Close, 52W High, Drawdown from High).
  * `HYG` (Close, 52W High, Drawdown from High).
  * `HYG_SPY_Ratio` = $HYG / SPY$ und dessen SMA-50.
  * Folgerenditen und maximale Drawdowns im SPY über T+15, T+30, T+45, T+60 Tage.

### B. Signal-Definition
* **Bedingung 1 (Aktien-Top):** `SPY >= 0.98 * SPY_52W_High`.
* **Bedingung 2 (Kredit-Schwäche):** `HYG < 0.97 * HYG_52W_High` **ODER** `(HYG / SPY) < SMA50(HYG / SPY)`.
* **Episode:** Zusammenhängende Cluster von Divergenztagen werden zu diskreten Episoden aggregiert.

### C. Historische Prüf-Episoden
* **Sommer/Herbst 2007:** HYG brach im Juni 2007 ein, SPY machte im Oktober 2007 ein letztes Allzeithoch (klassische Top-Divergenz vor der GFC).
* **Herbst 2018:** HYG brach ab September 2018 ein, SPY markierte im Oktober 2018 sein Hoch vor dem Dezember-Crash.
* **Spätsommer 2021 / Anfang 2022:** HYG peakte im November 2021, SPY zog Anfang Januar 2022 auf das finale ATH nach.
* **Aktuelle Phase 2026:** Prüfung des Status Quo.

### D. Erfolgs- & Falsifikations-Kriterien
* **Verifikation:** Mindestens 70 % aller isolierten Divergenz-Episoden führen innerhalb von 60 Tagen zu einem Drawdown $\ge -6.0\%$ im SPY.
* **Falsifikation:** Wenn in $> 40\%$ der Fälle der SPY in den nächsten 60 Tagen ohne Korrektur um $> +5.0\%$ weiter steigt.

---

## 4. Geplante Skript-Architektur

Das Skript `test_adr010_credit_spread_divergence.js` wird:
1. Den täglichen Verlauf von SPY und HYG seit April 2007 berechnen.
2. Rolling 52-Wochen-Höchststände und das relative Stärke-Verhältnis (Ratio) ermitteln.
3. Alle Divergenz-Tage identifizieren und zu Episoden zusammenfassen.
4. Die Trefferquote für nachfolgende Korrekturen (Forward Returns & Drawdowns) quantifizieren.
5. In `adr010_test_results.json` persistieren.
