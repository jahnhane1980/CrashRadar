# Gold & GDX Trading Strategie (Tranchen-Verkauf)

## Grundgedanke
Ein 100% Ausstieg beim ersten Anzeichen von Markt-Euphorie führt historisch in großen Bullenmärkten oft dazu, dass massive Gewinne auf dem Tisch gelassen werden ("Early Exit"). Blasen können irrational lange weiterlaufen (z.B. Gold 2011, Post-Corona 2020). 
Daher nutzen wir eine datengetriebene 3-Tranchen-Exit-Strategie (33% / 33% / 34%), um Gewinne dynamisch und risikoavers mitzunehmen.

## Entry (Einstieg in Tranchen)
Der Einstieg ist **dynamisch** und hängt vom identifizierten Makro-Regime (Art des Crashs) ab, da Gold und GDX unterschiedliche Vorlauf-Zeiten haben. Wir steigen nun ebenfalls in Tranchen ein (z.B. 3 Tranchen), um das Timing-Risiko zu glätten.

### Regime A: Der Flash Crash (VIX > 45 oder extremer SPY-Absturz)
* **Signal:** GDX Selling Climax führt.
* **Datenpunkte:** GDX Volumen ist > 3x des SMA50 **UND** GDX fällt an diesem Tag um > 5%.
* **Logik:** Kleinanleger kapitulieren durch massive Margin Calls. Smart Money sammelt die Panikverkäufe billig ein. Dies markiert den Beginn eines V-Shape-Bodens. **GDX bildet hier den Boden vor Gold.** Wir kaufen aggressiv GDX; Gold folgt leicht verzögert.

### Regime B: Der Bärenmarkt (VIX < 35, langsamer SPY-Absturz, Margin Debt sinkt)
* **Signal:** Gold-Stärke führt.
* **Datenpunkte:** Gold hört auf zu fallen und durchbricht seinen kurzfristigen Aufwärtstrend (z.B. SMA 20 nach oben).
* **Logik:** Ein strukturelles Deleveraging am Aktienmarkt drückt die Minen (GDX) weiter nach unten. Physisches Gold hingegen wird langsam als Krisenschutz akkumuliert. **Gold bildet hier den Boden deutlich vor GDX.** Wir fokussieren uns zuerst auf den Einstieg in physisches Gold. GDX-Kaufsignale werden ignoriert, bis Gold den Aufwärtstrend unbestritten etabliert hat.

## Taktisches Swing-Trading (Der Gummiband-Effekt)
Unabhängig vom langfristigen Makro-Regime nutzt die *TradeSetupEngine* extreme kurzfristige Übertreibungen für taktische Swing-Trades (Gewinnmitnahmen), um Schwankungen abzufedern.
* **Die Schallmauer:** Gold hat eine harte physische Schallmauer bei **+10 % über dem SMA 50**.
* **Aktion:** Sobald Gold sich mehr als 10 % von seinem 50-Tage-Schnitt nach oben entfernt, kippt die Zukunftsrendite historisch in den negativen Bereich. Die Engine kann hier einen Teil der Position taktisch verkaufen (als "Alpha-Trade", **unabhängig** von den regulären Exits) und auf den Rücksetzer (Snapback) auf den SMA 50 warten, um dort wieder günstiger nachzukaufen.

## Exit (Tranchen-Verkauf)

Jede Tranche feuert **strikt datenbasiert**, wir spekulieren nicht auf Prozente ("noch 20% im Tank").

### Tranche 1: Euphorie / FOMO (33% Verkauf)
* **Signal:** GDX Buying Climax (Top-Gefahr)
* **Datenpunkte:** GDX Volumen ist > 3x des SMA50 **UND** GDX steigt an diesem Tag um > 5%.
* **Logik:** Kleinanleger kaufen aus reiner FOMO. Das "Smart Money" nutzt die gewaltige Liquidität für Gewinnmitnahmen. Dies ist oft ein lokales Top. Wir sichern ein Drittel des Gewinns ab.

### Tranche 2: Smart Money Exit / Divergenz (33% Verkauf)
* **Signal:** GDX vs Gold Divergenz (ROC Momentum-Verlust)
* **Datenpunkte:** Gold markiert ein neues 30-Tage-Hoch, ABER GDX hat sein Momentum verloren (hat sein Top z.B. 10 Tage vorher gemacht und fällt). Zuvor muss GDX eine extreme **Rate of Change (ROC)** gezeigt haben (z.B. > 20% Steigung in 20 Tagen), was eine parabolische Erschöpfung (Glockenkurve) beweist.
* **Logik:** Das Ende eines Bullenmarktes kündigt sich an, wenn GDX parabolisch geht und dann kollabiert, *bevor* Gold sein Top erreicht. Physisches Gold steigt weiter (systemische Flucht), aber das hochriskante Hebel-Kapital verlässt bereits die Minen. Das echte Top rückt extrem nah. Wir stoßen das zweite Drittel ab.

### Tranche 3: Makro-Schock & Catastrophe Stop (34% Finaler Verkauf)
* **Signal:** Kombination aus technischem Crash (mit Sicherheitspuffer) UND toxischem Makro-Umfeld.
* **Datenpunkte & Schwellenwerte:**
  1. **Die -10% Todeszone (Technik):** Gold oder GDX stürzt massiv ab und fällt **> 10 % unter seinen SMA 50**. (Der direkte Bruch des SMA 50 ohne Puffer ist als alleiniges Signal ungültig!).
  2. **Der Makro-Killer (Fundamentaldaten):** Zeitgleich MUSS mindestens einer der folgenden Sensoren "rot" leuchten:
     * *DXY Spike:* US-Dollar (DXY) steigt um **> +1,01 %** (20-Tage ROC).
     * *Realzins-Schock:* Abrupter Anstieg der Realzinsen (z.B. **+0,29 Punkte in 20 Tagen**).
     * *Margin Debt Crash:* Rapider Abbau des FINRA Margin-Debt (z.B. **> 20 Mrd. $** Abbau).
* **Logik:** Der reine SMA 50 Bruch ist reines Stop-Loss Fishing (70 % Fake-Out Quote). Der SMA 200 wiederum schlägt viel zu spät an. Der "Heilige Gral" für die Notbremse ist die Kombination: Wenn der Preis *tief* unter den SMA 50 taucht (-10 % Puffer) UND das Makro-Umfeld nachweislich implodiert (Dollar/Zinsen/Margin Calls), liegt die Trefferquote für einen "True Death" des Zyklus bei sensationellen 75 %. Tranche 3 feuert hier und rettet das restliche Kapital vor dem fatalen Absturz.

## Hard-Stops & Risikomanagement
Um zu verhindern, dass wir in Bärenmärkten gefangen werden oder dumme Stopps auslösen, gelten diese absoluten Prinzipien:
* **Kein blinder SMA 50 Stop:** Der SMA 50 ist beim GDX **kein** Stop-Loss. In intakten Bullenmärkten fällt GDX regelmäßig 3-5 % darunter, bevor er in einem V-Shape-Reversal explodiert.
* **Kein später SMA 200 Stop:** Der SMA 200 wurde historisch oft als absolute "Lebenslinie" gepredigt. Backtests zeigen aber: Bis der SMA 200 bei GDX bricht, ist das Portfolio oft schon zu 40 % zerstört. Er reagiert zu träge.
* **Der ultimative Smart-Stop:** Die einzig valide Notbremse für das restliche Portfolio (Tranche 3) bleibt strikt die oben definierte Symbiose aus **(-10 % unter SMA 50) + (Makro-Schock aktiv)**. Fehlt das Makro-Signal, halten wir den Drawdown aus, da eine rapide Erholung hochwahrscheinlich ist.
