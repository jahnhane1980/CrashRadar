# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **Nächste Aufgabe:** Aufbau des "Alternative Labor Market" Divergenz-Trackers. Implementierung nativer Scraping-Pipelines für staatliche WARN-Notices ("Big 4": CA, TX, NY, FL) und Integration der Challenger-Reports direkt in das Backend, um eine ungeschönte Echtzeit-Indikation des Arbeitsmarktes zu erhalten (siehe Roadmap).
* **Zurückgestellt:** Ausstehende Daten-Challenge (DIX, 13F-Whale-Filings) für die Tech-Rotations-These.

## 2. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 3. Strikte Arbeitsregeln (Modus: Code-Buddy)
Diese Regeln gelten für den KI-Agenten zwingend in jeder Session:
1. **Keine Autokorrekturen:** Schlägt ein Skript fehl, wird **niemals** eigenmächtig der Produktionscode überschrieben. Stattdessen den Fehler sauber analysieren und dem User einen Lösungsvorschlag machen.
2. **Absolute Transparenz & Keine Annahmen:** Wenn eine Datei nicht im aktiven Kontext ist, wird sie eingelesen. Keine Schätzungen oder Raten von Variablen.
3. **Receipt-Pflicht:** Jede Kontext-Suche oder Aktion wird im Chat belegt.
4. **Fokus-Garantie:** Es wird exakt nur das geändert, was besprochen wurde. Bestehende Kommentare, Logiken und Variablen bleiben unangetastet.