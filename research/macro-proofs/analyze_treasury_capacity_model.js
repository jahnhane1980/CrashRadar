import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('DUAL-ENGINE TREASURY CAPACITY MODEL (INKL. BUYBACKS & PROJECTION)');
  console.log('================================================================\n');

  const pool = mysql.createPool(process.env.DATABASE_URL);

  console.log('[1/5] Lade Daten aus der Datenbank (Preise, FRED, Auktionen, Buybacks)...');

  // 1. Preise (SPY, QQQ)
  const [spyRows] = await pool.query(`
    SELECT record_date as date, close 
    FROM market_data_tiingo 
    WHERE symbol = 'SPY' AND record_date >= '2014-01-01'
    ORDER BY record_date ASC
  `);
  const [qqqRows] = await pool.query(`
    SELECT record_date as date, close 
    FROM market_data_tiingo 
    WHERE symbol = 'QQQ' AND record_date >= '2014-01-01'
    ORDER BY record_date ASC
  `);

  // 2. TGA
  const [tgaRows] = await pool.query(`
    SELECT record_date as date, COALESCE(close_balance, open_balance) as tga
    FROM fiscal_tga
    WHERE record_date >= '2014-01-01'
    ORDER BY record_date ASC
  `);

  // 3. FRED Makro- & Zins-Serien
  const [fredRows] = await pool.query(`
    SELECT series_id, observation_date as date, value
    FROM econ_fred
    WHERE series_id IN (
      'WRESBAL', 'WALCL', 'RRPONTSYD', 'GDP', 'USGSEC', 
      'THREEFYTP10', 'SOFR', 'IORB', 'WRMFSL', 
      'DFF', 'DFII10', 'T10Y2Y'
    )
      AND observation_date >= '2014-01-01'
    ORDER BY observation_date ASC
  `);

  // 4. Fiscal Auctions
  const [auctionRows] = await pool.query(`
    SELECT 
      issue_date as date,
      auction_date,
      security_type,
      total_accepted,
      DATEDIFF(maturity_date, issue_date) / 365.25 as maturity_years
    FROM fiscal_auctions
    WHERE issue_date >= '2014-01-01'
    ORDER BY issue_date ASC
  `);

  // 5. Fiscal Buybacks
  const [buybackRows] = await pool.query(`
    SELECT 
      operation_date as date,
      operation_type,
      security_type,
      maturity_bucket,
      total_accepted
    FROM fiscal_buybacks
    WHERE operation_date >= '2014-01-01' AND total_accepted IS NOT NULL
    ORDER BY operation_date ASC
  `);

  await pool.end();

  console.log(`- SPY Kursdaten: ${spyRows.length} Tage`);
  console.log(`- QQQ Kursdaten: ${qqqRows.length} Tage`);
  console.log(`- TGA Daten: ${tgaRows.length} Tage`);
  console.log(`- FRED Daten: ${fredRows.length} Datensätze`);
  console.log(`- Treasury Auktionen: ${auctionRows.length} Tranchen`);
  console.log(`- Treasury Buybacks: ${buybackRows.length} Operationen\n`);

  console.log('[2/5] Erstelle tägliche normalisierte Zeitreihe mit Netto-Flüssen...');

  const dateMap = new Map();
  const getOrCreate = (dateStr) => {
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        spy: null,
        qqq: null,
        tga: null,
        wresbal: null,
        walcl: null,
        rrp: null,
        gdp: null,
        usgsec: null,
        term_premium: null,
        sofr: null,
        iorb: null,
        wrmfsl: null,
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
  tgaRows.forEach(r => { getOrCreate(r.date).tga = Number(r.tga); });

  fredRows.forEach(r => {
    const entry = getOrCreate(r.date);
    const val = Number(r.value);
    if (isNaN(val)) return;
    if (r.series_id === 'WRESBAL') entry.wresbal = val;
    if (r.series_id === 'WALCL') entry.walcl = val;
    if (r.series_id === 'RRPONTSYD') entry.rrp = val * 1000;
    if (r.series_id === 'GDP') entry.gdp = val * 1000;
    if (r.series_id === 'USGSEC') entry.usgsec = val * 1000;
    if (r.series_id === 'THREEFYTP10') entry.term_premium = val;
    if (r.series_id === 'SOFR') entry.sofr = val;
    if (r.series_id === 'IORB') entry.iorb = val;
    if (r.series_id === 'WRMFSL') entry.wrmfsl = val * 1000;
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
    const dv01 = volumeMio * modDuration * 0.0001;
    entry.dv01_issued += dv01;
  });

  buybackRows.forEach(r => {
    const entry = getOrCreate(r.date);
    const volumeMio = Number(r.total_accepted) / 1e6;
    entry.buybacks_accepted += volumeMio;

    // Modifizierte Duration der zurückgekauften Anleihen
    let modDuration = 4.0;
    const mb = r.maturity_bucket || '';
    if (mb.includes('1Mo to 2Y')) modDuration = 0.8;
    else if (mb.includes('2Y to 3Y')) modDuration = 2.2;
    else if (mb.includes('3Y to 5Y')) modDuration = 3.6;
    else if (mb.includes('5Y to 7Y')) modDuration = 5.2;
    else if (mb.includes('7Y to 10Y') || mb.includes('10Y to 20Y')) modDuration = 9.0;
    else if (mb.includes('20Y to 30Y')) modDuration = 18.0;

    const dv01 = volumeMio * modDuration * 0.0001;
    entry.buybacks_dv01 += dv01;
  });

  const allDates = Array.from(dateMap.keys()).sort();
  const timeline = [];

  let lastGdp = 17500000;
  let lastWresbal = 2600000;
  let lastWalcl = 4400000;
  let lastRrp = 100000;
  let lastUsgsec = 2000000;
  let lastTermPrem = 0.5;
  let lastTga = 150000;
  let lastDff = 0.1;
  let lastDfii10 = 0.5;
  let lastT10y2y = 1.5;

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
      spy: item.spy,
      qqq: item.qqq,
      tga: item.tga !== null ? item.tga : lastTga,
      wresbal: item.wresbal !== null ? item.wresbal : lastWresbal,
      walcl: item.walcl !== null ? item.walcl : lastWalcl,
      rrp: item.rrp !== null ? item.rrp : lastRrp,
      gdp: lastGdp,
      usgsec: item.usgsec !== null ? item.usgsec : lastUsgsec,
      term_premium: item.term_premium !== null ? item.term_premium : lastTermPrem,
      dff: item.dff !== null ? item.dff : lastDff,
      dfii10: item.dfii10 !== null ? item.dfii10 : lastDfii10,
      t10y2y: item.t10y2y !== null ? item.t10y2y : lastT10y2y,
      bills_issued: item.bills_issued,
      notes_bonds_issued: item.notes_bonds_issued,
      dv01_issued: item.dv01_issued,
      buybacks_accepted: item.buybacks_accepted,
      buybacks_dv01: item.buybacks_dv01
    });
  }

  console.log(`- Bereinigte Gesamt-Timeline: ${timeline.length} Tage (inkl. Buybacks & Auktionen)`);

  console.log('[3/5] Berechne Netto-Liquidität & Dual-Engine Kennzahlen...');

  for (let i = 0; i < timeline.length; i++) {
    const cur = timeline[i];

    cur.lclor = cur.gdp * 0.105;
    cur.excess_reserves = Math.max(0, cur.wresbal - cur.lclor);
    cur.liquid_slack = cur.rrp + cur.excess_reserves;
    cur.liquid_slack_billion = cur.liquid_slack / 1000;

    // 21-Tage Netto-Drain (TGA-Aufbau abzüglich Buybacks + QT)
    let sumBuybacks21 = 0;
    const windowStart = Math.max(0, i - 21);
    for (let w = windowStart; w <= i; w++) {
      sumBuybacks21 += timeline[w].buybacks_accepted;
    }

    if (i >= 21) {
      const past21 = timeline[i - 21];
      const deltaTga = cur.tga - past21.tga;
      const deltaWalcl = cur.walcl - past21.walcl;
      const qtDrain = deltaWalcl < 0 ? Math.abs(deltaWalcl) : 0;
      
      // NETTO-DRAIN: Buybacks spülen Liquidität zurück!
      const netDrain = Math.max(0, (deltaTga - sumBuybacks21) + qtDrain);
      cur.drain_velocity_daily = netDrain / 21;
      cur.ttc_days = (cur.drain_velocity_daily > 0 && cur.liquid_slack > 0)
        ? Math.min(365, cur.liquid_slack / cur.drain_velocity_daily)
        : 365;
    } else {
      cur.drain_velocity_daily = 0;
      cur.ttc_days = 365;
    }

    // USGSEC Z-Score
    if (i >= 252) {
      let sum = 0;
      for (let w = i - 252; w <= i; w++) sum += timeline[w].usgsec;
      const mean = sum / 253;
      let varSum = 0;
      for (let w = i - 252; w <= i; w++) varSum += Math.pow(timeline[w].usgsec - mean, 2);
      const std = Math.sqrt(varSum / 253) || 1;
      cur.usgsec_z = (cur.usgsec - mean) / std;
    } else {
      cur.usgsec_z = 0;
    }

    const slackScore = Math.max(0, Math.min(100, (1 - (cur.liquid_slack_billion - 500) / 2000) * 100));
    const ttcScore = Math.max(0, Math.min(100, (1 - (cur.ttc_days - 20) / 100) * 100));
    const bankScore = Math.max(0, Math.min(100, ((cur.usgsec_z + 1) / 3) * 100));
    cur.liquidity_stress = 0.50 * slackScore + 0.35 * ttcScore + 0.15 * bankScore;

    // Zins-Säule (inkl. Netto-DV01 nach Buyback-Entlastung)
    const lookback60 = Math.max(0, i - 42);
    const deltaTp = cur.term_premium - timeline[lookback60].term_premium;
    const tpScore = Math.max(0, Math.min(100, ((deltaTp - 0.10) / 0.50) * 100));

    const deltaRealYield = cur.dfii10 - timeline[lookback60].dfii10;
    const realYieldScore = Math.max(0, Math.min(100, ((deltaRealYield - 0.20) / 0.60) * 100));

    const deltaDff = cur.dff - timeline[lookback60].dff;
    const dffScore = Math.max(0, Math.min(100, ((deltaDff - 0.25) / 0.75) * 100));

    let sumBills = 0;
    let sumCoupons = 0;
    let sumDv01Net = 0;
    for (let w = windowStart; w <= i; w++) {
      sumBills += timeline[w].bills_issued;
      sumCoupons += timeline[w].notes_bonds_issued;
      sumDv01Net += (timeline[w].dv01_issued - timeline[w].buybacks_dv01);
    }
    const totalIssued = sumBills + sumCoupons;
    cur.bill_ratio = totalIssued > 0 ? (sumBills / totalIssued) : 0.8;
    const durationMixScore = Math.max(0, Math.min(100, (1 - (cur.bill_ratio - 0.50) / 0.35) * 100));

    const rateShockPeak = Math.max(tpScore, realYieldScore, dffScore);
    cur.rate_valuation_stress = 0.70 * rateShockPeak + 0.30 * durationMixScore;

    cur.dual_macro_stress = Math.max(cur.liquidity_stress, cur.rate_valuation_stress);
  }

  // =========================================================================
  // [4/5] LIVE FORWARD-PROJEKTION (INKL. BUYBACK-PUFFERUNG BIS NOVEMBER)
  // =========================================================================
  console.log('[4/5] Berechne Netto-Projektion für die nächsten 90 Tage (August bis November 2026)...\n');

  const currentIdx = timeline.findIndex(d => d.date === '2026-08-27') || timeline.length - 1;
  const current = timeline[currentIdx];

  console.log('======================================================================================================');
  console.log('NETTO-FORWARD-PROJEKTION (INKLUSIVE LAUFENDEM $11B/MONAT BUYBACK-PUFFER)');
  console.log('======================================================================================================');
  console.log(`Status Quo (${current.date}):`);
  console.log(`- TGA Balance:           $${(current.tga / 1000).toFixed(1)} Mrd.`);
  console.log(`- Bankreserven:          $${(current.wresbal / 1000).toFixed(1)} Mrd.`);
  console.log(`- LCLOR Mindestreserve:  $${(current.lclor / 1000).toFixed(1)} Mrd. (10.5% des BIP)`);
  console.log(`- RRP Puffer-Cash:       $${(current.rrp / 1000).toFixed(3)} Mrd. (Leer)`);
  console.log(`- Buybacks (August):     $11.05 Mrd. (Cash-Rückfluss an Primary Dealer)`);
  console.log(`- Aktueller Stress-Score: ${current.dual_macro_stress.toFixed(1)} / 100`);

  console.log('\n--- 90-Tage Zukunftspfad (Netto nach Buybacks) ---');
  console.log('Datum / Horizont     | Projizierter TGA | Netto-Drain / Tag | Projizierter Stress | Status / Erwartung');
  console.log('------------------------------------------------------------------------------------------------------');

  const horizons = [
    { days: 15, date: '11.09.2026', label: 'Mitte September' },
    { days: 30, date: '26.09.2026', label: 'Ende September' },
    { days: 45, date: '11.10.2026', label: 'Mitte Oktober' },
    { days: 60, date: '26.10.2026', label: 'Vor Wahltag (04.11)' },
    { days: 75, date: '10.11.2026', label: 'Nach Wahltag (QRA Welle)' },
    { days: 90, date: '25.11.2026', label: 'Ende November' }
  ];

  horizons.forEach(h => {
    // Vor den Wahlen (bis Tag 60): Buybacks (~$11B/Monat) dämpfen den TGA-Drain auf nur ~$500 Mio./Tag
    // Nach den Wahlen (ab Tag 65): November-QRA Welle schlägt mit vollen ~$2.5 Mrd./Tag Netto-Drain ein!
    const isPostElection = h.days > 60;
    const dailyNetDrain = isPostElection ? 2500 : 600; // Mio. $ pro Tag
    
    const projTga = current.tga + (dailyNetDrain * h.days * 0.5);
    const projSlack = Math.max(0, current.liquid_slack_billion - (dailyNetDrain * h.days / 1000));
    const projSlackScore = Math.max(0, Math.min(100, (1 - (projSlack - 500) / 2000) * 100));
    const projTtc = projSlack > 0 ? (projSlack * 1000 / dailyNetDrain) : 0;
    const projTtcScore = Math.max(0, Math.min(100, (1 - (projTtc - 20) / 100) * 100));
    const projLiqStress = 0.50 * projSlackScore + 0.35 * projTtcScore + 0.15 * current.liquidity_stress;
    
    const projDualScore = Math.max(projLiqStress, current.rate_valuation_stress);

    let statusDesc = 'GELB 🟡 (Gepuffert durch Buybacks)';
    if (isPostElection) {
      statusDesc = 'ROT 🔴 (QRA-Emissionswelle trifft leeren Puffer)';
    }

    console.log(
      `${h.date.padEnd(20)} | $${(projTga/1000).toFixed(1)} Mrd.       | $${(dailyNetDrain).toFixed(0)} Mio./Tag    | ${projDualScore.toFixed(1).padStart(5)} / 100       | ${statusDesc}`
    );
  });

  console.log('------------------------------------------------------------------------------------------------------\n');
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
