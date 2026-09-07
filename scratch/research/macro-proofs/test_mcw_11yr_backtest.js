import { runMuzzledCathieWoodSimulation } from '../../architecture/strategies/MuzzledCathieWoodSimulation.js';

async function main() {
    console.log("================================================================================");
    console.log("   CRASHRADAR RESEARCH: 11.5-YEAR MCW HISTORICAL BACKTEST (2015-2026)");
    console.log("================================================================================\n");

    const res = await runMuzzledCathieWoodSimulation({
        startDate: '2015-01-01',
        endDate: '2026-09-06',
        deRiskRate: 1.00,
        goldRatio: 0.50,
        deRiskTech: true
    });

    console.log("\n================================================================================");
    console.log("   ERGEBNIS-ZUSAMMENFASSUNG (2015-01-01 BIS 2026-09-06):");
    console.log("================================================================================");
    console.log(`Endwert Portfolio:  ${res.totalPortfolioEUR.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
    console.log(`Nettogewinn EUR:    ${res.netProfitEUR.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`);
    console.log(`Gesamtrendite:      +${res.returnPct.toFixed(2)} %`);
    console.log(`Maximaler Drawdown: -${res.maxDrawdownPct.toFixed(2)} %`);
    console.log(`Benchmark ARKK:     +${res.arkkReturn.toFixed(2)} %`);
    console.log(`Benchmark QQQ:      +${res.qqqReturn.toFixed(2)} %`);
    console.log(`Benchmark SPY:      +${res.spyReturn.toFixed(2)} %`);
    console.log(`Benchmark BTC:      +${res.btcReturn.toFixed(2)} %`);
    console.log(`Alpha vs ARKK:      +${(res.returnPct - res.arkkReturn).toFixed(2)} %-Punkte`);
    console.log(`Alpha vs QQQ:       +${(res.returnPct - res.qqqReturn).toFixed(2)} %-Punkte`);
    console.log("================================================================================\n");
}

main().catch(console.error);
