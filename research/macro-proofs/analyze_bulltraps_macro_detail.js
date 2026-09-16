import dotenv from 'dotenv';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';

dotenv.config();

async function inspectTraps() {
  const fe = new FinanceExpert();
  const timeline = await fe.getDailyGroupedData('2018-01-01', { bypassMemoryGuard: true });

  const trapDates = ['2020-02-21', '2022-04-15', '2022-08-19', '2025-02-21', '2025-03-21'];

  for (const d of trapDates) {
    const idx = timeline.findIndex(t => t.date >= d);
    if (idx === -1) continue;
    const cur = timeline[idx];
    const prev21 = timeline[Math.max(0, idx - 21)];
    const prev42 = timeline[Math.max(0, idx - 42)];

    const curNl = cur.macroGroups?.NetLiquidity?.NetLiquidity;
    const prev21Nl = prev21.macroGroups?.NetLiquidity?.NetLiquidity;
    const nlDelta4w = prev21Nl ? ((curNl - prev21Nl) / prev21Nl) * 100 : 0;

    const rrp = cur.macroGroups?.NetLiquidity?.RRPONTSYD;
    const tga = cur.macroGroups?.NetLiquidity?.TGA;
    const walcl = cur.macroGroups?.NetLiquidity?.WALCL;
    const bankReserves = cur.macroGroups?.BankingHealth?.BankReserves;
    const realYield = cur.macroGroups?.FinancialConditions?.RealYield10y;
    const fedFunds = cur.macroGroups?.FinancialConditions?.FedFundsRate;
    const dxy = cur.macroGroups?.FinancialConditions?.DXY;

    console.log(`\n=================== TRAP: ${d} ===================`);
    console.log(`SPY: ${cur.assets?.SPY}`);
    console.log(`NetLiquidity: $${curNl?.toFixed(0)}B (4w-Delta: ${nlDelta4w.toFixed(2)}%)`);
    console.log(`WALCL (Fed BS): $${walcl?.toFixed(0)}B | TGA: $${tga?.toFixed(0)}B | RRP: $${rrp?.toFixed(0)}B`);
    console.log(`Bank Reserves: $${bankReserves?.toFixed(0)}B`);
    console.log(`Real Yield 10y: ${realYield}% | Fed Funds: ${fedFunds}% | DXY: ${dxy}`);
  }
}

inspectTraps().catch(console.error);
