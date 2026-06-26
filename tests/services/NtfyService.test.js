import { describe, it, expect, vi } from 'vitest';
import { NtfyService } from '../../src/services/NtfyService.js';
import ky from 'ky';

vi.mock('ky', () => ({
  default: {
    post: vi.fn().mockResolvedValue({})
  }
}));

describe('NtfyService', () => {
  it('sollte einen Error werfen wenn kein Topic angegeben wird', () => {
    expect(() => new NtfyService()).toThrow("NtfyService benötigt einen Topic-Namen.");
  });

  it('sollte eine Nachricht erfolgreich senden', async () => {
    const service = new NtfyService('test-topic');
    await service.send('Titel', 'Nachricht');
    expect(ky.post).toHaveBeenCalledWith('https://ntfy.sh/test-topic', expect.any(Object));
  });
});
