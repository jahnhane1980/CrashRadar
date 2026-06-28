import fs from 'fs';
import path from 'path';

const START_DATE = '2020-01-01'; // 5+ years history
const END_DATE = new Date().toISOString().split('T')[0];
const OUTPUT_FILE = path.resolve(process.cwd(), 'data/archive/cboe/pcr.csv');
const DELAY_MS = 3500; // 3.5 seconds delay to mimic a human

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getNextDate(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

async function fetchWithTimeout(url, options, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function run() {
    console.log(`Starte historischen CBOE PCR Download (Safe Mode)...`);
    console.log(`Zeitraum: ${START_DATE} bis ${END_DATE}`);
    
    const existingDates = new Set();
    let fileContent = 'record_date,total_pcr\n';
    
    if (fs.existsSync(OUTPUT_FILE)) {
        const lines = fs.readFileSync(OUTPUT_FILE, 'utf8').split('\n');
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const parts = lines[i].split(',');
                if (parts.length >= 2) {
                    existingDates.add(parts[0].trim());
                    fileContent += `${lines[i].trim()}\n`;
                }
            }
        }
        console.log(`Bereits ${existingDates.size} historische Tage im Archiv gefunden.`);
    }

    let currentDate = START_DATE;
    let addedCount = 0;
    let consecutiveErrors = 0;
    
    while (currentDate <= END_DATE) {
        if (consecutiveErrors >= 5) {
            console.log(`\n❌ ZU VIELE FEHLER (5x in Folge). Breche Skript ab, um IP-Bann zu vermeiden!`);
            break;
        }

        const d = new Date(currentDate);
        const dayOfWeek = d.getDay();
        
        // Skip weekends and dates we already have
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !existingDates.has(currentDate)) {
            const url = `https://www.cboe.com/markets/us/options/market-statistics/daily/?dt=${currentDate}`;
            try {
                const response = await fetchWithTimeout(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html'
                    }
                }, 8000); // 8 second timeout
                
                if (response.status === 200) {
                    const text = await response.text();
                    const match = text.match(/TOTAL PUT\/CALL RATIO(?:\\?|)",(?:\\?|)"value(?:\\?|)":(?:\\?|)"([0-9.]+)/);
                    
                    if (match && match[1]) {
                        const pcr = match[1];
                        console.log(`[${currentDate}] PCR: ${pcr}`);
                        fileContent += `${currentDate},${pcr}\n`;
                        addedCount++;
                        consecutiveErrors = 0; // reset errors
                        
                        // Zwischenspeichern
                        if (addedCount % 10 === 0) {
                            fs.writeFileSync(OUTPUT_FILE, fileContent);
                        }
                    } else {
                        console.log(`[${currentDate}] Kein PCR gefunden (Feiertag?)`);
                        consecutiveErrors = 0;
                    }
                } else if (response.status === 403 || response.status === 429) {
                     console.log(`[${currentDate}] GEBLOCKT! HTTP ${response.status}`);
                     consecutiveErrors += 5; // force abort
                } else {
                     console.log(`[${currentDate}] HTTP ${response.status}`);
                     consecutiveErrors++;
                }
            } catch (e) {
                console.error(`[${currentDate}] Fehler: ${e.message} (Timeout/Hang)`);
                consecutiveErrors++;
            }
            
            // Sleep to mimic human
            await delay(DELAY_MS);
        }
        
        currentDate = getNextDate(currentDate);
    }
    
    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`\n✅ Download beendet. Es wurden ${addedCount} neue Tage hinzugefügt.`);
}

run();
