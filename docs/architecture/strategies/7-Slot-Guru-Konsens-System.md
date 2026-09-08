# Masterplan: Das 7-Slot-Guru-Konsens-System (Tech-Fokus) – Version 2.0

Dieses Dokument ist die verbindliche Fassung (Version 2.0). Es integriert die Druckenmiller Net Fed Liquidity Formel als alleinigen mathematischen Auslöser für das Makro-Rebalancing (25 % Gold-Puffer), während die Einzeltitel-Ausstiege strikt über den 13F-Konsens (>= 2 Halter) gesteuert werden.

---

## 1. Das 6er-Gremium (Ausschlaggebende Investoren)

Die Einzeltitelauswahl und das Halten von Positionen wird vollständig an sechs ausgewählte US-Hedgefonds- und Tech-Manager delegiert:

1. **Stanley Druckenmiller** (*Duquesne Family Office*) – Makro-Liquidität und asymmetrische Technologietrends.
2. **Philippe Laffont** (*Coatue Management*) – Dediziertes Technologie-, Cloud- und Halbleiter-Research.
3. **Chase Coleman** (*Tiger Global Management*) – Marktführende Software- und Plattform-Monopole.
4. **David Tepper** (*Appaloosa Management*) – Opportunistischer Tech- und Value-Fokus.
5. **Brad Gerstner** (*Altimeter Capital*) – B2B-Software, Cloud und KI-Infrastruktur.
6. **Zach Schreiber** (*PointState Capital*) – Halbleiter- und makroökonomische Spezialthemen.

### Warteliste & Nachfolge-Regel (Gremiums-Governance)
Fällt einer der 6 Stamm-Manager dauerhaft aus (z. B. Schließung des Fonds, Ruhestand oder Wegfall der institutionellen SEC 13F-Meldepflicht), rückt automatisch der nächste Kandidat von der Warteliste auf den freien Stammplatz nach:
* **Nachrücker 1: Gavin Baker** (*Atreides Management*) – Führender Spezialist für Halbleiter-Supply-Chains, KI-Hardware und Enterprise-Software (ehem. Star-Manager des Fidelity OTC Fund).
* **Nachrücker 2: Alex Sacerdote** (*Whale Rock Capital Management*) – Spezialist für globale TMT-Wellen (Technology, Media, Telecom), Cloud-Adoption und KI-Infrastruktur.
* **Nachrücker 3: Christopher Hohn** (*TCI Fund Management*) – Stark konzentrierter Investor mit herausragender 10-Jahres-Alpha-Generierung in globalen Tech-Monopolen.

---

## 2. Datenquellen & Beschaffung

* **Primär-Check:** SEC Form 13F (Quartalsberichte institutioneller US-Verwalter über 100 Mio. $ AuM).
* **Plattformen:** Dataroma (dataroma.com) als Hauptquelle für die 6 Managerprofile und Bestandsüberschneidungen; ergänzend WhaleWisdom oder SEC EDGAR.
* **Makro-Liquiditätsdaten:** Federal Reserve Bank of St. Louis (FRED; fred.stlouisfed.org) für die wöchentliche Liquiditätsberechnung.
* **Feste Prüftermine (45 Tage nach Quartalsende):**
  * **16. Februar** (Stichtag Q4 / 31. Dezember)
  * **16. Mai** (Stichtag Q1 / 31. März)
  * **16. August** (Stichtag Q2 / 30. Juni)
  * **16. November** (Stichtag Q3 / 30. September)

---

## 3. Einstiegs-Ampelsystem (Pfad A vs. Pfad B)

Der Kapitalstart erfolgt über eine datengetriebene Makro-Ampel. Sie unterscheidet strikt zwischen zwei **harten Veto-Kriterien** (Zinskurve & Kredit-Spreads) und einem **Geschwindigkeits-Regler** (Bullenmarkt-Alter):

### A. Die beiden harten Veto-Kriterien (Müssen beide GRÜN sein für Pfad A):

1. **10Y-2Y Zinskurve (FRED: `T10Y2Y`) – Kein Panik-Steepening:**
   * *Hintergrund (Empirischer Beweis):* Historisch crashen Aktienmärkte nicht in der Inversion (wo die durchschnittliche SPY-Tagesrendite mit +0,063 % sogar überdurchschnittlich hoch ist), sondern erst beim panischen „Un-Inverting“ (Steepening), wenn die Fed in Notlagen überstürzt senkt.
   * *Messung & Schwellenwerte:*
     * **GRÜN:** Die Kurve ist invertiert (`T10Y2Y < 0,0`) ODER moderat positiv (`0,0 <= T10Y2Y < +0,30`), **UND** die 30-Tage-Steigung liegt unter $+0,20\,\%$ (`Delta_30d < +0,20`).
     * **ROT (Point of No Return):** `T10Y2Y >= +0,30` **UND** 30-Tage-Steigung `Delta_30d >= +0,20` (akutes Panik-Steepening).
2. **High-Yield Credit Spreads (FRED: `BAMLH0A0HYM2`) – Entspannte Kreditmärkte:**
   * *Dynamische Formel:*  
     $$\text{HY-Spread} < \text{SMA 50 (Spread)} \quad \text{ODER} \quad \text{Spread} < 4,0\,\%$$
   * *Messung & Schwellenwerte:*
     * **GRÜN:** Der Spread notiert unter seinem 50-Tage-Durchschnitt (abnehmender Stress) ODER absolut im sicheren Bereich unter 4,0 %.
     * **ROT:** Der Spread schießt über seinen 50-Tage-Schnitt nach oben UND liegt über 4,0 % (akute Risikoaversion und Kreditverknappung).

---

### B. Der Geschwindigkeits-Regler (Bullenmarkt-Alter steuert Tranchierung):
Das Alter des Bullenmarktes (gemessen seit dem letzten 20%-Korrekturtief des Nasdaq-100 / S&P 500) blockiert den Einstieg nicht, sondern steuert die defensive Streckung der Kauf-Tranchen:
* **Junger Bullenmarkt (< 2 Jahre):** Schneller Einstieg in **3 Monatstranchen** (je 33,3 % des Kapitals) + Sparplan ab Tag 1.
* **Reifer Bullenmarkt (>= 2 Jahre):** Defensiver Einstieg in **6 Monatstranchen** (je 16,6 % des Kapitals) zur Glättung des Spätzyklus-Risikos + Sparplan ab Tag 1.

### Die beiden Ausführungspfade

```
                  [Start: 100 % Cash auf Verrechnungskonto]
                                     |
                         Ist die Makro-Ampel GRÜN?
                                     |
               +---------------------+---------------------+
              JA                                          NEIN
               |                                           |
     [Pfad A: Direkter Start]                    [Pfad B: Defensiv-Modus]
  Kein Warten auf -10 % nötig.                 Strikter Cash-Standby (100 % Cash).
  Geparktes Cash in 3 Monatstranchen           Kauf erst bei >= 10 % Nasdaq-Dip.
  + Sparplan ab Tag 1 (100 % Tech).            Bei Liquiditätsalarm: 25 % Gold / 75 % Cash.
                                               Sparrate: 75 % Cash / 25 % Gold.
```

* **Pfad-B-Regeln im Detail:**
  * *Normalzustand:* 100 % Cash auf dem Verrechnungskonto. Die monatliche Sparrate fließt zu 100 % in Cash (Aufbau von trockenem Pulver).
  * *Bei Liquiditätsalarm (Net Liquidity 8-Wochen-Delta < -5 %):* Exakt 25 % des gesamten Cash-Bestands werden in physisch hinterlegtes Gold (z. B. Xetra-Gold ETC) getauscht, 75 % verbleiben als Cash. Die laufende Sparrate wird ab diesem Zeitpunkt zu 75 % Cash und 25 % Gold angespart.
  * *Kauf-Ausführung:* Erreicht der Nasdaq-100 einen Dip von $\ge 10\,\%$, wird der Cash-Puffer investiert. Sobald sich auch die Liquidität erholt, wird das Gold aufgelöst und vollständig in die 7 Tech-Slots reinvestiert.

---

## 4. Portfoliostruktur & Einzeltitel-Regelwerk

* **Kapazität:** Strikt **maximal 7 Slots**.
* **Sektor-Fokus:** Zwingend **Technologie-Sektor**. Alle Zukäufe oder Positionen außerhalb von Technologie (z. B. Rohstoffe, Banken, Energie) werden bei der Signalauswertung strikt ignoriert.
* **Aufnahmekriterium (Aktiver Kauf):** Eine Aktie muss im jüngsten SEC 13F-Quartalsbericht von **mindestens 2 der 6 Manager AKTIV GEKAUFT worden sein** (Neupositionierung oder signifikante Aufstockung). Ein rein passives Halten reicht für eine Neuaufnahme nicht aus.
* **Haltekriterium:** Ein einmal aufgenommener Titel verbleibt im Portfolio, solange er von mindestens 2 der 6 Manager im Bestand gehalten wird.
* **Gewichtung:** Gleichgewichtung aller belegten Slots (bei 7 Werten exakt **14,29 % pro Slot**). Bei weniger als 7 Titeln wird das Kapital gleichmäßig auf die aktiven Werte verteilt.
* **Monatlicher Sparplan:** Die monatliche Sparrate (z. B. 100 € bis 500 €) fließt gleichmäßig aufgeteilt in die aktuell aktiven Slots.
* **Ausstieg bei Einzeltiteln (Reine 13F-Regel):**
  * Fällt ein Wert bei der vierteljährlichen 13F-Prüfung unter die Mindestschwelle von 2 Haltern, wird die Position **zu 100 % verkauft**.
  * Der Erlös wird per Rebalancing gleichmäßig auf die verbleibenden aktiven Slots verteilt bzw. für einen Neuzugang reserviert.
  * Keine spekulativen vorzeitigen Verkäufe anhand unvollständiger Quartalsergebnisse oder Medienberichte.
* **Verdrängungs-Regel bei vollen 7 Slots (3-Stufen-„Base-Schutz“):**
  Sind alle 7 Slots voll besetzt und qualifiziert sich bei der vierteljährlichen 13F-Prüfung eine neue Technologie-Aktie (mindestens 2 aktive Käufer), gilt zur Vermeidung von Fehlausstiegen vor Kursexplosionen („Verkauf vor dem Boom“) der **3-Stufen-Base-Schutz**:
  1. *Haltedauer-Schutz (Mindest-Reifezeit):* Jeder aufgenommene Titel ist nach Einstieg für **mindestens 2 Quartale (6 Monate)** vor jeglicher Verdrängung absolut geschützt, solange er $\ge 2$ Halter behält.
  2. *Asymmetrische Überhang-Hürde:* Ein neuer Kandidat darf einen bestehenden Titel nur dann verdrängen, wenn der Neuzugang von **mindestens 3 Managern aktiv gekauft wurde** (starker Groß-Konsens), während der schwächste Bestandstitel nur noch **2 Halter** hat UND im jüngsten Quartal **keine Zukäufe** mehr verzeichnete (reines passives Halten).
  3. *Technischer Trend-Schutz (SMA-200-Filter):* Notiert der schwächste Bestandstitel (2 Halter) **über seinem 200-Tage-Durchschnitt (SMA 200)**, gilt er als *gesunde Konsolidierungs-Basis in einem intakten Aufwärtstrend* $\rightarrow$ **Verdrängung strikt verboten**.  
     *Verdrängt werden darf er nur*, wenn er **unter seinem SMA 200 notiert** (bestätigte charttechnische Trendschwäche).

---

## 5. Das Makro-Rebalancing: Die Druckenmiller-Liquiditäts-Regel (Gold-Guard & Re-Entry-Sniper)

Das Gesamtdepot wird nicht über Einzelaktien-Notbremsen, sondern auf Portfolio-Ebene über Druckenmillers mathematische Liquiditätsformel und den universellen Makro-Türsteher abgesichert:

$$\text{Net Fed Liquidity} = \text{Fed-Bilanzsumme (WALCL)} - \text{TGA Treasury Account (WTREGEN)} - \text{Reverse Repo (RRPONTSYD)}$$

```
                      [Wöchentlicher FRED-Check]
             Net Fed Liquidity = WALCL - WTREGEN - RRPONTSYD
                                     |
               Fällt die Net Liquidity über 8 Wochen um > 5 %
            UND notieren Credit Spreads > 4 % & über SMA 50?
                                     |
               +---------------------+---------------------+
              JA                                          NEIN
               |                                           |
     [Makro-Schutzschild AKTIV]                   [Normalzustand: 100 % Tech]
  100 % Notfall-Evakuierung aller              Alle 7 Slots voll besetzt.
  7 Slots in 50 % Gold / 50 % Cash.            Laufende Sparrate zu 100 %
  Sparrate: 50 % Gold / 50 % Cash.             in die 7 Tech-Aktien.
```

### Die Phasen des Makro-Rebalancings

1. **Aktivierung (Der universelle Makro-Türsteher ROT):**
   * **Bedingung 1 (Druckenmiller Liquiditätsentzug):** Die Net Fed Liquidity fällt über einen Zeitraum von 8 aufeinanderfolgenden Wochen um **mehr als 5,0 %** ($\Delta_{8\text{W}} < -5,0\,\%$).
   * **Bedingung 2 (Kreditstress-Filter):** Die High-Yield Credit Spreads (`BAMLH0A0HYM2`) steigen über ihren 50-Tage-Durchschnitt **und** über $4,0\,\%$ (Bestätigung akuter Liquiditätsverknappung).
   * *(Ausschluss Banken-Notkredite: Notkredite `FiscalFed EmergencyBorrowing > 15B` schalten die Tech-Slots nicht ab, um Liquiditäts-Rallyes in Big-Tech wie im März 2023 nicht zu verpassen).*
   * **Aktion (Universeller SignalEngine-Schutzschild bei ROT):** Ausnahmslose **100 % Notfall-Evakuierung aller 7 Slots in 50 % Gold (`GLD`) und 50 % USD-Cash**. Das Tech-Portfolio wird bei echtem Kreditstress vollständig gegen den Bärenmarkt abgedichtet.
   * **Sparplan-Anpassung:** Die monatliche Sparrate wird temporär defensiv aufgeteilt in **50 % Gold** und **50 % Cash**.
   * > [!TIP]
     > **Empirischer Beweis (Zinsschock 2022):**  
     > Im brutalen Tech-Bärenmarkt 2022 erzielte der 100 % Schutzschild einen Enddepotwert von **63.714,00 € (+243,47 %)** – das sind **+7.409 € Mehrertrag** gegenüber dem alten 25 %-Teil-Gold-Guard (56.305 €) und **+11.002 € Mehrertrag (+59,31 %-Punkte höhere Rendite)** gegenüber ungehedgtem Buy & Hold (52.712 €)!

2. **Deaktivierung (Duales Re-Entry-System: Reguläre Hysterese vs. antizyklischer Bottom-Finder):**
   * **Pfad 1 (Reguläre Hysterese):** Das 8-Wochen-Delta der Net Fed Liquidity erholt sich nachhaltig auf **$\ge 0,0\,\%$** (die Liquiditätskontraktion durch Notenbank und Treasury ist beendet).
     * *Anti-Whipsaw-Filter:* Liegt das 8-Wochen-Delta zwischen $-5,0\,\%$ und $0,0\,\%$, bleibt der Schutzschirm aktiv.
   * **Pfad 2 (Vorzeitiger Panic-Capitulation-Sniper am Marktboden):**  
     Schlägt während des aktiven Schutzschirms der [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) an ($\text{VIX} \ge 35$, CBOE Put/Call-Options-Spike $\ge 1{,}5\times$, bullische RSI-Divergenz) oder meldet [`SmartDumbMoneyBottomIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/SmartDumbMoneyBottomIndicator.js) Kapitulation ($\text{VIX} > 40$, $\text{AAII} < -25\,\%$, $\text{DIX} > 45\,\%$):
     * Der Schutzschirm wird **sofort am Panik-Tiefpunkt aufgelöst**, ohne monatelang auf die nachhinkende Net-Liquidity-Erholung der Fed zu warten!
   * **Aktion:** Das gesamte Gold und Cash wird zu 100 % aufgelöst und der Erlös fließt **vollständig gleichmäßig zurück in die 7 Tech-Slots**. Die laufende Sparrate fließt ab sofort wieder zu 100 % in Tech.

---

## 6. Aktueller Soll-Zustand des Portfolios (Ist-Stand 2026)

Alle 7 Slots sind aktuell belegt und durch mindestens zwei Manager bestätigt:

| Slot | Ticker | Unternehmen | Bestätigte Halter (unter den 6) | Soll-Gewichtung | Anteil an 100 € Sparrate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **MSFT** | Microsoft Corp. | Laffont (Coatue), Coleman (Tiger Global), Tepper (Appaloosa) | 14,29 % | 14,29 € |
| **2** | **AMZN** | Amazon.com Inc. | Druckenmiller (Duquesne), Tepper (Appaloosa), Laffont (Coatue) | 14,29 % | 14,29 € |
| **3** | **GOOGL**| Alphabet Inc. | Tepper (Appaloosa), Laffont (Coatue), Gerstner (Altimeter) | 14,28 % | 14,28 € |
| **4** | **META** | Meta Platforms Inc. | Druckenmiller (Duquesne), Gerstner (Altimeter), Tepper (Appaloosa) | 14,29 % | 14,29 € |
| **5** | **TSM**  | Taiwan Semiconductor | Laffont (Coatue), Druckenmiller (Duquesne) | 14,28 % | 14,28 € |
| **6** | **NVDA** | Nvidia Corp. | Coleman (Tiger Global), Schreiber (PointState), Laffont (Coatue) | 14,29 % | 14,29 € |
| **7** | **NOW**  | ServiceNow Inc. | Coleman (Tiger Global), Laffont (Coatue) | 14,28 % | 14,28 € |

---

## 7. Die operative Routine (Zwei feste Termine)

1. **Wöchentlich jeden Freitag oder Samstag (2 Minuten auf FRED & CrashRadar):**  
   Nach der wöchentlichen Aktualisierung der Fed-Bilanz (Donnerstagabend) die Druckenmiller-Formel ablesen (`WALCL - WTREGEN - RRPONTSYD`), das 8-Wochen-Delta sowie die High-Yield Credit Spreads (`BAMLH0A0HYM2`) prüfen:
   * **NetLiq-Delta < -5,0 % UND Credit Spreads > 4,0 % (über SMA 50):** Makro-Schutzschild aktivieren (100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash; Sparrate zu 50 % Gold / 50 % Cash).
   * **Re-Entry Pfad A (Regulär):** NetLiq-Delta $\ge 0,0\,\%$ $\rightarrow$ Schutzschild deaktivieren (Gold & Cash zu 100 % in Tech auflösen; Sparrate zu 100 % Tech).
   * **Re-Entry Pfad B (Antizyklischer Panic Sniper am Tiefstkurs):** Schlägt [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) ($\text{VIX} \ge 35$, CBOE Spike, RSI-Divergenz) während aktivem Schutzschild an $\rightarrow$ Schutzschild sofort am Tiefpunkt auflösen und 100 % in die 7 Tech-Slots reinvestieren!
   * **Zwischen -5,0 % und 0,0 % (ohne Panic Sniper):** Keinerlei Aktion nötig – bestehenden Zustand diszipliniert beibehalten (Anti-Whipsaw).
2. **Quartalsweise (15 Minuten am 16. Feb, Mai, Aug, Nov auf Dataroma):**  
   * **Ausstiegs-Check:** Halten alle aktuellen Positionen noch mindestens 2 Halter unter den 6 Managern? Fällt einer unter 2 Halter $\rightarrow$ Verkauf zu 100 % und Rebalancing.
   * **Aufnahme- & Verdrängungs-Check:** Gibt es neue Technologie-Aktien mit mindestens 2 aktiven Käufern? Bei freien Slots $\rightarrow$ Aufnahme. Bei vollen 7 Slots $\rightarrow$ Prüfung des 3-Stufen-Base-Schutzes (Verdrängung nur bei $\ge 3$ Neukäufern, $\le 2$ passiven Althaltern und Alttitel unter SMA 200).
   * **Gremiums-Check:** Sind alle 6 Stamm-Manager weiterhin aktiv und 13F-meldepflichtig? Falls einer dauerhaft ausfällt $\rightarrow$ Nachrücken des nächsten Kandidaten von der Warteliste.

---

## 8. Empirischer Proof of Concept (PoC) & Simulations-Code

Die quantitative Machbarkeit und historische Überlegenheit des Regelwerks wurde in einer echten Backtest-Simulation über den Zeitraum **01.01.2023 bis heute** nachgewiesen:

* 💻 **Basis-Simulation (2023 bis heute):** [`SevenSlotGuruSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/SevenSlotGuruSimulation.js)  
* 💻 **Multi-Krisen Stresstest (2018–2026):** [`MultiCrisisStressTest.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/MultiCrisisStressTest.js)  
  *(Beide gespiegelt abgelegt unter `scratch/architecture/strategies/` gemäß Spiegel-Disziplin)*

### A. Basis-Simulation (01.01.2023 bis heute – Bullenmarkt-Regime)
* **Rahmendaten:** 10.000 € Startkapital (Pfad A, 3 Monatstranchen) + 150 €/Monat Sparrate | Gesamteinzahlung: 16.750 €
* **Endwert (7-Slot-Portfolio):** **58.844,94 € (+251,31 % / +42.094,94 € Reingewinn)**
* **Benchmark (QQQ Buy & Hold):** **36.403,11 € (+117,33 %)** $\rightarrow$ **+133,98 %-Punkte Alpha**
* **Disziplin-Nachweis:** Im September 2025 notierten High-Yield Credit Spreads bei entspannten 2,70 % (weit unter 4,0 % und unter SMA 50). Der Kreditstress-Filter blockierte den rein administrativen TGA-Steuereffekt zuverlässig als Rauschen – das Portfolio blieb ununterbrochen zu 100 % in Tech investiert und hält heute **97,77 Nvidia-Aktien**.

### B. Multi-Krisen Härtetest (100 % Schutzschild an historischen Hochpunkten)
Gleiche Parameter (10.000 € Start + 150 € Sparrate) an den drei brutalsten Hochpunkten der modernen Geschichte gestartet:
1. **Zinsschock 2022 (Start 03.01.2022 am absoluten Allzeithoch vor -35 % Tech-Crash):**  
   * Eingezahlt: 18.550 € | **Endwert heute: 63.714,00 € (+243,47 %)** vs. QQQ: 35.265,32 € (+90,11 %) $\rightarrow$ **+153,36 %-Punkte Alpha**
   * *100 % Schutzschild-Effekt:* Stoppte den freien Fall bei Meta (-70 %) & Nvidia (-65 %) durch Evakuierung in 50 % Gold / 50 % Cash. Erzielt **+7.409 € Mehrertrag** gegenüber dem 25 % Teil-Gold-Guard (56.305 €) und **+11.002 € Mehrertrag** gegenüber ungehedgtem Buy & Hold (52.712 €).
2. **Corona-Crash 2020 (Start 19.02.2020 am Allzeithoch vor -35 % Blitz-Crash):**  
   * Eingezahlt: 22.000 € | **Endwert heute: 120.944,10 € (+449,75 %)** vs. QQQ: 59.844,69 € (+172,02 %) $\rightarrow$ **+277,72 %-Punkte Alpha**
3. **QT-Crash 2018 (Start 01.10.2018 am Hoch vor -23 % Einbruch):**  
   * Eingezahlt: 24.400 € | **Endwert heute: 194.714,36 € (+698,01 %)** vs. QQQ: 79.573,63 € (+226,12 %) $\rightarrow$ **+471,89 %-Punkte Alpha** (+8.102 € Mehrertrag vs. 25 % Gold).