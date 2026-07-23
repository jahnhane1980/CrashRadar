export class NfciIndicator {
    constructor() {
        this.name = 'Chicago Fed Stress Index (NFCI)';
        this.category = 'ACUTE_PANIC';
        this.THRESHOLDS = {
            CRITICAL: 0
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) {
            return { status: 'UNKNOWN', message: 'Zu wenig (oder ungültige) Daten' };
        }
        
        let current = timeline[timeline.length - 1]?.macroGroups?.FinancialConditions?.ChicagoFedIndex;
        
        if (current == null) {
            return { status: 'UNKNOWN', message: 'Keine Daten vorhanden' };
        }
        
        current = Number(current);
        if (isNaN(current)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahl)' };
        }
        
        if (current > this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Akuter Stress im Finanzsystem (>${this.THRESHOLDS.CRITICAL}).` };
        }
        return { status: 'OK', value: current.toFixed(2), message: `Kein Systemstress (<=${this.THRESHOLDS.CRITICAL}).` };
    }
}
