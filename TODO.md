# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. Ausstehende Beweisführungen (Backtest-Skripte) (Nächster Fokus)
Es fehlen für die essenziellen Behauptungen aus der `docs/Analyse.md` noch teilweise die empirischen Code-Beweise im `scratch/analyse/`-Ordner:
* **Tech-Sektor Rotation & Infrastruktur-Mauer:** [OFFEN - Datenproblem] Korrelation von 13F-Daten, DIX und VandaTrack/Odd-Lots mit Tech-Tops beweisen. Der aktuelle Backtest [Tech-Infrastruktur-Rotation.js](file:///workspaces/CrashRadar/scratch/analyse/Tech-Infrastruktur-Rotation.js) nutzt simulierte Daten und muss mit echten historischen Zeitreihen verifiziert werden.

  * **13F Hedgefonds-Daten entfernen:** **[TODO]** 13F Daten aus der kurzfristigen Signal-Engine (bzw. dem Backtester) restlos entfernen, da sie sich aufgrund der Quartalsmeldung und 45-Tage-Verzögerung für exaktes Timing (Tops/Bottoms) als unbrauchbar erwiesen haben.
  * **Integration der Divergenz-Signale in die Engine:** **[TODO]** Die Indikator-Klassen (`SmartDumbMoneyTopIndicator` und `SmartDumbMoneyBottomIndicator`) sowie die Daten-Pipeline (Fetcher/Storage für AAII, NAAIM, SqueezeMetrics) sind fertig und zu 100% getestet. Die Indikatoren müssen nun in die `IndicatorEngine.js` eingebaut und im finalen Backtest überprüft werden.

### 2. Architektur & Benachrichtigungen (Transparenz)
* **Makro-Signale in den Push-Benachrichtigungen:** **[TODO]** Aktuell setzen Indikatoren aus der `MacroRegimeEngine.js` (wie die Smart/Dumb Money Divergenz) nur das Hintergrund-Wetter, lösen aber keine aktiven Push-Nachrichten über den `NotificationManager` aus (das macht nur die `TradeSetupEngine`). Die Architektur muss überarbeitet werden, damit der User bei einem Regime-Wechsel (oder Veto) nicht "blind" ist. Wenn ein Makro-Indikator feuert, muss nachvollziehbar gemeldet werden, *warum* das Regime gewechselt wurde (z.B. Makro-Trigger als eigenständige Alarme oder Spieglung in die Trade-Engine).
