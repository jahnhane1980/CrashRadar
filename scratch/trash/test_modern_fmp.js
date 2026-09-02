import dotenv from 'dotenv';
dotenv.config();

async function testModernFmp() {
  const apiKey = process.env.FMP_API_KEY;
  console.log("Testing Modern FMP endpoints with key:", apiKey ? `${apiKey.substring(0, 4)}...` : 'NONE');

  const testUrls = [
    `https://financialmodelingprep.com/stable/economic-calendar?apikey=${apiKey}`,
    `https://financialmodelingprep.com/api/v4/economic-calendar?from=2026-09-01&to=2026-09-30&apikey=${apiKey}`,
    `https://financialmodelingprep.com/api/v4/economic_calendar?from=2026-09-01&to=2026-09-30&apikey=${apiKey}`,
    `https://financialmodelingprep.com/stable/economic-calendar-historical?apikey=${apiKey}`,
  ];

  for (const url of testUrls) {
    console.log(`\nTesting endpoint: ${url.replace(apiKey, 'HIDDEN_KEY')}`);
    try {
      const res = await fetch(url);
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Response snippet:", text.substring(0, 300));
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          console.log(`=> SUCCESS! Received ${json.length} items.`);
          if (json.length > 0) {
            console.log("First item:", json[0]);
          }
          return json;
        }
      } catch (e) {}
    } catch (e) {
      console.error("Fetch error:", e.message);
    }
  }
}

testModernFmp().catch(console.error);
