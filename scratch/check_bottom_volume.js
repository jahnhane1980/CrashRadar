import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

async function check() {
    const repo = new AnalysisRepository(process.env.DATABASE_URL);
    const data = await repo.getOhlcvForTicker('SPY', '2015-01-01');
    
    const withSma = [];
    for(let i=0; i<data.length; i++) {
        let smaVol = null;
        if(i >= 14) {
            let sum = 0;
            for(let j=i-14; j<i; j++) sum += Number(data[j].volume);
            smaVol = sum / 14;
        }
        const d = typeof data[i].date === 'string' ? data[i].date : data[i].date.toISOString().split('T')[0];
        withSma.push({
            date: d,
            close: data[i].close,
            volume: Number(data[i].volume),
            smaVol: smaVol
        });
    }

    const bottoms = ['2018-12-24', '2020-03-23', '2022-10-12'];
    
    for (const b of bottoms) {
        // Find exact date or closest surrounding days to see the spike
        const idx = withSma.findIndex(r => r.date === b);
        if (idx !== -1 && withSma[idx].smaVol) {
            const row = withSma[idx];
            const ratio = row.volume / row.smaVol;
            console.log(`Bottom ${b}: Ratio an dem Tag = ${ratio.toFixed(2)}x (Vol: ${row.volume}, Avg: ${Math.round(row.smaVol)})`);
            
            // Look for the max ratio around +/- 5 days
            let maxRatio = 0;
            let maxDay = null;
            for(let i=Math.max(0, idx-5); i<=Math.min(withSma.length-1, idx+5); i++) {
                 const r = withSma[i].volume / withSma[i].smaVol;
                 if (r > maxRatio) { maxRatio = r; maxDay = withSma[i].date; }
            }
            console.log(`   Höchster Volume-Spike im Umfeld (+/- 5 Tage): ${maxRatio.toFixed(2)}x am ${maxDay}`);
        }
    }
    
    await repo.close();
}
check();
