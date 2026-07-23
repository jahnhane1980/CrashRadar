# CrashRadar Roadmap & Offene TODOs

Dieses Dokument bündelt alle aktuell noch offenen Entwicklungsaufgaben und Architekturerweiterungen für die CrashRadar-Engine. 
*Hinweis: Die Reihenfolge der Aufgaben spiegelt ihre Dringlichkeit und architektonische Priorität wider.*



## 2. Architektur-Review der Indikatoren & Notifications
* **Problem:** Es besteht der Verdacht, dass die aktuelle Pipeline ineffizient ist. Möglicherweise werden Daten doppelt geladen/ausgewertet oder Logiken überschneiden sich unnötig zwischen Engine und Notification-Schicht.
* **Ziel:** Kritische Prüfung der aktuellen Architektur auf Effizienz, Redundanz und saubere Trennung der Zuständigkeiten (Separation of Concerns).
* **Aufgaben [OFFEN]:** Datenfluss der Indikatoren und Alarme analysieren. Überlegen, ob dies wirklich die "beste Lösung" ist oder ob ein Refactoring der Architektur ansteht, um Mehrfachauswertungen zu eliminieren.

## 3. Fractional Kelly (Positionsgrößen-Skalierung)
* **Problem:** Die Engine gibt Makro-Vetos aus, aber wir passen unsere Positionsgrößen nicht algorithmisch an.
* **Aufgabe [OFFEN]:** Die in der Theorie geforderte dynamische Skalierung (z.B. 100% -> 40% -> 10% -> 0%) basierend auf den Makro-Vetos muss in der `TradeSetupEngine.js` noch implementiert werden (Füllung des `action.scaleDown` Flags mit mathematischer Logik).

## 4. Rework & Integration der ML-Modelle für Einzelaktien (Growth: SOFI, ZETA, NVTS)
* **Problem Historie:** Anfängliche LSTM-Modelle zeigten massive, aktienspezifische Biases (z.B. Dauer-Bullish bei SOFI, Dauer-Bearish bei NVTS), da sie nur auf Preis-Action trainiert waren und Rauschen memorierten (dokumentiert in `docs/ML_EVALUATIONS.md`).
* **Erreichtes Rework [Juli 2026]:** 
  * Das Bias-Problem wurde erfolgreich gebrochen! Die Modelle wurden mit erweiterten Daten (FINRA Short-Volume und fundamentalen Time-Series-Daten wie `Inst_Ownership` und `Dilution_Risk_Flag`) neu trainiert. Die Trefferquoten sind signifikant gestiegen (z.B. SOFI auf 58%).
  * **Tooling:** Es wurde ein dediziertes Evaluierungs-Skript geschaffen, um Modelle fortlaufend gegen ungesehene Test-Sets zu prüfen: [evaluate.js](file:///C:/GitHub/CrashRadar/scratch/tools/evaluate.js).
* **Der aktuelle Plan (Noch offen) - Pipeline-Integration & Wachhund:**
  * Jetzt da die ML-Signale belastbar sind, müssen sie in die `TradeSetupEngine` integriert werden.
  * *Neu anzulegen:* `src/analysis/indicators/MlRegimeRadarStockIndicator.js` als generischer Indikator pro Ticker.
  * *Neu anzulegen:* Eine `config/Fundamental-Veto-Config.json` zur Definition harter Schwellenwerte.
  * *Die Veto-Logik (Guard):* Obwohl das ML-Netz jetzt klüger ist, darf es niemals blind feuern. Wirft das LSTM ein Kaufsignal, prüft der Wachhund die Bilanz-Daten (z.B. Verwässerung) in der Datenbank auf Strukturbrüche und wirft notfalls ein hartes VETO.


## 5. Gamma-Hedging Backtest (Spurenlesen)
* **Ziel:** Evaluierung des "Spurenlesen" Konzepts (Säule 2: Gamma Hedging). Da Yahoo Finance keine historischen Optionsdaten bereitstellt, sammeln wir ab dem 04.07.2026 jeden Tag Live-Daten über den Fetcher.
* **Stichtag für ersten Backtest:** **04.01.2027** (nach ca. 6 Monaten Live-Aufzeichnung). Erst dann haben wir genug Markt-Regime (Bull, Bear, Volatility) und OPEX-Zyklen durchlebt, um die Gamma-Support/Resistance-Mauern belastbar in ML-Modelle oder Indikatoren zu integrieren.

## 6. Datensynchronisation mit "datacenter" (Supabase)
* **Problem:** Das "datacenter"-Projekt hat eigene exklusive Datensätze (z.B. KI-basierte News/SEC-Analysen, QRA-Estimates, Sector Rotation), die aktuell in der CrashRadar MySQL-Datenbank nicht abgebildet werden. 
* **Aufgabe [OFFEN]:** Überprüfung des Datenbestands in Supabase. Es muss evaluiert werden, welche exklusiven Daten aus dem "datacenter" in CrashRadar (z.B. für neue ML-Features) genutzt werden sollen und ob diese direkt in Supabase verbleiben oder in die MySQL-DB migriert werden.
* **Erster Meilenstein (14.07.2026) - M5-Candles Transfer:** 
  * Wir haben offiziell die Struktur für die 5-Minuten-Kerzen in CrashRadar (MySQL) aufgebaut. 
  * **Tabelle:** `market_data_m5` (`symbol`, `record_time`, `open`, `high`, `low`, `close`, `volume`).
  * **Status:** Der initiale Export/Import-Skriptlauf (`import_m5_supabase.js`) wurde heute gestartet. Er übersetzt die abstrakten Supabase `ticker_id`s (wie `12` für `SOFI` oder `28` für `QQQ`) in unsere String-Ticker und überführt den gesamten historischen 5-Minuten-Datensatz in unsere lokale Datenbank.
* **Hinweis zu Optionsdaten (AlphaVantage):** Das `datacenter` nutzt die AlphaVantage-API (`AlphaVantageOptionService.js`) gezielt für Optionsdaten (Volume-to-Open-Interest Ratio und Put-Call-Ratio). Da der Free-Tier auf 25 Calls/Tag limitiert ist, könnten wir durch das Abschalten oder Konsolidieren von redundanten Daten-Fetches (z.B. unserer alten `market_data_pcr` Tabellen in CrashRadar) das API-Kontingent entlasten und effizienter nutzen.
