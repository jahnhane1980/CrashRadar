export class RedAlertIndicator {
    constructor() {
        this.name = 'Red Alert (Bullenmarkt-Stirbt-Signal)';
        this.category = 'TRIGGER';
    }

    evaluate(timeline) {
        if (timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        const skew = currentDay.assets?.SKEW;
        const shortRatio = currentDay.SPY_ShortVolumeRatio;
        const pcr = currentDay.TotalPCR;
        
        if (skew === undefined || shortRatio === undefined) {
            return { status: 'UNKNOWN', message: 'Keine SKEW oder Short-Ratio Daten' };
        }
        
        // Fallback für PCR, wenn die lokale Datei (noch) fehlt
        const pcrVal = pcr !== undefined ? pcr : 1.0; 
        const hasPcr = pcr !== undefined;
        
        if (skew > 145 && shortRatio < 0.45) {
            if (pcrVal < 0.75) {
                return { 
                    status: 'CRITICAL', 
                    value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%|PCR:${pcrVal.toFixed(2)}`, 
                    message: `MAXIMALER ALARM! Institutionelle Panik-Absicherung (SKEW) trifft auf extreme Retail-Gier (Short-Capitulation & PCR < 0.75). Der Markt steht vor dem Crash.`
                };
            } else {
                return { 
                    status: 'WARNING', 
                    value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%${hasPcr ? '|PCR:'+pcrVal.toFixed(2) : ' (Kein PCR)'}`, 
                    message: `Bären-Kapitulation + Smart-Money Hedging! ABER: Melt-Up Phase ist noch aktiv (PCR > 0.75). Weiterer Anstieg möglich, bis Euphorie komplettiert.` 
                };
            }
        } else if (skew > 140 && shortRatio < 0.50) {
            return { status: 'WARNING', value: `SKEW:${skew.toFixed(1)}|Short:${(shortRatio*100).toFixed(1)}%`, message: 'Spannung baut sich auf. Bären sterben langsam aus.' };
        }
        
        return { status: 'OK', value: '-', message: 'Kein Crash-Setup aktiv.' };
    }
}
