import { StandardRunner } from './StandardRunner.js';
import { Logger } from '../core/Logger.js';

export class TestRunner extends StandardRunner {
  async run() {
    Logger.info('\n[INFO] RUNNING IN TEST MODE (--test)');
    return super.run();
  }

  static getDatabaseUrl() {
    const testUrl = process.env.DATABASE_URL_TEST;
    if (!testUrl) {
      Logger.warn('[Warn] DATABASE_URL_TEST nicht gefunden. Verwende reguläre DATABASE_URL als Fallback!');
      return process.env.DATABASE_URL;
    }
    Logger.info('[INFO] Verwende TEST Datenbank:', testUrl.split('@')[1] || testUrl);
    return testUrl;
  }

  static applyTestConfigOverrides(config) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    config.globalStartDate = threeDaysAgo.toISOString().split('T')[0];
    Logger.info(`[INFO] Overriding globalStartDate to: ${config.globalStartDate} (3 days ago)`);
    
    if (config.providers) {
      for (const [pName, pConf] of Object.entries(config.providers)) {
        if (pConf.pagination && pConf.pagination.maxLimit) {
          pConf.pagination.maxLimit = Math.min(pConf.pagination.maxLimit, 5);
        }
        if (pConf.overrideStartDate) {
           pConf.overrideStartDate = config.globalStartDate;
        }
      }
    }
    
    if (config.tasks) {
       for (const task of config.tasks) {
         if (task.overrideStartDate) task.overrideStartDate = config.globalStartDate;
       }
    }
    return config;
  }
}
