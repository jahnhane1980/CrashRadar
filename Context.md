# These & Recherche: "Der Bullenmarkt stirbt mit dem letzten Bären"

## Die Kern-These
Historisch gesehen enden Bullenmärkte nicht aus Angst, sondern aus absoluter Euphorie und Gier ("Blow-off Top"). Ein Markt toppt erst dann, wenn selbst die hartnäckigsten Bären (Pessimisten) kapitulieren, ihre Short-Positionen auflösen und aus FOMO (Fear Of Missing Out) anfangen, auf steigende Kurse zu wetten. Wenn keine Absicherung (Hedging) mehr im Markt existiert, entfällt der "Käufer-Puffer" für Rücksetzer, und der Markt wird extrem anfällig für einen Crash.

## Die Metriken zur Messung der Bären-Kapitulation

Um diese Euphorie und Kapitulation quantifizierbar zu machen, haben wir folgende Metriken und Datenquellen definiert:

### 1. Daily Short Volume (Die Kapitulation der Leerverkäufer)
* **Konzept:** Wir messen nicht das langsame "Short Interest" (welches nur 14-tägig erscheint), sondern das tägliche "Short Volume". Wenn das Short Volume massiv abnimmt, traut sich niemand mehr, gegen den Markt zu wetten.
* **Fokus-Assets:** Wir betrachten nicht nur den Gesamtmarkt (**SPY**, **QQQ**), sondern explizit Hype-Sektoren wie Halbleiter (**SMH**). Wenn selbst beim SMH (Nvidia, TSMC) das Short-Volumen auf ein Rekordtief fällt, ist die Spekulation maximal ausgereizt.
* **Datenquelle:** FINRA "Reg SHO" Daily Files (kostenlose, tägliche Off-Exchange Volumen-Daten).

### 2. Put/Call Ratio (PCR) (Die Kapitulation der Absicherer)
* **Konzept:** Das Verhältnis von gekauften Put-Optionen (Wetten auf fallende Kurse) zu Call-Optionen (Wetten auf steigende Kurse). Fällt das PCR auf extreme Tiefststände (z.B. < 0.6), badet der Markt in Calls. Die Bären sind ausgestorben.
* **Datenquelle:** CBOE Total Market PCR (oder Equity PCR).
* **⚠️ Daten-Problem (Erkenntnis):** Wir haben aktuell keine historischen PCR-Daten. Der anvisierte CBOE-Endpunkt (`Cboe_Daily_Market_Statistics.csv`) liefert für historische Abfragen in die Vergangenheit konstant einen `403 Forbidden` Fehler. Offenbar stellt die CBOE dort nur noch den tagesaktuellen Snapshot bereit.

### 3. SKEW Index (Der Preis für Tail-Risk)
* **Konzept:** Der CBOE SKEW Index misst die Kosten für "Out-of-the-Money" Puts (Wetten auf einen schwarzen Schwan / Crash) im Vergleich zu Calls. 
* **Wichtige Korrektur (Nach Analyse):** Entgegen der anfänglichen Annahme ("niedriger SKEW = Sorglosigkeit") zeigt die Datenrealität das Gegenteil! Vor fast allen großen Crashs seit 2013 war der SKEW **extrem hoch** (> 145). Im absoluten Hype kaufen Smart Money und Institutionen panisch teure Crash-Versicherungen. Ein extrem hoher SKEW im Bullenmarkt ist das eigentliche Warnsignal.
* **Fokus-Asset:** `^SKEW`
* **Datenquelle:** Yahoo Finance.

## Aktueller Projektstatus & Fahrplan
* **Status:** Analyse-Phase abgeschlossen, Indikator-Logik ist vollständig in der `IndicatorEngine` implementiert. Fokus liegt nun auf dem Notification-System und Daten-Vollständigkeit.
* **Nächste Schritte:** 
  - [ ] 1. **TODO: Historischen PCR-Download abschließen.** Das "Safe Mode" Skript für den CBOE Download (`scratch/downloadHistoricalPcr.js`) läuft im Hintergrund. Wir müssen prüfen, ob die `pcr.csv` vollständig die letzten Jahre lückenlos abdeckt.
  - [ ] 2. **TODO: Dynamisches Benachrichtigungssystem & Daily Status:**
      * **Konfiguration:** Die Zuordnung der Indikatoren zu bestimmten Asset-Klassen (z.B. GOLD, CRYPTO, MARKET, MACRO) soll *von außen* konfigurierbar gemacht werden (z.B. per JSON-Config-Datei) und nicht hardgecodet in der Engine stehen.
      * **Warnungs-Trennung:** `IndicatorEngine.getAlerts()` umbauen, sodass Warnungen nach diesen konfigurierten Asset-Klassen getrennt gruppiert zurückgegeben werden.
      * **Visuelles Push-Design:** Den `NtfyService` so nutzen, dass er separate Benachrichtigungen pro Asset-Klasse inklusive spezifischer Emojis/Tags (z.B. 🪙, ₿, 🚨) sendet.
      * **Daily Status:** Einen zusammenfassenden, täglichen Bericht (Daily Status Report) bauen, der z.B. nach Marktschluss einmalig versendet wird.

## Diskrepanzen zwischen Analyse (Theorie) und Code (Implementierung)
Bei einem Abgleich zwischen `docs/Analyse.md` und `IndicatorEngine.js` wurden folgende Lücken festgestellt, die behoben werden müssen:
1. **Fehlende Krypto-Indikatoren (Höchste Prio):** Die Krypto-Indikatoren (Net Liquidity, BTC Volume Climax, und MSTR/COIN Zyklus-Divergenzen) sind ausführlich in der Doku beschrieben, fehlen aber komplett im Code der `IndicatorEngine`. Dies blockiert Krypto-spezifische Alarme.
2. **Maturity Wall Schwellenwerte:** Laut Doku ist `>15%` ein "Roter Alarm". Der Code definiert `15%` jedoch nur als Warning und `21%` als Critical. Die Doku muss an die reale Adaption (21%) angepasst werden oder der Code verschärft werden.
3. **Globale Liquidität (EZB Bilanz):** Wird in der Doku als Frühindikator gelistet, ist aber im Code nicht implementiert.

* **Nächste Schritte (Erweiterung):**
  - [ ] 3. **TODO: Code & Doku synchronisieren:** Implementierung der fehlenden BTC- und Proxy-Indikatoren in die `IndicatorEngine`, um das geplante Krypto-Benachrichtigungssystem zu ermöglichen, sowie Angleichung der Schwellenwerte (Maturity Wall).
