import { MathUtils } from '../../utils/MathUtils.js';

export class GdxGoldDivergenceIndicator {
    constructor() {
        this.name = '[INVEST] GDX vs Gold Divergenz';
        this.category = 'LEADING';
    }

    evaluate(timeline) {
        if (timeline.length < 30) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 30 Tage)' };
        
        const currentGold = timeline[timeline.length - 1].assets.Gold;
        const currentGdx = timeline[timeline.length - 1].assets.GDX;
        
        if (!currentGold || !currentGdx) return { status: 'UNKNOWN', message: 'Keine Daten' };
        
        const goldMaxData = MathUtils.getMaxWithIndex(timeline, t => t.assets.Gold, 30);
        const gdxMaxData = MathUtils.getMaxWithIndex(timeline, t => t.assets.GDX, 30);
        if (!goldMaxData || !gdxMaxData) return { status: 'UNKNOWN', message: 'Keine Max-Daten' };
        
        const isGoldAtTop = goldMaxData.daysAgo <= 5;
        const isGdxDiverging = gdxMaxData.daysAgo >= 10;
        const gdxDrawdown = ((currentGdx - gdxMaxData.maxValue) / gdxMaxData.maxValue) * 100;
        
        if (isGoldAtTop && isGdxDiverging && gdxDrawdown <= -3.0) {
            return { status: 'WARNING', value: `GDX ${gdxDrawdown.toFixed(1)}% vom Hoch`, message: 'GDX toppt vor Gold! Smart Money nimmt bei Minen bereits Gewinne mit, während Gold noch steigt. Gold-Top steht unmittelbar bevor.' };
        }
        
        return { status: 'OK', value: '-', message: 'Keine GDX/Gold Divergenz.' };
    }
}
