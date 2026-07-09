import fs from 'fs';
import path from 'path';
import { MathUtils } from '../utils/MathUtils.js';

import { MacroRegimeEngine } from './MacroRegimeEngine.js';
import { TradeSetupEngine } from './TradeSetupEngine.js';
import { NotificationManager } from '../services/NotificationManager.js';

export class IndicatorEngine {
  constructor(notificationConfig = { topics: {}, indicators: {} }, cycleConfig = { MACRO_CYCLE: { lastBtcBottomDate: '2022-11-21', dangerWindowStartDays: 970 } }) {
    this.notificationConfig = notificationConfig;
    this.cycleConfig = cycleConfig;

    // --- NEUE ARCHITEKTUR ---
    // Die 33 alten Einzel-Indikatoren wurden restlos entfernt und durch die beiden neuen Engines abgelöst.
    this.macroRegimeEngine = new MacroRegimeEngine();
    this.tradeSetupEngine = new TradeSetupEngine(() => this.cycleConfig);
    this.notificationManager = new NotificationManager(this.notificationConfig);
  }

  _evaluateState(groupedData) {
    if (!groupedData || Object.keys(groupedData).length === 0) return null;
    const macroStates = this.macroRegimeEngine.evaluate(groupedData);
    const actionsByDate = this.tradeSetupEngine.evaluate(groupedData, macroStates);
    
    const dates = Object.keys(groupedData).sort();
    const lastDate = dates[dates.length - 1];
    
    return {
      macroState: macroStates[lastDate] || { regime: 'NORMAL', vetos: [], liquidityStatus: 'NORMAL' },
      tradeActions: actionsByDate[lastDate] || [],
      dateStr: lastDate,
      currentDayData: groupedData[lastDate]
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
    console.log('\n' + report.trimEnd());
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
