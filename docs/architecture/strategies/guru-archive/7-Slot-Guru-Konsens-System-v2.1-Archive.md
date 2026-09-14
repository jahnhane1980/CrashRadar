# [ARCHIVIERT] 7-Slot-Guru-Konsens-System (Version 2.1)

> ⚠️ **Status: HISTORISCHES ARCHIV (Archiviert am 14.09.2026)**  
> Dieses Dokument stellt den historischen Vorgänger-Entwurf (Version 2.1) dar.  
> Es wurde durch das aktuelle Master-Konzept abgelöst:  
> 📄 **Aktuelle Version 3.0:** [`docs/architecture/strategies/7-Slot-Guru-Konsens-System.md`](file:///D:/GitHub/CrashRadar/docs/architecture/strategies/7-Slot-Guru-Konsens-System.md)  
> *Grund der Ablösung:* Überwindung des rein additiven Zähl-Konsens (Klumpenrisiko-Blindheit) durch die Dual-Engine-Governance, Geopolitische Whitelist (China-Ausschluss), Vetoed-No-Rebuy am Marktboden und SEC 13F Signature-Block Nachfolger-Überwachung.

---

# Masterplan: Das 7-Slot-Guru-Konsens-System (Tech-Fokus) – Version 2.1

Dieses Dokument ist die verbindliche Fassung (Version 2.1). Es integriert die Druckenmiller Net Fed Liquidity Formel als alleinigen mathematischen Auslöser für das Makro-Rebalancing (50 % Gold / 50 % Cash), während die Einzeltitel-Ausstiege strikt über den 13F-Konsens (>= 2 Halter) gesteuert werden.

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
  + Sparplan ab Tag 1 (100 % Tech).            Bei Liquiditätsalarm: 50 % Gold / 50 % Cash.
                                               Sparrate: 50 % Cash / 50 % Gold.
```

* **Pfad-B-Regeln im Detail:**
  * *Normalzustand:* 100 % Cash auf dem Verrechnungskonto. Die monatliche Sparrate fließt zu 100 % in Cash (Aufbau von trockenem Pulver).
  * *Bei Liquiditätsalarm (Net Liquidity 8-Wochen-Delta < -5 %):* Exakt 50 % des gesamten Cash-Bestands werden in physisch hinterlegtes Gold (z. B. Xetra-Gold ETC) getauscht, 50 % verbleiben als Cash. Die laufende Sparrate wird ab diesem Zeitpunkt zu 50 % Cash und 50 % Gold angespart.
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
* **Slot-Nachrücker-Priorität bei freien Plätzen (3-Stufen-Tiebreaker):**
  Wird ein Slot frei (z. B. durch Ausstieg eines Titels wie ServiceNow oder bei Neukonstituierung) und qualifizieren sich mehrere Technologie-Aktien (jeweils mindestens 2 aktive Käufer im Quartal), entscheidet die folgende 3-Stufen-Priorität über die Vergabe des freien Slots:
  1. *Stufe 1 – Breitester Guru-Konsens (Halterzahl):* Die Aktie mit der **höchsten Gesamtzahl an Haltern** unter den 6 Stamm-Managern erhält den Vorzug.
  2. *Stufe 2 – Höchste Zukaufs-Dynamik (Aktive Käufer):* Bei Gleichstand entscheidet die **Anzahl der aktiven Käufer** im jüngsten Quartal (wer hat die stärkste frische Nachfrage).
  3. *Stufe 3 – Größtes Kapital-Engagement (Marktwert):* Bei erneutem Gleichstand entscheidet das **aggregierte investierte Portfoliovolumen (Market Value in USD)** der Manager in dieser Position.
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
| **6** | **NVDA** | Nvidia Corp. | Gerstner (Altimeter), Laffont (Coatue), Coleman (Tiger Global) | 14,29 % | 14,29 € |
| **7** | **LRCX** | Lam Research Corp. | Laffont (Coatue), Gerstner (Altimeter), Druckenmiller (Duquesne), Tepper (Appaloosa), Schreiber (PointState) | 14,28 % | 14,28 € |

---

## 7. Die operative Routine (Zwei feste Termine)

1. **Wöchentlich jeden Freitag oder Samstag (2 Minuten auf FRED & CrashRadar):**  
   Nach der wöchentlichen Aktualisierung der Fed-Bilanz (Donnerstagabend) die Druckenmiller-Formel ablesen (`WALCL - WTREGEN - RRPONTSYD`), das 8-Wochen-Delta sowie die High-Yield Credit Spreads (`BAMLH0A0HYM2`) prüfen:
   * **NetLiq-Delta < -5,0 % UND Credit Spreads > 4,0 % (über SMA 50):** Makro-Schutzschild aktivieren (100 % Notfall-Evakuierung in 50 % Gold / 50 % Cash; Sparrate zu 50 % Gold / 50 % Cash).
   * **Re-Entry Pfad A (Regulär):** NetLiq-Delta $\ge 0,0\,\%$ $\rightarrow$ Schutzschild deaktivieren (Gold & Cash zu 100 % in Tech auflösen; Sparrate zu 100 % Tech).
   * **Re-Entry Pfad B (Antizyklischer Panic Sniper am Tiefstkurs):** Schlägt [`PanicCapitulationIndicator.js`](file:///D:/GitHub/CrashRadar/src/analysis/indicators/PanicCapitulationIndicator.js) an $\rightarrow$ Schutzschild sofort am Tiefpunkt auflösen und 100 % in die 7 Tech-Slots reinvestieren!
2. **Quartalsweise (15 Minuten am 16. Feb, Mai, Aug, Nov auf Dataroma):**  
   * **Ausstiegs-Check:** Halten alle aktuellen Positionen noch mindestens 2 Halter unter den 6 Managern? Fällt einer unter 2 Halter $\rightarrow$ Verkauf zu 100 % und Rebalancing.
   * **Aufnahme- & Verdrängungs-Check:** Gibt es neue Technologie-Aktien mit mindestens 2 aktiven Käufern? Bei freien Slots $\rightarrow$ Aufnahme.

---

## 8. Empirischer Proof of Concept (PoC) & Simulations-Code

* 💻 **Basis-Simulation (2023 bis heute):** [`SevenSlotGuruSimulation.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/SevenSlotGuruSimulation.js)  
* 💻 **Multi-Krisen Stresstest (2018–2026):** [`MultiCrisisStressTest.js`](file:///D:/GitHub/CrashRadar/scratch/architecture/strategies/MultiCrisisStressTest.js)  
