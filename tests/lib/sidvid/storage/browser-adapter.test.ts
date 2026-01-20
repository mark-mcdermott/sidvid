import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserStorageAdapter } from '$lib/sidvid/storage/browser-adapter';

// Mock IndexedDB for Node environment
const mockIndexedDB = {
  databases: new Map<string, any>(),
  open: vi.fn((name: string, version?: number) => {
    return {
      result: {
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            getAll: vi.fn()
          }))
        }))
      },
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
  })
};

describe('BrowserStorageAdapter - Initialization', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', mockIndexedDB);
  });

  it('should initialize with IndexedDB', () => {
    const storage = new BrowserStorageAdapter();
    expect(storage).toBeDefined();
  });

  it('should use custom database name', () => {
    const storage = new BrowserStorageAdapter('custom-db');
    expect(storage.getDatabaseName()).toBe('custom-db');
  });

  it('should default to "sidvid" database name', () => {
    const storage = new BrowserStorageAdapter();
    expect(storage.getDatabaseName()).toBe('sidvid');
  });

  it('should fallback to localStorage when IndexedDB unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    });

    const storage = new BrowserStorageAdapter();
    expect(storage.getStorageType()).toBe('localStorage');
  });
});

describe('BrowserStorageAdapter - IndexedDB Operations', () => {
  let storage: BrowserStorageAdapter;
  let mockDB: any;

  beforeEach(() => {
    mockDB = {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn((key) => ({
            onsuccess: null,
            result: null
          })),
          put: vi.fn(),
          delete: vi.fn(),
          getAllKeys: vi.fn(() => ({
            onsuccess: null,
            result: []
          })),
          clear: vi.fn()
        }))
      }))
    };

    vi.stubGlobal('indexedDB', {
      open: vi.fn((name, version) => {
        const request: any = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: mockDB
        };

        setTimeout(() => {
          if (request.onupgradeneeded) {
            request.onupgradeneeded({
              target: { result: { createObjectStore: vi.fn() } }
            });
          }
          if (request.onsuccess) {
            request.onsuccess({ target: { result: mockDB } });
          }
        }, 0);

        return request;
      })
    });

    storage = new BrowserStorageAdapter();
  });

  it('should save data to IndexedDB', async () => {
    const data = { foo: 'bar', baz: 123 };
    await storage.save('test-key', data);

    // Verify put was called
    expect(mockDB.transaction).toHaveBeenCalled();
  });

  it('should load data from IndexedDB', async () => {
    const data = { foo: 'bar', baz: 123 };

    // Mock get response
    const transaction = mockDB.transaction();
    const objectStore = transaction.objectStore();
    objectStore.get.mockReturnValue({
      onsuccess: null,
      result: data
    });

    await storage.save('test-key', data);
    const loaded = await storage.load('test-key');

    expect(loaded).toEqual(data);
  });

  it('should throw error when loading non-existent key', async () => {
    const transaction = mockDB.transaction();
    const objectStore = transaction.objectStore();
    objectStore.get.mockReturnValue({
      onsuccess: null,
      result: undefined
    });

    await expect(storage.load('non-existent'))
      .rejects.toThrow('Not found');
  });
});

describe('BrowserStorageAdapter - LocalStorage Fallback', () => {
  let storage: BrowserStorageAdapter;
  let mockLocalStorage: any;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);

    mockLocalStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockLocalStorage.data.set(key, value)),
      removeItem: vi.fn((key: string) => mockLocalStorage.data.delete(key)),
      clear: vi.fn(() => mockLocalStorage.data.clear()),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.data.keys());
        return keys[index] || null;
      }),
      get length() {
        return mockLocalStorage.data.size;
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    storage = new BrowserStorageAdapter();
  });

  it('should save data to localStorage', async () => {
    const data = { foo: 'bar', baz: 123 };

    await storage.save('test-key', data);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'sidvid:test-key',
      JSON.stringify(data)
    );
  });

  it('should load data from localStorage', async () => {
    const data = { foo: 'bar', baz: 123 };

    await storage.save('test-key', data);
    const loaded = await storage.load('test-key');

    expect(loaded).toEqual(data);
  });

  it('should throw error when loading non-existent key', async () => {
    await expect(storage.load('non-existent'))
      .rejects.toThrow('Not found');
  });

  it('should delete data from localStorage', async () => {
    await storage.save('to-delete', { data: 'value' });
    await storage.delete('to-delete');

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sidvid:to-delete');
  });

  it('should list all keys from localStorage', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});
    await storage.save('key3', {});

    const keys = await storage.list();
    expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
  });

  it('should list keys with prefix filter', async () => {
    await storage.save('sessions/1', {});
    await storage.save('sessions/2', {});
    await storage.save('images/1', {});

    const keys = await storage.list('sessions/');
    expect(keys.sort()).toEqual(['sessions/1', 'sessions/2']);
  });

  it('should clear all data from localStorage', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});

    await storage.clear();

    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  it('should handle corrupted JSON in localStorage', async () => {
    mockLocalStorage.setItem('sidvid:corrupted', '{ invalid json }');

    await expect(storage.load('corrupted'))
      .rejects.toThrow();
  });
});

describe('BrowserStorageAdapter - Complex Data', () => {
  let storage: BrowserStorageAdapter;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);

    const mockLocalStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockLocalStorage.data.set(key, value)),
      removeItem: vi.fn((key: string) => mockLocalStorage.data.delete(key)),
      clear: vi.fn(() => mockLocalStorage.data.clear()),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.data.keys());
        return keys[index] || null;
      }),
      get length() {
        return mockLocalStorage.data.size;
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    storage = new BrowserStorageAdapter();
  });

  it('should save complex nested objects', async () => {
    const data = {
      id: '123',
      nested: {
        array: [1, 2, 3],
        object: { deep: 'value' },
        nullValue: null,
        boolValue: true
      },
      dates: [new Date().toISOString()]
    };

    await storage.save('complex', data);
    const loaded = await storage.load('complex');

    expect(loaded).toEqual(data);
  });

  it('should handle arrays', async () => {
    const data = [1, 2, 3, 'four', { five: 5 }];

    await storage.save('array', data);
    const loaded = await storage.load('array');

    expect(loaded).toEqual(data);
  });

  it('should preserve data types', async () => {
    const data = {
      string: 'text',
      number: 42,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      object: { nested: 'value' }
    };

    await storage.save('types', data);
    const loaded = await storage.load('types');

    expect(typeof loaded.string).toBe('string');
    expect(typeof loaded.number).toBe('number');
    expect(typeof loaded.boolean).toBe('boolean');
    expect(loaded.null).toBeNull();
    expect(Array.isArray(loaded.array)).toBe(true);
    expect(typeof loaded.object).toBe('object');
  });
});

describe('BrowserStorageAdapter - Error Handling', () => {
  let storage: BrowserStorageAdapter;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);

    const mockLocalStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        if (key === 'error-key') {
          throw new Error('Storage quota exceeded');
        }
        mockLocalStorage.data.set(key, value);
      }),
      removeItem: vi.fn((key: string) => mockLocalStorage.data.delete(key)),
      clear: vi.fn(() => mockLocalStorage.data.clear()),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.data.keys());
        return keys[index] || null;
      }),
      get length() {
        return mockLocalStorage.data.size;
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    storage = new BrowserStorageAdapter();
  });

  it('should throw error when storage quota exceeded', async () => {
    await expect(
      storage.save('error-key', { large: 'data' })
    ).rejects.toThrow('Storage quota exceeded');
  });

  it('should not throw when deleting non-existent key', async () => {
    await expect(storage.delete('non-existent'))
      .resolves.not.toThrow();
  });
});

describe('BrowserStorageAdapter - Quota Management', () => {
  let storage: BrowserStorageAdapter;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);

    const mockLocalStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockLocalStorage.data.set(key, value)),
      removeItem: vi.fn((key: string) => mockLocalStorage.data.delete(key)),
      clear: vi.fn(() => mockLocalStorage.data.clear()),
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.data.keys());
        return keys[index] || null;
      }),
      get length() {
        return mockLocalStorage.data.size;
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    storage = new BrowserStorageAdapter();
  });

  it('should estimate storage usage', async () => {
    await storage.save('key1', { data: 'small' });
    await storage.save('key2', { data: 'larger data string' });

    const usage = await storage.estimateUsage();

    expect(usage).toBeGreaterThan(0);
    expect(usage).toBeLessThan(1000000); // Less than 1MB
  });

  it('should return approximate size in bytes', async () => {
    const data = { test: 'a'.repeat(1000) }; // ~1KB
    await storage.save('large', data);

    const usage = await storage.estimateUsage();
    expect(usage).toBeGreaterThan(1000);
  });
});
