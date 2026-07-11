# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Ausstehende Beweisführungen (Backtest-Skripte) (Nächster Fokus)
Es fehlen für die essenziellen Behauptungen aus der `docs/Analyse.md` noch teilweise die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** [OFFEN - Datenproblem] Korrelation von 13F-Daten, DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden.
  * **[ERLEDIGT]** Implementierung von `SqueezeMetricsFetchAdapter` und `SqueezeMetricsAdapter`.
  * **[ERLEDIGT]** Implementierung des `SecEdgar13FFetchAdapter` und `SecEdgar13FAdapter` für die Smart Money 13F Filings.
  * **Finaler Beweis (Die Dumb Money Divergenz):** Implementierung der Fetcher für `AAII Sentiment`, `FINRA Margin Debt` und `NAAIM Exposure Index`. Backtest/Beweisführung, dass an Tops der Retail-Markt (AAII/Margin) furchtlos überschuldet ist, während das Smart Money (NAAIM/13F) zeitgleich panisch hedgt. Das PCR wird als unbeweisbare Retail-Metrik verworfen.
