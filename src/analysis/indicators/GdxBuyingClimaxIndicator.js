import { MathUtils } from '../../utils/MathUtils.js';

export class GdxBuyingClimaxIndicator {
    constructor() {
        this.name = '[INVEST] GDX Buying Climax (Top-Gefahr)';
        this.category = 'CONTEMPORANEOUS';
        this.THRESHOLDS = {
            GDX_CLIMAX_VOL_MULTIPLIER: 3.0,
            GDX_CLIMAX_PRICE_RISE: 5.0
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
        
        const avgVol = MathUtils.getAverageForSlice(timeline, t => t.assets.GDX_Volume, 50);
        if (avgVol === null) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
        const volRatio = currentVol / avgVol;
        const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
        
        if (volRatio >= this.THRESHOLDS.GDX_CLIMAX_VOL_MULTIPLIER && priceChangePct >= this.THRESHOLDS.GDX_CLIMAX_PRICE_RISE) {
            return { status: 'WARNING', value: `${volRatio.toFixed(1)}x Vol, +${priceChangePct.toFixed(1)}%`, message: 'GDX BUYING CLIMAX! Extreme FOMO bei den Minern. Smart Money verkauft in Liquidität (Bullenfalle).' };
        }
        
        return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Kein Buying Climax.' };
    }
}
