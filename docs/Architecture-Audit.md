# Architektur-Review & Code-vs-Theorie Audit (Juli 2026)

Dieser Audit-Report dokumentiert die Divergenzen zwischen der theoretischen Makro-Forschung (`docs/Analyse.md`) und der tatsächlichen Implementierung in der CrashRadar-Engine (`src/analysis/`). 
Er dient als direkter Fahrplan für das anstehende Refactoring.

## 🚨 Fehlende Implementierungen (In Theorie gefordert, aber Code existiert nicht)
* **[ ] Fractional Kelly (Positionsgrößen-Skalierung)**
  * *Problem:* Die Theorie fordert eine dynamische Skalierung (z.B. 100% -> 40% -> 10% -> 0%) basierend auf den Makro-Vetos.
  * *Aktion:* Das ungenutzte `action.scaleDown` Flag in der `TradeSetupEngine.js` mit echter mathematischer Logik füllen.
