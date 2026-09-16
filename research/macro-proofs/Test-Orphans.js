import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { BizdIndicator } from '../../src/analysis/indicators/BizdIndicator.js';
import { BklnIndicator } from '../../src/analysis/indicators/BklnIndicator.js';
import { ArccIndicator } from '../../src/analysis/indicators/ArccIndicator.js';
import { RateShockIndicator } from '../../src/analysis/indicators/RateShockIndicator.js';
import { CbPolicyErrorIndicator } from '../../src/analysis/indicators/CbPolicyErrorIndicator.js';
import { HygDivergenceIndicator } from '../../src/analysis/indicators/HygDivergenceIndicator.js';

dotenv.config();

async function runTest() {
    const pool = mysql.createPool(process.env.DATABASE_URL);
    console.log('Lade Daten aus DB...');
    
    const [tiingo] = await pool.query(`SELECT record_date as date, symbol, close FROM market_data_tiingo WHERE symbol = 'SPY'`);
    const [yahoo] = await pool.query(`SELECT record_date as date, symbol, close FROM market_data_yahoo WHERE symbol IN ('HYG', 'BIZD', 'BKLN', 'ARCC', 'DX-Y.NYB', 'SPY')`);
    const [fred] = await pool.query(`SELECT observation_date as date, series_id, value FROM econ_fred WHERE series_id IN ('DFF', 'T10YIE', 'DFII10')`);
    const [fund] = await pool.query(`SELECT record_date as date, ticker, total_assets, interest_expense, net_income FROM fund_sec_edgar WHERE ticker = 'ARCC'`);

    await pool.end();

    const timelineMap = {};
    const add = (date, key, val) => {
        if(!date || val === null || val === undefined || val === 'null') return;
        const dStr = typeof date === 'string' ? date.split('T')[0] : date.toISOString().split('T')[0];
        if(!timelineMap[dStr]) timelineMap[dStr] = { date: dStr, assets: {}, macroGroups: { FinancialConditions: {}, Leading: {}, Fundamentals: {} } };
        
        if(['SPY', 'HYG', 'BIZD', 'BKLN', 'ARCC'].includes(key)) {
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
    console.log(`✅ ${dates.length} Handelstage zusammengeführt.`);

    // Fill forward missing data (da FRED und Aktienmärkte verschiedene Feiertage haben können)
    let lastKnown = { assets: {}, macroGroups: { FinancialConditions: {}, Leading: {}, Fundamentals: {} } };
    for (let d of dates) {
        const t = timelineMap[d];
        Object.assign(lastKnown.assets, t.assets);
        Object.assign(lastKnown.macroGroups.FinancialConditions, t.macroGroups.FinancialConditions);
        Object.assign(lastKnown.macroGroups.Leading, t.macroGroups.Leading);
        Object.assign(lastKnown.macroGroups.Fundamentals, t.macroGroups.Fundamentals);
        
        // kopiere referenzfrei
        t.assets = { ...lastKnown.assets };
        t.macroGroups = {
            FinancialConditions: { ...lastKnown.macroGroups.FinancialConditions },
            Leading: { ...lastKnown.macroGroups.Leading },
            Fundamentals: { ...lastKnown.macroGroups.Fundamentals }
        };
    }

    const timelineArray = dates.map(d => timelineMap[d]);

    const indicators = [
        new BizdIndicator(),
        new BklnIndicator(),
        new ArccIndicator(),
        new RateShockIndicator(),
        new CbPolicyErrorIndicator(),
        new HygDivergenceIndicator()
    ];

    console.log('\n========================================================');
    console.log('   ORPHANED INDICATORS: TOP & BOTTOM ANALYSIS');
    console.log('========================================================\n');

    const checkDates = [
        { name: 'Dotcom Peak', date: '2000-03-24' },
        { name: 'Dotcom Bottom', date: '2002-10-09' },
        { name: 'GFC Peak', date: '2007-10-09' },
        { name: 'GFC Bottom', date: '2009-03-09' },
        { name: 'Rate Panic Peak', date: '2018-09-20' },
        { name: 'Rate Panic Bottom', date: '2018-12-24' },
        { name: 'Corona Peak', date: '2020-02-19' },
        { name: 'Corona Bottom', date: '2020-03-23' },
        { name: 'Inflation Peak', date: '2022-01-03' },
        { name: 'Inflation Bottom', date: '2022-10-12' },
        { name: 'AI Crash Peak', date: '2025-02-19' }
    ];

    indicators.forEach(ind => {
        console.log(`\n\n--- 🔍 TESTING: ${ind.name} ---`);
        let totalSignals = 0;
        
        // Simuliere über den gesamten Zeitraum um zu sehen ob er im Dauerfeuer ist
        for (let i = 200; i < timelineArray.length; i++) {
            const window = timelineArray.slice(0, i + 1);
            const res = ind.evaluate(window);
            if (res.status === 'CRITICAL' || res.status === 'WARNING') {
                totalSignals++;
            }
        }
        console.log(`> Gesamte Signale in 25 Jahren (CRITICAL/WARNING): ${totalSignals}`);

        // Spezifisch 3 Monate (60 Handelstage) vor und nach den Tops/Bottoms prüfen
        checkDates.forEach(evt => {
            const idx = dates.indexOf(evt.date);
            if (idx === -1) {
                // Finde nächstes Datum
                return;
            }
            
            let foundSignals = [];
            const startIdx = Math.max(200, idx - 60);
            const endIdx = Math.min(timelineArray.length - 1, idx + 60);

            for (let i = startIdx; i <= endIdx; i++) {
                const window = timelineArray.slice(0, i + 1);
                const res = ind.evaluate(window);
                if (res.status === 'CRITICAL' || res.status === 'WARNING') {
                    const daysDiff = i - idx;
                    foundSignals.push(`[${daysDiff > 0 ? '+'+daysDiff : daysDiff} Tage] ${timelineArray[i].date}: ${res.status} (${res.value}) - ${res.message}`);
                }
            }
            
            if (foundSignals.length > 0) {
                console.log(`\nEvent: ${evt.name} (${evt.date})`);
                // Zeige nur erste, mittlere und letzte an falls es zu viele sind
                if (foundSignals.length > 5) {
                    console.log(`  -> ${foundSignals.length} Signale gefeuert. Beispiele:`);
                    console.log(`     ${foundSignals[0]}`);
                    console.log(`     ...`);
                    console.log(`     ${foundSignals[foundSignals.length - 1]}`);
                } else {
                    foundSignals.forEach(s => console.log(`  -> ${s}`));
                }
            } else {
                console.log(`\nEvent: ${evt.name} (${evt.date}) -> KEINE Signale.`);
            }
        });
    });
}

runTest().catch(console.error);
