import { Session, type SessionMetadata } from './session';
import type { StorageAdapter } from './storage/adapter';
import type { SidVidConfig } from './types';

export class SessionManager {
  private config: SidVidConfig;
  private storage: StorageAdapter;
  private sessions = new Map<string, Session>();
  private activeSessionId: string | null = null;
  private autoSave: boolean = false;

  constructor(config: SidVidConfig, storage: StorageAdapter) {
    this.config = config;
    this.storage = storage;
  }

  enableAutoSave(): void {
    this.autoSave = true;
  }

  disableAutoSave(): void {
    this.autoSave = false;
  }

  // ===== Session Creation =====

  createSession(name?: string): Session {
    const id = this.generateId();
    const session = new Session(id, this.config, this.storage, name);

    if (this.autoSave) {
      session.enableAutoSave();
    }

    this.sessions.set(id, session);
    this.activeSessionId = id;

    return session;
  }

  private generateId(): string {
    // Generate a simple unique ID (timestamp + random)
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Session Loading =====

  async loadSession(id: string): Promise<Session> {
    // Check cache first
    if (this.sessions.has(id)) {
      return this.sessions.get(id)!;
    }

    // Load from storage
    const session = new Session(id, this.config, this.storage);

    try {
      await session.load();
    } catch (error) {
      throw new Error('Session not found');
    }

    if (this.autoSave) {
      session.enableAutoSave();
    }

    // Cache it
    this.sessions.set(id, session);

    return session;
  }

  // ===== Session Listing =====

  listSessions(): SessionMetadata[] {
    const metadataList: SessionMetadata[] = [];

    // Get metadata from cached sessions
    this.sessions.forEach(session => {
      metadataList.push(session.getMetadata());
    });

    // Sort by updatedAt (most recent first)
    metadataList.sort((a, b) => b.updatedAt - a.updatedAt);

    return metadataList;
  }

  async listAllSessions(): Promise<SessionMetadata[]> {
    // Load all sessions from storage
    const keys = await this.storage.list('sessions/');

    const metadataList: SessionMetadata[] = [];

    for (const key of keys) {
      const id = key.replace('sessions/', '');

      // Try to get from cache first
      if (this.sessions.has(id)) {
        metadataList.push(this.sessions.get(id)!.getMetadata());
      } else {
        // Load just the metadata from storage
        try {
          const data = await this.storage.load(key);
          metadataList.push({
            id: data.id,
            name: data.name,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            storyCount: data.storyHistory?.length || 0,
            characterCount: data.characters?.length || 0
          });
        } catch (error) {
          // Skip if can't load
          continue;
        }
      }
    }

    // Sort by updatedAt (most recent first)
    metadataList.sort((a, b) => b.updatedAt - a.updatedAt);

    return metadataList;
  }

  // ===== Session Deletion =====

  async deleteSession(id: string): Promise<void> {
    // Remove from storage
    try {
      await this.storage.delete(`sessions/${id}`);
    } catch (error) {
      throw new Error('Session not found');
    }

    // Remove from cache
    this.sessions.delete(id);

    // Clear active session if it was deleted
    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }
  }

  async deleteAllSessions(): Promise<void> {
    // Get all session keys
    const keys = await this.storage.list('sessions/');

    // Delete each session
    for (const key of keys) {
      await this.storage.delete(key);
    }

    // Clear cache and active session
    this.sessions.clear();
    this.activeSessionId = null;
  }

  // ===== Active Session =====

  setActiveSession(id: string): void {
    if (!this.sessions.has(id)) {
      throw new Error('Session not found');
    }

    this.activeSessionId = id;
  }

  getActiveSession(): Session | null {
    if (!this.activeSessionId) {
      return null;
    }

    return this.sessions.get(this.activeSessionId) || null;
  }

  // ===== Export/Import =====

  async exportSession(id: string): Promise<string> {
    const session = await this.loadSession(id);
    const data = await this.storage.load(`sessions/${id}`);

    return JSON.stringify(data, null, 2);
  }

  async importSession(jsonData: string): Promise<Session> {
    let data: any;

    try {
      data = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid session data');
    }

    if (!data.id) {
      throw new Error('Invalid session data');
    }

    // Save to storage
    await this.storage.save(`sessions/${data.id}`, data);

    // Load into manager
    const session = await this.loadSession(data.id);

    return session;
  }

  async exportAllSessions(): Promise<string> {
    const allSessions: any[] = [];

    const keys = await this.storage.list('sessions/');

    for (const key of keys) {
      const data = await this.storage.load(key);
      allSessions.push(data);
    }

    return JSON.stringify(allSessions, null, 2);
  }

  async importAllSessions(jsonData: string): Promise<Session[]> {
    let data: any[];

    try {
      data = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('Invalid session data');
    }

    if (!Array.isArray(data)) {
      throw new Error('Invalid session data');
    }

    const imported: Session[] = [];

    for (const sessionData of data) {
      if (!sessionData.id) {
        continue;
      }

      await this.storage.save(`sessions/${sessionData.id}`, sessionData);
      const session = await this.loadSession(sessionData.id);
      imported.push(session);
    }

    return imported;
  }
}
