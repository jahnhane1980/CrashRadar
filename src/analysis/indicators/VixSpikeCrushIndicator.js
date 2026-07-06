export class VixSpikeCrushIndicator {
    constructor() {
        this.name = 'VIX (Spike & Crush)';
        this.category = 'TROUGH';
        this.THRESHOLDS = {
            VIX_SPIKE: 40,
            VIX_WARNING: 35,
            VIX_CRUSH_PCT: 0.8,
            VIX_CRUSH_WARNING_PCT: 0.85
        };
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentVix = timeline[timeline.length - 1].assets.VIX;
        if (currentVix === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        // Finde das Maximum der letzten 30 Tage
        let maxVix30 = 0;
        for (let i = timeline.length - 30; i < timeline.length; i++) {
            const v = timeline[i].assets.VIX;
            if (v !== null && v > maxVix30) maxVix30 = v;
        }
        
        if (maxVix30 >= this.THRESHOLDS.VIX_SPIKE && currentVix < maxVix30 * this.THRESHOLDS.VIX_CRUSH_PCT) {
            return { status: 'CRITICAL', value: currentVix.toFixed(1), message: `KAUFSIGNAL! VIX ist gespiket (>=${this.THRESHOLDS.VIX_SPIKE}) und crasht jetzt (-20% vom Peak).` };
        } else if (maxVix30 >= this.THRESHOLDS.VIX_WARNING && currentVix < maxVix30 * this.THRESHOLDS.VIX_CRUSH_WARNING_PCT) {
            return { status: 'WARNING', value: currentVix.toFixed(1), message: 'VIX baut Panik ab. Bodenbildung läuft.' };
        } else if (maxVix30 >= this.THRESHOLDS.VIX_WARNING) {
            return { status: 'WARNING', value: currentVix.toFixed(1), message: 'Extreme Panik am Markt (VIX extrem hoch).' };
        }
        return { status: 'OK', value: currentVix.toFixed(1), message: 'Keine Panik-Extreme. Normaler Markt.' };
    }
}
