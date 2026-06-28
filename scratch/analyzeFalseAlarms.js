import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    const repo = new AnalysisRepository(dbUrl);
    
    // Wir holen uns die Rohdaten ab 2021
    const rawData = await repo.getAllRawData('2021-01-01');
    const { fred, tga, yahoo, tiingo } = rawData;
    
    const targetDates = [
        // Real Crashes
        { date: '2022-01-03', type: 'TRUE CRASH (Inflation)' },
        { date: '2025-02-19', type: 'TRUE CRASH (Tech)' },
        // False Alarms
        { date: '2023-12-12', type: 'FALSE ALARM' },
        { date: '2024-01-17', type: 'FALSE ALARM' },
        { date: '2024-05-16', type: 'FALSE ALARM' },
        { date: '2024-11-18', type: 'FALSE ALARM' }
    ];
    
    const getVal = (array, dateStr, symbolOrIdKey, symbolOrIdVal, valKey) => {
        // Find closest date before or equal
        let best = null;
        for (const row of array) {
            const rDate = new Date(row.date).toISOString().split('T')[0];
            if (rDate <= dateStr && row[symbolOrIdKey] === symbolOrIdVal) {
                best = row[valKey];
            }
        }
        return best;
    };
    
    console.log("--- MACRO CONDITIONS COMPARISON ---");
    
    for (const target of targetDates) {
        const d = target.date;
        const nfci = getVal(fred, d, 'series_id', 'NFCI', 'value');
        const dxy = getVal(yahoo, d, 'symbol', 'DX-Y.NYB', 'close');
        
        // TGA Change (30 Tage)
        const dMinus30Obj = new Date(d);
        dMinus30Obj.setDate(dMinus30Obj.getDate() - 30);
        const dMinus30 = dMinus30Obj.toISOString().split('T')[0];
        
        let tgaCurrent = null;
        for (const row of tga) {
            const rDate = new Date(row.date).toISOString().split('T')[0];
            if (rDate <= d) {
                tgaCurrent = row.close_balance !== 'null' ? row.close_balance : row.open_balance;
            }
        }
        
        let tgaPast = null;
        for (const row of tga) {
            const rDate = new Date(row.date).toISOString().split('T')[0];
            if (rDate <= dMinus30) {
                tgaPast = row.close_balance !== 'null' ? row.close_balance : row.open_balance;
            }
        }
        
        let tgaChange = "N/A";
        if (tgaCurrent && tgaPast) {
            tgaChange = ((tgaCurrent - tgaPast) / 1000).toFixed(0) + "B"; // in Milliarden
        }
        
        // Corporate Profits (CP)
        const cp = getVal(fred, d, 'series_id', 'CP', 'value');
        
        console.log(`\n[${target.type}] ${d}:`);
        console.log(`  NFCI (System Stress): ${nfci} (Werte < 0 bedeuten lockeres Geld/wenig Stress)`);
        console.log(`  DXY (Dollar): ${dxy ? dxy.toFixed(2) : 'N/A'}`);
        console.log(`  TGA Change (30d): ${tgaChange} (Negativ = Yellen pumpt Geld in den Markt)`);
        console.log(`  Corp Profits (CP): ${cp ? cp : 'N/A'} Milliarden`);
    }

    await repo.close();
}

run().catch(console.error);
