export class MlRegimeRadarMacroIndicator {
    constructor() {
        this.name = 'ML Regime Radar (Makro)';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) {
            return { status: 'UNKNOWN', message: 'Keine (oder ungültige) Daten' };
        }
        
        const currentDay = timeline[timeline.length - 1];
        if (!currentDay || !currentDay.mlRegime || !currentDay.mlRegime.phase) return { status: 'UNKNOWN', message: 'Keine ML Daten' };
        
        const phase = currentDay.mlRegime.phase;
        const conf = ((currentDay.mlRegime.confidence || 0) * 100).toFixed(1);
        
        if (phase === 'MACRO_TOP') return { status: 'CRITICAL', value: `TOP (${conf}%)`, message: 'ML-Modell erkennt zyklisches MAKRO-TOP!' };
        if (phase === 'MACRO_BOTTOM') return { status: 'CRITICAL', value: `BOTTOM (${conf}%)`, message: 'ML-Modell erkennt zyklischen MAKRO-BODEN!' };
        if (phase === 'DOWNTREND') return { status: 'WARNING', value: `DOWNTREND (${conf}%)`, message: 'ML-Modell warnt vor Abwärtstrend.' };
        return { status: 'OK', value: `UPTREND (${conf}%)`, message: 'ML-Modell signalisiert intakten Aufwärtstrend.' };
    }
}
