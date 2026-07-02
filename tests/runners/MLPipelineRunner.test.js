import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { MLPipelineRunner } from '../../src/runners/MLPipelineRunner.js';
import { DefaultFeatureBuilder } from '../../src/ml/features/DefaultFeatureBuilder.js';
import { ModelTrainer } from '../../src/ml/ModelTrainer.js';

// Mocks
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  }
}));

vi.mock('../../src/ml/features/DefaultFeatureBuilder.js', () => {
  return {
    DefaultFeatureBuilder: class {
      build() {
        return Promise.resolve('/path/to/csv');
      }
    }
  };
});

vi.mock('../../src/ml/ModelTrainer.js', () => {
  return {
    ModelTrainer: class {
      train() {
        return Promise.resolve();
      }
    }
  };
});

describe('MLPipelineRunner', () => {
  let mockRepo;
  let mockConfig;
  let buildSpy;
  let trainSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {};
    mockConfig = { global: {} };
    
    // Standardmäßig existiert kein Custom Feature Builder
    fs.existsSync.mockReturnValue(false); 

    buildSpy = vi.spyOn(DefaultFeatureBuilder.prototype, 'build').mockResolvedValue('/path');
    trainSpy = vi.spyOn(ModelTrainer.prototype, 'train').mockResolvedValue();
  });

  it('should run only the features step if step="features"', async () => {
    const runner = new MLPipelineRunner('BTC', mockRepo, mockConfig);
    await runner.run('features');

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(trainSpy).not.toHaveBeenCalled();
  });

  it('should run only the train step if step="train"', async () => {
    const runner = new MLPipelineRunner('BTC', mockRepo, mockConfig);
    await runner.run('train');

    expect(buildSpy).not.toHaveBeenCalled();
    expect(trainSpy).toHaveBeenCalledTimes(1);
  });

  it('should run both steps if step="all"', async () => {
    const runner = new MLPipelineRunner('BTC', mockRepo, mockConfig);
    await runner.run('all');

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(trainSpy).toHaveBeenCalledTimes(1);
  });

  it('should catch and rethrow errors in the pipeline', async () => {
    // Force ModelTrainer to throw
    trainSpy.mockRejectedValueOnce(new Error('Test Error'));

    const runner = new MLPipelineRunner('BTC', mockRepo, mockConfig);
    await expect(runner.run('train')).rejects.toThrow('Test Error');
  });

  // Strategy Pattern Test:
  // Da dynamische imports in vitest etwas tricky sind, prüfen wir zumindest, 
  // dass existsSync aufgerufen wird und wir können prüfen, dass es den Pfad checkt
  it('should check for a custom feature builder via Strategy Pattern', async () => {
    const runner = new MLPipelineRunner('SOFI', mockRepo, mockConfig);
    await runner.run('features');

    expect(fs.existsSync).toHaveBeenCalledTimes(1);
    // Sollte nach SOFIFeatureBuilder.js suchen
    expect(fs.existsSync.mock.calls[0][0]).toContain('SOFIFeatureBuilder.js');
  });
});
