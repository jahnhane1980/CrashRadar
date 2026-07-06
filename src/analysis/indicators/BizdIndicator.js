export class BizdIndicator {
    constructor() {
        this.name = 'Private Credit Stress (BIZD)';
        this.category = 'TRIGGER';
        this.THRESHOLDS = {
            CRITICAL: -5.0,
            WARNING: -2.5
        };
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        const current = timeline[timeline.length - 1].assets.BIZD;
        const past30 = timeline[timeline.length - 30].assets.BIZD;
        if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const perf = ((current - past30) / past30) * 100;
        if (perf <= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `Smart Money Exit! BDC Sektor bricht ein (<=${this.THRESHOLDS.CRITICAL}% in 30d).` };
        } else if (perf <= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Schattenbanken unter Druck.' };
        }
        return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Private Credit Sektor stabil.' };
    }
}
