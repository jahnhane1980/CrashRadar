import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { ArccIndicator } from '../../src/analysis/indicators/ArccIndicator.js';
import { RateShockIndicator } from '../../src/analysis/indicators/RateShockIndicator.js';
import { CbPolicyErrorIndicator } from '../../src/analysis/indicators/CbPolicyErrorIndicator.js';

dotenv.config();

async function runTest() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    const [tiingo] = await pool.query(`SELECT record_date as date, symbol, close FROM market_data_tiingo WHERE symbol = 'SPY'`);
    const [yahoo] = await pool.query(`SELECT record_date as date, symbol, close FROM market_data_yahoo WHERE symbol IN ('ARCC', 'DX-Y.NYB', 'SPY')`);
    const [fred] = await pool.query(`SELECT observation_date as date, series_id, value FROM econ_fred WHERE series_id IN ('DFF', 'T10YIE', 'DFII10')`);
    const [fund] = await pool.query(`SELECT record_date as date, ticker, total_assets, interest_expense, net_income FROM fund_sec_edgar WHERE ticker = 'ARCC'`);

    await pool.end();

    const timelineMap = {};
    const add = (date, key, val) => {
        if(!date || val === null || val === undefined || val === 'null') return;
        const dStr = typeof date === 'string' ? date.split('T')[0] : date.toISOString().split('T')[0];
        if(!timelineMap[dStr]) timelineMap[dStr] = { date: dStr, assets: {}, macroGroups: { FinancialConditions: {}, Leading: {}, Fundamentals: {} } };
        
        if(['SPY', 'ARCC'].includes(key)) {
            timelineMap[dStr].assets[key] = Number(val);
        } else if (key === 'DX-Y.NYB') {
            timelineMap[dStr].macroGroups.FinancialConditions.DXY = Number(val);
        } else if (key === 'DFF' || key === 'DFII10') {
            if (key === 'DFF') timelineMap[dStr].macroGroups.FinancialConditions.FedFundsRate = Number(val);
            if (key === 'DFII10') timelineMap[dStr].macroGroups.FinancialConditions.RealYield10y = Number(val);
        } else if (key === 'T10YIE') {
            timelineMap[dStr].macroGroups.Leading.BreakevenInflation = Number(val);
        } else if (key === 'ARCC_TotalAssets') timelineMap[dStr].macroGroups.Fundamentals.ARCC_TotalAssets = Number(val);
        else if (key === 'ARCC_InterestExpense') timelineMap[dStr].macroGroups.Fundamentals.ARCC_InterestExpense = Number(val);
        else if (key === 'ARCC_NetIncome') timelineMap[dStr].macroGroups.Fundamentals.ARCC_NetIncome = Number(val);
    };

    tiingo.forEach(r => add(r.date, r.symbol, r.close));
    yahoo.forEach(r => add(r.date, r.symbol, r.close));
    fred.forEach(r => add(r.date, r.series_id, r.value));
    fund.forEach(r => {
        add(r.date, 'ARCC_TotalAssets', r.total_assets);
        add(r.date, 'ARCC_InterestExpense', r.interest_expense);
        add(r.date, 'ARCC_NetIncome', r.net_income);
    });

    const dates = Object.keys(timelineMap).sort();

    // Fill forward
    let lastKnown = { assets: {}, macroGroups: { FinancialConditions: {}, Leading: {}, Fundamentals: {} } };
    for (let d of dates) {
        const t = timelineMap[d];
        Object.assign(lastKnown.assets, t.assets);
        Object.assign(lastKnown.macroGroups.FinancialConditions, t.macroGroups.FinancialConditions);
        Object.assign(lastKnown.macroGroups.Leading, t.macroGroups.Leading);
        Object.assign(lastKnown.macroGroups.Fundamentals, t.macroGroups.Fundamentals);
        
        t.assets = { ...lastKnown.assets };
        t.macroGroups = {
            FinancialConditions: { ...lastKnown.macroGroups.FinancialConditions },
            Leading: { ...lastKnown.macroGroups.Leading },
            Fundamentals: { ...lastKnown.macroGroups.Fundamentals }
        };
    }

    const timelineArray = dates.map(d => timelineMap[d]);

    const indRate = new RateShockIndicator();
    const indArcc = new ArccIndicator();
    const indPolicy = new CbPolicyErrorIndicator();

    const checkDates = [
        { name: 'Dotcom Peak', date: '2000-03-24' },
        { name: 'GFC Peak', date: '2007-10-09' },
        { name: 'Rate Panic Peak', date: '2018-09-20' },
        { name: 'Corona Peak', date: '2020-02-19' },
        { name: 'Inflation Peak', date: '2022-01-03' },
        { name: 'AI Crash Peak', date: '2025-02-19' }
    ];

    console.log('--- TEST: COMBINED STATEFUL ZINS-INDIKATOR ---');
    console.log('Logik: Ein Modul speichert, welche Phase getriggert wurde (Memory = 180 Tage).');
    
    // State Memory
    let rateShockMem = 0;
    let arccMem = 0;
    let policyMem = 0;
    
    // Tracking for historical events
    const results = {};
    checkDates.forEach(cd => results[cd.name] = []);

    for (let i = 200; i < timelineArray.length; i++) {
        const window = timelineArray.slice(0, i + 1);
        const current = timelineArray[i];
        
        // Decrement memory
        if (rateShockMem > 0) rateShockMem--;
        if (arccMem > 0) arccMem--;
        if (policyMem > 0) policyMem--;

        // Check individual triggers
        const rShock = indRate.evaluate(window);
        const rArcc = indArcc.evaluate(window);
        const rPolicy = indPolicy.evaluate(window);

        if (rShock.status === 'WARNING' || rShock.status === 'CRITICAL') rateShockMem = 180;
        if (rArcc.status === 'WARNING' || rArcc.status === 'CRITICAL') arccMem = 180;
        if (rPolicy.status === 'WARNING' || rPolicy.status === 'CRITICAL') policyMem = 180;

        let score = 0;
        let triggers = [];
        if (rateShockMem > 0) { score++; triggers.push('RateShock'); }
        if (arccMem > 0) { score++; triggers.push('ARCC'); }
        if (policyMem > 0) { score++; triggers.push('PolicyError'); }

        let combinedStatus = 'OK';
        if (score === 1) combinedStatus = 'EARLY_WARNING';
        if (score === 2) combinedStatus = 'WARNING';
        if (score === 3) combinedStatus = 'CRITICAL';

        // Check if this date is near a historical event (-180 to +30 days)
        checkDates.forEach(evt => {
            const evtIdx = dates.indexOf(evt.date);
            if (evtIdx !== -1 && i >= Math.max(0, evtIdx - 180) && i <= Math.min(timelineArray.length - 1, evtIdx + 30)) {
                if (combinedStatus !== 'OK') {
                    const daysDiff = i - evtIdx;
                    results[evt.name].push(`[${daysDiff > 0 ? '+'+daysDiff : daysDiff}d] ${current.date}: Status=${combinedStatus} (Triggers: ${triggers.join('+')})`);
                }
            }
        });
    }

    // Print summary
    for (const [evtName, logs] of Object.entries(results)) {
        console.log(`\nEvent: ${evtName}`);
        if (logs.length === 0) {
            console.log('  -> KEINE SIGNALE');
        } else {
            // Zeige Zustandsübergänge an (nur wenn sich Status ändert)
            let lastStatus = '';
            logs.forEach(log => {
                const currentStatus = log.split('Status=')[1];
                if (currentStatus !== lastStatus) {
                    console.log(`  -> ${log}`);
                    lastStatus = currentStatus;
                }
            });
        }
    }
}

runTest().catch(console.error);
