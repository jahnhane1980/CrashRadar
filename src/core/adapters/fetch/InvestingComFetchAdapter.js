import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

export class InvestingComFetchAdapter {
    async fetch(task, provider, startValue) {
        if (task.id !== 'investing_challenger') {
            throw new Error(`Unsupported task for InvestingComFetchAdapter: ${task.id}`);
        }

        const url = "https://www.investing.com/economic-calendar/challenger-job-cuts-888";
        console.log(`[InvestingComFetchAdapter] Fetching data from ${url} ...`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        if (response.status === 403) {
            throw new Error('HTTP 403 Forbidden: Blocked by Cloudflare!');
        }
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Validation: Find H1
        const h1 = $('h1').filter((i, el) => $(el).text().trim() === 'U.S. Challenger Job Cuts');
        
        if (h1.length === 0) {
            throw new Error('Validation Failed: H1 with text "U.S. Challenger Job Cuts" not found! DOM structure changed.');
        }

        const h1Class = h1.attr('class') || '';
        const expectedClasses = ['font-bold', 'smMax:text-xl', 'smMax:leading-7', 'sm:text-3xl', 'sm:leading-8'];
        
        const hasAllClasses = expectedClasses.every(cls => h1Class.includes(cls));
        
        if (!hasAllClasses) {
            throw new Error(`Validation Failed: H1 class mismatch. Expected to contain: ${expectedClasses.join(' ')}. Actual class: ${h1Class}`);
        }

        // 2. Data Extraction
        let latestReleaseDate = null;
        let actualValue = null;

        let dataFound = false;
        $('tbody tr').each((i, row) => {
            if (dataFound) return; 

            const columns = $(row).find('td');
            if (columns.length >= 3) {
                const dateStr = $(columns[0]).text().trim();
                const actualStr = $(columns[2]).text().trim();
                
                if (actualStr && actualStr !== '') {
                    latestReleaseDate = dateStr;
                    actualValue = actualStr;
                    dataFound = true;
                }
            }
        });

        if (!dataFound) {
            throw new Error('Could not extract data rows from the table.');
        }

        // Parse date (e.g. "Dec 05, 2024" to "YYYY-MM-DD")
        const parsedDate = new Date(latestReleaseDate + ' UTC');
        if (isNaN(parsedDate.getTime())) {
            throw new Error(`Could not parse date: ${latestReleaseDate}`);
        }
        const record_date = parsedDate.toISOString().split('T')[0];

        // Parse actual value (e.g. "75.4K" to 75400)
        let parsedValue = null;
        if (actualValue.endsWith('K')) {
            parsedValue = parseFloat(actualValue.replace('K', '')) * 1000;
        } else if (actualValue.endsWith('M')) {
            parsedValue = parseFloat(actualValue.replace('M', '')) * 1000000;
        } else {
            parsedValue = parseFloat(actualValue.replace(/,/g, ''));
        }

        if (isNaN(parsedValue)) {
            throw new Error(`Could not parse actual value: ${actualValue}`);
        }

        console.log(`[InvestingComFetchAdapter] Extracted data: ${record_date} -> ${parsedValue}`);

        // Return array of data as expected by the framework
        return [{ record_date, value: parsedValue }];
    }
}
