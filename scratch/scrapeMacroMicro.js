import ky from 'ky';
import fs from 'fs';
import path from 'path';

async function run() {
    const api = ky.create({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });

    try {
        const url = 'https://en.macromicro.me/collections/9/us-market-relative/94/us-cboe-total-put-call-ratio';
        console.log(`Fetching HTML from ${url}...`);
        
        // This will likely return HTML
        const html = await api.get(url).text();
        
        // Sometimes the chart data is embedded in a <script> tag as JSON.
        // Let's search for "data:" or "series:" arrays.
        let foundData = false;
        
        const scriptTags = html.match(/<script[\s\S]*?<\/script>/gi);
        if (scriptTags) {
            for (const tag of scriptTags) {
                // If it contains "cboe-total-put-call-ratio" and looks like it has data
                if (tag.includes('stat:') || tag.includes('series:')) {
                    const dataMatch = tag.match(/data:\s*(\[.*?\])/);
                    if (dataMatch) {
                        console.log("Found embedded data string. Length:", dataMatch[1].length);
                        foundData = true;
                    }
                }
            }
        }
        
        if (!foundData) {
            console.log("Could not find embedded data in script tags.");
            // See if there's an API config
            const configMatch = html.match(/chart_id["\s:]+(\d+)/i);
            if (configMatch) {
                console.log("Found chart ID:", configMatch[1]);
                // We could try to hit the backend API with this ID
            } else {
                console.log("Could not find chart ID.");
            }
        }
        
    } catch(e) {
        console.error("Scrape failed:", e.message);
    }
}
run();
