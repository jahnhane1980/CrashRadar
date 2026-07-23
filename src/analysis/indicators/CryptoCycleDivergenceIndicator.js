import { MathUtils } from '../../utils/MathUtils.js';

export class CryptoCycleDivergenceIndicator {
    constructor() {
        this.name = 'Krypto Zyklus-Divergenz (MSTR/COIN)';
        this.category = 'EARLY_WARNING';
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        
        const currentBtc = timeline[timeline.length - 1].assets.BTC;
        const currentMstr = timeline[timeline.length - 1].assets.MSTR;
        const currentCoin = timeline[timeline.length - 1].assets.COIN;
        
        if (!currentBtc || (!currentMstr && !currentCoin)) return { status: 'UNKNOWN', message: 'Keine Proxy-Daten' };
        
        const btcDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t.assets.BTC, 30) || 0;
        const mstrDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t.assets.MSTR, 30) || 0;
        const coinDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t.assets.COIN, 30) || 0;
        
        const proxyDrawdown = Math.min(mstrDrawdown, coinDrawdown);
        
        if (btcDrawdown >= -2.0 && proxyDrawdown <= -15.0) {
            return { status: 'WARNING', value: `BTC ${btcDrawdown.toFixed(1)}%, Proxy ${proxyDrawdown.toFixed(1)}%`, message: 'Zyklus-Warnung! BTC stark, aber MSTR/COIN bluten aus (Liquidität fehlt).' };
        }
        return { status: 'OK', value: '-', message: 'Krypto-Proxies intakt.' };
    }
}
