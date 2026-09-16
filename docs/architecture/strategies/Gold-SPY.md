# Gold-SPY Dynamic DCA: Die quantitative Trend-Schild & Gold-Hedge-Strategie
*S&P 500 Vermögensaufbau mit der 3-Säulen-Katastrophen-Matrix, 75/25 Gold-Cash Sweet Spot, Margin-Call-Airbag & 21,8 Jahre Krisen-Beweis*

> ⚙️ **Operative Strategie-Konfiguration:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json) (Version 2.3.0)  
> 💻 **Katastrophen-Matrix & Hysterese-Test:** [`research/strategy-prototypes/test_katastrophen_matrix.js`](file:///D:/GitHub/CrashRadar/research/strategy-prototypes/test_katastrophen_matrix.js)  
> 💻 **75/25 Sweet-Spot & Stresstest:** [`research/strategy-prototypes/test_75_25_gold_spy.js`](file:///D:/GitHub/CrashRadar/research/strategy-prototypes/test_75_25_gold_spy.js)  
> 💻 **Empirischer 21,8-Jahre Tranchen-Vergleich:** [`simulations/CompareTranches21Years.js`](file:///D:/GitHub/CrashRadar/simulations/CompareTranches21Years.js)

---

## 1. Executive Summary & Strategische Vision

Der **S&P 500 (`SPY`)** gilt historisch als die verlässlichste Wohlstandsmaschine der Welt. Ein disziplinierter **DCA-Sparplan (Dollar-Cost-Averaging)** schlägt über Jahrzehnte hinweg mehr als 90 % aller aktiven Fondsmanager. Dennoch birgt der rein ungehedgte Buy & Hold-Ansatz verheerende psychologische und mathematische Schwachstellen:
* **Systemische Jahrhundert-Crashs (2000–2003, 2007–2009):** Verluste von über -50 % vernichten jahrelang mühsam angespartes Vermögen und führen bei vielen Sparern zur Panik-Kapitulation am absoluten Tiefpunkt.
* **Das Whipsaw-Dilemma bei "normalen Korrekturen":** Ein rein technischer Ausstieg (wie bloßes Kreuzen des 200-Tage-Durchschnitts) erzeugt in Seitwärtsmärkten über 70 nervöse Fehlausstiege. Man verkauft in gesunden Korrekturen bei -8 % und muss teurer wieder einsteigen.
* **Die 100 % Gold-Falle (Der Margin-Call-Sog):** Ein reiner 100 %-Ausstieg in Gold birgt das akute Risiko, in der ersten Schockwelle von Margin Calls zerrieben zu werden, wenn Institutionen Gold zwangsliquidieren, um Liquiditätslöcher zu stopfen.

Die **Gold-SPY Dynamic DCA Strategie (Version 2.2)** löst dieses Trilemma durch die **3-Säulen-Katastrophen-Matrix**:
1. **Timing über den Chart:** Der S&P 500 schließt unter dem SMA 200 bei $\ge 8,0\,\%$ Drawdown.
2. **Türsteher über das Makro-Umfeld:** Der Notfall-Schutz evakuiert **NUR DANN**, wenn mindestens einer der 3 großen Katastrophen-Sensoren (Kreditstress, Notenbank-Entzug oder Schock-Panik) rot leuchtet. Normale Korrekturen werden ignoriert!
3. **Absicherung im 75/25 Sweet Spot:** 75 % physisches Gold (`GLD`) als Krisenrakete + 25 % Cash als Margin-Call-Airbag und trockenes Pulver am Panik-Boden.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│           GOLD-SPY DYNAMIC DCA: DIE 3-SÄULEN-KATASTROPHEN-MATRIX                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. NORMALBETRIEB (Trend INTAKT oder Makro GRÜN):                               │
│     • 100 % der Sparrate fließt diszipliniert in den S&P 500 (SPY).             │
│     • Normale Korrekturen (-5 % bis -10 %) werden stur durchgespart!           │
│     • Kein vorzeitiges Aussteigen, kein Over-Trading – der Zinseszins läuft!   │
│                                                                                 │
│  2. DER NOTFALL-SCHUTZSCHILD (Trend GEBROCHEN + KATASTROPHE AKTIV):             │
│     • Chart-Bedingung: SPY < SMA 200 UND Drawdown vom Allzeithoch >= 8,0 %      │
│       UND MINDESTENS EIN KATASTROPHEN-SENSOR LEUCHTET ROT:                      │
│       [A] Schock-Panik: VIX >= 28,0 (Corona / Flash Crash)                     │
│       [B] Kredit- & Solvenzstress: Chicago Fed Index > -0.20 (2008 Subprime)   │
│       [C] Liquiditäts-Entzug: Net Fed Liquidity 8W-Delta < -5,0 % (2022 QT)    │
│       [D] Hebel-Kollaps: FINRA Margin Debt Drawdown <= -5,0 % (Deleveraging)    │
│     • Sofortige 100 % Evakuierung in den 75/25 Sweet Spot:                      │
│       --> 75 % Gold (GLD) [Asymmetrischer Krisengewinner im Bärenmarkt]         │
│       --> 25 % Cash (USD) [Airbag gegen Margin-Call-Dip & trockenes Pulver]     │
│     • Anti-Whipsaw: Mindestens 15 Tage Mindesthaltedauer im Bärenmarkt.         │
│                                                                                 │
│  3. ASYMMETRISCHER TRANCHEN-RE-ENTRY (30 / 40 / 30 %):                           │
│     • Tranche 1 (30 % SPY / 70 % Cash):                                         │
│       Erster antizyklischer Einstieg bei autorisiertem DEPLOY_CASH (DD <= -18%).│
│     • Tranche 2 (+40 % auf 70 % SPY / 30 % Cash - Der Wal-Einstieg):            │
│       Dark Pool Akkumulation (DIX >= 48 %) ODER Dip >= 6 % ODER 12 Handelstage. │
│     • Tranche 3 (+30 % auf 100 % SPY / 0 % Cash - Die Trendbestätigung):        │
│       S&P 500 schließt über SMA 20 ODER 12 Tage ODER Matrix-Schild erlischt.   │
│     • Fail-Safe: Bei Marktrückfall unter -20% ohne Boden sofort HOLD_CASH.     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Wie unterscheiden wir Katastrophen von normalen Korrekturen?

Historisch entstehen schwere Bärenmärkte (-25 % bis -55 %) niemals aus dem Nichts, sondern hinterlassen messbare Spuren in den Makro-Daten:

| Katastrophen-Typ | Historisches Vorbild | Der CrashRadar-Sensor | Was passiert bei einer normalen Korrektur? |
| :--- | :--- | :--- | :--- |
| **Typ 1: Kredit- & Solvenzkrise** | **2007–2008** (Subprime), 2000 DotCom | **`ChicagoFedIndex > -0.20`** & **`Margin Debt <= -5.0 %`** | Bei gesunden Dips bleiben Kredite entspannt (`CFI < -0.40`). |
| **Typ 2: Notenbank-Entzug (QT / Zinsen)** | **2022** (Zinswende & QT) | **`Net Fed Liquidity 8W-Delta < -5.0 %`** | In Bullenmärkten ist die Netto-Liquidität neutral oder positiv. |
| **Typ 3: Exogener Schock / Black Swan** | **März 2020** (Corona), August 2015 | **`VIX >= 28-30`** (Panik-Spike) | In normalen Dips dümpelt der VIX bei harmlosen 16–22 herum. |

**Das Ergebnis der Kopplung:**  
In normalen Dips (wie Sommer 2014, Sommer 2017, Herbst 2021) konsolidieren Aktien, aber die Makro-Sensoren bleiben grün. **Das System bleibt zu 100 % investiert.**  
Erst wenn das Finanzsystem Risse zeigt (Kreditstress) oder die Panik eskaliert (VIX), fällt die Notfall-Entscheidung.

---

## 3. Das Phänomen des Margin-Call-Sogs (Warum 75 % Gold / 25 % Cash?)

In fast jedem Jahrhundert-Crash existiert an der Wall Street eine eiserne Gesetzmäßigkeit:
> *"In a margin call, you don't sell what you want to sell. You sell what you CAN sell."*

### 1. Die historische Beweislast:
Wenn institutionelle Fonds von Brokern Margin Calls erhalten, müssen sie innerhalb von Stunden Liquidität beschaffen. Da Aktien abstürzen, liquidieren sie ihr liquidestes Gewinner-Asset: **Gold**.
* **Finanzkrise 2008:** Zwischen Juli und Oktober 2008 brach Gold (`GLD`) von **$ 96,17 auf $ 70,65 ein (`-26,5 %`)**.
* **Corona-März 2020:** In nur 10 Handelstagen fiel Gold von **$ 157,81 auf $ 138,04 (`-12,5 %`)**.
* Erst wenn die Zwangsverkäufe absorbiert sind, explodiert Gold im Bärenmarkt nach oben (2009–2011: von $ 70 auf $ 180 = **+157 %**).

### 2. Der 25 % Cash-Airbag:
* Die **25 % Cash** absorbieren diesen ersten Margin-Call-Schock vollkommen verlustfrei.
* Sie stellen **sofortiges, trockenes Pulver** am Panik-Boden bereit, um direkt die ersten Aktien-Tranchen zu kaufen.
* Die **75 % Gold** nehmen die gesamte darauffolgende Währungs- und Bärenmarkt-Aufwertung voll mit.

---

## 4. Empirischer Proof: 21,8 Jahre Backtest (2004 – 2026)

Ausgeführt über [`CompareTranches21Years.js`](file:///D:/GitHub/CrashRadar/simulations/CompareTranches21Years.js) bei 10.000 € Startkapital und 150 € monatlicher Sparrate (48.400 € Gesamteinzahlung über 7.760 Handelstage):

| Strategie / Setup | Depot-Endwert (€) | Reingewinn (€) | Rendite (%) | Maximaler Drawdown | Alpha vs. SPY |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. Reiner S&P 500 Buy & Hold DCA** | **€ 246.588,24** | +€ 198.188,24 | +409,48 % | **-47,90 %** (09.03.2009) | Baseline |
| **1. Reines Gold Buy & Hold DCA** | **€ 276.043,34** | +€ 227.643,34 | +470,34 % | **-37,89 %** (31.12.2013) | +€ 29.455,10 |
| **2. Gold-SPY All-In Re-Entry** | **€ 318.639,23** | +€ 270.239,23 | +558,35 % | **-46,92 %** (31.05.2009) | +€ 72.050,99 |
| **3. Gold-SPY mit 30/40/30 % Tranchen** | **€ 349.797,71** | **+€ 301.397,71** | **+622,72 %** | **-32,48 %** (14.10.2022) | **+€ 103.209,47** |

### Krisen-Drawdowns im Härtetest:
* **Finanzkrise 2008 (Lehman-Pleite):** Drawdown von **-46,92 % (All-In)** auf **`-25,68 %`** gedämpft!
* **Eurokrise 2011:** Maximaler Drawdown auf **`-18,07 %`** begrenzt.
* **Fed-Zinswende 2018:** Maximaler Drawdown auf **`-17,45 %`** begrenzt.
* **Corona-Crash 2020:** Drawdown von **-40,67 %** auf **`-26,69 %`** gedämpft (kein blindes Messer-Fangen).
* **Bärenmarkt 2022:** Maximaler Drawdown auf **`-32,48 %`** begrenzt.

---

## 5. Technische Implementierung & Code-Referenzen

* ⚙️ **Konfigurations-Manifest:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json)
* 💻 **Katastrophen-Matrix & Hysterese-Test:** [`research/strategy-prototypes/test_katastrophen_matrix.js`](file:///D:/GitHub/CrashRadar/research/strategy-prototypes/test_katastrophen_matrix.js)
* 💻 **75/25 Stresstest & Validierung:** [`research/strategy-prototypes/test_75_25_gold_spy.js`](file:///D:/GitHub/CrashRadar/research/strategy-prototypes/test_75_25_gold_spy.js)
* 💻 **22-Jahre-Simulationsskript:** [`simulations/GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/simulations/GoldSpyFullHistorySimulation.js)
* 📊 **Margin-Debt & Deleveraging Sensor:** [`src/analysis/indicators/MarginDebtIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MarginDebtIndicator.js)
* 📄 **Signaldienst Master-Architektur:** [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
* 📄 **Wissensgraph-Index:** [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md)
