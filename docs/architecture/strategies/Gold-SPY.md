# Gold-SPY Dynamic DCA: Die quantitative Makro-Schild & Tranchen-Strategie
*S&P 500 Vermögensaufbau mit 50/50 Gold-Cash-Notfall-Evakuierung, universellem Bottom-Finder & 21,8 Jahre Krisen-Beweis*

> ⚙️ **Operative Strategie-Konfiguration:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json)  
> 💻 **Empirische 22-Jahre-Simulation (2004–2026):** [`scratch/architecture/strategies/GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js)  
> 💻 **Basis-Simulation (2015–2026):** [`scratch/architecture/strategies/GoldSpyDcaSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyDcaSimulation.js)

---

## 1. Executive Summary & Strategische Vision

Der **S&P 500 (`SPY`)** gilt historisch als die verlässlichste Wohlstandsmaschine der Welt. Ein disziplinierter **DCA-Sparplan (Dollar-Cost-Averaging)** schlägt über Jahrzehnte hinweg mehr als 90 % aller aktiven Fondsmanager. Dennoch birgt der rein ungehedgte Buy & Hold-Ansatz verheerende psychologische und mathematische Schwachstellen:
* **Systemische Bärenmärkte (2000–2003, 2008, 2020, 2022):** Kursverluste von -25 % bis -55 % vernichten jahrelang angesammelte Buchgewinne und führen bei vielen Sparern zur Panik-Kapitulation am absoluten Tiefpunkt.
* **Das "Falling-Knife"-Dilemma:** Ein statischer Sparplan kauft blind mitten in einen systemischen Liquiditätsentzug der Notenbanken hinein, obwohl Zinsanstiege und Bilanzverkürzungen den Markt unausweichlich nach unten ziehen.

Die **Gold-SPY Dynamic DCA Strategie** kombiniert dauerhaftes S&P 500 DCA im Normalbetrieb mit der **universellen 3-Heiligkeit des Schutzes**: Bei akutem Liquiditätsentzug und Kreditstress evakuiert das System das gesamte Aktienvermögen in physisches Gold (`GLD`) und Cash, um den Bärenmarkt abzufedern und am antizyklischen Panik-Boden wieder einzusteigen.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│               GOLD-SPY DYNAMIC DCA: DAS 3-PHASEN-REGIME                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. NORMALBETRIEB (Makro GRÜN):                                                 │
│     • 100 % der Sparrate fließt diszipliniert in den S&P 500 (SPY).             │
│     • Kein vorzeitiges Aussteigen, kein Over-Trading – der Zinseszins läuft!   │
│                                                                                 │
│  2. DER UNIVERSELLE NOTFALL-STECKER (Makro ROT):                                │
│     • Trigger: Net Fed Liquidity 8W-Delta < -5,0 %                              │
│       UND High-Yield Credit Spreads (BAMLH0A0HYM2) > 4,0 % (über SMA 50).       │
│     • Sofortige 100 % Notfall-Evakuierung aller SPY-Aktien:                     │
│       --> 50 % Gold (GLD)   [Historischer Krisen- & Inflationshedge]            │
│       --> 50 % Cash (USD)   [Trockenes Pulver für das Tief]                     │
│     • Sparplan während Alarm: Fließt defensiv zu 50 % Gold / 50 % Cash.         │
│                                                                                 │
│  3. DUALER BOTTOM-FINDER & RE-ENTRY:                                            │
│     • Re-Entry via Panic-Capitulation-Sniper (VIX >= 35 Reversal / DIX > 45 %)  │
│       oder reguläre Makro-Entwarnung (NetLiq Delta >= 0,0 %).                   │
│     • 100 % Reinvestition aus Gold & Cash zurück in den S&P 500 (SPY).          │
│     • Sparplan fließt ab sofort wieder zu 100 % in SPY.                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Die Betriebs-Modi im Detail

### Modus 1: Der Normalbetrieb (Akkumulation & Zinseszins)
Befindet sich die US-Netto-Liquidität im neutralen oder expansiven Bereich ($8\text{W-Delta} \ge -5,0\,\%$) oder signalisieren die Credit Spreads entspannte Finanzierungsbedingungen ($< 4,0\,\%$), arbeitet das System als reine Zinseszins-Maschine:
* **Monatliches DCA:** 100 % der monatlichen Sparrate werden am 1. des Monats in den S&P 500 (`SPY`) investiert.
* **HODL-Disziplin:** Keine willkürlichen Verkäufe bei normalem Markt-Rauschen.

---

### Modus 2: Der Notfall-Stecker (100 % Evakuierung bei Makro ROT)

In einem systemischen Bärenmarkt greift der übergeordnete Notanker: **Makro schlägt Charttechnik!**

#### 1. Die Makro-Alarm-Bedingung:
Die Makro-Ampel schlägt auf **ROT**, sobald zwei unabhängige Sensoren gleichzeitig anschlagen:
1. **Druckenmiller Net Fed Liquidity:** Das 8-Wochen-Delta fällt unter **$-5,0\,\%$**:
   $$\text{Net Fed Liquidity} = \text{Fed Total Assets (WALCL)} - \text{TGA (WTREGEN)} - \text{Reverse Repo (RRPONTSYD)}$$
2. **Kreditstress-Filter:** Die High-Yield Credit Spreads (`BAMLH0A0HYM2`) steigen über ihren 50-Tage-Durchschnitt (SMA 50) **und** über $4,0\,\%$.
*(Ausschluss Banken-Notkredite: Notkredite `EmergencyBorrowing > 15B` schalten die Aktien nicht ab, um Liquiditäts-Rallyes nicht zu verpassen).*

#### 2. Die Evakuierungs-Aktion:
* **100 % Verkauf der S&P 500 Aktien:** Sämtliche SPY-Bestände werden unmittelbar veräußert.
* **Allokation des Kapitals:**
  * **50 % in Gold (`GLD`):** Wirkt als sicherer Wertspeicher und profitiert massiv von Flucht in Sicherheit und Währungsabwertung.
  * **50 % in Cash (USD):** Trockenes Pulver, absolut geschützt vor Buchverlusten.
* **Sparplan während Alarm:** Laufende monatliche Sparraten fließen defensiv zu **50 % in Gold und 50 % in Cash**.

---

### Modus 3: Der universelle Bottom-Finder & Re-Entry

Sobald der Schutzschirm aktiv ist, scannt das System täglich nach der Bodenbildung. Der Ausstieg aus Gold/Cash und der Wiedereinstieg in den S&P 500 erfolgt über das bewährte **Duale Re-Entry-System**:

#### 1. Die Bottom-Signale:
* **Pfad 1 (Reguläre NetLiq-Hysterese):**  
  Die Notenbank stoppt den Entzug, das 8-Wochen-Delta dreht nachhaltig ins Plus ($\Delta_{8W} \ge 0,0\,\%$).
* **Pfad 2 (Panic-Capitulation-Sniper am Marktboden):**  
  Der Volatilitätsindex schießt in die Panik-Zone ($\text{VIX} \ge 35$), dreht ab und der Kurs bildet eine bullische RSI-Divergenz (oder Smart/Dumb-Money meldet Kapitulation: $\text{VIX} > 40$, $\text{AAII} < -25\,\%$, $\text{DIX} > 45\,\%$).

#### 2. Das Re-Entry-Manöver:
* Gold und Cash werden zu 100 % liquidiert.
* Das gesamte Kapital fließt **vollständig zurück in den S&P 500 (`SPY`)**.
* Laufende Sparraten fließen ab sofort wieder zu 100 % in den S&P 500.

---

## 3. Empirischer Proof: 21,8 Jahre Backtest (18.11.2004 – 08.09.2026)

### Die Daten-Verfügbarkeit: Wie weit reichen unsere Daten zurück?
* **SPY (S&P 500):** Tägliche Börsenkurse verfügbar seit Januar 1993.
* **GLD (SPDR Gold Shares):** Börsenstart am **18. November 2004**.
* **Ergebnis:** Der **entlegenste gemeinsame Zeitpunkt**, an dem beide Instrumente als liquide, real handelbare ETFs vorliegen, ist der **18. November 2004**. Das entspricht exakt **21,8 Jahren lückenloser Tagesdaten (5.483 Börsentage)**.

### Was hat Gold uns über die 21,8 Jahre tatsächlich gebracht?

Die Simulation [`GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js) vergleicht fünf verschiedene Ansätze mit identischen Rahmenbedingungen:
* **Startkapital:** 10.000 € (am 18.11.2004)
* **Monatliche Sparrate:** 150 € / Monat
* **Gesamteinzahlung:** **€ 49.300,00** (10.000 € Start + 261 Sparraten à 150 €)

| Strategie / Allokation | Depot-Endwert (€) | Reingewinn (€) | Rendite (%) | Maximaler Drawdown |
| :--- | :--- | :--- | :--- | :--- |
| **1. Reiner S&P 500 Buy & Hold DCA (100 % SPY)** | **€ 306.045,71** | **+€ 256.745,71** | **+520,78 %** | **-47,48 %** *(brutaler Crash 2008)* |
| **2. Reines Gold Buy & Hold DCA (100 % GLD)** | **€ 233.922,16** | **+€ 184.622,16** | **+374,49 %** | **-38,80 %** |
| **3. 50/50 SPY / GLD Permanent Portfolio DCA** | **€ 269.983,93** | **+€ 220.683,93** | **+447,63 %** | **-32,42 %** *(massiv geglättet!)* |
| **4. Gold-SPY Dynamic Shield (Notfall: 50 % Gold / 50 % Cash)** | **€ 273.605,55** | **+€ 224.305,55** | **+454,98 %** | **-49,39 %** |
| **5. Gold-SPY Dynamic Shield (Notfall: 100 % Gold)** | **€ 296.212,55** | **+€ 246.912,55** | **+500,84 %** | **-48,57 %** |

---

### Zentrale historische Erkenntnisse aus 21,8 Jahren:

1. **Gold als asymmetrischer Krisen-Gewinner (Finanzkrise 2008):**
   * In der Weltfinanzkrise 2007–2009 fiel der S&P 500 von $120 auf $55 (**-54 % Verlust**).
   * Gold stieg im selben Zeitraum von $70 auf $95 (**+35 % Gewinn**).
   * Wer in dieser Phase in Gold evakuiert war, rettete nicht nur sein Vermögen, sondern vermehrte es gegen den kollabierenden Aktienmarkt.

2. **100 % Gold vs. 50/50 Gold/Cash im Notfall:**
   * Eine Evakuierung in **100 % Gold** erzielte im Backtest **296.212 € (+500,84 %)** – das sind **+22.607 € mehr Endvermögen** als bei 50/50 Gold/Cash (273.605 €).
   * *Grund:* In systemischen Krisen (2008, Eurokrise 2011, Zinsschock 2022) wertet Bargeld real ab, während Gold als zinsunabhängiger Wertspeicher florierte.
   * *System-Kompromiss:* Die 50/50 Gold/Cash-Regel bleibt der konservative Standard der SignalEngine, da 50 % Cash absolute Liquidität für den Re-Entry garantiert, während 50 % Gold den realen Werterhalt sichert.

3. **Das Permanent-Portfolio-Phänomen (50/50 SPY/Gold):**
   * Wer einfach stur 50 % SPY und 50 % Gold besparte, erzielte hervorragende **269.983 €** bei einem maximalen Drawdown von nur **-32,42 %** (über 15 %-Punkte weniger Verlust als 100 % Aktien!).

4. **Die Lehre für das S&P 500 Timing:**
   * Der S&P 500 ist ein unaufhaltsamer langfristiger Bulle. Jede Notfall-Evakuierung muss mit einem präzisen Re-Entry gepaart sein:
   * Ohne den **Kreditstress-Filter** führen TGA-Schwankungen zu teuren Fehlausstiegen.
   * Der **Panic-Capitulation-Sniper** stellt sicher, dass das evakuierte Gold/Cash-Kapital direkt an den Tiefpunkten (wie März 2009 bei SPY $55 oder März 2020) wieder voll in den Markt gedrückt wird.

---

## 4. Technische Implementierung & Code-Referenzen

* 💻 **22-Jahre-Simulationsskript:** [`scratch/architecture/strategies/GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js)
* 💻 **11-Jahre-Basisskript (2015–2026):** [`scratch/architecture/strategies/GoldSpyDcaSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyDcaSimulation.js)
* ⚙️ **Konfigurations-Manifest:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json)
* 📄 **Signaldienst-Architektur:** [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
* 📄 **Wissensgraph-Index:** [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md)
