import fs from 'fs';
import { DefaultFeatureBuilder } from './DefaultFeatureBuilder.js';

export class FinraFeatureBuilder extends DefaultFeatureBuilder {
  constructor(ticker, repo, config) {
    super(ticker, repo, config);
    
    // Die neuen FINRA-Features aus der Default-Liste entfernen, 
    // damit der DefaultFeatureBuilder die Zeilen beim Validieren nicht droppt.
    this.finraFeatures = ["FINRA_Short_Ratio", "Inst_Ownership", "Share_Change_YoY", "FCF_Change_QoQ", "Revenue_Change_QoQ"];
    
    // Wir speichern die originale Liste für den finalen CSV-Header
    this.originalFeaturesToExtract = [...this.featuresToExtract];
    this.featuresToExtract = this.featuresToExtract.filter(f => !this.finraFeatures.includes(f));
  }

  async build() {
    // 1. Basis-CSV durch DefaultFeatureBuilder erstellen lassen (OHLCV + Indikatoren)
    const baseCsvPath = await super.build();
    
    console.log(`[FinraFeatureBuilder] Erweitere Datensatz für ${this.ticker} mit FINRA & Fundamentaldaten...`);

    // 2. FINRA und Fundamentaldaten laden (jetzt sauber über das Repository/DB)
    const finraDataMap = await this._loadFinraData(this.ticker);
    const fundamentals = await this._loadFundamentals(this.ticker);

    // 3. Basis-CSV einlesen und anpassen
    const csvContent = fs.readFileSync(baseCsvPath, 'utf8').trim().split('\n');
    const header = csvContent[0].split(',');
    
    // Label-Spalte finden und kurz entfernen, um die neuen Features davor zu setzen
    const labelIdx = header.indexOf('Label');
    if (labelIdx !== -1) {
        header.splice(labelIdx, 1);
    }
    
    // Neue Features hinzufügen
    for (const feat of this.finraFeatures) {
        header.push(feat);
    }
    if (labelIdx !== -1) header.push('Label');

    const newCsvLines = [header.join(',')];
    let chaosCount = 0;

    for (let i = 1; i < csvContent.length; i++) {
        if (!csvContent[i].trim()) continue;
        const row = csvContent[i].split(',');
        
        const date = row[0];
        const label = row[labelIdx];
        
        row.splice(labelIdx, 1); // Label am alten Index entfernen

        // 4. Werte zuweisen (mit 'UNKNOWN' Fallback für fehlende Tage / Wochenenden)
        let shortRatio = finraDataMap[date] !== undefined ? finraDataMap[date] : 'UNKNOWN';
        
        // Forward fill fundamentals: finde den aktuellsten Bericht <= date
        let latestFund = null;
        for (let j = fundamentals.length - 1; j >= 0; j--) {
            if (fundamentals[j].date <= date) {
                latestFund = fundamentals[j];
                break;
            }
        }
        
        // YoY und QoQ berechnen
        let instOwn = 'UNKNOWN';
        let shareChangeYoY = 'UNKNOWN';
        let fcfChangeQoQ = 'UNKNOWN';
        let revChangeQoQ = 'UNKNOWN';

        if (latestFund) {
            instOwn = latestFund.institutional_ownership !== null ? Number(latestFund.institutional_ownership).toFixed(4) : 'UNKNOWN';
            
            // Suche Quartal davor für QoQ (ca. 90 Tage)
            const dateObj = new Date(date);
            const date90dAgo = new Date(dateObj.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const date1yAgo = new Date(dateObj.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            let fund1y = null; // Für Shares (Punkt-Metrik) ist period egal
            for (let j = fundamentals.length - 1; j >= 0; j--) {
                if (fundamentals[j].date <= date1yAgo) { fund1y = fundamentals[j]; break; }
            }
            
            let fund90d_flow = null; // Für FCF/Revenue (Fluss-Metrik) muss period exakt matchen
            for (let j = fundamentals.length - 1; j >= 0; j--) {
                if (fundamentals[j].date <= date90dAgo && fundamentals[j].period === latestFund.period) { 
                    fund90d_flow = fundamentals[j]; 
                    break; 
                }
            }

            if (fund1y && fund1y.shareIssued && latestFund.shareIssued) {
                shareChangeYoY = (Number(latestFund.shareIssued) / Number(fund1y.shareIssued)).toFixed(4);
            }
            
            // QoQ-Deltas für Fluss-Metriken (nur sinnvoll, wenn wir einen matching period-Report gefunden haben,
            // und latestFund.period == '3M' ist.
            if (latestFund.period === '3M' && fund90d_flow) {
                if (latestFund.freeCashFlow !== null && fund90d_flow.freeCashFlow !== null) {
                    if (Number(fund90d_flow.freeCashFlow) !== 0) {
                        fcfChangeQoQ = ((Number(latestFund.freeCashFlow) - Number(fund90d_flow.freeCashFlow)) / Math.abs(Number(fund90d_flow.freeCashFlow))).toFixed(4);
                    } else {
                        fcfChangeQoQ = '0.0000';
                    }
                }
                if (latestFund.totalRevenue !== null && fund90d_flow.totalRevenue !== null) {
                    if (Number(fund90d_flow.totalRevenue) !== 0) {
                        revChangeQoQ = ((Number(latestFund.totalRevenue) - Number(fund90d_flow.totalRevenue)) / Math.abs(Number(fund90d_flow.totalRevenue))).toFixed(4);
                    } else {
                        revChangeQoQ = '0.0000';
                    }
                }
            }
        }

        // 5. CHAOS-TESTING (Modus aktiv, wenn CHAOS_TEST env gesetzt ist)
        if (process.env.CHAOS_TEST === 'true') {
            // 5% Wahrscheinlichkeit für zufällige UNKNOWN Ausfälle (Struktur-Chaos)
            if (Math.random() < 0.05) { shortRatio = 'UNKNOWN'; chaosCount++; }
            if (Math.random() < 0.05) { instOwn = 'UNKNOWN'; chaosCount++; }
            if (Math.random() < 0.05) { shareChangeYoY = 'UNKNOWN'; chaosCount++; }
            if (Math.random() < 0.05) { fcfChangeQoQ = 'UNKNOWN'; chaosCount++; }
            if (Math.random() < 0.05) { revChangeQoQ = 'UNKNOWN'; chaosCount++; }
            
            // Hartes Rauschen (Noise) auf existierende Ratios addieren (+/- 10%)
            if (shortRatio !== 'UNKNOWN') {
                const noise = (Math.random() * 0.2 - 0.1); 
                shortRatio = Math.max(0, parseFloat(shortRatio) + noise).toFixed(4);
            }
            
            // Division-by-Zero Test simulieren (Extremwerte)
            if (Math.random() < 0.01) {
                shortRatio = '0.0000'; // Darf im Netz nicht zu Infinity führen
            }
        }

        row.push(shortRatio);
        row.push(instOwn);
        row.push(shareChangeYoY);
        row.push(fcfChangeQoQ);
        row.push(revChangeQoQ);
        row.push(label); // Label ganz ans Ende

        newCsvLines.push(row.join(','));
    }

    // 6. Neue CSV überschreiben
    fs.writeFileSync(baseCsvPath, newCsvLines.join('\n'));
    console.log(`[FinraFeatureBuilder] ✅ FINRA-Features erfolgreich integriert!`);
    if (process.env.CHAOS_TEST === 'true') {
        console.log(`[FinraFeatureBuilder] 🌪️ CHAOS-TESTING AKTIV: ${chaosCount} synthetische Daten-Ausfälle generiert.`);
    }

    return baseCsvPath;
  }

  async _loadFinraData(ticker) {
      const finraMap = {};
      try {
          // Wir fragen das Repository nach den echten DB-Daten ab
          const rows = await this.repo.getFinraShortVolumeForTicker(ticker, '2015-01-01');
          for (const row of rows) {
              const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0];
              finraMap[dateStr] = Number(row.short_volume_ratio).toFixed(4);
          }
      } catch(e) {
          console.warn(`[FinraFeatureBuilder] Warnung: Fehler beim Lesen der FINRA Daten aus DB: ${e.message}`);
      }
      return finraMap;
  }

  async _loadFundamentals(ticker) {
      try {
          // Fundamentaldaten über Repository beziehen
          const funds = await this.repo.getFundamentalsForTicker(ticker);
          return funds || []; // is an array of timeseries objects now
      } catch(e) {
           console.warn(`[FinraFeatureBuilder] Warnung: Fehler beim Lesen der Fundamentals: ${e.message}`);
      }
      return [];
  }
}
