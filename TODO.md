# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Ausstehende Beweisführungen (Backtest-Skripte) (Nächster Fokus)
Es fehlen für die essenziellen Behauptungen aus der `docs/Analyse.md` noch teilweise die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** [OFFEN - Datenproblem] Korrelation von DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden.
