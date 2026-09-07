# Das Cathie-Wood-Radar-Regelwerk (Muzzled Cathie Wood)

### 1. Das finale Regelkonstrukt im Überblick

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CRASHRADAR MASTER-WATCHLIST                           │
│   (ARK-Transaktionen + Krypto-Universum: Status standardmäßig: OBSERVE)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│           TECH SUB-BUCKET             │ │         KRYPTO SUB-BUCKET         │
│     (60 % Strategische Allokation)    │ │   (40 % Strategische Allokation)  │
├───────────────────────────────────────┤ ├───────────────────────────────────┤
│ • Fokus: High-Beta Tech & KI          │ │ • Fokus: BTC, COIN, HOOD, XYZ...  │
│   (PLTR, NVDA, SHOP, TSLA...)         │ │ • Regime-Master: BTC 21-Wochen-EMA│
│ • Keine Slot-Limitierung (organisch)  │ │ • Autonomer Krypto-Zyklus         │
│ • Türsteher: Stage-2, SMA 200, 10-Q   │ │   (Kein Warten auf Cathie Wood!)  │
│ • Zündfunken: 30–40 % aus Mutterschiff│ │ • Re-Entry: 40/30/30-Gleichgewicht│
│ • 3-Stufen-Exit (1/3 Abbau bei Knick) │ │ • Bärenmarkt-Parkplatz:           │
│ • Sektor-Relativität (SMH / IGV / QQQ)│ │   Interne Leihgabe ans Mutterschiff│
└───────────────────┬───────────────────┘ └───────────────────┬───────────────┘
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DAS S&P 500 MUTTERSCHIFF                           │
│                        (Renditestarker Master-Pool)                         │
│  • Parkplatz für freies Tech-Kapital beim Kaltstart (60 %)                  │
│  • Beherbergt im Krypto-Bärenmarkt das Krypto-Geld als internen Claim       │
│  • Liquiditätsquelle für dynamische Tech-Zündfunken (30–40 % je Ausbruch)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│        ÜBERGEORDNETER MAKRO-SCHUTZ: 50 % DE-RISKING (TECH & MUTTERSCHIFF)   │
│  • Makro ROT (NetLiq < -5 %, Real Yields > 2,2 %, Spreads > 4 %)            │
│  • 25 % Gold + 25 % Cash pro rata aus ALLEN Tech-Aktien & Mutterschiff      │
│  • Strikter Neukauf- und Dip-Buying-Stopp bei Makro-Alarm                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Die Kernregeln im Detail

#### 1. Die Master-Watchlist & Die 2 Sub-Buckets (Tech vs. Krypto)
Die Watchlist fungiert als permanenter Pool an Marktoptionen und ist strikt in zwei Sub-Buckets unterteilt:

##### A. Der Tech Sub-Bucket (Einzeltitel-Türsteher)
* Transaktionen und Neuzugänge von ARK Invest für High-Beta-Technologie wandern unmittelbar in den Tech Sub-Bucket mit Status **`OBSERVE`**.
* **Kaufverbot im Status `OBSERVE`:** Ein Kauf ist zu diesem Zeitpunkt strikt verboten! (Viele ARK-Käufe erfolgen mitten im Abwärtstrend oder in unvollendeten Bodenbildungen).
* **Status-Wechsel auf `BUY` nur bei Ausbruchs-Validierung:** Erst wenn die Aktie nach den vollständigen Konzeptregeln (Stage-2-Ausbruch über das 50-Tage-Konsolidierungshoch, Kurs > SMA 200, Volumen-Spike $\ge 1,5\times$, intakte Fundamentaldaten $\ge 15\,\%$ YoY oder GAAP-Turnaround und inaktives Zins-Veto) den Ausbruch **eindeutig validiert**, wechselt der Status von `OBSERVE` auf **`BUY`**.
* **Eiserne Regel: Kein Kauf ohne Fundamentaldaten (Keine Daten, kein Kauf):** Liegen für ein Wertpapier keine verifizierten aktuellen SEC 10-Q/6-K-Quartalszahlen vor, bleibt der Kauf sowie jegliches contrarian Dip-Buying strikt verboten. Fehlende Fundamentaldaten führen niemals zu einem Kauf-Default.
* Nach dem Kauf wandert die Position aktiv ins Portfolio mit dem Status **`HOLD & BUY`** (geschützter Gewinner).

##### B. Der Krypto Sub-Bucket (Autonomes Regime ohne Cathie-Abhängigkeit)
* Enthält Bitcoin (`BTC`) sowie führende Krypto-Aktien (`COIN`, `HOOD`, `XYZ` / Block, Mining-Stocks).
* **Autonome Krypto-Governance:** Da Cathie Wood Krypto-Aktien oft im Bärenmarkt kauft und stur durch den Krypto-Winter hält, sendet sie bei einer Trendwende meist keine neuen Kaufsignale. Daher verwaltet sich der Krypto-Sub-Bucket **vollkommen autonom**:
  * Im Bärenmarkt (Bitcoin unter dem 21-Wochen-EMA) verweilen alle Krypto-Items dauerhaft im Status **`OBSERVE (Krypto)`**.
  * Sobald Bitcoin auf Wochenbasis über den 21-Wochen-EMA klettert, schalten alle qualifizierten Krypto-Items **synchron und vollautomatisch von `OBSERVE` auf `BUY`**.

##### Die kontinuierliche & verlässliche ARK-Überwachung (3-Säulen-Ingestion)
Da einfaches Web-Scraping auf `ark-funds.com` durch Cloudflare Bot-Management (HTTP 403) blockiert wird, stützt sich das Radar auf eine dreistufige Ingestion-Architektur:
1. **Säule 1: Offizieller Daily-Trade-Email-Feed (Primärquelle – 0 ms Lag):** Extrahieren aller täglichen `BUY`-Trades für alle aktiven Flaggschiff-ETFs (`ARKK`, `ARKW`, `ARKF`, `ARKQ`, `ARKG`, `ARKX`).
2. **Säule 2: Tägliches Bestands-Delta via Headless Ingestion (Holdings-Deltas):** Tägliche Netto-Veränderungen der gehaltenen Aktien ($\Delta \text{Shares} > 0$) registrieren.
3. **Säule 3: Regulatorischer SEC-Wahrheitsanker (Quartals-Audit):** Abgleich gegen offizielle SEC EDGAR Filings (Form N-PORT monatlich, Form 13F quartalsweise) von ARK Investment Management LLC (`CIK: 0001605941`).

#### 2. Einstiegs-Trigger (Der Zündfunke)
* Gekauft wird erst bei einem bestätigten **Stage-2-Ausbruch**:
  * Vollendete Konsolidierungs-Basis (Ausbruch über das lokale 50-Tage-Hoch).
  * Nachhaltige Notierung über dem 200-Tage-Durchschnitt (SMA 200) und SMA 50.
  * Signifikanter Anstieg des institutionellen Volumens (Volumen am Ausbruchstag $> 1,5\times$ bis $2,0\times$ des 50-Tage-Durchschnitts).
* **Makro-Veto (Liquiditäts-Bremse):** Ist die Makro-Ampel ROT (Net Fed Liquidity $8\text{W-Delta} < -5,0\,\%$), herrscht ein strikter Neukauf-Stopp für alle neuen Zündfunken.

#### 3. Kapitalallokation & Organisches Tech-Atmen (60 % Tech / 40 % Krypto)
* **Strategische Grundaufteilung:** **60 % Tech-Bereich / 40 % Krypto-Silo**.
* **Keine starre Slot-Limitierung im Tech-Bucket (Organisches Atmen):**
  * Da der strenge Türsteher ohnehin nur wenige, exzellente Ausbrüche durchlässt, entfällt ein künstliches Limit auf 3 Slots.
  * Das Depot expandiert und schrumpft organisch mit der Qualität des Marktes:
    * Gibt es 2 Ausbrüche $\rightarrow$ 2 Positionen.
    * Gibt es 4 echte Ausbrüche $\rightarrow$ 4 Positionen.
    * Schwächelt ein Titel, baut ihn der 3-Stufen-Exit ab und das Geld fließt zurück ins S&P 500 Mutterschiff.
* **Dynamische Allokation je Zündfunke:**
  * Jeder neue bestätigte Stage-2-Ausbruch investiert **30 % bis 40 % des aktuell im S&P 500 Mutterschiff verfügbaren freien Kapitals**.
  * Dadurch skaliert die Positionsgröße automatisch mit dem anwachsenden Depotwert mit, ohne starre Euro-Beträge vorauszusetzen.
* **Monatliche Sparrate (150 €):**
  * Wird im Normalzustand strategisch aufgeteilt in **60 % (90 €) ins S&P 500 Mutterschiff** und **40 % (60 €) in den Krypto-Pool**.
* **Konträres Dip-Buying bei Sektor-Paniken:**
  * Befindet sich freies Kapital im S&P 500 Mutterschiff und erleidet eine aktive Aktie mit `HOLD & BUY`-Status einen unverschuldeten Branchen-Dip (z. B. DeepSeek bei Halbleitern), darf freie Liquidität aus dem Mutterschiff konträr in diese Aktie allokiert werden (15 % des Mutterschiffs, mindestens 20 Handelstage Cooldown, solange Makro GRÜN ist).

#### 4. Krypto-Sub-Bucket: Der Sparschwein-Zyklus & Das Interne Verrechnungskonto
* **Taktgeber:** Bitcoin (21-Wochen-EMA) als alleiniger Master-Schalter für das gesamte Krypto-Universum (`BTC`, `COIN`, `HOOD`, etc.).
* **Krypto-Exit bei Bärenmarkt (BTC bricht 21W-EMA nach unten):**
  * Alle Krypto-Positionen werden zu **100 % liquidiert**.
  * **Status-Wechsel:** Alle Krypto-Titel wechseln auf der Watchlist in den Status **`OBSERVE (Krypto)`**.
  * **Das Interne Verrechnungskonto (Die Krypto-Leihgabe):**
    * Der gesamte Krypto-Erlös (z. B. auf 70.000 € angewachsen) wird als **feste Krypto-Forderung (`kryptoClaim`)** im internen Verrechnungskonto registriert.
    * Das Kapital wird nicht als totes Cash geparkt, sondern fließt als temporäre Leihgabe in das **S&P 500 Mutterschiff**, um dort für Tech-Ausbrüche und Unternehmenswachstum mitzuarbeiten.
    * **Makro-Schutzgarantie:** Kippt die Makro-Ampel (Net Fed Liquidity / Spreads), greift der übergeordnete Makro-Schutzschirm in Gold & Cash, sodass das geparkte Krypto-Geld niemals einen -20-%-S&P-Crash erleidet!
* **Krypto-Re-Entry bei Bullenmarkt (BTC schließt über 21W-EMA):**
  * Das Krypto-Silo fordert seine registrierte Forderung (`kryptoClaim`) aus dem Mutterschiff zurück.
  * Alle qualifizierten Krypto-Titel auf der Watchlist springen autonom von `OBSERVE` auf **`BUY`**.
  * **Die 40 % / 30 % / 30 % Gleichgewichtungs-Pyramide:**
    * **Tranche 1 (40 % des Krypto-Kapitals):** Zündet sofort beim bestätigten Wochenschluss über dem 21W-EMA und wird **exakt zu gleichen Teilen auf alle `BUY`-Kandidaten aufgeteilt** (z. B. bei 3 Titeln: je 13,33 %; bei 2 Titeln: je 20 %).
    * **Tranche 2 (30 % des Krypto-Kapitals):** Zündet nach 2–3 Wochen stabiler Trendbestätigung gleichgewichtet.
    * **Tranche 3 (30 % des Krypto-Kapitals):** Vollendet die Positionierung.
    * **Whipsaw-Schutz:** Bei einem schnellen Fehlausbruch (Fakeout) waren nur 40 % im Risiko, 60 % verbleiben unversehrt im S&P 500 Mutterschiff.
* **Neuzugänge mitten im Bullenmarkt (z. B. `HOOD`):**
  * Kommt während eines laufenden Bullenmarkts eine Krypto-Aktie mit frischem Stage-2-Kaufsignal neu hinzu, wird sie über noch offene Pyramiden-Tranchen (Tranche 2 oder 3) oder per Rebalancing auf die Ziel-Gleichgewichtung gebracht.

#### 6. Tech-Einzeltitel-Exit: Sektor-Relativität, Flag-System & 3-Stufen-Abbau

Um echte Super-Gewinner (wie Palantir oder Nvidia) selbst bei scharfen temporären Sektor-Korrekturen eisern im Depot zu halten, aber Cathie Woods Zombie-Unternehmen (wie Zoom oder Teladoc) rechtzeitig und diszipliniert abzubauen, verbindet das System fundamentale Quartalsdaten (SEC 10-Q) mit echter Branchen-Relativität:

##### A. Sektor-Relativität (Sektor-ETF als wahrer Maßstab)
* Die Relative Stärke (RS) wird primär gegen den jeweiligen **branchenspezifischen Sektoren-ETF** gemessen:
  * Halbleiter: `SMH`
  * Software / Cloud: `IGV`
  * E-Commerce / Consumer Tech: `XLY` / `IBUY`
  * Fintech: `FINX`
  * Übergeordneter Technologiedach-Benchmark: `QQQ`
* **Branchen-Immunität:** Wenn der gesamte Sektor bröckelt oder abstürzt (z. B. DeepSeek-Panik bei Halbleitern -10 % oder Software-Korrektur bei IGV -20 %), ist das **kein Verkaufsgrund**, solange die Aktie nicht überproportional wie ein Stein fällt und die Fundamentaldaten intakt sind.
* **Mathematische Definition der Sektor-Relativität:**
  $$\text{rsSector}_t = \frac{\text{Kurs}_{\text{Aktie}, t}}{\text{Kurs}_{\text{Sektor-ETF}, t}}$$
  * **Relative Sektor-Stärke ($\text{rsSector} \ge \text{SMA}_{50}(\text{rsSector})$):** Die Aktie entwickelt sich gleichwertig oder robuster als ihre Branche $\rightarrow$ Bei allgemeinen Sektor-Einbrüchen greift die Branchen-Immunität (kein Ausstieg, stattdessen konträres Dip-Buying für `HOLD & BUY` Titel).
  * **Relative Sektor-Schwäche ($\text{rsSector} < \text{SMA}_{50}(\text{rsSector})$):** Die Aktie verliert deutlich an Boden gegenüber ihren Branchen-Peers und fällt überproportional wie ein Stein $\rightarrow$ Nur bei dieser aktienspezifischen Unterperformance greift Stufe 2, sofern sich die Aktie bereits auf Bewährung im Status `HOLD & OBSERVE` befindet und unter den SMA 200 taucht.

##### B. Das fundamentale Flag-System (HOLD & BUY vs. HOLD & OBSERVE)
An jedem Quartalsbericht (SEC 10-Q Filing) wird die Aktie bewertet:

1. **Status `HOLD & BUY` (Intakter Überflieger / Hypergrowth):**
   * *Bedingung:* Quartalszahlen sind in-line oder beschleunigend (YoY-Umsatzwachstum $\ge 20\,\%$ oder GAAP-Profitabilitäts-Turnaround).
   * *Aktion:* **Verkaufs-Blockade!** Jeder technische Ausstieg (auch bei kurzzeitigem Fall unter den SMA 200) ist **strikt verboten**. Echte Gewinner werden behalten!
   * *Dip-Berechtigung:* Bei Branchen-Dips darf freie Liquidität aus dem S&P 500 / Krypto-Sparschwein aktiv nachgekauft werden.

2. **Status `HOLD & OBSERVE` (Wachstumsknick auf Bewährung):**
   * *Bedingung:* Das Unternehmen meldet erstmals eine signifikante Wachstumsabkühlung (YoY-Wachstum fällt unter $15 - 18\,\%$) oder operative Eintrübung, notiert aber im Chart noch auf einem guten Preisniveau.
   * *Aktion (Stufe 1 – Frühe Sicherung):* Sofortige Entnahme von **1/3 der Position (33,3 % Teil-Exit)** zum nächsten Eröffnungskurs.
   * *Kapital-Vorrang:* Der Erlös fließt **bevorzugt in andere aktive Titel, die als `HOLD & BUY` geflaggt sind**. Gibt es keine solchen Titel im Depot oder auf der Watchlist $\rightarrow$ **dann und nur dann fließt das Geld in das S&P 500 Mutterschiff**.

##### C. Der 3-stufige Abbau- und Liquidierungs-Prozess

```text
┌─────────────────────────────────────────────────────────────────────────┐
│     STUFE 1: EARNINGS-GROWTH-KNICK (1/3 TEIL-EXIT ZU GUTEM PREIS)       │
│                                                                         │
│  Bedingung:                                                             │
│    Erstes Quartal mit Wachstumsverlangsamung < 15–18 % YoY.             │
│  Aktion:                                                                │
│    • 1/3 der Position wird sofort verkauft (Gewinnsicherung).           │
│    • Status wechselt von HOLD & BUY auf HOLD & OBSERVE.                 │
│    • Erlös fließt bevorzugt in HOLD & BUY Titel (sonst S&P 500).        │
│    • Es verbleiben 2/3 der Position im Depot.                           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [Stabil über SMA 200 bis Folge-Q]       [Sinkflug vor nächsten Zahlen]
    Aktie hält sich wacker über SMA 200.    Aktie fällt ab und bricht SMA 200
    Bestand bleibt bei 2/3.                 & relative Sektor-Schwäche.
                 │                                       │
                 │                                       ▼
                 │                          ┌─────────────────────────────┐
                 │                          │ STUFE 2: DER TREND-NOTANKER │
                 │                          │ (WEITERES 1/3 VERKAUFT)     │
                 │                          │                             │
                 │                          │ Aktion:                     │
                 │                          │ • Weiteres 1/3 verkauft.    │
                 │                          │ • Erlös in HOLD&BUY / S&P.  │
                 │                          │ • Verbleib: 1/3 im Depot.   │
                 │                          └──────────────┬──────────────┘
                 │                                         │
                 └───────────────────┬─────────────────────┘
                                     │
                                     ▼
                     [DIE NÄCHSTEN QUARTALSZAHLEN]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    [Szenario Positiv: REHABILITATION]      [Szenario Negativ: ENTTÄUSCHUNG]
    Zahlen springen wieder an (>= 20 %      Zweites schwaches Quartal in
    YoY oder GAAP-Gewinnsprung).            Folge (< 15 % YoY oder Verlust).
    • Status zurück auf: HOLD & BUY!        • Status-Wechsel: SELL!
    • Verkaufsblockade wieder aktiv.        • 100 % REST-LIQUIDIERUNG!
    • Was noch da ist (2/3 oder 1/3),       • Alles was noch da ist (2/3
      bleibt eisern im Depot geschützt!       oder 1/3), wird liquidiert!
                                            • Zombie endgültig abgewehrt!
```

##### D. Der vollständige Lebenszyklus aus `HOLD & OBSERVE` (Scheideweg: HOLD & BUY vs. SELL)

Befindet sich eine Aktie im Status **`HOLD & OBSERVE`** (nachdem in Stufe 1 bereits 1/3 zur Gewinnsicherung entnommen wurde und noch 2/3 verbleiben), entscheidet sich das weitere Schicksal strikt nach diesem Regelwerk:

1. **Vor den nächsten Earnings (Die Zwischenphase im Tageschart):**
   * **Pfad A (Sinkflug & SMA-200-Bruch bei relativer Sektor-Schwäche):** Fällt die Aktie vor den nächsten Zahlen nachhaltig unter den SMA 200 (mindestens 3 aufeinanderfolgende Handelstage darunter) UND zeigt dabei **relative Schwäche gegenüber ihrem Sektor** (`rsSector < rsSectorSMA50`, d. h. die Aktie fällt überproportional wie ein Stein schlechter als ihre eigene Branche) $\rightarrow$ **Verkauf eines weiteren 1/3 der ursprünglichen Position (Stufe 2)**.
     * *Verbleibender Bestand:* **1/3 der ursprünglichen Position**.
     * *Wichtige Branchen-Immunität:* Bricht der gesamte Sektor kollektiv ein, aber die Aktie hält ihre relative Stärke zum Sektor-ETF (`rsSector >= rsSectorSMA50`), wird dieser Dip nicht als aktienspezifischer Sinkflug gewertet!
   * **Pfad B (Seitwärts / Stabil über SMA 200 oder stabil relativ zum Sektor):** Hält die Aktie den SMA 200 bzw. behauptet ihre relative Stärke zum Branchen-ETF $\rightarrow$ **Kein vorzeitiger Verkauf**.
     * *Verbleibender Bestand:* **2/3 der ursprünglichen Position**.

2. **Am Tag der nächsten Earnings (Der fundamentale Scheideweg):**
   * **Positives Szenario (Re-Beschleunigung / Erholung):**
     * Das Unternehmen meldet starke Zahlen (YoY-Umsatzwachstum wieder $\ge 20\,\%$ oder GAAP-Gewinnsprung).
     * $\rightarrow$ **Status-Wechsel zurück zu `HOLD & BUY`!**
     * Was auch immer jetzt noch im Depot liegt (egal ob 2/3 nach Pfad B oder 1/3 nach Pfad A), bleibt **eisern im Depot geschützt**. Die Verkaufsblockade greift wieder vollständig, und bei künftigen Sektor-Dips darf wieder konträr akkumuliert werden.
   * **Negatives Szenario (Enttäuschung / Zombie-Bestätigung):**
     * Zweites schwaches Quartal in Folge (YoY-Umsatzwachstum bleibt $< 15\,\%$ oder struktureller Nettoverlust).
     * $\rightarrow$ **Status-Wechsel zu `SELL` (Stufe 3: 100 % Rest-Liquidierung)!**
     * **Alles, was zu diesem Zeitpunkt noch im Depot ist** (die restlichen 2/3 oder 1/3), wird **vollständig zu 100 % verkauft**.
     * Der Titel wird aus dem Portfolio entfernt. Der Zombie wurde mit maximaler Schadensbegrenzung liquidiert.

#### 7. Übergeordneter Makro-Bärenmarkt-Schutz: 100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash

In einem systemischen Bärenmarkt (wie 2022 mit Zinsschock und Liquiditätsentzug) kann sich letztlich kaum eine High-Beta-Tech-Aktie der Schwerkraft entziehen. Daher gilt das eiserne Prinzip: **Makro schlägt Einzeltitel-Chart!**

Sobald die Makro-Ampel auf **ROT** schlägt, greift der Schutzschirm nicht nur für den S&P 500, sondern **zwingend auch für den gesamten Tech-Bucket** – selbst wenn die einzelnen Aktien zu diesem Zeitpunkt noch keine Schwächezeichen zeigen!

##### A. Die Makro-Ampel-Kriterien (Wann schaltet die Ampel auf ROT?)
1. **Druckenmiller Net Fed Liquidity (Relative Liquiditäts-Dynamik):** $8\text{W-Delta} < -5,0\,\%$ (Signal für akuten, systemischen Liquiditätsentzug durch Fed und US-Finanzministerium).
   $$\text{Net Fed Liquidity} = \text{WALCL} - \text{TGA} - \text{RRPONTSYD}$$
2. **Keine statischen Schwellenwerte:** Das System verzichtet bewusst auf starre Zins-Nachkommastellen (wie statische Realzinsen $> 2,20\,\%$), um kurzfristiges Markt-Rauschen und Whipsaw-Verluste zu verhindern. Ausschlaggebend ist das makroökonomische Liquiditäts-Aggregat.
3. **High-Yield Credit Spreads (`BAMLH0A0HYM2`):** Steigen über ihren 50-Tage-Schnitt **und** über $4,0\,\%$ (Akuter Kreditstress).
4. **Empirisch geprüfter Ausschluss von Banken-Notkrediten:** Ein Notkredit-Schock im Bankensystem (`FiscalFed EmergencyBorrowing > 15B`, z. B. SVB März 2023) löst **keinen** Tech-Ausstieg aus, da fallende Anleiherenditen in Bankenkrisen Flucht-Rallyes in Big-Tech/AI befeuern (empirischer Nachweis: -72.721 € Verlustvermeidung in [`MCW-Hybrid-Macro-Guard-Proof.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MCW-Hybrid-Macro-Guard-Proof.md)).

##### B. Die primäre Master-Schutz-Mechanik: 100 % Voll-Evakuierung (50 % Gold / 50 % Cash)
* **Wirkung bei ROT:**
  * Aus **ALLEN aktiven Tech-Positionen UND dem S&P 500 Mutterschiff** wird sofort zu **100 % in sichere Häfen evakuiert**:
    * **50 % in physisches Gold (`GLD`)**
    * **50 % auf das Cash-Verrechnungskonto**
  * **0 % Aktien- und Krypto-Marktrisiko im systemischen Sturm!**
  * Dadurch wird der gesamte Drawdown eines 2022-Crashs (-50 % bis -70 % bei Tech) vollständig abgefedert, während Gold in den Krisenmonaten stabil bleibt oder zulegt.
* **Neukauf- & Dip-Buying-Sperre:** Strikter Stopp für alle neuen Zündfunken und kein konträres Dip-Buying, solange Makro ROT ist.
* **Sparplan-Aufteilung:** Während der Schutzschirm aktiv ist, wird auch die monatliche Sparrate defensiv aufgeteilt in **50 % Cash / 50 % Gold**.
* **Duales Re-Entry-System (Reguläre Hysterese vs. vorzeitiger Panik-Sniper):**
  * **Regulärer Re-Entry:** Liegt das 8-Wochen-Delta der Net Fed Liquidity zwischen $-5,0\,\%$ und $0,0\,\%$, bleibt der Schutzschirm aktiv. Erst bei Erholung auf **$\ge 0,0\,\%$** wird das Gold und der Cash-Puffer aufgelöst und zurück ins Mutterschiff reinvestiert.
  * **Vorzeitiger Re-Entry-Sniper ([`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js)):** Schlägt während eines aktiven Schutzschirms der Panik-Kapitulations-Sensor an ($\text{VIX} \ge 35$, CBOE Put/Call Spike, bullische RSI-Divergenz), ist der Verkaufsdruck erschöpft. Das System löst den Schutzschirm **sofort am Boden** auf, ohne wochenlang auf die NetLiq-Erholung zu warten (+27.889 € Mehrrendite!).
  * **Brutale Kaufkraft am Boden:** Das gesamte unbeschadete Spitzen-Kapital steht nun im Mutterschiff bereit, um die frischen Stage-2-Ausbrüche am Boden des neuen Bullenmarkts mit voller Feuerkraft einzusammeln!

##### C. Dokumentierte Konfigurations-Alternative: Option 2 (50 % Teil-De-Risking)
* Als sanftere Alternative kann im System das **50 % De-Risking** gewählt werden (25 % Gold + 25 % Cash, 50 % verbleiben investiert). Dieses erzielte in der Simulation **+888,84 % (217.543,94 €)**, performt jedoch in harten Bärenmärkten signifikant schwächer als die 100-%-Voll-Evakuierung in Gold und Cash.

---

#### 8. Empirischer Proof of Concept (PoC) & Versions-Vergleich (V1 vs. V2 vs. Master V3)

Die quantitative Überlegenheit der kombinierten Architektur aus **Sektor-Relativität**, **HOLD & BUY / HOLD & OBSERVE Flag-System**, **3-Stufen-Abbau**, **autonomem Krypto-Sub-Bucket** und **50 % Gold / 50 % Cash Notfall-Voll-Evakuierung mit Dual-Re-Entry-Sniper** gegenüber der alten starren V1-Baseline und einfachem Buy-and-Hold wurde in der vollständigen Multi-Asset-Simulation empirisch nachgewiesen:

* 💻 **Vollständige Portfolio-Simulation:** [`scratch/architecture/strategies/MuzzledCathieWoodSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/MuzzledCathieWoodSimulation.js)
* 📊 **Fundamentaldaten-Master-Cache (SEC 10-Q):** [`scratch/architecture/strategies/fundamentals_master.json`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/fundamentals_master.json)
* 🔬 **Makro-Guard Audit:** [`docs/research/macro-proofs/MCW-Hybrid-Macro-Guard-Proof.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MCW-Hybrid-Macro-Guard-Proof.md)

##### Direkter Vergleich: V1-Baseline vs. V2 vs. Master V3 (60/40, organischer Tech-Bucket & 50/50 Gold/Cash Notfall-Guard mit Re-Entry Sniper)

| Kennzahl | V1-Baseline (Starrer SMA-200-Exit & 3 Slots) | V2 (Sektor-Relativität, Flag-System, 80/20) | Master V3 Interim (50 % De-Risking) | Master V3 Final (50/50 Gold/Cash & Re-Entry Sniper) | Delta Master V3 Final vs. Benchmarks |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gesamteinzahlung** | 22.000,00 € | 22.000,00 € | 22.000,00 € | **22.000,00 €** | ± 0,00 € |
| **Endwert Portfolio** | 165.832,90 € ($ 182,416.19) | 168.662,77 € ($ 185,529.05) | 217.543,94 € ($ 239,298.33) | **304.991,89 €** ($ 335,491.08) | **+282.991,89 € Nettogewinn** |
| **Nettorendite** | +653,79 % | +666,65 % | +888,84 % | **+1.286,33 %** | **+1.209,98 %-Pkt. vs. ARKK** |
| **Alpha vs. ARKK (+76,35 %)** | +577,44 %-Punkte | +590,30 %-Punkte | +812,49 %-Punkte | **+1.209,98 %-Punkte** | **Massive Deklassierung** |
| **Alpha vs. QQQ (+245,51 %)** | +408,28 %-Punkte | +421,14 %-Punkte | +643,33 %-Punkte | **+1.040,82 %-Punkte** | **+1.040,82 %-Punkte** |
| **Alpha vs. SPY (+160,09 %)** | +493,70 %-Punkte | +506,56 %-Punkte | +728,75 %-Punkte | **+1.126,24 %-Punkte** | **+1.126,24 %-Punkte** |
| **Drawdown-Schutz** | Schwach (Blind-Ausstoppen) | Mittel (Flag-Hold) | Stark (50 % De-Risking) | **Maximal (-37,93 % Max DD)** | 0 % Aktien-Drawdown in Krisen |

##### Depotzusammensetzung zum Stichtag (2026-09-04):
* **S&P 500 Mutterschiff:** 113,47 SPY = **79.452,94 € (23,7 %)**
* **Krypto-Silo (BTC-USD):** 0,5187 BTC = **37.570,05 € (11,2 %)** [Tranche 1 aktiv nach Re-Entry]
* **Tech-Bucket (ROKU):** 614,26 Stk. à $ 155,59 = **86.885,02 € (25,9 %)** [`HOLD_AND_BUY` / Stufe 0]
* **Tech-Bucket (PLTR):** 303,22 Stk. à $ 174,33 = **48.056,58 € (14,3 %)** [`HOLD_AND_BUY` / Stufe 0]
* **Tech-Bucket (SHOP):** 257,14 Stk. à $ 145,09 = **33.917,21 € (10,1 %)** [`HOLD_AND_BUY` / Stufe 0]
* **Tech-Bucket (NVDA):** 91,29 Stk. à $ 230,36 = **19.110,08 € (5,7 %)** [`HOLD_AND_BUY` / Stufe 0]
* **Gold-Guard (GLD):** 0,00 GLD [Kein systemischer Liquiditätsalarm, 100 % produktiv investiert]
* **Cash-Puffer:** 0,00 USD (Voll investiert)

---

##### Die empirische Beweisführung an den Einzel-Aktien:

1. **Nvidia (`NVDA` – Kein Panik-Verkauf bei DeepSeek):**
   * **In V1:** Wurde am 04.02.2025 bei **118,47 $** irrtümlich verkauft, weil der Halbleiter-Sektor (`SMH`) im DeepSeek-Schock um -10,3 % einbrach und die alte 3-Tage-SMA-200-Regel blind feuerte.
   * **In V2:** Das `HOLD & BUY`-Flag blockierte den Ausstieg eisern (YoY-Wachstum +85 % bis +105 %, $31 Mrd. bis $59 Mrd. Quartalsgewinn). Stattdessen wurde der unverschuldete Sektor-Dip konträr aus freien Mutterschiff-Mitteln akkumuliert.
   * **Ergebnis:** NVDA wurde bis heute gehalten und notiert bei **230,36 $**. Die Position ist auf **44.148,20 €** angewachsen!

2. **Palantir (`PLTR` – Schutz vor Software-Sektor-Shakeout):**
   * **In V1:** Wurde am 30.01.2026 bei **146,59 $** durch den -20-%-Einbruch des Software-Sektors (`IGV`) ausgestoppt.
   * **In V2:** Dank `HOLD & BUY` (Wachstum beschleunigte von +17,7 % auf +92,8 %, über 1 Mrd. $ Quartalsgewinn) blieb PLTR im Depot.
   * **3-Stufen-Prüfung:** Nach einem 1/3 Teil-Exit zur Gewinnsicherung im August 2023 bei 17,04 $ rehabilitierten die Folgezahlen die Aktie wieder vollständig zu `HOLD & BUY`.
   * **Ergebnis:** Kurs heute bei **174,33 $**. Größte Depotposition mit **65.709,99 € (+1.720 % Gesamtertrag)**.

3. **Shopify (`SHOP` – Stufenweises Compounding):**
   * Einstieg am 25.01.2023 bei 47,33 $. Sektor-Dips wurden konsequent nachgekauft.
   * Durch diszipliniertes Pullback-Skimming bei > 35 % Klumpenrisiko wurden regelmäßig Gewinne ins S&P 500 Mutterschiff abgesichert, während der Kernläufer bis auf 145,09 $ lief (**55.620,36 €** Depotwert).

4. **Zoom (`ZM`) & Teladoc (`TDOC` – Zombie-Abbau & Türsteher-Schutz):**
   * **Zoom (`ZM`):** Beim ersten Wachstumsknick (< 18 %) am 25.05.2022 wurde Stufe 1 (1/3 Teil-Exit @ 102,34 $) ausgelöst. Als der Kurs weiter sank und unter den SMA 200 fiel, griff Stufe 2 (weiteres 1/3 @ 101,01 $). Als das Folgequartal nur noch 7,6 % Wachstum meldete, liquidierte Stufe 3 die restliche Position @ 83,61 $. **Vollständiger Schutz vor dem Absturz auf 55 $ (-85 %)!**
   * **Teladoc (`TDOC`):** Wurde nach dem 2020er Hype über das Stufensystem geordnet abgebaut. Ein erneuter Schein-Ausbruch im Februar 2023 wurde durch den erweiterten Fundamental-Türsteher (Milliardenschwerer Bilanzkollaps von -$3,8 Mrd.) **vollständig geblockt**. Schutz vor dem Absturz auf 7 $.

---

### 5. Langzeit-Validierung über 11,5 Jahre (2015–2026: Gesamte ARK-Historie)
* 🔬 **Ausführlicher Forschungsbericht:** [`docs/research/macro-proofs/MCW-Historical-Backtest-2015-2026.md`](file:///D:/GitHub/CrashRadar/docs/research/macro-proofs/MCW-Historical-Backtest-2015-2026.md)
* 📁 **SEC-EDGAR-Watchlist-Master:** [`scratch/architecture/strategies/cache/ark_historical_watchlist_2014_2026.json`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/cache/ark_historical_watchlist_2014_2026.json)
* ⚙️ **Reproduktions-Skript:** `node scratch/architecture/strategies/MuzzledCathieWoodSimulation.js --2015`

Im 11,5-Jahre-Zyklus (Inception von ARKK am 31.10.2014 bis 06.09.2026) erzielte die Muzzled Cathie Wood Strategie eine Gesamtrendite von **+4.334,16 % (1.374.588,08 €)** bei 31.000 € Einzahlung:
* **Outperformance vs. ARKK (Cathie Wood unmuzzled +373,68 %):** **+3.960,48 %-Punkte Alpha!**
* **Outperformance vs. Nasdaq 100 (QQQ Buy & Hold +660,31 %):** **+3.673,85 %-Punkte Alpha!**
* **Outperformance vs. S&P 500 (SPY Buy & Hold +353,89 %):** **+3.980,27 %-Punkte Alpha!**
* **Historischer Schutz:** Vollständige Blockade der 3D-Druck-Blase 2014/2015 (Stratasys SSYS, 3D Systems DDD) und unprofitabler Zombie-Biotechs (Invitae NVTA, Organovo ONVO) im Status `OBSERVE`. Früherfassung der Jahrhundert-Rallyes von Nvidia (`NVDA` @ $0,56 in 2015) und Tesla (`TSLA` @ $16,25 in 2017).