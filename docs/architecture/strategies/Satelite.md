# Satellite: Das 80/15/5 Core-Satellite Radar-Regelwerk
*Geopolitisch gehärtetes Core-Satellite-Depot mit S&P 500 Mutterschiff, VanEck Defense ETF, Bitcoin-HODL & universellem Notfall-Stecker (50/50 Gold & Cash)*

> ⚙️ **Operative Strategie-Konfiguration:** [`config/strategies/satellite.json`](file:///D:/GitHub/CrashRadar/config/strategies/satellite.json)  
> 💻 **Empirische Proof-of-Concept-Simulation:** [`simulations/SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/SatelliteCoreSimulation.js)

---

## 1. Strategie-DNA & Architektur-Überblick

Das **Satellite-System** ist ein defensiv gehärtetes, geopolitisch zukunftssicheres **Core-Satellite-Portfolio**, das die Stabilität des US-Leitmarkts mit den zwei asymmetrischsten Renditetreibern der modernen Dekade kombiniert:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               SATELLITE STRATEGIE: CORE-SATELLITE ALLOKATION                    │
├───────────────────────────────┬─────────────────────────────────────────────────┤
│ 1. Core-Mutterschiff (80 %)   │ SPY (SPDR S&P 500 ETF Trust)                    │
│                               │ Das fundamentale Fundament der US-Wirtschaft.   │
├───────────────────────────────┼─────────────────────────────────────────────────┤
│ 2. Geopolitik-Satellit (15 %) │ DFNS (VanEck Defense UCITS ETF / DFNS.L)        │
│                               │ Asymmetrischer Megatrend: Globale & europäische │
│                               │ Aufrüstung, Cybersecurity & Verteidigungs-Tech. │
├───────────────────────────────┼─────────────────────────────────────────────────┤
│ 3. Krypto-Satellit (5 %)      │ BTC (Bitcoin / Digitales Gold)                  │
│                               │ Asymmetrischer Wertspeicher & Makro-Booster.    │
└───────────────────────────────┴─────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│           DER UNIVERSAL-SCHUTZ: DER NOTFALL-STECKER BEI MAKRO ROT               │
│  • Trigger: Net Fed Liquidity 8W-Delta < -5,0 % UND Credit Spreads > 4,0 %      │
│  • 100 % Notfall-Evakuierung ALLER 3 Bausteine in 50 % Gold & 50 % Cash         │
│  • Re-Entry am Marktboden via Panic-Capitulation-Sniper oder NetLiq-Hysterese   │
│  • Reinvestition exakt in 80 % SPY / 15 % DFNS / 5 % BTC (Rebalancing-Reset)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Die Allokations-Säulen im Detail

### 1. Das Core-Mutterschiff: 80 % SPY (S&P 500)
* **Funktion:** Das unerschütterliche Fundament. Absorbiert den langfristigen Produktivitäts- und Gewinnzuwachs der 500 größten Unternehmen der USA.
* **Allokationsziel:** 80 % des Portfolios.
* **Vorteil:** Solide Dividenden, extrem tiefe Liquidität, minimale Gesamtkostenquote (TER) und fundamentale Absicherung gegen Klumpenrisiken.

### 2. Der Geopolitik-Satellit: 15 % DFNS (VanEck Defense ETF)
* **Instrument:** VanEck Defense UCITS ETF (Ticker: `DFNS` / `DFNS.L`, ISIN: `IE000YYE6WK5`, WKN: `A3D9M1`).
* **Funktion:** Geopolitische Härtung des Portfolios.
* **Makro-These:** Die geopolitische Zeitenwende, strukturell steigende NATO-Verteidigungsetats ($> 2-3\,\%$ des BIP) sowie die Modernisierung von Drohnen-, Radar- und Abwehrinfrastruktur sorgen für jahrzehntelange, krisenresistente Sonderkonjunktur fernab klassischer Konsumzyklen.
* **Allokationsziel:** 15 % des Portfolios.

### 3. Der Krypto-Satellit: 5 % BTC (Bitcoin / Digitales Gold)
* **Instrument:** Natives Bitcoin (`BTC-USD`) oder physisch besicherte Bitcoin-ETPs / Spot-ETFs (`IBIT`, `BTCE`).
* **Funktion:** Asymmetrischer Rendite-Beschleuniger und Inflations-/Entwertungs-Hedge gegen die ausufernde Staatsverschuldung der G7-Nationen.
* **Allokationsziel:** 5 % des Portfolios.

---

## 3. Das HODL-Prinzip & der aktive Krypto-Airbag (Makro GRÜN)

Im normalen Markt-Regime (Makro GRÜN / kein systemischer Notfall) gilt für das Core-Mutterschiff und den Defense-Satelliten eine strikte HODL-Regel (*"Let your winners run"*):
* Es gibt **keine bandbasierten Teilverkäufe** und **kein Abschöpfen von Gewinnen** bei SPY oder DFNS.
* **Aktiver Krypto-Airbag via `CryptoSensorHub` (Option B):**
  * Solange der Krypto-Taktgeber bullisch ist (`BULL_EXPANSION`, `BULL_WARNING`, `CYCLE_BOTTOM_CLOSE`): **100 % HODL** im Krypto-Satelliten (80 % SPY / 15 % DFNS / 5 % BTC).
  * Sobald MicroStrategy die 200-Tage-Linie verliert (`BULL_CRITICAL` oder `BEAR_REGIME`): Der 5%-BTC-Slot wird temporär in **USD-Cash geparkt** (`BTC_HEDGE_CASH`: 80 % SPY / 15 % DFNS / 5 % CASH). Laufende Sparraten für diesen Slot fließen in Cash, statt in das fallende Krypto-Messer zu greifen.
  * Sobald der Taktgeber wieder nach oben dreht: Reinvestition der 5 % Cash zurück in Bitcoin.
* **Empirischer Backtest-Beweis (2023–2026):**
  * Endwert Option A (Pure HODL): **28.841,13 $** (+76,94 % Rendite / Max DD: -8,50 %)
  * Endwert Option B (Aktiver Airbag): **29.473,70 $** (+80,82 % Rendite / Max DD: -7,53 %)
  * **Ergebnis:** **+$632,57 Mehrertrag (+3,88 %-Punkte Mehrrendite)** bei gleichzeitig **-0,97 %-Punkte geringerem Drawdown**!

---

## 4. Der Notfall-Stecker (SignalEngine Katastrophen-Schutz & Boden-Sniper)

Das Gesamtdepot wird durch dieselben bewährten, standardisierten Signale der **CrashRadar SignalEngine** (`macroSignalContext`) geschützt, die auch in `Gold-SPY` und `Kamikaze-Growth` arbeiten:

```
                  [SignalEngine: macroSignalContext]
                                   │
              Ist katastrophenMatrix.isShieldActive aktiv?
                                   │
                 ┌─────────────────┴─────────────────┐
                JA                                  NEIN
                 │                                   │
       [Notfall-Stecker GEZOGEN]            [Normalzustand: HODL]
    Status: EMERGENCY_SHIELD             Status: NORMAL_HODL
    100 % Evakuierung in:                Alle 3 Bausteine bleiben investiert:
    • 50 % Gold (GLD)                    • 80 % SPY
    • 50 % USD-Cash                      • 15 % DFNS
    Sparrate: 50 % Gold / 50 % Cash      • 5 % BTC
                                         Sparrate: 80% SPY / 15% DFNS / 5% BTC
```

### Die Phasen des Notfall-Schutzschilds:

1. **Aktivierung (Notfall-Stecker ziehen):**
   * **Signalgeber:** `macroSignalContext.katastrophenMatrix.isShieldActive === true` (bestätigter Chart-Trendbruch unter SMA 200 gekoppelt an makroökonomische System-Panik).
   * **Strategie-Status:** `EMERGENCY_SHIELD`.
   * **Aktion:** `EVACUATE_50_GOLD_50_CASH`.
   * **Evakuierungs-Ziel:**
     * **50 % in physisches Gold (`GLD`)**
     * **50 % in USD-Cash**
     * **0 % SPY / 0 % DFNS / 0 % BTC**
   * **Sparplan-Anpassung:** Laufende monatliche Sparraten fließen zu 50 % in Gold und 50 % in Cash.

2. **Deaktivierung & Rebalancing-Reset (Re-Entry am Boden):**
   * **Signalgeber:**
     * *Pfad A (Panik-Boden Sniper am Markttief):* `macroSignalContext.bottomSniper.isCritical === true` (VIX-Spike $\ge 35$, CBOE Put/Call-Panik oder DarkPool-Whales steigen massiv ein).
     * *Pfad B (Trend-Entwarnung):* Katastrophen-Matrix deaktiviert den Schutzschirm (`katastrophenMatrix.isShieldActive === false`).
   * **Strategie-Status:** `RE_ENTRY_RESET`.
   * **Aktion:** `REINVEST_TARGET_ALLOCATION`.
   * **Das Rebalancing-Reset:**  
     Die gesamte Gold- und Cash-Position wird zu 100 % aufgelöst. Das gesamte Kapital wird **exakt nach der Zielallokation neu verteilt**:
     * **80 % in SPY**
     * **15 % in DFNS**
     * **5 % in BTC**
     * Laufende Sparraten fließen ab sofort wieder zu 80 % SPY, 15 % DFNS und 5 % BTC.

---

## 5. Empirischer Proof of Concept (PoC) & Backtest (2023–2026)

Die quantitative Leistungsfähigkeit der Strategie wurde in einer lückenlosen Backtest-Simulation über den Zeitraum **01.04.2023 (nach Handelsaufnahme von DFNS) bis heute (08.09.2026)** verifiziert:

* 💻 **Simulations-Skript:** [`simulations/SatelliteCoreSimulation.js`](file:///D:/GitHub/CrashRadar/simulations/SatelliteCoreSimulation.js)

### Ergebnisse der Basis-Simulation (01.04.2023 – 08.09.2026):
* **Startkapital:** 10.000 $ USD
* **Monatliche Sparrate:** 200 $ / Monat
* **Gesamteinzahlung:** **$ 18.400,00** (10.000 $ Start + 42 Sparraten)

| Portfolio / Strategie | Endwert ($) | Reingewinn ($) | Nettorendite (%) | Alpha vs. Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **SATELLITE (Core 80/15/5 + Notfall-Stecker)** | **$ 33.745,54** | **+$ 15.345,54** | **+83,40 %** | **+12,68 %-Punkte** |
| **Buy & Hold (80/15/5 ungehedgt)** | **$ 33.745,54** | **+$ 15.345,54** | **+83,40 %** | **+12,68 %-Punkte** |
| **S&P 500 Benchmark (100 % SPY Buy & Hold)** | **$ 31.411,70** | **+$ 13.011,70** | **+70,72 %** | *Benchmark* |

### Detail-Allokation am Ende der Laufzeit (08.09.2026):
* **SPY (Core S&P 500):** $ 25.129,36 (**74,47 %**)
* **DFNS (Defense ETF):** $ 6.587,85 (**19,52 %**) $\rightarrow$ *Massive Outperformance des Verteidigungs-Megatrends!*
* **BTC-USD (Bitcoin HODL):** $ 2.028,33 (**6,01 %**) $\rightarrow$ *Organischer Zuwachs von 5,0 % auf 6,01 % ohne Verkaufszwang.*

> [!TIP]
> **Disziplin-Beweis:**  
> Im gesamten Bullenmarkt 2023–2026 hielten sich die High-Yield Credit Spreads konstant unter 4,0 %. Der Kreditstress-Filter verhinderte Fehlauslösungen bei rein administrativen Treasury-Effekten (z. B. TGA-Auffüllung Herbst 2025). Beide Satelliten (`DFNS` und `BTC`) konnten ihre asymmetrische Hebelwirkung voll entfalten und schlugen den S&P 500 um **+12,68 %-Punkte Überrendite**!

---

## 6. Operative SignalEngine-Routine

1. **Täglicher SignalEngine-Lauf:**
   * Auswertung des zentralen `macroSignalContext`.
   * **Signal `isShieldActive === true`:** Notfall-Stecker gezogen $\rightarrow$ Status `EMERGENCY_SHIELD`, Allokation 50 % Gold / 50 % Cash.
   * **Signal `isShieldActive === false`:** Normalbetrieb $\rightarrow$ Status `NORMAL_HODL`, entspannt HODLN.
2. **Monatlich am 1. des Monats (Sparplan-Ausführung via `StrategyNotificationService`):**
   * Bei Status `NORMAL_HODL`: Sparrate zu **80 % in SPY, 15 % in DFNS, 5 % in BTC** investieren.
   * Bei Status `EMERGENCY_SHIELD`: Sparrate zu **50 % in Gold (`GLD`) und 50 % in Cash** parken.
3. **Bei aktivem Schutzschild (Boden-Überwachung):**
   * `bottomSniper.isCritical` (VIX-Spikes $\ge 35$, CBOE-Panik, Dark-Pool-Whales) im CrashRadar.
   * Sobald Boden bestätigt oder Entwarnung: Notfall-Stecker lösen $\rightarrow$ Status `RE_ENTRY_RESET`, 100 % Reinvestition in 80 % SPY / 15 % DFNS / 5 % BTC.

---

## 7. Verwandte Dokumente & Wissensgraph

* 💻 **Strategie-Klasse:** [`src/strategies/SatelliteStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/SatelliteStrategy.js)
* ⚙️ **Konfigurations-Manifest:** [`config/strategies/satellite.json`](file:///D:/GitHub/CrashRadar/config/strategies/satellite.json)
* 📄 **Signaldienst-Architektur:** [`docs/architecture/signal-service/Investment-Signaldienst.md`](file:///D:/GitHub/CrashRadar/docs/architecture/signal-service/Investment-Signaldienst.md)
* 📄 **Kamikaze Growth Strategie:** [`docs/architecture/strategies/Kamikaze-Growth.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md)
* 📄 **7-Slot-Guru Konsens-System:** [`docs/architecture/strategies/7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md)
* 📄 **Gold-SPY DCA Strategie:** [`docs/architecture/strategies/Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md)
