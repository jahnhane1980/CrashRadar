/**
 * @file tools/synthesize_fedwatch_probabilities.js
 * @purpose: Synthetisiert historische FedWatch-Wahrscheinlichkeiten für alle FOMC-Meetings (2000–2026)
 *           aus den Rohdaten ZQ=F (Yahoo) und DFF (FRED) und speichert sie in macro_calendar_events.metadata_json.
 * @usage: node tools/synthesize_fedwatch_probabilities.js [--dry-run]
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Vollständiger historischer FOMC-Sitzungskalender 2000 bis 2026 (inkl. SEP-Kennzeichnung)
export const HISTORICAL_FOMC_MEETINGS = [
  // 2000
  { date: '2000-02-02', sep: false }, { date: '2000-03-21', sep: false },
  { date: '2000-05-16', sep: false }, { date: '2000-06-28', sep: false },
  { date: '2000-08-22', sep: false }, { date: '2000-10-03', sep: false },
  { date: '2000-11-15', sep: false }, { date: '2000-12-19', sep: false },
  // 2001
  { date: '2001-01-03', sep: false, isEmergency: true }, // Notfall-Senkung 50 Bp
  { date: '2001-01-31', sep: false }, { date: '2001-03-20', sep: false },
  { date: '2001-04-18', sep: false, isEmergency: true }, // Notfall-Senkung 50 Bp
  { date: '2001-05-15', sep: false }, { date: '2001-06-27', sep: false },
  { date: '2001-08-21', sep: false }, { date: '2001-09-17', sep: false, isEmergency: true }, // 9/11 Notfall-Senkung
  { date: '2001-10-02', sep: false }, { date: '2001-11-06', sep: false },
  { date: '2001-12-11', sep: false },
  // 2002
  { date: '2002-01-30', sep: false }, { date: '2002-03-19', sep: false },
  { date: '2002-05-07', sep: false }, { date: '2002-06-26', sep: false },
  { date: '2002-08-13', sep: false }, { date: '2002-09-24', sep: false },
  { date: '2002-11-06', sep: false }, { date: '2002-12-10', sep: false },
  // 2003
  { date: '2003-01-29', sep: false }, { date: '2003-03-18', sep: false },
  { date: '2003-05-06', sep: false }, { date: '2003-06-25', sep: false },
  { date: '2003-08-12', sep: false }, { date: '2003-09-16', sep: false },
  { date: '2003-10-28', sep: false }, { date: '2003-12-09', sep: false },
  // 2004
  { date: '2004-01-28', sep: false }, { date: '2004-03-16', sep: false },
  { date: '2004-05-04', sep: false }, { date: '2004-06-30', sep: false },
  { date: '2004-08-10', sep: false }, { date: '2004-09-21', sep: false },
  { date: '2004-11-10', sep: false }, { date: '2004-12-14', sep: false },
  // 2005
  { date: '2005-02-02', sep: false }, { date: '2005-03-22', sep: false },
  { date: '2005-05-03', sep: false }, { date: '2005-06-30', sep: false },
  { date: '2005-08-09', sep: false }, { date: '2005-09-20', sep: false },
  { date: '2005-11-01', sep: false }, { date: '2005-12-13', sep: false },
  // 2006
  { date: '2006-01-31', sep: false }, { date: '2006-03-28', sep: false },
  { date: '2006-05-10', sep: false }, { date: '2006-06-29', sep: false },
  { date: '2006-08-08', sep: false }, { date: '2006-09-20', sep: false },
  { date: '2006-10-25', sep: false }, { date: '2006-12-12', sep: false },
  // 2007
  { date: '2007-01-31', sep: false }, { date: '2007-03-21', sep: false },
  { date: '2007-05-09', sep: false }, { date: '2007-06-28', sep: false },
  { date: '2007-08-07', sep: false }, { date: '2007-09-18', sep: false },
  { date: '2007-10-31', sep: false }, { date: '2007-12-11', sep: false },
  // 2008
  { date: '2008-01-22', sep: false, isEmergency: true }, // Notfall-Senkung 75 Bp
  { date: '2008-01-30', sep: false }, { date: '2008-03-18', sep: false },
  { date: '2008-04-30', sep: false }, { date: '2008-06-25', sep: false },
  { date: '2008-08-05', sep: false }, { date: '2008-09-16', sep: false },
  { date: '2008-10-08', sep: false, isEmergency: true }, // Koordinierte Notfall-Senkung
  { date: '2008-10-29', sep: false }, { date: '2008-12-16', sep: false }, // Übergang auf ZLB 0.00-0.25%
  // 2009
  { date: '2009-01-28', sep: false }, { date: '2009-03-18', sep: false },
  { date: '2009-04-29', sep: false }, { date: '2009-06-24', sep: false },
  { date: '2009-08-12', sep: false }, { date: '2009-09-23', sep: false },
  { date: '2009-11-04', sep: false }, { date: '2009-12-16', sep: false },
  // 2010
  { date: '2010-01-27', sep: false }, { date: '2010-03-16', sep: false },
  { date: '2010-04-28', sep: false }, { date: '2010-06-23', sep: false },
  { date: '2010-08-10', sep: false }, { date: '2010-09-21', sep: false },
  { date: '2010-11-03', sep: false }, { date: '2010-12-14', sep: false },
  // 2011
  { date: '2011-01-26', sep: false }, { date: '2011-03-15', sep: false },
  { date: '2011-04-27', sep: false }, { date: '2011-06-22', sep: false },
  { date: '2011-08-09', sep: false }, { date: '2011-09-21', sep: false },
  { date: '2011-11-02', sep: false }, { date: '2011-12-13', sep: false },
  // 2012 (Beginn Dot-Plot / regelmäßiges SEP)
  { date: '2012-01-25', sep: true },  { date: '2012-03-13', sep: false },
  { date: '2012-04-25', sep: true },  { date: '2012-06-20', sep: true },
  { date: '2012-08-01', sep: false }, { date: '2012-09-13', sep: true },
  { date: '2012-10-24', sep: false }, { date: '2012-12-12', sep: true },
  // 2013
  { date: '2013-01-30', sep: false }, { date: '2013-03-20', sep: true },
  { date: '2013-05-01', sep: false }, { date: '2013-06-19', sep: true },
  { date: '2013-07-31', sep: false }, { date: '2013-09-18', sep: true },
  { date: '2013-10-30', sep: false }, { date: '2013-12-18', sep: true },
  // 2014
  { date: '2014-01-29', sep: false }, { date: '2014-03-19', sep: true },
  { date: '2014-04-30', sep: false }, { date: '2014-06-18', sep: true },
  { date: '2014-07-30', sep: false }, { date: '2014-09-17', sep: true },
  { date: '2014-10-29', sep: false }, { date: '2014-12-17', sep: true },
  // 2015
  { date: '2015-01-28', sep: false }, { date: '2015-03-18', sep: true },
  { date: '2015-04-29', sep: false }, { date: '2015-06-17', sep: true },
  { date: '2015-07-29', sep: false }, { date: '2015-09-17', sep: true },
  { date: '2015-10-28', sep: false }, { date: '2015-12-16', sep: true },
  // 2016
  { date: '2016-01-27', sep: false }, { date: '2016-03-16', sep: true },
  { date: '2016-04-27', sep: false }, { date: '2016-06-15', sep: true },
  { date: '2016-07-27', sep: false }, { date: '2016-09-21', sep: true },
  { date: '2016-11-02', sep: false }, { date: '2016-12-14', sep: true },
  // 2017
  { date: '2017-02-01', sep: false }, { date: '2017-03-15', sep: true },
  { date: '2017-05-03', sep: false }, { date: '2017-06-14', sep: true },
  { date: '2017-07-26', sep: false }, { date: '2017-09-20', sep: true },
  { date: '2017-11-01', sep: false }, { date: '2017-12-13', sep: true },
  // 2018
  { date: '2018-01-31', sep: false }, { date: '2018-03-21', sep: true },
  { date: '2018-05-02', sep: false }, { date: '2018-06-13', sep: true },
  { date: '2018-08-01', sep: false }, { date: '2018-09-26', sep: true },
  { date: '2018-11-08', sep: false }, { date: '2018-12-19', sep: true },
  // 2019
  { date: '2019-01-30', sep: false }, { date: '2019-03-20', sep: true },
  { date: '2019-05-01', sep: false }, { date: '2019-06-19', sep: true },
  { date: '2019-07-31', sep: false }, { date: '2019-09-18', sep: true },
  { date: '2019-10-30', sep: false }, { date: '2019-12-11', sep: true },
  // 2020
  { date: '2020-01-29', sep: false },
  { date: '2020-03-03', sep: false, isEmergency: true }, // COVID Notfall-Senkung 50 Bp
  { date: '2020-03-15', sep: true, isEmergency: true },  // COVID Notfall-Senkung 100 Bp (ZLB)
  { date: '2020-04-29', sep: false }, { date: '2020-06-10', sep: true },
  { date: '2020-07-29', sep: false }, { date: '2020-09-16', sep: true },
  { date: '2020-11-05', sep: false }, { date: '2020-12-16', sep: true },
  // 2021
  { date: '2021-01-27', sep: false }, { date: '2021-03-17', sep: true },
  { date: '2021-04-28', sep: false }, { date: '2021-06-16', sep: true },
  { date: '2021-07-28', sep: false }, { date: '2021-09-22', sep: true },
  { date: '2021-11-03', sep: false }, { date: '2021-12-15', sep: true },
  // 2022
  { date: '2022-01-26', sep: false }, { date: '2022-03-16', sep: true },
  { date: '2022-05-04', sep: false }, { date: '2022-06-15', sep: true },
  { date: '2022-07-27', sep: false }, { date: '2022-09-21', sep: true },
  { date: '2022-11-02', sep: false }, { date: '2022-12-14', sep: true },
  // 2023
  { date: '2023-02-01', sep: false }, { date: '2023-03-22', sep: true },
  { date: '2023-05-03', sep: false }, { date: '2023-06-14', sep: true },
  { date: '2023-07-26', sep: false }, { date: '2023-09-20', sep: true },
  { date: '2023-11-01', sep: false }, { date: '2023-12-13', sep: true },
  // 2024
  { date: '2024-01-31', sep: false }, { date: '2024-03-20', sep: true },
  { date: '2024-05-01', sep: false }, { date: '2024-06-12', sep: true },
  { date: '2024-07-31', sep: false }, { date: '2024-09-18', sep: true },
  { date: '2024-11-07', sep: false }, { date: '2024-12-18', sep: true },
  // 2025
  { date: '2025-01-29', sep: false }, { date: '2025-03-19', sep: true },
  { date: '2025-05-07', sep: false }, { date: '2025-06-18', sep: true },
  { date: '2025-07-30', sep: false }, { date: '2025-09-17', sep: true },
  { date: '2025-10-29', sep: false }, { date: '2025-12-10', sep: true },
  // 2026
  { date: '2026-01-28', sep: false }, { date: '2026-03-18', sep: true },
  { date: '2026-04-29', sep: false }, { date: '2026-06-17', sep: true },
  { date: '2026-07-29', sep: false }, { date: '2026-09-16', sep: true },
  { date: '2026-11-05', sep: false }, { date: '2026-12-16', sep: true }
];

/**
 * Gibt den letzten Kalendertag des Monats zurück (28, 29, 30 oder 31)
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Sucht den letzten Handelstag an oder vor dem Ziel-Datum in einer Map
 */
function getLatestTradingDay(targetDateStr, dateMap, maxLookbackDays = 7) {
  const targetDate = new Date(targetDateStr);
  for (let i = 0; i <= maxLookbackDays; i++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (dateMap.has(dateStr)) {
      return { date: dateStr, value: dateMap.get(dateStr) };
    }
  }
  return null;
}

/**
 * Ermittelt den N-ten vorherigen Handelstag vor einem Datum
 */
function getPreviousTradingDay(targetDateStr, zqMap, steps = 1) {
  const targetDate = new Date(targetDateStr);
  let count = 0;
  for (let i = 1; i <= 15; i++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (zqMap.has(dateStr)) {
      count++;
      if (count === steps) {
        return dateStr;
      }
    }
  }
  return null;
}

/**
 * Berechnet die diskrete CME-Wahrscheinlichkeitsverteilung über 25-Bp-Korridore
 */
function calculateCmeProbabilities(rateChange) {
  // Mögliche Aktionen
  let p_hold = 0;
  let p_cut_25 = 0;
  let p_cut_50 = 0;
  let p_cut_75 = 0;
  let p_hike_25 = 0;
  let p_hike_50 = 0;

  if (rateChange <= 0) {
    // Senkung oder Pause
    if (rateChange >= -0.25) {
      p_cut_25 = Math.abs(rateChange) / 0.25;
      p_hold = 1 - p_cut_25;
    } else if (rateChange >= -0.50) {
      p_cut_50 = (Math.abs(rateChange) - 0.25) / 0.25;
      p_cut_25 = 1 - p_cut_50;
    } else {
      p_cut_75 = Math.min((Math.abs(rateChange) - 0.50) / 0.25, 1.0);
      p_cut_50 = 1 - p_cut_75;
    }
  } else {
    // Erhöhung oder Pause
    if (rateChange <= 0.25) {
      p_hike_25 = rateChange / 0.25;
      p_hold = 1 - p_hike_25;
    } else {
      p_hike_50 = Math.min((rateChange - 0.25) / 0.25, 1.0);
      p_hike_25 = 1 - p_hike_50;
    }
  }

  // Runde auf 4 Nachkommastellen
  const probs = {
    p_hold: Math.round(p_hold * 10000) / 10000,
    p_cut_25: Math.round(p_cut_25 * 10000) / 10000,
    p_cut_50: Math.round(p_cut_50 * 10000) / 10000,
    p_hike_25: Math.round(p_hike_25 * 10000) / 10000
  };

  // Bestimme Konsens-Aktion (Maximum der Wahrscheinlichkeiten)
  let consensus_action = 'HOLD';
  let consensus_p = probs.p_hold;

  if (probs.p_cut_25 > consensus_p) {
    consensus_action = 'CUT_25';
    consensus_p = probs.p_cut_25;
  }
  if (probs.p_cut_50 > consensus_p) {
    consensus_action = 'CUT_50';
    consensus_p = probs.p_cut_50;
  }
  if (probs.p_hike_25 > consensus_p) {
    consensus_action = 'HIKE_25';
    consensus_p = probs.p_hike_25;
  }

  return { ...probs, consensus_action, consensus_p };
}

/**
 * Berechnet den Checkpoint-Snapshot gemäß Spezifikation
 */
function evaluateCheckpoint(checkpointDateStr, meetingDateStr, zqMap, dffMap, currentTargetRate) {
  const zqEntry = getLatestTradingDay(checkpointDateStr, zqMap, 5);
  if (!zqEntry) return null;

  const dffEntry = getLatestTradingDay(zqEntry.date, dffMap, 5);
  if (!dffEntry) return null;

  const meetingDate = new Date(meetingDateStr);
  const year = meetingDate.getFullYear();
  const month = meetingDate.getMonth() + 1;
  const meetingDay = meetingDate.getDate();
  const totalDays = getDaysInMonth(year, month);

  // Tage vor und nach der Sitzung
  let daysBefore = meetingDay;
  let daysAfter = totalDays - daysBefore;
  if (daysAfter <= 0) {
    // Sitzung am letzten Tag des Monats: Mindestens 1 Tag zur Gewichtung ansetzen
    daysAfter = 1;
    daysBefore = totalDays - 1;
  }

  const futurePrice = zqEntry.value;
  const impliedMonthRate = 100 - futurePrice;
  const currentEffr = dffEntry.value;

  // CME-Formel nach R_neu auflösen
  const expectedNewRate = (impliedMonthRate * totalDays - daysBefore * currentEffr) / daysAfter;
  const rateChange = expectedNewRate - currentTargetRate;

  const probs = calculateCmeProbabilities(rateChange);

  return {
    date: zqEntry.date,
    future_price: Math.round(futurePrice * 10000) / 10000,
    implied_rate: Math.round(impliedMonthRate * 10000) / 10000,
    expected_new_rate: Math.round(expectedNewRate * 10000) / 10000,
    ...probs
  };
}

export async function synthesizeAllFedwatchProbabilities(options = {}) {
  const isDryRun = options.dryRun || false;
  console.log(`[FedWatch-Synthesizer] Starte Synthese (Dry-Run: ${isDryRun})...`);

  const pool = mysql.createPool(process.env.DATABASE_URL);

  try {
    // 1. Lade DFF (EFFR)
    console.log('[1/4] Lade EFFR (DFF) aus econ_fred...');
    const [dffRows] = await pool.query('SELECT observation_date, value FROM econ_fred WHERE series_id = "DFF"');
    const dffMap = new Map(dffRows.map(r => [r.observation_date, parseFloat(r.value)]));
    console.log(`   -> ${dffMap.size} EFFR-Datensätze geladen.`);

    // 2. Lade Target Rates (DFEDTAR & DFEDTARU)
    console.log('[2/4] Lade Leitzins-Ziele (DFEDTARU / DFEDTAR) aus econ_fred...');
    const [tarRows] = await pool.query(`
      SELECT observation_date, value 
      FROM econ_fred 
      WHERE series_id IN ("DFEDTAR", "DFEDTARU") 
      ORDER BY observation_date ASC
    `);
    const tarMap = new Map(tarRows.map(r => [r.observation_date, parseFloat(r.value)]));
    console.log(`   -> ${tarMap.size} Zielzins-Datensätze geladen.`);

    // 3. Lade ZQ=F (Fed Funds Futures)
    console.log('[3/4] Lade Futures-Preise (ZQ=F) aus market_data_yahoo...');
    const [zqRows] = await pool.query('SELECT record_date, close FROM market_data_yahoo WHERE symbol = "ZQ=F"');
    const zqMap = new Map(zqRows.map(r => [r.record_date, parseFloat(r.close)]));
    console.log(`   -> ${zqMap.size} ZQ=F-Datensätze geladen.`);

    // 4. Lade CPI-Release-Dates aus macro_calendar_events
    const [cpiRows] = await pool.query(`
      SELECT event_date 
      FROM macro_calendar_events 
      WHERE subcategory = "INFLATION" AND status = "COMPLETED"
      ORDER BY event_date ASC
    `);
    const cpiDates = cpiRows.map(r => new Date(r.event_date).toISOString().slice(0, 10));

    console.log(`[4/4] Berechne Wahrscheinlichkeiten für ${HISTORICAL_FOMC_MEETINGS.length} FOMC-Meetings...`);

    let processedCount = 0;
    let t48CalculatedCount = 0;
    let highConvictionCount = 0; // P >= 0.80
    let correctPredictions = 0;

    for (const meeting of HISTORICAL_FOMC_MEETINGS) {
      const meetingDateStr = meeting.date;
      const meetingId = `fomc_${meetingDateStr.replace(/-/g, '_')}`;
      const mDate = new Date(meetingDateStr);
      const year = mDate.getFullYear();
      const month = mDate.getMonth() + 1;

      // Ermittle den Zielzins vor der Sitzung
      const preTargetEntry = getLatestTradingDay(meetingDateStr, tarMap, 10);
      const currentTargetRate = preTargetEntry ? preTargetEntry.value : null;

      // Ermittle den Zielzins nach der Sitzung (T+1 bis T+3)
      const postDate = new Date(mDate);
      postDate.setDate(postDate.getDate() + 2);
      const postTargetEntry = getLatestTradingDay(postDate.toISOString().slice(0, 10), tarMap, 5);
      const newTargetRate = postTargetEntry ? postTargetEntry.value : null;

      // Reale Zinsaktion bestimmen
      let actualAction = 'HOLD';
      if (currentTargetRate !== null && newTargetRate !== null) {
        const delta = Math.round((newTargetRate - currentTargetRate) * 100) / 100;
        if (delta <= -0.625) actualAction = 'CUT_75';
        else if (delta <= -0.375) actualAction = 'CUT_50';
        else if (delta <= -0.125) actualAction = 'CUT_25';
        else if (delta >= 0.625) actualAction = 'HIKE_75';
        else if (delta >= 0.375) actualAction = 'HIKE_50';
        else if (delta >= 0.125) actualAction = 'HIKE_25';
        else actualAction = 'HOLD';
      }

      // Checkpoint 1: month_start (1. Handelstag des Sitzungsmonats)
      const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthStartData = currentTargetRate !== null
        ? evaluateCheckpoint(monthStartStr, meetingDateStr, zqMap, dffMap, currentTargetRate)
        : null;

      // Checkpoint 2: pre_blackout (ca. 12 Tage vor dem Meeting)
      const preBlackoutDate = new Date(mDate);
      preBlackoutDate.setDate(preBlackoutDate.getDate() - 12);
      const preBlackoutData = currentTargetRate !== null
        ? evaluateCheckpoint(preBlackoutDate.toISOString().slice(0, 10), meetingDateStr, zqMap, dffMap, currentTargetRate)
        : null;

      // Checkpoint 3: post_cpi (letzter CPI-Termin vor der Sitzung)
      const priorCpi = cpiDates.filter(d => d < meetingDateStr).pop();
      const postCpiData = (currentTargetRate !== null && priorCpi)
        ? evaluateCheckpoint(priorCpi, meetingDateStr, zqMap, dffMap, currentTargetRate)
        : null;

      // Checkpoint 4: t_minus_48h (2 Handelstage vor dem Meeting)
      const t48DateStr = getPreviousTradingDay(meetingDateStr, zqMap, 2);
      const t48Data = (currentTargetRate !== null && t48DateStr)
        ? evaluateCheckpoint(t48DateStr, meetingDateStr, zqMap, dffMap, currentTargetRate)
        : null;

      if (t48Data) {
        t48CalculatedCount++;
        if (t48Data.consensus_p >= 0.80) {
          highConvictionCount++;
          if (t48Data.consensus_action === actualAction) {
            correctPredictions++;
          }
        }
      }

      // Erstelle Metadaten-Objekt
      const metadata = {
        hasSummaryOfEconomicProjections: Boolean(meeting.sep),
        isEmergency: Boolean(meeting.isEmergency),
        expectedAction: t48Data ? t48Data.consensus_action : 'UNKNOWN',
        actualAction: actualAction,
        currentTargetRate: currentTargetRate,
        newTargetRate: newTargetRate,
        fedwatch: {
          month_start: monthStartData,
          pre_blackout: preBlackoutData,
          post_cpi: postCpiData,
          t_minus_48h: t48Data
        }
      };

      const title = meeting.sep
        ? 'FOMC Zinsentscheid & Wirtschaftsprojektionen (SEP/Dot Plot)'
        : 'FOMC Zinsentscheid';
      
      const todayStr = new Date().toISOString().slice(0, 10);
      const status = meetingDateStr < todayStr ? 'COMPLETED' : 'CONFIRMED';

      if (!isDryRun) {
        await pool.query(`
          INSERT INTO macro_calendar_events 
            (id, category, subcategory, title, event_date, event_time, status, criticality, metadata_json, actual_value, source, created_at, updated_at)
          VALUES 
            (?, 'CENTRAL_BANK', 'FOMC', ?, ?, '20:00 MEZ', ?, 'CRITICAL', ?, ?, 'FEDERAL_RESERVE_CALENDAR', NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            metadata_json = VALUES(metadata_json),
            actual_value = VALUES(actual_value),
            status = VALUES(status),
            updated_at = NOW()
        `, [
          meetingId,
          title,
          meetingDateStr,
          status,
          JSON.stringify(metadata),
          actualAction
        ]);
      }

      processedCount++;
    }

    console.log('\n================================================================');
    console.log('🎉 [FedWatch-Synthesizer] ERFOLGREICH ABGESCHLOSSEN!');
    console.log('================================================================');
    console.log(`• Gesamtzahl FOMC-Meetings verarbeitet:   ${processedCount}`);
    console.log(`• Meetings mit berechnetem T-48h Snapshot: ${t48CalculatedCount}`);
    console.log(`• Konsensfälle mit P >= 80%:              ${highConvictionCount}`);
    if (highConvictionCount > 0) {
      const accuracy = ((correctPredictions / highConvictionCount) * 100).toFixed(1);
      console.log(`• Trefferquote bei P >= 80%:              ${correctPredictions} / ${highConvictionCount} (${accuracy}%)`);
      console.log(`• Empirische Failure Rate bei P >= 80%:   ${((1 - (correctPredictions / highConvictionCount)) * 100).toFixed(1)}%`);
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fehler bei der Wahrscheinlichkeitssynthese:', err);
  } finally {
    await pool.end();
  }
}

// CLI-Direktaufruf
if (process.argv[1] && process.argv[1].endsWith('synthesize_fedwatch_probabilities.js')) {
  const dryRun = process.argv.includes('--dry-run');
  synthesizeAllFedwatchProbabilities({ dryRun });
}
