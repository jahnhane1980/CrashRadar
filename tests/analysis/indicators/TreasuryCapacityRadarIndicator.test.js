import { describe, it, expect } from 'vitest';
import { TreasuryCapacityRadarIndicator } from '../../../src/analysis/indicators/TreasuryCapacityRadarIndicator.js';

describe('TreasuryCapacityRadarIndicator', () => {
  const indicator = new TreasuryCapacityRadarIndicator();

  it('should return UNKNOWN for empty or short timeline (< 21 days)', () => {
    const resEmpty = indicator.evaluate([]);
    expect(resEmpty.status).toBe('UNKNOWN');

    const resShort = indicator.evaluate(Array(15).fill({ macroGroups: {} }));
    expect(resShort.status).toBe('UNKNOWN');
  });

  it('should return UNKNOWN when required macro fields (BankingHealth/NetLiquidity) are missing', () => {
    const timeline = Array(30).fill({
      macroGroups: {
        NetLiquidity: {},
        BankingHealth: {}
      }
    });
    const res = indicator.evaluate(timeline);
    expect(res.status).toBe('UNKNOWN');
  });

  it('should return OK when liquid slack is large and rate stress is low (Green Regime)', () => {
    const timeline = Array(60).fill(null).map((_, i) => ({
      macroGroups: {
        NetLiquidity: { TGA: 200, WALCL: 7000, RRPONTSYD: 2000 },
        BankingHealth: { BankReserves: 3500 },
        FinancialConditions: { RealYield10y: 1.0, FedFundsRate: 3.0 },
        TreasuryCapacity: {
          GDP: 28000,
          THREEFYTP10: 0.10,
          USGSEC: 2000000,
          AuctionBillsMio: 10000,
          AuctionCouponsMio: 2000,
          AuctionDv01: 5,
          BuybackMio: 0,
          BuybackDv01: 0
        }
      }
    }));

    const res = indicator.evaluate(timeline);
    expect(res.status).toBe('OK');
    expect(res.details.liquidSlackBillion).toBeGreaterThan(1000);
    expect(res.message).toContain('entspannt');
  });

  it('should detect acute Liquidity Slack exhaustion and calculate post-election collision window', () => {
    const timeline = Array(60).fill(null).map((_, i) => ({
      macroGroups: {
        NetLiquidity: { TGA: 950, WALCL: 6730, RRPONTSYD: 0.18 },
        BankingHealth: { BankReserves: 2924.9 }, // unter LCLOR von ~3411B
        FinancialConditions: { RealYield10y: 2.45, FedFundsRate: 5.25 },
        TreasuryCapacity: {
          GDP: 32486,
          THREEFYTP10: 0.86,
          USGSEC: 4800,
          AuctionBillsMio: 15000,
          AuctionCouponsMio: 10000,
          AuctionDv01: 25,
          BuybackMio: 8000,
          BuybackDv01: 4
        }
      }
    }));

    const res = indicator.evaluate(timeline);
    expect(['WARNING', 'CRITICAL']).toContain(res.status);
    expect(res.projectedCollision).toContain('26.10.2026 - 10.11.2026');
    expect(res.details.liquidSlackBillion).toBeLessThan(1.0);
    expect(res.details.monthlyBuybacksBillion).toBeGreaterThan(5.0);
  });

  it('should trigger Rate / Duration Stress when Term Premium surges (Aug 2023 scenario)', () => {
    const timeline = Array(60).fill(null).map((_, i) => ({
      macroGroups: {
        NetLiquidity: { TGA: 500, WALCL: 7500, RRPONTSYD: 1500 }, // Viel Slack
        BankingHealth: { BankReserves: 3400 },
        FinancialConditions: { RealYield10y: i > 40 ? 2.50 : 1.50, FedFundsRate: 5.0 },
        TreasuryCapacity: {
          GDP: 27000,
          THREEFYTP10: i > 40 ? 0.65 : 0.05, // +60 bps Surge!
          USGSEC: 2000000,
          AuctionBillsMio: 2000,
          AuctionCouponsMio: 25000, // Hoher Kupon-Anteil
          AuctionDv01: 40,
          BuybackMio: 0,
          BuybackDv01: 0
        }
      }
    }));

    const res = indicator.evaluate(timeline);
    expect(res.details.rateValuationStress).toBeGreaterThan(50);
  });
});
