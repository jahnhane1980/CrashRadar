# ⚡ CrashRadar

## Konfiguration 
Konfigurationen für Abrufintervalle, Ticker-Listen und Quellenzuordnungen liegen zentral in:
config/Database-Fetcher-Config.json

## Codebasis Struktur
CrashRadar/
├── config/
│   └── Database-Fetcher-Config.json   # Task-Definitionen, Zeiträume und Adapter-Mappings
├── src/
│   ├── core/
│   │   ├── adapters/
│   │   │   ├── fetch/                 # Provider-Clients (FRED, Tiingo, FINRA, etc.)
│   │   │   └── storage/               # DB-Upsert-Adapter je Domain
│   │   ├── parsers/                   # Rohdaten-Parser (z. B. SEC 13F XML)
│   │   ├── repositories/              # Datenbank-Abstraktion
│   │   └── Logger.js / RequestManager # HTTP-Client mit Retry-Logik & Logging
│   ├── runners/
│   │   ├── DataFetchRunner.js         # Haupt-Task-Orchestrierung
│   │   └── TimeSeriesFetchRunner.js   # Generischer Runner für Zeitreihen
│   └── services/
│       └── NtfyService.js             # Headless-Alerting für Infrastrukturfehler
├── tests/
│   └── core/                          # Tests für Parser, Adapter und Repositories
├── index.js                           # CLI-Einstiegspunkt für Cronjobs / Workflows
└── TODO.md                            # Anstehende Härtungen und Fehlerbehebungen
