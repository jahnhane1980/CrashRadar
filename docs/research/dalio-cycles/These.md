In dem Video [Ray Dalio Explains Debt Cycles](http://www.youtube.com/watch?v=eD0wZL27O4c) aus dem Kanal *Principles by Ray Dalio* erklärt Ray Dalio die Funktionsweise von Kurz- und Langzeit-Schuldenzyklen und wie diese die Wirtschaft antreiben.

---

### 1. Zusammenfassung der wichtigsten Punkte

* **Der kurzfristige Schuldenzyklus (Dauer: ca. 5–8 Jahre):**
* **Expansionsphase [[00:00](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D0)]:** Die Wirtschaft wächst durch Kreditvergabe. Weil Ausgaben schneller steigen als die Produktion von Gütern, entsteht Inflation.
* **Straffung & Rezession [[00:34](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D34)]:** Um hohe Inflation zu bekämpfen, hebt die Zentralbank die Zinsen an. Dadurch werden Kredite teurer und der Schuldendienst bestehender Schulden steigt. Die Menschen geben weniger aus, das Einkommen anderer sinkt, und die Wirtschaft gerät in eine Rezession.
* **Lockerung [[01:20](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D80)]:** Bei zu starker Rezession senkt die Zentralbank die Zinsen wieder, um die Kreditaufnahme und das Wachstum neu anzukurbeln.


* **Der langfristige Schuldenzyklus (Dauer: mehrere Jahrzehnte):**
* **Akkumulation über Jahrzehnte [[02:17](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D137)]:** Da Menschen aus psychologischen Gründen in der Regel mehr Schulden aufnehmen, als sie zurückzahlen, endet jeder kurzfristige Zyklus mit mehr Schulden als der vorherige.
* **Trügerischer Boom & Vermögensblasen [[03:15](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D195)]:** Solange die Einkommen und Vermögenspreise (z. B. am Aktienmarkt) steigen, bleibt die Schuldenlast (*Debt Burden / Debt-to-Income*) tragbar. Investoren und Kreditgeber fühlen sich reich und nehmen massive Kredite auf.
* **Der Wendepunkt / Peak [[03:58](https://www.google.com/search?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeD0wZL27O4c%26t%3D238)]:** Irgendwann wachsen die Schuldendienstverpflichtungen schneller als die Einkommen. Es kommt zum erzwungenen Konsumverzicht, Zinssenkungen reichen nicht mehr aus und der langfristige Schuldenzyklus kehrt sich um.



---

### 2. Überprüfbare These (Hypothese)

Basierend auf Dalios Modell lässt sich folgende quantifizierbare Hauptthese formulieren:

> **Hauptthese:** *„Ein historisch hohes Niveau des Schuldendienstes im Verhältnis zum verfügbaren Einkommen (Debt Service Ratio) in Kombination mit einer Fed-Zinsanhebung führt mit einer zeitlichen Verzögerung (Lag) von 12 bis 24 Monaten zu einem systematischen Einbruch der Aktienmärkte (Drawdown > 20 %) und einer konjunkturellen Rezession.“*

**Ableitbare Teilhypothesen:**

1. **Kreditgetriebene Bewertung:** Phasen mit beschleunigtem Wachstum der Gesamtverschuldung relativ zum BIP korrelieren im Vorfeld positiv mit Bewertungskennzahlen des Aktienmarktes (z. B. Shiller-KGV / S&P 500 Multiples).
2. **Wendepunkt durch Schuldendienst:** Sobald die Schuldenquote der privaten Haushalte oder Unternehmen das obere Quartil ihres historischen Trends erreicht, führt jeder Anstieg des effektiven Leitzinses (*Fed Funds Rate*) um mehr als 150 Basispunkte zu einem Rückgang des realen Bip-Wachstums und der Marktkapitalisierung.

---

### 3. Entwurf für ein Test- und Analysekonzept

Um diese These empirisch zu überprüfen, können historische Finanz- und Makrodaten (vorzugsweise USA seit 1970) herangezogen werden.

#### A. Datensätze & Variablen (über FRED / Federal Reserve Data)

* **Schulden- & Schuldendienst-Metriken:**
* `TDSP`: *Household Debt Service Payments as a Percent of Disposable Personal Income* (Schuldendienst der Haushalte).
* `TCMDO` / `TDSL`: *Total Credit Market Debt Owed* im Verhältnis zum `GDP` (Gesamtverschuldung / BIP).
* `BUSLOANS` / `NONREVOL`: Unternehmenskredite und Konsumentenkredite.


* **Geldpolitik & Zinsen:**
* `FEDFUNDS`: *Effective Federal Funds Rate* (Leitzins).
* `GS10` minus `TB3MS`: Zinsstrukturkurve (10-jährige minus 3-monatige US-Staatsanleihen).


* **Aktienmarkt- & Wirtschaftsdaten:**
* **S&P 500 Index** (Kursdaten, KGV / Cyclically Adjusted Price-to-Earnings Ratio - CAPE).
* `GDPC1`: Reales Bruttoinlandsprodukt.
* `USREC`: NBER-Rezessionsindikatoren (binär 0/1).



#### B. Analyse-Schritte & Methodik

1. **Datenintegration & Normalisierung:**
* Zusammenführung aller Zeitreihen auf monatlicher oder quartalsweiser Basis (z. B. von 1970 bis heute).
* Berechnung der Veränderungsraten (*YoY Growth*) von Kreditmengen und Aktienkursen.


2. **Event-Studie & Zinszyklus-Mapping:**
* Identifikation aller historischen Fed-Zinsanhebungszyklen (*Hiking Cycles*).
* Messung der Höchststände des Schuldendienstes (`TDSP`) vor Beginn der Zinssenkungsphasen.


3. **Verzögerungs- & Korrelationsanalyse (*Cross-Correlation with Lags*):**
* Untersuchung der Zeitverzögerung zwischen dem Höchststand der Zinsen / des Schuldendienstes und dem Höchststand des S&P 500 bzw. dem Beginn einer Rezession.
* Prüfen, ob Lag-Intervalle von 6, 12, 18 und 24 Monaten statistisch signifikante negative Korrelationen mit der S&P-500-Rendite aufweisen.


4. **Regressionsmodell / Klassifikation:**
* **Logistisches Regressionsmodell:** Schätzung der Wahrscheinlichkeit eines Aktienmarkt-Crashs ($P(\text{Crash})$) in Abhängigkeit von:

$$\text{Score} = \beta_0 + \beta_1 \cdot \text{Schuldendienstquote} + \beta_2 \cdot \Delta \text{Leitzins} + \beta_3 \cdot \text{Invertierung der Zinskurve}$$


* **Backtesting:** Simulation einer Anlagestrategie, die das Aktien-Exposure reduziert, sobald die Schuldendienstquote ein kritisches Perzentil durchbricht und die Fed die Zinsen anhebt.