export class SahmRuleIndicator {
    constructor() {
        this.name = 'Sahm Rule (Rezession)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            CRITICAL: 0.50
        };
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const current = timeline[timeline.length - 1].macroGroups.Leading?.SahmRule;
        if (current === null || current === undefined) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        if (current >= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Lupenreine Rezessionswarnung (>=${this.THRESHOLDS.CRITICAL}).` };
        }
        return { status: 'OK', value: current.toFixed(2), message: 'Keine Rezession im Gange.' };
    }
}
