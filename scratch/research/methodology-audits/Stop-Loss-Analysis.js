import fs from 'fs';

function calculateSMA(data, period) {
    let result = new Array(data.length).fill(null);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (i >= period) {
            sum -= data[i - period];
            result[i] = sum / period;
        } else if (i === period - 1) {
            result[i] = sum / period;
        }
    }
    return result;
}

function loadData() {
    const csv = fs.readFileSync('../../data/archive/Gold-GDX-Performance-Test.csv', 'utf8');
    const lines = csv.split('\n').filter(l => l.trim() !== '');
    
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const [date, gdxClose, gdxVol, goldClose] = lines[i].split(',');
        rows.push({
            date: date,
            gdx: parseFloat(gdxClose),
            gold: parseFloat(goldClose)
        });
    }

    const gdxPrices = rows.map(r => r.gdx);
    const goldPrices = rows.map(r => r.gold);
    
    const gdxSma50 = calculateSMA(gdxPrices, 50);
    const goldSma50 = calculateSMA(goldPrices, 50);

    for (let i = 0; i < rows.length; i++) {
        rows[i].gdxSma50 = gdxSma50[i];
        rows[i].goldSma50 = goldSma50[i];
    }

    return rows.filter(r => r.gdxSma50 !== null);
}

// Simuliere historische Makro-Schocks (DXY Spikes, Realzins-Schocks, Margin-Debt Drops)
const macroShocks = [
    { start: '2008-08-01', end: '2008-12-31', name: 'Global Financial Crisis (Liquidation)' },
    { start: '2012-10-01', end: '2013-07-31', name: 'Taper Tantrum (Real Rates Spike)' }, // Zyklus Tod
    { start: '2020-02-01', end: '2020-04-30', name: 'Corona Flash Crash (Liquidation)' },
    { start: '2025-10-01', end: '2026-04-30', name: 'Q1 2026 Crash (Margin Debt Drop)' } // Zyklus Tod
];

function isMacroShockActive(dateStr) {
    for (const shock of macroShocks) {
        if (dateStr >= shock.start && dateStr <= shock.end) return true;
    }
    return false;
}

function analyzeFuture(data, startIndex, daysToLookForward = 90) {
    const sellPrice = data[startIndex].gdx;
    let minPrice = sellPrice;
    let maxPrice = sellPrice;
    
    const endIndex = Math.min(data.length - 1, startIndex + daysToLookForward);
    
    for (let i = startIndex + 1; i <= endIndex; i++) {
        if (data[i].gdx < minPrice) minPrice = data[i].gdx;
        if (data[i].gdx > maxPrice) maxPrice = data[i].gdx;
    }

    // Wenn der Preis nach dem Verkauf noch > 15% tiefer gestürzt ist, war der Stop ein Erfolg (True Death)
    // Wenn der Preis nach dem Verkauf nie wirklich tiefer fiel, sondern > 15% gestiegen ist, war es ein Fake-Out.
    const maxDrawdownFromSell = ((minPrice - sellPrice) / sellPrice) * 100; // z.B. -20%
    const maxGainFromSell = ((maxPrice - sellPrice) / sellPrice) * 100;     // z.B. +20%

    // True Death: Er fällt massiv weiter nach unserem Stop.
    // Fake Out: Er steigt massiv, ohne vorher massiv zu fallen.
    // Wenn beides passiert, schauen wir was zuerst passierte:
    let hitDrawdownFirst = false;
    for (let i = startIndex + 1; i <= endIndex; i++) {
        const drop = ((data[i].gdx - sellPrice) / sellPrice) * 100;
        const gain = ((data[i].gdx - sellPrice) / sellPrice) * 100;
        if (drop <= -15) { hitDrawdownFirst = true; break; }
        if (gain >= 15) { hitDrawdownFirst = false; break; }
    }

    const wasGoodSell = hitDrawdownFirst; 

    return { wasGoodSell };
}

function runTests() {
    const data = loadData();
    let testA_FakeOuts = 0, testA_TrueDeaths = 0;
    let testB_FakeOuts = 0, testB_TrueDeaths = 0;
    let testC_FakeOuts = 0, testC_TrueDeaths = 0;

    let inStopA = false, inStopB = false, inStopC = false;

    for (let i = 0; i < data.length - 100; i++) {
        const row = data[i];
        const prevRow = data[i - 1];
        if (!prevRow) continue;

        const macroFired = isMacroShockActive(row.date);

        // TEST A: Harter Stop bei exakt -10% unter SMA 50 (Ohne Makro)
        if (row.gdx < row.gdxSma50 * 0.9 && prevRow.gdx >= prevRow.gdxSma50 * 0.9 && !inStopA) {
            inStopA = true;
            const future = analyzeFuture(data, i);
            if (future.wasGoodSell) testA_TrueDeaths++;
            else testA_FakeOuts++;
        }
        if (row.gdx > row.gdxSma50) inStopA = false;

        // TEST B: Exakter Bruch des SMA 50, ABER nur wenn Makro-Schock aktiv
        if (row.gdx < row.gdxSma50 && prevRow.gdx >= prevRow.gdxSma50 && !inStopB) {
            if (macroFired) {
                inStopB = true;
                const future = analyzeFuture(data, i);
                if (future.wasGoodSell) testB_TrueDeaths++;
                else testB_FakeOuts++;
            }
        }
        if (row.gdx > row.gdxSma50) inStopB = false;

        // TEST C: -10% Puffer PLUS Makro-Schock
        if (row.gdx < row.gdxSma50 * 0.9 && prevRow.gdx >= prevRow.gdxSma50 * 0.9 && !inStopC) {
            if (macroFired) {
                inStopC = true;
                const future = analyzeFuture(data, i);
                if (future.wasGoodSell) testC_TrueDeaths++;
                else testC_FakeOuts++;
            }
        }
        if (row.gdx > row.gdxSma50) inStopC = false;
    }

    console.log("=== ERGEBNISSE FÜR GDX ===");
    console.log("DEFINITION:");
    console.log("True Death (Guter Stop) = Preis fiel danach noch > 15% tiefer.");
    console.log("Fake-Out (Schlechter Stop) = Preis stieg danach > 15% an, ohne tiefer zu fallen.\n");

    console.log("TEST A: Stop bei -10% unter SMA 50 (Rein Technisch, kein Makro-Filter)");
    console.log(`Fake-Outs (Unnötig verkauft, Preis erholte sich): ${testA_FakeOuts}`);
    console.log(`True Deaths (Gute Notbremse, Crash ging weiter): ${testA_TrueDeaths}`);
    console.log(`Fehlerquote: ${((testA_FakeOuts / (testA_FakeOuts + testA_TrueDeaths)) * 100).toFixed(1)}%\n`);

    console.log("TEST B: Stop direkt beim SMA 50-Bruch, ABER MIT Makro-Filter (VIX/DXY Schock)");
    console.log(`Fake-Outs (Unnötig verkauft): ${testB_FakeOuts}`);
    console.log(`True Deaths (Gute Notbremse): ${testB_TrueDeaths}`);
    console.log(`Fehlerquote: ${((testB_FakeOuts / (testB_FakeOuts + testB_TrueDeaths || 1)) * 100).toFixed(1)}%\n`);

    console.log("TEST C: Stop bei -10% unter SMA 50 PLUS Makro-Filter");
    console.log(`Fake-Outs (Unnötig verkauft): ${testC_FakeOuts}`);
    console.log(`True Deaths (Gute Notbremse): ${testC_TrueDeaths}`);
    console.log(`Fehlerquote: ${((testC_FakeOuts / (testC_FakeOuts + testC_TrueDeaths || 1)) * 100).toFixed(1)}%\n`);
}

runTests();
