import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function run() {
    console.log("Starte Puppeteer...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Als normaler Browser tarnen
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    const url = 'https://en.macromicro.me/collections/9/us-market-relative/94/us-cboe-total-put-call-ratio';
    console.log(`Navigiere zu ${url}...`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log("Seite geladen. Warte auf Chart-Rendering...");
        
        // Kurz warten, bis JavaScript alle Charts (meist Highcharts) gezeichnet hat
        await new Promise(r => setTimeout(r, 5000));
        
        // Extrahieren der Chart-Daten aus dem globalen Highcharts Objekt
        const chartData = await page.evaluate(() => {
            if (typeof window.Highcharts === 'undefined' || window.Highcharts.charts.length === 0) {
                return null;
            }
            
            // Finde den richtigen Chart (oft ist es der erste auf der Seite)
            const chart = window.Highcharts.charts.find(c => c !== undefined);
            if (!chart) return null;
            
            // Finde die Series, die das Put/Call Ratio enthält (normalerweise heißt sie so oder ist die erste)
            const pcrSeries = chart.series.find(s => s.name && s.name.toLowerCase().includes('put/call'));
            const targetSeries = pcrSeries || chart.series[0];
            
            if (!targetSeries || !targetSeries.data) return null;
            
            return targetSeries.data.map(point => {
                // Highcharts speichert das Datum oft in point.x als Unix-Timestamp in Millisekunden
                const dateObj = new Date(point.x);
                const dateStr = dateObj.toISOString().split('T')[0];
                return {
                    date: dateStr,
                    value: point.y
                };
            }).filter(d => d.date && d.value !== null && d.value !== undefined);
        });
        
        if (!chartData || chartData.length === 0) {
            throw new Error("Highcharts-Daten konnten nicht gefunden oder extrahiert werden.");
        }
        
        console.log(`Erfolgreich ${chartData.length} Datenpunkte extrahiert! Letzter Punkt: ${JSON.stringify(chartData[chartData.length-1])}`);
        
        // Als CSV speichern
        const archiveDir = path.resolve(process.cwd(), 'data/archive/cboe');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }
        
        const filePath = path.join(archiveDir, 'pcr.csv');
        let csvContent = 'record_date,total_pcr\n';
        chartData.forEach(d => {
            csvContent += `${d.date},${d.value}\n`;
        });
        
        fs.writeFileSync(filePath, csvContent, 'utf8');
        console.log(`\n🎉 CSV erfolgreich gespeichert unter: ${filePath}`);
        
    } catch (e) {
        console.error(`Fehler beim Scrapen: ${e.message}`);
    } finally {
        await browser.close();
    }
}

run().catch(console.error);
