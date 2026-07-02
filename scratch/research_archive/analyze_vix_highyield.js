import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

const crashes = [
    { name: "Dotcom-Blase", peak: "2000-03-24" },
    { name: "Finanzkrise", peak: "2007-10-09" },
    { name: "Zins-Panik 2018", peak: "2018-09-20" },
    { name: "Corona-Crash", peak: "2020-02-19" },
    { name: "Inflations-Schock", peak: "2022-01-03" },
    { name: "Recent 2025 Crash", peak: "2025-02-19" }
];

// Helper to get closest value
function getVal(table, dateColumn, valColumn, symbolColumn, symbolValue, targetDate) {
    const q = symbolColumn 
        ? `SELECT ${valColumn} as val FROM ${table} WHERE ${symbolColumn} = ? AND ${dateColumn} <= ? ORDER BY ${dateColumn} DESC LIMIT 1`
        : `SELECT ${valColumn} as val FROM ${table} WHERE ${dateColumn} <= ? ORDER BY ${dateColumn} DESC LIMIT 1`;
    
    const stmt = db.prepare(q);
    const res = symbolColumn ? stmt.get(symbolValue, targetDate) : stmt.get(targetDate);
    return res ? res.val : null;
}

function getMetricAtOffset(targetDateStr, monthsOffset, table, dateCol, valCol, symCol, symVal) {
    const target = new Date(targetDateStr);
    target.setMonth(target.getMonth() + monthsOffset);
    const dateStr = target.toISOString().split('T')[0];
    return getVal(table, dateCol, valCol, symCol, symVal, dateStr);
}

console.log("=== Analyse: VIX und High Yield Spreads vor Crashs (-6, -3, Peak) ===\n");

crashes.forEach(c => {
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    
    const vix6m = getMetricAtOffset(c.peak, -6, 'market_data_yahoo', 'record_date', 'close', 'symbol', '^VIX');
    const vix3m = getMetricAtOffset(c.peak, -3, 'market_data_yahoo', 'record_date', 'close', 'symbol', '^VIX');
    const vixPeak = getVal('market_data_yahoo', 'record_date', 'close', 'symbol', '^VIX', c.peak);
    
    const hy6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'BAMLH0A0HYM2');
    const hy3m = getMetricAtOffset(c.peak, -3, 'econ_fred', 'observation_date', 'value', 'series_id', 'BAMLH0A0HYM2');
    const hyPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'BAMLH0A0HYM2', c.peak);

    console.log(`  * VIX (Fear): -6m: ${vix6m ? vix6m.toFixed(2) : 'N/A'}, -3m: ${vix3m ? vix3m.toFixed(2) : 'N/A'}, Peak: ${vixPeak ? vixPeak.toFixed(2) : 'N/A'}`);
    console.log(`  * High Yield Spread: -6m: ${hy6m ? hy6m.toFixed(2)+'%' : 'N/A'}, -3m: ${hy3m ? hy3m.toFixed(2)+'%' : 'N/A'}, Peak: ${hyPeak ? hyPeak.toFixed(2)+'%' : 'N/A'}`);
    
    console.log("-------------------------------------------------------------------");
});

// Let's check a few known "False Alarms" where VIX spiked to 30 but SPY didn't crash hard
const falseAlarms = [
    { name: "Flash Crash 2010", date: "2010-05-20" },
    { name: "China Panik 2015", date: "2015-08-24" },
    { name: "Mini-Panic Jan 2021", date: "2021-01-27" }
];

console.log("\n=== Falsche VIX Alarme: Wie sahen die High Yield Spreads aus? ===");
falseAlarms.forEach(c => {
    const vix = getVal('market_data_yahoo', 'record_date', 'close', 'symbol', '^VIX', c.date);
    const hy = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'BAMLH0A0HYM2', c.date);
    console.log(`[ ${c.name} ] ${c.date}: VIX = ${vix ? vix.toFixed(2) : 'N/A'}, HY Spread = ${hy ? hy.toFixed(2)+'%' : 'N/A'}`);
});
