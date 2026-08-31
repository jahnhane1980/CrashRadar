import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { SmartDumbMoneyTopIndicator } from './indicators/SmartDumbMoneyTopIndicator.js';
import { FiscalFedLiquidityIndicator } from './indicators/FiscalFedLiquidityIndicator.js';
import { SmartDumbMoneyBottomIndicator } from './indicators/SmartDumbMoneyBottomIndicator.js';
import { YieldCurveIndicator } from './indicators/YieldCurveIndicator.js';
import { RedAlertIndicator } from './indicators/RedAlertIndicator.js';
import { MarginDebtIndicator } from './indicators/MarginDebtIndicator.js';
import { TgaIndicator } from './indicators/TgaIndicator.js';
import { PanicCapitulationIndicator } from './indicators/PanicCapitulationIndicator.js';
import { BankReservesIndicator } from './indicators/BankReservesIndicator.js';
import { MaturityWallIndicator } from './indicators/MaturityWallIndicator.js';
import { NfciIndicator } from './indicators/NfciIndicator.js';
import { ChallengerIndicator } from './indicators/ChallengerIndicator.js';
import { StealthExitIndicator } from './indicators/StealthExitIndicator.js';
import LaborMarketDivergenceIndicator from './indicators/LaborMarketDivergenceIndicator.js';
import { InterestRateCycleIndicator } from './indicators/InterestRateCycleIndicator.js';
import { DalioTwoStageRegimeIndicator } from './indicators/DalioTwoStageRegimeIndicator.js';
import { MlRegimeRadarMacroIndicator } from './indicators/MlRegimeRadarMacroIndicator.js';
import { TreasuryCapacityRadarIndicator } from './indicators/TreasuryCapacityRadarIndicator.js';

export class MacroRegimeEngine {
    constructor(indicatorConfig = null) {
        const registry = {
            SmartDumbMoneyTopIndicator,
            SmartDumbMoneyBottomIndicator,
            YieldCurveIndicator,
            RedAlertIndicator,
            MarginDebtIndicator,
            TgaIndicator,
            PanicCapitulationIndicator,
            BankReservesIndicator,
            MaturityWallIndicator,
            NfciIndicator,
            ChallengerIndicator,
            FiscalFedLiquidityIndicator,
            StealthExitIndicator,
            LaborMarketDivergenceIndicator,
            InterestRateCycleIndicator,
            DalioTwoStageRegimeIndicator,
            MlRegimeRadarMacroIndicator,
            TreasuryCapacityRadarIndicator
        };

        let resolvedConfig = indicatorConfig;
        if (!resolvedConfig) {
            const configPath = path.resolve(__dirname, '../../config/Indicator-Pipeline-Config.json');
            if (fs.existsSync(configPath)) {
                try {
                    resolvedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } catch (e) {
                    Logger.warn(`[MacroRegimeEngine] Konnte Indicator-Pipeline-Config.json nicht parsen: ${e.message}`);
                }
            }
        }

        const macroList = resolvedConfig?.macroIndicators || resolvedConfig;

        if (Array.isArray(macroList)) {
            const activeConfigs = macroList
                .filter(item => item && item.enabled !== false && registry[item.className])
                .sort((a, b) => (a.reportOrder ?? 999) - (b.reportOrder ?? 999));

            this.indicators = activeConfigs.map(item => {
                const instance = new registry[item.className]();
                instance.__rules = item.rules || null;
                return instance;
            });
        } else {
            // Fallback: Standard-Instanzen
            this.indicators = [
                new SmartDumbMoneyTopIndicator(),
                new SmartDumbMoneyBottomIndicator(),
                new YieldCurveIndicator(),
                new RedAlertIndicator(),
                new MarginDebtIndicator(),
                new TgaIndicator(),
                new PanicCapitulationIndicator(),
                new BankReservesIndicator(),
                new MaturityWallIndicator(),
                new NfciIndicator(),
                new ChallengerIndicator(),
                new FiscalFedLiquidityIndicator(),
                new StealthExitIndicator(),
                new LaborMarketDivergenceIndicator(),
                new InterestRateCycleIndicator(),
                new DalioTwoStageRegimeIndicator(),
                new MlRegimeRadarMacroIndicator(),
                new TreasuryCapacityRadarIndicator()
            ];
        }
    }

    _applyRule(rule, state, result) {
        if (!rule) return;

        if (Array.isArray(rule.addVetos)) {
            for (const v of rule.addVetos) {
                if (!state.vetos.includes(v)) {
                    state.vetos.push(v);
                }
            }
        }

        if (rule.setLiquidityStatus) {
            state.liquidityStatus = rule.setLiquidityStatus;
        }

        if (rule.setRegimeIf) {
            const allowedCurrent = Array.isArray(rule.setRegimeIf.currentRegime)
                ? rule.setRegimeIf.currentRegime
                : [rule.setRegimeIf.currentRegime];

            if (allowedCurrent.includes(state.regime)) {
                state.regime = rule.setRegimeIf.targetRegime;
            }
        }

        if (rule.setRegime) {
            const exceptions = rule.exceptIfRegime || rule.regimeOverrideExcept || [];
            if (!exceptions.includes(state.regime)) {
                state.regime = rule.setRegime;
            }
        }
    }

    _applyIndicatorRules(indicator, result, state) {
        const rules = indicator.__rules;
        if (!rules || !result) return;

        if (rules.onMessageMatch && result.message) {
            if (result.message.includes(rules.onMessageMatch.matchText)) {
                this._applyRule(rules.onMessageMatch, state, result);
            }
        }

        if (Array.isArray(rules.onStatusMatch)) {
            const matchedRule = rules.onStatusMatch.find(r => r.status === result.status);
            if (matchedRule) {
                this._applyRule(matchedRule, state, result);
            }
        }

        if (result.status === 'WARNING' && rules.onWarning) {
            this._applyRule(rules.onWarning, state, result);
        } else if (result.status === 'CRITICAL' && rules.onCritical) {
            this._applyRule(rules.onCritical, state, result);
        }
    }

    evaluate(groupedData) {
        if (!groupedData || typeof groupedData !== 'object' || Object.keys(groupedData).length === 0) {
            return {};
        }
        
        const states = {};
        const isArr = Array.isArray(groupedData);
        const entries = isArr 
            ? groupedData.map(item => ({ dateStr: item.date || item.dateStr, currentDay: item }))
            : Object.keys(groupedData).sort().map(d => ({ dateStr: d, currentDay: groupedData[d] }));

        const timeline = [];

        for (let i = 0; i < entries.length; i++) {
            const { dateStr, currentDay } = entries[i];
            timeline.push(currentDay);

            if (!currentDay || !currentDay.assets || !currentDay.macroGroups) {
                states[dateStr] = {
                    regime: 'UNKNOWN',
                    liquidityStatus: 'UNKNOWN',
                    vetos: [],
                    indicatorDetails: []
                };
                continue;
            }

            const state = {
                regime: 'NORMAL',
                liquidityStatus: 'NORMAL',
                vetos: [],
                indicatorDetails: []
            };

            for (const indicator of this.indicators) {
                const result = indicator.evaluate(timeline);
                
                state.indicatorDetails.push({
                    name: indicator.name,
                    category: indicator.category,
                    status: (result && result.status) ? result.status : 'UNKNOWN',
                    value: (result && result.value) ? result.value : null,
                    message: (result && result.message) ? result.message : null
                });

                if (!result || result.status === 'UNKNOWN') continue;

                this._applyIndicatorRules(indicator, result, state);
            }

            states[dateStr] = state;
        }

        return states;
    }
}
