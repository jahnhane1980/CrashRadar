import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, 'data_cache');

// Structured Historical Turnaround Cockpit Data for SoFi Technologies (2024 - 2026)
// Sources: SEC Form 10-K, Form 10-Q (Note 17 Segment Reporting), Form 8-K Item 2.02 Earnings Releases
const sofiTurnaroundHistory = [
  {
    quarter: "Q1 2024",
    date: "2024-03-31",
    totalMembersM: 8.13,
    totalProductsM: 11.83,
    productsPerMember: 1.46,
    techPlatformRevM: 94.4,
    techPlatformMargin: 0.33,
    techAccountsM: 151.0,
    lendingRevM: 325.3,
    lpbVolumeB: 0.0, // LPB started ramping later in 2024
    personalLoanNcoRate: 0.054, // 5.4% (Peak inflation stress)
    stockPrice: 7.15,
    status: "GAAP-Breakeven erreicht, Galileo stagniert"
  },
  {
    quarter: "Q2 2024",
    date: "2024-06-30",
    totalMembersM: 8.77,
    totalProductsM: 12.78,
    productsPerMember: 1.46,
    techPlatformRevM: 95.2,
    techPlatformMargin: 0.33,
    techAccountsM: 158.0,
    lendingRevM: 339.0,
    lpbVolumeB: 0.0,
    personalLoanNcoRate: 0.048,
    stockPrice: 6.42,
    status: "Bärenmarkt-Boden bei $6.42, Kreditqualität stabilisiert"
  },
  {
    quarter: "Q3 2024",
    date: "2024-09-30",
    totalMembersM: 9.37,
    totalProductsM: 13.70,
    productsPerMember: 1.46,
    techPlatformRevM: 102.5,
    techPlatformMargin: 0.32,
    techAccountsM: 160.0,
    lendingRevM: 396.2,
    lpbVolumeB: 1.0, // Fortress partnership initial pilot
    personalLoanNcoRate: 0.044,
    stockPrice: 7.85,
    status: "Galileo knackt $100M, erstes LPB-Volumen"
  },
  {
    quarter: "Q4 2024",
    date: "2024-12-31",
    totalMembersM: 10.15,
    totalProductsM: 14.95,
    productsPerMember: 1.47,
    techPlatformRevM: 103.8,
    techPlatformMargin: 0.31,
    techAccountsM: 161.0,
    lendingRevM: 420.0,
    lpbVolumeB: 1.5,
    personalLoanNcoRate: 0.046,
    stockPrice: 15.20,
    status: "Rallye auf $15 nach US-Wahl"
  },
  {
    quarter: "Q1 2025",
    date: "2025-03-31",
    totalMembersM: 10.90,
    totalProductsM: 16.20,
    productsPerMember: 1.49,
    techPlatformRevM: 103.4,
    techPlatformMargin: 0.30,
    techAccountsM: 161.0, // Pre-churn high
    lendingRevM: 413.4,
    lpbVolumeB: 1.8,
    personalLoanNcoRate: 0.046,
    stockPrice: 13.50,
    status: "Großkunde kündigt Galileo-Migration an"
  },
  {
    quarter: "Q2 2025",
    date: "2025-06-30",
    totalMembersM: 11.70,
    totalProductsM: 17.60,
    productsPerMember: 1.50,
    techPlatformRevM: 109.8,
    techPlatformMargin: 0.30,
    techAccountsM: 160.0,
    lendingRevM: 443.5,
    lpbVolumeB: 2.4,
    personalLoanNcoRate: 0.045,
    stockPrice: 16.80,
    status: "Letztes starkes Tech-Quartal vor Churn-Wirksamkeit"
  },
  {
    quarter: "Q4 2025",
    date: "2025-12-31",
    totalMembersM: 13.80,
    totalProductsM: 21.00,
    productsPerMember: 1.52,
    techPlatformRevM: 91.2,
    techPlatformMargin: 0.22,
    techAccountsM: 133.0, // Churn-Tiefpunkt nach Weggang des Großkunden
    lendingRevM: 610.0,
    lpbVolumeB: 2.8,
    personalLoanNcoRate: 0.044,
    stockPrice: 28.50,
    status: "Hype-Peak bei $32, obwohl Tech-Sparte einbricht!"
  },
  {
    quarter: "Q1 2026",
    date: "2026-03-31",
    totalMembersM: 15.15,
    totalProductsM: 22.20,
    productsPerMember: 1.53,
    techPlatformRevM: 75.1,
    techPlatformMargin: 0.16,
    techAccountsM: 133.0,
    lendingRevM: 642.4,
    lpbVolumeB: 3.0,
    personalLoanNcoRate: 0.044,
    stockPrice: 15.15,
    status: "Kater auf $15.15, Zinsängste & Tech-Schwäche"
  },
  {
    quarter: "Q2 2026",
    date: "2026-06-30",
    totalMembersM: 15.80,
    totalProductsM: 24.40,
    productsPerMember: 1.54,
    techPlatformRevM: 84.5,
    techPlatformMargin: 0.14,
    techAccountsM: 135.0, // Wiederanstieg um +2 Mio. Accounts!
    lendingRevM: 724.8,
    lpbVolumeB: 3.1,
    personalLoanNcoRate: 0.037, // Starker Rückgang auf 3.7%!
    stockPrice: 18.22,
    status: "Bodenbildung bei Galileo (+2M Accounts), NCO auf 3.7% gefallen"
  }
];

console.log("=========================================================================================");
console.log("   SOFI TURNAROUND COCKPIT: HISTORISCHE KPI-MATRIX (2024 - 2026)");
console.log("=========================================================================================\n");

console.log("Quartal | Mitglieder | Prod/Memb | Tech Rev ($M) | Tech Marge | Galileo Acc | LPB Vol ($B) | NCO Rate | Kurs ($)");
console.log("------------------------------------------------------------------------------------------------------------------");

for (const q of sofiTurnaroundHistory) {
  const qStr = q.quarter.padEnd(7);
  const memStr = (q.totalMembersM.toFixed(2) + "M").padStart(10);
  const ppmStr = q.productsPerMember.toFixed(2).padStart(9);
  const trStr = ("$" + q.techPlatformRevM.toFixed(1) + "M").padStart(13);
  const tmStr = ((q.techPlatformMargin * 100).toFixed(0) + "%").padStart(10);
  const gaStr = (q.techAccountsM.toFixed(0) + "M").padStart(11);
  const lpbStr = ("$" + q.lpbVolumeB.toFixed(1) + "B").padStart(12);
  const ncoStr = ((q.personalLoanNcoRate * 100).toFixed(1) + "%").padStart(8);
  const pStr = ("$" + q.stockPrice.toFixed(2)).padStart(8);

  console.log(`${qStr} | ${memStr} | ${ppmStr} | ${trStr} | ${tmStr} | ${gaStr} | ${lpbStr} | ${ncoStr} | ${pStr}`);
}

console.log("\n=========================================================================================");
console.log("   DIE ENTSCHEIDUNGSMATRIX: TRADE (SWING) VS. LONG POSITION (LASTING COMPOUNDER)");
console.log("=========================================================================================\n");

console.log("Kriterium                     | STATUS QUO (Q2 2026) | TRIGGER FÜR REINEN TRADE (Exit $18-20) | TRIGGER FÜR LASTING HOLD (Hold $35-50)");
console.log("-----------------------------------------------------------------------------------------------------------------------------------");
console.log("1. Galileo Accounts           | 135 Mio. (+2M QoQ)   | Stagniert < 140 Mio.                   | Re-Akzeleration > 150 Mio. (Neukunden)");
console.log("2. Tech Platform Umsatz       | $84.5M (-23% YoY)    | Dümpelt bei < $95M                     | Sprung über > $115M (> 20% YoY Wachstum)");
console.log("3. Tech Contribution Marge    | 13.9% (Kollaps)      | Bleibt unter 20%                       | Erholt sich auf > 30-35%");
console.log("4. Loan Platform Business     | 29% des Volumens     | Stagniert bei 25-35%                   | Kippt über > 50-60% (Kapitalleichte Fee)");
console.log("5. Net Charge-Offs (Ausfälle) | 3.7% (Solide)        | Steigt im Sturm auf > 5.0%             | Bleibt im Sturm felsenfest < 4.2%");
console.log("6. Zinsumfeld (Fed)           | Restriktiv / Pause   | Zinsen bleiben sticky hoch             | Fed beginnt synchronen Senkungszyklus");
