import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '$lib/sidvid/storage/memory-adapter';

describe('MemoryStorageAdapter - Basic Operations', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it('should save and load data', async () => {
    const data = { foo: 'bar', baz: 123 };

    await storage.save('test-key', data);
    const loaded = await storage.load('test-key');

    expect(loaded).toEqual(data);
  });

  it('should save complex nested objects', async () => {
    const data = {
      id: '123',
      nested: {
        array: [1, 2, 3],
        object: { deep: 'value' }
      }
    };

    await storage.save('complex', data);
    const loaded = await storage.load('complex');

    expect(loaded).toEqual(data);
  });

  it('should overwrite existing data on save', async () => {
    await storage.save('key', { version: 1 });
    await storage.save('key', { version: 2 });

    const loaded = await storage.load('key');
    expect(loaded.version).toBe(2);
  });

  it('should throw error when loading non-existent key', async () => {
    await expect(storage.load('non-existent'))
      .rejects.toThrow('Not found');
  });

  it('should store data independently by key', async () => {
    await storage.save('key1', { value: 'first' });
    await storage.save('key2', { value: 'second' });

    const loaded1 = await storage.load('key1');
    const loaded2 = await storage.load('key2');

    expect(loaded1.value).toBe('first');
    expect(loaded2.value).toBe('second');
  });
});

describe('MemoryStorageAdapter - Delete Operations', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it('should delete data by key', async () => {
    await storage.save('to-delete', { data: 'value' });
    await storage.delete('to-delete');

    await expect(storage.load('to-delete'))
      .rejects.toThrow('Not found');
  });

  it('should not throw when deleting non-existent key', async () => {
    await expect(storage.delete('non-existent'))
      .resolves.not.toThrow();
  });

  it('should only delete specified key', async () => {
    await storage.save('key1', { value: 1 });
    await storage.save('key2', { value: 2 });

    await storage.delete('key1');

    await expect(storage.load('key1')).rejects.toThrow();
    await expect(storage.load('key2')).resolves.toEqual({ value: 2 });
  });
});

describe('MemoryStorageAdapter - List Operations', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it('should list all keys', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});
    await storage.save('key3', {});

    const keys = await storage.list();
    expect(keys).toEqual(['key1', 'key2', 'key3']);
  });

  it('should return empty array when no keys exist', async () => {
    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  it('should list keys with prefix filter', async () => {
    await storage.save('sessions/1', {});
    await storage.save('sessions/2', {});
    await storage.save('images/1', {});

    const keys = await storage.list('sessions/');
    expect(keys).toEqual(['sessions/1', 'sessions/2']);
  });

  it('should update list after delete', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});

    await storage.delete('key1');

    const keys = await storage.list();
    expect(keys).toEqual(['key2']);
  });
});

describe('MemoryStorageAdapter - Clear Operations', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it('should clear all data', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});
    await storage.save('key3', {});

    await storage.clear();

    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  it('should allow saving after clear', async () => {
    await storage.save('before', {});
    await storage.clear();
    await storage.save('after', { value: 'test' });

    const loaded = await storage.load('after');
    expect(loaded.value).toBe('test');
  });
});

describe('MemoryStorageAdapter - Data Isolation', () => {
  it('should not share data between instances', async () => {
    const storage1 = new MemoryStorageAdapter();
    const storage2 = new MemoryStorageAdapter();

    await storage1.save('shared-key', { instance: 1 });
    await storage2.save('shared-key', { instance: 2 });

    const loaded1 = await storage1.load('shared-key');
    const loaded2 = await storage2.load('shared-key');

    expect(loaded1.instance).toBe(1);
    expect(loaded2.instance).toBe(2);
  });
});
