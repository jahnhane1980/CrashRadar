import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool(process.env.DATABASE_URL);

// Historische Bärenmärkte / Crashes
const CRASHES = [
    { name: 'Volmageddon / Zins-Crash 2018', topDate: '2018-09-21', bottomDate: '2018-12-24' },
    { name: 'Corona Flash-Crash 2020', topDate: '2020-02-19', bottomDate: '2020-03-23' },
    { name: 'Inflations-Bärenmarkt 2022', topDate: '2022-01-04', bottomDate: '2022-10-12' },
    { name: 'Simulierter KI-Crash 2025', topDate: '2025-02-19', bottomDate: '2025-04-01' }
];

async function getMetricClosestToDate(table, dateCol, date, selectCols, additionalWhere = '', additionalParams = []) {
    const query = `SELECT ${selectCols} FROM ${table} WHERE ${dateCol} <= ? ${additionalWhere} ORDER BY ${dateCol} DESC LIMIT 1`;
    const [rows] = await pool.query(query, [date, ...additionalParams]);
    return rows.length > 0 ? rows[0] : null;
}

async function get13fStats(date) {
    // Finde das letzte Quartalsende vor dem Datum
    const [quarters] = await pool.query(
        `SELECT DISTINCT report_date FROM fund_13f_holdings WHERE report_date <= ? ORDER BY report_date DESC LIMIT 1`,
        [date]
    );
    if (quarters.length === 0) return { call: 0, put: 0, stock: 0 };
    
    const reportDate = quarters[0].report_date;
    const [rows] = await pool.query(
        `SELECT put_call, SUM(value) as total_value FROM fund_13f_holdings WHERE report_date = ? GROUP BY put_call`,
        [reportDate]
    );
    
    const result = { call: 0, put: 0, stock: 0, reportDate };
    for (const row of rows) {
        if (!row.put_call || row.put_call === 'STOCK') result.stock = parseFloat(row.total_value);
        if (row.put_call === 'CALL') result.call = parseFloat(row.total_value);
        if (row.put_call === 'PUT') result.put = parseFloat(row.total_value);
    }
    return result;
}

function formatB(num) {
    if (!num) return 'N/A';
    return (num / 1e9).toFixed(1) + 'B';
}

function calculateDateOffset(dateStr, months) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
}

async function analyzeCrash(crash) {
    console.log(`\n======================================================================`);
    console.log(`🧨 CRASH ANALYSE: ${crash.name}`);
    console.log(`======================================================================`);
    
    const checkpoints = [
        { label: 'T-3 Monate', date: calculateDateOffset(crash.topDate, -3) },
        { label: 'The Top', date: crash.topDate },
        { label: 'The Bottom', date: crash.bottomDate },
        { label: 'T+3 Monate', date: calculateDateOffset(crash.bottomDate, 3) }
    ];

    const rows = {
        dix: ['DIX (Dark Pool %)', '', '', '', ''],
        aaii: ['AAII Spread (Retail)', '', '', '', ''],
        naaim: ['NAAIM Exposure (Profi)', '', '', '', ''],
        vix: ['VIX (Volatilität)', '', '', '', ''],
        skew: ['SKEW (Tail Risk)', '', '', '', ''],
        hedge_stock: ['13F Long Stocks ($)', '', '', '', ''],
        hedge_put: ['13F PUT Options ($)', '', '', '', ''],
        hedge_call: ['13F CALL Options ($)', '', '', '', '']
    };

    for (let i = 0; i < checkpoints.length; i++) {
        const cpDate = checkpoints[i].date;
        const colIdx = i + 1;

        // DIX
        const dixData = await getMetricClosestToDate('market_data_dix', 'record_date', cpDate, 'dix');
        rows.dix[colIdx] = dixData ? (parseFloat(dixData.dix) * 100).toFixed(1) + '%' : 'N/A';

        // AAII
        const aaiiData = await getMetricClosestToDate('market_data_aaii', 'record_date', cpDate, 'spread');
        rows.aaii[colIdx] = aaiiData ? (parseFloat(aaiiData.spread) * 100).toFixed(1) + '%' : 'N/A';

        // NAAIM
        const naaimData = await getMetricClosestToDate('market_data_naaim', 'record_date', cpDate, 'exposure_index');
        rows.naaim[colIdx] = naaimData ? parseFloat(naaimData.exposure_index).toFixed(1) : 'N/A';

        // VIX
        const vixData = await getMetricClosestToDate('market_data_yahoo', 'record_date', cpDate, 'close', 'AND symbol = ?', ['^VIX']);
        rows.vix[colIdx] = vixData ? parseFloat(vixData.close).toFixed(2) : 'N/A';

        // SKEW
        const skewData = await getMetricClosestToDate('market_data_yahoo', 'record_date', cpDate, 'close', 'AND symbol = ?', ['^SKEW']);
        rows.skew[colIdx] = skewData ? parseFloat(skewData.close).toFixed(2) : 'N/A';

        // 13F
        const hfData = await get13fStats(cpDate);
        rows.hedge_stock[colIdx] = hfData.stock ? formatB(hfData.stock) : 'N/A';
        rows.hedge_put[colIdx] = hfData.put ? formatB(hfData.put) : 'N/A';
        rows.hedge_call[colIdx] = hfData.call ? formatB(hfData.call) : 'N/A';
    }

    const results = [
        { 
            Metric: 'DIX (Dark Pool %)', 
            'T-3 Months': rows.dix[1], 
            'The Top': rows.dix[2], 
            'The Bottom': rows.dix[3], 
            'T+3 Months': rows.dix[4] 
        },
        { 
            Metric: 'AAII Spread (Retail)', 
            'T-3 Months': rows.aaii[1], 
            'The Top': rows.aaii[2], 
            'The Bottom': rows.aaii[3], 
            'T+3 Months': rows.aaii[4] 
        },
        { 
            Metric: 'NAAIM Exposure (Profi)', 
            'T-3 Months': rows.naaim[1], 
            'The Top': rows.naaim[2], 
            'The Bottom': rows.naaim[3], 
            'T+3 Months': rows.naaim[4] 
        },
        { 
            Metric: 'VIX (Panik/Angst)', 
            'T-3 Months': rows.vix[1], 
            'The Top': rows.vix[2], 
            'The Bottom': rows.vix[3], 
            'T+3 Months': rows.vix[4] 
        },
        { 
            Metric: 'SKEW (Tail Risk Hedging)', 
            'T-3 Months': rows.skew[1], 
            'The Top': rows.skew[2], 
            'The Bottom': rows.skew[3], 
            'T+3 Months': rows.skew[4] 
        },
        { 
            Metric: '13F Long Stocks ($)', 
            'T-3 Months': rows.hedge_stock[1], 
            'The Top': rows.hedge_stock[2], 
            'The Bottom': rows.hedge_stock[3], 
            'T+3 Months': rows.hedge_stock[4] 
        },
        { 
            Metric: '13F PUT Options ($)', 
            'T-3 Months': rows.hedge_put[1], 
            'The Top': rows.hedge_put[2], 
            'The Bottom': rows.hedge_put[3], 
            'T+3 Months': rows.hedge_put[4] 
        },
        { 
            Metric: '13F CALL Options ($)', 
            'T-3 Months': rows.hedge_call[1], 
            'The Top': rows.hedge_call[2], 
            'The Bottom': rows.hedge_call[3], 
            'T+3 Months': rows.hedge_call[4] 
        }
    ];

    console.table(results);
}

async function run() {
    for (const crash of CRASHES) {
        await analyzeCrash(crash);
    }
    await pool.end();
}

run();
