# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus: Error Handling, Logging & Console-Cleanup
* **Status-Update (Juli 2026):** Der große Code-vs-Theorie Audit ist **abgeschlossen**. Alle obsoleten Mythen und Waisen-Indikatoren wurden bereinigt.
* **Architektur-Plan: Dreistufiges Error- & Logging-Framework (ROADMAP Punkt 4)**
  1. **Zentraler Logger (Console-Cleanup):** Eine neue Klasse `src/core/Logger.js` mit Log-Leveln (DEBUG, INFO, WARN, ERROR, FATAL) ersetzt alle harten `console.log` Aufrufe. Die Konsole bleibt im Server-Betrieb flüsterleise.
  2. **ErrorRegistry (Non-Fatal Warnings):** Fehlerhafte Scraper oder API-Timeouts führen nicht mehr zum Absturz. Sie werden stattdessen in einer globalen `src/core/ErrorRegistry.js` gesammelt.
  3. **Admin-Wachhund (Ntfy-Push):** Am Ende des Pipeline-Runs (z.B. im `StandardRunner`) prüft das System die `ErrorRegistry`. Gibt es Warnungen, wird ein dedizierter System-Health-Report (getrennt vom normalen Wetterbericht) an den Admin via Ntfy gepusht.
  4. **Fatal Errors:** Fehlt die Datenbankverbindung oder `.env`, ruft das System `Logger.fatal()` auf und erzwingt einen harten Abbruch (`process.exit(1)`).
* **Relevante Dokumentation:**
  * [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md) (Siehe Punkt 4)