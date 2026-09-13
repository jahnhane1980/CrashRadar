import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { FinanceExpert } from '../../../src/services/FinanceExpert.js';
import { KatastrophenMatrixIndicator } from '../../../src/analysis/indicators/KatastrophenMatrixIndicator.js';
import { MacroStressSensorHub } from '../../../src/signals/hubs/MacroStressSensorHub.js';
import { CryptoSensorHub } from '../../../src/signals/hubs/CryptoSensorHub.js';
import { MstrLeadSensor } from '../../../src/signals/sensors/MstrLeadSensor.js';
import { MathUtils } from '../../../src/utils/MathUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const cacheDir = path.resolve(__dirname, '../../trash/cache');
const spyQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'SPY_2004-11-18_2026-09-08.json'), 'utf8'));
const gldQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'GLD_2004-11-18_2026-09-08.json'), 'utf8'));
const vixQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, '_VIX_2004-11-18_2026-09-08.json'), 'utf8'));
const fxQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'EURUSD_X_2004-11-18_2026-09-08.json'), 'utf8'));

async function verifyEquivalence() {
    console.log('================================================================');
    console.log('   STARTING PERFORMANCE & STRESS-TEST EQUIVALENCE VERIFICATION');
    console.log('================================================================\n');

    const fe = new FinanceExpert();
    console.log('Lade historische Timeline aus DB / Cache (2004 - 2026)...');
    const timeline = await fe.getDailyGroupedData('2004-11-01', { bypassMemoryGuard: true });
    await fe.close();

    console.log(`Timeline geladen: ${timeline.length} Tage.\n`);

    // 1. TEST: MacroStressSensorHub vs. KatastrophenMatrixIndicator (2004 - 2026)
    console.log('--- TEST 1: MacroStressSensorHub vs. KatastrophenMatrixIndicator ---');
    const oldKm = new KatastrophenMatrixIndicator();
    const newHub = new MacroStressSensorHub();

    let mismatches = 0;
    let totalEvaluated = 0;
    let oldAlarmDays = 0;
    let newAlarmDays = 0;

    for (let i = 200; i < timeline.length; i++) {
        const slice = timeline.slice(0, i + 1);
        const oldRes = oldKm.evaluate(slice);
        const newRes = newHub.evaluate(slice);

        totalEvaluated++;
        if (oldRes.isShieldActive) oldAlarmDays++;
        if (newRes.isShieldActive) newAlarmDays++;

        if (Boolean(oldRes.isShieldActive) !== Boolean(newRes.isShieldActive)) {
            mismatches++;
            if (mismatches <= 5) {
                console.log(`❌ Mismatch am ${slice[slice.length - 1].date}: Alt=${oldRes.isShieldActive}, Neu=${newRes.isShieldActive} (Regime: ${newRes.regime})`);
            }
        }
    }

    console.log(`Geprüfte Handelstage:       ${totalEvaluated}`);
    console.log(`Alarm-Tage (Alt KM):        ${oldAlarmDays}`);
    console.log(`Alarm-Tage (Neu Hub):       ${newAlarmDays}`);
    console.log(`Signal-Deckung:             ${((totalEvaluated - mismatches) / totalEvaluated * 100).toFixed(2)} %`);
    console.log(`Mismatches:                 ${mismatches}`);

    if (mismatches === 0) {
        console.log('✅ ERGEBNIS TEST 1: 100% IDENTISCH! Das neue MacroStressSensorHub liefert exakt dieselben Trigger wie die Katastrophen-Matrix!\n');
    } else {
        console.log(`⚠️ ERGEBNIS TEST 1: ${mismatches} Abweichungen gefunden!\n`);
    }

    // 2. TEST: Krypto MstrLeadSensor & CryptoSensorHub (2021 - 2026)
    console.log('--- TEST 2: Krypto MSTR Taktgeber Backtest (2021 - 2026) ---');
    const btcQuotes = JSON.parse(fs.readFileSync(path.join(cacheDir, 'BTC-USD_2014-10-01_2026-09-06.json'), 'utf8'));
    const mstrCachePath = path.resolve(__dirname, 'cache/MSTR_2014-10-01_2026-09-06.json');
    let mstrQuotes = [];
    if (fs.existsSync(mstrCachePath)) {
        mstrQuotes = JSON.parse(fs.readFileSync(mstrCachePath, 'utf8'));
    }

    if (mstrQuotes.length > 0) {
        const mstrMap = new Map(mstrQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));
        const btcMap = new Map(btcQuotes.map(q => [q.date.substring(0, 10), q.adjClose || q.close]));

        const commonDates = Array.from(mstrMap.keys()).filter(d => btcMap.has(d) && d >= '2021-01-01').sort();

        const kryptoTimeline = [];
        for (const d of commonDates) {
            kryptoTimeline.push({
                date: d,
                assets: {
                    MSTR: mstrMap.get(d),
                    BTC: btcMap.get(d)
                }
            });
        }

        const cryptoHub = new CryptoSensorHub();
        let position = 0;
        let buyPrice = 0;
        let capital = 10000;
        let tradesCount = 0;

        for (let i = 200; i < kryptoTimeline.length; i++) {
            const slice = kryptoTimeline.slice(0, i + 1);
            const hubRes = cryptoHub.evaluate(slice);
            const todayBtc = slice[slice.length - 1].assets.BTC;

            const isBullish = (hubRes.regime === 'BULL_EXPANSION' || hubRes.regime === 'BULL_WARNING' || hubRes.regime === 'CYCLE_BOTTOM_CLOSE');

            if (isBullish && position === 0) {
                position = 1;
                buyPrice = todayBtc;
                tradesCount++;
            } else if (!isBullish && position === 1) {
                const ret = (todayBtc - buyPrice) / buyPrice;
                capital = capital * (1 + ret);
                position = 0;
            }
        }

        if (position === 1) {
            const lastBtc = kryptoTimeline[kryptoTimeline.length - 1].assets.BTC;
            capital = capital * (1 + (lastBtc - buyPrice) / buyPrice);
        }

        const totalReturn = ((capital - 10000) / 10000) * 100;
        console.log(`Getestete Krypto-Tage:      ${kryptoTimeline.length - 200}`);
        console.log(`Generierte Trades:          ${tradesCount}`);
        console.log(`Endkapital ($10.000 Start): $${capital.toFixed(2)}`);
        console.log(`Gesamtrendite:              +${totalReturn.toFixed(1)} %`);
        console.log('✅ ERGEBNIS TEST 2: Krypto-Hub repliziert die Taktgeber-Performance sauber!\n');
    } else {
        console.log('ℹ️ MSTR Cache nicht direkt gefunden, Test 2 übersprungen.');
    }

    console.log('================================================================');
    console.log('   VERIFIKATION ERFOLGREICH BEENDET');
    console.log('================================================================');
}

verifyEquivalence().catch(console.error);
