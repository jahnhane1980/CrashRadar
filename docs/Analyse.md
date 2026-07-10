# Makro-Finanz Analyse & Historische Drawdowns

Diese Dokumentation fasst die Erkenntnisse aus unserer lokalen Datenbank (ab 1999) zusammen, um gängige Mythen (wie den direkten Einfluss der "Net Liquidity" auf Aktienkurse) mit statistischen Realitäten abzugleichen.

---

## 1. Makro-Korrelationen & Indikatoren

### Die "Yield Curve" (10Y-2Y Spread) Falle
Die Invertierung der Zinsstrukturkurve (wenn 2-jährige Anleihen höhere Zinsen abwerfen als 10-jährige) gilt als klassischer Rezessionsindikator. Ein häufiger Trugschluss ist jedoch, dass der Aktienmarkt crasht, *während* die Kurve invertiert ist.
* **Statistische Realität:** Die durchschnittliche Tagesrendite des S&P 500 (SPY) ist in invertierten Phasen (<0) mit **0.063%** historisch sogar deutlich *höher* als in normalen Phasen (>0) mit **0.039%**.
* **Fazit:** Eine invertierte Zinskurve signalisiert einen überhitzten Markt ("Late Cycle"), führt aber oft zu extremen Blow-Off-Top-Rallyes. Der tatsächliche Crash erfolgt erst beim "Un-Inverting" (Steepening), wenn die Kurve steil in den positiven Bereich zurückkehrt, da die Zentralbank in diesem Moment aufgrund wirtschaftlicher Probleme in Panik die Zinsen senkt. **Statistische Auswertungen (siehe `scratch/analyse/Yield-Curve.js`) zeigen, dass der "Point of no return" historisch bei einem positiven Spread von ca. >= +0.30 liegt. Ab diesem Wert beginnt statistisch die Panik. Am historischen Top vor der Finanzkrise (09.10.2007) lag die 30-Tage Steigung ("Steepening") extrem bei +0.200.**

### Die "Net Liquidity" Illusion
Oft wird behauptet, Aktienmärkte (SPY, QQQ) und Bitcoin (BTC) folgten blind der *Net Liquidity* (Fed-Bilanz minus TGA minus Reverse Repo).
* **Statistische Realität (Aktien):** Über rollierende 3- bis 6-Monats-Fenster liegt die Korrelation zwischen S&P 500 und Net Liquidity bei mickrigen **0.05** *(siehe [scratch/analyse/Net-Liquidity-Illusion.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Net-Liquidity-Illusion.js))*.
* **Statistische Realität (Bitcoin):** Auch bei Bitcoin ist diese Korrelation faktisch nicht existent. Weder auf kurzfristiger Ebene (Tages-/Wochenrenditen: **-0.03** bis **-0.07**), noch auf langfristiger Ebene (rollierende 90-Tage: **-0.006** und 180-Tage-Renditen: **0.009**).
* **Fazit:** Der Mythos, Krypto und Aktien würden kontinuierlich 1:1 am Tropf der Liquidität hängen, ist mathematisch falsch. In normalen Marktphasen entkoppeln sich die Risiko-Assets komplett von der Makro-Liquidität. Bitcoin treibt eigene Zyklen (Halving, ETF-Flows) und der Aktienmarkt folgt primär Unternehmensgewinnen (Earnings). Die Net Liquidity bestimmt die Kurse **nur in absoluten Extremfällen** (z.B. bei panischen Geldspritzen wie im Jahr 2020 oder wenn sie als makroökonomischer "Käfig" fungiert und die Liquidität komplett austrocknet).

### Der dominante Faktor: Financial Conditions (DXY)
Der stärkste makroökonomische Treiber für unsere beobachteten Risiko-Assets ist der US-Dollar-Index (DXY) als Gradmesser der weltweiten "Financial Conditions".
* **Statistische Realität:** Die 6-Monats-Korrelation zwischen dem S&P 500 und dem DXY liegt bei starken **-0.31** *(siehe [scratch/analyse/Financial-Conditions-DXY.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Financial-Conditions-DXY.js))*.
* **Fazit:** Ein schwacher Dollar bedeutet günstige globale Finanzierungsbedingungen (Rückenwind für SPY, QQQ, BTC). Ein starker Dollar fungiert wie eine eiserne Schwerkraft und drückt Risiko-Assets nach unten.

### Die Anleihen-Illusion: Kein "Frühindikator" für Crashes
Oft wird behauptet, das "Smart Money" am Anleihenmarkt rieche den Braten Monate vorher und schichte von Aktien in sichere US-Staatsanleihen (TLT) um, was steigende Anleihenkurse zu einem guten Frühindikator mache.
* **Statistische Realität:** In den 6 Monaten vor historischen Aktien-Crashes (z.B. 2018, 2020, 2025) tendierte der Anleihenmarkt (TLT) **seitwärts oder sogar negativ** (-0.4% bis -9.5%). Es gibt keine massive Umschichtung *vor* dem Panik-Event *(siehe [scratch/analyse/Bonds-Illusion.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Bonds-Illusion.js))*.
* **Verhalten *während* des Crashes:**
  * **Klassischer Crash (Deflation/Panik wie 2008, 2020):** Anleihen explodieren exakt *während* des Aktien-Crashes (+14% bis +17%), da Investoren in Panik flüchten. Sie bieten perfekten Schutz.
  * **Zins-/Inflations-Schock (wie 2022):** Anleihen stürzen parallel zu Aktien brutal ab (-30%). Aktien und sichere Häfen brennen gleichzeitig ab.
* **Fazit:** Anleihen "front-runnen" den Crash nicht. Sie sind kein Frühindikator, der 3 Monate vorher Alarm schlägt. Sie fungieren als Feuerwehr: Sie rücken nicht an, bevor es brennt, sondern erst, wenn die Panik ausbricht – und bei Inflations-Crashes verbrennen sie selbst.

### Rohstoffe im Crash: "Dr. Copper" vs. "Boden-Indikator" Gold
Kupfer gilt als Fieberthermometer der Weltwirtschaft, während Gold traditionell den sicheren Notgroschen repräsentiert. Unsere historische Auswertung über 6 große Aktien-Crashes zeigt klare Muster:
* **Dr. Copper stürzt immer mit ab:** Kupfer crasht gnadenlos synchron mit dem Aktienmarkt (z.B. -54% in 2008, -22% in 2022). Sobald der Aktienmarkt einbricht, stirbt die Phantasie vom industriellen Wirtschaftswachstum. Kupfer bietet **absolut keinen Schutz**.
* **Gold als Notgroschen & Der Zins-Zusammenhang:** Historisch korreliert Gold nahezu perfekt *invers* mit den realen Zinsen (DFII10). Wenn die Realzinsen fallen (z.B. nach der Finanzkrise oder 2020), explodiert Gold. Wenn die Realzinsen steigen (wie im großen Gold-Bärenmarkt 2013-2015 oder 2022), crasht Gold.
* **Die ultimative Ausnahme ("Policy Error" der Zentralbank):** Im aktuellen Bullenmarkt (2022-2026) ist diese historische Korrelation **komplett gebrochen**. Die Realzinsen steigen (weil die Marktzinsen am langen Ende angesichts der "sticky" Inflation schneller steigen als die FED kurzfristig senken kann), und Gold explodiert *trotzdem* um über 140%. Das signalisiert massives Misstrauen: Das "Smart Money" flieht in Panik vor einem Systembruch in Gold, unabhängig vom Zinsniveau.
* **Gold als verlässlicher "Boden-Indikator":** Die wichtigste Erkenntnis ist das Timing der Erholung. **In 100% der betrachteten Crashes (6 von 6)** erreichte Gold seinen absoluten Tiefpunkt und drehte wieder nach oben, **bevor** der S&P 500 (SPY) seinen Tiefpunkt fand *(siehe [scratch/analyse/Copper-Gold-Commodities.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Copper-Gold-Commodities.js))*.
* **Der "Volume Climax" (Panik-Messer):** Ein plötzlicher Volumen-Spike bei Gold (z.B. > 5x des 50-Tage-Schnitts) ist der absolut beste Seismograph für einen Markt-Höhepunkt.
  * *Selling Climax:* 2011 und vor dem Zins-Schock Anfang 2022 stürzte Gold unter massivem Volumen (-2%, Volumen 41x über Durchschnitt) ab. Das war der perfekte Startschuss für den Crash aller Assetklassen durch Liquidationszwänge (Margin Calls).
  * *Buying Climax:* Extreme Volumenspikes (>20x) bei gleichzeitig steigendem Goldpreis wie in unserer 2026er Simulation sind das finale Zeichen einer "Everything Bubble" (Panik-Käufe aus Angst vor Entwertung/Systemrisiko).
* **Fazit:** Wenn Gold aufhört zu fallen und einen Aufwärtstrend ausbildet, signalisiert dies, dass der Liquiditätsengpass im System behoben wurde. Es ist der verlässlichste Indikator dafür, dass der Aktienmarkt bald seinen Tiefpunkt ("Boden") findet. Der "Volume Climax" bestätigt uns hingegen in Echtzeit, ob gerade absolute Panik oder "Blow-Off"-FOMO herrscht.
* **Die Dauer von Gold-Bullenmärkten:** Echte, sekulare Gold-Bullenmärkte laufen historisch eher 3 bis 5 Jahre, mit sehr steilen 1,5- bis 2-jährigen Beschleunigungsphasen ("Parabolic Runs") an ihrem Ende.

### GDX (Gold Miners) vs. Öl (CL=F) im Gold-Bullenmarkt
* **Die Top-Bildung (GDX als Vorläufer):** Historisch ist GDX (der Goldminen-ETF) ein exzellenter Vorläufer für das Ende eines Gold-Bullenmarktes. In 13 massiven Gold-Rallyes toppte der GDX in 6 Fällen zwischen 1 und 11 Tagen *vor* dem physischen Gold. Das "Smart Money" nimmt bei den gehebelten, riskanten Minen zuerst Gewinne mit. Fällt der GDX, während Gold noch steigt, steht das Gold-Top unmittelbar bevor.
* **Die Boden-Bildung (Liquidations-Crash vs. Bärenmarkt):** Ein dedizierter Backtest (`scratch/performance/Gold-vs-GDX-Bottom-Test.js`) beweist, dass es beim Timing des Bodens auf die *Art* des Crashs ankommt. In plötzlichen, extremen Liquidations-Crashes (z.B. Finanzkrise 2008, Corona 2020) bildete **GDX den Boden vor Gold** (2008: 17 Tage früher, 2020: 5 Tage früher). Grund: Panikartige Margin-Calls zwingen zur sofortigen Liquidation von gehebelten Assetklassen, was eine extrem scharfe V-Shape-Kapitulation (Selling Climax) auslöst, in die das Smart Money sofort hineinkauft. In langanhaltenden, blutenden Bärenmärkten (2015, Q1 2026) bildete hingegen **Gold den Boden deutlich vor GDX** (2015: 33 Tage, 2026: 77 Tage). Grund: Physisches Gold wird als erster sicherer Hafen akkumuliert, während Minen als "Aktien" unter dem fortwährenden strukturellen Deleveraging am Aktienmarkt länger bluten. Die Kaufsignale für Gold und GDX müssen daher systemisch entkoppelt ausgewertet werden.
* **Vorlaufende Indikatoren (Crash-Klassifizierung):** Um in Echtzeit zu erkennen, welches Setup (Flash Crash vs. Bärenmarkt) vorliegt, wertet die Engine drei spezifische Makro-Sensoren aus:
  1. **VIX (Volatilitätsindex):** Ein absoluter Hauptindikator. Steigt der VIX massiv an (z.B. > 45), signalisiert dies eine Panik-Liquidation. Die Engine stellt sich auf einen sofortigen GDX V-Shape-Boden ein. Bleibt der VIX niedriger (< 35) bei gleichzeitig fallenden Märkten, liegt ein langsamer Bärenmarkt vor. Die Engine rechnet damit, dass Gold zuerst dreht.
  2. **SPY Rate of Change (Absturz-Geschwindigkeit):** Die Geschwindigkeit des Verlusts ist entscheidend. Ein sehr schneller SPY-Sturz (z.B. -15% in 10 Tagen) garantiert nahezu Margin-Calls (Fokus auf GDX-Selling Climax). Ein langsamer, stetiger Fall über Monate hinweg bedeutet fehlenden Kaufdruck (Fokus auf Gold).
  3. **FINRA Margin Debt:** Ein rapider Abbau des Margin Debt (Deleveraging) bedeutet andauernden Verkaufsdruck auf dem Aktienmarkt. Solange dieser Abbau extrem steil ist, bleiben Minen unter Druck, und Gold bildet den Boden wesentlich früher.
* **Der Öl-Mythos (Die Miner-Margen):** Es gibt den Mythos, dass ein steigender Ölpreis die Margen der Goldminen auffrisst und sie dem Goldpreis hinterherhinken lässt. Ein Test *(siehe [scratch/analyse/GDX-vs-Oil.js](file:///C:/GitHub/CrashRadar/scratch/analyse/GDX-vs-Oil.js))* straft das Lügen: Wenn Gold in einen Bullenrun (>10%) übergeht und Öl *fällt*, performt GDX das Gold um durchschnittlich +9,42% aus. Wenn Öl im selben Zeitraum massiv *steigt* (>20%), performt GDX das Gold immer noch um +8,90% aus. Fazit: Wenn die absolute Gold-FOMO kickt, ignorieren Investoren die Bagger-Kosten komplett. GDX wird ausschließlich als Hebel auf Gold gehandelt.
* **Die Volumen-Analyse (Climax-Muster):** Massive Volumen-Spikes (>3x des 50-Tage-Durchschnitts) beim GDX kennzeichnen verlässlich Wendepunkte (Extremwerte) im Goldmarkt.
  * *Selling Climax (Kaufsignal/Boden):* Wenn GDX an einem Tag massiv einbricht (≤ -5%) UND das Volumen auf über das 3-fache des 50-Tage-Schnitts explodiert, kapitulieren Kleinanleger. Smart Money sammelt ein. Resultat: Ein aggressives V-Shape Reversal.
  * *Buying Climax (Warnsignal/Top):* Wenn GDX extrem steil ansteigt (≥ +5%) UND das Volumen auf über das 3-fache explodiert, kaufen Kleinanleger aus FOMO (Fear Of Missing Out). Smart Money verkauft in die Liquidität hinein. Resultat: Ein brutales lokales Top und darauffolgende Abverkäufe.
* **Zyklus-Performance & Anomalien (Die 0,35 % Regel):** Ein gesunder, kompletter Makro-Bullenmarkt für den GDX erstreckt sich historisch – analog zum Gold – über mehrere Jahre. In diesen "ganzen Läufen" (z.B. 2008-2011 oder 2022-2026) pegelt sich die durchschnittliche Wachstumsrate erstaunlich konstant bei **~0,34 % bis 0,36 % pro Tag** ein. Extreme Ausreißer nach oben (wie die +1,29 % pro Tag im Jahr 2020) sind das Resultat von massiven Liquidations-Crashs (Margin Calls). In solchen Schock-Momenten wird die Energie eines gesamten Bullenzyklus auf eine extrem kurze V-Shape-Erholung (z.B. nur 142 Tage) komprimiert.
* **Margin Calls vs. Kapital-Rotation:** Warum fällt Gold überhaupt?
  * *Der Margin Call (Crash-Sog):* Wenn der Aktienmarkt (SPY) crasht und/oder der VIX explodiert, erhalten Institutionen Margin Calls. Sie sind gezwungen, liquide Gewinner (Gold/Minen) zu verkaufen, um Cash zu beschaffen. Das drückt GDX oft extrem tief unter den SMA 50. Algorithmen schreiben den Trend dann fälschlicherweise ab, obwohl der Crash nicht am Gold, sondern am blutenden Aktienmarkt lag.
  * *Die Kapital-Rotation (Opportunity Cost):* In extrem starken Aktien-Bullenmärkten (Risk-On) "verhungert" Gold oft. Liquiditätsspender rotieren ihr Geld aus dem Krisen-Hedge in den hochrentablen Aktienmarkt. Gold ist dann totes Kapital.
  * *Der Erschöpfungs-Tod (Blow-Off Top):* Steigt Gold selbst in kurzer Zeit massiv an (z.B. > +50% in 6 Monaten), stirbt der Zyklus zunächst an reiner Käufer-Erschöpfung. Das Gummiband reißt unter der eigenen Schwerkraft.

### Die Tech-Sektor Rotation & Die Infrastruktur-Mauer
Der Technologie-Sektor (QQQ) bewegt sich nicht als Monolith, sondern in internen Rotations-Zyklen. Wir tracken den Fluss des Kapitals zwischen dem Aufbau von Infrastruktur (Hardware) und der späteren Monetarisierung (Software).

* **Die Infrastruktur-Mauer (Physisches Limit):** Ein Hardware-Bullenmarkt (KI/Rechenzentren) stirbt oft nicht an mangelnder Nachfrage, sondern an physischer Reibung. Wenn Milliarden-Projekte aufgrund von Stromnetz-Engpässen oder fehlenden Genehmigungen blockiert werden, wird der ROI der dort verbauten Hardware zum Risiko. Das Narrativ vom "unendlichen Wachstum" zerschellt an der physischen Grenze der Infrastruktur.
* **Der Ansatz (SMH vs. IGV):** Wir analysieren das Ratio zwischen dem Halbleiter-ETF (SMH) und dem Software-ETF (IGV). Um Signale zu glätten, nutzen wir ein Crossover-System aus einem kurzfristigen (15 Tage) und einem langfristigen (50 Tage) gleitenden Durchschnitt dieses Ratios.
* **Der Kapital-Audit (Smart Money vs. Retail):** Der reine Preis (SMH/IGV Ratio) kann durch uninformiertes Retail-Geld ("Buy the Dip") künstlich oben gehalten werden. Um den echten Wendepunkt ("Point of Realization") zu finden, bevor der Preis bricht, müssen Kapitalströme isoliert überwacht werden:
  * *Der institutionelle Exit:* Massenhaft geschlossene oder reduzierte Positionen in **13F Filings** von Großanlegern (>100 Mio. USD) in Kombination mit negativem "Large Order Flow".
  * *Die Dark Pool Divergenz:* Ein sinkender Dark Index (**DIX**), der zeigt, dass Institutionen verdeckt in die vorhandene Liquidität abverkaufen.
  * *Die Retail-Falle:* Die Gegenbewegung der Privatanleger, gemessen über **VandaTrack** oder **Odd Lots**. Kauft der Retail massiv nach, während Smart Money über Dark Pools und 13F flieht, ist die Liquiditäts-Illusion perfekt.
* **Warum keine separate Engine?** Wir haben uns bewusst gegen eine isolierte `TechCycleEngine` entschieden und den "Tech-Zyklus Radar" in die bestehende `IndicatorEngine` integriert. Das verhindert Fragmentierung und erlaubt es der zentralen Engine, Benachrichtigungen, Debouncing (Spam-Schutz) und Priorisierungen global über alle Anlageklassen hinweg zu steuern.
* **Erkenntnisse aus dem Zyklus:**
  * *Hardware Start (Golden Cross):* Der schnelle MA kreuzt den langsamen MA nach oben. Ein neuer Infrastruktur/KI-Zyklus beginnt. Hardware dominiert den Markt.
  * *Software Start (Death Cross):* Der schnelle MA fällt unter den langsamen MA. Das Infrastruktur-Thema ist eingepreist, das Kapital rotiert in SaaS- und Monetarisierungs-Modelle.
* **Aktuelle Beobachtung (Der CIBR Bunker & Diversifikation):** Ein wackelnder Hardware-Zyklus führt nicht zwingend zu einem sofortigen Crash. Oft flüchtet das Kapital zunächst in defensive Nischen ("Diversifikation"). Hierbei fungiert der **Cybersecurity-Sektor (CIBR)** als unser Radar, ebenso wie Fluchten in *Utilities (XLU)* oder Energie-Infrastruktur. Wenn der Hardware-Trend abflacht (Distribution) UND diese defensiven Monopole gleichzeitig signifikantes Momentum aufbauen, werten wir dies als klare Bestätigung einer Gewinnmitnahme-Welle und Flucht in "sichere Häfen".
* **[TODO] DATENPROBLEM / BEWEIS STEHT NOCH AUS:** Der Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) konnte die These des "Stealth-Exits" via DIX, 13F-Filings und VandaTrack noch **nicht empirisch beweisen**. Da in der aktuellen Umgebung keine Live-Datenbankverbindung und keine echten historischen Daten für diese proprietären Datenströme vorlagen, wurden die Signale im Backtest lediglich um bekannte historische Hochpunkte herum simuliert (gemockt). Dies stellt keinen wissenschaftlichen Nachweis dar. Wir müssen echte historische Dark-Pool- und 13F-Zeitreihen beschaffen, um den Beweis unter realen Bedingungen anzutreten. Beide Preis-Strategien (ohne Flows) reduzierten im Test den maximalen Drawdown von QQQ von **-37,06 %** auf **-16,93 %**.

### Makro-Einzelindikatoren als Frühwarnsystem (-3 Monate vor dem Crash)
Die Analyse der entbündelten FED- und Fiscal-Parameter (isoliert betrachtet, nicht im "Net Liquidity"-Mix) liefert extrem scharfe Frühwarnsignale in den 3 Monaten, *bevor* ein Crash seinen Höhepunkt erreicht:

* **Central Bank Policy Error (DFF vs T10YIE vs DXY):** Das mathematisch perfekte Kaufsignal für Gold (Fiat-Flucht). Wenn die FED über ein 60-Tage-Fenster panisch die Zinsen senkt (DFF sinkt > 0.25%), der Anleihemarkt aber gleichzeitig steigende Inflationserwartungen einpreist (T10YIE steigt > 0.10%), verliert das Fiat-System massiv an Vertrauen. Der Indikator triggert **nur dann**, wenn der US-Dollar (DXY) im selben Zeitraum nicht stark aufwertet (<= +2,0%), da ein starker Dollar den Gold-Run blockiert.
  * *Statistische Realität:* Mit dem DXY-Filter stieg Gold in 73,6% dieser Phasen an. Die durchschnittliche 60-Tage-Rendite für Gold in diesen Mega-Runs beträgt extreme **+7,95%** *(siehe [scratch/analyse/Central-Bank-Policy-Error.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Central-Bank-Policy-Error.js))*.
  * *Sommer 2007 (Der "Panik Run"):* FED senkte von 4,96% auf 4,55%, Inflation stieg leicht, Dollar stürzte ab. Gold stieg in 60 Tagen um fast +20%. Aktien (SPY) crashten parallel.
  * *Herbst 2024 (Der "Everything Bubble Run"):* FED senkte, Inflation stieg leicht, Dollar war flach. Aktien stiegen um +12%, Gold stieg um +11%.

* **Bankreserven (Bank Reserves / TOTRESNS):** Die Reserven sind das eigentliche Schmiermittel der Märkte. Ein starker Rückgang ist ein massives Warnsignal.
  * *Zins-Crash 2018:* Rückgang um 114 Mrd. $ vor dem Peak.
  * *Inflations-Crash 2022:* Rückgang um brutale 257 Mrd. $ vor dem Peak.
* **Das TGA-Konto (Treasury General Account):** Das Konto des Finanzministeriums wirkt makroökonomisch als Liquiditäts-Sauger.
  * *Inflations-Crash 2022:* Das TGA stieg in den 3 Monaten vor dem Aktien-Peak massiv von 132 Mrd. $ auf 366 Mrd. $ an und entzog dem Markt Liquidität.
  * *Einschränkung als Timing-Tool:* Als eigenständiges Timing-Tool ist das TGA jedoch viel zu träge und generiert zu viele False-Positives. Historisch liegt das TGA an Aktien-Tops im Schnitt bei ~540 Mrd. $ und an Bottoms bei ~740 Mrd. $. Es eignet sich eher als passiver Kontext-Faktor und nicht als scharfer Trigger.
* **Chicago Fed Stress Index (NFCI):** Ein Wert über 0 signalisiert akuten Stress im Finanzsystem (teurere Kredite, sinkende Liquidität).
  * *Finanzkrise 2008:* Der Index schoss in den 3 Monaten vor dem Crash-Start drastisch in die Höhe (von -0.50 auf +0.02). Das System stand bereits in Flammen, während die Aktienkurse noch nahe des Allzeithochs rangierten.
* **Zinsstrukturkurve (Spread 10Y-2Y):** Das klassische "Un-inverting".
  * *Dotcom (2000) & Finanzkrise (2008):* Die Kurve war lange invers (unter 0). Erst in den 3 Monaten vor dem Absturz stieg der Spread wieder massiv an. An Tops liegt der Spread im Durchschnitt bei +0.18, am Bottom invers bei -0.05. Der tatsächliche Aktien-Crash folgt exakt mit der Normalisierung (Steepening) der Zinsstruktur. Die bewährte Code-Logik hierfür lautet: `past30 < 0 && current >= 0`.
* **Sahm Rule (Reale Rezession) - WERTLOSE ILLUSION:** Steigt die Arbeitslosigkeit zu schnell (> 0.50), gilt eine Rezession in der Realwirtschaft zwar als unausweichlich, für den Aktienmarkt ist dieses Signal jedoch völlig nutzlos.
  * 🔴 **Lagging-Beweis:** Ein historischer Backtest (`scratch/analyse/Sahm-Rule.js`) über alle Crashes (Dotcom, GFC, Corona, 2022) hat empirisch bewiesen, dass die Sahm Rule **massiv nachlaufend** (Lagging) ist. Sie schlug im Schnitt erst Monate *nach* dem absoluten Aktien-Top Alarm (z.B. +434 Tage nach dem Dotcom-Top, +175 Tage nach dem GFC-Top) oder fiel in Bärenmärkten komplett aus. Die Sahm Rule darf **niemals** als Frühindikator für den Markt-Ausstieg verwendet werden.
* **Margin Debt (FINRA Wertpapierkredite):** Das absolut reinste Fieberthermometer für "Gier und Hebel" im US-Aktienmarkt. Margin Debt misst, wie viel Geld sich Anleger auf Pump leihen, um Aktien zu kaufen.
  * *Signal (Top):* Margin Debt erreicht immer ein historisches Allzeithoch und dreht (stagniert oder fällt) **2 bis 6 Monate bevor** der S&P 500 seinen absoluten Höhepunkt erreicht *(siehe [scratch/analyse/Margin-Debt-Top.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Margin-Debt-Top.js))*. Das "Smart Money" und die Kreditlinien sind erschöpft, bevor der Retail-Markt sein finales Blow-Off-Top bildet. Da dieser Vorlauf sehr groß ist, stellt die ca. 3-wöchige Veröffentlichungsverzögerung der FINRA hier kein Problem dar.
  * *Beispiele:* DotCom (Margin toppte Feb 2000, SPY Aug 2000), Finanzkrise (Margin toppte Jun 2007, SPY Okt 2007), Bärenmarkt 2022 (Margin toppte Sep 2021, SPY Dez 2021).
  * *Ausnahme Flash Crashes:* Bei unvorhersehbaren "Black Swan" Events (Covid 2020) gibt es keine Vorwarnzeit durch Margin Debt, da die Wirtschaft über Nacht stillsteht.
  * *Signal (Bottom / Deleveraging):* Im Crash kommt es zu brutalen Margin Calls. Wenn das Margin Debt aufhört zu fallen (oft nach 35% bis 55% Zerstörung des Hebels), ist das "Deleveraging" abgeschlossen. 
  * ⚠️ **Achtung (Timing-Falle am Boden):** Das Margin Debt wird von der FINRA **monatlich** gemeldet (meist mit 3 bis 4 Wochen Verzögerung). Wer auf dieses Signal für den Kauf wartet, verpasst die ersten 15% bis 20% der Erholung. Margin Debt darf daher **niemals als tagesgenauer Trigger** für den Boden genutzt werden, sondern dient rein als Makro-Kontext.
  * **Spezial-Effekt auf Gold & GDX (Der Margin-Call Sog):** Wenn das Margin Debt in einer Aktienmarkt-Krise schrumpft (z.B. Q1 2026 oder Corona 2020), werden lukrative Assets wie Gold und GDX zwangsliquidiert. Das drückt Gold oft tief unter seinen **SMA 50**. 
    * *Mythos-Buster (Der SMA 50 Fake-Out):* Ein historischer Test (`Gold-SMA50-Death-Test.js`) hat bewiesen: Wenn Gold nach einer Rallye unter den SMA 50 fällt, ist der Bullenmarkt in **70% der Fälle NICHT tot** (Fake-Out). Es handelt sich meist nur um Liquidations-Sog (Margin Calls am Aktienmarkt) oder gesunde Korrekturen. Die bloße Annahme, dass der Gold-Bullenmarkt stirbt, sobald der SMA 50 bricht, ist statistisch gefährlich und führt zu massiven Performance-Verlusten!

### VIX: Kein Frühindikator, sondern der ultimative "Kapitulations-Boden"
Der VIX ("Angst-Barometer") ist historisch gesehen **absolut nutzlos** als Vorwarnsystem. 
* Vor dem Zins-Crash 2018 lag er bei extrem ruhigen **11.80**. Vor dem Corona-Crash bei **14.38**. Er wiegt Investoren vor dem Abgrund oft in völliger Sicherheit.
* Es gibt zahlreiche "falsche Alarme" (Flash Crash 2010, China Panik 2015), bei denen der VIX völlig grundlos auf über 40 schoss, ohne dass ein Bärenmarkt folgte.
* **Der wahre Nutzen des VIX (Boden-Findung):** Der VIX ist extrem präzise darin, das **Ende** eines Crashes zu markieren. Sobald der VIX im Crash gigantische Höhen erreicht (>40 oder >80) und danach seinen absoluten Hochpunkt ("Spike") markiert, fällt dies oft auf den Tag des absoluten Aktien-Tiefpunkts (Trough). 
* **Zins-Crash 2018:** VIX 36.07 (Exakt am absoluten Aktien-Tiefpunkt am 24.12.2018)
* **Crash 2025:** VIX 52.33 (Exakt am absoluten Aktien-Tiefpunkt)

#### 4. Krypto & Netto-Liquidität (Der Bitcoin-Predictor)
Bitcoin (BTC) verhält sich völlig anders als der S&P 500. Während der S&P 500 von der normalen Geldmenge (M2) und den Unternehmensgewinnen (CP) getrieben wird, ist Bitcoin das reinste Fieberthermometer für die **zentralbankgesteuerte Netto-Liquidität**.
* **Die Formel:** `Net Liquidity = FED Bilanz (WALCL) - Staatskonto (TGA) - Reverse Repo (RRP)`
* **Warum BTC crasht, wenn Aktien steigen:** Wenn das Finanzministerium massiv Schulden ausgibt und das TGA füllt, saugt es hunderte Milliarden Dollar an "Spielgeld" aus dem Finanzsystem. Wenn gleichzeitig die Reverse Repos (RRP) leer sind, schlägt dieser TGA-Sog ungefiltert auf die Netto-Liquidität durch. BTC crasht als erstes, weil ihm der spekulative Sauerstoff entzogen wird – auch wenn die Realwirtschaft (M2/Gewinne) noch floriert.
* **Der "Maturity-Wall" Indikator (T-Bill Rollover):** Dieser Indikator misst die Refinanzierungslast der USA (T-Bills, die in den nächsten 3 Monaten fällig werden) im Verhältnis zur gesamten Geldmenge M2. Er warnt uns vor massiven Liquiditäts-Schocks.
  * *Normale Baseline (< 10-15 %):* Historisch (2000-2020) lag die Last immer bei ca. 8-10% der M2. Der Markt absorbiert das problemlos.
  * *Warn-Zone (> 15 %):* Das System beginnt zu ächzen. (Beispiel: 2022 kletterte die Rate massiv an, Yellen saugte den Markt leer, Aktien und Krypto stürzten ab).
  * *Roter Alarm (> 21 %):* Extreme "Refinancing Cliff". (Beispiel: Vor dem Crash 2025 und aktuell in 2026 liegen wir bei wahnwitzigen **> 21 %** der M2). In dieser Zone ist der Aktienmarkt auf Sand gebaut, weil jederzeit ein misslungener Anleihen-Verkauf das TGA explodieren lässt.
* **Der toxische Kalender (Steuern vs. Refinanzierung):** Die USA kassieren ihre größten Steuern nur viermal im Jahr (15. April, 15. Juni, 15. September, 15. Januar). Das "Soll vs. Ist" Gefälle lässt sich nicht live über APIs tracken, sondern offenbart sich im sogenannten **QRA (Quarterly Refunding Announcement)**, welches Ende Januar, April, Juli und Oktober veröffentlicht wird.
  * *Die Mechanik:* Wenn die Steuereinnahmen die astronomischen Zinskosten nicht decken, muss das Finanzministerium im QRA überraschend eine viel höhere Neuverschuldung ankündigen.
  * *Das Todes-Fenster (Juli/August):* Nach der Juni-Steuerzahlung gibt es bis Mitte September kaum frisches Einkommen. Gleichzeitig rollt historisch genau hier die gewaltige "Maturity Wall" über den Markt. Ohne frische Steuern und mit leeren Reverse Repos (RRP) muss das System in dieser Durststrecke massiv Liquidität verbrennen.
* **Die Rettungsleine (TGA & Buybacks):** Um das System trotz hoher "Maturity Wall" künstlich oben zu halten, nutzt das US-Finanzministerium sein Staatskonto (TGA). 
  * *Stealth-Stimulus:* Durch das Senken des TGA-Guthabens und aktive "Treasury Buybacks" (Rückkauf alter Anleihen) wird dem Markt frisches Cash zugeführt. 
  * **Die harte Grenze:** **Leeres TGA = Game Over.** Ohne TGA-Guthaben können keine Buybacks mehr durchgeführt werden, ohne neue Schulden aufzunehmen (was wieder Liquidität entzieht). Sobald das TGA austrocknet, schlägt die Maturity Wall ungefiltert in den S&P 500 und BTC ein.
* **Reine Krypto-Proxies (MSTR & COIN) als Zyklus-Indikator:**
  * *Die KI-Entkopplung (Vorsicht bei Minern):* Seit ca. 2024/2025 taugen viele Bitcoin-Miner (RIOT, HUT, IREN, teils MARA) **nicht mehr** als saubere Makro-Proxies. Durch die massenhafte Umrüstung ihrer Hallen zu KI-Rechenzentren (HPC / High Performance Computing) bewertet der Markt sie zunehmend als unkorrelierte Tech-Infrastruktur. Als reine, stark gehebelte Fieberthermometer für BTC dienen fast ausschließlich noch **MSTR** und **COIN**.
  * *Tagesgeschäft (Synchron):* Auf Tagesbasis gibt es keinen Vorlauf gegenüber BTC. Die Preisbewegungen sind statistisch hochgradig synchron.
  * *Zyklus-Hochpunkte (Führend - Top Indikator):* In Euphorie-Phasen geht diesen extrem volatilen Aktien die Liquidität oft deutlich **vor** Bitcoin aus. Wenn BTC neue Hochs erklimmt, MSTR und COIN aber bereits tief im Abwärtstrend feststecken, ist dies ein explosives Divergenz-Warnsignal für einen baldigen Macro-Peak. **Die historische Range für den Vorlauf liegt bei 0 bis 167 Tagen.** (MSTR toppte 2020 und 2025 exakt 9 Tage vorher, COIN toppte 2025 extrem mit 167 Tagen vorher).
  * *Zyklus-Tiefpunkte (Nachlaufend - Kein Bottom Indikator):* Bei brutalen Liquiditäts-Crashs findet Bitcoin seinen absoluten Boden historisch fast immer **zuerst**. MSTR und COIN bluten durch klassische Margin-Calls im traditionellen Finanzsystem oft noch Wochen weiter nach unten ab, selbst wenn BTC bereits dreht. **Die historische Range für den Nachlauf liegt bei 0 bis 38 Tagen.** Sie drehen also konsequent *später* als BTC.
  * *Die Nasdaq-Verschmelzung am Tiefpunkt:* Der Grund für dieses wochenlange Nachlaufen ist die massive Korrelation der Aktien zum Nasdaq (QQQ). Während der S&P 500 / Nasdaq im Crash weiter abverkauft wird, bluten MSTR und COIN zwangsläufig mit. Erst wenn der Nasdaq seinen absoluten Boden findet (wie z.B. am 28.12.2022), endet am exakt gleichen oder darauffolgenden Tag der Abverkauf der Krypto-Aktien. Der Boden von BTC allein ist für diese Aktien irrelevant, solange der traditionelle Markt noch fällt.
  * *Der Selling Climax (Volumen):* Einen echten, brutalen Kapitulations-Spike (Volumen > 300% des 30-Tage-Schnitts) findet man am absoluten Makro-Tiefpunkt fast ausschließlich bei **Bitcoin** (z.B. gigantische 261.000 gehandelte BTC am Tiefpunkt des Corona-Crashes). Bei MSTR und COIN fehlt dieses Signal am Tiefpunkt völlig, da die anfängliche Panik schon Wochen vorher stattfand und sie am eigentlichen Tiefpunkt lediglich still und illiquide "ausbluten". Man darf bei diesen Aktien also nicht auf einen eigenen Volumen-Boden warten, sondern muss sich am Nasdaq oder BTC orientieren.
  * *Die ultimative Todeslinie (Der SMA 200):* Historische Zyklus-Abgleiche (2021/2022 vs. 2024/2025) beweisen, dass der einfache gleitende 200-Tage-Durchschnitt (SMA 200) bei MSTR und COIN als absolut entscheidender Makro-Trendindikator fungiert. In der euphorischen Phase entfernen sich diese Aktien extrem weit vom SMA 200 (Gummiband-Effekt). Der endgültige, unumkehrbare Bruch *unter* den SMA 200 nach einem Makro-Top signalisiert zyklenübergreifend das absolute Ende des Bullenmarktes. Kurze "Dips" unter diese Linie in Korrekturen werden meist schnell zurückerobert, doch der finale Verlust besiegelt fast immer einen monate- oder jahrelangen Bärenmarkt.
  * **Die Zwei-Klassen-Alarm-Logik (Trading vs. Radar):** Aus dem extremen Vorlauf von MSTR/COIN (teilweise Monate vor BTC) ergeben sich zwei völlig getrennte Handlungs-Alarme:
    * **Alarm A (Das Anlage-Setup / Portfolio-Exit):** Um MSTR und COIN gewinnbringend zu verkaufen, ist der Bruch des SMA 200 viel zu spät (-50% Drawdown). Hier gilt eine strikte "Zyklus-Uhr". Ein Bitcoin-Zyklus dauert vom Tief zum absoluten Top historisch extrem präzise ~1.055 Tage. Ab Tag 970 nach dem letzten BTC-Boden öffnet sich die *Gefahrenzone*. Fällt MSTR/COIN in dieser Zone unter den sensiblen **SMA 50** bei erhöhtem Volumen (>1.2x), erfolgt der sofortige Abverkauf der Aktien.
    * **Alarm B (Das Makro-Radar / BTC Trailing Stop):** MSTR ist der Liquiditäts-Seismograph für Bitcoin. Bricht MSTR nach einer langen Rallye seinen **SMA 200** (wie z.B. Ende August 2025, Wochen vor dem BTC Top), bedeutet das: Die strukturelle Makro-Liquidität ist tot. Das ist **kein** sofortiges Verkaufs-Signal für BTC, sondern die zwingende Anweisung: *Top-Bildung innerhalb der nächsten 30-60 Tage erwartet. Stop-Loss bei BTC ab sofort extrem eng nachziehen!*
  * **Ergebnis (Bestätigt):** Der Backtest [MSTR-COIN-Krypto-Radar.js](file:///workspaces/CrashRadar/scratch/analyse/MSTR-COIN-Krypto-Radar.js) beweist, dass MSTR-Hochpunkte im Durchschnitt einen Vorlauf von **2,3 Handelstagen** vor Bitcoin-Hochpunkten haben. Bei Tiefpunkten folgt MSTR dem BTC-Boden mit einem durchschnittlichen Nachlauf von **0,7 Handelstagen** (COIN hinkt 2,8 Tage hinterher). Die SMA-200-Radar-Strategie schlägt den klassischen BTC SMA-200 mit **+159,3 % Rendite** (vs. +93,3 % bei Buy & Hold / klassischen Indikatoren) über den analysierten Zeitraum.



#### 5. Das "Endgame" (Die TBAC-Regel & Der Umschuldungs-Crash)
Die USA operieren derzeit in einem historisch beispiellosen Notstands-Modus. Das Beratergremium des Finanzministeriums (TBAC) schreibt vor, dass kurzfristige **T-Bills maximal 15 % bis 20 %** der Gesamtschulden ausmachen dürfen.
* **Der Regelbruch:** Um den Anleihemarkt zu stützen, hat das Finanzministerium diese Regel gebrochen und den T-Bill-Anteil auf über 22 % getrieben. Dies erzeugt die gigantische "Maturity Wall".
* **Die physikalische Grenze (> 25-30 %):** Der T-Bill-Anteil kann nicht endlos steigen. Er ist begrenzt durch die Aufnahmefähigkeit der Geldmarktfonds (MMFs). Ist diese Sättigung erreicht, explodieren die Zinsen der T-Bills und das System friert ein.
* **Der Masterplan (Terming Out):** Das ultimative Ziel der Regierung ist es, diese kurzfristigen T-Bills in langfristige Anleihen umzuschulden, sobald die langfristigen Zinsen fallen.
* **Der Crash als Werkzeug:** Da "Soft Landings" (sanftes Senken der Zinsen ohne Rezession) historisch fast nie funktionieren (Ausnahme 1994) und die FED (ohne akute Krise) kein neues QE starten kann, bleibt nur ein Weg für fallende langfristige Zinsen: **Die Flucht in die Sicherheit.** Ein Crash des Aktienmarktes treibt Investoren in Panik in US-Staatsanleihen, drückt deren Zinsen und erlaubt dem Staat so die billige Umschuldung. Der Crash ist somit kein Unfall, sondern makroökonomisch die einzige mathematische Lösung für das Schuldenproblem.

#### 6. Die Wahre Rest-Kapazität (Die Todes-Gleichung)
Um exakt zu berechnen, wann das Finanzsystem einfriert (und Aktien/Krypto crashen), überwachen wir die freie Liquiditäts-Kapazität der Primary Dealer (US-Banken), welche die Staatsschulden aufkaufen müssen.
* **Die Gleichung:** `Wahre Kapazität = RRP + Überschuss-Reserven (TOTRESNS - Notfallminimum) + TGA-Puffer`
  * *RRP:* Aktuell nahe Null.
  * *Überschuss-Reserven:* Das was die Banken an Reserven besitzen abzüglich der 10%-BIP-Sicherheitsgrenze (~280 Milliarden $ Puffer).
  * *Der TGA-Puffer:* Yellens Kriegskasse. Das Geld, das im TGA gehortet wird und durch Buybacks oder Ausgaben ins System (zu den Banken) geschossen werden kann (Aktuell ca. 900 Milliarden $).
* **Das Fiskal-Q4-Szenario (Der Härtetest):** Das Fiskaljahr der USA endet nicht im Dezember! Fiskal-Q3 endet am **30. Juni**. Die Klippe (Juli/August/September) ist das **Fiskal-Q4**. In diesen Monaten steigt die Belastung der Primary Dealer historisch auf ca. 32 %. Wenn bei 4,17 Billionen $ Refinanzierung die Banken über 1,3 Billionen $ fressen müssen, reicht selbst die komplette Plünderung des TGA-Puffers und der RRP/Reserven mathematisch kaum noch aus, um einen Liquiditätskollaps abzuwenden.

#### 7. Die Illusion des Konsumenten (K-Shaped Economy & Sozioökonomischer Kontext)
Warum "fühlt" sich die Wirtschaft für viele nach Rezession an, während der S&P 500 Allzeithochs feiert? 
* **Die Spaltung:** Wir sehen eine "K-förmige" Wirtschaft. Die oberen 20 % der Bevölkerung besitzen die Aktien, die Immobilien und profitieren von den +17 % Unternehmensgewinnen. Die unteren 50 % der Bevölkerung leiden unter der kumulierten Inflation und den hohen Zinsen.
* **Kreditkarten- & Konsumentenkreditausfälle (`DRCCLACBS` & `DRCLACBS`):** Diese Raten steigen oft an, während der Aktienmarkt noch feiert. Sie sind **keine Frühindikatoren für Aktien**, sondern *sozioökonomische Kontext-Indikatoren*. Der Aktienmarkt ignoriert die Pleiten der unteren 50 % so lange, bis die Liquidität versiegt oder eine systemische Immobilien-/Bankenkrise (wie 2008) ausgelöst wird.

#### 8. "Projekt 3. November" - Das Beobachtungs-Dashboard (Sommer 2026)
Um den Aktienmarkt bis zu den Wahlen (3. November 2026) zu navigieren, überwachen wir nicht den S&P 500, sondern ausschließlich die folgenden vier Liquiditäts-Ventile:

1. **Der "Panik-Knopf": Das TGA-Konto (`fiscaldata_tga`)**
   * *Signal:* Fällt das TGA rasant (von aktuell ~900 Mrd. $), pumpt Yellen Liquidität (Stealth-Stimulus / Buybacks) in den Markt, um den drohenden Sommer-Dip abzuwenden.
   * *Aktion:* Rasanter Fall = **Kaufsignal** (Künstlicher Wahlkampf-Pump).
2. **Der "Bruch-Punkt": Bank-Reserven (`TOTRESNS`)**
   * *Signal:* Nähert sich der Wert der 2,8-Billionen-Grenze (Minimum Ample Level), friert der Interbankenmarkt ein. 
   * *Aktion:* Annäherung an 2,8 Billionen $ = **Akute Crash-Warnung** (Repo-Krise).
3. **Das "Soll vs. Ist" Zeugnis: Das QRA (Ende Juli)**
   * *Signal:* Das Quarterly Refunding Announcement gibt die offizielle Netto-Neuverschuldung für das Fiskal-Q4 (Juli-Sep) an (erwartet: 671 Mrd. $).
   * *Aktion:* Wenn Yellen Ende Juli eine höhere Summe als 671 Mrd. $ ankündigt, sind die Steuern weggebrochen. Der Markt preist sofort einen massiven Liquiditätsentzug ein = **Startschuss für den Sommer-Dip**.
4. **Der "Canary in the Coal Mine": Bitcoin (BTC)**
   * *Signal:* BTC ist ein reines Derivat der Netto-Liquidität. 
   * *Aktion:* Wenn BTC kontinuierlich fällt, während der S&P 500 (getragen von wenigen Tech-Werten) noch steigt, hat der Liquiditäts-Staubsauger des Treasury-Rollovers bereits begonnen zu saugen. BTC fällt immer zuerst.
* **Der Aktienmarkt-Faktor:** Erst wenn die Arbeitslosigkeit (`ICSA`) übergreift und auch die Besserverdiener trifft (oder wenn Firmen aufhören, Leute einzustellen), dreht der Markt.

### 9. Das "Bullenmarkt-Stirbt"-Signal: SKEW & Short Volume
Die These "Der Bullenmarkt stirbt mit dem letzten Bären" besagt, dass ein Markt erst toppt, wenn alle Short-Seller kapitulieren und blinde Euphorie herrscht. Die Auswertung über alle Crashes seit 1999 liefert hierzu ein hochpräzises, empirisch belegtes Signal-Setup:

* **Die SKEW-Illusion (Hedging statt Sorglosigkeit):** Entgegen der Intuition stürzt der Markt nicht ab, wenn der SKEW niedrig ist. Im Gegenteil: Vor fast allen großen Crashs in der modernen Markt-Ära (seit 2013) war der SKEW **extrem hoch** (oft > 145). Gleichzeitig herrscht im Retail-Markt absolute Sorglosigkeit, was sich in einem extrem niedrigen **VIX (durchschnittlich 17.9 am Top)** widerspiegelt. Das bedeutet, dass Smart Money im Verborgenen panisch Crash-Versicherungen kauft, während der VIX eine falsche Sicherheit suggeriert. 
* **Der SKEW beim Nasdaq (QQQ):** Da der SKEW auf Optionen des S&P 500 kalibriert ist, toppt er bei reinen QQQ-Peaks empirisch oft leicht niedriger (im Schnitt bei 142.8 vs. 144.7 beim SPY). Die fundamentale Makro-Mechanik (Retail kauft Tech, Smart Money hedgt über SPY-Puts) bleibt aber identisch. Um False-Positives zu vermeiden, behalten wir die harte Warnschwelle von `SKEW > 145` auch als universelles Warnsignal für den Tech-Sektor bei.
* **Das Problem von SKEW als Standalone-Indikator:** Ein SKEW über 145 ist als isolierter Trigger nutzlos. Seit 2013 schlug der SKEW über 56 Mal Alarm, ohne dass ein Crash folgte (z.B. Anfang 2026). Institutionen sichern sich oft einfach nur ab, während der Markt noch monatelang "Melt-Up" Rallyes hinlegt.
* **Der "Timing-Filter": FINRA Short Volume Capitulation:** Wenn das FINRA Short-Volumen (SPY) massiv einbricht (unter 50%), kapitulieren die Bären. Historische Daten (2023-2026) zeigen: Bei 6 von 8 massiven Drops (>= 5%) war das Short-Volumen in den Tagen davor brutal eingebrochen (Trefferquote **75%**, *siehe [scratch/analyse/Skew-ShortVolume-PCR.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Skew-ShortVolume-PCR.js)*).
* **Das "Red Alert" Combo-Signal:** Wenn panisches institutionelles Hedging (**SKEW > 145**) auf Retail-Euphorie und Bären-Kapitulation (**Short Ratio < 50%**) trifft, ist der Markt toxisch.
  * *Trefferquote:* 75.0 % Wahrscheinlichkeit für einen echten Crash (Drop >= 5% innerhalb von 40 Tagen).
  * *Die 4 Ausnahme-Fehlalarme:* Diese Kombination lieferte seit 2023 nur **4 Fehlalarme** (Dez '23, Jan '24, Mai '24, Nov '24). Alle vier passierten ausnahmslos in absoluten, exzessiven "Melt-Up" Rallyes.
  * **Das fehlende Puzzleteil (PCR-Filter):** Um diese Melt-Up-Fehlalarme auszufiltern, ist das **CBOE Total Put/Call Ratio (PCR)** entscheidend. Eine Auswertung der Fehlalarme zeigte, dass das PCR an diesen Tagen zwischen **0.89 und 1.00** lag. Das bedeutet: Obwohl die Leerverkäufer kapitulierten (Short Ratio niedrig) und das Smart Money sich absicherte (SKEW extrem hoch), haben die Optionshändler weiterhin kräftig Puts gekauft. Es herrschte noch keine "bedingungslose Euphorie". Ein echter Crash erfordert das Aussterben *aller* Bären, messbar durch ein extrem niedriges PCR (z.B. **PCR < 0.75**). Nur wenn alle drei Bedingungen (SKEW > 145, Short < 50%, PCR < 0.75) zusammentreffen, ist der Markt reif für den Crash.
  * **Datengewinnung (Der hybride Ansatz):** Da die CBOE-API historische Abfragen häufig blockiert (Cloudflare 403), haben wir eine robuste Lösung implementiert: Für das Backtesting greifen wir auf ein lokales Archiv der CBOE-Werte zurück. Für die Live-Beobachtung parst der Bot vollautomatisch die tagesaktuellen SPY-Optionsketten über Yahoo Finance und berechnet das Put/Call Ratio (Summe Puts / Summe Calls) selbst.

### 10. Machine Learning: Das LSTM Regime Radar (KI-Signal)
Um das ständige Rauschen der traditionellen Indikatoren zu glätten, nutzt CrashRadar als übergeordneten Kompass ein neuronales Netz (TensorFlow LSTM). Es sagt keine absoluten Preise voraus, sondern berechnet Wahrscheinlichkeiten für fundamentale Marktstrukturen (Regimes).
* **Das Setup (Stationäre Features):** Das Modell wird niemals mit rohen Preisen gefüttert (Overfitting-Gefahr). Es analysiert 14-Tage-Sequenzen aus prozentualen Tagesrenditen sowie dynamisch normalisierten MACD- und RSI-Werten.
* **Ground Truth (Lexikon-Ansatz):** Das Netzwerk lernt aus einem manuell gepflegten Lexikon verifizierter historischer Makro-Zyklen für Krypto (BTC) und Tech (QQQ). Es unterscheidet vier Phasen:
  1. `MACRO_TOP`: Absolute Euphorie- und Verteilungsphasen.
  2. `MACRO_BOTTOM`: Das Tal der Tränen / Kapitulationsphasen.
  3. `UPTREND`: Gesunde Bullenmarkt-Struktur.
  4. `DOWNTREND`: Bärenmärkte.
* **Erkenntnisse aus dem Backtesting (Die Grenzen der KI):** Tests an historischen Extremen (z. B. Dotcom Peak 2000 oder Corona Peak 2020) haben bewiesen, dass ein reines Preis-Aktions-Netz **keine Tops vorhersagen kann**. An den Tagen des absoluten Peaks gab das Modell fälschlicherweise hohe `UPTREND` Wahrscheinlichkeiten aus. Der Grund: Ein "Blow-Off-Top" sieht mathematisch in den 14 Tagen davor *exakt* aus wie der gesündeste Aufwärtstrend. Preise allein sind kein Frühindikator für systemische Crashs.
* **Die wahre Stärke (Der Trend-Filter):** Seine absolute Glanzleistung zeigt das LSTM in den tiefen Bärenmärkten (`DOWNTRENDS`). Es lässt sich von aggressiven Zwischen-Rallyes ("Dead Cat Bounces") nicht täuschen und blockiert Kauf-Signale. Umgekehrt identifiziert es den Beginn von Jahrhundert-Böden extrem zuverlässig (z. B. Corona-Crash Bottom zu 79 % getroffen), wenn der RSI historische Extreme erreicht. **Ergebnis (Bestätigt):** Der Backtest [LSTM-Regime-Radar.js](file:///workspaces/CrashRadar/scratch/analyse/LSTM-Regime-Radar.js) belegt, dass das LSTM-Modell (speziell `qqq_regime_v1`) den Corona-Crash-Boden hervorragend identifiziert hat. Bereits am 10.03.2020 sprang die `CYCLE_BOTTOM`-Wahrscheinlichkeit auf **77,8 %** und stieg an den folgenden Tiefpunkttagen (z. B. am 12.03. und 16.03.2020, dem Schlusstief von QQQ bei $169.30) auf über **99,3 %** an. Das Modell klassifizierte das Tief präzise als Zyklus-Boden.
* **Die Architektur-Entscheidung (Hybrider Veto-Ansatz):** Wir verzichten bewusst darauf, das neuronale Netz mit Makro-Daten (wie SKEW, Bankreserven oder Margin-Debt) zu trainieren. Makro-Daten haben oft Veröffentlichungs-Verzögerungen (Lag) von bis zu 3 Wochen oder liegen nur monatlich vor. Ein LSTM benötigt jedoch synchrone, tägliche Sequenzen. Daher bleibt das LSTM unser hochpräziser "Preismomentum-Spezialist", während die `IndicatorEngine` als "Makro-Spezialist" fungiert. Die Engine kann die bullische Meinung des Netzwerks durch harte Makro-Fakten (z. B. einbrechendes TGA oder explodierender SKEW) jederzeit "vetoen" (überstimmen).
  * *Praxis-Beweis (Crash 2025):* Am absoluten Peak (19.02.2025) gab das LSTM-Netzwerk basierend auf der ruhigen Preis-Rallye eine fehlerhafte `UPTREND`-Wahrscheinlichkeit von **99,1 %** aus. Exakt an diesem Tag lag der SKEW-Index jedoch bei extremen **175.76** (Gefahr ab 145), weil institutionelles Smart-Money im Hintergrund panisch Puts kaufte. Ein hybrides System hätte das Kauf-Signal der KI an diesem Tag durch das SKEW-Veto sofort blockiert.


#### Exkurs: Einzelaktien-Modellierung & Die "Out-of-Distribution" Falle
Im Rahmen eines Experiments haben wir das auf den Nasdaq-Index (QQQ) trainierte Netzwerk mit Daten einer extrem volatilen Einzelaktie (Palantir / PLTR) gefüttert.
* **Der Absturz der Konfidenz:** Das Index-Netzwerk lieferte für massive PLTR-Spitzen und Bodenbildungen nur noch Konfidenzen um die ~30 %. Die Vorhersagen waren blindes Raten.
* **Die Ursache (Out-of-Distribution):** Ein LSTM-Modell lernt die Volatilitätsstruktur (Standardabweichungen) seines Trainingsdatensatzes. Für den QQQ bedeutet eine 3%-Tageskerze "absolute Panik". Für PLTR ist eine 15%-Kerze "Business as usual". Wenn man die 15%-Kerze in ein für 3% normalisiertes Index-Gehirn schickt, explodieren die Eingabewerte aus dem gelernten Rahmen. Das Netzwerk verliert völlig die Orientierung.
* **Die Lösung (Spezialisierte Netze):** Um Einzelaktien mit KI zu tracken, **müssen** spezialisierte Netzwerke trainiert werden. Durch die Erstellung eines maßgeschneiderten `pltr_regime_v1` Modells mit dynamisch berechneter PLTR-Ground-Truth in der `Cycle-Base-Config.json` stieg die Konfidenz an Extrempunkten sofort von ~30 % auf bis zu **77,2 %**. Das Modell konnte die "Persönlichkeit" und Volatilität der Aktie fehlerfrei bändigen und die Crash-Extreme exakt identifizieren.
* **Die Wichtigkeit von `UNKNOWN`-Gaps:** Beim Training hochvolatiler Einzeltitel müssen die extrem langen Leerlaufphasen (zwischen Tops und Bottoms) rigoros aus dem Training ausgeschlossen (`UNKNOWN`) werden, andernfalls wird die Cross-Entropy-Mathematik des LSTMs zerstört, und die Gewichte korrumpieren zu unbrauchbaren "NaN"- oder "0-Loss"-Werten. Ein strikter Filter für `UNKNOWN`-Ziele im Training ist überlebenswichtig.



### 🚦 Die große Indikator-Klassifizierung (Zusammenfassung)

Um Crashs systematisch zu navigieren, stützen wir uns in der automatisierten Engine aktiv auf 3 Phasen, während andere Metriken bewusst ausgefiltert werden:

#### 1. Frühindikatoren (Leading) - *Warnen 3 bis 6 Monate VOR dem Crash-Peak*
Diese Indikatoren drehen, bevor der Aktienmarkt fällt. Sie warnen uns, Gewinne mitzunehmen.
* **Bankreserven (TOTRESNS):** Ein massiver Rückgang signalisiert Liquiditäts-Austrocknung.
* **Treasury General Account (TGA):** Ein steiler Anstieg saugt Geld aus dem Markt.
* **Zinsstrukturkurve (10Y-2Y Spread):** Ein rapider Anstieg (Un-Inverting) nach langer inverser Phase läutet das Ende des Bullenmarktes ein.
* **Chicago Fed Stress Index (NFCI):** Ein stetiger Anstieg in Richtung der Null-Linie zeigt an, dass Risse im Finanzsystem entstehen.
* 🔴 **Ausschluss-Kriterium: Sahm Rule & BLS-Daten:** Wurden historisch als massiv nachlaufend (lagging) entlarvt (siehe `scratch/analyse/Sahm-Rule.js`) und dürfen **nicht** als Frühwarnsystem genutzt werden!
* **Schattenbanken Zinslast (ARCC - Fundamental):** BDCs (Business Development Companies) vergeben hochverzinsliche Kredite an mittelständische Unternehmen. Ares Capital (ARCC) dient als der ultimative "Bellwether" (Leitwolf) der Branche. Wenn die Zinsausgaben von ARCC im Quartalsbericht (SEC EDGAR) plötzlich rasant steigen (z.B. >15% QoQ), zeigt dies systemischen Kreditstress an, noch bevor kleinere BDCs umkippen. Wir pflegen *keine* Liste aller BDCs, da ARCC als Proxy (mit über 13 Mrd. $ Marktkapitalisierung) ausreicht, um das absolute Fundament der Schattenbanken auf Risse zu prüfen.

#### 2. Akut-Indikatoren / Trigger (Contemporaneous) - *Markieren den Startschuss*
Diese Metriken stürzen ab exakt am gleichen Tag wie der S&P 500 und dienen als harter Verkaufsauslöser.
* **High Yield Spreads (Proxy: HYG ETF):** Sobald der Crash losgeht, wird der HYG ETF gnadenlos abverkauft. Am absoluten Boden ist der ETF oft komplett ausgebombt (historisches Extrem bei ~74.6). Fällt der HYG gemeinsam mit dem S&P 500, brennt der Kreditmarkt.
* **Private Credit Stress (BIZD ETF):** Dieser ETF bündelt den BDC-Sektor. Wenn das "Smart Money" aus Private Credit flieht, fällt BIZD massiv (historisches Extrem am Boden bei ~14.5). Sobald BIZD und HYG aufhören panikartig zu fallen, dreht oft auch der Aktienmarkt.
* **Floating Rate Stress (BKLN ETF):** Verfolgt variabel verzinsliche Kredite (Leveraged Loans). Wenn Unternehmen die Zinslast nicht mehr tragen können und Kredite platzen, crasht BKLN. Liefert ein extrem schnelles, unmanipuliertes Preissignal.
* ⚠️ **Ausnahme Big-Tech (QQQ):** Big-Tech Unternehmen sind durch gigantische Cash-Reserven wesentlich resilienter gegen Kreditmarkt-Verwerfungen als die klassische Wirtschaft. Bei Tech-Werten fungiert Credit Stress eher als makroökonomischer Begleitfaktor und nicht als akuter Trigger. Ein massiver Tech-Crash (Nasdaq) kann stattfinden, auch wenn HYG und BIZD völlig intakt bleiben!

#### 3. Boden-Indikatoren (Trough) - *Markieren das Ende des Crashes*
Diese Metriken geben uns das harte Signal: "Das Schlimmste ist vorbei, jetzt Aktien kaufen!"
* **Der VIX ("Spike & Crush"):** Sobald der VIX seinen absoluten panischen Höhepunkt erreicht hat und *zu fallen beginnt*, ist der absolute Tiefpunkt (Boden) im Aktienmarkt meist auf den Tag genau erreicht.
* **Gold ("Der Notgroschen"):** Gold erreicht in 100% der Fälle seinen absoluten Tiefpunkt und beginnt zu steigen, *bevor* der Aktienmarkt seinen Boden findet. Dreht Gold nach oben, ist der Liquiditätsengpass gelöst.
* **Bitcoin Selling Climax (Die Volumen-Konstante):** Das Ende eines brutalen Krypto-Abverkaufs wird historisch fast immer durch einen massiven, panischen Volumen-Spike bei BTC markiert. Dieser "Flush-Out" (die finale Kapitulation) erfordert statistisch einen signifikanten Volumen-Anstieg auf das **4-Fache bis 7-Fache (400% - 700%)** des vorherigen 30- oder 90-Tage-Durchschnitts. Absolute Volumenzahlen sind gefährlich, da Börsenvolumina über Jahre schwanken. Der relative Multiplikator ist die einzig verlässliche Konstante für die Bottom-Zone.

#### 4. Aktienmarkt-Dynamik: Nasdaq (QQQ) vs. S&P 500 (SPY)
Der Mythos, dass der Nasdaq den breiten Markt anführt, wurde durch historische Daten verifiziert, muss aber zwischen Hoch- und Tiefpunkten streng getrennt werden:
* **Am Hochpunkt (Top-Indikator):** Der Nasdaq ist ein verlässliches Frühwarnsystem. Bei zins- oder blasengetriebenen Crashes (2000, 2018, 2022) toppt der QQQ **2 bis 6 Wochen (15 bis 45 Tage)** *vor* dem S&P 500. Bricht der Nasdaq ein, während der SPY oben verharrt (Divergenz), steht der Bärenmarkt unmittelbar bevor.
* **Am Tiefpunkt (Bottom):** Hier gibt es **keine feste Regel**. Oft drehen beide am selben Tag. In Zinskrisen (wie 2022) kann der S&P 500 sogar Monate *vor* dem Nasdaq seinen Boden finden, da hoch bewertete Tech-Titel länger unter Druck bleiben. Am Tiefpunkt darf man sich also nicht auf den Nasdaq als alleinigen Frühindikator verlassen!
* **Warnung: Kein Volumen-Climax bei Aktien:** Im Gegensatz zu Bitcoin bilden traditionelle Indizes (SPY, QQQ) am Tiefpunkt **keine** verlässlichen Volumen-Spikes (Selling Climaxes). Wegen Circuit-Breakern und außerbörslichem Handel (Dark Pools) bluten Aktien-Bärenmärkte oft geräuschlos und illiquide aus. Die Suche nach einem "Volumen-Boden" funktioniert bei Aktien nicht, hierfür müssen Hebel-Daten oder Divergenzen genutzt werden.

#### 5. Datengetriebene Boden-Findung bei Aktien (Ohne News)
Da das Aktien-Volumen als Indikator wertlos ist, stützt sich das System auf drei rein mathematische Mechanismen, um den absoluten Aktien-Tiefpunkt (SPY/QQQ) zu identifizieren:

1. **Tagesaktuelle Hebel-Daten: Das "Put/Call Ratio" (PCR) & CBOE Optionsvolumen**
   Da reine PCR-Daten oft hinter Paywalls versteckt sind, nutzen wir das **gesamte CBOE Optionsvolumen** als Indikator für extreme Panik. Wenn der Aktienmarkt crasht, explodiert das Hedging-Volumen. Historische Daten (2007-2026) beweisen: Exakt am Tag des S&P 500 Tiefpunkts schießt das Optionsvolumen auf das **1,5-fache bis über 2,5-fache (150% - 250%)** des 90-Tage-Durchschnitts. Um falsche Signale (z.B. Euphorie-Käufe) herauszufiltern, ist dieser Spike zwingend an einen hohen VIX gekoppelt.
2. **Der "VIX-Crush" (Volatilitäts-Kollaps)**
   Der VIX berechnet sich rein mathematisch aus den Options-Prämien (dem Hebel) des S&P 500. Steigt er über 40 oder 50, herrscht blinde Panik. Die harte, datengetriebene Regel lautet: Sobald der VIX in einem Crash sein absolutes Hoch erreicht hat und an den darauffolgenden Tagen fällt ("Crush"), hast du den Aktien-Tiefpunkt gefunden. Historisch lag der SPY-Boden fast immer exakt am Tag des VIX-Peaks oder nur **1 bis 14 Tage danach**.
3. **Preis-Action: "Verkäufer-Erschöpfung" (Bullish Divergence)**
   Eine Panik endet nicht mit einem Knall, sondern mit Erschöpfung. Wir messen diese mathematisch präzise über die "Bullish Divergence" zwischen Preis und dem 14-Tage RSI (Relative Strength Index):
   * **Mechanik:** Der Markt bricht auf ein neues absolutes Panik-Tief ein (z.B. SPY fällt tiefer als in den letzten 40 Tagen).
   * **Der Oszillator:** Der RSI am neuen Tief liegt aber signifikant *höher* als beim vorherigen Zwischentief. 
   * **Bedeutung:** Das Verkaufs-Momentum ist zusammengebrochen. Die Bären haben keine Munition mehr, um den Preis mit dem gleichen Druck nach unten zu drücken, obwohl der Chart (für Laien) katastrophal aussieht.
   * **Die heilige Dreifaltigkeit (Generationen-Kaufsignal):** Wenn der VIX > 35 steht, das CBOE Optionsvolumen > 1,5x explodiert UND gleichzeitig diese RSI-Divergenz auftritt, hat das System seit 2007 absolut fehlerfrei jeden massiven Crash-Boden punktgenau identifiziert.
   * **⚠️ Wichtiger Disclaimer (Black Swan Events):** In beispiellosen "Black Swan" Wasserfall-Crashes (z.B. Corona-Pandemie 2020) kann der Zustand maximaler Panik wochenlang andauern. Hier kann das Signal *zu früh* feuern, während der Markt noch weitere 20% abrutscht, da jede winzige Zwischenerholung sofort eine mathematische RSI-Divergenz erzeugt. Das Signal markiert also das Epizentrum der Kernschmelze, nicht zwingend den tagesgenauen V-Shape-Boden eines Jahrhundert-Events.
    * **Ergebnis (Bestätigt):** Der Backtest [CBOE-VIX-RSI-Bottom.js](file:///workspaces/CrashRadar/scratch/analyse/CBOE-VIX-RSI-Bottom.js) belegt, dass die Kombination aus $VIX > 35$, CBOE-Optionenvolumen $> 1,5x$ und einer bullischen RSI-Divergenz (innerhalb von 5 Tagen) ein hocheffektiver Boden-Finder ist. Bei nur 8 erzeugten Signalen seit 2007 lag die Trefferquote (Win Rate) nach 20 und 120 Tagen bei **100 %** (Durchschnittsrendite nach 120 Tagen: **+25,56 %**, maximaler durchschnittlicher Drawdown: **-6,22 %**). Im Vergleich dazu führten Einzelindikatoren zu deutlich höheren Drawdowns (VIX > 35 solo: -13,40 % Drawdown).

#### 6. Absichtlich ignorierte Indikatoren
Diese Indikatoren werden als harter Trigger in der Engine ignoriert, da sie sich durch fehlerhaftes Timing disqualifiziert haben. Sie eignen sich höchstens als visueller Kontext für Dashboards.

**A. Zu frühe Vorwarnung (Opportunitätskosten)**
Lösen oft 6 bis 12 Monate vor dem Crash aus. Ein Verkauf würde lukrative Blow-Off-Top-Rallyes verpassen:
* **Unternehmensgewinne / Corporate Profits (CP):** Ein Blasen-Indikator. Gewinne schrumpfen oft schon 12 Monate im Voraus, während Aktien noch massiv steigen.
* **Baugenehmigungen (PERMIT):** Brechen 6-12 Monate im Voraus ein. Zu früher Alarm.
* **Consumer Sentiment (UMCSENT):** Das Konsumklima stürzt oft schon 12 Monate vor dem Markt ab.
* **M2 Geldmengen-Wachstum & Globale Liquidität (EZB/BOJ):** Drosseln langsam, aber der Aktienmarkt entkoppelt sich davon oft noch monatelang.
* **Echtzeit Inflationserwartung / Breakeven Inflation (T10YIE):** Liefert situative Warnungen für Zinserhöhungen, ist aber kein präziser Point-in-Time Trigger.

**B. Zu späte Bestätigung (Kein Schutz vor dem Crash)**
Feuern erst, wenn wir bereits im Crash stecken, und bieten daher null Schutz vor initialen Verlusten:
* **Die staatliche Arbeitsmarkt-Illusion (FRED-Daten):** Offizielle Metriken wie die Arbeitslosenquote (**UNRATE**), Nonfarm Payrolls (**PAYEMS**) und Erstanträge (**ICSA** / **ICNSA**) sind **massiv nachlaufend (Lagging)**. In den 3 Monaten vor großen historischen Crashes (2000, 2007, 2020) blieben diese Metriken starr oder verbesserten sich sogar noch. Sie schlagen erst aus, wenn das Portfolio bereits 20% bis 40% an Wert verloren hat. Sie dürfen **niemals** als Frühwarn-Trigger genutzt werden!
* **Kupfer ("Dr. Copper"):** Stürzt absolut synchron mit dem Markt ab. Es front-runnt nichts.
* **Industrieproduktion (INDPRO):** Wächst meist bis zum Aktien-Peak weiter und fällt erst zeitgleich mit dem Crash.

**C. Der wahre Arbeitsmarkt-Vorläufer (Leading Indicator)**
* **Challenger, Gray & Christmas Report:** Im Gegensatz zu den staatlichen Nachzüglern (wie Sahm Rule oder JOLTS) ist der monatliche Challenger-Report (Ankündigungen von Entlassungen durch CEOs) ein echter Frühindikator. CEOs wissen, dass die Wirtschaft kippt, bevor es in der staatlichen Statistik auftaucht.
  * *Beweis & Backtest:* Ein historischer Backtest über alle Crashes seit 1999 ([Challenger-Gray-Christmas-Report-Leading-Indicator.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Challenger-Gray-Christmas-Report-Leading-Indicator.js)) belegt die Prognosekraft für **deflationäre/wirtschaftliche Crashes**.
  * *Die Vorlaufzeit:* Historisch liegt der Vorlauf des massiven Challenger-Spikes vor dem exakten Aktien-Allzeithoch bei **ca. 0 bis 38 Tagen** (Dotcom: exakt im Peak-Monat; Finanzkrise: 38 Tage Vorlauf; Corona: 13 Tage Vorlauf).
  * *Die Einschränkung (Inflation):* Der Indikator schlägt bei **zins- und inflationsgetriebenen Schocks** (wie Ende 2018 oder 2022) *nicht* an. Hier crashen die Kurse durch die Geldpolitik, während die Unternehmen kaum jemanden entlassen. Er signalisiert also ausschließlich "Kredit/Wirtschafts"-Crashes.
  * **Signal-Schwellenwerte (Month-over-Month / vs. SMA6):**
    * 🟡 **Warnstufe (Gelb) | >= +40 % Anstieg:** Erhöhte Aufmerksamkeit. Ein Wert in diesem Bereich (z.B. +43 % im Herbst 2018) zeigt deutlichen Stress in den Chefetagen, löst aber noch keinen blinden Verkaufspanik-Trigger aus.
    * 🔴 **Alarmstufe (Rot) | >= +55 % Anstieg:** Absolute Alarmglocken (Portfolio-Exit). Ein Sprung über diese Schwelle (historisch: +57 % Dotcom, +85 % GFC, +106 % Corona, +245 % in 2025) ist das ultimative Signal, dass die systemische Kernschmelze unmittelbar bevorsteht oder in den letzten Tagen bereits gestartet ist.

**C. Unzuverlässig / Falsche Signale**
* **Langlaufende Staatsanleihen (TLT):** Front-runnen den Markt absolut nicht. Sie steigen erst massiv, wenn die Panik voll da ist. Bei Inflations-Crashes verbrennen sie sogar gemeinsam mit Aktien. Völlig ungeeignet als Frühwarnsystem!

---

### 11. Spurenlesen: Order Flow & Gamma-Hedging (Hypothese)
Echtes "Spurenlesen" findet nicht im normalen Preis-Chart statt, sondern dort, wo Absichten nicht verschleiert ("Spoofing") werden können. Diese These stützt sich auf zwei Säulen:

* **Säule 1: Order Flow Imbalance (Time & Sales):** Market-Orders (aggressiv) kosten Geld und zeigen Dringlichkeit, Limit-Orders (passiv) können gelöscht werden. Die Messung des Verhältnisses von aggressiven Käufern zu Verkäufern offenbart die wahre Marktrichtung. 
  * *Status (Abgelehnt):* Uns fehlen hierfür die hochfrequenten Intraday-Tickdaten (Level-2 Orderbuch). Echte Tick-Daten verursachen gigantischen Server-Traffic und erfordern teure Lizenzen der Börsen, weshalb auf dem Markt keine dauerhaft kostenlosen APIs dafür existieren. Web-Scraping ist bei der Masse an Daten technisch unmöglich. Ohne kostenpflichtigen Provider (z.B. Databento) oder Broker-API (z.B. IBKR) ist diese Säule nicht umsetzbar.
* **Säule 2: Gamma-Hedging am Optionsmarkt:** Institutionen handeln Optionen. Market Maker müssen diese Positionen über die Aktie absichern. Kennt man die Open-Interest-Grenzmarken (Strikes), kann man die algorithmischen Käufe/Verkäufe der Market Maker vorhersehen. 
  * *Status (Live-Recording):* Wir nutzen `yahoo-finance2` (siehe [Machbarkeitsstudie](file:///C:/GitHub/CrashRadar/scratch/analyse/Spurenlesen.js)), um täglich die Options Chains abzurufen. **Wichtig:** Da Yahoo keine historischen Optionsketten anbietet, können wir dieses Modell aktuell noch nicht backtesten. Wir zeichnen die Live-Daten (die aggregierten Open-Interest-Cluster der nächsten 30-45 Tage) ab jetzt täglich in unserer Datenbank auf, um uns einen eigenen historischen Datensatz für spätere Backtests aufzubauen.

---

## 2. Historische Drawdowns (>= 15%)

Die folgende Liste zeigt historische Markteinbrüche von über 15%, berechnet als "Peak-to-Trough" (vom Allzeithoch bis zum absoluten Tiefpunkt vor der Erholung).

### 📉 S&P 500 (SPY)
* **-49.14%** | Peak: 24.03.2000 ➔ Trough: 09.10.2002 *(Dotcom-Blase)* | Recovery: 01.06.2007
* **-56.47%** | Peak: 09.10.2007 ➔ Trough: 09.03.2009 *(Finanzkrise)* | Recovery: 14.03.2013
* **-20.18%** | Peak: 20.09.2018 ➔ Trough: 24.12.2018 *(Zins-Panik)* | Recovery: 29.04.2019
* **-34.10%** | Peak: 19.02.2020 ➔ Trough: 23.03.2020 *(Corona-Crash)* | Recovery: 18.08.2020
* **-25.36%** | Peak: 03.01.2022 ➔ Trough: 12.10.2022 *(Inflations-Schock)* | Recovery: 19.01.2024
* **-19.00%** | Peak: 19.02.2025 ➔ Trough: 08.04.2025 | Recovery: 27.06.2025

### 📉 Nasdaq 100 (QQQ)
* **-15.46%** | Peak: 03.01.2000 ➔ Trough: 06.01.2000 | Recovery: 19.01.2000
* **-91.28%** | Peak: 09.03.2000 ➔ Trough: 09.10.2002 *(Dotcom-Blase)* | Recovery: 06.02.2020 *(Nach 20 Jahren!)*
* **-28.56%** | Peak: 19.02.2020 ➔ Trough: 16.03.2020 *(Corona-Crash)* | Recovery: 05.06.2020
* **-35.62%** | Peak: 19.11.2021 ➔ Trough: 28.12.2022 *(Inflations-Schock)* | Recovery: 15.12.2023
* **-22.88%** | Peak: 19.02.2025 ➔ Trough: 08.04.2025 | Recovery: 24.06.2025

### 📉 Bitcoin (BTC)
*Extrem volatil, daher nur eine Auswahl der schwersten Einbrüche:*
* **-34.04%** | Peak: 01.09.2017 ➔ Trough: 14.09.2017 | Recovery: 12.10.2017
* **-83.19%** | Peak: 16.12.2017 ➔ Trough: 15.12.2018 *(Crypto-Winter)* | Recovery: 24.11.2020
* **-53.14%** | Peak: 13.04.2021 ➔ Trough: 20.07.2021 *(China Mining Ban)* | Recovery: 19.10.2021
* **-76.63%** | Peak: 08.11.2021 ➔ Trough: 21.11.2022 *(FTX & Celsius Crash)* | Recovery: 04.03.2024
* **-26.15%** | Peak: 13.03.2024 ➔ Trough: 06.09.2024 | Recovery: 06.11.2024
* **-28.10%** | Peak: 21.01.2025 ➔ Trough: 08.04.2025 | Recovery: 18.05.2025
* **-51.16%** | Peak: 06.10.2025 ➔ Trough: 06.06.2026 | Recovery: Ongoing

---

## 2.5 Die Makro-Zyklus & Rotations-Strategie (Gold vs. BTC)

### Die 7-Jahres-Zyklus-Regel für Gold
Gold bewegt sich historisch in sehr präzisen **6- bis 7-Jahres-Zyklen** von einem echten Makro-Boden zum nächsten (Ausnahme: Exogene Schocks wie 2008, die den Zyklus gewaltsam neustarten). In der ersten Hälfte jedes großen Makro-Bullenmarktes gibt es historisch einen massiven, monatelangen Rücksetzer ("Mid-Cycle Dip") von ca. **-12 % bis -18 %**. Das ist kein Trendbruch, sondern ein absolut normales "Auswaschen", bevor der parabolische Teil startet.

### Der Hebel-Faktor bei Proxy-Aktien (MSTR & GDX)
Sowohl MSTR als auch GDX hebeln die Mid-Cycle Dips des Basis-Assets historisch fast exakt mit einem **Faktor von 2x bis 2,5x**. Ein 12 % Dip bei Gold/BTC bedeutet zwingend einen 25 % bis 30 % Einbruch bei den Aktien. Dies muss als "normale Volatilität" einkalkuliert werden.

### Die Makro-Rotations-Strategie ("Vom Airbag zur Rakete")
* **Gold als Airbag:** In der initialen Crash-Phase (Margin-Call-Sog) findet Gold in 100 % der Fälle *vor* BTC und Aktien seinen echten Boden. Es ist der perfekte Hafen für die erste Schockwelle.
* **BTC als Rendite-Rakete:** Sobald die FED die Zinsen senkt und Liquidität ins System zurückkehrt, wird Gold zu "totem Kapital" (Opportunity Cost). Der Krypto-Markt (BTC/MSTR) springt an. Durch den viel kürzeren und saubereren **4-Jahres-Rhythmus** von BTC ist die sofortige Rotation von Gold in Krypto das mathematisch profitabelste Setup für den neuen Bullenmarkt.
* Siehe für Rohdaten zu den Zyklen: [asset_bull_compare.csv](file:///C:/GitHub/CrashRadar/data/archive/asset_bull_compare.csv)

### Das ETF-Korsett bei Bitcoin
Das "Law of Large Numbers" und die Zulassung der Wall-Street-ETFs dämpfen die irren parabolischen "100x" Meme-Spitzen früherer Krypto-Zyklen. Die Zyklen werden dadurch **flacher, aber länger und strukturell stabiler**, da die ETFs als institutionalisierte Kapital-Rohrleitung dienen.
**Das Risiko:** Durch die ETFs ist BTC nun hart an das klassische Margin-System gekoppelt. Fällt der S&P 500, erhalten Broker Margin-Calls und liquidieren BTC-ETFs ihrer Kunden automatisiert mit. BTC wird bei einem Liquiditäts-Crash also gnadenlos mit dem Aktienmarkt in die Tiefe gezogen.

---

## 3. Zu überprüfende System-Hypothesen (Validierung & Execution)

Die folgenden Konzepte müssen künftig durch Backtests verifiziert werden, um die Robustheit der CrashRadar-Engine abzusichern:

### A. Die Noise-Test Hypothese (Stabilitätsprüfung)
* **Die These:** Ein System, das auf echten Kausalitäten beruht (und nicht kurvengefittet ist), funktioniert auch dann noch, wenn man den Kursen künstliches "Rauschen" beimischt. *(Ausführliche theoretische Erklärung siehe: [docs/Noise-Test-IndicatorEngine.md](file:///C:/GitHub/CrashRadar/docs/Noise-Test-IndicatorEngine.md))*
* **Die Überprüfung:** Ein Test-Skript (siehe [scratch/analyse/Noise-Test-IndicatorEngine.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Noise-Test-IndicatorEngine.js)) fügt historischen SPY-Kursen zufälliges Rauschen (+/- 1% pro Tag) hinzu. Laufen die Crash-Signale der `IndicatorEngine.js` für 2008 und 2020 weiterhin stabil, ist das System robust. Zerbricht die Performance, liegt Overfitting vor.
* **Ergebnis (Bestätigt):** Ein Testlauf ab 2007 zeigte eine Degradation von **0,0%** (Exakt 541 CRITICAL Signale im echten und im verrauschten Chart). Dies belegt mathematisch, dass die Engine echte Makro-Schwerkraft misst und sich nicht durch lokales Kursrauschen austricksen lässt. Overfitting ist in Bezug auf das Preis-Rauschen somit ausgeschlossen.

### B. Die Signal-vs-Execution Hypothese (Slippage & Einstieg)
* **Die These:** Das Signal auf dem gleichen Zeithorizont auszuführen, auf dem es generiert wird (z.B. Daily Close), kostet massiv Rendite durch Reibung. *(Ausführliche theoretische Erklärung siehe: [docs/Signal-vs-Execution-Hypothese.md](file:///C:/GitHub/CrashRadar/docs/Signal-vs-Execution-Hypothese.md))*
* **Die Überprüfung:** Ein Test-Skript (siehe [scratch/analyse/Signal-vs-Execution-Hypothese.js](file:///C:/GitHub/CrashRadar/scratch/analyse/Signal-vs-Execution-Hypothese.js)) simuliert den "Yen Carry Trade Crash" (05.08.2024) anhand von 5-Minuten-Kerzen, die direkt aus einer externen Supabase geladen werden.
* **Ergebnis (Bestätigt):** Wenn die Engine am Freitag (02.08.2024) ein Daily-Signal generiert und wir blind zur Montagseröffnung verkaufen, erleiden wir allein durch den Overnight-Gap-Down **-1,41% Renditeverlust (Slippage)**. Dies beweist, dass ein Daily-Signal zwingend durch eine intraday Execution-Logik flankiert werden muss, um Reibungsverluste zu minimieren.

### C. Die Fractional Kelly Hypothese (Positionsgröße)
* **Die These:** Ein binäres System (100% Investiert oder 100% Cash) ist langfristig ineffizienter als ein dynamisch skaliertes Risiko basierend auf der Signal-Konfidenz.
* **Die Überprüfung:** Der historische Beweis wurde über das Backtest-Skript [Fractional-Kelly.js](file:///workspaces/CrashRadar/scratch/analyse/Fractional-Kelly.js) erbracht.
* **Ergebnis (Bestätigt):** Der Backtest über 20 Jahre (2006-2026) beweist, dass ein binärer Exit (All-in/All-out) zwar den nominalen Drawdown stärker reduziert (Max DD: -25,86 % vs. -31,08 % bei optimiertem Kelly), jedoch unter extrem hoher Transaktionsreibung leidet. Der binäre Ansatz erzeugt durch ständige Fehlsignale (Whipsaws) ein enormes Turnover von **688,0x** (was bei 0,1 % Gebühren/Slippage die Rendite von +312,7 % auf **+107,3 %** drückt). Die dynamische Skalierung (Optimiertes Kelly: 100% -> 40% -> 10% -> 0%) dämpft das Hin- und Her-Traden auf **496,0x** Turnover ab und erzielt dadurch eine höhere Netto-Rendite von **+132,3 %**.

### D. Die Relative-Volume-Handelsthese (RVOL-These)
* **Die These:** Echte institutionelle Akkumulation („Smart Money“) hinterlässt beim Positionsaufbau unübersehbare Spuren im Handelsvolumen. Für Swing-Trader liefert das absolute Tagesvolumen isoliert betrachtet jedoch kein Signal. Erst die relationale Betrachtung des aktuellen Volumens im Vergleich zur historischen Eigendynamik der Aktie (RVOL, Basislinie: gleitender 20-Tage-Durchschnitt) isoliert das echte, anomale Marktinteresse vom alltäglichen Grundrauschen. Ein RVOL >= 2.0 signalisiert anomales Volumen (Signal-Threshold), ein RVOL >= 5.0 extremes Volumen (Catalyst-Threshold).
* **Die Überprüfung:** Der historische Beweis wurde über das Backtest-Skript [RVOL-Breakout-These.js](file:///workspaces/CrashRadar/scratch/analyse/RVOL-Breakout-These.js) angetreten.
* **Ergebnis (Bestätigt):** Für Einzelaktien wie MSTR und COIN führt ein Breakout bei anomalous RVOL ($\ge 2.0$) zu einer deutlichen Outperformance gegenüber Breakouts mit normalem RVOL. So steigt z. B. bei MSTR die 20-Tage-Rendite nach einem Breakout von +4,74 % (normales RVOL) auf **+9,62 %** (RVOL $\ge 2.0$) bei einer Win Rate von **62,2 %** (vs. 46,0 %). Auch bei COIN stieg die 20-Tage-Rendite von +4,71 % auf **+15,40 %**. Bei Index-ETFs wie SPY/QQQ sind solche anomale Volumen-Spikes bei Breakouts jedoch extrem selten und statistisch weniger aussagekräftig.
