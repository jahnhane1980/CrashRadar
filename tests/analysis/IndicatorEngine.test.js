import { describe, it, expect, beforeEach } from 'vitest';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';

describe('IndicatorEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new IndicatorEngine();
  });

  // Helper für dynamische Timelines
  const generateTimeline = (length, overrides = {}) => {
    return Array(length).fill(0).map((_, i) => ({
      date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
      assets: {
        VIX: 20,
        HYG: 100,
        Gold: 2000,
        ...overrides.assets
      },
      macroGroups: {
        BankingHealth: { TotalReserves: 3200 },
        Leading: { MaturityWallPct: 10, SahmRule: 0.1 },
        NetLiquidity: { TGA: 500 },
        YieldCurve: { Spread10y2y: 0.5 },
        FinancialConditions: { ChicagoFedIndex: -0.5, RealYield10y: 1.5 },
        ...overrides.macroGroups
      }
    }));
  };

  it('sollte Frühindikatoren korrekt evaluieren (Happy Path)', () => {
    const timeline = generateTimeline(60);
    const results = engine.indicators.map(ind => ({ name: ind.name, result: ind.evaluate(timeline) }));
    
    // Check TOTRESNS (Happy Path)
    const totresns = results.find(r => r.name.includes('TOTRESNS')).result;
    expect(totresns.status).toBe('OK');
  });

  it('sollte Grenzfälle: Zu kurze Timeline abfangen (Edge Case)', () => {
    const shortTimeline = generateTimeline(10); // Nur 10 Tage Daten
    
    const tga = engine.indicators.find(i => i.name.includes('TGA')).evaluate(shortTimeline);
    expect(tga.status).toBe('UNKNOWN');
    expect(tga.message).toContain('Zu wenig Daten');
    
    const rateShock = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(shortTimeline);
    expect(rateShock.status).toBe('UNKNOWN');
  });

  it('sollte fehlende Daten (null) sicher abfangen (Ausfall)', () => {
    const timeline = generateTimeline(35, {
      macroGroups: { YieldCurve: { Spread10y2y: null } }
    });
    
    const yieldCurve = engine.indicators.find(i => i.name.includes('Yield Curve')).evaluate(timeline);
    expect(yieldCurve.status).toBe('UNKNOWN');
  });

  it('sollte CRITICAL bei UN-INVERTING Yield Curve triggern (Signal)', () => {
    const timeline = generateTimeline(35);
    // Vor 30 Tagen (Index 5 bei length 35): negativ
    timeline[5].macroGroups.YieldCurve = { Spread10y2y: -0.5 };
    // Heute (Index 34): positiv
    timeline[34].macroGroups.YieldCurve = { Spread10y2y: 0.1 };  
    
    const yc = engine.indicators.find(i => i.name.includes('Yield Curve')).evaluate(timeline);
    expect(yc.status).toBe('CRITICAL');
  });

  it('sollte CRITICAL bei VIX Spike & Crush triggern (Signal)', () => {
    const timeline = generateTimeline(35);
    timeline[25].assets.VIX = 45;
    timeline[34].assets.VIX = 30;
    const vix = engine.indicators.find(i => i.name.includes('VIX')).evaluate(timeline);
    expect(vix.status).toBe('CRITICAL');
  });

  it('sollte WARNING bei leichtem VIX Crush triggern', () => {
    const timeline = generateTimeline(35);
    timeline[25].assets.VIX = 38; // Spike >= 35
    timeline[34].assets.VIX = 30; // Crush < 38 * 0.85 = 32.3
    const vix = engine.indicators.find(i => i.name.includes('VIX')).evaluate(timeline);
    expect(vix.status).toBe('WARNING');
  });

  it('sollte WARNING bei hohem VIX ohne Crush triggern', () => {
    const timeline = generateTimeline(35);
    timeline[25].assets.VIX = 38;
    timeline[34].assets.VIX = 38; // Kein Crush
    const vix = engine.indicators.find(i => i.name.includes('VIX')).evaluate(timeline);
    expect(vix.status).toBe('WARNING');
  });

  it('sollte CRITICAL bei starkem Gold Breakout triggern', () => {
    const timeline = generateTimeline(55);
    timeline[54].assets.Gold = 2100; // > SMA 2000 * 1.02
    const gold = engine.indicators.find(i => i.name.includes('Gold')).evaluate(timeline);
    expect(gold.status).toBe('CRITICAL');
  });

  it('sollte WARNING bei leichtem Gold Breakout triggern', () => {
    const timeline = generateTimeline(55);
    timeline[54].assets.Gold = 2010; // > SMA 2000 aber < 2040
    const gold = engine.indicators.find(i => i.name.includes('Gold')).evaluate(timeline);
    expect(gold.status).toBe('WARNING');
  });

  it('sollte CRITICAL bei starkem Rate Shock triggern', () => {
    const timeline = generateTimeline(65);
    timeline[5].macroGroups.FinancialConditions.RealYield10y = 1.0;
    timeline[64].macroGroups.FinancialConditions.RealYield10y = 1.6; // diff = 0.6 >= 0.5
    const rate = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(timeline);
    expect(rate.status).toBe('CRITICAL');
  });

  it('sollte WARNING bei leichtem Rate Shock triggern', () => {
    const timeline = generateTimeline(65);
    timeline[5].macroGroups.FinancialConditions.RealYield10y = 1.0;
    timeline[64].macroGroups.FinancialConditions.RealYield10y = 1.4; // diff = 0.4 >= 0.3
    const rate = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(timeline);
    expect(rate.status).toBe('WARNING');
  });

  it('sollte CRITICAL bei extremem HYG Drop triggern', () => {
    const timeline = generateTimeline(35);
    timeline[5].assets.HYG = 100;
    timeline[34].assets.HYG = 96; // perf = -4% <= -3.0%
    const hyg = engine.indicators.find(i => i.name.includes('HYG')).evaluate(timeline);
    expect(hyg.status).toBe('CRITICAL');
  });

  it('sollte WARNING bei leichtem HYG Drop triggern', () => {
    const timeline = generateTimeline(35);
    timeline[5].assets.HYG = 100;
    timeline[34].assets.HYG = 98; // perf = -2% <= -1.5%
    const hyg = engine.indicators.find(i => i.name.includes('HYG')).evaluate(timeline);
    expect(hyg.status).toBe('WARNING');
  });

  it('sollte run() ohne Absturz für die CLI ausführen (Terminal Output)', () => {
    const timeline = generateTimeline(35);
    const originalLog = console.log;
    let output = '';
    console.log = (msg) => { output += msg + '\n'; };
    
    expect(() => engine.run(timeline)).not.toThrow();
    
    console.log = originalLog;
    expect(output).toContain('MAKRO-FINANZ ANALYSE');
    expect(output).toContain('FRÜHINDIKATOREN');
  });

  it('sollte einen Fehler werfen, wenn run() leere Daten erhält', () => {
    expect(() => engine.run([])).toThrow(/Keine Daten für die Analyse/);
    expect(() => engine.run(null)).toThrow(/Keine Daten für die Analyse/);
  });
});
