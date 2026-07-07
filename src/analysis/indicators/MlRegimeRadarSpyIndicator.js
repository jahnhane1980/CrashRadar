export class MlRegimeRadarSpyIndicator {
    constructor() {
        this.name = 'ML Regime Radar (SPY)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) {
            return { status: 'UNKNOWN', message: 'Zu wenig (oder ungültige) Daten' };
        }
        
        const currentDay = timeline[timeline.length - 1];
        if (!currentDay || !currentDay.mlRegimeSpy || !currentDay.mlRegimeSpy.phase) {
            return { status: 'UNKNOWN', message: 'Keine (vollständige) ML Prognose vorhanden' };
        }
        
        const { phase, confidence } = currentDay.mlRegimeSpy;
        
        const validPhases = ['MACRO_TOP', 'CYCLE_TOP', 'DOWNTREND', 'BEAR_MARKET', 'MACRO_BOTTOM', 'CYCLE_BOTTOM', 'UPTREND', 'BULL_MARKET', 'SIDEWAYS', 'NEUTRAL'];
        if (!validPhases.includes(phase)) {
            return { status: 'UNKNOWN', message: `Unbekannte ML-Phase: ${phase}` };
        }
        
        const confPct = ((confidence || 0) * 100).toFixed(1) + '%';
        
        if (phase === 'MACRO_TOP' || phase === 'CYCLE_TOP') {
            return { status: 'CRITICAL', value: `TOP (${confPct})`, message: 'KI-ALARM! Absolute SPY-Makro-Euphorie erkannt. Extremes Absturzrisiko.' };
        } else if ((phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6) {
            return { status: 'WARNING', value: `BEAR (${confPct})`, message: 'KI-Warnung! SPY Bärenmarkt-Struktur aktiv. Liquidität sinkt.' };
        } else if (phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM') {
            return { status: 'CRITICAL', value: `BOTTOM (${confPct})`, message: 'KI-SIGNAL! SPY Makroökonomisches Tal der Tränen (Kapitulation) erreicht.' };
        } else if (phase === 'UPTREND' || phase === 'BULL_MARKET') {
            return { status: 'OK', value: `BULL (${confPct})`, message: 'SPY Gesunde Bullenmarkt-Struktur (Higher Highs).' };
        }
        
        return { status: 'OK', value: `${phase} (${confPct})`, message: 'SPY Neutrales Regime.' };
    }
}
