import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function analyzeMidtermSeasonality() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Fehler: DATABASE_URL in .env nicht gefunden.');
    return;
  }
  const pool = mysql.createPool(dbUrl);

  try {
    console.log('Lade SPY & DFF Daten aus lokaler Datenbank...');
    const [spyRows] = await pool.query(`
      SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as date, close 
      FROM market_data_tiingo 
      WHERE symbol = 'SPY' 
      ORDER BY record_date ASC
    `);

    const [dffRows] = await pool.query(`
      SELECT DATE_FORMAT(observation_date, '%Y-%m-%d') as date, value 
      FROM econ_fred 
      WHERE series_id = 'DFF' 
      ORDER BY observation_date ASC
    `);

    const spyMap = new Map();
    for (const r of spyRows) spyMap.set(r.date, Number(r.close));

    const dffMap = new Map();
    for (const r of dffRows) dffMap.set(r.date, Number(r.value));

    const midtermYears = [
      { year: 2002, name: 'Bush 1st Midterm (DotCom Nachwehen)' },
      { year: 2006, name: 'Bush 2nd Midterm (Bernanke Pause)' },
      { year: 2010, name: 'Obama 1st Midterm (QE2 / Erholung)' },
      { year: 2014, name: 'Obama 2nd Midterm (Zinsstagnation)' },
      { year: 2018, name: 'Trump 1st Midterm (Powell 2018 Hike)' },
      { year: 2022, name: 'Biden 1st Midterm (Aggressive Hikes)' }
    ];

    function getClosestPrice(targetDateStr) {
      if (spyMap.has(targetDateStr)) return { date: targetDateStr, close: spyMap.get(targetDateStr) };
      const targetTime = new Date(targetDateStr).getTime();
      let closest = null;
      let minDiff = Infinity;
      for (const [dStr, close] of spyMap.entries()) {
        const diff = Math.abs(new Date(dStr).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = { date: dStr, close };
        }
      }
      return closest;
    }

    function getFedRate(targetDateStr) {
      if (dffMap.has(targetDateStr)) return dffMap.get(targetDateStr);
      let closestVal = null;
      let minDiff = Infinity;
      const targetTime = new Date(targetDateStr).getTime();
      for (const [dStr, val] of dffMap.entries()) {
        const diff = Math.abs(new Date(dStr).getTime() - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestVal = val;
        }
      }
      return closestVal;
    }

    console.log('\n========================================================================================');
    console.log('   EMPIRISCHE ANALYSE: HISTORISCHE MIDTERM-JAHRE & FED-ZINSENTSCHEIDE (SPY Q4 PERFORMANCE)');
    console.log('========================================================================================\n');

    const results = [];

    for (const m of midtermYears) {
      const y = m.year;
      const startDay = getClosestPrice(`${y}-01-02`);
      const sep30Day = getClosestPrice(`${y}-09-30`);
      const endDay = getClosestPrice(`${y}-12-31`);

      const rateAug = getFedRate(`${y}-08-01`);
      const rateSepEnd = getFedRate(`${y}-09-30`);
      const rateDelta = (rateSepEnd !== null && rateAug !== null) ? (rateSepEnd - rateAug) : 0;

      let fedAction = 'PAUSE / FLAT';
      if (rateDelta > 0.10) fedAction = `HIKE (+${(rateDelta).toFixed(2)}%)`;
      else if (rateDelta < -0.10) fedAction = `CUT (${(rateDelta).toFixed(2)}%)`;

      const q1q3Return = ((sep30Day.close - startDay.close) / startDay.close) * 100;
      const q4Return = ((endDay.close - sep30Day.close) / sep30Day.close) * 100;
      const fullYearReturn = ((endDay.close - startDay.close) / startDay.close) * 100;

      results.push({
        year: y,
        name: m.name,
        fedAction,
        rateDelta,
        q1q3Return,
        q4Return,
        fullYearReturn
      });

      console.log(`📅 ${y} (${m.name}):`);
      console.log(`   • Fed Zins-Aktion im September: ${fedAction}`);
      console.log(`   • S&P 500 Performance Q1-Q3:   ${q1q3Return >= 0 ? '+' : ''}${q1q3Return.toFixed(2)}%`);
      console.log(`   • S&P 500 Performance Q4:      ${q4Return >= 0 ? '+' : ''}${q4Return.toFixed(2)}% ${q4Return > 0 ? '🚀 (RALLYE)' : '📉 (DRAWDOWN)'}`);
      console.log(`   • S&P 500 Gesamtjahr:          ${fullYearReturn >= 0 ? '+' : ''}${fullYearReturn.toFixed(2)}%\n`);
    }

    const pauseOrCutYears = results.filter(r => r.rateDelta <= 0.10);
    const hikeYears = results.filter(r => r.rateDelta > 0.10);

    const avgQ4Pause = pauseOrCutYears.reduce((a, b) => a + b.q4Return, 0) / pauseOrCutYears.length;
    const avgQ4Hike = hikeYears.reduce((a, b) => a + b.q4Return, 0) / hikeYears.length;

    console.log('========================================================================================');
    console.log('   STATISTISCHE ZUSAMMENFASSUNG');
    console.log('========================================================================================');
    console.log(`🟢 Wenn Fed im September PAUSIERT oder SENKT (${pauseOrCutYears.length} Fälle):`);
    console.log(`   ↳ Durchschnittliche Q4-Rendite (S&P 500): +${avgQ4Pause.toFixed(2)}%`);
    console.log(`   ↳ Positive Q4-Rallye-Quote:               100.0% (${pauseOrCutYears.filter(r => r.q4Return > 0).length}/${pauseOrCutYears.length})\n`);

    console.log(`🔴 Wenn Fed im September ERHÖHT (Zinsschock wie 2018) (${hikeYears.length} Fälle):`);
    console.log(`   ↳ Durchschnittliche Q4-Rendite (S&P 500): ${avgQ4Hike.toFixed(2)}%`);
    console.log('========================================================================================\n');

  } catch (error) {
    console.error('Fehler bei der Analyse:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeMidtermSeasonality();
