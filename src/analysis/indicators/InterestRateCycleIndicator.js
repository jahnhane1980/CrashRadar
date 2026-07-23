export class InterestRateCycleIndicator {
    constructor() {
        this.name = 'Macro Interest Rate Cycle (RateShock + ARCC + PolicyError)';
        this.category = 'MACRO_CONTEXT';
        this.MEMORY_DAYS = 180;
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < this.MEMORY_DAYS) {
            return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 180 Tage)' };
        }

        let rateShockActive = false;
        let arccActive = false;
        let policyErrorActive = false;

        const latestIdx = timeline.length - 1;
        const startIdx = Math.max(0, latestIdx - this.MEMORY_DAYS);

        for (let i = latestIdx; i >= startIdx; i--) {
            // Check Rate Shock (60 days back from i)
            if (!rateShockActive && i >= 60) {
                const cYield = timeline[i]?.macroGroups?.FinancialConditions?.RealYield10y;
                const pYield = timeline[i - 60]?.macroGroups?.FinancialConditions?.RealYield10y;
                if (cYield != null && pYield != null && (cYield - pYield) >= 0.5) {
                    rateShockActive = true;
                }
            }

            // Check ARCC (90 days back from i)
            if (!arccActive && i >= 90) {
                const cExp = timeline[i]?.macroGroups?.Fundamentals?.ARCC_InterestExpense;
                const pExp = timeline[i - 90]?.macroGroups?.Fundamentals?.ARCC_InterestExpense;
                if (cExp != null && pExp != null && pExp > 0) {
                    const perf = ((cExp - pExp) / pExp) * 100;
                    if (perf >= 15.0) {
                        arccActive = true;
                    }
                }
            }

            // Check Policy Error (60 days back from i)
            if (!policyErrorActive && i >= 60) {
                const cDFF = timeline[i]?.macroGroups?.FinancialConditions?.FedFundsRate;
                const pDFF = timeline[i - 60]?.macroGroups?.FinancialConditions?.FedFundsRate;
                const cInf = timeline[i]?.macroGroups?.Leading?.BreakevenInflation;
                const pInf = timeline[i - 60]?.macroGroups?.Leading?.BreakevenInflation;
                
                if (cDFF != null && pDFF != null && cInf != null && pInf != null) {
                    if ((cDFF - pDFF) < -0.25 && (cInf - pInf) > 0.10) {
                        policyErrorActive = true;
                    }
                }
            }
            
            if (rateShockActive && arccActive && policyErrorActive) break;
        }

        let score = 0;
        let triggers = [];
        if (rateShockActive) { score++; triggers.push('RateShock'); }
        if (arccActive) { score++; triggers.push('ARCC'); }
        if (policyErrorActive) { score++; triggers.push('PolicyError'); }

        if (score === 3) {
            return { status: 'CRITICAL', value: '3/3', message: `CODE RED Zins-Zyklus! (${triggers.join(' + ')})` };
        } else if (score === 2) {
            return { status: 'WARNING', value: '2/3', message: `Eskalierender Zins-Zyklus (${triggers.join(' + ')})` };
        } else if (score === 1) {
            return { status: 'EARLY_WARNING', value: '1/3', message: `Erste Anzeichen von Zins-Stress (${triggers[0]})` };
        }
        
        return { status: 'OK', value: '0/3', message: 'Kein makroökonomischer Zins-Stress detektiert.' };
    }
}
