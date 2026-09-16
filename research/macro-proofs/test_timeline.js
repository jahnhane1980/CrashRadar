import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool(process.env.DATABASE_URL);

const CRASHES = [
    { name: 'Volmageddon 2018', start: '2018-07-01', end: '2018-12-31', intervalDays: 7 },
    { name: 'Corona Flash-Crash 2020', start: '2019-11-15', end: '2020-04-15', intervalDays: 7 },
    { name: 'Inflations-Bärenmarkt 2022', start: '2021-10-01', end: '2022-10-31', intervalDays: 14 },
    { name: 'KI-Crash 2025', start: '2024-11-19', end: '2025-04-30', intervalDays: 7 }
];

async function getMetricClosestToDate(table, dateCol, date, selectCols, additionalWhere = '', additionalParams = []) {
    const query = `SELECT ${selectCols} FROM ${table} WHERE ${dateCol} <= ? ${additionalWhere} ORDER BY ${dateCol} DESC LIMIT 1`;
    const [rows] = await pool.query(query, [date, ...additionalParams]);
    return rows.length > 0 ? rows[0] : null;
}

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

async function analyzeTimeline(crash) {
    console.log(`\n### Timeline: ${crash.name} (Intervall: ${crash.intervalDays} Tage)`);
    console.log(`| Datum | SPY | VIX | SKEW | DIX | AAII Spread | NAAIM |`);
    console.log(`|---|---|---|---|---|---|---|`);

    let currentDate = crash.start;
    while (currentDate <= crash.end) {
        // SPY
        const spyData = await getMetricClosestToDate('market_data_tiingo', 'record_date', currentDate, 'close', 'AND symbol = ?', ['SPY']);
        const spy = spyData ? parseFloat(spyData.close).toFixed(2) : '-';

        // VIX & SKEW
        const vixData = await getMetricClosestToDate('market_data_yahoo', 'record_date', currentDate, 'close', 'AND symbol = ?', ['^VIX']);
        const vix = vixData ? parseFloat(vixData.close).toFixed(2) : '-';
        
        const skewData = await getMetricClosestToDate('market_data_yahoo', 'record_date', currentDate, 'close', 'AND symbol = ?', ['^SKEW']);
        const skew = skewData ? parseFloat(skewData.close).toFixed(2) : '-';

        // DIX
        const dixData = await getMetricClosestToDate('market_data_dix', 'record_date', currentDate, 'dix');
        const dix = dixData ? (parseFloat(dixData.dix) * 100).toFixed(1) + '%' : '-';

        // AAII
        const aaiiData = await getMetricClosestToDate('market_data_aaii', 'record_date', currentDate, 'spread');
        const aaii = aaiiData ? (parseFloat(aaiiData.spread) * 100).toFixed(1) + '%' : '-';

        // NAAIM
        const naaimData = await getMetricClosestToDate('market_data_naaim', 'record_date', currentDate, 'exposure_index');
        const naaim = naaimData ? parseFloat(naaimData.exposure_index).toFixed(1) : '-';

        console.log(`| **${currentDate}** | $${spy} | ${vix} | ${skew} | ${dix} | ${aaii} | ${naaim} |`);
        
        currentDate = addDays(currentDate, crash.intervalDays);
    }
}

async function run() {
    for (const crash of CRASHES) {
        await analyzeTimeline(crash);
    }
    await pool.end();
}

run();
