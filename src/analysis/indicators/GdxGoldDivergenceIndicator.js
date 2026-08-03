import { MathUtils } from '../../utils/MathUtils.js';

export class GdxGoldDivergenceIndicator {
    constructor() {
        this.name = '[INVEST] GDX vs Gold Divergenz';
        this.category = 'EARLY_WARNING';
    }

    evaluate(timeline) {
        if (!timeline || timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        
        const lastDay = timeline[timeline.length - 1];
        const currentGold = lastDay?.assets?.Gold;
        const currentGdx = lastDay?.assets?.GDX;
        
        if (!currentGold || !currentGdx) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        // 1. Bearische Top-Divergenz (GDX toppt vor Gold)
        const goldMaxData = MathUtils.getMaxWithIndex(timeline, t => t?.assets?.Gold, 30);
        const gdxMaxData = MathUtils.getMaxWithIndex(timeline, t => t?.assets?.GDX, 30);
        
        if (goldMaxData && gdxMaxData) {
            const isGoldAtTop = goldMaxData.daysAgo <= 5;
            const isGdxDiverging = gdxMaxData.daysAgo >= 10;
            const gdxDrawdown = ((currentGdx - gdxMaxData.maxValue) / gdxMaxData.maxValue) * 100;
            
            if (isGoldAtTop && isGdxDiverging && gdxDrawdown <= -3.0) {
                return { 
                    status: 'WARNING', 
                    value: `GDX ${gdxDrawdown.toFixed(1)}% vom Hoch`, 
                    message: 'GDX toppt vor Gold! Smart Money nimmt bei Minen bereits Gewinne mit, während Gold noch steigt. Gold-Top steht unmittelbar bevor.' 
                };
            }
        }

        // 2. Bullische Boden-Divergenz (GDX macht höhere Tiefs, während Gold das Tief testet)
        const goldMinData = MathUtils.getMinWithIndex(timeline, t => t?.assets?.Gold, 30);
        const gdxMinData = MathUtils.getMinWithIndex(timeline, t => t?.assets?.GDX, 30);

        if (goldMinData && gdxMinData && gdxMinData.minValue > 0) {
            const isGoldAtBottom = goldMinData.daysAgo <= 5;
            const isGdxBottomEarlier = gdxMinData.daysAgo >= 10;
            const gdxRecoveryPct = ((currentGdx - gdxMinData.minValue) / gdxMinData.minValue) * 100;

            if (isGoldAtBottom && isGdxBottomEarlier && gdxRecoveryPct >= 3.0) {
                return {
                    status: 'CRITICAL',
                    category: 'BOTTOM_FINDER',
                    value: `GDX +${gdxRecoveryPct.toFixed(1)}% vom Tief`,
                    message: `BULLISCHE MINEN-DIVERGENZ! GDX macht höhere Tiefs (+${gdxRecoveryPct.toFixed(1)}% vom Boden), während Gold noch sein Tief testet. Smart Money akkumuliert Minen am Boden!`
                };
            }
        }
        
        return { status: 'OK', value: '-', message: 'Keine GDX/Gold Divergenz.' };
    }
}
