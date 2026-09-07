import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMuzzledCathieWoodSimulation } from '../../architecture/strategies/MuzzledCathieWoodSimulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function auditZombiesAndEarlySells() {
    console.log("================================================================================");
    console.log("   CRASHRADAR AUDIT: ZOMBIE-FALLEN & VERFRÜHTE VERKÄUFE (2015-2026)");
    console.log("================================================================================\n");

    const sim = await runMuzzledCathieWoodSimulation({
        startDate: '2015-01-01',
        endDate: '2026-09-06',
        deRiskRate: 1.00,
        goldRatio: 0.50,
        deRiskTech: true,
        silent: true
    });

    const tradeLog = sim.tradeLog;
    console.log(`Gesamtzahl Trades im Backtest: ${tradeLog.length}`);

    // Group trades by stock
    const stockTrades = {};
    for (const t of tradeLog) {
        const s = t.symbol;
        if (s) {
            if (!stockTrades[s]) stockTrades[s] = [];
            stockTrades[s].push(t);
        }
    }

    console.log("\n--------------------------------------------------------------------------------");
    console.log("1. DETAIL-ANALYSE JE AKTIE: TRADES, EXITS & BEFUND");
    console.log("--------------------------------------------------------------------------------");

    for (const [sym, trades] of Object.entries(stockTrades)) {
        console.log(`\n>>> ${sym} (${trades.length} Aktionen):`);
        const entries = trades.filter(t => t.action.includes('ENTRY'));
        const dips = trades.filter(t => t.action.includes('DIP_BUY'));
        const skims = trades.filter(t => t.action.includes('SKIM'));
        const exits1 = trades.filter(t => t.action.includes('STUFE_1'));
        const exits2 = trades.filter(t => t.action.includes('STUFE_2'));
        const exits3 = trades.filter(t => t.action.includes('STUFE_3') || t.action.includes('ZOMBIE'));
        const rehabs = trades.filter(t => t.action.includes('REHABILITATION'));

        console.log(`    Einstiege (Stage-2): ${entries.length} | Dip-Buys: ${dips.length} | Skims: ${skims.length}`);
        console.log(`    Exits: Stufe 1 (1/3 Knick): ${exits1.length} | Stufe 2 (SMA 200 Notanker): ${exits2.length} | Stufe 3 (100% Zombie): ${exits3.length} | Rehabs: ${rehabs.length}`);

        // Show all exit logs
        for (const e of [...exits1, ...exits2, ...exits3]) {
            console.log(`      * [${e.date}] ${e.action}: ${e.detail}`);
        }
    }

    // Check stocks that were in the universe but NEVER bought
    const allCandidateTech = [
        'TSLA', 'NVDA', 'AMZN', 'NFLX', 'SHOP', 'XYZ', 'ROKU',
        'TDOC', 'ZM', 'PLTR', 'SSYS', 'DDD', 'ILMN', 'PRLB', 'MELI', 'ISRG', 'CRSP'
    ];
    const neverBought = allCandidateTech.filter(s => !stockTrades[s] || stockTrades[s].length === 0);
    console.log("\n--------------------------------------------------------------------------------");
    console.log(`2. TITEL DIE NIE GEKAUFT WURDEN (100 % in OBSERVE geblockt):`);
    console.log(`   ${neverBought.join(', ')}`);
    console.log("--------------------------------------------------------------------------------");

    // Check final holdings and their current unrealized gains/losses
    console.log("\n--------------------------------------------------------------------------------");
    console.log("3. END-POSITIONEN IM TECH-BUCKET (2026-09-04):");
    console.log("--------------------------------------------------------------------------------");
    for (const [sym, pos] of Object.entries(sim.techPositions)) {
        console.log(`* ${sym.padEnd(6)}: ${pos.shares.toFixed(2).padStart(10)} Stk. | Flag: ${pos.flag} | Stage: ${pos.stage} | Consecutive Weak: ${pos.consecutiveWeakFilings}`);
    }
}

auditZombiesAndEarlySells().catch(console.error);
