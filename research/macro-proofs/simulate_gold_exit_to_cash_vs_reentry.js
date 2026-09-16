import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function testStrategies() {
  const gldRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/historical_prices/GLD_tiingo_full.json'), 'utf-8'));
  const gldMap = new Map(gldRaw.map(d => [d.date, d.close]));

  const btcRaw = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/cache/turnarounds/BTC-USD_daily.json'), 'utf-8'));
  const btcMap = new Map(btcRaw.map(d => [d.date.split('T')[0], d.close]));

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [spyRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'SPY' ORDER BY record_date ASC`);
  const [qqqRows] = await conn.query(`SELECT record_date as date, close FROM market_data_tiingo WHERE symbol = 'QQQ' ORDER BY record_date ASC`);
  await conn.end();

  const spyMap = new Map(spyRows.map(d => [d.date, d.close]));
  const qqqMap = new Map(qqqRows.map(d => [d.date, d.close]));

  console.log('========================================================================================');
  console.log('   VERGLEICH DER 3 STRATEGIEN BEI CORONA 2020 (Startkapital: 100.000 $)');
  console.log('   Portfolio-Start am 19.02.2020: 50.000 $ Gold (GLD) + 50.000 $ Cash (IB01)');
  console.log('========================================================================================\n');

  // Stichtage Corona:
  // t0: 2020-02-19 (SPY Peak)
  // t1: 2020-03-09 (SPY -18.9%, Gold Peak $157.81)
  // t2: 2020-03-19 (Gold Boden $138.04, Reversal)
  // t3: 2020-03-23 (SPY Boden, QQQ Boden)
  // t_end: 2020-06-30 (Erholung nach 3 Monaten)

  const gld_t0 = gldMap.get('2020-02-19'); // $151.79
  const gld_t1 = gldMap.get('2020-03-09'); // $157.81
  const gld_t2 = gldMap.get('2020-03-19'); // $138.04
  const gld_end = gldMap.get('2020-06-30'); // $167.37

  const qqq_t1 = qqqMap.get('2020-03-09'); // $193.57
  const qqq_t2 = qqqMap.get('2020-03-19'); // $177.54
  const qqq_t3 = qqqMap.get('2020-03-23'); // $170.46
  const qqq_end = qqqMap.get('2020-06-30'); // $247.61

  const btc_t1 = btcMap.get('2020-03-09'); // $7924
  const btc_t2 = btcMap.get('2020-03-19'); // $6191 (Intraday Tief am 12.03. war $3850)
  const btc_end = btcMap.get('2020-06-30'); // $9138

  console.log('Preise zu den Zeitpunkten:');
  console.log(`- 19.02.2020 (Crash-Start): GLD $${gld_t0.toFixed(2)}`);
  console.log(`- 09.03.2020 (SPY -18.9%):  GLD $${gld_t1.toFixed(2)} | QQQ $${qqq_t1.toFixed(2)} | BTC $${btc_t1.toFixed(0)}`);
  console.log(`- 19.03.2020 (Gold-Boden):  GLD $${gld_t2.toFixed(2)} | QQQ $${qqq_t2.toFixed(2)} | BTC $${btc_t2.toFixed(0)}`);
  console.log(`- 23.03.2020 (Aktien-Boden): QQQ $${qqq_t3.toFixed(2)}`);
  console.log(`- 30.06.2020 (Stichtag):     GLD $${gld_end.toFixed(2)} | QQQ $${qqq_end.toFixed(2)} | BTC $${btc_end.toFixed(0)}\n`);

  // Strategie A: Bei -18% (09.03.) SOFORT Gold verkaufen und direkt 100% in QQQ gehen
  // Am 09.03. ist Gold wert: 50.000 * (157.81 / 151.79) = 51.983 $
  // Gesamt-Cash: 51.983 $ (Gold) + 50.000 $ (IB01) = 101.983 $
  // Kauf von QQQ am 09.03. zu $193.57:
  const qqqShares_A = 101983 / qqq_t1;
  const val_A_end = qqqShares_A * qqq_end;
  const maxDD_A = ((qqq_t3 - qqq_t1) / qqq_t1) * 100;

  // Strategie B: Bei -18% (09.03.) Gold verkaufen in CASH (IB01).
  // Am Gold-Boden (19.03. - 23.03.) mit vollem Cash (101.983 $) in QQQ einsteigen:
  const qqqShares_B = 101983 / qqq_t2; // Kauf am 19.03. bei Gold Reversal
  const val_B_end = qqqShares_B * qqq_end;
  const maxDD_B = ((qqq_t3 - qqq_t2) / qqq_t2) * 100;

  // Strategie C: Gold NICHT verkaufen (stoisch halten).
  // Am 19.03./23.03. NUR das 50.000 $ IB01 Cash in QQQ investieren:
  const qqqShares_C = 50000 / qqq_t2;
  const goldVal_C_end = 50000 * (gld_end / gld_t0);
  const val_C_end = (qqqShares_C * qqq_end) + goldVal_C_end;

  console.log('ERGEBNISSE AM 30. JUNI 2020 (nach 4 Monaten):');
  console.log('----------------------------------------------------------------------------------------');
  console.log(`Strategie A (Sofort-Kauf QQQ bei SPY -18%):`);
  console.log(`  • Endkapital: $${val_A_end.toFixed(2)} (+${(((val_A_end - 100000)/100000)*100).toFixed(1)} %)`);
  console.log(`  • Zwischenzeitlicher Schmerz (Drawdown nach Kauf): ${maxDD_A.toFixed(1)} % (QQQ fiel noch von $193 auf $170)`);

  console.log(`\nStrategie B (Gold bei -18% in CASH verkaufen, Kauf QQQ erst bei Gold-Boden 19.03.):`);
  console.log(`  • Endkapital: $${val_B_end.toFixed(2)} (+${(((val_B_end - 100000)/100000)*100).toFixed(1)} %)`);
  console.log(`  • Zwischenzeitlicher Schmerz (Drawdown nach Kauf): ${maxDD_B.toFixed(1)} % (fast am perfekten Tief erwischt!)`);
  console.log(`  • Mehrertrag gegenüber Sofort-Kauf: +$${(val_B_end - val_A_end).toFixed(2)} (+${(((val_B_end - val_A_end)/val_A_end)*100).toFixed(1)} %)`);

  console.log(`\nStrategie C (Gold stoisch behalten, nur 50k IB01-Cash in QQQ investieren):`);
  console.log(`  • Endkapital: $${val_C_end.toFixed(2)} (+${(((val_C_end - 100000)/100000)*100).toFixed(1)} %)`);
  console.log(`  • Zusammensetzung: $${goldVal_C_end.toFixed(2)} in Gold + $${(qqqShares_C * qqq_end).toFixed(2)} in QQQ`);
}

testStrategies();
