import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { FinanceExpert } from '../../../src/services/FinanceExpert.js';

async function inspectIndicators() {
    const fe = new FinanceExpert();
    const timeline = await fe.getDailyGroupedData('2007-01-01', { bypassMemoryGuard: true });
    await fe.close();

    const sample = timeline[Math.floor(timeline.length / 2)];
    console.log('--- Sample Day Macro Groups ---');
    console.log(JSON.stringify(Object.keys(sample.macroGroups || {}), null, 2));

    for (const [group, data] of Object.entries(sample.macroGroups || {})) {
        console.log(`\nGroup: ${group}`);
        console.log(Object.keys(data));
    }
}

inspectIndicators().catch(console.error);
