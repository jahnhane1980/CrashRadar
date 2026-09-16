import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../src/services/FinanceExpert.js';
import { CryptoSensorHub } from '../src/signals/hubs/CryptoSensorHub.js';
import { MacroStressSensorHub } from '../src/signals/hubs/MacroStressSensorHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const cacheDir = path.resolve(__dirname, '../data/cache/historical_prices');
const mstrCachePath = path.resolve(__dirname, '../data/cache/strategies/prices/MSTR_2014-10-01_2026-09-06.json');

async function compareSatelliteHandling() {
  console.log('================================================================');
  console.log('   SATELLITE STRATEGIE: OPTION A (PURE HODL) VS. OPTION B (AIRBAG)');
  console.log('================================================================\n');

  // Lade Kurse: SPY, DFNS, BTC, GLD, MSTR
  const spyQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'SPY_2004-11-18_2026-09-08.json'), 'utf8'));
  const gldQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_2004-11-18_2026-09-08.json'), 'utf8'));
  const btcQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'BTC-USD_2014-10-01_2026-09-06.json'), 'utf8'));
  const dfnsQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'DFNS_L_2023-04-01_2026-09-08.json'), 'utf8'));
  const mstrQuotes = JSON.parse(fs.readFileSync(mstrCachePath, 'utf8'));

  const spyMap = new Map(spyQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));
  const gldMap = new Map(gldQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));
  const btcMap = new Map(btcQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));
  const dfnsMap = new Map(dfnsQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));
  const mstrMap = new Map(mstrQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));

  // Wir testen ab DFNS-Auflage (April 2023 bis September 2026)
  const commonDates = Array.from(dfnsMap.keys())
    .filter(d => spyMap.has(d) && btcMap.has(d) && gldMap.has(d) && mstrMap.has(d))
    .sort();

  console.log(`Gemeinsame Handelstage (DFNS, SPY, BTC, GLD, MSTR): ${commonDates.length} Tage (${commonDates[0]} bis ${commonDates[commonDates.length - 1]})\n`);

  // Baue Timeline für Hubs
  const fe = new FinanceExpert();
  const rawTimeline = await fe.getDailyGroupedData('2020-01-01', { bypassMemoryGuard: true });
  await fe.close();

  const timelineMap = new Map(rawTimeline.map(t => [t.date, t]));

  const cryptoHub = new CryptoSensorHub();
  const macroHub = new MacroStressSensorHub();

  // Simulation Setup
  const START_CAPITAL = 10000;
  const MONTHLY_RATE = 150;

  // Portfolio A: PURE HODL (Option A)
  let portA = {
    spyShares: 0,
    dfnsShares: 0,
    btcShares: 0,
    gldShares: 0,
    cashUSD: START_CAPITAL,
    isShieldActive: false
  };

  // Portfolio B: MSTR-AIRBAG OHNE DÄMPFER
  let portB = {
    spyShares: 0,
    dfnsShares: 0,
    btcShares: 0,
    btcCashUSD: 0,
    gldShares: 0,
    cashUSD: START_CAPITAL,
    isShieldActive: false,
    btcTrades: 0
  };

  // Portfolio C: MSTR-AIRBAG MIT 10-TAGE DÄMPFER (Hysterese)
  let portC = {
    spyShares: 0,
    dfnsShares: 0,
    btcShares: 0,
    btcCashUSD: 0,
    gldShares: 0,
    cashUSD: START_CAPITAL,
    isShieldActive: false,
    btcTrades: 0,
    daysInHedge: 0
  };

  let totalDeposited = START_CAPITAL;
  let lastMonth = null;
  let initialDay = true;

  // Track Drawdown & Equity Curves
  let peakA = 0, maxDdA = 0;
  let peakB = 0, maxDdB = 0;
  let peakC = 0, maxDdC = 0;

  for (const date of commonDates) {
    const pSpy = spyMap.get(date);
    const pDfns = dfnsMap.get(date);
    const pBtc = btcMap.get(date);
    const pGld = gldMap.get(date);

    // Hub Auswertung
    const historySlice = rawTimeline.filter(t => t.date <= date);
    const currentEntry = historySlice[historySlice.length - 1];
    if (currentEntry) {
      if (!currentEntry.assets) currentEntry.assets = {};
      currentEntry.assets.MSTR = mstrMap.get(date);
      currentEntry.assets.BTC = pBtc;
      currentEntry.assets.SPY = pSpy;
    }

    const macroRes = macroHub.evaluate(historySlice);
    const cryptoRes = cryptoHub.evaluate(historySlice);

    const isSystemCrash = macroRes.isShieldActive;
    const isBtcBear = cryptoRes.regime === 'BULL_CRITICAL' || cryptoRes.regime === 'BEAR_REGIME';

    // 1. Initialisierung an Tag 1
    if (initialDay) {
      // Port A
      portA.spyShares = (portA.cashUSD * 0.80) / pSpy;
      portA.dfnsShares = (portA.cashUSD * 0.15) / pDfns;
      portA.btcShares = (portA.cashUSD * 0.05) / pBtc;
      portA.cashUSD = 0;

      // Port B
      portB.spyShares = (portB.cashUSD * 0.80) / pSpy;
      portB.dfnsShares = (portB.cashUSD * 0.15) / pDfns;
      if (isBtcBear) {
        portB.btcCashUSD = portB.cashUSD * 0.05;
      } else {
        portB.btcShares = (portB.cashUSD * 0.05) / pBtc;
      }
      portB.cashUSD = 0;

      // Port C
      portC.spyShares = (portC.cashUSD * 0.80) / pSpy;
      portC.dfnsShares = (portC.cashUSD * 0.15) / pDfns;
      if (isBtcBear) {
        portC.btcCashUSD = portC.cashUSD * 0.05;
        portC.daysInHedge = 1;
      } else {
        portC.btcShares = (portC.cashUSD * 0.05) / pBtc;
      }
      portC.cashUSD = 0;

      initialDay = false;
    }

    // 2. Sparrate am 1. des Monats
    const curMonth = date.substring(0, 7);
    if (curMonth !== lastMonth) {
      totalDeposited += MONTHLY_RATE;

      // Port A
      if (portA.isShieldActive) {
        portA.gldShares += (MONTHLY_RATE * 0.50) / pGld;
        portA.cashUSD += (MONTHLY_RATE * 0.50);
      } else {
        portA.spyShares += (MONTHLY_RATE * 0.80) / pSpy;
        portA.dfnsShares += (MONTHLY_RATE * 0.15) / pDfns;
        portA.btcShares += (MONTHLY_RATE * 0.05) / pBtc;
      }

      // Port B
      if (portB.isShieldActive) {
        portB.gldShares += (MONTHLY_RATE * 0.50) / pGld;
        portB.cashUSD += (MONTHLY_RATE * 0.50);
      } else {
        portB.spyShares += (MONTHLY_RATE * 0.80) / pSpy;
        portB.dfnsShares += (MONTHLY_RATE * 0.15) / pDfns;
        if (isBtcBear) {
          portB.btcCashUSD += (MONTHLY_RATE * 0.05);
        } else {
          portB.btcShares += (MONTHLY_RATE * 0.05) / pBtc;
        }
      }

      // Port C
      if (portC.isShieldActive) {
        portC.gldShares += (MONTHLY_RATE * 0.50) / pGld;
        portC.cashUSD += (MONTHLY_RATE * 0.50);
      } else {
        portC.spyShares += (MONTHLY_RATE * 0.80) / pSpy;
        portC.dfnsShares += (MONTHLY_RATE * 0.15) / pDfns;
        if (portC.btcCashUSD > 0 || isBtcBear) {
          portC.btcCashUSD += (MONTHLY_RATE * 0.05);
        } else {
          portC.btcShares += (MONTHLY_RATE * 0.05) / pBtc;
        }
      }

      lastMonth = curMonth;
    }

    // 3. Makro-Notfall Stecker
    if (isSystemCrash) {
      if (!portA.isShieldActive) {
        portA.isShieldActive = true;
        const valA = (portA.spyShares * pSpy) + (portA.dfnsShares * pDfns) + (portA.btcShares * pBtc) + portA.cashUSD;
        portA.spyShares = 0; portA.dfnsShares = 0; portA.btcShares = 0;
        portA.gldShares = (valA * 0.50) / pGld;
        portA.cashUSD = (valA * 0.50);
      }
      if (!portB.isShieldActive) {
        portB.isShieldActive = true;
        const valB = (portB.spyShares * pSpy) + (portB.dfnsShares * pDfns) + (portB.btcShares * pBtc) + portB.btcCashUSD + portB.cashUSD;
        portB.spyShares = 0; portB.dfnsShares = 0; portB.btcShares = 0; portB.btcCashUSD = 0;
        portB.gldShares = (valB * 0.50) / pGld;
        portB.cashUSD = (valB * 0.50);
      }
      if (!portC.isShieldActive) {
        portC.isShieldActive = true;
        const valC = (portC.spyShares * pSpy) + (portC.dfnsShares * pDfns) + (portC.btcShares * pBtc) + portC.btcCashUSD + portC.cashUSD;
        portC.spyShares = 0; portC.dfnsShares = 0; portC.btcShares = 0; portC.btcCashUSD = 0;
        portC.daysInHedge = 0;
        portC.gldShares = (valC * 0.50) / pGld;
        portC.cashUSD = (valC * 0.50);
      }
    } else {
      // Re-Entry Notfall
      if (portA.isShieldActive) {
        portA.isShieldActive = false;
        const valA = (portA.gldShares * pGld) + portA.cashUSD;
        portA.gldShares = 0; portA.cashUSD = 0;
        portA.spyShares = (valA * 0.80) / pSpy;
        portA.dfnsShares = (valA * 0.15) / pDfns;
        portA.btcShares = (valA * 0.05) / pBtc;
      }
      if (portB.isShieldActive) {
        portB.isShieldActive = false;
        const valB = (portB.gldShares * pGld) + portB.cashUSD;
        portB.gldShares = 0; portB.cashUSD = 0;
        portB.spyShares = (valB * 0.80) / pSpy;
        portB.dfnsShares = (valB * 0.15) / pDfns;
        if (isBtcBear) {
          portB.btcCashUSD = valB * 0.05;
          portB.btcShares = 0;
        } else {
          portB.btcShares = (valB * 0.05) / pBtc;
          portB.btcCashUSD = 0;
        }
      }
      if (portC.isShieldActive) {
        portC.isShieldActive = false;
        const valC = (portC.gldShares * pGld) + portC.cashUSD;
        portC.gldShares = 0; portC.cashUSD = 0;
        portC.spyShares = (valC * 0.80) / pSpy;
        portC.dfnsShares = (valC * 0.15) / pDfns;
        if (isBtcBear) {
          portC.btcCashUSD = valC * 0.05;
          portC.btcShares = 0;
          portC.daysInHedge = 1;
        } else {
          portC.btcShares = (valC * 0.05) / pBtc;
          portC.btcCashUSD = 0;
          portC.daysInHedge = 0;
        }
      }

      // 4. KRYPTO-HANDLING
      if (!portB.isShieldActive) {
        if (isBtcBear && portB.btcShares > 0) {
          portB.btcCashUSD = portB.btcShares * pBtc;
          portB.btcShares = 0;
          portB.btcTrades++;
        } else if (!isBtcBear && portB.btcCashUSD > 0) {
          portB.btcShares = portB.btcCashUSD / pBtc;
          portB.btcCashUSD = 0;
          portB.btcTrades++;
        }
      }

      // Krypto-Handling Port C (mit 10 Tage Dämpfer)
      if (!portC.isShieldActive) {
        if (portC.btcCashUSD > 0) {
          portC.daysInHedge++;
          if (!isBtcBear && portC.daysInHedge >= 10) {
            portC.btcShares = portC.btcCashUSD / pBtc;
            portC.btcCashUSD = 0;
            portC.daysInHedge = 0;
            portC.btcTrades++;
          }
        } else if (portC.btcShares > 0 && isBtcBear) {
          portC.btcCashUSD = portC.btcShares * pBtc;
          portC.btcShares = 0;
          portC.daysInHedge = 1;
          portC.btcTrades++;
        }
      }
    }

    // Wert-Tracking
    const valCurA = (portA.spyShares * pSpy) + (portA.dfnsShares * pDfns) + (portA.btcShares * pBtc) + (portA.gldShares * pGld) + portA.cashUSD;
    if (valCurA > peakA) peakA = valCurA;
    const ddA = ((peakA - valCurA) / peakA) * 100;
    if (ddA > maxDdA) maxDdA = ddA;

    const valCurB = (portB.spyShares * pSpy) + (portB.dfnsShares * pDfns) + (portB.btcShares * pBtc) + portB.btcCashUSD + (portB.gldShares * pGld) + portB.cashUSD;
    if (valCurB > peakB) peakB = valCurB;
    const ddB = ((peakB - valCurB) / peakB) * 100;
    if (ddB > maxDdB) maxDdB = ddB;

    const valCurC = (portC.spyShares * pSpy) + (portC.dfnsShares * pDfns) + (portC.btcShares * pBtc) + portC.btcCashUSD + (portC.gldShares * pGld) + portC.cashUSD;
    if (valCurC > peakC) peakC = valCurC;
    const ddC = ((peakC - valCurC) / peakC) * 100;
    if (ddC > maxDdC) maxDdC = ddC;
  }

  const lastDate = commonDates[commonDates.length - 1];
  const lastSpy = spyMap.get(lastDate);
  const lastDfns = dfnsMap.get(lastDate);
  const lastBtc = btcMap.get(lastDate);
  const lastGld = gldMap.get(lastDate);

  const finalValA = (portA.spyShares * lastSpy) + (portA.dfnsShares * lastDfns) + (portA.btcShares * lastBtc) + (portA.gldShares * lastGld) + portA.cashUSD;
  const finalValB = (portB.spyShares * lastSpy) + (portB.dfnsShares * lastDfns) + (portB.btcShares * lastBtc) + portB.btcCashUSD + (portB.gldShares * lastGld) + portB.cashUSD;
  const finalValC = (portC.spyShares * lastSpy) + (portC.dfnsShares * lastDfns) + (portC.btcShares * lastBtc) + portC.btcCashUSD + (portC.gldShares * lastGld) + portC.cashUSD;

  const retA = ((finalValA - totalDeposited) / totalDeposited) * 100;
  const retB = ((finalValB - totalDeposited) / totalDeposited) * 100;
  const retC = ((finalValC - totalDeposited) / totalDeposited) * 100;

  console.log(`Gesamteinzahlung: $${totalDeposited.toFixed(2)} ($10.000 Start + monatl. $150 Sparrate)\n`);

  console.log('📌 OPTION A: PURE HODL (Original-Setup)');
  console.log(`   * Depot-Endwert:       $${finalValA.toFixed(2)} (+${retA.toFixed(2)} %)`);
  console.log(`   * Max Drawdown:        -${maxDdA.toFixed(2)} %`);
  console.log(`   * BTC Umschichtungen:  0 Trades`);

  console.log('\n📌 OPTION B: KRYPTO-AIRBAG OHNE DÄMPFER (Whipsaw-Rauschen)');
  console.log(`   * Depot-Endwert:       $${finalValB.toFixed(2)} (+${retB.toFixed(2)} %)`);
  console.log(`   * Max Drawdown:        -${maxDdB.toFixed(2)} %`);
  console.log(`   * BTC Umschichtungen:  ${portB.btcTrades} Trades`);

  console.log('\n📌 OPTION C: KRYPTO-AIRBAG MIT 10-TAGE DÄMPFER (Gehärtet)');
  console.log(`   * Depot-Endwert:       $${finalValC.toFixed(2)} (+${retC.toFixed(2)} %)`);
  console.log(`   * Max Drawdown:        -${maxDdC.toFixed(2)} %`);
  console.log(`   * BTC Umschichtungen:  ${portC.btcTrades} Trades`);
}

compareSatelliteHandling().catch(console.error);
