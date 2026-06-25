import { Fetcher } from '../services/Fetcher.js';
import { Storage } from '../core/Storage.js';
import { RequestManager } from '../core/RequestManager.js';
import { MaturityWallBuilder } from '../services/MaturityWallBuilder.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export class StandardRunner {
  constructor() {
    this.globalStorage = null;
  }

  getDatabaseUrl() {
    return process.env.DATABASE_URL;
  }

  loadFetcherConfig() {
    const configPath = path.resolve(rootDir, 'config/Database-Fetcher-Config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Critical Config not found at ${configPath}. Exiting.`);
    }
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(rawConfig);
  }

  async run() {
    try {
      const dbUrl = this.getDatabaseUrl();
      if (!dbUrl) {
        throw new Error("Missing DATABASE_URL in environment.");
      }
      
      this.globalStorage = new Storage({ databaseUrl: dbUrl });

      const config = this.loadFetcherConfig();

      const requestManager = new RequestManager(config);
      const fetcher = new Fetcher(config, this.globalStorage, requestManager);

      console.log('Starting fetch jobs...');
      await fetcher.runAllTasks();
      
      console.log('Updating Maturity Wall...');
      const mwBuilder = new MaturityWallBuilder(dbUrl);
      await mwBuilder.build(config.globalStartDate || '2015-01-01');
      await mwBuilder.close();

      console.log('All jobs completed.');
    } catch (error) {
      console.error('[Fatal Error] Execution failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.globalStorage) {
      await this.globalStorage.close();
      console.log('Database connection closed.');
      this.globalStorage = null;
    }
  }
}
