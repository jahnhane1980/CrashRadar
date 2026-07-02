import fs from 'fs';

const lines = fs.readFileSync('scratch/btc_regimes_output.csv', 'utf8').split('\n').filter(l => l.trim() !== '');

let currentState = null;
let startDate = null;
let endDate = null;

let output = '| Von | Bis | Regime |\n|---|---|---|\n';

for(let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if(parts.length < 3) continue;
  
  const date = parts[0];
  const label = parts[2];
  
  if (label === 'UNKNOWN') continue; // Skip warmup

  if (label !== currentState) {
    if (currentState !== null) {
      output += `| ${startDate} | ${endDate} | **${currentState}** |\n`;
    }
    currentState = label;
    startDate = date;
  }
  endDate = date;
}

if (currentState !== null) {
  output += `| ${startDate} | ${endDate} | **${currentState}** |\n`;
}

console.log(output);
