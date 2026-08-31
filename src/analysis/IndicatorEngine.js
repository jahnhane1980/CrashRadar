import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MathUtils } from '../utils/MathUtils.js';
import { Logger } from '../core/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { MacroRegimeEngine } from './MacroRegimeEngine.js';
import { TradeSetupEngine } from './TradeSetupEngine.js';
import { NotificationManager } from '../services/NotificationManager.js';

export class IndicatorEngine {
  constructor(
    notificationConfig = { topics: {}, indicators: {} },
    cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } },
    indicatorPipelineConfig = null
  ) {
    this.notificationConfig = notificationConfig;
    this.cycleConfig = cycleConfig;

    let pipelineConfig = indicatorPipelineConfig;
    if (!pipelineConfig) {
      const configPath = path.resolve(__dirname, '../../config/Indicator-Pipeline-Config.json');
      if (fs.existsSync(configPath)) {
        try {
          pipelineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
          Logger.warn(`[IndicatorEngine] Konnte Indicator-Pipeline-Config.json nicht parsen: ${e.message}`);
        }
      }
    }
    this.indicatorPipelineConfig = pipelineConfig;

    this.macroRegimeEngine = new MacroRegimeEngine(this.indicatorPipelineConfig?.macroIndicators || this.indicatorPipelineConfig);
    this.tradeSetupEngine = new TradeSetupEngine(() => this.cycleConfig, this.indicatorPipelineConfig?.tradeSetupIndicators || this.indicatorPipelineConfig);
    this.notificationManager = new NotificationManager(this.notificationConfig);
  }

  _evaluateState(groupedData) {
    if (!groupedData || Object.keys(groupedData).length === 0) return null;
    const macroStates = this.macroRegimeEngine.evaluate(groupedData);
    const actionsByDate = this.tradeSetupEngine.evaluate(groupedData, macroStates);
    
    let lastDate;
    let currentDayData;

    if (Array.isArray(groupedData)) {
      currentDayData = groupedData[groupedData.length - 1];
      lastDate = currentDayData?.date || currentDayData?.dateStr;
    } else {
      const dates = Object.keys(groupedData).sort();
      lastDate = dates[dates.length - 1];
      currentDayData = groupedData[lastDate];
    }
    
    return {
      macroState: macroStates[lastDate] || { regime: 'NORMAL', vetos: [], liquidityStatus: 'NORMAL' },
      tradeActions: actionsByDate[lastDate] || [],
      dateStr: lastDate,
      currentDayData: currentDayData
    };
  }

  generateReport(groupedData, cleanText = false) {
    const state = this._evaluateState(groupedData);
    if (!state) throw new Error('Keine Daten für die Analyse vorhanden.');
    return this.notificationManager.generateReport(state.macroState, state.tradeActions, state.dateStr, cleanText);
  }

  run(groupedData) {
    // Console Log für die CLI mit Farben
    const report = this.generateReport(groupedData, false);
    Logger.info('\n' + report.trimEnd());
  }

  getAlerts(groupedData, alertHistory = {}, debounceDays = 14) {
    const state = this._evaluateState(groupedData);
    if (!state) return null;
    return this.notificationManager.getAlerts(state.macroState, state.tradeActions, alertHistory, debounceDays);
  }

  getDailyStatusReport(groupedData) {
    const state = this._evaluateState(groupedData);
    if (!state) return null;
    return this.notificationManager.getDailyStatusReport(state.macroState, state.tradeActions, state.currentDayData);
  }
}
