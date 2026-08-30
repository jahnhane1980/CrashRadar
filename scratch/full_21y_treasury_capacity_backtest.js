import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { TreasuryCapacityRadarIndicator } from '../src/analysis/indicators/TreasuryCapacityRadarIndicator.js';

async function runGrandBacktest() {
  console.log('================================================================');
  console.log('GROSSER 21-JAHRE-BACKTEST (2005 - 2026): TREASURY CAPACITY RADAR');
  console.log('================================================================\n');

  const pool = mysql.createPool(process.env.DATABASE_URL);

  console.log('[1/4] Lade 21 Jahre Makro- und Marktdaten aus der Datenbank...');

  const [spyRows] = await pool.query(`
    SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' AND record_date >= '2005-10-19' ORDER BY record_date ASC
  `);
  const [qqqRows] = await pool.query(`
    SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' AND record_date >= '2005-10-19' ORDER BY record_date ASC
  `);
  const [arkkRows] = await pool.query(`
    SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'ARKK' AND record_date >= '2005-10-19' ORDER BY record_date ASC
  `);
  const [mstrRows] = await pool.query(`
    SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'MSTR' AND record_date >= '2005-10-19' ORDER BY record_date ASC
  `);

  const [tgaRows] = await pool.query(`
    SELECT record_date as date, COALESCE(close_balance, open_balance) as tga FROM fiscal_tga WHERE record_date >= '2005-10-19' ORDER BY record_date ASC
  `);

  const [fredRows] = await pool.query(`
    SELECT series_id, observation_date as date, value FROM econ_fred 
    WHERE series_id IN ('WRESBAL', 'WALCL', 'RRPONTSYD', 'GDP', 'USGSEC', 'THREEFYTP10', 'SOFR', 'IORB', 'DFF', 'DFII10', 'T10Y2Y')
      AND observation_date >= '2005-10-19'
    ORDER BY observation_date ASC
  `);

  const [auctionRows] = await pool.query(`
    SELECT issue_date as date, security_type, total_accepted, DATEDIFF(maturity_date, issue_date)/365.25 as maturity_years
    FROM fiscal_auctions WHERE issue_date >= '2005-10-19' ORDER BY issue_date ASC
  `);

  const [buybackRows] = await pool.query(`
    SELECT operation_date as date, security_type, maturity_bucket, total_accepted
    FROM fiscal_buybacks WHERE operation_date >= '2005-10-19' AND total_accepted IS NOT NULL ORDER BY operation_date ASC
  `);

  await pool.end();

  console.log(`- SPY Kursdaten: ${spyRows.length} Tage`);
  console.log(`- QQQ Kursdaten: ${qqqRows.length} Tage`);
  console.log(`- TGA Daten: ${tgaRows.length} Tage`);
  console.log(`- FRED Daten: ${fredRows.length} Datensätze`);
  console.log(`- Auktionen: ${auctionRows.length} Tranchen`);
  console.log(`- Buybacks: ${buybackRows.length} Operationen\n`);

  console.log('[2/4] Baue normalisierte Timeline auf (2005 - 2026)...');

  const dateMap = new Map();
  const getOrCreate = (dateStr) => {
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        spy: null,
        qqq: null,
        arkk: null,
        mstr: null,
        tga: null,
        wresbal: null,
        walcl: null,
        rrp: null,
        gdp: null,
        usgsec: null,
        term_premium: null,
        dff: null,
        dfii10: null,
        t10y2y: null,
        bills_issued: 0,
        notes_bonds_issued: 0,
        dv01_issued: 0,
        buybacks_accepted: 0,
        buybacks_dv01: 0
      });
    }
    return dateMap.get(dateStr);
  };

  spyRows.forEach(r => { getOrCreate(r.date).spy = Number(r.close); });
  qqqRows.forEach(r => { getOrCreate(r.date).qqq = Number(r.close); });
  arkkRows.forEach(r => { getOrCreate(r.date).arkk = Number(r.close); });
  mstrRows.forEach(r => { getOrCreate(r.date).mstr = Number(r.close); });
  tgaRows.forEach(r => { getOrCreate(r.date).tga = Number(r.tga) / 1000; }); // in Mrd. $

  fredRows.forEach(r => {
    const entry = getOrCreate(r.date);
    const val = Number(r.value);
    if (isNaN(val)) return;
    if (r.series_id === 'WRESBAL') entry.wresbal = val > 100000 ? val / 1000 : val; // Mrd. $
    if (r.series_id === 'WALCL') entry.walcl = val > 100000 ? val / 1000 : val; // Mrd. $
    if (r.series_id === 'RRPONTSYD') entry.rrp = val; // Mrd. $
    if (r.series_id === 'GDP') entry.gdp = val; // Mrd. $
    if (r.series_id === 'USGSEC') entry.usgsec = val; // Mrd. $
    if (r.series_id === 'THREEFYTP10') entry.term_premium = val;
    if (r.series_id === 'DFF') entry.dff = val;
    if (r.series_id === 'DFII10') entry.dfii10 = val;
    if (r.series_id === 'T10Y2Y') entry.t10y2y = val;
  });

  auctionRows.forEach(r => {
    const entry = getOrCreate(r.date);
    const volumeMio = Number(r.total_accepted || 25000000000) / 1e6;
    const mat = Number(r.maturity_years) || 0.25;
    let modDuration = 0.25;
    if (r.security_type === 'Bill') {
      modDuration = Math.max(0.08, mat * 0.9);
      entry.bills_issued += volumeMio;
    } else {
      modDuration = Math.max(1.5, mat * 0.85);
      entry.notes_bonds_issued += volumeMio;
    }
    entry.dv01_issued += (volumeMio * modDuration * 0.0001);
  });

  buybackRows.forEach(r => {
    const entry = getOrCreate(r.date);
    const volumeMio = Number(r.total_accepted) / 1e6;
    entry.buybacks_accepted += volumeMio;
    let modDuration = 4.0;
    const mb = r.maturity_bucket || '';
    if (mb.includes('1Mo to 2Y')) modDuration = 0.8;
    else if (mb.includes('2Y to 3Y')) modDuration = 2.2;
    else if (mb.includes('3Y to 5Y')) modDuration = 3.6;
    else if (mb.includes('5Y to 7Y')) modDuration = 5.2;
    else if (mb.includes('7Y to 10Y') || mb.includes('10Y to 20Y')) modDuration = 9.0;
    else if (mb.includes('20Y to 30Y')) modDuration = 18.0;
    entry.buybacks_dv01 += (volumeMio * modDuration * 0.0001);
  });

  const allDates = Array.from(dateMap.keys()).sort();
  const timeline = [];

  let lastGdp = 13000;
  let lastWresbal = 15;
  let lastWalcl = 850;
  let lastRrp = 0;
  let lastUsgsec = 1100;
  let lastTermPrem = 0.5;
  let lastTga = 50;
  let lastDff = 4.0;
  let lastDfii10 = 2.0;
  let lastT10y2y = 0.5;

  for (const d of allDates) {
    const item = dateMap.get(d);
    if (item.gdp !== null) lastGdp = item.gdp;
    if (item.wresbal !== null) lastWresbal = item.wresbal;
    if (item.walcl !== null) lastWalcl = item.walcl;
    if (item.rrp !== null) lastRrp = item.rrp;
    if (item.usgsec !== null) lastUsgsec = item.usgsec;
    if (item.term_premium !== null) lastTermPrem = item.term_premium;
    if (item.tga !== null) lastTga = item.tga;
    if (item.dff !== null) lastDff = item.dff;
    if (item.dfii10 !== null) lastDfii10 = item.dfii10;
    if (item.t10y2y !== null) lastT10y2y = item.t10y2y;

    timeline.push({
      date: d,
      assets: {
        SPY: item.spy,
        QQQ: item.qqq,
        ARKK: item.arkk,
        MSTR: item.mstr
      },
      macroGroups: {
        NetLiquidity: {
          TGA: item.tga !== null ? item.tga : lastTga,
          WALCL: item.walcl !== null ? item.walcl : lastWalcl,
          RRPONTSYD: item.rrp !== null ? item.rrp : lastRrp
        },
        BankingHealth: {
          BankReserves: item.wresbal !== null ? item.wresbal : lastWresbal
        },
        FinancialConditions: {
          RealYield10y: item.dfii10 !== null ? item.dfii10 : lastDfii10,
          FedFundsRate: item.dff !== null ? item.dff : lastDff
        },
        TreasuryCapacity: {
          GDP: lastGdp,
          THREEFYTP10: item.term_premium !== null ? item.term_premium : lastTermPrem,
          USGSEC: item.usgsec !== null ? item.usgsec : lastUsgsec,
          AuctionBillsMio: item.bills_issued,
          AuctionCouponsMio: item.notes_bonds_issued,
          AuctionDv01: item.dv01_issued,
          BuybackMio: item.buybacks_accepted,
          BuybackDv01: item.buybacks_dv01
        }
      }
    });
  }

  console.log(`- Bereinigte Gesamt-Timeline: ${timeline.length} Tage von ${timeline[0].date} bis ${timeline[timeline.length - 1].date}\n`);

  console.log('[3/4] Führe tägliche Indikator-Evaluation & Forward-Return Analyse durch...');

  const indicator = new TreasuryCapacityRadarIndicator();
  const evaluationTimeline = [];

  // Berechne für jeden Tag ab Index 60 den Indikator
  for (let i = 60; i < timeline.length; i++) {
    const curSlice = timeline.slice(0, i + 1);
    const evalRes = indicator.evaluate(curSlice);
    const curDay = timeline[i];

    // Forward Returns & Drawdowns berechnen (30d, 60d, 90d)
    const curSpy = curDay.assets.SPY;
    const curQqq = curDay.assets.QQQ;
    const curArkk = curDay.assets.ARKK;

    let fwd30Spy = null, fwd60Spy = null, fwd90Spy = null;
    let fwd30Qqq = null, fwd60Qqq = null, fwd90Qqq = null;
    let fwd60Arkk = null;
    let maxDd60Spy = 0, maxDd90Spy = 0;

    if (curSpy !== null) {
      // 30 Tage (~21 Handelstage)
      if (i + 21 < timeline.length && timeline[i + 21].assets.SPY) {
        fwd30Spy = (timeline[i + 21].assets.SPY - curSpy) / curSpy * 100;
      }
      // 60 Tage (~42 Handelstage)
      if (i + 42 < timeline.length && timeline[i + 42].assets.SPY) {
        fwd60Spy = (timeline[i + 42].assets.SPY - curSpy) / curSpy * 100;
        if (curQqq && timeline[i + 42].assets.QQQ) {
          fwd60Qqq = (timeline[i + 42].assets.QQQ - curQqq) / curQqq * 100;
        }
        if (curArkk && timeline[i + 42].assets.ARKK) {
          fwd60Arkk = (timeline[i + 42].assets.ARKK - curArkk) / curArkk * 100;
        }
        // Max DD 60d
        let minPrice = curSpy;
        for (let w = i; w <= i + 42; w++) {
          if (timeline[w].assets.SPY && timeline[w].assets.SPY < minPrice) minPrice = timeline[w].assets.SPY;
        }
        maxDd60Spy = (minPrice - curSpy) / curSpy * 100;
      }
      // 90 Tage (~63 Handelstage)
      if (i + 63 < timeline.length && timeline[i + 63].assets.SPY) {
        fwd90Spy = (timeline[i + 63].assets.SPY - curSpy) / curSpy * 100;
        let minPrice90 = curSpy;
        for (let w = i; w <= i + 63; w++) {
          if (timeline[w].assets.SPY && timeline[w].assets.SPY < minPrice90) minPrice90 = timeline[w].assets.SPY;
        }
        maxDd90Spy = (minPrice90 - curSpy) / curSpy * 100;
      }
    }

    evaluationTimeline.push({
      date: curDay.date,
      status: evalRes.status,
      score: Number(evalRes.value.split('/')[0]),
      catalystStatus: evalRes.catalystStatus,
      collisionWindow: evalRes.projectedCollision,
      slackB: evalRes.details?.liquidSlackBillion,
      spy: curSpy,
      fwd30Spy,
      fwd60Spy,
      fwd90Spy,
      fwd60Qqq,
      fwd60Arkk,
      maxDd60Spy,
      maxDd90Spy
    });
  }

  // =========================================================================
  // [4/4] STATISTISCHE AUSWERTUNG
  // =========================================================================

  console.log('[4/4] Aggregiere statistische Kennzahlen über 5.000+ Handelstage...\n');

  const groups = {
    GREEN: evaluationTimeline.filter(d => d.status === 'OK'),
    YELLOW: evaluationTimeline.filter(d => d.status === 'WARNING'),
    RED: evaluationTimeline.filter(d => d.status === 'CRITICAL')
  };

  function calcStats(arr) {
    const valid60 = arr.filter(d => d.fwd60Spy !== null);
    if (valid60.length === 0) return { count: arr.length, avgFwd30: 0, avgFwd60: 0, avgFwd90: 0, avgMaxDd60: 0, avgMaxDd90: 0, winRate60: 0 };

    const avgFwd30 = arr.filter(d => d.fwd30Spy !== null).reduce((a,b) => a + b.fwd30Spy, 0) / (arr.filter(d => d.fwd30Spy !== null).length || 1);
    const avgFwd60 = valid60.reduce((a,b) => a + b.fwd60Spy, 0) / valid60.length;
    const avgFwd90 = arr.filter(d => d.fwd90Spy !== null).reduce((a,b) => a + b.fwd90Spy, 0) / (arr.filter(d => d.fwd90Spy !== null).length || 1);
    const avgMaxDd60 = valid60.reduce((a,b) => a + b.maxDd60Spy, 0) / valid60.length;
    const avgMaxDd90 = arr.filter(d => d.fwd90Spy !== null).reduce((a,b) => a + b.maxDd90Spy, 0) / (arr.filter(d => d.fwd90Spy !== null).length || 1);
    const winRate60 = (valid60.filter(d => d.fwd60Spy > 0).length / valid60.length) * 100;

    // Small/Mid Growth Performance (ARKK)
    const validArkk = arr.filter(d => d.fwd60Arkk !== null);
    const avgArkk60 = validArkk.length > 0 ? (validArkk.reduce((a,b) => a + b.fwd60Arkk, 0) / validArkk.length) : null;

    return {
      count: arr.length,
      daysSharePct: (arr.length / evaluationTimeline.length * 100).toFixed(1),
      avgFwd30: avgFwd30.toFixed(2),
      avgFwd60: avgFwd60.toFixed(2),
      avgFwd90: avgFwd90.toFixed(2),
      avgMaxDd60: avgMaxDd60.toFixed(2),
      avgMaxDd90: avgMaxDd90.toFixed(2),
      winRate60: winRate60.toFixed(1),
      avgArkk60: avgArkk60 ? avgArkk60.toFixed(2) : 'N/A'
    };
  }

  const greenStats = calcStats(groups.GREEN);
  const yellowStats = calcStats(groups.YELLOW);
  const redStats = calcStats(groups.RED);

  console.log('======================================================================================================');
  console.log('1. GESAMT-PERFORMANCE PRO AMPEL-REGIME (2005 - 2026: 5.100+ TAGE)');
  console.log('======================================================================================================');
  console.log(`Regime       | Tage (Anteil)    | Fwd 30d (SPY) | Fwd 60d (SPY) | Fwd 90d (SPY) | Max DD 60d | Max DD 90d | Win-Rate 60d | Growth (ARKK 60d)`);
  console.log(`-----------------------------------------------------------------------------------------------------------------------------------------`);
  console.log(`🟢 GRÜN (OK) | ${greenStats.count} (${greenStats.daysSharePct}%)  | +${greenStats.avgFwd30}%       | +${greenStats.avgFwd60}%       | +${greenStats.avgFwd90}%       | ${greenStats.avgMaxDd60}%     | ${greenStats.avgMaxDd90}%     | ${greenStats.winRate60}%       | +${greenStats.avgArkk60}%`);
  console.log(`🟡 GELB (WRN)| ${yellowStats.count} (${yellowStats.daysSharePct}%)  | +${yellowStats.avgFwd30}%       | +${yellowStats.avgFwd60}%       | +${yellowStats.avgFwd90}%       | ${yellowStats.avgMaxDd60}%     | ${yellowStats.avgMaxDd90}%     | ${yellowStats.winRate60}%       | +${yellowStats.avgArkk60}% (Melt-Up Outperf!)`);
  console.log(`🔴 ROT (CRI) | ${redStats.count} (${redStats.daysSharePct}%)   | ${redStats.avgFwd30}%        | ${redStats.avgFwd60}%        | ${redStats.avgFwd90}%        | ${redStats.avgMaxDd60}%    | ${redStats.avgMaxDd90}%    | ${redStats.winRate60}%       | ${redStats.avgArkk60}% (High Growth Crash!)`);
  console.log('-----------------------------------------------------------------------------------------------------------------------------------------\n');

  // =========================================================================
  // 2. DIE 10 HISTORISCHEN GROSSKRISEN IM DETAIL-CHECK
  // =========================================================================
  const majorCrises = [
    { name: '2007/08 Große Finanzkrise (GFC)', peakDate: '2007-10-09', crashLowDate: '2009-03-09', expectedType: 'Plumbing & Bank Liquidity' },
    { name: '2011 US-Rating Downgrade / Euro-Krise', peakDate: '2011-04-29', crashLowDate: '2011-10-03', expectedType: 'Debt Ceiling & Refill Shock' },
    { name: '2015/16 Rohstoff & Fed Zinswende', peakDate: '2015-05-21', crashLowDate: '2016-02-11', expectedType: 'Rate Shock & Liquidity Drain' },
    { name: '2018 Q4 QT-Crash', peakDate: '2018-09-20', crashLowDate: '2018-12-24', expectedType: 'QT & Slack Depletion' },
    { name: '2019 Sept Repo-Krise', peakDate: '2019-09-16', crashLowDate: '2019-10-02', expectedType: 'LCLOR Violation & Tax Drain' },
    { name: '2020 Feb Covid-Crash', peakDate: '2020-02-19', crashLowDate: '2020-03-23', expectedType: 'Pre-existing 0B Slack + Shock' },
    { name: '2022 Tech-Bärenmarkt (Zinsschock)', peakDate: '2022-01-04', crashLowDate: '2022-10-12', expectedType: 'Term Premium & Real Yield Surge' },
    { name: '2023 Aug-Okt QRA Kupon-Schock', peakDate: '2023-07-31', crashLowDate: '2023-10-27', expectedType: 'QRA Duration Shock & TP Spike' },
    { name: '2024 Sommer Tech-Dip / Carry Unwind', peakDate: '2024-07-16', crashLowDate: '2024-08-05', expectedType: 'Slack Drain & Vol Shock' },
    { name: '2025 April Tax-Day Crash', peakDate: '2025-03-25', crashLowDate: '2025-04-08', expectedType: 'Imminent Tax Day Drain' }
  ];

  console.log('======================================================================================================');
  console.log('2. DIE 10 HISTORISCHEN GROSSKRISEN IM TEST (VORWARNZEITEN & SIGNAL-STATUS)');
  console.log('======================================================================================================');
  console.log(`Krise / Event                           | Peak-Datum | Erstes Warn-Signal | Vorlaufzeit (Lead-Time) | Signal-Typ / Auslöser`);
  console.log(`-----------------------------------------------------------------------------------------------------------------------------------------`);

  const crisisReport = [];

  majorCrises.forEach(c => {
    // Suche im Fenster bis zu 90 Tage VOR dem Peak-Datum nach der ersten Gelb/Rot-Warnung
    const peakIdx = evaluationTimeline.findIndex(d => d.date >= c.peakDate);
    if (peakIdx === -1) return;

    let firstWarning = null;
    for (let w = Math.max(0, peakIdx - 90); w <= peakIdx; w++) {
      if (evaluationTimeline[w].status === 'WARNING' || evaluationTimeline[w].status === 'CRITICAL') {
        firstWarning = evaluationTimeline[w];
        break;
      }
    }

    let leadDays = 0;
    let leadTradingDays = 0;
    let leadStr = 'Kein Vorwarn-Signal ❌';

    if (firstWarning) {
      const d1 = new Date(firstWarning.date);
      const d2 = new Date(c.peakDate);
      leadDays = Math.round((d2 - d1) / (1000 * 3600 * 24));
      const firstIdx = evaluationTimeline.findIndex(d => d.date === firstWarning.date);
      leadTradingDays = peakIdx - firstIdx;
      leadStr = `${leadTradingDays} Handelstage (${leadDays} Tage vor Peak) ✅`;
    }

    console.log(
      `${c.name.padEnd(39)} | ${c.peakDate} | ${firstWarning ? firstWarning.date : 'Kein Signal'}       | ${leadStr.padEnd(35)} | ${firstWarning ? (firstWarning.status + ' (' + firstWarning.score.toFixed(0) + ' Pkt.)') : 'Verpasst'}`
    );

    crisisReport.push({
      crisis: c.name,
      peakDate: c.peakDate,
      firstWarningDate: firstWarning ? firstWarning.date : null,
      leadDays,
      leadTradingDays,
      status: firstWarning ? firstWarning.status : 'MISSED',
      score: firstWarning ? firstWarning.score : null
    });
  });

  console.log('-----------------------------------------------------------------------------------------------------------------------------------------\n');

  // Speichern
  fs.writeFileSync(
    path.resolve(process.cwd(), 'scratch/full_21y_backtest_results.json'),
    JSON.stringify({ greenStats, yellowStats, redStats, crisisReport }, null, 2),
    'utf8'
  );

  console.log('[Erfolg] Alle 21-Jahre-Ergebnisse in scratch/full_21y_backtest_results.json persistiert.');
}

runGrandBacktest().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
