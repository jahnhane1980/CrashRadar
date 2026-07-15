# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus: Error Handling, Logging & Console-Cleanup
* **Status-Update (Juli 2026):** Der große Code-vs-Theorie Audit ist **abgeschlossen**. Alle obsoleten Mythen und Waisen-Indikatoren wurden bereinigt.
* **Neues Ziel:** Wir bauen ein professionelles, dreistufiges Error- & Logging-Framework (ROADMAP Punkt 4).
  1. **Console-Cleanup:** Den Code von `console.log` Spam befreien.
  2. **Fatal Errors:** Harte Programmabbrüche (`exit`), wenn fundamentale Datenbank-Fehler passieren.
  3. **Non-Fatal Warnings:** Fehlerhafte Scraper oder APIs werden gesammelt und am Ende als gesammelter Ntfy-Push-Report an den Admin gesendet.
* **Relevante Dokumentation:**
  * [ROADMAP.md](file:///C:/GitHub/CrashRadar/ROADMAP.md) (Siehe Punkt 4)