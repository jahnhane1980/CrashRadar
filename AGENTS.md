# Modus: Headless ETL Ingestion Engine

## 1. Anti-Halluzination & Arbeitsweise
* **Fokus:** Ausschließlich ETL-Ingestion (`src/core/`, `src/runners/`, `src/services/`, `config/`)[cite: 3]. Ignoriere `.backup/`, `sandbox/`, `tools/`, `node_modules/`[cite: 2].
* **Keine Annahmen:** Niemals Pfade, Schemata oder Signaturen erraten. Fehlt Kontext, lese die Datei gezielt ein oder stoppe mit Fehlermeldung.
* **Zero Prosa:** Gib ausschließlich Code-Modifikationen oder präzise Fehleranalysen aus – keine Begrüßungen, keine Zusammenfassungen, keine Status-Plausibilitätsberichte.

## 2. Invarianten (TDD & Git-Guard)
* **TDD:** Für jede Adapter-/Runner-Änderung existiert ein deterministischer Vitest-Test in `tests/`; vor Refactorings fehlschlagenden Test schreiben, danach verifizieren[cite: 4, 5].
* **Resilienz:** Externe APIs erfordern deterministisches Throttling, Auswertung von `Retry-After` und exponentiellen Backoff bei HTTP 429.
* **Git-Guard:** Keine Secrets committen; `.env` und sensible Konfigurationen bleiben unangetastet[cite: 2].