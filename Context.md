# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **Primäres Ziel:** Erbringung der fehlenden empirischen Beweise (Backtest-Skripte) für die extrem spezifischen Thesen aus der `docs/Analyse.md`. Siehe `TODO.md` Punkt 1 ("Ausstehende Beweisführungen").
* **Nächstes Target:** Wir beginnen mit der Erstellung der Backtest-Skripte im Verzeichnis `scratch/analyse/`. Wir müssen die Behauptungen methodisch beweisen (z.B. Tech-Infrastruktur-Rotation mit 13F/DIX, MSTR/COIN-Vorlauf in Tagen, CBOE-VIX-Aktien-Boden, LSTM 79%-Trefferquote, Fractional Kelly, RVOL-These).
* **Wichtige Erkenntnis:** Die `Analyse.md` wurde überarbeitet und mit lauten `[TODO] BEWEIS ANTRETTEN:`-Markern versehen. Unser Fokus ist es jetzt, diese TODOs im Code zu tilgen und die Ergebnisse in der Doku zu verlinken.

## 2. Abgeschlossene Meilensteine (Historie)
* **Testabdeckung & Härtung:** Sämtliche 35 Core-Indikatoren und Services wurden in extremen Chaos-Tests (fehlende Daten, Rauschen) erfolgreich gehärtet. Die Testsuite ist zu **100% grün** (751/751 Tests bestanden) und die Coverage liegt am Maximum.
* **Architektur:** Die monolithische `IndicatorEngine.js` wurde erfolgreich in autarke Indikator-Klassen (Registry-Pattern) ausgelagert.
* **Analyse & Doku:** Thesen aus `neue-Thesen.md` wurden tief in die Kern-Doku integriert und alle existierenden Beweis-Skripte aus `scratch/analyse/` wurden lückenlos verlinkt.

## 3. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 4. Strikte Arbeitsregeln (Modus: Code-Buddy)
Diese Regeln gelten für den KI-Agenten zwingend in jeder Session:
1. **Keine Autokorrekturen:** Schlägt ein Skript fehl, wird **niemals** eigenmächtig der Produktionscode überschrieben. Stattdessen den Fehler sauber analysieren und dem User einen Lösungsvorschlag machen.
2. **Absolute Transparenz & Keine Annahmen:** Wenn eine Datei nicht im aktiven Kontext ist, wird sie eingelesen. Keine Schätzungen oder Raten von Variablen.
3. **Receipt-Pflicht:** Jede Kontext-Suche oder Aktion wird im Chat belegt.
4. **Fokus-Garantie:** Es wird exakt nur das geändert, was besprochen wurde. Bestehende Kommentare, Logiken und Variablen bleiben unangetastet.