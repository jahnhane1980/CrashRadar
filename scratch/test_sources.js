import dotenv from 'dotenv';
dotenv.config();

async function testAlphaVantage() {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  console.log("Testing AlphaVantage Economic Calendar with key:", apiKey ? `${apiKey.substring(0, 4)}...` : 'NONE');
  
  if (!apiKey) {
    console.log("No AlphaVantage key found.");
    return;
  }

  try {
    const url = `https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&apikey=${apiKey}`;
    const res = await fetch(url);
    const text = await res.text();
    console.log("AlphaVantage response (first 500 chars):");
    console.log(text.substring(0, 500));
  } catch (err) {
    console.error("AlphaVantage error:", err.message);
  }
}

async function testClevelandFed() {
  console.log("\nTesting Cleveland Fed Nowcasting...");
  try {
    // Cleveland Fed typically serves html or data
    const url = `https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Cleveland Fed status:", res.status);
    const html = await res.text();
    // Search for current estimates in HTML
    const cpiMatch = html.match(/CPI[^\d]*(\d+\.\d+)%/i);
    const pceMatch = html.match(/PCE[^\d]*(\d+\.\d+)%/i);
    console.log("Cleveland Fed HTML snippet around CPI/PCE:", html.substring(0, 500));
  } catch (err) {
    console.error("Cleveland Fed error:", err.message);
  }
}

async function main() {
  await testAlphaVantage();
  await testClevelandFed();
}

main();
