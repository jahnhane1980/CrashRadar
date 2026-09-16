import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

function getNYTimeString(dateObj) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(dateObj);
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    return `${h}:${m}`;
}

function getNYDateString(dateObj) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(dateObj);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
}

async function aggregateSymbolM5(connection, symbol) {
    const cacheFile = path.join(CACHE_DIR, `${symbol.toLowerCase()}_m5_rth_aggregated.json`);
    if (fs.existsSync(cacheFile)) {
        console.log(`[CACHE] ${symbol}: Bereits vorhanden in ${cacheFile}`);
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }

    console.log(`[DB] Lade M5 für ${symbol}...`);
    const [rows] = await connection.query(`
        SELECT record_time, open, high, low, close, volume
        FROM market_data_m5
        WHERE symbol = ?
        ORDER BY record_time ASC;
    `, [symbol]);

    console.log(`[DB] ${symbol}: ${rows.length} Kerzen geladen. Aggregiere RTH Sessions (09:30-16:00 ET)...`);
    const daysMap = new Map();

    for (const r of rows) {
        const dObj = new Date(r.record_time);
        const nyDate = getNYDateString(dObj);
        const nyTime = getNYTimeString(dObj);

        if (nyTime < '09:30' || nyTime >= '16:00') continue;

        if (!daysMap.has(nyDate)) {
            daysMap.set(nyDate, {
                date: nyDate,
                candles: [],
                openCandles: [],
                closeCandles: [],
                midCandles: []
            });
        }

        const dayObj = daysMap.get(nyDate);
        const candle = {
            time: nyTime,
            open: parseFloat(r.open),
            high: parseFloat(r.high),
            low: parseFloat(r.low),
            close: parseFloat(r.close),
            volume: parseInt(r.volume, 10),
            isUp: parseFloat(r.close) >= parseFloat(r.open)
        };

        dayObj.candles.push(candle);
        if (nyTime < '11:00') dayObj.openCandles.push(candle);
        else if (nyTime >= '14:30') dayObj.closeCandles.push(candle);
        else dayObj.midCandles.push(candle);
    }

    const dailyData = [];
    for (const [d, day] of daysMap.entries()) {
        if (day.candles.length < 10) continue;

        const openPrice = day.candles[0].open;
        const closePrice = day.candles[day.candles.length - 1].close;
        let highPrice = -Infinity;
        let lowPrice = Infinity;
        let totalVolume = 0;
        let totalUpVol = 0;
        let totalDownVol = 0;

        for (const c of day.candles) {
            if (c.high > highPrice) highPrice = c.high;
            if (c.low < lowPrice) lowPrice = c.low;
            totalVolume += c.volume;
            if (c.isUp) totalUpVol += c.volume;
            else totalDownVol += c.volume;
        }

        let openVol = 0, openUpVol = 0, openDownVol = 0;
        for (const c of day.openCandles) {
            openVol += c.volume;
            if (c.isUp) openUpVol += c.volume;
            else openDownVol += c.volume;
        }

        let closeVol = 0, closeUpVol = 0, closeDownVol = 0;
        for (const c of day.closeCandles) {
            closeVol += c.volume;
            if (c.isUp) closeUpVol += c.volume;
            else closeDownVol += c.volume;
        }

        dailyData.push({
            date: d,
            open: openPrice,
            high: highPrice,
            low: lowPrice,
            close: closePrice,
            volume: totalVolume,
            pnlPct: parseFloat((((closePrice - openPrice) / openPrice) * 100).toFixed(2)),
            openWindow: {
                volume: openVol,
                volPct: parseFloat(((openVol / totalVolume) * 100).toFixed(1)),
                upVol: openUpVol,
                downVol: openDownVol,
                deltaPct: openVol > 0 ? parseFloat((((openUpVol - openDownVol) / openVol) * 100).toFixed(1)) : 0
            },
            closeWindow: {
                volume: closeVol,
                volPct: parseFloat(((closeVol / totalVolume) * 100).toFixed(1)),
                upVol: closeUpVol,
                downVol: closeDownVol,
                deltaPct: closeVol > 0 ? parseFloat((((closeUpVol - closeDownVol) / closeVol) * 100).toFixed(1)) : 0
            }
        });
    }

    dailyData.sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(cacheFile, JSON.stringify(dailyData, null, 2));
    console.log(`[DONE] ${symbol}: ${dailyData.length} Handelstage aggregiert in ${cacheFile}`);
    return dailyData;
}

async function main() {
    console.log("Verbinde mit DATABASE_URL...");
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    const symbols = ['PLTR', 'NVTS', 'IBRX', 'SOFI', 'S'];

    for (const sym of symbols) {
        await aggregateSymbolM5(connection, sym);
    }

    await connection.end();
    console.log("\nAlle Growth-M5 Daten erfolgreich aggregiert!");
}

main().catch(console.error);
