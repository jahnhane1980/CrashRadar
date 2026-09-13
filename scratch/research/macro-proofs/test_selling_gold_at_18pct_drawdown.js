import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

async function testSellingGoldAt18Pct() {
  console.log('========================================================================================');
  console.log('   SIMULATION: GOLD BEI -18%/-19% SPY DRAWDOWN VERKAUFEN UND IN TECH/KRYPTO GEHEN?');
  console.log('========================================================================================\n');

  // Lade GLD
  const gldRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'scratch/trash/cache/GLD_tiingo_full.json'), 'utf-8'));
  const gldMap = new Map(gldRaw.map(d => [d.date, d.close]));

  // Lade BTC
  const btcRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'scratch/research/turnarounds/data_cache/BTC-USD_daily.json'), 'utf-8'));
  const btcMap = new Map(btcRaw.map(d => [d.date.split('T')[0], d.close]));

  // Lade SPY und QQQ aus MySQL
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [spyRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
  const [qqqRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
  await conn.end();

  const spyMap = new Map(spyRows.map(d => [d.date, d.close]));
  const qqqMap = new Map(qqqRows.map(d => [d.date, d.close]));

  const CRISES = [
    {
      name: '2020 Corona Shock',
      spyPeakDate: '2020-02-19',
      spyTroughDate: '2020-03-23',
      endDate: '2020-06-30',
      hasBtc: true
    },
    {
      name: '2018 Q4 Fed Hike Crash',
      spyPeakDate: '2018-10-03',
      spyTroughDate: '2018-12-24',
      endDate: '2019-04-30',
      hasBtc: false
    },
    {
      name: '2022 Fed Rate Hike (Welle 1)',
      spyPeakDate: '2022-01-04',
      spyTroughDate: '2022-06-17',
      endDate: '2022-12-31',
      hasBtc: true
    },
    {
      name: '2008 Lehman Brothers',
      spyPeakDate: '2008-08-11',
      spyTroughDate: '2008-11-20',
      endDate: '2009-06-30',
      hasBtc: false
    }
  ];

  for (const cr of CRISES) {
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`📌 SZENARIO: ${cr.name.toUpperCase()}`);
    console.log(`----------------------------------------------------------------------------------------`);

    const spyPeak = spyMap.get(cr.spyPeakDate);
    const qqqPeak = qqqMap.get(cr.spyPeakDate);
    const gldPeak = gldMap.get(cr.spyPeakDate);
    const btcPeak = cr.hasBtc ? btcMap.get(cr.spyPeakDate) : null;

    // Finde den Tag, an dem SPY erstmals -18% oder mehr Drawdown erreicht
    let date18 = null;
    let spyAt18 = null;
    for (const r of spyRows) {
      if (r.date < cr.spyPeakDate || r.date > cr.endDate) continue;
      const dd = ((r.close - spyPeak) / spyPeak) * 100;
      if (dd <= -18.0) {
        date18 = r.date;
        spyAt18 = r.close;
        break;
      }
    }

    if (!date18) {
      console.log(`  SPY hat die -18% Schwelle in dieser Periode nicht erreicht.`);
      continue;
    }

    const spyDDAt18 = ((spyAt18 - spyPeak) / spyPeak) * 100;
    const qqqAt18 = qqqMap.get(date18);
    const qqqDDAt18 = ((qqqAt18 - qqqPeak) / qqqPeak) * 100;
    const gldAt18 = gldMap.get(date18);
    const gldChgAt18 = ((gldAt18 - gldPeak) / gldPeak) * 100;
    const btcAt18 = cr.hasBtc ? btcMap.get(date18) : null;
    const btcChgAt18 = cr.hasBtc && btcPeak ? ((btcAt18 - btcPeak) / btcPeak) * 100 : null;

    console.log(`1. Zeitpunkt bei SPY -18%/-19%: Datum ${date18}`);
    console.log(`   • SPY: Kurs $${spyAt18.toFixed(2)} | Drawdown: ${spyDDAt18.toFixed(1)} %`);
    console.log(`   • QQQ: Kurs $${qqqAt18.toFixed(2)} | Drawdown: ${qqqDDAt18.toFixed(1)} %`);
    console.log(`   • GLD: Kurs $${gldAt18.toFixed(2)} | Rendite vs SPY-Peak: ${gldChgAt18 >= 0 ? '+' : ''}${gldChgAt18.toFixed(1)} %`);
    if (cr.hasBtc && btcAt18) {
      console.log(`   • BTC: Kurs $${btcAt18.toFixed(0)} | Drawdown vs SPY-Peak: ${btcChgAt18.toFixed(1)} %`);
    }

    // Was passierte DANACH bis zum echten Marktboden (spyTroughDate)?
    const spyTrough = spyMap.get(cr.spyTroughDate);
    const qqqTrough = qqqMap.get(cr.spyTroughDate);
    const gldAtTrough = gldMap.get(cr.spyTroughDate);
    const btcAtTrough = cr.hasBtc ? btcMap.get(cr.spyTroughDate) : null;

    const spyFurtherDrop = ((spyTrough - spyAt18) / spyAt18) * 100;
    const qqqFurtherDrop = ((qqqTrough - qqqAt18) / qqqAt18) * 100;
    const gldFurtherChg = ((gldAtTrough - gldAt18) / gldAt18) * 100;
    const btcFurtherDrop = cr.hasBtc && btcAtTrough ? ((btcAtTrough - btcAt18) / btcAt18) * 100 : null;

    console.log(`\n2. Was passierte DANACH bis zum echten Boden (${cr.spyTroughDate})?`);
    console.log(`   • SPY fiel vom -18%-Signal nochmals um: ${spyFurtherDrop.toFixed(1)} % (auf $${spyTrough.toFixed(2)}, Gesamt-DD: ${(((spyTrough - spyPeak)/spyPeak)*100).toFixed(1)} %)`);
    console.log(`   • QQQ fiel vom -18%-Signal nochmals um: ${qqqFurtherDrop.toFixed(1)} % (auf $${qqqTrough.toFixed(2)}, Gesamt-DD: ${(((qqqTrough - qqqPeak)/qqqPeak)*100).toFixed(1)} %)`);
    console.log(`   • GLD veränderte sich vom -18%-Signal um: ${gldFurtherChg >= 0 ? '+' : ''}${gldFurtherChg.toFixed(1)} % (auf $${gldAtTrough.toFixed(2)})`);
    if (cr.hasBtc && btcFurtherDrop !== null) {
      console.log(`   • BTC fiel vom -18%-Signal nochmals um: ${btcFurtherDrop.toFixed(1)} % (auf $${btcAtTrough.toFixed(0)})`);
    }

    // Was passierte in der Erholung (Ende der Periode)?
    const spyEnd = spyMap.get(cr.endDate);
    const qqqEnd = qqqMap.get(cr.endDate);
    const gldEnd = gldMap.get(cr.endDate);
    const btcEnd = cr.hasBtc ? btcMap.get(cr.endDate) : null;

    const qqqReboundFrom18 = ((qqqEnd - qqqAt18) / qqqAt18) * 100;
    const gldReboundFrom18 = ((gldEnd - gldAt18) / gldAt18) * 100;
    const btcReboundFrom18 = cr.hasBtc && btcEnd ? ((btcEnd - btcAt18) / btcAt18) * 100 : null;

    console.log(`\n3. Gesamtertrag zum Stichtag (${cr.endDate}) ab dem -18%-Signal:`);
    console.log(`   • Wenn man bei -18% in QQQ ging: ${qqqReboundFrom18 >= 0 ? '+' : ''}${qqqReboundFrom18.toFixed(1)} %`);
    console.log(`   • Wenn man Gold einfach BEHIELT:  ${gldReboundFrom18 >= 0 ? '+' : ''}${gldReboundFrom18.toFixed(1)} %`);
    if (cr.hasBtc && btcReboundFrom18 !== null) {
      console.log(`   • Wenn man bei -18% in BTC ging: ${btcReboundFrom18 >= 0 ? '+' : ''}${btcReboundFrom18.toFixed(1)} %`);
    }
    console.log('\n');
  }
}

testSellingGoldAt18Pct();
