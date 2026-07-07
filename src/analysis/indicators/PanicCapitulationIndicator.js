import { MathUtils } from '../../utils/MathUtils.js';

export class PanicCapitulationIndicator {
    constructor() {
        this.name = 'Panik-Kapitulation (VIX + CBOE + RSI)';
        this.category = 'TROUGH';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 90) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 90 Tage)' };
        
        const currentDay = timeline[timeline.length - 1];
        let currentPrice = currentDay?.assets?.SPY;
        let currentVix = currentDay?.assets?.VIX;
        let currentCboe = currentDay?.assets?.CBOE_SPY;
        
        if (currentPrice == null || currentVix == null || currentCboe == null) {
            return { status: 'UNKNOWN', message: 'Keine (vollständigen) Daten' };
        }

        currentPrice = Number(currentPrice);
        currentVix = Number(currentVix);
        currentCboe = Number(currentCboe);
        
        if (isNaN(currentPrice) || isNaN(currentVix) || isNaN(currentCboe)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        }
        
        const prices = timeline.map(t => t?.assets?.SPY != null ? Number(t.assets.SPY) : null);
        const rsiArr = MathUtils.getRsiArray(timeline, t => t?.assets?.SPY != null ? Number(t.assets.SPY) : null, 14);
        
        if (!Array.isArray(rsiArr) || rsiArr.length < 40) return { status: 'UNKNOWN', message: 'Zu wenig Preisdaten für RSI' };
        
        let currentRsi = rsiArr[rsiArr.length - 1];
        if (currentRsi == null || isNaN(Number(currentRsi))) return { status: 'UNKNOWN', message: 'RSI konnte nicht berechnet werden' };
        currentRsi = Number(currentRsi);
        
        const sma90Vol = MathUtils.getAverageForSlice(timeline, t => t?.assets?.CBOE_SPY != null ? Number(t.assets.CBOE_SPY) : null, 90, 1) || 0;
        const isCboeSpike = sma90Vol > 0 && currentCboe >= sma90Vol * 1.5;
        const cboeMult = sma90Vol > 0 ? (currentCboe / sma90Vol) : 0;
        
        let prevLowPrice = Infinity, prevLowRsi = 0;
        for (let j = 5; j <= 40; j++) {
            const idx = prices.length - 1 - j;
            if (idx >= 0 && prices[idx] != null && !isNaN(prices[idx]) && rsiArr[idx] != null && !isNaN(rsiArr[idx])) {
                if (prices[idx] < prevLowPrice) {
                    prevLowPrice = prices[idx];
                    prevLowRsi = Number(rsiArr[idx]);
                }
            }
        }
        
        const isNewLow = prevLowPrice !== Infinity && currentPrice <= prevLowPrice * 1.02;
        const isRsiHigher = currentRsi > prevLowRsi + 2;
        
        if (currentVix >= 35 && isCboeSpike && isNewLow && isRsiHigher) {
            return { status: 'CRITICAL', value: `VIX:${currentVix.toFixed(1)}|CBOE:${cboeMult.toFixed(1)}x`, message: `GENERATIONEN-KAUFSIGNAL! Extremer Panik-Climax bestätigt durch Bullish Divergence (RSI ${currentRsi.toFixed(1)} > ${prevLowRsi.toFixed(1)}).` };
        } else if (currentVix >= 35 && isCboeSpike) {
            return { status: 'WARNING', value: `VIX:${currentVix.toFixed(1)}|CBOE:${cboeMult.toFixed(1)}x`, message: `Massiver Panik-Spike im Optionsvolumen. Setup formiert sich.` };
        }
        
        return { status: 'OK', value: '-', message: 'Kein Panik-Climax aktiv.' };
    }
}
