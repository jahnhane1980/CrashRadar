# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Ausstehende Beweisführungen (Backtest-Skripte)
Es fehlen für die essenziellen Behauptungen aus der `docs/Analyse.md` noch teilweise die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** [OFFEN - Datenproblem] Korrelation von 13F-Daten, DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden.

### 2. Domain Splitting (Aufspaltung der Core-Engines)
Aufspaltung der verbleibenden, sauberen Indikatoren-Auswertung auf zwei neue Kern-Klassen.
* **Prototyp (Code-Vorlage):** Die Architektur-Aufteilung in zwei Engines wurde bereits erfolgreich in einer Sandbox bewiesen. Als Referenz dient: `scratch/performance/GoldGDXEngine.js`.
* **Die zwei neuen Engines:**
  - `MacroRegimeEngine`: Für übergeordnete Makro- und Liquiditäts-Analysen (Zyklus-Erkennung, Crash-Typ Klassifizierung, Catastrophe Stop). Gibt einen globalen Wetterbericht (`State`) aus.
  - `TradeSetupEngine`: Für kurzfristige, tagesaktuelle Setups und Signale (Dynamischer Einstieg, Gewinnmitnahmen, Divergenz-Tracking). Arbeitet reaktiv auf dem Zustand der MacroRegimeEngine und gibt konkrete `TradeActions` (Buy/Sell inkl. Sizing) aus.

## Erledigte Aufgaben

### Abgeschlossene Beweisführungen (Backtests)
Die folgenden Thesen wurden erfolgreich empirisch belegt:
* **MSTR & COIN als Krypto-Radar:** Den historischen Vorlauf/Nachlauf gegenüber BTC und den SMA-200/SMA-50 Bruch belegen. -> Siehe [MSTR-COIN-Krypto-Radar.js](file:///workspaces/CrashRadar/scratch/analyse/MSTR-COIN-Krypto-Radar.js)
* **Datengetriebene Boden-Findung (Aktien):** Das Kombi-Signal aus CBOE Volumen (>1.5x) + VIX (>35) + RSI Divergence als fehlerfreien Crash-Boden-Finder validieren. -> Siehe [CBOE-VIX-RSI-Bottom.js](file:///workspaces/CrashRadar/scratch/analyse/CBOE-VIX-RSI-Bottom.js)
* **LSTM Regime Radar:** Die 79% Trefferquote des neuronalen Netzes am Corona-Crash-Tiefpunkt nachweisen. -> Siehe [LSTM-Regime-Radar.js](file:///workspaces/CrashRadar/scratch/analyse/LSTM-Regime-Radar.js)
* **Fractional Kelly Hypothese:** 20-Jahres-Backtest (Binäres Risiko vs. Dynamisches Scaling nach Signal-Konfidenz) programmieren. -> Siehe [Fractional-Kelly.js](file:///workspaces/CrashRadar/scratch/analyse/Fractional-Kelly.js)
* **Relative-Volume-Handelsthese (RVOL):** Beweisen, dass Aktien-Breakouts mit RVOL >= 2.0 eine signifikant höhere Erfolgsquote haben als Breakouts mit normalem Volumen. -> Siehe [RVOL-Breakout-These.js](file:///workspaces/CrashRadar/scratch/analyse/RVOL-Breakout-These.js)

