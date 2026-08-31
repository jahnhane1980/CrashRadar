import fs from 'fs';
import path from 'path';
import { MacroRegimeEngine } from '../src/analysis/MacroRegimeEngine.js';
import { TradeSetupEngine } from '../src/analysis/TradeSetupEngine.js';

function createScenarioData() {
  const data = {};
  const startDate = new Date(2025, 0, 1);

  let currentSpy = 500;
  let currentVix = 14;
  let marginDebt = 900000;
  let totalReserves = 3200;
  let tga = 750;
  let rrp = 400;
  let challenger = 30000;
  let arccPrice = 20.0;
  let spread10y2y = 0.40;

  for (let i = 0; i < 200; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    // Simuliere Phasen:
    // Tage 0-30: Normaler Markt
    // Tage 31-60: Euphorie & Smart Money Stealth Exit (DIX fällt, SKEW hoch, Red Alert)
    // Tage 61-90: Deleveraging (Margin Debt fällt stark) -> Bärenmarkt
    // Tage 91-120: Treasury Stress & Zinsanstieg (Dalio Stress, ARCC fällt, TGA steigt)
    // Tage 121-150: Flash Crash & Panik (VIX > 45, CBOE Extremwerte, Capitulation)
    // Tage 151-180: Gold Kapitulation & Boden-Heilung (Tranchen 1/3, 2/3, 3/3)
    // Tage 181-199: Erholung / Normalisierung

    if (i >= 31 && i <= 60) {
      currentSpy += 1.5;
    } else if (i >= 61 && i <= 90) {
      marginDebt *= 0.985; // Deleveraging
      currentSpy -= 1.0;
    } else if (i >= 91 && i <= 120) {
      arccPrice *= 0.99;
      tga += 5;
      rrp = Math.max(10, rrp - 5);
      challenger += 2000;
    } else if (i >= 121 && i <= 150) {
      currentVix = 48 + (i % 5);
      currentSpy -= 3.0;
    } else if (i >= 151 && i <= 180) {
      currentVix = 20;
      currentSpy += 1.0;
    }

    data[dateStr] = {
      date: dateStr,
      dateStr: dateStr,
      assets: {
        SPY: currentSpy,
        SPY_Volume: 80000000 + (i * 100000),
        QQQ: currentSpy * 0.9,
        QQQ_Volume: 50000000,
        VIX: currentVix,
        SKEW: i >= 31 && i <= 60 ? 148 : 125,
        DIX: i >= 35 && i <= 50 ? 38.5 : 46.0,
        HYG: 76.0 - (i > 90 ? 2 : 0),
        GDX: i >= 151 ? 25 + (i - 150) * 0.5 : 30,
        GDX_Volume: i >= 151 ? 60000000 : 20000000,
        Gold: i >= 151 ? 2400 + (i - 150) * 10 : 2300,
        BTC: 60000 - (i > 80 ? 5000 : 0),
        BTC_Volume: 30000,
        SMH: 220 + (i > 60 ? -10 : 10),
        IGV: 85,
        DXY: 104 + (i > 100 ? 2 : 0),
        ARCC: arccPrice,
        MSTR: 1400 - (i > 80 ? 200 : 0)
      },
      macroGroups: {
        NetLiquidity: {
          TGA: tga,
          WALCL: 6800,
          RRPONTSYD: rrp
        },
        BankingHealth: {
          TotalReserves: totalReserves,
          BankReserves: totalReserves * 1000
        },
        Leading: {
          MarginDebt: marginDebt,
          MaturityWallPct: 10.5,
          Challenger: challenger
        },
        YieldCurve: {
          Spread10y2y: spread10y2y
        },
        FinancialConditions: {
          ChicagoFedIndex: i >= 91 && i <= 130 ? 0.25 : -0.55,
          FedFundsRate: 5.25,
          RealYield10y: 2.1
        },
        TreasuryCapacity: {
          GDP: 29000,
          USGSEC: 4200,
          THREEFYTP10: i >= 95 && i <= 120 ? 0.85 : 0.35,
          BuybackMio: 2500,
          AuctionBillsMio: 80000,
          AuctionCouponsMio: 35000
        }
      },
      SPY_ShortVolumeRatio: i >= 35 && i <= 50 ? 0.38 : 0.52,
      TotalPCR: i >= 121 && i <= 140 ? 1.65 : 0.85
    };
  }

  return data;
}

function main() {
  const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const inputData = createScenarioData();
  const inputPath = path.join(fixturesDir, 'golden_master_input.json');
  fs.writeFileSync(inputPath, JSON.stringify(inputData, null, 2), 'utf8');
  console.log(`Golden Master Input saved: ${inputPath} (${Object.keys(inputData).length} days)`);

  const macroEngine = new MacroRegimeEngine();
  const tradeEngine = new TradeSetupEngine();

  const macroStates = macroEngine.evaluate(inputData);
  const tradeActions = tradeEngine.evaluate(inputData, macroStates);

  const expectedOutput = {
    macroStates,
    tradeActions
  };

  const expectedPath = path.join(fixturesDir, 'golden_master_expected.json');
  fs.writeFileSync(expectedPath, JSON.stringify(expectedOutput, null, 2), 'utf8');
  console.log(`Golden Master Expected Output saved: ${expectedPath}`);
}

main();
