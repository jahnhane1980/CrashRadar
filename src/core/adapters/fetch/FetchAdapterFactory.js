export class FetchAdapterFactory {
  static #adapters = new Map();

  static register(type, adapterInstance) {
    this.#adapters.set(type, adapterInstance);
  }

  static getAdapter(providerName) {
    if (!this.#adapters.has(providerName)) {
      throw new Error(`No fetch adapter found for provider: ${providerName}`);
    }
    return this.#adapters.get(providerName);
  }
}
