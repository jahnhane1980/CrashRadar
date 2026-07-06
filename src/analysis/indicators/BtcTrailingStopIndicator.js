import { MathUtils } from '../../utils/MathUtils.js';

export class BtcTrailingStopIndicator {
    constructor() {
        this.name = 'BTC Trailing Stop Warnung (Makro-Radar)';
        this.category = 'TRIGGER';
    }

    evaluate(timeline) {
        if (timeline.length < 200) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 200 Tage)' };
        
        const mstr = timeline[timeline.length - 1].assets.MSTR;
        const prevMstr = timeline[timeline.length - 2].assets.MSTR;
        
        const mstrSma200 = MathUtils.getSma(timeline, t => t.assets.MSTR, 200, 0);
        const prevMstrSma200 = MathUtils.getSma(timeline, t => t.assets.MSTR, 200, 1);

        if (!mstr || !mstrSma200 || !prevMstrSma200) return { status: 'UNKNOWN', message: 'Keine MSTR Daten' };

        const dropPct = ((mstr - mstrSma200) / mstrSma200) * 100;

        if (mstr < mstrSma200 && prevMstr >= prevMstrSma200) {
            return { status: 'CRITICAL', value: `MSTR Drop: ${dropPct.toFixed(1)}%`, message: 'MSTR VERLIERT SMA 200! Strukturelle Liquidität bricht ab. BTC Zyklus-Top innerhalb 30-60 Tagen erwartet. Stop-Loss bei BTC ab sofort extrem eng nachziehen!' };
        } else if (mstr < mstrSma200) {
            return { status: 'WARNING', value: `MSTR < SMA200`, message: `MSTR bleibt unter SMA 200 (${dropPct.toFixed(1)}%). Makro-Klima für BTC extrem toxisch.` };
        }

        return { status: 'OK', value: `MSTR > SMA200`, message: 'MSTR intakt. Makro-Liquidität für BTC weiterhin vorhanden.' };
    }
}
