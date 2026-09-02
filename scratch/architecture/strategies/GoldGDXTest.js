import { GoldGDXEngine } from './GoldGDXEngine.js';
import fs from 'fs';

// Test-Szenarien generieren
function generateScenarios() {
    const scenarios = [];

    // Szenario 1: Flash Crash (VIX > 45, schneller SPY Drop) -> Engine sollte GDX priorisieren
    const flashCrashData = [];
    for (let i = 1; i <= 20; i++) {
        flashCrashData.push({
            date: `2020-03-${i.toString().padStart(2, '0')}`,
            vix: 80, 
            spyRoc20d: -20, // Rapider Absturz
            marginDebtDropping: true,
            gdxDailyReturn: i === 13 ? -8 : 0, // Tag 13: Selling Climax (Boden)
            gdxVolume: i === 13 ? 5000000 : 1000000,
            gdxVolumeSma50: 1000000,
            goldPrice: 1500,
            goldSma20: 1550, // Gold fällt noch
            gdxPrice: 20
        });
    }
    scenarios.push({ name: 'Flash_Crash_2020', data: flashCrashData });

    // Szenario 2: Bärenmarkt (VIX < 35, langsamer SPY Drop) -> Engine sollte Gold priorisieren
    const bearMarketData = [];
    for (let i = 1; i <= 20; i++) {
        bearMarketData.push({
            date: `2026-02-${i.toString().padStart(2, '0')}`,
            vix: 30, 
            spyRoc20d: -8, // Langsamer Absturz
            marginDebtDropping: true, // Margin Debt baut sich ab
            gdxDailyReturn: i === 18 ? -6 : 0, // GDX Climax kommt viel später an Tag 18
            gdxVolume: i === 18 ? 4000000 : 1000000,
            gdxVolumeSma50: 1000000,
            goldPrice: i >= 10 ? 1600 : 1400, // Gold dreht schon an Tag 10 hoch
            goldSma20: 1500,
            gdxPrice: 25
        });
    }
    scenarios.push({ name: 'Bear_Market_2026', data: bearMarketData });

    return scenarios;
}

function runTests() {
    const scenarios = generateScenarios();
    const testResults = {};

    for (const scenario of scenarios) {
        const engine = new GoldGDXEngine({ entryTranches: 3, exitTranches: 3 });
        const history = [];

        for (const row of scenario.data) {
            const result = engine.processDay(row);
            history.push(result);
        }

        // Analysieren der Ergebnisse für das Szenario
        const detectedRegimes = [...new Set(history.map(h => h.regime))];
        const allActions = history.flatMap(h => h.actions);
        const gdxEntries = allActions.filter(a => a.type === 'ENTRY_GDX');
        const goldEntries = allActions.filter(a => a.type === 'ENTRY_GOLD');

        testResults[scenario.name] = {
            expectedRegime: scenario.name.includes('Flash') ? 'FLASH_CRASH' : 'BEAR_MARKET',
            detectedRegimes: detectedRegimes,
            isRegimeCorrect: detectedRegimes.includes(scenario.name.includes('Flash') ? 'FLASH_CRASH' : 'BEAR_MARKET'),
            firstSignal: allActions.length > 0 ? allActions[0].type : 'NONE',
            totalGdxEntries: gdxEntries.length,
            totalGoldEntries: goldEntries.length,
            // Komplette Signal-Historie für Detail-Prüfung
            signals: history.filter(h => h.actions.length > 0).map(h => ({
                date: h.date,
                regime: h.regime,
                actions: h.actions.map(a => a.type + ' (' + a.reason + ')')
            }))
        };
    }

    // Ausgabe als formatiertes JSON-Objekt
    console.log(JSON.stringify(testResults, null, 2));
    
    // Optional: in eine Datei schreiben für spätere automatisierte Tests (z.B. Jest)
    fs.writeFileSync('./test-results.json', JSON.stringify(testResults, null, 2));
}

runTests();
