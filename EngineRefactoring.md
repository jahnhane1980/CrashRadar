# Engine Refactoring: Architektur-Skizze

Diese Datei dokumentiert die geplante architektonische Trennung der neuen zentralen Handelslogik. Um monolithischen "Spaghetti-Code" zu verhindern, wird die künftige `IndicatorEngine` in zwei logische Ebenen aufgespalten. Dies folgt dem "Single Responsibility Principle" (Zwei Paar Schuhe).

## 1. MacroRegimeEngine (Der System-Zustand / Wetterbericht)

Diese Engine wertet ausschließlich das große Bild aus. Sie interessiert sich nicht für Swing-Trading oder 10%-Rallyes, sondern überwacht den makroökonomischen Zustand des Finanzsystems.

**Aufgabenbereich:**
*   **Zyklus-Erkennung (Makro-Gesundheit):** Befinden wir uns im Bullenmarkt, Bärenmarkt oder in einem Flash Crash?
*   **Crash-Typ Klassifizierung:** Auswertung von VIX (> 45 vs < 35), SPY Absturzgeschwindigkeit (ROC) und FINRA Margin Debt.
*   **Der "Catastrophe Stop" (Makro-Tod):** Überwacht exogene Schocks wie DXY Spikes (> 1,01 %) oder Realzins-Schocks (> +0,29). Bricht der SMA 50 unter diesen Bedingungen, meldet die MacroRegimeEngine den "True Death" des Zyklus.

**Output:** 
Ein globaler `State` (z.B. `Regime: FLASH_CRASH`, `Cycle: DEAD`), der von allen anderen Engines abonniert und respektiert werden muss.

---

## 2. TradeSetupEngine / Execution Layer (Das Swing-Trading / Segeln)

Diese Engine ist rein für die *Ausführung* und das *Taktieren* innerhalb des von der MacroRegimeEngine vorgegebenen Wetters zuständig. Sie handelt dynamisch und reaktiv.

**Aufgabenbereich:**
*   **Dynamischer Einstieg (Tranchen-Kauf):** Liest das Regime (z.B. `FLASH_CRASH`) aus und entscheidet, *welches* Asset gekauft wird. Im Flash Crash fokussiert sie sich aggressiv auf den "GDX Selling Climax". Im Bärenmarkt ignoriert sie GDX und wartet auf physische Gold-Stärke.
*   **Gewinnmitnahmen (Das Gummiband):** Wenn das System gesund ist (Regime: `BULL_MARKET`), überwacht die TradeSetupEngine kurzfristige Übertreibungen. Steigt Gold z.B. **> +10 % über seinen SMA 50**, verkauft sie taktisch (z.B. Tranche 1 / 30 %) für den unvermeidlichen Snapback. Das Makro-Regime ändert sich hierdurch nicht!
*   **Divergenz-Tracking (Smart Money Exit):** Überwacht das ROC-Verhalten von Gold vs. GDX. Top-Bildungen bei GDX vor Gold führen zu Tranche 2 Gewinnmitnahmen.

**Output:**
Konkrete `TradeActions` (Buy/Sell) inklusive Sizing-Vorschlag (Tranchen).

---

## Zusammenfassung der Interaktion

1. Daten fließen in das System.
2. Die `MacroRegimeEngine` klassifiziert das Wetter. ("Wir sind im Flash Crash, alles brennt").
3. Die `TradeSetupEngine` liest den Wetterbericht, sieht die Panik, wartet geduldig auf den extremen Volumen-Spike (GDX Selling Climax) und drückt präzise auf den Kaufen-Knopf.
4. Später im Zyklus meldet die `MacroRegimeEngine`: "Wetter ist top, Bullenmarkt".
5. Die `TradeSetupEngine` stellt fest: "Gold ist +10% über SMA 50 geschossen, das Gummiband ist überspannt". Sie verkauft 30 % und kauft sie am SMA 50 billiger zurück. Die `MacroRegimeEngine` hat diesen Mini-Swing-Trade gar nicht gemerkt, da für sie weiterhin der Bullenmarkt lief.
