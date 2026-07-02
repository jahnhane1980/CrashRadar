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

console.log("=== Baugenehmigungen (PERMIT) als 12-Monats-Frühindikator ===");
crashes.forEach(c => {
    const p12m = getMetricAtOffset(c.peak, -12, 'econ_fred', 'observation_date', 'value', 'series_id', 'PERMIT');
    const p6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'PERMIT');
    const pPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'PERMIT', c.peak);
    
    // Check if it already started dropping 12 months before the peak
    const drop12mToPeak = p12m && pPeak ? ((pPeak - p12m) / p12m * 100).toFixed(2) + '%' : 'N/A';
    
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    console.log(`  * Permits (in Tsd.): -12m: ${p12m}, -6m: ${p6m}, Peak: ${pPeak}`);
    console.log(`  * Veränderung (-12m bis Peak): ${drop12mToPeak}`);
});

console.log("\n=== M2 Geldmenge (M2SL) Wachstum als Liquiditäts-Warnung ===");
crashes.forEach(c => {
    const m12m = getMetricAtOffset(c.peak, -12, 'econ_fred', 'observation_date', 'value', 'series_id', 'M2SL');
    const m6m = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', 'M2SL');
    const mPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', 'M2SL', c.peak);
    
    // YoY Growth Rate at Peak
    const yoyGrowthAtPeak = m12m && mPeak ? ((mPeak - m12m) / m12m * 100).toFixed(2) + '%' : 'N/A';
    // 6m annualized growth
    const annualized6mGrowth = m6m && mPeak ? (((mPeak - m6m) / m6m) * 2 * 100).toFixed(2) + '%' : 'N/A';
    
    console.log(`[ ${c.name} ] - SPY Peak: ${c.peak}`);
    console.log(`  * M2 Wachstum: YoY (12m vor Peak): ${yoyGrowthAtPeak}`);
    console.log(`  * M2 kurzfristiges Momentum (6m annualisiert vor Peak): ${annualized6mGrowth}`);
});
