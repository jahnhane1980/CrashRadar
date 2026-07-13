# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus: US-Arbeitsmarkt Divergenz-Tracker
* **Fokus:** Aufbau und Evaluierung eines Event-Driven Arbeitsmarkt-Radars auf Basis von FRED-Zeitreihen (CE16OV, Full-Time/Part-Time, Sahm-Rule).
* **Dokumentation:** Die komplette Spezifikation sowie die Backtest-Ergebnisse sind in [Arbeitsmarkt-Radar_und_Divergenz-Scanner.md](file:///workspaces/CrashRadar/Arbeitsmarkt-Radar_und_Divergenz-Scanner.md) dokumentiert.
* **Status:** Die Datenbeschaffung und der historische Backtest wurden erfolgreich in den Sandbox-Skripten ([download_labor_data.js](file:///workspaces/CrashRadar/scratch/analyse/download_labor_data.js) & [analyze_labor_market.js](file:///workspaces/CrashRadar/scratch/analyse/analyze_labor_market.js)) durchgeführt und validiert.