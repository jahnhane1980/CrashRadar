import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { PortfolioStrategyEngine } from '../../../src/strategies/PortfolioStrategyEngine.js';
import { GoldSpyDcaStrategy } from '../../../src/strategies/GoldSpyDcaStrategy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function traceDrawdown2020() {
  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
  await fe.close();

  const engine = new PortfolioStrategyEngine();
  const km = engine.katastrophenMatrix;
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

  const strategy = new GoldSpyDcaStrategy();
  engine.registerStrategy(strategy);

  engine.goldSniper.katastrophenMatrix = km;
  engine.goldSniper.panicCapitulation = pc;

  // Harmonisierung Gold
  rawTimeline.forEach(t => {
    if (t.assets) {
      if (t.assets.Gold && !t.assets.GLD) t.assets.GLD = Number(t.assets.Gold);
      if (t.assets.GLD && !t.assets.Gold) t.assets.Gold = Number(t.assets.GLD);
    }
  });

  const START_CAPITAL_EUR = 10000;
  const MONTHLY_DCA_EUR = 150;
  const startDayIdx = 200;
  const startDay = rawTimeline[startDayIdx];
  const startFx = 1.25;
  const startSpy = Number(startDay.assets.SPY);

  let stratSpyShares = (START_CAPITAL_EUR * startFx) / startSpy;
  let stratGldShares = 0;
  let stratCashUSD = 0;
  let stratPeakEUR = 0;
  let stratMaxDdPct = 0;
  let stratMaxDdDate = '';
  let currentEpisode = null;
  let lastEvaluatedMonth = '';

  for (let i = startDayIdx; i < rawTimeline.length; i++) {
    const currentDay = rawTimeline[i];
    const dateStr = currentDay.date;
    const spyPrice = Number(currentDay.assets?.SPY);
    const gldPrice = Number(currentDay.assets?.GLD || currentDay.assets?.Gold);
    const fxRate = 1.15; // default fx

    if (!spyPrice || isNaN(spyPrice) || !gldPrice || isNaN(gldPrice)) continue;

    const monthStr = dateStr.substring(0, 7);
    const isNewMonth = monthStr !== lastEvaluatedMonth;
    lastEvaluatedMonth = monthStr;

    const sliceUntilToday = rawTimeline.slice(0, i + 1);
    const evalResult = await engine.evaluateAll({
      date: dateStr,
      timeline: sliceUntilToday
    });

    const stratRes = evalResult.strategyResults.GOLD_SPY;
    const currentStatus = stratRes?.status || 'NORMAL_DCA';
    const targetAlloc = stratRes?.targetAllocationPct || { SPY: 100, GLD: 0, CASH: 0 };

    // DCA
    if (isNewMonth) {
      const dcaUSD = MONTHLY_DCA_EUR * fxRate;
      const spyAllocationUSD = dcaUSD * ((targetAlloc.SPY || 0) / 100);
      const gldAllocationUSD = dcaUSD * ((targetAlloc.GLD || 0) / 100);
      const cashAllocationUSD = dcaUSD * ((targetAlloc.CASH || 0) / 100);

      if (spyAllocationUSD > 0) stratSpyShares += spyAllocationUSD / spyPrice;
      if (gldAllocationUSD > 0) stratGldShares += gldAllocationUSD / gldPrice;
      if (cashAllocationUSD > 0) stratCashUSD += cashAllocationUSD;
    }

    // Reallokation
    const isHedgeActive = (currentStatus === 'EMERGENCY_HEDGE' || currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE');

    if (isHedgeActive) {
      if (!currentEpisode) {
        const currentDepotUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;
        currentEpisode = { startDate: dateStr };
        stratSpyShares = 0;
        const targetGoldUSD = currentDepotUSD * ((targetAlloc.GLD || 75) / 100);
        const targetCashUSD = currentDepotUSD * ((targetAlloc.CASH || 25) / 100);
        stratGldShares = targetGoldUSD / gldPrice;
        stratCashUSD = targetCashUSD;
      } else {
        if (currentStatus === 'PRE_MARGIN_CASH_LOCK' || currentStatus === 'MARGIN_CALL_ACTIVE') {
          if (stratGldShares > 0) {
            stratCashUSD += stratGldShares * gldPrice;
            stratGldShares = 0;
          }
        }
      }
    } else {
      if (currentEpisode) {
        const finalDepotUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;
        currentEpisode = null;
        stratSpyShares = finalDepotUSD / spyPrice;
        stratGldShares = 0;
        stratCashUSD = 0;
      }
    }

    const stratValUSD = (stratSpyShares * spyPrice) + (stratGldShares * gldPrice) + stratCashUSD;
    const stratValEUR = stratValUSD / fxRate;
    if (stratValEUR > stratPeakEUR) stratPeakEUR = stratValEUR;
    const stratDd = ((stratValEUR - stratPeakEUR) / stratPeakEUR) * 100;
    if (stratDd < stratMaxDdPct) {
      stratMaxDdPct = stratDd;
      stratMaxDdDate = dateStr;
    }

    if (dateStr >= '2020-02-15' && dateStr <= '2020-04-05') {
      console.log(`${dateStr} | SPY: ${spyPrice.toFixed(1)} | GLD: ${gldPrice.toFixed(1)} | Status: ${currentStatus.padEnd(20)} | Act: ${stratRes?.trancheAction || ''} | ValEUR: €${stratValEUR.toFixed(0)} | Peak: €${stratPeakEUR.toFixed(0)} | DD: ${stratDd.toFixed(2)}% | GoldShr: ${stratGldShares.toFixed(1)} | Cash: $${stratCashUSD.toFixed(0)} | SpyShr: ${stratSpyShares.toFixed(1)}`);
    }

    if (dateStr > '2020-04-10') break;
  }

  console.log(`\nMax Drawdown until April 2020: ${stratMaxDdPct.toFixed(2)}% on ${stratMaxDdDate}`);
}

traceDrawdown2020().catch(console.error);
