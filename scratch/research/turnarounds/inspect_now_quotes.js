import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../');
const CACHE_DIR = path.join(REPO_ROOT, 'scratch/research/turnarounds/data_cache');

const quotes = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NOW_daily.json'), 'utf8'));

console.log("Analyzing NOW daily price action around 2024-2026...");
const recent = quotes.filter(q => q.date >= '2024-01-01');

for (let i = 0; i < recent.length; i += 20) {
    const q = recent[i];
    console.log(`${q.date}: Open ${q.open}, High ${q.high}, Low ${q.low}, Close ${q.close}, Vol ${q.volume}`);
}
const last = recent[recent.length - 1];
console.log(`Last quote: ${last.date}: Close ${last.close}`);
