import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    const [goldRows] = await db.query(`SELECT record_date, close FROM market_data_yahoo WHERE symbol = 'GC=F' ORDER BY record_date ASC`);
    const [dffRows] = await db.query(`SELECT observation_date, value FROM econ_fred WHERE series_id = 'DFF' ORDER BY observation_date ASC`);
    const [t10yieRows] = await db.query(`SELECT observation_date, value FROM econ_fred WHERE series_id = 'T10YIE' ORDER BY observation_date ASC`);
    const [dxyRows] = await db.query(`SELECT record_date, close FROM market_data_yahoo WHERE symbol = 'DX-Y.NYB' ORDER BY record_date ASC`);

    await db.end();

    const timeline = {};
    const addToTimeline = (date, key, value) => {
        const dStr = typeof date === 'string' ? date : date.toISOString().substring(0, 10);
        if (!timeline[dStr]) timeline[dStr] = {};
        timeline[dStr][key] = value;
    };

    goldRows.forEach(r => addToTimeline(r.record_date, 'gold', r.close));
    dffRows.forEach(r => addToTimeline(r.observation_date, 'dff', parseFloat(r.value)));
    t10yieRows.forEach(r => addToTimeline(r.observation_date, 't10yie', parseFloat(r.value)));
    dxyRows.forEach(r => addToTimeline(r.record_date, 'dxy', r.close));

    const dates = Object.keys(timeline).sort();
    const finalData = [];
    const state = { gold: null, dff: null, t10yie: null, dxy: null };

    for (const d of dates) {
        if (timeline[d].gold !== undefined) state.gold = timeline[d].gold;
        if (timeline[d].dff !== undefined) state.dff = timeline[d].dff;
        if (timeline[d].t10yie !== undefined) state.t10yie = timeline[d].t10yie;
        if (timeline[d].dxy !== undefined) state.dxy = timeline[d].dxy;
        
        if (state.gold !== null && state.dff !== null && state.t10yie !== null && state.dxy !== null && !isNaN(state.dff) && !isNaN(state.t10yie)) {
            finalData.push({ date: d, ...state });
        }
    }

    const WINDOW = 60; // 60 Handelstage (~3 Monate)
    
    let totalPolicyErrors = 0;
    
    // Statistiken OHNE DXY Filter
    let goldUpUnfiltered = 0;
    let avgGoldReturnUnfiltered = 0;
    
    // Statistiken MIT DXY Filter (DXY <= +2.0%)
    let filteredPolicyErrors = 0;
    let goldUpFiltered = 0;
    let avgGoldReturnFiltered = 0;

    for (let i = WINDOW; i < finalData.length; i++) {
        const current = finalData[i];
        const past = finalData[i - WINDOW];

        const dffChange = current.dff - past.dff;
        const t10yieChange = current.t10yie - past.t10yie;
        const goldReturn = ((current.gold - past.gold) / past.gold) * 100;
        const dxyReturn = ((current.dxy - past.dxy) / past.dxy) * 100;

        // POLICY ERROR Trigger
        if (dffChange < -0.25 && t10yieChange > 0.10) {
            totalPolicyErrors++;
            if (goldReturn > 0) goldUpUnfiltered++;
            avgGoldReturnUnfiltered += goldReturn;

            // MIT DXY FILTER (DXY ist nicht extrem gestiegen)
            if (dxyReturn <= 2.0) {
                filteredPolicyErrors++;
                if (goldReturn > 0) goldUpFiltered++;
                avgGoldReturnFiltered += goldReturn;
            }
        }
    }

    console.log("=== AUSWERTUNG: EFFEKT DES DXY FILTERS ===");
    console.log("\n1. OHNE Filter (Altes Setup):");
    console.log(`Anzahl Trigger: ${totalPolicyErrors}`);
    console.log(`Trefferquote (Gold > 0%): ${(goldUpUnfiltered / totalPolicyErrors * 100).toFixed(1)}%`);
    console.log(`Durchschn. Gold Rendite: ${(avgGoldReturnUnfiltered / totalPolicyErrors).toFixed(2)}%`);

    console.log("\n2. MIT DXY Filter (DXY <= +2.0%):");
    console.log(`Anzahl Trigger: ${filteredPolicyErrors}`);
    if (filteredPolicyErrors > 0) {
        console.log(`Trefferquote (Gold > 0%): ${(goldUpFiltered / filteredPolicyErrors * 100).toFixed(1)}%`);
        console.log(`Durchschn. Gold Rendite: ${(avgGoldReturnFiltered / filteredPolicyErrors).toFixed(2)}%`);
    }
}

main().catch(console.error);
