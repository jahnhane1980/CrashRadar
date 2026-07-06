export class MlRegimeRadarSpyIndicator {
    constructor() {
        this.name = 'ML Regime Radar (SPY)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const mlRegime = timeline[timeline.length - 1].mlRegimeSpy;
        if (!mlRegime) return { status: 'UNKNOWN', message: 'Keine ML Prognose vorhanden' };
        
        const { phase, confidence } = mlRegime;
        const confPct = (confidence * 100).toFixed(1) + '%';
        
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
