export class MlRegimeRadarQqqIndicator {
    constructor() {
        this.name = 'ML Regime Radar (QQQ)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const mlRegime = timeline[timeline.length - 1].mlRegimeQqq;
        if (!mlRegime) return { status: 'UNKNOWN', message: 'Keine ML Prognose vorhanden' };
        
        const { phase, confidence } = mlRegime;
        const confPct = (confidence * 100).toFixed(1) + '%';
        
        if (phase === 'MACRO_TOP' || phase === 'CYCLE_TOP') {
            return { status: 'CRITICAL', value: `TOP (${confPct})`, message: 'KI-ALARM! QQQ Makro-Euphorie erkannt. Tech-Topping im Gange.' };
        } else if ((phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6) {
            return { status: 'WARNING', value: `BEAR (${confPct})`, message: 'KI-Warnung! QQQ Bärenmarkt-Struktur aktiv.' };
        } else if (phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM') {
            return { status: 'CRITICAL', value: `BOTTOM (${confPct})`, message: 'KI-SIGNAL! QQQ Kapitulation ist erreicht. Tech-Kaufgelegenheit.' };
        } else if (phase === 'UPTREND' || phase === 'BULL_MARKET') {
            return { status: 'OK', value: `BULL (${confPct})`, message: 'QQQ Gesunde Bullenmarkt-Struktur.' };
        }
        return { status: 'OK', value: `${phase} (${confPct})`, message: 'QQQ Neutrales Regime.' };
    }
}
