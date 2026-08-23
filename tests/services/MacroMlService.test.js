import { describe, it, expect, beforeEach } from 'vitest';
import { MacroMlService } from '../../src/services/MacroMlService.js';

describe('MacroMlService', () => {
  let service;

  beforeEach(() => {
    service = new MacroMlService('macro_regime');
  });

  it('throws an error if model files do not exist', () => {
    const invalidService = new MacroMlService('non_existent_model_xyz');
    expect(() => invalidService.loadModelSync()).toThrow(/nicht gefunden/);
  });

  it('auto-loads model synchronously on predict() if not previously loaded', () => {
    const freshService = new MacroMlService('macro_regime');
    expect(freshService.model).toBeNull();
    const result = freshService.predict({});
    expect(freshService.model).toBeDefined();
    expect(result).toHaveProperty('riskPct');
  });

  it('loads the XGBoost model JSON and metadata into memory asynchronously', async () => {
    await service.loadModel();
    expect(service.model).toBeDefined();
    expect(service.trees.length).toBeGreaterThan(0);
    expect(service.featureNames.length).toBeGreaterThan(0);
  });

  it('evaluates probability, riskPct, and regime correctly for live sample', async () => {
    await service.loadModel();

    const sample = {
      Spread_10Y_2Y_Current: 0.50,
      Spread_10Y_2Y_Delta30d: 0.16,
      Spread_10Y_3M_Current: 0.50,
      FedFundsRate_DFF: 4.33,
      BankReserves_TOTRESNS_B: 3018.8,
      WRESBAL_Delta56d_B: -50.0,
      TGA_Balance_B: 935.1,
      TGA_Delta90d_B: 109.5,
      ReverseRepo_RRPONTSYD_B: 0.2,
      ReverseRepo_Delta30d_B: -5.0,
      FedBalance_WALCL_B: 6745.7,
      MarginDebt_Amount_M: 1417225,
      MarginDebt_Drawdown180d_Pct: 0.0,
      ChicagoFed_NFCI: -0.559,
      SKEW_Index: 143.9,
      AAII_BullBear_Spread_Pct: -4.4,
      DIX_DarkPool_Pct: 46.3,
      SPY_ShortVolumeRatio_Pct: 55.7,
      Total_PutCall_Ratio_PCR: 1.16,
      Gold_Close: 4661.6,
      DXY_Close: 98.84
    };

    const result = service.predict(sample);
    expect(result).toHaveProperty('probability');
    expect(result).toHaveProperty('riskPct');
    expect(result).toHaveProperty('regime');
    expect(result.probability).toBeGreaterThanOrEqual(0.0);
    expect(result.probability).toBeLessThanOrEqual(1.0);
    expect(result.riskPct).toBeGreaterThanOrEqual(0.0);
    expect(result.riskPct).toBeLessThanOrEqual(100.0);
    expect(['NORMAL', 'ELEVATED_RISK', 'ACUTE_CRASH_RISK']).toContain(result.regime);
  });

  it('handles missing or empty features gracefully via default tree paths', async () => {
    await service.loadModel();
    const emptyResult = service.predict({});
    expect(emptyResult.probability).toBeGreaterThanOrEqual(0.0);
    expect(emptyResult.probability).toBeLessThanOrEqual(1.0);
    expect(typeof emptyResult.riskPct).toBe('number');
  });
});
