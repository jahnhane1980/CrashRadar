import 'dotenv/config';
import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';

function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    const rsiArr = new Array(prices.length).fill(null);
    rsiArr[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff >= 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        avgGain = ((avgGain * 13) + gain) / period;
        avgLoss = ((avgLoss * 13) + loss) / period;
        rsiArr[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    }
    return rsiArr;
}

function calculateSMA(prices, period) {
    const smaArr = new Array(prices.length).fill(null);
    for (let i = period - 1; i < prices.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += prices[i - j];
        }
        smaArr[i] = sum / period;
    }
    return smaArr;
}

function calculateROC(prices, period) {
    const rocArr = new Array(prices.length).fill(null);
    for (let i = period; i < prices.length; i++) {
        if (prices[i - period]) {
            rocArr[i] = ((prices[i] - prices[i - period]) / prices[i - period]) * 100;
        }
    }
    return rocArr;
}

async function run() {
    console.log("Loading data from Database...");
    const dbUrl = process.env.DATABASE_URL;
    const repo = new AnalysisRepository(dbUrl);
    
    const rawData = await repo.getAllRawData('2023-01-01');
    const tiingo = rawData.tiingo;
    
    // Group by date
    const datesSet = new Set(tiingo.map(d => {
        const dt = new Date(d.date);
        return dt.toISOString().split('T')[0];
    }));
    const dates = Array.from(datesSet).sort();
    
    console.log(`Loaded ${dates.length} days of data.`);
    
    const spyPrices = [];
    const qqqPrices = [];
    
    let lastSpy = null;
    let lastQqq = null;
    
    for (const d of dates) {
        const rowSpy = tiingo.find(x => x.symbol === 'SPY' && new Date(x.date).toISOString().split('T')[0] === d);
        if (rowSpy) lastSpy = rowSpy.close;
        spyPrices.push(lastSpy);
        
        const rowQqq = tiingo.find(x => x.symbol === 'QQQ' && new Date(x.date).toISOString().split('T')[0] === d);
        if (rowQqq) lastQqq = rowQqq.close;
        qqqPrices.push(lastQqq);
    }
    
    const spyRSI = calculateRSI(spyPrices, 14);
    const qqqRSI = calculateRSI(qqqPrices, 14);
    
    const spySMA50 = calculateSMA(spyPrices, 50);
    const qqqSMA50 = calculateSMA(qqqPrices, 50);
    
    const spySMA200 = calculateSMA(spyPrices, 200);
    const qqqSMA200 = calculateSMA(qqqPrices, 200);
    
    const spyROC = calculateROC(spyPrices, 20);
    const qqqROC = calculateROC(qqqPrices, 20);
    
    const targetDates = ['2023-12-12', '2024-01-17', '2024-05-16', '2024-11-18'];
    
    console.log("\n--- Metrics for False Alarms ---");
    dates.forEach((date, i) => {
        if (targetDates.includes(date)) {
            console.log(`\nDate: ${date}`);
            
            if (spyPrices[i] && spySMA50[i] && spySMA200[i]) {
                const spyDist50 = ((spyPrices[i] - spySMA50[i]) / spySMA50[i]) * 100;
                const spyDist200 = ((spyPrices[i] - spySMA200[i]) / spySMA200[i]) * 100;
                console.log(`  SPY: Price=${spyPrices[i].toFixed(2)}, RSI=${spyRSI[i]?.toFixed(1)}, ROC20=${spyROC[i]?.toFixed(1)}%, DistSMA50=${spyDist50.toFixed(2)}%, DistSMA200=${spyDist200.toFixed(2)}%`);
            }
            
            if (qqqPrices[i] && qqqSMA50[i] && qqqSMA200[i]) {
                const qqqDist50 = ((qqqPrices[i] - qqqSMA50[i]) / qqqSMA50[i]) * 100;
                const qqqDist200 = ((qqqPrices[i] - qqqSMA200[i]) / qqqSMA200[i]) * 100;
                console.log(`  QQQ: Price=${qqqPrices[i].toFixed(2)}, RSI=${qqqRSI[i]?.toFixed(1)}, ROC20=${qqqROC[i]?.toFixed(1)}%, DistSMA50=${qqqDist50.toFixed(2)}%, DistSMA200=${qqqDist200.toFixed(2)}%`);
            }
        }
    });

    await repo.close();
}

run().catch(console.error);
