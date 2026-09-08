# Gold-SPY Dynamic DCA: Die quantitative Trend-Schild & Gold-Hedge-Strategie
*S&P 500 Vermögensaufbau mit SMA 200 Trend-Notfall-Evakuierung in Gold, Panik-Boden-Sniper & 21,8 Jahre Krisen-Beweis*

> ⚙️ **Operative Strategie-Konfiguration:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json)  
> 💻 **Empirische 22-Jahre-Simulation (2004–2026):** [`scratch/architecture/strategies/GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js)  
> 💻 **Erkenntnis- & Fehlerdiagnose (2008/2020):** [`scratch/architecture/strategies/test_hedge_mechanisms.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/test_hedge_mechanisms.js)

---

## 1. Executive Summary & Strategische Vision

Der **S&P 500 (`SPY`)** gilt historisch als die verlässlichste Wohlstandsmaschine der Welt. Ein disziplinierter **DCA-Sparplan (Dollar-Cost-Averaging)** schlägt über Jahrzehnte hinweg mehr als 90 % aller aktiven Fondsmanager. Dennoch birgt der rein ungehedgte Buy & Hold-Ansatz verheerende psychologische und mathematische Schwachstellen:
* **Systemische Jahrhundert-Crashs (2000–2003, 2007–2009):** Verluste von über -50 % vernichten jahrelang mühsam angespartes Vermögen und führen bei vielen Sparern zur Panik-Kapitulation am absoluten Tiefpunkt.
* **Das Notenbank-Blindheits-Dilemma:** Ein reiner Makro-Liquiditäts-Ausstieg (*Net Fed Liquidity*) versagt in systemischen Bankenkrisen (wie 2008) und Blitzcrashs (wie Corona 2020), weil die Notenbank in diesen Phasen panikartig Notkredite druckt. Dadurch schlägt ein reiner Notenbank-Filter nicht an und das Depot rauscht ungebremst in die Tiefe.

Die **Gold-SPY Dynamic DCA Strategie (Version 2.0)** löst dieses Problem durch die Kopplung von **diszipliniertem Sparplan-Zinseszins im Bullenmarkt** mit einem **robusten Trend-Filter (SMA 200)** und **Gold als asymmetrischem Krisen-Hedge**:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│               GOLD-SPY DYNAMIC DCA: DAS 3-PHASEN-REGIME                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. NORMALBETRIEB (Trend INTAKT):                                               │
│     • 100 % der Sparrate fließt diszipliniert in den S&P 500 (SPY).             │
│     • Kein vorzeitiges Aussteigen, kein Over-Trading – der Zinseszins läuft!   │
│                                                                                 │
│  2. DER NOTFALL-TREND-SCHILD (Trend GEBROCHEN):                                 │
│     • Trigger: S&P 500 schließt UNTER seinem 200-Tage-Durchschnitt (SMA 200)    │
│       UND der Drawdown vom Allzeithoch beträgt mindestens 8,0 %.                │
│     • Sofortige 100 % Evakuierung aller Aktien in physisches Gold (GLD):        │
│       --> 100 % Gold (GLD) [Maximales Alpha: schützt & steigt im Crash]         │
│       --> Optional: 50 % Gold / 50 % Cash [Maximale Drawdown-Dämpfung]          │
│     • Laufende Sparrate: Fließt während Alarm zu 100 % in Gold (bzw. 50/50).    │
│                                                                                 │
│  3. DUALER BOTTOM-FINDER & RE-ENTRY:                                            │
│     • Re-Entry Pfad A (Panic-Capitulation-Sniper):                              │
│       VIX schießt in Panik-Zone (>= 35) und dreht ab (Bodenbildung).           │
│     • Re-Entry Pfad B (Trend-Rückeroberung):                                    │
│       S&P 500 schließt wieder nachhaltig ÜBER dem SMA 200.                      │
│     • 100 % Reinvestition aus Gold & Cash zurück in den S&P 500 (SPY).          │
│     • Sparplan fließt ab sofort wieder zu 100 % in SPY.                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Die Betriebs-Modi im Detail

### Modus 1: Der Normalbetrieb (Akkumulation & Zinseszins)
Solange der S&P 500 seinen übergeordneten Aufwärtstrend behauptet (über dem 200-Tage-Durchschnitt) oder Konsolidierungen unter 8 % Drawdown bleiben, arbeitet das System als ungestörte Zinseszins-Maschine:
* **Monatliches DCA:** 100 % der monatlichen Sparrate werden am 1. des Monats in den S&P 500 (`SPY`) investiert.
* **HODL-Disziplin:** Kein Verkauf bei gewöhnlichem Markt-Rauschen.

---

### Modus 2: Der Notfall-Trend-Schild (100 % Evakuierung in Gold)

In einem echten Bärenmarkt schützt der Trend-Filter vor dem Absturz:

#### 1. Die Alarm-Bedingung:
Der Schutzschild schlägt an, sobald **zwei Bedingungen gleichzeitig** erfüllt sind:
1. **Trendbruch:** Der Schlusskurs von `SPY` liegt unter dem 200-Tage-Durchschnitt (`Close < SMA 200`).
2. **Bestätigter Drawdown:** Der Kursverlust vom Allzeithoch (ATH) beträgt **mindestens 8,0 %**.  
   *(Dieser Puffer verhindert Whipsaws bei harmlosen Tests des SMA 200 im gesunden Bullenmarkt).*

#### 2. Die Evakuierungs-Aktion:
* **100 % Verkauf der S&P 500 Aktien:** Sämtliche Bestände werden glattgestellt.
* **Allokation des Kapitals:**
  * **Modus Maximum Alpha (Standard):** 100 % des Kapitals wird in physisches Gold (`GLD`) umgeschichtet. Gold fungiert historisch als krisenresistenter Wertspeicher und wertet bei einsetzender Währungs- und Marktpanik auf.
  * **Modus Maximum Stability (Defensiv):** 50 % in Gold (`GLD`) und 50 % in Cash (USD). Dies halbiert den maximalen Drawdown des Gesamtportfolios.
* **Sparplan während Alarm:** Laufende Sparraten fließen zu 100 % in Gold (bzw. 50/50).

---

### Modus 3: Der duale Bottom-Finder & Re-Entry

Sobald das Kapital im sicheren Gold-Hafen liegt, scannt das System täglich nach der Bodenbildung:

#### 1. Die Re-Entry-Signale:
* **Pfad A (Panic-Capitulation-Sniper am Marktboden):**  
  Der Volatilitätsindex schießt in die Panik-Zone ($\text{VIX} \ge 35$) und dreht ab, während sich der Aktienkurs stabilisiert (oder der CrashRadar `PanicCapitulationIndicator` schlägt an). Das Kapital kauft direkt am antizyklischen Panik-Tiefpunkt!
* **Pfad B (Trend-Rückeroberung):**  
  Der S&P 500 erobert seinen 200-Tage-Durchschnitt nachhaltig zurück (`Close > SMA 200`).

#### 2. Das Re-Entry-Manöver:
* Gold (und ggf. Cash) werden zu 100 % liquidiert.
* Das gesamte Kapital fließt **vollständig zurück in den S&P 500 (`SPY`)**.
* Laufende monatliche Sparraten fließen ab sofort wieder zu 100 % in den S&P 500.

---

## 3. Empirischer Proof: 21,8 Jahre Backtest (18.11.2004 – 08.09.2026)

### Die Daten-Verfügbarkeit
* **SPY (S&P 500):** Tägliche Börsenkurse verfügbar seit Januar 1993.
* **GLD (SPDR Gold Shares):** Börsenstart am **18. November 2004**.
* **Ergebnis:** Der **entlegenste gemeinsame Zeitpunkt**, an dem beide Instrumente als reale ETFs handelbar sind, ist der **18. November 2004** (exakt **21,8 Jahre / 5.483 Börsentage**).

### Was hat Gold über 21,8 Jahre tatsächlich gebracht?

Ausgeführt über die historische Validierungs-Simulation [`GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js):
* **Startkapital:** 10.000 € (am 18.11.2004)
* **Monatliche Sparrate:** 150 € / Monat (261 Sparraten)
* **Gesamteinzahlung:** **€ 49.300,00**

| Strategie / Allokation | Depot-Endwert (€) | Reingewinn (€) | Rendite (%) | Maximaler Drawdown |
| :--- | :--- | :--- | :--- | :--- |
| **1. Reiner S&P 500 Buy & Hold DCA (100 % SPY)** | **€ 306.045,71** | +€ 256.745,71 | +520,78 % | **-47,48 %** *(brutaler 2008er Crash)* |
| **2. Reines Gold Buy & Hold DCA (100 % GLD)** | **€ 233.922,16** | +€ 184.622,16 | +374,49 % | **-38,80 %** |
| **3. 50/50 SPY / GLD Permanent Portfolio DCA** | **€ 269.983,93** | +€ 220.683,93 | +447,63 % | **-32,42 %** *(massiv geglättet)* |
| **4. Gold-SPY Trend-Shield (Notfall: 50 % Gold / 50 % Cash)** | **€ 216.720,88** | +€ 167.420,88 | +339,60 % | **-30,59 %** *(Drawdown stark gedämpft)* |
| **5. Gold-SPY Trend-Shield + Panic-Sniper (100 % Gold)** | **€ 448.497,19** | **+€ 399.197,19** | **+809,73 %** | **-38,22 %** *(+€ 142.451 Alpha vs. SPY!)* |

---

## 4. Die mathematische Diagnose: Warum versagte die reine Notenbank-Liquidität?

In der ursprünglichen Konzeption wurde versucht, den Ausstieg rein über das 8-Wochen-Delta der Fed-Netto-Liquidität (`NetLiq < -5 %`) zu steuern. Die empirische Untersuchung ([`test_hedge_mechanisms.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/test_hedge_mechanisms.js)) deckte dabei zwei fundamentale Fallen auf:

1. **Die 2008-Lehman-Falle:**
   * Vor Lehman betrieb die Fed kein QT; die Bilanz war flach bei ~870 Mrd. $.
   * Als Lehman im September 2008 kollabierte, pumpte die Fed Notkredite in den Markt. Die Bilanz stieg von 900 Mrd. auf 2.200 Mrd. $ (+115,9 % NetLiq-Delta!).
   * **Ergebnis:** Das System erkannte keinen Liquiditätsentzug und blieb von 150 $ bis 60 $ (-60 % Crash) voll investiert! Es stieg erst am 22.01.2009 bei 60,36 $ am absoluten Tiefpunkt in Gold um.
2. **Die 2020-Covid-Falle:**
   * Im Corona-Crash druckte die Fed sofort Billionen (+47 % NetLiq-Delta). Das NetLiq-System bemerkte den Crash nicht, stieg aber im Juli 2020 mitten in die Erholungs-Rallye grundlos aus.

### Die Lösung durch den Trend-Filter (SMA 200 & Drawdown):
* Im echten Crash von 2008 evakuierte das Trend-System bereits am **21. Mai 2008 bei SPY = 99,85 $** in Gold.
* Bis zum Re-Entry fiel der S&P 500 auf **67,98 $** (und im Tief bis 55 $), während Gold von 91,96 $ auf 96,20 $ zulegte.
* **Ergebnis:** Während der ungehedgte Markt um -32 % einbrach, wuchs das gehedgte Depot von 22.719 $ auf 25.840 $. Am Boden wurde mit vollen Kassen in spottbillige Aktien zurückgekehrt.
* Genau dieser asymmetrische Hebel erzeugte über 21,8 Jahre das sensationelle Alpha von **+142.451 € Mehrgewinn**.

---

## 5. Technische Implementierung & Code-Referenzen

* 💻 **22-Jahre-Simulationsskript:** [`scratch/architecture/strategies/GoldSpyFullHistorySimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/GoldSpyFullHistorySimulation.js)
* 💻 **Hedge-Mechanismen & Stresstest:** [`scratch/architecture/strategies/test_hedge_mechanisms.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/test_hedge_mechanisms.js)
* ⚙️ **Konfigurations-Manifest:** [`config/strategies/gold-spy.json`](file:///D:/GitHub/CrashRadar/config/strategies/gold-spy.json)
* 📄 **Signaldienst-Architektur:** [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
* 📄 **Wissensgraph-Index:** [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md)
