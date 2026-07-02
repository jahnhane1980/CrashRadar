import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

function getLatest(table, dateCol, valCol, symCol, symVal) {
    const q = symCol 
        ? `SELECT ${dateCol} as date, ${valCol} as val FROM ${table} WHERE ${symCol} = ? AND ${valCol} IS NOT NULL ORDER BY ${dateCol} DESC LIMIT 1`
        : `SELECT ${dateCol} as date, ${valCol} as val FROM ${table} WHERE ${valCol} IS NOT NULL ORDER BY ${dateCol} DESC LIMIT 1`;
    const stmt = db.prepare(q);
    return symCol ? stmt.get(symVal) : stmt.get();
}

function getAtOffset(monthsOffset, table, dateCol, valCol, symCol, symVal, referenceDateStr) {
    const target = new Date(referenceDateStr);
    target.setMonth(target.getMonth() + monthsOffset);
    const dateStr = target.toISOString().split('T')[0];
    const q = symCol 
        ? `SELECT ${dateCol} as date, ${valCol} as val FROM ${table} WHERE ${symCol} = ? AND ${dateCol} <= ? AND ${valCol} IS NOT NULL ORDER BY ${dateCol} DESC LIMIT 1`
        : `SELECT ${dateCol} as date, ${valCol} as val FROM ${table} WHERE ${dateCol} <= ? AND ${valCol} IS NOT NULL ORDER BY ${dateCol} DESC LIMIT 1`;
    const stmt = db.prepare(q);
    return symCol ? stmt.get(symVal, dateStr) : stmt.get(dateStr);
}

function evaluateMetric(id, table, dateCol, valCol, symCol, symVal) {
    const current = getLatest(table, dateCol, valCol, symCol, symVal);
    if (!current) return { id, status: 'No Data' };
    
    const m3 = getAtOffset(-3, table, dateCol, valCol, symCol, symVal, current.date);
    const m6 = getAtOffset(-6, table, dateCol, valCol, symCol, symVal, current.date);
    const m12 = getAtOffset(-12, table, dateCol, valCol, symCol, symVal, current.date);
    
    return {
        id,
        current: current,
        m3: m3,
        m6: m6,
        m12: m12
    };
}

const metrics = [
    { id: 'TOTRESNS', table: 'econ_fred', sym: 'series_id', name: 'Bank Reserves' },
    { id: 'TGA', table: 'fiscal_tga', sym: null, dateCol: 'record_date', valCol: 'close_balance', name: 'TGA Balance' },
    { id: 'T10Y2Y', table: 'econ_fred', sym: 'series_id', name: '10Y-2Y Spread' },
    { id: 'NFCI', table: 'econ_fred', sym: 'series_id', name: 'Fed Stress Index' },
    { id: 'ECBASSETSW', table: 'econ_fred', sym: 'series_id', name: 'ECB Assets' },
    { id: 'JPNASSETS', table: 'econ_fred', sym: 'series_id', name: 'BOJ Assets' },
    { id: 'SAHMREALTIME', table: 'econ_fred', sym: 'series_id', name: 'Sahm Rule' },
    { id: 'PERMIT', table: 'econ_fred', sym: 'series_id', name: 'Building Permits' },
    { id: 'UMCSENT', table: 'econ_fred', sym: 'series_id', name: 'Consumer Sentiment' },
    { id: 'M2SL', table: 'econ_fred', sym: 'series_id', name: 'M2 Money Supply' },
    { id: 'CP', table: 'econ_fred', sym: 'series_id', name: 'Corporate Profits' },
    { id: 'T10YIE', table: 'econ_fred', sym: 'series_id', name: 'Breakeven Inflation' },
    { id: 'HYG', table: 'market_data_yahoo', sym: 'symbol', dateCol: 'record_date', name: 'High Yield Spreads' },
    { id: 'HG=F', table: 'market_data_yahoo', sym: 'symbol', dateCol: 'record_date', name: 'Copper' },
    { id: 'INDPRO', table: 'econ_fred', sym: 'series_id', name: 'Industrial Production' },
    { id: 'ICSA', table: 'econ_fred', sym: 'series_id', name: 'Initial Claims' },
];

metrics.forEach(m => {
    const dc = m.dateCol || 'observation_date';
    const vc = m.valCol || (m.table.includes('market_data') ? 'close' : 'value');
    const sc = m.sym;
    const sv = m.id;
    
    const res = evaluateMetric(m.id, m.table, dc, vc, sc, sc ? sv : null);
    
    if (res.status === 'No Data') {
        console.log(`[${m.name}] No data found.`);
        return;
    }
    
    const cur = res.current.val;
    const m12 = res.m12 ? res.m12.val : null;
    const roc = m12 ? ((cur - m12) / m12 * 100).toFixed(2) + '%' : 'N/A';
    
    console.log(`\n=== ${m.name} ===`);
    console.log(`Today (${res.current.date}): ${cur}`);
    if (res.m3) console.log(`3m ago (${res.m3.date}): ${res.m3.val}`);
    if (res.m6) console.log(`6m ago (${res.m6.date}): ${res.m6.val}`);
    if (res.m12) console.log(`12m ago (${res.m12.date}): ${res.m12.val}`);
    console.log(`12m Rate of Change: ${roc}`);
});
