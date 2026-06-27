import ky from 'ky';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export class CboeFetchAdapter {
    constructor() {
        this.api = ky.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Origin': 'https://www.cboe.com',
                'Referer': 'https://www.cboe.com/us/options/market_statistics/historical_data/'
            },
            timeout: 60000
        });
    }

    async fetch(task, provider, startValue) {
        const fromDateStr = startValue || '2024-01-01'; 
        const toDateStr = new Date().toISOString().split('T')[0];

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
            responseText = await this.api.get(url, { searchParams }).text();
        } catch (e) {
            console.error(`[CboeFetchAdapter] Fehler beim Abruf von ${task.ticker}: ${e.message}`);
            return [];
        }

        if (!responseText || responseText.trim().length === 0 || responseText.includes('No data found')) {
            console.log(`[CBOE] Keine Daten für ${task.ticker} im Zeitraum (${fromDateStr} bis ${toDateStr}) gefunden.`);
            return [];
        }

        // CSV lokal archivieren (Ansatz A - Audit-Trail)
        const archiveDir = path.resolve(process.cwd(), 'data/archive/cboe');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        
        const fileName = `${task.ticker}_${fromDateStr}_to_${toDateStr}.csv`;
        fs.writeFileSync(path.join(archiveDir, fileName), responseText, 'utf8');
        console.log(`[CBOE] CSV gesichert unter: ${path.join('data/archive/cboe', fileName)}`);

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
