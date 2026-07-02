import fs from 'fs';

const csv = fs.readFileSync('scratch/extrema_analysis.csv', 'utf8').split('\n');
const headers = csv[0].split(',');
const rows = csv.slice(1).map(row => {
    const vals = row.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]);
    return obj;
});

function analyzeOffsetRange(type, minOffset, maxOffset) {
    const filtered = rows.filter(r => r.Extremum_Type === type && Number(r.Days_Offset) >= minOffset && Number(r.Days_Offset) <= maxOffset);
    if (filtered.length === 0) return null;
    
    const stats = {};
    const cols = ['VIX', 'TOTRESNS', 'TGA', 'Spread10y2y', 'SahmRule', 'MarginDebt', 'HYG', 'BIZD', 'BKLN', 'SKEW', 'SPY_ShortVol', 'PCR', 'CBOE_SPY'];
    
    cols.forEach(col => {
        const vals = filtered.map(r => Number(r[col])).filter(v => !isNaN(v) && v !== 0);
        if (vals.length > 0) {
            const avg = vals.reduce((a,b)=>a+b, 0) / vals.length;
            stats[col] = avg;
        }
    });
    
    // ML Prediction distribution
    const mlPhases = filtered.map(r => r.ML_Phase).filter(v => v);
    const mlCounts = {};
    mlPhases.forEach(p => mlCounts[p] = (mlCounts[p]||0) + 1);
    
    return { stats, mlCounts };
}

console.log('=== ANALYSIS: TOPS ===');
console.log('4 weeks BEFORE Top (-20 to -5 days):', analyzeOffsetRange('TOP', -20, -5));
console.log('AT Top (-4 to +4 days):', analyzeOffsetRange('TOP', -4, 4));
console.log('AFTER Top (+5 to +20 days):', analyzeOffsetRange('TOP', 5, 20));

console.log('\n=== ANALYSIS: BOTTOMS ===');
console.log('4 weeks BEFORE Bottom (-20 to -5 days):', analyzeOffsetRange('BOTTOM', -20, -5));
console.log('AT Bottom (-4 to +4 days):', analyzeOffsetRange('BOTTOM', -4, 4));
console.log('AFTER Bottom (+5 to +20 days):', analyzeOffsetRange('BOTTOM', 5, 20));
