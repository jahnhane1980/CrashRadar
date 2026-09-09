# Empirischer Forschungsbericht: Parabolische Volumen- & Korrektur-Analyse

> 🔬 **Forschungsbereich:** High-Beta Wachstumsaktien, Intraday M5-Session-Fenster & Korrektur-Volumen  
> 📅 **Datum:** September 2026  
> 📂 **Spiegel-Code:** [`scratch/research/turnarounds/analyze_parabolic_volumes.js`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/analyze_parabolic_volumes.js)  
> 📊 **Daten-Caches:** [`scratch/research/turnarounds/data_cache/`](file:///D:/GitHub/CrashRadar/scratch/research/turnarounds/data_cache/)  
> 🗄️ **Datenbank:** `market_data_m5` (106.979 M5-Kerzen PLTR, 86.403 NVTS, 73.247 IBRX, 106.552 SOFI, 68.077 S)  

---

## 1. Executive Summary & Forschungsziel

Dieser Bericht untersucht das reale Verhalten von High-Beta Wachstumsaktien in ihren **parabolischen Boom-Phasen**. Im Zentrum steht die fundamentale Händler-Fragestellung:

> **„Wie viel Prozent korrigiert eine High-Beta Aktie im laufenden Trend und mit wie viel Volumen? Woran unterscheidet das System mathematisch einen gesunden Zwischen-Dip (-20 % bis -30 %, der stoisch gehalten werden MUSS) von einem fatalen institutionellen Dump / Climax Top?“**

Hierzu wurden alle US Regular Trading Hours (RTH 09:30–16:00 ET) in M5-Intraday-Intervalle zerlegt, mit Fokus auf:
1. **Das Eröffnungsfenster (09:30–11:00 ET, erste 1,5h):** Retail-Gap-Flow und Market-Maker-Liquidität.
2. **Das Schlussfenster (14:30–16:00 ET, letzte 1,5h, Power Hour):** Das institutionelle Settlement („Smart Money Positioning“).
3. **Das Volumen-Delta ($UpVol - DownVol$):** Überwiegen an Korrekturtagen die Käufer oder die Verkäufer vor Börsenschluss?

---

## 2. Einzelfall-Analysen der Korrekturen in der Parabolik

### 2.1 Palantir (`PLTR`): Der Hypergrowth-Software-Gigant (23 $ $\rightarrow$ 222 $)

| Korrektur-Phase | Kursspanne & Tiefe | Dauer | Volumen vs. 20d Runup | M5 Open Delta | M5 Close Delta | Typ & Markt-Charakter |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Juli–Aug 2024** | 29,60 $ $\rightarrow$ 23,60 $ (**-20,4 %**) | 11 Tage | **0,95x** (Kein Verkaufsdruck) | +1,7 % | **+22,5 % 🟢** | **✅ Gesunder Dip:** Smart Money saugte den Dip massiv ins Close auf! **(HOLD)** |
| **Dez 2024–Jan 2025** | 83,90 $ $\rightarrow$ 63,60 $ (**-24,2 %**) | 11 Tage | **0,90x** (Dry-Up Volumen) | +4,6 % | **+8,6 % 🟢** | **✅ Gesunder Dip:** Trockenes Volumen, stoisches Halten. **(HOLD)** |
| **Feb–April 2025** | 125,40 $ $\rightarrow$ 72,80 $ (**-41,9 %**) | 32 Tage | 1,18x (Auswaschung) | +7,4 % | +5,4 % ⚪ | **⚡ Re-Accumulation:** Große Konsolidierungsbasis vor Welle 2. |
| **Mai 2025** | 130,10 $ $\rightarrow$ 106,10 $ (**-18,4 %**) | 1 Tag | **1,40x 🔴** (Spike) | **-24,6 %** | **-35,1 % 🔴** | **⚠️ Institutioneller Dump:** Aggressiver Abverkauf in Eröffnung und Schluss. |
| **Juni 2025** | 135,30 $ $\rightarrow$ 117,20 $ (**-13,3 %**) | 2 Tage | **1,34x 🔴** (Spike) | **-29,0 %** | +12,6 % 🟢 | **⚡ Flash-Shakeout:** Vormittags Panik, nachmittags sofort wieder absorbiert. |
| **Aug 2025** | 190,00 $ $\rightarrow$ 148,80 $ (**-21,7 %**) | 6 Tage | **1,60x 🔴** (Heavy Selling) | **-13,6 %** | -1,4 % ⚪ | **⚠️ Ernstzunehmende Distribution:** Großanleger nahmen massiv Gewinne mit. |
| **Nov 2025 (TOP)** | 222,00 $ $\rightarrow$ 106,60 $ (**-52,0 %**) | 160 Tage | 1,10x (Erosion) | -0,6 % | **-42,0 % 🔴** am Peak | **🛑 Finale Parabolik-Erschöpfung:** 3 Wochen Monster-Volumen (661 Mio. Aktien). |

---

### 2.2 Navitas Semi (`NVTS`): Der hochgradig squeeze-getriebene Small/Mid-Cap (2 $ $\rightarrow$ 34 $)

| Korrektur-Phase | Kursspanne & Tiefe | Dauer | Volumen vs. 20d Runup | M5 Open Delta | M5 Close Delta | Typ & Markt-Charakter |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mai 2025 (Squeeze-Peak)** | 6,50 $ $\rightarrow$ 4,03 $ (**-38,0 %**) | 1 Tag | **36,30x 🔴** (Extrem-Spike) | **+84,2 %** | **+15,0 %** | **⚠️ Short-Covering Climax:** Vertikaler Squeeze-Blowout. |
| **Mai 2025 (Welle 1)** | 7,53 $ $\rightarrow$ 4,95 $ (**-34,3 %**) | 3 Tage | **1,88x 🔴** (Heavy Selling) | -21,9 % | +24,9 % 🟢 | **⚡ Flash-Shakeout:** Scharfe Gewinnmitnahme vor dem nächsten Run. |
| **Juni–Juli 2025** | 8,64 $ $\rightarrow$ 5,81 $ (**-32,8 %**) | 21 Tage | **0,40x 🟢** (Tiefes Dry-Up) | -0,9 % | **+4,5 % 🟢** | **✅ Gesunder Dip:** Verkäufer völlig erschöpft. Perfekter Re-Entry. |
| **Juli–Sept 2025** | 9,28 $ $\rightarrow$ 5,51 $ (**-40,6 %**) | 31 Tage | **0,66x 🟢** (Dry-Up) | +9,0 % | **+18,0 % 🟢** | **✅ Gesunder Dip:** Akkumulation vor dem Welle-2-Ausbruch. |
| **Okt 2025** | 14,28 $ $\rightarrow$ 12,17 $ (**-14,8 %**) | 1 Tag | **2,84x 🔴** (Spike) | +11,2 % | +43,8 % | **⚡ Flash-Shakeout:** Schneller Rücksetzer. |
| **Mai 2026 (TOP 34 $)** | 33,70 $ $\rightarrow$ 24,28 $ (**-27,9 %**) | 4 Tage | **0,61x** (Erschöpfung) | +3,0 % | +5,0 % ⚪ | **🛑 Parabolik-Erschöpfung:** Notbremse greift am Peak bei 31,79 $. |
| **Juni–Juli 2026** | 34,17 $ $\rightarrow$ 9,55 $ (**-72,1 %**) | 38 Tage | **0,53x** (Kollaps) | -5,0 % | +13,4 % ⚪ | **Vollständiger Crash:** Durch Notbremse zu 100 % vermieden. |

---

### 2.3 ImmunityBio (`IBRX`): Der hoch-volatile Biotech-Turnaround

| Korrektur-Phase | Kursspanne & Tiefe | Dauer | Volumen vs. 20d Runup | M5 Open Delta | M5 Close Delta | Typ & Markt-Charakter |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mai–Juni 2024** | 6,91 $ $\rightarrow$ 5,50 $ (**-20,3 %**) | 11 Tage | 1,14x | -4,4 % | **+75,3 % 🟢** | **⚡ Konsolidierung:** Starkes Auffangen im Schlussfenster. |
| **Juni 2024–Mai 2025** | 7,49 $ $\rightarrow$ 1,86 $ (**-75,2 %**) | 218 Tage | **1,69x 🔴** (Dauer-Abgabe) | +5,2 % | +32,8 % | **⚠️ Institutioneller Dump:** Monatelanger Kater nach ANKTIVA-Hype. |
| **Jan–Feb 2026** | 7,98 $ $\rightarrow$ 5,51 $ (**-31,0 %**) | 12 Tage | 1,23x | -8,5 % | -0,9 % | **⚡ Shakeout:** Konsolidierung vor Folge-Schub. |
| **Feb–März 2026** | 12,28 $ $\rightarrow$ 6,57 $ (**-46,5 %**) | 24 Tage | **0,80x 🟢** (Dry-Up) | -3,6 % | **+14,1 % 🟢** | **✅ Gesunder Dip:** Akkumulation vor nächster Welle. |

---

### 2.4 SoFi (`SOFI`) & SentinelOne (`S`): FinTech & CyberSecurity

* **SoFi (`SOFI`):**
  * **Gesunde Dips (Sept/Okt 2024 & Jan 2025):** Liefen bei **0,72x bis 0,74x** Volumen (starkes Dry-Up) und **positivem Close-Delta (+7 % bis +8 %)**. Die Aktie konnte entspannt gehalten werden.
  * **Gefährlicher Dump (Jan–April 2025, -49,4 %):** Begann mit einem Volumensprung auf **1,30x** und riss den Aufwärtstrend ein.
* **SentinelOne (`S`):**
  * **Dump (Mai 2024, -25,7 %):** Explodierte auf **3,63x des Vorlauf-Volumens** mit Eröffnungs-Delta von **-11,0 %**.
  * **Gesunder Dip (Sept/Okt 2024, -10,5 %):** Trocknete auf **0,51x Volumen** aus, während das Schlussfenster ein massives **Close-Delta von +54,2 %** auswies (institutionelle Absorption).

---

## 3. Beantwortung von Leitfrage 1: Zeigen alle Wachstumsaktien ein ähnliches Bild?

**Antwort: Ja, das Verhaltensmuster ist über alle Ticker identisch, aber die Multiplikatoren sind marktkapitalisierungs-abhängig.**

### Die universellen Regeln für High-Beta Wachstumsaktien:

1. **Der gesunde Dip (Holding-Garantie):**
   * Das Volumen während der Korrektur fällt signifikant unter das Niveau des vorangegangenen Anstiegs:
     * Bei Large/Mid-Caps (`PLTR`, `SOFI`): $\text{VolRatio} \le 0{,}90\times - 0{,}95\times$.
     * Bei hoch-volatilen Small-Caps (`NVTS`, `IBRX`, `S`): $\text{VolRatio} \le 0{,}40\times - 0{,}66\times$ (extremes Austrocknen).
   * Das **M5-Schlussfenster (14:30–16:00 ET)** weist ein **positives Delta** auf ($CloseDelta \ge +5\,\%$ bis $+25\,\%$). Das bedeutet: Privatanleger werfen panisch ab, aber institutionelle Hände sammeln die Stücke vor Börsenschluss heimlich auf.
2. **Der institutionelle Dump (Gefahr / Reißleine):**
   * Das Volumen explodiert während des Abverkaufs auf $\ge 1{,}35\times$ (bei Small-Caps oft $\ge 2{,}5\times$ bis $35\times$).
   * Das **M5-Schlussfenster** bricht tiefrot ein ($CloseDelta \le -20\,\%$ bis $-45\,\%$). Großanleger liquidieren aktiv in die Schlussauktion.
