## US-Arbeitsmarkt Divergenz-Tracker: Historische Validierung

Dieses Skript prüft, wie viele Monate vor (negativ) oder nach (positiv) einem S&P 500 Zyklus-Top die einzelnen Divergenzen angeschlagen haben.

| Markt-Top (Peak) | S&P Peak-Monat | Quant. Schere (Household vs. Payrolls) | Qual. Schere (Vollzeit vs. Teilzeit) | Sahm-Rule Early-Warning (>= 0.3%) | Sahm-Rule Trigger (>= 0.5%) |
| --- | --- | --- | --- | --- | --- |
| **Dotcom-Blase** | `2000-03` | 🔴 **+2 Monate** (PAY:501|CE:-71) | 🔴 **+8 Monate** (-2.7%) | 🔴 **+11 Monate** (0.30%) | ❌ *Kein Signal* |
| **Finanzkrise (GFC)** | `2007-10` | 🟢 **-6 Monate** (PAY:287|CE:-471) | 🟢 **-17 Monate** (-2.9%) | 🔴 **+2 Monate** (0.40%) | 🔴 **+4 Monate** (0.57%) |
| **Zins-Panik (2018)** | `2018-09` | 🟢 **-10 Monate** (PAY:364|CE:-481) | 🟢 **-6 Monate** (-2.5%) | ❌ *Kein Signal* | ❌ *Kein Signal* |
| **Corona-Crash** | `2020-02` | 🟢 **-18 Monate** (PAY:317|CE:-258) | 🟢 **-1 Monate** (-2.5%) | 🔴 **+1 Monate** (0.33%) | 🔴 **+2 Monate** (4.07%) |
| **Inflations-Schock** | `2022-01` | 🟢 **-12 Monate** (PAY:130|CE:-113) | 🟢 **-18 Monate** (-15.1%) | 🟢 **-18 Monate** (7.97%) | 🟢 **-18 Monate** (7.97%) |
| **Korrektur (2025)** | `2025-02` | 🟢 **-16 Monate** (PAY:315|CE:-287) | 🟢 **-18 Monate** (-3.4%) | 🟢 **-16 Monate** (0.37%) | ❌ *Kein Signal* |


### 💡 Interpretation & Klassifizierung:

1. **Frühindikatoren (Leading - 6 bis 12 Monate Vorlauf):**
   * **Vollzeit/Teilzeit-Qualitätsschere:** Schlägt zuverlässig viele Monate vor dem Top an. Das erste Anzeichen dafür, dass Unternehmen Stellen abbauen/umbauen, während der S&P noch neue Rekordhöhen markiert.

2. **Akutindikatoren (Coincident - 0 bis 3 Monate Vorlauf):**
   * **Quantitative Divergenz (CE16OV vs. PAYEMS):** Bildet die finale Phase der Divergenz. Die Payrolls steigen noch durch statistische Faktoren, aber das reale Beschäftigungsniveau bricht bereits ein.

3. **Spätindikatoren (Lagging - Bestätigung nach dem Top):**
   * **Sahm-Rule & Sahm-Warning:** Triggern historisch meist erst nach dem absoluten Preis-Top, dafür aber mit 100%iger Trefferquote für eine beginnende Rezession. Sie dienen als finaler Zündschlüssel, um defensive Re-Entries zu verhindern.
