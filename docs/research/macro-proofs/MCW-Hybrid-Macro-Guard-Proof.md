# Empirischer Proof: Makro-Guard Matrix-Audit auf Muzzled Cathie Wood (2020 – 2026)

Dieses Forschungsdokument untersucht empirisch, wie sich bestehende Indikatoren aus dem CrashRadar-Arsenal – namentlich [`FiscalFedLiquidityIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/FiscalFedLiquidityIndicator.js) und [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) – auf die Gesamt-Performance der **Muzzled Cathie Wood (MCW) Strategie** auswirken.

* 💻 **Zugehöriges Test-Skript:** [`scratch/research/macro-proofs/test_mcw_hybrid_macro_guard.js`](file:///D:/GitHub/CrashRadar/scratch/research/macro-proofs/test_mcw_hybrid_macro_guard.js)
* ♟️ **Strategie-Referenz:** [`Muzzled-Cathie-Wood.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/Muzzled-Cathie-Wood.md)
* 📊 **Datenbasis:** 1.678 Handelstage (2020-01-01 bis 2026-09-04) aus TiDB Cloud & SEC 10-Q Cache.

---

## 1. Die Fragestellung & Hypothesen

1. **Hypothese A (Akuter Banken-Schock):** Wenn die Federal Reserve im Notkredit-Fenster (`EmergencyBorrowing` / Discount Window / BTFP) innerhalb von 28 Tagen mehr als $+15\text{ Mrd. \$}$ bereitstellen muss, sollte das Portfolio sofort in den Notfall-Hedge (50 % Gold / 50 % Cash) evakuiert werden, ohne auf die 8-Wochen-Verzögerung der Net-Fed-Liquidity-Formel zu warten.
2. **Hypothese B (Generationen-Boden-Sniper):** Befindet sich das Portfolio im Notfall-Schutzschirm und schlägt der [`PanicCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) an ($\text{VIX} \ge 35$, CBOE SPY Call/Put Spikes, RSI Bullish Divergence), wird der Re-Entry vorzeitig freigegeben, anstatt monatelang zu warten, bis das 8-Wochen-Delta der Net Liquidity wieder $\ge 0,0\,\%$ erreicht.

---

## 2. Die empirischen Matrix-Ergebnisse

Simulations-Rahmen: 10.000 € Startkapital, 150 € monatlicher Sparplan (Gesamteinzahlung 22.000 €), 60 % Tech / 40 % Krypto, S&P 500 Mutterschiff, SEC 10-Q Flag-System und 100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash.

| Konfiguration | Endwert (€) | Nettogewinn (€) | Nettorendite | Max Drawdown | Delta vs. Baseline |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Baseline Master V3 (Nur 8W-NetLiq)** | 277.102,26 € | 255.102,26 € | +1.159,56 % | -38,01 % | Referenz |
| **2. NetLiq + Panic Sniper (Re-Entry)** | **304.991,89 €** | **282.991,89 €** | **+1.286,33 %** | **-37,93 %** | **+27.889,63 € (+126,77 %-Pkt.)** 🚀 |
| **3. NetLiq + FiscalFed Notkredite (Exit)** | 204.380,66 € | 182.380,66 € | +829,00 % | -37,12 % | **-72.721,60 € (-330,56 %-Pkt.)** ❌ |
| **4. Full Hybrid (NetLiq + Fiscal + Sniper)**| 225.577,07 € | 203.577,07 € | +925,35 % | -37,38 % | **-51.525,19 € (-234,21 %-Pkt.)** ❌ |

---

## 3. Die anatomischen Ursachen der Ergebnisse

### Warum FiscalFed Emergency Borrowing als Exit für Tech-Growth scheitert (-72.721 €)
1. **Die Zins-Fluchtburg-Dynamik (SVB März 2023):**  
   Als im März 2023 die Silicon Valley Bank kollabierte und Notkredite um fast $+200\text{ Mrd. \$}$ nach oben schossen, brach an den Anleihemärkten eine brutale Flucht in sichere Staatsanleihen aus. Die 10-jährigen Renditen stürzten von über $4,0\,\%$ auf $3,4\,\%$ ab.  
   Für Tech-Wachstumsaktien (insb. Big Tech & AI wie Nvidia) wirkte dieser Zinssturz wie Kerosin. Genau in diesem Moment evakuierte die FiscalFed-Bedingung jedoch das gesamte Portfolio für 4 Wochen in Gold und Cash. Wer im März 2023 wegen Bankenstress aus Tech floh, verpasste den Start der größten AI-Rallye des Jahrzehnts.
2. **Whipsaw-Kaskade im Corona-Crash 2020:**  
   Im März 2020 schossen die Notkredite der Fed schlagartig nach oben und blieben wochenlang erhöht. Das System stieg am 09.03. aus, sprang im April erneut in den Hedge und verpasste dadurch den historischen V-förmigen Rebound des Nasdaq im April 2020.

### Warum der Panic-Capitulation-Sniper als Re-Entry triumphiert (+27.889 €)
1. **Verkürzung der Sidelining-Zeit:**  
   Die 8-Wochen-Net-Liquidity-Regel benötigt nach einem Bärenmarkt typischerweise 6 bis 10 Wochen, bis der rollierende 8-Wochen-Vergleich wieder über $0,0\,\%$ klettert. Zu diesem Zeitpunkt haben Tech-Aktien oft schon die ersten $+20\,\%$ bis $+40\,\%$ der Bodenrallye absolviert.
2. **Punktgenaues Timing am Schmerzmaximum:**  
   Wenn der VIX über 35 schießt und eine bullische RSI-Divergenz vorliegt, ist der Verkaufsdruck der schwachen Hände mathematisch erschöpft. Indem das System diesen Tag als Re-Entry-Freigabe nutzt, kauft das Mutterschiff direkt am Wendepunkt ein und stellt frisches Kapital für neue Stage-2-Ausbrüche zu Tiefstpreisen bereit.

---

## 4. Fazit & Empfehlung

* **FiscalFed Emergency Borrowing** gehört **nicht** in den Ausstiegs-Filter von Wachstums- und Tech-Portfolios.
* Der **[`PanicCapitulationIndicator`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js)** ist hingegen eine hocheffektive **Re-Entry-Erweiterung** für den bestehenden Druckenmiller-Schutzschirm, der das Endergebnis von **277.102 € auf 304.991 € (+1.286,33 %)** steigert.
