import fs from 'fs';

const html = fs.readFileSync('data/cache/turnarounds/sofi_10q_20260630.htm', 'utf8');
const start = 3110686;
const chunk = html.substring(start, start + 300000);

const regex = /name="([^"]+)"[^>]*>([^<]+)<\/ix:nonFraction>/g;
const matches = [];
let m;
while ((m = regex.exec(chunk)) !== null) {
  matches.push({ name: m[1], val: m[2].trim() });
}

console.log("Total matches found:", matches.length);

const revMatches = matches.filter(x => x.name.includes('RevenuesNetOfInterestExpense'));
console.log('\n--- RevenuesNetOfInterestExpense (groups of 6: Lending, Tech, FinServ, TotalSeg, Corp, TotalNet) ---');
for (let i = 0; i < revMatches.length; i += 6) {
  const g = revMatches.slice(i, i + 6).map(x => x.val);
  console.log(`Table ${i/6}: Lending=${g[0]}, Tech=${g[1]}, FinServ=${g[2]}, TotalSeg=${g[3]}, Corp=${g[4]}, Total=${g[5]}`);
}

const profitMatches = matches.filter(x => x.name.includes('ContributionProfitLoss'));
console.log('\n--- ContributionProfitLoss (groups of 4: Lending, Tech, FinServ, TotalSeg) ---');
for (let i = 0; i < profitMatches.length; i += 4) {
  const g = profitMatches.slice(i, i + 4).map(x => x.val);
  console.log(`Table ${i/4}: Lending=${g[0]}, Tech=${g[1]}, FinServ=${g[2]}, TotalSeg=${g[3]}`);
}
