/**
 * StorageAdapter Interface
 *
 * Platform-agnostic storage interface for persisting session data.
 * Implementations:
 * - MemoryStorageAdapter: In-memory (testing)
 * - FileStorageAdapter: File system (CLI)
 * - BrowserStorageAdapter: IndexedDB/localStorage (UI)
 */

export interface StorageAdapter {
  /**
   * Save data to storage
   * @param key - Storage key (e.g., 'sessions/abc-123')
   * @param data - Data to save (will be serialized to JSON)
   */
  save(key: string, data: any): Promise<void>;

  /**
   * Load data from storage
   * @param key - Storage key
   * @returns Parsed data
   * @throws Error if key not found
   */
  load(key: string): Promise<any>;

  /**
   * Delete data from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * List all keys, optionally filtered by prefix
   * @param prefix - Optional key prefix filter (e.g., 'sessions/')
   * @returns Array of matching keys
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Clear all data from storage
   */
  clear(): Promise<void>;
}
