import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStorageAdapter } from '$lib/sidvid/storage/file-adapter';
import { rm, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = join(process.cwd(), '.test-storage');

describe('FileStorageAdapter - Initialization', () => {
  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should create storage directory if it does not exist', async () => {
    const storage = new FileStorageAdapter(TEST_DIR);
    await storage.save('test', {});

    expect(existsSync(TEST_DIR)).toBe(true);
  });

  it('should use existing directory if it exists', async () => {
    await mkdir(TEST_DIR, { recursive: true });

    const storage = new FileStorageAdapter(TEST_DIR);
    await storage.save('test', {});

    expect(existsSync(TEST_DIR)).toBe(true);
  });

  it('should default to .sidvid directory when no path provided', () => {
    const storage = new FileStorageAdapter();

    expect(storage.getBasePath()).toContain('.sidvid');
  });
});

describe('FileStorageAdapter - Save Operations', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should save data to JSON file', async () => {
    const data = { foo: 'bar', baz: 123 };

    await storage.save('test-key', data);

    const filePath = join(TEST_DIR, 'test-key.json');
    expect(existsSync(filePath)).toBe(true);
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

  it('should create nested directories for keys with slashes', async () => {
    await storage.save('sessions/user1/story', { title: 'Test' });

    const filePath = join(TEST_DIR, 'sessions', 'user1', 'story.json');
    expect(existsSync(filePath)).toBe(true);
  });

  it('should overwrite existing file on save', async () => {
    await storage.save('key', { version: 1 });
    await storage.save('key', { version: 2 });

    const loaded = await storage.load('key');
    expect(loaded.version).toBe(2);
  });

  it('should pretty-print JSON for readability', async () => {
    await storage.save('pretty', { foo: 'bar' });

    const { readFile } = await import('fs/promises');
    const content = await readFile(join(TEST_DIR, 'pretty.json'), 'utf-8');

    expect(content).toContain('\n'); // Pretty printed with newlines
  });
});

describe('FileStorageAdapter - Load Operations', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should load data from JSON file', async () => {
    const data = { foo: 'bar', baz: 123 };
    await storage.save('test-key', data);

    const loaded = await storage.load('test-key');
    expect(loaded).toEqual(data);
  });

  it('should throw error when loading non-existent file', async () => {
    await expect(storage.load('non-existent'))
      .rejects.toThrow('Not found');
  });

  it('should load from nested directories', async () => {
    const data = { title: 'Nested Story' };
    await storage.save('sessions/user1/story', data);

    const loaded = await storage.load('sessions/user1/story');
    expect(loaded).toEqual(data);
  });

  it('should handle corrupted JSON files', async () => {
    const { writeFile } = await import('fs/promises');
    const filePath = join(TEST_DIR, 'corrupted.json');

    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(filePath, '{ invalid json }');

    await expect(storage.load('corrupted'))
      .rejects.toThrow();
  });
});

describe('FileStorageAdapter - Delete Operations', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should delete file by key', async () => {
    await storage.save('to-delete', { data: 'value' });
    await storage.delete('to-delete');

    const filePath = join(TEST_DIR, 'to-delete.json');
    expect(existsSync(filePath)).toBe(false);
  });

  it('should not throw when deleting non-existent file', async () => {
    await expect(storage.delete('non-existent'))
      .resolves.not.toThrow();
  });

  it('should delete files in nested directories', async () => {
    await storage.save('sessions/user1/story', { title: 'Test' });
    await storage.delete('sessions/user1/story');

    await expect(storage.load('sessions/user1/story'))
      .rejects.toThrow('Not found');
  });

  it('should remove empty parent directories after delete', async () => {
    await storage.save('sessions/user1/story', { title: 'Test' });
    await storage.delete('sessions/user1/story');

    const dirPath = join(TEST_DIR, 'sessions', 'user1');
    expect(existsSync(dirPath)).toBe(false);
  });
});

describe('FileStorageAdapter - List Operations', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should list all keys', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});
    await storage.save('key3', {});

    const keys = await storage.list();
    expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
  });

  it('should return empty array when no files exist', async () => {
    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  it('should list keys with prefix filter', async () => {
    await storage.save('sessions/1', {});
    await storage.save('sessions/2', {});
    await storage.save('images/1', {});

    const keys = await storage.list('sessions/');
    expect(keys.sort()).toEqual(['sessions/1', 'sessions/2']);
  });

  it('should list keys in nested directories', async () => {
    await storage.save('sessions/user1/story1', {});
    await storage.save('sessions/user1/story2', {});
    await storage.save('sessions/user2/story1', {});

    const keys = await storage.list('sessions/');
    expect(keys).toHaveLength(3);
  });

  it('should ignore non-JSON files', async () => {
    const { writeFile } = await import('fs/promises');

    await mkdir(TEST_DIR, { recursive: true });
    await writeFile(join(TEST_DIR, 'test.json'), '{}');
    await writeFile(join(TEST_DIR, 'readme.txt'), 'text');

    const keys = await storage.list();
    expect(keys).toEqual(['test']);
  });
});

describe('FileStorageAdapter - Clear Operations', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should clear all files', async () => {
    await storage.save('key1', {});
    await storage.save('key2', {});
    await storage.save('sessions/user1/story', {});

    await storage.clear();

    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  it('should remove storage directory after clear', async () => {
    await storage.save('test', {});
    await storage.clear();

    expect(existsSync(TEST_DIR)).toBe(false);
  });

  it('should allow saving after clear', async () => {
    await storage.save('before', {});
    await storage.clear();
    await storage.save('after', { value: 'test' });

    const loaded = await storage.load('after');
    expect(loaded.value).toBe('test');
  });
});

describe('FileStorageAdapter - Concurrency', () => {
  let storage: FileStorageAdapter;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
    storage = new FileStorageAdapter(TEST_DIR);
  });

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should handle concurrent saves to different keys', async () => {
    await Promise.all([
      storage.save('key1', { value: 1 }),
      storage.save('key2', { value: 2 }),
      storage.save('key3', { value: 3 })
    ]);

    const [data1, data2, data3] = await Promise.all([
      storage.load('key1'),
      storage.load('key2'),
      storage.load('key3')
    ]);

    expect(data1.value).toBe(1);
    expect(data2.value).toBe(2);
    expect(data3.value).toBe(3);
  });

  it('should handle concurrent saves to same key (last write wins)', async () => {
    await Promise.all([
      storage.save('key', { version: 1 }),
      storage.save('key', { version: 2 }),
      storage.save('key', { version: 3 })
    ]);

    const loaded = await storage.load('key');
    expect([1, 2, 3]).toContain(loaded.version);
  });
});

describe('FileStorageAdapter - Data Isolation', () => {
  afterEach(async () => {
    await rm(join(process.cwd(), '.test-storage-1'), { recursive: true, force: true }).catch(() => {});
    await rm(join(process.cwd(), '.test-storage-2'), { recursive: true, force: true }).catch(() => {});
  });

  it('should not share data between instances with different paths', async () => {
    const storage1 = new FileStorageAdapter(join(process.cwd(), '.test-storage-1'));
    const storage2 = new FileStorageAdapter(join(process.cwd(), '.test-storage-2'));

    await storage1.save('shared-key', { instance: 1 });
    await storage2.save('shared-key', { instance: 2 });

    const loaded1 = await storage1.load('shared-key');
    const loaded2 = await storage2.load('shared-key');

    expect(loaded1.instance).toBe(1);
    expect(loaded2.instance).toBe(2);
  });
});
