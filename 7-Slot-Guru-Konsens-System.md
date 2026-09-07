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

Der Kapitalstart erfolgt über eine dreiteilige Makro-Ampel, um weder blind an zyklischen Höchstständen einzusteigen noch monatelang tatenlos auf eine Korrektur zu warten:

1. **2-Year US Treasury Yield:** Sinkt oder konsolidiert seitwärts (kein akuter Zinsstraffungszyklus).
2. **High-Yield Credit Spreads (BAMLH0A0HYM2):** Unter 3,5 % bis 4,0 % (Kreditmärkte liquide, keine Panik).
3. **Bullenmarkt-Alter:** Jünger als 2 Jahre seit dem letzten 20%-Korrekturtief.

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
  Kein Warten auf -10 % nötig.                 Strikter Cash-Standby.
  Geparktes Cash in 3 Monatstranchen           Kauf erst bei >= 10 % Nasdaq-Dip.
  + 100 € Sparplan ab Tag 1.                   (Bei Liquiditätsalarm: Gold-Guard aktiv).
```

---

## 4. Portfoliostruktur & Einzeltitel-Regelwerk

* **Kapazität:** Strikt **maximal 7 Slots**.
* **Aufnahmekriterium:** Eine Aktie muss von **mindestens 2 der 6 Manager** im Portfolio gehalten werden.
* **Gewichtung:** Gleichgewichtung aller belegten Slots (bei 7 Werten exakt **14,29 % pro Slot**). Bei weniger als 7 Titeln wird das Kapital gleichmäßig auf die aktiven Werte verteilt.
* **Monatlicher Sparplan:** 100 € fließen monatlich gleichmäßig aufgeteilt in die aktuell aktiven Slots.
* **Ausstieg bei Einzeltiteln (Reine 13F-Regel):**
  * Fällt ein Wert bei der vierteljährlichen 13F-Prüfung unter die Mindestschwelle von 2 Haltern, wird die Position **zu 100 % verkauft**.
  * Der Erlös wird per Rebalancing gleichmäßig auf die verbleibenden aktiven Slots verteilt bzw. für einen Neuzugang reserviert.
  * Keine spekulativen vorzeitigen Verkäufe anhand unvollständiger Quartalsergebnisse oder Medienberichte.

---

## 5. Das Makro-Rebalancing: Die Druckenmiller-Liquiditäts-Regel (25 % Gold-Guard)

Das Gesamtdepot wird nicht über Einzelaktien-Notbremsen, sondern auf Portfolio-Ebene über Druckenmillers mathematische Liquiditätsformel abgesichert:

Net Fed Liquidity = WALCL (Fed-Bilanzsumme) - WTREGEN (TGA Treasury Account) - RRPONTSYD (Reverse Repo)

```
                      [Wöchentlicher FRED-Check]
             Net Fed Liquidity = WALCL - WTREGEN - RRPONTSYD
                                     |
                  Fällt die Net Liquidity über 8 Wochen
                            um MEHR als 5 %?
                                     |
               +---------------------+---------------------+
              JA                                          NEIN
               |                                           |
     [25 % Gold-Guard AKTIV]                      [Normalzustand: 100 % Tech]
  Aus allen 7 Slots werden 25 %                Alle 7 Slots voll besetzt.
  entnommen und in Gold umgeschichtet.         Laufende Sparrate zu 100 %
  Sparplan: 75 € Tech / 25 € Gold.             in die 7 Tech-Aktien.
```

### Die beiden Phasen des Rebalancings

1. **Aktivierung (Der Schutz-Schirm):**
   * *Bedingung:* Die Net Fed Liquidity fällt über einen Zeitraum von 8 aufeinanderfolgenden Wochen um **mehr als 5,0 %** (Signal für systemischen Liquiditätsentzug durch Notenbank und Finanzministerium).
   * *Aktion:* Aus **allen 7 Slots werden pauschal 25 % des Kapitals pro rata entnommen** und in physisch hinterlegtes Gold (z. B. Xetra-Gold ETC) umgeschichtet.
   * *Sparplan-Anpassung:* Die monatliche Rate wird temporär aufgeteilt in **75 € Tech** (auf die aktiven Slots) und **25 € Gold**.

2. **Deaktivierung (Der Reinvestitions-Kauf):**
   * *Bedingung:* Die Net Fed Liquidity stabilisiert sich (zwei aufeinanderfolgende Messungen ohne neuen Tiefstand) oder steigt wieder an (Signal für Zinspause oder Liquiditätsspritze).
   * *Aktion:* Die **gesamte Gold-Position wird zu 100 % aufgelöst**.
   * *Reinvestition:* Der Erlös fließt vollständig zurück in die 7 Tech-Slots (Kauf zu Bärenmarkt-Tiefstkursen). Der Sparplan kehrt zu 100 % Tech zurück.

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

1. **Monatlich / Wöchentlich (2 Minuten auf FRED):**  
   Druckenmiller-Formel ablesen (`WALCL - WTREGEN - RRPONTSYD`). Fällt der Wert über 8 Wochen um mehr als 5 %?  
   * Nein: Nichts tun (100 % Tech läuft weiter).  
   * Ja: 25 % Gold-Guard aktivieren.
2. **Quartalsweise (15 Minuten am 16. Feb, Mai, Aug, Nov auf Dataroma):**  
   Prüfen, ob alle 7 Titel weiterhin mindestens 2 Halter unter den 6 Managern haben. Fällt einer raus -> Verkauf zu 100 % und Rebalancing.