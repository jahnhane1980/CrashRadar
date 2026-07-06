import { MathUtils } from '../../utils/MathUtils.js';

export class BitcoinDivergenceIndicator {
    constructor() {
        this.name = 'Bitcoin Divergenz (Makro-Liquidität)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        
        const currentSpy = timeline[timeline.length - 1].assets.SPY;
        const currentBtc = timeline[timeline.length - 1].assets.BTC;
        if (!currentSpy || !currentBtc) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const spyDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t.assets.SPY, 30);
        const btcDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t.assets.BTC, 30);
        
        if (spyDrawdown >= -2.0 && btcDrawdown <= -10.0) {
            return { status: 'WARNING', value: `SPY ${spyDrawdown.toFixed(1)}%, BTC ${btcDrawdown.toFixed(1)}%`, message: 'Liquiditäts-Staubsauger aktiv! SPY nahe Allzeithoch, aber BTC stürzt ab (TGA-Sog).' };
        }
        return { status: 'OK', value: '-', message: 'Keine gefährliche Liquiditäts-Divergenz.' };
    }
}
