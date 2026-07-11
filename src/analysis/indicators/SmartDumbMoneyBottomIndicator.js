export class SmartDumbMoneyBottomIndicator {
    constructor() {
        this.name = 'Smart vs Dumb Money (The Bottom)';
        this.category = 'TROUGH';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        
        let vix = currentDay?.assets?.VIX;
        let aaiiSpread = currentDay?.assets?.AAII_Spread;
        let dix = currentDay?.assets?.DIX;
        
        if (vix == null || aaiiSpread == null || dix == null) {
            return { status: 'UNKNOWN', message: 'Keine VIX, AAII oder DIX Daten vorhanden' };
        }
        
        vix = Number(vix);
        aaiiSpread = Number(aaiiSpread);
        dix = Number(dix);
        
        // Normalize DIX if it is represented as decimal (0.45) instead of percentage (45%)
        if (dix > 0 && dix <= 1) dix = dix * 100;

        if (isNaN(vix) || isNaN(aaiiSpread) || isNaN(dix)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        }
        
        if (vix > 40 && aaiiSpread < -25 && dix > 45) {
            return { 
                status: 'CRITICAL', 
                value: `VIX:${vix.toFixed(1)}|AAII:${aaiiSpread.toFixed(1)}%|DIX:${dix.toFixed(1)}%`, 
                message: `KAPITULATION! Retail in totaler Panik (AAII < -25% & VIX > 40), WÄHREND Wale extrem stark akkumulieren (DIX > 45%). V-Shape Reversal imminent!`
            };
        }
        
        return { status: 'OK', value: '-', message: 'Kein Bottom-Setup aktiv.' };
    }
}
