import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_BASE = path.resolve(__dirname, '../../../data/cache/sec_13f');

const GURU_INFO = {
    '0001541617': { name: 'Brad Gerstner', short: 'Gerstner', fund: 'Altimeter', role: 'SCOUT' },
    '0001135730': { name: 'Philippe Laffont', short: 'Laffont', fund: 'Coatue', role: 'SCOUT' },
    '0001167483': { name: 'Chase Coleman', short: 'Coleman', fund: 'Tiger Global', role: 'SCOUT' },
    '0001536411': { name: 'Stanley Druckenmiller', short: 'Druckenmiller', fund: 'Duquesne', role: 'GUARDIAN' },
    '0001509842': { name: 'Zach Schreiber', short: 'Schreiber', fund: 'PointState', role: 'GUARDIAN' },
    '0001656456': { name: 'David Tepper', short: 'Tepper', fund: 'Appaloosa', role: 'GUARDIAN' }
};

const CUSIP_TO_TICKER = {
    '023135106': 'AMZN', '30303M102': 'META', '594918104': 'MSFT', '67066G104': 'NVDA',
    '01609W102': 'BABA', '02079K305': 'GOOGL', '02079K107': 'GOOGL', '64110L106': 'NFLX',
    '874039100': 'TSM', '47215P106': 'JD', '70450Y103': 'PYPL', '00724F101': 'ADBE',
    '90353T100': 'UBER', '11135F101': 'AVGO', '88160R101': 'TSLA', '79466L302': 'CRM',
    '81141R100': 'SE', '82509L107': 'SHOP', '25809K105': 'DASH', '852234103': 'SQ',
    'G29183103': 'ETN', '21037T109': 'CEG', '722304102': 'PDD', '36828A101': 'GEV',
    '512807108': 'LRCX', '037833100': 'AAPL', '595112103': 'MU', '007903107': 'AMD'
};

function run() {
    console.log("================================================================================");
    console.log("  VETOED-NO-REBUY PRÜFUNG: WELCHE AKTIEN SIND BEI EINEM CRASH GESPERRT?");
    console.log("  Stichtag: Q2-2026 (Aktuellster Datenstand)");
    console.log("================================================================================\n");

    const qCurr = '2026-06-30';
    const holdings = {};

    for (const [cik, info] of Object.entries(GURU_INFO)) {
        const p = path.join(CACHE_BASE, cik, `${qCurr}.json`);
        if (!fs.existsSync(p)) continue;
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));

        for (const h of raw) {
            let t = CUSIP_TO_TICKER[h.cusip];
            if (!t && h.issuer_name && h.issuer_name.toUpperCase().includes('VERNOVA')) t = 'GEV';
            if (!t) continue;
            if (t === 'GOOG') t = 'GOOGL';

            if (!holdings[t]) {
                holdings[t] = {
                    ticker: t,
                    scoutHolders: [],
                    guardianHolders: [],
                    guardianPuts: [],
                    totalScoutVal: 0,
                    totalGuardianVal: 0
                };
            }

            const val = (Number(h.value) || 0) * 1000;
            if (h.put_call === 'STOCK') {
                if (info.role === 'SCOUT') {
                    holdings[t].scoutHolders.push(info.short);
                    holdings[t].totalScoutVal += val;
                } else {
                    holdings[t].guardianHolders.push(info.short);
                    holdings[t].totalGuardianVal += val;
                }
            } else if (h.put_call === 'PUT' && info.role === 'GUARDIAN') {
                holdings[t].guardianPuts.push({ guru: info.short, val });
            }
        }
    }

    // Prüfe die Top-Kandidaten
    const candidates = ['AMZN', 'TSM', 'META', 'GOOGL', 'NVDA', 'MSFT', 'GEV', 'UBER', 'AAPL', 'LRCX', 'AMD', 'MU'];

    console.log("------------------------------------------------------------------------------------------------------------------------");
    console.log(" Ticker | Scouts-Halter        | Wächter-Halter          | Wächter-Puts          | Re-Buy Status am Boden");
    console.log("------------------------------------------------------------------------------------------------------------------------");

    for (const t of candidates) {
        const h = holdings[t] || { scoutHolders: [], guardianHolders: [], guardianPuts: [] };
        let status = '';
        let reason = '';

        const hasGuardianPuts = h.guardianPuts.length > 0;
        const hasGuardianHolders = h.guardianHolders.length > 0;

        if (hasGuardianPuts) {
            status = '🚫 ABSOLUT GESPERRT';
            reason = `Wächter-Put (${h.guardianPuts.map(p => p.guru).join(',')})`;
        } else if (!hasGuardianHolders) {
            status = '🚫 KEIN RE-BUY (GESPERRT)';
            reason = '0 Wächter investiert (Scout-Zombie-Gefahr!)';
        } else if (h.guardianHolders.length >= 2) {
            status = '✅ HOHE KONVIKTION RE-BUY';
            reason = `${h.guardianHolders.length} Wächter investiert (${h.guardianHolders.join(', ')})`;
        } else {
            status = '⚠️ BEDINGTER RE-BUY';
            reason = `Nur 1 Wächter (${h.guardianHolders.join(', ')}), darf nicht vor Crash verkaufen`;
        }

        console.log(` ${t.padEnd(6)} | ${h.scoutHolders.join(', ').padEnd(20)} | ${h.guardianHolders.join(', ').padEnd(23)} | ${(hasGuardianPuts ? 'JA' : 'Keine').padEnd(21)} | ${status} (${reason})`);
    }

    console.log("------------------------------------------------------------------------------------------------------------------------\n");
}

run();
