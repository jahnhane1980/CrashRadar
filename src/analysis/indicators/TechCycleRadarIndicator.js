export class TechCycleRadarIndicator {
    constructor() {
        this.name = 'Tech-Zyklus Radar (SMH vs IGV)';
        this.category = 'CYCLE';
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 100) return { status: 'UNKNOWN', message: 'Zu wenig Daten für Moving Averages' };

        const SHORT_MA_DAYS = 15; // ca. 3 Wochen
        const LONG_MA_DAYS = 50;  // ca. 10 Wochen

        // Helper-Funktion für MA des Ratios
        const getRatioMa = (days, offsetIndex = 0) => {
            let sum = 0, count = 0;
            const startIndex = timeline.length - 1 - offsetIndex - days;
            const endIndex = timeline.length - 1 - offsetIndex;
            for (let i = startIndex; i < endIndex; i++) {
                const day = timeline[i];
                if (!day || !day.assets) continue;
                
                let smh = day.assets.SMH;
                let igv = day.assets.IGV;
                
                if (smh == null || igv == null) continue;
                
                if (typeof smh !== 'number' && typeof smh !== 'string') continue;
                if (typeof igv !== 'number' && typeof igv !== 'string') continue;
                if (typeof smh === 'string' && smh.trim() === '') continue;
                if (typeof igv === 'string' && igv.trim() === '') continue;
                
                smh = Number(smh);
                igv = Number(igv);
                
                if (isNaN(smh) || isNaN(igv) || igv === 0) continue;

                sum += (smh / igv);
                count++;
            }
            return count > 0 ? sum / count : null;
        };

        const currentShortMa = getRatioMa(SHORT_MA_DAYS, 0);
        const currentLongMa = getRatioMa(LONG_MA_DAYS, 0);
        
        const prevShortMa = getRatioMa(SHORT_MA_DAYS, 5); // MA vor einer Woche
        const prevLongMa = getRatioMa(LONG_MA_DAYS, 5);

        if (currentShortMa == null || currentLongMa == null || prevShortMa == null || prevLongMa == null) {
            return { status: 'UNKNOWN', message: 'Keine SMH oder IGV Daten verfügbar' };
        }

        // Ratio Momentum (Steigt der schnelle MA noch oder flacht er ab?)
        const shortMaMomentum = currentShortMa - prevShortMa;
        
        // CIBR Check (Gibt es defensive Flucht?)
        // Berechne kurzes Momentum von CIBR vs SPY
        let cibrFleeing = false;
        let cibrStr = "";
        const today = timeline[timeline.length - 1];
        const past = timeline[timeline.length - 15];
        
        let todayCibr = today?.assets?.CIBR;
        let todaySpy = today?.assets?.SPY;
        let pastCibr = past?.assets?.CIBR;
        let pastSpy = past?.assets?.SPY;
        
        if (todayCibr != null && todaySpy != null && pastCibr != null && pastSpy != null) {
            todayCibr = Number(todayCibr);
            todaySpy = Number(todaySpy);
            pastCibr = Number(pastCibr);
            pastSpy = Number(pastSpy);
            
            if (!isNaN(todayCibr) && !isNaN(todaySpy) && !isNaN(pastCibr) && !isNaN(pastSpy) && todaySpy !== 0 && pastSpy !== 0) {
                const currentCibrRs = todayCibr / todaySpy;
                const pastCibrRs = pastCibr / pastSpy;
                if (pastCibrRs !== 0) {
                    const cibrMomentum = ((currentCibrRs - pastCibrRs) / pastCibrRs) * 100;
                    if (cibrMomentum > 2.0) {
                        cibrFleeing = true;
                        cibrStr = `Defensives Geld flüchtet massiv in Cybersecurity (CIBR Momentum: +${cibrMomentum.toFixed(1)}%).`;
                    }
                }
            }
        }

        // Status-Erkennung
        const isHardwareDominant = currentShortMa > currentLongMa;
        const wasHardwareDominant = prevShortMa > prevLongMa;

        if (isHardwareDominant && !wasHardwareDominant) {
            return { status: 'CRITICAL', value: 'HARDWARE START', message: 'TECH-ZYKLUS BESTÄTIGUNG: Hardware (SMH) hat offiziell die Führung übernommen (Golden Cross des Ratios). Der neue KI/Infrastruktur-Zyklus ist aktiv.' };
        }
        if (!isHardwareDominant && wasHardwareDominant) {
            return { status: 'CRITICAL', value: 'SOFTWARE START', message: 'TECH-ZYKLUS BESTÄTIGUNG: Software (IGV) hat offiziell die Führung übernommen (Death Cross des Ratios). Das Geld wandert in SaaS/Monetarisierung.' };
        }
        
        if (isHardwareDominant) {
            if (shortMaMomentum < 0) {
                // Distribution!
                const msg = `Hardware wackelt (Distribution). Das Ratio flacht ab, Gewinnmitnahmen wahrscheinlich. ${cibrStr}`;
                return { status: 'WARNING', value: 'DISTRIBUTION', message: msg.trim() };
            } else {
                return { status: 'OK', value: 'HARDWARE DOMINANZ', message: 'Hardware-Zyklus (SMH) ist intakt und baut Momentum auf.' };
            }
        } else {
            if (shortMaMomentum > 0) {
                // Accumulation!
                return { status: 'WARNING', value: 'ACCUMULATION', message: 'Vorwarnung: Software (IGV) ist noch dominant, aber Hardware (SMH) sammelt bereits massiv Momentum. Ein Wechsel steht an.' };
            } else {
                return { status: 'OK', value: 'SOFTWARE DOMINANZ', message: 'Software-Zyklus (IGV) ist intakt und baut Momentum auf.' };
            }
        }
    }
}
