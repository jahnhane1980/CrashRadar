export class ArccIndicator {
    constructor() {
        this.name = 'Schattenbanken Zinslast (ARCC)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            CRITICAL: 15.0,
            WARNING: 5.0
        };
    }

    evaluate(timeline) {
        if (timeline.length < 90) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 90 Tage)' };
        const currentDay = timeline[timeline.length - 1];
        const pastDay = timeline[timeline.length - 90];
        
        const currentInterest = currentDay.macroGroups.Fundamentals?.ARCC_InterestExpense;
        const pastInterest = pastDay.macroGroups.Fundamentals?.ARCC_InterestExpense;
        
        if (!currentInterest || !pastInterest) return { status: 'UNKNOWN', message: 'Keine Fundamentaldaten' };
        
        const growth = ((currentInterest - pastInterest) / pastInterest) * 100;
        if (growth >= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: `+${growth.toFixed(1)}%`, message: `Zinslast der BDCs explodiert! (>=${this.THRESHOLDS.CRITICAL}% QoQ). Kreditausfälle drohen.` };
        } else if (growth >= this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: `+${growth.toFixed(1)}%`, message: 'Zinsbelastung der Schattenbanken steigt deutlich.' };
        }
        return { status: 'OK', value: (growth > 0 ? '+' : '') + growth.toFixed(1) + '%', message: 'Zinslast unter Kontrolle.' };
    }
}
