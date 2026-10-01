# TODO

## 1. Härtung und Entkopplung des NtfyService (Infrastruktur-Alerting)

### Problem & Kontext
* Im Quellcode von `src/services/NtfyService.js` existieren hartkodierte Fallback-Werte (z. B. Topic `Crash-Alert-4NpY6sD2jK_Test` sowie der Default-Tag `chart_with_upwards_trend`)[cite: 4].
* Trotz Löschung von `config/Notification-Config.json` sendet der Service weiterhin Alerts an dieses hardcodierte Topic[cite: 1, 4].
* Dies verletzt 12-Factor-App-Prinzipien, leckt interne Kommunikationskanäle ins VCS und bindet die reine Ingestion-Pipeline begrifflich an das alte „Crash-Radar“-System.

### Ziel-Zustand
* `src/services/NtfyService.js` fungiert ausschließlich als neutraler Infrastruktur-Alerter für ETL-/Ingestion-Fehler im Headless-Betrieb (GitHub Actions / Scheduled Jobs).
* Konfiguration erfolgt ausnahmslos über Umgebungsvariablen (`process.env`).
* Keine hartkodierten Topic-Namen oder fachlichen Regimedaten mehr im Code.

### Technische Anforderungen & Spezifikation
1. **Konfigurationsauflösung:**
   * Base-URL: `process.env.NTFY_URL || 'https://ntfy.sh'`
   * Topic: `process.env.NTFY_TOPIC` (strikt ohne String-Fallback)
2. **Guard Condition (Early Return):**
   * Vor dem Absetzen eines HTTP-Requests prüfen: `if (!process.env.NTFY_TOPIC)`.
   * Ist kein Topic definiert: Warnung via `Logger` ausgeben (`"NTFY_TOPIC nicht konfiguriert – Benachrichtigung übersprungen"`) und Methode sofort ohne Netzwerkaufruf terminieren.
3. **Signatur & Parameter-Bereinigung:**
   * Den Default-Parameter `tags = 'chart_with_upwards_trend'` durch einen neutralen Infrastruktur-Tag ersetzen (z. B. `'warning'` oder `'wrench'`).
4. **Aufrufer-Prüfung:**
   * Sicherstellen, dass Aufrufer wie `src/runners/DataFetchRunner.js` oder Fehler-Handler die Methode weiterhin mit `(title, message, priority, tags)` aufrufen können, ohne dass Exceptions bei fehlender Konfiguration geworfen werden.
5. **Secrets & CI-Workflow:**
   * Sicherstellen, dass in `.github/workflows/daily-fetch.yml` der Secret-Parameter `NTFY_TOPIC: ${{ secrets.NTFY_TOPIC }}` gesetzt werden kann.

---

## 2. Tiingo-API Rate-Limiting & Backoff-Strategie (HTTP 429)

### Problem & Kontext
* Beim Abruf von Ticker-Daten (u. a. `CIBR`, `FDN`, `IPAY`, `TDIV`, `ARKK`, `PLTR`, `S`, `SOFI`, `ZETA`, `SOUN`, `LUMN`, `NVTS`) bricht die Ingestion mit `429 Too Many Requests` ab[cite: 4].
* Der `RequestManager` triggert 3 Retries innerhalb von nur ~2 Sekunden[cite: 4]. Das ist bei API-Rate-Limits wirkungslos, da Zeitfenster (typischerweise 60 Sekunden) noch aktiv sind.

### Ziel-Zustand
* Gezielte Drosselung von aufeinanderfolgenden Tiingo-Requests und intelligenter Backoff bei HTTP 429, sodass Tasks nicht deterministisch scheitern.

### Technische Anforderungen & Spezifikation
1. **Header-Auswertung:**
   * `RequestManager.js` muss bei HTTP-Status 429 den Header `Retry-After` auslesen und die Wartezeit entsprechend dynamisch anpassen.
2. **Backoff-Intervalle:**
   * Falls kein `Retry-After`-Header existiert: Statt Subsekunden-Retries einen gestaffelten Backoff verwenden (z. B. 5s -> 15s -> 30s).
3. **Request-Throttling (Proaktiv):**
   * Im Tiingo-Fetch-Adapter (`src/core/adapters/fetch/`) ein Mindestintervall (z. B. 1000–1500 ms Delay per `setTimeout`/Promise) zwischen sequenziellen Symbolabrufen implementieren, um das Auslösen des Limits von vornherein zu verhindern.

---

## 3. Yahoo Finance Adapter Timezone / Off-by-One Fix

### Problem & Kontext
* Symbole wie `DX-Y.NYB`, `GC=F`, `CL=F`, `HG=F`, `ZQ=F`, `NQ=F`, `ES=F`, `^VIX` werden mit der Meldung `Skipping ... as startValue (YYYY-MM-DD) is in the future` übersprungen[cite: 2, 3, 4].
* Ursache ist eine fehlerhafte Datumsberechnung (`last_timestamp + 1 day`) im Zusammenspiel mit lokalen Systemzeiten und UTC-Tagesgrenzen.

### Ziel-Zustand
* Tagesaktuelle Marktdaten werden zuverlässig synchronisiert, ohne dass der Folgetag fälschlicherweise als Startdatum berechnet wird, solange die Börsen noch nicht geschlossen haben.

### Technische Anforderungen & Spezifikation
1. **Datumsberechnung im Fetch-Adapter:**
   * `src/core/adapters/fetch/YahooFinanceFetchAdapter.js` prüfen: Berechnung von `startValue` gegen `Date.now()` bzw. den aktuellen Börsentag validieren.
   * Prüfen, ob `startDate <= currentDateUTC` eingehalten wird, statt den Task vorzeitig zu verwerfen.