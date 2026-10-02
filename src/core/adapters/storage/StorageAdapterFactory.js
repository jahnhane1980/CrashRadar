export class StorageAdapterFactory {
  static #adapters = new Map();

  static register(type, adapterInstance) {
    this.#adapters.set(type, adapterInstance);
  }

  /**
   * Liefert den passenden Datenbank-Adapter für den gegebenen Provider.
   */
  static getAdapter(providerName) {
    if (!this.#adapters.has(providerName)) {
      throw new Error(`No storage adapter found for provider: ${providerName}`);
    }
    return this.#adapters.get(providerName);
  }
}
