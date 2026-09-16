import { ModelEvaluator } from '../../src/ml/ModelEvaluator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../../config/ML-Config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const tickers = [
    { name: 'PLTR', version: 'v1' },
    { name: 'S', version: 'v1' },
    { name: 'SOFI', version: 'v1' },
    { name: 'ZETA', version: 'v2' },
    { name: 'NVTS', version: 'v2' }
];

async function run() {
    for (const t of tickers) {
        const evaluator = new ModelEvaluator(t.name, t.version, config);
        await evaluator.evaluate();
    }
}

run().catch(console.error);
