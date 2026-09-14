# September 2026 Makro- & Rallye-Checkliste

Checkliste zur Überprüfung des „Goldilocks-Szenarios“ für eine nachhaltige Marktrallye.

---

### 1. Arbeitsmarktdaten (KW 36)

- [x] **Dienstag, 01. September 2026 – 16:00 Uhr MESZ | US JOLTS Report (Juli): 🟢 PASS**
  * **Ist-Wert:** 7,27M offene Stellen (Korridor: 6,9M – 7,8M).
  * **Bewertung:** Offene Stellen kühlen sich moderat ab, kein abrupter Einbruch bei der Einstellungsbereitschaft.

- [x] **Freitag, 04. September 2026 – 14:30 Uhr MESZ | US-Arbeitsmarktbericht / Nonfarm Payrolls (August): 🟢 PASS**
  * **Ist-Wert:** +162k neue Stellen (Kriterium: $\ge 40\text{k}$), Sahm-Regel bei -0,07 (Kriterium: $\le 0,50$).
  * **Bewertung:** Arbeitsmarkt stabil im neutralen Korridor, keine Rezessionsgefahr.

---

### 2. Inflationsdaten (KW 37)

- [x] **Donnerstag, 10. September 2026 – 14:30 Uhr MESZ | Erzeugerpreisindex / PPI (August): 🔴 FAIL**
  * **Ist-Wert:** +9,85 % YoY (Kriterium: $\le 9,00\,\%$).
  * **Bewertung:** Rohstoff-Erzeugerpreise überhitzt durch temporären Öl- und Frachtpreisanstieg. Dämpfer im Szenario!

- [x] **Freitag, 11. September 2026 – 14:30 Uhr MESZ | Verbraucherpreisindex / CPI (August): 🟢 PASS**
  * **Ist-Wert:** Core CPI 2,45 % YoY / 0,2 % MoM (Kriterium: $\le 2,70\,\%$).
  * **Bewertung:** Kerninflation bestätigt intakten Disinflationspfad. Inputkosten schlagen nicht auf Konsumenten durch.

---

### 3. Zinsentscheidung & Notenbank-Signal (KW 38)

- [ ] **Mittwoch, 16. September 2026 – 20:00 Uhr MESZ (PK ab 20:30 Uhr) | FOMC-Zinsentscheid & Dot Plot: ⏳ NÄCHSTE PRÜFUNG**
  * **Soll-Kriterium 1 (Zinsschritt):** Zinssenkung um 25 Basispunkte (Signal der Stärke und Planbarkeit statt 50-Bp-Notfallschritt).
  * **Soll-Kriterium 2 (Dot Plot):** Ausblick signalisiert einen stetigen, berechenbaren Zinssenkungspfad für die verbleibenden Sitzungen 2026.
  * **Soll-Kriterium 3 (Pressekonferenz):** Powell betont eine weiche Landung (*Soft Landing*) und signalisiert Zuversicht in die Wirtschaft.

---

### 4. Monatsabschluss & Marktbreite

- [ ] **Mittwoch, 30. September 2026 – 14:30 Uhr MESZ | Core PCE Preisindex (August): ⏳ AUSSTEHEND**
  * **Soll-Kriterium:** Das offizielle Lieblings-Preismaß der Fed bestätigt die Disinflation als Basis für die Oktober-Sitzung ($\le 3,5\,\%$).

- [ ] **Laufend im Monatsverlauf | Marktinterne Begleitfaktoren**
  * **Marktbreite:** Auch Nebenwerte (Russell 2000) und der gleichgewichtete S&P 500 (RSP) steigen mit an (keine reine Big-Tech-Show).
  * **Kreditmarkt:** High-Yield Spreads verharren stabil unter 3,0 %.

> **Hinweis zur System-Automation:** Diese Checkliste wird tagesaktuell und vollautomatisch über die Datenbank-Tabelle [`macro_calendar_events`](file:///D:/GitHub/CrashRadar/docs/architecture/database/Macro-Calendar-Events.md) und den [`MacroScorecardRunner`](file:///D:/GitHub/CrashRadar/src/runners/MacroScorecardRunner.js) gepflegt.