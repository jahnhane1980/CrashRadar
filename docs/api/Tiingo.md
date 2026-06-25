# Tiingo API Dokumentation & Futures-Alternative

## Indizes & Futures über Tiingo
Tiingo liefert standardmäßig **keine** Preisdaten für direkte Indizes (wie `^GSPC` oder `NDX`) und **keine** Futures-Kontrakte (wie `ES` für S&P 500 oder `NQ` für Nasdaq 100).

## Die Alternative: Tracker-ETFs (SPY & QQQ)
Als Ersatz für die reinen Indizes und Futures verwenden wir die jeweiligen Tracker-ETFs. Da diese ETFs (insbesondere SPY und QQQ) hochliquide sind und auch außerhalb der regulären Börsenöffnungszeiten (Pre-Market / After-Hours) ausgiebig gehandelt werden, dienen ihre Kursbewegungen als perfekten Indikator für die Marktstimmung, genau wie die eigentlichen Futures.

*   **S&P 500:** Ticker **`SPY`** (SPDR S&P 500 ETF Trust)
*   **Nasdaq 100:** Ticker **`QQQ`** (Invesco QQQ Trust)

---

## Konkrete URLs für Abfragen

Die Basis-URL für alle Abfragen lautet: `https://api.tiingo.com`

> **Wichtig zur Authentifizierung:** Bei jeder Abfrage muss der API-Key mitgeschickt werden. Entweder als Header `Authorization: Token <DEIN_API_KEY>` oder als URL-Parameter `?token=<DEIN_API_KEY>`. Der Key befindet sich in der Projekt-Datei `.env` als `TIINGO_API_KEY`.

### 1. Aktueller Preis (inkl. Pre- & After-Market) via IEX Feed
Um Echtzeitkurse auch außerhalb der regulären Handelszeiten zu erhalten, wird der IEX-Endpunkt von Tiingo genutzt. Dies ersetzt den Blick auf die Futures.

*   **S&P 500 (SPY):**
    `https://api.tiingo.com/iex/SPY` *(Beispiel-Antwort: [iex_spy.json](../../scripts/response/tiingo/iex_spy.json))*
*   **Nasdaq 100 (QQQ):**
    `https://api.tiingo.com/iex/QQQ` *(Beispiel-Antwort: [iex_qqq.json](../../scripts/response/tiingo/iex_qqq.json))*

*(Ergebnis ist ein JSON-Array mit dem Echtzeit-Preis, aktuellem Bid/Ask und Zeitstempeln).*

### 2. Historische Intraday-Daten (inkl. Pre-Market)
Um Kursverläufe während und außerhalb der Handelszeiten zu laden (z.B. um Charts mit Pre-Market Daten darzustellen). Die Datenauflösung lässt sich über `resampleFreq` steuern (z.B. `1min`, `5min`, `1hour`).

*   **SPY (Beispiel 5-Minuten-Kerzen):**
    `https://api.tiingo.com/iex/SPY/prices?resampleFreq=5min` *(Beispiel-Antwort: [iex_spy_prices_5min.json](../../scripts/response/tiingo/iex_spy_prices_5min.json))*
*   **QQQ (Beispiel 1-Minuten-Kerzen):**
    `https://api.tiingo.com/iex/QQQ/prices?resampleFreq=1min` *(Beispiel-Antwort: [iex_qqq_prices_1min.json](../../scripts/response/tiingo/iex_qqq_prices_1min.json))*

### 3. End-of-Day (EOD) Tagesabschlusskurse
Für die regulären täglichen Schlusskurse (inklusive Open, High, Low, Close, Adjusted Close und Volumen). Diese Daten beinhalten keine Intraday- oder Pre-Market-Schwankungen.

*   **S&P 500 (SPY):**
    `https://api.tiingo.com/tiingo/daily/SPY/prices` *(Beispiel-Antwort: [daily_spy.json](../../scripts/response/tiingo/daily_spy.json))*
*   **Nasdaq 100 (QQQ):**
    `https://api.tiingo.com/tiingo/daily/QQQ/prices` *(Beispiel-Antwort: [daily_qqq.json](../../scripts/response/tiingo/daily_qqq.json))*

*(Um eine Historie abzufragen, können Parameter wie `?startDate=2023-01-01` angehängt werden).*

---

## Automatischer Daten-Abruf (Beispiel-Skript)
Ein Node.js-Skript, das diese Beispiel-Abfragen automatisiert ausführt und speichert, findest du hier:
[tiingo_fetch_examples.ts](../../scripts/tiingo_fetch_examples.ts)
