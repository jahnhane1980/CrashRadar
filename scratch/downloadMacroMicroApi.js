import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function run() {
    console.log("Starte Puppeteer im API Interception Mode...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    let foundJson = null;

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') || url.includes('/data/') || url.includes('charts/94')) {
            try {
                const text = await response.text();
                // Wenn es nach PCR-Daten aussieht
                if (text.includes('series') || text.includes('stat:') || text.includes('put/call')) {
                    console.log(`Verdächtige API Antwort von: ${url}`);
                    const json = JSON.parse(text);
                    if (json && json.data) {
                        foundJson = json;
                    }
                }
            } catch(e) {}
        }
    });

    const url = 'https://en.macromicro.me/collections/9/us-market-relative/94/us-cboe-total-put-call-ratio';
    console.log(`Navigiere zu ${url}...`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000)); // Warten auf letze APIs
        
        // Versuchen wir als Fallback, die Daten aus dem statischen window-Objekt zu extrahieren
        const windowData = await page.evaluate(() => {
            if (window.mm_chart_data) return window.mm_chart_data;
            if (window.__INITIAL_STATE__) return window.__INITIAL_STATE__;
            return null;
        });

        if (!foundJson && !windowData) {
            // Suchen im DOM nach JSON in script tags
            const rawHtml = await page.content();
            const dataMatch = rawHtml.match(/data-chart='([^']+)'/);
            if (dataMatch) {
                console.log("Daten im DOM-Attribut 'data-chart' gefunden!");
                foundJson = JSON.parse(dataMatch[1]);
            }
        }
        
        const dataToAnalyze = foundJson || windowData;
        
        if (dataToAnalyze) {
            console.log("Wir haben potenziell die Daten gefunden!");
            fs.writeFileSync('scratch/macromicro_raw.json', JSON.stringify(dataToAnalyze, null, 2));
            console.log("Rohdaten in scratch/macromicro_raw.json gespeichert.");
        } else {
            console.log("Keine verwertbaren Daten gefunden. Nehme Screenshot...");
            await page.screenshot({ path: 'scratch/macromicro_screenshot.png' });
        }
        
    } catch (e) {
        console.error(`Fehler beim Scrapen: ${e.message}`);
    } finally {
        await browser.close();
    }
}

run().catch(console.error);
