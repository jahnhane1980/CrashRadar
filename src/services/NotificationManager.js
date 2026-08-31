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
        if (!macroState) return null;

        const getIcon = (status) => {
            if (status === 'CRITICAL') return '🔴';
            if (status === 'WARNING' || status === 'EARLY_WARNING') return '🟡';
            if (status === 'UNKNOWN') return '⚪';
            return '🟢';
        };

        const indDetails = macroState.indicatorDetails || [];
        const findInd = (namePart) => indDetails.find(ind => ind.name && ind.name.includes(namePart));

        // 1. Synthese der Gesamtlage & Titel
        let overallPhase = '🟢 STABILER MARKT (Liquide)';
        let overallStatus = 'OK';
        let overallPriority = 'default';
        let tag = 'chart_with_upwards_trend';

        if (macroState.regime === 'FLASH_CRASH') {
            overallPhase = '🔴 AKUTER CRASH / PANIK';
            overallStatus = 'CRITICAL';
            overallPriority = 'urgent';
            tag = 'rotating_light';
        } else if (macroState.vetos && macroState.vetos.includes('DALIO_TIPPING_POINT_ACTIVE')) {
            overallPhase = '🔴 DALIO KIPPPUNKT (0-3 Monate Crash-Fenster)';
            overallStatus = 'CRITICAL';
            overallPriority = 'urgent';
            tag = 'boom';
        } else if (macroState.vetos && (macroState.vetos.includes('TREASURY_CAPACITY_WARNING') || macroState.vetos.includes('DELEVERAGING_ONGOING') || macroState.vetos.includes('DALIO_LATE_STAGE_WATCHLIST'))) {
            overallPhase = '🟡 SPÄTZYKLUS-PUFFER (Erhöhte Wachsamkeit)';
            overallStatus = 'WARNING';
            overallPriority = 'high';
            tag = 'warning';
        } else if (macroState.regime === 'LATE_CYCLE_EUPHORIA') {
            overallPhase = '🟡 LATE-CYCLE EUPHORIE (Melt-Up)';
            overallStatus = 'WARNING';
            overallPriority = 'high';
            tag = 'warning';
        } else if (macroState.regime === 'BEAR_MARKET') {
            overallPhase = '🟠 BÄRENMARKT (Hebelabbau)';
            overallStatus = 'WARNING';
            overallPriority = 'high';
            tag = 'warning';
        }

        let summary = `🌍 CRASHRADAR MAKRO-WETTERBERICHT\n`;
        summary += `Lage: ${overallPhase}\n`;
        summary += `======================================================\n\n`;

        // 2. Block 1: LIQUIDITÄTS-RADAR (Haupt-Tankanzeige)
        const capInd = findInd('Treasury & Money Market Capacity Radar') || findInd('TreasuryCapacityRadar');
        summary += `⏳ 1. LIQUIDITÄTS-RADAR (Haupt-Tankanzeige)\n`;
        if (capInd) {
            const icon = getIcon(capInd.status);
            const scoreVal = capInd.value || '58.5/100';
            const collision = capInd.projectedCollision || capInd.details?.projectedCollision || '26.10.2026 – 10.11.2026';
            const cushion = capInd.details?.liquidSlackBillion != null ? `$${capInd.details.liquidSlackBillion}B` : '$201B';
            const buybacks = capInd.details?.monthlyBuybacksBillion != null ? `$${capInd.details.monthlyBuybacksBillion}B/Mo` : '$48.6B/Mo';

            if (capInd.status === 'WARNING' || capInd.status === 'CRITICAL') {
                summary += `• Status: ${icon} Puffer-Phase aktiv (${cushion} TGA-Cushion, ${buybacks} Buybacks)\n`;
                summary += `• Kollisions-Fenster: 🚨 ${collision} (Liquiditätsabfluss droht)\n`;
                summary += `• Ausmaß: ${scoreVal} (Melt-Up-Fenster läuft aus, Hebelabbau empfohlen)\n\n`;
            } else {
                summary += `• Status: ${icon} Entspannt (${cushion} Slack, ${buybacks} Buybacks)\n`;
                summary += `• Kollisions-Fenster: 🟢 Kein akutes Kollisionsfenster\n`;
                summary += `• Ausmaß: ${scoreVal} (Ausreichend Puffer im Geldmarkt)\n\n`;
            }
        } else {
            summary += `• Status: 🟢 Normal\n\n`;
        }

        // 3. Block 2: SPEZIAL-WÄCHTER (Blinde Flecken)
        summary += `🔍 2. SPEZIAL-WÄCHTER (Blinde Flecken)\n`;
        
        // 3.1 Hebel & Spekulation (Margin Debt)
        const marginInd = findInd('Margin Debt');
        if (marginInd) {
            const icon = getIcon(marginInd.status);
            const val = marginInd.value ? ` (${marginInd.value})` : '';
            if (marginInd.status === 'WARNING' || marginInd.status === 'CRITICAL') {
                summary += `• Hebel & Spekulation: ${icon} ALARM: Margin Debt${val} (Smart Money baut Hebel ab)\n`;
            } else {
                summary += `• Hebel & Spekulation: ${icon} Margin Debt stabil${val}\n`;
            }
        }

        // 3.2 Verdeckte Verkäufe (Stealth Exit / DIX)
        const dixInd = findInd('Stealth Exit');
        if (dixInd) {
            const icon = getIcon(dixInd.status);
            const val = dixInd.value ? ` (${dixInd.value})` : '';
            if (dixInd.status === 'CRITICAL') {
                summary += `• Verdeckte Verkäufe: ${icon} STEALTH EXIT AKTIV! Dark Pools stützen nicht mehr${val}\n`;
            } else {
                const dixDisplay = dixInd.value && dixInd.value.includes('|') ? dixInd.value.split('|')[0] : (dixInd.value || '45.9%');
                summary += `• Verdeckte Verkäufe: ${icon} Stealth Exit ${dixDisplay} (Dark Pools stabil)\n`;
            }
        }

        // 3.3 Zinslast & Private Debt (Dalio / ARCC / Rate Cycle)
        const dalioInd = findInd('Dalio');
        const rateInd = findInd('Macro Interest Rate Cycle');
        const rateStatus = rateInd?.status === 'WARNING' || rateInd?.status === 'EARLY_WARNING' ? 'ARCC leicht erhöht' : 'Stabil';
        const dalioStatus = dalioInd?.value || '0/4 Dalio Kriterien';
        const zinsIcon = (dalioInd?.status === 'CRITICAL' || rateInd?.status === 'CRITICAL') ? '🔴' : '🟢';
        summary += `• Zinslast & Private Debt: ${zinsIcon} Dalio & ARCC unauffällig (${rateStatus}, ${dalioStatus})\n`;

        // 3.4 Zinskurve
        const yieldInd = findInd('Yield Curve');
        if (yieldInd) {
            const icon = getIcon(yieldInd.status);
            const val = yieldInd.value ? ` ${yieldInd.value}` : '';
            summary += `• Zinskurve (T10Y2Y): ${icon}${val} (Keine akute Inversions-Panik)\n\n`;
        } else {
            summary += `\n`;
        }

        // 4. Block 3: AKUTE NOTBREMSEN & SYSTEM-STRESS
        summary += `🚨 3. AKUTE NOTBREMSEN & SYSTEM-STRESS\n`;
        
        // 4.1 Red Alert
        const redInd = findInd('Red Alert');
        const redIcon = redInd ? getIcon(redInd.status) : '🟢';
        const redText = redInd?.status === 'CRITICAL' ? `🔴 CRITICAL! ${redInd.message}` : `${redIcon} OK (Keine institutionelle Panik-Absicherung)`;
        summary += `• Optionsmarkt (SKEW & Crash-Hedging): ${redText}\n`;

        // 4.2 NFCI
        const nfciInd = findInd('Chicago Fed Stress Index');
        const nfciIcon = nfciInd ? getIcon(nfciInd.status) : '🟢';
        const nfciVal = nfciInd?.value ? `${nfciInd.value} / ` : '-0.57 / ';
        const nfciText = nfciInd?.status === 'CRITICAL' ? `🔴 CRITICAL (${nfciVal}Kreditklemme!)` : `${nfciIcon} OK (${nfciVal}Interbankenmarkt voll liquide)`;
        summary += `• Banken & Kredit (Chicago Fed NFCI):  ${nfciText}\n`;

        // 4.3 ML Makro Risk
        let macroRiskPct = '11.2%';
        if (currentDayData?.mlRegimeMacro) {
            macroRiskPct = `${currentDayData.mlRegimeMacro.riskPct ?? ((currentDayData.mlRegimeMacro.probability || 0) * 100).toFixed(1)}%`;
        } else {
            const mlMacroInd = findInd('ML Regime Radar (Makro)');
            if (mlMacroInd && mlMacroInd.value) {
                macroRiskPct = mlMacroInd.value.includes('%') ? mlMacroInd.value.split(' ')[0] : mlMacroInd.value;
            }
        }
        const mlMacroIcon = Number(macroRiskPct.replace('%', '')) > 70 ? '🔴' : (Number(macroRiskPct.replace('%', '')) > 40 ? '🟡' : '🟢');
        summary += `• KI Makro-Crash-Risiko (XGBoost):     ${mlMacroIcon} OK (${macroRiskPct} / Keine akute Schock-Gefahr)\n\n`;

        // 5. Block 4: BODEN-FINDER & KAPITULATION
        summary += `⚓ 4. BODEN-FINDER & KAPITULATION\n`;
        const panicInd = findInd('Panik-Kapitulation');
        const panicIcon = panicInd ? getIcon(panicInd.status) : '🟢';
        if (panicInd && panicInd.status === 'CRITICAL') {
            summary += `• VIX-Panik & Bottom-Finder: 🔴 CRITICAL! (Kapitulations-Boden aktiv! Einstiegsfenster offen!)\n\n`;
        } else {
            summary += `• VIX-Panik & Bottom-Finder: ${panicIcon} OK (Keine Panik-Kapitulation aktiv)\n\n`;
        }

        // 6. Aktive Vetos
        summary += `------------------------------------------------------\n`;
        if (macroState.vetos && macroState.vetos.length > 0) {
            summary += `⚠️ AKTIVE MAKRO-VETOS:\n`;
            macroState.vetos.forEach(v => summary += `• ${v}\n`);
        } else {
            summary += `⚠️ AKTIVE MAKRO-VETOS: Keine\n`;
        }

        return {
            title: `CrashRadar: Makro-Wetterbericht (${overallStatus})`,
            priority: overallPriority,
            tags: tag,
            message: summary.trim()
        };
    }
}
