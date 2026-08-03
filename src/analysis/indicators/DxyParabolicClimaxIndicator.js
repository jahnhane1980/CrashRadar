import { MathUtils } from '../../utils/MathUtils.js';

export class DxyParabolicClimaxIndicator {
    constructor() {
        this.name = '[INVEST] DXY Parabolic Climax (Dollar-Erschöpfung)';
        this.category = 'BOTTOM_FINDER';
        this.targetAsset = 'GOLD';
        this.LOOKBACK_DAYS = 20;
        this.ROC_THRESHOLD = 3.0; // +3.0% Anstieg in 20 Tagen
    }

    evaluate(timeline) {
        if (!timeline || timeline.length < this.LOOKBACK_DAYS + 1) {
            return { status: 'UNKNOWN', message: `Zu wenig Daten (< ${this.LOOKBACK_DAYS + 1} Tage)` };
        }

        const lastIdx = timeline.length - 1;
        const today = timeline[lastIdx];
        const prevDay = timeline[lastIdx - 1];
        const pastDay = timeline[lastIdx - this.LOOKBACK_DAYS];

        const todayDxy = today?.assets?.DXY ?? today?.assets?.['DX-Y.NYB'] ?? today?.macroGroups?.FinancialConditions?.Dxy;
        const prevDxy = prevDay?.assets?.DXY ?? prevDay?.assets?.['DX-Y.NYB'] ?? prevDay?.macroGroups?.FinancialConditions?.Dxy;
        const pastDxy = pastDay?.assets?.DXY ?? pastDay?.assets?.['DX-Y.NYB'] ?? pastDay?.macroGroups?.FinancialConditions?.Dxy;

        if (todayDxy == null || prevDxy == null || pastDxy == null || pastDxy === 0) {
            return { status: 'UNKNOWN', message: 'Keine DXY-Daten verfügbar' };
        }

        // 20-Tage Rate of Change (ROC) in Prozent
        const roc20d = MathUtils.getRateOfChangePct(pastDxy, todayDxy);
        if (roc20d == null || isNaN(roc20d)) {
            return { status: 'UNKNOWN', message: 'Ungültige DXY ROC Berechnungsdaten' };
        }

        const isParabolicRise = roc20d >= this.ROC_THRESHOLD;
        const isExhausted = todayDxy < prevDxy; // Erschöpfungs-Knick (heute tiefer als gestern)

        if (isParabolicRise && isExhausted) {
            return {
                status: 'CRITICAL',
                category: 'BOTTOM_FINDER',
                value: `ROC +${roc20d.toFixed(1)}%, Knick auf ${todayDxy.toFixed(2)}`,
                message: `DXY PARABOLIC CLIMAX! Dollar-Parabel bricht ein (ROC: +${roc20d.toFixed(1)}%). Makro-Wendepunkt für physisches Gold erreicht!`
            };
        } else if (isParabolicRise) {
            return {
                status: 'WARNING',
                category: 'EARLY_WARNING',
                value: `ROC +${roc20d.toFixed(1)}%`,
                message: `DXY Parabel steilt an (ROC: +${roc20d.toFixed(1)}%). Dollar-Sog aktiv, warten auf Erschöpfungs-Knick für Gold-Kauf.`
            };
        }

        return {
            status: 'OK',
            value: `ROC ${roc20d >= 0 ? '+' : ''}${roc20d.toFixed(1)}%`,
            message: 'DXY im normalen Bewegungsrahmen.'
        };
    }
}
