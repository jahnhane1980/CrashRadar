import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CRASHES = [
    { name: 'Dotcom-Blase (SPY)', date: '2000-03-24' },
    { name: 'Dotcom-Blase (QQQ)', date: '2000-03-09' },
    { name: 'Finanzkrise (SPY)', date: '2007-10-09' },
    { name: 'Zins-Panik (SPY)', date: '2018-09-20' },
    { name: 'Corona-Crash (SPY)', date: '2020-02-19' },
    { name: 'Inflations-Schock (QQQ)', date: '2021-11-19' },
    { name: 'Inflations-Schock (SPY)', date: '2022-01-03' },
    { name: 'Crash 2025 (SPY)', date: '2025-02-19' }
];

async function runBacktest() {
    console.log('📈 Starte Backtest: Challenger Report als Leading Indicator\n');
    const connection = await mysql.createConnection(process.env.DATABASE_URL);

    try {
        const [rows] = await connection.execute('SELECT * FROM econ_challenger ORDER BY record_date ASC');
        
        // Calculate SMA 6 (months) to detect spikes
        const data = rows.map((row, index, arr) => {
            let sum = 0;
            let count = 0;
            for (let i = Math.max(0, index - 6); i < index; i++) {
                sum += arr[i].value;
                count++;
            }
            const sma6 = count > 0 ? sum / count : row.value;
            const momPercent = index > 0 ? ((row.value - arr[index-1].value) / arr[index-1].value) * 100 : 0;
            const sma6Percent = ((row.value - sma6) / sma6) * 100;
            return {
                date: new Date(row.record_date),
                value: row.value,
                momPercent: momPercent.toFixed(2),
                sma6Percent: sma6Percent.toFixed(2),
                sma6: Math.round(sma6)
            };
        });

        for (const crash of CRASHES) {
            const crashDate = new Date(crash.date);
            const startDate = new Date(crashDate);
            startDate.setMonth(startDate.getMonth() - 3);
            const endDate = new Date(crashDate);
            endDate.setMonth(endDate.getMonth() + 1);

            console.log(`\n======================================================`);
            console.log(`🔥 Crash: ${crash.name} | Peak: ${crash.date}`);
            console.log(`Untersuche Challenger-Daten zwischen ${startDate.toISOString().split('T')[0]} und ${endDate.toISOString().split('T')[0]}`);
            console.log(`======================================================`);

            const windowData = data.filter(d => d.date >= startDate && d.date <= endDate);
            
            let triggered = false;
            let triggerDate = null;
            let triggerValue = '';

            if (windowData.length === 0) {
                console.log(`❌ Keine Daten im Auswertungszeitraum gefunden.`);
                continue;
            }

            for (const row of windowData) {
                const dateStr = row.date.toISOString().split('T')[0];
                const spike = parseFloat(row.sma6Percent);
                const mom = parseFloat(row.momPercent);
                
                let marker = '';
                // Thresholds basierend auf der These (> 50%)
                if (spike >= 50 || mom >= 50) {
                    marker = ' 🚨 [SPIKE DETECTED]';
                    if (!triggered && row.date <= crashDate) {
                        triggered = true;
                        triggerDate = dateStr;
                        const diffDays = Math.floor((crashDate - row.date) / (1000 * 60 * 60 * 24));
                        triggerValue = `Vorlauf: ${diffDays} Tage`;
                    }
                }

                console.log(`- ${dateStr} | Actual: ${row.value} | MoM: ${row.momPercent}% | vs SMA6: ${row.sma6Percent}%${marker}`);
            }

            if (triggered) {
                console.log(`\n✅ ERGEBNIS: Indikator hat VOR dem Peak erfolgreich angeschlagen! (${triggerValue})`);
            } else {
                console.log(`\n❌ ERGEBNIS: Kein valider Spike (>50%) vor dem Peak gefunden (oder erst danach).`);
            }
        }
        
    } catch (e) {
        console.error('Fehler beim Backtest:', e);
    } finally {
        await connection.end();
    }
}

runBacktest();
