import YahooFinance from 'yahoo-finance2';
import { Logger } from '../../Logger.js';
const yahooFinance = new YahooFinance();

export class YahooFinanceFetchAdapter {
  async fetch(task, provider, startValue) {
    if (task.method === 'options') {
      Logger.info(`[YahooFinanceFetchAdapter] Fetching Options Chain for ${task.ticker}...`);
      const result = await yahooFinance.options(task.ticker);
      if (!result.options || result.options.length === 0) return { quotes: [] };
      
      let allCalls = [];
      let allPuts = [];
      for (const chain of result.options) {
         allCalls.push(...(chain.calls || []));
         allPuts.push(...(chain.puts || []));
      }
      
      const maxCall = allCalls.sort((a,b) => (b.openInterest || 0) - (a.openInterest || 0))[0];
      const maxPut = allPuts.sort((a,b) => (b.openInterest || 0) - (a.openInterest || 0))[0];
      
      if (!maxCall || !maxPut) return { quotes: [] };
      
      const today = new Date().toISOString().split('T')[0];
      return { 
        quotes: [{
          date: today,
          ticker: task.ticker,
          call_wall_strike: maxCall.strike,
          call_wall_oi: maxCall.openInterest,
          put_wall_strike: maxPut.strike,
          put_wall_oi: maxPut.openInterest
        }]
      };
    }

    if (task.method === 'fundamentals') {
      Logger.info(`[YahooFinanceFetchAdapter] Fetching Fundamentals TimeSeries for ${task.ticker}...`);
      
      let timeSeries = [];
      try {
          timeSeries = await yahooFinance.fundamentalsTimeSeries(task.ticker, { period1: '2010-01-01', module: 'all' });
      } catch (err) {
          Logger.error(`[YahooFinanceFetchAdapter] Error fetching fundamentalsTimeSeries for ${task.ticker}: ${err.message}`);
      }
      
      let instOwn = 0;
      try {
        const quote = await yahooFinance.quoteSummary(task.ticker, { modules: ['majorHoldersBreakdown'] });
        instOwn = quote?.majorHoldersBreakdown?.institutionsPercentHeld || 0;
      } catch (err) {
        Logger.error(`[YahooFinanceFetchAdapter] Failed to fetch quoteSummary for ${task.ticker}: ${err.message}`);
      }
      
      const rawQuotes = timeSeries.map(item => {
        let dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        
        const isAnnual = item.periodType === '12M' || item.periodType === '1Y' || String(item.periodType).toUpperCase() === 'ANNUAL';
        const p = isAnnual ? '12M' : '3M';

        const opIncome = item.operatingIncome ?? item.ebit ?? null;
        const depAmort = item.depreciationAndAmortization ?? 
                         item.reconciledDepreciation ?? 
                         item.depreciationAmortizationDepletion ?? 
                         item.depreciation ?? 
                         null;

        let calculatedEbitda = null;
        if (opIncome !== null && depAmort !== null && !isNaN(opIncome) && !isNaN(depAmort)) {
          calculatedEbitda = Math.round(Number(opIncome) + Math.abs(Number(depAmort)));
        }

        const rawEbitda = (item.ebitda === 0 || item.ebitda == null || isNaN(item.ebitda)) ? null : item.ebitda;

        return {
          ticker: task.ticker,
          date: dateStr,
          period: p,
          shareIssued: item.shareIssued || item.ordinarySharesNumber || null,
          freeCashFlow: item.freeCashFlow || null,
          totalRevenue: item.totalRevenue || item.operatingRevenue || null,
          netIncome: item.netIncome || item.netIncomeCommonStockholders || item.netIncomeFromContinuingOperations || null,
          financingCashFlow: item.financingCashFlow || null,
          inventory: item.inventory || null,
          cogs: item.costOfRevenue || null,
          cash_and_cash_equivalents: item.cashAndCashEquivalents || null,
          total_debt: item.totalDebt || null,
          short_term_debt: item.currentDebt || null,
          ebitda: rawEbitda ?? calculatedEbitda,
          interest_expense: item.interestExpense || null,
          stock_based_compensation: item.stockBasedCompensation || null,
          institutional_ownership: instOwn || null,
          operating_cash_flow: item.operatingCashFlow ?? null,
          gross_profit: item.grossProfit ?? null,
          eps: item.dilutedEPS ?? item.basicEPS ?? null,
          yoy_revenue_growth_pct: null
        };
      });

      rawQuotes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const quarterlyQuotes = rawQuotes.filter(q => q.period === '3M');
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      for (let i = 0; i < quarterlyQuotes.length; i++) {
        const current = quarterlyQuotes[i];
        const currentDateMs = new Date(current.date).getTime();
        
        let past = null;
        for (let j = i - 1; j >= 0; j--) {
          const candidate = quarterlyQuotes[j];
          const candidateDateMs = new Date(candidate.date).getTime();
          const diffDays = (currentDateMs - candidateDateMs) / oneDayMs;
          
          if (diffDays >= 320 && diffDays <= 410) {
            past = candidate;
            break;
          }
          if (diffDays > 410) {
            break;
          }
        }
        
        if (past && current.totalRevenue !== null && past.totalRevenue !== null && past.totalRevenue !== 0) {
          const growth = ((current.totalRevenue - past.totalRevenue) / Math.abs(past.totalRevenue)) * 100;
          current.yoy_revenue_growth_pct = Number(growth.toFixed(4));
        }
      }

      const annualQuotes = rawQuotes.filter(q => q.period === '12M');
      const quotes = [...quarterlyQuotes, ...annualQuotes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return { quotes };
    }

    if (startValue) {
      let dateToCheck = String(startValue);
      // Wenn es ein YYYY-MM-DD String ist, als UTC Mitternacht interpretieren
      if (!dateToCheck.includes('T') && isNaN(Number(dateToCheck))) {
        dateToCheck += 'T00:00:00.000Z';
      } else if (!isNaN(Number(dateToCheck))) {
        // Fallback falls Unix-Timestamp in ms
        dateToCheck = Number(dateToCheck);
      }
      
      const startDate = new Date(dateToCheck);
      const now = new Date(Date.now());
      const currentDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      if (!isNaN(startDate.getTime()) && startDate > currentDateUTC) {
        Logger.info(`[YahooFinanceFetchAdapter] Skipping ${task.ticker} as startValue (${startValue}) is in the future.`);
        return [];
      }
    }

    const options = task.options || {};
    options[provider.pagination?.startParam || 'period1'] = startValue;
    return await yahooFinance[task.method](task.ticker, options);
  }
}
