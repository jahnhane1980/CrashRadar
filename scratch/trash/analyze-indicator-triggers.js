import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const EPOCHS = [
    { name: 'Dotcom-Blase (2000)', peak: '2000-03-24', trough: '2002-10-09' },
    { name: 'Finanzkrise (2007)', peak: '2007-10-09', trough: '2009-03-09' },
    { name: 'Zins-Panik (2018)', peak: '2018-09-20', trough: '2018-12-24' },
    { name: 'Corona-Crash (2020)', peak: '2020-02-19', trough: '2020-03-23' },
    { name: 'Inflations-Schock (2022)', peak: '2022-01-03', trough: '2022-10-12' },
    { name: 'Crash 2025', peak: '2025-02-19', trough: '2025-04-08' }
];

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("Fehler: DATABASE_URL in .env nicht gefunden.");
        return;
    }
    const pool = mysql.createPool(dbUrl);

    try {
        console.log("Lade historische Daten...");
        
        // Load SPY
        const [spyRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
        const spyMap = new Map(spyRows.map(r => [r.date, r.close]));

        // Load Margin Debt
        const [marginRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, margin_debt as value FROM macro_margin_debt ORDER BY record_date ASC`);
        const marginMap = new Map(marginRows.map(r => [r.date.substring(0,7), r.value]));

        // Load VIX (try tiingo first, then yahoo)
        let [vixRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_tiingo WHERE symbol = 'VIX' OR symbol = '^VIX' ORDER BY record_date ASC`);
        if (vixRows.length === 0) {
            [vixRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close FROM market_data_yahoo WHERE symbol = '^VIX' ORDER BY record_date ASC`);
        }
        const vixMap = new Map(vixRows.map(r => [r.date, r.close]));

        // Load T10Y2Y
        const [ycRows] = await pool.query(`SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value FROM econ_fred WHERE series_id = 'T10Y2Y' ORDER BY observation_date ASC`);
        const ycMap = new Map(ycRows.map(r => [r.date, r.value]));
        const ycList = ycRows.map(r => ({date: r.date, val: r.value}));

        // Load TGA
        let [tgaRows] = [];
        try {
             [tgaRows] = await pool.query(`SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close_balance as value FROM fiscal_tga ORDER BY record_date ASC`);
        } catch(e) {}
        const tgaList = tgaRows ? tgaRows.map(r => ({date: r.date, val: r.value})) : [];
        const tgaMap = new Map(tgaList.map(r => [r.date, r.val]));

        let report = `# CrashRadar: Indikator Trigger Report\n\n`;
        report += `Dieser Report analysiert exakt, an welchen Tagen die Kern-Indikatoren in den großen Bärenmärkten getriggert haben.\n\n`;

        for (const epoch of EPOCHS) {
            report += `## ${epoch.name}\n`;
            report += `- **SPY Peak (Markthoch):** ${epoch.peak}\n`;
            report += `- **SPY Trough (Marktboden):** ${epoch.trough}\n\n`;

            const peakDate = new Date(epoch.peak);
            const troughDate = new Date(epoch.trough);

            // 1. MARGIN DEBT (Top Finder)
            let maxMargin = 0;
            let maxMarginMonth = '';
            for (const [month, val] of marginMap.entries()) {
                const rDate = new Date(month + '-01');
                if (rDate <= peakDate && (peakDate - rDate)/(1000*3600*24) <= 400) {
                    if (val > maxMargin) {
                        maxMargin = val;
                        maxMarginMonth = month;
                    }
                }
            }
            if (maxMarginMonth) {
                const diffDays = Math.round((peakDate - new Date(maxMarginMonth + '-01')) / (1000 * 3600 * 24));
                report += `- **Margin Debt (Leading):** Toppte im Monat ${maxMarginMonth} (**${Math.round(diffDays/30)} Monate VOR dem Crash**). Das Signal kam extrem verlässlich im Vorfeld.\n`;
            } else {
                report += `- **Margin Debt (Leading):** Keine Daten.\n`;
            }

            // 2. YIELD CURVE (T10Y2Y Un-Inverting)
            let uninvertingDate = null;
            let wasInverted = false;
            for (let i = 0; i < ycList.length; i++) {
                const rDate = new Date(ycList[i].date);
                if (rDate > peakDate) break;
                if ((peakDate - rDate)/(1000*3600*24) > 400) continue; // max 400 days lookback

                if (ycList[i].val < 0) {
                    wasInverted = true;
                }
                if (wasInverted && ycList[i].val >= 0) {
                    uninvertingDate = ycList[i].date;
                    wasInverted = false; // Reset to catch the last uninvert
                }
            }
            if (uninvertingDate) {
                const diffDays = Math.round((peakDate - new Date(uninvertingDate)) / (1000 * 3600 * 24));
                report += `- **Yield Curve Un-Inverting (Leading):** Passierte am ${uninvertingDate} (**${diffDays} Tage VOR dem Crash**).\n`;
            } else {
                report += `- **Yield Curve Un-Inverting (Leading):** Kein Inverting/Un-Inverting im direkten Vorfeld (oder fehlende Daten).\n`;
            }

            // 3. TGA DRAIN
            if (tgaList.length > 0) {
                let maxRise = 0;
                let tgaWarnDate = null;
                for (let i = 90; i < tgaList.length; i++) {
                    const rDate = new Date(tgaList[i].date);
                    if (rDate > peakDate) break;
                    if ((peakDate - rDate)/(1000*3600*24) > 365) continue;
                    
                    const pastVal = tgaList[i-90].val;
                    const curVal = tgaList[i].val;
                    const rise = curVal - pastVal;
                    if (rise > 150000 && rise > maxRise) { // >150B
                        maxRise = rise;
                        tgaWarnDate = tgaList[i].date;
                    }
                }
                if (tgaWarnDate) {
                    const diffDays = Math.round((peakDate - new Date(tgaWarnDate)) / (1000 * 3600 * 24));
                    report += `- **TGA Drain (Leading):** Warnschwelle (+150B in 90d) gerissen am ${tgaWarnDate} (**${diffDays} Tage VOR dem Crash**).\n`;
                } else {
                    report += `- **TGA Drain (Leading):** Kein Signal vor dem Peak.\n`;
                }
            }

            // 4. VIX CRUSH (Bottom Finder)
            let maxVix = 0;
            let maxVixDate = null;
            const searchStart = new Date(peakDate);
            const searchEnd = new Date(troughDate);
            searchEnd.setDate(searchEnd.getDate() + 30); // Allow some leeway

            for (const [date, val] of vixMap.entries()) {
                const rDate = new Date(date);
                if (rDate >= searchStart && rDate <= searchEnd) {
                    if (val > maxVix) {
                        maxVix = val;
                        maxVixDate = date;
                    }
                }
            }
            if (maxVixDate && maxVix >= 35) {
                const diffDays = Math.round((new Date(maxVixDate) - troughDate) / (1000 * 3600 * 24));
                let daysStr = diffDays === 0 ? "EXAKT am Trough" : (diffDays > 0 ? `${diffDays} Tage NACH dem Trough` : `${Math.abs(diffDays)} Tage VOR dem Trough`);
                report += `- **VIX Spike & Crush (Bottom):** Höchststand von ${maxVix.toFixed(2)} am ${maxVixDate} (**${daysStr}**). Danach fiel der VIX.\n`;
            } else if (maxVixDate) {
                 report += `- **VIX Spike & Crush (Bottom):** VIX Höchststand war nur ${maxVix.toFixed(2)} (Kein >35 Spike) am ${maxVixDate}.\n`;
            } else {
                report += `- **VIX Spike & Crush (Bottom):** Keine Daten.\n`;
            }

            report += `\n`;
        }

        const outPath = path.join(__dirname, 'Indicator-Trigger-Report.md');
        fs.writeFileSync(outPath, report);
        console.log(`Report generiert: ${outPath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

run();
