export class DalioTwoStageRegimeIndicator {
    constructor() {
        this.name = 'Dalio Late-Stage & Tipping Point Indicator (2-Stufen)';
        this.category = 'MACRO_CONTEXT';
        this.MEMORY_DAYS = 30;
    }

    _safeNum(val, fallback = 0) {
        if (val == null) return fallback;
        if (typeof val === 'string' && val.trim() === '') return fallback;
        const n = Number(val);
        return isNaN(n) ? fallback : n;
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length < 5) {
            return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 5 Tage)' };
        }

        const currentDay = timeline[timeline.length - 1];
        if (!currentDay || typeof currentDay !== 'object') {
            return { status: 'UNKNOWN', message: 'Keine Tagesdaten vorhanden' };
        }

        const macro = currentDay.macroGroups || {};
        const yieldCurve = macro.YieldCurve || {};
        const finCond = macro.FinancialConditions || {};
        const liquidity = macro.Liquidity || {};
        const fundamentals = macro.Fundamentals || {};

        // Extract metrics (with safe parsing & fallbacks)
        const fedFunds = this._safeNum(finCond.FedFundsRate ?? currentDay.fedFunds, 0);
        const yield10y = this._safeNum(finCond.RealYield10y ?? yieldCurve.Yield10y, 0);
        const yield30y = this._safeNum(finCond.Yield30y ?? yieldCurve.Yield30y, 0);
        const spread10y2y = this._safeNum(yieldCurve.Spread10y2y, 0);
        const spread10y3m = this._safeNum(yieldCurve.Spread10y3m ?? yieldCurve.Spread10y2y, 0);
        const rrp = this._safeNum(liquidity.ReverseRepo ?? currentDay.rrp, 2.15); // in $B
        const hySpread = this._safeNum(finCond.HighYieldSpread, 2.84); // in %
        const interestExp = this._safeNum(fundamentals.GovInterestExpenses ?? currentDay.interestExpenses, 0);
        const taxReceipts = this._safeNum(fundamentals.GovTaxReceipts ?? currentDay.taxReceipts, 1);

        // Prevent Division by Zero
        const govInterestRatio = (taxReceipts > 0 && interestExp > 0) ? (interestExp / taxReceipts) * 100 : 0;

        // --- STUFE 1: MAKRO-SPÄTZYKLUS WATCHLIST (4 BEDINGUNGEN) ---
        const c1_rate_stress = fedFunds > 4.5 || yield10y > 4.5 || yield30y > 5.0;
        const c2_inversion = spread10y3m < 0 || spread10y2y < 0;
        const c3_debt_burden = govInterestRatio > 30.0 || (interestExp > 900); // > 30% Tax Receipts or > $900B
        const c4_credit_stress = hySpread > 3.5 || (c1_rate_stress && c2_inversion);

        let stage1Count = 0;
        const stage1Triggers = [];
        if (c1_rate_stress) { stage1Count++; stage1Triggers.push('RateStress'); }
        if (c2_inversion) { stage1Count++; stage1Triggers.push('YieldInversion'); }
        if (c3_debt_burden) { stage1Count++; stage1Triggers.push('GovDebtBurden'); }
        if (c4_credit_stress) { stage1Count++; stage1Triggers.push('CreditStress'); }

        const stage1WatchlistActive = stage1Count >= 3;

        // --- STUFE 2: UNMITTELBARER KIPPPUNKT-TRIGGER ---
        const catA_rrp_exhausted = rrp < 20.0; // Reverse Repo under $20B
        const catB_hy_breakout = hySpread > 4.0; // Credit spread breakout

        const stage2Triggered = stage1WatchlistActive && (catA_rrp_exhausted || catB_hy_breakout);

        // Result formatting
        if (stage2Triggered) {
            const catReason = catA_rrp_exhausted ? 'RRP-Puffer erschöpft (< 20 Mrd. $)' : 'Credit-Spread-Ausbruch (> 4,0 %)';
            return {
                status: 'CRITICAL',
                value: `KIPPPUNKT (${stage1Count}/4 RED + ${catReason})`,
                message: `ALARM ROT: Dalio-Kipppunkt erreicht! (${catReason}). Unmittelbares Crash-Fenster (0-3 Monate).`,
                details: { stage1Count, stage1Triggers, rrp, hySpread, govInterestRatio }
            };
        }

        if (stage1WatchlistActive) {
            return {
                status: 'WARNING',
                value: `WATCHLIST (${stage1Count}/4 RED)`,
                message: `Spätzyklus-Watchlist aktiv (${stage1Count}/4 Bedingungen ROT: ${stage1Triggers.join(', ')}). Fenster: ~3 bis 12 Monate.`,
                details: { stage1Count, stage1Triggers, rrp, hySpread, govInterestRatio }
            };
        }

        return {
            status: 'OK',
            value: `NORMAL (${stage1Count}/4 RED)`,
            message: `Stabile Makro-Phase (${stage1Count}/4 Bedingungen ROT).`,
            details: { stage1Count, stage1Triggers, rrp, hySpread, govInterestRatio }
        };
    }
}
