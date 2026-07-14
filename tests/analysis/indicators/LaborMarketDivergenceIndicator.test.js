import { describe, it, expect } from 'vitest';
import LaborMarketDivergenceIndicator from '../../../src/analysis/indicators/LaborMarketDivergenceIndicator.js';

describe('LaborMarketDivergenceIndicator', () => {
  
  const generateTimeline = (overrideFn = null, length = 13) => {
    const timeline = [];
    for(let i = 0; i < length; i++) {
      const day = {
        date: `2024-${String(i+1).padStart(2, '0')}-01`,
        macroGroups: {
          LaborMarket: {
            PAYEMS: 150000 + i * 100,
            CE16OV: 160000 + i * 100,
            LNS12500000: 130000,
            LNS12600000: 25000,
            LNS12026619: 8000
          }
        }
      };
      if (overrideFn) {
        overrideFn(day, i);
      }
      timeline.push(day);
    }
    return timeline;
  };

  it('should return NEUTRAL when there are no divergences', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    const timeline = generateTimeline();
    const result = indicator.evaluate(timeline);
    
    expect(result.status).toBe('NEUTRAL');
    expect(result.signals[0].triggered).toBe(false);
    expect(result.signals[1].triggered).toBe(false);
  });

  it('should trigger LEADING_WARNING when full-time to part-time ratio drops >= 2.5%', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    // Drop full time at index 12 to 126000 and increase part time to 26000
    const timeline = generateTimeline((day, i) => {
      if (i === 12) {
        day.macroGroups.LaborMarket.LNS12500000 = 126000;
        day.macroGroups.LaborMarket.LNS12600000 = 26000;
      }
    });

    const result = indicator.evaluate(timeline);
    
    expect(result.status).toBe('LEADING_WARNING');
    expect(result.signals[0].type).toBe('LEADING');
    expect(result.signals[0].triggered).toBe(true);
    expect(result.signals[0].metrics.ratioDrop).toBeLessThan(-0.025);
    
    expect(result.signals[1].type).toBe('COINCIDENT');
    expect(result.signals[1].triggered).toBe(false);
  });

  it('should trigger COINCIDENT_ALERT when PAYEMS grows but CE16OV shrinks', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    const timeline = generateTimeline((day, i) => {
      if (i === 9) {
        day.macroGroups.LaborMarket.CE16OV = 161000;
      }
      if (i === 12) {
        day.macroGroups.LaborMarket.CE16OV = 160500;
        day.macroGroups.LaborMarket.LNS12026619 = 8200;
      }
    });

    const result = indicator.evaluate(timeline);
    
    expect(result.status).toBe('COINCIDENT_ALERT');
    expect(result.signals[1].triggered).toBe(true);
    expect(result.signals[1].metrics.payemsDelta3M).toBeGreaterThan(0);
    expect(result.signals[1].metrics.ce16ovDelta3M).toBeLessThan(0);
    expect(result.signals[1].metrics.multJobDelta3M).toBeGreaterThan(0);
  });

  it('should escalate to COINCIDENT_ALERT if both leading and coincident are triggered', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    const timeline = generateTimeline((day, i) => {
      if (i === 9) {
        day.macroGroups.LaborMarket.CE16OV = 161000;
      }
      if (i === 12) {
        day.macroGroups.LaborMarket.CE16OV = 160500;
        day.macroGroups.LaborMarket.LNS12500000 = 126000;
        day.macroGroups.LaborMarket.LNS12600000 = 26000;
      }
    });

    const result = indicator.evaluate(timeline);
    
    expect(result.status).toBe('COINCIDENT_ALERT');
    expect(result.signals[0].triggered).toBe(true);
    expect(result.signals[1].triggered).toBe(true);
  });

  it('should handle chaos (Math.random noise) robustly', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    const noise = () => (Math.random() - 0.5) * 10;
    
    const timeline = generateTimeline((day, i) => {
      day.macroGroups.LaborMarket.PAYEMS += noise();
      day.macroGroups.LaborMarket.CE16OV += noise();
      day.macroGroups.LaborMarket.LNS12500000 += noise();
      day.macroGroups.LaborMarket.LNS12600000 += noise();
      day.macroGroups.LaborMarket.LNS12026619 += noise();

      if (i === 9) {
        day.macroGroups.LaborMarket.CE16OV = 161000;
      }
      if (i === 12) {
        day.macroGroups.LaborMarket.CE16OV = 160500;
      }
    });

    const result = indicator.evaluate(timeline);
    expect(result.status).toBe('COINCIDENT_ALERT');
  });

  it('should handle missing data gracefully', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    const resultMissingAll = indicator.evaluate([]);
    expect(resultMissingAll.status).toBe('NEUTRAL');
    
    const timeline = generateTimeline((day) => {
      delete day.macroGroups.LaborMarket.CE16OV;
    });

    const resultMissingSome = indicator.evaluate(timeline);
    expect(resultMissingSome.status).toBe('NEUTRAL');
  });
  
  it('should handle division by zero or NaN gracefully', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    const timeline = generateTimeline((day) => {
      day.macroGroups.LaborMarket.LNS12600000 = 0; // Division by zero
    });

    const result = indicator.evaluate(timeline);
    expect(result.status).toBe('NEUTRAL');
    expect(result.signals[0].triggered).toBe(false);
  });

  it('should fail safely or handle mismatched array lengths (e.g. Household survey published before Establishment survey)', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    // Simulate async data arriving at different dates
    const timeline = generateTimeline((day, i) => {
      if (i === 12) {
        day.macroGroups.LaborMarket.PAYEMS = undefined; // Not published yet for the latest month
      }
    }, 13);

    const result = indicator.evaluate(timeline);
    // Since latest PAYEMS is missing, we don't have enough common dates (we need 13 full overlapping data points)
    // Actually we will have 12 common dates, which is less than 13, so it safely returns NEUTRAL
    expect(result.status).toBe('NEUTRAL');
  });

  it('should handle FRED typical string values and "." for missing values gracefully', () => {
    const indicator = new LaborMarketDivergenceIndicator();
    
    const timeline = generateTimeline((day, i) => {
      // Return strings
      day.macroGroups.LaborMarket.PAYEMS = "150000";
      day.macroGroups.LaborMarket.CE16OV = "160000";
      day.macroGroups.LaborMarket.LNS12500000 = "130000";
      day.macroGroups.LaborMarket.LNS12600000 = "25000";
      day.macroGroups.LaborMarket.LNS12026619 = "8000";

      if (i === 12) {
        day.macroGroups.LaborMarket.PAYEMS = ".";
      }
    });

    const result = indicator.evaluate(timeline);
    expect(result.status).toBe('NEUTRAL');
  });
});
