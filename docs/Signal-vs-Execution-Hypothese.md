# Signal-vs-Execution Hypothese (Fraktales Trading)

Dieses Dokument beschreibt die Systematik zur Überprüfung, ob eine Trennung der Zeithorizonte zwischen "Signalgenerierung" und "Trade-Ausführung" (Execution) die Systemrendite signifikant verbessert.

## Das Problem: Slippage und Reibungsverluste
Die klassische Anfängerfalle im algorithmischen Trading ist die Vermischung von Signal- und Execution-Ebene. Wenn ein robustes Makro-Modell (z.B. auf Basis von Tages-Schlusskursen) am Abend einen "Crash-Alarm" auslöst, verkaufen viele Systeme stumpf zur nächsten Markteröffnung. 
In Panikphasen führt dies zu:
* Riesigen Bid-Ask-Spreads (Slippage)
* Dem Hineinverkaufen in kurzfristige Intraday-Tiefs
* Dem Verlust von wertvollen Prozentpunkten, die das Gesamtergebnis (den "Edge") über die Jahre zunichtemachen.

## Die Lösung: Fraktales Design
Wir trennen die Ebenen strikt:
1. **Das Makro-Signal (Daily):** Die `IndicatorEngine` feuert auf dem Tageschart. Das ist aber nur eine "Erlaubnis" (Permission to trade), kein direkter Handelsbefehl.
2. **Die Execution (Intraday, z.B. 15-Minuten):** Sobald die Erlaubnis vorliegt, wechseln wir auf einen feingranularen Chart. Wir verkaufen nicht panisch in fallende Kurse, sondern nutzen Mean-Reversion-Metriken (z.B. einen Intraday-RSI-Spike nach oben), um in eine kurzfristige Erholung hinein zu verkaufen. 

## Ziel der Überprüfung
Wir wollen historisch simulieren und beweisen, dass die Rendite/der Kapitalerhalt massiv steigt, wenn wir nach einem Makro-Verkaufssignal auf eine Intraday-Gegenbewegung warten, anstatt sofort unlimitiert abzustoßen.

## Konkreter Umsetzungsplan (Datenarchitektur)
Um die Hauptdatenbank von CrashRadar nicht mit Gigabytes an Intraday-Daten aufzublähen, verfolgen wir einen eleganten On-Demand-Ansatz:
1. **Datenquelle:** Wir zapfen temporär ein externes Supabase-Projekt des Users an, in welchem hochauflösende 5-Minuten-Kerzen (`market_m5_candles`) liegen.
2. **Ziel-Asset:** Wir beschränken uns auf den extrem liquiden S&P 500 ETF (SPY, Ticker-ID: 13), da hier Trading-Halts und idiosynkratische Gaps minimiert werden.
3. **Extraktion:** Ein Test-Skript (`Signal-vs-Execution-Hypothese.js`) baut eine Verbindung zur Supabase auf, zieht sich gezielt die M5-Kerzen (Timestamp, Open, High, Low, Close, Volume) für die relevanten Zeitfenster und legt sie lokal als CSV unter `./data/archive/intraday_test/` ab.
4. **Auswertung:** Zukünftige Backtests lesen dann lediglich diese lokalen, flachen CSV-Dateien ein, um den Slippage-Unterschied (Daily-Close vs Intraday-Reversion) zu berechnen.

*(Siehe Umsetzung in `scratch/analyse/Signal-vs-Execution-Hypothese.js`)*
