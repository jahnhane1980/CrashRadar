import { StandardRunner } from './StandardRunner.js';

export class TestRunner extends StandardRunner {
  async run() {
    console.log('\n[INFO] RUNNING IN TEST MODE (--test)');
    return super.run();
  }

  getDatabaseUrl() {
    const testUrl = process.env.DATABASE_URL_TEST;
    if (!testUrl) {
      console.warn('[Warn] DATABASE_URL_TEST nicht gefunden. Verwende reguläre DATABASE_URL als Fallback!');
      return process.env.DATABASE_URL;
    }
    console.log('[INFO] Verwende TEST Datenbank:', testUrl.split('@')[1] || testUrl); // Versteckt das Passwort im Log
    return testUrl;
  }

  loadFetcherConfig() {
    const config = super.loadFetcherConfig();
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    config.globalStartDate = threeDaysAgo.toISOString().split('T')[0];
    console.log(`[INFO] Overriding globalStartDate to: ${config.globalStartDate} (3 days ago)`);
    
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
