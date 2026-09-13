import { MathUtils } from '../../utils/MathUtils.js';

export class BtcTrailingStopIndicator {
    constructor() {
        this.name = 'BTC Trailing Stop Warnung (Makro-Radar)';
        this.category = 'ACUTE_PANIC';
        this.targetAsset = 'BTC';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 200) {
            return {
                status: 'UNKNOWN',
                signal: 'UNKNOWN',
                isAboveSma200: false,
                isFreshBreak: false,
                isFreshCrossAbove: false,
                mstrPrice: null,
                mstrSma200: null,
                dropPct: null,
                message: 'Zu wenig Daten (< 200 Tage)'
            };
        }
        
        const currentEntry = timeline[timeline.length - 1];
        const prevEntry = timeline[timeline.length - 2];
        const mstr = currentEntry?.assets?.MSTR ?? currentEntry?.MSTR ?? null;
        const prevMstr = prevEntry?.assets?.MSTR ?? prevEntry?.MSTR ?? null;
        
        const mstrSma200 = MathUtils.getSma(timeline, t => t.assets?.MSTR ?? t.MSTR, 200, 0);
        const prevMstrSma200 = MathUtils.getSma(timeline, t => t.assets?.MSTR ?? t.MSTR, 200, 1);

        if (!mstr || !mstrSma200 || !prevMstrSma200) {
            return {
                status: 'UNKNOWN',
                signal: 'UNKNOWN',
                isAboveSma200: false,
                isFreshBreak: false,
                isFreshCrossAbove: false,
                mstrPrice: mstr || null,
                mstrSma200: mstrSma200 || null,
                dropPct: null,
                message: 'Keine MSTR Daten'
            };
        }

        const dropPct = ((mstr - mstrSma200) / mstrSma200) * 100;
        const roundedDropPct = Number(dropPct.toFixed(2));

        if (mstr < mstrSma200 && prevMstr >= prevMstrSma200) {
            return {
                status: 'CRITICAL',
                signal: 'BEAR_EXIT',
                isAboveSma200: false,
                isFreshBreak: true,
                isFreshCrossAbove: false,
                mstrPrice: mstr,
                mstrSma200: mstrSma200,
                dropPct: roundedDropPct,
                value: `MSTR Drop: ${dropPct.toFixed(1)}%`,
                message: 'MSTR VERLIERT SMA 200! Strukturelle Liquidität bricht ab. BTC Zyklus-Top innerhalb 30-60 Tagen erwartet. Stop-Loss bei BTC ab sofort extrem eng nachziehen!'
            };
        } else if (mstr < mstrSma200) {
            return {
                status: 'WARNING',
                signal: 'BEAR_EXIT',
                isAboveSma200: false,
                isFreshBreak: false,
                isFreshCrossAbove: false,
                mstrPrice: mstr,
                mstrSma200: mstrSma200,
                dropPct: roundedDropPct,
                value: `MSTR < SMA200`,
                message: `MSTR bleibt unter SMA 200 (${dropPct.toFixed(1)}%). Makro-Klima für BTC extrem toxisch.`
            };
        }

        const isFreshCrossAbove = prevMstr < prevMstrSma200;
        return {
            status: 'OK',
            signal: 'BULL_HOLD',
            isAboveSma200: true,
            isFreshBreak: false,
            isFreshCrossAbove,
            mstrPrice: mstr,
            mstrSma200: mstrSma200,
            dropPct: roundedDropPct,
            value: `MSTR > SMA200`,
            message: 'MSTR intakt. Makro-Liquidität für BTC weiterhin vorhanden.'
        };
    }
}
