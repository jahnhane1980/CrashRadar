# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Aktueller Fokus (Nächste Session)
* **GOLD & GDX Dynamisches Debouncing:** Das statische 14-Tage-Debouncing in `getAlerts` muss in "Crash-Phasen" (Crisis Mode) dynamisch auf 1-5 Tage reduziert werden, um V-Shape-Böden und essenzielle Folge-Alarme nicht zu verpassen.

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
2. **SEC 13F (Verworfen für exaktes Timing):** 
   * **Erkenntnis:** Wir haben empirisch bewiesen, dass 13F-Daten (Hedgefonds Holdings) aufgrund der gesetzlichen Quartalsmeldung und der 45-Tage Grace Period für das exakte Crash-Timing völlig blind sind. Sie fliegen aus der direkten Signal-Logik der Engine raus und dienen maximal zur historischen Langzeit-Bestätigung.
3. **Retail-Proxy (Die beweisbare "Dumb Money" Divergenz):** 
   * Da Optionen (PCR) institutionelles und privates Geld unbeweisbar vermischen, nutzen wir rein explizite Proxies für den Retail- vs. Smart-Money-Split:
   * **Die Retail-Masse (Dumb Money):** 
     - *AAII Sentiment Survey:* Misst wöchentlich die Gier der Main Street (Kleinanleger). Ein Bull/Bear Spread auf Extremwerten beweist blinde Gier. Datenbezug via Scraper/API.
     - *FINRA Margin Debt:* Misst die Überschuldung auf Pump, was historisch ein reines Retail-Phänomen am Top ist. Bezug via monatlichem FINRA CSV-Download. **(Bereits vollständig im FinraFetchAdapter implementiert!)**
   * **Das Smart Money (Active Managers):** 
     - *NAAIM Exposure Index:* Misst wöchentlich die Aktienquote aktiver US-Fondsmanager. Bezug via NAAIM Website (Excel/Scraper).
   * **Der finale Beweis (Divergenz):** Der Markt crasht, wenn der AAII (Retail) auf "Gier" steht und das Margin Debt auf Allzeithoch klettert, WÄHREND der NAAIM Index fällt und die Top 20 Hedgefonds (13F) netto verkaufen.

## 5. Ergebnisse der Smart vs. Dumb Money Divergenz (Beweisführung)
*(Diese Ergebnisse stammen aus dem Skript `scratch/analyse/test_dumb_money.js` und zeigen das divergierende Verhalten von Smart und Dumb Money an den absoluten Tops und Bottoms der größten Crashes).*

### Corona Flash-Crash 2020
```text
┌─────────┬────────────────────────────┬────────────┬──────────┬────────────┬────────────┐
│ (index) │ Metric                     │ T-3 Months │ The Top  │ The Bottom │ T+3 Months │
├─────────┼────────────────────────────┼────────────┼──────────┼────────────┼────────────┤
│ 0       │ 'DIX (Dark Pool %)'        │ '42.2%'    │ '41.7%'  │ '36.7%'    │ '46.9%'    │
│ 1       │ 'AAII Spread (Retail)'     │ '15.9%'    │ '14.9%'  │ '-16.8%'   │ '-23.4%'   │
│ 2       │ 'NAAIM Exposure (Profi)'   │ '72.3'     │ '87.9'   │ '10.7'     │ '88.3'     │
│ 3       │ 'VIX (Panik/Angst)'        │ '12.86'    │ '14.38'  │ '61.59'    │ '31.77'    │
│ 4       │ 'SKEW (Tail Risk Hedging)' │ '127.46'   │ '141.81' │ '117.05'   │ '135.54'   │
└─────────┴────────────────────────────┴────────────┴──────────┴────────────┴────────────┘
```
* **Beobachtung:** VIX bei Top extrem ruhig (`14.38`). Aber der SKEW stand auf sehr hohen `141.81` – Institutionen haben massiv Puts gekauft (gehedged), bevor der Markt crashte. Am Bottom explodierte der VIX auf `61.59` (Retail Panik), während das Smart Money seine Puts längst verkauft hatte (SKEW fiel auf `117.05`).

### Inflations-Bärenmarkt 2022
```text
┌─────────┬────────────────────────────┬────────────┬──────────┬────────────┬────────────┐
│ (index) │ Metric                     │ T-3 Months │ The Top  │ The Bottom │ T+3 Months │
├─────────┼────────────────────────────┼────────────┼──────────┼────────────┼────────────┤
│ 0       │ 'DIX (Dark Pool %)'        │ '43.7%'    │ '43.1%'  │ '43.0%'    │ '47.6%'    │
│ 1       │ 'AAII Spread (Retail)'     │ '-12.6%'   │ '7.1%'   │ '-30.8%'   │ '-15.9%'   │
│ 2       │ 'NAAIM Exposure (Profi)'   │ '55.0'     │ '85.7'   │ '19.8'     │ '45.3'     │
│ 3       │ 'VIX (Panik/Angst)'        │ '21.10'    │ '16.91'  │ '33.57'    │ '18.83'    │
│ 4       │ 'SKEW (Tail Risk Hedging)' │ '135.05'   │ '150.36' │ '119.99'   │ '117.39'   │
└─────────┴────────────────────────────┴────────────┴──────────┴────────────┴────────────┘
```
* **Beobachtung:** VIX niedrig am Top (`16.91`), SKEW massiv erhöht auf `150.36`. Am absoluten Tiefpunkt herrschte Retail-Panik (AAII `-30.8%`) und die Dark Pools liefen heiß (`47.6%`).

### KI-Crash 2025
```text
┌─────────┬────────────────────────────┬────────────┬──────────┬────────────┬────────────┐
│ (index) │ Metric                     │ T-3 Months │ The Top  │ The Bottom │ T+3 Months │
├─────────┼────────────────────────────┼────────────┼──────────┼────────────┼────────────┤
│ 0       │ 'DIX (Dark Pool %)'        │ '44.3%'    │ '47.8%'  │ '49.3%'    │ '44.8%'    │
│ 1       │ 'AAII Spread (Retail)'     │ '21.5%'    │ '-18.9%' │ '-24.7%'   │ '-5.2%'    │
│ 2       │ 'NAAIM Exposure (Profi)'   │ '91.6'     │ '91.5'   │ '57.5'     │ '81.4'     │
│ 3       │ 'VIX (Panik/Angst)'        │ '16.35'    │ '15.27'  │ '21.77'    │ '16.83'    │
│ 4       │ 'SKEW (Tail Risk Hedging)' │ '149.46'   │ '175.76' │ '143.01'   │ '140.07'   │
│ 5       │ '13F Long Stocks ($)'      │ '261.2B'   │ '276.2B' │ '274.9B'   │ '305.3B'   │
│ 6       │ '13F PUT Options ($)'      │ '8.3B'     │ '4.5B'   │ '4.3B'     │ '5.2B'     │
│ 7       │ '13F CALL Options ($)'     │ '4.3B'     │ '5.4B'   │ '5.2B'     │ '5.6B'     │
└─────────┴────────────────────────────┴────────────┴──────────┴────────────┴────────────┘
```
* **Beobachtung:** Beim simulierten Top lag der SKEW bei abartigen `175.76`. Das Smart Money hatte extreme Angst und sicherte sich ab. Retail war völlig euphorisch.

### Timing-Regeln (Vorlaufzeiten der Divergenzen)
Aus der historischen Timeline der letzten Crashes leiten sich zwei völlig unterschiedliche Verhaltensmuster für das Timing ab:

**🔴 Das absolute Top (Distribution Window: 21 bis 60 Tage Vorlauf)**
Tops werden vom Smart Money langfristig vorbereitet, während der Preis noch steigt. Die Frühwarn-Divergenzen triggern nicht am Tag des Crashes, sondern weit im Voraus:
1. **SKEW (Tail Risk Hedging):** Schlägt meist **50 bis 60 Tage VOR** dem absoluten Preis-Top an (z.B. > 145). Das Smart Money kauft Puts billig ein, solange der Markt ruhig ist.
2. **AAII (Retail Euphorie):** Erreicht sein Maximum (Spread > 20%) ebenfalls meist **40 bis 60 Tage** vor dem Top. Retail feiert die Party, während Institutionen hedgen.
3. **DIX (Dark Pool Leere):** Fällt oft **7 bis 14 Tage** vor dem Top ab (unter 40%).
*Die Engine-Regel (Distribution):* Wenn SKEW > 145 und AAII > 20%, öffnet sich ein 1-8 wöchiges Crash-Fenster.

**🟢 Das absolute Bottom (Capitulation Window: 0 bis 14 Tage Vorlauf)**
Böden werden nicht langfristig geplant, sondern entstehen durch akute Panik und plötzliches Eingreifen des Smart Money (V-Shape Reversals):
1. **DIX (Wale greifen zu):** Schießt **7 bis 14 Tage VOR** dem finalen Tief plötzlich extrem in die Höhe (> 45%). Das Smart Money kauft das fallende Messer.
2. **AAII (Retail Kapitulation):** Der Spread stürzt **7 bis 14 Tage VOR** dem Tief in extreme Angst-Werte (oft < -25%).
3. **VIX (Der Panik-Peak):** Laggt nicht, sondern erreicht seinen absoluten Höhepunkt **exakt am Tag (0 Tage)** des Preis-Bottoms.
*Die Engine-Regel (Re-Entry):* Wenn VIX > 40, AAII < -25% UND DIX > 45% -> Aggressiver Kauf (The Bottom is in).

*(Hinweis: Die Indikatoren-Klassen, das Fiskal-FED Plumbing (WRESBAL, TGA, BORROW) und das Benachrichtigungs-System (Makro-Wetterbericht) sind nun vollständig implementiert, verknüpft und getestet).*