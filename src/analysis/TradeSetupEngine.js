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

export class TradeSetupEngine {
    constructor(getCycleConfig) {
        const safeConfig = getCycleConfig || (() => ({ MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21' } }));
        // Orchestrierung der Topf-B Indikatoren (Asset-Setups & Signale)
        this.indicators = [
            new GoldVolumeClimaxIndicator(),
            new GoldCapitulationIndicator(),
            new GdxSellingClimaxIndicator(),
            new GdxBuyingClimaxIndicator(),
            new GdxGoldDivergenceIndicator(),
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

    evaluate(groupedData, macroStates) {
        if (!groupedData || typeof groupedData !== 'object' || Object.keys(groupedData).length === 0) {
            return {};
        }

        const actionsByDate = {};
        const dates = Object.keys(groupedData).sort();
        const timeline = [];

        for (let i = 0; i < dates.length; i++) {
            const dateStr = dates[i];
            const currentDay = groupedData[dateStr];
            timeline.push(currentDay);

            actionsByDate[dateStr] = [];

            // Fallback: Keine gültigen Daten für diesen Tag
            if (!currentDay || !currentDay.assets) {
                continue;
            }

            // Makro-Regime vom "Wetterfrosch" holen (Fallback auf NORMAL)
            const macroState = macroStates && macroStates[dateStr] ? macroStates[dateStr] : { regime: 'NORMAL', vetos: [], liquidityStatus: 'NORMAL' };
            const regime = macroState.regime;
            const vetos = macroState.vetos || [];

            for (const indicator of this.indicators) {
                const result = indicator.evaluate(timeline);
                
                // Wir filtern UNKNOWN und uninteressante (OK) Signale heraus,
                // ES SEI DENN wir wollen auch "OK" tracken. Wir konzentrieren uns auf Actions (WARNING/CRITICAL).
                if (!result || result.status === 'UNKNOWN' || result.status === 'OK') {
                    continue;
                }

                // Generiere ein TradeAction-Objekt
                const action = {
                    indicator: indicator.name,
                    category: indicator.category,
                    status: result.status,
                    message: result.message,
                    macroRegime: regime,
                    blocked: false,
                    blockReason: null
                };

                // --- EXECUTION BLOCKING LOGIC ---
                // Hier entscheidet die Engine, ob ein Signal durch das Makro-Wetter blockiert wird

                if (regime === 'FLASH_CRASH') {
                    // In einem Flash Crash verbieten wir Breakouts und reguläre Long-Setups.
                    // Nur Capitulation / Selling Climax Indikatoren dürfen durch!
                    const isCapitulation = indicator.name.includes('Capitulation') || indicator.name.includes('Selling Climax');
                    
                    if (!isCapitulation) {
                        action.blocked = true;
                        action.blockReason = 'FLASH_CRASH_BLOCKS_RISK_ON';
                    }
                } 
                else if (regime === 'BEAR_MARKET') {
                    // Im Bärenmarkt verbieten wir riskante Tech-Longs
                    if (indicator.name === 'Tech-Zyklus Radar (SMH vs IGV)') {
                        action.blocked = true;
                        action.blockReason = 'BEAR_MARKET_BLOCKS_TECH_BREAKOUT';
                    }
                    // Vetos könnten auch Skalierungen erzwingen (z.B. halbe Positionsgröße)
                    if (vetos.includes('DELEVERAGING_ONGOING')) {
                        action.scaleDown = true; // Empfehlung für Positionsgröße
                    }
                }
                else if (regime === 'LATE_CYCLE_EUPHORIA') {
                    // In der Euphorie blockieren wir späte Einstiege
                    const isBuyingClimax = indicator.name.includes('Buying Climax');
                    if (!isBuyingClimax) {
                        // TODO: Je nach Strategie blockieren
                    }
                }

                actionsByDate[dateStr].push(action);
            }
        }

        return actionsByDate;
    }
}
