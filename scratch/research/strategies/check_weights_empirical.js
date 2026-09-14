import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

async function checkWeightsAndPrices() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    try {
        console.log("================================================================================");
        console.log("   EMPIRISCHER CHECK: PORTFOLIO-GEWICHTUNG & 45-TAGE-LAG REZEPT");
        console.log("================================================================================\n");

        // 1. Prüfe Portfolio-Gewichtungen für Q2-2026 (2026-06-29)
        const targetCiks = ['0001536411', '0001135730', '0001167483', '0001656456', '0001541617', '0001509842'];
        const [fundTotals] = await pool.query(`
            SELECT cik, SUM(value) as total_value
            FROM fund_13f_holdings
            WHERE DATE_FORMAT(report_date, '%Y-%m-%d') = '2026-06-30' AND cik IN (?)
            GROUP BY cik
        `, [targetCiks]);

        const fundValMap = new Map();
        for (const f of fundTotals) fundValMap.set(f.cik, Number(f.total_value));

        // 2. Berechne Gewichtung der 7 Slots in Q2-2026
        const slotCusips = [
            { ticker: 'AMZN', cusip: '023135106', name: 'Amazon' },
            { ticker: 'META', cusip: '30303M102', name: 'Meta Platforms' },
            { ticker: 'TSM',  cusip: '874039100', name: 'Taiwan Semi' },
            { ticker: 'MSFT', cusip: '594918104', name: 'Microsoft' },
            { ticker: 'NVDA', cusip: '67066G104', name: 'Nvidia' },
            { ticker: 'GOOGL',cusip: '02079K305', name: 'Alphabet' },
            { ticker: 'LRCX', cusip: '512807306', name: 'Lam Research' },
            { ticker: 'NOW',  cusip: '81762P102', name: 'ServiceNow' },
            { ticker: 'AVGO', cusip: '11135F101', name: 'Broadcom' }
        ];

        console.log("--- 1. PORTFOLIO-GEWICHTUNG (%) DER TITEL BEI DEN EINZELNEN HALTERN (Q2-2026) ---\n");

        const [holdingsRows] = await pool.query(`
            SELECT cik, cusip, issuer_name, put_call, value, shares
            FROM fund_13f_holdings
            WHERE DATE_FORMAT(report_date, '%Y-%m-%d') = '2026-06-30' AND cik IN (?) AND put_call = 'STOCK'
        `, [targetCiks]);

        for (const slot of slotCusips) {
            const matches = holdingsRows.filter(h => h.cusip === slot.cusip);
            console.log(`📌 ${slot.ticker.padEnd(5)} (${slot.name.padEnd(16)}) -> Halter: ${matches.length}`);
            for (const m of matches) {
                const total = fundValMap.get(m.cik) || 1;
                const weight = ((m.value / total) * 100).toFixed(2);
                console.log(`   - CIK ${m.cik}: Wert $${(m.value / 1e6).toFixed(1)}M von $${(total / 1e6).toFixed(1)}M (${weight} % des Fonds)`);
            }
            if (matches.length === 0) console.log("   - Kein Halter");
            console.log("");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkWeightsAndPrices();
