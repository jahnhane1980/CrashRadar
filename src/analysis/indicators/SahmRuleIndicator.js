export class SahmRuleIndicator {
    constructor() {
        this.name = 'Sahm Rule (Rezession)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            CRITICAL: 0.50
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        let current = currentDay?.macroGroups?.Leading?.SahmRule;
        
        if (current == null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        // Fange JS Type-Coercion Bugs ab (z.B. Number("") === 0, Number(true) === 1, Number([]) === 0)
        if (typeof current !== 'number' && typeof current !== 'string') return { status: 'UNKNOWN', message: 'Ungültiger Datentyp' };
        if (typeof current === 'string' && current.trim() === '') return { status: 'UNKNOWN', message: 'Leerer Wert' };
        
        current = Number(current);
        if (isNaN(current)) return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        
        if (current >= this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Lupenreine Rezessionswarnung (>=${this.THRESHOLDS.CRITICAL}).` };
        }
        return { status: 'OK', value: current.toFixed(2), message: 'Keine Rezession im Gange.' };
    }
}
