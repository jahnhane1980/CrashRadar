import { MathUtils } from '../../utils/MathUtils.js';

export class MarketPanicCapitulationIndicator {
    constructor() {
        this.name = 'Market Panic & Capitulation (VIX + Volume)';
        this.category = 'TROUGH';
    }

    evaluate(timeline) {
        if (timeline.length < 15) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        // Wir betrachten das aktuelle 14-Tage-Fenster auf historische Panik-Spitzen
        let maxVix = 0;
        let maxVolRatio = 0;
        
        // 50-Tage Durchschnittsvolumen VOR dem 14-Tage-Fenster berechnen
        const avgVol = MathUtils.getAverageForSlice(timeline, t => t.assets.SPY_Volume || t.assets.QQQ_Volume, 50, 15);
        if (avgVol === null) return { status: 'UNKNOWN', message: 'Keine gültigen Volumendaten' };
        
        // Analysiere die letzten 14 Tage auf Extremwerte
        const windowStart = timeline.length - 15;
        for (let i = windowStart; i < timeline.length; i++) {
            const day = timeline[i];
            const vix = day.assets.VIX || 0;
            const vol = day.assets.SPY_Volume || day.assets.QQQ_Volume || 0;
            
            if (vix > maxVix) maxVix = vix;
            if (vol) {
                const ratio = vol / avgVol;
                if (ratio > maxVolRatio) maxVolRatio = ratio;
            }
        }
        
        if (maxVix >= 28 && maxVolRatio >= 1.25) {
            return { status: 'CRITICAL', value: `VIX:${maxVix.toFixed(1)}|Vol:${maxVolRatio.toFixed(1)}x`, message: 'CAPITULATION ZONE! Maximale Panik (VIX>28) und gigantisches Volumen (>1.25x). Historisches DCA-Kaufgebiet!' };
        } else if (maxVix >= 25 && maxVolRatio >= 1.2) {
            return { status: 'WARNING', value: `VIX:${maxVix.toFixed(1)}|Vol:${maxVolRatio.toFixed(1)}x`, message: 'Panik nimmt stark zu. Blut auf den Straßen formiert sich.' };
        }
        
        return { status: 'OK', value: `VIX:${maxVix.toFixed(1)}|Vol:${maxVolRatio.toFixed(1)}x`, message: 'Normales Marktumfeld, keine Kapitulation.' };
    }
}
