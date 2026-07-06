export class NotificationManager {
    constructor(indicators, notificationConfig) {
        this.indicators = indicators;
        this.notificationConfig = notificationConfig;
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
