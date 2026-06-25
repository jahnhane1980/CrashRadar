export class StandardRunner {
  constructor({ config, storage, fetcher, maturityWallBuilder }) {
    this.config = config;
    this.storage = storage;
    this.fetcher = fetcher;
    this.maturityWallBuilder = maturityWallBuilder;
  }

  async run() {
    try {
      console.log('Starting fetch jobs...');
      await this.fetcher.runAllTasks();
      
      console.log('Updating Maturity Wall...');
      await this.maturityWallBuilder.build(this.config.globalStartDate || '2015-01-01');
      await this.maturityWallBuilder.close();

      console.log('All jobs completed.');
    } catch (error) {
      console.error('[Fatal Error] Execution failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.storage) {
      await this.storage.close();
      console.log('Database connection closed.');
      this.storage = null;
    }
  }
}
