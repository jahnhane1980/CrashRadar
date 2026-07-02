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

console.log("=== Industrial Production (INDPRO) als PMI-Ersatz ===");
crashes.forEach(c => {
    const i12m = getMetricAtOffset(c.peak, -12, 'econ_fred', 'observation_date', 'value', 'series_id', 'INDPRO');
    const i6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'INDPRO');
    const iPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'INDPRO', c.peak);
    
    const drop12mToPeak = i12m && iPeak ? ((iPeak - i12m) / i12m * 100).toFixed(2) + '%' : 'N/A';
    
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    console.log(`  * INDPRO: -12m: ${i12m}, -6m: ${i6m}, Peak: ${iPeak}`);
    console.log(`  * Veränderung (-12m bis Peak): ${drop12mToPeak}`);
});

console.log("\n=== Corporate Profits (CP) vs 10Y Yield (ERP Proxy) ===");
crashes.forEach(c => {
    const cp12m = getMetricAtOffset(c.peak, -12, 'econ_fred', 'observation_date', 'value', 'series_id', 'CP');
    const cpPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'CP', c.peak);
    const y10Peak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'DFII10', c.peak) || getVal('econ_fred', 'observation_date', 'value', 'series_id', 'DGS10', c.peak); // fallback if no real yield
    
    const yoyGrowthAtPeak = cp12m && cpPeak ? ((cpPeak - cp12m) / cp12m * 100).toFixed(2) + '%' : 'N/A';
    
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    console.log(`  * Corp. Profits (Mrd. $): -12m: ${cp12m}, Peak: ${cpPeak}`);
    console.log(`  * Gewinn-Wachstum YoY: ${yoyGrowthAtPeak}`);
});
