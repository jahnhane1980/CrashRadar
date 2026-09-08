# Architektur- & Implementierungsdokument: Investment- & Signaldienst (V2.1)

Dieses Dokument definiert die End-to-End-Architektur für die Bereitstellung von automatisierten Anlagestrategien, Signalbenachrichtigungen und Portfolio-Trackings über Telegram. Das Gesamtsystem arbeitet serverlos, vollständig innerhalb der kostenfreien Kontingente (0,00 € Betriebskosten) und strikt nach dem Prinzip der **Separation of Concerns**: Trennung von schwerer Analyse-Engine (Pre-Computation) und leichtgewichtigem Edge-Gateway (Personalisierung).

---

## 1. Systemarchitektur & Rollenteilung

Zur Wahrung der Produktionsstabilität des bestehenden Marktdatensystems und zur Vermeidung von Runner-Kosten wird eine strikte 2-Säulen-Architektur etabliert:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. INTELLIGENCE ENGINE & RESEARCH LAB (Haupt-Repo: CrashRadar)         │
│    • Holt alle Marktdaten (FRED, Polygon M5, Yahoo, Tiingo) [WRITE]    │
│    • Berechnet alle 18 Indikatoren, ML-Modelle & Notenbank-Events      │
│    • Führt die Strategie-Engines aus (MCW, Kamikaze, 7-Slot-Guru)      │
│    • Beherbergt die gesamte Forschung, Backtests & Doku (Analyse.md)   │
│    • Sendet unpersonalisiertes Makro-Wetter an den Broadcast-Kanal     │
│    • Erzeugt 1x täglich 'daily_intelligence.json' Snapshot             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS Webhook Push (Secret Token)
                                    │ Nach täglichem Lauf (ca. 4 KB Payload)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND & PERSONALIZATION GATEWAY (Cloudflare Edge + D1)           │
│    • Cloudflare Worker: Webhook-Receiver für Telegram (Latenz < 30 ms) │
│    • Cloudflare D1: SQLite für Nutzerprofile, Portfolios & Snapshot    │
│    • Führt 1:1-Dialoge, Onboarding und Ad-hoc-Befehle (/topup) aus    │
│    • Rechnet KEINE Indikatoren, sondern multipliziert nur:             │
│      (Signal der Strategie) ✕ (User-Sparrate / Topup)                  │
│    • Verarbeitet Inline-Feedback [✅ Ausgeführt] / [⏳ Überspringen]   │
└───────────────────▲──────────────────────────────┬─────────────────────┘
                    │ Webhook                      │ Proaktiver Push
                    │                              │ (1:1 Chat)
┌───────────────────┴──────────────────────────────▼─────────────────────┐
│ 3. BENUTZER-SCHNITTSTELLE (Telegram)                                   │
│    • Private 1:1 Chats: Individuelles Onboarding, Signale & Bestätigung│
│    • Broadcast-Kanal: Globales Makro-Wetter (Read-Only Einweg)         │
└────────────────────────────────────────────────────────────────────────┘
                    ▲
                    │ Batch-Trigger (nur 1x wöchentlich / monatlich)
┌───────────────────┴────────────────────────────────────────────────────┐
│ 4. SIGNAL-ENGINE SCHEDULER (Neues Repo: CrashRadar-Signals / Actions)  │
│    • GitHub Actions Runner: Nur für geplante Batch-Jobs                │
│    • Wöchentlicher Statusbericht (Montag 07:00 UTC)                    │
│    • Monatliche Sparplanausführung (1. des Monats 08:00 UTC)           │
└────────────────────────────────────────────────────────────────────────┘
```

### Die zwei Repositories im Detail:
1. **Haupt-Repository (`CrashRadar`):**
   * **Rolle:** Single Source of Truth für alle Finanzmathematik, Daten-Ingestion, Indikatorenberechnungen, ML-Pipelines und Strategieregeln.
   * **Dokumentation:** Beherbergt die gesamte Spezifikations- und Forschungsdokumentation ([`docs/architecture/`](file:///D:/GitHub/CrashRadar/docs/architecture/) und [`docs/research/`](file:///D:/GitHub/CrashRadar/docs/research/)).
   * **Broadcast:** Schickt den täglichen Makro-Wetter-Report direkt in den öffentlichen Telegram-Kanal.
   * **Push:** Übergibt nach Abschluss der Berechnungen den aggregierten Tages-Snapshot (`daily_intelligence.json`) per gesichertem Webhook an Cloudflare D1.

2. **Gateway-Repository (`CrashRadar-Signals`):**
   * **Rolle:** Bereitstellung des Cloudflare Workers, der D1-Datenbankmigrationen und der Telegram-Bot-Dialoge.
   * **Vorteil:** Völlige Isolation der Benutzerdaten (Telegram User-IDs, individuelle Budgets) und Secrets.
   * **Kosten & Kontingente:** Durch den Edge-First-Ansatz (Worker greift auf vorberechneten Snapshot in D1 zu) fallen für normale Nutzeraktionen **0 GitHub-Actions-Minuten** an.

---

## 1.1 High-Level SignalEngine-Architektur & Strategie-Lifecycle (Core-Modell)

Um die evolutorische Entwicklung der SignalEngine und der fünf Portfoliostrategien sauber aufzusetzen, definiert dieses Kapitel das verbindliche Zusammenspiel zwischen Engine, Strategien und dem Cloudflare D1 Gateway:

```
┌────────────────────────────────────────────────────────────────────────┐
│ CRASHRADAR SIGNALENGINE (Core Orchestrator & Registry)                 │
│                                                                        │
│ 1. Marktdaten- & Makro-Vorberechnung:                                  │
│    • Regime-Ampel (EXPANSION, SLOWDOWN, CRISIS_ALERT)                  │
│    • Globale 3-Säulen-Katastrophen-Matrix (Trendbruch + Makro-Alarm)   │
│    • Universeller Bottom-Finder (Panic-Capitulation & DIX-Whales)      │
│    • Net Liquidity Delta (ΔNetLiq 4W) & Krypto-Zyklus (21W-EMA)        │
│                                                                        │
│ 2. Strategy Registry (Plugin-Muster analog zu _indicators):            │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │ registerStrategy(strategyInstance)                           │    │
│    ├───────────────────────┬──────────────────────────────────────┤    │
│    │ BasePortfolioStrategy │ • MuzzledCathieWoodStrategy          │    │
│    │ (Einheitliches        │ • KamikazeGrowthStrategy (Broker-API)│    │
│    │  Interface)           │ • SevenSlotGuruStrategy              │    │
│    │                       │ • GoldSpyDcaStrategy                 │    │
│    │                       │ • SatelliteCoreStrategy              │    │
│    └───────────────────────┴──────────────────────────────────────┘    │
│                                │                                       │
│ 3. Autonome Portfolio-Verwaltung je Strategie (Bucket-Management):     │
│    • Core-Bucket (z. B. SPY Mutterschiff)                              │
│    • Satelliten-Bucket (z. B. DFNS, Tech-Picks, Krypto-Pyramide)       │
│    • Hedge-Bucket (Gold & Cash Notfall-Schirm)                         │
│    • Order-Generierung: Ziel-Allokation (%) & Tranchen-Aktionen        │
│                                │                                       │
│ 4. Snapshot-Export (Täglicher Pre-Computation Push):                   │
│    • Aggregiert alle Strategie-Zustände in 'daily_intelligence.json'   │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTPS Webhook Push (daily_intelligence.json)
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE D1 & WORKER GATEWAY (Skalierung & Personalisierung)         │
│ • Nimmt abstrakte Modell-Prozente (%) der SignalEngine entgegen        │
│ • Multipliziert Modell-Gewichte mit dem individuellen Euro-Budget:     │
│   (Ziel-Quote %) ✕ (Monatliche Sparrate / Topup-Betrag in €)           │
│ • Steuert interaktive 1:1 Telegram-Dialoge & [✅ Ausgeführt] Feedback   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Die 5 Kern-Prinzipien des High-Level-Modells:

1. **Strategie-Registry (Plugin-Architektur via `BasePortfolioStrategy.js`):**  
   * Analog zur Indikatoren-Registry (`_indicators` in `MacroRegimeEngine`) werden alle Strategien als modulare Klassen implementiert und in der `PortfolioStrategyEngine` registriert.
   * Jede Strategie erbt von `BasePortfolioStrategy` und implementiert verbindliche Lebenszyklus-Methoden: `initialize(config)`, `evaluateDaily(date, marketData, macroSignalContext)`, `getPortfolioStatus()` und `generateOrderInstructions()`.
   * Neue Strategien können hinzugeschaltet oder deaktiviert werden, ohne den Orchestrator oder bestehende Strategien zu modifizieren.

2. **Standard-Signale der Engine („Signals as a Service“):**  
   * Die Strategien berechnen keine komplexen Makro-Indikatoren redundant selbst.
   * Die Engine stellt allen registrierten Strategien einen vorberechneten, standardisierten Signal-Kontext (`macroSignalContext`) zur Verfügung:
     * **Regime-Ampel:** Übergeordnetes Makro-Klima (`EXPANSION`, `SLOWDOWN`, `CRISIS_ALERT`).
     * **3-Säulen-Katastrophen-Matrix:** Globaler Notfall-Schutzschild (Trendbruch + VIX-Panik / Kreditstress / Deleveraging).
     * **Universeller Bottom-Finder:** Antizyklisches Generationen-Kaufsignal (`CRITICAL` Re-Entry an Panik-Böden).
     * **Liquiditäts-Metriken:** Net Liquidity Delta ($\Delta\text{NetLiq}_{4W}$) und K-Faktor.
     * **Krypto-Master-Sensorik:** Bitcoin 21-Wochen-EMA und Zyklus-Divergenzen.

3. **Autonome Portfolio- & Bucket-Verwaltung der Strategien:**  
   * Jede Strategie ist eigenverantwortlich für die Verwaltung ihres Portfolios zuständig.
   * Sie unterteilt ihr Kapital in definierte **Asset-Buckets** (z. B. Core-Mutterschiff, Wachstums-Satelliten, Krypto-Pyramide, Hedge-Bucket).
   * Anhand der Engine-Signale entscheidet die Strategie autonom über Rebalancing, Tranchenkäufe, Zündfunken-Aktivierungen oder Evakuierungen in den Hedge-Bucket (Gold/Cash).
   * **Rückgabe an die Engine:** Jede Strategie gibt einen standardisierten Ergebnis-Kontrakt zurück:
     * `target_allocation_pct`: Relative Zielgewichtung aller Assets (z. B. `{ SPY: 0.0, GLD: 0.75, CASH: 0.25 }`).
     * `tranche_action`: Konkrete Aktion (z. B. `BUY_TRANCHE_1`, `HOLD`, `EVACUATE_TO_HEDGE`, `RE_ENTRY_SNIPER`).
     * `rebalance_delta_pct`: Benötigte Umschichtungsquote gegenüber dem Vortag.
     * `reason`: Menschlich lesbare Begründung für das Telegram-Signal.

4. **Sonderfall Kamikaze Growth (Echtgeld-Broker-Kopplung):**  
   * Während die übrigen Strategien als algorithmische Referenz-Portfolios laufen, ist Kamikaze Growth direkt mit dem **realen Trading-Konto (Broker-API)** verknüpft (~94.000 $ Realdepot).
   * **Discretionary Human Override:** Weicht der Händler manuell ab, gilt das Prinzip „Broker-Realität ist Gesetz“ – die Engine übernimmt den echten Kontostand als Reconciled State und passt Zündfunken und freie Quoten adaptiv an.
   * **Telegram-Rolle:** Für Abonnenten fungiert Kamikaze als reines Read-Only Echtgeld-Flaggschiff (keine individuellen Sparplan-Multiplikationen im Bot).

5. **Schnittstelle zu Cloudflare D1 (`daily_intelligence.json`):**  
   * CrashRadar berechnet **keine** individuellen Kunden-Depots und führt keine Euro-Multiplikation durch.
   * Nach dem täglichen Rechenlauf exportiert die Engine den aggregierten Snapshot `daily_intelligence.json` per Webhook an Cloudflare D1.
   * **Aufgabe von D1 & Cloudflare Worker:** Der Worker liest den Snapshot, matcht ihn mit den hinterlegten User-Profilen (`user_portfolios`) und multipliziert die relativen Modell-Prozente linear mit der monatlichen Sparrate oder dem Topup-Betrag des jeweiligen Nutzers.

---

## 2. Telegram Chat-Typen & Berechtigungskonzepte

Telegram unterscheidet grundlegend zwischen verschiedenen Chat-Arten. Das System nutzt gezielt zwei getrennte Typen, um Privatsphäre und passive Signale sauber zu trennen:

### 1. Privater 1:1-Direktchat (`chat.type == "private"`) – Interaktive Schnittstelle
* **Zweck:** Persönliches Onboarding, individuelle Portfoliosteuerung, private Statusmeldungen und persönliche Signale.
* **Funktionsweise:** Jeder Nutzer interagiert ausschließlich in einem geschlossenen Einzelgespräch direkt mit dem Bot.
* **Datenschutz & Isolation:** Nutzer sehen zu keinem Zeitpunkt die Existenz, Eingaben, Sparraten oder Portfoliostände anderer Nutzer. Es gibt keine gemeinsame Gruppenübersicht.
* **Identifikation:** Die Authentifizierung erfolgt über die native, manipulationssichere Telegram `user_id` (`from.id`), die bei jeder Interaktion automatisch mitgesendet wird.

### 2. Broadcast-Kanal (`chat.type == "channel"`) – Passive Signale (Einweg)
* **Zweck:** Zentrale, ungefilterte Markt-Ticker, Crash-Radar-Statusmeldungen und globale Veto-Warnungen.
* **Funktionsweise:** Reines Einweg-Medium (One-to-Many). Ausschließlich Administratoren bzw. der GitHub-Actions-Bot besitzen Schreibrechte.
* **Vollständiger Ausschluss von Interaktion:**
  * Abonnenten haben **kein Chat-Eingabefeld**.
  * Es gibt standardmäßig **keine Kommentar- oder Diskussionsfunktion**.
  * Die **Mitgliederliste ist verborgen** (Abonnenten sehen sich nicht gegenseitig).

### 3. Read-Only Flaggschiff-Stream – Kamikaze Growth (Echtgeld-Live-Feed)
* **Zweck:** Maximal transparenter „Skin in the Game“-Beweis für Follower. Kamikaze Growth ist das **reale Echtgeld-Depot des Autors** (aktuell ~94.000 $ USD-Depotvolumen).
* **Funktionsweise:**
  * **Strikter Read-Only-Modus für alle:** Externe Telegram-Abonnenten können sämtliche Transaktionen, Zündfunken, Climax-Exits und Depot-Kennzahlen in Echtzeit mitverfolgen, haben jedoch **keine Möglichkeit, eigene Sparraten, Tranchen oder Portfolios dafür zu konfigurieren**.
  * **Trennung von Onboarding-Strategien:** Während `MUZZLED_CATHIE_WOOD`, `7_SLOT_GURU` oder `GOLD_SPY` über das interaktive 1:1-Onboarding für eigene Depots parametrisiert und per `[✅ Ausgeführt]` bestätigt werden, wird Kamikaze Growth als reines beobachtbares Echtgeld-Flaggschiff geführt.

---

## 3. Telegram-Schnittstellendefinition (Funktionsumfang)

Die Schnittstelle umfasst fünf verbindliche Kernmodule:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TELEGRAM-SCHNITTSTELLENMODULE                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Interaktives Onboarding     │ Geführte State-Machine inkl.          │
│    (1:1 Direktchat)            │ Strategie-Auswahl (MCW, Kamikaze etc.)│
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Proaktives Sparplan-Signal  │ Zeitgesteuerte Allokation mit         │
│    (Monatszyklus)              │ [✅ Ausgeführt] Feedback-Loop          │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Ad-hoc Sonderzahlungen      │ Latenzfreier Check (<50ms via D1)     │
│    (/topup)                    │ mit Veto- und Lauerstellung           │
├────────────────────────────────┼───────────────────────────────────────┤
│ 4. Wöchentlicher Statusbericht │ Strukturierte Übersicht über          │
│    (Montags-Cronjob)           │ Portfoliowerte und Cash-Quote         │
├────────────────────────────────┼───────────────────────────────────────┤
│ 5. Die 3 Beweis-Szenarien      │ 3 kuratierte Fälle (Worst, Best,      │
│    (Simulation / Modul 5)      │ Neutral) mit Sofort-Skalierung        │
├────────────────────────────────┼───────────────────────────────────────┤
│ 6. Versions-Changelog          │ Proaktiver Transparenz-Push bei       │
│    (Modell-Governance)         │ Anpassung der quantitativen Logik     │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Modul 1: Geführtes Onboarding (Strikte Parametererfassung)
Der Bot führt den Nutzer nach dem ersten Startbefehl (`/start`) durch eine State-Machine im Cloudflare Worker:
1. **Identifikator:** Automatische Erfassung der Telegram `user_id` (keine Registrierung erforderlich).
2. **Strategie-Auswahl (`strategy_id`):** Auswahl über Inline-Buttons:
   * `[🛡️ Muzzled Cathie Wood]` (60/40 Tech/Krypto mit 50/50 Gold/Cash Notfall-Schirm)
   * `[⚡ Kamikaze Growth]` (50/50 High-Beta Turnarounds mit Climax-Exit)
   * `[🏛️ 7-Slot-Guru]` (Superinvestor 13F-Konsens mit Makro-Schutzschild)
   * `[🥇 Gold-SPY DCA]` (Dynamisches S&P 500 DCA mit Gold-Skimming)
   * `[🛰️ Satellite Core]` (80 % SPY / 15 % DFNS Defense / 5 % BTC HODL mit Notfall-Stecker)
3. **Startkapital:** Numerischer Geldbetrag (z. B. in Euro), der initial zur Verfügung steht.
4. **Monatliche Sparrate:** Numerischer Geldbetrag (kann `0` sein).
5. **Option Sonderzahlungen:** Flag (`Ja` / `Nein`), ob künftige Zuzahlungen via `/topup` aktiv verwaltet werden sollen.
6. **Sofortige Handlungsanweisung:** Der Worker liest den aktuellen Snapshot aus D1 und liefert in 50 ms die Startorder (z. B. „Tranche 1 jetzt kaufen: X € in Asset A, Y € in Asset B, Z € in Cash“).

### 3.1 Unterstützte Anlagestrategien (Katalog & Spezifikation)

> [!IMPORTANT]
> **Priorisierung & Entwicklungs-Reihenfolge:**  
> Sämtliche Strategien müssen zuerst in `CrashRadar` einzeln und vollständig im Code ausformuliert, mathematisch harmonisiert und via Backtest verifiziert werden (siehe Meilenstein 5 in [`TODO.md`](file:///D:/GitHub/CrashRadar/TODO.md)), bevor die eigentliche Umsetzung des Signal-Services (Cloudflare Worker & Telegram Gateway) beginnt. Das Fundament der Signal-Qualität liegt ausnahmslos in der Core-Engine.

Die im Signaldienst wählbaren Strategien im Überblick:

1. 📄 **[`Muzzled-Cathie-Wood.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Muzzled-Cathie-Wood.md) (`MUZZLED_CATHIE_WOOD`):**  
   Disziplinierte 60/40 Tech- und Krypto-Strategie mit 3-Säulen-ARK-Ingestion (`OBSERVE` vor Kauf). Der Krypto-Anteil wird dynamisch über den 21-Wochen-EMA mit einer 40/30/30-Pyramide gesteuert und über ein Leihgabe-Verrechnungskonto im S&P-500-Mutterschiff geparkt. Bei Makro-Kollaps greift eine 100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash mit antizyklischem Panic-Capitulation-Sniper für den Wiedereinstieg.

2. 📄 **[`Kamikaze-Growth.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Kamikaze-Growth.md) (`KAMIKAZE_GROWTH`):**  
   Aggressive 50/50 High-Beta-Turnaround-Strategie für Tech-Aktien (`PLTR`, `NVTS`, `SOFI`) und Krypto-Equities (`MSTR`, `MARA`) ohne laufende Sparrate. Sie fungiert als **reales Echtgeld-Flaggschiff des Autors** und ist auf Telegram für alle externen Nutzer **strikt Read-Only**. Im Gegensatz zu rein algorithmischen Modellen ist Kamikaze **direkt an das reale Handelskonto (Broker-API) angebunden**, wodurch Portfolio-Positionen und freies USD-Cash permanent synchronisiert werden. Handelt der Investor beim Broker abweichend von der Modell-Vorgabe, gilt das Prinzip **Discretionary Override („Broker-Realität ist Gesetz“)** – die SignalEngine passt ihre Berechnungen (Zündfunken, freier Pool) dynamisch an die echte Kontoführung an. Parabolische Überhitzungen werden über einen Climax-Top Exit abgeschöpft, während dieselbe 50/50 Gold/Cash Notfall-Evakuierung vor Bärenmärkten schützt.

3. 📄 **[`7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md) (`7_SLOT_GURU`):**  
   Fokussiertes 7-Slot-System, das ausschließlich Aktien kauft, die im 13F-Konsens von mindestens 2 legendären Superinvestoren gehalten werden. Die Einstiegs-Ampel kombiniert Fair-Value-Discounts mit technischem Momentum. Ein Druckenmiller-Makroschutzschild (Net Fed Liquidity) steuert eine defensive Absicherung oder Evakuierung zum Schutz des Kernkapitals.

4. 📄 **[`Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md) (`GOLD_SPY`):**  
   Quantitative Trend-Schild & Gold-Hedge-Strategie für dynamisches DCA im S&P 500. Im Normalbetrieb gilt ungestörtes 100 % S&P 500 DCA. Bei Bärenmarkt-Gefahr schützt die **globale 3-Säulen-Katastrophen-Matrix** vor Fehlausstiegen: Erst wenn der S&P 500 unter den SMA 200 fällt (Drawdown $\ge 8\,\%$) **und** ein echter System-Alarm (Kreditstress, VIX-Panik, Deleveraging oder QT) aktiv ist, evakuiert das System in den **75 % Gold / 25 % Cash Sweet Spot** (Margin-Call-Airbag). Der Re-Entry erfolgt antizyklisch am Panik-Tiefpunkt über den VIX-Panic-Sniper ($\text{VIX} \ge 35$ Reversal) oder SMA 200 Rückeroberung (+674 % Rendite / 381.741 € über 21,8 Jahre bei nur -28,61 % Max Drawdown).

5. 📄 **[`Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) (`SATELITE`):**  
   Geopolitisch gehärtetes Core-Satellite-Depot: **80 % SPY (S&P 500)** als Core-Mutterschiff, **15 % DFNS (VanEck Defense ETF)** als asymmetrischer Rüstungs- & Verteidigungs-Satellit und **5 % BTC (Bitcoin)** als makroökonomischer Wertspeicher. Im Normalbetrieb gilt eisernes **HODL** (keine unterjährigen Verkäufe). Einziges Rebalancing erfolgt über den **universellen Notfall-Stecker** (100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash bei Makro ROT und Rebalancing-Reset bei Re-Entry).

6. 📄 **[`Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md):**  
   *(Aktuell nicht im Signaldienst angeboten)*: Quantitative Regime- und Tranchen-Exit-Strategie für Edelmetall-Minenwerte (GDX). Steuert Gewinnmitnahmen über Selling Climaxes, ROC-Erschöpfung und Divergenzen. Verbleibt vorerst als reine Analyse- und Forschungsreferenz in `CrashRadar` und wird Nutzern im Bot nicht zur Auswahl gestellt.

---

### 3.2 Verbindliche Kern-Standards der SignalEngine (Universal-Architektur)

Um Code-Duplikate, Widersprüche und uneinheitliches Signalverhalten über verschiedene Strategien hinweg auszuschließen, gelten für die `CrashRadar` SignalEngine drei **unverrückbare System-Standards**:

#### 1. Die globale 3-Säulen-Katastrophen-Matrix (Universeller Notfall-Schutzschild)
* **Standard-Geltung:** Steht als übergeordnetes Makro-Fundament **allen** aktiven Strategien (`MUZZLED_CATHIE_WOOD`, `KAMIKAZE_GROWTH`, `7_SLOT_GURU`, `GOLD_SPY`, `SATELITE`) zur Verfügung.
* **Architektonische Erkenntnis:** Ein reiner Notenbank-Liquiditäts-Sensor (`NetLiq < -5 %`) war in Schock- und Solvenzkrisen (2008 & 2020) blind, weil die Fed Notkredite druckte (`WALCL` stieg auf +115 % bzw. +47 %). Die globale Katastrophen-Matrix koppelt daher den realen **Chart-Trendbruch an 3 unabhängige Makro-Säulen**:
* **Die Alarm-Logik:** Ein Notfall-Schutzschild löst **NUR DANN** aus, wenn:
  1. **Chart-Bedingung:** Die jeweilige Benchmark (`SPY` unter SMA 200 bei $\ge 8\,\%$ Drawdown; bzw. `BTC` unter 21-Wochen-EMA) ihren Trend bricht  
     **UND**
  2. **Mindestens eine Katastrophen-Säule leuchtet ROT:**
     * **Säule A (Schock-Panik):** $\text{VIX} \ge 28{,}0$ *(fängt exogene Black Swans wie Corona 2020 ab)*.
     * **Säule B (Kredit- & Solvenzstress):** $\text{ChicagoFedIndex} > -0{,}20$ oder High-Yield Spreads $> 4{,}0\,\%$ *(fängt Banken- & Krediteinbrüche wie 2008 ab)*.
     * **Säule C (Liquiditäts-Entzug & Deleveraging):** $\Delta\text{NetLiq} < -5{,}0\,\%$ *(Zinsschock 2022)* **ODER** $\text{FINRA Margin Debt} \le -5{,}0\,\%$ *(institutioneller Hebel-Kollaps)*.
* **Schutz vor Fehlausstiegen:** In gesunden Korrekturen (-5 % bis -10 %) bleiben die Makro-Säulen grün $\rightarrow$ Die Strategien bleiben zu 100 % investiert und sparen stur weiter (eliminiert über 50 Fehlausstiege in 21,8 Jahren).
* **Aktion:** Sofortige Evakuierung der risikobehafteten Positionen in Gold und Cash (Standard: **75 % Gold / 25 % Cash** bei `GOLD_SPY` als Margin-Call-Airbag; **50 % Gold / 50 % Cash** als defensiver Standard bei `MCW`, `KAMIKAZE`, `7_SLOT_GURU` und `SATELITE`).
* **Anti-Whipsaw-Hysterese:** Mindestens 15 Handelstage Haltedauer im Hedge gegen zermürbenden Day-to-Day-Churn im Bärenmarkt.

#### 2. Der universelle Bottom-Finder (Antizyklischer Re-Entry-Sniper)
* **Standard-Geltung:** Löst den Schutzschirm am Panik-Tief vorzeitig auf, ohne Wochen auf die NetLiq-Hysterese warten zu müssen.
* **Sensor 1 ([`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js)):**  
  $\text{VIX} \ge 35$, CBOE Put/Call-Options-Spike $\ge 1{,}5\times$, bullische RSI-Divergenz (neues Kurs-Tief bei höherem RSI). Status: `CRITICAL` (Generationen-Kaufsignal).
* **Sensor 2 ([`SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js)):**  
  $\text{VIX} > 40$, AAII Sentiment $< -25\,\%$ (Retail-Panik) und Dark Pool Index $\text{DIX} > 45\,\%$ (Wal-Akkumulation).
* **Aktion:** Sofortige Auflösung des Gold/Cash-Schutzschirms und 100 % Reinvestition in das S&P 500 Mutterschiff, um neue Stage-2-Ausbrüche am absoluten Marktboden mit maximaler Liquidität einzusammeln!

#### 3. Standardisierte Krypto-Hebel- & Bitcoin-Sensorik
* **Bitcoin-Regime (Master-Taktgeber):** BTC 21-Wochen-EMA und [`MlRegimeRadarBtcIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/MlRegimeRadarBtcIndicator.js) bestimmen das Krypto-Gesamtregime.
* **Hebel-Aktien-Sensoren ([`CryptoPortfolioExitIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoPortfolioExitIndicator.js)):**  
  Überwacht `MSTR` und `COIN` in der Krypto-Zyklus-Gefahrenzone ($> 970\text{ Tage}$ seit dem letzten Bitcoin-Boden). Ein Durchbruch des SMA 50 unter Volumen $> 1{,}2\times$ triggert sofortigen Krypto-Equity-Exit ins Mutterschiff.
* **Frühwarn-Divergenzen ([`CryptoCycleDivergenceIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/CryptoCycleDivergenceIndicator.js) & [`BtcTrailingStopIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/BtcTrailingStopIndicator.js)):**  
  Warnen vor Liquiditäts-Austrocknung, wenn `MSTR` den SMA 200 verliert oder die Hebel-Aktien trotz hohem Bitcoin-Kurs ausbluten.

---

### 3.3 Kamikaze Growth: Live-Broker-Anbindung & Discretionary Override („Broker-Realität ist Gesetz“)

Im Unterschied zu den rein theoretisch simulierten oder per Chat-Feedback quittierten Strategien basiert Kamikaze Growth auf einer direkten Kopplung mit dem **realen Handelskonto** des Investors:

```
┌────────────────────────────────────────────────────────────────────────┐
│             BROKER-LIVE-SYNCHRONISATION & RECONCILIATION               │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Broker Read-Only Adapter    │ Zapft das Trading-Konto per API an:   │
│    (CrashRadar Engine Ingestion)│ • Realer Cash-Bestand (USD)           │
│                                │ • Real gebundenes Order-Cash          │
│                                │ • Exakte Stückzahlen & Einstandspreise│
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Discretionary Human Override│ Handelt der Investor abweichend:      │
│    ("Broker Reality is Law")   │ • Vorzeitiger manueller Teilverkauf   │
│                                │ • Manueller Zukauf / Limit-Orders     │
│                                │ ➔ Broker-Ist überschreibt Modell-Soll! │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Dynamische Weiterrechnung   │ Alle mathematischen Kenngrößen:       │
│    (Adaptive SignalEngine)     │ • Freies Mutterschiff-Volumen         │
│                                │ • 35 % Zündfunken-Betrag              │
│                                │ • Krypto-Claim & Cash-Quoten          │
│                                │ passen sich an die reale Liquidität an│
├────────────────────────────────┼───────────────────────────────────────┤
│ 4. Read-Only Telegram Broadcast│ Follower erhalten den Live-Stream des │
│    (100 % Transparenz)         │ realen Depots als "Skin in the Game"  │
└────────────────────────────────┴───────────────────────────────────────┘
```

#### 1. Die Broker-Ingestion-Pipeline
* Der Ingestion-Adapter in `CrashRadar` liest in regelmäßigen Intervallen (z. B. vor/nach Marktschluss sowie bei Strategieausführung) die aktuellen Konto-Rohdaten aus:
  * `free_usd`: Tatsächlich frei verfügbares Barvermögen (USD).
  * `pending_orders_usd`: Durch offene Kauf-Limits (z. B. Limit-Buy Orders auf `S` oder `PGY`) reserviertes Kapital.
  * `positions`: Array aller tatsächlich im Depot eingebuchten Wertpapiere mit Stückzahl, Durchschnittspreis und aktuellem Marktwert.
* Diese Rohdaten werden in den täglichen Snapshot (`daily_intelligence.json`) eingespielt und fließen in die D1-Datenbank für das Telegram-Reporting.

#### 2. Das Prinzip des Discretionary Override (Menschliche Übersteuerung)
* Ein starres algorithmisches Modell neigt bei manuellen Eingriffen des Händlers dazu, zu desynchronisieren (Ghost Trades, falsche Cash-Annahmen).
* In CrashRadar gilt für Kamikaze Growth ein klares Primat: **Die Realität des Brokers hat immer Recht.**
* Wenn der Investor:
  * eine Position vor Erreichen des Climax-Tops ganz oder teilweise abstößt,
  * eine Aktie opportunistisch kauft, bevor das Modell das Kaufsignal finalisiert hat,
  * Limit-Orders storniert, ändert oder neue Orders einstellt:
* **Verhalten der SignalEngine:**
  1. Das System erzwingt keinen Rückbau auf das theoretische Modell.
  2. Der tatsächliche Bestand wird bedingungslos als neuer Ausgangszustand (*Reconciled State*) übernommen.
  3. Die dynamische Zündfunken-Logik (35 % des freien Mutterschiffs) berechnet sich ab sofort auf Basis des *tatsächlich* vorhandenen freien Cashs im Broker-Konto.
  4. Alle Risikokennzahlen (z. B. Stop-Losses, Climax-Alarme) werden sofort für die neu erfassten Positionen scharf geschaltet.

---

### Modul 2: Proaktives Sparplan-Signal & Execution Feedback
* **Trigger:** Zeitgesteuerter Batch-Workflow am 1. Werktag des Monats um 08:00 UTC.
* **Funktion:**
  * Lädt alle Profile mit `monthly_rate > 0`.
  * Multipliziert die hinterlegte Sparrate mit der aktuellen Strategie-Allokation aus dem D1-Snapshot.
  * Sendet eine personalisierte Handlungsanweisung direkt in den 1:1-Chat.
* **Execution Feedback Loop (Inline-Buttons):**
  * `[✅ Ausgeführt]` ➔ Aktualisiert `cash_reserve`, inkrementiert `current_tranche` und loggt die Transaktion.
  * `[⏳ Diesen Monat überspringen]` ➔ Belässt die Monatsrate auf dem Verrechnungskonto (`cash_reserve`) für antizyklische Nachkäufe.

### Modul 3: Ad-hoc Sonderzahlungen (`/topup <Betrag>`)
* **Funktion:** Nutzer meldet zusätzliches Kapital (z. B. Steuerrückzahlung, Bonus).
* **Latenzfreie Edge-Verarbeitung:**
  * Der Cloudflare Worker prüft den tagesaktuellen `market_regime_snapshot` direkt in D1.
  * **Kein Veto:** Der Bot liefert in unter 50 ms die konkrete Kaufanweisung für die nächste Tranche.
  * **Veto aktiv:** Das Kapital wird als `pending_topup` verbucht und auf die Seitenlinie (`cash_reserve`) gelegt. Der Bot meldet sich proaktiv, sobald das Crash-Radar Entwarnung gibt.

### Modul 4: Wöchentlicher Portfolio- und Strategiebericht
* **Trigger:** Wöchentlicher Cronjob (Montagmorgen 07:00 UTC).
* **Funktion:**
  * Strukturierte Zusammenfassung: Investiertes Kapital, Cash-Quote, Gold-Absicherung.
  * Aktueller Risikostatus der gewählten Strategie und übergeordnete Makro-Ampel.

### Modul 5: Die 3 kuratierten Beweis-Szenarien (Simulation)
Statt rechenintensiver, freier Backtests im Chat greift der Bot auf **3 empirisch verifizierte Standard-Szenarien** pro Strategie zurück (abgeleitet aus den Backtests in `docs/research/`):

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIE 3 BEWEIS-SZENARIEN IM CHAT                       │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Worst Case (Crash)    │ Bärenmarkt 2022 / Corona-Crash 2020:        │
│                          │ Beweis der Notfall-Evakuierung (50/50 Gold/ │
│                          │ Cash) und Begrenzung des Max-Drawdowns.     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 2. Best Case (Boom)      │ Tech-Boom 2020–2021 / Rallye 2023:          │
│                          │ Beweis der 40/30/30-Pyramide und des        │
│                          │ maximalen Upsides in Wachstumsphasen.       │
├──────────────────────────┼─────────────────────────────────────────────┤
│ 3. Neutral (Vollzyklus)  │ 5-Jahres-Horizont über Bull- & Bärmarkt:    │
│                          │ Realistische Langfristerwartung inkl. aller │
│                          │ Zyklen und Zinseszins-Effekte.              │
└──────────────────────────┴─────────────────────────────────────────────┘
```

* **Ablauf im Chat:**
  1. Nutzer tippt `/simulate` oder wählt den Button `[🧪 Strategie testen]`.
  2. Nutzer wählt sein Wunschkapital (z. B. `[5.000 €]`, `[10.000 €]`, `[25.000 €]`).
  3. Nutzer klickt auf eines der 3 Szenarios.
  4. **Antwortzeit < 20 ms:** Der Cloudflare Worker skaliert die vorberechnete Rendite- und Drawdown-Matrix linear per Dreisatz und liefert sofort das Ergebnis.

### Modul 6: Strategie-Governance & Versions-Changelog (Transparenz-Push)
* **Zweck:** Absolute Transparenz und Nachvollziehbarkeit für den Nutzer, wenn an der quantitativen Logik oder den Absicherungsregeln einer Strategie Anpassungen vorgenommen werden.
* **Trigger:** Sobald in `CrashRadar` ein Regelwerk modifiziert wird (z. B. Schärfung der Makrosicherung, Aktualisierung der Veto-Schwellenwerte oder Tranchenaufteilung), wird die neue Versionsnummer und ein kurzer Changelog-Text übergeben (via `daily_intelligence.json` Snapshot oder gezieltem Push).
* **Zielgerichtete Ausspielung:**
  * **1:1-Privatchat:** Alle aktiven Abonnenten der betroffenen `strategy_id` erhalten automatisch eine proaktive Push-Nachricht:
    > ℹ️ **Strategie-Update: Muzzled Cathie Wood (V2.1)**  
    > *Die quantitative Logik deiner gewählten Strategie wurde aktualisiert:*  
    > • **Änderung:** Die Makrosicherung wurde modifiziert. Bei Überschreiten der Net-Liquidity-Gefahrenschwelle evakuiert das System nun in 50 % physisches Gold / 50 % Cash mit Re-Entry Sniper.  
    > • **Auswirkung:** Dein bestehendes Portfolio bleibt unberührt; künftige Signale greifen automatisch nach dem optimierten Regelwerk V2.1.
  * **Broadcast-Kanal:** Kurzer Versionshinweis für alle Marktbeobachter im öffentlichen Kanal.
* **Persistenz & Quittierung:** Der Stand wird in D1 (`user_portfolios.strategy_version`) vermerkt, sodass der Nutzer bei `/status` jederzeit seinen aktuellen Versionsstand sieht.

---

## 4. Datenbank-Design (Cloudflare D1 / SQLite)

Als persistenter Speicher dient Cloudflare D1. Als Primärschlüssel fungiert die unveränderliche, numerische Telegram-`user_id`.

```sql
-- Tabelle: Nutzerprofile und Strategie-Zustand
CREATE TABLE IF NOT EXISTS user_portfolios (
    user_id INTEGER PRIMARY KEY,              -- Eindeutige Telegram User-ID / Chat-ID
    first_name TEXT,                          -- Optionaler Anzeigename aus Telegram
    strategy_id TEXT DEFAULT 'MUZZLED_CATHIE_WOOD', -- 'MUZZLED_CATHIE_WOOD', 'KAMIKAZE_GROWTH', '7_SLOT_GURU', 'GOLD_SPY', 'SATELITE'
    risk_profile TEXT DEFAULT 'BALANCED',     -- 'CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'
    onboarding_step TEXT DEFAULT 'COMPLETED', -- Status für State-Machine
    start_capital REAL NOT NULL,              -- Initiales Investitionskapital
    monthly_rate REAL DEFAULT 0.0,            -- Monatliche Sparrate (bei Kamikaze Growth = 0.0)
    flexible_topups_enabled INTEGER DEFAULT 0,-- Flag: Sonderzahlungen erwünscht (0 = Nein, 1 = Ja)
    pending_topup REAL DEFAULT 0.0,           -- Angemeldete, noch nicht investierte Sonderzahlung
    topup_status TEXT DEFAULT 'IDLE',         -- 'IDLE', 'WAITING_FOR_SIGNAL', 'ALLOCATED'
    cash_reserve REAL DEFAULT 0.0,            -- Aktuell auf Verrechnungskonto geparktes Kapital
    current_tranche INTEGER DEFAULT 0,        -- Fortschritt der Tranchenkäufe (z. B. 0 bis 3)
    strategy_version TEXT DEFAULT 'v1.0',     -- Revisionsstand der Strategie beim Nutzer
    is_read_only_flagship INTEGER DEFAULT 0,  -- 1 = Reines Read-Only Flaggschiff-Abo (Kamikaze Growth)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: Tages-Snapshot aus CrashRadar (Pre-Computation Push)
CREATE TABLE IF NOT EXISTS market_regime_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),     -- Immer nur genau 1 aktueller Datensatz
    snapshot_date TEXT NOT NULL,              -- YYYY-MM-DD
    macro_regime TEXT NOT NULL,               -- 'EXPANSION', 'SLOWDOWN', 'CRISIS_ALERT'
    veto_active INTEGER NOT NULL,             -- 0 = Inaktiv, 1 = Aktiv
    crash_risk_pct REAL NOT NULL,             -- z. B. 14.5
    strategy_payload TEXT NOT NULL,           -- JSON: Detaillierte Allokationen & Tranchen je Strategie (inkl. Broker-Ist & Cash für Kamikaze)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: Strategie-Versionen & Transparenz-Changelog
CREATE TABLE IF NOT EXISTS strategy_changelogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id TEXT NOT NULL,                -- 'MUZZLED_CATHIE_WOOD', 'KAMIKAZE_GROWTH', etc.
    version TEXT NOT NULL,                    -- z. B. 'v2.1'
    title TEXT NOT NULL,                      -- Kurztitel (z. B. 'Makrosicherung modifiziert')
    change_summary TEXT NOT NULL,             -- Detailbeschreibung der Regelanpassung
    broadcast_sent INTEGER DEFAULT 0,         -- Flag: 1 = An Telegram-Kanal gepusht
    released_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: Transaktions- und Signalisierungshistorie
CREATE TABLE IF NOT EXISTS signal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    signal_type TEXT NOT NULL,                -- 'BUY_TRANCHE', 'MONTHLY_EXECUTION', 'PARK_CASH', 'VETO_HOLD', 'TOPUP_DEPLOY', 'VERSION_UPDATE'
    strategy_id TEXT NOT NULL,                -- Zugehörige Strategie
    details TEXT,                             -- Allokationsdetails (z. B. "40% QQQ, 20% BTC, 40% Cash")
    status TEXT DEFAULT 'SENT',               -- 'SENT', 'CONFIRMED', 'SKIPPED'
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user_portfolios(user_id)
);
```

---

## 5. Cloudflare Worker (Frontend & Zustandsverwaltung)

Der Cloudflare Worker nimmt Webhooks von Telegram entgegen, führt Dialoge ohne Latenz und entlastet GitHub Actions von Vorab-Logik.

### Aufgaben des Workers:
1. **Zustandsgesteuertes Onboarding:** Führt die Abfragekette (inkl. Strategieauswahl) ohne Verzögerung aus.
2. **Entgegennahme von Ad-hoc Befehlen:** Verarbeitet `/topup <Betrag>`, `/rate <Betrag>`, `/status` in Millisekunden über den lokalen `market_regime_snapshot`.
3. **Execution Feedback:** Fängt Callback-Queries von Inline-Buttons ab (`[✅ Ausgeführt]` / `[⏳ Überspringen]`) und bucht den Depot-Status in D1 um.
4. **Die 3 Beweis-Szenarien:** Berechnet hypothetische Szenarien über vorberechnete Koeffizienten in < 20 ms.
5. **Snapshot-Ingestion:** Stellt einen geheimen Webhook-Endpunkt bereit (`POST /api/snapshot`), über den `CrashRadar` nach Marktschluss den `market_regime_snapshot` aktualisiert.

---

## 6. GitHub Actions (Batch-Scheduler & Engine)

GitHub Actions verbraucht Rechenzeit nur noch für geplante Großläufe:

### 1. Workflow: Wöchentlicher Statusbericht (`weekly_report.yml`)
* **Trigger:** `schedule` (`cron: '0 7 * * 1'`) – Jeden Montag um 07:00 UTC.
* **Ablauf:** Iteriert über alle aktiven Nutzer in D1 und pusht den aktuellen Depotstatus in deren private Chats.

### 2. Workflow: Monatliche Sparplanausführung (`monthly_savings.yml`)
* **Trigger:** `schedule` (`cron: '0 8 1 * *'`) – Jeden 1. des Monats um 08:00 UTC.
* **Ablauf:**
  1. Filtert Nutzer mit `monthly_rate > 0`.
  2. Liest die Allokation der jeweiligen `strategy_id` aus dem aktuellen Snapshot.
  3. Sendet konkrete Kaufanweisungen mit Inline-Buttons (`[✅ Ausgeführt]` / `[⏳ Überspringen]`) per Telegram-Push.

---

## 7. Sicherheits- und Betriebsvorgaben

1. **Strikte Einweg-Kopplung (CrashRadar ➔ D1):**  
   Das Signal-Repository erhält niemals Schreib- oder Lesezugriff auf die MySQL-Produktionsdatenbank von `CrashRadar`. Die Kommunikation erfolgt ausschließlich unidirektional über den geheimen Webhook-Endpunkt (`POST /api/snapshot`).
2. **Secrets-Verwaltung:**  
   * **CrashRadar:** Speichert `CF_SNAPSHOT_WEBHOOK_URL` und `CF_SNAPSHOT_SECRET`.
   * **Cloudflare Worker:** Speichert `TELEGRAM_BOT_TOKEN` und `CF_SNAPSHOT_SECRET`.
3. **Kosten- und Kontingentgarantie (0,00 €):**
   * **Cloudflare Workers:** Mit wenigen tausend Requests pro Tag weit unter dem Free-Limit (100.000 Req/Tag).
   * **Cloudflare D1:** Nur wenige Megabyte des 5-GB-Speicherkontingents belegt.
   * **GitHub Actions:** Reduzierung auf reine Batch-Cronjobs (< 30 Minuten/Monat), wodurch das 2.000-Minuten-Kontingent zu 98 % frei bleibt.

---

## 8. Konfigurations-Architektur & Strategie-Manifeste

Um maximale Entkopplung, einfache Wartung und saubere Git-Deltas zu gewährleisten, folgt die Konfiguration dem **modularen Manifest-Prinzip**: Statt einer unübersichtlichen, monolithischen Master-Datei besitzt jede Strategie ein eigenes Manifest in `config/strategies/`.

```
config/
├── Signal-Engine-Config.json          <-- Globale Steuerung der Engine (Webhooks, Scheduling)
└── strategies/                        <-- Autarke Strategie-Manifeste (Auto-Discovery)
    ├── muzzled-cathie-wood.json       <-- Parameter, Version & Changelog für MCW
    ├── kamikaze-growth.json           <-- Parameter, Version & Changelog für Kamikaze
    ├── seven-slot-guru.json           <-- Parameter, Version & Changelog für 7-Slot-Guru
    ├── gold-spy.json                  <-- Parameter, Version & Changelog für Gold-SPY
    └── satellite.json                 <-- Parameter, Version & Changelog für Satellite
```

### 1. Aufbau eines Strategie-Manifests (`config/strategies/<strategie-id>.json`)
Jedes Manifest ist die Single Source of Truth für Parameter, Revisionsstand und Historie der Strategie:

```json
{
  "id": "MUZZLED_CATHIE_WOOD",
  "name": "Muzzled Cathie Wood",
  "version": "2.1.0",
  "status": "ACTIVE",
  "allocation": {
    "tech_weight_pct": 60,
    "crypto_weight_pct": 40,
    "emergency_evacuation": {
      "gold_pct": 50,
      "cash_pct": 50,
      "trigger_net_liq_delta": -0.05
    }
  },
  "changelog": [
    {
      "version": "2.1.0",
      "date": "2026-09-08",
      "title": "Makrosicherung modifiziert",
      "summary": "Die Makrosicherung wurde modifiziert. Bei Überschreiten der Net-Liquidity-Gefahrenschwelle evakuiert das System nun in 50 % Gold / 50 % Cash mit Re-Entry Sniper.",
      "broadcast": true
    },
    {
      "version": "2.0.0",
      "date": "2026-08-15",
      "title": "Krypto-Pyramide 40/30/30 eingeführt",
      "summary": "Dynamische Tranchensteuerung über den BTC 21-Wochen-EMA implementiert.",
      "broadcast": true
    }
  ]
}
```

### 2. Globale Signal-Engine-Konfiguration (`config/Signal-Engine-Config.json`)
Beherbergt ausschließlich übergeordnete Parameter zur Ausführung und Schnittstellenanbindung:

```json
{
  "snapshot_export": {
    "enabled": true,
    "webhook_env_url": "CF_SNAPSHOT_WEBHOOK_URL",
    "frequency": "after_daily_analysis"
  },
  "active_strategies": [
    "MUZZLED_CATHIE_WOOD",
    "KAMIKAZE_GROWTH",
    "7_SLOT_GURU",
    "GOLD_SPY",
    "SATELITE"
  ]
}
```

### 3. Automatisierter Versionierungs- & Push-Workflow:
1. **Änderung in CrashRadar:** Entwickler passt z. B. in `kamikaze-growth.json` einen Parameter an, erhöht `version` auf `"1.2.0"` und fügt einen Changelog-Eintrag mit `broadcast: true` hinzu.
2. **Auto-Discovery:** Die `PortfolioStrategyEngine` lädt alle Manifeste dynamisch ein und erfasst den Versionssprung im täglichen Snapshot `daily_intelligence.json`.
3. **D1-Ingestion:** Der Webhook aktualisiert `strategy_changelogs` in Cloudflare D1.
4. **Proaktiver Push:** Der Cloudflare Worker erkennt die neue Version für aktive Portfolios (`strategy_version < new_version`) und sendet den Changelog-Text automatisch in die 1:1-Privatchats der betroffenen Nutzer.

---

## 9. Zu klärende Punkte für die evolutorische Entwicklung (Roadmap & Klärungsbedarf)

Für die anstehende evolutorische Umsetzung der SignalEngine und der fünf Portfoliostrategien müssen vier zentrale Architektur- und Integrationsfragen verbindlich fixiert werden:

```
┌────────────────────────────────────────────────────────────────────────┐
│             DIE 4 ZU KLÄRENDEN PUNKTE (EVOLUTORISCHE ROADMAP)          │
├───────────────────────────────┬────────────────────────────────────────┤
│ 1. Schritt 0: Daten-Audit &   │ Vollständige Registrierung aller       │
│    Fetcher-Vollständigkeit    │ Ticker (DFNS, GLD, Equities, 13F)      │
├───────────────────────────────┼────────────────────────────────────────┤
│ 2. Abstraktes Modell (%) vs.  │ Mathematische Gewichtung in CrashRadar │
│    Euro-Ausführung (€)        │ ✕ Nutzer-Budget & Mindestorder in D1   │
├───────────────────────────────┼────────────────────────────────────────┤
│ 3. Bidirektionale Feedback-   │ State-Machine für [✅ Ausgeführt] und   │
│    Schleife & Quittierung     │ Toleranz bei verspäteter Bestätigung   │
├───────────────────────────────┼────────────────────────────────────────┤
│ 4. Dynamisches Debouncing &   │ Sparplan-Ruhe (1x/Monat) vs.           │
│    Alert-Priorisierung        │ 0ms Notfall-Push bei Katastrophen-Alarm│
└───────────────────────────────┴────────────────────────────────────────┘
```

### 9.1 Schritt 0: Daten-Audit & Fetcher-Vollständigkeit (`config/Database-Fetcher-Config.json`)
* **Hintergrund:** Ein Live-Audit von [`config/Database-Fetcher-Config.json`](file:///D:/GitHub/CrashRadar/config/Database-Fetcher-Config.json) zeigt, dass zwar die Provider (Tiingo, YahooFinance, CBOE, FINRA) konfiguriert sind, die konkreten `tasks` jedoch primär auf FRED-Makrodaten und Binance-BTC beschränkt sind.
* **Erforderliche Datenreihen der 5 Strategien:**
  1. **ETFs & Rohstoffe:** `SPY` (Benchmark / Mutterschiff), `DFNS` (VanEck Defense UCITS ETF für Satellite), `GLD` / `IAU` (physisches Gold für Notfall-Schirm), `GDX` (Goldminen).
  2. **High-Beta Equities & Krypto-Aktien (Kamikaze & MCW):** `MSTR`, `MARA`, `COIN`, `HOOD`, `PLTR`, `NVTS`, `SOFI`, `PGY`, `S`.
  3. **Superinvestor-Konsens (7-Slot-Guru):** 13F-Filing-Daten (Scraper oder SEC Edgar Pipeline für die 6 Top-Gurus: Druckenmiller, Buffett, Klarman, Tepper, Li Lu, Burry).
  4. **Sentiment & Flow-Daten (Bottom-Finder):** CBOE Total Put/Call Ratio (`PUTCALL`), SqueezeMetrics Dark Pool Index (`DIX`), AAII Sentiment (`AAII_BULL` / `AAII_BEAR`), FINRA Margin Debt.
* **Verbindliche Festlegung für Schritt 0:**  
  Bevor die Strategy-Klassen im Runner instanziiert werden, muss jede fehlende Datenreihe mit Ticker, Intervall und Provider in `Database-Fetcher-Config.json` eingetragen und via Live-Fetch in die lokale MySQL-Datenbank ingestiert worden sein (keine Signalberechnung auf Blindwerten).

### 9.2 Abstraktes Modell (%) vs. Personalisierte Euro-Ausführung (€ & Währung)
* **Klare Trennung der Zuständigkeit:**
  * **CrashRadar SignalEngine:** Berechnet ausschließlich relative Ziel-Gewichte ($0{,}00$ bis $1{,}00$ bzw. $0\,\%$ bis $100\,\%$) sowie tranchenbasierte Delta-Anweisungen (`BUY_TRANCHE_1`, `EVACUATE_HEDGE`). Die Engine rechnet **währungsneutral** auf Portfolio-Prozente.
  * **Cloudflare Worker & D1 Gateway:** Ist für die Personalisierung zuständig. Er multipliziert:
    $$\text{Orderbetrag (€)} = \text{Zielgewicht (\%)} \times \text{User-Monatsrate oder Topup (€)}$$
* **Zu klärende Detailregeln für D1:**
  1. **Mindest-Ordergrößen & Split-Handling:** Wenn ein 5 % Bitcoin-Satellit bei einer 100-€-Sparrate nur 5 € ergäbe, viele Broker aber eine Mindest-Sparrate von 25 € oder keine Fractional Shares für Small Caps erlauben.  
     *Lösungsansatz:* D1 implementiert einen konfigurierbaren Mindest-Schwellenwert (`min_order_threshold_eur`, z. B. 25 €). Beträge darunter verbleiben auf dem Verrechnungskonto (`cash_reserve`), bis die Tranche die Mindestgröße erreicht.
  2. **Währungsumrechnung:** Alle Modelle rechnen in USD-Benchmarks (`SPY`, `BTC-USD`), während Privatanleger im D1-Gateway Euro (€) besparen. Der Cloudflare Worker zieht den EUR/USD-Tageskurs aus dem Snapshot, um Beträge korrekt in Euro auszugeben.
  3. **Ausnahme Kamikaze:** Kamikaze läuft als reines 94.000-$ USD-Echtgelddepot. Es findet keine Euro-Skalierung statt; Abonnenten sehen die Original-Dollar-Positionen und Zündfunken als Read-Only Stream.

### 9.3 Bidirektionale State-Machine & Feedback-Loop (`[✅ Ausgeführt]`)
* **Die Herausforderung:** Ein Nutzer erhält am 1. des Monats die Sparplan-Anweisung, führt den Kauf bei seinem Broker aber erst 3 Tage später oder gar nicht aus.
* **Status-Übergänge in Cloudflare D1 (`user_portfolios` & `signal_logs`):**
  * `SIGNAL_SENT`: Anweisung wurde per Telegram zugestellt.
  * `[✅ Ausgeführt]` geklickt:
    * `current_tranche` wird inkrementiert.
    * Das investierte Kapital wird von `cash_reserve` abgezogen.
    * Status wechselt auf `CONFIRMED`.
  * `[⏳ Diesen Monat überspringen]` geklickt:
    * Die Sparrate wird der internen `cash_reserve` gutgeschrieben (Bereitschaft für antizyklische Re-Entry-Sniper oder Nachkäufe).
    * Status wechselt auf `SKIPPED`.
* **Umgang mit Ausführungs-Latenz (Slippage):**
  * Da CrashRadar kein direkter Broker-Executor für Privatanleger ist, erfasst D1 den Ausführungstag und den Richtkurs des Snapshots. Eine exakte Cent-Abrechnung auf Nachkommastellen ist für die Signalführung nicht erforderlich; die relative Tranchen- und Disziplin-Treue steht im Vordergrund.

### 9.4 Dynamisches Debouncing & Alert-Priorisierung (Monats-DCA vs. Notfall-Push)
* **Das Problem:** Ein Benachrichtigungsdienst darf Privatanleger nicht mit täglichem Marktrauschen überschütten, muss aber bei einem Crash-Event in Echtzeit warnen.
* **3-Stufige Prioritäts-Hierarchie:**
  1. **Priorität 3 – Geplanter Monats- & Wochenzyklus (Vollkommene Chat-Ruhe):**
     * Monatliche Sparrate: Nur 1x pro Monat am 1. Werktag um 08:00 UTC.
     * Wöchentlicher Statusbericht: Nur 1x pro Woche montags um 07:00 UTC.
     * Dazwischen herrscht im 1:1-Chat absolute Ruhe (kein tägliches Ping-Pong).
  2. **Priorität 2 – Antizyklischer Re-Entry (Sniper-Alert):**
     * Schlägt der universelle Bottom-Finder an (`VIX >= 35` Reversal, Dark Pool DIX Wal-Akkumulation), wird innerhalb von 24h nach Marktschluss ein einmaliges Reinvestitions-Signal gepusht.
  3. **Priorität 1 – Globaler Katastrophen-Alarm (3-Säulen-Matrix schlägt an):**
     * Trendbruch (`SPY < SMA 200` mit $\text{DD} \ge 8\,\%$) **und** mind. 1 Makro-Alarm (VIX $\ge 28$, Credit Spreads, Deleveraging).
     * Hier wird jedes reguläre Debounce sofort auf **0 ms** übersteuert:
     * **Sofortiger Push:** Push-Benachrichtigung in alle privaten 1:1-Chats der betroffenen Strategien:  
       > 🚨 **NOTFALL-SCHUTZSCHILD AKTIVIERT (3-Säulen-Matrix)**  
       > *System-Trend gebrochen & Kredit-/Volatilitäts-Alarm aktiv.*  
       > **Handlungsanweisung:** Positionen evakuieren in den Schutzschirm (Gold & Cash).
     * **Anti-Whipsaw-Hysterese:** Nach Auslösen des Notfall-Schutzschirms bleibt die Evakuierung für mindestens 15 Handelstage verriegelt, um Fehlsignale und Whipsaws im Bärenmarkt zu unterbinden.


