import { describe, it, expect, beforeEach } from 'vitest';
import { TradeSetupEngine } from '../../src/analysis/TradeSetupEngine.js';

describe('TradeSetupEngine - Asset Execution & Macro Blocking', () => {
    let engine;

    beforeEach(() => {
        engine = new TradeSetupEngine();
    });

    /**
     * Helferfunktion für Synthetische Topf-B Chaos Daten
     */
    const createChaosData = (daysCount) => {
        const data = {};
        for(let i=0; i<daysCount; i++) {
            const date = new Date(2026, 0, 1);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            data[dateStr] = {
                date: dateStr,
                assets: {
                    Gold: 2000 + Math.random() * 100,
                    GDX: 30 + Math.random() * 5,
                    GDX_Volume: 20000000 + Math.random() * 1000000,
                    BTC: 60000 + Math.random() * 2000,
                    BTC_Volume: 1000 + Math.random() * 100,
                    MSTR: 500 + Math.random() * 50,
                    MSTR_Volume: 5000000,
                    COIN: 150 + Math.random() * 10,
                    COIN_Volume: 2000000,
                    SMH: 200 + Math.random() * 10,
                    IGV: 400 + Math.random() * 20
                },
                mlRegimeBtc: 'ACCUMULATION',
                mlRegimeCrypto: 'NEUTRAL'
            };
        }
        return data;
    };

    describe('1. Happy Path: Orchestrierung von Topf B', () => {
        it('sollte Signale generieren, wenn MacroState NORMAL ist', () => {
            const data = createChaosData(60);
            
            // Simuliere einen Krypto-Portfolio-Exit Fall (MSTR und COIN crashen unter SMA50 bei hohem Volumen)
            const targetDateStr = Object.keys(data)[59];
            
            // Um SMA50 zu unterbieten, crashen wir die Preise extrem ab Tag 58
            data[Object.keys(data)[58]].assets.MSTR = 100;
            data[Object.keys(data)[58]].assets.COIN = 50;
            data[targetDateStr].assets.MSTR = 90;
            data[targetDateStr].assets.COIN = 40;
            data[targetDateStr].assets.MSTR_Volume = 50000000; // 10x Volumen
            data[targetDateStr].assets.COIN_Volume = 20000000; // 10x Volumen
            
            // Wetterfrosch liefert harmloses Regime
            const macroStates = {
                [targetDateStr]: { regime: 'NORMAL', liquidityStatus: 'NORMAL', vetos: [] }
            };

            const actions = engine.evaluate(data, macroStates);
            const lastActions = actions[targetDateStr];
            
            expect(lastActions).toBeDefined();
            expect(Array.isArray(lastActions)).toBe(true);
            
            // Erwartung: Ein Signal für Krypto Portfolio-Exit
            const exitSignal = lastActions.find(a => a.indicator === 'Krypto Portfolio-Exit (MSTR/COIN)');
            expect(exitSignal).toBeDefined();
            expect(exitSignal.blocked).toBe(false); // Nicht blockiert im normalen Makro-Regime
        });
    });

    describe('2. Macro-Regime Blocking (Der Execution-Planer)', () => {
        it('FLASH_CRASH: Sollte Kapitulations-Käufe (GDX) erlauben', () => {
            const data = createChaosData(60);
            const crashDate = Object.keys(data)[59];
            
            // Simuliere GDX Selling Climax (Boden-Suche) -> GDX crasht, Volumen explodiert
            data[crashDate].assets.GDX = 15; // Massiver Drop
            data[crashDate].assets.GDX_Volume = 100000000; // 5x Durchschnitt
            
            // Macro-Wetterfrosch sagt: FLASH_CRASH!
            const macroStates = {
                [crashDate]: { regime: 'FLASH_CRASH', vetos: ['VIX_SPIKE_PANIC'] }
            };

            const actions = engine.evaluate(data, macroStates);
            const crashActions = actions[crashDate];
            
            // Das GDX Kaufsignal muss durchkommen, da Kapitulation in Flash-Crashes erlaubt ist
            const gdxAction = crashActions.find(a => a.indicator === '[INVEST] GDX Selling Climax (Boden-Suche)');
            expect(gdxAction).toBeDefined();
            expect(gdxAction.blocked).toBe(false); // Bottom-Fishing in Panik ist ok!
        });

        it('BEAR_MARKET: Sollte DELEVERAGING_ONGOING Vetos respektieren und riskante Setups blockieren/warnen', () => {
            const data = createChaosData(60);
            const bearDate = Object.keys(data)[59];
            
            // Wir erzeugen ein Tech-Zyklus Kaufsignal (SMH stark, IGV schwach)
            data[bearDate].assets.SMH = 250;
            data[bearDate].assets.IGV = 350;

            const macroStates = {
                [bearDate]: { regime: 'BEAR_MARKET', vetos: ['DELEVERAGING_ONGOING'] }
            };

            const actions = engine.evaluate(data, macroStates);
            const bearActions = actions[bearDate];
            
            expect(bearActions).toBeDefined();
            
            // Jedes generierte Signal muss das Makro-Regime anhängen
            expect(bearActions.every(a => a.macroRegime === 'BEAR_MARKET')).toBe(true);
            
            // Wenn der Tech-Zyklus triggert, sollte er idealerweise blockiert sein
            const techAction = bearActions.find(a => a.indicator === 'Tech-Zyklus Radar (SMH vs IGV)');
            if (techAction) {
                expect(techAction.blocked).toBe(true); // Im Bärenmarkt keine Tech-Breakouts kaufen!
            }
        });
    });
    
    describe('3. Edge Cases & API-Stabilität', () => {
        it('sollte fehlende MacroStates ignorieren (Fallback auf NORMAL)', () => {
            const data = createChaosData(10);
            let actions;
            expect(() => { actions = engine.evaluate(data, null); }).not.toThrow();
            expect(actions).toBeDefined();
            expect(actions[Object.keys(data)[9]]).toBeDefined();
        });

        it('sollte bei kaputten Assets nicht abstürzen', () => {
            const data = createChaosData(20);
            delete data[Object.keys(data)[19]].assets;
            
            expect(() => { engine.evaluate(data, {}); }).not.toThrow();
        });
    });
});
