import { Logger } from '../core/Logger.js';

export class StandardRunner {
  constructor({ config, storage, fetcher, maturityWallBuilder }) {
    this.config = config;
    this.storage = storage;
    this.fetcher = fetcher;
    this.maturityWallBuilder = maturityWallBuilder;
  }

  async run() {
    try {
      Logger.info('Starting fetch jobs...');
      await this.fetcher.runAllTasks();
      
      Logger.info('Updating Maturity Wall...');
      await this.maturityWallBuilder.build(this.config.globalStartDate || '2015-01-01');
      await this.maturityWallBuilder.close();

      Logger.info('All jobs completed.');
    } catch (error) {
      Logger.error('[Fatal Error] Execution failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.storage) {
      await this.storage.close();
      Logger.info('Database connection closed.');
      this.storage = null;
    }
  }
}
