# CrashRadar Refactoring - Status & TODOs

## Was bisher erfolgreich umgesetzt wurde (Erledigt)
1. **Basis-Refactoring**: 
   - Das monolithische Design der `IndicatorEngine.js` wurde aufgebrochen.
   - Die `MathUtils.js` wurde als separates, sauberes Tool-Modul ausgelagert.
2. **Indikatoren-Migration (Alle 35/35 abgeschlossen)**:
   - Jeder Indikator wurde nach dem Registry-Pattern in eine eigene Klasse im Ordner `src/analysis/indicators/` ausgelagert.
   - Konstanten und Schwellenwerte (Thresholds) wurden direkt in die jeweiligen Instanzen gekapselt.
   - Die Abhängigkeit von `cycleConfig` wurde per Getter-Funktion (Dependency Injection) sauber gelöst.
3. **Qualitätssicherung**:
   - Die Testsuite (`vitest tests/analysis/IndicatorEngine.test.js`) verifizierte nach **jeder einzelnen** Auslagerung den Erfolg.
   - Aktueller Stand: **139/139 Tests bestanden (Grün!)**.

---

## Was noch zu tun ist (Offen)

### 1. Notification Separation & Config-Binding (Event-Driven Architektur)
* **Ziel:** Die Engine feuert künftig nur noch rohe, neutrale JavaScript-Daten-Events (z.B. `eventEmitter.emit('CRITICAL', data)`). Ein separater `NotificationService` fängt diese ab und formatiert sie.
* **Zu lösende Altlasten:** 
  - Die Engine baut derzeit plattformspezifische Notification-Payloads (Emojis, Prioritäten, Tags) und Konsolen-Outputs mit ANSI-Farbcodes selbst zusammen. Das muss ausgelagert werden.
  - Die Engine lädt Konfigurationsdateien direkt über `fs.readFileSync` von der Festplatte (Anti-Pattern, erschwert Unit-Testing). Das Laden der Configs muss aus der Engine entfernt werden.

### 2. Domain Splitting (Aufspaltung der Core-Engines)
Aufspaltung der verbleibenden, sauberen Indikatoren-Auswertung auf zwei neue Kern-Klassen.
* **Prototyp (Code-Vorlage):** Die Architektur-Aufteilung in zwei Engines wurde bereits erfolgreich in einer Sandbox bewiesen. Als Referenz dient: `scratch/performance/GoldGDXEngine.js`.
* **Die zwei neuen Engines:**
  - `MacroRegimeEngine`: Für übergeordnete Makro- und Liquiditäts-Analysen (Zyklus-Erkennung, Crash-Typ Klassifizierung, Catastrophe Stop). Gibt einen globalen Wetterbericht (`State`) aus.
  - `TradeSetupEngine`: Für kurzfristige, tagesaktuelle Setups und Signale (Dynamischer Einstieg, Gewinnmitnahmen, Divergenz-Tracking). Arbeitet reaktiv auf dem Zustand der MacroRegimeEngine und gibt konkrete `TradeActions` (Buy/Sell inkl. Sizing) aus.

---
*Letztes Update: Indikatoren-Migration komplett abgeschlossen. Bereit für Notification Separation.*
