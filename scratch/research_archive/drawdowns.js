import { FinanceExpert } from '../src/FinanceExpert.js';

const expert = new FinanceExpert('./data/Liquidity.sqlite');
const data = expert.getDailyGroupedData('1999-01-01');

function findDrawdowns(assetName, threshold = -0.15) {
    let peak = { price: 0, date: '' };
    let trough = { price: Infinity, date: '' };
    let inDrawdown = false;
    const drawdowns = [];

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const price = d.assets[assetName];
        if (!price) continue;

        if (price > peak.price) {
            if (inDrawdown) {
                const drop = (trough.price - peak.price) / peak.price;
                if (drop <= threshold) {
                    drawdowns.push({
                        peakDate: peak.date,
                        troughDate: trough.date,
                        recoveryDate: d.date,
                        dropPct: drop
                    });
                }
                inDrawdown = false;
            }
            peak = { price, date: d.date };
            trough = { price, date: d.date };
        } else {
            inDrawdown = true;
            if (price < trough.price) {
                trough = { price, date: d.date };
            }
        }
    }

    if (inDrawdown) {
        const drop = (trough.price - peak.price) / peak.price;
        if (drop <= threshold) {
            drawdowns.push({
                peakDate: peak.date,
                troughDate: trough.date,
                recoveryDate: 'Ongoing',
                dropPct: drop
            });
        }
    }

    // Sort chronologically
    drawdowns.sort((a, b) => new Date(a.peakDate) - new Date(b.peakDate));
    return drawdowns;
}

console.log("=== SPY Drawdowns >= 15% ===");
findDrawdowns('SPY').forEach(d => console.log(`${(d.dropPct*100).toFixed(2)}% | Peak: ${d.peakDate} -> Trough: ${d.troughDate} (Recovery: ${d.recoveryDate})`));

console.log("\n=== QQQ Drawdowns >= 15% ===");
findDrawdowns('QQQ').forEach(d => console.log(`${(d.dropPct*100).toFixed(2)}% | Peak: ${d.peakDate} -> Trough: ${d.troughDate} (Recovery: ${d.recoveryDate})`));

console.log("\n=== BTC Drawdowns >= 15% ===");
const btcDD = findDrawdowns('BTC', -0.15);
btcDD.forEach(d => console.log(`${(d.dropPct*100).toFixed(2)}% | Peak: ${d.peakDate} -> Trough: ${d.troughDate} (Recovery: ${d.recoveryDate})`));
