import { MathUtils } from '../../utils/MathUtils.js';

export class GdxSellingClimaxIndicator {
    constructor() {
        this.name = '[INVEST] GDX Selling Climax (Boden-Suche)';
        this.category = 'ACUTE_PANIC';
        this.THRESHOLDS = {
            GDX_CLIMAX_VOL_MULTIPLIER: 3.0,
            GDX_CLIMAX_PRICE_DROP: -5.0
        };
    }

    evaluate(timeline) {
        if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 50 Tage)' };
        
        const currentDay = timeline[timeline.length - 1];
        const prevDay = timeline[timeline.length - 2];
        
        const currentVol = currentDay.assets.GDX_Volume;
        const currentPrice = currentDay.assets.GDX;
        const prevPrice = prevDay.assets.GDX;
        
        if (!currentVol || !currentPrice || !prevPrice) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für GDX' };
        
        // 50-Tage Durchschnittsvolumen
        const avgVol = MathUtils.getAverageForSlice(timeline, t => t.assets.GDX_Volume, 50);
        if (!avgVol || isNaN(avgVol)) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
        const volRatio = currentVol / avgVol;
        const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
        
        if (volRatio >= this.THRESHOLDS.GDX_CLIMAX_VOL_MULTIPLIER && priceChangePct <= this.THRESHOLDS.GDX_CLIMAX_PRICE_DROP) {
            return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'GDX SELLING CLIMAX! Miner-Kapitulation. Smart Money sammelt ein (V-Shape Boden).' };
        }
        
        return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Selling Climax.' };
    }
}
