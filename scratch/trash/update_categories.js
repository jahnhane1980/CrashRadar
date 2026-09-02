import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indicatorsDir = path.resolve(__dirname, '../src/analysis/indicators');

const categoryMap = {
    'LEADING': 'EARLY_WARNING',
    'TRIGGER': 'ACUTE_PANIC',
    'CONTEMPORANEOUS': 'ACUTE_PANIC',
    'TROUGH': 'BOTTOM_FINDER',
    'MACRO': 'MACRO_CONTEXT',
    'CYCLE': 'MACRO_CONTEXT'
};

async function run() {
    const files = fs.readdirSync(indicatorsDir).filter(f => f.endsWith('.js'));
    console.log(`Passe Kategorien in ${files.length} Indikatoren an...`);
    
    let changedCount = 0;
    
    for (const file of files) {
        const filePath = path.join(indicatorsDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        let changed = false;
        for (const [oldCat, newCat] of Object.entries(categoryMap)) {
            const searchStr = `this.category = '${oldCat}';`;
            if (content.includes(searchStr)) {
                content = content.replace(searchStr, `this.category = '${newCat}';`);
                changed = true;
                break; // Assume one category per file
            }
        }
        
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`- ${file} -> Aktualisiert`);
            changedCount++;
        }
    }
    
    console.log(`Fertig! ${changedCount} Dateien wurden exakt an der Zeile this.category geändert.`);
}

run();
