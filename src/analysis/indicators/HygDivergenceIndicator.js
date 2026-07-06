export class HygDivergenceIndicator {
    constructor() {
        this.name = 'High Yield Divergenz (HYG)';
        this.category = 'TRIGGER';
        this.THRESHOLDS = {
            CRITICAL: -3.0,
            WARNING: -1.5
        };
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        const current = timeline[timeline.length - 1].assets.HYG;
        const past30 = timeline[timeline.length - 30].assets.HYG;
        if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const perf = ((current - past30) / past30) * 100;
        if (perf <= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `HYG bricht ein! Der Kreditmarkt trocknet aus (<=${this.THRESHOLDS.CRITICAL}% in 30d).` };
        } else if (perf <= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Kreditmarkt zeigt Schwäche.' };
        }
        return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Kreditmarkt gesund.' };
    }
}
