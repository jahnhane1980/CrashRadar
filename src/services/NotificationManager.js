export class NotificationManager {
    constructor(notificationConfig = {}) {
        this.notificationConfig = {
            topics: notificationConfig?.topics || {},
            indicators: notificationConfig?.indicators || {}
        };
    }

    generateReport(macroState, tradeActions, dateStr, cleanText = false) {
        let report = '';
        const addLine = (str) => report += str + '\n';
    
        addLine(`======================================================`);
        addLine(`📊 MAKRO-FINANZ ANALYSE (Stichtag: ${dateStr})`);
        addLine(`======================================================\n`);
    
        const c_red = cleanText ? '' : '\x1b[31m';
        const c_yel = cleanText ? '' : '\x1b[33m';
        const c_grn = cleanText ? '' : '\x1b[32m';
        const c_rst = cleanText ? '' : '\x1b[0m';
        const c_bold = cleanText ? '' : '\x1b[1m';
        const c_gray = cleanText ? '' : '\x1b[90m';

        // 1. Makro Regime
        addLine(`${c_bold}🌍 MAKRO-REGIME (Wetterfrosch)${c_rst}`);
        addLine(`------------------------------------------------------`);
        
        let regimeColor = c_grn;
        if (macroState.regime === 'FLASH_CRASH' || macroState.regime === 'BEAR_MARKET') regimeColor = c_red;
        else if (macroState.regime === 'LATE_CYCLE_EUPHORIA') regimeColor = c_yel;
        
        addLine(`Regime:       ${regimeColor}[${macroState.regime}]${c_rst}`);
        addLine(`Liquidität:   ${macroState.liquidityStatus === 'STIMULUS_ACTIVE' ? c_grn + '[STIMULUS_ACTIVE]' : c_gray + '[NORMAL]'}${c_rst}`);
        
        if (macroState.vetos && macroState.vetos.length > 0) {
            addLine(`Aktive Vetos: ${c_yel}${macroState.vetos.join(', ')}${c_rst}`);
        } else {
            addLine(`Aktive Vetos: Keine`);
        }
        addLine('');

        // 2. Trade Actions
        addLine(`${c_bold}📈 TRADE ACTIONS (Execution Planer)${c_rst}`);
        addLine(`------------------------------------------------------`);
        
        if (!tradeActions || tradeActions.length === 0) {
            addLine(`  Keine Signale am heutigen Tag.`);
        } else {
            tradeActions.forEach(action => {
                let statusStr = action.status === 'CRITICAL' ? `${c_red}[CRITICAL]${c_rst}` : `${c_yel}[WARNING]${c_rst}`;
                let blockStr = action.blocked ? ` 🚫 ${c_red}(BLOCKIERT: ${action.blockReason})${c_rst}` : ` ✅ ${c_grn}(ERLAUBT)${c_rst}`;
                let scaleStr = action.scaleDown ? ` 📉 ${c_yel}(SCALE DOWN)${c_rst}` : '';
                
                addLine(`  ${statusStr} ${action.indicator}: ${action.message}${blockStr}${scaleStr}`);
            });
        }
        
        addLine('');
        return report;
    }

    getAlerts(macroState, tradeActions, alertHistory = {}, debounceDays = 14) {
        if (!tradeActions || tradeActions.length === 0) return { notifications: null, updatedHistory: alertHistory };
        
        const now = Date.now();
        const debounceMs = debounceDays * 24 * 60 * 60 * 1000;
        const groupedAlerts = {};
    
        tradeActions.forEach(action => {
            // Wir alarmieren nicht für blockierte Aktionen
            if (action.blocked) return;

            const historyKey = `${action.indicator}_${action.status}`;
            const lastSent = alertHistory[historyKey];
            if (lastSent && (now - lastSent) < debounceMs) {
                return; // Spam-Schutz
            }
    
            alertHistory[historyKey] = now;
            
            const topicKey = this.notificationConfig.indicators[action.indicator] || 'MACRO';
            
            if (!groupedAlerts[topicKey]) {
                groupedAlerts[topicKey] = { highestPriority: 'default', messages: [] };
            }
    
            let actionText = `${action.indicator} - ${action.message}`;
            if (action.scaleDown) actionText += ` (Empfehlung: Position skalieren)`;

            if (action.status === 'CRITICAL') {
                groupedAlerts[topicKey].highestPriority = 'urgent'; 
                groupedAlerts[topicKey].messages.push(`🚨 CRITICAL: ${actionText}`);
            } else if (action.status === 'WARNING') {
                if (groupedAlerts[topicKey].highestPriority === 'default') {
                    groupedAlerts[topicKey].highestPriority = 'high';
                }
                groupedAlerts[topicKey].messages.push(`⚠️ WARNING: ${actionText}`);
            }
        });
    
        const notifications = [];
        for (const [topicKey, data] of Object.entries(groupedAlerts)) {
            const topicConfig = this.notificationConfig.topics[topicKey] || { title: `CrashRadar: ${topicKey}`, icon: 'warning', priority: 'high' };
            const finalPriority = data.highestPriority === 'urgent' ? 'urgent' : 
                                 (data.highestPriority === 'high' && topicConfig.priority === 'default' ? 'high' : topicConfig.priority);
            
            let regimeInfo = `[Makro-Regime: ${macroState.regime}]`;
            if (macroState.vetos.length > 0) regimeInfo += ` [Vetos: ${macroState.vetos.join(', ')}]`;

            notifications.push({
                title: topicConfig.title,
                priority: finalPriority,
                tags: topicConfig.icon,
                message: `${regimeInfo}\n\n${data.messages.join('\n\n')}`
            });
        }
    
        return {
            notifications: notifications.length > 0 ? notifications : null,
            updatedHistory: alertHistory
        };
    }

    getDailyStatusReport(macroState, tradeActions, currentDayData) {
        let summary = `🌍 Regime: ${macroState.regime}\n`;
        if (macroState.vetos.length > 0) summary += `⚠️ Vetos: ${macroState.vetos.join(', ')}\n`;
        summary += `💧 Liquidität: ${macroState.liquidityStatus}\n\n`;

        let activeActions = tradeActions ? tradeActions.filter(a => !a.blocked) : [];
        if (activeActions.length > 0) {
            summary += `📈 Aktive Signale:\n`;
            activeActions.forEach(a => summary += `- ${a.indicator} (${a.status})\n`);
            summary += `\n`;
        }

        const formatRegime = (regime) => regime ? `${regime.phase} (${(regime.confidence * 100).toFixed(1)}%)` : 'UNKNOWN';
        if (currentDayData) {
            summary += `🤖 KI-Regime:\n`;
            summary += `SPY: ${formatRegime(currentDayData.mlRegimeSpy)}\n`;
            summary += `QQQ: ${formatRegime(currentDayData.mlRegimeQqq)}\n`;
            summary += `BTC: ${formatRegime(currentDayData.mlRegimeBtc)}\n`;
        }

        let overallStatus = 'OK';
        if (macroState.regime === 'FLASH_CRASH' || macroState.regime === 'BEAR_MARKET') overallStatus = 'CRITICAL';
        else if (activeActions.some(a => a.status === 'CRITICAL')) overallStatus = 'CRITICAL';
        else if (activeActions.some(a => a.status === 'WARNING')) overallStatus = 'WARNING';

        return {
            title: `CrashRadar: Daily Status (${overallStatus})`,
            priority: 'default',
            tags: 'chart_with_upwards_trend',
            message: summary.trim()
        };
    }
}
