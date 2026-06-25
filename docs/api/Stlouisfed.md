# St. Louis Fed (FRED) API - Wirtschafts- & Finanzdaten

Die FRED API (Federal Reserve Economic Data) der St. Louis Fed bietet Zugriff auf eine Vielzahl an volkswirtschaftlichen Indikatoren, Zentralbank-Bilanzen und Liquiditätskennzahlen.

## Basis-URL
`https://api.stlouisfed.org`

## Endpunkt für Zeitreihen-Daten
`GET /fred/series/observations`

### Parameter

**Pflichtparameter (Mandatory):**
*   **`series_id`**: Die eindeutige ID der abzufragenden Datenreihe (z. B. `WALCL`).
*   **`api_key`**: Der persönliche API-Schlüssel zur Authentifizierung (als 32-stelliger String).
    *   *Hinweis: Der API-Key ist in der Datei `.env` im ROOT-Verzeichnis unter dem Namen `FRED_API_KEY` zu finden.*

**Optionale Parameter:**
*   **`file_type`**: Das gewünschte Antwortformat. Standard ist `xml`. Um JSON zu erhalten, muss zwingend `file_type=json` gesetzt werden.
*   **`observation_start`**: Startdatum der Datenreihe im Format `YYYY-MM-DD` (z. B. `2020-01-01`). Ohne diesen Parameter werden Daten ab dem frühestmöglichen Datum zurückgegeben.
*   **`observation_end`**: Enddatum der Datenreihe im Format `YYYY-MM-DD`.
*   **`limit`**: Maximale Anzahl an zurückgegebenen Datensätzen (Beobachtungen). Standard und Maximum ist `100000`.

---

## Verwendete Datenreihen (Series)

Im Folgenden sind die für uns relevanten Serien aufgelistet. Die URLs gehen davon aus, dass der Parameter `file_type=json` und der `api_key` angehängt werden.

> **Hinweis zur Datenherkunft:** Die Informationen zu den jeweiligen Update-Intervallen wurden direkt über den Metadaten-Endpunkt (`/fred/series`) der FRED-API bezogen und mit den Veröffentlichungs-Kalendern der Federal Reserve (z.B. H.4.1 Release) abgeglichen.

### 1. WALCL (Fed Total Assets)
**Beschreibung:** Die Gesamtbilanzsumme der Federal Reserve. Ein Indikator für Quantitative Easing (QE) oder Quantitative Tightening (QT).
**Update-Intervall:** Wöchentlich (Stand: Mittwoch). Offizieller Release durch die Fed (H.4.1 Report) ist in der Regel donnerstags um 16:30 Uhr US-Ostküstenzeit (ca. 22:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=WALCL&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [walcl.json](../../scripts/response/fred/walcl.json))*

### 2. RRPONTSYD (Domestic RRP)
**Beschreibung:** Overnight Reverse Repurchase Agreements. Zeigt die Überschussliquidität im Finanzsystem an, die Banken und Geldmarktfonds über Nacht bei der Fed parken.
**Update-Intervall:** Täglich. Veröffentlichung kurz nach den Operationen der New York Fed, meist am frühen US-Nachmittag (ca. 19:15 - 19:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=RRPONTSYD&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [rrpontsyd.json](../../scripts/response/fred/rrpontsyd.json))*

### 3. DFII10 (US 10Y Real Yield)
**Beschreibung:** Die reale (inflationsbereinigte) Rendite 10-jähriger US-Staatsanleihen. Wichtig für die Bewertung von Risikoanlagen (wie Tech-Aktien oder Krypto).
**Update-Intervall:** Täglich. Veröffentlichung durch das US-Finanzministerium am US-Nachmittag (meist bis spätestens 22:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=DFII10&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [dfii10.json](../../scripts/response/fred/dfii10.json))*

### 4. T10Y2Y (Zinsstrukturkurve)
**Beschreibung:** Der Spread (Zinsdifferenz) zwischen 10-jährigen und 2-jährigen US-Staatsanleihen. Eine invertierte Kurve gilt oft als Rezessionsindikator.
**Update-Intervall:** Täglich. Ebenfalls am US-Nachmittag analog zu den anderen Treasury Rates (bis ca. 22:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [t10y2y.json](../../scripts/response/fred/t10y2y.json))*

### 5. TOTRESNS (Total Reserves)
**Beschreibung:** Die gesamten Reserven von Depotinstituten bei der Fed. Wichtiger Indikator für die Bankenliquidität.
**Update-Intervall:** Monatlich.
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=TOTRESNS&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [totresns.json](../../scripts/response/fred/totresns.json))*

### 6. WLCFLL (Liquidity and Credit Facilities: Loans)
**Beschreibung:** Kredite, die über verschiedene Liquiditäts- und Kreditfazilitäten der Fed vergeben wurden.
**Update-Intervall:** Wöchentlich (Stand: Mittwoch). Wird zusammen mit WALCL im H.4.1 Report donnerstags (ca. 22:30 Uhr deutscher Zeit) veröffentlicht.
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=WLCFLL&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [wlcfll.json](../../scripts/response/fred/wlcfll.json))*

### 7. BORROW (Fed Borrowings)
**Beschreibung:** Die gesamten Kredite der Fed an Banken (Borrowings von Depotinstituten).
**Update-Intervall:** Monatlich.
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=BORROW&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [borrow.json](../../scripts/response/fred/borrow.json))*

### 8. LOANS (Bank Loans)
**Beschreibung:** Commercial and Industrial Loans bei allen Geschäftsbanken. Ein Gradmesser für die Kreditvergabe an Unternehmen.
**Update-Intervall:** Monatlich. (Basierend auf den wöchentlichen H.8 Daten, welche freitags um ca. 22:15 Uhr deutscher Zeit publiziert werden).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=LOANS&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [loans.json](../../scripts/response/fred/loans.json))*

### 9. WORAL (Fed RRP vs. SRF Utilization / SRF Proxy)
**Beschreibung:** Repo-Geschäfte der Fed (Securities Sold Under Agreements to Repurchase). Dient oft zur Analyse der Standing Repo Facility (SRF) bzw. zur Liquiditätsüberwachung.
**Update-Intervall:** Wöchentlich (Stand: Mittwoch). Bestandteil des H.4.1 Reports am Donnerstag (ca. 22:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=WORAL&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [woral.json](../../scripts/response/fred/woral.json))*

### 10. NFCI (Chicago Fed National Financial Conditions Index)
**Beschreibung:** Ein wöchentlicher Index der Chicago Fed, der die aktuellen finanziellen Bedingungen anzeigt. Negative Werte bedeuten lockere, positive Werte bedeuten restriktive Finanzierungsbedingungen.
**Update-Intervall:** Wöchentlich (die Datenwoche endet am vorherigen Freitag). Veröffentlichung ist immer mittwochs um 08:30 Uhr CT/ET (ca. 14:30 Uhr deutscher Zeit).
**URL:** `https://api.stlouisfed.org/fred/series/observations?series_id=NFCI&api_key=YOUR_API_KEY&file_type=json`
*(Beispiel-Antwort: [nfci.json](../../scripts/response/fred/nfci.json))*

---

## Code Beispiel & Automatischer Abruf

Ein lauffähiges Node.js-Skript, das diese Beispiel-Abfragen automatisiert ausführt und speichert, findest du hier:
- **Skript:** [fred_fetch_example.ts](../../scripts/fred_fetch_example.ts)
