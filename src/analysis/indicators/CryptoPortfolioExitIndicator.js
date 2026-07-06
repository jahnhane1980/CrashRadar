import { MathUtils } from '../../utils/MathUtils.js';

export class CryptoPortfolioExitIndicator {
    constructor(getCycleConfig) {
        this.name = 'Krypto Portfolio-Exit (MSTR/COIN)';
        this.category = 'TRIGGER';
        this.getCycleConfig = getCycleConfig;
    }

    evaluate(timeline) {
        if (timeline.length < 50) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const macroCycle = this.getCycleConfig()?.MACRO_CYCLE;
        if (!macroCycle || !macroCycle.lastBtcBottomDate) return { status: 'UNKNOWN', message: 'Kein Zyklus-Boden in Config' };
        
        const currentDay = timeline[timeline.length - 1];
        const currentDate = new Date(currentDay.date);
        const bottomDate = new Date(macroCycle.lastBtcBottomDate);
        const daysSinceBottom = Math.floor((currentDate - bottomDate) / (1000 * 60 * 60 * 24));
        const dangerStart = macroCycle.dangerWindowStartDays || 970;

        if (isNaN(daysSinceBottom)) return { status: 'UNKNOWN', message: 'Ungültiges Datum' };

        if (daysSinceBottom < dangerStart) {
            return { status: 'OK', value: `Tag ${daysSinceBottom}/${dangerStart}`, message: 'Krypto-Proxies im sicheren Zeitfenster.' };
        }

        const mstr = currentDay.assets.MSTR;
        const coin = currentDay.assets.COIN;
        
        const mstrSma50 = MathUtils.getSma(timeline, t => t.assets.MSTR, 50, 0);
        const prevMstrSma50 = MathUtils.getSma(timeline, t => t.assets.MSTR, 50, 1);
        const prevMstr = timeline[timeline.length - 2].assets.MSTR;
        
        const coinSma50 = MathUtils.getSma(timeline, t => t.assets.COIN, 50, 0);
        const prevCoinSma50 = MathUtils.getSma(timeline, t => t.assets.COIN, 50, 1);
        const prevCoin = timeline[timeline.length - 2].assets.COIN;
        
        const mstrVolSma50 = MathUtils.getSma(timeline, t => t.assets.MSTR_Volume, 50, 0);
        const coinVolSma50 = MathUtils.getSma(timeline, t => t.assets.COIN_Volume, 50, 0);
        const mstrVol = currentDay.assets.MSTR_Volume;
        const coinVol = currentDay.assets.COIN_Volume;

        let alarms = [];
        
        if (mstr && mstrSma50 && mstrVolSma50) {
            const crossedDown = prevMstr >= prevMstrSma50 && mstr < mstrSma50;
            if (crossedDown && mstrVol > (mstrVolSma50 * 1.2)) {
                alarms.push(`MSTR bricht SMA 50 (Vol: ${(mstrVol/mstrVolSma50).toFixed(1)}x)`);
            }
        }
        
        if (coin && coinSma50 && coinVolSma50) {
            const crossedDown = prevCoin >= prevCoinSma50 && coin < coinSma50;
            if (crossedDown && coinVol > (coinVolSma50 * 1.2)) {
                alarms.push(`COIN bricht SMA 50 (Vol: ${(coinVol/coinVolSma50).toFixed(1)}x)`);
            }
        }

        if (alarms.length > 0) {
            return { status: 'CRITICAL', value: `Tag ${daysSinceBottom}`, message: `GEFAHRENZONE AKTIV! ${alarms.join(' & ')}. MSTR/COIN sofort abverkaufen!` };
        }

        return { status: 'WARNING', value: `Tag ${daysSinceBottom}`, message: 'Gefahrenzone (>970 Tage) aktiv! Warten auf SMA 50 Bruch unter hohem Volumen.' };
    }
}
