export class MlRegimeRadarBtcIndicator {
    constructor() {
        this.name = 'ML Regime Radar (BTC)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        const mlRegime = timeline[timeline.length - 1].mlRegimeBtc;
        if (!mlRegime) return { status: 'UNKNOWN', message: 'Keine ML Prognose vorhanden' };
        
        const { phase, confidence } = mlRegime;
        const confPct = (confidence * 100).toFixed(1) + '%';
        
        if (phase === 'MACRO_TOP' || phase === 'CYCLE_TOP') {
            return { status: 'CRITICAL', value: `TOP (${confPct})`, message: 'KRYPTO-ZYKLUSENDE! Verteilungsphase (Distribution) im vollen Gange.' };
        } else if ((phase === 'DOWNTREND' || phase === 'BEAR_MARKET') && confidence > 0.6) {
            return { status: 'WARNING', value: `BEAR (${confPct})`, message: 'KRYPTO-WINTER: Bärenmarkt aktiv.' };
        } else if (phase === 'BEAR_RALLY') {
            return { status: 'WARNING', value: `BEAR RALLY (${confPct})`, message: 'Trügerischer Pump im Bärenmarkt (Dead Cat Bounce).' };
        } else if (phase === 'MACRO_BOTTOM' || phase === 'CYCLE_BOTTOM') {
            return { status: 'CRITICAL', value: `BOTTOM (${confPct})`, message: 'KRYPTO-BODEN! Historische Kaufgelegenheit im Bitcoin.' };
        } else if (phase === 'UPTREND' || phase === 'BULL_MARKET') {
            return { status: 'OK', value: `BULL (${confPct})`, message: 'Bitcoin im stabilen Aufwärtstrend (Höhere Hochs).' };
        } else if (phase === 'BULL_CORRECTION') {
            return { status: 'OK', value: `CORRECTION (${confPct})`, message: 'Normale Korrektur im intakten Bullenmarkt (Buy the dip).' };
        }
        return { status: 'OK', value: `${phase} (${confPct})`, message: 'Neutrales Krypto-Regime.' };
    }
}
