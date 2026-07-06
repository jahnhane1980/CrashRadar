import { SMA, RSI } from 'technicalindicators';

export class MathUtils {
    /**
     * Berechnet den Gleitenden Durchschnitt (SMA) für das Ende eines Arrays,
     * optional mit einem Offset (z.B. offset=1 für 'gestern').
     * @param {Array} timeline - Das volle Daten-Array
     * @param {Function} valueExtractor - Funktion, um den Wert zu extrahieren (z.B. t => t.assets.Gold)
     * @param {number} period - Die Länge des SMA (z.B. 50)
     * @param {number} offset - Abstand vom Ende (0 = heute, 1 = gestern)
     * @returns {number|null} Der SMA-Wert
     */
    static getSma(timeline, valueExtractor, period, offset = 0) {
        if (!timeline || timeline.length < period + offset) return null;
        
        // Wir schneiden die Timeline bis zum gewünschten Offset ab
        const slice = timeline.slice(0, timeline.length - offset);
        
        // Werte extrahieren
        const values = slice.map(valueExtractor).filter(v => v !== null && v !== undefined);
        
        if (values.length < period) return null;

        // Nutze technicalindicators
        const result = SMA.calculate({ period: period, values: values });
        return result.length > 0 ? result[result.length - 1] : null;
    }

    /**
     * Berechnet den RSI (Relative Strength Index) für den aktuellsten Zeitpunkt.
     * @param {Array} timeline - Das Daten-Array
     * @param {Function} valueExtractor - (z.B. t => t.assets.SPY)
     * @param {number} period - RSI-Periode (Standard: 14)
     * @returns {number|null}
     */
    static getRsi(timeline, valueExtractor, period = 14) {
        if (!timeline || timeline.length <= period) return null;
        
        const values = timeline.map(valueExtractor).filter(v => v !== null && v !== undefined);
        if (values.length <= period) return null;

        const result = RSI.calculate({ period: period, values: values });
        return result.length > 0 ? result[result.length - 1] : null;
    }

    /**
     * Berechnet den RSI für die gesamte Timeline und gibt ein Array zurück,
     * das mit null/0 gepaddet ist, sodass es exakt die gleiche Länge hat wie
     * die sauberen (gefilterten) Timeline-Daten.
     */
    static getRsiArray(timeline, valueExtractor, period = 14) {
        if (!timeline || timeline.length <= period) return [];
        const values = timeline.map(valueExtractor).filter(v => v !== null && v !== undefined);
        if (values.length <= period) return [];
        
        const rsiValues = RSI.calculate({ period: period, values: values });
        // Auffüllen am Anfang, da der RSI erst ab Tag 14 einen Wert hat
        const padding = new Array(values.length - rsiValues.length).fill(0);
        return [...padding, ...rsiValues];
    }

    /**
     * Berechnet den prozentualen Drawdown des aktuellen Werts zum Maximum 
     * innerhalb der letzten X Tage (lookback).
     * @param {Array} timeline 
     * @param {Function} valueExtractor 
     * @param {number} lookback - Suchfenster für das Maximum (z.B. 180)
     * @returns {number|null} Drawdown in Prozent (z.B. -5.0)
     */
    static getDrawdownFromMax(timeline, valueExtractor, lookback) {
        if (!timeline || timeline.length < lookback) return null;

        const currentDay = timeline[timeline.length - 1];
        const currentValue = valueExtractor(currentDay);
        if (currentValue === null || currentValue === undefined) return null;

        let max = -Infinity;
        const startIndex = timeline.length - lookback;
        
        for (let i = startIndex; i < timeline.length; i++) {
            const v = valueExtractor(timeline[i]);
            if (v !== null && v !== undefined && v > max) {
                max = v;
            }
        }

        if (max === -Infinity || max === 0) return 0;
        return ((currentValue - max) / max) * 100;
    }

    /**
     * Rate of Change (Prozentualer Unterschied) zwischen zwei Werten
     */
    static getRateOfChangePct(pastValue, currentValue) {
        if (pastValue === null || currentValue === null || pastValue === 0) return null;
        return ((currentValue - pastValue) / pastValue) * 100;
    }

    /**
     * Volumen-Multiplikator (Aktuelles Volumen geteilt durch Durchschnittsvolumen)
     */
    static getVolumeMultiplier(currentVol, avgVol) {
        if (!currentVol || !avgVol || avgVol === 0) return 0;
        return currentVol / avgVol;
    }

    /**
     * Hilfsfunktion: Berechnet den einfachen Durchschnitt einer Liste von Zahlen.
     * Wird verwendet für Climax-Volumen, wenn der simple Mittelwert ohne strict SMA benötigt wird.
     */
    static getAverage(values) {
        if (!values || values.length === 0) return 0;
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }

    /**
     * Berechnet den einfachen Durchschnitt (Average) für einen exakten Ausschnitt der Timeline.
     * Das repliziert genau die Logik der alten for-Schleifen.
     * @param {Array} timeline 
     * @param {Function} valueExtractor 
     * @param {number} lookback - Suchfenster (z.B. 50)
     * @param {number} offset - Abstand vom Ende (Standard 0)
     * @returns {number|null}
     */
    static getAverageForSlice(timeline, valueExtractor, lookback, offset = 0) {
        if (!timeline || timeline.length < lookback + offset) return null;
        let sum = 0, count = 0;
        const end = timeline.length - offset;
        const start = end - lookback;
        for (let i = start; i < end; i++) {
            const v = valueExtractor(timeline[i]);
            if (v !== null && v !== undefined && v > 0) {
                sum += v;
                count++;
            }
        }
        return count > 0 ? sum / count : null;
    }

    /**
     * Findet das Maximum in einem Suchfenster und gibt auch den relativen Index (Tage seit dem Hoch) zurück.
     * @returns {Object|null} { maxValue, daysAgo }
     */
    static getMaxWithIndex(timeline, valueExtractor, lookback) {
        if (!timeline || timeline.length < lookback) return null;
        let max = -Infinity;
        let maxIdx = -1;
        const startIndex = timeline.length - lookback;
        for (let i = startIndex; i < timeline.length; i++) {
            const v = valueExtractor(timeline[i]);
            if (v !== null && v !== undefined && v > max) {
                max = v;
                maxIdx = i;
            }
        }
        if (maxIdx === -1) return null;
        return { maxValue: max, daysAgo: (timeline.length - 1) - maxIdx };
    }
}
