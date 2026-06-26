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
  async getDailyGroupedData(startDate) {
    if (!startDate) throw new Error("startDate is required");

    // 1. Raw-Daten holen
    const rawData = await this.repo.getAllRawData(startDate);

    // 2. Timeline aufbauen
    const timeline = TimeSeriesService.buildTimeline(rawData);
    const dates = Object.keys(timeline).sort();

    // 3. Initialen Status für das Forward-Fill laden
    const state = await this.repo.getInitialState(startDate);

    const finalData = [];

    // 4. Forward-Fill State & Mapping
    for (const date of dates) {
      Object.assign(state, timeline[date]);

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
          QQQ: state.QQQ,
          BTC: state.BTC,
          TLT: state.TLT,
          Gold: state.Gold,
          Copper: state.Copper,
          VIX: state.VIX,
          HYG: state.HYG
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
            ChicagoFedIndex: state.NFCI
          },
          BankingHealth: {
            TotalReserves: state.TOTRESNS,
            EmergencyBorrowing: state.BORROW
          },
          YieldCurve: {
            Spread10y2y: state.T10Y2Y
          },
          Leading: {
            SahmRule: state.SAHMREALTIME,
            MaturityWallPct: maturityWallPct,
            BuildingPermits: state.PERMIT,
            ConsumerSentiment: state.UMCSENT,
            M2: state.M2SL,
            CorporateProfits: state.CP,
            BreakevenInflation: state.T10YIE,
            EcbAssets: state.ECBASSETSW
          },
          Contemporaneous: {
            IndustrialProduction: state.INDPRO,
            InitialClaims: state.ICSA
          }
        }
      });
    }

    return finalData;
  }
}
