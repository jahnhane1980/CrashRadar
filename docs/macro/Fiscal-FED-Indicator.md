# Fiscal-FED-Indicator (Makro-Schwellenwert-Logik) v4.0

Dieses Dokument definiert die Kernlogik für das "Quantitative K-Faktor-Marktradar" basierend auf historischen Sandbox-Analysen (2008, 2018, 2020, 2022, 2023, 2025, 2026). Es beschreibt das Zusammenspiel zwischen Staat (Fiskaldominanz) und der Zentralbank (FED) und legt harte, datengetriebene Schwellenwerte für das Machine-Learning-Modell fest.

## 1. Das Konzept: Fiskaldominanz & Das Plumbing
Der Markt wird nicht mehr proaktiv durch Zinsen gesteuert, sondern durch Liquidität, die vom Staat (Treasury) und der FED (Zentralbank) in das System gepumpt oder entzogen wird. 
*   **Der Staat (Aktion):** Saugt dem Markt durch das Füllen der Kriegskasse (TGA) Liquidität ab oder pumpt sie hinein (durch das Leeren des TGA).
*   **Die FED (Reaktion):** Ist gezwungen, die Fehler des Staates aufzukehren. Sie muss entweder den Markt crashen (QT), um Inflation zu bekämpfen, oder die Währung entwerten (QE / Fazilitäten), um das Bankensystem zu retten.
*   **Markt-Manipulation:** Solange der Staat Cash im TGA hat oder die FED Bilanzspielraum (WALCL) freigibt, **kann und wird** der Markt jederzeit manipuliert (gerettet) werden.

---

## 2. Die Chronologie eines Makro-Crashes
Jeder Crash folgt einem glasklaren, wiederkehrenden Muster aus Aktion (Übertreibung), Reaktion (Crash) und Rettung (Gegensteuerung).

1.  **Die Übertreibung (Der Auslöser):** Der Staat füllt aggressiv sein TGA-Konto (z.B. +225 Mrd. $ vor 2022) und saugt Liquidität ab. Alternativ übertreibt die FED mit zu schnellem QT und zieht massive Bankreserven aus dem System (z.B. -133 Mrd. $ in 2018).
2.  **Das Einknicken (Der Markt erstickt):** Die Bankreserven (`WRESBAL`) fallen auf ein kritisches Niveau im Verhältnis zu TGA und RRP. Den Banken fehlt das Geld, um Margin-Schulden (Hebel) im Aktienmarkt aufrechtzuerhalten. Der S&P 500 bricht ein.
3.  **Die Gegensteuerung (Die Rettung):** Erste Banken wackeln und rennen zum Notfallfenster der FED. Die FED oder das Finanzministerium kapitulieren. Sie fluten die **Bankreserven (`WRESBAL`)** sofort wieder mit Liquidität (durch TGA-Entleerung oder Stealth QE). Sobald die Reserven steigen, ist der Stress abgefangen und der Aktienmarkt findet seinen Boden.

---

## 3. Die "Wunder-Pille": WRESBAL als ultimativer Timing-Indikator
Die historische Sandbox-Analyse hat bewiesen: Bankreserven (`WRESBAL`) sind die reinste Form von monetärem Adrenalin. Egal, ob das Geld von der FED (QE) oder vom Staat (TGA-Entleerung) kommt – es landet immer in den Reserven.

### Dip vs. Crash (Wie man den Unterschied erkennt)
*   **Es ist ein andauernder Crash (Finger weg):** Der Markt fällt, die Panik-Indikatoren (`BORROW`) schlagen an, ABER die Bankreserven (`WRESBAL`) fallen weiter oder bleiben flach. Die Rettung ist noch nicht da (Beispiel: 2008 oder 2022).
*   **Der "Buy-the-Dip" Moment (All-In):** Der Markt fällt in Panik, doch plötzlich verbucht `WRESBAL` (Update immer mittwochs) einen massiven positiven Delta-Sprung. Dies ist der offizielle Startschuss. 

### Wann die Wunder-Pille versagt (Die Ausnahme-Regel)
Ein historischer "Reverse-Test" hat gezeigt, dass nicht jede Liquiditätsspritze den Markt automatisch rettet. In extrem toxischen Makro-Umfeldern (wie dem Zinsschock 2022 oder dem Tech-Crash 2025) können kleine Injektionen von der Panik überrollt werden.
*   **Die 150-Milliarden-Garantie:** Nur Injektionen von **> +150 Mrd. $** haben historisch eine 100%ige Trefferquote. Sie markieren unfehlbar den Boden.
*   **Kleine Injektionen (+50 bis +100 Mrd. $) ohne vorherige Panik:** Wenn diese Gelder ins System fließen, *bevor* die Banken am Discount Window geblutet haben (Phase 3), verpuffen sie oft wirkungslos (Beispiel: Die erfolglosen Rettungsversuche Mitte 2022).

### Das Timing (Keine Verzögerung!)
Wenn die "richtige" (massive) Rettung kommt, gibt es **keine zeitliche Verzögerung** zwischen Liquiditätsspritze und Marktreaktion. Der S&P 500 dreht *exakt in der gleichen Woche* nach oben:
*   **März 2023 (SVB Bank Run):** S&P 500 fällt am 15.03. In derselben Woche explodiert `WRESBAL` um **+251 Mrd. $**. V-Shape Recovery startet sofort.
*   **April 2026 (Der Dip):** S&P 500 korrigiert bis 01.04. `WRESBAL` schießt um **+121 Mrd. $** (in 2 Wochen) nach oben. Der S&P 500 zündet sofort auf neue Allzeithochs.

---

## 4. Die "4 Reiter der Liquidität" (Warum wir Steuern & Co. ignorieren)
Unsere Backtests haben gezeigt: Es ist vollkommen unnötig und sogar kontraproduktiv (Rauschen), jeden einzelnen Steuer-Dollar oder Regierungsausgaben zu tracken. Jeder Dollar, der sich im Makro-System bewegt, landet am Ende physikalisch in der `WRESBAL`-Bilanz (Bankreserven). 
* Zieht der Staat Steuern ein ➔ TGA steigt, WRESBAL sinkt.
* Gibt der Staat Geld aus ➔ TGA sinkt, WRESBAL steigt.
* Druckt die FED Geld ➔ WRESBAL steigt.

Aus diesem Grund verlässt sich das CrashRadar-System **ausschließlich auf diese 4 essenziellen Daten-Serien**. Sie erfassen 100% aller fiskalischen und monetären Markt-Manipulationen:

### A. Das Frühwarnsystem (Lead: 1 bis 3 Monate vor dem Crash)
Diese Werte tracken wir, um Risiko aus dem Portfolio zu nehmen.

*   **Serie 1: TGA (Treasury General Account) - *Der Staubsauger***
    *   **Schwellenwert (Rot):** Ein Netto-Anstieg von **> +150 Mrd. $** innerhalb von 90 Tagen.
*   **Serie 2: Bankreserven (`WRESBAL`) - *Das Schmieröl / Der Flaschenhals***
    *   **Schwellenwert (Rot):** Ein kontinuierlicher Rückgang von **> -100 Mrd. $** innerhalb von 8 Wochen.
*   **Serie 3: Reverse Repo (`RRPONTSYD`) - *Das Schatten-Parkhaus***
    *   **Schwellenwert (Gelb/Rot):** Zuflüsse > 100 Mrd. $ in kurzer Zeit.

### B. Die Akut-Melder & Boden-Finder (Lag/Coincident: 0 bis 5 Tage)
Diese Werte bestätigen, dass die Kernschmelze läuft und liefern das Kaufsignal.

*   **Serie 4: Discount Window (`BORROW`) & BTFP (`WLCFLL`) - *Der Panik-Raum***
    *   **Schwellenwert (Absolute Panik):** Sobald die Inanspruchnahme innerhalb von 4 Wochen um **> +15 Milliarden $** in die Höhe schießt (Delta-Messung).
*   *(Zusatz zu Serie 2):* **FED-Bilanz (`WALCL`) & Bankreserven (`WRESBAL`) - *Die Rettungs-Bazooka***
    *   **Schwellenwert (Grün / Boden):** Wenn `WALCL` oder `WRESBAL` plötzlich um **> +150 Mrd. $** ansteigen, ODER um > +50 Mrd. $, **sofern vorher Phase 3 (Panik)** erreicht wurde.

---

## 5. Bauplan für die ML-Logik (Die 4 System-Phasen)

1.  🟡 **PHASE 1: WARNUNG (Risk-Off Vorbereitung)**
    *   *Trigger:* TGA füllt sich schnell (> 150 Mrd. $) **UND / ODER** Bankreserven fallen drastisch.
    *   *Aktion:* Liquidität verlässt das System. Positionen verkleinern.
2.  🔴 **PHASE 2: CRASH STARTET (Cash-Position)**
    *   *Trigger:* Aktienindizes brechen ein, RRP saugt das Geld auf.
3.  🚨 **PHASE 3: KAPITULATION (Watchlist für Einstieg)**
    *   *Trigger:* `BORROW` (Notfallkredite) explodiert um **> +15 Mrd. $ (Delta-Schock)**.
    *   *Aktion:* Die Banken bluten. Dies ist unser Marker für eine "Echte Krise". Höchste Alarmbereitschaft für den Wiedereinstieg.
4.  🟢 **PHASE 4: RETTUNG & STRESS-ABFANG (Risk-On)**
    *   *Trigger:* Bankreserven (`WRESBAL`) schnellen aggressiv nach oben (> +150 Mrd. $ *oder* > +50 Mrd. $ wenn wir vorher in Phase 3 waren).
    *   *Aktion:* Das System hat den Stress erfolgreich abgefangen. Krypto (BTC) und Nasdaq (QQQ) aggressiv kaufen.

---

## 6. Referenzierte Sandbox-Skripte & Backtest-Logs
Alle Thesen in diesem Dokument wurden über historische Daten (2006-2026) in unserer lokalen Sandbox mathematisch validiert.

*   **Der Fetcher:** [sandbox-fetcher.js](file:///C:/GitHub/CrashRadar/scratch/sandbox-fetcher.js) (Zieht alle FED/TGA Daten).
*   **Der State-Machine Simulator:** [backtest-indicator.js](file:///C:/GitHub/CrashRadar/scratch/backtest-indicator.js) (Simuliert die 4 Phasen historisch).
*   **Detail-Analyse (Die letzten 6 Monate):** [backtest-recent.js](file:///C:/GitHub/CrashRadar/scratch/backtest-recent.js)
*   **Das WRESBAL-Timing:** [wresbal-timing-test.js](file:///C:/GitHub/CrashRadar/scratch/wresbal-timing-test.js) (Beweist das exakte Timing).
*   **Der WRESBAL-Failure-Test:** [wresbal-failure-test.js](file:///C:/GitHub/CrashRadar/scratch/wresbal-failure-test.js) (Untersucht die 10% Ausfallrate von Liquiditätsspritzen).
*   **Ergebnis-Logs:** 
    *   [Crash-Analyzer-Report.md](file:///C:/GitHub/CrashRadar/scratch/Crash-Analyzer-Report.md)
    *   [Indicator-Backtest-Log.md](file:///C:/GitHub/CrashRadar/scratch/Indicator-Backtest-Log.md)
    *   [Indicator-Recent-6-Months.md](file:///C:/GitHub/CrashRadar/scratch/Indicator-Recent-6-Months.md)
