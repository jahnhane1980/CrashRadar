import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
    console.log("Verbinde mit Datenbank...");
    const pool = mysql.createPool(process.env.DATABASE_URL);
    
    // We only need SMH, IGV, and SPY
    const [rows] = await pool.query(`
        SELECT symbol, DATE_FORMAT(record_date, '%Y-%m-%d') as date, close 
        FROM market_data_tiingo 
        WHERE symbol IN ('SMH', 'IGV', 'SPY') AND record_date >= '2001-08-01'
        ORDER BY record_date ASC
    `);
    await pool.end();

    const timeline = {};
    rows.forEach(row => {
        if (!timeline[row.date]) timeline[row.date] = {};
        timeline[row.date][row.symbol] = row.close;
    });

    // Wir brauchen nur das Monats-Ende für langfristige Zyklen (Monthly Data)
    const monthlyData = [];
    let currentMonth = '';
    
    const dates = Object.keys(timeline).sort();
    dates.forEach(date => {
        const month = date.substring(0, 7); // YYYY-MM
        const prices = timeline[date];
        if (prices.SMH && prices.IGV && prices.SPY) {
            // Wir überschreiben es jeden Tag im Monat, sodass am Ende der Monats-Schlusskurs bleibt
            monthlyData[month] = { date, smh: prices.SMH, igv: prices.IGV, spy: prices.SPY };
        }
    });

    const sortedMonths = Object.keys(monthlyData).sort().map(m => monthlyData[m]);
    
    console.log(`Geladen: ${sortedMonths.length} Monate (seit 2001)`);

    // Berechne das Verhältnis (Ratio) SMH / IGV
    const ratios = sortedMonths.map(m => ({
        date: m.date,
        ratio: m.smh / m.igv
    }));

    // Nutze Gleitende Durchschnitte (Moving Averages) um den Base-Effekt (ROC-Glitch) zu eliminieren
    const SHORT_MA_LEN = 3;  // 3-Monats Trend (Reagiert schnell)
    const LONG_MA_LEN = 10;  // 10-Monats Trend (Bestätigt den Makro-Zyklus)
    
    let currentLeader = null;
    let cycleStart = null;
    let cycles = [];

    for (let i = LONG_MA_LEN; i < ratios.length; i++) {
        const current = ratios[i];
        
        // Berechne Short MA
        let shortSum = 0;
        for (let j = 0; j < SHORT_MA_LEN; j++) shortSum += ratios[i - j].ratio;
        const shortMa = shortSum / SHORT_MA_LEN;

        // Berechne Long MA
        let longSum = 0;
        for (let j = 0; j < LONG_MA_LEN; j++) longSum += ratios[i - j].ratio;
        const longMa = longSum / LONG_MA_LEN;

        // Wenn der kurzfristige Trend über dem langfristigen liegt, out-performt Hardware (SMH)
        const leader = shortMa > longMa ? 'HARDWARE (SMH)' : 'SOFTWARE (IGV)';
        
        if (currentLeader !== leader) {
            if (currentLeader !== null) {
                cycles.push({
                    phase: currentLeader,
                    start: cycleStart,
                    end: current.date,
                    durationMonths: i - ratios.findIndex(r => r.date === cycleStart)
                });
            }
            currentLeader = leader;
            cycleStart = current.date;
        }
    }
    
    // Aktueller Zyklus
    cycles.push({
        phase: currentLeader,
        start: cycleStart,
        end: 'HEUTE',
        durationMonths: sortedMonths.length - sortedMonths.findIndex(m => m.date === cycleStart)
    });

    console.log("\n=== HISTORISCHE TECH-MAKRO-ZYKLEN (Hardware vs Software) ===");
    console.table(cycles.map(c => ({
        Phase: c.phase,
        Start: c.start,
        End: c.end,
        'Dauer (Monate)': c.durationMonths,
        'Dauer (Jahre)': (c.durationMonths / 12).toFixed(1)
    })));

    // Fasse zusammen
    let hwMonths = 0; let hwCount = 0;
    let swMonths = 0; let swCount = 0;

    cycles.forEach(c => {
        if (c.phase.includes('HARDWARE')) { hwMonths += c.durationMonths; hwCount++; }
        else { swMonths += c.durationMonths; swCount++; }
    });

    console.log(`\nDURCHSCHNITTE:`);
    console.log(`- Hardware Zyklen dauern im Schnitt: ${(hwMonths/hwCount/12).toFixed(1)} Jahre`);
    console.log(`- Software Zyklen dauern im Schnitt: ${(swMonths/swCount/12).toFixed(1)} Jahre`);
}

run().catch(console.error);
