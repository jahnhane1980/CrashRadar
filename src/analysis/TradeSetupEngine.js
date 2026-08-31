import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { GoldVolumeClimaxIndicator } from './indicators/GoldVolumeClimaxIndicator.js';
import { GoldCapitulationIndicator } from './indicators/GoldCapitulationIndicator.js';
import { GdxSellingClimaxIndicator } from './indicators/GdxSellingClimaxIndicator.js';
import { GdxBuyingClimaxIndicator } from './indicators/GdxBuyingClimaxIndicator.js';
import { GdxGoldDivergenceIndicator } from './indicators/GdxGoldDivergenceIndicator.js';
import { BitcoinDivergenceIndicator } from './indicators/BitcoinDivergenceIndicator.js';
import { CryptoCycleDivergenceIndicator } from './indicators/CryptoCycleDivergenceIndicator.js';
import { CryptoPortfolioExitIndicator } from './indicators/CryptoPortfolioExitIndicator.js';
import { BtcTrailingStopIndicator } from './indicators/BtcTrailingStopIndicator.js';
import { BitcoinSellingClimaxIndicator } from './indicators/BitcoinSellingClimaxIndicator.js';
import { TechCycleRadarIndicator } from './indicators/TechCycleRadarIndicator.js';
import { MlRegimeRadarBtcIndicator } from './indicators/MlRegimeRadarBtcIndicator.js';
import { MlRegimeRadarCryptoIndicator } from './indicators/MlRegimeRadarCryptoIndicator.js';
import { DxyParabolicClimaxIndicator } from './indicators/DxyParabolicClimaxIndicator.js';

export class TradeSetupEngine {
    constructor(getCycleConfig, indicatorConfig = null) {
        const safeConfig = getCycleConfig || (() => ({ MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21' } }));
        
        const registry = {
            GoldVolumeClimaxIndicator: () => new GoldVolumeClimaxIndicator(),
            GoldCapitulationIndicator: () => new GoldCapitulationIndicator(),
            GdxSellingClimaxIndicator: () => new GdxSellingClimaxIndicator(),
            GdxBuyingClimaxIndicator: () => new GdxBuyingClimaxIndicator(),
            GdxGoldDivergenceIndicator: () => new GdxGoldDivergenceIndicator(),
            DxyParabolicClimaxIndicator: () => new DxyParabolicClimaxIndicator(),
            BitcoinDivergenceIndicator: () => new BitcoinDivergenceIndicator(),
            CryptoCycleDivergenceIndicator: () => new CryptoCycleDivergenceIndicator(),
            CryptoPortfolioExitIndicator: () => new CryptoPortfolioExitIndicator(safeConfig),
            BtcTrailingStopIndicator: () => new BtcTrailingStopIndicator(),
            BitcoinSellingClimaxIndicator: () => new BitcoinSellingClimaxIndicator(),
            TechCycleRadarIndicator: () => new TechCycleRadarIndicator(),
            MlRegimeRadarBtcIndicator: () => new MlRegimeRadarBtcIndicator(),
            MlRegimeRadarCryptoIndicator: () => new MlRegimeRadarCryptoIndicator()
        };

        let resolvedConfig = indicatorConfig;
        if (!resolvedConfig) {
            const configPath = path.resolve(__dirname, '../../config/Indicator-Pipeline-Config.json');
            if (fs.existsSync(configPath)) {
                try {
                    resolvedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                } catch (e) {
                    Logger.warn(`[TradeSetupEngine] Konnte Indicator-Pipeline-Config.json nicht parsen: ${e.message}`);
                }
            }
        }

        const tradeList = resolvedConfig?.tradeSetupIndicators || resolvedConfig;

        if (Array.isArray(tradeList)) {
            const activeConfigs = tradeList
                .filter(item => item && item.enabled !== false && registry[item.className])
                .sort((a, b) => (a.reportOrder ?? 999) - (b.reportOrder ?? 999));

            this.indicators = activeConfigs.map(item => {
                const instance = registry[item.className]();
                instance.__executionRules = item.executionRules || null;
                return instance;
            });
        } else {
            // Fallback: Orchestrierung der Topf-B Indikatoren
            this.indicators = [
                new GoldVolumeClimaxIndicator(),
                new GoldCapitulationIndicator(),
                new GdxSellingClimaxIndicator(),
                new GdxBuyingClimaxIndicator(),
                new GdxGoldDivergenceIndicator(),
                new DxyParabolicClimaxIndicator(),
                new BitcoinDivergenceIndicator(),
                new CryptoCycleDivergenceIndicator(),
                new CryptoPortfolioExitIndicator(safeConfig),
                new BtcTrailingStopIndicator(),
                new BitcoinSellingClimaxIndicator(),
                new TechCycleRadarIndicator(),
                new MlRegimeRadarBtcIndicator(),
                new MlRegimeRadarCryptoIndicator()
            ];
        }
    }

    _determineTargetAsset(indicator) {
        if (indicator.targetAsset) return indicator.targetAsset;
        const name = indicator.name || '';
        if (name.includes('Gold') || name.includes('GDX')) return 'GOLD';
        if (name.includes('Bitcoin') || name.includes('BTC') || name.includes('Crypto')) return 'BTC';
        if (name.includes('Tech') || name.includes('QQQ')) return 'QQQ';
        if (name.includes('SPY')) return 'SPY';
        return 'MACRO';
    }

    _applyExecutionRules(action, indicator, regime, vetos) {
        const rules = indicator.__executionRules;

        if (regime === 'FLASH_CRASH') {
            const allowInFlashCrash = rules?.allowInFlashCrash ?? (indicator.name.includes('Capitulation') || indicator.name.includes('Selling Climax'));
            if (!allowInFlashCrash) {
                action.blocked = true;
                action.blockReason = 'FLASH_CRASH_BLOCKS_RISK_ON';
            }
        } 
        else if (regime === 'BEAR_MARKET') {
            if (rules?.blockedByRegimes?.includes('BEAR_MARKET') || indicator.name === 'Tech-Zyklus Radar (SMH vs IGV)') {
                action.blocked = true;
                action.blockReason = rules?.blockReason || 'BEAR_MARKET_BLOCKS_TECH_BREAKOUT';
            }
            if (vetos.includes('DELEVERAGING_ONGOING')) {
                action.scaleDown = true;
            }
        }
        else if (regime === 'LATE_CYCLE_EUPHORIA') {
            if (rules?.blockedByRegimes?.includes('LATE_CYCLE_EUPHORIA')) {
                action.blocked = true;
                action.blockReason = rules?.blockReason || 'LATE_CYCLE_EUPHORIA_BLOCKS_ENTRY';
            }
        }
    }

    evaluate(groupedData, macroStates) {
        if (!groupedData || typeof groupedData !== 'object' || Object.keys(groupedData).length === 0) {
            return {};
        }

        const actionsByDate = {};
        const isArr = Array.isArray(groupedData);
        const entries = isArr 
            ? groupedData.map(item => ({ dateStr: item.date || item.dateStr, currentDay: item }))
            : Object.keys(groupedData).sort().map(d => ({ dateStr: d, currentDay: groupedData[d] }));

        const timeline = [];

        for (let i = 0; i < entries.length; i++) {
            const { dateStr, currentDay } = entries[i];
            timeline.push(currentDay);

            actionsByDate[dateStr] = [];

            if (!currentDay || !currentDay.assets) {
                continue;
            }

            const macroState = macroStates && macroStates[dateStr] ? macroStates[dateStr] : { regime: 'NORMAL', vetos: [], liquidityStatus: 'NORMAL' };
            const regime = macroState.regime;
            const vetos = macroState.vetos || [];

            const rawActions = [];

            for (const indicator of this.indicators) {
                const result = indicator.evaluate(timeline);
                
                if (!result || result.status === 'UNKNOWN' || result.status === 'OK') {
                    continue;
                }

                const targetAsset = this._determineTargetAsset(indicator);

                const action = {
                    indicator: indicator.name,
                    category: result.category || indicator.category,
                    targetAsset: targetAsset,
                    status: result.status,
                    value: result.value,
                    message: result.message,
                    macroRegime: regime,
                    blocked: false,
                    blockReason: null
                };

                this._applyExecutionRules(action, indicator, regime, vetos);

                rawActions.push(action);
            }

            // Asset Confluence & Tranche Allocation Calculation (Post-Processing pro Tag)
            const activeBottomSignalsByAsset = {};
            for (const action of rawActions) {
                if (!action.blocked && (action.category === 'BOTTOM_FINDER' || action.status === 'CRITICAL')) {
                    const asset = action.targetAsset;
                    activeBottomSignalsByAsset[asset] = (activeBottomSignalsByAsset[asset] || 0) + 1;
                }
            }

            for (const action of rawActions) {
                if (!action.blocked && (action.category === 'BOTTOM_FINDER' || action.status === 'CRITICAL')) {
                    const score = activeBottomSignalsByAsset[action.targetAsset] || 1;
                    action.confluenceScore = score;
                    action.trancheLevel = Math.min(score, 3);
                    action.targetAllocationPct = action.trancheLevel === 1 ? 33 : (action.trancheLevel === 2 ? 66 : 100);
                }
                actionsByDate[dateStr].push(action);
            }
        }

        return actionsByDate;
    }
}
