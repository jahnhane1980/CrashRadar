import { describe, it, expect, beforeEach } from 'vitest';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';

describe('IndicatorEngine', () => {
  let engine;

  beforeEach(() => {
    const mockNotificationConfig = { topics: {}, indicators: {} };
    const mockCycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } };
    engine = new IndicatorEngine(mockNotificationConfig, mockCycleConfig);
  });

  const generateTimeline = (length, overrides = {}) => {
    const startDate = new Date('2024-01-01T12:00:00Z');
    return Array(length).fill(0).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        assets: {
        VIX: 20,
        HYG: 100,
        Gold: 2000,
        GDX: 30,
        GDX_Volume: 1000000,
        BIZD: 100,
        BKLN: 100,
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
    };
  });
};

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

  it('sollte Grenzfälle: Zu kurze Timeline abfangen (Edge Case)', () => {
    const shortTimeline = generateTimeline(10);
    const tga = engine.indicators.find(i => i.name.includes('TGA')).evaluate(shortTimeline);
    expect(tga.status).toBe('UNKNOWN');
    expect(tga.message).toContain('Zu wenig Daten');
    
    const rateShock = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(shortTimeline);
    expect(rateShock.status).toBe('UNKNOWN');
  });

  it('sollte fehlende Daten (null) sicher abfangen (Ausfall)', () => {
    const timeline = generateTimeline(35, { macroGroups: { YieldCurve: { Spread10y2y: null } } });
    const yieldCurve = engine.indicators.find(i => i.name.includes('Yield Curve')).evaluate(timeline);
    expect(yieldCurve.status).toBe('UNKNOWN');
  });

  // --- INDIVIDUAL INDICATOR TESTS ---

  describe('Bankreserven (TOTRESNS)', () => {
    it('sollte OK sein wenn Reserven hoch sind', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name.includes('TOTRESNS')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern bei Annäherung an Limit', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.BankingHealth.TotalReserves = 2900;
      const res = engine.indicators.find(i => i.name.includes('TOTRESNS')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte CRITICAL triggern wenn Reserven unter Limit fallen', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.BankingHealth.TotalReserves = 2700;
      const res = engine.indicators.find(i => i.name.includes('TOTRESNS')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
  });

  describe('Maturity Wall', () => {
    it('sollte OK sein bei normaler Baseline', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name.includes('Maturity Wall')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern über 15%', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.Leading.MaturityWallPct = 16;
      const res = engine.indicators.find(i => i.name.includes('Maturity Wall')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte CRITICAL triggern über 21%', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.Leading.MaturityWallPct = 22;
      const res = engine.indicators.find(i => i.name.includes('Maturity Wall')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
  });

  describe('TGA (Treasury General Account)', () => {
    it('sollte WARNING triggern bei starkem Anstieg (>100)', () => {
      const timeline = generateTimeline(35);
      timeline[5].macroGroups.NetLiquidity.TGA = 500;
      timeline[34].macroGroups.NetLiquidity.TGA = 650;
      const res = engine.indicators.find(i => i.name.includes('TGA')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK sein bei rasantem Fall (Stealth Stimulus)', () => {
      const timeline = generateTimeline(35);
      timeline[5].macroGroups.NetLiquidity.TGA = 500;
      timeline[34].macroGroups.NetLiquidity.TGA = 350;
      const res = engine.indicators.find(i => i.name.includes('TGA')).evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Kaufsignal');
    });

    it('sollte OK sein bei Seitwärtsbewegung', () => {
      const timeline = generateTimeline(35);
      timeline[5].macroGroups.NetLiquidity.TGA = 500;
      timeline[34].macroGroups.NetLiquidity.TGA = 550;
      const res = engine.indicators.find(i => i.name.includes('TGA')).evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Seitwärtsbewegung');
    });
  });

  describe('Sahm Rule', () => {
    it('sollte OK sein unter 0.5', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name.includes('Sahm Rule')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte CRITICAL sein bei >= 0.5', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.Leading.SahmRule = 0.5;
      const res = engine.indicators.find(i => i.name.includes('Sahm Rule')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
  });

  describe('NFCI', () => {
    it('sollte OK sein <= 0', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name.includes('Chicago Fed')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte CRITICAL sein > 0', () => {
      const timeline = generateTimeline(1);
      timeline[0].macroGroups.FinancialConditions.ChicagoFedIndex = 0.1;
      const res = engine.indicators.find(i => i.name.includes('Chicago Fed')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
  });

  describe('Yield Curve', () => {
    it('sollte CRITICAL bei UN-INVERTING triggern', () => {
      const timeline = generateTimeline(35);
      timeline[5].macroGroups.YieldCurve.Spread10y2y = -0.5;
      timeline[34].macroGroups.YieldCurve.Spread10y2y = 0.1;  
      const res = engine.indicators.find(i => i.name.includes('Yield Curve')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
    
    it('sollte WARNING triggern solange invertiert', () => {
      const timeline = generateTimeline(35);
      timeline[5].macroGroups.YieldCurve.Spread10y2y = -0.5;
      timeline[34].macroGroups.YieldCurve.Spread10y2y = -0.2;  
      const res = engine.indicators.find(i => i.name.includes('Yield Curve')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });

  describe('VIX (Spike & Crush)', () => {
    it('sollte CRITICAL bei Spike & Crush triggern', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.VIX = 45; // Spike
      timeline[34].assets.VIX = 30;
      const res = engine.indicators.find(i => i.name.includes('VIX (Spike')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING bei leichtem Crush triggern', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.VIX = 38; // Warning Spike
      timeline[34].assets.VIX = 30;
      const res = engine.indicators.find(i => i.name.includes('VIX (Spike')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte WARNING bei hohem VIX ohne Crush triggern', () => {
      const timeline = generateTimeline(35);
      timeline[34].assets.VIX = 38;
      const res = engine.indicators.find(i => i.name.includes('VIX (Spike')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });

  describe('Gold Capitulation & Healing (2-Step)', () => {
    it('sollte WARNING (TRAUMA) triggern, wenn Trauma existiert, aber noch kein SMA20 Breakout', () => {
      const timeline = generateTimeline(60);
      // Average Volume auf 1000 setzen
      for(let i=0; i<60; i++) {
          timeline[i].assets.Gold = 2000;
          timeline[i].assets.Gold_Volume = 1000;
      }
      
      // Trauma an Tag 50 (Volume > 4.5x, also 5000)
      timeline[50].assets.Gold_Volume = 5000;
      timeline[50].assets.Gold = 1900; // Preis muss fallen für Trauma
      
      // Heute an Tag 59, Preis bleibt unter SMA20 (SMA20 = 2000)
      timeline[58].assets.Gold = 1950;
      timeline[59].assets.Gold = 1980;

      const res = engine.indicators.find(i => i.name === '[INVEST] Gold Capitulation & Healing (2-Step)').evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.value).toBe('TRAUMA');
    });

    it('sollte CRITICAL (HEALING) triggern, wenn Trauma existiert und heute SMA20 Breakout stattfindet', () => {
      const timeline = generateTimeline(60);
      for(let i=0; i<60; i++) {
          timeline[i].assets.Gold = 2000;
          timeline[i].assets.Gold_Volume = 1000;
      }
      
      // Trauma an Tag 50
      timeline[50].assets.Gold_Volume = 5000;
      timeline[50].assets.Gold = 1900; // Preis muss fallen
      
      // Gestern unter SMA20, Heute über SMA20 (Breakout)
      timeline[58].assets.Gold = 1950;
      timeline[59].assets.Gold = 2050; // SMA20 ist ca. 2000

      const res = engine.indicators.find(i => i.name === '[INVEST] Gold Capitulation & Healing (2-Step)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.value).toBe('HEALING');
    });

    it('sollte OK sein, wenn kein Trauma existiert', () => {
      const timeline = generateTimeline(60);
      for(let i=0; i<60; i++) {
          timeline[i].assets.Gold = 2000;
          timeline[i].assets.Gold_Volume = 1000;
      }
      // Kein Volume Climax in den letzten 20 Tagen
      
      const res = engine.indicators.find(i => i.name === '[INVEST] Gold Capitulation & Healing (2-Step)').evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.value).toBe('NORMAL');
    });
  });

  describe('Gold Volume Climax', () => {
    it('sollte CRITICAL triggern bei SELLING CLIMAX (Volumen > 5x, Preis <= -2%)', () => {
      const timeline = generateTimeline(55);
      // Normales Volumen
      for(let i=5; i<54; i++) {
          timeline[i].assets.Gold_Volume = 1000;
      }
      timeline[53].assets.Gold = 2000; 
      timeline[54].assets.Gold = 1950; // -2.5%
      timeline[54].assets.Gold_Volume = 6000; // 6x Volumen
      
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('SELLING CLIMAX');
    });

    it('sollte CRITICAL triggern bei BUYING CLIMAX (Volumen > 5x, Preis >= +2%)', () => {
      const timeline = generateTimeline(55);
      for(let i=5; i<54; i++) {
          timeline[i].assets.Gold_Volume = 1000;
      }
      timeline[53].assets.Gold = 2000; 
      timeline[54].assets.Gold = 2050; // +2.5%
      timeline[54].assets.Gold_Volume = 6000; // 6x Volumen
      
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('BUYING CLIMAX');
    });

    it('sollte OK sein bei normalem Volumen', () => {
      const timeline = generateTimeline(55);
      for(let i=5; i<54; i++) {
          timeline[i].assets.Gold_Volume = 1000;
      }
      timeline[54].assets.Gold_Volume = 1000;
      
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK sein bei hohem Volumen aber kaum Preisbewegung', () => {
        const timeline = generateTimeline(55);
        for(let i=5; i<54; i++) {
            timeline[i].assets.Gold_Volume = 1000;
        }
        timeline[53].assets.Gold = 2000; 
        timeline[54].assets.Gold = 2010; // +0.5%
        timeline[54].assets.Gold_Volume = 6000; // 6x Volumen
        
        const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
        expect(res.status).toBe('OK');
    });

    it('sollte UNKNOWN sein bei zu wenig Daten (< 50)', () => {
      const timeline = generateTimeline(40);
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn Volumendaten fehlen', () => {
      const timeline = generateTimeline(55);
      timeline[54].assets.Gold_Volume = null;
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn avgVol 0 ist (Division by Zero)', () => {
      const timeline = generateTimeline(55);
      for(let i=5; i<55; i++) timeline[i].assets.Gold_Volume = 0;
      const res = engine.indicators.find(i => i.name.includes('Gold Volume Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('GDX Selling Climax', () => {
    it('sollte CRITICAL triggern bei Volumen > 3x und Preis <= -5%', () => {
      const timeline = generateTimeline(55);
      timeline[53].assets.GDX = 30; // Vorheriger Preis
      timeline[54].assets.GDX = 28.5; // -5% (30 * 0.95 = 28.5)
      timeline[54].assets.GDX_Volume = 3500000; // > 3x avg (1000000)
      
      const res = engine.indicators.find(i => i.name.includes('GDX Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte OK sein, wenn Volumen groß ist, aber Preis nicht stark genug fällt', () => {
      const timeline = generateTimeline(55);
      timeline[53].assets.GDX = 30;
      timeline[54].assets.GDX = 29.1; // -3% (30 * 0.97 = 29.1)
      timeline[54].assets.GDX_Volume = 3500000; // > 3x avg
      
      const res = engine.indicators.find(i => i.name.includes('GDX Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte UNKNOWN sein bei zu wenig Daten (< 50)', () => {
      const timeline = generateTimeline(40);
      const res = engine.indicators.find(i => i.name.includes('GDX Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn GDX Daten fehlen (Edge Case)', () => {
      const timeline = generateTimeline(55);
      timeline[54].assets.GDX = null;
      const res = engine.indicators.find(i => i.name.includes('GDX Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
    
    it('sollte null/0 Divisionen abfangen wenn avgVol 0 ist (Edge Case)', () => {
      const timeline = generateTimeline(55);
      for(let i=5; i<55; i++) timeline[i].assets.GDX_Volume = 0;
      const res = engine.indicators.find(i => i.name.includes('GDX Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('GDX Buying Climax', () => {
    it('sollte WARNING triggern bei Volumen > 3x und Preis >= +5%', () => {
      const timeline = generateTimeline(55);
      timeline[53].assets.GDX = 30; 
      timeline[54].assets.GDX = 31.5; // +5% (30 * 1.05 = 31.5)
      timeline[54].assets.GDX_Volume = 3500000; // > 3x avg 
      
      const res = engine.indicators.find(i => i.name.includes('GDX Buying Climax')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK sein, wenn Volumen groß ist, aber Preis nicht stark genug steigt', () => {
      const timeline = generateTimeline(55);
      timeline[53].assets.GDX = 30;
      timeline[54].assets.GDX = 31.0; // +3.3% 
      timeline[54].assets.GDX_Volume = 3500000; 
      
      const res = engine.indicators.find(i => i.name.includes('GDX Buying Climax')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });
    
    it('sollte UNKNOWN sein wenn GDX_Volume fehlt', () => {
      const timeline = generateTimeline(55);
      timeline[54].assets.GDX_Volume = null;
      const res = engine.indicators.find(i => i.name.includes('GDX Buying Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('GDX vs Gold Divergenz', () => {
    it('sollte WARNING triggern, wenn Gold am Top ist und GDX divergiert (Drawdown > 3%)', () => {
      const timeline = generateTimeline(35);
      
      // Gold Top an Tag 34 (1 Tag her)
      for(let i=5; i<35; i++) timeline[i].assets.Gold = 2000;
      timeline[33].assets.Gold = 2050; // Höchster Punkt
      timeline[34].assets.Gold = 2045; // Leicht darunter, aber im 5 Tage Fenster
      
      // GDX Top an Tag 20 (vor 15 Tagen) -> divergiert!
      for(let i=5; i<35; i++) timeline[i].assets.GDX = 30;
      timeline[19].assets.GDX = 35; // GDX Hochpunkt
      timeline[34].assets.GDX = 33.5; // -4.2% vom Hoch (35 * 0.958)
      
      const res = engine.indicators.find(i => i.name.includes('GDX vs Gold Divergenz')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('GDX toppt vor Gold');
    });

    it('sollte OK sein, wenn Gold am Top ist, aber GDX auch gerade sein Hoch macht', () => {
      const timeline = generateTimeline(35);
      
      for(let i=5; i<35; i++) timeline[i].assets.Gold = 2000;
      timeline[34].assets.Gold = 2050; 
      
      for(let i=5; i<35; i++) timeline[i].assets.GDX = 30;
      timeline[34].assets.GDX = 35; 
      
      const res = engine.indicators.find(i => i.name.includes('GDX vs Gold Divergenz')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK sein, wenn GDX fällt, aber Gold sein Hoch schon vor langer Zeit hatte (>5 Tage)', () => {
      const timeline = generateTimeline(35);
      
      for(let i=5; i<35; i++) timeline[i].assets.Gold = 2000;
      timeline[10].assets.Gold = 2050; // Hochpunkt schon sehr lange her
      
      for(let i=5; i<35; i++) timeline[i].assets.GDX = 30;
      timeline[10].assets.GDX = 35; // GDX auch lange her
      timeline[34].assets.GDX = 30; // Deutlicher Drawdown
      
      const res = engine.indicators.find(i => i.name.includes('GDX vs Gold Divergenz')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte UNKNOWN sein, wenn Daten (< 30 Tage)', () => {
      const timeline = generateTimeline(20);
      const res = engine.indicators.find(i => i.name.includes('GDX vs Gold Divergenz')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
    
    it('sollte UNKNOWN sein, wenn GDX oder Gold Daten fehlen', () => {
      const timeline = generateTimeline(35);
      timeline[34].assets.Gold = null;
      const res = engine.indicators.find(i => i.name.includes('GDX vs Gold Divergenz')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('Central Bank Policy Error', () => {
    it('sollte CRITICAL triggern wenn DFF sinkt, T10YIE steigt und DXY flach ist', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.FedFundsRate = 5.0;
      timeline[64].macroGroups.FinancialConditions.FedFundsRate = 4.5; // -0.5%
      
      timeline[5].macroGroups.Leading.BreakevenInflation = 2.0;
      timeline[64].macroGroups.Leading.BreakevenInflation = 2.2; // +0.2%

      timeline[5].macroGroups.FinancialConditions.DXY = 100.0;
      timeline[64].macroGroups.FinancialConditions.DXY = 101.0; // +1.0% (<= 2.0%)

      const res = engine.indicators.find(i => i.name.includes('Policy Error')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern wenn DFF leicht sinkt und T10YIE leicht steigt', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.FedFundsRate = 5.0;
      timeline[64].macroGroups.FinancialConditions.FedFundsRate = 4.85; // -0.15% (zwischen -0.10 und -0.25)
      
      timeline[5].macroGroups.Leading.BreakevenInflation = 2.0;
      timeline[64].macroGroups.Leading.BreakevenInflation = 2.06; // +0.06% (über 0.05 aber unter 0.10)

      timeline[5].macroGroups.FinancialConditions.DXY = 100.0;
      timeline[64].macroGroups.FinancialConditions.DXY = 100.0; // DXY Daten setzen, sonst UNKNOWN
      
      const res = engine.indicators.find(i => i.name.includes('Policy Error')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('FED Zinsen sinken');
    });

    it('sollte WARNING triggern wenn DXY stark steigt (Ausbruch blockiert)', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.FedFundsRate = 5.0;
      timeline[64].macroGroups.FinancialConditions.FedFundsRate = 4.5;
      
      timeline[5].macroGroups.Leading.BreakevenInflation = 2.0;
      timeline[64].macroGroups.Leading.BreakevenInflation = 2.2;

      timeline[5].macroGroups.FinancialConditions.DXY = 100.0;
      timeline[64].macroGroups.FinancialConditions.DXY = 105.0; // +5.0% (> 2.0%)

      const res = engine.indicators.find(i => i.name.includes('Policy Error')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK sein wenn es keine Divergenz gibt', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.FedFundsRate = 5.0;
      timeline[64].macroGroups.FinancialConditions.FedFundsRate = 4.9;
      
      timeline[5].macroGroups.Leading.BreakevenInflation = 2.0;
      timeline[64].macroGroups.Leading.BreakevenInflation = 1.9;

      timeline[5].macroGroups.FinancialConditions.DXY = 100.0;
      timeline[64].macroGroups.FinancialConditions.DXY = 100.0;

      const res = engine.indicators.find(i => i.name.includes('Policy Error')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte UNKNOWN zurückgeben wenn Daten fehlen', () => {
      const timeline = generateTimeline(65);
      timeline[64].macroGroups.FinancialConditions.FedFundsRate = null;
      
      const res = engine.indicators.find(i => i.name.includes('Policy Error')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });


  describe('Rate Shock', () => {
    it('sollte CRITICAL triggern (diff >= 0.5)', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.RealYield10y = 1.0;
      timeline[64].macroGroups.FinancialConditions.RealYield10y = 1.6;
      const res = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern (diff >= 0.3)', () => {
      const timeline = generateTimeline(65);
      timeline[5].macroGroups.FinancialConditions.RealYield10y = 1.0;
      timeline[64].macroGroups.FinancialConditions.RealYield10y = 1.4;
      const res = engine.indicators.find(i => i.name.includes('Rate Shock')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });

  describe('HYG', () => {
    it('sollte CRITICAL triggern bei perf <= -3%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.HYG = 100;
      timeline[34].assets.HYG = 96;
      const res = engine.indicators.find(i => i.name.includes('HYG')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei perf <= -1.5%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.HYG = 100;
      timeline[34].assets.HYG = 98;
      const res = engine.indicators.find(i => i.name.includes('HYG')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });

  describe('BIZD (Private Credit Stress)', () => {
    it('sollte CRITICAL triggern bei perf <= -5.0%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.BIZD = 100;
      timeline[34].assets.BIZD = 94;
      const res = engine.indicators.find(i => i.name.includes('BIZD')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei perf <= -2.5%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.BIZD = 100;
      timeline[34].assets.BIZD = 97;
      const res = engine.indicators.find(i => i.name.includes('BIZD')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte UNKNOWN abfangen wenn Daten fehlen', () => {
      const timeline = generateTimeline(10);
      const res = engine.indicators.find(i => i.name.includes('BIZD')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('BKLN (Floating Rate Stress)', () => {
    it('sollte CRITICAL triggern bei perf <= -2.0%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.BKLN = 100;
      timeline[34].assets.BKLN = 97.5;
      const res = engine.indicators.find(i => i.name.includes('BKLN')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei perf <= -1.0%', () => {
      const timeline = generateTimeline(35);
      timeline[5].assets.BKLN = 100;
      timeline[34].assets.BKLN = 98.5;
      const res = engine.indicators.find(i => i.name.includes('BKLN')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });
  describe('Schattenbanken Zinslast (ARCC)', () => {
    it('sollte CRITICAL triggern bei >= 15% Wachstum', () => {
      const timeline = generateTimeline(95);
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 120000000 }; // +20%
      const res = engine.indicators.find(i => i.name.includes('ARCC')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei >= 5% Wachstum', () => {
      const timeline = generateTimeline(95);
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 105000000 }; // +5%
      const res = engine.indicators.find(i => i.name.includes('ARCC')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK triggern bei < 5% Wachstum', () => {
      const timeline = generateTimeline(95);
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 101000000 }; // +1%
      const res = engine.indicators.find(i => i.name.includes('ARCC')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte UNKNOWN sein, wenn keine Daten vorhanden', () => {
      const timeline = generateTimeline(95);
      // Keine Fundamentals gesetzt
      const res = engine.indicators.find(i => i.name.includes('ARCC')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });
  });

  describe('getAlerts()', () => {
    it('sollte null zurückgeben, wenn es keine Warnungen gibt', () => {
      const timeline = generateTimeline(95); // alles OK
      const alerts = engine.getAlerts(timeline);
      expect(alerts.notifications).toBeNull();
    });

    it('sollte nur Warnungen aggregieren', () => {
      const timeline = generateTimeline(95);
      // Erzeuge ein WARNING
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 105000000 }; // +5%
      
      const alerts = engine.getAlerts(timeline);
      expect(alerts.notifications).not.toBeNull();
      expect(alerts.notifications[0].priority).toBe('high');
      expect(alerts.notifications[0].message).toContain('WARNING: Schattenbanken Zinslast');
      expect(alerts.notifications[0].message).not.toContain('CRITICAL');
    });

    it('sollte höchste Priorität (urgent) annehmen wenn es CRITICAL gibt', () => {
      const timeline = generateTimeline(95);
      // Erzeuge ein CRITICAL
      timeline[94].macroGroups.BankingHealth.TotalReserves = 2000;
      
      const alerts = engine.getAlerts(timeline);
      expect(alerts.notifications).not.toBeNull();
      expect(alerts.notifications[0].priority).toBe('urgent');
      expect(alerts.notifications[0].message).toContain('CRITICAL: Bankreserven');
    });

    it('sollte die Priorität bei einem zweiten Warning nicht überschreiben', () => {
      const timeline = generateTimeline(95);
      // Erzeuge zwei WARNINGS (beide MACRO -> selbes Topic)
      timeline[94].macroGroups.BankingHealth.TotalReserves = 2900; // Warning 1
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 105000000 }; // Warning 2
      
      const alerts = engine.getAlerts(timeline);
      expect(alerts.notifications).not.toBeNull();
      expect(alerts.notifications[0].priority).toBe('high');
      expect(alerts.notifications[0].message).toContain('WARNING: Bankreserven');
      expect(alerts.notifications[0].message).toContain('WARNING: Schattenbanken Zinslast');
    });
    it('sollte Spam via Debounce-Logik blockieren', () => {
      const timeline = generateTimeline(95);
      timeline[5].macroGroups.Fundamentals = { ARCC_InterestExpense: 100000000 };
      timeline[94].macroGroups.Fundamentals = { ARCC_InterestExpense: 105000000 };
      
      // Erster Aufruf: Notification sollte da sein
      const alerts1 = engine.getAlerts(timeline);
      expect(alerts1.notifications).not.toBeNull();
      
      // Zweiter Aufruf (sofort danach): Notification sollte null sein (Debounce)
      const alerts2 = engine.getAlerts(timeline, alerts1.updatedHistory);
      expect(alerts2.notifications).toBeNull();
    });
  });


  describe('Panik-Kapitulation (VIX + CBOE + RSI)', () => {
    it('sollte UNKNOWN zurückgeben, wenn weniger als 90 Tage Daten vorhanden sind (Edge Case)', () => {
      const timeline = generateTimeline(80);
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Zu wenig Daten');
    });

    it('sollte UNKNOWN zurückgeben, wenn SPY, VIX oder CBOE null sind (Ausfall)', () => {
      const timeline = generateTimeline(100);
      timeline[99].assets.SPY = null;
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Keine Daten');
    });

    it('sollte OK zurückgeben bei VIX < 35 (Edge Case)', () => {
      const timeline = generateTimeline(100, { assets: { VIX: 20, SPY: 100, CBOE_SPY: 1000 } });
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK zurückgeben bei VIX > 35 aber fehlendem CBOE Spike (Happy Path Normal)', () => {
      const timeline = generateTimeline(100);
      for(let i=0; i<100; i++) {
        timeline[i].assets.SPY = 100;
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 40;
      }
      // Current CBOE is 1000, SMA is 1000 -> 1.0x (No Spike)
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern, wenn VIX > 35 und CBOE spiket, aber KEINE Divergenz (Happy Path Warning)', () => {
      const timeline = generateTimeline(100);
      // Fallender SPY Kurs (keine RSI Divergenz)
      for(let i=0; i<100; i++) {
        timeline[i].assets.SPY = 200 - i; // Price steadily dropping -> RSI very low
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 40;
      }
      // Letzter Tag Spike
      timeline[99].assets.CBOE_SPY = 2000; 

      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Massiver Panik-Spike im Optionsvolumen');
    });

    it('sollte CRITICAL triggern, wenn alle Bedingungen (Divergenz) eintreten (Happy Path Critical)', () => {
      const timeline = generateTimeline(100);
      for(let i=0; i<100; i++) {
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 20;
      }
      
      // Phase 1: Massive flash crash
      for(let i=0; i<=60; i++) timeline[i].assets.SPY = 100;
      for(let i=61; i<=65; i++) timeline[i].assets.SPY = 100 - (i-60)*10; // Drops to 50 very fast -> RSI hits bottom
      
      // Phase 2: Recovery
      for(let i=66; i<=80; i++) timeline[i].assets.SPY = 80;
      
      // Phase 3: Slow bleed to new low
      for(let i=81; i<=99; i++) timeline[i].assets.SPY = 80 - (i-80)*1.7; // Drops to 47.7 (New Low) slowly -> RSI higher

      timeline[99].assets.CBOE_SPY = 2000; // 2x Spike
      timeline[99].assets.VIX = 40; // Panic

      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('GENERATIONEN-KAUFSIGNAL');
      expect(res.message).toContain('Bullish Divergence');
    });
  });

  describe('Red Alert (Bullenmarkt-Stirbt-Signal)', () => {
    it('sollte UNKNOWN sein, wenn SKEW oder ShortRatio fehlen', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Keine SKEW oder Short-Ratio Daten');
    });

    it('sollte OK sein, wenn Werte normal sind', () => {
      const timeline = generateTimeline(1);
      timeline[0].assets.SKEW = 130;
      timeline[0].SPY_ShortVolumeRatio = 0.55;
      timeline[0].TotalPCR = 0.90;
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern bei Aufbau von Spannung (SKEW > 140, Short < 0.50)', () => {
      const timeline = generateTimeline(1);
      timeline[0].assets.SKEW = 142;
      timeline[0].SPY_ShortVolumeRatio = 0.48;
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Spannung baut sich auf');
    });

    it('sollte WARNING triggern (Melt-Up aktiv), wenn SKEW > 145 und Short < 0.45, ABER PCR > 0.75', () => {
      const timeline = generateTimeline(1);
      timeline[0].assets.SKEW = 150;
      timeline[0].SPY_ShortVolumeRatio = 0.40;
      timeline[0].TotalPCR = 0.95;
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Melt-Up Phase ist noch aktiv (PCR > 0.75)');
    });

    it('sollte WARNING triggern (Melt-Up aktiv), wenn PCR fehlt (Fallback = 1.0)', () => {
      const timeline = generateTimeline(1);
      timeline[0].assets.SKEW = 150;
      timeline[0].SPY_ShortVolumeRatio = 0.40;
      // Kein PCR definiert -> Fallback 1.0
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.value).toContain('Kein PCR');
    });

    it('sollte CRITICAL triggern, wenn SKEW > 145, Short < 0.45 UND PCR < 0.75 (Perfekter Sturm)', () => {
      const timeline = generateTimeline(1);
      timeline[0].assets.SKEW = 150;
      timeline[0].SPY_ShortVolumeRatio = 0.40;
      timeline[0].TotalPCR = 0.65;
      const res = engine.indicators.find(i => i.name.includes('Red Alert')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('MAXIMALER ALARM');
    });
  });

  describe('Bitcoin Divergenz (Makro-Liquidität)', () => {
    it('sollte UNKNOWN sein, wenn zu wenig Daten vorhanden sind', () => {
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Divergenz')).evaluate(generateTimeline(29));
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein, wenn SPY oder BTC Daten fehlen', () => {
      const timeline = generateTimeline(35);
      timeline.forEach(t => t.assets = { SPY: 5000 }); // BTC fehlt
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Divergenz')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte WARNING triggern, wenn SPY stark ist, aber BTC abstürzt', () => {
      const timeline = generateTimeline(35);
      // Base: Maxima setzen
      timeline.forEach(t => t.assets = { SPY: 500, BTC: 100000 });
      // Aktueller Tag: SPY stabil (0%), BTC Crash (-15%)
      timeline[34].assets = { SPY: 495, BTC: 85000 };
      
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Divergenz')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Liquiditäts-Staubsauger aktiv');
    });

    it('sollte OK sein, wenn keine Divergenz vorliegt', () => {
      const timeline = generateTimeline(35);
      // Base: Alles steigt
      for (let i = 0; i < 35; i++) {
        timeline[i].assets = { SPY: 400 + i, BTC: 90000 + (i*100) };
      }
      
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Divergenz')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });
  });

  describe('Krypto Zyklus-Divergenz (MSTR/COIN)', () => {
    it('sollte UNKNOWN sein, wenn zu wenig Daten vorhanden sind', () => {
      const res = engine.indicators.find(i => i.name.includes('Krypto Zyklus-Divergenz')).evaluate(generateTimeline(29));
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein, wenn BTC oder Proxy Daten fehlen', () => {
      const timeline = generateTimeline(35);
      timeline.forEach(t => t.assets = { BTC: 50000 }); // MSTR und COIN fehlen
      const res = engine.indicators.find(i => i.name.includes('Krypto Zyklus-Divergenz')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte WARNING triggern, wenn BTC stark ist, aber MSTR oder COIN abverkaufen', () => {
      const timeline = generateTimeline(35);
      
      // Base: Maxima setzen
      timeline.forEach(t => t.assets = { BTC: 100000, MSTR: 200, COIN: 200 });
      
      // Aktueller Tag: BTC kaum verändert (-1%), aber Proxies crashen (-20%)
      timeline[34].assets = { BTC: 99000, MSTR: 160, COIN: 160 }; // -20% Drawdown
      
      const res = engine.indicators.find(i => i.name.includes('Krypto Zyklus-Divergenz')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Zyklus-Warnung! BTC stark, aber MSTR/COIN bluten aus');
    });

    it('sollte OK sein, wenn Krypto-Proxies intakt sind', () => {
      const timeline = generateTimeline(35);
      
      // Base: Alles steigt synchron
      for (let i = 0; i < 35; i++) {
        timeline[i].assets = { BTC: 100000 + (i*10), MSTR: 200 + i, COIN: 200 + i };
      }
      
      const res = engine.indicators.find(i => i.name.includes('Krypto Zyklus-Divergenz')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });
  });

  describe('Bitcoin Selling Climax (Panik/Boden)', () => {
    it('sollte UNKNOWN sein, wenn Daten (< 30 Tage) fehlen', () => {
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Selling Climax')).evaluate(generateTimeline(29));
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein, wenn BTC Daten oder Volumen fehlen', () => {
      const timeline = generateTimeline(35);
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein, wenn avgVol 0 ist', () => {
      const timeline = generateTimeline(35);
      timeline.forEach(t => t.assets = { BTC: 50000, BTC_Volume: 0 }); 
      // Negative Volumen passieren den ersten Check (falsy), aber fliegen im Loop (v > 0) raus
      timeline[34].assets.BTC_Volume = -1;
      
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Keine gültigen Volumendaten');
    });

    it('sollte CRITICAL triggern bei riesigem Volumen und Preissturz', () => {
      const timeline = generateTimeline(35);
      // Base
      for(let i=0; i<34; i++) {
        timeline[i].assets = { BTC: 60000, BTC_Volume: 1000 };
      }
      // Climax Tag
      timeline[34].assets = { BTC: 50000, BTC_Volume: 5000 }; // Vol 5x, Preis -16%

      const res = engine.indicators.find(i => i.name.includes('Bitcoin Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('BTC SELLING CLIMAX');
    });

    it('sollte OK sein bei normalem Verhalten', () => {
      const timeline = generateTimeline(35);
      for(let i=0; i<35; i++) {
        timeline[i].assets = { BTC: 60000, BTC_Volume: 1000 };
      }
      const res = engine.indicators.find(i => i.name.includes('Bitcoin Selling Climax')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });
  });

  describe('Tech-Zyklus Radar (SMH vs IGV)', () => {
    it('sollte UNKNOWN zurückgeben, wenn weniger als 100 Datenpunkte vorhanden sind', () => {
      const timeline = generateTimeline(99);
      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Zu wenig Daten');
    });

    it('sollte HARDWARE START (Golden Cross) erkennen', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 100, IGV: 100, SPY: 100, CIBR: 100 });
      
      // Prev Short < Prev Long
      for (let i = 45; i < 95; i++) {
        timeline[i].assets.SMH = 90;
      }
      // Current Short > Current Long
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 150;
      }

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.value).toBe('HARDWARE START');
    });

    it('sollte DISTRIBUTION bei wackelndem Hardware-Zyklus und CIBR Flucht erkennen', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 120, IGV: 100, SPY: 100, CIBR: 100 });
      
      // Hardware war extrem dominant
      for (let i = 80; i < 95; i++) {
        timeline[i].assets.SMH = 150;
      }
      // Current Short flacht ab
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 125;
        timeline[i].assets.CIBR = 110; 
      }
      timeline[84].assets.CIBR = 100; // Past reference (index 84 is timeline.length - 1 - 15)

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.value).toBe('DISTRIBUTION');
      expect(res.message).toContain('Cybersecurity (CIBR Momentum');
    });

    it('sollte SOFTWARE START (Death Cross) erkennen', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 100, IGV: 100, SPY: 100, CIBR: 100 });
      
      for (let i = 80; i < 95; i++) {
        timeline[i].assets.SMH = 120;
      }
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 50; 
      }

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.value).toBe('SOFTWARE START');
    });

    it('sollte UNKNOWN zurückgeben, wenn SMH oder IGV Daten fehlen', () => {
      const timeline = generateTimeline(100);
      // Timeline hat standardmäßig keine Assets
      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Keine SMH oder IGV Daten');
    });

    it('sollte HARDWARE DOMINANZ (OK) erkennen, wenn Hardware weiter steigt', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 100, IGV: 100, SPY: 100, CIBR: 100 });
      
      // Prev Short > Prev Long (Hardware war dominant)
      for (let i = 80; i < 95; i++) {
        timeline[i].assets.SMH = 120;
      }
      // Current Short noch höher (Momentum > 0)
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 150; 
      }

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.value).toBe('HARDWARE DOMINANZ');
    });

    it('sollte SOFTWARE DOMINANZ (OK) erkennen, wenn Software intakt ist', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 100, IGV: 100, SPY: 100, CIBR: 100 });
      
      // Software dominiert (Ratio < 1)
      for (let i = 80; i < 95; i++) {
        timeline[i].assets.SMH = 80;
      }
      // Weiterer Fall von SMH (Ratio sinkt = Software Momentum positiv) -> für unser Script: shortMaMomentum < 0
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 50; 
      }

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.value).toBe('SOFTWARE DOMINANZ');
    });

    it('sollte ACCUMULATION erkennen, wenn Software dominiert aber Hardware Momentum sammelt', () => {
      const timeline = generateTimeline(100);
      timeline.forEach(t => t.assets = { SMH: 100, IGV: 100, SPY: 100, CIBR: 100 });
      
      // Software dominiert stark
      for (let i = 80; i < 95; i++) {
        timeline[i].assets.SMH = 50;
      }
      // Hardware erholt sich leicht (Ratio steigt, Momentum > 0, aber Short < Long)
      for (let i = 95; i < 100; i++) {
        timeline[i].assets.SMH = 80; 
      }

      const res = engine.indicators.find(i => i.name.includes('Tech-Zyklus Radar')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.value).toBe('ACCUMULATION');
      expect(res.message).toContain('Vorwarnung');
    });
  });

  describe('getDailyStatusReport()', () => {
    it('sollte null zurückgeben, wenn keine Daten vorhanden sind', () => {
      expect(engine.getDailyStatusReport([])).toBeNull();
      expect(engine.getDailyStatusReport(null)).toBeNull();
    });

    it('sollte einen aggregierten Daily Report erstellen', () => {
      const timeline = generateTimeline(100);
      // Alles OK = Report OK
      const reportOK = engine.getDailyStatusReport(timeline);
      expect(reportOK.title).toContain('OK');
      
      // Einen Critical triggern
      timeline[99].macroGroups.BankingHealth.TotalReserves = 1000;
      const reportCrit = engine.getDailyStatusReport(timeline);
      expect(reportCrit.title).toContain('CRITICAL');
      expect(reportCrit.message).toContain('🚨 Kritisch');
    });
  });

  describe('generateReport()', () => {
    it('sollte einen sauberen Text generieren ohne ANSI Farben', () => {
      const timeline = generateTimeline(35);
      // setze ein paar status values
      timeline[34].macroGroups.BankingHealth.TotalReserves = 2900; // WARNING
      const report = engine.generateReport(timeline, true);
      
      expect(report).toContain('[WARNING] Bankreserven');
      expect(report).toContain('[OK] Sahm Rule');
      expect(report).not.toContain('\x1b'); // Keine ANSI Escape codes
    });
  });

  describe('ML Regime Radar (Makro & Krypto)', () => {
    it('sollte UNKNOWN zurückgeben, wenn Daten fehlen', () => {
      const timeline = generateTimeline(1);
      const res1 = engine.indicators.find(i => i.name.includes('ML Regime Radar (Makro)')).evaluate(timeline);
      const res2 = engine.indicators.find(i => i.name.includes('ML Regime Radar (Krypto)')).evaluate(timeline);
      expect(res1.status).toBe('UNKNOWN');
      expect(res2.status).toBe('UNKNOWN');
    });

    it('sollte ML Regime Radar Makro korrekt auswerten', () => {
      const timeline = generateTimeline(1);
      
      timeline[0].mlRegime = { phase: 'MACRO_TOP', confidence: 0.9 };
      let res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Makro)')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.value).toContain('TOP (90.0%)');

      timeline[0].mlRegime = { phase: 'DOWNTREND', confidence: 0.7 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Makro)')).evaluate(timeline);
      expect(res.status).toBe('WARNING');

      timeline[0].mlRegime = { phase: 'MACRO_BOTTOM', confidence: 0.8 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Makro)')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.value).toContain('BOTTOM');

      timeline[0].mlRegime = { phase: 'UPTREND', confidence: 0.6 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Makro)')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte ML Regime Radar Krypto korrekt auswerten', () => {
      const timeline = generateTimeline(1);
      
      timeline[0].mlRegime = { phase: 'MACRO_TOP', confidence: 0.9 };
      let res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Krypto)')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('KRYPTO-ZYKLUSENDE');

      timeline[0].mlRegime = { phase: 'DOWNTREND', confidence: 0.7 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Krypto)')).evaluate(timeline);
      expect(res.status).toBe('WARNING');

      timeline[0].mlRegime = { phase: 'MACRO_BOTTOM', confidence: 0.8 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Krypto)')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('KRYPTO-BODEN');

      timeline[0].mlRegime = { phase: 'UPTREND', confidence: 0.6 };
      res = engine.indicators.find(i => i.name.includes('ML Regime Radar (Krypto)')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });
  });
  describe('Krypto Portfolio-Exit (MSTR/COIN)', () => {
    it('sollte UNKNOWN sein wenn Daten fehlen (< 50 Tage)', () => {
      const timeline = generateTimeline(40);
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn invalid Datum (NaN) in config', () => {
      const timeline = generateTimeline(60);
      engine.cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: 'invalid-date' } };
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toBe('Ungültiges Datum');
    });

    it('sollte default dangerStart (970) nutzen wenn in config nicht definiert', () => {
      const timeline = generateTimeline(50);
      engine.cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21' } };
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK sein wenn wir noch nicht in der Gefahrenzone sind', () => {
      const timeline = generateTimeline(50);
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING sein wenn in der Gefahrenzone aber noch kein SMA Bruch', () => {
      const timeline = generateTimeline(60);
      engine.cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 10 } };
      for(let i=0; i<60; i++) {
        timeline[i].assets.MSTR = 1000;
        timeline[i].assets.COIN = 200;
      }
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte CRITICAL triggern wenn in Gefahrenzone, SMA50 bricht und Volumen hoch ist', () => {
      const timeline = generateTimeline(60);
      engine.cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 10 } };
      for(let i=0; i<60; i++) {
        timeline[i].assets.MSTR = 1000;
        timeline[i].assets.MSTR_Volume = 1000;
      }
      timeline[59].assets.MSTR = 900;
      timeline[59].assets.MSTR_Volume = 3000;
      
      const res = engine.indicators.find(i => i.name.includes('Portfolio-Exit')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('MSTR bricht SMA 50');
    });
  });

  describe('BTC Trailing Stop Warnung (Makro-Radar)', () => {
    it('sollte UNKNOWN sein wenn Daten fehlen (< 200 Tage)', () => {
      const timeline = generateTimeline(100);
      const res = engine.indicators.find(i => i.name.includes('BTC Trailing Stop')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn MSTR Daten fehlen', () => {
      const timeline = generateTimeline(210);
      timeline[209].assets.MSTR = null;
      const res = engine.indicators.find(i => i.name.includes('BTC Trailing Stop')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toBe('Keine MSTR Daten');
    });

    it('sollte OK sein wenn MSTR >= SMA200', () => {
      const timeline = generateTimeline(210);
      for(let i=0; i<210; i++) timeline[i].assets.MSTR = 1000;
      const res = engine.indicators.find(i => i.name.includes('BTC Trailing Stop')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte CRITICAL triggern wenn MSTR durch SMA 200 fällt', () => {
      const timeline = generateTimeline(210);
      for(let i=0; i<210; i++) timeline[i].assets.MSTR = 1000;
      timeline[209].assets.MSTR = 900; 
      
      const res = engine.indicators.find(i => i.name.includes('BTC Trailing Stop')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('MSTR VERLIERT SMA 200');
    });

    it('sollte WARNING triggern wenn MSTR bereits unter SMA 200 bleibt', () => {
      const timeline = generateTimeline(210);
      for(let i=0; i<210; i++) timeline[i].assets.MSTR = 1000;
      timeline[208].assets.MSTR = 900;
      timeline[209].assets.MSTR = 900;
      
      const res = engine.indicators.find(i => i.name.includes('BTC Trailing Stop')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });
  });

  describe('Market Panic & Capitulation (VIX + Volume)', () => {
    it('sollte UNKNOWN sein wenn Daten fehlen (< 15 Tage)', () => {
      const timeline = generateTimeline(10);
      const res = engine.indicators.find(i => i.name.includes('Market Panic & Capitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte UNKNOWN sein wenn keine gültigen Volumendaten existieren', () => {
      const timeline = generateTimeline(65);
      // Entferne alle Volumendaten
      for(let i=0; i<65; i++) {
        timeline[i].assets.SPY_Volume = null;
        timeline[i].assets.QQQ_Volume = null;
      }
      const res = engine.indicators.find(i => i.name.includes('Market Panic & Capitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toBe('Keine gültigen Volumendaten');
    });

    it('sollte OK sein bei normalem VIX und Volumen', () => {
      const timeline = generateTimeline(65);
      for(let i=0; i<65; i++) timeline[i].assets.SPY_Volume = 1000;
      const res = engine.indicators.find(i => i.name.includes('Market Panic & Capitulation')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern bei VIX >= 25 und Vol >= 1.2x', () => {
      const timeline = generateTimeline(65);
      for(let i=0; i<65; i++) timeline[i].assets.SPY_Volume = 1000;
      timeline[64].assets.VIX = 26;
      timeline[64].assets.SPY_Volume = 1250;
      const res = engine.indicators.find(i => i.name.includes('Market Panic & Capitulation')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte CRITICAL triggern bei VIX >= 28 und Vol >= 1.25x', () => {
      const timeline = generateTimeline(65);
      for(let i=0; i<65; i++) timeline[i].assets.SPY_Volume = 1000;
      timeline[64].assets.VIX = 30;
      timeline[64].assets.SPY_Volume = 1500;
      const res = engine.indicators.find(i => i.name.includes('Market Panic & Capitulation')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });
  });

  describe('ML Regime Radar (BTC)', () => {
    it('sollte UNKNOWN zurückgeben, wenn Daten fehlen', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL triggern bei MACRO_TOP oder CYCLE_TOP', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'CYCLE_TOP', confidence: 0.95 };
      let res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('KRYPTO-ZYKLUSENDE');

      timeline[0].mlRegimeBtc = { phase: 'MACRO_TOP', confidence: 0.9 };
      res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei BEAR_MARKET mit hoher Confidence', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'BEAR_MARKET', confidence: 0.7 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('KRYPTO-WINTER');
    });

    it('sollte WARNING triggern bei BEAR_RALLY', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'BEAR_RALLY', confidence: 0.6 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Dead Cat Bounce');
    });

    it('sollte CRITICAL triggern bei CYCLE_BOTTOM', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'CYCLE_BOTTOM', confidence: 0.8 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('KRYPTO-BODEN');
    });

    it('sollte OK sein bei BULL_MARKET oder UPTREND', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'BULL_MARKET', confidence: 0.9 };
      let res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('OK');

      timeline[0].mlRegimeBtc = { phase: 'UPTREND', confidence: 0.9 };
      res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK sein bei BULL_CORRECTION', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'BULL_CORRECTION', confidence: 0.8 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Normale Korrektur');
    });

    it('sollte OK (neutral) sein bei unbekannter Phase', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeBtc = { phase: 'UNKNOWN_PHASE', confidence: 0.5 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (BTC)').evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Neutrales Krypto-Regime');
    });
  });

  describe('ML Regime Radar (SPY)', () => {
    it('sollte UNKNOWN zurückgeben, wenn Daten fehlen', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (SPY)').evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL triggern bei MACRO_TOP', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeSpy = { phase: 'MACRO_TOP', confidence: 0.95 };
      let res = engine.indicators.find(i => i.name === 'ML Regime Radar (SPY)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei BEAR_MARKET mit hoher Confidence', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeSpy = { phase: 'BEAR_MARKET', confidence: 0.7 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (SPY)').evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK (neutral) sein bei unbekannter Phase', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeSpy = { phase: 'UNKNOWN_PHASE', confidence: 0.5 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (SPY)').evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Neutrales Regime');
    });
  });

  describe('ML Regime Radar (QQQ)', () => {
    it('sollte UNKNOWN zurückgeben, wenn Daten fehlen', () => {
      const timeline = generateTimeline(1);
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (QQQ)').evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
    });

    it('sollte CRITICAL triggern bei MACRO_TOP', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeQqq = { phase: 'MACRO_TOP', confidence: 0.95 };
      let res = engine.indicators.find(i => i.name === 'ML Regime Radar (QQQ)').evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
    });

    it('sollte WARNING triggern bei BEAR_MARKET mit hoher Confidence', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeQqq = { phase: 'BEAR_MARKET', confidence: 0.7 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (QQQ)').evaluate(timeline);
      expect(res.status).toBe('WARNING');
    });

    it('sollte OK (neutral) sein bei unbekannter Phase', () => {
      const timeline = generateTimeline(1);
      timeline[0].mlRegimeQqq = { phase: 'UNKNOWN_PHASE', confidence: 0.5 };
      const res = engine.indicators.find(i => i.name === 'ML Regime Radar (QQQ)').evaluate(timeline);
      expect(res.status).toBe('OK');
      expect(res.message).toContain('Neutrales Regime');
    });
  });
});
