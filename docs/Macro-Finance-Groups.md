# Macro Finance Groups & Liquidity

Das System aggregiert Rohdaten aus verschiedenen Quellen (FED, FiscalData, Binance, Tiingo, Yahoo Finance) und gruppiert diese in vier essenzielle makroökonomische Themenkomplexe. Diese Gruppierungen ermöglichen es, das Verhalten von Risiko-Assets (Bitcoin, QQQ, SPY) mit der Liquiditätsversorgung und dem Stress im globalen Finanzsystem in Verbindung zu bringen.

Alle Daten der Fed- und Fiscal-Seite stehen nicht für sich allein, sondern agieren als kommunizierende Röhren. 

Hier ist die detaillierte Erklärung der 4 Gruppen:

---

### Gruppe 1: Der "Net Liquidity" Index (Der Geldhahn)
Das ist die mit Abstand wichtigste Metrik für BTC, QQQ und SPY. Krypto und Tech-Aktien sind hochsensibel auf die *echte* Menge an verfügbarem Geld im Finanzsystem.

* **Komponenten:**
  * `WALCL` (Fed Balance Sheet): Das gesamte gedruckte Geld. *(Treibt Liquidität hoch)*
  * `TGA` (Treasury General Account): Das Girokonto der US-Regierung. Wenn Steuern eingenommen oder Schulden gemacht werden, wandert das Geld aus dem Markt hierhin. *(Zieht Liquidität ab)*
  * `RRPONTSYD` (Reverse Repo): Geld von Geldmarktfonds, das risikolos über Nacht bei der Fed geparkt wird und somit dem Aktienmarkt entzogen ist. *(Zieht Liquidität ab)*
* **Die Formel:** `Net Liquidity = WALCL - TGA - RRPONTSYD`
* **Zusammenhang:** Fällt die Net Liquidity, leiden Krypto und Tech fast augenblicklich. Steigt sie (weil z.B. die USA ihr TGA-Konto leeren oder RRP sinkt), haben Risiko-Assets extremen Rückenwind.

### Gruppe 2: Financial Conditions & Cost of Capital (Die Daumenschrauben)
Diese Gruppe steht als "Stress-Indikator" für das Finanzsystem. Tech und Krypto hassen hohe Zinsen und einen starken Dollar.

* **Komponenten:**
  * `DXY` (US Dollar Index): Ein starker Dollar entzieht der Welt Liquidität und drückt den Preis von Assets, die in Dollar gepreist werden.
  * `DFII10` (10y Real Yields): Der "echte" Zins nach Inflation. Krypto wirft keine Zinsen ab. Wenn Real Yields steigen, flüchten Investoren aus zinslosen Risiko-Assets (BTC) und langlaufenden Tech-Werten (QQQ) in sichere Anleihen.
  * `NFCI` (Chicago Fed National Financial Conditions Index): Ist dieser Wert negativ, fließt das Geld leicht (Party). Ist er positiv, gibt es Stress im Finanzsystem (Kreditklemmen).
* **Zusammenhang:** Diese Werte verhalten sich stark invers (spiegelverkehrt) zum S&P 500 (SPY) und Bitcoin.

### Gruppe 3: Banking Health & Credit Cycle (Der Maschinenraum)
Die Wirtschaft wächst nur, wenn Banken Kredite vergeben. Diese Daten zeigen an, ob im Finanzsystem gerade etwas bricht (z.B. wie beim Zusammenbruch der Silicon Valley Bank).

* **Komponenten:**
  * `TOTRESNS` (Total Reserves): Was die Banken tatsächlich an Reserven haben. Sollte relativ synchron zur *Net Liquidity* laufen.
  * `BORROW` (Emergency Borrowing): Notfall-Kredite der Banken bei der Fed (Discount Window, BTFP). Wenn dieser Wert senkrecht nach oben schießt, brennt es im Bankensystem.
* **Zusammenhang:** Ein Vorlauf-Indikator für Krisen. Ein Spike beim Notfall-Borrowing ist ein massives Stress-Signal für die Wirtschaft, ironischerweise aber oft ein starkes Kaufsignal für Gold und Bitcoin (als "Safe Haven" außerhalb des Bankensystems).

### Gruppe 4: Die Konjunktur / Yield Curve
* **Komponente:** `T10Y2Y` (Der Zins-Spread zwischen 10-jährigen und 2-jährigen Staatsanleihen).
* **Zusammenhang:** Ist diese Kurve negativ (invertiert), preist der Markt mittelfristig eine Rezession ein. Risiko-Assets ignorieren das oft erstaunlich lange. Historisch gesehen crasht der Markt meistens erst in dem Moment, in dem die Kurve sich wieder "ent-invertiert" (Steepening), weil dann die Zentralbanken in Panik die Zinsen senken.
