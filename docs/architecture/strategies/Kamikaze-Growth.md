# Kamikaze Growth (KMG): Das 50/50 High-Conviction Radar-Regelwerk
*Organischer High-Beta Tech- & Krypto-Equity-Accelerator mit 90k $ Startpool, S&P 500 Mutterschiff, Makro-Gold-Schild & irregulärem Staking-Satelliten*

> ⚙️ **Operative Strategie-Konfiguration & Live-Bestand:** [`config/strategies/kamikaze-growth.json`](file:///D:/GitHub/CrashRadar/config/strategies/kamikaze-growth.json)

---

## 1. Das finale Regelkonstrukt im Überblick

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      KAMIKAZE USER-CURATED MASTER-WATCHLIST                     │
│  • Tier 1 (Core Observe): PLTR, SOFI (Primäre Einstiegsziele)                  │
│  • Tier 2 (Fallback Observe): ZETA, SOUN (Opportunistisch, falls Tier 1 teuer) │
│  • Krypto-Equities: MSTR, MARA, BMNR, BLSH (Gesteuert via BTC 21W-EMA)          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
             ┌───────────────────────────┴───────────────────────────┐
             ▼                                                       ▼
┌────────────────────────────────────────┐ ┌─────────────────────────────────────┐
│            TECH SUB-BUCKET             │ │          KRYPTO SUB-BUCKET          │
│     (50 % Strategische Allokation)     │ │    (50 % Strategische Allokation)   │
├────────────────────────────────────────┤ ├─────────────────────────────────────┤
│ • Aktive Kern-Bestände (HOLD & BUY):   │ │ • High-Beta Krypto-Equities:        │
│   AIRO, LUMN, IBRX, NVTS, S            │ │   MSTR, MARA, BMNR, BLSH            │
│ • Phase-Out Bestände (HOLD_ONLY):      │ │ • Kein Direktinvestment in BTC!     │
│   SEMI, CDNX, PGY (Verkaufserlöse      │ │ • Regime-Master: BTC 21-Wochen-EMA  │
│   fließen zu 100% ins Mutterschiff)    │ │ • 40/30/30-Gleichgewichts-Pyramide  │
│ • Türsteher: Weinstein Stage-2, SMA200 │ │ • Bärenmarkt-Parkplatz:             │
│ • Fundamental-Gate: >= 15 % YoY / Turn │ │   Interner Krypto-Claim im SPY-Pool │
│ • Zündfunken: 35 % aus freiem SPY-Pool │ │                                     │
│ • 3-Stufen-Exit (1/3 Knick, 1/3 SMA200)│ │ 🛰️ EIGENER STAKING-SATELLIT (EUR):  │
│ • Sektor-Relativität (IGV, SMH, QQQ...)│ │ • 2.088,20 € Startkapital (50/50    │
│                                        │ │   ETH- & SOL-Staking aus Gehalt)    │
└───────────────────┬────────────────────┘ └───────────────────┬─────────────────┘
                    │                                          │
                    └────────────────────┬─────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DAS S&P 500 MUTTERSCHIFF                              │
│                         (Renditestarker Master-Pool)                            │
│  • Basis-Kapital: ~94.000 $ USD-Depotvolumen (keine monatliche Core-Sparrate)   │
│  • Liquidität: $7.034 freies USD-Cash + $4.287 Limit-Orders (200x S, 25x PGY)   │
│  • Absorbiert ~32.000 $ Erlöse aus den auslaufenden Beständen (SEMI, CDNX, PGY) │
│  • Schüttet dynamische Zündfunken (35 % des freien Mutterschiffs) an Tech aus   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│        ÜBERGEORDNETER MAKRO-SCHUTZ: 100 % NOTFALL-EVAKUIERUNG (50/50)           │
│  • Makro ROT (Net Fed Liquidity 8W-Delta < -5,0 % oder Credit Spreads > 4,0 %)  │
│  • 100 % Evakuierung von Tech-Aktien & Mutterschiff in 50 % Gold & 50 % Cash    │
│  • Strikter Neukauf- und Dip-Buying-Stopp bei Makro-Alarm                       │
│  • Dual-Re-Entry-Sniper: Panic-Capitulation (VIX >= 35) oder NetLiq-Wende       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Die Kernregeln im Detail

### 1. Das Anlage-Universum & Die User-Curated Watchlist

Im Unterschied zum *Muzzled-Cathie-Wood (MCW)* System wird die Watchlist nicht durch externe Fonds-Transaktionen (ARK Invest) gespeist, sondern **vom Investor selbst kuratiert**:
* **Ideen-Pool:** Sobald der Investor eine disruptive High-Growth-Idee identifiziert, wird der Ticker eigenhändig auf die Watchlist gesetzt.
* **Status standardmäßig `OBSERVE`:** Ein manuell hinzugefügter Titel landet ausnahmslos mit dem Status **`OBSERVE`** auf der Watchlist. Ein sofortiger Kauf ist streng verboten!
* **Historischer Anker (`firstSeenDate`):** Jeder Ticker führt ein Registrierungsdatum, ab wann er auf der Beobachtungsliste stand. Ein Stage-2-Ausbruch vor diesem Datum wird vom System ignoriert.

#### A. Das reale Start-Depot (Aktive Bestände zum Stichtag 08.09.2026):

Das Portfolio startet nicht auf der grünen Wiese, sondern übernimmt einen konkreten Realbestand von **8 Positionen** im Gegenwert von **$ 83.064,80**:

| Ticker | Bezeichnung / Sektor | Bestand (Stk.) | Ø Kaufpreis | Investiertes Kapital | Status | Phase-Out / Re-Observe Flag |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AIRO** | KI-Autonomie & Aerospace Tech | 2.600 | 6,38 $ | 16.588,00 $ | `HOLD & BUY` | Standard (`return_to_observe: true`) |
| **LUMN** | Lumen Tech / Fiber AI Infra | 2.500 | 6,12 $ | 15.300,00 $ | `HOLD & BUY` | Standard (`return_to_observe: true`) |
| **SEMI** | Semiconductor ETF | 650 | 19,325 $ | 12.561,25 $ | `HOLD_ONLY` | **Auslaufposition (`return_to_observe: false`)** |
| **IBRX** | Immuntherapie & Onkologie | 1.875 | 7,31 $ | 13.706,25 $ | `HOLD & BUY` | Standard (`return_to_observe: true`) |
| **CDNX** | CleanTech Energy ETF | 7,5 | 1.654,04 $ | 12.405,30 $ | `HOLD_ONLY` | **Auslaufposition (`return_to_observe: false`)** |
| **PGY** | Pagaya Technologies (Fintech) | 325 | 21,68 $ | 7.046,00 $ | `HOLD_ONLY` | **Auslaufposition (`return_to_observe: false`)** |
| **NVTS** | GaN / SiC Power Chips | 300 | 9,91 $ | 2.973,00 $ | `HOLD & BUY` | Standard (`return_to_observe: true`) |
| **S** | SentinelOne (Cybersecurity) | 125 | 19,88 $ | 2.485,00 $ | `HOLD & BUY` | Standard (`return_to_observe: true`) |

> [!IMPORTANT]
> **Die Auslauf-Positionen (`SEMI`, `CDNX`, `PGY`):**  
> Diese 3 Positionen binden aktuell **$ 32.012,55 (über 38 % des investierten Kapitals)**. Sie erhalten den Status `HOLD_ONLY` (keine Zündfunken-Nachkäufe). Bei Exit fließen die Erlöse zu 100 % in das S&P 500 Mutterschiff, und die Ticker werden archiviert (`return_to_observe: false`), sodass sie nicht wieder als Kaufsignal aufpoppen.

#### B. Die Zweistufige Watchlist (Core vs. Fallback) & Krypto-Silo:

Die Beobachtungsliste (`OBSERVE`) unterscheidet strikt zwischen primären Kern-Zielen und opportunistischen Fallbacks:

| Ticker | Kategorie | Priorität / Ebene | Logik & Auslöser |
| :--- | :--- | :--- | :--- |
| **PLTR** | Tech | **Tier 1 (Core)** | Primäres Einstiegsziel bei charttechnischer Konsolidierung |
| **SOFI** | Tech | **Tier 1 (Core)** | Primäres Einstiegsziel bei gesundem Stage-2-Rücklauf |
| **ZETA** | Tech | **Tier 2 (Fallback)** | Opportunistisch: Kauf nur wenn Tier 1 nicht konsolidiert / zu heiß läuft |
| **SOUN** | Tech | **Tier 2 (Fallback)** | Opportunistisch: Kauf nur wenn Tier 1 nicht konsolidiert / zu heiß läuft |
| **MSTR** | Krypto-Equity | Krypto-Silo | Zündet über 40/30/30-Pyramide, sobald BTC > 21-Wochen-EMA schließt |
| **MARA** | Krypto-Equity | Krypto-Silo | Zündet über 40/30/30-Pyramide, sobald BTC > 21-Wochen-EMA schließt |
| **BMNR** | Krypto-Equity | Krypto-Silo | Zündet über 40/30/30-Pyramide, sobald BTC > 21-Wochen-EMA schließt |
| **BLSH** | Krypto-Equity | Krypto-Silo | Zündet über 40/30/30-Pyramide, sobald BTC > 21-Wochen-EMA schließt |

* **Besonderheit Krypto Sub-Bucket:** **Kein Direktinvestment in Bitcoin (`BTC`)!** Die Allokation erfolgt ausschließlich in die hochbeta Krypto-Aktien der Watchlist, gesteuert durch den BTC 21W-EMA als Regime-Schalter.
* **Separater Staking-Satellit (EUR):**
  * Unabhängig vom USD-Core-Depot führt der Investor einen eigenen **EUR-Staking-Topf** (Startkapital: **2.088,20 €**).
  * Zielallokation: **50 % Ethereum-Staking / 50 % Solana-Staking** ETPs (`ETHE` wird gegen EUR-Pendant getauscht, `SLNC`).
  * Wird opportunistisch aus Gehaltsüberschüssen dotiert und dient als externer Cashflow-Beschleuniger.

---

### 2. Kapitalallokation & Die realen Cash-Pots

* **Währungs-Regime:** Die Kernstrategie wird nativ auf **US-Dollar-Basis ($ USD)** geführt.
* **Aktives Gesamt-Depotvolumen (Stichtag 08.09.2026):** **$ 94.386,47**
  * **Investiert in 8 Bestände:** **$ 83.064,80**
  * **Freies USD-Cash (verzinst auf Verrechnungskonto):** **$ 7.034,67**
  * **Gebunden in offenen Limit-Orders:** **$ 4.287,00**
    * SentinelOne (`S`): 200 Stk. @ 18,80 $ = $ 3.760,00
    * Pagaya (`PGY`): 25 Stk. @ 21,08 $ = $ 527,00
* **Autarke Finanzierung ohne Sparrate:**
  * In das USD-Hauptdepot fließt keine starre monatliche Sparrate.
  * Das System finanziert sich vollständig autark: Bei Teilverkäufen und insbesondere bei der Liquidation der 3 Auslaufpositionen (~32.000 $) fließt das freiwerdende Kapital in das **S&P 500 Mutterschiff** und nährt neue Zündfunken für `PLTR`, `SOFI` oder das Krypto-Silo.
* **Strategische 50/50-Grundaufteilung:**
  * **50 % Tech-Reserve:** Investiert in aktive Kernbestände bzw. im S&P 500 Mutterschiff (`SPY`).
  * **50 % Krypto-Budget:**
    * Notiert Bitcoin *über* seinem 21-Wochen-EMA $\rightarrow$ Das Kapital wird über die 40/30/30-Pyramide in die 4 Krypto-Aktien investiert.
    * Notiert Bitcoin *unter* seinem 21-Wochen-EMA $\rightarrow$ Das Kapital parkt als zinstragende Leihgabe (`kryptoClaimUSD`) im S&P 500 Mutterschiff.

---

### 3. Der Einstiegs-Türsteher: Weinstein Stage-2 & SEC 10-Q Gate

Ein Kauf aus dem Status `OBSERVE` ist strikt verboten, bis die Aktie alle Kriterien des **Einstiegs-Türstehers** erfüllt:

#### A. Charttechnischer Stage-2-Ausbruch:
1. **50-Tage-Konsolidierungs-Ausbruch:** $\text{Kurs} > \max_{50d}(\text{High})$.
2. **Nachhaltiger Trend:** $\text{Kurs} > \text{SMA}_{200}$ **und** $\text{Kurs} > \text{SMA}_{50}$ **und** $\text{SMA}_{50} > \text{SMA}_{200}$.
3. **Relative Stärke:** $\text{RS}(\text{Aktie vs. QQQ}) > \text{SMA}_{50}(\text{RS})$.
4. **Institutioneller Volumen-Spike:** $\text{Volumen} \ge 1,5 \times \text{SMA}_{50}(\text{Volumen})$.

#### B. Eiserne Regel: Kein Kauf ohne Fundamentaldaten (Keine Daten, kein Kauf):
* Liegen für ein Wertpapier keine verifizierten aktuellen SEC 10-Q/6-K-Quartalszahlen im System vor, bleibt der Kauf **strikt verboten**!
* **Qualifikations-Kriterien:**
  * YoY-Umsatzwachstum $\ge 15,0\,\%$ **ODER** operativer GAAP-Profitabilitäts-Turnaround ($\text{Net Income} > 0$).
  * **Ausschluss von Bilanzkollapsen:** Ist $\text{Net Income} < 0$ und $|\text{Net Income}| > 2,0 \times \text{Umsatz}$, wird der Titel trotz Chartausbruchs abgewiesen.

#### C. Dynamische Zündfunken-Allokation:
* Gibt der Türsteher grünes Licht, investiert das System **35 % des aktuell im S&P 500 Mutterschiff freien Kapitals** in die Aktie.
* **Tier-Priorisierung:** Tier-1-Werte (`PLTR`, `SOFI`) haben absolute Priorität. Tier-2-Werte (`ZETA`, `SOUN`) dürfen den 35 %-Zündfunken nur beanspruchen, wenn Tier 1 keine Ausbruchssignale liefert und überschüssiges Cash im Mutterschiff liegt.
* Nach dem Kauf wechselt der Status der Position auf **`HOLD & BUY`** (geschützter Gewinner).

---

### 4. Krypto-Sub-Bucket: Der 21-Wochen-EMA Regime-Zyklus

Da Krypto-Equities (`MSTR`, `MARA`, etc.) extreme Volatilität aufweisen, steuert der übergeordnete Trend von Bitcoin den Krypto-Bucket absolut digital:

1. **Bärenmarkt-Exit (BTC bricht 21-Wochen-EMA):**
   * Alle Krypto-Aktien (`MSTR`, `MARA`, `BMNR`, `BLSH`) werden zu **100 % liquidiert**.
   * Status wechselt zurück auf **`OBSERVE (Krypto)`**.
   * Der gesamte Erlös wird als **feste Krypto-Forderung (`kryptoClaimUSD`)** registriert und parkt als Leihgabe im S&P 500 Mutterschiff.
2. **Bullenmarkt-Re-Entry (BTC schließt über 21-Wochen-EMA):**
   * Das Krypto-Silo fordert seine Liquidität aus dem Mutterschiff zurück.
   * **Die 40 / 30 / 30 Gleichgewichtungs-Pyramide:**
     * **Tranche 1 (40 % des Krypto-Kapitals):** Zündet sofort bei Wochenschluss über dem 21W-EMA und teilt sich zu exakt gleichen Anteilen auf alle verfügbaren Krypto-Aktien auf.
     * **Tranche 2 (30 % des Krypto-Kapitals):** Zündet nach 15 Handelstagen stabiler Trendbestätigung.
     * **Tranche 3 (30 % des Krypto-Kapitals):** Vollendet nach 30 Handelstagen die 100 % Allokation.

---

### 5. Tech-Exit: Sektor-Relativität, Flag-System & 3-Stufen-Abbau

Echte Hypergrowth-Gewinner (z. B. Palantir oder SentinelOne) dürfen bei unverschuldeten Branchen-Dips nicht panisch verkauft werden. Gleichzeitig müssen fundamentale Flops konsequent eliminiert werden:

#### A. Sektor-Relativität:
* Gemessen am branchenspezifischen Sektor-ETF (z. B. `IGV` für Software wie PLTR & S, `SMH` für Halbleiter wie NVTS):
  $$\text{rsSector}_t = \frac{\text{Kurs}_{\text{Aktie}, t}}{\text{Kurs}_{\text{Sektor-ETF}, t}}$$
* Solange $\text{rsSector} \ge \text{SMA}_{50}(\text{rsSector})$ gilt, greift die **Branchen-Immunität**: Ein Ausstieg ist verboten, stattdessen darf bei Sektor-Paniken konträr nachgekauft werden.

#### B. Das fundamentale Flag-System & Der 3-stufige Abbau:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│     STUFE 1: EARNINGS-GROWTH-KNICK (1/3 TEIL-EXIT ZU GUTEM PREIS)       │
│  Bedingung: Erstes 10-Q mit YoY-Umsatzwachstum < 15–18 % oder Kollaps.  │
│  Aktion:    • 1/3 der Position wird sofort verkauft (Gewinnsicherung).  │
│             • Status wechselt von HOLD & BUY auf HOLD & OBSERVE.        │
│             • Erlös fließt bevorzugt in HOLD & BUY Titel (sonst SPY).   │
│             • Es verbleiben 2/3 der Position im Depot.                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [Stabil über SMA 200 bis Folge-Q]       [Sinkflug vor nächsten Zahlen]
    Bestand bleibt bei 2/3.                 Kurs < SMA 200 (3 Tage) &
                 │                          relative Sektor-Schwäche.
                 │                                       │
                 │                                       ▼
                 │                          ┌─────────────────────────────┐
                 │                          │ STUFE 2: DER TREND-NOTANKER │
                 │                          │ • Weiteres 1/3 verkauft.    │
                 │                          │ • Verbleib: 1/3 im Depot.   │
                 └───────────────────┬──────┴─────────────────────────────┘
                                     │
                                     ▼
                     [DIE NÄCHSTEN QUARTALSZAHLEN]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [Szenario Positiv: REHABILITATION]      [Szenario Negativ: ENTTÄUSCHUNG]
    Zahlen beschleunigen wieder (>= 20 %)   Zweites schwaches Quartal in Folge.
    • Status zurück auf: HOLD & BUY!        • Status-Wechsel: SELL!
    • Verkaufsblockade wieder aktiv!        • 100 % REST-LIQUIDIERUNG!
    • Restbestand bleibt eisern geschützt.  • Position wird komplett gelöscht.
```

#### C. Konträres Dip-Buying:
* Befindet sich eine Aktie im Status `HOLD & BUY` und erleidet einen Branchen-Dip ($\text{Sektor-Return}_{5d} \le -3,5\,\%$ oder Aktie $\le -10\,\%$ vom 50T-Hoch unter EMA 20):
* Liegt freies Kapital im Mutterschiff vor und ist Makro GRÜN $\rightarrow$ Nachkauf von **15 % des freien Mutterschiff-Kapitals** (mindestens 20 Handelstage Cooldown).

#### D. Phase-Out & Legacy-Positionen-Liquidierung (`SEMI`, `CDNX`, `PGY`):
* **Status `HOLD_ONLY`:** Diese 3 Bestände binden aktuell **$ 32.012,55**. Sie sind von allen künftigen Zündfunken-Nachkäufen strikt ausgeschlossen.
* **Exit-Prozess:** Der Verkauf erfolgt diszipliniert über Trendbrüche (SMA 200), Climax-Exits oder diskretionäre Zielerreichung.
* **100 % Re-Allokation ins Mutterschiff:** Die Verkaufserlöse fließen ausnahmslos in das **S&P 500 Mutterschiff (`SPY`)**, um als Liquiditätspool für neue Stage-2-Zündfunken (`PLTR`, `SOFI`) und Krypto-Tranchen zu dienen.
* **Dauerhafte Archivierung (`return_to_observe: false`):** Nach der vollständigen Liquidation wird der Ticker dauerhaft aus der Watchlist entfernt und rutscht nicht mehr in den Status `OBSERVE` zurück.
* **Sonderfall offene Limit-Order (`PGY`):** Die bestehende Kauf-Limit-Order über 25 Stk. @ 21,08 $ ($ 527) stammt aus der Vorperiode. Sollte sie im Markt noch bedient werden, erhöht sie den Bestand temporär auf 350 Stk., verbleibt jedoch unverändert im Status `HOLD_ONLY` zur vollständigen Liquidation. Weitere Neukäufe sind ausgeschlossen.

---

### 6. Übergeordneter Makro-Schutz: 100 % Notfall-Evakuierung (50 % Gold / 50 % Cash)

Wenn das Finanzsystem unter Liquiditätsentzug leidet, greift der übergeordnete Schutzschirm:

#### A. Trigger Makro ROT:
1. **Druckenmiller Net Fed Liquidity:** $8\text{W-Delta} < -5,0\,\%$.
2. **Credit Spreads:** $\text{BAMLH0A0HYM2} > 4,0\,\%$ und über dem 50-Tage-Durchschnitt.

#### B. Evakuierungs-Aktion:
* **Ausnahmslos ALLE Tech-Positionen UND das S&P 500 Mutterschiff werden zu 100 % liquidiert.**
* **Allokation der Erlöse:**
  * **50 % in physisches Gold (`GLD`)**
  * **50 % in Cash (USD)**
* **0 % Markt- und Beta-Risiko während systemischer Stürme.**

#### C. Dual-Re-Entry-Sniper:
1. **Pfad 1 (Reguläre Hysterese):** Net Fed Liquidity $8\text{W-Delta}$ erholt sich auf $\ge 0,0\,\%$.
2. **Pfad 2 (Panic-Capitulation-Sniper):** Volatilitäts-Spike $\text{VIX} \ge 35$ mit Reversal unter 30 oder CrashRadar Indicator `CRITICAL`.
* Bei Auslösung wird der Schutzschirm aufgelöst: Das gesamte Kapital fließt unbeschadet zurück in das S&P 500 Mutterschiff, um neue Stage-2-Zündfunken am Bärenmarkt-Tief mit voller Kraft einzusammeln!

---

## 3. Empirischer Proof of Concept (PoC) & Simulations-Ergebnisse (2021–2026)

Die quantitative Leistungsfähigkeit der **Kamikaze-Growth-Architektur** (50/50 Allokation Tech & Krypto-Equities, $90.000 Startpool, kein Blind-Kauf ohne 10-Q Fundamentaldaten, Sektor-Dip-Buying, 3-Stufen-Abbau und 100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash) wurde über den Zeitraum vom **04.01.2021 bis 04.09.2026** simuliert:

* 💻 **Vollständige Portfolio-Simulation:** [`scratch/architecture/strategies/KamikazeGrowthSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/KamikazeGrowthSimulation.js)
* 📊 **Fundamentaldaten-Master-Cache (SEC EDGAR):** [`scratch/architecture/strategies/fundamentals_master.json`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/fundamentals_master.json)
* ⚙️ **Realer Portfolio-Zustand & Live-Konfiguration:** [`config/strategies/kamikaze-growth.json`](file:///D:/GitHub/CrashRadar/config/strategies/kamikaze-growth.json)

### A. Performance- und Benchmark-Vergleich (2021–2026 Backtest):

| Kennzahl | S&P 500 (SPY Buy & Hold) | Nasdaq 100 (QQQ Buy & Hold) | Bitcoin (BTC Buy & Hold) | KAMIKAZE GROWTH STRATEGIE | Delta KMG vs. Benchmarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Startkapital** | $ 90.000,00 | $ 90.000,00 | $ 90.000,00 | **$ 90.000,00** | ± $ 0,00 |
| **Endwert Portfolio** | $ 202.419,00 | $ 216.081,00 | $ 224.271,00 | **$ 605.705,67** | **+$ 403.286,67 Mehrwert vs. SPY** |
| **Nettorendite** | +124,91 % | +140,09 % | +149,19 % | **+573,01 %** | **+448,10 %-Pkt. vs. SPY** |
| **Nettogewinn** | +$ 112.419,00 | +$ 126.081,00 | +$ 134.271,00 | **+$ 515.705,67** | **+$ 381.434,67 vs. BTC** |
| **Alpha vs. SPY** | Baseline | +15,18 %-Pkt. | +24,28 %-Pkt. | **+448,10 %-Punkte** | **Massive Outperformance** |
| **Alpha vs. QQQ** | -15,18 %-Pkt. | Baseline | +9,10 %-Pkt. | **+432,92 %-Punkte** | **+432,92 %-Punkte** |
| **Alpha vs. BTC** | -24,28 %-Pkt. | -9,10 %-Pkt. | Baseline | **+423,82 %-Punkte** | **+423,82 %-Punkte** |
| **Maximaler Drawdown** | -24,50 % | -33,10 % | -76,80 % | **-42,76 %** | **Vollständiger Schutz vor Krypto-Winter (-76 %)** |

---

### B. Reale Depot-Allokation zum Stichtag (08.09.2026):

Die Live-Umsetzung in [`config/strategies/kamikaze-growth.json`](file:///D:/GitHub/CrashRadar/config/strategies/kamikaze-growth.json) gliedert sich in folgende konkrete Bausteine:

* **Aktive Kern-Positionen (`HOLD & BUY`):** **$ 51.052,25 (54,1 %)**
  * AIRO: 2.600 Stk. @ 6,38 $ = $ 16.588,00
  * LUMN: 2.500 Stk. @ 6,12 $ = $ 15.300,00
  * IBRX: 1.875 Stk. @ 7,31 $ = $ 13.706,25
  * NVTS: 300 Stk. @ 9,91 $ = $ 2.973,00
  * S: 125 Stk. @ 19,88 $ = $ 2.485,00
* **Auslauf-Bestände (`HOLD_ONLY` - Phase-Out):** **$ 32.012,55 (33,9 %)**
  * SEMI (Halbleiter-ETF): 650 Stk. @ 19,325 $ = $ 12.561,25
  * CDNX (CleanTech-ETF): 7,5 Stk. @ 1.654,04 $ = $ 12.405,30
  * PGY (Pagaya Tech): 325 Stk. @ 21,68 $ = $ 7.046,00
* **Liquidität & Offene Orders:** **$ 11.321,67 (12,0 %)**
  * Freies verzinstes USD-Cash: **$ 7.034,67**
  * Reserviert in Limit-Orders: **$ 4.287,00** (200x `S` @ 18,80 $ = $ 3.760,00 | 25x `PGY` @ 21,08 $ = $ 527,00)
* **Gesamtes USD-Portfolio:** **$ 94.386,47**
* **Autarker EUR-Satellit:** **2.088,20 €** bereitgestellt für 50/50 Staking-ETPs (ETH & SOL).

---

### C. Empirische Verhaltens-Highlights der Strategie:

1. **Navitas Semiconductor (`NVTS` – Perfekter Zombie-Schutz via 3-Stufen-Abbau):**
   * Stieg nach einem Stage-2-Ausbruch ins Depot ein.
   * Am **05.08.2024** meldete NVTS ein abflauendes YoY-Umsatzwachstum von nur noch 13,3 %. Sofort griff **Stufe 1** (1/3 Teil-Exit @ $ 3,05 zur Gewinnsicherung, Status auf `HOLD & OBSERVE`).
   * Da NVTS gleichzeitig unter den SMA 200 fiel und relative Branchen-Schwäche zeigte, feuerte am selben Tag **Stufe 2** (weiteres 1/3 Exit @ $ 3,05). Die freigewordenen Mittel ($ 9.224) wurden unverzüglich in die aktiven `HOLD & BUY` Spitzenreiter (`PLTR`, `SOFI`) umgeschichtet!
   * Am **05.11.2024** bestätigte der nächste 10-Q-Report den Einbruch mit negativem Wachstum (-1,4 %). Sofort liquidierte **Stufe 3** den Restbestand @ $ 2,36. NVTS wurde vollständig abgestoßen, bevor die Aktie weiter in den Boden versank.

2. **Krypto-Equity Taktung via BTC 21W-EMA:**
   * Anstatt in harten Bärenmärkten 70–80 % Drawdown bei Krypto-Minern und High-Beta-Aktien auszusitzen, liquidierte das System bei jedem Bruch des 21-Wochen-EMA von Bitcoin (z. B. August 2024, Januar 2026, Mai 2026) 100 % der Krypto-Aktien und parkte das Kapital als verzinslichen Krypto-Claim im S&P 500 Mutterschiff.
   * Erst bei nachhaltiger Rückeroberung der 21W-Linie stieg das System mit der 40/30/30-Tranchen-Pyramide diszipliniert wieder ein.

3. **Makro-Notfall-Evakuierung (September – Dezember 2025):**
   * Am **18.09.2025** schlug die Makro-Ampel durch akuten Liquiditätsentzug (Net Fed Liquidity $8\text{W-Delta} = -6,44\,\%$) auf **ROT**.
   * Die Strategie evakuierte das gesamte Portfolio (**$ 523.540**) vollständig zu 50 % in Gold (`GLD`) und 50 % in USD-Cash.
   * Am **11.12.2025** triggerte der Panik-Capitulation-Sniper am Marktboden. Der Schutzschirm wurde bei einem Depotwert von **$ 568.482** (+8,58 % Wertzuwachs während der Krise!) aufgelöst und das gesamte Kapital floss unbeschadet zurück in das S&P 500 Mutterschiff, um die Ausbrüche von `S`, `PLTR` und `AIRO` massiv zu befeuern!

---

## 4. Technische Spezifikation & Verwandte Werkzeuge

* **PoC-Simulation:** [`scratch/architecture/strategies/KamikazeGrowthSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/KamikazeGrowthSimulation.js)
* **Single-Asset Katapult-Engine (NVTS, IBRX, PLTR):** [`scratch/tools/GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js)
* **Single-Asset Trading Framework:** [`docs/architecture/single-asset-radar/SingleAssetTrading.md`](file:///D:/GitHub/CrashRadar/docs/architecture/single-asset-radar/SingleAssetTrading.md)
* **Wissensgraph & Architektur:** Verlinkt in [`docs/README.md`](file:///D:/GitHub/CrashRadar/docs/README.md).
* **Verwandte Core-Strategien:**
  * [`docs/architecture/strategies/Muzzled-Cathie-Wood.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Muzzled-Cathie-Wood.md) (60/40 ARK-Modell auf Euro-Basis mit Sparplan)
  * [`docs/architecture/strategies/Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md) (Defensives Core-DCA mit Skimming & Notfall-Schutz)

---

## 5. TODO: Weiterentwicklung für explosives High-Beta Growth (Lehre aus dem NVTS > $ 30 Case)

> [!IMPORTANT]
> **Erkenntnis aus der NVTS-Historie (Mai/Juni 2026):**
> Navitas Semiconductor (`NVTS`) explodierte im Frühjahr 2026 vertikal von ca. $ 10 auf ein Allzeithoch von **$ 34,17** (Close bei **$ 31,79** am 26.05.2026 und Double-Top am 03.06.2026 bei 112 Mio. Stück Float-Turnover), bevor der Kurs wieder auf **$ 11,80** (-65 %) kollabierte. 
> Das war der **ideale Punkt zur Voll- oder Teil-Liquidierung**, der im klassischen MCW-Regelwerk (reine Verkaufsblockade bei `HOLD & BUY` und fehlender parabolischer Exit) ungenutzt geblieben wäre. Zudem wurde NVTS durch die rigide 10-Q-Zombie-Klausel im November 2024 ausgestoßen und durfte trotz der Jahrhundert-Rallye wegen verzögerter SEC-Zahlen nicht wieder einsteigen.

### Konkrete TODO-Aufgaben für die nächste Entwicklungsstufe:

1. **Einführung des parabolischen Climax-Top Exits (`TOP_CLIMAX_ALERT`):**
   * Verknüpfung der erprobten Katapult-Logik aus [`GrowthStockTradingEngine.js`](file:///D:/GitHub/CrashRadar/scratch/tools/GrowthStockTradingEngine.js) mit dem Portfolio-Manager:
     * **Trigger:** Distanz zum 20er EMA $\ge +35\,\%$ bis $+45\,\%$ **ODER** RSI(14) $\ge 80 - 85$ nach starkem Kursanstieg ($> +100\,\%$).
     * **Aktion:** Sofortige Gewinnmitnahme (50 % Skimming oder 100 % Voll-Liquidierung bei Bruch des EMA 20).
     * **Sicherung:** Erlöse fließen sofort als gesicherter Profit in das **S&P 500 Mutterschiff**.
2. **Watchlist-Klausel für Turnaround- & Explosiv-Kandidaten:**
   * Da der Investor die Watchlist-Kandidaten (Tier 1 Core: `PLTR`, `SOFI` | Tier 2 Fallback: `ZETA`, `SOUN` | Krypto: `MSTR`, `MARA`, `BMNR`, `BLSH`) eigenhändig auswählt:
     * Bei neuen Stage-2-Ausbrüchen mit massivem Volumen ($\ge 1,8\times$ Durchschnitt) soll die Chart-Qualität den Vorrang vor rückwärtsgewandten SEC 10-Q-Zahlen erhalten, um explosive Turnaround-Wellen nicht zu verpassen.
3. **Simulation Update:**
   * Nach Freigabe der konkreten Schwellenwerte wird [`KamikazeGrowthSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/KamikazeGrowthSimulation.js) um das Climax-Modul erweitert und neu gebenchmarkt.

