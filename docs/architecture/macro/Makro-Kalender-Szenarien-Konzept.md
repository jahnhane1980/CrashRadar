# Konzept: Dynamischer Makro-Wirtschaftskalender & Szenario-Framework

> **Status:** Verbindliche Architektur & Konzept-Spezifikation (`Option A: Full DB`)  
> **Ziel:** Vollständige Ablösung der statischen `Macro-Scenarios-Config.json` durch eine automatisierte, datenbankgestützte Event-, Kalender- und Scorecard-Engine.

---

## 1. Ausgangslage & Problemstellung

Für den September 2026 wurde mit der [`config/Macro-Scenarios-Config.json`](file:///D:/GitHub/CrashRadar/config/Macro-Scenarios-Config.json) ein statisches *Minimum Viable Product (MVP)* geschaffen. 

### Warum die MVP-Konstruktion skaliert werden muss:
1. **Monatsgekoppelte IDs:** IDs wie `jolts_july` oder `nfp_august` sind starr. Für Folgequartale müssten fortlaufend neue JSON-Einträge manuell angelegt werden.
2. **Ablaufdatum des Szenarios:** Nach dem 30.09.2026 ist das System "blind", da kein automatischer Übergang in neue Quartale (z. B. Q4 2026, Q1 2027) existiert.
3. **Keine Persistenz der Ist-Ergebnisse:** Gemessene Werte (`actual_value`) und der finale Status (`PASSED`/`FAILED`) existieren nur flüchtig zur Laufzeit im Speicher und in der Ntfy-Benachrichtigung, anstatt in der DB historisiert zu werden.
4. **Statische Schwellenwerte altern (Das Dynamik- & Realzins-Problem):**
   * Feste Zahlenwerte wie $100\text{k}$ NFP oder $3.4\,\%$ CPI sind Momentaufnahmen:
     * *Arbeitsmarkt:* 2022 waren $12\text{M}$ offene Stellen normal, 2026 sind es $7.5\text{M}$. Bei demografischem Wandel reichen in Zukunft vielleicht $+60\text{k}$ Payrolls für Vollbeschäftigung.
     * *Realzins-Kopplung:* Bei $5.25\,\%$ Leitzins ist eine Kerninflation von $3.2\,\%$ unkritisch (positiver Realzins $+2.05\,\%$, Fed hat Spielraum). Bei einem Leitzins von $3.00\,\%$ wäre dieselbe Inflation von $3.2\,\%$ ein negativer Realzins-Schock!

---

## 2. Das 3-Schichten-Zielbild (Separation of Concerns)

Um Termine (Fakten), Marktregeln (Interpretation) und Ausführung (Execution) strikt zu trennen, wird das System in drei Schichten strukturiert:

```mermaid
flowchart TD
    subgraph Layer1["1. Kalender- & Termin-Schicht (MacroCalendarFetcher)"]
        FRED_API["FRED API (/fred/release/dates)"] --> CalSync["Zukunftstermine 1x/Jahr abfragen (Release Dates & Times)"]
        CalSync --> DB_Events[("macro_calendar_events (SCHEDULED)")]
    end

    subgraph Layer2["2. Interpretations- & Regel-Schicht (MacroScenarioRuleService)"]
        Rules["Dynamische Szenario-Regeln (Goldilocks / Soft Landing)"] --> Assign["Weist Events relative & dynamische rule_json zu"]
        Assign --> DB_Events
    end

    subgraph Layer3["3. Execution- & Scorecard-Schicht (MacroScorecardRunner)"]
        Cron["Event heute fällig? (release_date = TODAY)"] --> Fetcher["Gezielter TimeSeriesFetcher (schreibt in econ_fred)"]
        Fetcher --> LocalRead["Liest Ist-Wert direkt lokal aus econ_fred"]
        LocalRead --> FreshGuard{"Freshness-Guard (obs_date >= target_observation_date)"}
        FreshGuard -->|"Ja"| Eval["Prüft Ist-Wert gegen dynamische rule_json"]
        FreshGuard -->|"Nein"| Wait["Bleibt auf PENDING_DATA (Stumm)"]
        Eval --> Persist["Schreibt actual_value & status (PASSED/FAILED) in DB"]
        Persist --> Push["Ntfy Scorecard Push"]
    end

    DB_Events --> Cron
```

### Die Zuständigkeiten im Detail:

1. **`MacroCalendarFetcher.js` (Fakten, Termine & Konsens):**
   * Fragt die offiziellen Veröffentlichungstermine für das Kalenderjahr von der FRED-API ab (`release_date`, `release_time`, `target_observation_date`, `event_code`).
   * Bezieht den offiziellen Wall-Street-Konsens (`consensus_estimate`) von ForexFactory und Cleveland Fed Nowcast.
   * Schreibt diese Termine mit Status `SCHEDULED` in die Tabelle `macro_calendar_events`.
   * **Wichtig:** Kennt *keine* Trading- oder Goldilocks-Regeln.

2. **`MacroScenarioRuleService.js` (Markt-Regeln & Interpretation):**
   * Definiert, was die Wall Street in einem bestimmten Regime (z. B. "Goldilocks", "Stagflation-Watch", "Zinswende-Tracker") sehen will.
   * Generiert relative, trend- und zinsabhängige Schwellenwerte (`rule_json`) und ordnet sie den Events zu.

3. **`MacroScorecardRunner.js` (Live-Execution & Werte-Übertrag):**
   * Prüft täglich, ob ein Event ansteht (`release_date = CURRENT_DATE`).
   * Führt den gezielten `TimeSeriesFetcher`-Task aus (Daten fließen in `econ_fred`).
   * **Lokale Synchronisation:** Liest den neuen Ist-Wert direkt lokal aus `econ_fred` (keine redundanten externen API-Calls).
   * Validiert den Freshness-Guard, bewertet die Regel, aktualisiert `actual_value` + `status` (`PASSED`/`FAILED`) und feuert die Ntfy-Scorecard.

### 2.1 Das Monopol des TimeSeriesFetchers (Separation of Concerns)

Ein zentraler Architektur-Grundsatz von CrashRadar ist das **Monopol des TimeSeriesFetchers** auf externe Zeitreihenbeschaffung. Dieses Monopol wird wie folgt gewahrt und sauber abgegrenzt:

1. **Harte Wirtschafts- und Marktdaten (`econ_fred`):**
   * Das Monopol des `TimeSeriesFetcher` (`StandardRunner` / [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json)) bleibt zu **100 % unangetastet**.
   * Der `MacroScorecardRunner` greift niemals selbst auf externe Daten-Endpunkte von FRED zu, sondern delegiert die Datenbeschaffung an den regulären `TimeSeriesFetcher`-Task (`fred_jtsjol`, `fred_payems`, etc.) und liest das Ergebnis erst nach dem Speichern lokal aus MySQL.
2. **Event- und Kalender-Metadaten (`macro_calendar_events`):**
   * Release-Termine (`/fred/release/dates`) und Konsens-Schätzungen (ForexFactory, Cleveland Fed Nowcast) sind **keine relationalen Markt-Zeitreihen**, sondern **Szenario-Metadaten**.
   * Sie werden getrennt über den `MacroCalendarFetcher` eingepflegt (vergleichbar mit Stammdaten-Seedern), wodurch die Kern-Zeitreihentabellen von CrashRadar schlank und unberührt bleiben.

---

## 3. Datenquellen & Offizielle Release-IDs

Die US-Behörden und die Federal Reserve veröffentlichen ihren Jahresplan weit im Voraus. Die Termine werden über die offizielle FRED-Release-API synchronisiert:

| Event | Herausgeber | Offizielle Quelle | FRED Release-ID | Standard-Uhrzeit |
| :--- | :--- | :--- | :--- | :--- |
| **JOLTS** (Offene Stellen) | **BLS** (Bureau of Labor Statistics) | [BLS Schedule](https://www.bls.gov/schedule/news_release/) | `release_id=119` | 16:00 MESZ (10:00 ET) |
| **NFP** (Employment Situation / Payrolls) | **BLS** | [BLS Schedule](https://www.bls.gov/news.release/empsit.toc.htm) | `release_id=50` | 14:30 MESZ (08:30 ET) |
| **CPI Core** (Verbraucherpreise) | **BLS** | [BLS Schedule](https://www.bls.gov/cpi/) | `release_id=10` | 14:30 MESZ (08:30 ET) |
| **PPI** (Erzeugerpreise) | **BLS** | [BLS Schedule](https://www.bls.gov/ppi/) | `release_id=110` | 14:30 MESZ (08:30 ET) |
| **FOMC** (Fed Zinsentscheid) | **Federal Reserve** | [FOMC Calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) | *(8 feste Termine / Jahr)* | 20:00 MESZ (14:00 ET) |
| **Core PCE** (Fed-Preismaß) | **BEA** (Bureau of Economic Analysis) | [BEA Schedule](https://www.bea.gov/news/schedule) | `release_id=54` | 14:30 MESZ (08:30 ET) |

### 3.2 Live-Evaluierung & Marktübersicht aller Datenquellen

Im Rahmen der Konzeption wurden alle relevanten Marktdaten-Provider auf ihre Eignung und Datenverfügbarkeit im Free-Tier untersucht und live getestet (Skripte: [`scratch/trash/test_sources.js`](file:///D:/GitHub/CrashRadar/scratch/trash/test_sources.js), [`scratch/trash/test_modern_fmp.js`](file:///D:/GitHub/CrashRadar/scratch/trash/test_modern_fmp.js), [`scratch/architecture/macro/test_forexfactory.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/macro/test_forexfactory.js) und [`scratch/architecture/macro/parse_cleveland.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/macro/parse_cleveland.js)):

| Provider | Makro-Wirtschaftskalender | Konsens-Schätzungen (Macro) | Free-Tier Eignung & Testergebnis |
| :--- | :--- | :--- | :--- |
| **Tiingo** | ❌ Nein | ❌ Nein | Spezialisiert auf Aktien, Krypto, Forex & SEC-Fundamentaldaten. Kein Makro-Kalender. |
| **Alpaca** | ❌ Nein | ❌ Nein | "Calendar API" liefert nur Börsen-Handelszeiten (Market Open/Close/Holidays). |
| **AlphaVantage** | ❌ Nein | ❌ Nein | Funktion `ECONOMIC_CALENDAR` existiert nicht. Reine historische Zeitreihen. |
| **FMP (FinancialModelingPrep)** | ⚠️ Nur Paid | ⚠️ Nur Paid | ❌ **Blockiert:** Seit Aug 2025 hinter Paywall (`HTTP 402 Restricted Endpoint`). |
| **Finnhub** | ⚠️ Nur Schedule | ⚠️ Nur Earnings | Im Free-Tier auf Schedule und Unternehmensgewinne (EPS) beschränkt; keine verlässlichen Makro-Prints. |
| **👑 Cleveland Fed Nowcasting** | ✅ Ja (Inflation) | ✅ Ja (Live Nowcast) | 🟢 **Hervorragend (Gold-Standard):** Tägliche Schätzungen für Core CPI (`2.38 %`) und Core PCE (`3.40 %`). |
| **👑 ForexFactory JSON Feed** | ✅ Ja (Alle Events) | ✅ Ja (Offizieller Konsens) | 🟢 **Hervorragend:** Öffentlicher JSON-Feed (`nfs.faireconomy.media`) liefert punktgenauen Wall-Street-Konsens (z. B. JOLTS: `7.33M`, NFP: `55k`, Unemployment: `4.1%`). |

### 3.3 Beschlossene Quellen-Strategie pro Metrik

| Metrik-Gruppe | Primäre Datenquelle für `consensus_estimate` | Status & Implementierung |
| :--- | :--- | :--- |
| **Inflation** (`CPI_CORE`, `PCE_CORE`) | **Cleveland Fed Inflation Nowcast** | ✅ **Beschlossen:** Tägliches Nowcast-Scraping / API-Parsing (`parseClevelandNowcast()`). |
| **Zinsen** (`FOMC`) | **Federal Reserve FOMC-Kalender** | ✅ **Beschlossen:** Diskreter Zins-Erwartungskorridor (`PAUSE`, `CUT_25`, `CUT_50`). |
| **Arbeitsmarkt** (`PAYEMS` / NFP, `JTSJOL`) | **ForexFactory JSON Feed + Demografischer Breakeven Guard ($100\text{k}$ / Sahm $<0.50$)** | ✅ **Beschlossen:** Liest den Wall-Street-Konsens (`forecast`) direkt aus dem ForexFactory-JSON-Feed (JOLTS: `7.33M`, NFP: `55k`) und sichert ihn durch das 2-Stufen-Modell gegen Rezessionsschocks ab. |

#### 3.3.1 Der ForexFactory Konsens-Ingestion-Flow (4-Schritte-Ablauf)

```mermaid
sequenceDiagram
    autonumber
    participant CalFetcher as MacroCalendarFetcher
    participant FF as ForexFactory Feed (nfs.faireconomy.media)
    participant DB as MySQL (macro_calendar_events)
    participant Runner as MacroScorecardRunner (am Event-Tag)

    Note over CalFetcher,FF: 1. Konsens-Abruf (wöchentlich / am Event-Morgen)
    CalFetcher->>FF: GET /ff_calendar_thisweek.json
    FF-->>CalFetcher: JSON-Array aller USD-Events mit "forecast"
    
    Note over CalFetcher: 2. Normalisierung (z. B. "7.33M" -> 7330k, "55K" -> 55k)
    CalFetcher->>DB: UPDATE macro_calendar_events SET consensus_estimate = 7330 WHERE event_code = 'JTSJOL' AND release_date = '2026-09-01'

    Note over Runner,DB: 3. Auswertung am Event-Tag (nach FRED-Daten-Fetch)
    Runner->>DB: Lese Event (consensus_estimate: 7330, actual_value: 7650)
    Note over Runner: Stufe 1: 7650k vs 7330k (Konsens erfüllt / Beat)<br>Stufe 2: Sahm -0.03 < 0.50 (Makro-Guard intakt)
    Runner->>DB: SET status = 'PASSED'
```

1. **Abruf des Feeds:** URL: `https://nfs.faireconomy.media/ff_calendar_thisweek.json` (kein API-Key erforderlich).
2. **Matching & Einheiten-Normalisierung:** Filterung nach `country === 'USD'`, Umwandlung von Strings (`"7.33M"` $\to$ `7330`, `"55K"` $\to$ `55`).
3. **Persistierung in der DB:** Automatisches Update der Spalte `macro_calendar_events.consensus_estimate`.
4. **Ausführung am Event-Tag:** Abgleich von `actual_value` gegen `consensus_estimate` und Prüfung des Stufe-2-Guards.

### 3.4 Der FRED API Endpunkt für Kalenderdaten
```http
GET https://api.stlouisfed.org/fred/release/dates?release_id={RELEASE_ID}&api_key={KEY}&include_release_dates_with_no_data=true&file_type=json
```

---

## 4. Datenbank-Design: `macro_calendar_events`

### 4.1 DDL Schema (MySQL)

```sql
CREATE TABLE IF NOT EXISTS `macro_calendar_events` (
  `id` VARCHAR(64) NOT NULL,                           -- z. B. '2026-09-01_JTSJOL' oder UUID
  `scenario_id` VARCHAR(64) NOT NULL,                  -- z. B. 'goldilocks_q3_2026', 'goldilocks_q4_2026'
  `event_code` VARCHAR(32) NOT NULL,                   -- Standardisiert: 'JTSJOL', 'PAYEMS', 'CPI_CORE', 'PPI', 'FOMC', 'PCE_CORE'
  `title` VARCHAR(128) NOT NULL,                        -- z. B. 'US JOLTS Report'
  `reporting_period` VARCHAR(16) NOT NULL,             -- z. B. '2026-07' (Juli), '2026-08' (August), '2026-Q3'
  `release_date` DATE NOT NULL,                        -- Veröffentlichungstag, z. B. '2026-09-01'
  `release_time` VARCHAR(32) NOT NULL,                 -- Uhrzeit, z. B. '16:00 MESZ'
  `target_observation_date` DATE NOT NULL,             -- Exakter FRED-Stichtag, z. B. '2026-07-01'
  `metric` VARCHAR(32) NOT NULL,                       -- Metrik in econ_fred, z. B. 'JTSJOL'
  `rule_json` JSON NOT NULL,                           -- Dynamische Auswertungsregel
  `pass_message` VARCHAR(255) DEFAULT NULL,            -- Erklärung bei Erfolg
  `fail_message` VARCHAR(255) DEFAULT NULL,            -- Erklärung bei Nichterfüllung
  `status` ENUM('SCHEDULED', 'PENDING_DATA', 'PASSED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'SCHEDULED',
  `previous_value` DOUBLE DEFAULT NULL,                -- Wert des vorangegangenen Berichtsmonats
  `consensus_estimate` DOUBLE DEFAULT NULL,            -- Offizieller Wall-Street-Konsens vor Veröffentlichung
  `actual_value` DOUBLE DEFAULT NULL,                  -- Gemessener Ist-Wert aus econ_fred
  `evaluated_at` DATETIME DEFAULT NULL,                -- Timestamp der erfolgreichen Auswertung
  `notified_at` DATETIME DEFAULT NULL,                 -- Timestamp des Ntfy-Versands
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_release_date` (`release_date`),
  KEY `idx_scenario_status` (`scenario_id`, `status`),
  KEY `idx_event_code` (`event_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4.2 Standardisierte Event-Codes & Mapping

| `event_code` | Beschreibung | Zugehörige Fetcher-Tasks | Primäre Metrik in `econ_fred` |
| :--- | :--- | :--- | :--- |
| `JTSJOL` | US JOLTS Offene Stellen | `fred_jtsjol` | `JTSJOL` |
| `PAYEMS` | NFP Arbeitsmarkt & Payrolls | `fred_payems`, `fred_sahmrealtime` | `PAYEMS_DIFF`, `SAHMREALTIME` |
| `PPI` | Erzeugerpreisindex | `fred_ppiaco` | `PPIACO_YOY` |
| `CPI_CORE` | Kerninflation | `fred_cpilfesl` | `CPILFESL_YOY` |
| `FOMC` | Fed Zinsentscheid | `fred_interest` | `DFF_ACTION` |
| `PCE_CORE` | Core PCE Preisindex | `fred_pcepilfe` | `PCEPILFE_YOY` |

### 4.3 Automatische Metrik-Transformationen (Rohdaten -> Ist-Wert)

In `econ_fred` liegen Rohzeitreihen vor. Der `MacroScorecardRunner` bzw. `AnalysisRepository` führt vor dem Regelabgleich standardisierte Transformationen durch:

1. **Preisindizes (`CPI_CORE`, `PCE_CORE`, `PPI`):**
   * *Rohdaten:* Indexstände (z. B. `CPILFESL = 325.4`).
   * *Berechnung:* $\text{YoY} = \frac{\text{Wert}(t) - \text{Wert}(t-12)}{\text{Wert}(t-12)} \times 100$
   * *Ergebnis:* Prozentuale Inflationsrate (z. B. `2.47 %`), die direkt gegen den Konsens (`consensus_estimate`) abgeglichen wird.
2. **Arbeitsmarkt-Zuwachs (`PAYEMS`):**
   * *Rohdaten:* Gesamtbeschäftigte in Tausend (z. B. `PAYEMS = 158858`).
   * *Berechnung:* $\Delta \text{PAYEMS} = \text{Wert}(t) - \text{Wert}(t-1)$
   * *Ergebnis:* Monatlicher Stellenzuwachs in Tausend (z. B. `+55k`).
3. **Zinsentscheid (`FOMC`):**
   * *Rohdaten:* Effektiver Leitzins `DFF`.
   * *Berechnung:* Delta $\Delta \text{DFF} = \text{DFF}(t) - \text{DFF}(t-1)$.
   * *Ergebnis:* Diskrete Klassifikation (`'PAUSE'` bei $\Delta = 0$, `'CUT_25'` bei $\Delta \approx -0.25\,\%$, `'CUT_50'` bei $\Delta \approx -0.50\,\%$, `'HIKE'` bei $\Delta > 0$).

---

## 5. Empirische Simulation & Grenzen reiner Trend-Modelle

Zur Validierung der Dynamisierung wurde ein Simulations-Skript ([`scratch/architecture/macro/simulate_dynamic_rules.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/macro/simulate_dynamic_rules.js)) entwickelt, das die realen historischen FRED-Zeitreihen aus `econ_fred` lädt, die gleitenden 3-Monats-Durchschnitte (3M MA) berechnet und den statischen JSON-Werten gegenüberstellt:

### 5.1 Simulations-Ergebnisse (Datenbasis: Sommer 2026)

| Event / Metrik | Datenbasis in `econ_fred` | Statischer Wert ([`Macro-Scenarios-Config.json`](file:///D:/GitHub/CrashRadar/config/Macro-Scenarios-Config.json)) | Dynamisch berechnete Rule | Erkenntnis aus der Simulation |
| :--- | :--- | :--- | :--- | :--- |
| **JOLTS** (`JTSJOL`) | 3M-Schnitt: **7.49M** | `RANGE: [7.00M - 8.20M]` | **`RANGE: [6.99M - 7.99M]`** | Die statische Obergrenze ($8.2\text{M}$) war veraltet. Der dynamische Korridor ($3\text{M} \pm 500\text{k}$) passt sich exakt dem 2026er Niveau an. |
| **NFP / Sahm** | Sahm: `-0.03`, Payrolls: `-23k` | `PAYEMS >= 100k` & `SAHM < 0.50` | **`MIN: 100k` & `MAX: 0.50`** | $100\text{k}$ bildet den demografischen US-Breakeven, $0.50$ die mathematische Rezessionsgrenze. |
| **Core CPI** (`CPILFESL`) | 3M-Trend: `2.82% -> 2.57% -> 2.47%`<br>3M-Schnitt: **2.62%**<br>Leitzins (`DFF`): **3.63%** | `MAX: 3.4%` | **`TREND_DELTA: Max 2.72%`**<br>**`REAL_RATE: Max 3.38%`** | 🔥 **Frühwarnung:** Wenn die Inflation auf $2.47\%$ gefallen ist, wäre ein Anstieg auf $3.3\%$ ein Schock. Die statische JSON ($3.4\%$) wäre blind geblieben, die dynamische Regel schlägt sofort Alarm! |
| **Core PCE** (`PCEPILFE`) | 3M-Schnitt: **3.38%** (stabil) | `MAX: 3.3%` | **`TREND_DELTA: Max 3.48%`** | Die statische Grenze ($3.3\%$) hätte einen **Fehlalarm** ausgelöst. Die dynamische Regel erkennt den stabilen Seitwärtstrend ($3.34\%$). |

### 5.2 Grenzen rein mathematischer Trend-Regeln (Warum 3M MA allein nicht reicht)
* **Das Problem:** Ein gleitender 3-Monats-Durchschnitt ist **rückwärtsgerichtet (lagging)**.
* **Wie die Wall Street wirklich agiert:** Große Marktteilnehmer (Hedgefonds & Investmentbanken) handeln nicht nach Vergangenheitsdurchschnitten, sondern nach **Forward-Looking Consensus Estimates** (offizielle Konsens-Schätzungen von Bloomberg, FactSet, Reuters oder Nowcasting-Modellen).
* **Fazit:** Ein reines Trend-Modell schützt vor strukturellem Veralten, kennt aber nicht die punktgenaue Erwartungshaltung des Marktes am Veröffentlichungstag.

---

## 6. Die Architektur-Entscheidung: Das 2-Stufen-Bewertungsmodell

Um die Vorzüge von echten Wall-Street-Erwartungen mit mathematischer Krisensicherheit zu vereinen, implementiert das System ein **2-Stufen-Bewertungsmodell**:

```mermaid
flowchart TD
    Actual["Gemessener Ist-Wert (actual_value aus econ_fred)"] --> Step1{"Stufe 1: Wall-Street-Konsens\n(actual_value vs. consensus_estimate)"}
    
    Step1 -->|"Miss (Erwartung verfehlt)"| Fail1["❌ FAILED (Marktreaktion negativ / Enttäuschung)"]
    Step1 -->|"Beat / In-Line (innerhalb ±0.1% Toleranz)"| Step2{"Stufe 2: Strukturelles Makro-Sicherheitsnetz\n(Sahm < 0.50 / Realzins positiv / Breakeven)"}
    
    Step2 -->|"Regime-Kollision (z. B. Sahm >= 0.50)"| Fail2["❌ FAILED (Struktureller Rezessions-/Stagflationsschock)"]
    Step2 -->|"Makro-Fundament intakt"| Pass["✅ PASSED (Goldilocks bestätigt)"]
```

### Stufe 1: Der Wall-Street-Konsens-Check (`consensus_estimate`)
* Prüft, ob der gemeldete Wert die Konsens-Erwartungen der Wall Street erfüllt:
  * **Inflation (CPI/PCE/PPI):** $\text{actual\_value} \le \text{consensus\_estimate} + 0.10\,\%$
  * **Arbeitsmarkt (NFP):** $\text{actual\_value} \ge \text{consensus\_estimate} - 15\text{k}$
* Ein Erreichen oder Schlagen des Konsenses signalisiert grünes Licht für eine Erleichterungsrallye.

### Stufe 2: Das strukturelle Makro-Sicherheitsnetz (Sanity Guard)
* Verhindert Fehlinterpretationen bei "faulen Beats":
  * *Beispiel:* Die Wall Street erwartet im Crash nur noch $+10\text{k}$ Payrolls. Die gemeldeten $+20\text{k}$ "schlagen" zwar den Konsens, bedeuten aber realen Stellenabbau und Rezession!
  * **Der Guard greift ein:** Trotz positivem Konsens-Beat wirft Stufe 2 ein Veto, wenn die Sahm-Regel $\ge 0.50$ triggert oder die Kerninflation über dem Leitzins (`DFF`) liegt.

---

## 7. Dynamische & Relative Rule-Engine (`rule_json`)

Die Konfiguration in `macro_calendar_events.rule_json` bildet dieses 2-Stufen-Modell flexibel ab:

### 1. 2-Stufen-Regel für Inflation (Konsens + Realzins-Schutz)
```json
{
  "type": "TWO_STAGE_CONSENSUS",
  "consensusMetric": "consensus_estimate",
  "maxTolerance": 0.10,
  "macroGuard": {
    "type": "SPREAD_TO_METRIC",
    "compareMetric": "DFF",
    "operator": "LESS_THAN_OR_EQUAL",
    "offset": -0.25
  },
  "passMsg": "Inflation im Rahmen der Erwartungen & Realzins restriktiv",
  "failMsg": "Inflation über Konsens oder Realzins-Inversion"
}
```

### 2. 2-Stufen-Regel für Arbeitsmarkt (Konsens + Sahm-Regel Guard)
```json
{
  "type": "TWO_STAGE_CONSENSUS",
  "consensusMetric": "consensus_estimate",
  "minTolerance": -15,
  "macroGuard": {
    "metric": "SAHMREALTIME",
    "type": "MAX",
    "max": 0.50
  },
  "passMsg": "Arbeitsmarkt stabil im Erwartungs-Korridor (keine Rezession)",
  "failMsg": "Arbeitsmarkt bricht ein oder Sahm-Rezessionsalarm"
}
```

### 3. Diskrete Notenbank-Entscheidung (`ALLOWED_VALUES` z. B. FOMC)
```json
{
  "type": "ALLOWED_VALUES",
  "allowed": ["PAUSE", "CUT_25", "CUT_50"],
  "passMsg": "Geldpolitische Lockerung / Zinspause bestätigt",
  "failMsg": "Unerwarteter Zinsschritt / Restriktion"
}
```

---

## 8. End-to-End Workflow & Durchstich-Beispiel

### Beispiel: Veröffentlichungstag 01.09.2026 (JOLTS Juli)

```mermaid
sequenceDiagram
    autonumber
    actor Cron as Täglicher Cron (16:05 MESZ)
    participant Runner as MacroScorecardRunner
    participant DB as MySQL (macro_calendar_events & econ_fred)
    participant Fetcher as StandardRunner (fred_jtsjol)
    participant FRED as St. Louis Fed API
    participant Ntfy as Ntfy Push Service

    Cron->>Runner: Starte Scorecard-Check
    Runner->>DB: SELECT * FROM macro_calendar_events WHERE release_date = '2026-09-01'
    DB-->>Runner: Event: '2026-09-01_JTSJOL' (status: 'SCHEDULED', target_obs: '2026-07-01', consensus: 7500)
    
    Runner->>Fetcher: Starte gezielten Fetch für task 'fred_jtsjol'
    Fetcher->>FRED: GET /fred/series/observations (JTSJOL)
    FRED-->>Fetcher: Neuer Datenpunkt { date: '2026-07-01', value: 7650 }
    Fetcher->>DB: Speichere in econ_fred

    Runner->>DB: Lese neuesten Wert für JTSJOL (lokaler DB-Zugriff)
    DB-->>Runner: { obs_date: '2026-07-01', value: 7650 }
    
    Note over Runner: Freshness-Guard OK ('2026-07-01' >= '2026-07-01')
    Note over Runner: 2-Stufen-Check: actual_value (7650) vs consensus (7500) -> In-Line -> PASSED
    
    Runner->>DB: UPDATE macro_calendar_events SET actual_value = 7650, status = 'PASSED', evaluated_at = NOW()
    Runner->>Ntfy: Sende Scorecard Update (1/6 Kriterien erfüllt: 🟢 JOLTS: 7.65M)
```

---

## 9. Migrations- & Einführungsfahrplan (Step-by-Step)

1. **Schritt 1: DDL & Migration (`macro_calendar_events`)**
   * Erstellen des Migrationsskripts in `src/db/migrations/create_macro_calendar_events.sql` inklusive der Spalten `consensus_estimate` und `previous_value`.
   * Ausführen der Tabellenerstellung in MySQL.

2. **Schritt 2: `MacroCalendarFetcher.js` (Termin- & Konsens-Ingestion)**
   * Implementierung des Fetchers, der für das Kalenderjahr 2026 die Termine der 5 Kern-Release-IDs abfragt und mit `status = 'SCHEDULED'` in `macro_calendar_events` einträgt.
   * Periodische Konsens-Ingestion von ForexFactory und Cleveland Fed Nowcast in `macro_calendar_events.consensus_estimate`.

3. **Schritt 3: `MacroScenarioRuleService.js` (2-Stufen-Regel-Engine)**
   * Implementierung der 2-Stufen-Regel-Auswertung (`TWO_STAGE_CONSENSUS`, `ALLOWED_VALUES`, `RANGE`, `SPREAD_TO_METRIC`).
   * Zuweisung des aktiven Szenarios (z. B. `goldilocks_q3_2026`) auf die entsprechenden Quartals-Events.

4. **Schritt 4: Refactoring [`ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js) & [`MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js)**
   * Umstellung von der statischen JSON-Datei auf die Datenbank-Tabelle `macro_calendar_events`.
   * Lokaler Werte-Abgleich aus `econ_fred` und persistentes Update von `actual_value` und `status`.

5. **Schritt 5: Test-Suite & Verifikation**
   * Unit-Tests mit Mocks für alle Regeltypen und Live-Dry-Run via CLI.

---

## 10. Zukunftsausblick: Integration in MacroEngine & TradingEngine

Ursprünglich als reines Reporting- und Monitoring-Tool gestartet, besitzt das dynamische Szenario-Framework alle mathematischen und strukturellen Eigenschaften eines vollwertigen **Makro-Regime-Indikators**.

```mermaid
flowchart LR
    subgraph Data["1. Daten-Schicht"]
        DB[("macro_calendar_events & econ_fred")]
    end

    subgraph Macro["2. MacroEngine (Berechnung & State)"]
        Ind["MacroScenarioIndicator\n(z. B. Goldilocks Score: 5/6 = 83%)"]
        State["State: GOLDILOCKS_CONFIRMED\nSeverity: LOW / BULLISH\nRegime: DISINFLATIONARY_GROWTH"]
    end

    subgraph Trading["3. TradingEngine (Execution & Veto)"]
        Radar["MlRegimeRadar / Watchdog\n(docs/architecture/trading-engine/TradingEngine.md)"]
        Kelly["Fractional Kelly: 1.0x (Volle Allokation)\nBei FAILED: scaleDown & Veto"]
    end

    DB --> Ind
    Ind --> State
    State --> Radar
    Radar --> Kelly
```

### 10.1 Rolle in der MacroEngine (`MacroScenarioIndicator.js`)
* **Verantwortung:** Aggregation der `macro_calendar_events` zu einem normierten Makro-Score (`0.0 - 1.0`).
* **Output-Schema:**
  ```json
  {
    "indicator": "MacroScenarioIndicator",
    "scenarioId": "goldilocks_q3_2026",
    "score": 0.83,
    "passedCount": 5,
    "totalCount": 6,
    "state": "CONFIRMED",
    "regime": "DISINFLATIONARY_GROWTH"
  }
  ```

### 10.2 Rolle in der TradingEngine ([`docs/architecture/trading-engine/TradingEngine.md`](file:///D:/GitHub/CrashRadar/docs/architecture/trading-engine/TradingEngine.md))
* **Verantwortung:** Fundamental-Veto und dynamische Risikoskalierung (Kelly Multiplikator).
* **Handlungslogik:**
  * **Score $\ge 80\,\%$ (`CONFIRMED`):** Grünes Licht für Trendfolge- und Momentum-Strategien. Maximales Risiko-Budget.
  * **Szenario `FAILED` (z. B. Inflations-Schock oder Sahm-Rezessions-Trigger):** Die TradingEngine zieht automatisch den **Fundamental-Watchdog** (`action.scaleDown`), friert neue Long-Käufe ein und zieht Trailing-Stops enger.

> **Roadmap-Einordnung:** In Phase 1 wird das System als autarker Runner & Benachrichtigungsdienst betrieben. In Phase 2 erfolgt die direkte Anbindung des Indikators an die Pipeline der TradingEngine.
