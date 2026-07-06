export class CbPolicyErrorIndicator {
    constructor() {
        this.name = '[MACRO] Central Bank Policy Error (DFF vs T10YIE vs DXY)';
        this.category = 'TRIGGER';
    }

    evaluate(timeline) {
        // Wir brauchen 60 Handelstage (~3 Monate)
        if (timeline.length < 60) return { status: 'UNKNOWN', message: 'Zu wenig Daten (< 60 Tage)' };
        
        const current = timeline[timeline.length - 1];
        const past = timeline[timeline.length - 60];
        
        const currentDFF = current.macroGroups?.FinancialConditions?.FedFundsRate;
        const pastDFF = past.macroGroups?.FinancialConditions?.FedFundsRate;
        
        const currentT10YIE = current.macroGroups?.Leading?.BreakevenInflation;
        const pastT10YIE = past.macroGroups?.Leading?.BreakevenInflation;

        const currentDXY = current.macroGroups?.FinancialConditions?.DXY;
        const pastDXY = past.macroGroups?.FinancialConditions?.DXY;

        if (currentDFF === undefined || pastDFF === undefined || currentDFF === null || pastDFF === null ||
            currentT10YIE === undefined || pastT10YIE === undefined || currentT10YIE === null || pastT10YIE === null ||
            currentDXY === undefined || pastDXY === undefined || currentDXY === null || pastDXY === null) {
            return { status: 'UNKNOWN', message: 'Keine Daten für FED Funds Rate, Inflation oder DXY' };
        }

        const dffChange = currentDFF - pastDFF;
        const t10yieChange = currentT10YIE - pastT10YIE;
        const dxyReturn = ((currentDXY - pastDXY) / pastDXY) * 100;

        // THRESHOLD: Leitzins sinkt um > 0.25%, Inflation steigt um > 0.10%
        if (dffChange < -0.25 && t10yieChange > 0.10) {
            // FILTER: Ein starker Dollar (> +2%) erstickt die Gold-Rallye
            if (dxyReturn > 2.0) {
                return { 
                    status: 'WARNING', 
                    value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}% / DXY +${dxyReturn.toFixed(1)}%`, 
                    message: `MACRO ALARM: Policy Error erkannt (Gefahr für Aktien), ABER starker US-Dollar blockiert Gold-Ausbruch.` 
                };
            }
            return { 
                status: 'CRITICAL', 
                value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}% / DXY ${dxyReturn.toFixed(1)}%`, 
                message: `MACRO ALARM: Fiat-Flucht detektiert. Erhöhtes Crash-Risiko für SPY/QQQ! (Hinweis: Für ein Gold-Investment auf separaten 'Healing'-Alarm warten).` 
            };
        } else if (dffChange < -0.10 && t10yieChange > 0.05) {
            return { 
                status: 'WARNING', 
                value: `DFF ${dffChange.toFixed(2)}% / T10YIE +${t10yieChange.toFixed(2)}%`, 
                message: 'MACRO WARNUNG: FED Zinsen sinken, während Inflationserwartung leicht steigt. Vertrauensverlust droht.' 
            };
        }
        
        return { status: 'OK', value: `DFF ${dffChange.toFixed(2)}%`, message: 'Geldpolitik im Einklang mit Inflationserwartungen.' };
    }
}
