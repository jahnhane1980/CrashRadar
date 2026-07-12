# CrashRadar Refactoring - Status & TODOs

## Was noch zu tun ist (Offen)

### 1. GOLD & GDX Dynamisches Debouncing (Push-Alarme) (Nächster Fokus)
* **Status:** Die Indikatoren für Gold und GDX wurden erfolgreich in Macro- und Investment-Signale getrennt und die Push-Benachrichtigungs-Pipeline via Ntfy ist aktiv.
* **Problem:** Das aktuelle statische 14-Tage-Debouncing der `getAlerts`-Methode blockiert in Crash-Phasen (z.B. die kurze Zeitspanne zwischen einem Selling Climax und dem finalen Healing Breakout) essenzielle Folge-Alarme.
* **Aufgabe:** 
  * **Dynamisches Debouncing:** Das System so umbauen, dass in "Peacetime" (ruhiger Markt) ein 14-Tage-Debounce gilt. Wechselt das System in den "Crisis Mode" (z.B. VIX Spike oder CRITICAL Warnungen), muss das Debouncing dynamisch auf 1-5 Tage reduziert werden, um schnelle V-Shape-Böden nicht zu verpassen.
