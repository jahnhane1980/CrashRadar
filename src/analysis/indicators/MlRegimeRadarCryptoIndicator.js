export class MlRegimeRadarCryptoIndicator {
    constructor() {
        this.name = 'ML Regime Radar (Krypto)';
        this.category = 'TRIGGER';
    }

    evaluate(timeline) {
        const currentDay = timeline[timeline.length - 1];
        if (!currentDay || !currentDay.mlRegime || !currentDay.mlRegime.phase) return { status: 'UNKNOWN', message: 'Keine ML Daten' };
        
        const phase = currentDay.mlRegime.phase;
        const confidence = currentDay.mlRegime.confidence || 0;
        const conf = (confidence * 100).toFixed(1);
        
        if (phase === 'MACRO_TOP') return { status: 'CRITICAL', value: `TOP (${conf}%)`, message: 'ML-Modell erkennt KRYPTO-ZYKLUSENDE!' };
        if (phase === 'MACRO_BOTTOM') return { status: 'CRITICAL', value: `BOTTOM (${conf}%)`, message: 'ML-Modell erkennt KRYPTO-BODEN!' };
        if (phase === 'DOWNTREND') return { status: 'WARNING', value: `DOWNTREND (${conf}%)`, message: 'ML-Modell warnt vor Krypto-Abwärtstrend.' };
        return { status: 'OK', value: `${phase} (${conf}%)`, message: 'Krypto-Zyklus intakt (oder neutral).' };
    }
}
