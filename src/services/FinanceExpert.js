import { AnalysisRepository } from '../core/repositories/AnalysisRepository.js';
import { TimeSeriesService } from './TimeSeriesService.js';

export class FinanceExpert {
  constructor(databaseUrlOrRepo) {
    if (typeof databaseUrlOrRepo === 'string' || !databaseUrlOrRepo) {
      this.repo = new AnalysisRepository(databaseUrlOrRepo);
    } else {
      this.repo = databaseUrlOrRepo;
    }
  }

  async close() {
    if (this.repo && typeof this.repo.close === 'function') {
      await this.repo.close();
    }
  }

  /**
   * Orchestriert das Laden der Rohdaten, das Forward-Fill (Lücken füllen)
   * und das finale Mapping auf das Makro-Ökonomische Modell.
   */
  async getDailyGroupedData(startDate, options = { bypassMemoryGuard: false }) {
    if (!startDate) throw new Error("startDate is required");

    let actualStartDate = startDate;

    if (!options.bypassMemoryGuard) {
      // Memory Guard: Lade maximal 1.5 Jahre an Daten in den RAM, um OOM 
      // bei sehr weit zurückliegenden globalStartDates (z.B. 1999) zu verhindern.
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      d.setMonth(d.getMonth() - 6);
      const limitDateStr = d.toISOString().split('T')[0];
      
      actualStartDate = startDate < limitDateStr ? limitDateStr : startDate;
    }

    // 1. Raw-Daten holen
    const rawData = await this.repo.getAllRawData(actualStartDate);

    // 2. Timeline aufbauen
    const timeline = TimeSeriesService.buildTimeline(rawData);
    const dates = Object.keys(timeline).sort();

    // 3. Initialen Status für das Forward-Fill laden
    const state = await this.repo.getInitialState(startDate);

    const finalData = [];
    const lastUpdatedDates = {
      AAII_Spread: null,
      SPY_ShortVolumeRatio: null,
      TotalPCR: null,
      SKEW: null
    };

    const getDiffDays = (d1Str, d2Str) => {
      if (!d1Str || !d2Str) return Infinity;
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      return Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
    };

    // 4. Forward-Fill State & Mapping
    for (const date of dates) {
      const currentTimeline = timeline[date] || {};
      Object.assign(state, currentTimeline);

      // Stale-Handling (max. 8 Tage Gültigkeit für wöchentliche/verzögerte Daten)
      const periodicFields = ['AAII_Spread', 'SPY_ShortVolumeRatio', 'TotalPCR', 'SKEW'];
      for (const field of periodicFields) {
        if (currentTimeline[field] !== undefined && currentTimeline[field] !== null) {
          lastUpdatedDates[field] = date;
        } else if (lastUpdatedDates[field] && getDiffDays(date, lastUpdatedDates[field]) > 8) {
          state[field] = null;
        }
      }

      const netLiquidity = (state.WALCL !== null && state.TGA !== null && state.RRPONTSYD !== null)
        ? (state.WALCL - state.TGA - state.RRPONTSYD)
        : null;

      const maturityWallPct = (state.MaturityWall90d && state.M2SL) 
        ? (state.MaturityWall90d / state.M2SL) * 100 
        : null;

      finalData.push({
        date,
        assets: {
          SPY: state.SPY,
          SPY_Volume: state.SPY_Volume,
          QQQ: state.QQQ,
          QQQ_Volume: state.QQQ_Volume,
          BTC: state.BTC,
          BTC_Volume: state.BTC_Volume,
          BTC_High: state.BTC_High,
          BTC_Low: state.BTC_Low,
          MSTR: state.MSTR,
          MSTR_Volume: state.MSTR_Volume,
          COIN: state.COIN,
          COIN_Volume: state.COIN_Volume,
          TLT: state.TLT,
          Gold: state.Gold,
          Gold_Volume: state.Gold_Volume,
          GDX: state.GDX,
          GDX_Volume: state.GDX_Volume,
          Copper: state.Copper,
          VIX: state.VIX,
          HYG: state.HYG,
          BIZD: state.BIZD,
          BKLN: state.BKLN,
          CBOE_SPY: state.CBOE_SPY,
          AAII_Spread: state.AAII_Spread,
          DIX: state.DIX,
          SKEW: state.SKEW,
          SPY_ShortVolumeRatio: state.SPY_ShortVolumeRatio,
          TotalPCR: state.TotalPCR
        },
        macroGroups: {
          NetLiquidity: {
            NetLiquidity: netLiquidity,
            WALCL: state.WALCL,
            TGA: state.TGA,
            RRPONTSYD: state.RRPONTSYD
          },
          FinancialConditions: {
            DXY: state.DXY,
            RealYield10y: state.DFII10,
            FedFundsRate: state.DFF,
            ChicagoFedIndex: state.NFCI
          },
          BankingHealth: {
            TotalReserves: state.TOTRESNS,
            BankReserves: state.WRESBAL,
            EmergencyBorrowing: state.BORROW
          },
          YieldCurve: {
            Spread10y2y: state.T10Y2Y
          },
          Leading: {
            SahmRule: state.SAHMREALTIME,
            MaturityWallPct: maturityWallPct,
            MarginDebt: state.MarginDebt,
            BuildingPermits: state.PERMIT,
            ConsumerSentiment: state.UMCSENT,
            M2: state.M2SL,
            CorporateProfits: state.CP,
            BreakevenInflation: state.T10YIE,
            EcbAssets: state.ECBASSETSW,
            Challenger: state.Challenger
          },
          Contemporaneous: {
            IndustrialProduction: state.INDPRO,
            InitialClaims: state.ICSA
          },
          Fundamentals: {
            ARCC_InterestExpense: state.ARCC_InterestExpense,
            ARCC_TotalAssets: state.ARCC_TotalAssets,
            ARCC_NetIncome: state.ARCC_NetIncome
          },
          LaborMarket: {
            PAYEMS: state.PAYEMS,
            CE16OV: state.CE16OV,
            LNS12500000: state.LNS12500000,
            LNS12600000: state.LNS12600000,
            LNS12026619: state.LNS12026619,
            U6RATE: state.U6RATE
          },
          TreasuryCapacity: {
            GDP: state.GDP,
            THREEFYTP10: state.THREEFYTP10,
            USGSEC: state.USGSEC,
            SOFR: state.SOFR,
            IORB: state.IORB,
            WRMFSL: state.WRMFSL,
            AuctionBillsMio: state.AuctionBillsMio || 0,
            AuctionCouponsMio: state.AuctionCouponsMio || 0,
            AuctionDv01: state.AuctionDv01 || 0,
            BuybackMio: state.BuybackMio || 0,
            BuybackDv01: state.BuybackDv01 || 0
          }
        }
      });
    }

    return finalData;
  }
}
