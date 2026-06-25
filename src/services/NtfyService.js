import ky from 'ky';

export class NtfyService {
  constructor(topic, serverUrl = 'https://ntfy.sh') {
    if (!topic) throw new Error("NtfyService benötigt einen Topic-Namen.");
    this.topic = topic;
    this.serverUrl = serverUrl;
  }

  async send(title, message, priority = 'default', tags = 'chart_with_upwards_trend') {
    const url = `${this.serverUrl}/${this.topic}`;
    try {
      await ky.post(url, {
        body: message,
        headers: {
          'Title': title,
          'Priority': priority,
          'Tags': tags
        }
      });
      console.log(`[Ntfy] Alert erfolgreich an Topic '${this.topic}' gesendet.`);
    } catch (error) {
      console.error(`[Ntfy] Fehler beim Senden an ${url}:`, error.message);
    }
  }
}
