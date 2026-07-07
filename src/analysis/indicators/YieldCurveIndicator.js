export class YieldCurveIndicator {
    constructor() {
        this.name = 'Yield Curve (T10Y2Y)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        
        let current = timeline[timeline.length - 1]?.macroGroups?.YieldCurve?.Spread10y2y;
        let past30 = timeline[timeline.length - 30]?.macroGroups?.YieldCurve?.Spread10y2y;
        
        if (current == null || past30 == null) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        if (typeof current !== 'number' && typeof current !== 'string') return { status: 'UNKNOWN', message: 'Ungültiger Datentyp' };
        if (typeof past30 !== 'number' && typeof past30 !== 'string') return { status: 'UNKNOWN', message: 'Ungültiger Datentyp' };
        if (typeof current === 'string' && current.trim() === '') return { status: 'UNKNOWN', message: 'Leerer Wert' };
        if (typeof past30 === 'string' && past30.trim() === '') return { status: 'UNKNOWN', message: 'Leerer Wert' };
        
        current = Number(current);
        past30 = Number(past30);
        
        if (isNaN(current) || isNaN(past30)) return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        
        if (past30 < 0 && current >= 0) {
            return { status: 'CRITICAL', value: current.toFixed(2), message: 'UN-INVERTING! Kurve ist in den letzten 30 Tagen positiv geworden. Startschuss für den Crash.' };
        } else if (current < 0) {
            return { status: 'WARNING', value: current.toFixed(2), message: 'Invertiert (Late Cycle). Noch keine Panik, bis sie un-invertiert.' };
        }
        return { status: 'OK', value: current.toFixed(2), message: 'Normale Kurve (positiv).' };
    }
}
