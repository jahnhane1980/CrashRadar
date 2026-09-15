# ADR-011: Dual-Gatekeeper-Reentry-These (Systematischer Wiedereinstieg nach Liquiditäts-Crashes)

* **Status:** Entwurf / Bereit für Testaufbau  
* **Datum:** 2026-09-15  
* **Autor:** CrashRadar Intelligence Engine (Modus Code-Buddy)  
* **Bereich:** [`docs/research/DailyPortfolioCompass/`](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/)  
* **Geplantes Test-Skript:** `scratch/research/DailyPortfolioCompass/test_adr011_dual_gatekeeper_reentry.js`  
* **Geplanter Ergebnis-Datensatz:** `scratch/research/DailyPortfolioCompass/adr011_test_results.json`  
* **Referenz-Komponenten:** [`DailyPortfolioCompass.js`](file:///D:/GitHub/CrashRadar/src/analysis/DailyPortfolioCompass.js), [`LiquiditySensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/LiquiditySensorHub.js), [`GoldilocksSensorHub.js`](file:///D:/GitHub/CrashRadar/src/signals/hubs/GoldilocksSensorHub.js), [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js), [`Corona2020DrawdownRootCauseAnalysis.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md)

---

## 1. Kontext & Ausgangsbeobachtung

In der empirischen Root-Cause-Analyse der Drawdown-Anomalie ([`Corona2020DrawdownRootCauseAnalysis.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md)) wurde der schwerwiegendste historische Schwachpunkt der CrashRadar Signal-Engine aufgedeckt:

1. **Der Ausstieg am 27.02.2020:** War strukturell exzellent (Depot ging bei $-12\%$ Drawdown vollständig in Cash/Gold).
2. **Die Fehlauslösung am 06.03.2020:** Nach nur 8 Tagen generierte der [`PanicCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) durch einen extremen VIX-Spike ein voreiliges Bodenkaufs-Signal (*Capitulation Bottom*).
3. **Die fatale Konsequenz:** Das Depot stieg mit $100\%$ Hebel wieder in den S&P 500 ein – genau am Vorabend des historischen $-25\%$-Kollapses bis zum 23. März 2020. Dies trieb den Allzeit-Max-Drawdown der Strategie auf **$-40.67\%$**.

**Die Erkenntnis aus [ADR-004](file:///D:/GitHub/CrashRadar/docs/research/DailyPortfolioCompass/ADR-004-Dual-Gatekeeper-These.md):**  
In ADR-004 wurde bewiesen, dass der Dual-Gatekeeper (`LiquiditySensorHub.status === 'OK'` + `GoldilocksSensorHub !== 'RECESSION_CRACK'`) 100 % aller Bärenmarkt-Fallen aus 2022 eliminieren konnte. 

**Die offene Frage:**  
Kann genau diese Dual-Gatekeeper-Logik als **chirurgische Re-Entry-Bremse** institutionalisiert werden, um voreilige Einstiege in fallende Messer während akuter Notenbank- und Liquiditätskrisen dauerhaft zu verhindern?

---

## 2. Entscheidung & Formulierung der Forschungs-Hypothese (Ohne Bias)

> ### 🎯 Haupt-Hypothese:
> **„Teil A (Das Re-Entry-Veto bei Liquiditäts-Kollaps):**  
> Ein rein volatilitätsbasiertes Panik- oder Kapitulationssignal (`PanicCapitulationIndicator` oder VIX-Spike $> 30$) darf **niemals** zu einem sofortigen Re-Entry in Aktien führen, solange die Liquidität im Zustand `CRITICAL` verharrt (`LiquiditySensorHub.status === 'CRITICAL'`) ODER die Makro-Schadenslage `RECESSION_CRACK` aktiv ist. In einem solchen Regime führen sofortige Re-Entries in $> 70\%$ der Fälle zu gravierenden Folge-Drawdowns ($> -10\%$).  
>  
> **Teil B (Die 2-Stufen-Wiedereinstiegs-Doktrin):**  
> Ein sicherer Wiedereinstieg nach einem Crash-Ausstieg erfolgt erst dann, wenn:  
> 1. Die Notenbank-Liquidität durch massive Stützungsmaßnahmen von `CRITICAL` auf `NEUTRAL` oder `OK` dreht (wie am 23.03.2020 durch Fed QE Unlimited), **ODER**  
> 2. Der Markt nach dem Kapitulations-Tief eine technische Trend-Stabilisierung bestätigt (z.B. Schlusskurs über dem EMA-21).  
>  
> Durch diese 2-Stufen-Gatekeeper-Regel wird der maximale historische Portfolio-Drawdown (2004–2026) von $-40.67\%$ auf unter $-22.0\%$ halbiert, während die langfristige Rebound-Partizipation zu $> 90\%$ erhalten bleibt.“

### Null-Hypothese ($H_0$):
Das Hinzufügen von Liquiditäts- und Trend-Gatekeepern beim Re-Entry verzögert den Einstieg so stark, dass die Performance durch verpasste Rebounds einbricht und der risikobereinigte Ertrag (Calmar/Sharpe) sinkt.

### Alternativ-Hypothese ($H_1$):
Das Re-Entry-Gatekeeper-System eliminiert die katastrophalen Fehlschläge (März 2020, Lehman Oktober 2008) vollständig und steigert das Calmar-Ratio der Gesamtstrategie signifikant.

---

## 3. Test-Design & Validierungs-Kriterien (2004–2026)

### A. Testkorpus
* **Historischer Zeitraum:** 2004–2026 (7.760 Handelstage).
* **Test-Umgebung:** Reale Simulation auf der [`PortfolioStrategyEngine.js`](file:///D:/GitHub/CrashRadar/src/strategies/PortfolioStrategyEngine.js) und [`GoldSpyDcaStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/GoldSpyDcaStrategy.js).
* **Benchmark:** Aktuelle Benchmark-Performance (Endkapital: 89.851 €, Max Drawdown: -40.67 %).

### B. Untersuchte historische Krisen-Episoden
1. **Lehman Brothers Crash (Herbst 2008):** Mehrfache VIX-Panikspikes zwischen September und November 2008 vor dem finalen Tief im März 2009.
2. **Corona-Crash (Februar / März 2020):** Der fatale Re-Entry am 06.03.2020 vs. verzögerter Einstieg am 24./25.03.2020.
3. **Zins-Bärenmarkt (2022):** 4 VIX-Spikes während fortlaufendem QT und Zinsanhebungen.

### C. Erfolgs- & Falsifikations-Kriterien
* **Verifikation:**
  1. Der Max Drawdown im Corona-Crash 2020 sinkt von **$-40.67\%$ auf unter $-22.0\%$**.
  2. Der finale Gesamtertrag der Strategie (2004–2026) bleibt mindestens stabil oder steigt durch Vermeidung des $-25\%$-Zwischenverlusts.
  3. Das Calmar-Ratio (Annualisierter Ertrag / Max Drawdown) steigt um mindestens **+30 %**.
* **Falsifikation:** Wenn der spätere Re-Entry dazu führt, dass der Boden der Rallye so weit verpasst wird, dass das Endkapital um mehr als $-10.000 €$ unter den Benchmark-Wert fällt.

---

## 4. Geplante Skript-Architektur

Das Skript `test_adr011_dual_gatekeeper_reentry.js` wird:
1. Die originale `PortfolioStrategyEngine` mit der `GoldSpyDcaStrategy` über die 21,8 Jahre laufen lassen.
2. Einen Gatekeeper-Modus aktivieren: Vor jedem Re-Entry nach `EXIT_TO_CASH` Prüfung von `LiquiditySensorHub.status` und `SPY >= EMA21`.
3. Direkter Vergleich der Equity-Kurven (Tag für Tag im März 2020 und Oktober 2008).
4. Persistierung der Performance-Metriken in `adr011_test_results.json`.
