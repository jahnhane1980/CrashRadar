import { MathUtils } from '../../utils/MathUtils.js';

export class StealthExitIndicator {
    constructor() {
        this.name = 'Stealth Exit (DIX Dark Pool Divergenz)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            DIX_LOW: 40.0,
            SPY_DRAWDOWN_MAX: -3.0 // SPY must be within 3% of 30-day high
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 30) {
            return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        }

        const currentDay = timeline[timeline.length - 1];
        let dix = currentDay?.assets?.DIX;
        let spy = currentDay?.assets?.SPY;

        if (dix == null) {
            return { status: 'UNKNOWN', message: 'Keine DIX Daten vorhanden' };
        }

        dix = Number(dix);
        if (isNaN(dix)) {
            return { status: 'UNKNOWN', message: 'Ungültige DIX Daten' };
        }

        // Normalisieren, falls DIX als Dezimalwert (z.B. 0.395 statt 39.5) angegeben ist
        if (dix > 0 && dix <= 1) {
            dix = dix * 100;
        }

        // Falls SPY nicht vorhanden ist, machen wir eine reine DIX-Prüfung mit Warnung
        if (spy == null) {
            if (dix < this.THRESHOLDS.DIX_LOW) {
                return {
                    status: 'WARNING',
                    value: `DIX:${dix.toFixed(1)}%`,
                    message: `Stealth Exit Warnung: Dark Pool Aktivität ist extrem niedrig (DIX < 40%), aber SPY Preisdaten fehlen zur Trendbestätigung.`
                };
            }
            return { status: 'OK', value: `DIX:${dix.toFixed(1)}%`, message: 'DIX im neutralen/gesunden Bereich.' };
        }

        const spyDrawdown = MathUtils.getDrawdownFromMax(timeline, t => t?.assets?.SPY, 30);
        if (spyDrawdown === null) {
            return { status: 'UNKNOWN', message: 'Konnte SPY Drawdown nicht berechnen' };
        }

        const isMarketNearHigh = spyDrawdown >= this.THRESHOLDS.SPY_DRAWDOWN_MAX;

        if (dix < this.THRESHOLDS.DIX_LOW && isMarketNearHigh) {
            return {
                status: 'CRITICAL',
                value: `DIX:${dix.toFixed(1)}%|SPY_DD:${spyDrawdown.toFixed(1)}%`,
                message: `STEALTH EXIT AKTIV! Wale verkaufen verdeckt über Dark Pools (DIX: ${dix.toFixed(1)}% < 40%), während der SPY nahe Allzeithoch notiert (Drawdown: ${spyDrawdown.toFixed(1)}%).`
            };
        } else if (dix < this.THRESHOLDS.DIX_LOW) {
            return {
                status: 'WARNING',
                value: `DIX:${dix.toFixed(1)}%|SPY_DD:${spyDrawdown.toFixed(1)}%`,
                message: `Niedrige Dark Pool Aktivität (DIX: ${dix.toFixed(1)}%), aber Markt befindet sich bereits in einer Korrektur (Drawdown: ${spyDrawdown.toFixed(1)}%).`
            };
        }

        return {
            status: 'OK',
            value: `DIX:${dix.toFixed(1)}%|SPY_DD:${spyDrawdown.toFixed(1)}%`,
            message: 'Keine Stealth Exit Anzeichen.'
        };
    }
}
