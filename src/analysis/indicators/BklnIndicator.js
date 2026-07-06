export class BklnIndicator {
    constructor() {
        this.name = 'Floating Rate Stress (BKLN)';
        this.category = 'TRIGGER';
        this.THRESHOLDS = {
            CRITICAL: -2.0,
            WARNING: -1.0
        };
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        const current = timeline[timeline.length - 1].assets.BKLN;
        const past30 = timeline[timeline.length - 30].assets.BKLN;
        if (current === null || past30 === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const perf = ((current - past30) / past30) * 100;
        if (perf <= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `${perf.toFixed(1)}%`, message: `Leveraged Loans crashen (<=${this.THRESHOLDS.CRITICAL}% in 30d). Zinslast erdrückt Kreditnehmer!` };
        } else if (perf <= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `${perf.toFixed(1)}%`, message: 'Schwäche bei variabel verzinslichen Firmenkrediten.' };
        }
        return { status: 'OK', value: `${perf.toFixed(1)}%`, message: 'Leveraged Loans stabil.' };
    }
}
