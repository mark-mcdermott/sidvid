import type { StorageAdapter } from './adapter';
import { readFile, writeFile, mkdir, rm, readdir, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { existsSync } from 'fs';

/**
 * FileStorageAdapter
 *
 * File system storage implementation for CLI and Node.js environments.
 * Stores data as JSON files in a directory structure.
 */
export class FileStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || join(process.cwd(), '.sidvid');
  }

  getBasePath(): string {
    return this.basePath;
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    return join(this.basePath, `${key}.json`);
  }

  async save(key: string, data: any): Promise<void> {
    const filePath = this.getFilePath(key);
    const dir = dirname(filePath);

    // Create directory if it doesn't exist
    await this.ensureDir(dir);

    // Write pretty-printed JSON
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async load(key: string): Promise<any> {
    const filePath = this.getFilePath(key);

    if (!existsSync(filePath)) {
      throw new Error('Not found');
    }

    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    if (!existsSync(filePath)) {
      return; // Already deleted, no error
    }

    await rm(filePath, { force: true });

    // Clean up empty parent directories
    let dir = dirname(filePath);
    while (dir !== this.basePath && existsSync(dir)) {
      const files = await readdir(dir);
      if (files.length === 0) {
        await rm(dir, { recursive: true, force: true });
        dir = dirname(dir);
      } else {
        break;
      }
    }
  }

  async list(prefix?: string): Promise<string[]> {
    if (!existsSync(this.basePath)) {
      return [];
    }

    const keys: string[] = [];

    const walk = async (dir: string, currentPrefix: string = ''): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await walk(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          // Remove .json extension
          const key = relativePath.replace(/\.json$/, '');

          if (!prefix || key.startsWith(prefix)) {
            keys.push(key);
          }
        }
      }
    };

    await walk(this.basePath);
    return keys;
  }

  async clear(): Promise<void> {
    if (existsSync(this.basePath)) {
      await rm(this.basePath, { recursive: true, force: true });
    }
  }
}
