export class BankReservesIndicator {
    constructor() {
        this.name = 'Bankreserven (TOTRESNS)';
        this.category = 'LEADING';
        this.THRESHOLDS = {
            CRITICAL: 2800,
            WARNING: 3000
        };
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const current = timeline[timeline.length - 1].macroGroups.BankingHealth.TotalReserves;
        if (current === null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        if (current < this.THRESHOLDS.CRITICAL) {
            return { status: 'CRITICAL', value: current.toFixed(0) + 'B', message: `Unter ${this.THRESHOLDS.CRITICAL / 1000}T Limit! Akute Crash-Warnung (Repo-Krise).` };
        } else if (current < this.THRESHOLDS.WARNING) {
            return { status: 'WARNING', value: current.toFixed(0) + 'B', message: `Nähert sich der ${this.THRESHOLDS.CRITICAL / 1000}T Grenze.` };
        }
        return { status: 'OK', value: current.toFixed(0) + 'B', message: 'Reserven im sicheren Bereich.' };
    }
}
