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
        if (!Array.isArray(timeline) || timeline.length < 60) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 60 Tage)' };
        const currentDay = timeline[timeline.length - 1];
        const pastDay = timeline[timeline.length - 60];
        
        let currentYield = currentDay?.macroGroups?.FinancialConditions?.RealYield10y;
        let pastYield = pastDay?.macroGroups?.FinancialConditions?.RealYield10y;
        
        if (currentYield == null || pastYield == null) return { status: 'UNKNOWN', message: 'Keine (vollständigen) Daten' };
        
        currentYield = Number(currentYield);
        pastYield = Number(pastYield);
        
        if (isNaN(currentYield) || isNaN(pastYield)) return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        
        // Fix for JavaScript Floating Point Math (e.g. 2.3 - 2.0 = 0.2999999999999998)
        let diff = currentYield - pastYield;
        diff = Math.round(diff * 10000) / 10000;
        
        if (diff >= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `+${diff.toFixed(2)}%`, message: `Zins-Schock! Realzinsen steigen zu schnell (>=${this.THRESHOLDS.CRITICAL}% in 60d).` };
        } else if (diff >= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `+${diff.toFixed(2)}%`, message: 'Realzinsen steigen rasant.' };
        }
        return { status: 'OK', value: (diff > 0 ? '+' : '') + diff.toFixed(2) + '%', message: 'Zinsumfeld stabil.' };
    }
}
