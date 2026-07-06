export class NfciIndicator {
    constructor() {
        this.name = 'Chicago Fed Stress Index (NFCI)';
        this.category = 'CONTEMPORANEOUS';
        this.THRESHOLDS = {
            CRITICAL: 0
        };
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const current = timeline[timeline.length - 1].macroGroups.FinancialConditions.ChicagoFedIndex;
        if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        if (current > this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: `Akuter Stress im Finanzsystem (>${this.THRESHOLDS.CRITICAL}).` };
        }
        return { status: 'OK', value: current.toFixed(2), message: `Kein Systemstress (<=${this.THRESHOLDS.CRITICAL}).` };
    }
}
