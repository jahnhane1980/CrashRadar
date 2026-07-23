export class SmartDumbMoneyTopIndicator {
    constructor() {
        this.name = 'Smart vs Dumb Money (The Top)';
        this.category = 'ACUTE_PANIC';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        
        let skew = currentDay?.assets?.SKEW;
        let aaiiSpread = currentDay?.assets?.AAII_Spread;
        
        if (skew == null || aaiiSpread == null) {
            return { status: 'UNKNOWN', message: 'Keine SKEW oder AAII Daten vorhanden' };
        }
        
        skew = Number(skew);
        aaiiSpread = Number(aaiiSpread);
        
        if (isNaN(skew) || isNaN(aaiiSpread)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        }
        
        if (skew > 145 && aaiiSpread > 20) {
            return { 
                status: 'CRITICAL', 
                value: `SKEW:${skew.toFixed(1)}|AAII:${aaiiSpread.toFixed(1)}%`, 
                message: `CRASH-FENSTER OFFEN (Distribution Window)! Smart Money hedged massiv (SKEW > 145) während Retail extrem euphorisch ist (AAII > 20%). Tops bilden sich innerhalb von 1-8 Wochen.`
            };
        }
        
        return { status: 'OK', value: '-', message: 'Kein Top-Setup aktiv.' };
    }
}
