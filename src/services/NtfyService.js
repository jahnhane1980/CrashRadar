import ky from 'ky';
import { Logger } from '../core/Logger.js';

export class NtfyService {
  constructor(topic = process.env.NTFY_TOPIC, serverUrl = process.env.NTFY_URL || 'https://ntfy.sh') {
    if (topic === undefined && !process.env.NTFY_TOPIC && arguments.length === 0) {
      throw new Error("NtfyService benötigt einen Topic-Namen.");
    }
    this.topic = topic || process.env.NTFY_TOPIC;
    this.serverUrl = serverUrl || process.env.NTFY_URL || 'https://ntfy.sh';
  }

  async send(title, message, priority = 'default', tags = 'warning') {
    const topic = this.topic || process.env.NTFY_TOPIC;
    if (!topic) {
      Logger.warn("NTFY_TOPIC nicht konfiguriert – Benachrichtigung übersprungen");
      return;
    }

    const url = `${this.serverUrl}/${topic}`;
    // HTTP-Header Title muss reine ASCII-Zeichen enthalten (keine Emojis), um ByteString-Fehler zu vermeiden
    const safeTitle = (title || 'CrashRadar Alert').replace(/[^\x20-\x7E]/g, '').trim() || 'CrashRadar Alert';
    const tagString = typeof tags === 'string' ? tags : (Array.isArray(tags) ? tags.join(',') : 'warning');

    try {
      await ky.post(url, {
        body: message,
        headers: {
          'Title': safeTitle,
          'Priority': String(priority || 'default'),
          'Tags': tagString,
          'Markdown': 'yes',
        }
      });
      Logger.info(`[Ntfy] Alert erfolgreich an Topic '${topic}' gesendet.`);
    } catch (error) {
      Logger.error(`[Ntfy] Fehler beim Senden an ${url}:`, error.message);
    }
  }
}
