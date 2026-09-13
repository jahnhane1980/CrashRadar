import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../../../src/strategies/GoldSpyDcaStrategy.js';
import { DarkPoolAccumulationIndicator } from '../../../src/analysis/indicators/DarkPoolAccumulationIndicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

class TranchePortfolio {
  constructor(name, mode, startCapitalEUR, startFx, startSpyPrice) {
    this.name = name;
    this.mode = mode; // 'ALL_IN', 'EQUAL_33', '30_40_30'
    this.spyShares = (startCapitalEUR * startFx) / startSpyPrice;
    this.gldShares = 0;
    this.cashUSD = 0;
    this.investedEUR = startCapitalEUR;

    this.peakEUR = startCapitalEUR;
    this.maxDdPct = 0;
    this.maxDdDate = '';

    this.trancheLevel = 0; // 0 = hedge/cash, 1, 2, 3
    this.daysInTranche = 0;
    this.t1SpyPrice = 0;

    // Crisis max drawdowns
    this.crisisDd = {
      lehman2008: { peak: 0, maxDd: 0, date: '' },
      debt2011:   { peak: 0, maxDd: 0, date: '' },
      tight2018:  { peak: 0, maxDd: 0, date: '' },
      corona2020: { peak: 0, maxDd: 0, date: '' },
      rate2022:   { peak: 0, maxDd: 0, date: '' }
    };
  }

  updateValuation(dateStr, spyPrice, gldPrice, fxRate) {
    const valUSD = (this.spyShares * spyPrice) + (this.gldShares * gldPrice) + this.cashUSD;
    const valEUR = valUSD / fxRate;

    if (valEUR > this.peakEUR) this.peakEUR = valEUR;
    const dd = ((valEUR - this.peakEUR) / this.peakEUR) * 100;
    if (dd < this.maxDdPct) {
      this.maxDdPct = dd;
      this.maxDdDate = dateStr;
    }

    // Check crisis intervals
    this.checkCrisisDd('lehman2008', dateStr, '2007-10-01', '2009-06-30', valEUR);
    this.checkCrisisDd('debt2011',   dateStr, '2011-07-01', '2011-12-31', valEUR);
    this.checkCrisisDd('tight2018',  dateStr, '2018-01-01', '2018-12-31', valEUR);
    this.checkCrisisDd('corona2020', dateStr, '2020-02-01', '2020-06-30', valEUR);
    this.checkCrisisDd('rate2022',   dateStr, '2022-01-01', '2022-12-31', valEUR);

    return valEUR;
  }

  checkCrisisDd(crisisKey, dateStr, startD, endD, valEUR) {
    if (dateStr >= startD && dateStr <= endD) {
      const c = this.crisisDd[crisisKey];
      if (valEUR > c.peak) c.peak = valEUR;
      if (c.peak > 0) {
        const dd = ((valEUR - c.peak) / c.peak) * 100;
        if (dd < c.maxDd) {
          c.maxDd = dd;
          c.date = dateStr;
        }
      }
    }
  }

  applyMonthlyDca(dcaEUR, fxRate, spyPrice, gldPrice, currentStatus) {
    this.investedEUR += dcaEUR;
    const dcaUSD = dcaEUR * fxRate;

    if (currentStatus === 'EMERGENCY_HEDGE') {
      this.gldShares += (dcaUSD * 0.75) / gldPrice;
      this.cashUSD += dcaUSD * 0.25;
    } else if (currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE') {
      this.cashUSD += dcaUSD;
    } else if (currentStatus === 'RE_ENTRY_SNIPER') {
      let spyRatio = 1.0;
      if (this.mode === 'EQUAL_33') {
        spyRatio = this.trancheLevel === 1 ? 0.333 : this.trancheLevel === 2 ? 0.666 : 1.0;
      } else if (this.mode === '30_40_30') {
        spyRatio = this.trancheLevel === 1 ? 0.30 : this.trancheLevel === 2 ? 0.70 : 1.0;
      }
      this.spyShares += (dcaUSD * spyRatio) / spyPrice;
      this.cashUSD += dcaUSD * (1 - spyRatio);
    } else {
      // 100% SPY
      this.spyShares += dcaUSD / spyPrice;
    }
  }

  handleSignal(currentStatus, isShieldActive, spyPrice, gldPrice, dpIsCrit, sma20) {
    const totalUSD = (this.spyShares * spyPrice) + (this.gldShares * gldPrice) + this.cashUSD;

    if (currentStatus === 'EMERGENCY_HEDGE') {
      this.trancheLevel = 0;
      this.daysInTranche = 0;
      this.t1SpyPrice = 0;
      this.spyShares = 0;
      this.gldShares = (totalUSD * 0.75) / gldPrice;
      this.cashUSD = totalUSD * 0.25;
      return;
    }

    if (currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE') {
      this.trancheLevel = 0;
      this.daysInTranche = 0;
      this.t1SpyPrice = 0;
      this.spyShares = 0;
      this.gldShares = 0;
      this.cashUSD = totalUSD;
      return;
    }

    if (currentStatus === 'NORMAL_DCA' && !isShieldActive) {
      // Full normal regime
      this.trancheLevel = 3;
      this.daysInTranche = 0;
      this.t1SpyPrice = 0;
      this.spyShares = totalUSD / spyPrice;
      this.gldShares = 0;
      this.cashUSD = 0;
      return;
    }

    // Re-Entry Sniper is active (or transitional state)
    if (this.mode === 'ALL_IN') {
      this.trancheLevel = 3;
      this.spyShares = totalUSD / spyPrice;
      this.gldShares = 0;
      this.cashUSD = 0;
      return;
    }

    if (this.mode === 'EQUAL_33') {
      if (this.trancheLevel === 0) {
        this.trancheLevel = 1;
        this.daysInTranche = 1;
        this.t1SpyPrice = spyPrice;
      } else {
        this.daysInTranche++;
      }

      // Tranche 2 check: 10 days OR SPY dropped >= 5% OR Dark Pool accumulation
      if (this.trancheLevel === 1) {
        const dropped5Pct = this.t1SpyPrice > 0 && ((spyPrice - this.t1SpyPrice) / this.t1SpyPrice) <= -0.05;
        if (this.daysInTranche >= 10 || dropped5Pct || dpIsCrit) {
          this.trancheLevel = 2;
          this.daysInTranche = 1;
        }
      }

      // Tranche 3 check: 10 days after T2 OR SPY > SMA20
      if (this.trancheLevel === 2) {
        const spyAboveSma20 = sma20 && spyPrice > sma20;
        if (this.daysInTranche >= 10 || spyAboveSma20) {
          this.trancheLevel = 3;
        }
      }

      const targetSpyPct = this.trancheLevel === 1 ? 33.3 : this.trancheLevel === 2 ? 66.6 : 100.0;
      const targetSpyUSD = totalUSD * (targetSpyPct / 100);
      this.spyShares = targetSpyUSD / spyPrice;
      this.gldShares = 0;
      this.cashUSD = totalUSD - targetSpyUSD;
      return;
    }

    if (this.mode === '30_40_30') {
      if (this.trancheLevel === 0) {
        this.trancheLevel = 1;
        this.daysInTranche = 1;
        this.t1SpyPrice = spyPrice;
      } else {
        this.daysInTranche++;
      }

      // Tranche 2 check (Wal-Einstieg): Dark Pool accumulation OR 12 days OR SPY dropped >= 6%
      if (this.trancheLevel === 1) {
        const dropped6Pct = this.t1SpyPrice > 0 && ((spyPrice - this.t1SpyPrice) / this.t1SpyPrice) <= -0.06;
        if (dpIsCrit || this.daysInTranche >= 12 || dropped6Pct) {
          this.trancheLevel = 2;
          this.daysInTranche = 1;
        }
      }

      // Tranche 3 check (Trendbestätigung): SPY > SMA20 OR 12 days after T2
      if (this.trancheLevel === 2) {
        const spyAboveSma20 = sma20 && spyPrice > sma20;
        if (spyAboveSma20 || this.daysInTranche >= 12) {
          this.trancheLevel = 3;
        }
      }

      const targetSpyPct = this.trancheLevel === 1 ? 30.0 : this.trancheLevel === 2 ? 70.0 : 100.0;
      const targetSpyUSD = totalUSD * (targetSpyPct / 100);
      this.spyShares = targetSpyUSD / spyPrice;
      this.gldShares = 0;
      this.cashUSD = totalUSD - targetSpyUSD;
    }
  }
}

async function main() {
  console.log('================================================================================');
  console.log('   CRASHRADAR: 21.8 JAHRE TRANCHEN-VERGLEICH (2004 - 2026)');
  console.log('   All-In vs. Gleiche Tranchen (3x 33%) vs. Asymmetrisch (30/40/30%)');
  console.log('================================================================================\n');

  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  const cacheDir = path.resolve(__dirname, '../../trash/cache');
  const fxPath = path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json');
  const fxMap = {};
  if (fs.existsSync(fxPath)) {
    try {
      const fxData = JSON.parse(fs.readFileSync(fxPath, 'utf8'));
      fxData.forEach(q => {
        const d = (q.date || '').substring(0, 10);
        if (d && q.close) fxMap[d] = Number(q.close);
      });
      console.log(`  • FX-Raten geladen: ${Object.keys(fxMap).length} Tage.`);
    } catch (e) {
      console.warn('  • Konnte FX-Cache nicht laden:', e.message);
    }
  }

  rawTimeline.forEach(t => {
    if (t.assets) {
      if (t.assets.Gold && !t.assets.GLD) t.assets.GLD = Number(t.assets.Gold);
      if (t.assets.GLD && !t.assets.Gold) t.assets.Gold = Number(t.assets.GLD);
    }
  });

  const engine = new PortfolioStrategyEngine();
  const km = engine.katastrophenMatrix;

  // Memoization Caches for ultra speed
  const kmCache = new Map();
  const origKmEval = km.evaluate.bind(km);
  km.evaluate = (tl) => {
    const last = tl[tl.length - 1];
    const k = last?.date ? `${last.date}_${tl.length}` : null;
    if (k && kmCache.has(k)) return kmCache.get(k);
    const res = origKmEval(tl);
    if (k) kmCache.set(k, res);
    return res;
  };

  const pc = engine.panicCapitulation;
  const pcCache = new Map();
  const origPcEval = pc.evaluate.bind(pc);
  pc.evaluate = (tl) => {
    const last = tl[tl.length - 1];
    const k = last?.date ? `${last.date}_${tl.length}` : null;
    if (k && pcCache.has(k)) return pcCache.get(k);
    const res = origPcEval(tl);
    if (k) pcCache.set(k, res);
    return res;
  };

  engine.registerStrategy(new GoldSpyDcaStrategy());
  const dpIndicator = new DarkPoolAccumulationIndicator();

  const START_CAPITAL_EUR = 10000;
  const MONTHLY_DCA_EUR = 150;
  const startDayIdx = 200;
  const startDay = rawTimeline[startDayIdx];
  const startFx = fxMap[startDay.date] || 1.25;
  const startSpy = Number(startDay.assets.SPY);
  const startGld = Number(startDay.assets.GLD || startDay.assets.Gold);

  // Benchmarks
  let b1SpyShares = (START_CAPITAL_EUR * startFx) / startSpy;
  let b1InvestedEUR = START_CAPITAL_EUR;
  let b1PeakEUR = START_CAPITAL_EUR;
  let b1MaxDdPct = 0;
  let b1MaxDdDate = '';

  let b2GldShares = (START_CAPITAL_EUR * startFx) / startGld;
  let b2InvestedEUR = START_CAPITAL_EUR;
  let b2PeakEUR = START_CAPITAL_EUR;
  let b2MaxDdPct = 0;
  let b2MaxDdDate = '';

  // 3 Tranche Portfolios
  const pAllIn = new TranchePortfolio('1. All-In Re-Entry (Status Quo)', 'ALL_IN', START_CAPITAL_EUR, startFx, startSpy);
  const pEqual = new TranchePortfolio('2. Gleiche Tranchen (3x 33.3%)', 'EQUAL_33', START_CAPITAL_EUR, startFx, startSpy);
  const p304030 = new TranchePortfolio('3. Asymmetrisch (30/40/30%)', '30_40_30', START_CAPITAL_EUR, startFx, startSpy);
  const portfolios = [pAllIn, pEqual, p304030];

  let lastEvaluatedMonth = '';
  const t0 = Date.now();
  console.log(`Starte 21,8 Jahre Simulation ab ${startDay.date} (${rawTimeline.length - startDayIdx} Handelstage)...`);

  for (let i = startDayIdx; i < rawTimeline.length; i++) {
    const day = rawTimeline[i];
    const dateStr = day.date;
    const spyPrice = Number(day.assets?.SPY);
    const gldPrice = Number(day.assets?.GLD || day.assets?.Gold);
    const fxRate = fxMap[dateStr] || startFx;

    if (!spyPrice || isNaN(spyPrice) || !gldPrice || isNaN(gldPrice)) continue;

    const sliceUntilToday = rawTimeline.slice(0, i + 1);
    const evalResult = await engine.evaluateAll({ date: dateStr, timeline: sliceUntilToday });
    const stratRes = evalResult.strategyResults.GOLD_SPY;
    const macroCtx = evalResult.macroSignalContext;
    const currentStatus = stratRes?.status || 'NORMAL_DCA';
    const isShieldActive = macroCtx.katastrophenMatrix?.isShieldActive || false;

    // Dark Pool and 20-day SMA for tranche triggers
    const dpRes = dpIndicator.evaluate(sliceUntilToday);
    const dpIsCrit = dpRes?.status === 'CRITICAL';

    let sma20 = null;
    if (sliceUntilToday.length >= 20) {
      let sum = 0;
      for (let s = sliceUntilToday.length - 20; s < sliceUntilToday.length; s++) {
        sum += Number(sliceUntilToday[s].assets?.SPY);
      }
      sma20 = sum / 20;
    }

    // Monthly DCA
    const monthStr = dateStr.substring(0, 7);
    const isNewMonth = monthStr !== lastEvaluatedMonth;
    lastEvaluatedMonth = monthStr;

    if (isNewMonth && i > startDayIdx) {
      const dcaUSD = MONTHLY_DCA_EUR * fxRate;
      b1SpyShares += dcaUSD / spyPrice;
      b1InvestedEUR += MONTHLY_DCA_EUR;

      b2GldShares += dcaUSD / gldPrice;
      b2InvestedEUR += MONTHLY_DCA_EUR;

      for (const p of portfolios) {
        p.applyMonthlyDca(MONTHLY_DCA_EUR, fxRate, spyPrice, gldPrice, currentStatus);
      }
    }

    // Handle strategy allocation
    for (const p of portfolios) {
      p.handleSignal(currentStatus, isShieldActive, spyPrice, gldPrice, dpIsCrit, sma20);
      p.updateValuation(dateStr, spyPrice, gldPrice, fxRate);
    }

    // Benchmark Valuation
    const b1Val = (b1SpyShares * spyPrice) / fxRate;
    if (b1Val > b1PeakEUR) b1PeakEUR = b1Val;
    const b1Dd = ((b1Val - b1PeakEUR) / b1PeakEUR) * 100;
    if (b1Dd < b1MaxDdPct) {
      b1MaxDdPct = b1Dd;
      b1MaxDdDate = dateStr;
    }

    const b2Val = (b2GldShares * gldPrice) / fxRate;
    if (b2Val > b2PeakEUR) b2PeakEUR = b2Val;
    const b2Dd = ((b2Val - b2PeakEUR) / b2PeakEUR) * 100;
    if (b2Dd < b2MaxDdPct) {
      b2MaxDdPct = b2Dd;
      b2MaxDdDate = dateStr;
    }

    if ((i - startDayIdx) % 1500 === 0 && i > startDayIdx) {
      console.log(`  • Tag ${i - startDayIdx}/${rawTimeline.length - startDayIdx} (${dateStr}) fertig...`);
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nSimulation in ${dur}s beendet!\n`);

  const lastDay = rawTimeline[rawTimeline.length - 1];
  const lastFx = fxMap[lastDay.date] || 1.10;
  const lastSpy = Number(lastDay.assets.SPY);
  const lastGld = Number(lastDay.assets.GLD || lastDay.assets.Gold);

  const b1FinalEUR = (b1SpyShares * lastSpy) / lastFx;
  const b2FinalEUR = (b2GldShares * lastGld) / lastFx;

  console.log('================================================================================');
  console.log('   GESAMTERGEBNIS: 21,8 JAHRE PERFORMANCE & ALLZEIT-DRAWDOWN (2004 - 2026)');
  console.log('================================================================================');
  console.log(`S&P 500 Buy & Hold DCA:    € ${b1FinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Max DD: ${b1MaxDdPct.toFixed(2)}% (${b1MaxDdDate})`);
  console.log(`Gold Buy & Hold DCA:       € ${b2FinalEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} | Max DD: ${b2MaxDdPct.toFixed(2)}% (${b2MaxDdDate})\n`);

  for (const p of portfolios) {
    const finalValEUR = ((p.spyShares * lastSpy) + (p.gldShares * lastGld) + p.cashUSD) / lastFx;
    const profitEUR = finalValEUR - p.investedEUR;
    const profitPct = (profitEUR / p.investedEUR) * 100;
    const alphaVsSpy = profitEUR - (b1FinalEUR - b1InvestedEUR);

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`▶ ${p.name.toUpperCase()}`);
    console.log(`  Endvermögen:       € ${finalValEUR.toLocaleString('de-DE', { minimumFractionDigits: 2 })} (Gewinn: +${profitPct.toFixed(1)}%)`);
    console.log(`  Alpha vs. SPY DCA: +€ ${alphaVsSpy.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`);
    console.log(`  Allzeit Max DD:    ${p.maxDdPct.toFixed(2)}% am ${p.maxDdDate}`);
    console.log(`  Krisen-Drawdowns:`);
    console.log(`    • 2008 Lehman:   ${p.crisisDd.lehman2008.maxDd.toFixed(2)}% (${p.crisisDd.lehman2008.date})`);
    console.log(`    • 2011 Schulden: ${p.crisisDd.debt2011.maxDd.toFixed(2)}% (${p.crisisDd.debt2011.date})`);
    console.log(`    • 2018 Fed-Zins: ${p.crisisDd.tight2018.maxDd.toFixed(2)}% (${p.crisisDd.tight2018.date})`);
    console.log(`    • 2020 Corona:   ${p.crisisDd.corona2020.maxDd.toFixed(2)}% (${p.crisisDd.corona2020.date})`);
    console.log(`    • 2022 Bärenm.:  ${p.crisisDd.rate2022.maxDd.toFixed(2)}% (${p.crisisDd.rate2022.date})`);
  }
}

main().catch(console.error);
