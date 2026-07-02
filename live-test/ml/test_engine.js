import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import { AnalysisRepository } from '../../src/core/repositories/AnalysisRepository.js';
import { FinanceExpert } from '../../src/services/FinanceExpert.js';
import { MLRegimeService } from '../../src/services/MLRegimeService.js';
import { RegimeLabeler } from '../../src/analysis/RegimeLabeler.js';
import { IndicatorEngine } from '../../src/analysis/IndicatorEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDate(dateObj) {
    if (typeof dateObj === 'string') return dateObj.split('T')[0];
    return dateObj.toISOString().split('T')[0];
}

async function run() {
    program
      .requiredOption('-t, --ticker <string>', 'Der Ticker für das Modell (z.B. SPY, BTC, QQQ)')
      .parse(process.argv);
    
    const options = program.opts();
    const ticker = options.ticker.toUpperCase();

    const configPath = path.join(__dirname, '../../config/ML-Config.json');
    const mlConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const tickerConfig = mlConfig.tickers[ticker] || {};
    const version = tickerConfig.version || mlConfig.default.version || 'v1';
    
    const modelName = `${ticker.toLowerCase()}_regime_${version}`;
    console.log(`\nStarte VETO-Test für Ticker: ${ticker} (Modell: ${modelName})`);

    const repo = new AnalysisRepository(process.env.DATABASE_URL);
    const ml = new MLRegimeService(modelName);
    const engine = new IndicatorEngine();
    await ml.loadModel();

    // 1. Hole Rohdaten
    const rawData = await repo.getOhlcvForTicker(ticker, '2015-01-01');
    const expert = new FinanceExpert(process.env.DATABASE_URL);
    const macroData = await expert.getDailyGroupedData('2015-01-01', { bypassMemoryGuard: true });
    if (rawData.length < 300) {
        console.error("Nicht genug Daten für den Test.");
        process.exit(1);
    }

    // 2. Erzeuge Ground Truth Labels
    const labelerData = rawData.map(c => ({
        date: formatDate(c.date),
        assets: { [ticker]: Number(c.close) }
    }));
    
    const labeler = new RegimeLabeler(labelerData, ticker);
    const trueLabels = labeler.generateLabels();

    // 3. Wähle Testpunkte dynamisch aus
    const testPoints = [];
    
    const tops = trueLabels.filter(l => l.label === 'CYCLE_TOP');
    if (tops.length > 0) {
         const lastTop = tops[tops.length - 1];
         const rawIndex = rawData.findIndex(r => formatDate(r.date) === lastTop.date);
         if (rawIndex >= 210) {
             testPoints.push({ index: rawIndex - 14, date: formatDate(rawData[rawIndex - 14].date), trueLabel: trueLabels[rawIndex - 14].label, desc: "14 Tage VOR letztem Top" });
             testPoints.push({ index: rawIndex, date: lastTop.date, trueLabel: 'CYCLE_TOP', desc: "Exakt AM letzten Top" });
         }
    }

    const bottoms = trueLabels.filter(l => l.label === 'CYCLE_BOTTOM');
    if (bottoms.length > 0) {
         const lastBot = bottoms[bottoms.length - 1];
         const rawIndex = rawData.findIndex(r => formatDate(r.date) === lastBot.date);
         if (rawIndex >= 210) {
             testPoints.push({ index: rawIndex, date: lastBot.date, trueLabel: 'CYCLE_BOTTOM', desc: "Exakt AM letzten Bottom" });
         }
    }

    testPoints.push({ index: rawData.length - 1, date: labelerData[labelerData.length - 1].date, trueLabel: trueLabels[trueLabels.length - 1].label, desc: "Aktueller Stand (Heute)" });

    // Entferne Duplikate
    const uniquePoints = [];
    const seen = new Set();
    for (const tp of testPoints.sort((a,b) => a.index - b.index)) {
        if (!seen.has(tp.date)) {
            seen.add(tp.date);
            uniquePoints.push(tp);
        }
    }

    // 4. Testlauf mit VETO Logik
    let correctAI = 0;
    let correctVeto = 0;
    
    for (const tp of uniquePoints) {
        // ML braucht die Kerzen für Indikatoren, IndicatorEngine braucht volle Historie (180 Tage)
        const recentCandles = rawData.slice(tp.index - 210, tp.index + 1);
        const mappedCandles = recentCandles.map(c => ({
            date: formatDate(c.date),
            close: Number(c.close),
            high: Number(c.high),
            low: Number(c.low),
            volume: Number(c.volume)
        }));

        try {
            const result = await ml.predict(mappedCandles);
            const actualClose = mappedCandles[mappedCandles.length - 1].close;
            let pred = result.phase;
            
            // Engine Evaluate
            const recentMacro = macroData.filter(d => formatDate(d.date) <= tp.date).slice(-210);
            let finalDecision = pred;
            
            // Sammle alle aktiven Alarme der letzten 14 Tage (Veto Lookback)
            const activeAlerts = [];
            const seenAlerts = new Set();
            
            for (let daysBack = 14; daysBack >= 0; daysBack--) {
                const snapshotLength = recentMacro.length - daysBack;
                if (snapshotLength < 180) continue;
                const macroSlice = recentMacro.slice(0, snapshotLength);
                
                for (const indicator of engine.indicators) {
                    if (indicator.name.includes('ML Regime Radar')) continue;
                    const res = indicator.evaluate(macroSlice);
                    if (res.status === 'CRITICAL' || res.status === 'WARNING') {
                        const alertKey = `${indicator.name}_${res.status}`;
                        if (!seenAlerts.has(alertKey)) {
                            seenAlerts.add(alertKey);
                            activeAlerts.push({ 
                                name: indicator.name, 
                                category: indicator.category, 
                                status: res.status, 
                                message: `[${daysBack}d ago] ${res.message}`
                            });
                        }
                    }
                }
            }

            // VETO LOGIC (STRICT)
            let vetoTriggered = false;
            let vetoReason = '';
            
            // REGEL 1: Panik sticht Makro! (Boden-Vetos haben höchste Priorität)
            // Prüfe zuerst auf CRITICAL TROUGH Alarme
            const criticalBottomAlert = activeAlerts.find(a => a.category === 'TROUGH' && a.status === 'CRITICAL');
            if (criticalBottomAlert && (pred === 'BEAR_MARKET' || pred === 'CYCLE_TOP' || pred === 'BULL_CORRECTION')) {
                finalDecision = 'CYCLE_BOTTOM (VETO)';
                vetoTriggered = true;
                vetoReason = `${criticalBottomAlert.name} (${criticalBottomAlert.status})`;
            }
            
            // REGEL 2: Wenn kein Boden-Veto aktiv ist, prüfe auf Top-Vetos
            // Veto darf NUR bei CRITICAL Alarmen ausgelöst werden!
            if (!vetoTriggered && (pred === 'BULL_MARKET' || pred === 'BULL_CORRECTION' || pred === 'BEAR_RALLY')) {
                const criticalTopAlert = activeAlerts.find(a => (a.category === 'LEADING' || a.category === 'TRIGGER') && a.status === 'CRITICAL');
                if (criticalTopAlert) {
                    finalDecision = 'CYCLE_TOP (VETO)';
                    vetoTriggered = true;
                    vetoReason = `${criticalTopAlert.name} (${criticalTopAlert.status})`;
                }
            }

            if (pred === tp.trueLabel) correctAI++;
            if (finalDecision.replace(' (VETO)', '') === tp.trueLabel) correctVeto++;

            console.log(`\n----------------------------------------`);
            console.log(`📅 Datum: ${tp.date} | 🏷️  Szenario: ${tp.desc}`);
            console.log(`💵 Close: $${actualClose.toFixed(2)}`);
            console.log(`🎯 Realität (Labeler) : ${tp.trueLabel}`);
            console.log(`🤖 ML Vorhersage     : ${pred} (Konfidenz: ${(result.confidence * 100).toFixed(2)}%)`);
            if (activeAlerts.length > 0) {
                console.log(`🔥 Engine Alerts      : ${activeAlerts.map(a => a.name + ' (' + a.status + ')').join(', ')}`);
            }
            if (vetoTriggered) console.log(`🚨 VETO ALARM         : ${vetoReason}`);
            console.log(`🏁 Finale Entscheidung: ${finalDecision}`);
        } catch (e) {
            console.log(`\nFehler bei ${tp.date}:`, e.message);
        }
    }

    console.log(`\n========================================`);
    console.log(`Ergebnis PURE AI: ${correctAI} von ${uniquePoints.length}`);
    console.log(`Ergebnis AI + VETO: ${correctVeto} von ${uniquePoints.length}`);

    await expert.close();
    await repo.close();
}

run().catch(console.error);
