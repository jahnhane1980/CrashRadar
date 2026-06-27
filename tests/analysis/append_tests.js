import fs from 'fs';

const testFile = 'C:\\GitHub\\CrashRadar\\tests\\analysis\\IndicatorEngine.test.js';
let content = fs.readFileSync(testFile, 'utf8');

const newTestBlock = `
  describe('Panik-Kapitulation (VIX + CBOE + RSI)', () => {
    it('sollte UNKNOWN zurückgeben, wenn weniger als 90 Tage Daten vorhanden sind (Edge Case)', () => {
      const timeline = generateTimeline(80);
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Zu wenig Daten');
    });

    it('sollte UNKNOWN zurückgeben, wenn SPY, VIX oder CBOE null sind (Ausfall)', () => {
      const timeline = generateTimeline(100);
      timeline[99].assets.SPY = null;
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('UNKNOWN');
      expect(res.message).toContain('Keine Daten');
    });

    it('sollte OK zurückgeben bei VIX < 35 (Edge Case)', () => {
      const timeline = generateTimeline(100, { assets: { VIX: 20, SPY: 100, CBOE_SPY: 1000 } });
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte OK zurückgeben bei VIX > 35 aber fehlendem CBOE Spike (Happy Path Normal)', () => {
      const timeline = generateTimeline(100);
      for(let i=0; i<100; i++) {
        timeline[i].assets.SPY = 100;
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 40;
      }
      // Current CBOE is 1000, SMA is 1000 -> 1.0x (No Spike)
      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('OK');
    });

    it('sollte WARNING triggern, wenn VIX > 35 und CBOE spiket, aber KEINE Divergenz (Happy Path Warning)', () => {
      const timeline = generateTimeline(100);
      // Fallender SPY Kurs (keine RSI Divergenz)
      for(let i=0; i<100; i++) {
        timeline[i].assets.SPY = 200 - i; // Price steadily dropping -> RSI very low
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 40;
      }
      // Letzter Tag Spike
      timeline[99].assets.CBOE_SPY = 2000; 

      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('WARNING');
      expect(res.message).toContain('Massiver Panik-Spike im Optionsvolumen');
    });

    it('sollte CRITICAL triggern, wenn alle Bedingungen (Divergenz) eintreten (Happy Path Critical)', () => {
      const timeline = generateTimeline(100);
      // Simulate prices for RSI Divergence
      for(let i=0; i<100; i++) {
        timeline[i].assets.SPY = 100;
        timeline[i].assets.CBOE_SPY = 1000;
        timeline[i].assets.VIX = 20;
      }
      
      // Previous swing low 20 days ago
      for(let i=70; i<=80; i++) timeline[i].assets.SPY = 80; // Hard drop
      
      // Recovery
      for(let i=81; i<=90; i++) timeline[i].assets.SPY = 100; // Recovery
      
      // New absolute low today, but slower drop (RSI will be higher)
      for(let i=91; i<=99; i++) timeline[i].assets.SPY = 79; // New low

      timeline[99].assets.CBOE_SPY = 2000; // 2x Spike
      timeline[99].assets.VIX = 40; // Panic

      const res = engine.indicators.find(i => i.name.includes('Panik-Kapitulation')).evaluate(timeline);
      expect(res.status).toBe('CRITICAL');
      expect(res.message).toContain('GENERATIONEN-KAUFSIGNAL');
      expect(res.message).toContain('Bullish Divergence');
    });
  });
`;

content = content.replace(/  describe\('generateReport\(\)', \(\) => {/, newTestBlock + "\n  describe('generateReport()', () => {");
fs.writeFileSync(testFile, content);
console.log("IndicatorEngine.test.js updated successfully.");
