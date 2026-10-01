# Befund & Gap-Analyse: Überarbeitung des Szenario- & Kalender-Systems

> **Status:** ✅ ERLEDIGT & VOLLSTÄNDIG UMGESETZT (Live in MySQL `macro_calendar_events`)  
> **Referenz-Konzept:** [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md)  
> **Ziel:** Vollständiger technischer Abgleich des überarbeiteten Konzepts gegen die bestehende Codebase zur Vorbereitung der System-Umstellung von statischen JSON-Konfigurationen auf das datenbankgestützte 3-Schichten-Framework (`Option A: Full DB`).

---

## 1. Zusammenfassung des Befunds

Der Abgleich zwischen dem Zielkonzept [`docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md`](file:///D:/GitHub/CrashRadar/docs/architecture/macro/Makro-Kalender-Szenarien-Konzept.md) und dem Ist-Zustand des Codes ([`src/services/ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js), [`src/runners/MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js), [`src/core/repositories/AnalysisRepository.js`](file:///D:/GitHub/CrashRadar/src/core/repositories/AnalysisRepository.js)) zeigte eine klare Trennung zwischen:
1. **Neu zu erstellenden Kern-Diensten und Datenbank-Strukturen** (Kalender-Ingestion, dynamischer Regel-Generator, Notenbank-RSS-Parser).
2. **Punktuell anzupassenden bestehenden Diensten** (Runner auf DB-Events umstellen, Rule-Engine um 2-Stufen-Modell erweitern, Repository-Erweiterungen, CI/CD-Timing).

*Alle Punkte wurden erfolgreich in `macro_calendar_events`, `CalendarFetchAdapter.js`, `CalendarStorageAdapter.js`, `FiscalCalendarService.js` und `ScenarioChecklistService.js` umgesetzt.*

---

## 2. Was ist NEU zu erstellen? ("Neu")

| Komponente | Dateipfad | Zweck & Spezifikation | Status |
| :--- | :--- | :--- | :--- |
| **1. DDL & Migration** | [`docs/architecture/data/Macro-Calendar-Events.md`](file:///D:/GitHub/CrashRadar/docs/architecture/data/Macro-Calendar-Events.md) | **MySQL Schema für `macro_calendar_events`:**<br>• Spalten: `id`, `category`, `subcategory`, `title`, `event_date`, `event_time`, `status`, `criticality`, `metadata_json`, `actual_value`, `details_json`, `source`, Timestamps.<br>• Indizes: `idx_event_date`, `idx_category_status`, `idx_subcategory`. | ✅ Umgesetzt |
| **2. `CalendarFetchAdapter.js`** | [`src/core/adapters/fetch/CalendarFetchAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/fetch/CalendarFetchAdapter.js) | **Layer 1 (Termine & Konsens):**<br>• *Jahres-Termine:* Ruft FRED Release Dates API (`/fred/release/dates`) für die 5 Kern-Releases ab (JOLTS: 192, NFP: 50, CPI: 10, PPI: 46, PCE: 54) und legt Termine mit Status `SCHEDULED` in DB an.<br>• *Konsens-Ingestion:* Gecachter, resilienter Abruf des Wall-Street-Konsens von ForexFactory (`ff_calendar_thisweek.json`) & Cleveland Fed Inflation Nowcast, Normalisierung und Update von `metadata_json`. | ✅ Umgesetzt |
| **3. `CalendarStorageAdapter.js`** | [`src/core/adapters/storage/CalendarStorageAdapter.js`](file:///D:/GitHub/CrashRadar/src/core/adapters/storage/CalendarStorageAdapter.js) | **Layer 1 (Speicherung & Upsert):**<br>• Persistiert alle Kalender-Events mit Erhalt historischer `actual_value` und `status` Einträge per `ON DUPLICATE KEY UPDATE`. | ✅ Umgesetzt |
| **4. Task `macro_calendar_events`** | [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json) | **Fetcher-Task:**<br>• Automatisierte Ausführung im nächtlichen EOD-Job via Package-Provider `Calendar`. | ✅ Umgesetzt |

---

## 3. Was wurde im bestehenden Code GEÄNDERT? ("Anders")

### 3.1 [`src/runners/MacroScorecardRunner.js`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js)
* **Umstellung:**
  1. Liest anstehende Events direkt per SQL aus `macro_calendar_events`.
  2. Persistiert nach Auswertung `status` (`PASSED`/`FAILED`), `actual_value` und `details_json` direkt in die Datenbank.
  3. Statische `config/Macro-Scenarios-Config.json` wurde vollständig gelöscht.

### 3.2 [`src/services/ScenarioChecklistService.js`](file:///D:/GitHub/CrashRadar/src/services/ScenarioChecklistService.js)
* **Umstellung:**
  1. `loadEventsFromDb(pool, targetDateStr)` lädt alle Monats-Events autark aus MySQL.
  2. Dynamisches Branding: `${monthName} ${year}: GOLDILOCKS-SCORECARD`.
  3. Fallback auf eingebettetes Standard-Szenario für Offline-Testbarkeit ohne DB-Verbindung.

---

## 4. Wichtige Befunde & Korrekturen aus der Live-Verifikation

1. **Korrektur der FRED Release IDs:**
   * **JOLTS:** BLS Release-ID ist **`192`** (nicht 119). Liefert verlässlich den Veröffentlichungstermin (z. B. 01.09.2026).
   * **PPI:** BLS Release-ID ist **`46`** (nicht 110). Liefert verlässlich den Erzeugerpreis-Termin (z. B. 10.09.2026).
2. **Entlastung von `alert_history.json`:**
   * Die Entprellung und Ist-Wert-Historisierung wandert vollständig in die Datenbank `macro_calendar_events`.
3. **Monopol des TimeSeriesFetchers gewahrt:**
   * Auch im neuen System greift der `MacroScorecardRunner` niemals direkt auf externe Zeitreihen-Endpunkte zu, sondern liest Ist-Werte lokal über `FinanceExpert` aus `econ_fred`.
