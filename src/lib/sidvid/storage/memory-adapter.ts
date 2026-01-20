import type { StorageAdapter } from './adapter';

/**
 * MemoryStorageAdapter
 *
 * In-memory storage implementation for testing and development.
 * Data is stored in a Map and cleared when the process exits.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, any>();

  async save(key: string, data: any): Promise<void> {
    // Deep clone to prevent mutation
    this.storage.set(key, JSON.parse(JSON.stringify(data)));
  }

  async load(key: string): Promise<any> {
    if (!this.storage.has(key)) {
      throw new Error('Not found');
    }
    // Deep clone to prevent mutation
    return JSON.parse(JSON.stringify(this.storage.get(key)));
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());

    if (!prefix) {
      return keys;
    }

    return keys.filter(key => key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}
