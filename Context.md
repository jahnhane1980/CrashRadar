# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **Nächste Aufgabe:** Implementierung der Fetcher für die Retail-Proxy Indikatoren ("Dumb Money Divergence"): AAII Sentiment, FINRA Margin Debt und NAAIM Exposure Index.

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

## 4. Makro-Theorie & Schwellenwerte (Stealth Exit)
Die These lautet, dass Institutionen bei Liquiditätsengpässen (TGA/Bank-Reserven) ihre Aktien an euphorische Kleinanleger abverkaufen, bevor der Preis-Chart einbricht. Wir suchen nach der Divergenz: Preis steigt + Wale verkaufen + Retail kauft.
Die zu beweisenden Trigger-Schwellen für den Code-Backtest sind:
1. **SqueezeMetrics (DIX):** `DIX < 40 %` (Wale verkaufen/shorten über Dark Pools, während Markt am ATH steht).
2. **SEC 13F (Smart Money Holdings - Der "Rote Alarm"):** 
   * **Der Schwellenwert:** Eine `Netto-Positionsreduzierung` auf breiter Front. Der Alarm löst NICHT aus, weil ein Fonds viel Cash hält. Der Alarm löst aus, wenn die Top 20 Hedgefonds *gleichzeitig* ihre Kern-Tech-Aktien (NVDA, QQQ) massiv reduzieren (Net Outflows) **während** der Kurs in dem Quartal gestiegen ist (Divergenz), und sich dieser Abverkauf von Quartal zu Quartal *beschleunigt*.
   * **Die Top 20 "Smart Money" Tracker-Liste:**
     1. Berkshire Hathaway (0001067983)
     2. Renaissance Technologies (0001037389)
     3. Citadel Advisors (0001423053)
     4. Bridgewater Associates (0001350694)
     5. Duquesne Family Office / Stanley Druckenmiller (0001533621)
     6. Elliott Investment Management (0000902219)
     7. Appaloosa Management / David Tepper (0001006438)
     8. Two Sigma Investments (0001179288)
     9. D.E. Shaw & Co. (0001009207)
     10. Millennium Management (0001273087)
     11. Tiger Global Management (0001167483)
     12. Point72 Asset Management (0001603466)
     13. Baupost Group (0001061768)
     14. AQR Capital Management (0001167557)
     15. Third Point LLC (0001040273)
     16. Tudor Investment Corp (0000855654)
     17. Pershing Square (0001336528)
     18. Soros Fund Management (0001029160)
     19. Coatue Management (0001135730)
     20. Altimeter Capital Management (0001515903)
3. **Retail-Proxy (Die beweisbare "Dumb Money" Divergenz):** 
   * Da Optionen (PCR) institutionelles und privates Geld unbeweisbar vermischen, nutzen wir rein explizite Proxies für den Retail- vs. Smart-Money-Split:
   * **Die Retail-Masse (Dumb Money):** 
     - *AAII Sentiment Survey:* Misst wöchentlich die Gier der Main Street (Kleinanleger). Ein Bull/Bear Spread auf Extremwerten beweist blinde Gier. Datenbezug via Scraper/API.
     - *FINRA Margin Debt:* Misst die Überschuldung auf Pump, was historisch ein reines Retail-Phänomen am Top ist. Bezug via monatlichem FINRA CSV-Download.
   * **Das Smart Money (Active Managers):** 
     - *NAAIM Exposure Index:* Misst wöchentlich die Aktienquote aktiver US-Fondsmanager. Bezug via NAAIM Website (Excel/Scraper).
   * **Der finale Beweis (Divergenz):** Der Markt crasht, wenn der AAII (Retail) auf "Gier" steht und das Margin Debt auf Allzeithoch klettert, WÄHREND der NAAIM Index fällt und die Top 20 Hedgefonds (13F) netto verkaufen.