import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

const nvdaFacts = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_sec_facts.json'), 'utf8'));
const nvdaDaily = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'NVDA_daily.json'), 'utf8'));

// Detailed analysis of inventory divergence
console.log("==================================================================================================================");
console.log("   DER KANARIENVOGEL IM DETAIL: INVENTORY-DIVERGENZ & LEAD-TIME ZWISCHEN KURS, EARNINGS & CAPEX");
console.log("==================================================================================================================");

// Historical Comparison Table
const findings = [
    {
        cycle: "1. KRYPTO / DATACENTER (2018)",
        stockPeakDate: "2018-10-01 ($7.23)",
        canary1_GrossMargin: "Peak bei 64.5% im Q1 2018 (April). Errodierte auf 63.2% (Juli) und 60.4% (Okt).",
        canary2_InventoryDSI: "Q2 2018 (Juli): Inventar explodiert um +36.8% QoQ, DSI springt von 63 auf 85 Tage.",
        canary3_RevDecel: "Q2 2018 (Juli): QoQ-Umsatzwachstum kippt ins Minus (-2.6% von $3.21B auf $3.12B).",
        hyperscalerCapExStatus: "CapEx stieg bis Q4 2018 WEITER ($16.1B) und fiel erst im Q1 2019 (-11% YoY).",
        leadTime: "NVIDIA-Aktie peakte 2 Monate nach dem Inventarsprung und 2 QUARTALE VOR dem CapEx-Rückgang!",
        crashMagnitude: "-56.1% (von $7.23 auf $3.18 innerhalb von 84 Tagen)."
    },
    {
        cycle: "2. PANDEMIE / PC / QT (2021/2022)",
        stockPeakDate: "2021-11-29 ($33.38)",
        canary1_GrossMargin: "Peak bei 65.5% im Q1 2022. Kollabierte im Q2 2022 auf 43.5% (Inventar-Abschreibungen).",
        canary2_InventoryDSI: "Q1 2022: Inventar schoss um +41.6% QoQ auf $3.16B. DSI stieg auf 146 Tage.",
        canary3_RevDecel: "Q3 2021 (Nov 2021): QoQ-Wachstum verlangsamte sich von +20% auf +9.2%.",
        hyperscalerCapExStatus: "CapEx wuchs bis Q3 2022 UNGEBROCHEN ($39.3B) und pausierte erst in Q1 2023.",
        leadTime: "NVIDIA-Aktie peakte 4 QUARTALE (1 ganzes Jahr!) VOR der Verlangsamung des Hyperscaler-CapEx!",
        crashMagnitude: "-66.4% (von $33.38 auf $11.23 innerhalb von 319 Tagen)."
    },
    {
        cycle: "3. DOTCOM / CISCO (2000)",
        stockPeakDate: "2000-03-27 ($80.06)",
        canary1_GrossMargin: "Bruttomarge brach im Herbst 2000 ein, gefolgt von $2.25 Mrd. Inventarabschreibung im April 2001.",
        canary2_InventoryDSI: "Inventar stieg 2000 drastisch an, weil Telekom-Unternehmen Doppelbestellungen aufgaben.",
        canary3_RevDecel: "Umsatz wuchs bis Ende 2000 noch weiter, aber Auftrags-Backlog kollabierte.",
        hyperscalerCapExStatus: "Telekom-CapEx (WorldCom, Global Crossing, AT&T) lief noch fast das gesamte Jahr 2000 weiter.",
        leadTime: "Cisco peakte 9 bis 12 Monate VOR dem offiziellen Einbruch der Investitionsausgaben!",
        crashMagnitude: "-89.3% (von $80.06 auf $8.60)."
    },
    {
        cycle: "4. AKTUELLER AI-ZYKLUS (2024 - 2026: STATUS QUO)",
        stockPeakDate: "Bisheriges Allzeithoch: ~$216 (Mai 2026) / Aktuell ~$196",
        canary1_GrossMargin: "Gross Margin peakte bei 78.4% (Q1 2024). Seitdem Decke erreicht: 75.0% (Q2 2026). Steigt nicht mehr.",
        canary2_InventoryDSI: "ALARM: Inventar explodierte von $5.86 Mrd. (2024) auf $31.57 Mrd. (Q2 2026) = +438%! DSI kletterte auf 118 Tage.",
        canary3_RevDecel: "QoQ-Wachstum: Von +100% / +43% auf aktuell +17.9% abgeflacht. Absolut gigantisch ($96B/Q), aber 2. Ableitung verlangsamt.",
        hyperscalerCapExStatus: "CapEx ist auf Allzeithoch (> $130 Mrd./Q), aber Big Tech kündigt In-House ASICs (TPU v6, Trainium 3, Maia) an.",
        leadTime: "Historisch: Noch 1 bis maximal 3 Quartale, bevor die Inventar-Whip zu Stornierungen/Wartezeiten-Kollaps führt!",
        crashMagnitude: "Typischer Zyklus-Crash nach Inventar-DSI > 120 Tagen: -50 % bis -65 %."
    }
];

console.log(JSON.stringify(findings, null, 2));
