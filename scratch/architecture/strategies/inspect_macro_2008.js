import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

async function inspectMacroHistory() {
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2007-01-01', { bypassMemoryGuard: true });
    await fe.close();

    console.log('--- 2007-2009 MAKRO DATEN CHECK ---');
    const filtered2008 = timeline.filter(t => t.date >= '2007-06-01' && t.date <= '2009-06-01');

    const weeklyNetLiq = [];
    for (let i = 0; i < filtered2008.length; i++) {
        const day = filtered2008[i];
        const nl = day.macroGroups?.NetLiquidity;
        if (nl && nl.WALCL !== undefined) {
            const dObj = new Date(day.date);
            const val = nl.WALCL - (nl.TGA || 0) - (nl.RRPONTSYD || 0);
            if (dObj.getDay() === 4 || weeklyNetLiq.length === 0) {
                weeklyNetLiq.push({ date: day.date, walcl: nl.WALCL, tga: nl.TGA, rrp: nl.RRPONTSYD, netLiq: val, stress: day.macroGroups?.FinancialConditions?.ChicagoFedIndex });
            }
        }
    }

    for (let i = 0; i < weeklyNetLiq.length; i++) {
        const cur = weeklyNetLiq[i];
        let delta8 = null;
        if (i >= 8) {
            const past8 = weeklyNetLiq[i - 8].netLiq;
            delta8 = past8 !== 0 ? ((cur.netLiq - past8) / Math.abs(past8)) * 100 : 0;
        }
        if (i % 2 === 0 || (delta8 !== null && delta8 < -5.0)) {
            console.log(`${cur.date} | WALCL: ${cur.walcl} | TGA: ${cur.tga} | NetLiq: ${cur.netLiq} | 8W-Delta: ${delta8 ? delta8.toFixed(2) + '%' : 'N/A'} | Stress: ${cur.stress}`);
        }
    }

    console.log('\n--- 2020 COVID MAKRO DATEN CHECK ---');
    const filtered2020 = timeline.filter(t => t.date >= '2020-01-01' && t.date <= '2020-06-01');
    const weekly2020 = [];
    for (let i = 0; i < filtered2020.length; i++) {
        const day = filtered2020[i];
        const nl = day.macroGroups?.NetLiquidity;
        if (nl && nl.WALCL !== undefined) {
            const dObj = new Date(day.date);
            const val = nl.WALCL - (nl.TGA || 0) - (nl.RRPONTSYD || 0);
            if (dObj.getDay() === 4 || weekly2020.length === 0) {
                weekly2020.push({ date: day.date, walcl: nl.WALCL, tga: nl.TGA, rrp: nl.RRPONTSYD, netLiq: val, stress: day.macroGroups?.FinancialConditions?.ChicagoFedIndex });
            }
        }
    }
    for (let i = 0; i < weekly2020.length; i++) {
        const cur = weekly2020[i];
        let delta8 = null;
        if (i >= 8) {
            const past8 = weekly2020[i - 8].netLiq;
            delta8 = past8 !== 0 ? ((cur.netLiq - past8) / Math.abs(past8)) * 100 : 0;
        }
        console.log(`${cur.date} | WALCL: ${cur.walcl} | TGA: ${cur.tga} | NetLiq: ${cur.netLiq} | 8W-Delta: ${delta8 ? delta8.toFixed(2) + '%' : 'N/A'} | Stress: ${cur.stress}`);
    }
}

inspectMacroHistory().catch(console.error);
