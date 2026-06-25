# US Treasury Fiscal Data API - Fiskaldaten & Staatsfinanzen

Die Fiscal Data API des US-Finanzministeriums bietet öffentlichen Zugriff auf Daten rund um die Staatsfinanzen der USA, wie etwa den Kassenbestand (TGA), Staatsanleihen-Auktionen und Rückkaufprogramme.

## Basis-URL
`https://api.fiscaldata.treasury.gov/services/api/fiscal_service`

## API-Struktur & Endpunkte

Im Gegensatz zu manch anderen APIs verwendet die Fiscal Data API spezifische Endpunkte für jede Datenreihe (Datensatz). Das Datenformat der Antworten ist standardmäßig JSON. Eine Authentifizierung (API-Key) wird für normale Abfragen nicht benötigt.

### Parameter

Die API orientiert sich an JSON:API-Standards. Parameter werden per Query-String angehängt.

**Pflichtparameter:**
*   *Keine.* (Die API erfordert weder API-Keys noch zwingend weitere Parameter, um die Standardanzahl an Daten zurückzugeben.)

**Optionale Parameter:**
*   **`page[size]`** (Limit): Definiert die Anzahl der zurückgegebenen Datensätze pro Seite. Standard ist 100, das Maximum liegt bei `10000`. 
    *   *Beispiel:* `page[size]=1000`
*   **`page[number]`**: Zur Paginierung, falls mehr Ergebnisse als das eingestellte `page[size]`-Limit vorhanden sind.
*   **`filter`** (Startdatum / Zeiträume): Zum Filtern der Daten. Sehr nützlich für das Einschränken auf einen bestimmten Zeitraum.
    *   *Beispiel (ab einem bestimmten Datum):* `filter=record_date:gte:2023-01-01` (bzw. `operation_date` je nach Endpunkt)
*   **`sort`**: Sortierung der Ergebnisse. Ein vorangestelltes Minuszeichen (`-`) sortiert absteigend.
    *   *Beispiel:* `sort=-record_date` (Neueste Daten zuerst)

---

## Verwendete Datenreihen (Datasets)

Im Folgenden sind die für uns relevanten Endpunkte (Datasets) aufgelistet. 

### 1. TGA (Treasury General Account / Operating Cash Balance)
**Beschreibung:** Der Kassenbestand des US-Finanzministeriums (Treasury General Account). Zeigt an, wie viel Liquidität der US-Regierung zur Verfügung steht. Ein sinkender TGA bedeutet oft, dass Liquidität in den Markt fließt.
**Endpunkt:** `/v1/accounting/dts/operating_cash_balance`
**URL (mit Sortierung):** `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date`
*(Beispiel-Antwort: [tga.json](../../scripts/response/fiscaldata/tga.json))*

### 2. Staatsanleihen-Auktionen (Auctions Query)
**Beschreibung:** Details zu den durchgeführten und geplanten Auktionen von US-Staatsanleihen (Bills, Notes, Bonds).
**Endpunkt:** `/v1/accounting/od/auctions_query`
**URL (mit Sortierung):** `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-record_date`
*(Beispiel-Antwort: [auctions.json](../../scripts/response/fiscaldata/auctions.json))*

### 3. Rückkaufprogramme der US-Regierung (Buybacks Operations)
**Beschreibung:** Operationen des US-Finanzministeriums zum Rückkauf von Staatsanleihen (Buybacks), die Einfluss auf die Marktliquidität und die Zinskurve haben können.
**Endpunkt:** `/v1/accounting/od/buybacks_operations`
**URL (mit Sortierung):** `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/buybacks_operations?sort=-operation_date`
*(Beispiel-Antwort: [buybacks.json](../../scripts/response/fiscaldata/buybacks.json))*

---

## Code Beispiel & Automatischer Abruf

Ein lauffähiges Node.js-Skript, das diese Beispiel-Abfragen automatisiert ausführt und speichert, findest du hier:
- **Skript:** [fiscaldata_fetch_example.ts](../../scripts/fiscaldata_fetch_example.ts)
