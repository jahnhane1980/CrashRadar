import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

const crashes = [
    { name: "Dotcom-Blase", peak: "2000-03-24", trough: "2002-10-09" },
    { name: "Finanzkrise", peak: "2007-10-09", trough: "2009-03-09" },
    { name: "Zins-Panik 2018", peak: "2018-09-20", trough: "2018-12-24" },
    { name: "Corona-Crash", peak: "2020-02-19", trough: "2020-03-23" },
    { name: "Inflations-Schock", peak: "2022-01-03", trough: "2022-10-12" },
    { name: "Recent 2025 Crash", peak: "2025-02-19", trough: "2025-04-08" }
];

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

// 1. Markiert der VIX den Boden?
console.log("=== VIX am Tiefpunkt des Marktes (Trough) ===");
crashes.forEach(c => {
    // Finde das VIX Maximum im Zeitraum zwischen Peak und Trough
    const stmt = db.prepare(`SELECT MAX(close) as max_vix, record_date FROM market_data_yahoo WHERE symbol = '^VIX' AND record_date >= ? AND record_date <= ?`);
    const res = stmt.get(c.peak, c.trough);
    const vixTrough = getVal('market_data_yahoo', 'record_date', 'close', 'symbol', '^VIX', c.trough);
    console.log(`[ ${c.name} ] Trough Date: ${c.trough}`);
    console.log(`  * Max VIX im Crash: ${res.max_vix ? res.max_vix.toFixed(2) : 'N/A'} (am ${res.record_date})`);
    console.log(`  * VIX genau am Trough-Tag: ${vixTrough ? vixTrough.toFixed(2) : 'N/A'}`);
});

// 2. Arbeitsmarkt & Globale Liquidität
console.log("\n=== Arbeitsmarkt & Globale Liquidität (Vor dem Peak) ===");
crashes.forEach(c => {
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    
    // Sahm Rule
    const sahm6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'SAHMREALTIME');
    const sahmPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'SAHMREALTIME', c.peak);
    const sahmTrough = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'SAHMREALTIME', c.trough);
    
    // ICSA (Jobless claims)
    const icsa6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'ICSA');
    const icsaPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'ICSA', c.peak);
    
    // ECB Assets
    const ecb6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'ECBASSETSW');
    const ecbPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'ECBASSETSW', c.peak);
    
    console.log(`  * Sahm Rule: -6m: ${sahm6m}, Peak: ${sahmPeak}, Trough: ${sahmTrough} (Auslöser ab >0.50)`);
    console.log(`  * Erstanträge (ICSA): -6m: ${icsa6m}, Peak: ${icsaPeak}`);
    console.log(`  * ECB Bilanzen (Mio €): -6m: ${ecb6m}, Peak: ${ecbPeak} (Wachstum: ${ecb6m && ecbPeak ? ((ecbPeak/ecb6m - 1)*100).toFixed(2)+'%' : 'N/A'})`);
});
