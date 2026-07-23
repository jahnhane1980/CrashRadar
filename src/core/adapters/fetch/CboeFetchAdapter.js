import ky from 'ky';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Logger } from '../../Logger.js';

export class CboeFetchAdapter {
    constructor() {
    }

    async fetch(task, provider, startValue, requestManager) {
        const fromDateStr = startValue || '2024-01-01'; 
        const toDateStr = new Date().toISOString().split('T')[0];

        if (task.dataset === 'pcr') {
            Logger.info(`[CBOE/Yahoo] Hole PCR Daten für den Markt (Zeitraum: ${fromDateStr} bis ${toDateStr})`);
            
            const results = [];

            // 1. Lokales Archiv lesen (Backtesting Historie)
            const archivePath = path.resolve(process.cwd(), 'data/archive/cboe/pcr.csv');
            if (fs.existsSync(archivePath)) {
                Logger.info(`[CBOE] Lese historische PCR-Daten aus lokalem Archiv: ${archivePath}`);
                const text = fs.readFileSync(archivePath, 'utf8');
                const recordsObj = parse(text, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                });
                
                if (recordsObj.length > 0) {
                    const parsedRecords = recordsObj.map(row => ({
                        record_date: row['record_date'] || row['Date'] || row['date'],
                        total_pcr: parseFloat(row['total_pcr'] || row['Total'] || row['value'] || row['Ratio'] || 0)
                    })).filter(r => r.record_date && !isNaN(r.total_pcr));
                    results.push(...parsedRecords);
                }
            }

            // 2. Live Daten über Yahoo Finance Optionskette (Future-Proof Proxy)
            try {
                Logger.info(`[YahooOptions] Berechne tagesaktuelles SPY Put/Call Ratio...`);
                // Dynamischer Import, um Abhängigkeiten sauber zu halten
                const YahooFinance = (await import('yahoo-finance2')).default;
                const yahooFinance = new YahooFinance();
                
                const optionResult = await yahooFinance.options('SPY');
                if (optionResult && optionResult.options && optionResult.options.length > 0) {
                    let totalPutVol = 0;
                    let totalCallVol = 0;
                    
                    // Wir summieren über die Optionen des ersten Verfallsdatums (oder wir könnten über alle summieren, aber options() liefert standardmäßig das nächste)
                    optionResult.options[0].puts.forEach(p => totalPutVol += (p.volume || 0));
                    optionResult.options[0].calls.forEach(c => totalCallVol += (c.volume || 0));

                    if (totalCallVol > 0) {
                        const calculatedPcr = totalPutVol / totalCallVol;
                        const latestDate = new Date().toISOString().split('T')[0];
                        Logger.info(`[YahooOptions] SPY PCR berechnet: ${calculatedPcr.toFixed(2)} (Puts: ${totalPutVol}, Calls: ${totalCallVol})`);
                        results.push({
                            record_date: latestDate,
                            total_pcr: calculatedPcr,
                            equity_pcr: calculatedPcr,
                            index_pcr: calculatedPcr
                        });
                    }
                }
            } catch(e) {
                Logger.error(`[YahooOptions] Fehler bei der PCR-Berechnung: ${e.message}`);
            }

            return results;
        }

        const url = 'https://www.cboe.com/us/options/market_statistics/historical_data/download/class/';
        
        const searchParams = {
            reportType: 'volume',
            volumeType: 'sum',
            volumeAggType: 'daily',
            symbolType: 'osiRoot', 
            symbol: task.ticker.toUpperCase(),
            startDate: fromDateStr,
            endDate: toDateStr,
            exchanges: 'CBOE'
        };

        let responseText;
        try {
            responseText = await requestManager.fetch(url, task.provider, { 
                searchParams,
                responseType: 'text',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Origin': 'https://www.cboe.com',
                    'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
                }
            });
        } catch (e) {
            Logger.error(`[CboeFetchAdapter] Fehler beim Abruf von ${task.ticker}: ${e.message}`);
            return [];
        }

        if (!responseText || responseText.trim().length === 0 || responseText.includes('No data found')) {
            Logger.info(`[CBOE] Keine Daten für ${task.ticker} im Zeitraum (${fromDateStr} bis ${toDateStr}) gefunden.`);
            return [];
        }

        // CSV lokal archivieren (Ansatz A - Audit-Trail)
        const archiveDir = path.resolve(process.cwd(), 'data/archive/cboe');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        
        const fileName = `${task.ticker}_${fromDateStr}_to_${toDateStr}.csv`;
        fs.writeFileSync(path.join(archiveDir, fileName), responseText, 'utf8');
        Logger.info(`[CBOE] CSV gesichert unter: ${path.join('data/archive/cboe', fileName)}`);

        const records = parse(responseText, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        return records.map(r => ({
            symbol: task.ticker,
            record_date: r['Trade Date'].replace(/\//g, '-'),
            volume: parseInt(r['Volume'], 10)
        }));
    }
}
