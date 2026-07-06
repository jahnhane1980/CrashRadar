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
4. **Notification Separation & Config-Binding**:
   - Festplatten-Zugriffe (`fs.readFileSync`) wurden restlos aus der Engine entfernt (Dependency Injection).
   - Formatierung, UI-Logik und Push-Payload-Generierung (inkl. Spam-Schutz) wurden in den neuen `NotificationManager` ausgelagert.
   - Die `IndicatorEngine` arbeitet jetzt nur noch als Wrapper, 100% Test-Coverage für den neuen Manager.
5. **Core-Klassen Härtetests (100% Coverage)**:
   - `MathUtils.js`: Extrem-Szenarien für SMA, RSI, Drawdowns, Volume.
   - `YahooFinanceFetchAdapter.js`: Optionen-Aggregations-Wahnsinn (Tie-Breaks, Gaps, Date-Chaos) fehlerfrei implementiert.
   - `DefaultFeatureBuilder.js` (ML): 300-Tage Chaos-Arrays mit Gaps, Sinus-Wellen und Volume-Climax-Szenarien (Z-Score & SMA-Crosses) zu 100% abgedeckt.

---

## Was noch zu tun ist (Offen)

### 1. Core-Services Testabdeckung (Lücken füllen)
Die Architektur-Analyse hat ergeben, dass noch Lücken in zentralen Services bestehen. Diese werden auf 100% gebracht (mittels Edge-Cases, chaotischen Testdaten und Fallbacks).
- [x] `RegimeService.js` (Aktuell ~74% Coverage, benötigt Härtetests für fehlende Logik-Blöcke) -> 100% Abdeckung erreicht!

### 2. Indikatoren Testabdeckung (Testsuite vervollständigen)
Jeder verbleibende Indikator muss einzeln und sequenziell mit einer eigenen Testdatei abgedeckt werden. 

**Regeln für das Testing:**
- Es darf nicht nur der Happy Path getestet werden! Auch alle Edge Cases müssen zwingend abgedeckt werden.
- Die Testdaten müssen die Algorithmen und die Logik aktiv herausfordern (z.B. hohe Volatilität, versteckte Allzeithochs mitten im Array, mathematische Extreme wie Division durch Null, exaktes Treffen der Threshold-Grenzen).
- Das Ziel sind immer 100% Test-Coverage. Wir versuchen so nah wie möglich an dieses Ziel heranzukommen.
- Keine Autokorrektur der Test-Ergebnisse (Indikatoren-Code bleibt unangetastet, Ergebnisse werden analysiert).

**Offene Indikatoren (Verbleibende TODOs):**
- [x] CryptoPortfolioExitIndicator -> 100% Abdeckung!
- [x] GdxBuyingClimaxIndicator -> 100% Abdeckung erreicht!
- [x] GdxGoldDivergenceIndicator -> 100% Abdeckung erreicht!
- [x] GdxSellingClimaxIndicator -> 100% Abdeckung erreicht!
- [x] GoldCapitulationIndicator -> 100% Abdeckung erreicht!
- [x] GoldVolumeClimaxIndicator -> 100% Abdeckung erreicht!
- [x] HygDivergenceIndicator -> 100% Abdeckung erreicht!
- [x] MarginDebtIndicator -> 100% Abdeckung erreicht!
- [x] MarketPanicCapitulationIndicator -> 100% Abdeckung erreicht!
- [x] MaturityWallIndicator -> 100% Abdeckung erreicht!
- [x] MlRegimeRadarBtcIndicator -> 100% Abdeckung erreicht!
- [x] MlRegimeRadarCryptoIndicator -> 100% Abdeckung erreicht!
- [ ] MlRegimeRadarMacroIndicator
- [ ] MlRegimeRadarQqqIndicator
- [ ] MlRegimeRadarSpyIndicator
- [ ] NfciIndicator
- [ ] PanicCapitulationIndicator
- [ ] RateShockIndicator
- [ ] RedAlertIndicator
- [ ] SahmRuleIndicator
- [ ] TechCycleRadarIndicator
- [ ] TgaIndicator
- [ ] VixSpikeCrushIndicator
- [ ] YieldCurveIndicator

### 3. Domain Splitting (Aufspaltung der Core-Engines)
Aufspaltung der verbleibenden, sauberen Indikatoren-Auswertung auf zwei neue Kern-Klassen.
* **Prototyp (Code-Vorlage):** Die Architektur-Aufteilung in zwei Engines wurde bereits erfolgreich in einer Sandbox bewiesen. Als Referenz dient: `scratch/performance/GoldGDXEngine.js`.
* **Die zwei neuen Engines:**
  - `MacroRegimeEngine`: Für übergeordnete Makro- und Liquiditäts-Analysen (Zyklus-Erkennung, Crash-Typ Klassifizierung, Catastrophe Stop). Gibt einen globalen Wetterbericht (`State`) aus.
  - `TradeSetupEngine`: Für kurzfristige, tagesaktuelle Setups und Signale (Dynamischer Einstieg, Gewinnmitnahmen, Divergenz-Tracking). Arbeitet reaktiv auf dem Zustand der MacroRegimeEngine und gibt konkrete `TradeActions` (Buy/Sell inkl. Sizing) aus.

---
*Letztes Update: Core-Klassen Härtetests (FetchAdapter, FeatureBuilder) komplett abgeschlossen. Fokus liegt nun auf RegimeService.*
