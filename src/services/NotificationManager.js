export class NotificationManager {
    constructor(notificationConfig = {}, indicatorPipelineConfig = null) {
        this.notificationConfig = {
            topics: notificationConfig?.topics || {},
            indicators: notificationConfig?.indicators || {}
        };
        this.indicatorPipelineConfig = indicatorPipelineConfig;
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

        if (macroState.indicatorDetails && macroState.indicatorDetails.length > 0) {
            addLine(`${c_bold}🔎 MAKRO-INDIKATOREN${c_rst}`);
            addLine(`------------------------------------------------------`);
            macroState.indicatorDetails.forEach(ind => {
                let indColor = c_grn;
                let icon = cleanText ? '' : '🟢';
                if (ind.status === 'WARNING') { indColor = c_yel; icon = cleanText ? '' : '🟡'; }
                if (ind.status === 'CRITICAL') { indColor = c_red; icon = cleanText ? '' : '🔴'; }
                const valStr = ind.value ? ` (${ind.value})` : '';
                addLine(`  ${icon} ${ind.name.padEnd(50, ' ')} ${indColor}[${ind.status}]${c_rst}${valStr}`);
                if (ind.status !== 'OK' && ind.status !== 'NORMAL' && ind.status !== 'NEUTRAL' && ind.message) {
                    addLine(`     ↳ ${c_gray}${ind.message}${c_rst}`);
                }
            });
            addLine('');
        }

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
        const groupedAlerts = {};
    
        tradeActions.forEach(action => {
            // Wir alarmieren nicht für blockierte Aktionen
            if (action.blocked) return;

            let dynamicDebounceDays = debounceDays;
            
            // CRISIS MODE: Wenn wir im Flash Crash sind und es um Gold/GDX geht, 
            // reduzieren wir das Debouncing dynamisch auf 2 Tage.
            if (macroState.regime === 'FLASH_CRASH' && 
               (action.indicator.includes('Gold') || action.indicator.includes('GDX'))) {
                dynamicDebounceDays = 2;
            }
            
            const debounceMs = dynamicDebounceDays * 24 * 60 * 60 * 1000;

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
            
            let regimeInfo = `[Makro: ${macroState.regime}]`;

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
        // HINWEIS: Der tägliche Wetterbericht unterliegt absichtlich KEINEM Debouncing (Spam-Schutz).
        // Er soll jeden Tag den ungeschönten Ist-Zustand des Marktes pushen.
        let summary = `🌍 Makro-Regime: ${macroState.regime}\n`;
        summary += `💧 Liquidität: ${macroState.liquidityStatus}\n`;

        if (macroState.vetos && macroState.vetos.includes('DALIO_TIPPING_POINT_ACTIVE')) {
            summary += `💥 DALIO KIPPPUNKT: 🔴 CRITICAL (0-3 Monate Crash-Fenster - RRP/Spreads getriggert!)\n\n`;
        } else if (macroState.vetos && macroState.vetos.includes('DALIO_LATE_STAGE_WATCHLIST')) {
            summary += `🏛️ DALIO SPÄTZYKLUS: 🟡 WATCHLIST (3/4 Bedingungen ROT - Zeitfenster ~3-12 Monate)\n\n`;
        } else {
            summary += `\n`;
        }

        if (macroState.indicatorDetails && macroState.indicatorDetails.length > 0) {
            const getIcon = (status) => {
                if (status === 'CRITICAL') return '🔴';
                if (status === 'WARNING') return '🟡';
                if (status === 'UNKNOWN') return '⚪';
                return '🟢';
            };

            const defaultGroups = [
                { id: 'EARLY_WARNING', title: '🌪️ 1. Frühwarn-System (Liquiditätsentzug)' },
                { id: 'ACUTE_PANIC', title: '🚨 2. Akut-Sensoren (Stress & Überhitzung)' },
                { id: 'BOTTOM_FINDER', title: '⚓ 3. Boden-Finder (Kapitulation & Einstieg)' },
                { id: 'MACRO_CONTEXT', title: '🌍 4. Zyklus-Begleitumfeld' }
            ];

            const stagesConfig = this.indicatorPipelineConfig?.stages;
            const groups = Array.isArray(stagesConfig) && stagesConfig.length > 0
                ? stagesConfig.filter(s => s.enabled !== false).map(s => ({
                    id: s.id || s.category,
                    title: s.title || s.name
                }))
                : defaultGroups;

            groups.forEach(group => {
                const groupInds = macroState.indicatorDetails.filter(ind => ind.category === group.id);
                if (groupInds.length > 0) {
                    summary += `${group.title}\n`;
                    groupInds.forEach(ind => {
                        const icon = getIcon(ind.status);
                        let text = `${icon} ${ind.name}: ${ind.status}`;
                        if (ind.value) text += ` (${ind.value})`;
                        summary += `${text}\n`;
                    });
                    summary += `\n`;
                }
            });
        }

        if (macroState.vetos && macroState.vetos.length > 0) {
            summary += `⚠️ Aktive Vetos: ${macroState.vetos.join(', ')}\n\n`;
        }

        let activeActions = tradeActions ? tradeActions.filter(a => !a.blocked) : [];
        if (activeActions.length > 0) {
            summary += `📈 Aktive Signale:\n`;
            activeActions.forEach(a => {
                let trancheStr = a.trancheLevel ? ` [Tranche ${a.trancheLevel}/3: ${a.targetAllocationPct}% ${a.targetAsset}]` : '';
                summary += `- ${a.indicator} (${a.status})${trancheStr}\n`;
            });
            summary += `\n`;
        }

        const formatRegime = (regime) => {
            if (!regime) return 'UNKNOWN';
            if (!regime.rawScores || Object.keys(regime.rawScores).length === 0) {
                return `${regime.phase} (${(regime.confidence * 100).toFixed(1)}%)`;
            }

            const scores = regime.rawScores;
            const bearSum = (scores.BEAR_MARKET || 0) + (scores.BEAR_RALLY || 0);
            const bullSum = (scores.BULL_MARKET || 0) + (scores.BULL_CORRECTION || 0);
            const cycleTop = scores.CYCLE_TOP || 0;
            const cycleBottom = scores.CYCLE_BOTTOM || 0;

            const sortedClasses = Object.entries(scores)
                .filter(([_, score]) => typeof score === 'number' && !isNaN(score))
                .sort((a, b) => b[1] - a[1]);

            const top2Str = sortedClasses.slice(0, 2)
                .map(([cls, score]) => `${cls} ${(score * 100).toFixed(1)}%`)
                .join(', ');

            let groupTitle = '';
            if (bearSum >= bullSum && bearSum >= cycleTop && bearSum >= cycleBottom && bearSum > 0) {
                groupTitle = `BÄR ${(bearSum * 100).toFixed(1)}%`;
            } else if (bullSum >= bearSum && bullSum >= cycleTop && bullSum >= cycleBottom && bullSum > 0) {
                groupTitle = `BULL ${(bullSum * 100).toFixed(1)}%`;
            } else if (cycleTop >= cycleBottom && cycleTop > 0) {
                groupTitle = `CYCLE_TOP ${(cycleTop * 100).toFixed(1)}%`;
            } else if (cycleBottom > 0) {
                groupTitle = `CYCLE_BOTTOM ${(cycleBottom * 100).toFixed(1)}%`;
            } else {
                return `${regime.phase} (${(regime.confidence * 100).toFixed(1)}%)`;
            }

            return `${groupTitle} (${top2Str})`;
        };

        if (currentDayData) {
            summary += `🤖 5. KI-Regime Radar\n`;
            let macroRiskInfo = null;
            if (currentDayData.mlRegimeMacro) {
                const mRisk = currentDayData.mlRegimeMacro.riskPct ?? ((currentDayData.mlRegimeMacro.probability || 0) * 100).toFixed(1);
                const mReg = currentDayData.mlRegimeMacro.regime || 'NORMAL';
                macroRiskInfo = `${mRisk}% Crash-Risiko [${mReg}]`;
            } else if (macroState?.indicatorDetails) {
                const macroInd = macroState.indicatorDetails.find(ind => ind.name === 'ML Regime Radar (Makro)');
                if (macroInd && macroInd.value) {
                    macroRiskInfo = `${macroInd.value} [${macroInd.status}]`;
                }
            }
            if (macroRiskInfo) {
                summary += `Makro (XGBoost 32 Features): ${macroRiskInfo}\n`;
            }
            summary += `SPY: ${formatRegime(currentDayData.mlRegimeSpy)}\n`;
            summary += `QQQ: ${formatRegime(currentDayData.mlRegimeQqq)}\n`;
            summary += `BTC: ${formatRegime(currentDayData.mlRegimeBtc)}\n`;
        }

        let overallStatus = 'OK';
        if (macroState.regime === 'FLASH_CRASH' || macroState.regime === 'BEAR_MARKET') overallStatus = 'CRITICAL';
        else if (activeActions.some(a => a.status === 'CRITICAL')) overallStatus = 'CRITICAL';
        else if (activeActions.some(a => a.status === 'WARNING')) overallStatus = 'WARNING';

        return {
            title: `CrashRadar: Makro-Wetterbericht (${overallStatus})`,
            priority: 'default',
            tags: 'chart_with_upwards_trend',
            message: summary.trim()
        };
    }
}
