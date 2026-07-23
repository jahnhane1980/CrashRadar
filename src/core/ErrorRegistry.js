export class ErrorRegistry {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  addError(context, error) {
    const message = error instanceof Error ? error.message : String(error);
    this.errors.push({ context, message });
  }

  addWarning(context, message) {
    this.warnings.push({ context, message: String(message) });
  }

  hasErrors() {
    return this.errors.length > 0;
  }
  
  hasWarnings() {
    return this.warnings.length > 0;
  }

  getSummary() {
    const durationSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    let summary = `Laufzeit: ${durationSec}s\n`;
    summary += `Fehler: ${this.errors.length} | Warnungen: ${this.warnings.length}\n\n`;

    if (this.hasErrors()) {
      summary += "❌ FEHLER:\n";
      this.errors.forEach(e => {
        summary += `- [${e.context}] ${e.message}\n`;
      });
    }
    
    if (this.hasWarnings()) {
      if (this.hasErrors()) summary += "\n";
      summary += "⚠️ WARNUNGEN:\n";
      this.warnings.forEach(w => {
        summary += `- [${w.context}] ${w.message}\n`;
      });
    }
    
    return summary.trim();
  }
}
