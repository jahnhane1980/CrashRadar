import 'dotenv/config';
import mysql from 'mysql2/promise';

async function analyzeDotcomAndBeyond() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Hole SPY und QQQ aus market_data_tiingo und GC=F aus market_data_yahoo ab 2000-08-30
  const [rows] = await conn.query(`
    SELECT t.record_date,
           MAX(CASE WHEN t.symbol = 'SPY' THEN t.close END) as spy,
           MAX(CASE WHEN t.symbol = 'QQQ' THEN t.close END) as qqq,
           MAX(CASE WHEN y.symbol = 'GC=F' THEN y.close END) as gold
    FROM market_data_tiingo t
    LEFT JOIN market_data_yahoo y ON t.record_date = y.record_date AND y.symbol = 'GC=F'
    WHERE t.record_date BETWEEN '2000-08-30' AND '2003-05-01'
      AND t.symbol IN ('SPY', 'QQQ')
    GROUP BY t.record_date
    ORDER BY t.record_date ASC
  `);

  console.log(`Loaded ${rows.length} trading days from 2000 to 2003.`);

  // Dotcom Phase 1: Sep 2000 bis April 2001 (Tech Implosion)
  // Dotcom Phase 2: Mai 2001 bis Sep 2001 (inkl. 9/11 Schock)
  // Dotcom Phase 3: Finale Kapitulation 2002 (WorldCom / Enron)

  const periods = [
    { name: 'Dotcom Phase 1 (Sep 2000 - Apr 2001)', start: '2000-09-01', end: '2001-04-15' },
    { name: 'Dotcom Phase 2 (9/11 Anschläge Sep 2001)', start: '2001-08-15', end: '2001-10-31' },
    { name: 'Dotcom Phase 3 (Finaler Boden 2002)', start: '2002-03-15', end: '2002-10-31' },
  ];

  for (const p of periods) {
    const pRows = rows.filter(r => r.record_date >= p.start && r.record_date <= p.end && r.gold && r.spy && r.qqq);
    if (pRows.length === 0) continue;

    console.log(`\n========================================================================`);
    console.log(`EPISODE: ${p.name}`);
    console.log(`========================================================================`);

    let spyPeak = 0, spyPeakDate = '';
    let spyLow = Infinity, spyLowDate = '';
    let qqqPeak = 0, qqqPeakDate = '';
    let qqqLow = Infinity, qqqLowDate = '';
    let goldPeak = 0, goldPeakDate = '';
    let goldLow = Infinity, goldLowDate = '';

    for (const r of pRows) {
      if (r.spy > spyPeak) { spyPeak = r.spy; spyPeakDate = r.record_date; }
      if (r.spy < spyLow) { spyLow = r.spy; spyLowDate = r.record_date; }
      if (r.qqq > qqqPeak) { qqqPeak = r.qqq; qqqPeakDate = r.record_date; }
      if (r.qqq < qqqLow) { qqqLow = r.qqq; qqqLowDate = r.record_date; }
      if (r.gold > goldPeak) { goldPeak = r.gold; goldPeakDate = r.record_date; }
      if (r.gold < goldLow) { goldLow = r.gold; goldLowDate = r.record_date; }
    }

    const spyDD = ((spyLow - spyPeak) / spyPeak) * 100;
    const qqqDD = ((qqqLow - qqqPeak) / qqqPeak) * 100;
    const goldChange = ((pRows[pRows.length - 1].gold - pRows[0].gold) / pRows[0].gold) * 100;

    console.log(`Aktien-Crash:`);
    console.log(`  • SPY: Peak ${spyPeakDate} ($${spyPeak.toFixed(2)}) ➔ Low ${spyLowDate} ($${spyLow.toFixed(2)}) | Drawdown: ${spyDD.toFixed(1)} %`);
    console.log(`  • QQQ: Peak ${qqqPeakDate} ($${qqqPeak.toFixed(2)}) ➔ Low ${qqqLowDate} ($${qqqLow.toFixed(2)}) | Drawdown: ${qqqDD.toFixed(1)} %`);
    console.log(`  • Gold (GC=F): Start $${pRows[0].gold.toFixed(2)} ➔ Ende $${pRows[pRows.length-1].gold.toFixed(2)} | Veränderung: ${goldChange >= 0 ? '+' : ''}${goldChange.toFixed(1)} %`);

    // Gold Tief vs Aktien Tief
    console.log(`\nTimeline:`);
    console.log(`  • Gold Low am: ${goldLowDate} ($${goldLow.toFixed(2)})`);
    console.log(`  • SPY Low am:  ${spyLowDate} ($${spyLow.toFixed(2)})`);
    console.log(`  • QQQ Low am:  ${qqqLowDate} ($${qqqLow.toFixed(2)})`);
  }

  await conn.end();
}

analyzeDotcomAndBeyond();
