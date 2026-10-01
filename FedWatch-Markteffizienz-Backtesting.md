# Spezifikation: Falsifikation & Backtesting der FedWatch-Markteffizienz

## 1. Zielsetzung & Methodik
Ziel dieser Analyse ist es nicht, die triviale Trefferquote des CME FedWatch Tools zu bestätigen (*Confirmation Bias*), sondern die **Grenzen und Anomalien der Markteffizienz** rund um FOMC-Zinsentscheide systematisch zu falsifizieren.

Dazu werden die **Prognosegüte der Zinsderivate** (Fed Funds Futures) und die **Informationseffizienz der Aktienmärkte** (S&P 500 / Nasdaq 100) strikt getrennt untersucht (*Entkopplung des Joint-Hypothesis-Problems*). Im Zentrum steht die Frage, warum trotz hoher vorab eingepreister Wahrscheinlichkeiten erhebliche Volatilitätsimpulse an den Märkten entstehen und welche Informationskomponenten (Zinsentscheid vs. Pressekonferenz vs. Dot Plot) diese treiben.

---

## 2. Entkoppelte Hypothesen-Definition

### Dimension A: Prognosegüte der Zinsderivate ($H_{0, \text{Rate}}$)
> **$H_{0, \text{Rate}}$ (Probabilistische Kalibrierung):**  
> Die durch Zins-Futures (CME FedWatch Tool) signalisierte Wahrscheinlichkeitsverteilung bei $T_{-48h}$ ist statistisch kalibriert. Ein Marktkonsens von $P \ge 0{,}80$ für eine bestimmte Zinsaktion führt in mindestens $(1 - \alpha) \cdot 100\,\%$ der Fälle zum Eintreffen dieses Beschlusses; die beobachtete Ausfallrate übersteigt nicht das theoretische Fehlerbudget von $20\,\%$ signifikant ($p \ge 0{,}05$, Binomialtest).

> **$H_{1, \text{Rate}}$ (Konsens-Verzerrung / Schock-Fragilität):**  
> Bei $P \ge 0{,}80$ treten systematische Konsensbrüche auf ($\text{Failure Rate} > 20\,\%$), hervorgerufen durch Notfallinterventionen, exogene Liquiditätsschocks oder kurzfristige geldpolitische Kehrtwenden, die von den Derivatemärkten systematisch fehlbepreist werden.

### Dimension B: Informationseffizienz der Aktienmärkte ($H_{0, \text{Market}}$)
> **$H_{0, \text{Market}}$ (Vollständige Einpreisung des Zinsbeschlusses):**  
> Liegt bei $T_{-48h}$ ein Konsens von $P \ge 0{,}80$ vor, ist der Leitzinsbeschluss im engen Veröffentlichungsfenster (Tight Window: 13:55–14:15 ET) vollständig eingepreist. Die anormale Rendite und die realisierte Volatilität in Index-Futures (`ES`, `NQ`) weichen in diesem Fenster nicht signifikant von Nicht-FOMC-Kontrolltagen ab.

> **$H_{1, \text{Market}}$ (Guidance- & Überhang-Dominanz):**  
> Trotz vollständig eingepreistem Zinsbeschluss treten an FOMC-Tagen mit $P \ge 0{,}80$ signifikante Volatilitäts- und Drift-Impulse auf. Diese entstehen jedoch nicht durch die Zinsentscheidung selbst, sondern konzentrieren sich asymmetrisch auf:
> 1. Das **Pressekonferenz-Fenster** (14:25–15:45 ET, Powell-Kommunikation/Q&A),
> 2. Termine mit **Summary of Economic Projections (SEP / Dot Plot)** gegenüber reinen Statement-Meetings.

---

## 3. Falsifizierende Testarchitektur & Metriken

### Test 1: Probabilistische Validierung & Konsensversagen (Prediction Failure)
* **Fragestellung:** Ist die Ausfallrate bei $P \ge 0{,}80$ mit der statistischen Wahrscheinlichkeitsverteilung vereinbar, oder liegt eine systematische Überkonfidenz der Zins-Futures vor?
* **Segmentierung:**
  * *Reguläre FOMC-Meetings* (8 Termine/Jahr).
  * *Intermeeting- / Notfall-Zinsschritte* (z. B. 2008, 2020; Erfassung als Schock-Klasse zur Vermeidung von Censoring Bias).
* **Metrik:** 
  $$\text{Empirical Failure Rate} = \frac{\sum [P_{\text{implizit}} \ge 0{,}80 \land \text{Aktion}_{\text{real}} \ne \text{Aktion}_{\text{erwartet}}]}{\sum [P_{\text{implizit}} \ge 0{,}80]}$$
* **Falsifikationskriterium:**
  * Exakter Binomialtest gegen die **feste Schwelle** $0{,}20$: Die Nullhypothese ($H_0$: Failure Rate $\le 0{,}20$) wird verworfen, wenn die empirische Fehlerrate diese Schwelle mit $p < 0{,}05$ signifikant übersteigt. Die Schwelle leitet sich direkt aus der Hypothesendefinition ab ($P \ge 0{,}80$ impliziert maximal $20\,\%$ tolerierte Fehlprognosen) und ist unabhängig von der Sample-Zusammensetzung klar falsifizierbar.
  * Kalibrierungsprüfung über Brier-Score-Reliability-Zerlegung ($BS = \text{Reliability} - \text{Resolution} + \text{Uncertainty}$).  
    *Interpretationsrichtung:* `Reliability ↓ besser` (geringerer Kalibrierungsfehler zwischen vorhergesagter und beobachteter Häufigkeit); `Resolution ↑ besser` (höhere Trennschärfe – gute Prognosen differenzieren zwischen schwierigen und einfachen Ereignissen); `Uncertainty` ist datenkonstant (klimatologischer Basisrausch, unabhängig vom Forecaster).
* **Attribution:** Qualitative Analyse der Fehlprognosen (z. B. Liquiditätskrisen, Banken-Stress, Geopolitik).

### Test 2: Multi-Window Event Study & SEP-Divergenz (Post-Announcement Dynamics)
* **Fragestellung:** Zu welchem Zeitpunkt und durch welche Informationskomponente entsteht die Volatilität an Tagen mit $P \ge 0{,}80$?
* **2-Ebenen-Architektur (Pragmatischer Daten-Schnitt):**
  * **Ebene 1 (Multi-Dekaden Makro-Drift, 2000–2026 via `market_data_yahoo`):**
    * Analyse der vollen 26 Jahre ($N \approx 208$ Meetings) auf Basis täglicher Schlusskurse von `ES=F` und `NQ=F`.
    * Untersucht den 24-Stunden-Drift ($T_0$ bis $T_{+24h}$) bei $P \ge 0{,}80$ im Vergleich zu einer Kontrollgruppe normaler Nicht-FOMC-Handelstage.
  * **Ebene 2 (Mikrostrukturelle Intraday-Zerlegung, ab Mai 2024 via `market_data_m5`):**
    * Hochauflösende 5-Minuten-Analyse für `SPY` und `QQQ` zur isolierten Trennung von Zinsentscheid und Pressekonferenz:
      1. **Tight Window ($W_1$, 13:55–14:15 ET):** Isolierte Wirkung des Zinsbeschlusses & Statement-Textes, intern aufgeteilt in:
         * **$W_{1a}$ (13:55–14:00 ET):** Pre-Announcement Microstructure-Baseline. Erfasst Liquiditätsrückzug und Bid-Ask-Spread-Ausweitung unmittelbar vor der Veröffentlichung. Dient als Intra-Window-Kontrollbasis. Der 5-Minuten-Vorlauf ist kein Datenfehler, sondern **bewusstes Design**.
         * **$W_{1b}$ (14:00–14:15 ET):** Post-Announcement Price Discovery. Der FOMC-Beschluss wird planmäßig um 14:00 ET veröffentlicht; dieses Sub-Fenster isoliert die unmittelbare Marktreaktion auf Zinsentscheid und Statement-Text.
      2. **Press Window ($W_2$, 14:25–15:45 ET):** Forward Guidance, Pressekonferenz und Q&A.
      3. **Next-Day Drift Window ($W_3$, 16:00 ET bis Folgetag 16:00 ET):** Überhang-Drift (kontrolliert für Folgetagsdaten wie Initial Jobless Claims um 08:30 ET).
* **Meeting-Differenzierung:**
  * **SEP-Meetings (4x/Jahr):** Veröffentlichung von Dot Plot und Wirtschaftsprojektionen.
  * **Non-SEP-Meetings (4x/Jahr):** Reine Statement-Entscheidungen.
  * *Datenbank-Mapping:* Die Klassifizierung erfolgt über die Tabelle `macro_calendar_events` im JSON-Feld `metadata_json` über das Flag `hasSummaryOfEconomicProjections`:
    * Bei SEP-Terminen (z. B. `fomc_2026_09_16`): `"hasSummaryOfEconomicProjections": true`.
    * Bei Nicht-SEP-Terminen (z. B. `fomc_2026_11_05`): `"hasSummaryOfEconomicProjections": false`.
* **Metrik:** Anormale absolute Rendite ($AR$) und Realized Volatility ($RV$) im Vergleich zu einer Kontrollgruppe aus Nicht-Event-Handelstagen ($N_{\text{Control}}$):
  $$AR_{W} = |R_{W}| - \overline{|R_{\text{Control}, W}|}$$
  $$RV_{W} = \sqrt{\frac{1}{n} \sum_{j=1}^{n} r_{j,W}^{2}} \quad \text{(Quadratmittel der M5-Log-Returns im Fenster } W\text{, annualisierbar)}$$
  Beide Metriken werden separat gegen die Kontrollgruppe getestet und erfordern eigene Signifikanzgrenzen (vgl. Falsifikationskriterium).
* **Falsifikationskriterium:**
  * **Auf Ebene 1 (2000–2026):** Der 24h-Drift nach Meetings mit $P \ge 0{,}80$ weist signifikant erhöhte anormale Volatilität gegenüber Kontrolltagen auf ($AR_{24h} > 0, p < 0{,}01$) – insbesondere bei SEP-Meetings gegenüber Non-SEP-Meetings.
  * **Auf Ebene 2 (M5 ab Mai 2024):** Wenn im Tight Window ($W_1$) bei $P \ge 0{,}80$ keine signifikante Überrendite auftritt ($AR_{W_1} \approx 0, p > 0{,}10$), aber im Press Window ($W_2$) anormale Volatilität dominiert ($AR_{W_2} > 0, p < 0{,}01$), ist die These der „blinden Markteffizienz“ widerlegt: Der Markt preist den Leitzins ein, scheitert jedoch an der verbalen Guidance.

### Test 3: Unsicherheitszerfall & Signal-Reifegrad (Decay of Uncertainty)
* **Fragestellung:** Wann konvergiert die Information in den Zins-Futures gegen den finalen Beschluss, und welche Rolle spielen Makro-Veröffentlichungen versus Fed Blackout Period?
* **Stützstellen-Definition (Institutioneller Schnitt):**
  * $T_{\text{MonthStart}}$: Erster Handelstag des Sitzungsmonats (maximaler valider Vorlauf mit Front-Month `ZQ=F`, ca. 10–25 Kalendertage).
  * $T_{\text{Pre-Blackout}}$: Letzter Handelstag vor Beginn der offiziellen FOMC Blackout Period (ca. $T_{-10}$ bis $T_{-12}$).
  * $T_{\text{Post-CPI}}$: Handelsschluss unmittelbar nach Veröffentlichung des letzten Core-CPI-Reports vor der FOMC-Sitzung.
  * $T_{-48h}$: Finaler Pre-Announcement-Konsens (48 Stunden vor dem Zinsentscheid).
* **Metrik:** Multi-Class Brier Score ($BS$) und Log-Loss für alle Zinskorridor-Klassen an den 4 institutionellen Stützstellen:
  $$BS_t = \frac{1}{N} \sum_{i=1}^N \sum_{k=1}^K (p_{i,k,t} - y_{i,k})^2$$
* **Benchmark:**
  * Vergleich gegen eine **Status-Quo-Baseline** (No-Change-Martingale).
  * Vergleich gegen den **Ökonomen-Konsens** (Bloomberg/Reuters Pre-Meeting Polls vor der Blackout Period).
* **Falsifikationskriterium:**
  * Signalstärke vor Beginn der Blackout Period ($T_{\text{Pre-Blackout}}$) schneidet nicht signifikant besser ab als der Ökonomen-Konsens ($p > 0{,}05$).
  * Sprunghafte Informationsgewinne treten empirisch an Makro-Veröffentlichungstagen (CPI) auf, nicht durch kontinuierlichen linearen Zeitverlauf.

---

## 4. Daten- & Mikrostruktur-Anforderungen

1. **Mathematische CME-Berechnungslogik & Future-Rekonstruktion:**
   * Ein 30-Day Fed Funds Future (`ZQ`) rechnet auf den arithmetischen Durchschnitt der täglichen Effective Federal Funds Rate (EFFR) über alle Kalendertage des Sitzungsmonats ab.
   * **Monats-Implizite Rate:**
     $$R_{\text{Monat}} = 100 - \text{FuturesPrice}$$
   * **Kalendertags-Akkumulation & Wochenend-Regel:**
     * Zinsen laufen an 7 Tagen pro Woche auf. Für Samstage und Sonntage gilt der EFFR-Satz des vorangegangenen Freitags (analog für Feiertage).
     * Sei $N$ die Gesamtzahl der Kalendertage im Monat (28, 29, 30 oder 31) und $M$ der Kalendertag des FOMC-Zinsentscheids.
     * Tage **vor** dem Entscheid ($D_{\text{before}} = M - 1$, Kalendertage 1 bis $M-1$) laufen zum aktuellen Zinssatz $R_{\text{alt}}$ (EFFR vor der Sitzung). Der Entscheidungstag selbst zählt bereits zum neuen Satz, da der Beschluss noch am selben Kalendertag wirksam wird.
     * Tage **ab** dem Entscheid inklusive Entscheidungstag ($D_{\text{after}} = N - M + 1$, Kalendertage $M$ bis $N$) laufen zum neuen Zinssatz $R_{\text{neu}}$. Prüfung: $D_{\text{before}} + D_{\text{after}} = (M-1) + (N-M+1) = N$ ✔
       $$R_{\text{Monat}} = \frac{D_{\text{before}} \cdot R_{\text{alt}} + D_{\text{after}} \cdot R_{\text{neu}}}{N}$$
   * **Erwarteter neuer Zielsatz ($R_{\text{neu}}$):**
     $$R_{\text{neu}} = \frac{N \cdot R_{\text{Monat}} - D_{\text{before}} \cdot R_{\text{alt}}}{D_{\text{after}}}$$
   * **Wahrscheinlichkeitsverteilung über 25-Bp-Korridore:**
     Liegt $R_{\text{neu}}$ zwischen zwei Zielkorridoren $K_1$ und $K_2 = K_1 + 0{,}25\,\%$:
     $$P(K_2) = \min\left(\max\left(\frac{R_{\text{neu}} - K_1}{0{,}25}, 0{,}0\right), 1{,}0\right) \quad \text{und} \quad P(K_1) = 1 - P(K_2)$$
2. **Epochen-Filter:**
   * **3-Tier-ZLB-Klassifikation** für korrekte Einbeziehung bzw. Ausgrenzung von Niedrigzins-Phasen:
     * **Tier 1 – Hard-ZLB** (16.12.2008–17.12.2015 & 16.03.2020–30.06.2021): Zinsänderungen strukturell blockiert, Futures-Signalvarianz → 0 (P ≈ 1,0 für Hold ist trivial). Diese Meetings werden aus Zähler und Nenner der Failure Rate in Test 1 **ausgeschlossen**.
     * **Tier 2 – ZLB-Lift-off-Antizipation** (01.07.2021–17.03.2022): Technisch noch ZLB, aber Futures preisen aktiv Lift-off-Timing ein (signifikante Signalvarianz vorhanden). Diese Meetings werden **einbezogen**, jedoch mit dem Flag `zlb_anticipation: true` im `metadata_json` markiert, um isolierte Subgruppenanalysen zu ermöglichen.
     * **Tier 3 – Intermeeting-/Notfall-Schocks** (z. B. 03.03.2020, 15.03.2020): Unabhängig von der ZLB-Phase immer als **Schock-Klasse** in Test 1 klassifiziert (Segment "Notfall", Zeile 36) und **nie gefiltert**. Sie sind die primären Falsifizierungsereignisse für $H_{1, \text{Rate}}$ und dürfen nicht durch den ZLB-Filter zensiert werden.
3. **Zeitzonen-, Feiertags- & Front-Month-Governance:**
   * Strikte Normalisierung von $T_{-48h}$ auf US/Eastern Time unter Ausschluss von Wochenenden und Börsenfeiertagen (Martin Luther King Jr. Day, Memorial Day, Juneteenth, Labor Day).
   * **Front-Month-Gültigkeitsgrenze (`ZQ=F`):** Der kontinuierliche Yahoo-Future `ZQ=F` rolliert zum Monatswechsel. Bei $T_{-48h}$ und Stützstellen innerhalb des Sitzungsmonats bildet `ZQ=F` verlässlich den Kontrakt des Sitzungsmonats ab. Starre Vorläufe wie $T_{-30}$ bei frühen Monatsterminen würden in den Vormonats-Kontrakt greifen; daher werden für Test 3 institutionelle Stützstellen ($T_{\text{MonthStart}}$ ab dem 1. des Sitzungsmonats) verwendet.
4. **SEP / Dot-Plot Identifikation in der Datenbank:**
   * Die Unterscheidung zwischen Dot-Plot-Sitzungen (März, Juni, September, Dezember) und reinen Statement-Sitzungen ist in der Tabelle `macro_calendar_events` im JSON-Feld `metadata_json` hinterlegt:
     * **SEP-Meeting:** `"hasSummaryOfEconomicProjections": true` (z. B. `id = 'fomc_2026_09_16'`)
     * **Nicht-SEP-Meeting:** `"hasSummaryOfEconomicProjections": false` (z. B. `id = 'fomc_2026_11_05'`)
   * Im Test-Runner kann die Abfrage direkt per SQL erfolgen:
     ```sql
     SELECT id, event_date, title, 
            metadata_json->>'$.hasSummaryOfEconomicProjections' AS has_sep
     FROM macro_calendar_events 
     WHERE subcategory = 'FOMC';
     ```
5. **Leitzins-Zielmetrik & Historischer Übergang (`DFEDTARU` vs. `DFEDTAR`):**
   * Zur Ermittlung der tatsächlichen Zinsaktion ($\text{Aktion}_{\text{real}}$) wird das Delta des Zielzinssatzes herangezogen:
     $$\Delta \text{Rate} = \text{TargetRate}_t - \text{TargetRate}_{t-1}$$
   * **Serie-Wahl:** Als Standard wird **`DFEDTARU`** (Federal Funds Target Range - Upper Limit) anstelle von `DFEDTARL` gewählt. Da die Spanne seit Dezember 2008 konstant 25 Basispunkte breit ist, ist das berechnete Delta bei beiden Serien rechnerisch identisch ($\Delta \text{DFEDTARU} \equiv \Delta \text{DFEDTARL}$).
   * **Nahtloser 2008er-Übergang & Architektur-Konvention:** Vor dem 16.12.2008 nutzte die Fed kein Zielband, sondern ein Punktziel (FRED-Serie `DFEDTAR`). Beim Wechsel am 16.12.2008 (von 1,00 % auf 0,00–0,25 %) ergibt die Verknüpfung mit `DFEDTARU` ein Delta von $-75\text{ Bp}$ (mit `DFEDTARL` wären es $-100\text{ Bp}$). Da die Fed diesen Schritt offiziell als „75–100 Bp Senkung" kommunizierte (ambigues Zielband ohne eindeutigen Referenzpunkt), ist die Wahl der oberen Bandgrenze eine **explizite Architektur-Konvention** – kein objektiver Wahrheitsanspruch. Sie gilt einheitlich für alle Berechnungen im Projekt und ist in der `ADR`-Dokumentation festzuhalten.
   * **Synthetische Datenanbindung:**
     $$\text{TargetRate} = \text{COALESCE}(\text{DFEDTARU}, \text{DFEDTAR})$$
   * **Konfiguration:** Beide Serien sind in `config/Database-Fetcher-Config.json` unter den Task-IDs `fred_dfedtaru` und `fred_dfedtar` registriert und werden in die Tabelle `econ_fred` (Spalten `series_id`, `observation_date`, `value`) synchronisiert.
6. **Speicherung der synthetisierten P-Werte (Architektur-Entscheidung Option 1):**
   * Die berechneten Wahrscheinlichkeitsverteilungen werden atomar im Feld `metadata_json` des jeweiligen Events in `macro_calendar_events` abgelegt. Dadurch bleibt das Datenmodell einheitlich ohne relationale Zusatztabellen:
     ```json
     {
       "hasSummaryOfEconomicProjections": true,
       "fedwatch": {
         "month_start": { "date": "2026-09-01", "p_hold": 0.15, "p_cut_25": 0.85, "consensus_action": "CUT_25", "consensus_p": 0.85 },
         "pre_blackout": { "date": "2026-09-05", "p_hold": 0.10, "p_cut_25": 0.90, "consensus_action": "CUT_25", "consensus_p": 0.90 },
         "post_cpi": { "date": "2026-09-11", "p_hold": 0.05, "p_cut_25": 0.95, "consensus_action": "CUT_25", "consensus_p": 0.95 },
         "t_minus_48h": { "date": "2026-09-14", "p_hold": 0.00, "p_cut_25": 1.00, "consensus_action": "CUT_25", "consensus_p": 1.00 }
       }
     }
     ```
   * **SQL-Abfrage für Konsens-Filter ($P \ge 0{,}80$ bei $T_{-48h}$):**
     ```sql
     SELECT id, event_date, title 
     FROM macro_calendar_events
     WHERE subcategory = 'FOMC'
       AND metadata_json->>'$.fedwatch.t_minus_48h.consensus_p' >= 0.80;
     ```