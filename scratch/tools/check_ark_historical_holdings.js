import fs from 'fs';

async function testArk13F() {
    console.log("================================================================================");
    console.log("   PRÜFE HISTORISCHE ARK 13F-BESTÄNDE (2016-12-31)");
    console.log("================================================================================\n");

    const url = 'https://www.sec.gov/Archives/edgar/data/1697748/000114036117006197/form13fInfoTable.xml';
    const res = await fetch(url, {
        headers: { 'User-Agent': 'CrashRadar Research research@crashradar.org' }
    });

    const xml = await res.text();
    console.log(`- XML geladen (${xml.length} Bytes).`);

    const tableMatches = xml.match(/<infoTable>[\s\S]*?<\/infoTable>/gi) || [];
    console.log(`- ${tableMatches.length} Positionen im Filing gefunden.`);

    const holdings = [];
    for (const r of tableMatches) {
        const name = /<nameOfIssuer>([^<]+)<\/nameOfIssuer>/i.exec(r)?.[1];
        const cusip = /<cusip>([^<]+)<\/cusip>/i.exec(r)?.[1];
        const val = /<value>([^<]+)<\/value>/i.exec(r)?.[1];
        const shares = /<sshPrnamt>([^<]+)<\/sshPrnamt>/i.exec(r)?.[1];
        if (name) holdings.push({ name, cusip, shares, val });
    }

    console.log("\nTop-Positionen von Cathie Wood am 31.12.2016 (Form 13F):");
    holdings.sort((a, b) => (parseInt(b.val) || 0) - (parseInt(a.val) || 0));
    for (const h of holdings.slice(0, 30)) {
        console.log(`  * ${h.name.padEnd(35)} | $ ${(parseInt(h.val) * 1000).toLocaleString('en-US').padStart(12)} | ${parseInt(h.shares).toLocaleString('en-US').padStart(10)} Shares`);
    }
}

testArk13F().catch(console.error);
