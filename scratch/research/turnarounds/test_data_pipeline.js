import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const yahooFinance = new YahooFinance();

const CACHE_DIR = path.resolve(__dirname, 'data_cache');
const SHARED_CACHE_DIR = path.resolve(__dirname, '../../architecture/strategies/cache');
const SHARED_FUNDAMENTALS_PATH = path.resolve(__dirname, '../../architecture/strategies/fundamentals_master.json');

const CIK_MAP = {
    NOW: '0001373715',
    META: '0001326801',
    HIMS: '0001773751',
    APP: '0001751008',
    GOOGL: '0001652044',
    AMZN: '0001018724',
    NFLX: '0001065280',
    S: '0001583708',
    NVTS: '0001821769',
    IBRX: '0001326110',
    SOFI: '0001818874',
    PLTR: '0001321655'
};

async function getDailyPrices(symbol) {
    const localCache = path.join(CACHE_DIR, `${symbol}_daily.json`);
    if (fs.existsSync(localCache)) {
        return JSON.parse(fs.readFileSync(localCache, 'utf8'));
    }

    const sharedCache = path.join(SHARED_CACHE_DIR, `${symbol}_2014-10-01_2026-09-06.json`);
    if (fs.existsSync(sharedCache)) {
        const data = JSON.parse(fs.readFileSync(sharedCache, 'utf8'));
        fs.writeFileSync(localCache, JSON.stringify(data, null, 2));
        console.log(`[CACHE REUSED] ${symbol} aus Shared Cache geladen (${data.length} Tage)`);
        return data;
    }

    console.log(`[API FETCH] Lade historische Kurse für ${symbol} via Yahoo Finance...`);
    try {
        const queryOptions = { period1: '2015-01-01', period2: '2026-09-08' };
        const result = await yahooFinance.historical(symbol, queryOptions);
        const formatted = result.map(q => ({
            date: q.date.toISOString().split('T')[0],
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
        })).sort((a, b) => a.date.localeCompare(b.date));

        fs.writeFileSync(localCache, JSON.stringify(formatted, null, 2));
        console.log(`[CACHE SAVED] ${symbol} erfolgreich gecacht (${formatted.length} Tage) -> ${localCache}`);
        return formatted;
    } catch (err) {
        console.error(`Fehler beim Laden von ${symbol}:`, err.message);
        return [];
    }
}

async function getSecFundamentals(symbol) {
    const cik = CIK_MAP[symbol];
    if (!cik) {
        console.warn(`Kein CIK für ${symbol} gefunden!`);
        return [];
    }

    const localFundCache = path.join(CACHE_DIR, `${symbol}_sec_facts.json`);
    if (fs.existsSync(localFundCache)) {
        return JSON.parse(fs.readFileSync(localFundCache, 'utf8'));
    }

    console.log(`[SEC API FETCH] Lade SEC Facts für ${symbol} (CIK: ${cik})...`);
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'CrashRadar Research research@crashradar.org',
                'Accept-Encoding': 'gzip, deflate'
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        fs.writeFileSync(localFundCache, JSON.stringify(data, null, 2));
        console.log(`[SEC CACHE SAVED] SEC Facts für ${symbol} gespeichert (${(fs.statSync(localFundCache).size / 1024).toFixed(0)} KB)`);
        return data;
    } catch (err) {
        console.error(`Fehler beim Abruf der SEC-Daten für ${symbol}:`, err.message);
        return null;
    }
}

async function main() {
    console.log("=== Turnaround Research Data Pipeline Test ===");
    const testSymbols = ['NOW', 'HIMS', 'META', 'S'];
    for (const sym of testSymbols) {
        const prices = await getDailyPrices(sym);
        console.log(`-> ${sym}: ${prices.length} Kurstage geladen (Bereich: ${prices[0]?.date} bis ${prices[prices.length - 1]?.date})`);
        const sec = await getSecFundamentals(sym);
        console.log(`-> ${sym}: SEC Facts vorhanden: ${Boolean(sec)}`);
        // Pause for SEC rate limits (10 req/s max)
        await new Promise(r => setTimeout(r, 1200));
    }
    console.log("=== Test abgeschlossen! ===");
}

main().catch(console.error);
