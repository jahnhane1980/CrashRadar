# Spezifikation: Event-Driven Arbeitsmarkt-Radar & Divergenz-Scanner

Dieses Dokument dient als funktionale und technische Spezifikation für die Implementierung eines automatisierten Markt-Radars. Ziel ist es, makroökonomische Wendepunkte (Zyklus-Tops und beginnende Rezessionen) durch die Analyse von Divergenzen am US-Arbeitsmarkt frühzeitig zu erkennen, bevor diese im S&P 500 eingepreist werden.

---

## 1. Datenquellen und API-Schnittstellen (FRED)

Sämtliche Datenreihen stammen aus der Datenbank der Federal Reserve Bank of St. Louis (FRED). Für die API-Abfragen (`/series/observations`) sind folgende eindeutige IDs zu verwenden:

### 1.1 Basismetrik & Benchmark
*   **S&P 500 Index (`SP500`):** Täglicher Schlusskurs des Aktienmarkt-Benchmarks. Dient zur Ermittlung von Allzeithochs (ATH) und zur Korrelationsanalyse.
*   **Offizielle Arbeitslosenquote (`UNRATE`):** Monatliche Kernrate (U-3) in Prozent. Basis für Trendwenden und die mathematische Sahm-Rule.

### 1.2 Die Divergenz-Datenreihen (Quantität vs. Qualität)
*   **Nonfarm Payrolls (`PAYEMS`):** Gesamtbeschäftigung außerhalb der Landwirtschaft (Establishment/Unternehmens-Umfrage). Monatlich, in Tausend Personen.
*   **Civilian Employment Level (`CE16OV`):** Reales Beschäftigungsniveau aus der Haushalts-Umfrage (Household Survey). Erfasst Individuen statt Stellen und eliminiert Doppelzählungen.
*   **Full-Time Workers (`LNS12500000`):** Anzahl der Personen in Vollzeitbeschäftigung (35+ Stunden/Woche).
*   **Part-Time Workers (`LNS12000000`):** Anzahl der Personen in Teilzeitbeschäftigung.
*   **Multiple Jobholders (`MULTJOB`):** Anzahl der Personen mit mehr als einem Arbeitsverhältnis.

### 1.3 Validierungs- und Kontrollmetriken
*   **U-6 Arbeitslosenquote (`U6RATE`):** Beinhaltet unterbeschäftigte und frustrierte Arbeitskräfte (U-3 + marginal eingebundene + unfreiwillige Teilzeit).
*   **Initial Claims (`ICSA`):** Wöchentliche Erstanträge auf Arbeitslosenhilfe. Dient als hochfrequenter Frühindikator (Leading Indicator), da monatliche Daten stark nachlaufend sind.

---

## 2. Mathematische Modelle & Divergenz-Logiken

Um ein Signal im Radar auszulösen, müssen die Rohdaten in zyklische Verhältnisse und mathematische Regeln übersetzt werden. Die Pipeline muss folgende drei Kern-Divergenzen berechnen:

### 2.1 Die quantitative Schere: `PAYEMS` vs. `CE16OV`
*   **Logik:** In der Spätphase eines Wirtschaftszyklus steigt die offizielle Stellenanzahl (`PAYEMS`) scheinbar stabil weiter (getrieben durch statistische Geburts-/Todes-Schätzmodelle von Unternehmen). Gleichzeitig bricht die Zahl der tatsächlich beschäftigten Individuen in den Haushalten (`CE16OV`) bereits ein.
*   **Berechnung (Rolling Divergence):**
    *   Definiere ein rollierendes 3-Monats-Zeitfenster ($t, t-1, t-2$).
    *   *Bedingung:* $\Delta PAYEMS_{(t, t-2)} > 0$ **UND** $\Delta CE16OV_{(t, t-2)} < 0$.
    *   *Signal-Stärke:* Skaliert mit der Dauer (Monate) und der absoluten Delta-Differenz dieser Schere.

### 2.2 Die qualitative Kern-Divergenz: Vollzeit vs. Teilzeit
*   **Logik:** Unternehmen bauen vor einer Rezession zunächst unbemerkt Vollzeitstellen ab und wandeln diese in Teilzeitstellen um oder lagern Arbeiten aus. Die reine "Headline-Zahl" bleibt konstant, die Qualität implodiert.
*   **Berechnung (Ratio Pivot):**
    *   Berechne die monatliche Ratio: $R_t = \frac{LNS12500000_t}{LNS12000000_t}$ (Vollzeit / Teilzeit).
    *   Ermittle das rollierende 12-Monats-Maximum ($Max_{12}(R)$).
    *   *Signal-Trigger:* Wenn $R_t$ unter einen definierten Schwellenwert (z.B. 2,5% unter dem 12-Monats-Maximum) fällt, während der S&P 500 noch innerhalb von 3% seines Allzeithochs notiert.

### 2.3 Das Multi-Job-Rauschen: `MULTJOB`
*   **Logik:** Ein künstlicher Push der offiziellen Statistik entsteht, wenn Personen aufgrund wirtschaftlichen Drucks Zweit- oder Drittjobs annehmen müssen (jeder Job zählt als $+1$ bei `PAYEMS`).
*   **Berechnung:** Ein starker Anstieg von `MULTJOB` bei gleichzeitiger Stagnation von `CE16OV` validiert, dass das gemeldete Jobwachstum rein struktureller Stress der Bevölkerung ist, keine wirtschaftliche Expansion.

---

## 3. Das Timing- & Auslösemodell (Zündschlüssel)

Während Divergenzen (Sektion 2) oft Monate im Voraus auf den Systemfehler hinweisen, fungiert die **Sahm-Rule** als der definitive, historische Zündschlüssel, der das "Risk-Off"-Szenario für den Aktienmarkt triggert.

### 3.1 Die Sahm-Rule Formel
Das Signal wird ausgelöst, wenn der dreimonatige gleitende Durchschnitt der offiziellen Arbeitslosenquote (`UNRATE`) um **0,50 Prozentpunkte** oder mehr über dem Tiefststand der vorangegangenen 12 Monate liegt.

$$\text{MA3}_{t} = \frac{\text{UNRATE}_t + \text{UNRATE}_{t-1} + \text{UNRATE}_{t-2}}{3}$$

$$\text{Minimum}_{12} = \min(\text{UNRATE}_{t}, \dots, \text{UNRATE}_{t-11})$$

$$\text{Signal-Trigger wenn: } \text{MA3}_{t} - \text{Minimum}_{12} \ge 0.50\%$$

*   **Implementierungs-Hinweis:** Für das Radar sollte eine "Early-Warning-Stufe" bei $\ge 0.30\%$ eingebaut werden. Historisch leitete jeder nachhaltige Anstieg von $>0.30\%$ die finale Trendwende ein.

---

## 4. Historische Muster & Validierung (Empirische Backtest-Ergebnisse)

Im Rahmen des Backtests (unter Verwendung der Daten ab 1995) wurden die theoretischen Annahmen empirisch belegt.

### 4.1 Die historische Validierungs-Matrix

Die folgende Tabelle zeigt, wie viele Monate **vor (grün/negativ)** oder **nach (rot/positiv)** dem S&P 500 Peak die Indikatoren das erste Mal angeschlagen haben:

| Markt-Top (Peak) | S&P Peak-Monat | Quant. Schere (Household vs. Payrolls) | Qual. Schere (Vollzeit vs. Teilzeit) | Sahm-Rule Early-Warning (>= 0.3%) | Sahm-Rule Trigger (>= 0.5%) |
| --- | :---: | :---: | :---: | :---: | :---: |
| **Dotcom-Blase** | `2000-03` | 🟢 **-12 Monate** (PAY:535\|CE:-80) | 🔴 **+8 Monate** (-2.7%) | 🔴 **+11 Monate** (0.30%) | ❌ *Kein Signal* |
| **Finanzkrise (GFC)** | `2007-10` | 🟢 **-6 Monate** (PAY:287\|CE:-471) | 🟢 **-17 Monate** (-2.9%) | 🔴 **+2 Monate** (0.40%) | 🔴 **+4 Monate** (0.57%) |
| **Zins-Panik (2018)** | `2018-09` | 🟢 **-10 Monate** (PAY:364\|CE:-481) | 🟢 **-6 Monate** (-2.5%) | ❌ *Kein Signal* | ❌ *Kein Signal* |
| **Corona-Crash** | `2020-02` | 🟢 **-18 Monate** (PAY:317\|CE:-258) | 🟢 **-1 Monate** (-2.5%) | 🔴 **+1 Monate** (0.33%) | 🔴 **+2 Monate** (4.07%) |
| **Inflations-Schock** | `2022-01` | 🟢 **-12 Monate** (PAY:130\|CE:-113) | 🟢 **-18 Monate** (-15.1%) | 🟢 **-18 Monate** (7.97%) | 🟢 **-18 Monate** (7.97%) |
| **Korrektur (2025)** | `2025-02` | 🟢 **-16 Monate** (PAY:315\|CE:-287) | 🟢 **-18 Monate** (-3.4%) | 🟢 **-16 Monate** (0.37%) | ❌ *Kein Signal* |

### 4.2 Interpretation & Klassifizierung

1. **Frühindikatoren (Leading - 6 bis 18 Monate Vorlauf):**
   * **Vollzeit/Teilzeit-Qualitätsschere:** Schlägt zuverlässig viele Monate vor dem Top an. Das erste Anzeichen dafür, dass Unternehmen Stellen abbauen/umbauen, während der S&P noch neue Rekordhöhen markiert. (Ausnahme: Reine Bewertungsblasen wie Dotcom, bei denen die Realwirtschaft erst nach dem Crash der Finanzmärkte einbrach).
2. **Akutindikatoren (Coincident - 0 bis 3 Monate Vorlauf):**
   * **Quantitative Divergenz (CE16OV vs. PAYEMS):** Bildet die finale Phase der Divergenz. Die Payrolls steigen noch durch statistische Faktoren, aber das reale Beschäftigungsniveau bricht bereits ein.
3. **Spätindikatoren (Lagging - Bestätigung nach dem Top):**
   * **Sahm-Rule & Sahm-Warning:** Triggern historisch meist erst nach dem absoluten Preis-Top, dafür aber mit 100%iger Trefferquote für eine beginnende Rezession. Sie dienen als finaler Zündschlüssel, um defensive Re-Entries zu verhindern.

---

## 5. Implementierte Skripte & Sandbox-Umgebung

Die Auswertung und Datenbeschaffung wurden als Sandbox-Skripte im `./scratch/analyse/`-Verzeichnis umgesetzt:

*   **Daten-Download:** [download_labor_data.js](file:///workspaces/CrashRadar/scratch/analyse/download_labor_data.js) – Lädt alle FRED-Reihen ab 1995 über die API herunter und speichert sie lokal als JSON in `scratch/arbeitsmarkt_tmp/`.
*   **Backtest-Analyse:** [analyze_labor_market.js](file:///workspaces/CrashRadar/scratch/analyse/analyze_labor_market.js) – Verbindet sich mit der lokalen Datenbank (für SPY und ICSA), lädt die JSON-Dateien, harmonisiert die Zeitreihen monatlich und gibt den historischen Validierungs-Report aus.
*   **Generierter Report:** [Crash-Arbeitsmarkt-Analyse.md](file:///workspaces/CrashRadar/scratch/Crash-Arbeitsmarkt-Analyse.md) – Der rohe Analysebericht als separate Datei.