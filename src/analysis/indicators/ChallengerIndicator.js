import { MathUtils } from '../../utils/MathUtils.js';

export class ChallengerIndicator {
    constructor() {
        this.name = 'Challenger Job Cuts (Entlassungswelle)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 180) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 180 Tage)' };
        
        const current = timeline[timeline.length - 1].macroGroups?.Leading?.Challenger;
        if (current === null || current === undefined) return { status: 'UNKNOWN', message: 'Keine Daten' };

        // Wir brauchen die vorherigen 6 Monate (exklusive des aktuellen Werts) als Baseline (SMA6)
        const previousValues = [];
        let lastVal = current;
        
        for (let i = timeline.length - 1; i >= 0; i--) {
            const val = timeline[i].macroGroups?.Leading?.Challenger;
            if (val !== null && val !== undefined) {
                // Sobald sich der Wert ändert, haben wir den Vormonat gefunden
                if (val !== lastVal) {
                    previousValues.push(val);
                    lastVal = val;
                }
            }
            if (previousValues.length >= 6) break;
        }

        if (previousValues.length === 0) {
            return { status: 'UNKNOWN', message: 'Zu wenig Historie für SMA6' };
        }

        const sum = previousValues.reduce((a, b) => a + b, 0);
        const sma6 = sum / previousValues.length;

        if (sma6 === 0) {
            return { status: 'UNKNOWN', message: 'SMA6 ist 0 (Division by Zero Schutz)' };
        }

        const changePct = ((current - sma6) / sma6) * 100;

        if (changePct >= 55.0) {
            return { status: 'CRITICAL', value: `+${changePct.toFixed(1)}%`, message: `Challenger Report explodiert um +${changePct.toFixed(1)}% vs. SMA6! Alarmstufe Rot: Deflationärer/Wirtschaftlicher Crash unmittelbar bevorstehend.` };
        } else if (changePct >= 40.0) {
            return { status: 'WARNING', value: `+${changePct.toFixed(1)}%`, message: `Challenger Report steigt stark an (+${changePct.toFixed(1)}% vs. SMA6). Warnstufe Gelb: Deutlicher Stress in den Chefetagen.` };
        }

        return { status: 'OK', value: current.toFixed(0), message: 'Keine auffälligen Entlassungswellen (Markt intakt oder rein zinssensitiv).' };
    }
}
