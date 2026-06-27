import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    const db = await mysql.createConnection(process.env.DATABASE_URL);

    // Hole Daten für die letzten 6 Monate (ab ca. 2026-01-01)
    const [gdxRows] = await db.query(`SELECT record_date, close FROM market_data_tiingo WHERE symbol = 'GDX' AND record_date >= '2025-12-01' ORDER BY record_date ASC`);
    const [goldRows] = await db.query(`SELECT record_date, close FROM market_data_yahoo WHERE symbol = 'GC=F' AND record_date >= '2025-12-01' ORDER BY record_date ASC`);
    const [dxyRows] = await db.query(`SELECT record_date, close FROM market_data_yahoo WHERE symbol = 'DX-Y.NYB' AND record_date >= '2025-12-01' ORDER BY record_date ASC`);

    await db.end();

    console.log("=== AKTUELLE MARKT-TRENDS (LETZTE 6 MONATE) ===");
    console.log(`Betrachtungszeitraum: 2025-12-01 bis heute\n`);

    const printTrend = (name, rows) => {
        if (!rows || rows.length === 0) return;
        
        let first = parseFloat(rows[0].close);
        let max = first;
        let min = first;
        let last = parseFloat(rows[rows.length - 1].close);
        
        let maxDate = rows[0].record_date;
        let minDate = rows[0].record_date;

        for (let r of rows) {
            let val = parseFloat(r.close);
            if (val > max) { max = val; maxDate = r.record_date; }
            if (val < min) { min = val; minDate = r.record_date; }
        }

        const formatD = (d) => d instanceof Date ? d.toISOString().substring(0, 10) : d;
        const ret = ((last - first) / first) * 100;
        const drawdownFromPeak = ((last - max) / max) * 100;

        console.log(`--- ${name} ---`);
        console.log(`Start (Dez 2025) : ${first.toFixed(2)}`);
        console.log(`Top (Allzeithoch/Lokales Hoch): ${max.toFixed(2)} am ${formatD(maxDate)}`);
        console.log(`Aktuell (Letzter Close) : ${last.toFixed(2)}`);
        console.log(`Drawdown vom Top : ${drawdownFromPeak.toFixed(2)}%`);
        console.log(`Gesamt-Trend : ${ret > 0 ? '+' : ''}${ret.toFixed(2)}%\n`);
    };

    printTrend('Gold (GC=F)', goldRows);
    printTrend('GDX (Gold Miners)', gdxRows);
    printTrend('DXY (US-Dollar Index)', dxyRows);

}

main().catch(console.error);
