import 'dotenv/config';
import mysql from 'mysql2/promise';

const MACRO_SECTORS = {
    'EARLY': ['XLF', 'XLY', 'XLRE'],
    'MID': ['XLK', 'XLC'],
    'LATE': ['XLB', 'XLE'],
    'RECESSION': ['XLV', 'XLU', 'XLP']
};

const TECH_SUB_SECTORS = [
    { ticker: 'SMH', v: 0.7, name: 'Semiconductors (Hardware/AI)' },
    { ticker: 'IGV', v: 0.8, name: 'Software / SaaS' },
    { ticker: 'CIBR', v: 0.8, name: 'Cybersecurity' },
    { ticker: 'FDN', v: 0.9, name: 'Internet Mega-Caps' },
    { ticker: 'IPAY', v: 0.8, name: 'FinTech & Payments' },
    { ticker: 'TDIV', v: 1.0, name: 'Value / Dividend Tech' },
    { ticker: 'ARKK', v: 0.6, name: 'Hyper-Growth (Spekulativ)' }
];

async function loadData() {
    console.log("Verbinde mit Datenbank...");
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    // SPY + Macro + Tech
    const allSymbols = ['SPY'];
    Object.values(MACRO_SECTORS).flat().forEach(s => allSymbols.push(s));
    TECH_SUB_SECTORS.forEach(s => allSymbols.push(s.ticker));

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

    const sortedDates = Object.keys(timeline).sort();
    return sortedDates.map(date => ({ date, prices: timeline[date] }));
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
    
    return ((currentRS - oldRS) / oldRS) * 100;
}

function analyzeDay(timeline, index) {
    const date = timeline[index].date;
    const LOOKBACK_MACRO = 60; 
    const LOOKBACK_TECH = 20;
    
    if (index < LOOKBACK_MACRO) return { date, status: 'NOT_ENOUGH_DATA' };

    // 1. MACRO RADAR (Top-Down)
    const phaseScores = {};
    for (const [phase, symbols] of Object.entries(MACRO_SECTORS)) {
        let sumRoc = 0, count = 0;
        for (const sym of symbols) {
            const roc = calculateRelativeStrengthRoc(timeline, index, LOOKBACK_MACRO, sym);
            if (roc !== null) { sumRoc += roc; count++; }
        }
        phaseScores[phase] = count > 0 ? (sumRoc / count) : -999;
    }

    let winningPhase = null;
    let maxScore = -Infinity;
    for (const [phase, score] of Object.entries(phaseScores)) {
        if (score > maxScore) {
            maxScore = score;
            winningPhase = phase;
        }
    }

    const radarStatus = (winningPhase === 'EARLY' || winningPhase === 'MID') ? '🟢 RISK-ON' : '🔴 RISK-OFF (WARNUNG)';

    // 2. TECH FLOW (Bottom-Up)
    const techRankings = [];
    for (const sub of TECH_SUB_SECTORS) {
        const rawRoc = calculateRelativeStrengthRoc(timeline, index, LOOKBACK_TECH, sub.ticker);
        if (rawRoc !== null) {
            const adjustedScore = rawRoc * sub.v;
            techRankings.push({
                Rank: 0, // placeholder
                Ticker: sub.ticker,
                Name: sub.name,
                Raw_Momentum: rawRoc.toFixed(2) + '%',
                V_Factor: sub.v,
                Final_Score: parseFloat(adjustedScore.toFixed(2))
            });
        }
    }

    techRankings.sort((a, b) => b.Final_Score - a.Final_Score);
    techRankings.forEach((r, i) => r.Rank = i + 1);

    return {
        date,
        status: 'OK',
        radarStatus,
        winningPhase,
        techRankings
    };
}

async function run() {
    const args = process.argv.slice(2);
    const timeline = await loadData();
    console.log(`Daten geladen: ${timeline.length} Handelstage.\n`);

    if (args.includes('--backtest')) {
        console.log("Starte historischen Backtest für Tech-Sub-Sektoren...");
        
        const counts = {};
        const transitions = {};
        const durations = {};
        TECH_SUB_SECTORS.forEach(s => {
            counts[s.ticker] = 0;
            transitions[s.ticker] = {};
            durations[s.ticker] = [];
        });

        let currentLeader = null;
        let currentLength = 0;

        for (let i = 60; i < timeline.length; i++) {
            const result = analyzeDay(timeline, i);
            if (result.status === 'OK' && result.techRankings.length > 0) {
                // Nur Tage werten, an denen das Radar "Grün" ist? 
                // Wir werten alle Tage, um die pure Tech-Rotation zu sehen!
                const leader = result.techRankings[0].Ticker;
                counts[leader] = (counts[leader] || 0) + 1;

                if (currentLeader !== leader) {
                    if (currentLeader !== null) {
                        if (!transitions[currentLeader][leader]) transitions[currentLeader][leader] = 0;
                        transitions[currentLeader][leader]++;
                        
                        if (currentLength > 0) {
                            if (!durations[currentLeader]) durations[currentLeader] = [];
                            durations[currentLeader].push(currentLength);
                        }
                    }
                    currentLeader = leader;
                    currentLength = 1;
                } else {
                    currentLength++;
                }
            }
        }

        console.log("\n=== 1. Absolute Dominanz (Tage auf Platz 1) ===");
        console.table(counts);

        console.log("\n=== 2. Durchschnittliche Dauer auf Platz 1 (in Tagen) ===");
        const avgDurations = {};
        for (const [ticker, durs] of Object.entries(durations)) {
            if (durs && durs.length > 0) {
                const sum = durs.reduce((a,b) => a+b, 0);
                avgDurations[ticker] = (sum / durs.length).toFixed(1);
            } else {
                avgDurations[ticker] = '0';
            }
        }
        console.table(avgDurations);

        console.log("\n=== 3. Tech-Zyklus Übergangs-Matrix (Wer löst wen ab?) ===");
        const transitionTable = {};
        const availableTickers = TECH_SUB_SECTORS.map(s => s.ticker);
        for (const from of availableTickers) {
            transitionTable[from] = {};
            for (const to of availableTickers) {
                if (from === to) continue;
                transitionTable[from][to] = (transitions[from] && transitions[from][to]) ? transitions[from][to] : 0;
            }
        }
        console.table(transitionTable);
        
    } else {
        const dateArgIndex = args.indexOf('--date');
    let targetIndex = timeline.length - 1;
    
    if (dateArgIndex !== -1 && args.length > dateArgIndex + 1) {
        const targetDate = args[dateArgIndex + 1];
        const foundIndex = timeline.findIndex(t => t.date === targetDate);
        if (foundIndex !== -1) {
            targetIndex = foundIndex;
        } else {
            console.error(`Datum ${targetDate} nicht gefunden. Nutze den letzten verfügbaren Tag.`);
        }
    }

    const result = analyzeDay(timeline, targetIndex);
    if (result.status !== 'OK') {
        console.log(`Nicht genug Daten am ${result.date}`);
        return;
    }

    console.log(`========================================================`);
    console.log(` 🚀 TECH-FLOW RADAR für ${result.date}`);
    console.log(`========================================================`);
    console.log(`\n📡 MAKRO-RADAR: ${result.radarStatus} (Führende Phase: ${result.winningPhase})`);
    if (result.radarStatus.includes('WARNUNG')) {
        console.log(`   -> Achtung: Das Geld fließt aktuell auf Makro-Ebene in Rohstoffe oder defensive Häfen!`);
    } else {
        console.log(`   -> Alles im grünen Bereich. Voller Fokus auf Alpha-Generierung in Tech.`);
    }

    console.log(`\n🏆 TECH SUB-SEKTOR RANKING (20-Tage Momentum x V-Faktor)`);
    console.table(result.techRankings);
    }
}

run().catch(console.error);
