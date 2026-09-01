import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '../core/Storage.js';
import { RequestManager } from '../core/RequestManager.js';
import { TimeSeriesFetcher } from '../services/TimeSeriesFetcher.js';
import { MaturityWallBuilder } from '../services/MaturityWallBuilder.js';
import { ErrorRegistry } from '../core/ErrorRegistry.js';
import { NtfyService } from '../services/NtfyService.js';
import { StandardRunner } from './StandardRunner.js';
import { TestRunner } from './TestRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TimeSeriesFetchRunner {
  constructor(options = {}, dependencies = {}) {
    this.options = options;
    this.isTest = Boolean(options.test);
    this.dependencies = dependencies;
    this.activeRunner = null;
  }

  async run() {
    const isTest = this.isTest;
    const dbUrl = isTest 
      ? (this.dependencies.dbUrl || TestRunner.getDatabaseUrl()) 
      : (this.dependencies.dbUrl || process.env.DATABASE_URL);

    if (!dbUrl) throw new Error("Missing DATABASE_URL in environment.");

    const configPath = this.dependencies.configPath || path.resolve(__dirname, '../../config/Database-Fetcher-Config.json');
    let config = this.dependencies.config;
    if (!config) {
      if (!fs.existsSync(configPath)) {
        throw new Error(`Critical Config not found at ${configPath}. Exiting.`);
      }
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (isTest) {
      TestRunner.applyTestConfigOverrides(config);
    }

    const storage = this.dependencies.storage || new Storage({ databaseUrl: dbUrl });
    const requestManager = this.dependencies.requestManager || new RequestManager(config);
    const errorRegistry = this.dependencies.errorRegistry || new ErrorRegistry();
    const ntfyTopic = process.env.NTFY_TOPIC || this.dependencies.ntfyTopic;
    const ntfyService = this.dependencies.ntfyService !== undefined 
      ? this.dependencies.ntfyService 
      : (ntfyTopic ? new NtfyService(ntfyTopic) : null);
    const fetcher = this.dependencies.fetcher || new TimeSeriesFetcher(config, storage, requestManager, errorRegistry);
    const maturityWallBuilder = this.dependencies.maturityWallBuilder || new MaturityWallBuilder(dbUrl);

    const runnerArgs = { config, storage, fetcher, maturityWallBuilder, errorRegistry, ntfyService };
    
    if (this.dependencies.runner) {
      this.activeRunner = this.dependencies.runner;
    } else {
      this.activeRunner = isTest ? new TestRunner(runnerArgs) : new StandardRunner(runnerArgs);
    }

    await this.activeRunner.run();
  }

  async cleanup() {
    if (this.activeRunner && typeof this.activeRunner.cleanup === 'function') {
      await this.activeRunner.cleanup();
      this.activeRunner = null;
    }
  }
}

// Backward-compatibility alias
export const DataFetchRunner = TimeSeriesFetchRunner;
