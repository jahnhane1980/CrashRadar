import { MathUtils } from '../../utils/MathUtils.js';

export class MarginDebtIndicator {
    constructor() {
        this.name = 'Margin Debt (Gier & Hebel)';
        this.category = 'EARLY_WARNING';
    }

    evaluate(timeline) {
        if (timeline.length < 180) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 180 Tage)' };
        
        const current = timeline[timeline.length - 1]?.macroGroups?.Leading?.MarginDebt;
        if (current === null || current === undefined) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const drawdownPct = MathUtils.getDrawdownFromMax(timeline, t => t.macroGroups?.Leading?.MarginDebt, 180);
        
        if (drawdownPct <= -10.0) {
            return { status: 'CRITICAL', value: drawdownPct.toFixed(1) + '%', message: `Margin Debt kollabiert (${Math.abs(drawdownPct).toFixed(1)}% vom Hoch). Akute Liquidierungswelle!` };
        } else if (drawdownPct <= -5.0) {
            return { status: 'WARNING', value: drawdownPct.toFixed(1) + '%', message: `Margin Debt ist um ${Math.abs(drawdownPct).toFixed(1)}% von seinem Hoch gefallen. Das Smart Money baut rasant Hebel ab!` };
        }
        return { status: 'OK', value: current.toFixed(0) + 'M', message: 'Hebel (Margin Debt) steigt / ist intakt.' };
    }
}
