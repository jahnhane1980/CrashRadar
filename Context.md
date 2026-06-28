
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
