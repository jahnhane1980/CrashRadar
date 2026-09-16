import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const GURU_MAP = {
    '0001536411': { name: 'Druckenmiller', fund: 'Duquesne', core: true },
    '0001135730': { name: 'Laffont', fund: 'Coatue', core: true },
    '0001167483': { name: 'Coleman', fund: 'Tiger Global', core: true },
    '0001656456': { name: 'Tepper', fund: 'Appaloosa', core: true },
    '0001541617': { name: 'Gerstner', fund: 'Altimeter', core: true },
    '0001509842': { name: 'Schreiber', fund: 'PointState', core: true },
    '0001777813': { name: 'Baker', fund: 'Atreides', core: false },
    '0001387322': { name: 'Sacerdote', fund: 'Whale Rock', core: false },
    '0001647251': { name: 'Hohn', fund: 'TCI', core: false }
};

function formatCurrency(val) {
    if (!val) return '$0';
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
}

function formatShares(val) {
    if (!val) return '0';
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return `${val}`;
}

async function run() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    try {
        const [datesRows] = await pool.query(`SELECT DISTINCT report_date FROM fund_13f_holdings ORDER BY report_date ASC`);
        const quarters = datesRows.map(r => r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0]);

        const ciks = Object.keys(GURU_MAP);
        const [rows] = await pool.query(`
            SELECT cik, report_date, cusip, issuer_name, put_call, shares, value
            FROM fund_13f_holdings
            WHERE cik IN (?)
            ORDER BY report_date ASC, cusip ASC
        `, [ciks]);

        const securities = new Map();
        for (const r of rows) {
            const rDate = r.report_date instanceof Date ? r.report_date.toISOString().split('T')[0] : String(r.report_date).split('T')[0];
            const putCall = r.put_call || 'STOCK';
            const key = `${r.cusip}_${putCall}`;
            
            if (!securities.has(key)) {
                securities.set(key, {
                    cusip: r.cusip,
                    issuer_name: r.issuer_name,
                    put_call: putCall,
                    byQuarter: {}
                });
            }
            
            const sec = securities.get(key);
            if (r.issuer_name && r.issuer_name.length > sec.issuer_name.length) {
                sec.issuer_name = r.issuer_name;
            }
            
            if (!sec.byQuarter[rDate]) {
                sec.byQuarter[rDate] = { coreHolders: new Map(), succHolders: new Map() };
            }
            
            const isCore = GURU_MAP[r.cik]?.core;
            const targetMap = isCore ? sec.byQuarter[rDate].coreHolders : sec.byQuarter[rDate].succHolders;
            targetMap.set(r.cik, {
                shares: Number(r.shares) || 0,
                value: Number(r.value) || 0
            });
        }

        const list = [];
        for (const [key, sec] of securities.entries()) {
            let maxCore = 0;
            for (const q of quarters) {
                const count = sec.byQuarter[q]?.coreHolders.size || 0;
                if (count > maxCore) maxCore = count;
            }
            if (maxCore >= 2) {
                list.push({ ...sec, maxCore });
            }
        }

        const latestQ = quarters[quarters.length - 1];
        list.sort((a, b) => {
            const hA = a.byQuarter[latestQ]?.coreHolders.size || 0;
            const hB = b.byQuarter[latestQ]?.coreHolders.size || 0;
            if (hB !== hA) return hB - hA;
            if (b.maxCore !== a.maxCore) return b.maxCore - a.maxCore;
            const valA = Array.from(a.byQuarter[latestQ]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
            const valB = Array.from(b.byQuarter[latestQ]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
            return valB - valA;
        });

        console.log(`ANZAHL KONSENS-WERTPAPIERE (>=2 Core-Halter): ${list.length}`);
        for (const item of list) {
            const counts = quarters.map(q => {
                const count = item.byQuarter[q]?.coreHolders.size || 0;
                const val = Array.from(item.byQuarter[q]?.coreHolders.values() || []).reduce((s, h) => s + h.value, 0);
                return `${q.slice(2, 7)}: ${count} (${formatCurrency(val)})`;
            });
            console.log(`[${item.put_call}] ${item.issuer_name.padEnd(25)} (CUSIP: ${item.cusip}) -> ${counts.join(' | ')}`);
        }

        fs.writeFileSync(
            path.resolve('data/cache/strategies/consensus_data_12m.json'),
            JSON.stringify({ quarters, list }, null, 2)
        );
        console.log("\nGespeichert nach data/cache/strategies/consensus_data_12m.json");

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
