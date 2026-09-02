import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '../tests/analysis/indicators/LaborMarketDivergenceIndicator.test.js');

let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/'COINCIDENT'/g, "'ACUTE_PANIC'");
fs.writeFileSync(filePath, content, 'utf8');

console.log("LaborMarketDivergenceIndicator.test.js updated successfully.");
