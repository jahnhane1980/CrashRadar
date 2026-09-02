async function testForexFactoryFeed() {
  console.log("=== TESTING FOREX FACTORY PUBLIC CALENDAR FEED ===");
  const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", res.status);
    if (res.status === 200) {
      const data = await res.json();
      console.log(`Received ${data.length} events for this week.`);
      
      const usEvents = data.filter(e => e.country === 'USD');
      console.log(`US events: ${usEvents.length}`);
      
      for (const ev of usEvents) {
        console.log(`[${ev.date}] ${ev.title}:`);
        console.log(`   Impact: ${ev.impact}`);
        console.log(`   Forecast (Konsens): "${ev.forecast}"`);
        console.log(`   Previous (Vormonat): "${ev.previous}"`);
        console.log(`   Actual (Ist): "${ev.actual}"`);
        console.log('---');
      }
    }
  } catch (e) {
    console.error("ForexFactory error:", e.message);
  }
}

testForexFactoryFeed().catch(console.error);
