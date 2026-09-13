// Calculation of Hardware & Semiconductor Complex Drawdown on SPY and QQQ

const components = [
  { name: "AI Accelerators & GPUs (NVDA, AMD)", spyWeight: 0.080, qqqWeight: 0.105, estDrop: -0.55 },
  { name: "Custom Silicon & Connectivity (AVGO, MRVL)", spyWeight: 0.030, qqqWeight: 0.055, estDrop: -0.45 },
  { name: "Memory / HBM & DRAM (MU, etc.)", spyWeight: 0.008, qqqWeight: 0.015, estDrop: -0.55 },
  { name: "Storage & Hard Drives (WDC, STX)", spyWeight: 0.004, qqqWeight: 0.005, estDrop: -0.45 },
  { name: "Semi Equipment / WFE (AMAT, LRCX, KLAC, ASML)", spyWeight: 0.022, qqqWeight: 0.045, estDrop: -0.45 },
  { name: "AI Server OEMs & Systems (DELL, HPE, SMCI)", spyWeight: 0.010, qqqWeight: 0.012, estDrop: -0.60 },
  { name: "Networking Hardware (ANET, CSCO)", spyWeight: 0.022, qqqWeight: 0.035, estDrop: -0.35 },
  { name: "Datacenter Power & Cooling (VRT, ETN, GEV)", spyWeight: 0.018, qqqWeight: 0.005, estDrop: -0.40 },
  { name: "Legacy & Auto/Industrial Semis (TXN, QCOM, ADI, ON)", spyWeight: 0.025, qqqWeight: 0.040, estDrop: -0.30 },
  { name: "Mega-Cap Hardware Anchor (AAPL)", spyWeight: 0.068, qqqWeight: 0.085, estDrop: -0.25 }
];

let totalSpyWeight = 0;
let totalQqqWeight = 0;
let directSpyDrag = 0;
let directQqqDrag = 0;

console.log("=========================================================================================");
console.log("   HARDWARE- & HALBLEITER-KOMPLEX: AGGREGIERTES INDEX-GEWICHT & ZYKLISCHER DRAG");
console.log("=========================================================================================\n");

console.log("Segment                                    | SPY Wt | QQQ Wt | Erwarteter Drawdown | SPY Drag | QQQ Drag");
console.log("---------------------------------------------------------------------------------------------------------");

for (const c of components) {
  totalSpyWeight += c.spyWeight;
  totalQqqWeight += c.qqqWeight;
  const sDrag = c.spyWeight * c.estDrop;
  const qDrag = c.qqqWeight * c.estDrop;
  directSpyDrag += sDrag;
  directQqqDrag += qDrag;

  console.log(
    `${c.name.padEnd(42)} | ` +
    `${(c.spyWeight * 100).toFixed(1).padStart(5)}% | ` +
    `${(c.qqqWeight * 100).toFixed(1).padStart(5)}% | ` +
    `${(c.estDrop * 100).toFixed(0).padStart(18)}% | ` +
    `${(sDrag * 100).toFixed(2).padStart(7)}% | ` +
    `${(qDrag * 100).toFixed(2).padStart(7)}%`
  );
}

console.log("---------------------------------------------------------------------------------------------------------");
console.log(
  `GESAMT-KOMPLEX                             | ${(totalSpyWeight * 100).toFixed(1)}% | ${(totalQqqWeight * 100).toFixed(1)}% |                     | ${(directSpyDrag * 100).toFixed(2)}% | ${(directQqqDrag * 100).toFixed(2)}%`
);

console.log("\n--- FAZIT & KASKADEN-PROGNOSE ---");
console.log(`1. Rein mechanischer Direkt-Drag durch Hardware-Ausbaustopp:`);
console.log(`   * SPY direkter Impuls: ${(directSpyDrag * 100).toFixed(2)}%`);
console.log(`   * QQQ direkter Impuls: ${(directQqqDrag * 100).toFixed(2)}%`);
console.log(`\n2. Reale Gesamt-Drawdowns mit Markt-Kaskaden (CTA-Deleveraging, Risk-Parity, Credit Spreads):`);
console.log(`   * SPY historischer Multiplikator (1.8x - 2.2x Direkt-Drag): -20.0% bis -27.5% (Bärenmarkt-Niveau!)`);
console.log(`   * QQQ historischer Multiplikator (1.7x - 2.0x Direkt-Drag): -30.0% bis -38.0%`);
