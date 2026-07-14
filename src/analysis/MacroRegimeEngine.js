import { SmartDumbMoneyTopIndicator } from './indicators/SmartDumbMoneyTopIndicator.js';
import { FiscalFedLiquidityIndicator } from './indicators/FiscalFedLiquidityIndicator.js';
import { SmartDumbMoneyBottomIndicator } from './indicators/SmartDumbMoneyBottomIndicator.js';
import { YieldCurveIndicator } from './indicators/YieldCurveIndicator.js';
import { RedAlertIndicator } from './indicators/RedAlertIndicator.js';
import { MarginDebtIndicator } from './indicators/MarginDebtIndicator.js';
import { TgaIndicator } from './indicators/TgaIndicator.js';
import { MarketPanicCapitulationIndicator } from './indicators/MarketPanicCapitulationIndicator.js';
import { BankReservesIndicator } from './indicators/BankReservesIndicator.js';
import { MaturityWallIndicator } from './indicators/MaturityWallIndicator.js';
import { NfciIndicator } from './indicators/NfciIndicator.js';
import { ChallengerIndicator } from './indicators/ChallengerIndicator.js';
import { StealthExitIndicator } from './indicators/StealthExitIndicator.js';
import LaborMarketDivergenceIndicator from './indicators/LaborMarketDivergenceIndicator.js';

export class MacroRegimeEngine {
    constructor() {
        // Wir orchestrieren ausschließlich bestehende Indikatoren aus Topf A
        this.indicators = [
            new SmartDumbMoneyTopIndicator(),
            new SmartDumbMoneyBottomIndicator(),
            new YieldCurveIndicator(),
            new RedAlertIndicator(),
            new MarginDebtIndicator(),
            new TgaIndicator(),
            new MarketPanicCapitulationIndicator(),
            new BankReservesIndicator(),
            new MaturityWallIndicator(),
            new NfciIndicator(),
            new ChallengerIndicator(),
            new FiscalFedLiquidityIndicator(),
            new StealthExitIndicator(),
            new LaborMarketDivergenceIndicator()
        ];
    }

    evaluate(groupedData) {
        if (!groupedData || typeof groupedData !== 'object' || Object.keys(groupedData).length === 0) {
            return {};
        }
        
        const states = {};
        const dates = Object.keys(groupedData).sort();
        const timeline = [];

        for (let i = 0; i < dates.length; i++) {
            const dateStr = dates[i];
            const currentDay = groupedData[dateStr];
            timeline.push(currentDay);

            // Fallback für Struktur-Chaos
            if (!currentDay || !currentDay.assets || !currentDay.macroGroups) {
                states[dateStr] = {
                    regime: 'UNKNOWN',
                    liquidityStatus: 'UNKNOWN',
                    vetos: [],
                    indicatorDetails: []
                };
                continue;
            }

            let regime = 'NORMAL';
            let liquidityStatus = 'NORMAL';
            let vetos = [];
            let indicatorDetails = [];

            // Alle Indikatoren ausführen
            for (const indicator of this.indicators) {
                const result = indicator.evaluate(timeline);
                
                indicatorDetails.push({
                    name: indicator.name,
                    status: (result && result.status) ? result.status : 'UNKNOWN'
                });

                if (!result || result.status === 'UNKNOWN') continue;

                // 1. Flash Crash & Panik
                if (indicator.name === 'Market Panic & Capitulation (VIX + Volume)' && result.status === 'CRITICAL') {
                    regime = 'FLASH_CRASH';
                    vetos.push('VIX_SPIKE_PANIC');
                }
                
                // 2. Melt-Up Euphorie (Red Alert)
                if (indicator.name === 'Red Alert (Bullenmarkt-Stirbt-Signal)' && result.status === 'CRITICAL') {
                    // Falls nicht schon FLASH_CRASH gesetzt ist
                    if (regime !== 'FLASH_CRASH') {
                        regime = 'LATE_CYCLE_EUPHORIA';
                    }
                }

                // 2.1 Smart vs Dumb Money (Top/Bottom)
                if (indicator.name === 'Smart vs Dumb Money (The Top)' && result.status === 'CRITICAL') {
                    if (regime !== 'FLASH_CRASH') {
                        regime = 'LATE_CYCLE_EUPHORIA';
                    }
                }
                // 2.1.1 Stealth Exit (DIX Dark Pool Divergenz)
                if (indicator.name === 'Stealth Exit (DIX Dark Pool Divergenz)' && result.status === 'CRITICAL') {
                    if (regime !== 'FLASH_CRASH') {
                        regime = 'LATE_CYCLE_EUPHORIA';
                    }
                    vetos.push('STEALTH_EXIT_ACTIVE');
                }
                if (indicator.name === 'Smart vs Dumb Money (The Bottom)' && result.status === 'CRITICAL') {
                    regime = 'FLASH_CRASH';
                    vetos.push('SMART_MONEY_ACCUMULATION');
                }

                // 3. Deleveraging & Bear Market Warnung (Margin Debt)
                if (indicator.name === 'Margin Debt (Gier & Hebel)' && (result.status === 'WARNING' || result.status === 'CRITICAL')) {
                    vetos.push('DELEVERAGING_ONGOING');
                    // Wenn kein Flash Crash oder Melt-Up aktiv, stufen wir als Bear Market ein
                    if (regime === 'NORMAL') {
                        regime = 'BEAR_MARKET';
                    }
                }

                // 4. Yield Curve Panic (Un-Inverting)
                if (indicator.name === 'Yield Curve (T10Y2Y)' && result.status === 'CRITICAL') {
                    vetos.push('YIELD_CURVE_PANIC');
                }

                // 5. Stealth Stimulus (TGA)
                if (indicator.name === 'Treasury General Account (TGA)' && result.message && result.message.includes('Stealth-Stimulus')) {
                    liquidityStatus = 'STIMULUS_ACTIVE';
                }
                
                // Weitere Vetos aus Topf A (z.B. Bank Reserves, NFCI, etc.)
                if (indicator.name === 'Bank Reserves' && result.status === 'CRITICAL') {
                    vetos.push('BANK_RESERVES_CRITICAL');
                }
                if (indicator.name === 'Maturity Wall' && result.status === 'CRITICAL') {
                    vetos.push('MATURITY_WALL_CRITICAL');
                }
                if (indicator.name === 'Chicago Fed Stress Index (NFCI)' && result.status === 'CRITICAL') {
                    vetos.push('NFCI_STRESS_PANIC');
                }
                if (indicator.name === 'Challenger Job Cuts (Entlassungswelle)' && result.status === 'CRITICAL') {
                    vetos.push('CHALLENGER_CRITICAL_LAYOFFS');
                    if (regime === 'NORMAL') {
                        regime = 'BEAR_MARKET';
                    }
                }
                
                // 6. Labor Market Divergence (Qualitativ & Quantitativ)
                if (indicator.name === 'LaborMarketDivergenceIndicator') {
                    if (result.status === 'COINCIDENT_ALERT') {
                        vetos.push('LABOR_MARKET_CRASH_WARNING');
                        if (regime !== 'FLASH_CRASH') {
                            regime = 'BEAR_MARKET';
                        }
                    } else if (result.status === 'LEADING_WARNING') {
                        vetos.push('LABOR_MARKET_QUALITY_WARNING');
                        if (regime === 'NORMAL') {
                            regime = 'LATE_CYCLE_EUPHORIA';
                        }
                    }
                }
            }

            states[dateStr] = {
                regime,
                liquidityStatus,
                vetos,
                indicatorDetails
            };
        }

        return states;
    }
}
