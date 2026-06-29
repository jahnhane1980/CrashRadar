import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { AnalysisRepository } from '../src/core/repositories/AnalysisRepository.js';
import { TimeSeriesService } from '../src/services/TimeSeriesService.js';
import { MLRegimeService } from '../src/services/MLRegimeService.js';

async function extract() {
    const repo = new AnalysisRepository();
    const startDate = '2019-01-01'; // Get data from 2019 onwards
    
    console.log('Loading raw data...');
    const rawData = await repo.getAllRawData(startDate);
    console.log('Building timeline...');
    const timelineDict = TimeSeriesService.buildTimeline(rawData);
    
    const dates = Object.keys(timelineDict).sort();
    const state = await repo.getInitialState(startDate);
    
    const timeline = [];
    console.log('Forward filling...');
    for (const date of dates) {
        Object.assign(state, timelineDict[date]);
        timeline.push({
            date,
            SPY: state.SPY,
            QQQ: state.QQQ,
            VIX: state.VIX,
            TOTRESNS: state.TOTRESNS,
            TGA: state.TGA,
            Spread10y2y: state.T10Y2Y,
            SahmRule: state.SAHMREALTIME,
            MarginDebt: state.MarginDebt,
            HYG: state.HYG,
            BIZD: state.BIZD,
            BKLN: state.BKLN,
            DFF: state.DFF,
            T10YIE: state.T10YIE,
            DXY: state.DXY,
            SKEW: state.SKEW,
            SPY_ShortVolumeRatio: timelineDict[date]?.SPY_ShortVolumeRatio || state.SPY_ShortVolumeRatio,
            TotalPCR: timelineDict[date]?.TotalPCR || state.TotalPCR,
            CBOE_SPY: state.CBOE_SPY,
            BTC: state.BTC,
            Gold: state.Gold
        });
    }

    console.log('Finding tops and bottoms...');
    const WINDOW = 60; // 60 days local extrema
    const EXPORT_WINDOW = 20; // 4 weeks = 20 trading days
    
    const extrema = [];
    for (let i = WINDOW; i < timeline.length - WINDOW; i++) {
        if (!timeline[i].QQQ) continue;
        
        let isTop = true;
        let isBottom = true;
        for (let j = i - WINDOW; j <= i + WINDOW; j++) {
            if (i === j || !timeline[j].QQQ) continue;
            if (timeline[j].QQQ > timeline[i].QQQ) isTop = false;
            if (timeline[j].QQQ < timeline[i].QQQ) isBottom = false;
        }
        
        if (isTop || isBottom) {
            // Also ensure it's a significant move (e.g. at least 10% drop from top, or 10% rally from bottom)
            let significant = false;
            if (isTop) {
                let minAfter = timeline[i].QQQ;
                for(let j=i; j<=i+WINDOW; j++) if(timeline[j].QQQ < minAfter) minAfter = timeline[j].QQQ;
                if ((timeline[i].QQQ - minAfter) / timeline[i].QQQ > 0.10) significant = true; // 10% drop
            } else if (isBottom) {
                let maxAfter = timeline[i].QQQ;
                for(let j=i; j<=i+WINDOW; j++) if(timeline[j].QQQ > maxAfter) maxAfter = timeline[j].QQQ;
                if ((maxAfter - timeline[i].QQQ) / timeline[i].QQQ > 0.10) significant = true; // 10% rally
            }
            
            if (significant) {
                extrema.push({ index: i, type: isTop ? 'TOP' : 'BOTTOM', date: timeline[i].date });
            }
        }
    }

    console.log(`Found ${extrema.length} significant extrema:`, extrema.map(e => `${e.date} (${e.type})`));
    
    // ML Prediction load
    const mlService = new MLRegimeService('qqq_regime_v1');
    let hasModel = false;
    try {
        await mlService.loadModel();
        hasModel = true;
        console.log('ML Model loaded successfully.');
    } catch (e) {
        console.log('Failed to load ML model:', e.message);
    }
    
    // Gather export data
    const exportData = [];
    
    for (const ex of extrema) {
        const startIdx = Math.max(0, ex.index - EXPORT_WINDOW);
        const endIdx = Math.min(timeline.length - 1, ex.index + EXPORT_WINDOW);
        
        for (let i = startIdx; i <= endIdx; i++) {
            const row = timeline[i];
            const daysOffset = i - ex.index;
            
            let mlPhase = '';
            let mlConf = '';
            
            if (hasModel && i >= 60) {
                try {
                    // Provide candles up to current day
                    const candles = timeline.slice(0, i + 1).map(t => ({ close: t.QQQ || t.SPY }));
                    const pred = await mlService.predict(candles);
                    mlPhase = pred.phase;
                    mlConf = pred.confidence.toFixed(3);
                } catch(e) {}
            }

            exportData.push({
                Extremum_Date: ex.date,
                Extremum_Type: ex.type,
                Days_Offset: daysOffset,
                Date: row.date,
                QQQ: row.QQQ,
                SPY: row.SPY,
                VIX: row.VIX,
                TOTRESNS: row.TOTRESNS,
                TGA: row.TGA,
                Spread10y2y: row.Spread10y2y,
                SahmRule: row.SahmRule,
                MarginDebt: row.MarginDebt,
                HYG: row.HYG,
                BIZD: row.BIZD,
                BKLN: row.BKLN,
                DFF: row.DFF,
                T10YIE: row.T10YIE,
                DXY: row.DXY,
                SKEW: row.SKEW,
                SPY_ShortVol: row.SPY_ShortVolumeRatio,
                PCR: row.TotalPCR,
                CBOE_SPY: row.CBOE_SPY,
                BTC: row.BTC,
                Gold: row.Gold,
                ML_Phase: mlPhase,
                ML_Confidence: mlConf
            });
        }
    }
    
    // Write CSV
    if (exportData.length > 0) {
        const headers = Object.keys(exportData[0]).join(',');
        const rows = exportData.map(row => Object.values(row).map(v => v === null || v === undefined ? '' : v).join(','));
        fs.writeFileSync('scratch/extrema_analysis.csv', [headers, ...rows].join('\n'));
        console.log('Saved to scratch/extrema_analysis.csv');
    } else {
        console.log('No extrema found to export.');
    }

    await repo.close();
}

extract().catch(console.error);
