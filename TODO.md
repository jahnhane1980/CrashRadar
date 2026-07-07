# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Ausstehende Beweisführungen (Backtest-Skripte)
Es fehlen für 6 essenzielle Behauptungen aus der `docs/Analyse.md` noch die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** Korrelation von 13F-Daten, DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. *(Details siehe [neue-Thesen.md](file:///C:/GitHub/CrashRadar/neue-Thesen.md))*
* **MSTR & COIN als Krypto-Radar:** Den historischen Vorlauf/Nachlauf gegenüber BTC und den SMA-200/SMA-50 Bruch belegen.
* **Datengetriebene Boden-Findung (Aktien):** Das Kombi-Signal aus CBOE Volumen (>1.5x) + VIX (>35) + RSI Divergence als fehlerfreien Crash-Boden-Finder validieren.
* **LSTM Regime Radar:** Die 79% Trefferquote des neuronalen Netzes am Corona-Crash-Tiefpunkt nachweisen.
* **Fractional Kelly Hypothese:** 20-Jahres-Backtest (Binäres Risiko vs. Dynamisches Scaling nach Signal-Konfidenz) programmieren.
* **Relative-Volume-Handelsthese (RVOL):** Beweisen, dass Aktien-Breakouts mit RVOL >= 2.0 eine signifikant höhere Erfolgsquote haben als Breakouts mit normalem Volumen. *(Details siehe [neue-Thesen.md](file:///C:/GitHub/CrashRadar/neue-Thesen.md))*

### 2. Domain Splitting (Aufspaltung der Core-Engines)
Aufspaltung der verbleibenden, sauberen Indikatoren-Auswertung auf zwei neue Kern-Klassen.
* **Prototyp (Code-Vorlage):** Die Architektur-Aufteilung in zwei Engines wurde bereits erfolgreich in einer Sandbox bewiesen. Als Referenz dient: `scratch/performance/GoldGDXEngine.js`.
* **Die zwei neuen Engines:**
  - `MacroRegimeEngine`: Für übergeordnete Makro- und Liquiditäts-Analysen (Zyklus-Erkennung, Crash-Typ Klassifizierung, Catastrophe Stop). Gibt einen globalen Wetterbericht (`State`) aus.
  - `TradeSetupEngine`: Für kurzfristige, tagesaktuelle Setups und Signale (Dynamischer Einstieg, Gewinnmitnahmen, Divergenz-Tracking). Arbeitet reaktiv auf dem Zustand der MacroRegimeEngine und gibt konkrete `TradeActions` (Buy/Sell inkl. Sizing) aus.
