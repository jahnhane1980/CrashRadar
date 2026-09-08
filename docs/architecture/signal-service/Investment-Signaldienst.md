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
   * `[🛰️ Satellite Staking]` (Opportunistischer Krypto-Cashflow)
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
   Aggressive 50/50 High-Beta-Turnaround-Strategie für Tech-Aktien (`PLTR`, `NVTS`, `SOFI`) und Krypto-Equities (`MSTR`, `MARA`) ohne laufende Sparrate. Sie erfordert Weinstein Stage-2-Ausbrüche sowie den strikten 'Kein Kauf ohne SEC-10-Q'-Fundamental-Türsteher. Parabolische Überhitzungen werden über einen Climax-Top Exit abgeschöpft, während dieselbe 50/50 Gold/Cash Notfall-Evakuierung vor Bärenmärkten schützt.

3. 📄 **[`7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md) (`7_SLOT_GURU`):**  
   Fokussiertes 7-Slot-System, das ausschließlich Aktien kauft, die im 13F-Konsens von mindestens 2 legendären Superinvestoren gehalten werden. Die Einstiegs-Ampel kombiniert Fair-Value-Discounts mit technischem Momentum. Ein Druckenmiller-Makroschutzschild (Net Fed Liquidity) steuert eine defensive Absicherung oder Evakuierung zum Schutz des Kernkapitals.

4. 📄 **[`Gold-SPY.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-SPY.md) (`GOLD_SPY`):**  
   Quantitative Makro-Schild- und Tranchen-Strategie für dynamisches DCA im S&P 500 mit Gold-Absicherung. In euphorischen Phasen wird parabolischer Gewinn in physisches Gold umgeleitet (Skimming). Bei makroökonomischem Alarm (Net Liquidity Einbruch) evakuiert das System in 50 % Gold / 50 % Cash und kauft den Boden über einen 40/30/30-Tranchen-Sniper antizyklisch zurück.

5. 📄 **[`Satelite.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Satelite.md) (`SATELITE`):**  
   Opportunistisches Satelliten-Portfolio für unregelmäßige Gehaltsüberschüsse und Sonderzahlungen. Es fokussiert auf renditestarke Solana- und Ethereum-Staking-ETFs zur Generierung passiven Cashflows. Das Kapital wird zyklisch gesteuert und dient als Rendite-Booster neben den konservativeren Kern-Strategien.

6. 📄 **[`Gold-GDX.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Gold-GDX.md):**  
   *(Aktuell nicht im Signaldienst angeboten)*: Quantitative Regime- und Tranchen-Exit-Strategie für Edelmetall-Minenwerte (GDX). Steuert Gewinnmitnahmen über Selling Climaxes, ROC-Erschöpfung und Divergenzen. Verbleibt vorerst als reine Analyse- und Forschungsreferenz in `CrashRadar` und wird Nutzern im Bot nicht zur Auswahl gestellt.

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
    monthly_rate REAL DEFAULT 0.0,            -- Monatliche Sparrate
    flexible_topups_enabled INTEGER DEFAULT 0,-- Flag: Sonderzahlungen erwünscht (0 = Nein, 1 = Ja)
    pending_topup REAL DEFAULT 0.0,           -- Angemeldete, noch nicht investierte Sonderzahlung
    topup_status TEXT DEFAULT 'IDLE',         -- 'IDLE', 'WAITING_FOR_SIGNAL', 'ALLOCATED'
    cash_reserve REAL DEFAULT 0.0,            -- Aktuell auf Verrechnungskonto geparktes Kapital
    current_tranche INTEGER DEFAULT 0,        -- Fortschritt der Tranchenkäufe (z. B. 0 bis 3)
    strategy_version TEXT DEFAULT 'v1.0',     -- Revisionsstand der Strategie beim Nutzer
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
    strategy_payload TEXT NOT NULL,           -- JSON: Detaillierte Allokationen & Tranchen je Strategie
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

