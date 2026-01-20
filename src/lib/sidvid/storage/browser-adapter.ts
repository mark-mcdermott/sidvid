import type { StorageAdapter } from './adapter';

/**
 * BrowserStorageAdapter
 *
 * Browser-based storage using IndexedDB (with localStorage fallback).
 * For use in web applications and UI components.
 */
export class BrowserStorageAdapter implements StorageAdapter {
  private dbName: string;
  private dbVersion: number = 1;
  private storeName: string = 'sessions';
  private db: IDBDatabase | null = null;
  private storageType: 'indexedDB' | 'localStorage';

  constructor(dbName: string = 'sidvid') {
    this.dbName = dbName;

    // Check if IndexedDB is available
    if (typeof indexedDB !== 'undefined') {
      this.storageType = 'indexedDB';
    } else if (typeof localStorage !== 'undefined') {
      this.storageType = 'localStorage';
    } else {
      throw new Error('No browser storage available');
    }
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  getStorageType(): 'indexedDB' | 'localStorage' {
    return this.storageType;
  }

  // ===== IndexedDB Implementation =====

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async saveToIndexedDB(key: string, data: any): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async loadFromIndexedDB(key: string): Promise<any> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result === undefined) {
          reject(new Error('Not found'));
        } else {
          resolve(request.result);
        }
      };
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async listFromIndexedDB(prefix?: string): Promise<string[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result.map(key => String(key));
        if (prefix) {
          resolve(keys.filter(key => key.startsWith(prefix)));
        } else {
          resolve(keys);
        }
      };
    });
  }

  private async clearIndexedDB(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ===== localStorage Implementation =====

  private getLocalStorageKey(key: string): string {
    return `${this.dbName}:${key}`;
  }

  private saveToLocalStorage(key: string, data: any): void {
    const storageKey = this.getLocalStorageKey(key);
    localStorage.setItem(storageKey, JSON.stringify(data));
  }

  private loadFromLocalStorage(key: string): any {
    const storageKey = this.getLocalStorageKey(key);
    const item = localStorage.getItem(storageKey);

    if (item === null) {
      throw new Error('Not found');
    }

    return JSON.parse(item);
  }

  private deleteFromLocalStorage(key: string): void {
    const storageKey = this.getLocalStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  private listFromLocalStorage(prefix?: string): string[] {
    const keys: string[] = [];
    const fullPrefix = this.getLocalStorageKey(prefix || '');

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.dbName}:`)) {
        // Remove the dbName prefix
        const cleanKey = key.substring(`${this.dbName}:`.length);

        if (!prefix || cleanKey.startsWith(prefix)) {
          keys.push(cleanKey);
        }
      }
    }

    return keys;
  }

  private clearLocalStorage(): void {
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.dbName}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => localStorage.removeItem(key));
  }

  // ===== Public StorageAdapter Interface =====

  async save(key: string, data: any): Promise<void> {
    if (this.storageType === 'indexedDB') {
      await this.saveToIndexedDB(key, data);
    } else {
      this.saveToLocalStorage(key, data);
    }
  }

  async load(key: string): Promise<any> {
    if (this.storageType === 'indexedDB') {
      return await this.loadFromIndexedDB(key);
    } else {
      return this.loadFromLocalStorage(key);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.storageType === 'indexedDB') {
      await this.deleteFromIndexedDB(key);
    } else {
      this.deleteFromLocalStorage(key);
    }
  }

  async list(prefix?: string): Promise<string[]> {
    if (this.storageType === 'indexedDB') {
      return await this.listFromIndexedDB(prefix);
    } else {
      return this.listFromLocalStorage(prefix);
    }
  }

  async clear(): Promise<void> {
    if (this.storageType === 'indexedDB') {
      await this.clearIndexedDB();
    } else {
      this.clearLocalStorage();
    }
  }

  // ===== Utility Methods =====

  async estimateUsage(): Promise<number> {
    if (this.storageType === 'indexedDB') {
      // For IndexedDB, we can't easily calculate size
      // Return approximate size based on number of items
      const keys = await this.list();
      return keys.length * 1000; // Rough estimate: 1KB per item
    } else {
      // For localStorage, calculate actual size
      let totalSize = 0;
      const keys = this.listFromLocalStorage();

      keys.forEach(key => {
        const storageKey = this.getLocalStorageKey(key);
        const item = localStorage.getItem(storageKey);
        if (item) {
          totalSize += item.length;
        }
      });

      return totalSize;
    }
  }
}
