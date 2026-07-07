export class RedAlertIndicator {
    constructor() {
        this.name = 'Red Alert (Bullenmarkt-Stirbt-Signal)';
        this.category = 'TRIGGER';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 1) return { status: 'UNKNOWN', message: 'Zu wenig Daten' };
        
        const currentDay = timeline[timeline.length - 1];
        
        let skew = currentDay?.assets?.SKEW;
        let shortRatio = currentDay?.SPY_ShortVolumeRatio;
        let pcr = currentDay?.TotalPCR;
        
        if (skew == null || shortRatio == null) {
            return { status: 'UNKNOWN', message: 'Keine SKEW oder Short-Ratio Daten' };
        }
        
        skew = Number(skew);
        shortRatio = Number(shortRatio);
        
        if (isNaN(skew) || isNaN(shortRatio)) {
            return { status: 'UNKNOWN', message: 'Ungültige Daten (keine Zahlen)' };
        }
        
        // Fallback für PCR, wenn die lokale Datei (noch) fehlt
        let pcrVal = 1.0;
        let hasPcr = false;
        
        if (pcr != null) {
            const numPcr = Number(pcr);
            if (!isNaN(numPcr)) {
                pcrVal = numPcr;
                hasPcr = true;
            }
        }
        
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
