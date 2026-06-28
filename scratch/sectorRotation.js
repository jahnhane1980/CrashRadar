import 'dotenv/config';
import mysql from 'mysql2/promise';

const MACRO_SECTORS = {
    'EARLY': ['XLF', 'XLY', 'XLRE'],
    'MID': ['XLK', 'XLC'],
    'LATE': ['XLB', 'XLE'],
    'RECESSION': ['XLV', 'XLU', 'XLP']
};

const SUB_SECTORS = {
    // Assigned to Macro Phases for the Hybrid approach
    'EARLY': [
        { ticker: 'XRT', v: 0.8, name: 'Retail' },
        { ticker: 'ITB', v: 0.7, name: 'Homebuilders' },
        { ticker: 'KBE', v: 0.8, name: 'Large Banks' },
        { ticker: 'KRE', v: 0.6, name: 'Regional Banks' },
        { ticker: 'KIE', v: 1.0, name: 'Insurance' },
        { ticker: 'IYT', v: 0.8, name: 'Transports' },
        { ticker: 'ITA', v: 0.9, name: 'Aerospace & Defense' }
    ],
    'MID': [
        { ticker: 'SMH', v: 0.7, name: 'Semiconductors' },
        { ticker: 'IGV', v: 0.8, name: 'Software' },
        { ticker: 'CIBR', v: 0.8, name: 'Cybersecurity' }
    ],
    'LATE': [
        { ticker: 'XOP', v: 0.7, name: 'Exploration & Prod.' },
        { ticker: 'XES', v: 0.7, name: 'Equipment & Serv.' },
        { ticker: 'XME', v: 0.7, name: 'Metals & Mining' }
    ],
    'RECESSION': [
        { ticker: 'XPH', v: 1.0, name: 'Pharmaceuticals' },
        { ticker: 'IBB', v: 0.7, name: 'Biotechnology' },
        { ticker: 'IHI', v: 0.9, name: 'Medical Devices' },
        { ticker: 'GDX', v: 0.6, name: 'Gold Miners' }
    ]
};

async function loadData() {
    console.log("Verbinde mit Datenbank...");
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    // Get all relevant symbols + SPY
    const allSymbols = ['SPY'];
    Object.values(MACRO_SECTORS).flat().forEach(s => allSymbols.push(s));
    Object.values(SUB_SECTORS).flat().forEach(s => allSymbols.push(s.ticker));

    console.log(`Lade historische Daten für ${allSymbols.length} Ticker ab 2015...`);
    
    const [rows] = await pool.query(`
        SELECT symbol, DATE_FORMAT(record_date, '%Y-%m-%d') as date, close 
        FROM market_data_tiingo 
        WHERE symbol IN (?) AND record_date >= '2015-01-01'
        ORDER BY record_date ASC
    `, [allSymbols]);
    
    await pool.end();

    const timeline = {};
    rows.forEach(row => {
        if (!timeline[row.date]) timeline[row.date] = {};
        timeline[row.date][row.symbol] = row.close;
    });

    // Convert to sorted array
    const sortedDates = Object.keys(timeline).sort();
    const sortedTimeline = sortedDates.map(date => ({ date, prices: timeline[date] }));
    
    return sortedTimeline;
}

function calculateRelativeStrengthRoc(timeline, currentIndex, lookbackDays, symbol) {
    if (currentIndex < lookbackDays) return null;
    
    const currentDay = timeline[currentIndex];
    const oldDay = timeline[currentIndex - lookbackDays];
    
    const currentPrice = currentDay.prices[symbol];
    const currentSpy = currentDay.prices['SPY'];
    const oldPrice = oldDay.prices[symbol];
    const oldSpy = oldDay.prices['SPY'];
    
    if (!currentPrice || !currentSpy || !oldPrice || !oldSpy) return null;
    
    const currentRS = currentPrice / currentSpy;
    const oldRS = oldPrice / oldSpy;
    
    return ((currentRS - oldRS) / oldRS) * 100; // ROC in percent
}

function analyzeDay(timeline, index) {
    const date = timeline[index].date;
    const LOOKBACK_MACRO = 60; // 60 days for macro trend
    const LOOKBACK_MICRO = 20; // 20 days for sub-sector momentum
    
    if (index < LOOKBACK_MACRO) return { date, status: 'NOT_ENOUGH_DATA' };

    // 1. TOP-DOWN: Evaluate Macro Phases
    const phaseScores = {};
    for (const [phase, symbols] of Object.entries(MACRO_SECTORS)) {
        let sumRoc = 0;
        let count = 0;
        for (const sym of symbols) {
            const roc = calculateRelativeStrengthRoc(timeline, index, LOOKBACK_MACRO, sym);
            if (roc !== null) {
                sumRoc += roc;
                count++;
            }
        }
        phaseScores[phase] = count > 0 ? (sumRoc / count) : -999;
    }

    // Find winning phase
    let winningPhase = null;
    let maxScore = -Infinity;
    for (const [phase, score] of Object.entries(phaseScores)) {
        if (score > maxScore) {
            maxScore = score;
            winningPhase = phase;
        }
    }

    // 2. BOTTOM-UP: Rank Sub-Sectors of winning phase
    const subSectorRankings = [];
    if (winningPhase && SUB_SECTORS[winningPhase]) {
        for (const sub of SUB_SECTORS[winningPhase]) {
            const rawRoc = calculateRelativeStrengthRoc(timeline, index, LOOKBACK_MICRO, sub.ticker);
            if (rawRoc !== null) {
                const adjustedScore = rawRoc * sub.v;
                subSectorRankings.push({
                    ticker: sub.ticker,
                    name: sub.name,
                    rawRoc: rawRoc.toFixed(2) + '%',
                    vFactor: sub.v,
                    score: adjustedScore.toFixed(2)
                });
            }
        }
    }

    subSectorRankings.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    return {
        date,
        status: 'OK',
        macroScores: phaseScores,
        winningPhase,
        subSectorRankings
    };
}

async function run() {
    const args = process.argv.slice(2);
    const timeline = await loadData();
    console.log(`Daten geladen: ${timeline.length} Handelstage.\n`);

    if (args.includes('--backtest')) {
        console.log("Starte historischen Backtest...");
        const phaseCounts = { EARLY: 0, MID: 0, LATE: 0, RECESSION: 0 };
        const transitions = {};
        const phaseDurations = { EARLY: [], MID: [], LATE: [], RECESSION: [] };
        
        let currentPhase = null;
        let currentPhaseLength = 0;

        for (let i = 60; i < timeline.length; i++) {
            const result = analyzeDay(timeline, i);
            if (result.status === 'OK' && result.winningPhase) {
                const phase = result.winningPhase;
                phaseCounts[phase]++;
                
                if (currentPhase !== phase) {
                    if (currentPhase !== null) {
                        // Record transition
                        if (!transitions[currentPhase]) transitions[currentPhase] = {};
                        if (!transitions[currentPhase][phase]) transitions[currentPhase][phase] = 0;
                        transitions[currentPhase][phase]++;
                        
                        // Record duration of the phase that just ended
                        if (currentPhaseLength > 0) {
                            phaseDurations[currentPhase].push(currentPhaseLength);
                        }
                    }
                    currentPhase = phase;
                    currentPhaseLength = 1;
                } else {
                    currentPhaseLength++;
                }
            }
        }
        
        console.log("=== 1. Absolute Verteilung (Tage pro Phase) ===");
        console.table(phaseCounts);
        
        console.log("\n=== 2. Durchschnittliche Dauer pro Phase (in Tagen) ===");
        const avgDurations = {};
        for (const [phase, durations] of Object.entries(phaseDurations)) {
            if (durations.length > 0) {
                const sum = durations.reduce((a,b) => a+b, 0);
                avgDurations[phase] = (sum / durations.length).toFixed(1);
            } else {
                avgDurations[phase] = '0';
            }
        }
        console.table(avgDurations);

        console.log("\n=== 3. Übergangs-Matrix (Wer folgt auf wen?) ===");
        const transitionTable = {};
        for (const from of Object.keys(MACRO_SECTORS)) {
            transitionTable[from] = {};
            for (const to of Object.keys(MACRO_SECTORS)) {
                if (from === to) continue; // no self-transition in this logic
                transitionTable[from][to] = (transitions[from] && transitions[from][to]) ? transitions[from][to] : 0;
            }
        }
        console.table(transitionTable);
        
    } else {
        // Evaluate specific date or latest
        const dateArgIndex = args.indexOf('--date');
        let targetIndex = timeline.length - 1; // latest
        
        if (dateArgIndex !== -1 && args.length > dateArgIndex + 1) {
            const targetDate = args[dateArgIndex + 1];
            const foundIndex = timeline.findIndex(t => t.date === targetDate);
            if (foundIndex !== -1) {
                targetIndex = foundIndex;
            } else {
                console.error(`Datum ${targetDate} nicht gefunden (Feiertag/Wochenende?). Nutze den letzten verfügbaren Tag.`);
            }
        }

        const result = analyzeDay(timeline, targetIndex);
        if (result.status !== 'OK') {
            console.log(`Nicht genug Daten am ${result.date} (min. 60 Tage benötigt).`);
            return;
        }

        console.log(`========================================================`);
        console.log(` SEKTOR ROTATION ANALYSE für ${result.date}`);
        console.log(`========================================================`);
        console.log(`\n--- 1. MAKRO UHR (60-Tage Relative Stärke) ---`);
        
        const sortedMacro = Object.entries(result.macroScores)
            .sort((a, b) => b[1] - a[1])
            .map(([phase, score]) => ({ Phase: phase, RS_Score: score.toFixed(2) + '%' }));
        
        console.table(sortedMacro);
        
        console.log(`\n>> AKTUELLE PHASE: ** ${result.winningPhase} **`);

        console.log(`\n--- 2. SUB-SEKTOR SIGNALE (20-Tage Momentum x V-Faktor) ---`);
        console.table(result.subSectorRankings);
        
        console.log(`\n(Tipp: Führe 'node scratch/sectorRotation.js --date YYYY-MM-DD' aus, um historische Crashs zu analysieren, z.B. 2020-03-20 oder 2022-01-05)`);
    }
}

run().catch(console.error);
