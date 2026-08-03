# CrashRadar: System Context

*(Dieses Dokument dient als Gedächtnisstütze und State-Transfer für Folge-Sessions. Es hält den aktuellen Fokus, architektonische Leitplanken und strikte Arbeitsregeln fest).*

## 1. Testing-Philosophie & Synthetische Märkte (Chaos-Daten)
* **Chaos-Arrays:** Daten müssen in Tests Zyklen, hartes Rauschen (`Math.random()`) und extreme Gaps enthalten.
* **Struktur-Chaos (API-Ausfälle):** Wir löschen gezielt Schlüsselpunkte (wie `assets` oder `macroGroups`), um Robustheit zu beweisen.
* **Mathematische Singularitäten:** Wir zwingen Code gezielt in Division-by-Zero-Szenarien oder undefinierte Zustände (`UNKNOWN` Fallbacks).
* **Anti-Overfitting:** Rauschen (`Math.random()`) in historische Preise mischen, um echte Makro-Kausalitäten zu prüfen.

## 2. Aktueller Fokus / Fahrplan: Behebung der UNKNOWN-Werte im Makro-Wetterbericht
* **Aufgabe 1: Mapping in `FinanceExpert.js` ergänzen**
  * `SKEW`, `SPY_ShortVolumeRatio` und `TotalPCR` müssen in `finalData.assets` bzw. im Tagesobjekt gemappt werden, damit `SmartDumbMoneyTopIndicator` und `RedAlertIndicator` die Werte aus der DB erhalten.
* **Aufgabe 2: Last Known Value (Forward-Fill) & Stale-Handling für wöchentliche/verzögerte Daten**
  * Forward-Fill für AAII Sentiment und FINRA Short Volume nutzen, um künstliche `UNKNOWN`-Blindspots an tagesaktuellen Rastern zu vermeiden.
  * Altersgrenze (z.B. max. 14 Tage Gültigkeit) beachten/kennzeichnen, um Fehlsignale durch zu alte Daten zu verhindern.
* **Aufgabe 3: ML-Pipeline-Integration & Error-Handling absichern**
  * Sicherstellen, dass der ML-Inferenz-Schritt (`MLRegimeService.predict()`) für SPY, QQQ und BTC im Standard-Runner vor der Berichtgenerierung verlässlich ausgeführt wird.
  * Verbessertes Logging & Fallback bei ML-Ausfällen.
* **Aufgabe 4: Umstellung von `investing_challenger` Scraper auf FRED API (Cloudflare HTTP 403 Fix)**
  * **Analyse:** `investing.com` blockiert den Axios-Scraper in `InvestingComFetchAdapter.js` mit `HTTP 403 Forbidden: Blocked by Cloudflare`.
  * **Lösungsvorschlag (Empfohlen):** Umstellung des `ChallengerJobCuts`-Abrufs auf die offizielle FRED API (Series ID `JTSLDL` für Layoffs & Discharges), um Arbeitsmarkt-Daten ohne anfälliges HTML-Scraping und ohne Cloudflare-Sperren zu erhalten.