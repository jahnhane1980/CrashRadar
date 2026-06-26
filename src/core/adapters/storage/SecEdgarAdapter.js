export class SecEdgarAdapter {
  getInsertQueryAndValues(task, data) {
    if (!data || data.length === 0) return { query: null, values: null };
    
    // data[0] contains the full SEC Edgar JSON response since we didn't specify an extract path
    const facts = data[0].facts;
    if (!facts || !facts['us-gaap']) return { query: null, values: null };

    const gaap = facts['us-gaap'];
    
    // Wir extrahieren die Daten quartalsweise. 
    // Struktur: { "2025-03-31": { interest_expense: 186000000, total_assets: ... } }
    const quarterlyData = {};

    // Hilfsfunktion zum Extrahieren und Mappen der Werte nach Quartalsende (end-date)
    const extractMetric = (gaapKey, dbField) => {
      if (gaap[gaapKey] && gaap[gaapKey].units && gaap[gaapKey].units['USD']) {
        const records = gaap[gaapKey].units['USD'];
        records.forEach(record => {
          // Wir interessieren uns primär für 10-Q (Quartal) und 10-K (Jahresbericht)
          if (record.form === '10-Q' || record.form === '10-K') {
            const endDate = record.end;
            if (!quarterlyData[endDate]) {
              quarterlyData[endDate] = {
                interest_expense: null,
                total_assets: null,
                net_income: null
              };
            }
            // Da SEC XBRL manchmal Year-to-Date anstatt diskrete Quartalswerte bei Q2/Q3 ausweist,
            // überschreiben wir im simplen Setup erstmal nur. Für perfekte Genauigkeit müsste man Differenzen bilden.
            quarterlyData[endDate][dbField] = record.val;
          }
        });
      }
    };

    extractMetric('InterestExpense', 'interest_expense');
    extractMetric('Assets', 'total_assets');
    extractMetric('NetIncomeLoss', 'net_income');

    const values = [];
    for (const [date, metrics] of Object.entries(quarterlyData)) {
      values.push([
        task.ticker, // z.B. ARCC
        date,
        metrics.interest_expense,
        metrics.total_assets,
        metrics.net_income
      ]);
    }

    if (values.length === 0) return { query: null, values: null };

    const query = `
      INSERT INTO fund_sec_edgar (ticker, record_date, interest_expense, total_assets, net_income)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        interest_expense = VALUES(interest_expense),
        total_assets = VALUES(total_assets),
        net_income = VALUES(net_income)
    `;

    return { query, values };
  }
}
