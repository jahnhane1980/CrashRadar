export class MaturityWallIndicator {
    constructor() {
        this.name = 'Maturity Wall (T-Bill Rollover)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            CRITICAL: 21,
            WARNING: 15
        };
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const current = timeline[timeline.length - 1].macroGroups.Leading?.MaturityWallPct;
        if (current === null || current === undefined) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        if (current > this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2) + '%', message: `Roter Alarm! Extreme Refinancing Cliff (>${this.THRESHOLDS.CRITICAL}%).` };
        } else if (current > this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: current.toFixed(2) + '%', message: `Warn-Zone. System beginnt zu ächzen (>${this.THRESHOLDS.WARNING}%).` };
        }
        return { status: 'OK', value: current.toFixed(2) + '%', message: 'Normale Baseline (<10-15%).' };
    }
}
