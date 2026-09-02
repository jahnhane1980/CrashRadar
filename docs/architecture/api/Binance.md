# Binance Spot API - Historische Marktdaten & Volumen

## Problemstellung: 24h Ticker
Der Endpunkt `GET /api/v3/ticker/24hr` liefert immer nur ein rollierendes 24-Stunden-Fenster ausgehend von der genauen Sekunde der Anfrage. Da der Kryptomarkt 24/7 geöffnet ist, gibt es keinen klassischen Pre- oder After-Market.
- **Limitierung:** Es können keine historischen Zeitfenster (z. B. ein bestimmter Tag in der Vergangenheit von 00:00 bis 23:59 Uhr) definiert werden. Parameter wie `startTime` oder `endTime` existieren hierfür nicht.
- **Volumen:** Zeigt nur das aggregierte Gesamtvolumen der letzten 24 Stunden, ohne die Möglichkeit, dieses Volumen spezifischen Preisbewegungen zuzuordnen.

## Lösung: Kline/Candlestick Daten
Um Daten für historische Tage oder das Volumen für spezifische Preisbewegungen zu analysieren, muss stattdessen der **Kline/Candlestick-Endpunkt** genutzt werden.

### Endpunkt
`GET /api/v3/klines`

### Basis-URL
`https://api.binance.com` (oder alternative Cluster wie `https://api1.binance.com`)

### Wichtige Such-Parameter (Query Parameters)
*   **symbol** *(Pflicht)*: Das Handelspaar, z. B. `BTCUSDT`
*   **interval** *(Pflicht)*: Die Zeitspanne pro Kerze, z. B. `1d` (für eine Tages-Kerze), `1h` (Stunde), `15m` (15 Minuten), etc.
*   **startTime** *(Optional)*: Startzeitpunkt in Millisekunden (z. B. Timestamp für 2026-06-12 00:00:00).
*   **endTime** *(Optional)*: Endzeitpunkt in Millisekunden (z. B. Timestamp für 2026-06-12 23:59:59).

*Hinweis: Wenn `startTime` und `endTime` weggelassen werden, werden die aktuellsten Kerzen zum gewünschten Intervall zurückgegeben.*

### Rückgabewerte (Auszug der wichtigsten Daten)
Die API liefert ein Array für jede Kerze im gewählten Zeitraum. Darin enthalten sind unter anderem:
- **Open, High, Low, Close (OHLC)**: Die exakten Preise für das Intervall.
- **Volume**: Gesamtvolumen (im Base Asset, z. B. BTC).
- **Quote Asset Volume**: Gesamtvolumen (im Quote Asset, z. B. USDT).
- **Number of Trades**: Anzahl der durchgeführten Trades.
- **Taker Buy Base Asset Volume**: Das Kaufvolumen, das durch aktive Käufer (Market-Orders) generiert wurde. *Wichtig:* Durch Abzug dieses Wertes vom Gesamtvolumen lässt sich der Verkaufsdruck ermitteln.

### Offizielle Dokumentation
- [Binance API Docs - Kline/Candlestick Data](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints#klinecandlestick-data)

## Abfrage großer Zeiträume (Pagination & Bulk-Downloads)

### 1. API Limit pro Request (Batch-Limit)
Ein einzelner Aufruf an `/api/v3/klines` liefert **maximal 1000 Kerzen** auf einmal (gesteuert über den Parameter `limit`, Default ist 500, Max 1000).
- Beispiel: Bei `interval=1d` erhält man mit einem Request 1000 Tage am Stück.
- Beispiel: Bei `interval=1m` entsprechen 1000 Kerzen nur 1000 Minuten (ca. 16,5 Stunden).

### 2. Paginierung über die REST-API
Für längere Zeiträume (z. B. 1-Minuten-Daten über mehrere Jahre) muss die Abfrage automatisiert über ein Skript paginiert (in einer Schleife durchlaufen) werden:
1. Eine erste Anfrage mit der gewünschten Startzeit (`startTime`) absenden.
2. In der erhaltenen Antwort die **Close Time** der *letzten* Kerze (Index 6 im Array) auslesen.
3. Diese `Close Time` nehmen, 1 Millisekunde addieren, und als neue `startTime` in den nächsten Request einsetzen.
4. Diese Schleife wiederholen, bis das gewünschte Enddatum (`endTime`) erreicht ist.

### 3. Binance Data Vision (Bulk-Download)
Wenn ohnehin riesige historische Datensätze (z.B. jahrelange 1-Minuten-Kerzen) zum Backtesting benötigt werden, ist das massenhafte Abfragen via REST-API zu langsam.
Dafür stellt Binance unter **[data.binance.vision](https://data.binance.vision/)** fertige CSV-Dateien (in `.zip` gepackt) zum direkten Download bereit. Dort finden sich die exakt gleichen OHLCV-Daten für komplette Tage, Monate oder Jahre aufbereitet.

## Authentifizierung (API-Keys)
Für reine **Marktdaten-Endpunkte** (Market Data Endpoints) wie `GET /api/v3/klines` oder `GET /api/v3/ticker/24hr` wird **kein API-Key** benötigt. Diese Daten sind komplett öffentlich zugänglich und können direkt ohne Authentifizierung (z. B. über den Browser oder ein einfaches Skript) abgefragt werden.

Ein API-Key (inkl. kryptografischer Signatur) wird erst benötigt für:
1. Zugriff auf **private Account-Daten** (z. B. Kontostand, Trade-Historie).
2. **Aktives Handeln** (z. B. das Platzieren oder Stornieren von Orders).

## Code Beispiel
Ein lauffähiges Skript, das die Kline-Daten für die letzten 2 Wochen (14 Tage) auf Basis von Tageskerzen (`1d`) abruft und als JSON abspeichert, findest du hier:
- **Skript:** [binance_fetch_example.ts](../../scripts/binance_fetch_example.ts)
- **Beispiel-Response:** [klines_2weeks.json](../../scripts/response/binance/klines_2weeks.json)
