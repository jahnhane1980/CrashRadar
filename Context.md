# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **Primäres Ziel:** Fortsetzung der "Hardcore"-Testabdeckung der Indikatoren (Ziel: 100% Coverage).
* **Nächstes Target:** `MlRegimeRadarMacroIndicator` und die verbleibenden Indikatoren aus der `TODO.md`.
* **Wichtige Erkenntnis aus letzter Session:** Viele alte Indikatoren verlassen sich blind auf verschachtelte API-Objekte (z.B. `day.assets.VIX`, `macroGroups.Leading.MarginDebt`). Dies führt zu fatalen `TypeError` Abstürzen, wenn Arrays unvollständig sind. Wir nutzen in Tests gezielt `delete` auf diesen Objekten, um Abstürze zu provozieren, und sichern sie dann per Optional Chaining (`?.`) ab.

## 2. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
Wir testen nicht mehr mit linearen oder flachen Dummy-Daten. Alle Tests müssen die Algorithmen massiv stressen:
* **Chaos-Arrays:** Daten müssen Sinus-Wellen (Zyklen), hartes Rauschen (`Math.random()`), extreme Gaps (z.B. `+/- 40` Punkte über Nacht) und Volumen-Climaxe (z.B. `15x` Volumen-Spikes) enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüssel und ganze Knotenpunkte (wie `assets` oder `macroGroups`), um die Robustheit der Indikatoren gegen fehlende Daten zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände, um Fallbacks (`|| 0`) zu erzwingen.
* **Anti-Overfitting (Noise Injection):** Wir nutzen Rauschen, um sicherzustellen, dass die Indikatoren nicht auf sterile "Happy Paths" überoptimiert sind.

## 3. Strikte Arbeitsregeln (Modus: Code-Buddy)
Diese Regeln gelten für den KI-Agenten zwingend in jeder Session:
1. **Keine Autokorrekturen an Kernklassen:** Schlägt ein Test fehl, wird **niemals** eigenmächtig der Produktionscode (z.B. Indikatoren) umgeschrieben. Stattdessen wird der Fehler (inklusive toter Code-Pfade) sauber analysiert und dem User ein Lösungsvorschlag angeboten.
2. **Absolute Transparenz & Keine Annahmen:** Wenn eine Datei nicht im aktiven Kontext ist, wird sie eingelesen. Keine Schätzungen oder Raten von Variablen.
3. **Receipt-Pflicht:** Jede Suche oder Aktion wird belegt.
4. **Fokus-Garantie:** Es wird exakt nur das geändert, was besprochen wurde. Bestehende Kommentare, Logiken und Variablen bleiben unangetastet.

## 4. Abgeschlossene Meilensteine (Historie)
* Die monolithische `IndicatorEngine.js` wurde vollständig in autarke Indikator-Klassen ausgelagert.
* Core-Services (`MathUtils.js`, `YahooFinanceFetchAdapter.js`, `DefaultFeatureBuilder.js`, `RegimeService.js`) sind bereits erfolgreich durch Chaos-Tests auf 100% Coverage gebracht worden.
* Etwa die Hälfte der Indikatoren (z.B. GDX-Familie, Gold-Familie, ML-Radar-Familie) ist bereits komplett abgestützt und auf 100% gebracht.