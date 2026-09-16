import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(projectRoot, '.env') });

const csvOutputPath = path.join(projectRoot, 'data', 'historical_events_raw_indicators.csv');

// Die 8 signifikanten Events (Start = Peak minus 90 Tage bis Trough)
const EVENTS = [
  {
    name: 'Dotcom-Blase & Rezession',
    peakDate: '2000-03-24',
    troughDate: '2002-10-09',
    windowStart: '2000-01-01',
    windowEnd: '2002-10-31'
  },
  {
    name: 'Große Finanzkrise (GFC)',
    peakDate: '2007-10-09',
    troughDate: '2009-03-09',
    windowStart: '2007-07-09',
    windowEnd: '2009-03-31'
  },
  {
    name: 'US-Downgrade & Eurokrise',
    peakDate: '2011-04-29',
    troughDate: '2011-10-03',
    windowStart: '2011-01-29',
    windowEnd: '2011-10-31'
  },
  {
    name: 'China-Yuan & Öl-Crash',
    peakDate: '2015-05-21',
    troughDate: '2016-02-11',
    windowStart: '2015-02-21',
    windowEnd: '2016-02-28'
  },
  {
    name: 'Zins-Panik (QT-Klemme)',
    peakDate: '2018-09-20',
    troughDate: '2018-12-24',
    windowStart: '2018-06-20',
    windowEnd: '2019-01-15'
  },
  {
    name: 'Corona Flash-Crash',
    peakDate: '2020-02-19',
    troughDate: '2020-03-23',
    windowStart: '2019-11-19',
    windowEnd: '2020-04-30'
  },
  {
    name: 'Inflations- & Zinsschock',
    peakDate: '2022-01-03',
    troughDate: '2022-10-12',
    windowStart: '2021-10-03',
    windowEnd: '2022-11-15'
  },
  {
    name: 'Maturity-Wall & Fiskal-Klemme',
    peakDate: '2025-02-19',
    troughDate: '2025-04-08',
    windowStart: '2024-11-19',
    windowEnd: '2025-05-15'
  }
];

// Hilfsfunktionen für Zahlen & CSV-Formatierung
function safeNum(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  return isNaN(n) ? '' : n.toFixed(decimals);
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Mathematische Hilfsfunktionen (Rein lokal, transparent und fehlerfrei)
function getSMA(array, period) {
  if (!array || array.length < period) return null;
  const slice = array.slice(-period).filter(v => v !== null && !isNaN(v));
  if (slice.length === 0) return null;
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / slice.length;
}

function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function getMaxWithDaysAgo(array, lookback = 30) {
  if (!array || array.length === 0) return null;
  const slice = array.slice(Math.max(0, array.length - lookback));
  let maxVal = -Infinity;
  let maxIdx = -1;
  for (let idx = 0; idx < slice.length; idx++) {
    const val = slice[idx];
    if (val !== null && val !== undefined && !isNaN(val) && val > maxVal) {
      maxVal = val;
      maxIdx = idx;
    }
  }
  if (maxIdx === -1) return null;
  return { maxValue: maxVal, daysAgo: slice.length - 1 - maxIdx };
}

function getMinWithDaysAgo(array, lookback = 30) {
  if (!array || array.length === 0) return null;
  const slice = array.slice(Math.max(0, array.length - lookback));
  let minVal = Infinity;
  let minIdx = -1;
  for (let idx = 0; idx < slice.length; idx++) {
    const val = slice[idx];
    if (val !== null && val !== undefined && !isNaN(val) && val < minVal) {
      minVal = val;
      minIdx = idx;
    }
  }
  if (minIdx === -1) return null;
  return { minValue: minVal, daysAgo: slice.length - 1 - minIdx };
}

async function runHistoricalRawAudit() {
  console.log('================================================================');
  console.log('   HISTORICAL EVENT RAW AUDIT & INDICATOR EVALUATION (AKTIEN)   ');
  console.log('================================================================\n');

  const expert = new FinanceExpert(process.env.DATABASE_URL);

  console.log('⏳ Lade vollständige Rohdaten ab 1999 aus der Datenbank (bypassMemoryGuard)...');
  const fullTimeline = await expert.getDailyGroupedData('1999-01-01', { bypassMemoryGuard: true });
  console.log(`✅ ${fullTimeline.length} Handelstage erfolgreich geladen.\n`);

  const csvRows = [];
  const eventStats = {};

  // CSV-Header definieren (87 Spalten)
  const headers = [
    // Metadaten
    'Date',
    'Event_Name',
    'Event_Phase',
    'Days_To_Peak',
    'SPY_Close',
    'SPY_Drawdown_ATH_Pct',
    'QQQ_Close',
    'VIX_Close',
    'VIX_30d_Max',
    'SPY_RSI_14d',

    // Zinsen & Zinskurve (Rohwerte)
    'Spread_10Y_2Y_Current',
    'Spread_10Y_2Y_Past30d',
    'Spread_10Y_2Y_Delta30d',
    'Spread_10Y_3M_Current',
    'FedFundsRate_DFF',
    'RealYield_10Y_DFII10',
    'RealYield_10Y_Delta60d',
    'Yield_30Y',
    'BreakevenInflation_T10YIE',

    // Liquiditäts-Plumbing & Fed-Bilanzen (Rohwerte)
    'BankReserves_TOTRESNS_B',
    'WRESBAL_BankReserves_B',
    'WRESBAL_Delta56d_B',
    'TGA_Balance_B',
    'TGA_Delta90d_B',
    'TGA_Delta30d_B',
    'ReverseRepo_RRPONTSYD_B',
    'ReverseRepo_Delta30d_B',
    'FedBalance_WALCL_B',
    'FedBalance_WALCL_Delta14d_B',
    'EmergencyBorrowing_BORROW_B',
    'EmergencyBorrowing_Delta28d_B',
    'MaturityWall_Pct_M2',

    // Hebel, Sentiment, Dark Pools & Kredit-Stress (Rohwerte)
    'MarginDebt_Amount_M',
    'MarginDebt_Drawdown180d_Pct',
    'ChicagoFed_NFCI',
    'HighYieldSpread_Pct',
    'HYG_Close',
    'BIZD_Close',
    'BKLN_Close',
    'SKEW_Index',
    'AAII_BullBear_Spread_Pct',
    'DIX_DarkPool_Pct',
    'SPY_ShortVolumeRatio_Pct',
    'Total_PutCall_Ratio_PCR',
    'CBOE_SPY_Volume',
    'CBOE_SPY_Ratio_SMA90',

    // Arbeitsmarkt, Tech & Rohstoffe (Rohwerte)
    'Challenger_JobCuts',
    'Challenger_Delta_SMA6_Pct',
    'Labor_FullTime_PartTime_Drop_Pct',
    'Labor_PAYEMS_Delta3M',
    'Labor_CE16OV_Delta3M',
    'SMH_IGV_Ratio',
    'SMH_IGV_Ratio_SMA15',
    'SMH_IGV_Ratio_SMA50',
    'CIBR_RS_Momentum15d_Pct',
    'Gold_Close',
    'Gold_SMA20',
    'Gold_Volume',
    'Gold_Volume_Ratio50d',
    'GDX_Close',
    'GDX_Volume',
    'GDX_Volume_Ratio50d',
    'DXY_Close',
    'DXY_ROC20d_Pct',

    // Regel-Bewertung (Wann sprang was an?)
    'Eval_YieldCurve_Status',
    'Eval_BankReserves_Status',
    'Eval_TGA_Status',
    'Eval_FiscalFed_Plumbing_Phase',
    'Eval_MaturityWall_Status',
    'Eval_NFCI_Stress_Status',
    'Eval_LaborMarket_Status',
    'Eval_Challenger_Status',
    'Eval_MarginDebt_Status',
    'Eval_SmartDumbMoney_Top_Status',
    'Eval_StealthExit_DIX_Status',
    'Eval_RedAlert_Status',
    'Eval_Dalio_TwoStage_Status',
    'Eval_TechCycle_Status',
    'Eval_VixSpikeCrush_Status',
    'Eval_PanicCapitulation_Status',
    'Eval_SmartDumbMoney_Bottom_Status',
    'Eval_GoldCapitulation_Status',
    'Eval_GoldVolumeClimax_Status',
    'Eval_GdxClimax_Status',
    'Eval_GdxGoldDivergence_Status',
    'Eval_DxyParabolic_Status',

    // Zähler & Trigger-Listen
    'Total_Critical_Triggers',
    'Total_Warning_Triggers',
    'Active_Critical_Signals',
    'Active_Warning_Signals'
  ];

  csvRows.push(headers.join(','));

  console.log('🔍 Starte Durchlauf über die 8 Event-Fenster (Peak - 90d bis Trough)...\n');

  for (const event of EVENTS) {
    eventStats[event.name] = {
      peakDate: event.peakDate,
      troughDate: event.troughDate,
      firstCriticalPrePeak: null,
      firstWarningPrePeak: null,
      firstCriticalAtBottom: null,
      triggerHits: {}
    };

    const peakDateObj = new Date(event.peakDate);
    const troughDateObj = new Date(event.troughDate);

    for (let i = 0; i < fullTimeline.length; i++) {
      const day = fullTimeline[i];
      if (day.date < event.windowStart || day.date > event.windowEnd) continue;

      const currentDateObj = new Date(day.date);
      const daysToPeak = Math.round((currentDateObj - peakDateObj) / (1000 * 60 * 60 * 24));

      let eventPhase = 'PRE_PEAK_3M';
      if (currentDateObj > peakDateObj && currentDateObj < troughDateObj) {
        eventPhase = 'POST_PEAK_DROP';
      } else if (currentDateObj >= troughDateObj) {
        eventPhase = 'BOTTOM_ZONE';
      }

      // -------------------------------------------------------------
      // 1. MATHEMATISCHE ROHDATEN-BERECHNUNG (LOOKBACKS & SMAs)
      // -------------------------------------------------------------

      // SPY Drawdown von Allzeithoch
      let maxSpySoFar = 0;
      for (let j = 0; j <= i; j++) {
        const p = fullTimeline[j].assets?.SPY;
        if (p && p > maxSpySoFar) maxSpySoFar = p;
      }
      const currentSpy = day.assets?.SPY ?? null;
      const spyDdAth = (currentSpy && maxSpySoFar > 0) ? ((currentSpy - maxSpySoFar) / maxSpySoFar) * 100 : null;

      // SPY 30d Drawdown
      const spyLast30Prices = fullTimeline.slice(Math.max(0, i - 30), i + 1).map(d => d.assets?.SPY).filter(Boolean);
      const maxSpy30d = spyLast30Prices.length > 0 ? Math.max(...spyLast30Prices) : currentSpy;
      const spyDd30d = (currentSpy && maxSpy30d) ? ((currentSpy - maxSpy30d) / maxSpy30d) * 100 : 0;

      // SPY RSI 14d
      const spyPricesForRsi = fullTimeline.slice(Math.max(0, i - 40), i + 1).map(d => d.assets?.SPY).filter(Boolean);
      const spyRsi = calculateRSI(spyPricesForRsi, 14);

      // VIX Max 30d
      const vixLast30 = fullTimeline.slice(Math.max(0, i - 30), i + 1).map(d => d.assets?.VIX).filter(v => v !== null && !isNaN(v));
      const vixCurrent = day.assets?.VIX ?? null;
      const vixMax30 = vixLast30.length > 0 ? Math.max(...vixLast30) : vixCurrent;

      // Zinskurve 10Y-2Y Spread & 30d Past
      const spreadCurrent = day.macroGroups?.YieldCurve?.Spread10y2y ?? null;
      const dayMinus30 = i >= 30 ? fullTimeline[i - 30] : null;
      const spreadPast30 = dayMinus30?.macroGroups?.YieldCurve?.Spread10y2y ?? null;
      const spreadDelta30d = (spreadCurrent !== null && spreadPast30 !== null) ? (spreadCurrent - spreadPast30) : null;
      const spread10y3m = day.macroGroups?.YieldCurve?.Spread10y3m ?? spreadCurrent;

      // Zinsen & Real Yield Deltas
      const dff = day.macroGroups?.FinancialConditions?.FedFundsRate ?? null;
      const realYield10y = day.macroGroups?.FinancialConditions?.RealYield10y ?? null;
      const dayMinus60 = i >= 60 ? fullTimeline[i - 60] : null;
      const realYield60dAgo = dayMinus60?.macroGroups?.FinancialConditions?.RealYield10y ?? null;
      const realYieldDelta60d = (realYield10y !== null && realYield60dAgo !== null) ? (realYield10y - realYield60dAgo) : null;
      const yield30y = day.macroGroups?.FinancialConditions?.Yield30y ?? null;
      const breakevenInf = day.macroGroups?.Leading?.BreakevenInflation ?? null;

      // Liquiditäts-Plumbing & Fed Bilanzen
      const bankReservesTot = day.macroGroups?.BankingHealth?.TotalReserves ?? null;
      const wresbal = day.macroGroups?.BankingHealth?.BankReserves ?? null;
      const dayMinus56 = i >= 56 ? fullTimeline[i - 56] : null;
      const wresbalPast56 = dayMinus56?.macroGroups?.BankingHealth?.BankReserves ?? null;
      const wresbalDelta56d = (wresbal !== null && wresbalPast56 !== null) ? (wresbal - wresbalPast56) : null;

      const tga = day.macroGroups?.NetLiquidity?.TGA ?? null;
      const dayMinus90 = i >= 90 ? fullTimeline[i - 90] : null;
      const tgaPast90 = dayMinus90?.macroGroups?.NetLiquidity?.TGA ?? null;
      const tgaDelta90d = (tga !== null && tgaPast90 !== null) ? (tga - tgaPast90) : null;
      const tgaPast30 = dayMinus30?.macroGroups?.NetLiquidity?.TGA ?? null;
      const tgaDelta30d = (tga !== null && tgaPast30 !== null) ? (tga - tgaPast30) : null;

      const rrp = day.macroGroups?.NetLiquidity?.RRPONTSYD ?? null;
      const rrpPast30 = dayMinus30?.macroGroups?.NetLiquidity?.RRPONTSYD ?? null;
      const rrpDelta30d = (rrp !== null && rrpPast30 !== null) ? (rrp - rrpPast30) : null;

      const walcl = day.macroGroups?.NetLiquidity?.WALCL ?? null;
      const dayMinus14 = i >= 14 ? fullTimeline[i - 14] : null;
      const walclPast14 = dayMinus14?.macroGroups?.NetLiquidity?.WALCL ?? null;
      const walclDelta14d = (walcl !== null && walclPast14 !== null) ? (walcl - walclPast14) : null;

      const borrow = day.macroGroups?.BankingHealth?.EmergencyBorrowing ?? null;
      const dayMinus28 = i >= 28 ? fullTimeline[i - 28] : null;
      const borrowPast28 = dayMinus28?.macroGroups?.BankingHealth?.EmergencyBorrowing ?? null;
      const borrowDelta28d = (borrow !== null && borrowPast28 !== null) ? (borrow - borrowPast28) : null;

      const maturityWallPct = day.macroGroups?.Leading?.MaturityWallPct ?? null;

      // Hebel & Kredit-Stress
      const marginDebt = day.macroGroups?.Leading?.MarginDebt ?? null;
      const md180Slice = fullTimeline.slice(Math.max(0, i - 180), i + 1).map(d => d.macroGroups?.Leading?.MarginDebt).filter(Boolean);
      const maxMd180 = md180Slice.length > 0 ? Math.max(...md180Slice) : marginDebt;
      const marginDebtDd180d = (marginDebt && maxMd180) ? ((marginDebt - maxMd180) / maxMd180) * 100 : 0;

      const nfci = day.macroGroups?.FinancialConditions?.ChicagoFedIndex ?? null;
      const hySpread = day.macroGroups?.FinancialConditions?.HighYieldSpread ?? null;
      const skew = day.assets?.SKEW ?? null;
      const aaiiSpread = day.assets?.AAII_Spread !== null && day.assets?.AAII_Spread !== undefined ? day.assets.AAII_Spread * 100 : null;
      const dix = day.assets?.DIX !== null && day.assets?.DIX !== undefined ? (day.assets.DIX > 1 ? day.assets.DIX : day.assets.DIX * 100) : null;
      const shortRatio = day.assets?.SPY_ShortVolumeRatio !== null && day.assets?.SPY_ShortVolumeRatio !== undefined ? (day.assets.SPY_ShortVolumeRatio > 1 ? day.assets.SPY_ShortVolumeRatio : day.assets.SPY_ShortVolumeRatio * 100) : null;
      const totalPcr = day.assets?.TotalPCR ?? null;

      // CBOE SPY Optionsvolumen SMA90
      const cboeVol = day.assets?.CBOE_SPY ?? null;
      const cboe90Slice = fullTimeline.slice(Math.max(0, i - 90), i + 1).map(d => d.assets?.CBOE_SPY).filter(Boolean);
      const sma90Cboe = getSMA(cboe90Slice, 90);
      const cboeVolRatio90 = (cboeVol && sma90Cboe) ? (cboeVol / sma90Cboe) : null;

      // Arbeitsmarkt & Challenger
      const challenger = day.macroGroups?.Leading?.Challenger ?? null;
      const chalSlice = fullTimeline.slice(Math.max(0, i - 180), i).map(d => d.macroGroups?.Leading?.Challenger).filter(Boolean);
      const sma6Chal = getSMA(chalSlice, 6);
      const chalDeltaSma6 = (challenger && sma6Chal) ? ((challenger - sma6Chal) / sma6Chal) * 100 : null;

      const fullTime = day.macroGroups?.LaborMarket?.LNS12500000 ?? null;
      const partTime = day.macroGroups?.LaborMarket?.LNS12600000 ?? null;
      const ftPtRatio = (fullTime && partTime) ? (fullTime / partTime) : null;
      const ftPtSlice = fullTimeline.slice(Math.max(0, i - 365), i + 1).map(d => {
        const ft = d.macroGroups?.LaborMarket?.LNS12500000;
        const pt = d.macroGroups?.LaborMarket?.LNS12600000;
        return (ft && pt) ? (ft / pt) : null;
      }).filter(Boolean);
      const maxFtPt12m = ftPtSlice.length > 0 ? Math.max(...ftPtSlice) : ftPtRatio;
      const ftPtDropPct = (ftPtRatio && maxFtPt12m) ? ((ftPtRatio - maxFtPt12m) / maxFtPt12m) * 100 : 0;

      const payems = day.macroGroups?.LaborMarket?.PAYEMS ?? null;
      const payems3mAgo = dayMinus90?.macroGroups?.LaborMarket?.PAYEMS ?? null;
      const payemsDelta3m = (payems !== null && payems3mAgo !== null) ? (payems - payems3mAgo) : null;

      const ce16ov = day.macroGroups?.LaborMarket?.CE16OV ?? null;
      const ce16ov3mAgo = dayMinus90?.macroGroups?.LaborMarket?.CE16OV ?? null;
      const ce16ovDelta3m = (ce16ov !== null && ce16ov3mAgo !== null) ? (ce16ov - ce16ov3mAgo) : null;

      // Tech-Sektor (SMH / IGV & CIBR)
      const smh = day.assets?.SMH ?? null;
      const igv = day.assets?.IGV ?? null;
      const techRatio = (smh && igv) ? (smh / igv) : null;
      const techRatioSeries = fullTimeline.slice(Math.max(0, i - 60), i + 1).map(d => {
        const s = d.assets?.SMH;
        const g = d.assets?.IGV;
        return (s && g) ? (s / g) : null;
      }).filter(Boolean);
      const sma15Tech = getSMA(techRatioSeries, 15);
      const sma50Tech = getSMA(techRatioSeries, 50);
      const dayMinus5TechSeries = techRatioSeries.slice(0, -5);
      const sma15Tech5dAgo = getSMA(dayMinus5TechSeries, 15);
      const sma15Delta5d = (sma15Tech && sma15Tech5dAgo) ? (sma15Tech - sma15Tech5dAgo) : 0;

      const cibr = day.assets?.CIBR ?? null;
      const dayMinus15 = i >= 15 ? fullTimeline[i - 15] : null;
      const cibr15Ago = dayMinus15?.assets?.CIBR ?? null;
      const spy15Ago = dayMinus15?.assets?.SPY ?? null;
      let cibrRsMom15d = null;
      if (cibr && cibr15Ago && currentSpy && spy15Ago) {
        const cibrPerf = (cibr - cibr15Ago) / cibr15Ago;
        const spyPerf = (currentSpy - spy15Ago) / spy15Ago;
        cibrRsMom15d = (cibrPerf - spyPerf) * 100;
      }

      // Rohstoffe (Gold, GDX, DXY)
      const gold = day.assets?.Gold ?? null;
      const goldPrices = fullTimeline.slice(Math.max(0, i - 25), i + 1).map(d => d.assets?.Gold).filter(Boolean);
      const goldSma20 = getSMA(goldPrices, 20);
      const goldVol = day.assets?.Gold_Volume ?? null;
      const goldVolSlice = fullTimeline.slice(Math.max(0, i - 50), i).map(d => d.assets?.Gold_Volume).filter(Boolean);
      const goldAvgVol50 = getSMA(goldVolSlice, 50);
      const goldVolRatio50d = (goldVol && goldAvgVol50) ? (goldVol / goldAvgVol50) : null;

      const gdx = day.assets?.GDX ?? null;
      const gdxVol = day.assets?.GDX_Volume ?? null;
      const gdxVolSlice = fullTimeline.slice(Math.max(0, i - 50), i).map(d => d.assets?.GDX_Volume).filter(Boolean);
      const gdxAvgVol50 = getSMA(gdxVolSlice, 50);
      const gdxVolRatio50d = (gdxVol && gdxAvgVol50) ? (gdxVol / gdxAvgVol50) : null;

      // 30d Gold & GDX Extremes for Divergence
      const gold30Prices = fullTimeline.slice(Math.max(0, i - 30), i + 1).map(d => d.assets?.Gold);
      const gdx30Prices = fullTimeline.slice(Math.max(0, i - 30), i + 1).map(d => d.assets?.GDX);
      const goldMax30 = getMaxWithDaysAgo(gold30Prices, 30);
      const gdxMax30 = getMaxWithDaysAgo(gdx30Prices, 30);
      const goldMin30 = getMinWithDaysAgo(gold30Prices, 30);
      const gdxMin30 = getMinWithDaysAgo(gdx30Prices, 30);

      const dxy = day.macroGroups?.FinancialConditions?.DXY ?? day.assets?.DXY ?? null;
      const dayMinus20 = i >= 20 ? fullTimeline[i - 20] : null;
      const dxyPast20 = dayMinus20?.macroGroups?.FinancialConditions?.DXY ?? dayMinus20?.assets?.DXY ?? null;
      const dxyRoc20d = (dxy && dxyPast20) ? ((dxy - dxyPast20) / dxyPast20) * 100 : null;

      // -------------------------------------------------------------
      // 2. REGEL-BEWERTUNGEN (SCHWELLENWERTE DIREKT AUSGEWERTET)
      // -------------------------------------------------------------
      const activeCriticals = [];
      const activeWarnings = [];

      // 1. YieldCurve
      let evalYieldCurve = 'UNKNOWN';
      if (spreadCurrent !== null && spreadPast30 !== null) {
        if (spreadPast30 < 0 && spreadCurrent >= 0) {
          evalYieldCurve = 'CRITICAL';
          activeCriticals.push('YieldCurve (Un-Inverting)');
        } else if (spreadCurrent < 0) {
          evalYieldCurve = 'WARNING';
          activeWarnings.push('YieldCurve (Invertiert)');
        } else {
          evalYieldCurve = 'OK';
        }
      }

      // 2. BankReserves
      let evalBankReserves = 'UNKNOWN';
      if (bankReservesTot !== null) {
        if (bankReservesTot < 2800) {
          evalBankReserves = 'CRITICAL';
          activeCriticals.push('BankReserves (<2.8T)');
        } else if (bankReservesTot < 3000) {
          evalBankReserves = 'WARNING';
          activeWarnings.push('BankReserves (<3.0T)');
        } else {
          evalBankReserves = 'OK';
        }
      }

      // 3. TGA Liquidity
      let evalTga = 'OK';
      if (tgaDelta30d !== null) {
        if (tgaDelta30d > 100) {
          evalTga = 'WARNING_DRAIN';
          activeWarnings.push('TGA (+100B Sog)');
        } else if (tgaDelta30d < -100) {
          evalTga = 'OK_STIMULUS';
        }
      }

      // 4. Fiscal Fed Plumbing
      let evalFiscalFed = 'NORMAL';
      if (walclDelta14d !== null && walclDelta14d > 50) {
        evalFiscalFed = 'PHASE_4_STEALTH_QE';
      } else if (wresbalDelta56d !== null && wresbalDelta56d > 150) {
        evalFiscalFed = 'PHASE_4_WONDER_PILL';
      } else if (borrowDelta28d !== null && borrowDelta28d > 15) {
        evalFiscalFed = 'PHASE_3_PANIC_BORROW';
        activeCriticals.push('FiscalFed (Phase 3 Notkredite)');
      } else if (rrpDelta30d !== null && rrpDelta30d > 100) {
        evalFiscalFed = 'PHASE_2_RRP_DRAIN';
        activeWarnings.push('FiscalFed (Phase 2 RRP Drain)');
      } else if (tgaDelta90d !== null && tgaDelta90d > 150) {
        evalFiscalFed = 'PHASE_1_TGA_VACUUM';
        activeWarnings.push('FiscalFed (Phase 1 TGA Sauger)');
      } else if (wresbalDelta56d !== null && wresbalDelta56d < -100) {
        evalFiscalFed = 'PHASE_1_RESERVES_DRAIN';
        activeWarnings.push('FiscalFed (Phase 1 Reserven-Drain)');
      }

      // 5. MaturityWall
      let evalMaturityWall = 'OK';
      if (maturityWallPct !== null) {
        if (maturityWallPct > 21) {
          evalMaturityWall = 'CRITICAL';
          activeCriticals.push('MaturityWall (>21%)');
        } else if (maturityWallPct > 15) {
          evalMaturityWall = 'WARNING';
          activeWarnings.push('MaturityWall (>15%)');
        }
      }

      // 6. NFCI
      let evalNfci = 'OK';
      if (nfci !== null) {
        if (nfci > 0.0) {
          evalNfci = 'CRITICAL';
          activeCriticals.push('NFCI (>0 Stress)');
        }
      }

      // 7. LaborMarket
      let evalLaborMarket = 'NEUTRAL';
      if (payemsDelta3m !== null && ce16ovDelta3m !== null && payemsDelta3m > 0 && ce16ovDelta3m < 0) {
        evalLaborMarket = 'COINCIDENT_ALERT';
        activeCriticals.push('LaborMarket (PAYEMS vs CE16OV Bruch)');
      } else if (ftPtDropPct <= -2.5) {
        evalLaborMarket = 'LEADING_WARNING';
        activeWarnings.push('LaborMarket (Vollzeit/Teilzeit Schere)');
      }

      // 8. Challenger
      let evalChallenger = 'OK';
      if (chalDeltaSma6 !== null) {
        if (chalDeltaSma6 >= 55.0) {
          evalChallenger = 'CRITICAL';
          activeCriticals.push('Challenger (+55% vs SMA6)');
        } else if (chalDeltaSma6 >= 40.0) {
          evalChallenger = 'WARNING';
          activeWarnings.push('Challenger (+40% vs SMA6)');
        }
      }

      // 9. MarginDebt
      let evalMarginDebt = 'OK';
      if (marginDebtDd180d !== null) {
        if (marginDebtDd180d <= -5.0) {
          evalMarginDebt = 'WARNING_FAST_DELEVERAGING';
          activeWarnings.push('MarginDebt (-5% Abbau)');
        } else if (marginDebtDd180d <= -2.0) {
          evalMarginDebt = 'WARNING_SLOW_DELEVERAGING';
          activeWarnings.push('MarginDebt (-2% Risse)');
        }
      }

      // 10. SmartDumbMoney Top
      let evalSmartDumbTop = 'OK';
      if (skew !== null && aaiiSpread !== null) {
        if (skew > 145 && aaiiSpread > 20) {
          evalSmartDumbTop = 'CRITICAL';
          activeCriticals.push('SmartDumbTop (SKEW>145 & AAII>20)');
        }
      }

      // 11. StealthExit DIX
      let evalStealthExit = 'OK';
      if (dix !== null) {
        if (dix < 40.0 && spyDd30d >= -3.0) {
          evalStealthExit = 'CRITICAL';
          activeCriticals.push('StealthExit (DIX<40% bei ATH)');
        } else if (dix < 40.0) {
          evalStealthExit = 'WARNING';
          activeWarnings.push('StealthExit (DIX<40%)');
        }
      }

      // 12. RedAlert Combo
      let evalRedAlert = 'OK';
      if (skew !== null && shortRatio !== null) {
        const pcrVal = totalPcr ?? 0.8;
        if (skew > 145 && shortRatio < 45 && pcrVal < 0.75) {
          evalRedAlert = 'CRITICAL';
          activeCriticals.push('RedAlert (SKEW>145 & Short<45% & PCR<0.75)');
        } else if (skew > 145 && shortRatio < 45) {
          evalRedAlert = 'WARNING_MELTUP';
          activeWarnings.push('RedAlert (Melt-Up Setup)');
        } else if (skew > 140 && shortRatio < 50) {
          evalRedAlert = 'WARNING_BUILDING';
          activeWarnings.push('RedAlert (Spannung baut auf)');
        }
      }

      // 13. Dalio Two Stage
      let evalDalio = 'OK';
      const c1 = (dff > 4.5 || (spreadCurrent && spreadCurrent > 4.5) || yield30y > 5.0) ? 1 : 0;
      const c2 = (spread10y3m < 0 || (spreadCurrent && spreadCurrent < 0)) ? 1 : 0;
      const c3 = (maturityWallPct > 15) ? 1 : 0;
      const c4 = (hySpread > 3.5 || (c1 && c2)) ? 1 : 0;
      const stage1Score = c1 + c2 + c3 + c4;
      if (stage1Score >= 3) {
        if ((rrp !== null && rrp < 20) || (hySpread !== null && hySpread > 4.0)) {
          evalDalio = 'CRITICAL_TIPPING';
          activeCriticals.push('Dalio (Kipppunkt erreicht)');
        } else {
          evalDalio = 'WARNING_WATCHLIST';
          activeWarnings.push('Dalio (Spätzyklus 3/4)');
        }
      }

      // 14. TechCycle
      let evalTechCycle = 'OK';
      if (sma15Tech && sma50Tech) {
        if (sma15Tech > sma50Tech && sma15Delta5d < 0) {
          evalTechCycle = 'WARNING_DISTRIBUTION';
          activeWarnings.push('TechCycle (Hardware Distribution)');
        } else if (sma15Tech < sma50Tech && sma15Delta5d > 0) {
          evalTechCycle = 'WARNING_ACCUMULATION';
          activeWarnings.push('TechCycle (Hardware Accumulation)');
        } else if (sma15Tech > sma50Tech) {
          evalTechCycle = 'HARDWARE_DOMINANT';
        } else {
          evalTechCycle = 'SOFTWARE_DOMINANT';
        }
      }

      // 15. VixSpikeCrush
      let evalVixSpikeCrush = 'OK';
      if (vixMax30 !== null && vixCurrent !== null) {
        if (vixMax30 >= 40 && vixCurrent < vixMax30 * 0.80) {
          evalVixSpikeCrush = 'CRITICAL_BUY';
          activeCriticals.push('VIX (Spike & Crush -20%)');
        } else if (vixMax30 >= 35 && vixCurrent < vixMax30 * 0.85) {
          evalVixSpikeCrush = 'WARNING_BOTTOMING';
          activeWarnings.push('VIX (Bodenbildung läuft)');
        } else if (vixMax30 >= 35) {
          evalVixSpikeCrush = 'WARNING_PANIC';
          activeWarnings.push('VIX (Extreme Panik >=35)');
        }
      }

      // 16. PanicCapitulation CBOE & RSI
      let evalPanicCapitulation = 'OK';
      if (vixCurrent >= 35 && cboeVolRatio90 >= 1.5) {
        if (spyRsi && spyRsi > 30) {
          evalPanicCapitulation = 'CRITICAL_GENERATIONAL_BUY';
          activeCriticals.push('PanicCapitulation (CBOE Spike + RSI Divergence)');
        } else {
          evalPanicCapitulation = 'WARNING_PANIC_SPIKE';
          activeWarnings.push('PanicCapitulation (CBOE Spike 1.5x)');
        }
      }

      // 17. SmartDumbMoney Bottom
      let evalSmartDumbBottom = 'OK';
      if (vixCurrent > 40 && aaiiSpread < -25 && dix > 45) {
        evalSmartDumbBottom = 'CRITICAL_BUY';
        activeCriticals.push('SmartDumbBottom (VIX>40 & AAII<-25 & DIX>45)');
      }

      // 18. Gold Capitulation & Healing
      let evalGoldCap = 'OK';
      if (gold && goldSma20) {
        const prevDay = i > 0 ? fullTimeline[i - 1] : null;
        const prevGold = prevDay?.assets?.Gold;
        const prevGoldSma20 = goldPrices.length > 1 ? getSMA(goldPrices.slice(0, -1), 20) : null;
        if (prevGold && prevGoldSma20 && prevGold < prevGoldSma20 && gold > goldSma20) {
          evalGoldCap = 'CRITICAL_HEALING';
          activeCriticals.push('Gold (SMA20 Ausbruch / Healing)');
        }
      }

      // 19. Gold Volume Climax
      let evalGoldClimax = 'OK';
      if (goldVolRatio50d >= 5.0) {
        evalGoldClimax = 'CRITICAL_CLIMAX';
        activeCriticals.push('Gold (Volume Climax >=5x)');
      }

      // 20. GDX Climax
      let evalGdxClimax = 'OK';
      if (gdxVolRatio50d >= 3.0) {
        evalGdxClimax = 'CRITICAL_CLIMAX';
        activeCriticals.push('GDX (Volume Climax >=3x)');
      }

      // 21. GDX Gold Divergence
      let evalGdxGoldDiv = 'OK';
      if (goldMax30 && gdxMax30 && gdx) {
        const isGoldAtTop = goldMax30.daysAgo <= 5;
        const isGdxDiverging = gdxMax30.daysAgo >= 10;
        const gdxDd = ((gdx - gdxMax30.maxValue) / gdxMax30.maxValue) * 100;
        if (isGoldAtTop && isGdxDiverging && gdxDd <= -3.0) {
          evalGdxGoldDiv = 'WARNING_TOP_DIVERGENCE';
          activeWarnings.push('GDX/Gold (Minen toppen vor Gold)');
        }
      }
      if (goldMin30 && gdxMin30 && gdx && gdxMin30.minValue > 0) {
        const isGoldAtBottom = goldMin30.daysAgo <= 5;
        const isGdxBottomEarlier = gdxMin30.daysAgo >= 10;
        const gdxRecovery = ((gdx - gdxMin30.minValue) / gdxMin30.minValue) * 100;
        if (isGoldAtBottom && isGdxBottomEarlier && gdxRecovery >= 3.0) {
          evalGdxGoldDiv = 'CRITICAL_BOTTOM_DIVERGENCE';
          activeCriticals.push('GDX/Gold (Bullische Minen-Bodendivergenz)');
        }
      }

      // 22. DXY Parabolic Climax
      let evalDxyParabolic = 'OK';
      if (dxyRoc20d >= 3.0) {
        const prevDxy = i > 0 ? (fullTimeline[i - 1].macroGroups?.FinancialConditions?.DXY ?? fullTimeline[i - 1].assets?.DXY) : null;
        if (prevDxy && dxy < prevDxy) {
          evalDxyParabolic = 'CRITICAL_BUY';
          activeCriticals.push('DXY (Parabel-Knick / Dollar-Erschöpfung)');
        } else {
          evalDxyParabolic = 'WARNING_PARABOLIC';
          activeWarnings.push('DXY (Parabler Anstieg >=3%)');
        }
      }

      // Tracking für Statistiken
      if (daysToPeak <= 0 && activeCriticals.length > 0 && !eventStats[event.name].firstCriticalPrePeak) {
        eventStats[event.name].firstCriticalPrePeak = { date: day.date, daysToPeak, signals: [...activeCriticals] };
      }
      if (daysToPeak <= 0 && activeWarnings.length > 0 && !eventStats[event.name].firstWarningPrePeak) {
        eventStats[event.name].firstWarningPrePeak = { date: day.date, daysToPeak, signals: [...activeWarnings] };
      }
      if (daysToPeak >= 0 && activeCriticals.length > 0 && !eventStats[event.name].firstCriticalAtBottom) {
        eventStats[event.name].firstCriticalAtBottom = { date: day.date, daysToPeak, signals: [...activeCriticals] };
      }

      // Zeile zusammensetzen (exakt 87 Elemente)
      const row = [
        // Metadaten
        day.date,
        escapeCsv(event.name),
        eventPhase,
        daysToPeak,
        safeNum(currentSpy),
        safeNum(spyDdAth),
        safeNum(day.assets?.QQQ),
        safeNum(vixCurrent),
        safeNum(vixMax30),
        safeNum(spyRsi, 1),

        // Zinsen & Zinskurve
        safeNum(spreadCurrent, 3),
        safeNum(spreadPast30, 3),
        safeNum(spreadDelta30d, 3),
        safeNum(spread10y3m, 3),
        safeNum(dff),
        safeNum(realYield10y),
        safeNum(realYieldDelta60d, 3),
        safeNum(yield30y),
        safeNum(breakevenInf),

        // Liquidität & Bilanzen
        safeNum(bankReservesTot, 0),
        safeNum(wresbal ? wresbal / 1000 : null, 1),
        safeNum(wresbalDelta56d ? wresbalDelta56d / 1000 : null, 1),
        safeNum(tga, 1),
        safeNum(tgaDelta90d, 1),
        safeNum(tgaDelta30d, 1),
        safeNum(rrp, 1),
        safeNum(rrpDelta30d, 1),
        safeNum(walcl, 1),
        safeNum(walclDelta14d, 1),
        safeNum(borrow ? borrow / 1000 : null, 2),
        safeNum(borrowDelta28d ? borrowDelta28d / 1000 : null, 2),
        safeNum(maturityWallPct, 2),

        // Hebel, Sentiment & Kredit
        safeNum(marginDebt, 0),
        safeNum(marginDebtDd180d, 2),
        safeNum(nfci, 2),
        safeNum(hySpread, 2),
        safeNum(day.assets?.HYG),
        safeNum(day.assets?.BIZD),
        safeNum(day.assets?.BKLN),
        safeNum(skew, 2),
        safeNum(aaiiSpread, 1),
        safeNum(dix, 1),
        safeNum(shortRatio, 1),
        safeNum(totalPcr, 2),
        safeNum(cboeVol, 0),
        safeNum(cboeVolRatio90, 2),

        // Arbeitsmarkt, Tech & Rohstoffe
        safeNum(challenger, 0),
        safeNum(chalDeltaSma6, 1),
        safeNum(ftPtDropPct, 2),
        safeNum(payemsDelta3m, 1),
        safeNum(ce16ovDelta3m, 1),
        safeNum(techRatio, 3),
        safeNum(sma15Tech, 3),
        safeNum(sma50Tech, 3),
        safeNum(cibrRsMom15d, 2),
        safeNum(gold),
        safeNum(goldSma20),
        safeNum(goldVol, 0),
        safeNum(goldVolRatio50d, 2),
        safeNum(gdx),
        safeNum(gdxVol, 0),
        safeNum(gdxVolRatio50d, 2),
        safeNum(dxy),
        safeNum(dxyRoc20d, 2),

        // Regel-Bewertungen
        evalYieldCurve,
        evalBankReserves,
        evalTga,
        evalFiscalFed,
        evalMaturityWall,
        evalNfci,
        evalLaborMarket,
        evalChallenger,
        evalMarginDebt,
        evalSmartDumbTop,
        evalStealthExit,
        evalRedAlert,
        evalDalio,
        evalTechCycle,
        evalVixSpikeCrush,
        evalPanicCapitulation,
        evalSmartDumbBottom,
        evalGoldCap,
        evalGoldClimax,
        evalGdxClimax,
        evalGdxGoldDiv,
        evalDxyParabolic,

        // Zähler & Listen
        activeCriticals.length,
        activeWarnings.length,
        escapeCsv(activeCriticals.join(' | ')),
        escapeCsv(activeWarnings.join(' | '))
      ];

      csvRows.push(row.join(','));
    }
  }

  // CSV schreiben
  fs.writeFileSync(csvOutputPath, csvRows.join('\n'), 'utf-8');
  console.log(`💾 CSV-Datei erfolgreich gespeichert unter: ${csvOutputPath}`);
  console.log(`📊 Exportierte Zeilen: ${csvRows.length} (inkl. Header)\n`);

  // Konsole-Auswertung
  console.log('================================================================');
  console.log('   STATISTISCHE ZUSAMMENFASSUNG: HISTORISCHE TRIGGER-ANALYSE    ');
  console.log('================================================================\n');

  for (const [eName, stats] of Object.entries(eventStats)) {
    console.log(`📌 Event: ${eName}`);
    console.log(`   - Allzeithoch (Peak): ${stats.peakDate} | Tiefpunkt (Trough): ${stats.troughDate}`);
    if (stats.firstWarningPrePeak) {
      console.log(`   🟡 Erste VORWARNUNG vor dem Top: ${stats.firstWarningPrePeak.date} (${Math.abs(stats.firstWarningPrePeak.daysToPeak)} Tage VORHER)`);
      console.log(`      Signale: ${stats.firstWarningPrePeak.signals.join(', ')}`);
    } else {
      console.log(`   🟡 Keine Vorwarnung vor dem Top.`);
    }

    if (stats.firstCriticalPrePeak) {
      console.log(`   🔴 Erstes CRITICAL-Signal vor dem Top: ${stats.firstCriticalPrePeak.date} (${Math.abs(stats.firstCriticalPrePeak.daysToPeak)} Tage VORHER)`);
      console.log(`      Signale: ${stats.firstCriticalPrePeak.signals.join(', ')}`);
    } else {
      console.log(`   🔴 Kein CRITICAL-Signal vor dem Top.`);
    }

    if (stats.firstCriticalAtBottom) {
      console.log(`   🟢 Erstes BODEN-/KAUFSIGNAL nach Crash-Start: ${stats.firstCriticalAtBottom.date} (+${stats.firstCriticalAtBottom.daysToPeak} Tage nach Peak)`);
      console.log(`      Signale: ${stats.firstCriticalAtBottom.signals.join(', ')}`);
    }
    console.log('');
  }

  await expert.close();
  console.log('🏁 Audit erfolgreich abgeschlossen.');
}

runHistoricalRawAudit().catch(err => {
  console.error('❌ Fehler beim Ausführen des Audits:', err);
});
