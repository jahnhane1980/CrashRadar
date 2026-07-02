import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegimeLabeler, Regimes, Strategies } from '../../src/analysis/RegimeLabeler.js';
import fs from 'fs';

// Wir mocken das Dateisystem, um fehlende oder falsche Configs zu simulieren
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn()
    }
  };
});

describe('RegimeLabeler - Dow Theory & Edge Cases', () => {
  
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Helper zur Generierung von Mock-Daten (nur Close-Preise)
  const generateMockData = (closes) => {
    return closes.map((close, i) => {
      // Simuliere aufsteigende Datums-Strings
      const d = new Date(2020, 0, 1);
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        assets: { BTC: close }
      };
    });
  };

  it('Edge Case: Fehlende Config-Datei -> Fallback auf Defaults', () => {
    fs.existsSync.mockReturnValue(false); // Tu so, als gäbe es keine Config
    const labeler = new RegimeLabeler([], 'BTC');
    expect(labeler.baseCycleDays).toBe(1460); // Muss auf 4 Jahre (1460 Tage) zurückfallen
  });

  it('Edge Case: Erfolgreiches Einlesen der Config', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ BTC: 500, DEFAULT: 1000 }));
    const labeler = new RegimeLabeler([], 'BTC');
    expect(labeler.baseCycleDays).toBe(500); // Asset-Spezifischer Wert zieht!
  });

  it('Edge Case: Warm-Up Phase (Nicht genug Daten) -> UNKNOWN', () => {
    const closes = Array(49).fill(100); // 49 Tage (SMA 50 braucht 50!)
    const labeler = new RegimeLabeler(generateMockData(closes), 'BTC');
    const labels = labeler.generateLabels();
    
    // Alle müssen UNKNOWN sein
    expect(labels.every(l => l.label === Regimes.UNKNOWN)).toBe(true);
  });

  it('Edge Case: Lücken in den Daten (Null-Werte mitten im Trend)', () => {
    let closes = Array(60).fill(100);
    closes[52] = null; // API Fehler / Datenlücke
    closes[53] = null;
    
    const labeler = new RegimeLabeler(generateMockData(closes), 'BTC');
    const labels = labeler.generateLabels();
    
    // Tag 51 hat Daten
    expect(labels[51].label).not.toBe(Regimes.UNKNOWN);
    // Tag 52 & 53 müssen als UNKNOWN übersprungen werden, ohne dass die Engine abstürzt
    expect(labels[52].label).toBe(Regimes.UNKNOWN);
    expect(labels[53].label).toBe(Regimes.UNKNOWN);
    // Tag 54 fängt sich wieder
    expect(labels[54].label).not.toBe(Regimes.UNKNOWN);
  });

  it('Happy Path & Edge Case: Makro-Peaks perfekt isolieren (+/- 3 Tage Puffer)', () => {
    const labeler = new RegimeLabeler([], 'BTC');
    labeler.baseCycleDays = 20; // Wir erzwingen ein kleines Fenster (w = 10), um es im Test zu triggern
    
    // V-Shape: Keine flachen Zonen oder identischen Minima
    let closes = [];
    for(let i=0; i<120; i++) {
        if (i <= 75) closes.push(100 + i); // Steigt bis Index 75 (Top)
        else if (i <= 90) closes.push(175 - (i - 75) * 11); // Fällt bis Index 90 (Bottom = 10)
        else closes.push(10 + (i - 90) * 5); // Steigt wieder
    }
    // closes[75] = 175 (Top)
    // closes[90] = 10 (Bottom)
    
    labeler.data = generateMockData(closes);
    const labels = labeler.generateLabels();
    
    // Peak bei Index 75 -> Puffer 72 bis 78
    for(let i=72; i<=78; i++) {
        expect(labels[i].label).toBe(Regimes.CYCLE_TOP);
    }
    expect(labels[71].label).not.toBe(Regimes.CYCLE_TOP);
    expect(labels[79].label).not.toBe(Regimes.CYCLE_TOP);

    // Boden bei Index 90 -> Puffer 87 bis 93
    for(let i=87; i<=93; i++) {
        expect(labels[i].label).toBe(Regimes.CYCLE_BOTTOM);
    }
  });

  it('Dow-Theorie: Erkennung von Swing Highs/Lows und Wechsel in BEAR_MARKET bei Strukturbruch', () => {
    let closes = [];
    for(let i=0; i<50; i++) closes.push(100); // Warmup
    
    // Wir bauen einen künstlichen Bullrun (Impuls rauf)
    for(let i=0; i<10; i++) closes.push(100 + i*10); // Top bei 190 (Swing High)
    // Korrektur, aber HL (Higher Low) bleibt intakt (Support bei 150)
    for(let i=0; i<5; i++) closes.push(190 - i*10);  // Boden bei 150 (Swing Low)
    // Neuer Impuls rauf (Higher High)
    for(let i=0; i<10; i++) closes.push(150 + i*10); // Top bei 240
    
    // JETZT: Der brutale Crash, der die Struktur bricht (Fällt unter Swing Low von 150)
    for(let i=0; i<15; i++) closes.push(240 - i*10); // Endet bei 100
    
    const labeler = new RegimeLabeler(generateMockData(closes), 'BTC');
    labeler.baseCycleDays = 1000; // Makro-Extreme deaktivieren für diesen Test
    
    const labels = labeler.generateLabels();
    
    // Prüfe, ob das System den Strukturbruch verstanden hat
    // Die letzten Kerzen des Crashs MÜSSEN im BEAR_MARKET sein, da das Swing Low durchbrochen wurde
    const crashLabels = labels.slice(-5).map(l => l.label);
    expect(crashLabels).toContain(Regimes.BEAR_MARKET);
  });

  it('Edge Case: Absolute Zero Volatility (Flat Market Death)', () => {
    // Was passiert, wenn ein Coin 100 Tage lang exakt 0% Bewegung hat?
    // Der ATR ist 0, die Bänder sind 0, SMA ist gleich dem Close-Preis.
    const closes = Array(100).fill(50000);
    const labeler = new RegimeLabeler(generateMockData(closes), 'BTC');
    labeler.baseCycleDays = 200;
    
    // Darf keine NaN, Nullpointer oder Endlosschleifen erzeugen!
    expect(() => labeler.generateLabels()).not.toThrow();
    
    const labels = labeler.generateLabels();
    // Nach dem Warmup sollte ein solider Fallback State existieren (idR BEAR_MARKET durch Fallback <= SMA)
    expect(labels[90].label).toBe(Regimes.BEAR_MARKET);
  });

  it('Drawdown-Strategie: Erkennung von CYCLE_TOP und CYCLE_BOTTOM bei SPY (20% Threshold)', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ 
      SPY: { strategy: Strategies.DRAWDOWN, threshold: 0.20 } 
    }));

    let closes = [];
    for(let i=0; i<50; i++) closes.push(100); // Warmup
    
    closes.push(200); // Index 50: ATH
    closes.push(180); // Index 51
    closes.push(160); // Index 52: Exakt -20% Drop -> Lockt Index 50 als CYCLE_TOP
    
    for(let i=0; i<10; i++) closes.push(150 - i*5); // Fällt bis 105 (Index 62)
    closes.push(100); // Index 63: Tiefpunkt
    closes.push(110); // Index 64
    closes.push(120); // Index 65: Exakt +20% Runup -> Lockt Index 63 als CYCLE_BOTTOM
    
    // Mappe BTC auf SPY, da unser Mock-Generator hart auf BTC programmiert ist
    const rawData = generateMockData(closes).map(d => ({ date: d.date, assets: { SPY: d.assets.BTC } }));
    
    const labeler = new RegimeLabeler(rawData, 'SPY');
    const labels = labeler.generateLabels();
    
    expect(labeler.strategy).toBe(Strategies.DRAWDOWN);
    expect(labeler.threshold).toBe(0.20);
    
    // Das Top muss an Index 50 gelockt sein (inkl. +/- 3 Puffer)
    expect(labels[50].label).toBe(Regimes.CYCLE_TOP);
    expect(labels[49].label).toBe(Regimes.CYCLE_TOP);
    
    // Das Bottom muss an Index 63 gelockt sein
    expect(labels[63].label).toBe(Regimes.CYCLE_BOTTOM);
    expect(labels[64].label).toBe(Regimes.CYCLE_BOTTOM);
  });

  it.skip('Dow-Theorie: Komplexe Transitions (ZigZag 100% Coverage)', () => {
    let closes = [];
    // 50 Kerzen Warmup: SMA etabliert sich bei ~100
    for(let i=0; i<50; i++) closes.push(100); 
    
    // 1. Etabliere BEAR_MARKET mit klaren Swings
    // Runter auf 50 (Swing Low)
    for(let i=0; i<10; i++) closes.push(100 - i*5); 
    
    // 2. Erholung auf 80 (Swing High), SMA50 sinkt langsam
    // Wir bleiben unter SMA50 (SMA50 ist bei ~90) -> BEAR_MARKET bleibt
    for(let i=0; i<5; i++) closes.push(50 + i*6); 
    
    // 3. Neues Low bei 30 -> Bestätigt BEAR_MARKET
    for(let i=0; i<10; i++) closes.push(80 - i*5); 

    // Wir sind in BEAR_MARKET. lastSwingHigh=80, lastSwingLow=30
    
    // 4. Direkter massiver Pump über lastSwingHigh (80) in einem Zug, 
    // um direkt von BEAR_MARKET zu BULL_MARKET zu springen (Line 231)
    closes.push(120); 
    
    // 5. Nun sind wir im BULL_MARKET. Etabliere neue Swings.
    // Swing High = 120. Fall auf 90 (Swing Low). SMA50 ist ca. 80.
    for(let i=0; i<5; i++) closes.push(120 - i*6); // 90
    
    // 6. Erholung unter Swing High (110). 
    for(let i=0; i<5; i++) closes.push(90 + i*4); // 110

    // 7. Jetzt Sturz unter SMA50 (ca. 85), aber über Swing Low (90) -> geht nicht, SMA ist tiefer.
    // Wir pushen den SMA durch viele Kerzen bei 110 nach oben.
    for(let i=0; i<20; i++) closes.push(110); 
    // Jetzt ist SMA50 bei ca 100. lastSwingLow = 90, lastSwingHigh = 110.
    
    // 8. Wir fallen unter SMA50 (z.b. 95) -> BULL_CORRECTION
    closes.push(95);

    // 9. Aus BULL_CORRECTION direkt unter Swing Low (90) stürzen -> BEAR_MARKET
    closes.push(50); // Crash!

    // 10. BEAR_MARKET etabliert. lastSwingHigh = 110, lastSwingLow = 50. SMA50 ~ 100
    // Erholung ÜBER SMA50 (z.B. 105), aber unter Swing High (110) -> BEAR_RALLY
    closes.push(105);

    // 11. Aus BEAR_RALLY direkt unter Swing Low (50) stürzen -> BEAR_MARKET (Line 241)
    closes.push(30);

    // 12. Wieder BEAR_RALLY erzeugen
    closes.push(90); // SMA50 ist ca. 80. -> BEAR_RALLY

    // 13. Aus BEAR_RALLY zurück unter SMA50 fallen (aber nicht unter Swing Low 30) -> BEAR_MARKET (Line 245)
    closes.push(70);

    const labeler = new RegimeLabeler(generateMockData(closes), 'BTC');
    labeler.baseCycleDays = 1000;
    expect(() => labeler.generateLabels()).not.toThrow();
    
    const allLabels = labeler.generateLabels().map(l => l.label);
    expect(allLabels).toContain(Regimes.BEAR_RALLY);
    expect(allLabels).toContain(Regimes.BULL_CORRECTION);
    expect(allLabels).toContain(Regimes.BEAR_MARKET);
    expect(allLabels).toContain(Regimes.BULL_MARKET);
  });

});
