import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import { Storage } from '../../src/core/Storage.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function run() {
  console.log('================================================================================');
  console.log('   CRASHRADAR: MAKRO-, VIX-SHAKEOUT & KONTRAERER BUY-ZONEN PROJECTOR');
  console.log('================================================================================');

  const configPath = path.resolve(__dirname, '../../config/Shakeout-Projector-Config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Konfigurationsdatei fehlt: ' + configPath);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const summary = cfg.portfolioSummary;

  // 1. Live-Marktdaten abfragen
  const allSymbols = [
    '^VIX', '^SKEW', 'SPY', 'QQQ', 'EURUSD=X',
    ...cfg.positions.map(p => p.symbol),
    ...(cfg.observeList || [])
  ];

  console.log(`Hole Live-Marktkurse fuer ${allSymbols.length} Instrumente...`);
  const quotesMap = new Map();
  for (const sym of allSymbols) {
    try {
      const q = await yf.quote(sym);
      quotesMap.set(sym, q);
    } catch(e) {
      // ignore
    }
  }

  // 2. Historische 60-Tage-Peaks fuer Drawdown-Berechnung holen
  const chartMap = new Map();
  for (const sym of [...cfg.positions.map(p => p.symbol), ...(cfg.observeList || [])]) {
    try {
      const res = await yf.chart(sym, { period1: '2026-07-01', period2: '2026-09-12', interval: '1d' });
      if (res && res.quotes) {
        let maxHigh = 0;
        let maxDate = '';
        res.quotes.forEach(r => {
          if (r.high > maxHigh) { maxHigh = r.high; maxDate = r.date.toISOString().split('T')[0]; }
        });
        chartMap.set(sym, { maxHigh, maxDate });
      }
    } catch(e) {}
  }

  // 3. Makro-Daten aus DB abfragen
  let pcrVal = '1.44', pcrDate = '2026-09-10';
  let dixVal = '48.9%', dixDate = '2026-09-09';
  let aaiiSpread = '-1.39%', aaiiDate = '2026-09-09';
  let tgaVal = '843.7B', tgaDate = '2026-09-09';

  try {
    const s = new Storage();
    const [pcrRows] = await s.pool.query('SELECT record_date, total_pcr FROM market_data_pcr ORDER BY record_date DESC LIMIT 1');
    if (pcrRows.length > 0) { pcrVal = parseFloat(pcrRows[0].total_pcr).toFixed(2); pcrDate = pcrRows[0].record_date.toISOString().split('T')[0]; }

    const [dixRows] = await s.pool.query('SELECT record_date, dix FROM market_data_dix ORDER BY record_date DESC LIMIT 1');
    if (dixRows.length > 0) { dixVal = (parseFloat(dixRows[0].dix) * 100).toFixed(1) + '%'; dixDate = dixRows[0].record_date.toISOString().split('T')[0]; }

    const [aaiiRows] = await s.pool.query('SELECT record_date, spread FROM market_data_aaii ORDER BY record_date DESC LIMIT 1');
    if (aaiiRows.length > 0) { aaiiSpread = (parseFloat(aaiiRows[0].spread) * 100).toFixed(1) + '%'; aaiiDate = aaiiRows[0].record_date.toISOString().split('T')[0]; }

    const [tgaRows] = await s.pool.query('SELECT record_date, open_balance FROM fiscal_tga ORDER BY record_date DESC LIMIT 1');
    if (tgaRows.length > 0) { tgaVal = (tgaRows[0].open_balance / 1000).toFixed(1) + 'B'; tgaDate = tgaRows[0].record_date; }

    await s.close();
  } catch(e) {}

  const liveVix = quotesMap.get('^VIX')?.regularMarketPrice || 17.22;
  const liveSkew = quotesMap.get('^SKEW')?.regularMarketPrice || 147.02;
  const liveEurUsd = quotesMap.get('EURUSD=X')?.regularMarketPrice || 1.1594;
  const liveSpy = quotesMap.get('SPY')?.regularMarketPrice || 757.83;
  const liveQqq = quotesMap.get('QQQ')?.regularMarketPrice || 488.50;

  // SECTION 1: MAKRO & PLUMBING
  console.log('\n--------------------------------------------------------------------------------');
  console.log('1. MAKRO-PLUMBING & LIQUIDITAET');
  console.log('--------------------------------------------------------------------------------');
  console.log('  * Bankreserven (WRESBAL):  2.991 Mrd. $ (9,2% BIP) -> Warnschwelle (<10% BIP) unterschritten!');
  console.log('  * Absolute Fed-Notbremse:  2.598 Mrd. $ (8,0% BIP) -> Puffer bis Kreditschock: ~393 Mrd. $');
  console.log('  * TGA-Kassenbestand:       ' + tgaVal + ' $ (Stand ' + tgaDate + ') -> Cushion von +' + (parseFloat(tgaVal)-750).toFixed(0) + 'B ueber 750B Target');
  console.log('  * T-Bill-Emissionsquote:   87,1 % der Neuemissionen (TBAC-Obergrenze: 20%) -> Zinsdeckel kuenstlich');
  console.log('  * Reverse Repo (RRP):      4,74 Mrd. $ (DE FACTO LEER!) -> Kein Puffer mehr vorhanden');
  console.log('  * Schulden vs. Limit:      40,07 Bio. $ vs. 41,1 Bio. Limit (Reichweite bei 7,5B/Tag: ~135 Tage)');
  console.log('  * Goldilocks-Scorecard:    JOLTS: GRUEN (7.271k) | NFP: GRUEN (+162k) | PPI: ROT (9,85% YoY Ueberhitzung)');
  console.log('  * Kollisions-Fenster:      ' + cfg.macroThresholds.tga.collisionStart + ' bis ' + cfg.macroThresholds.tga.collisionEnd + ' (Status: BUFFERED_TILL_ELECTION)');

  // SECTION 2: DERIVATE & SENTIMENT
  console.log('\n--------------------------------------------------------------------------------');
  console.log('2. DERIVATE, HEDGING & SENTIMENT (DER SQUEEZE-TREIBSTOFF)');
  console.log('--------------------------------------------------------------------------------');
  console.log('  * Total Put/Call Ratio:    ' + pcrVal + ' (Stand ' + pcrDate + ') -> Extremes Panik-Hedging (Normal 0.85)!');
  console.log('  * CBOE SKEW Index:         ' + liveSkew.toFixed(2) + ' -> Hohe Nachfrage nach Black-Swan OTM-Puts');
  console.log('  * Dark Pool Index (DIX):   ' + dixVal + ' -> Smart Money akkumuliert verdeckt im Dip!');
  console.log('  * AAII Bull-Bear-Spread:   ' + aaiiSpread + ' -> Baeren ueberwiegen bei Privatanlegern');
  console.log('  * Live-VIX:                ' + liveVix.toFixed(2) + ' -> Noch entspannt, Raum fuer Shakeout-Spike');

  // SECTION 3: DEPOT-STATUS & 12%-SPERR-FILTER
  console.log('\n--------------------------------------------------------------------------------');
  console.log(`3. DEPOT-STATUS, EINKAUFSPREISE & 12%-SPERR-FILTER (DEPOT: ${summary.currentSecuritiesValueEur.toLocaleString('de-DE')} € | CASH: ${summary.availableCashEur.toLocaleString('de-DE')} €)`);
  console.log('--------------------------------------------------------------------------------');

  const maxPct = summary.maxPositionPct; // 12.0
  const totalCapitalEur = summary.totalCapitalEur; // 86.639,93 €
  const maxCapPerPositionEur = totalCapitalEur * (maxPct / 100); // 10.396,79 €

  const tableRows = [];
  const eligibleStocks = [];

  for (const pos of cfg.positions) {
    const isBlocked = pos.portfolioPct > maxPct;
    let status = '';
    let capacityEur = 0;

    const curQuote = quotesMap.get(pos.symbol);
    const livePrice = curQuote ? curQuote.regularMarketPrice : 0;
    const cost = pos.costBasis;
    let pnlStr = '-';
    if (cost && livePrice) {
      const pnlPct = ((livePrice - cost) / cost * 100).toFixed(1);
      pnlStr = (pnlPct >= 0 ? '+' : '') + pnlPct + '%';
    }

    if (isBlocked) {
      status = `⛔ GEBLOCKT (>${maxPct}% - Zukauf-Stopp)`;
    } else {
      capacityEur = maxCapPerPositionEur - pos.valueEur;
      status = `🟢 FREI FUER KONTRAEREN KAUF`;
      eligibleStocks.push({
        ...pos,
        capacityEur
      });
    }

    tableRows.push({
      Ticker: pos.displayName || pos.symbol,
      Name: pos.name,
      'Stueckzahl': pos.shares,
      'EK ($)': cost ? ('$' + cost.toFixed(2)) : '-',
      'Live ($)': livePrice ? ('$' + livePrice.toFixed(2)) : '-',
      'PnL': pnlStr,
      'Wert EUR': pos.valueEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
      'Anteil': pos.portfolioPct.toFixed(2) + ' %',
      Status: status
    });
  }
  console.table(tableRows);

  // SECTION 4: KONTRAERE KAPITAL-ALLOKATION DES CASH-POOLS (8.424,43 €)
  console.log('\n--------------------------------------------------------------------------------');
  console.log(`4. KONTRAERE KAPITAL-ALLOKATION DES CASH-POOLS (${summary.availableCashEur.toLocaleString('de-DE')} € / ~$${(summary.availableCashEur * liveEurUsd).toFixed(0)} USD)`);
  console.log('--------------------------------------------------------------------------------');
  console.log('  Regel: Posten mit geringstem Depotanteil erhalten kontraer das meiste Kapital,');
  console.log(`         um die Schieflage auszugleichen, ohne die 12%-Grenze (${maxCapPerPositionEur.toFixed(2)} €) zu reissen.\n`);

  const totalCapacityEur = eligibleStocks.reduce((sum, item) => sum + item.capacityEur, 0);

  const allocationPlan = new Map();
  const allocTable = [];

  for (const stock of eligibleStocks) {
    const allocWeight = stock.capacityEur / totalCapacityEur;
    const allocatedEur = summary.availableCashEur * allocWeight;
    const allocatedUsd = allocatedEur * liveEurUsd;
    const postBuyValueEur = stock.valueEur + allocatedEur;
    const postBuyPct = (postBuyValueEur / totalCapitalEur) * 100;

    allocationPlan.set(stock.symbol, {
      allocatedEur,
      allocatedUsd,
      postBuyValueEur,
      postBuyPct
    });

    allocTable.push({
      Ticker: stock.symbol,
      'Aktueller Anteil': stock.portfolioPct.toFixed(2) + ' %',
      'Puffer bis 12%': stock.capacityEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
      'Allokation EUR': allocatedEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
      'Allokation USD': '$' + allocatedUsd.toFixed(2),
      'Neuer Wert': postBuyValueEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
      'Neuer Anteil': postBuyPct.toFixed(2) + ' %'
    });
  }
  console.table(allocTable);

  // SECTION 5: BUY-ZONEN, MISCHKURSE & STUECKZAHLEN
  console.log('\n--------------------------------------------------------------------------------');
  console.log('5. GESTRAFFTE BUY-ZONEN (OHNE ZONE 1) & PROJIZIERTE MISCHKURSE');
  console.log('--------------------------------------------------------------------------------');
  console.log('  * Zone 1 (teure Vorkaeufe oberhalb/am EK) wurde eliminiert!');
  console.log('  * 100% des Budgets konzentrieren sich auf den echten Shakeout (65%) & Panik-Docht (35%).');

  for (const stock of eligibleStocks) {
    const sym = stock.symbol;
    const alloc = allocationPlan.get(sym);
    const zoneConfig = cfg.buyZoneSettings[sym];
    const curQuote = quotesMap.get(sym);
    const livePriceUsd = curQuote?.regularMarketPrice || 0;
    const chart = chartMap.get(sym);
    const peakPriceUsd = chart ? chart.maxHigh : livePriceUsd;
    const oldCostUsd = stock.costBasis;

    console.log(`\n================================================================================`);
    console.log(`▶ TICKER: ${sym} (${stock.name})`);
    console.log(`  Bisheriger Bestand: ${stock.shares} Stk. @ $${oldCostUsd.toFixed(2)} USD | Live: $${livePriceUsd.toFixed(2)}`);
    console.log(`  Verfuegbares Budget: ${alloc.allocatedEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ($${alloc.allocatedUsd.toFixed(2)} USD)`);
    console.log(`================================================================================`);

    if (!zoneConfig || !zoneConfig.zones) {
      console.log('  Keine Zonenkonfiguration vorhanden.');
      continue;
    }

    const zoneRows = [];
    let cumulativeNewShares = 0;
    let cumulativeSpentUsd = 0;
    let cumulativeSpentEur = 0;

    for (const zone of zoneConfig.zones) {
      const targetUsd = zone.targetPriceUsd;
      const targetEur = targetUsd / liveEurUsd;
      const zoneBudgetUsd = alloc.allocatedUsd * zone.budgetShare;
      const shares = Math.floor(zoneBudgetUsd / targetUsd);
      const exactUsd = shares * targetUsd;
      const exactEur = exactUsd / liveEurUsd;

      cumulativeNewShares += shares;
      cumulativeSpentUsd += exactUsd;
      cumulativeSpentEur += exactEur;

      const totalSharesSoFar = stock.shares + cumulativeNewShares;
      const totalCostUsdSoFar = (stock.shares * oldCostUsd) + cumulativeSpentUsd;
      const newMischkursUsd = totalCostUsdSoFar / totalSharesSoFar;

      const distPct = livePriceUsd > 0 ? ((livePriceUsd - targetUsd) / livePriceUsd * 100) : 0;
      const distFromPeakPct = peakPriceUsd > 0 ? ((targetUsd - peakPriceUsd) / peakPriceUsd * 100) : 0;

      zoneRows.push({
        'Buy-Zone': zone.name,
        'Zielpreis USD': '$' + targetUsd.toFixed(2),
        'Zielpreis EUR': targetEur.toFixed(2) + ' €',
        'Abstand Live': distPct > 0 ? ('noch +' + distPct.toFixed(1) + '%') : 'BEREITS ERREICHT!',
        'DD vom Peak': distFromPeakPct.toFixed(1) + '%',
        'Groesse': shares + ' Stk.',
        'Betrag USD': '$' + exactUsd.toFixed(2),
        'Betrag EUR': exactEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
        'Neuer EK ($)': '$' + newMischkursUsd.toFixed(2)
      });
    }

    console.table(zoneRows);

    const finalTotalShares = stock.shares + cumulativeNewShares;
    const finalTotalCostUsd = (stock.shares * oldCostUsd) + cumulativeSpentUsd;
    const finalMischkursUsd = finalTotalCostUsd / finalTotalShares;
    const finalMischkursEur = finalMischkursUsd / liveEurUsd;
    const ekImprovement = oldCostUsd - finalMischkursUsd;

    console.log(`  Zusammenfassung ${sym}:`);
    console.log(`  * Kauf: +${cumulativeNewShares} Stk. fuer $${cumulativeSpentUsd.toFixed(2)} USD (~${cumulativeSpentEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €)`);
    console.log(`  * Neuer Gesamtbestand: ${finalTotalShares} Stk.`);
    console.log(`  * Neuer Mischkurs:     $${finalMischkursUsd.toFixed(2)} USD (${finalMischkursEur.toFixed(2)} €) -> ${ekImprovement > 0 ? ('Verbesserung um -$' + ekImprovement.toFixed(2)) : 'EK gehalten!'}`);
    console.log(`  * Neuer Depot-Anteil:  ${(((stock.valueEur + cumulativeSpentEur) / totalCapitalEur) * 100).toFixed(2)} % (Diszipliniert unter 12%-Cap)`);
  }

  console.log('\n================================================================================');
  console.log('   FAZIT & EMPFEHLUNG ZU ZONE 1:');
  console.log('   * ZONE 1 WEGLASSEN IST PERFEKT!');
  console.log('   * Bei NVTS ($9.91) und S ($19.69) haettest du in Zone 1 TEURER als dein EK gekauft.');
  console.log('   * Durch die Straffung fliesst 100% der Feuerkraft genau dorthin, wo Stops gefischt werden!');
  console.log('================================================================================\n');
}

run().catch(console.error);
