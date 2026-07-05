export class GoldGDXEngine {
    constructor(config = {}) {
        this.entryTranches = config.entryTranches || 3;
        this.exitTranches = config.exitTranches || 3;
        
        // State
        this.goldPosition = 0;
        this.gdxPosition = 0;
        
        this.goldEntries = 0;
        this.gdxEntries = 0;
        this.goldExits = 0;
        this.gdxExits = 0;
        
        // Signals
        this.signals = [];
    }

    detectCrashRegime(dataContext) {
        // VIX > 45 oder extrem schneller SPY-Absturz -> Flash Crash
        if (dataContext.vix > 45 || dataContext.spyRoc20d < -15) {
            return 'FLASH_CRASH';
        } 
        // VIX moderat, aber SPY sinkt und Margin Debt wird abgebaut -> Bärenmarkt
        else if (dataContext.spyRoc20d < -5 && dataContext.marginDebtDropping) {
            return 'BEAR_MARKET';
        }
        return 'NORMAL';
    }

    processDay(dataContext) {
        let actions = [];
        const regime = this.detectCrashRegime(dataContext);

        // --- ENTRY LOGIC ---
        const gdxSellingClimax = (dataContext.gdxVolume > (dataContext.gdxVolumeSma50 * 3)) && (dataContext.gdxDailyReturn <= -5);
        
        // Gold Entry: z.B. wenn Gold aufhört zu fallen und über seinen kurzen Durchschnitt dreht
        const goldTurningUp = dataContext.goldPrice > dataContext.goldSma20;

        if (regime === 'FLASH_CRASH') {
            // Im Flash Crash warten wir auf die brutale GDX Kapitulation
            if (gdxSellingClimax && this.gdxEntries < this.entryTranches) {
                this.gdxEntries++;
                this.gdxPosition += (100 / this.entryTranches);
                actions.push({ type: 'ENTRY_GDX', tranche: this.gdxEntries, reason: 'Selling Climax (Flash Crash)', price: dataContext.gdxPrice });
                
                // Gold folgt dem GDX-Panik-Boden leicht verzögert oder direkt
                if (this.goldEntries < this.entryTranches) {
                    this.goldEntries++;
                    this.goldPosition += (100 / this.entryTranches);
                    actions.push({ type: 'ENTRY_GOLD', tranche: this.goldEntries, reason: 'GDX Capitulation Lead', price: dataContext.goldPrice });
                }
            }
        } else if (regime === 'BEAR_MARKET') {
            // Im blutenden Bärenmarkt führt Gold. Wir kaufen Gold, sobald es Stärke zeigt.
            if (goldTurningUp && this.goldEntries < this.entryTranches) {
                this.goldEntries++;
                this.goldPosition += (100 / this.entryTranches);
                actions.push({ type: 'ENTRY_GOLD', tranche: this.goldEntries, reason: 'Gold Stärke (Bärenmarkt-Hafen)', price: dataContext.goldPrice });
                
                // GDX wird erst nachgekauft, wenn Gold bereits etabliert ist oder GDX später nachzieht
                if (gdxSellingClimax && this.gdxEntries < this.entryTranches) {
                    this.gdxEntries++;
                    this.gdxPosition += (100 / this.entryTranches);
                    actions.push({ type: 'ENTRY_GDX', tranche: this.gdxEntries, reason: 'Verspäteter GDX Boden', price: dataContext.gdxPrice });
                }
            }
        } else {
            // NORMAL Bull Market Entry Logic (z.B. Pullbacks kaufen)
        }

        // --- EXIT LOGIC ---
        // Tranche 1: Euphoria / FOMO (Buying Climax)
        const gdxBuyingClimax = (dataContext.gdxVolume > (dataContext.gdxVolumeSma50 * 3)) && (dataContext.gdxDailyReturn >= 5);
        if (gdxBuyingClimax && this.gdxPosition > 0 && this.gdxExits === 0) {
            this.gdxExits++;
            this.goldExits++;
            actions.push({ type: 'EXIT_TRANCHE_1', reason: 'Buying Climax / FOMO', gdxPrice: dataContext.gdxPrice, goldPrice: dataContext.goldPrice });
        }

        // Tranche 2: Smart Money Exit / Divergence
        const goldNewHigh = dataContext.goldPrice >= dataContext.goldHighest30d;
        const gdxDiverging = (dataContext.daysSinceGdxHigh30 > 10) && (dataContext.gdxDrawdownFrom30dHigh <= -3);
        
        if (goldNewHigh && gdxDiverging && this.gdxExits === 1) {
            this.gdxExits++;
            this.goldExits++;
            actions.push({ type: 'EXIT_TRANCHE_2', reason: 'GDX/Gold Divergence', gdxPrice: dataContext.gdxPrice, goldPrice: dataContext.goldPrice });
        }

        // Tranche 3: Macro Shock & Catastrophe Stop
        const goldBreaksSma50 = dataContext.goldPrice < dataContext.goldSma50;
        const rocCollapse = dataContext.goldRoc20d <= -15;
        const dxySpike = dataContext.dxyRoc20d > 1.01;
        const realRateSpike = dataContext.realRateRoc20d > 0.29;
        const marginDebtDrop = dataContext.marginDebtDropping;

        const macroShock = dxySpike || realRateSpike || marginDebtDrop;
        const technicalBreak = goldBreaksSma50 || rocCollapse;

        if (technicalBreak && macroShock && this.gdxExits < 3 && this.gdxPosition > 0) {
            this.gdxExits++;
            this.goldExits++;
            actions.push({ type: 'EXIT_TRANCHE_3', reason: 'Macro Shock + Tech Break', gdxPrice: dataContext.gdxPrice, goldPrice: dataContext.goldPrice });
        }

        if (actions.length > 0) {
            this.signals.push({ date: dataContext.date, regime, actions });
        }

        return {
            date: dataContext.date,
            regime: regime,
            actions: actions,
            positions: {
                gold: this.goldPosition,
                gdx: this.gdxPosition
            }
        };
    }
}
