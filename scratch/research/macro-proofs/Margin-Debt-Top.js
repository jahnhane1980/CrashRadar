import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeMarginDebt() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade Daten für FINRA Margin Debt und SPY...");
        
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '1999-01-01' ORDER BY record_date ASC`);
        const [marginRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m') as month, MAX(margin_debt) as value FROM macro_margin_debt GROUP BY month ORDER BY month ASC`);

        // SPY Tops aus dem Dokument:
        const tops = [
            { name: 'DotCom Bubble', date: '2000-08-31' },
            { name: 'Finanzkrise', date: '2007-10-09' },
            { name: 'Zins-/Inflations-Schock', date: '2022-01-03' }
        ];

        console.log("\n========================================================");
        console.log("   MARGIN DEBT ANALYSE: TOP VORLAUF (2-6 MONATE)");
        console.log("========================================================");

        for(const top of tops) {
            const spyTopDate = new Date(top.date);
            const topMonthStr = spyTopDate.toISOString().substring(0, 7);

            // Finde das absolute Max vom Margin Debt in den letzten 12 Monaten vor dem SPY Peak
            let maxMargin = 0;
            let maxMarginMonth = '';

            for(const row of marginRows) {
                const rowDate = new Date(row.month + '-01');
                
                // Wir schauen nur auf Daten vor oder exakt im Monat des SPY Tops
                if(rowDate <= spyTopDate) {
                    const diffMonths = (spyTopDate.getFullYear() - rowDate.getFullYear()) * 12 + (spyTopDate.getMonth() - rowDate.getMonth());
                    
                    if(diffMonths <= 12 && diffMonths >= 0) {
                        if(row.value > maxMargin) {
                            maxMargin = row.value;
                            maxMarginMonth = row.month;
                        }
                    }
                }
            }

            if(maxMarginMonth !== '') {
                const marginDate = new Date(maxMarginMonth + '-01');
                const diffMonths = (spyTopDate.getFullYear() - marginDate.getFullYear()) * 12 + (spyTopDate.getMonth() - marginDate.getMonth());
                
                console.log(`--- ${top.name} ---`);
                console.log(`SPY Top: ${topMonthStr}`);
                console.log(`Margin Debt Top: ${maxMarginMonth}`);
                console.log(`-> Vorlauf: ${diffMonths} Monate`);
                if(diffMonths >= 2 && diffMonths <= 6) {
                    console.log(`-> Bestätigt: Margin Debt toppte exakt im 2-6 Monats-Fenster vorher.`);
                } else if(diffMonths > 6) {
                    console.log(`-> Signal war sogar noch früher (${diffMonths} Monate).`);
                } else {
                    console.log(`-> Zeitgleich oder zu spät.`);
                }
                console.log("");
            } else {
                console.log(`Keine Daten für ${top.name} gefunden.\n`);
            }
        }

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeMarginDebt();
