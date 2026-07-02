import Database from 'better-sqlite3';

const db = new Database('./data/Liquidity.sqlite');

const q = `
  SELECT 
    strftime('%Y-%m', maturity_date) as maturity_month,
    security_type,
    SUM(total_accepted) as total_amount
  FROM fiscal_auctions
  WHERE maturity_date >= date('now') 
    AND maturity_date <= date('now', '+24 months')
  GROUP BY maturity_month, security_type
  ORDER BY maturity_month ASC
`;

const results = db.prepare(q).all();

let monthlyTotals = {};
results.forEach(r => {
    if (!monthlyTotals[r.maturity_month]) {
        monthlyTotals[r.maturity_month] = { total: 0, Bill: 0, Note: 0, Bond: 0, CMB: 0 };
    }
    const type = r.security_type.includes('Bill') ? 'Bill' : 
                 r.security_type.includes('Note') ? 'Note' : 
                 r.security_type.includes('Bond') ? 'Bond' : 
                 r.security_type.includes('Cash Management') ? 'CMB' : 'Other';
                 
    monthlyTotals[r.maturity_month][type] += r.total_amount || 0;
    monthlyTotals[r.maturity_month].total += r.total_amount || 0;
});

console.log("=== THE MATURITY WALL (Next 24 Months) ===");
console.log("Format: Year-Month | Total Maturing | (Bills / Notes / Bonds)\n");

for (const [month, data] of Object.entries(monthlyTotals)) {
    const totalB = (data.total / 1e9).toFixed(2); // Convert to Billions
    const billB = (data.Bill / 1e9).toFixed(2);
    const noteB = (data.Note / 1e9).toFixed(2);
    const bondB = (data.Bond / 1e9).toFixed(2);
    
    console.log(`${month} | $${totalB} Billion | (Bills: $${billB} B, Notes: $${noteB} B, Bonds: $${bondB} B)`);
}

const total12M = Object.entries(monthlyTotals)
    .filter(([month]) => month <= '2027-06') // 12 months from now
    .reduce((sum, [_, data]) => sum + data.total, 0);

console.log(`\n=> Total Debt maturing in the next 12 months: $${(total12M / 1e9).toFixed(2)} Billion`);
