import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MacroRegimeEngine } from '../../src/analysis/MacroRegimeEngine.js';
import { TradeSetupEngine } from '../../src/analysis/TradeSetupEngine.js';

describe('Golden Master Regression Suite (0-Diff Charakterisierungs-Test)', () => {
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
  const inputPath = path.join(fixturesDir, 'golden_master_input.json');
  const expectedPath = path.join(fixturesDir, 'golden_master_expected.json');

  const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

  it('sollte MacroRegimeEngine exakt identisch zur Golden-Master Baseline auswerten', () => {
    const macroEngine = new MacroRegimeEngine();
    const actualMacroStates = macroEngine.evaluate(inputData);

    const dates = Object.keys(inputData);
    expect(Object.keys(actualMacroStates).length).toBe(dates.length);

    for (const d of dates) {
      const actual = actualMacroStates[d];
      const expected = expectedData.macroStates[d];

      expect(actual.regime, `Regime-Mismatch am ${d}`).toBe(expected.regime);
      expect(actual.liquidityStatus, `LiquidityStatus-Mismatch am ${d}`).toBe(expected.liquidityStatus);
      expect(actual.vetos, `Vetos-Mismatch am ${d}`).toEqual(expected.vetos);
      
      // Indikatoren-Anzahl und Status abgleichen
      expect(actual.indicatorDetails.length, `Indicator-Count-Mismatch am ${d}`).toBe(expected.indicatorDetails.length);
      for (let idx = 0; idx < actual.indicatorDetails.length; idx++) {
        expect(actual.indicatorDetails[idx].name).toBe(expected.indicatorDetails[idx].name);
        expect(actual.indicatorDetails[idx].status).toBe(expected.indicatorDetails[idx].status);
      }
    }
  });

  it('sollte TradeSetupEngine exakt identisch zur Golden-Master Baseline filtern und skalieren', () => {
    const macroEngine = new MacroRegimeEngine();
    const tradeEngine = new TradeSetupEngine();

    const actualMacroStates = macroEngine.evaluate(inputData);
    const actualTradeActions = tradeEngine.evaluate(inputData, actualMacroStates);

    const dates = Object.keys(inputData);
    expect(Object.keys(actualTradeActions).length).toBe(dates.length);

    for (const d of dates) {
      const actualActions = actualTradeActions[d] || [];
      const expectedActions = expectedData.tradeActions[d] || [];

      expect(actualActions.length, `TradeActions-Count Mismatch am ${d}`).toBe(expectedActions.length);

      for (let idx = 0; idx < actualActions.length; idx++) {
        const act = actualActions[idx];
        const exp = expectedActions[idx];

        expect(act.indicator, `Action Indicator Mismatch am ${d}`).toBe(exp.indicator);
        expect(act.targetAsset, `Action TargetAsset Mismatch am ${d}`).toBe(exp.targetAsset);
        expect(act.status, `Action Status Mismatch am ${d}`).toBe(exp.status);
        expect(act.blocked, `Action Blocked Mismatch am ${d} (${act.indicator})`).toBe(exp.blocked);
        expect(act.blockReason, `Action BlockReason Mismatch am ${d} (${act.indicator})`).toBe(exp.blockReason);
        expect(act.scaleDown, `Action ScaleDown Mismatch am ${d} (${act.indicator})`).toBe(exp.scaleDown);
        expect(act.confluenceScore, `Action ConfluenceScore Mismatch am ${d}`).toBe(exp.confluenceScore);
        expect(act.trancheLevel, `Action TrancheLevel Mismatch am ${d}`).toBe(exp.trancheLevel);
        expect(act.targetAllocationPct, `Action Allocation Mismatch am ${d}`).toBe(exp.targetAllocationPct);
      }
    }
  });
});
