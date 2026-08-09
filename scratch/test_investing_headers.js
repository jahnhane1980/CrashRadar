import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function testInvestingScrape() {
  const url = "https://www.investing.com/economic-calendar/challenger-job-cuts-888";
  console.log(`[Test] Requesting ${url} with enhanced Chrome headers...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-CH-UA': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    console.log(`[Response Status]: ${response.status} ${response.statusText}`);
    
    if (response.status === 403) {
      console.error('❌ Still blocked by Cloudflare (HTTP 403 Forbidden). TLS fingerprinting detected Node.js.');
      return;
    }

    if (!response.ok) {
      console.error(`❌ Request failed with HTTP ${response.status}`);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const h1 = $('h1').text().trim();
    console.log(`✅ Success! Page H1: "${h1}"`);

    // Try extracting data row
    let latestReleaseDate = null;
    let actualValue = null;
    $('tbody tr').each((i, row) => {
      const columns = $(row).find('td');
      if (columns.length >= 3) {
        const dateStr = $(columns[0]).text().trim();
        const actualStr = $(columns[2]).text().trim();
        if (actualStr && actualStr !== '' && !latestReleaseDate) {
          latestReleaseDate = dateStr;
          actualValue = actualStr;
        }
      }
    });

    console.log(`[Extracted Data]: Date: ${latestReleaseDate}, Value: ${actualValue}`);
  } catch (err) {
    console.error(`❌ Error during fetch:`, err.message);
  }
}

testInvestingScrape();
