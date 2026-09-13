# Empirische Root-Cause-Analyse: Corona-Crash 2020 & Drawdown-Anomalie (-40,67 %)
**Wiedereinstiegspunkt für die nächste Session**

---

## 1. Executive Summary & Problemstellung

Im 21,8-Jahre-Stresstest (`2004 - 2026`) der **Gold-SPY Dynamic DCA Strategie** erzielte das System ein herausragendes Gesamtergebnis (**+41.425 € Alpha** gegenüber sturem SPY Buy & Hold und **+72 % Alpha** in der Finanzkrise 2008).

Dennoch zeigte die Risikokennzahl eine Auffälligkeit:
* **Maximaler Drawdown der Strategie:** `-40,67 %` am **21./23. März 2020** (Corona-Crash).
* **Vergleich SPY Buy & Hold:** `-47,90 %` (am 09.03.2009 in der Lehman-Krise).

Obwohl der Spitzenverlust im Vergleich zum reinen Aktienmarkt um über 7 Prozentpunkte gedämpft wurde, stellte sich die berechtigte Frage:  
> *„Warum ging es 2020 noch so weit runter (-40,67 %)? Sind wir zu spät raus und/oder zu spät wieder rein?“*

Die empirische Untersuchung der Handelstage im Frühjahr 2020 ([`scratch/research/strategies/InspectCorona2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/InspectCorona2020.js)) liefert den eindeutigen Befund:  
**Wir sind nicht zu spät raus, sondern am 06. März 2020 viel zu früh wieder eingestiegen – mitten in das fallende Messer!**

---

## 2. Chronologie des Corona-Crashs (Tages-Receipts)

| Datum | SPY Kurs | SPY Drawdown | Katastrophen-Matrix | Status / Signal | Was passierte im Depot? |
|:---|:---|:---|:---:|:---|:---|
| **19.02.2020** | $ 338,30 | 0,0 % (ATH) | Inaktiv | `NORMAL_DCA` | Ungestörter Normalbetrieb (100% SPY). |
| **27.02.2020** | $ 297,50 | **-12,1 %** | **AKTIV** | `EMERGENCY_HEDGE` | **Ausstieg**: SPY schließt unter SMA 200, VIX > 28. Evakuierung in **75% Gold / 25% Cash**. |
| **05.03.2020** | $ 302,50 | -10,6 % | AKTIV | `EMERGENCY_HEDGE` | Schild stabil, Gold im Plus (+1,6 % Gewinn). Depot geschützt. |
| **06.03.2020** | **$ 297,50** | **-12,1 %** | AKTIV | **`RE_ENTRY` (`DEPLOY_CASH`)** | ⚠️ **FEHLALARM!** Re-Entry Sniper feuert. Depot kauft zu **100% SPY zurück**! |
| **09.03.2020** | $ 274,20 | -18,9 % | AKTIV | `RE_ENTRY` (`DEPLOY_CASH`) | *Black Monday 1:* Depot ist wieder voll in SPY investiert. |
| **12.03.2020** | $ 248,10 | -26,7 % | AKTIV | `RE_ENTRY` (`DEPLOY_CASH`) | *Black Thursday:* SPY bricht ein, Depot stürzt ungebremst mit. |
| **16.03.2020** | $ 239,80 | -29,1 % | AKTIV | `RE_ENTRY` (`DEPLOY_CASH`) | *Black Monday 2:* VIX explodiert auf 82,7. Depot reitet Crash voll ab. |
| **23.03.2020** | **$ 222,90** | **-34,1 %** | AKTIV | `RE_ENTRY` (`DEPLOY_CASH`) | **Absoluter Tiefpunkt** (SPY bei $ 222,90). |

---

## 3. Die 3 Ursachen im Detail

### Ursache 1: Der Ausstieg (-12 % Puffer ist gewollt & strukturell)
* Am 19.02.2020 markierte SPY ein Allzeithoch bei $ 338,30. Der 200-Tage-Schnitt lag bei ca. $ 305.
* Die Ausstiegsregel verlangt: `SPY < SMA 200` **UND** `Drawdown >= 8%` **UND** `mind. 1 rote Makro-Säule`.
* Weil Corona der steilste Einbruch der Geschichte war, dauerte es nur 6 Handelstage, bis diese Schwellen am 27.02. erreicht wurden ($ 297,50 / -12,1 % DD).
* **Fazit zum Ausstieg:** Dieser ~12 %-Puffer ist systembedingt notwendig, um bei harmlosen 3-5 %-Marktrücksetzern keine teuren Fehlausstiege zu produzieren. Hier lag nicht der Fehler.

### Ursache 2: Der verfrühte Re-Entry am 06. März 2020 (Der Hauptfehler)
* Nach nur 8 Tagen im Schutzschild meldete der [`PanicCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js#L56) fälschlicherweise `status: 'CRITICAL'`:
  * VIX lag bei 41,9 ($\ge 35$).
  * CBOE-Optionsvolumen zeigte einen Spike.
  * Der 14-Tage-RSI war am 06.03. minimal höher als am ersten Panik-Tag (28.02.).
  * Der Indikator wertete dies als angebliche „Bullish Divergence / Generationen-Kaufsignal“.
* Im [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js#L166-L170):
  ```javascript
  // Prüfung auf Bottom Sniper V-Umkehr (auch vor -18% möglich)
  if (isBottomCrit) {
    state = 'RE_ENTRY';
    signal = 'DEPLOY_CASH';
  }
  ```
* In [`GoldSpyDcaStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/GoldSpyDcaStrategy.js#L60-L65) hat `DEPLOY_CASH` die **höchste Priorität** (Priorität 1, über dem Schutzschild).
* **Konsequenz:** Am 06. März 2020 wurde die Notfall-Phase beendet und 100 % des Depots bei **SPY = $ 297,50** zurückgekauft!
* **Das Desaster danach:** Vom 06. März ($ 297,50) bis zum 23. März ($ 222,90) fiel der S&P 500 um weitere **-25 %**! Da das Depot bereits wieder voll in Aktien investiert war, wurde dieser finale Ausverkauf voll absorbiert.

### Ursache 3: Der State-Machine Lock-In Effekt
* Im [`GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js#L193-L196) gab es keine Rückfall-Logik aus `RE_ENTRY`:
  Einmal ausgelöst, feuerte der Indikator kontinuierlich jeden Tag weiter `DEPLOY_CASH`, solange `isShieldActive` anstand.
* Selbst als der Markt nach dem 06. März neue dramatische Tiefs markierte und Margin Debt kollabierte, konnte das System nicht mehr zurück in `HEDGE_ACTIVE` oder `PRE_MARGIN_LOCK` wechseln.

---

## 4. Konkreter Fahrplan für die nächste Session

Um den maximalen Drawdown von `-40,67 %` auf **unter `-20 %`** zu drücken, sind folgende Anpassungen zu prüfen und umzusetzen:

1. **Mindest-Korrekturtiefe für den Bottom-Sniper (`min_bottom_drawdown_pct`):**
   * Ein Re-Entry via Panik-Kapitulation darf **erst ab einem Mindest-Drawdown von z. B. -20 % bis -25 %** ausgelöst werden.
   * Bei nur -12 % darf kein Generationen-Boden-Signal feuern, wenn die Katastrophen-Matrix zeitgleich auf Rot steht.
2. **Entkopplung oder Bestätigung der RSI-Divergenz:**
   * Eine bloße 5-Tage-RSI-Schwankung während eines Crash-Auftakts ist keine valide Boden-Divergenz. Der RSI muss erst einen echten Überverkauft-Extremwert (< 20) und eine nachhaltige Erholung zeigen.
3. **State-Machine Reset-Regel (Fail-Safe):**
   * Wenn nach einem Re-Entry-Signal ein neuer, tieferer Trendbruch erfolgt (neues Verlaufstief), muss das System wieder in den Schutzschild (`HEDGE_ACTIVE` bzw. `PRE_MARGIN_LOCK`) zurückkehren dürfen, statt im Kaufrausch gefangen zu bleiben.
4. **Validierung via Stresstest:**
   * Re-Run von [`scratch/research/strategies/GoldSpyDailyStressTest.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/GoldSpyDailyStressTest.js) zur Verifikation der neuen Drawdown-Kennzahlen.

---

## 5. Zugehörige Dateien & Receipts

* **Forschungsbericht (Root-Cause):** [`docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md`](file:///D:/GitHub/CrashRadar/docs/research/strategies/Corona2020DrawdownRootCauseAnalysis.md)
* **Live-Analyse Skripte:**
  * [`scratch/research/strategies/InspectCorona2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/InspectCorona2020.js)
  * [`scratch/research/strategies/TraceDrawdown2020.js`](file:///D:/GitHub/CrashRadar/scratch/research/strategies/TraceDrawdown2020.js)
* **Betroffene Indikatoren & Strategien:**
  * [`src/analysis/indicators/GoldSniperIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/GoldSniperIndicator.js#L165-L175)
  * [`src/analysis/indicators/PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js#L56-L60)
  * [`src/strategies/GoldSpyDcaStrategy.js`](file:///D:/GitHub/CrashRadar/src/strategies/GoldSpyDcaStrategy.js#L59-L74)
