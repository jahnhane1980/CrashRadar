# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **Primäres Ziel:** Fortsetzung der "Hardcore"-Testabdeckung (100% Coverage).
* **Nächstes Target:** `src/services/RegimeService.js` (aktuell ~74% Coverage).
* **Danach:** Fortsetzung der Checkliste in der `TODO.md` (Verbleibende 24 Einzel-Indikatoren).

## 2. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
Wir testen nicht mehr mit linearen oder flachen Dummy-Daten. Alle Tests müssen die Algorithmen massiv stressen:
* **Chaos-Arrays:** Daten müssen Sinus-Wellen (Zyklen), hartes Rauschen (`Math.random()`), extreme Gaps (z.B. `+/- 40` Punkte über Nacht) und Volumen-Climaxe (z.B. `15x` Volumen-Spikes) enthalten.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien (z.B. konstantes Volumen über 60 Tage für `Volume_Z_Score` Standardabweichung 0) oder in Ausweich-Zweige (z.B. `Math.abs(high - prevClose)` beim ATR).
* **Anti-Overfitting (Noise Injection):** Wir nutzen Rauschen, um sicherzustellen, dass die Indikatoren nicht auf sterile "Happy Paths" überoptimiert sind.

## 3. Strikte Arbeitsregeln (Modus: Code-Buddy)
Diese Regeln gelten für den KI-Agenten zwingend in jeder Session:
1. **Keine Autokorrekturen an Kernklassen:** Schlägt ein Test fehl, wird **niemals** eigenmächtig der Produktionscode (z.B. Indikatoren) umgeschrieben. Stattdessen wird der Fehler sauber analysiert und dem User ein Lösungsvorschlag angeboten.
2. **Absolute Transparenz & Keine Annahmen:** Wenn eine Datei nicht im aktiven Kontext ist, wird sie eingelesen. Keine Schätzungen oder Raten von Variablen.
3. **Receipt-Pflicht:** Jede Suche oder Aktion wird belegt.
4. **Fokus-Garantie:** Es wird exakt nur das geändert, was besprochen wurde. Bestehende Kommentare, Logiken und Variablen bleiben unangetastet.

## 4. Abgeschlossene Meilensteine (Historie)
* Die monolithische `IndicatorEngine.js` wurde vollständig zerschlagen und in 35 dezentrale, autarke Indikator-Klassen (Registry-Pattern) ausgelagert.
* Festplatten-I/O und Notification-Logik wurden sauber abstrahiert (`NotificationManager`).
* Core-Services (`MathUtils.js`, `YahooFinanceFetchAdapter.js`, `DefaultFeatureBuilder.js`) wurden bereits erfolgreich durch Chaos-Tests auf 100% Coverage gebracht.