import { describe, it, expect } from 'vitest';
import { FiscalFedLiquidityIndicator } from '../../../src/analysis/indicators/FiscalFedLiquidityIndicator.js';

describe('FiscalFedLiquidityIndicator', () => {
    const indicator = new FiscalFedLiquidityIndicator();

    const generateDates = (count) => {
        const dates = [];
        let d = new Date('2026-01-01');
        for (let i = 0; i < count; i++) {
            dates.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 1);
        }
        return dates;
    };

    const dates = generateDates(200);

    const createTimeline = () => {
        return dates.map(d => ({
            date: d,
            macroGroups: {
                NetLiquidity: {
                    TGA: 500000,
                    WALCL: 7000000,
                    RRPONTSYD: 200000
                },
                BankingHealth: {
                    BankReserves: 3000000,
                    EmergencyBorrowing: 1000
                }
            }
        }));
    };

    it('sollte UNKNOWN zurückgeben wenn zu wenig Daten vorliegen', () => {
        const timeline = createTimeline().slice(0, 80);
        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('UNKNOWN');
    });

    it('sollte NORMAL zurückgeben wenn alles flach ist', () => {
        const timeline = createTimeline();
        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('NORMAL');
    });

    it('sollte WARNING (Phase 1) ausgeben wenn TGA um mehr als 150B in 90 Tagen steigt', () => {
        const timeline = createTimeline();
        // TGA steigt in den letzten 90 Tagen
        timeline[timeline.length - 91].macroGroups.NetLiquidity.TGA = 500000;
        timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = 660000; // +160B
        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('WARNING');
        expect(res.message).toContain('Phase 1: TGA +160.0B');
    });

    it('sollte CRITICAL (Phase 3) ausgeben wenn BORROW um mehr als 15B in 28 Tagen steigt', () => {
        const timeline = createTimeline();
        timeline[timeline.length - 29].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
        timeline[timeline.length - 1].macroGroups.BankingHealth.EmergencyBorrowing = 17000; // +16B
        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('CRITICAL');
        expect(res.message).toContain('Phase 3: BORROW +16.0B');
    });

    it('sollte kleine Rettung (Phase 4) ignorieren wenn keine Panik war', () => {
        const timeline = createTimeline();
        // Kleine Rettung +60B
        timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
        timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3060000; 
        
        // TGA Warnung aktiv
        timeline[timeline.length - 91].macroGroups.NetLiquidity.TGA = 500000;
        timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = 660000;

        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('WARNING'); // Rettung ignoriert, TGA Warnung greift (Prio 4)
    });

    it('sollte kleine Rettung (Phase 4) akzeptieren wenn Panik-Gedächtnis aktiv ist', () => {
        const timeline = createTimeline();
        
        // Panik vor ca. 40 Tagen
        const panicStartIdx = timeline.length - 69;
        const panicEndIdx = timeline.length - 40;
        timeline[panicStartIdx].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
        timeline[panicEndIdx].macroGroups.BankingHealth.EmergencyBorrowing = 17000; // +16B -> Panik-Gedächtnis = true
        // Heute wieder flach/normal für Borrow (Panik vorbei)
        timeline[timeline.length - 1].macroGroups.BankingHealth.EmergencyBorrowing = 1000;

        // Kleine Rettung heute (+60B in 56 Tagen)
        timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
        timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3060000;

        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('NORMAL');
        expect(res.message).toContain('Phase 4: WRESBAL +60.0B (Boden nach Panik)');
    });

    it('sollte riesige Rettung (Phase 4) immer akzeptieren (Wunder-Pille)', () => {
        const timeline = createTimeline();
        // Riesige Rettung +160B
        timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
        timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3160000; 
        
        // TGA Warnung aktiv
        timeline[timeline.length - 91].macroGroups.NetLiquidity.TGA = 500000;
        timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = 660000;

        const res = indicator.evaluate(timeline);
        expect(res.status).toBe('NORMAL');
        expect(res.message).toContain('Phase 4: WRESBAL +160.0B (Wunder-Pille)');
    });
    describe('Edge Cases & Nasty Data', () => {
        it('sollte fehlende Daten (null/undefined) sicher ignorieren', () => {
            const timeline = createTimeline();
            // Mach mittendrin Daten kaputt
            timeline[100].macroGroups.BankingHealth.EmergencyBorrowing = null;
            timeline[105].macroGroups = undefined; // komplette gruppe weg
            timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = undefined;
            
            const res = indicator.evaluate(timeline);
            expect(res.status).toBe('UNKNOWN'); // Da aktuelle Werte fehlen
        });

        it('sollte Panik-Gedächtnis nach 60 Tagen exakt vergessen', () => {
            const timeline = createTimeline();
            
            // Panik exakt vor 62 Tagen
            const panicStartIdx = timeline.length - 90;
            const panicEndIdx = timeline.length - 62;
            timeline[panicStartIdx].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
            timeline[panicEndIdx].macroGroups.BankingHealth.EmergencyBorrowing = 17000; 
            
            // Kleine Rettung heute (+60B)
            timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3060000;

            const res = indicator.evaluate(timeline);
            // Panik ist zu alt -> kleine Rettung verpufft -> NORMAL oder WARNING (wenn TGA getriggert wird, hier NORMAL)
            expect(res.status).toBe('NORMAL'); 
            expect(res.message).not.toContain('Boden nach Panik');
        });

        it('sollte bei kollidierenden Phasen strikt die Rettung (Phase 4) priorisieren', () => {
            const timeline = createTimeline();
            
            // 1. TGA warnt (Phase 1)
            timeline[timeline.length - 91].macroGroups.NetLiquidity.TGA = 500000;
            timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = 660000;
            
            // 2. BORROW explodiert (Phase 3)
            timeline[timeline.length - 29].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.EmergencyBorrowing = 17000;

            // 3. WRESBAL rettet gigantisch (Phase 4)
            timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3160000;

            const res = indicator.evaluate(timeline);
            // Phase 4 MUSS Phase 3 und 1 überschreiben
            expect(res.status).toBe('NORMAL');
            expect(res.message).toContain('Phase 4: WRESBAL +160.0B (Wunder-Pille)');
        });

        it('sollte mit unregelmäßigen Datums-Sprüngen (Feiertage/Wochenenden) klarkommen', () => {
            // Wir erzeugen eine Timeline, in der das Datum nicht linear 1 Tag ist, sondern springt
            const nastyDates = [];
            let d = new Date('2026-01-01');
            for (let i = 0; i < 200; i++) {
                nastyDates.push(d.toISOString().split('T')[0]);
                d.setDate(d.getDate() + 3); // Jeder Datensatz ist 3 Tage vom vorherigen entfernt
            }

            const nastyTimeline = nastyDates.map(dateStr => ({
                date: dateStr,
                macroGroups: {
                    NetLiquidity: { TGA: 500000, WALCL: 7000000, RRPONTSYD: 200000 },
                    BankingHealth: { BankReserves: 3000000, EmergencyBorrowing: 1000 }
                }
            }));

            // Panik vor 28 echten Kalendertagen (was in unserem Array ca. 9 Indizes sind)
            nastyTimeline[nastyTimeline.length - 15].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
            nastyTimeline[nastyTimeline.length - 1].macroGroups.BankingHealth.EmergencyBorrowing = 17000;

            const res = indicator.evaluate(nastyTimeline);
            expect(res.status).toBe('CRITICAL');
            expect(res.message).toContain('Phase 3: BORROW +16.0B');
        });

        it('sollte WARNING (Phase 1) ausgeben wenn WRESBAL massiv fällt (Liquiditätsentzug)', () => {
            const timeline = createTimeline();
            timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 2890000; // -110B
            const res = indicator.evaluate(timeline);
            expect(res.status).toBe('WARNING');
            expect(res.message).toContain('Phase 1: WRESBAL -110.0B');
        });

        it('sollte WARNING (Phase 2) ausgeben wenn RRP Liquidität absaugt', () => {
            const timeline = createTimeline();
            timeline[timeline.length - 31].macroGroups.NetLiquidity.RRPONTSYD = 200000;
            timeline[timeline.length - 1].macroGroups.NetLiquidity.RRPONTSYD = 310000; // +110B
            const res = indicator.evaluate(timeline);
            expect(res.status).toBe('WARNING');
            expect(res.message).toContain('Phase 2: RRP +110.0B');
        });

        it('sollte NORMAL (Phase 4) als Stealth QE werten, wenn WALCL steigt', () => {
            const timeline = createTimeline();
            // Erzeuge vorher Warnung, um Priorität zu prüfen
            timeline[timeline.length - 91].macroGroups.NetLiquidity.TGA = 500000;
            timeline[timeline.length - 1].macroGroups.NetLiquidity.TGA = 660000; // Phase 1
            
            // WALCL steigt um > 50B (14 Tage)
            timeline[timeline.length - 15].macroGroups.NetLiquidity.WALCL = 7000000;
            timeline[timeline.length - 1].macroGroups.NetLiquidity.WALCL = 7060000; // +60B

            const res = indicator.evaluate(timeline);
            expect(res.status).toBe('NORMAL');
            expect(res.message).toContain('Phase 4: WALCL +60.0B (Stealth QE)');
        });

        it('sollte Panik auch finden, wenn sie isoliert in der Mitte der 60 Tage passierte und heute abgeflacht ist', () => {
            const timeline = createTimeline();
            
            // Panik-Delta passierte vor exakt 30 Tagen, hielt aber nur 1 Tag an
            const panicStartIdx = timeline.length - 58;
            const panicEndIdx = timeline.length - 30;
            
            timeline[panicStartIdx].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
            timeline[panicEndIdx].macroGroups.BankingHealth.EmergencyBorrowing = 17000; // Delta > 15B
            
            // Unmittelbar danach fällt es wieder flach auf 1000
            timeline[panicEndIdx + 1].macroGroups.BankingHealth.EmergencyBorrowing = 1000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.EmergencyBorrowing = 1000;

            // Kleine Rettung heute (+60B)
            timeline[timeline.length - 57].macroGroups.BankingHealth.BankReserves = 3000000;
            timeline[timeline.length - 1].macroGroups.BankingHealth.BankReserves = 3060000;

            // Der Indikator muss das Delta zwischen (Tag - 58) und (Tag - 30) finden und das Gedächtnis aktivieren!
            const res = indicator.evaluate(timeline);
            expect(res.status).toBe('NORMAL');
            expect(res.message).toContain('Boden nach Panik');
        });
    });
});
