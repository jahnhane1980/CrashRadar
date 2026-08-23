# CrashRadar: System Context

> **Zweck:** State-Transfer für neue Chat-Sessions und dauerhafte Leitplanken. Hält fest, nach welchen Regeln und Qualitätsmaßstäben das Gesamtsystem entwickelt, getestet und gewartet wird.  
> **Fokus:** Keine Aufgabenlisten, sondern Qualitätsstandards, Test-Philosophien (Chaos-Daten, Anti-Overfitting) und übergeordnete Systemarchitektur.


## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.