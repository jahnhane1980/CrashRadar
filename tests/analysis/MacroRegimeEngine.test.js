import { describe, it, expect, beforeEach } from 'vitest';
import { MacroRegimeEngine } from '../../src/analysis/MacroRegimeEngine.js';

describe('MacroRegimeEngine - Chaos & Edge Case Testing', () => {
    let engine;

    beforeEach(() => {
        engine = new MacroRegimeEngine();
    });

    /**
     * Helferfunktion: Generiert gigantische, synthetische Marktphasen
     * passend zum exakten Schema der existierenden Topf-A Indikatoren.
     */
    const createHugeChaosData = (daysCount) => {
        const data = {};
        let currentSpy = 400;
        let currentVix = 15;
        let marginDebt = 800000;

        for(let i=0; i<daysCount; i++) {
            const date = new Date(2020, 0, 1);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Random Walk
            currentSpy = currentSpy * (1 + (Math.random() - 0.49) * 0.02);
            currentVix = Math.max(10, currentVix + (Math.random() - 0.5) * 5);
            marginDebt = marginDebt * (1 + (Math.random() - 0.48) * 0.01);

            data[dateStr] = {
                macroGroups: {
                    YieldCurve: {
                        Spread10y2y: 0.15 + Math.random() * 0.05
                    },
                    NetLiquidity: {
                        TGA: 700 + Math.random() * 100
                    },
                    Leading: {
                        MarginDebt: marginDebt,
                        MaturityWallPct: 0.10 + Math.random() * 0.05
                    },
                    BankingHealth: {
                        TotalReserves: 3000 + Math.random() * 500
                    },
                    FinancialConditions: {
                        ChicagoFedIndex: -0.5 + Math.random() * 0.2
                    }
                },
                assets: {
                    VIX: currentVix,
                    SKEW: 130 + Math.random() * 10,
                    SPY_Volume: 50000000 + Math.random() * 1000000,
                    SPY: currentSpy
                },
                SPY_ShortVolumeRatio: 0.50 + Math.random() * 0.1,
                TotalPCR: 0.90 + Math.random() * 0.2
            };
        }
        return data;
    };

    describe('1. Happy Path & Performance', () => {
        it('sollte riesige Datenmengen (10 Jahre) fehlerfrei und performant auswerten', () => {
            const data = createHugeChaosData(3650); 
            
            const start = performance.now();
            const states = engine.evaluate(data);
            const end = performance.now();

            expect(states).toBeDefined();
            expect(Object.keys(states).length).toBe(3650); 
            
            const firstState = states[Object.keys(states)[0]];
            expect(firstState).toHaveProperty('regime');
            expect(firstState).toHaveProperty('liquidityStatus');
            expect(firstState).toHaveProperty('vetos');
            expect(Array.isArray(firstState.vetos)).toBe(true);
            
            expect(end - start).toBeLessThan(1500); 
        });
    });

    describe('2. Extreme Edge Cases & Absturzsicherung', () => {
        it('sollte leere Inputs überleben und sichere Fallbacks generieren', () => {
            expect(() => engine.evaluate({})).not.toThrow();
            expect(engine.evaluate({})).toEqual({});
            
            expect(() => engine.evaluate(null)).not.toThrow();
            expect(engine.evaluate(null)).toEqual({});
        });

        it('sollte Struktur-Chaos (komplett fehlende API-Sektionen) überleben', () => {
            const data = createHugeChaosData(50);
            
            // Zerstörung der Datenstruktur
            delete data[Object.keys(data)[15]].assets;
            delete data[Object.keys(data)[20]].macroGroups;

            let states;
            expect(() => { states = engine.evaluate(data); }).not.toThrow();
            expect(states[Object.keys(data)[20]].regime).toBe('UNKNOWN');
        });
    });

    describe('3. Fachliche Worst-Case-Szenarien & Makro-Regeln (Laut Docs)', () => {
        it('FLASH_CRASH: Sollte VIX-Spike und raschen SPY-Absturz erkennen', () => {
            const data = createHugeChaosData(80);
            const crashDate = Object.keys(data)[79];
            
            // MarketPanicCapitulationIndicator erwartet VIX >= 28 und hohes Volumen (>1.25x avg)
            data[crashDate].assets.VIX = 55.0; 
            data[crashDate].assets.SPY_Volume = 200000000; // Sehr hoch im Vergleich zum Schnitt

            const states = engine.evaluate(data);
            expect(states[crashDate].regime).toBe('FLASH_CRASH');
            expect(states[crashDate].vetos).toContain('VIX_SPIKE_PANIC');
        });

        it('BEAR_MARKET: Sollte blutende Märkte erkennen (Deleveraging / Margin Debt Drop)', () => {
            const data = createHugeChaosData(250);
            
            // MarginDebtIndicator prüft oft Drawdowns über Monate (z.B. 180 Tage)
            let margin = 800000;
            for(let i=50; i<250; i++) {
                margin *= 0.99; // Stetiger Abbau
                data[Object.keys(data)[i]].macroGroups.Leading.MarginDebt = margin;
            }

            const states = engine.evaluate(data);
            const lastState = states[Object.keys(data)[249]];
            
            // MarginDebtIndicator sollte WARNING oder CRITICAL werfen -> DELEVERAGING_ONGOING
            expect(lastState.vetos).toContain('DELEVERAGING_ONGOING');
        });

        it('YIELD_CURVE_UNINVERTING: Sollte den Crash-Trigger werfen, wenn Zinskurve nach Invertierung steil wird', () => {
            const data = createHugeChaosData(80);
            
            // Vor 30 Tagen Invers (< 0)
            for(let i=0; i<=50; i++) {
                data[Object.keys(data)[i]].macroGroups.YieldCurve.Spread10y2y = -0.50; 
            }
            // Aktuell (Un-inverting)
            for(let i=51; i<80; i++) {
                data[Object.keys(data)[i]].macroGroups.YieldCurve.Spread10y2y = +0.10; 
            }

            const states = engine.evaluate(data);
            const panicState = states[Object.keys(data)[79]];
            
            expect(panicState.vetos).toContain('YIELD_CURVE_PANIC');
        });

        it('STEALTH_STIMULUS: Sollte erkennen, wenn das TGA massiv fällt (Yellen pumpt Liquidität)', () => {
            const data = createHugeChaosData(80);
            const pumpDate = Object.keys(data)[79];
            
            // TGA fällt massiv von Tag 49 zu Tag 79 (30 Tage Fenster)
            data[Object.keys(data)[49]].macroGroups.NetLiquidity.TGA = 800;
            data[pumpDate].macroGroups.NetLiquidity.TGA = 400;

            const states = engine.evaluate(data);
            expect(states[pumpDate].liquidityStatus).toBe('STIMULUS_ACTIVE');
        });

        it('LATE_CYCLE_EUPHORIA: Sollte Melt-Up erkennen (SKEW > 145, Short < 0.45, PCR < 0.75)', () => {
            const data = createHugeChaosData(80);
            const euphoricDate = Object.keys(data)[79];

            data[euphoricDate].assets.SKEW = 150.0;
            data[euphoricDate].SPY_ShortVolumeRatio = 0.40;
            data[euphoricDate].TotalPCR = 0.70;

            const states = engine.evaluate(data);
            expect(states[euphoricDate].regime).toBe('LATE_CYCLE_EUPHORIA');
        });
    });
});
