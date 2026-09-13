import ky from 'ky';
import { Logger } from '../core/Logger.js';

export class NtfyService {
  constructor(topic, serverUrl = 'https://ntfy.sh') {
    if (!topic) throw new Error("NtfyService benötigt einen Topic-Namen.");
    this.topic = topic;
    this.serverUrl = serverUrl;
  }

  async send(title, message, priority = 'default', tags = 'chart_with_upwards_trend') {
    const url = `${this.serverUrl}/${this.topic}`;
    // HTTP-Header Title muss reine ASCII-Zeichen enthalten (keine Emojis), um ByteString-Fehler zu vermeiden
    const safeTitle = (title || 'CrashRadar Alert').replace(/[^\x20-\x7E]/g, '').trim() || 'CrashRadar Alert';
    const tagString = typeof tags === 'string' ? tags : (Array.isArray(tags) ? tags.join(',') : 'chart_with_upwards_trend');

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
      Logger.info(`[Ntfy] Alert erfolgreich an Topic '${this.topic}' gesendet.`);
    } catch (error) {
      Logger.error(`[Ntfy] Fehler beim Senden an ${url}:`, error.message);
    }
  }
}
