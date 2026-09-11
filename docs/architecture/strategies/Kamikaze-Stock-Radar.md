# Das Kamikaze-Stock-Radar-Regelwerk

> 📄 **Kontext:** Operative Radar- und Watchlist-Spezifikation für die Einzeltitel-Auswahl des [Kamikaze Growth Portfolios](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md).  
> 🏛️ **Single Source of Truth:** Die vollständige fundamentale Bilanzprüfung (Solvenz-Airbag), das Wyckoff-Boden-Timing ($L_1 \to L_2$), der Event-Pivot ($t_0$) und die Parabolik-Notbremse sind verbindlich in **[Stock-Radar-Turnaround-Framework.md](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Stock-Radar-Turnaround-Framework.md)** definiert.

---

## 1. Das Anlage-Universum: Die User-Curated Master-Watchlist

Im Gegensatz zu anderen Systemen (z. B. Cathie-Wood-Radar via ARK-Trades oder 7-Slot-Guru via 13F-Filings) scannt das Kamikaze-Radar nicht den Gesamtmarkt, sondern stützt sich ausschließlich auf eine **vom Investor eigenhändig kuratierte Beobachtungsliste**:

* **Ideen-Pool:** Sobald der Investor eine disruptive High-Growth- oder Turnaround-Idee identifiziert, wird der Ticker manuell auf die Watchlist gesetzt.
* **Status standardmäßig `OBSERVE`:** Ein manuell hinzugefügter Titel landet ausnahmslos mit dem Status **`OBSERVE`**. Ein sofortiger Kauf ist streng verboten!
* **Historischer Anker (`firstSeenDate`):** Jeder Ticker führt ein Registrierungsdatum, ab wann er beobachtet wird. Ein Chart-Ausbruch vor diesem Datum wird vom System ignoriert (Schutz vor rückblickendem Hineinschummeln).

### Die zweistufige Watchlist & Krypto-Silo:

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

---

## 2. Der Einstiegs-Türsteher: Von `OBSERVE` zu `BUY` (Delegiert an Stufe 2)

Ein Kauf aus dem Status `OBSERVE` ist strikt verboten, bis die Aktie alle Kriterien des **[Stock-Radar Turnaround-Frameworks (Stufe 2)](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Stock-Radar-Turnaround-Framework.md)** erfüllt:

1. **Fundamentaler Solvenz-Airbag:** Net Cash Runway $\ge 12\text{ Monate}$ ($BC_{\text{Monthly}} = |\text{FCF}_Q|/3$), Deleveraging, Peer-Discount $\ge 60\,\%$ und Verwässerung $< 5\,\%$ p.a.
2. **Technisches Wyckoff-Retest-Timing:** Panik-Tief $L_1$ $\to$ Higher-Low Retest $L_2$ $\to$ Institutional Event-Pivot ($t_0$) mit Ausbruch über AVWAP und EMA 20.
3. **Asymmetrischer Makro-Guard:** Kauf nur bei freigegebenem Makro-Regime (Makro GRÜN). Bei Makro ROT gilt striktes Zündfunken- und Kaufverbot.

---

## 3. Der Status `HOLD & BUY` (Geschützter Gewinner)

Gibt der Einstiegs-Türsteher grünes Licht und löst die Portfolio-Engine den Kauf aus, wechselt der Status der Position auf **`HOLD & BUY`**:

* **Verkaufsblockade:** Der Titel darf bei normalen Marktschwankungen nicht vorzeitig herausgeschüttelt werden.
* **Konträres Dip-Buying:** Befindet sich eine Aktie im Status `HOLD & BUY` und erleidet einen Branchen-Dip ($\text{Sektor-Return}_{5d} \le -3,5\,\%$ oder Aktie $\le -10\,\%$ vom 50T-Hoch unter EMA 20), meldet das Radar ein `DIP_BUY_CANDIDATE`-Signal (mindestens 20 Handelstage Cooldown, solange Makro GRÜN ist).

---

## 4. Radar-Exit: Sektor-Relativität & 3-Stufen-Abbau

Echte Hypergrowth-Gewinner dürfen bei unverschuldeten Branchen-Dips nicht panisch verkauft werden. Gleichzeitig müssen fundamentale Flops konsequent eliminiert werden:

### A. Sektor-Relativität (Branchen-Immunität):
* Gemessen am branchenspezifischen Sektor-ETF (z. B. `IGV` für Software wie PLTR & S, `SMH` für Halbleiter wie NVTS):
  $$\text{rsSector}_t = \frac{\text{Kurs}_{\text{Aktie}, t}}{\text{Kurs}_{\text{Sektor-ETF}, t}}$$
* Solange $\text{rsSector} \ge \text{SMA}_{50}(\text{rsSector})$ gilt, greift die **Branchen-Immunität**: Ein Ausstieg ist verboten, stattdessen darf bei Sektor-Paniken konträr nachgekauft werden.

### B. Das fundamentale Flag-System & Der 3-stufige Abbau:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│     STUFE 1: EARNINGS-GROWTH-KNICK (1/3 TEIL-EXIT ZU GUTEM PREIS)       │
│  Bedingung: Erstes 10-Q mit YoY-Umsatzwachstum < 15–18 % oder Kollaps.  │
│  Aktion:    • 1/3 der Position wird sofort verkauft (Gewinnsicherung).  │
│             • Status wechselt von HOLD & BUY auf HOLD & OBSERVE.        │
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

---

## 5. Die 4 empirischen Schärfungen & Turnaround-Klauseln

Basierend auf dem empirischen Abgleich realer Trades (NVTS, IBRX, S) fließen vier konkrete Sonderregeln in das Radar ein:

1. **Parabolischer Climax-Top Exit (`TOP_CLIMAX_ALERT`):**
   * *Signal:* Distanz zum EMA 20 $\ge 35-45\,\%$ **ODER** RSI(14) $\ge 85$ nach starkem Anstieg ($> +100\,\%$) gekoppelt an M5 Power-Hour Dump unter Tages-VWAP.
   * *Aktion:* Gewinnmitnahme (Teil- oder Voll-Exit) zur Sicherung der Gewinne vor dem unvermeidlichen Crash.
2. **NVTS-Klausel (Turnarounds & Short-Squeezes):**
   * Wenn ein Kandidat explizit auf der Watchlist steht und ein massives Volumen-Breakout-Signal zeigt (relatives Volumen $\ge 1,8\times$ mit Kurs über EMA 20 und SMA 50):
   * Der träge 10-Q-Umsatzfilter wird temporär außer Kraft gesetzt (gesichert durch strikten EMA-20-Trailing-Stop).
3. **IBRX-Klausel (Biotech & Zulassungs-Blockbuster):**
   * Bei Biotech-/MedTech-Unternehmen wird die Restriktion $|\text{Net Income}| > 2 \times \text{Umsatz}$ ausgesetzt, sofern:
     * Das YoY-Umsatzwachstum $\ge 100\,\%$ beträgt (Nachweis kommerzieller Marktdurchdringung).
     * Der Kurs relative Stärke gegenüber dem Biotech-Sektor (`XBI`) beweist.
4. **SentinelOne-Klausel (Frühzeitiger Einstieg):**
   * Erlaubnis einer ersten 50 %-Starttranche bereits bei Trendlinien-Durchbruch über den SMA 50 und positivem RS-Momentum, ohne monatelang auf ein verzögertes Golden Cross über dem SMA 200 warten zu müssen.

---

## 6. Schnittstelle zur Portfolio-Engine (`GrowthStockRadar.js`)

Das Radar erzeugt rein den Zustand des Assets und übergibt folgendes normiertes Signal-Objekt an `KamikazeGrowthStrategy.js`:

```javascript
{
  symbol: "NVTS",
  date: "2026-05-14",
  status: "TOP_CLIMAX_ALERT", // BREAKOUT_ACTIVE, READY_TO_FIRE, RIDE_TREND, TOP_CLIMAX_ALERT, TREND_BROKEN, STOP_LOSS
  actionSuggestion: "SELL_FULL", // BUY_SIGNAL, SELL_FULL, SELL_PARTIAL, HOLD, NO_ACTION
  confidence: 0.95,
  metrics: {
    price: 32.23,
    distEma20Pct: 48.5,
    rsi14: 87.2,
    volumeRatio: 2.8,
    closeVsVwap: -3.2
  },
  flags: {
    isStage2: true,
    is10QPassed: false,
    isClimaxTop: true,
    isTurnaroundCandidate: true
  },
  reason: "Parabolic Climax: Distanz zu EMA20 >= +45% und Intraday-Schluss unter VWAP"
}
```
Die Strategie entscheidet anschließend, wie viele Stücke verkauft und wie viel Liquidität ins S&P 500 Mutterschiff transferiert wird.

---

## 7. TODO / RFC: Integration der Investment-Typen (`LASTING_HOLD`, `CYCLICAL`, `BINARY`)

> 🔗 Siehe die übergeordnete Strategie-Spezifikation in [`Kamikaze-Growth.md` (Abschnitt 6)](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md).

* [ ] **Signal-Differenzierung nach `investmentType`:**
  * **`LASTING_HOLD` (`PLTR`, `S`):** Keine Emittierung technischer Verkaufs-Signale. `SELL_FULL` und `SELL_PARTIAL` bei SMA 200-Brüchen oder Climax-Spikes werden blockiert; Status verbleibt stoisch auf `HOLD`.
  * **`CYCLICAL` (`NVTS`):** Die vollständige Katapult-Engine mit Climax-Gewinnmitnahme (`TOP_CLIMAX_ALERT`) und Trendbruch-Exits bleibt uneingeschränkt aktiv.
  * **`BINARY` (`IBRX`):** Pre-Event De-Risking und asymmetrischer Risikofilter für das Schlüssel-Event im Januar 2027.

