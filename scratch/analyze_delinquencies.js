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

function getVal(table, dateColumn, valColumn, symbolColumn, symbolValue, targetDateStr) {
    const q = `SELECT ${valColumn} as val FROM ${table} WHERE ${symbolColumn} = ? AND ${dateColumn} <= ? AND ${valColumn} IS NOT NULL ORDER BY ${dateColumn} DESC LIMIT 1`;
    const stmt = db.prepare(q);
    const res = stmt.get(symbolValue, targetDateStr);
    return res ? res.val : null;
}

function getMetricAtOffset(targetDateStr, monthsOffset, table, dateCol, valCol, symCol, symVal) {
    const target = new Date(targetDateStr);
    target.setMonth(target.getMonth() + monthsOffset);
    const dateStr = target.toISOString().split('T')[0];
    return getVal(table, dateCol, valCol, symCol, symVal, dateStr);
}

const series = [
    { id: 'DRCCLACBS', name: 'Credit Card Delinquency (%)' },
    { id: 'DRCLACBS', name: 'Consumer Loans Delinquency (%)' }
];

series.forEach(s => {
    console.log(`\n=== ${s.name} ===`);
    crashes.forEach(c => {
        const val12 = getMetricAtOffset(c.peak, -12, 'econ_fred', 'observation_date', 'value', 'series_id', s.id);
        const val6 = getMetricAtOffset(c.peak, -6, 'econ_fred', 'observation_date', 'value', 'series_id', s.id);
        const valPeak = getVal('econ_fred', 'observation_date', 'value', 'series_id', s.id, c.peak);
        
        const diff = val12 && valPeak ? (valPeak - val12).toFixed(2) + ' %-Punkte' : 'N/A';
        
        console.log(`[ ${c.name} ] - Peak: ${c.peak}`);
        console.log(`  * -12m: ${val12}%, -6m: ${val6}%, Peak: ${valPeak}%`);
        console.log(`  * Veränderung (-12m bis Peak): ${diff}`);
    });
});
