export class FiscalFedLiquidityIndicator {
    constructor() {
        this.name = 'Fiscal-FED Liquidity (Plumbing)';
    }

    /**
     * @param {Array} timeline - Array von Tages-Objekten aus FinanceExpert
     */
    evaluate(timeline) {
        if (!timeline || timeline.length < 90) {
            return { status: 'UNKNOWN', message: 'Zu wenig Daten für 90-Tage Delta' };
        }

        const currentDay = timeline[timeline.length - 1];
        const currentDate = currentDay.date;
        if (!currentDate || isNaN(new Date(currentDate).getTime())) {
            return { status: 'UNKNOWN', message: 'Ungültiges Datum in Timeline' };
        }
        
        // Hilfsfunktion: Hole Wert vor X Tagen aus der Timeline
        const getValAgo = (daysBack, extractFn) => {
            const targetDate = new Date(currentDate);
            targetDate.setDate(targetDate.getDate() - daysBack);
            const targetStr = targetDate.toISOString().split('T')[0];

            let pastVal = null;
            // Rückwärts suchen bis zum passenden Datum
            for (let i = timeline.length - 1; i >= 0; i--) {
                if (timeline[i].date <= targetStr) {
                    pastVal = extractFn(timeline[i]);
                    break;
                }
            }
            if (pastVal === null) pastVal = extractFn(timeline[0]); // Fallback
            
            const currVal = extractFn(currentDay);
            if (currVal === null || pastVal === null || currVal === undefined || pastVal === undefined) return null;
            return { current: currVal, past: pastVal, delta: currVal - pastVal };
        };

        const tga = getValAgo(90, d => d.macroGroups?.NetLiquidity?.TGA);
        const wresbal = getValAgo(56, d => d.macroGroups?.BankingHealth?.BankReserves);
        const rrp = getValAgo(30, d => d.macroGroups?.NetLiquidity?.RRPONTSYD);
        const walcl = getValAgo(14, d => d.macroGroups?.NetLiquidity?.WALCL);
        const borrow = getValAgo(28, d => d.macroGroups?.BankingHealth?.EmergencyBorrowing);

        if (!tga || !wresbal || !rrp || !walcl || !borrow) {
            return { status: 'UNKNOWN', message: 'Fehlende Metriken für Deltas' };
        }

        // Schritt 2: Panik-Gedächtnis aufbauen (Lookback 60 Tage)
        let hadRecentPanic = false;
        
        for (let i = timeline.length - 1; i >= 0; i--) {
            const dStr = timeline[i].date;
            if (!dStr || isNaN(new Date(dStr).getTime())) continue;

            const diffTime = Math.abs(new Date(currentDate) - new Date(dStr));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 60) break; // Nicht weiter als 60 Tage zurückschauen
            
            // Berechne 28-Tage Delta für diesen historischen Tag i
            const targetD = new Date(dStr);
            targetD.setDate(targetD.getDate() - 28);
            const targetS = targetD.toISOString().split('T')[0];
            
            let pVal = null;
            for (let j = i; j >= 0; j--) {
                if (timeline[j].date <= targetS) {
                    pVal = timeline[j].macroGroups?.BankingHealth?.EmergencyBorrowing;
                    break;
                }
            }
            if (pVal === null || pVal === undefined) pVal = timeline[0].macroGroups?.BankingHealth?.EmergencyBorrowing;
            
            const cVal = timeline[i].macroGroups?.BankingHealth?.EmergencyBorrowing;
            if (cVal !== null && cVal !== undefined && pVal !== null && pVal !== undefined && (cVal - pVal) > 15000) { // > +15 Mrd
                hadRecentPanic = true;
                break;
            }
        }

        const formatB = (val) => `${(val / 1000).toFixed(1)}B`;

        // Schritt 4: Phasen-Auswertung (Top-Down Priorität)
        
        // Prio 1: Phase 4 - Rettung
        if (walcl.delta > 50000) {
            return { status: 'NORMAL', message: `Phase 4: WALCL +${formatB(walcl.delta)} (Stealth QE)` };
        }
        if (wresbal.delta > 150000) {
            return { status: 'NORMAL', message: `Phase 4: WRESBAL +${formatB(wresbal.delta)} (Wunder-Pille)` };
        }
        if (wresbal.delta > 50000 && hadRecentPanic) {
            return { status: 'NORMAL', message: `Phase 4: WRESBAL +${formatB(wresbal.delta)} (Boden nach Panik)` };
        }

        // Prio 2: Phase 3 - Kapitulation
        if (borrow.delta > 15000) {
            return { status: 'CRITICAL', message: `Phase 3: BORROW +${formatB(borrow.delta)} (Kernschmelze)` };
        }

        // Prio 3: Phase 2 - Crash/Drain
        if (rrp.delta > 100000) {
            return { status: 'WARNING', message: `Phase 2: RRP +${formatB(rrp.delta)} (Liquiditäts-Drain)` };
        }

        // Prio 4: Phase 1 - Warnung
        if (tga.delta > 150000) {
            return { status: 'WARNING', message: `Phase 1: TGA +${formatB(tga.delta)} (Staubsauger)` };
        }
        if (wresbal.delta < -100000) {
            return { status: 'WARNING', message: `Phase 1: WRESBAL ${formatB(wresbal.delta)} (Liquiditätsentzug)` };
        }

        return { status: 'NORMAL', message: 'Liquidity OK.' };
    }
}
