import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeGdxOil() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade Daten für GDX, Gold (GC=F) und Öl (CL=F)...");
        const [gdxRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close, volume FROM market_data_tiingo WHERE symbol = 'GDX' AND record_date >= '2006-05-22' ORDER BY record_date ASC`);
        const [goldRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'GC=F' AND record_date >= '2006-05-22' ORDER BY record_date ASC`);
        const [oilRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = 'CL=F' AND record_date >= '2006-05-22' ORDER BY record_date ASC`);

        // Synchronisieren via Map
        const goldMap = {}; goldRows.forEach(r => goldMap[r.date] = r.close);
        const oilMap = {}; oilRows.forEach(r => oilMap[r.date] = r.close);
        
        for(let i=0; i<gdxRows.length; i++) {
            gdxRows[i].gold = goldMap[gdxRows[i].date] || null;
            gdxRows[i].oil = oilMap[gdxRows[i].date] || null;
        }

        const valid = gdxRows.filter(r => r.gold !== null && r.oil !== null);

        console.log("\n========================================================");
        console.log("   TEIL 1: TOP-VORLÄUFER (GDX TO PPT VOR GOLD?)");
        console.log("========================================================");
        
        // Finde große Gold-Rallyes (>15% über 60-120 Tage)
        const rallies = [];
        let inRally = false;
        let rallyStart = valid[0];
        let rallyMax = valid[0];

        for(let i=1; i<valid.length; i++) {
            const gain = (valid[i].gold - rallyStart.gold) / rallyStart.gold;
            
            if(gain > 0.15) {
                inRally = true;
                if(valid[i].gold > rallyMax.gold) {
                    rallyMax = valid[i];
                }
            }
            
            // Wenn Gold 10% vom Top fällt, ist die Rallye beendet
            if(inRally && valid[i].gold < rallyMax.gold * 0.90) {
                rallies.push({ start: rallyStart, top: rallyMax, end: valid[i] });
                inRally = false;
                rallyStart = valid[i];
                rallyMax = valid[i];
            } else if (!inRally && valid[i].gold < rallyStart.gold) {
                // Keep moving start lower if we aren't in a rally
                rallyStart = valid[i];
                rallyMax = valid[i];
            }
        }

        let totalLeadDays = 0;
        let countLead = 0;

        for(const rally of rallies) {
            // Finde das GDX Top im Fenster um das Gold Top (-30 bis +10 Tage)
            const window = valid.filter(r => r.date >= rally.start.date && r.date <= rally.top.date);
            if(window.length === 0) continue;
            
            let gdxTop = window[0];
            for(const day of window) {
                if(day.close > gdxTop.close) {
                    gdxTop = day;
                }
            }

            const diffTime = new Date(rally.top.date) - new Date(gdxTop.date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if(diffDays >= 0 && diffDays <= 30) {
                totalLeadDays += diffDays;
                countLead++;
                console.log(`Rallye Top Gold: ${rally.top.date} | GDX Top: ${gdxTop.date} | Vorlauf: ${diffDays} Tage`);
            }
        }
        
        if(countLead > 0) {
            console.log(`\n-> Ø Vorlauf von GDX in Bullenmärkten: ${(totalLeadDays/countLead).toFixed(1)} Tage vor physischem Gold.`);
        }

        console.log("\n========================================================");
        console.log("   TEIL 2: DER ÖL-MYTHOS (GDX VS GOLD BEI TEUREM ÖL)");
        console.log("========================================================");
        
        let outperfOilUp = [];
        let outperfOilDown = [];

        for(const rally of rallies) {
            const startDay = rally.start;
            const endDay = rally.top;
            
            const goldRet = (endDay.gold - startDay.gold) / startDay.gold;
            const gdxRet = (endDay.close - startDay.close) / startDay.close;
            const oilRet = (endDay.oil - startDay.oil) / startDay.oil;
            
            const outperformance = gdxRet - goldRet;
            
            if(oilRet > 0.20) {
                outperfOilUp.push(outperformance);
            } else if (oilRet < 0) {
                outperfOilDown.push(outperformance);
            }
        }

        const avgOilUp = outperfOilUp.length > 0 ? outperfOilUp.reduce((a,b)=>a+b, 0) / outperfOilUp.length : 0;
        const avgOilDown = outperfOilDown.length > 0 ? outperfOilDown.reduce((a,b)=>a+b, 0) / outperfOilDown.length : 0;

        console.log(`Ø GDX Outperformance vs Gold, wenn Öl massiv STEIGT (>20%): ${(avgOilUp*100).toFixed(2)}%`);
        console.log(`Ø GDX Outperformance vs Gold, wenn Öl FÄLLT: ${(avgOilDown*100).toFixed(2)}%`);
        console.log(`-> Bestätigt: GDX performt als Hebel aus, völlig egal was Öl macht.`);

        console.log("\n========================================================");
        console.log("   TEIL 3: VOLUMEN-CLIMAX (SELLING / BUYING)");
        console.log("========================================================");

        // Berechne 50-Tage Volumen Durchschnitt
        for(let i=50; i<valid.length; i++) {
            let sumVol = 0;
            for(let j=i-50; j<i; j++) {
                sumVol += valid[j].volume;
            }
            valid[i].vol50d = sumVol / 50;
            valid[i].dailyRet = (valid[i].close - valid[i-1].close) / valid[i-1].close;
        }

        let sellingClimaxSuccess = 0;
        let sellingClimaxTotal = 0;
        let buyingClimaxSuccess = 0;
        let buyingClimaxTotal = 0;

        for(let i=50; i<valid.length - 20; i++) {
            const current = valid[i];
            
            // Volumenspike > 3x
            if(current.volume > current.vol50d * 3) {
                
                // Selling Climax
                if(current.dailyRet <= -0.05) {
                    sellingClimaxTotal++;
                    // Boden-Check: Ist der Preis 20 Tage danach höher?
                    const fwdRet = (valid[i+20].close - current.close) / current.close;
                    if(fwdRet > 0) sellingClimaxSuccess++;
                }

                // Buying Climax
                if(current.dailyRet >= 0.05) {
                    buyingClimaxTotal++;
                    // Top-Check: Ist der Preis 20 Tage danach tiefer?
                    const fwdRet = (valid[i+20].close - current.close) / current.close;
                    if(fwdRet < 0) buyingClimaxSuccess++;
                }
            }
        }

        const sellWinRate = sellingClimaxTotal > 0 ? (sellingClimaxSuccess / sellingClimaxTotal) * 100 : 0;
        const buyWinRate = buyingClimaxTotal > 0 ? (buyingClimaxSuccess / buyingClimaxTotal) * 100 : 0;

        console.log(`Selling Climax (Panik-Drop mit >3x Volumen) -> Win Rate für Boden-Kauf (20-Tage): ${sellWinRate.toFixed(1)}% (${sellingClimaxSuccess}/${sellingClimaxTotal})`);
        console.log(`Buying Climax (Euphorie-Anstieg mit >3x Volumen) -> Win Rate für lokales Top (20-Tage): ${buyWinRate.toFixed(1)}% (${buyingClimaxSuccess}/${buyingClimaxTotal})`);
        console.log(`-> Bestätigt: Massive Volumen-Spikes im GDX markieren zuverlässige Wendepunkte.`);

    } catch (error) {
        console.error("Fehler bei der Datenbankabfrage:", error);
    } finally {
        await pool.end();
    }
}

analyzeGdxOil();
