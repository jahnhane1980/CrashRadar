import 'dotenv/config';
import mysql from 'mysql2/promise';

function findTrough(dataArray, startDate, endDate) {
    let minClose = Infinity;
    let minDate = null;
    let minIdx = -1;
    for(let i=0; i<dataArray.length; i++) {
        const d = dataArray[i];
        if (d.date >= startDate && d.date <= endDate) {
            if (d.close < minClose) {
                minClose = d.close;
                minDate = d.date;
                minIdx = i;
            }
        }
    }
    return { date: minDate, close: minClose, index: minIdx };
}

function processData(rows, isBTC = false) {
    return rows.map(r => {
        let dateStr;
        if (isBTC) {
            const d = new Date(Number(r.d));
            dateStr = d.toISOString().split('T')[0];
        } else {
            dateStr = r.d;
        }
        return { date: dateStr, close: r.close, volume: r.volume };
    });
}

const addSmaVol = (arr) => {
    for(let i=0; i<arr.length; i++) {
        let sum = 0;
        let count = 0;
        for(let j=Math.max(0, i-30); j<i; j++) {
            sum += arr[j].volume;
            count++;
        }
        arr[i].smaVol = count > 0 ? (sum / count) : arr[i].volume;
    }
};

function analyzeVolumeClimax(arr, troughInfo) {
    if (!troughInfo.date) return null;
    let maxSpikeRatio = 0;
    let climaxDate = null;
    let climaxVol = 0;
    let normalVol = 0;

    for(let i = Math.max(0, troughInfo.index - 2); i <= Math.min(arr.length - 1, troughInfo.index + 2); i++) {
        const day = arr[i];
        if (day.smaVol > 0) {
            const ratio = day.volume / day.smaVol;
            if (ratio > maxSpikeRatio) {
                maxSpikeRatio = ratio;
                climaxDate = day.date;
                climaxVol = day.volume;
                normalVol = day.smaVol;
            }
        }
    }
    return { climaxDate, ratio: maxSpikeRatio, climaxVol, normalVol };
}

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);
    
    const btcRows = await db.query(`SELECT open_time as d, close, volume FROM market_data_binance WHERE symbol = 'BTCUSDT' AND interval_type = '1d' ORDER BY open_time ASC`);
    const mstrRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'MSTR' ORDER BY record_date ASC`);
    const coinRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'COIN' ORDER BY record_date ASC`);
    const qqqRows = await db.query(`SELECT record_date as d, close, volume FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
    
    db.end();

    const btc = processData(btcRows[0], true);
    const mstr = processData(mstrRows[0]);
    const coin = processData(coinRows[0]);
    const qqq = processData(qqqRows[0]);

    addSmaVol(btc); addSmaVol(mstr); addSmaVol(coin); addSmaVol(qqq);

    const crashes = [
        { name: '2020 Corona-Crash', start: '2020-02-15', end: '2020-04-15' },
        { name: '2022 FTX/Celsius/Inflation', start: '2022-10-01', end: '2023-01-15' }
    ];

    console.log("=== Trough Timing & Nasdaq Einfluss ===");
    for (const c of crashes) {
        const tBtc = findTrough(btc, c.start, c.end);
        const tQqq = findTrough(qqq, c.start, c.end);
        const tMstr = findTrough(mstr, c.start, c.end);
        const tCoin = findTrough(coin, c.start, c.end);

        console.log(`\n[${c.name}]`);
        console.log(`BTC Bottom:  ${tBtc.date}`);
        console.log(`QQQ Bottom:  ${tQqq.date}`);
        console.log(`MSTR Bottom: ${tMstr.date}`);
        if(tCoin.date) console.log(`COIN Bottom: ${tCoin.date}`);

        // QQQ Volume Climax
        const qqqClimax = analyzeVolumeClimax(qqq, tQqq);
        console.log(`QQQ Volume Climax: Spike Ratio ${(qqqClimax.ratio*100).toFixed(0)}% am ${qqqClimax.climaxDate}`);
        
        // BTC Absolute Volume
        const btcDay = btc[tBtc.index];
        console.log(`BTC Absolutes Volumen am Tiefpunkt (${tBtc.date}): ${Number(btcDay.volume).toLocaleString('de-DE')} BTC (30D-Schnitt: ${Number(btcDay.smaVol).toLocaleString('de-DE')} BTC)`);
    }

}

main().catch(console.error);
