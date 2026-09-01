async function parseClevelandFed() {
  const url = `https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  
  // Look for tables or data cards in HTML
  console.log("=== CLEVELAND FED INFLATION NOWCASTING ===");
  
  // Extract text within table or main container
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi);
  if (tableMatches) {
    for (const table of tableMatches) {
      // Strip tags to get clean text
      const cleanText = table.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log("Table content:", cleanText);
    }
  } else {
    console.log("No table tags found, checking text around 'CPI' and 'PCE'");
    const lines = html.split('\n').filter(l => l.includes('CPI') || l.includes('PCE') || l.includes('Nowcast'));
    console.log("Matching lines:", lines.slice(0, 15));
  }
}

parseClevelandFed().catch(console.error);
