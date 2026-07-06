import { MathUtils } from '../../utils/MathUtils.js';

export class GoldVolumeClimaxIndicator {
    constructor() {
        this.name = '[INVEST] Gold Volume Climax (Panik/FOMO)';
        this.category = 'CONTEMPORANEOUS';
        this.THRESHOLDS = {
            GOLD_CLIMAX_VOL_MULTIPLIER: 5.0,
            GOLD_CLIMAX_PRICE_DROP: -2.0,
            GOLD_CLIMAX_PRICE_RISE: 2.0
        };
    }

    evaluate(timeline) {
        if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 50 Tage)' };
        
        const currentDay = timeline[timeline.length - 1];
        const prevDay = timeline[timeline.length - 2];
        
        const currentVol = currentDay.assets.Gold_Volume;
        const currentPrice = currentDay.assets.Gold;
        const prevPrice = prevDay.assets.Gold;
        
        if (!currentVol || !currentPrice || !prevPrice) return { status: 'UNKNOWN', message: 'Keine Volumen/Preis-Daten für Gold' };
        
        // 50-Tage Durchschnittsvolumen
        const avgVol = MathUtils.getAverageForSlice(timeline, t => t.assets.Gold_Volume, 50);
        if (avgVol === null) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
        const volRatio = currentVol / avgVol;
        const priceChangePct = ((currentPrice - prevPrice) / prevPrice) * 100;
        
        if (volRatio >= this.THRESHOLDS.GOLD_CLIMAX_VOL_MULTIPLIER) {
            if (priceChangePct <= this.THRESHOLDS.GOLD_CLIMAX_PRICE_DROP) {
                return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, ${priceChangePct.toFixed(1)}%`, message: 'SELLING CLIMAX! Gold crasht unter extremem Volumen (Margin Call Liquidations!).' };
            } else if (priceChangePct >= this.THRESHOLDS.GOLD_CLIMAX_PRICE_RISE) {
                return { status: 'CRITICAL', value: `${volRatio.toFixed(1)}x Vol, +${priceChangePct.toFixed(1)}%`, message: 'BUYING CLIMAX! Gold explodiert unter extremem Volumen (Panik-Flucht in Sicherheit!).' };
            }
        }
        
        return { status: 'OK', value: `${volRatio.toFixed(1)}x Vol`, message: 'Normales Gold-Handelsvolumen.' };
    }
}
