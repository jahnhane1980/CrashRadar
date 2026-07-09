# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Aufbau des "Alternative Labor Market" Divergenz-Trackers (Nächster Fokus)
* Implementierung von nativen Scraping-Fetcher-Strategien (Strategy Pattern) direkt im System für die staatlichen Warn-Portale (WARN-Notices) der "Big 4" (Kalifornien, Texas, New York, Florida).
* Direkte Integration des Parsings für die monatlichen Entlassungsreports (Challenger, Gray & Christmas).

### 2. Ausstehende Beweisführungen (Backtest-Skripte)
Es fehlen für die essenziellen Behauptungen aus der `docs/Analyse.md` noch teilweise die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** [OFFEN - Datenproblem] Korrelation von 13F-Daten, DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden.

