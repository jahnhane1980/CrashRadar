import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole Margin Debt Daten
    const [marginRows] = await db.query(`
        SELECT record_date, margin_debt 
        FROM macro_margin_debt 
        ORDER BY record_date ASC
    `);

    // Hole SPY Monats-Schlusskurse zum Vergleich (Näherung: letzter Tag des Monats, oder einfach Monatsdurchschnitt)
    // Einfacher: Wir holen SPY Daten für die gleichen Daten (Anfang des Monats)
    const [spyRows] = await db.query(`
        SELECT record_date, close 
        FROM market_data_tiingo 
        WHERE symbol = 'SPY' 
        ORDER BY record_date ASC
    `);

    // Map SPY Daten nach Monat (YYYY-MM)
    const spyByMonth = {};
    for (const r of spyRows) {
        const month = new Date(r.record_date).toISOString().substring(0, 7);
        // Behalte den letzten Kurs des Monats
        spyByMonth[month] = r.close;
    }

    const data = marginRows.map(r => {
        const month = new Date(r.record_date).toISOString().substring(0, 7);
        return {
            month,
            margin_debt: r.margin_debt,
            spy: spyByMonth[month] || null
        };
    }).filter(d => d.spy !== null);

    console.log("Analyzing major crashes...");

    const crashes = [
        { name: "Dot-Com 2000-2002", start: "2000-01", end: "2003-01" },
        { name: "GFC 2007-2009", start: "2007-01", end: "2009-06" },
        { name: "Covid 2020", start: "2019-10", end: "2020-05" },
        { name: "Bear Market 2022", start: "2021-08", end: "2023-01" }
    ];

    for (const crash of crashes) {
        console.log(`\n--- ${crash.name} (${crash.start} to ${crash.end}) ---`);
        
        const periodData = data.filter(d => d.month >= crash.start && d.month <= crash.end);
        if (periodData.length === 0) continue;

        let peakMargin = 0;
        let peakMarginMonth = "";
        let peakSpy = 0;
        let peakSpyMonth = "";

        let troughMargin = Infinity;
        let troughMarginMonth = "";
        let troughSpy = Infinity;
        let troughSpyMonth = "";

        for (const d of periodData) {
            if (d.margin_debt > peakMargin) {
                peakMargin = d.margin_debt;
                peakMarginMonth = d.month;
            }
            if (d.spy > peakSpy) {
                peakSpy = d.spy;
                peakSpyMonth = d.month;
            }
        }

        // Trough only AFTER peak
        const afterPeakMarginData = periodData.filter(d => d.month >= peakMarginMonth);
        for (const d of afterPeakMarginData) {
            if (d.margin_debt < troughMargin) {
                troughMargin = d.margin_debt;
                troughMarginMonth = d.month;
            }
        }

        const afterPeakSpyData = periodData.filter(d => d.month >= peakSpyMonth);
        for (const d of afterPeakSpyData) {
            if (d.spy < troughSpy) {
                troughSpy = d.spy;
                troughSpyMonth = d.month;
            }
        }

        const marginDrawdown = ((troughMargin - peakMargin) / peakMargin * 100).toFixed(2);
        const spyDrawdown = ((troughSpy - peakSpy) / peakSpy * 100).toFixed(2);

        console.log(`Peak SPY:        ${peakSpyMonth} ($${peakSpy})`);
        console.log(`Peak Margin:     ${peakMarginMonth} ($${peakMargin}M)`);
        console.log(`Lead/Lag at Top: Margin peaked ${peakMarginMonth === peakSpyMonth ? 'SAME TIME' : (peakMarginMonth < peakSpyMonth ? 'BEFORE' : 'AFTER')} SPY`);
        
        console.log(`Trough SPY:      ${troughSpyMonth} ($${troughSpy})`);
        console.log(`Trough Margin:   ${troughMarginMonth} ($${troughMargin}M)`);
        
        console.log(`Drawdown SPY:    ${spyDrawdown}%`);
        console.log(`Drawdown Margin: ${marginDrawdown}% (Deleveraging)`);
    }

    await db.end();
}

main().catch(console.error);
