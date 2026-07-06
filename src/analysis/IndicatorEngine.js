import fs from 'fs';
import path from 'path';
import { MathUtils } from '../utils/MathUtils.js';
import { BankReservesIndicator } from './indicators/BankReservesIndicator.js';
import { MaturityWallIndicator } from './indicators/MaturityWallIndicator.js';
import { TgaIndicator } from './indicators/TgaIndicator.js';
import { YieldCurveIndicator } from './indicators/YieldCurveIndicator.js';
import { SahmRuleIndicator } from './indicators/SahmRuleIndicator.js';
import { MarginDebtIndicator } from './indicators/MarginDebtIndicator.js';
import { ArccIndicator } from './indicators/ArccIndicator.js';
import { BitcoinDivergenceIndicator } from './indicators/BitcoinDivergenceIndicator.js';
import { CryptoCycleDivergenceIndicator } from './indicators/CryptoCycleDivergenceIndicator.js';
import { NfciIndicator } from './indicators/NfciIndicator.js';
import { GoldVolumeClimaxIndicator } from './indicators/GoldVolumeClimaxIndicator.js';
import { GdxSellingClimaxIndicator } from './indicators/GdxSellingClimaxIndicator.js';
import { GdxBuyingClimaxIndicator } from './indicators/GdxBuyingClimaxIndicator.js';
import { GdxGoldDivergenceIndicator } from './indicators/GdxGoldDivergenceIndicator.js';
import { RedAlertIndicator } from './indicators/RedAlertIndicator.js';
import { RateShockIndicator } from './indicators/RateShockIndicator.js';
import { HygDivergenceIndicator } from './indicators/HygDivergenceIndicator.js';
import { BizdIndicator } from './indicators/BizdIndicator.js';
import { BklnIndicator } from './indicators/BklnIndicator.js';
import { CbPolicyErrorIndicator } from './indicators/CbPolicyErrorIndicator.js';
import { CryptoPortfolioExitIndicator } from './indicators/CryptoPortfolioExitIndicator.js';
import { BtcTrailingStopIndicator } from './indicators/BtcTrailingStopIndicator.js';
import { PanicCapitulationIndicator } from './indicators/PanicCapitulationIndicator.js';
import { VixSpikeCrushIndicator } from './indicators/VixSpikeCrushIndicator.js';
import { GoldCapitulationIndicator } from './indicators/GoldCapitulationIndicator.js';
import { BitcoinSellingClimaxIndicator } from './indicators/BitcoinSellingClimaxIndicator.js';
import { TechCycleRadarIndicator } from './indicators/TechCycleRadarIndicator.js';
import { MlRegimeRadarSpyIndicator } from './indicators/MlRegimeRadarSpyIndicator.js';
import { MlRegimeRadarQqqIndicator } from './indicators/MlRegimeRadarQqqIndicator.js';
import { MlRegimeRadarBtcIndicator } from './indicators/MlRegimeRadarBtcIndicator.js';
import { MarketPanicCapitulationIndicator } from './indicators/MarketPanicCapitulationIndicator.js';
import { MlRegimeRadarMacroIndicator } from './indicators/MlRegimeRadarMacroIndicator.js';
import { MlRegimeRadarCryptoIndicator } from './indicators/MlRegimeRadarCryptoIndicator.js';

export class IndicatorEngine {
  constructor() {
    const configPath = path.resolve(process.cwd(), 'config/Notification-Config.json');
    this.notificationConfig = { topics: {}, indicators: {} };
    try {
      if (fs.existsSync(configPath)) {
        this.notificationConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } else {
        console.warn(`[IndicatorEngine] Config nicht gefunden: ${configPath}`);
      }
    } catch (e) {
      console.error("[IndicatorEngine] Fehler beim Laden der Notification-Config:", e.message);
    }

    const cycleConfigPath = path.resolve(process.cwd(), 'config/Cycle-Base-Config.json');
    this.cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } };
    try {
      if (fs.existsSync(cycleConfigPath)) {
        this.cycleConfig = JSON.parse(fs.readFileSync(cycleConfigPath, 'utf8'));
      }
    } catch (e) {
      console.error("[IndicatorEngine] Fehler beim Laden der Cycle-Base-Config:", e.message);
    }

    const THRESHOLDS = {
      TOTRESNS_CRITICAL: 2800,
      TOTRESNS_WARNING: 3000,
      MW_CRITICAL: 21,
      MW_WARNING: 15,
      TGA_DIFF: 100,
      SAHM_CRITICAL: 0.50,
      NFCI_CRITICAL: 0,
      RATE_SHOCK_CRITICAL: 0.50,
      RATE_SHOCK_WARNING: 0.30,
      HYG_CRITICAL: -3.0,
      HYG_WARNING: -1.5,
      VIX_SPIKE: 40,
      VIX_WARNING: 35,
      VIX_CRUSH_PCT: 0.8,
      VIX_CRUSH_WARNING_PCT: 0.85,
      GOLD_BREAKOUT_PCT: 1.02,
      BIZD_CRITICAL: -5.0,
      BIZD_WARNING: -2.5,
      BKLN_CRITICAL: -2.0,
      BKLN_WARNING: -1.0,
      ARCC_INTEREST_GROWTH_CRITICAL: 15.0,
      ARCC_INTEREST_GROWTH_WARNING: 5.0,
      GOLD_CLIMAX_VOL_MULTIPLIER: 5.0,
      GOLD_CLIMAX_PRICE_DROP: -2.0,
      GOLD_CLIMAX_PRICE_RISE: 2.0,
      GDX_CLIMAX_VOL_MULTIPLIER: 3.0,
      GDX_CLIMAX_PRICE_DROP: -5.0,
      GDX_CLIMAX_PRICE_RISE: 5.0
    };

    this.indicators = [
      // 🟢 LEADING (Frühindikatoren)
      new BankReservesIndicator(),
      new MaturityWallIndicator(),
      new TgaIndicator(),
      new YieldCurveIndicator(),
      new SahmRuleIndicator(),
      new MarginDebtIndicator(),
      new ArccIndicator(),
      new BitcoinDivergenceIndicator(),
      new CryptoCycleDivergenceIndicator(),

      // 🟡 CONTEMPORANEOUS (Akut)
      new NfciIndicator(),
      new GoldVolumeClimaxIndicator(),
      new GdxSellingClimaxIndicator(),
      new GdxBuyingClimaxIndicator(),
      new GdxGoldDivergenceIndicator(),

      // 🔴 TRIGGER (Verkaufssignale)
      new RedAlertIndicator(),
      new RateShockIndicator(),
      new HygDivergenceIndicator(),
      new BizdIndicator(),
      new BklnIndicator(),
      new CbPolicyErrorIndicator(),

      new CryptoPortfolioExitIndicator(() => this.cycleConfig),
      new BtcTrailingStopIndicator(),

      // 🔵 TROUGH (Boden-Suche / Kaufsignale nach Crash)
      new PanicCapitulationIndicator(),
      new VixSpikeCrushIndicator(),
      new GoldCapitulationIndicator(),
      new BitcoinSellingClimaxIndicator(),
      new TechCycleRadarIndicator(),
      new MlRegimeRadarSpyIndicator(),
      new MlRegimeRadarQqqIndicator(),
      new MlRegimeRadarBtcIndicator(),
      new MarketPanicCapitulationIndicator(),
      new MlRegimeRadarMacroIndicator(),
      new MlRegimeRadarCryptoIndicator()
    ];
  }

  generateReport(groupedData, cleanText = false) {
    if (!groupedData || groupedData.length === 0) {
      throw new Error("Keine Daten für die Analyse vorhanden.");
    }
    
    let report = '';
    const addLine = (str) => report += str + '\n';

    addLine(`======================================================`);
    addLine(`📊 MAKRO-FINANZ ANALYSE (Stichtag: ${groupedData[groupedData.length - 1].date})`);
    addLine(`======================================================\n`);

    const categories = ['LEADING', 'TRIGGER', 'CONTEMPORANEOUS', 'TROUGH'];
    const icons = {
      'LEADING': '🟢 FRÜHINDIKATOREN (LEADING)',
      'TRIGGER': '🔴 TRIGGER-INDIKATOREN (SIGNAL)',
      'CONTEMPORANEOUS': '🟡 AKUT-INDIKATOREN (CONTEMPORANEOUS)',
      'TROUGH': '🔵 BODEN-INDIKATOREN (TROUGH)'
    };

    const statusColor = {
      'CRITICAL': cleanText ? '[CRITICAL]' : '\x1b[31m[CRITICAL]\x1b[0m', // Rot
      'WARNING': cleanText ? '[WARNING]' : '\x1b[33m[WARNING]\x1b[0m',  // Gelb
      'OK': cleanText ? '[OK]' : '\x1b[32m[OK]\x1b[0m',       // Grün
      'UNKNOWN': cleanText ? '[UNKNOWN]' : '\x1b[90m[UNKNOWN]\x1b[0m'   // Grau
    };

    categories.forEach(cat => {
      const header = cleanText ? icons[cat] : `\x1b[1m${icons[cat]}\x1b[0m`;
      addLine(header);
      const catIndicators = this.indicators.filter(i => i.category === cat);
      
      catIndicators.forEach(ind => {
        const result = ind.evaluate(groupedData);
        const colorStat = statusColor[result.status] || result.status;
        addLine(`  ${colorStat} ${ind.name}: ${result.value} -> ${result.message}`);
      });
      addLine('');
    });

    return report;
  }

  run(groupedData) {
    // Console Log für die CLI mit Farben
    const report = this.generateReport(groupedData, false);
    // Wir entfernen das letzte \n vom report, da console.log eh eins anhängt
    console.log('\n' + report.trimEnd());
  }

  getAlerts(groupedData, alertHistory = {}, debounceDays = 14) {
    if (!groupedData || groupedData.length === 0) return null;
    
    const now = Date.now();
    const debounceMs = debounceDays * 24 * 60 * 60 * 1000;
    
    // Gruppierung der Alarme nach Topic (Asset Class)
    const groupedAlerts = {};

    this.indicators.forEach(ind => {
      const result = ind.evaluate(groupedData);
      if (result.status === 'CRITICAL' || result.status === 'WARNING') {
        
        // Debounce-Check: Wurde für diesen Indikator (mit diesem Status) in letzter Zeit schon gewarnt?
        const historyKey = `${ind.name}_${result.status}`;
        const lastSent = alertHistory[historyKey];
        if (lastSent && (now - lastSent) < debounceMs) {
            return; // Zu früh, überspringen (Spam-Schutz)
        }

        alertHistory[historyKey] = now;
        
        // Topic ermitteln (Fallback: MACRO)
        const topicKey = this.notificationConfig.indicators[ind.name] || 'MACRO';
        
        if (!groupedAlerts[topicKey]) {
            groupedAlerts[topicKey] = {
                highestPriority: 'default',
                messages: []
            };
        }

        if (result.status === 'CRITICAL') {
          groupedAlerts[topicKey].highestPriority = 'urgent'; 
          groupedAlerts[topicKey].messages.push(`🚨 CRITICAL: ${ind.name} - ${result.message} (${result.value})`);
        } else if (result.status === 'WARNING') {
          if (groupedAlerts[topicKey].highestPriority === 'default') {
              groupedAlerts[topicKey].highestPriority = 'high';
          }
          groupedAlerts[topicKey].messages.push(`⚠️ WARNING: ${ind.name} - ${result.message} (${result.value})`);
        }
      }
    });

    const notifications = [];
    
    for (const [topicKey, data] of Object.entries(groupedAlerts)) {
        const topicConfig = this.notificationConfig.topics[topicKey] || { title: `CrashRadar: ${topicKey}`, icon: 'warning', priority: 'high' };
        
        // Bei 'urgent' (Critical) überschreiben wir die Standard-Topic-Priority. 
        // Bei 'high' (Warning) überschreiben wir nur, wenn der Topic-Standard 'default' ist.
        const finalPriority = data.highestPriority === 'urgent' ? 'urgent' : 
                             (data.highestPriority === 'high' && topicConfig.priority === 'default' ? 'high' : topicConfig.priority);
        
        notifications.push({
            title: topicConfig.title,
            priority: finalPriority,
            tags: topicConfig.icon,
            message: data.messages.join('\n\n')
        });
    }

    return {
      notifications: notifications.length > 0 ? notifications : null,
      updatedHistory: alertHistory
    };
  }

  getDailyStatusReport(groupedData) {
    if (!groupedData || groupedData.length === 0) return null;
    
    let summary = '';
    const categories = ['LEADING', 'TRIGGER', 'CONTEMPORANEOUS', 'TROUGH'];
    let overallStatus = 'OK';
    
    categories.forEach(cat => {
      const catIndicators = this.indicators.filter(i => i.category === cat);
      let catErrors = 0;
      let catWarns = 0;
      
      catIndicators.forEach(ind => {
          const res = ind.evaluate(groupedData);
          if (res.status === 'CRITICAL') catErrors++;
          else if (res.status === 'WARNING') catWarns++;
      });
      
      if (catErrors > 0) overallStatus = 'CRITICAL';
      else if (catWarns > 0 && overallStatus !== 'CRITICAL') overallStatus = 'WARNING';
      
      let catStatusStr = catErrors > 0 ? '🚨 Kritisch' : (catWarns > 0 ? '⚠️ Warnung' : '✅ OK');
      summary += `${cat}: ${catStatusStr}\n`;
    });
    
    const currentDay = groupedData[groupedData.length - 1];
    const formatRegime = (regime) => regime ? `${regime.phase} (${(regime.confidence * 100).toFixed(1)}%)` : 'UNKNOWN';
    
    summary += `\n🤖 KI-Regime:\n`;
    summary += `SPY: ${formatRegime(currentDay.mlRegimeSpy)}\n`;
    summary += `QQQ: ${formatRegime(currentDay.mlRegimeQqq)}\n`;
    summary += `BTC: ${formatRegime(currentDay.mlRegimeBtc)}\n`;
    
    return {
        title: `CrashRadar: Daily Status (${overallStatus})`,
        priority: 'default',
        tags: 'chart_with_upwards_trend',
        message: summary.trim()
    };
  }
}
