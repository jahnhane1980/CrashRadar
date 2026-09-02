import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.resolve(__dirname, '../tests/analysis/indicators');

const categoryMap = {
    'LEADING': 'EARLY_WARNING',
    'TRIGGER': 'ACUTE_PANIC',
    'CONTEMPORANEOUS': 'ACUTE_PANIC',
    'TROUGH': 'BOTTOM_FINDER',
    'MACRO': 'MACRO_CONTEXT',
    'CYCLE': 'MACRO_CONTEXT'
};

async function run() {
    if (!fs.existsSync(testsDir)) {
        console.error("Test directory not found.");
        return;
    }
    const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));
    console.log(`Passe Kategorien in ${files.length} Test-Dateien an...`);
    
    let changedCount = 0;
    
    for (const file of files) {
        const filePath = path.join(testsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        let changed = false;
        for (const [oldCat, newCat] of Object.entries(categoryMap)) {
            const searchStr1 = `.toBe('${oldCat}')`;
            const searchStr2 = `.toEqual('${oldCat}')`;
            if (content.includes(searchStr1)) {
                content = content.replace(searchStr1, `.toBe('${newCat}')`);
                changed = true;
            }
            if (content.includes(searchStr2)) {
                content = content.replace(searchStr2, `.toEqual('${newCat}')`);
                changed = true;
            }
        }
        
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`- ${file} -> Aktualisiert`);
            changedCount++;
        }
    }
    
    console.log(`Fertig! ${changedCount} Test-Dateien wurden angepasst.`);
}

run();
