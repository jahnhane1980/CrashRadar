import { MacroMlService } from '../../services/MacroMlService.js';

export class MlRegimeRadarMacroIndicator {
    constructor(macroMlService = null) {
        this.name = 'ML Regime Radar (Makro)';
        this.category = 'EARLY_WARNING';
        this.macroMlService = macroMlService || new MacroMlService('macro_regime');
    }

    _extractFeatures(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) return null;
        const i = timeline.length - 1;
        const curr = timeline[i];
        const prev30 = i >= 30 ? timeline[i - 30] : null;
        const prev56 = i >= 56 ? timeline[i - 56] : null;
        const prev90 = i >= 90 ? timeline[i - 90] : null;
        const prev14 = i >= 14 ? timeline[i - 14] : null;
        const prev28 = i >= 28 ? timeline[i - 28] : null;
        const prev60 = i >= 60 ? timeline[i - 60] : null;

        const spread10y2y = curr.macroGroups?.YieldCurve?.Spread10y2y ?? null;
        const spread10y2y_past30 = prev30?.macroGroups?.YieldCurve?.Spread10y2y ?? null;
        const spread10y2y_delta30 = (spread10y2y !== null && spread10y2y_past30 !== null) ? spread10y2y - spread10y2y_past30 : null;

        const realYield = curr.macroGroups?.FinancialConditions?.RealYield10y ?? null;
        const realYield_past60 = prev60?.macroGroups?.FinancialConditions?.RealYield10y ?? null;
        const realYield_delta60 = (realYield !== null && realYield_past60 !== null) ? realYield - realYield_past60 : null;

        const wresbal = curr.macroGroups?.BankingHealth?.BankReserves ? curr.macroGroups.BankingHealth.BankReserves / 1000 : null;
        const wresbal_past56 = prev56?.macroGroups?.BankingHealth?.BankReserves ? prev56.macroGroups.BankingHealth.BankReserves / 1000 : null;
        const wresbal_delta56 = (wresbal !== null && wresbal_past56 !== null) ? wresbal - wresbal_past56 : null;

        const tga = curr.macroGroups?.NetLiquidity?.TGA ?? null;
        const tga_past90 = prev90?.macroGroups?.NetLiquidity?.TGA ?? null;
        const tga_delta90 = (tga !== null && tga_past90 !== null) ? tga - tga_past90 : null;
        const tga_past30 = prev30?.macroGroups?.NetLiquidity?.TGA ?? null;
        const tga_delta30 = (tga !== null && tga_past30 !== null) ? tga - tga_past30 : null;

        const rrp = curr.macroGroups?.NetLiquidity?.RRPONTSYD ?? null;
        const rrp_past30 = prev30?.macroGroups?.NetLiquidity?.RRPONTSYD ?? null;
        const rrp_delta30 = (rrp !== null && rrp_past30 !== null) ? rrp - rrp_past30 : null;

        const walcl = curr.macroGroups?.NetLiquidity?.WALCL ?? null;
        const walcl_past14 = prev14?.macroGroups?.NetLiquidity?.WALCL ?? null;
        const walcl_delta14 = (walcl !== null && walcl_past14 !== null) ? walcl - walcl_past14 : null;

        const borrow = curr.macroGroups?.BankingHealth?.EmergencyBorrowing ?? null;
        const borrow_past28 = prev28?.macroGroups?.BankingHealth?.EmergencyBorrowing ?? null;
        const borrow_delta28 = (borrow !== null && borrow_past28 !== null) ? borrow - borrow_past28 : null;

        return {
            Spread_10Y_2Y_Current: spread10y2y,
            Spread_10Y_2Y_Delta30d: spread10y2y_delta30,
            Spread_10Y_3M_Current: curr.macroGroups?.YieldCurve?.Spread10y3m ?? spread10y2y,
            FedFundsRate_DFF: curr.macroGroups?.FinancialConditions?.FedFundsRate ?? null,
            RealYield_10Y_DFII10: realYield,
            RealYield_10Y_Delta60d: realYield_delta60,
            BankReserves_TOTRESNS_B: curr.macroGroups?.BankingHealth?.TotalReserves ?? null,
            WRESBAL_Delta56d_B: wresbal_delta56,
            TGA_Balance_B: tga,
            TGA_Delta90d_B: tga_delta90,
            TGA_Delta30d_B: tga_delta30,
            ReverseRepo_RRPONTSYD_B: rrp,
            ReverseRepo_Delta30d_B: rrp_delta30,
            FedBalance_WALCL_B: walcl,
            FedBalance_WALCL_Delta14d_B: walcl_delta14,
            EmergencyBorrowing_BORROW_B: borrow,
            EmergencyBorrowing_Delta28d_B: borrow_delta28,
            MaturityWall_Pct_M2: curr.macroGroups?.Leading?.MaturityWallPct ?? null,
            MarginDebt_Amount_M: curr.macroGroups?.Leading?.MarginDebt ?? null,
            MarginDebt_Drawdown180d_Pct: 0.0,
            ChicagoFed_NFCI: curr.macroGroups?.FinancialConditions?.ChicagoFedIndex ?? null,
            HighYieldSpread_Pct: null,
            SKEW_Index: curr.assets?.SKEW ?? null,
            AAII_BullBear_Spread_Pct: curr.assets?.AAII_Spread ? curr.assets.AAII_Spread * 100 : null,
            DIX_DarkPool_Pct: curr.assets?.DIX ? curr.assets.DIX * 100 : null,
            SPY_ShortVolumeRatio_Pct: curr.assets?.SPY_ShortVolumeRatio ? curr.assets.SPY_ShortVolumeRatio * 100 : null,
            Total_PutCall_Ratio_PCR: curr.assets?.TotalPCR ?? null,
            Challenger_JobCuts: curr.macroGroups?.Leading?.Challenger ?? null,
            Challenger_Delta_SMA6_Pct: null,
            Labor_PAYEMS_Delta3M: null,
            Labor_CE16OV_Delta3M: null,
            Gold_Close: curr.assets?.Gold ?? null,
            GDX_Close: curr.assets?.GDX ?? null,
            DXY_Close: curr.macroGroups?.FinancialConditions?.DXY ?? curr.assets?.DXY ?? null
        };
    }

    evaluate(timeline) {
        if (!Array.isArray(timeline) || timeline.length === 0) {
            return { status: 'UNKNOWN', message: 'Keine (oder ungültige) Daten' };
        }
        
        const currentDay = timeline[timeline.length - 1];
        if (!currentDay) return { status: 'UNKNOWN', message: 'Keine Daten für aktuellen Tag' };

        // 1. Priorität: Bereits vorberechnetes ML-Objekt (z. B. aus index.js / mlRegimeMacro)
        const mlData = currentDay.mlRegimeMacro || currentDay.mlRegime;
        if (mlData && mlData.phase) {
            const conf = ((mlData.confidence || 0) * 100).toFixed(1);
            if (mlData.phase === 'MACRO_TOP') return { status: 'CRITICAL', value: `TOP (${conf}%)`, message: 'ML-Modell erkennt zyklisches MAKRO-TOP!' };
            if (mlData.phase === 'MACRO_BOTTOM') return { status: 'CRITICAL', value: `BOTTOM (${conf}%)`, message: 'ML-Modell erkennt zyklischen MAKRO-BODEN!' };
            if (mlData.phase === 'ACUTE_CRASH_RISK') return { status: 'CRITICAL', value: `${conf}% Risk`, message: 'ML-Modell warnt vor akutem Crash-Risiko (ACUTE_CRASH_RISK)!' };
            if (mlData.phase === 'DOWNTREND') return { status: 'WARNING', value: `DOWNTREND (${conf}%)`, message: 'ML-Modell warnt vor Abwärtstrend.' };
            if (mlData.phase === 'ELEVATED_RISK') return { status: 'WARNING', value: `${conf}% Risk`, message: 'ML-Modell signalisiert erhöhtes Makro-Risiko (ELEVATED_RISK).' };
            return { status: 'OK', value: `UPTREND (${conf}%)`, message: 'ML-Modell signalisiert intakten Aufwärtstrend.' };
        }

        // 2. Priorität: Live-Inferenz über MacroMlService anhand der Timeline-Daten
        if (currentDay.macroGroups || currentDay.assets) {
            try {
                const features = this._extractFeatures(timeline);
                const pred = this.macroMlService.predict(features);
                const driversStr = pred.topDrivers?.slice(0, 3).map(d => d.feature).join(', ') || '';

                if (pred.regime === 'ACUTE_CRASH_RISK') {
                    return {
                        status: 'CRITICAL',
                        value: `${pred.riskPct}% Risk`,
                        message: `🚨 Akutes Crash-Risiko (${pred.riskPct}%). Haupttreiber: ${driversStr}`
                    };
                } else if (pred.regime === 'ELEVATED_RISK') {
                    return {
                        status: 'WARNING',
                        value: `${pred.riskPct}% Risk`,
                        message: `⚠️ Erhöhtes Makro-Risiko (${pred.riskPct}%). Haupttreiber: ${driversStr}`
                    };
                } else {
                    return {
                        status: 'OK',
                        value: `${pred.riskPct}% Risk`,
                        message: `Makro-Umfeld im Normalbereich (${pred.riskPct}% Crash-Risiko).`
                    };
                }
            } catch (e) {
                return { status: 'UNKNOWN', message: `ML-Fehler: ${e.message}` };
            }
        }

        return { status: 'UNKNOWN', message: 'Keine ML Daten oder Makro-Gruppen vorhanden' };
    }
}
