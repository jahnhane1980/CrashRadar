import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

const crashes = [
    { name: "Dotcom-Blase", peak: "2000-03-24" },
    { name: "Finanzkrise", peak: "2007-10-09" },
    { name: "Zins-Panik 2018", peak: "2018-09-20" },
    { name: "Corona-Crash", peak: "2020-02-19" },
    { name: "Inflations-Schock", peak: "2022-01-03" },
    { name: "Recent 2025 Crash", peak: "2025-02-19" },
    { name: "HEUTE (2026)", peak: "2026-06-24" }
];

function getM2(dateStr) {
    const q = `SELECT value FROM econ_fred WHERE series_id = 'M2SL' AND observation_date <= ? AND value IS NOT NULL ORDER BY observation_date DESC LIMIT 1`;
    const res = db.prepare(q).get(dateStr);
    return res ? res.value : null; // in Billions
}

function getMaturityWall(dateStr, monthsAhead = 3) {
    // Finde alle Auctions, die VOR dem dateStr emittiert wurden, 
    // aber NACH dem dateStr und innerhalb der nächsten X Monate fällig werden.
    // Aber warte: issue_date muss <= dateStr sein (wir wissen am dateStr davon)
    // maturity_date muss > dateStr sein und <= dateStr + monthsAhead.
    
    const q = `
      SELECT SUM(total_accepted) as total_bills
      FROM fiscal_auctions
      WHERE security_type LIKE '%Bill%'
        AND issue_date <= ?
        AND maturity_date > ?
        AND maturity_date <= date(?, '+' || ? || ' months')
    `;
    
    const res = db.prepare(q).get(dateStr, dateStr, dateStr, monthsAhead);
    return res ? res.total_bills : 0;
}

console.log("=== Historische T-Bill 'Maturity Wall' vs. M2 Geldmenge ===\n");

crashes.forEach(c => {
    // 6 Monate vor Peak
    const d6 = new Date(c.peak); d6.setMonth(d6.getMonth() - 6);
    const date6m = d6.toISOString().split('T')[0];
    
    const bills6m = getMaturityWall(date6m, 3) / 1e9; // in Billions
    const m2_6m = getM2(date6m);
    const ratio6m = m2_6m ? (bills6m / m2_6m * 100).toFixed(2) : 'N/A';
    
    // Am Peak
    const billsPeak = getMaturityWall(c.peak, 3) / 1e9;
    const m2Peak = getM2(c.peak);
    const ratioPeak = m2Peak ? (billsPeak / m2Peak * 100).toFixed(2) : 'N/A';
    
    console.log(`[ ${c.name} ] - Peak: ${c.peak}`);
    console.log(`  -6 Monate (${date6m}): ${bills6m.toFixed(2)} B fällig in Folgemonaten | M2: ${m2_6m} B | Belastung: ${ratio6m}% der M2`);
    console.log(`  AM PEAK (${c.peak}):   ${billsPeak.toFixed(2)} B fällig in Folgemonaten | M2: ${m2Peak} B | Belastung: ${ratioPeak}% der M2`);
    console.log('');
});
