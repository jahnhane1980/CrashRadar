# These & Recherche: "Der Bullenmarkt stirbt mit dem letzten Bären"

## Die Kern-These
Historisch gesehen enden Bullenmärkte nicht aus Angst, sondern aus absoluter Euphorie und Gier ("Blow-off Top"). Ein Markt toppt erst dann, wenn selbst die hartnäckigsten Bären (Pessimisten) kapitulieren, ihre Short-Positionen auflösen und aus FOMO (Fear Of Missing Out) anfangen, auf steigende Kurse zu wetten. Wenn keine Absicherung (Hedging) mehr im Markt existiert, entfällt der "Käufer-Puffer" für Rücksetzer, und der Markt wird extrem anfällig für einen Crash.

## Die Metriken zur Messung der Bären-Kapitulation

Um diese Euphorie und Kapitulation quantifizierbar zu machen, haben wir folgende Metriken und Datenquellen definiert:

### 1. Daily Short Volume (Die Kapitulation der Leerverkäufer)
* **Konzept:** Wir messen nicht das langsame "Short Interest" (welches nur 14-tägig erscheint), sondern das tägliche "Short Volume". Wenn das Short Volume massiv abnimmt, traut sich niemand mehr, gegen den Markt zu wetten.
* **Fokus-Assets:** Wir betrachten nicht nur den Gesamtmarkt (**SPY**, **QQQ**), sondern explizit Hype-Sektoren wie Halbleiter (**SMH**). Wenn selbst beim SMH (Nvidia, TSMC) das Short-Volumen auf ein Rekordtief fällt, ist die Spekulation maximal ausgereizt.
* **Datenquelle:** FINRA "Reg SHO" Daily Files (kostenlose, tägliche Off-Exchange Volumen-Daten).

### 2. Put/Call Ratio (PCR) (Die Kapitulation der Absicherer)
* **Konzept:** Das Verhältnis von gekauften Put-Optionen (Wetten auf fallende Kurse) zu Call-Optionen (Wetten auf steigende Kurse). Fällt das PCR auf extreme Tiefststände (z.B. < 0.6), badet der Markt in Calls. Die Bären sind ausgestorben.
* **Datenquelle:** CBOE Total Market PCR (oder Equity PCR).
* **⚠️ Daten-Problem (Erkenntnis):** Wir haben aktuell keine historischen PCR-Daten. Der anvisierte CBOE-Endpunkt (`Cboe_Daily_Market_Statistics.csv`) liefert für historische Abfragen in die Vergangenheit konstant einen `403 Forbidden` Fehler. Offenbar stellt die CBOE dort nur noch den tagesaktuellen Snapshot bereit.

### 3. SKEW Index (Der Preis für Tail-Risk)
* **Konzept:** Der CBOE SKEW Index misst die Kosten für "Out-of-the-Money" Puts (Wetten auf einen schwarzen Schwan / Crash) im Vergleich zu Calls. 
* **Wichtige Korrektur (Nach Analyse):** Entgegen der anfänglichen Annahme ("niedriger SKEW = Sorglosigkeit") zeigt die Datenrealität das Gegenteil! Vor fast allen großen Crashs seit 2013 war der SKEW **extrem hoch** (> 145). Im absoluten Hype kaufen Smart Money und Institutionen panisch teure Crash-Versicherungen. Ein extrem hoher SKEW im Bullenmarkt ist das eigentliche Warnsignal.
* **Fokus-Asset:** `^SKEW`
* **Datenquelle:** Yahoo Finance.

## Aktueller Projektstatus & Fahrplan
* **Status:** Analyse-Phase abgeschlossen, Indikator-Logik in Vorbereitung.
* **Nächste Schritte:** 
  - [x] 1. Datenquellen (FINRA Short Volume, CBOE PCR, SKEW, SMH) in das Fetcher-System integrieren.
  - [x] 2. Historische Daten lokal sammeln (Ab 2023 für FINRA, ab 1999 für SKEW).
  - [x] 3. **Data Science / Analyse:** Überprüfen, ob die Theorie in der Vergangenheit (z.B. Tops in 2021 oder 2023) statistisch signifikante Crash-Signale geliefert hat.
      * *Ergebnis:* Das Combo-Signal (`SKEW > 145` UND `Short-Ratio < 45%`) hat eine sehr hohe Trefferquote (75% bei Short-Volume-Dips). Es gab jedoch **4 signifikante Fehlalarme**, bei denen das Signal auslöste, aber kein Crash folgte:
        * 12.12.2023 (SKEW 148.8, Short 44.8%)
        * 17.01.2024 (SKEW 147.8, Short 33.5%)
        * 16.05.2024 (SKEW 147.9, Short 42.5%)
        * 18.11.2024 (SKEW 147.3, Short 33.9%)
      * *Erkenntnis:* Diese 4 Fehlalarme passierten ausnahmslos in absoluten "Melt-Up" Phasen (z.B. KI-Wahn, Post-Election). Das schiere **Momentum** (FOMO) des Marktes war in diesen Phasen so gigantisch, dass es die Kapitulation und die hohen Hedging-Kosten einfach überrollt und einen Crash verhindert hat.
  - [ ] 4. **TODO: Messung von "Momentum" beschließen.** Wir müssen uns damit beschäftigen, wie wir das "Melt-Up Momentum" präzise messen können, um diese 4 Fehlalarme künftig mathematisch herauszufiltern.
  - [ ] 5. **TODO: Historische PCR-Datenquelle finden.** Da der CBOE-Endpunkt blockiert (403), müssen wir eine alternative API oder Lösung finden, um die Put/Call Ratio Historie abzurufen.
  - [ ] 6. Übernahme der finalen, momentum-gefilterten Erkenntnisse in die `IndicatorEngine`.
