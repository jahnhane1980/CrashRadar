export class RateShockIndicator {
    constructor() {
        this.name = 'Rate Shock (Real Yield Velocity)';
        this.category = 'TRIGGER';
        this.THRESHOLDS = {
            CRITICAL: 0.5,
            WARNING: 0.3
        };
    }

    evaluate(timeline) {
        if (timeline.length < 60) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 60 Tage)' };
        const currentDay = timeline[timeline.length - 1];
        const pastDay = timeline[timeline.length - 60];
        
        const currentYield = currentDay.macroGroups.FinancialConditions.RealYield10y;
        const pastYield = pastDay.macroGroups.FinancialConditions.RealYield10y;
        
        if (currentYield === null || pastYield === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const diff = currentYield - pastYield;
        if (diff >= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `+${diff.toFixed(2)}%`, message: `Zins-Schock! Realzinsen steigen zu schnell (>=${this.THRESHOLDS.CRITICAL}% in 60d).` };
        } else if (diff >= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `+${diff.toFixed(2)}%`, message: 'Realzinsen steigen rasant.' };
        }
        return { status: 'OK', value: (diff > 0 ? '+' : '') + diff.toFixed(2) + '%', message: 'Zinsumfeld stabil.' };
    }
}
