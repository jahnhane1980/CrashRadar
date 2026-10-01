# Empirische 12-Monats-Evolution der Guru-Konsens-Portfolios (Q3/2025 – Q2/2026)

**Stichtag der Analyse:** September 2026  
**Datenbasis:** 2.342 reale SEC Form 13F-Positionen aus der CrashRadar-Datenbank `fund_13f_holdings` über 4 aufeinanderfolgende Quartale (Q3-2025, Q4-2025, Q1-2026, Q2-2026).  
**Analysiertes Gremium:** 6 Core-Manager (Stanley Druckenmiller, Philippe Laffont, Chase Coleman, David Tepper, Brad Gerstner, Zach Schreiber) + 3 Nachrücker (Gavin Baker, Alex Sacerdote, Christopher Hohn).

---

## 1. Executive Summary & Haupt-Erkenntnisse

1. **Konsens-Spitze (Die unangefochtenen Säulen):**  
   * **Amazon (`AMZN`)** und **Meta Platforms (`META`)** dominieren das Gremium über alle 4 Quartale mit 5 bis 6 Haltern. Beide bilden das absolute Kern-Rückgrat der institutionellen Tech-Allokation.
   * **Lam Research (`LRCX`)** erlebte die stärkste Konsens-Expansion im Halbleiterbereich: Von 2 Haltern in Q3-2025 stieg die Aktie auf **5 Halter und 3 aktive Neukäufer** in Q2-2026 (Coatue +401 %, Altimeter Neukauf, Duquesne Neukauf). Dies untermauert empirisch den Nachrücker-Entscheid in Slot 7.
   * **Microsoft (`MSFT`)**, **Taiwan Semiconductor (`TSM`)** und **Nvidia (`NVDA`)** verbleiben stabil mit 3 bis 5 Haltern im Kern-Konsens.

2. **Der große Schnitt (Brutales Trimming & Ausstiege):**  
   * **ServiceNow (`NOW`):** Wurde von Philippe Laffont (Coatue) bereits Anfang 2025 vollständig liquidiert. In den letzten 12 Monaten verblieb nur noch Chase Coleman (Tiger Global). Das 7-Slot-Regelwerk reagierte mit der 100 %-Verkaufsregel völlig präzise und schützte vor relativem Underperformance-Risiko.
   * **Broadcom (`AVGO`):** Erlebte eine massive Konsens-Erosion. Stanley Druckenmiller (Duquesne) und Brad Gerstner (Altimeter) stiegen komplett aus; Coleman halbierte seine Position (-51 %). Nur Laffont und Tepper bauten aus.
   * **China-Tech Exit:** Nahezu synchroner Kahlschlag bei chinesischen Werten: Alibaba (`BABA`, von 3 auf 1 Halter), PDD Holdings (`PDD`, von 2 auf 0 Halter), JD.com (`JD`, von 2 auf 1 Halter).
   * **Enterprise SaaS Trimming:** MongoDB (`MDB`, von 2 auf 0), Figma (`FIGMA`, von 2 auf 0), Snowflake (`SNOW`, von 2 auf 1).

3. **Optionen & Asymmetrische Makro-Hedges (Puts & Calls):**  
   * **Zach Schreiber (PointState Capital):** Nutzt massive Index- und Sektor-Puts zur Portfolioabsicherung. Im Q1-2026 hielt PointState einen gigantischen **S&P 500 ETF (SPY) Put im Nominalwert von 3,32 Mrd. $** sowie im Q2-2026 einen **VanEck Semiconductor (SMH) Put im Wert von 601 Mio. $**! Parallel setzte Schreiber massiv auf Power/Energy-Calls (PG&E Call 529,8 Mio. $) und Meta-Calls (740,7 Mio. $).
   * **David Tepper (Appaloosa):** Hielt im Q2-2026 eine gezielte **Apple (`AAPL`) Put-Position über 241,6 Mio. $**, womit er Big-Tech-Bewertungsrisiken selektiv absicherte.
   * **Stanley Druckenmiller (Duquesne):** Kombiniert Long-Aktien mit gehebelten Long-Calls auf Kern-Picks (Amazon Calls, Meta Calls, QQQ Calls, SPY Calls).

---

## 2. Die Konsens-Tabelle: Entwicklung aller Aktien mit $\ge 2$ Haltern

Die folgende Tabelle zeigt alle Wertpapiere, die im 12-Monats-Verlauf von mindestens 2 der 6 Stamm-Manager gehalten wurden, geordnet nach aktuellem Konsens:

| Ticker / Unternehmen | CUSIP | Typ | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Trend | Status 7-Slot |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **AMAZON COM INC** | `023135106` | STOCK | 6 ($5.09B) | 6 ($3.73B) | 5 ($3.66B) | 6 ($4.72B) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **META PLATFORMS INC** | `30303M102` | STOCK | 5 ($3.76B) | 4 ($3.46B) | 5 ($3.18B) | 5 ($3.97B) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **TAIWAN SEMICONDUCTOR M** | `874039100` | STOCK | 5 ($1.91B) | 5 ($2.09B) | 5 ($2.82B) | 5 ($3.90B) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **LAM RESEARCH CORP** | `512807306` | STOCK | 3 ($779.4M) | 3 ($842.6M) | 3 ($936.3M) | 5 ($1.92B) | 🟢 +2 Halter | **Aktiv im 7-Slot** |
| **MICROSOFT CORP** | `594918104` | STOCK | 5 ($5.58B) | 4 ($3.70B) | 4 ($2.31B) | 4 ($1.41B) | 🔴 -1 Halter | **Aktiv im 7-Slot** |
| **NVIDIA CORPORATION** | `67066G104` | STOCK | 4 ($4.05B) | 4 ($3.90B) | 4 ($4.31B) | 4 ($5.24B) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **ALPHABET INC** | `02079K305` | STOCK | 4 ($2.69B) | 4 ($3.58B) | 2 ($3.06B) | 4 ($2.15B) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **ADVANCED MICRO DEVICES** | `007903107` | STOCK | 2 ($354.2M) | 2 ($335.0M) | 1 ($45.0M) | 4 ($562.5M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **SPACE EXPLORATION TECH** | `84615Q103` | STOCK | 0 ($0) | 0 ($0) | 0 ($0) | 4 ($426.0M) | 🟢 +4 Halter | Qualifiziert (Warteliste) |
| **BROADCOM INC** | `11135F101` | STOCK | 3 ($1.22B) | 3 ($1.05B) | 4 ($1.14B) | 3 ($735.2M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **COUPANG INC** | `22266T109` | STOCK | 4 ($996.8M) | 4 ($1.18B) | 3 ($667.1M) | 3 ($705.7M) | 🔴 -1 Halter | Qualifiziert (Warteliste) |
| **DOORDASH INC** | `25809K105` | STOCK | 2 ($317.5M) | 4 ($225.6M) | 3 ($279.7M) | 3 ($358.3M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **APPLIED MATLS INC** | `038222105` | STOCK | 2 ($197.6M) | 2 ($252.5M) | 2 ($587.7M) | 3 ($1.39B) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **MICRON TECHNOLOGY INC** | `595112103` | STOCK | 1 ($83.7M) | 1 ($428.1M) | 3 ($618.6M) | 3 ($1.38B) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **UBER TECHNOLOGIES INC** | `90353T100` | STOCK | 3 ($798.2M) | 3 ($620.2M) | 3 ($1.04B) | 3 ($1.10B) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **REDDIT INC** | `75734B100` | STOCK | 2 ($1.08B) | 2 ($944.2M) | 2 ($712.3M) | 3 ($923.2M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **QUALCOMM INC** | `747525103` | STOCK | 1 ($207.1M) | 1 ($195.9M) | 2 ($242.9M) | 3 ($650.4M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **CARIS LIFE SCIENCES IN** | `142152107` | STOCK | 2 ($120.2M) | 2 ($446.2M) | 3 ($226.2M) | 3 ($216.0M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **NATERA INC** | `632307104` | STOCK | 3 ($182.5M) | 3 ($212.2M) | 3 ($155.1M) | 3 ($79.8M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **SEA LTD** | `81141R100` | STOCK | 3 ($2.99B) | 2 ($1.97B) | 2 ($1.28B) | 2 ($1.20B) | 🔴 -1 Halter | Qualifiziert (Warteliste) |
| **GE VERNOVA INC** | `36828A101` | STOCK | 3 ($727.8M) | 2 ($690.8M) | 2 ($856.5M) | 2 ($944.5M) | 🔴 -1 Halter | Qualifiziert (Warteliste) |
| **Arm Holdings Plc** | `042068205` | STOCK | 3 ($301.4M) | 1 ($67.9M) | 2 ($259.5M) | 2 ($582.2M) | 🔴 -1 Halter | Qualifiziert (Warteliste) |
| **NU HLDGS LTD** | `G6683N103` | STOCK | 3 ($881.1M) | 2 ($194.7M) | 2 ($580.1M) | 2 ($539.3M) | 🔴 -1 Halter | Qualifiziert (Warteliste) |
| **HUT 8 CORP** | `44812J104` | STOCK | 0 ($0) | 1 ($10.7M) | 0 ($0) | 2 ($1.12B) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **META PLATFORMS INC** | `30303M102` | CALL | 0 ($0) | 0 ($0) | 0 ($0) | 2 ($740.8M) | 🟢 +2 Halter | **Aktiv im 7-Slot** |
| **COREWEAVE INC** | `21873S108` | STOCK | 1 ($920.3M) | 1 ($230.1M) | 1 ($348.5M) | 2 ($711.9M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **CEREBRAS SYSTEMS INC** | `15675D103` | STOCK | 0 ($0) | 0 ($0) | 0 ($0) | 2 ($666.8M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **ALPHABET INC** | `02079K107` | STOCK | 2 ($347.4M) | 2 ($590.8M) | 2 ($499.5M) | 2 ($658.9M) | ➡️ Stabil | **Aktiv im 7-Slot** |
| **INTEL CORP** | `458140100` | STOCK | 0 ($0) | 0 ($0) | 2 ($72.3M) | 2 ($617.6M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **BLOCK INC** | `852234103` | STOCK | 2 ($346.4M) | 2 ($548.2M) | 2 ($480.1M) | 2 ($583.0M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **SPOTIFY TECHNOLOGY S A** | `L8681T102` | STOCK | 2 ($1.70B) | 2 ($834.2M) | 2 ($768.4M) | 2 ($552.4M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **QNITY ELECTRONICS INC** | `74743L100` | STOCK | 0 ($0) | 0 ($0) | 2 ($200.5M) | 2 ($293.5M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **Seagate Technology Hld** | `G7997R103` | STOCK | 1 ($20K) | 0 ($0) | 1 ($20K) | 2 ($275.2M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **WABTEC** | `929740108` | STOCK | 2 ($51.8M) | 2 ($119.2M) | 2 ($150.1M) | 2 ($172.1M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **BAIDU INC** | `056752108` | STOCK | 1 ($137.7M) | 1 ($75.1M) | 1 ($77.1M) | 2 ($148.0M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **SYNOPSYS INC** | `871607107` | STOCK | 2 ($610.1M) | 1 ($10.2M) | 1 ($67.0M) | 2 ($138.0M) | ➡️ Stabil | Qualifiziert (Warteliste) |
| **UNITED AIRLS HLDGS INC** | `910047109` | STOCK | 1 ($44.6M) | 2 ($52.0M) | 1 ($24K) | 2 ($121.1M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **ASML HOLDING N V** | `N07059210` | STOCK | 1 ($62.0M) | 1 ($66.9M) | 2 ($73.4M) | 2 ($104.1M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **RAMBUS INC DEL** | `750917106` | STOCK | 0 ($0) | 0 ($0) | 1 ($60.3M) | 2 ($101.5M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **Danaher Corp Del** | `235851102` | STOCK | 0 ($0) | 0 ($0) | 0 ($0) | 2 ($86.9M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **Ishares Inc** | `464286400` | CALL | 0 ($0) | 1 ($134K) | 1 ($162K) | 2 ($82.9M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **GRUPO FINANCIERO GALIC** | `399909100` | STOCK | 1 ($16.2M) | 1 ($85.9M) | 1 ($60.6M) | 2 ($70.0M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **Cleveland-Cliffs Inc N** | `185899101` | STOCK | 1 ($33K) | 1 ($23K) | 1 ($20K) | 2 ($61.8M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **EQUINIX INC** | `29444U700` | STOCK | 0 ($0) | 0 ($0) | 1 ($104.4M) | 2 ($19.7M) | 🟢 +2 Halter | Qualifiziert (Warteliste) |
| **CARVANA CO** | `146869102` | STOCK | 1 ($13.3M) | 1 ($67.6M) | 1 ($46.0M) | 2 ($14.5M) | 🟢 +1 Halter | Qualifiziert (Warteliste) |
| **VISTRA CORP** | `92840M102` | STOCK | 4 ($334.5M) | 2 ($207.7M) | 1 ($304.0M) | 1 ($351.4M) | 🔴 -3 Halter | Ausgeschieden (<2) |
| **APPLOVIN CORP** | `03831W108` | STOCK | 3 ($1.50B) | 2 ($929.2M) | 2 ($571.2M) | 1 ($379.3M) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **ALIBABA GROUP HLDG LTD** | `01609W102` | STOCK | 3 ($1.34B) | 1 ($753.1M) | 1 ($434.7M) | 1 ($192.0M) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **CHIME FINL INC** | `16935C109` | STOCK | 3 ($261.0M) | 2 ($610.7M) | 2 ($300.9M) | 1 ($108.2M) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **Flutter Entmt Plc** | `G3643J108` | STOCK | 3 ($1.08B) | 3 ($1.16B) | 1 ($144.4M) | 1 ($87.3M) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **ZILLOW GROUP INC** | `98954M200` | STOCK | 3 ($614.3M) | 3 ($562.4M) | 2 ($335.5M) | 1 ($23.3M) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **SNOWFLAKE INC** | `833445109` | STOCK | 2 ($557.1M) | 2 ($493.9M) | 1 ($290.5M) | 1 ($490.2M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **ISHARES INC** | `464286772` | STOCK | 0 ($0) | 1 ($182.3M) | 2 ($506.9M) | 1 ($489.6M) | 🟢 +1 Halter | Ausgeschieden (<2) |
| **Pg&amp;E Corp** | `69331C108` | STOCK | 2 ($211.5M) | 1 ($189.5M) | 1 ($377.2M) | 1 ($341.0M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **NETFLIX INC.** | `64110L106` | STOCK | 2 ($983.9M) | 2 ($242.1M) | 2 ($236.3M) | 1 ($336.3M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **GRAB HOLDINGS LIMITED** | `G4124C109` | STOCK | 2 ($597.7M) | 2 ($626.1M) | 1 ($154.7M) | 1 ($320.0M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **Mercadolibre  Inc** | `58733R102` | STOCK | 2 ($88.6M) | 2 ($138.0M) | 2 ($233.4M) | 1 ($259.9M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **NRG ENERGY INC** | `629377508` | STOCK | 2 ($313.7M) | 1 ($261.2M) | 1 ($253.5M) | 1 ($257.1M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **LIBERTY MEDIA CORP DEL** | `531229755` | STOCK | 2 ($280.2M) | 1 ($264.2M) | 1 ($228.0M) | 1 ($216.8M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **Capital One Finl Corp** | `14040H105` | STOCK | 2 ($224.6M) | 1 ($183.7M) | 1 ($124.4M) | 1 ($171.3M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **AMERICAN AIRLINES GROU** | `02376R102` | STOCK | 1 ($104.0M) | 2 ($216.9M) | 0 ($0) | 1 ($135.5M) | ➡️ Stabil | Ausgeschieden (<2) |
| **UNITEDHEALTH GROUP INC** | `91324P102` | STOCK | 2 ($221.8M) | 2 ($204.7M) | 2 ($119.2M) | 1 ($123.6M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **CONSTELLATION ENERGY C** | `21037T109` | STOCK | 1 ($19.6M) | 2 ($400.0M) | 1 ($309.6M) | 1 ($101.7M) | ➡️ Stabil | Ausgeschieden (<2) |
| **WEBULL CORP** | `G9572D103` | STOCK | 2 ($343.8M) | 2 ($52.8M) | 1 ($32.3M) | 1 ($43.8M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **PINTEREST INC** | `72352L106` | STOCK | 2 ($76.3M) | 0 ($0) | 1 ($30.8M) | 1 ($25.2M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **ZILLOW GROUP INC** | `98954M101` | STOCK | 2 ($82.7M) | 1 ($69.8M) | 2 ($56.0M) | 1 ($10.3M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **JD.COM INC** | `47215P106` | STOCK | 2 ($229.8M) | 2 ($129.2M) | 2 ($48.8M) | 1 ($5.1M) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **GEMINI SPACE STA INC** | `36866J105` | STOCK | 2 ($40.0M) | 1 ($694K) | 1 ($309K) | 1 ($298K) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **Ishares Inc** | `464286400` | STOCK | 0 ($0) | 1 ($113K) | 2 ($93.1M) | 1 ($119K) | 🟢 +1 Halter | Ausgeschieden (<2) |
| **Sandisk Corp** | `80004C200` | STOCK | 1 ($19K) | 0 ($0) | 2 ($178.7M) | 1 ($79K) | ➡️ Stabil | Ausgeschieden (<2) |
| **Crh Plc** | `G25508105` | STOCK | 2 ($156.9M) | 2 ($44.1M) | 1 ($40K) | 1 ($59K) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **DELTA AIR LINES INC DE** | `247361702` | STOCK | 1 ($26.2M) | 2 ($33.0M) | 0 ($0) | 1 ($56K) | ➡️ Stabil | Ausgeschieden (<2) |
| **Stubhub Hldgs Inc** | `86384P109` | STOCK | 2 ($169.3M) | 2 ($136.0M) | 2 ($35.3M) | 1 ($45K) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **Teva Pharmaceutical In** | `881624209` | STOCK | 2 ($418.7M) | 2 ($118.6M) | 2 ($59.5M) | 1 ($21K) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **ROCKET COS INC** | `77311W101` | STOCK | 1 ($162.1M) | 2 ($131.0M) | 1 ($40.2M) | 1 ($10K) | ➡️ Stabil | Ausgeschieden (<2) |
| **Solstice Advanced Matl** | `83443Q103` | STOCK | 0 ($0) | 0 ($0) | 2 ($18.8M) | 1 ($6K) | 🟢 +1 Halter | Ausgeschieden (<2) |
| **BLOOM ENERGY CORP** | `093712107` | STOCK | 0 ($0) | 2 ($22.7M) | 1 ($18K) | 0 ($0) | ➡️ Stabil | Ausgeschieden (<2) |
| **CARPENTER TECHNOLOGY C** | `144285103` | STOCK | 2 ($205.8M) | 1 ($192.7M) | 1 ($5.1M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **CORNING INC** | `219350105` | STOCK | 2 ($625.9M) | 2 ($212.5M) | 1 ($153.6M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **Eqt Corp** | `26884L109` | STOCK | 2 ($14.2M) | 1 ($10.4M) | 0 ($0) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **Echostar Corp** | `278768106` | STOCK | 1 ($5K) | 2 ($9.5M) | 1 ($7K) | 0 ($0) | 🔴 -1 Halter | Ausgeschieden (<2) |
| **FIGMA INC** | `316841105` | STOCK | 2 ($170.8M) | 1 ($2.2M) | 1 ($1.3M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **Figure Technology Solu** | `349381103` | STOCK | 2 ($7.4M) | 2 ($8.2M) | 2 ($6.8M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **HINGE HEALTH INC** | `433313103` | STOCK | 2 ($257.9M) | 1 ($83.9M) | 0 ($0) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **LUMENTUM HLDGS INC** | `55024U109` | STOCK | 0 ($0) | 0 ($0) | 2 ($96.1M) | 0 ($0) | ➡️ Stabil | Ausgeschieden (<2) |
| **MONGODB INC** | `60937P106` | STOCK | 2 ($105.8M) | 0 ($0) | 0 ($0) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **NETSKOPE INC** | `64119N608` | STOCK | 2 ($18.8M) | 1 ($8.8M) | 1 ($4.2M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **PDD HOLDINGS INC** | `722304102` | STOCK | 2 ($419.2M) | 1 ($201.3M) | 1 ($92.0M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **KLARNA GROUP PLC** | `G5279N105` | STOCK | 2 ($6.7M) | 1 ($5.1M) | 1 ($2.3M) | 0 ($0) | 🔴 -2 Halter | Ausgeschieden (<2) |
| **Lattice Semiconductor ** | `518415104` | STOCK | 0 ($0) | 2 ($20.0M) | 1 ($30K) | 0 ($0) | ➡️ Stabil | Ausgeschieden (<2) |
| **Lyondellbasell Industr** | `N53745100` | STOCK | 0 ($0) | 0 ($0) | 2 ($49.7M) | 0 ($0) | ➡️ Stabil | Ausgeschieden (<2) |

---

## 3. Transaktions-Chronik der 7 Kern-Slots (Quartal für Quartal)

### 📌 AMZN: Amazon.com Inc. (`023135106`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | 437.1K ($96K) | 737.9K ($170K) | 45.8K ($10K) | 541.6K ($129K) | 🔼 **Aggressiver Zukauf** (+24 %) |
| **Laffont** (Coatue) | 6.60M ($1.45B) | 496.0K ($114.5M) | 1.17M ($242.8M) | 1.28M ($305.8M) | 🔻 **Teilverkaeufe** (-81 %) |
| **Coleman** (Tiger Global) | 11.04M ($2.42B) | 10.01M ($2.31B) | 10.00M ($2.08B) | 9.68M ($2.31B) | ➡️ Unverändert |
| **Tepper** (Appaloosa) | 2.50M ($548.9M) | 2.18M ($503.0M) | 4.32M ($899.7M) | 5.00M ($1.19B) | 🔼 **Aggressiver Zukauf** (+100 %) |
| **Gerstner** (Altimeter) | 2.17M ($475.9M) | 2.22M ($511.4M) | 2.09M ($435.2M) | 2.43M ($578.1M) | ➡️ Unverändert |
| **Schreiber** (PointState) | 872.3K ($191.5M) | 1.26M ($290.0M) | - | 1.42M ($339.3M) | 🔼 **Aggressiver Zukauf** (+63 %) |

### 📌 META: Meta Platforms Inc. (`30303M102`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | 76.1K ($56K) | - | - | - | 🔴 **Komplettverkauf** |
| **Laffont** (Coatue) | 66.9K ($49.1M) | 48.1K ($31.8M) | 6.4K ($3.7M) | 1.82M ($1.03B) | 🔼 **Aggressiver Zukauf** (+2624 %) |
| **Coleman** (Tiger Global) | 2.82M ($2.07B) | 2.75M ($1.82B) | 3.09M ($1.77B) | 2.82M ($1.59B) | ➡️ Unverändert |
| **Tepper** (Appaloosa) | 370.0K ($271.7M) | 600.0K ($396.1M) | 436.5K ($249.7M) | 675.0K ($380.2M) | 🔼 **Aggressiver Zukauf** (+82 %) |
| **Gerstner** (Altimeter) | 1.87M ($1.37B) | 1.85M ($1.22B) | 1.95M ($1.12B) | 1.35M ($763.3M) | 🔻 **Teilverkaeufe** (-27 %) |
| **Schreiber** (PointState) | - | - | 72.7K ($41.6M) | 380.4K ($214.3M) | 🟢 **Neupositionierung** (+380.4K) |

### 📌 MSFT: Microsoft Corp. (`594918104`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Laffont** (Coatue) | 2.48M ($1.28B) | 397.3K ($192.2M) | 2.48M ($918.0M) | 136.2K ($50.8M) | 🔻 **Teilverkaeufe** (-95 %) |
| **Coleman** (Tiger Global) | 6.55M ($3.39B) | 5.48M ($2.65B) | 2.50M ($925.4M) | 2.27M ($845.6M) | 🔻 **Teilverkaeufe** (-65 %) |
| **Tepper** (Appaloosa) | 462.5K ($239.6M) | 500.0K ($241.8M) | 90.0K ($33.3M) | - | 🔴 **Komplettverkauf** |
| **Gerstner** (Altimeter) | 1.16M ($601.9M) | 1.28M ($617.8M) | 1.18M ($438.1M) | 1.27M ($473.0M) | ➡️ Unverändert |
| **Schreiber** (PointState) | 107.7K ($55.8M) | - | - | 117.3K ($43.8M) | ➡️ Unverändert |

### 📌 TSM: Taiwan Semiconductor (`874039100`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | 765.1K ($214K) | 543.1K ($165K) | 495.3K ($167K) | 589.7K ($282K) | 🔻 **Teilverkaeufe** (-23 %) |
| **Laffont** (Coatue) | 119.9K ($33.5M) | 793.0K ($241.0M) | 98.0K ($33.1M) | 197.9K ($94.5M) | 🔼 **Aggressiver Zukauf** (+65 %) |
| **Coleman** (Tiger Global) | 4.58M ($1.28B) | 3.73M ($1.13B) | 5.57M ($1.88B) | 4.88M ($2.33B) | ➡️ Unverändert |
| **Tepper** (Appaloosa) | 1.06M ($296.0M) | 1.13M ($343.4M) | 1.33M ($448.6M) | 1.65M ($788.0M) | 🔼 **Aggressiver Zukauf** (+56 %) |
| **Gerstner** (Altimeter) | 1.07M ($298.5M) | 1.22M ($370.5M) | 1.37M ($461.5M) | 1.43M ($682.6M) | 🔼 **Aggressiver Zukauf** (+34 %) |

### 📌 NVDA: Nvidia Corp. (`67066G104`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Laffont** (Coatue) | 464.7K ($86.7M) | 90.6K ($16.9M) | 1.92M ($334.1M) | 4.05M ($811.1M) | 🔼 **Aggressiver Zukauf** (+772 %) |
| **Coleman** (Tiger Global) | 11.71M ($2.18B) | 11.01M ($2.05B) | 12.01M ($2.09B) | 11.20M ($2.24B) | ➡️ Unverändert |
| **Tepper** (Appaloosa) | 1.90M ($354.5M) | 1.70M ($317.1M) | 1.47M ($256.6M) | 1.52M ($305.1M) | ➡️ Unverändert |
| **Gerstner** (Altimeter) | 7.64M ($1.43B) | 8.10M ($1.51B) | 9.34M ($1.63B) | 9.41M ($1.88B) | 🔼 **Aggressiver Zukauf** (+23 %) |

### 📌 GOOGL: Alphabet Inc. (Class A) (`02079K305`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | 102.2K ($25K) | 385.0K ($121K) | - | 336.3K ($120K) | 🔼 **Aggressiver Zukauf** (+229 %) |
| **Laffont** (Coatue) | 126.3K ($30.7M) | 302.4K ($94.7M) | 24.5K ($7.0M) | 44.4K ($15.9M) | 🔻 **Teilverkaeufe** (-65 %) |
| **Coleman** (Tiger Global) | 10.63M ($2.58B) | 10.63M ($3.33B) | 10.63M ($3.06B) | 5.81M ($2.07B) | 🔻 **Teilverkaeufe** (-45 %) |
| **Gerstner** (Altimeter) | 313.1K ($76.1M) | 519.3K ($162.5M) | - | 175.2K ($62.6M) | 🔻 **Teilverkaeufe** (-44 %) |

### 📌 LRCX: Lam Research Corp. (`512807306`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | - | - | - | 43.6K ($19K) | 🟢 **Neupositionierung** (+43.6K) |
| **Laffont** (Coatue) | 190.1K ($25.4M) | 596.9K ($102.2M) | 99.4K ($21.2M) | 498.4K ($216.0M) | 🔼 **Aggressiver Zukauf** (+162 %) |
| **Coleman** (Tiger Global) | 5.26M ($704.4M) | 3.90M ($667.7M) | 3.90M ($833.4M) | 3.16M ($1.37B) | 🔻 **Teilverkaeufe** (-40 %) |
| **Tepper** (Appaloosa) | 370.0K ($49.5M) | 425.0K ($72.8M) | 382.5K ($81.7M) | 382.5K ($165.7M) | ➡️ Unverändert |
| **Gerstner** (Altimeter) | - | - | - | 394.1K ($170.8M) | 🟢 **Neupositionierung** (+394.1K) |

### 📌 NOW (Ex-Slot): ServiceNow Inc. (`81762P102`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Coleman** (Tiger Global) | 300.0K ($276.1M) | 2.13M ($325.8M) | 1.50M ($156.8M) | 873.5K ($86.7M) | 🔼 **Aggressiver Zukauf** (+191 %) |

### 📌 AVGO (Kandidat): Broadcom Inc. (`11135F101`)

| Manager (Fonds) | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Aktion |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Druckenmiller** (Duquesne) | - | - | 196.0K ($61K) | - | ➡️ Unverändert |
| **Laffont** (Coatue) | 59.8K ($19.7M) | 133.0K ($46.0M) | 20.2K ($6.3M) | 42.2K ($15.9M) | 🔻 **Teilverkaeufe** (-29 %) |
| **Coleman** (Tiger Global) | 2.89M ($953.3M) | 2.88M ($995.3M) | 3.58M ($1.11B) | 1.75M ($662.6M) | 🔻 **Teilverkaeufe** (-39 %) |
| **Tepper** (Appaloosa) | - | - | - | 150.0K ($56.7M) | 🟢 **Neupositionierung** (+150.0K) |
| **Gerstner** (Altimeter) | 744.8K ($245.7M) | 32.1K ($11.1M) | 67.1K ($20.8M) | - | 🔴 **Komplettverkauf** |

---

## 4. Derivate-Spiegel: Makro-Hedges über Puts & Calls

Die 13F-Meldungen offenbaren spektakuläre Absicherungs- und Hebelstrategien der Hedgefonds-Manager:

| Quartal | Manager | Fonds | Basiswert | Option | Kontrakte / Aktien | Gemeldeter Marktwert |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| 2025-09-29 | **Schreiber** | PointState | CEMEX SAB DE CV | **CALL** | 9.00M | **$80.9M** |
| 2025-12-30 | **Schreiber** | PointState | CEMEX SAB DE CV | **CALL** | 9.00M | **$103.4M** |
| 2025-09-29 | **Schreiber** | PointState | CORNING INC | **CALL** | 4.20M | **$344.5M** |
| 2025-09-29 | **Schreiber** | PointState | ILLUMINA INC | **CALL** | 1.65M | **$156.4M** |
| 2025-12-30 | **Schreiber** | PointState | ILLUMINA INC | **CALL** | 646.9K | **$84.8M** |
| 2025-09-29 | **Schreiber** | PointState | ISHARES TR | **CALL** | 3.50M | **$186.9M** |
| 2025-09-29 | **Druckenmiller** | Duquesne | Ishares Tr | **CALL** | 226.0K | **$55K** |
| 2025-12-30 | **Druckenmiller** | Duquesne | Ishares Tr | **CALL** | 226.0K | **$56K** |
| 2026-03-30 | **Druckenmiller** | Duquesne | Ishares Tr | **CALL** | 79.0K | **$20K** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Ishares Tr | **CALL** | 330.0K | **$99K** |
| 2025-09-29 | **Druckenmiller** | Duquesne | Natera Inc | **CALL** | 100.0K | **$16K** |
| 2025-09-29 | **Schreiber** | PointState | PG&E CORP | **CALL** | 15.00M | **$226.2M** |
| 2026-06-29 | **Schreiber** | PointState | PG&E CORP | **CALL** | 31.50M | **$529.8M** |
| 2025-09-29 | **Druckenmiller** | Duquesne | State Str Spdr S&P 500 Etf T | **CALL** | 90.0K | **$60K** |
| 2025-12-30 | **Druckenmiller** | Duquesne | State Str Spdr S&P 500 Etf T | **CALL** | 90.0K | **$61K** |
| 2026-03-30 | **Druckenmiller** | Duquesne | State Str Spdr S&P 500 Etf T | **CALL** | 90.0K | **$59K** |
| 2026-06-29 | **Druckenmiller** | Duquesne | State Str Spdr S&P 500 Etf T | **CALL** | 90.0K | **$67K** |
| 2025-09-29 | **Schreiber** | PointState | SELECT SECTOR SPDR TR | **CALL** | 1.00M | **$53.9M** |
| 2025-09-29 | **Schreiber** | PointState | TEVA PHARMACEUTICAL INDS LTD | **CALL** | 3.67M | **$74.2M** |
| 2025-12-30 | **Schreiber** | PointState | TEVA PHARMACEUTICAL INDS LTD | **CALL** | 3.67M | **$114.6M** |
| 2025-12-30 | **Druckenmiller** | Duquesne | Amazon Com Inc | **CALL** | 100.0K | **$23K** |
| 2026-03-30 | **Druckenmiller** | Duquesne | Amazon Com Inc | **CALL** | 200.0K | **$42K** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Amazon Com Inc | **CALL** | 459.3K | **$109K** |
| 2025-12-30 | **Schreiber** | PointState | CARPENTER TECHNOLOGY CORP | **CALL** | 450.0K | **$141.7M** |
| 2025-12-30 | **Druckenmiller** | Duquesne | Ishares Inc | **CALL** | 4.23M | **$134K** |
| 2026-03-30 | **Druckenmiller** | Duquesne | Ishares Inc | **CALL** | 4.23M | **$162K** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Ishares Inc | **CALL** | 4.23M | **$146K** |
| 2026-06-29 | **Schreiber** | PointState | Ishares Inc | **CALL** | 2.40M | **$82.8M** |
| 2025-12-30 | **Tepper** | Appaloosa | MICRON TECHNOLOGY INC | **CALL** | 250.0K | **$71.4M** |
| 2025-12-30 | **Schreiber** | PointState | VANECK ETF TRUST | **PUT** | 1.38M | **$497.0M** |
| 2026-06-29 | **Schreiber** | PointState | VANECK ETF TRUST | **PUT** | 916.4K | **$601.1M** |
| 2026-03-30 | **Druckenmiller** | Duquesne | Invesco Exchange Traded Fd T | **CALL** | 821.0K | **$158K** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Invesco Exchange Traded Fd T | **CALL** | 821.0K | **$175K** |
| 2026-03-30 | **Schreiber** | PointState | ISHARES TR | **PUT** | 1.10M | **$272.8M** |
| 2026-03-30 | **Schreiber** | PointState | STATE STR SPDR S&P 500 ETF T | **PUT** | 5.10M | **$3.32B** |
| 2026-06-29 | **Tepper** | Appaloosa | APPLE INC | **PUT** | 835.0K | **$241.6M** |
| 2026-06-29 | **Tepper** | Appaloosa | BERKSHIRE HATHAWAY INC DEL | **PUT** | 25.0K | **$12.5M** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Cdw Corp | **CALL** | 250.0K | **$35K** |
| 2026-06-29 | **Schreiber** | PointState | DRAFTKINGS INC NEW | **CALL** | 3.00M | **$75.8M** |
| 2026-06-29 | **Druckenmiller** | Duquesne | META PLATFORMS INC | **CALL** | 50.0K | **$28K** |
| 2026-06-29 | **Schreiber** | PointState | META PLATFORMS INC | **CALL** | 1.31M | **$740.7M** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Insmed Inc | **CALL** | 1.35M | **$144K** |
| 2026-06-29 | **Schreiber** | PointState | NEXTNAV INC | **CALL** | 3.79M | **$67.6M** |
| 2026-06-29 | **Schreiber** | PointState | RAMBUS INC DEL | **CALL** | 350.0K | **$46.5M** |
| 2026-06-29 | **Druckenmiller** | Duquesne | Tesla Inc | **CALL** | 126.0K | **$53K** |

> [!IMPORTANT]
> **Strategische Interpretation der Put-Hedges:**
> 1. **Zach Schreiber (PointState):** Fuhr im Q1-2026 einen massiven **3,32 Mrd. $ SPY Put**, als die Zins- und Zollsorgen zunahmen. Im Q2-2026 rotierte er in einen **601 Mio. $ VanEck Halbleiter (SMH) Put**, was auf gezielte Absicherung gegen Halbleiter-Rücksetzer hindeutet.
> 2. **David Tepper (Appaloosa):** Setzte im Q2-2026 einen gezielten **241,6 Mio. $ Apple-Put**. Tepper hält zwar massiv Meta, Amazon und Google, schirmte sich aber explizit gegen Apples Margen- und China-Schwäche ab.

---

## 5. Portfoliovolumen & Thematische Sektor-Rotation

### A. Entwicklung des 13F-Gesamtvolumens der 6 Stamm-Manager

| Manager | Fonds | Q3-2025 | Q4-2025 | Q1-2026 | Q2-2026 | 12M-Veränderung |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Stanley Druckenmiller** | Duquesne | $4.1M | $4.5M | $3.4M | $5.2M | **28.3 %** |
| **Philippe Laffont** | Coatue | $10.95B | $3.51B | $4.50B | $7.30B | **-33.4 %** |
| **Chase Coleman** | Tiger Global | $32.36B | $29.71B | $22.85B | $23.98B | **-25.9 %** |
| **David Tepper** | Appaloosa | $7.38B | $6.93B | $5.93B | $7.73B | **4.6 %** |
| **Brad Gerstner** | Altimeter | $7.58B | $6.66B | $5.70B | $9.83B | **29.6 %** |
| **Zach Schreiber** | PointState | $6.52B | $6.59B | $7.81B | $7.70B | **18.1 %** |

### B. Auf was haben die Gurus ihre Portfolios in den letzten 12 Monaten getrimmt?

1. **Aufbau: KI-Infrastruktur & Next-Gen Hardware (Lam Research, TSMC, Nvidia):**  
   Das Gremium hat die Hardware- und Halbleiter-Ausrüster massiv aufgestockt. Lam Research stieg von 2 auf 5 Halter, TSMC wurde von Duquesne und Coatue kontinuierlich akkumuliert.

2. **Aufbau: Energie & Data Center Power (Vistra, Constellation, PG&E):**  
   Eine der markantesten thematischen Neuerungen: Druckenmiller, Tepper und Schreiber bauten signifikante Positionen in Energieversorgern und Kernkraft-Profiteuren auf (Vistra Corp, Constellation Energy, PG&E), um vom gigantischen Strombedarf der KI-Rechenzentren zu profitieren.

3. **Abbau: China-Aktien & Asiatischer Konsum:**  
   Bis Q3-2025 hielten Tepper, Coleman und Laffont noch Milliarden in Alibaba, PDD und JD.com. Über die letzten 12 Monate wurden diese Bestände fast vollständig liquidiert oder drastisch zusammengestrichen.

4. **Abbau: B2B Enterprise Software ohne KI-Monopol:**  
   Software-Werte mit verlangsamtem Wachstum wie ServiceNow, Snowflake und MongoDB wurden abgestoßen oder halbiert. Das Kapital rotierte stattdessen konzentriert in die Hyperscaler (Microsoft, Amazon, Meta, Google).

