/**
 * SignalComponent (Basis-Kontrakt für das Composite-Pattern)
 * 
 * Einheitliche Schnittstelle für alle atomaren Sensoren (Leafs)
 * und aggregierenden Sensor-Hubs (Composites) in CrashRadar.
 */
export class SignalComponent {
  /**
   * Eindeutige ID der Komponente (z. B. 'MSTR_LEAD_SENSOR', 'CRYPTO_SENSOR_HUB')
   * @returns {string}
   */
  getId() {
    throw new Error(`[SignalComponent] Methode getId() muss von ${this.constructor.name} implementiert werden.`);
  }

  /**
   * Lesbarer Name für Reports, Dashboards und Logs
   * @returns {string}
   */
  getName() {
    throw new Error(`[SignalComponent] Methode getName() muss von ${this.constructor.name} implementiert werden.`);
  }

  /**
   * Typ der Komponente ('SENSOR' oder 'HUB')
   * @returns {'SENSOR' | 'HUB'}
   */
  getComponentType() {
    return 'SENSOR';
  }

  /**
   * Wertet die Zeitreihe aus und liefert ein standardisiertes SignalResult-Objekt.
   * @param {Array<Object>} timeline 
   * @param {Object} [context={}] 
   * @returns {Object} SignalResult
   */
  evaluate(timeline, context = {}) {
    throw new Error(`[SignalComponent] Methode evaluate(timeline, context) muss von ${this.constructor.name} implementiert werden.`);
  }

  /**
   * Validiert zur Laufzeit, ob eine Instanz den Kontrakt erfüllt.
   * @param {Object} instance 
   * @returns {boolean}
   */
  static validate(instance) {
    if (!instance || typeof instance !== 'object') {
      throw new Error('[SignalComponent] Instanz muss ein gültiges Objekt sein.');
    }
    const requiredMethods = ['getId', 'getName', 'evaluate'];
    for (const method of requiredMethods) {
      if (typeof instance[method] !== 'function') {
        throw new Error(`[SignalComponent] Komponente '${instance.constructor?.name || 'Unbekannt'}' verletzt den Kontrakt: Methode '${method}' fehlt.`);
      }
    }
    const id = instance.getId();
    if (!id || typeof id !== 'string') {
      throw new Error(`[SignalComponent] getId() muss einen nicht-leeren String liefern (erhalten: '${id}').`);
    }
    return true;
  }
}
