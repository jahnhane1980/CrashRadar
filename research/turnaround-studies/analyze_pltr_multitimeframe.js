import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

// Helper to convert UTC date to New York ET time string "HH:mm"
function getNYTimeString(dateObj) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(dateObj);
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    return `${h}:${m}`;
}

function getNYDateString(dateObj) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(dateObj);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
}

async function runMultiTimeframeAnalysis() {
    console.log("================================================================================");
    console.log("   PLTR MULTI-TIMEFRAME ANALYSE: M5 SESSION-FENSTER, TAGE, WOCHEN & MONATE");
    console.log("   Fokus: Parabolische Phase (2024-2026), Korrektur-Volumen & Institutionelle Fenster");
    console.log("================================================================================\n");

    const cacheFile = path.join(CACHE_DIR, 'pltr_m5_rth_aggregated.json');
    let dailyData = [];

    if (fs.existsSync(cacheFile)) {
        console.log("Lade aggregierte M5-RTH-Daten aus Cache...");
        dailyData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
        console.log("Lade M5-Daten für PLTR aus Datenbank...");
        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        const [rows] = await connection.query(`
            SELECT record_time, open, high, low, close, volume
            FROM market_data_m5
            WHERE symbol = 'PLTR'
            ORDER BY record_time ASC;
        `);
        await connection.end();

        console.log(`Geladene M5 Kerzen: ${rows.length}. Aggregiere RTH Sessions (09:30 - 16:00 ET)...`);

        const daysMap = new Map();

        for (const r of rows) {
            const dObj = new Date(r.record_time);
            const nyDate = getNYDateString(dObj);
            const nyTime = getNYTimeString(dObj);

            // Filter for US Regular Trading Hours (09:30 - 16:00 ET)
            if (nyTime < '09:30' || nyTime >= '16:00') continue;

            if (!daysMap.has(nyDate)) {
                daysMap.set(nyDate, {
                    date: nyDate,
                    candles: [],
                    openCandles: [],  // 09:30 - 11:00 (1.5h)
                    closeCandles: [], // 14:30 - 16:00 (1.5h)
                    midCandles: []    // 11:00 - 14:30 (3.5h)
                });
            }

            const dayObj = daysMap.get(nyDate);
            const candle = {
                time: nyTime,
                open: parseFloat(r.open),
                high: parseFloat(r.high),
                low: parseFloat(r.low),
                close: parseFloat(r.close),
                volume: parseInt(r.volume, 10),
                isUp: parseFloat(r.close) >= parseFloat(r.open)
            };

            dayObj.candles.push(candle);
            if (nyTime < '11:00') dayObj.openCandles.push(candle);
            else if (nyTime >= '14:30') dayObj.closeCandles.push(candle);
            else dayObj.midCandles.push(candle);
        }

        // Aggregate daily metrics
        for (const [d, day] of daysMap.entries()) {
            if (day.candles.length < 10) continue; // skip half days/anomalies

            const openPrice = day.candles[0].open;
            const closePrice = day.candles[day.candles.length - 1].close;
            let highPrice = -Infinity;
            let lowPrice = Infinity;
            let totalVolume = 0;
            let totalUpVol = 0;
            let totalDownVol = 0;

            for (const c of day.candles) {
                if (c.high > highPrice) highPrice = c.high;
                if (c.low < lowPrice) lowPrice = c.low;
                totalVolume += c.volume;
                if (c.isUp) totalUpVol += c.volume;
                else totalDownVol += c.volume;
            }

            // Opening window metrics (09:30 - 11:00)
            let openVol = 0, openUpVol = 0, openDownVol = 0;
            for (const c of day.openCandles) {
                openVol += c.volume;
                if (c.isUp) openUpVol += c.volume;
                else openDownVol += c.volume;
            }

            // Closing window metrics (14:30 - 16:00)
            let closeVol = 0, closeUpVol = 0, closeDownVol = 0;
            for (const c of day.closeCandles) {
                closeVol += c.volume;
                if (c.isUp) closeUpVol += c.volume;
                else closeDownVol += c.volume;
            }

            dailyData.push({
                date: d,
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                close: closePrice,
                volume: totalVolume,
                pnlPct: parseFloat((((closePrice - openPrice) / openPrice) * 100).toFixed(2)),
                openWindow: {
                    volume: openVol,
                    volPct: parseFloat(((openVol / totalVolume) * 100).toFixed(1)),
                    upVol: openUpVol,
                    downVol: openDownVol,
                    deltaPct: openVol > 0 ? parseFloat((((openUpVol - openDownVol) / openVol) * 100).toFixed(1)) : 0
                },
                closeWindow: {
                    volume: closeVol,
                    volPct: parseFloat(((closeVol / totalVolume) * 100).toFixed(1)),
                    upVol: closeUpVol,
                    downVol: closeDownVol,
                    deltaPct: closeVol > 0 ? parseFloat((((closeUpVol - closeDownVol) / closeVol) * 100).toFixed(1)) : 0
                }
            });
        }

        dailyData.sort((a, b) => a.date.localeCompare(b.date));
        fs.writeFileSync(cacheFile, JSON.stringify(dailyData, null, 2));
        console.log(`Erfolgreich ${dailyData.length} RTH-Tage gespeichert in ${cacheFile}`);
    }

    console.log(`\nVerfügbare Handelstage in M5: ${dailyData.length} (von ${dailyData[0].date} bis ${dailyData[dailyData.length - 1].date})`);

    // =========================================================================
    // 1. HIGHER TIMEFRAME AGGREGATION (Woche, Monat, 3-Tage-Swing)
    // =========================================================================
    // Aggregate Weekly
    const weeklyMap = new Map();
    for (const day of dailyData) {
        // get ISO week Monday
        const dObj = new Date(day.date);
        const dayOfWeek = dObj.getDay(); // 0 is Sun, 1 is Mon
        const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const mon = new Date(dObj);
        mon.setDate(dObj.getDate() + diffToMon);
        const weekKey = mon.toISOString().split('T')[0];

        if (!weeklyMap.has(weekKey)) {
            weeklyMap.set(weekKey, {
                weekStart: weekKey,
                open: day.open,
                high: day.high,
                low: day.low,
                close: day.close,
                volume: day.volume,
                openWindowVol: day.openWindow.volume,
                closeWindowVol: day.closeWindow.volume,
                days: 1
            });
        } else {
            const w = weeklyMap.get(weekKey);
            if (day.high > w.high) w.high = day.high;
            if (day.low < w.low) w.low = day.low;
            w.close = day.close;
            w.volume += day.volume;
            w.openWindowVol += day.openWindow.volume;
            w.closeWindowVol += day.closeWindow.volume;
            w.days++;
        }
    }
    const weeklyData = Array.from(weeklyMap.values()).map(w => ({
        ...w,
        pnlPct: parseFloat((((w.close - w.open) / w.open) * 100).toFixed(2))
    }));

    // Aggregate Monthly
    const monthlyMap = new Map();
    for (const day of dailyData) {
        const monthKey = day.date.substring(0, 7);
        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
                month: monthKey,
                open: day.open,
                high: day.high,
                low: day.low,
                close: day.close,
                volume: day.volume,
                days: 1
            });
        } else {
            const m = monthlyMap.get(monthKey);
            if (day.high > m.high) m.high = day.high;
            if (day.low < m.low) m.low = day.low;
            m.close = day.close;
            m.volume += day.volume;
            m.days++;
        }
    }
    const monthlyData = Array.from(monthlyMap.values()).map(m => ({
        ...m,
        pnlPct: parseFloat((((m.close - m.open) / m.open) * 100).toFixed(2))
    }));

    // =========================================================================
    // 2. ANALYSE DER KORREKTUREN IN DER PARABOLISCHEN PHASE (PLTR 2024-2026)
    // =========================================================================
    // Identifiziere alle signifikanten Korrekturen (Drawdowns >= 10% vom Zwischenhoch)
    console.log("\n================================================================================");
    console.log("   2. KORREKTUREN & ABVERKAUFS-VOLUMEN IN DER PARABOLIK (PLTR)");
    console.log("================================================================================");

    const pullbacks = [];
    let curPeak = dailyData[0].high;
    let curPeakIdx = 0;
    let inPullback = false;
    let pbStartIdx = 0;
    let pbLow = dailyData[0].low;
    let pbLowIdx = 0;

    for (let i = 1; i < dailyData.length; i++) {
        const day = dailyData[i];
        if (day.high > curPeak && !inPullback) {
            curPeak = day.high;
            curPeakIdx = i;
        } else {
            const dd = ((day.close - curPeak) / curPeak) * 100;
            if (dd <= -10.0 && !inPullback) {
                // Pullback started
                inPullback = true;
                pbStartIdx = curPeakIdx;
                pbLow = day.low;
                pbLowIdx = i;
            } else if (inPullback) {
                if (day.low < pbLow) {
                    pbLow = day.low;
                    pbLowIdx = i;
                }
                // Check if recovered to new peak
                if (day.high > curPeak) {
                    pullbacks.push({
                        peakDate: dailyData[pbStartIdx].date,
                        peakPrice: curPeak,
                        troughDate: dailyData[pbLowIdx].date,
                        troughPrice: pbLow,
                        reboundDate: day.date,
                        reboundPrice: day.high,
                        depthPct: parseFloat((((pbLow - curPeak) / curPeak) * 100).toFixed(1)),
                        daysToTrough: pbLowIdx - pbStartIdx,
                        totalDuration: i - pbStartIdx,
                        peakIdx: pbStartIdx,
                        troughIdx: pbLowIdx,
                        reboundIdx: i
                    });
                    inPullback = false;
                    curPeak = day.high;
                    curPeakIdx = i;
                }
            }
        }
    }

    // Also check open pullback at the end if any
    if (inPullback) {
        pullbacks.push({
            peakDate: dailyData[pbStartIdx].date,
            peakPrice: curPeak,
            troughDate: dailyData[pbLowIdx].date,
            troughPrice: pbLow,
            reboundDate: 'OPEN (' + dailyData[dailyData.length - 1].date + ')',
            reboundPrice: dailyData[dailyData.length - 1].close,
            depthPct: parseFloat((((pbLow - curPeak) / curPeak) * 100).toFixed(1)),
            daysToTrough: pbLowIdx - pbStartIdx,
            totalDuration: dailyData.length - 1 - pbStartIdx,
            peakIdx: pbStartIdx,
            troughIdx: pbLowIdx,
            reboundIdx: dailyData.length - 1
        });
    }

    console.log(`Gefundene signifikante Korrekturen (>= -10%) in der Parabolik: ${pullbacks.length}\n`);

    // Detaillierte Volumen-Analyse jeder Korrektur
    const pullbackAnalysis = [];

    for (const pb of pullbacks) {
        // Berechne Durchschnittsvolumen VOR dem Pullback (20 Tage Run-Up)
        const runupStart = Math.max(0, pb.peakIdx - 20);
        const runupDays = dailyData.slice(runupStart, pb.peakIdx + 1);
        const avgRunupVol = runupDays.reduce((s, d) => s + d.volume, 0) / Math.max(1, runupDays.length);

        // Berechne Volumen WÄHREND des Pullbacks (vom Peak bis zum Trough)
        const pbDays = dailyData.slice(pb.peakIdx + 1, pb.troughIdx + 1);
        const avgPbVol = pbDays.length > 0 ? pbDays.reduce((s, d) => s + d.volume, 0) / pbDays.length : 0;
        const pbVolRatio = avgRunupVol > 0 ? (avgPbVol / avgRunupVol) : 1.0;

        // M5 Opening & Closing Delta während der Korrekturtage
        let totalOpenDelta = 0;
        let totalCloseDelta = 0;
        let openVolShare = 0;
        let closeVolShare = 0;

        for (const d of pbDays) {
            totalOpenDelta += d.openWindow.deltaPct;
            totalCloseDelta += d.closeWindow.deltaPct;
            openVolShare += d.openWindow.volPct;
            closeVolShare += d.closeWindow.volPct;
        }

        const avgOpenDelta = pbDays.length > 0 ? totalOpenDelta / pbDays.length : 0;
        const avgCloseDelta = pbDays.length > 0 ? totalCloseDelta / pbDays.length : 0;
        const avgOpenVolShare = pbDays.length > 0 ? openVolShare / pbDays.length : 0;
        const avgCloseVolShare = pbDays.length > 0 ? closeVolShare / pbDays.length : 0;

        pullbackAnalysis.push({
            Peak: `${pb.peakDate} ($${pb.peakPrice.toFixed(2)})`,
            Tief: `${pb.troughDate} ($${pb.troughPrice.toFixed(2)})`,
            Korrektur: `${pb.depthPct} %`,
            Tage: `${pb.daysToTrough}d`,
            VolRatio: `${pbVolRatio.toFixed(2)}x ${pbVolRatio < 0.85 ? '🟢 Dry-Up' : pbVolRatio > 1.25 ? '🔴 Distribution' : '⚪ Neutral'}`,
            OpenDelta: `${avgOpenDelta >= 0 ? '+' : ''}${avgOpenDelta.toFixed(1)} %`,
            CloseDelta: `${avgCloseDelta >= 0 ? '+' : ''}${avgCloseDelta.toFixed(1)} %`,
            OpenShare: `${avgOpenVolShare.toFixed(0)} %`,
            CloseShare: `${avgCloseVolShare.toFixed(0)} %`,
            Charakter: pbVolRatio < 0.85 && avgCloseDelta >= -5.0 
                ? '✅ GESUNDER DIP (Hold!)' 
                : pbVolRatio > 1.25 || avgCloseDelta < -15.0
                    ? '⚠️ INSTITUTIONELLER DUMP'
                    : '⚡ KONSOLIDIERUNG'
        });
    }

    console.table(pullbackAnalysis);

    // =========================================================================
    // 3. MULTI-TIMEFRAME EBENEN-VERGLEICH (Tag, Woche, Monat)
    // =========================================================================
    console.log("\n================================================================================");
    console.log("   3. MULTI-TIMEFRAME STATISTIKEN: WOCHEN- UND MONATS-KERZEN");
    console.log("================================================================================");
    
    console.log(`\nLetzte 10 Monats-Kerzen (Monthly Bars):`);
    console.table(monthlyData.slice(-10).map(m => ({
        Monat: m.month,
        Open: `$${m.open.toFixed(2)}`,
        High: `$${m.high.toFixed(2)}`,
        Low: `$${m.low.toFixed(2)}`,
        Close: `$${m.close.toFixed(2)}`,
        Rendite: `${m.pnlPct >= 0 ? '+' : ''}${m.pnlPct.toFixed(1)} %`,
        Volumen: `${(m.volume / 1e6).toFixed(0)} Mio`,
        Handelstage: m.days
    })));

    console.log(`\nAusgewählte Wochen-Kerzen um das Parabolik-Top (Oktober 2025 - Februar 2026):`);
    console.table(weeklyData.filter(w => w.weekStart >= '2025-10-01' && w.weekStart <= '2026-03-01').map(w => ({
        WocheAb: w.weekStart,
        Open: `$${w.open.toFixed(2)}`,
        High: `$${w.high.toFixed(2)}`,
        Low: `$${w.low.toFixed(2)}`,
        Close: `$${w.close.toFixed(2)}`,
        Rendite: `${w.pnlPct >= 0 ? '+' : ''}${w.pnlPct.toFixed(1)} %`,
        Volumen: `${(w.volume / 1e6).toFixed(0)} Mio`
    })));
}

runMultiTimeframeAnalysis().catch(console.error);
