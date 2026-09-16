import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

const GURU_MAP = {
    '0001536411': { name: 'Druckenmiller', fund: 'Duquesne', core: true },
    '0001135730': { name: 'Laffont', fund: 'Coatue', core: true },
    '0001167483': { name: 'Coleman', fund: 'Tiger Global', core: true },
    '0001656456': { name: 'Tepper', fund: 'Appaloosa', core: true },
    '0001541617': { name: 'Gerstner', fund: 'Altimeter', core: true },
    '0001509842': { name: 'Schreiber', fund: 'PointState', core: true }
};

function formatCurrency(val) {
    if (!val || val === 0) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    return `$${val.toFixed(0)}`;
}

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    try {
        console.log("================================================================================");
        console.log("   SIMULATION: KONVIKTIONS-FILTER & PORTFOLIO-GEWICHTUNG (Q2-2026)");
        console.log("================================================================================\n");

        const targetCiks = Object.keys(GURU_MAP);

        // 1. Fondsvolumen pro Guru
        const [fundTotals] = await pool.query(`
            SELECT cik, SUM(value) as total_value
            FROM fund_13f_holdings
            WHERE DATE_FORMAT(report_date, '%Y-%m-%d') = '2026-06-30' AND cik IN (?)
            GROUP BY cik
        `, [targetCiks]);

        const fundValMap = new Map();
        for (const f of fundTotals) fundValMap.set(f.cik, Number(f.total_value));

        // 2. Alle Aktien-Holdings in Q2-2026
        const [rows] = await pool.query(`
            SELECT cik, cusip, issuer_name, value, shares
            FROM fund_13f_holdings
            WHERE DATE_FORMAT(report_date, '%Y-%m-%d') = '2026-06-30' 
              AND cik IN (?) 
              AND put_call = 'STOCK'
        `, [targetCiks]);

        // 3. Gruppiere nach CUSIP
        const stockMap = new Map();
        for (const r of rows) {
            if (!stockMap.has(r.cusip)) {
                stockMap.set(r.cusip, {
                    cusip: r.cusip,
                    issuer_name: r.issuer_name,
                    holders: []
                });
            }
            const item = stockMap.get(r.cusip);
            if (r.issuer_name.length > item.issuer_name.length) item.issuer_name = r.issuer_name;
            
            const totalFund = fundValMap.get(r.cik) || 1;
            const weightPct = (Number(r.value) / totalFund) * 100;
            item.holders.push({
                cik: r.cik,
                guru: GURU_MAP[r.cik].name,
                fund: GURU_MAP[r.cik].fund,
                value: Number(r.value),
                shares: Number(r.shares),
                weightPct
            });
        }

        // 4. Analysiere mit verschiedenen Schwellenwerten:
        // Schwellen: >= 0.0% (Raw), >= 1.0% (Conviction-1), >= 2.0% (Conviction-2)
        const candidateStats = [];

        for (const [cusip, item] of stockMap.entries()) {
            const rawCount = item.holders.length;
            const conv1Count = item.holders.filter(h => h.weightPct >= 1.0).length;
            const conv2Count = item.holders.filter(h => h.weightPct >= 2.0).length;
            const totalVal = item.holders.reduce((s, h) => s + h.value, 0);
            const avgWeight = item.holders.reduce((s, h) => s + h.weightPct, 0) / rawCount;

            // Berechne aggregierten "Conviction Score": sum(weightPct)
            const sumWeightPct = item.holders.reduce((s, h) => s + h.weightPct, 0);

            if (rawCount >= 2) {
                candidateStats.push({
                    cusip,
                    name: item.issuer_name,
                    rawCount,
                    conv1Count,
                    conv2Count,
                    totalVal,
                    avgWeight,
                    sumWeightPct,
                    holders: item.holders
                });
            }
        }

        // Sortiere nach Conviction Score (Summe der Depotanteile bei den Gurus)
        candidateStats.sort((a, b) => b.sumWeightPct - a.sumWeightPct);

        console.log("--- KANDIDATEN MIT >= 2 HALTERN SORTIERT NACH AGGREGIERTER KONVIKTION (SUMME DEPOT-%) ---");
        const tableData = candidateStats.map(c => ({
            Issuer: c.name.slice(0, 24),
            RawHalter: c.rawCount,
            'Halter (>=1%)': c.conv1Count,
            'Halter (>=2%)': c.conv2Count,
            'Ø Depot-%': c.avgWeight.toFixed(2) + ' %',
            'Summe Depot-%': c.sumWeightPct.toFixed(2) + ' %',
            'Gesamtkapital': formatCurrency(c.totalVal)
        }));
        console.table(tableData.slice(0, 25));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
