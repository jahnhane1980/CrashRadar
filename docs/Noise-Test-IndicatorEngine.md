# Noise-Test der IndicatorEngine (Stabilitätsprüfung)

Dieses Dokument beschreibt die Systematik zur Überprüfung der Robustheit unserer Crash-Signale mittels künstlichem Rauschen (White Noise / Monte-Carlo).

## Das Problem: Overfitting
Ein häufiges Problem bei der Entwicklung von Handelssystemen ist das *Overfitting* (Kurvenanpassung). Indikatoren werden oft so lange optimiert, bis sie in der Vergangenheit perfekt feuerten (z.B. genau vor dem Lehman-Crash 2008 oder Corona 2020). Da sich die Zukunft jedoch nie exakt wie die Vergangenheit verhält, kollabieren solche Systeme beim nächsten echten Schock.

## Die Lösung: Der Noise-Test
Um zu beweisen, dass die CrashRadar-Engine echte makroökonomische Kausalität (Schwerkraft) misst und sich nicht nur historische Zacken gemerkt hat, unterziehen wir sie einem Rausch-Test.

### Der Ablauf
1. **Datenbezug:** Wir laden die sauberen historischen Originaldaten aus der Datenbank (z.B. SPY-Kurse, VIX).
2. **Noise Injection:** Wir verschmutzen die Originalkurse des SPY künstlich. Jedem Tages-Schlusskurs wird ein zufälliger Wert zwischen `-1%` und `+1%` ("Weißes Rauschen") aufgeschlagen. Dadurch bleiben Makro-Trends erhalten, aber die Mikrostruktur (lokale Hochs/Tiefs) verschiebt sich.
3. **Auswertung:** Wir leiten diese künstlich "verwackelten" Zeitreihen durch unsere `IndicatorEngine` und zählen, wie oft die harten Crash-Signale (z.B. VIX > 35, oder RSI Divergenzen) noch anspringen.

### Interpretation der Ergebnisse
* **Totaler Kollaps (Overfitting):** Wenn die Crash-Signale plötzlich gar nicht mehr oder monatelang falsch feuern, ist das System kaputt/überoptimiert.
* **Proportionale Degradation (Robustheit):** Wenn das System den Crash immer noch zuverlässig im gleichen Zeitfenster (vielleicht ein paar Tage früher/später) erkennt, haben wir den mathematischen Beweis erbracht, dass unser Edge real und robust ist.

*(Siehe Umsetzung in `scratch/analyse/Noise-Test-IndicatorEngine.js`)*
