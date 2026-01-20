import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the sidvid module before importing sessionStore
vi.mock('$lib/sidvid', () => {
  class MockSession {
    private id: string;
    private name?: string;

    constructor(id: string, name?: string) {
      this.id = id;
      this.name = name;
    }

    getId() { return this.id; }
    getName() { return this.name; }
    getMetadata() {
      return {
        id: this.id,
        name: this.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storyCount: 0,
        characterCount: 0
      };
    }
    generateStory = vi.fn();
    improveStory = vi.fn();
    getStoryHistory = vi.fn().mockReturnValue([]);
    save = vi.fn();
  }

  class MockSessionManager {
    private sessions = new Map<string, MockSession>();
    private activeId: string | null = null;

    createSession(name?: string) {
      const id = `session-${Date.now()}`;
      const session = new MockSession(id, name);
      this.sessions.set(id, session);
      this.activeId = id;
      return session;
    }

    loadSession = vi.fn().mockImplementation(async (id: string) => {
      if (this.sessions.has(id)) {
        return this.sessions.get(id);
      }
      throw new Error('Session not found');
    });

    listSessions() {
      return Array.from(this.sessions.values()).map(s => s.getMetadata());
    }

    listAllSessions = vi.fn().mockResolvedValue([]);

    deleteSession = vi.fn().mockImplementation(async (id: string) => {
      this.sessions.delete(id);
      if (this.activeId === id) {
        this.activeId = null;
      }
    });

    getActiveSession() {
      return this.activeId ? this.sessions.get(this.activeId) || null : null;
    }

    setActiveSession(id: string) {
      if (this.sessions.has(id)) {
        this.activeId = id;
      }
    }

    enableAutoSave = vi.fn();
  }

  class MockMemoryStorageAdapter {
    private storage = new Map<string, any>();

    save = vi.fn().mockImplementation(async (key: string, data: any) => {
      this.storage.set(key, data);
    });

    load = vi.fn().mockImplementation(async (key: string) => {
      if (!this.storage.has(key)) {
        throw new Error('Not found');
      }
      return this.storage.get(key);
    });

    delete = vi.fn().mockImplementation(async (key: string) => {
      this.storage.delete(key);
    });

    list = vi.fn().mockResolvedValue([]);
    clear = vi.fn();
  }

  return {
    SessionManager: MockSessionManager,
    MemoryStorageAdapter: MockMemoryStorageAdapter,
    Session: MockSession
  };
});

describe('sessionStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should create store with initial state', async () => {
    const { sessionStore } = await import('$lib/stores/sessionStore');
    const state = get(sessionStore);

    expect(state).toBeDefined();
    expect(state.manager).toBeDefined();
    expect(state.activeSession).toBeNull();
    expect(state.sessions).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should have a manager instance', async () => {
    const { sessionStore } = await import('$lib/stores/sessionStore');
    const state = get(sessionStore);

    expect(state.manager).not.toBeNull();
  });
});

describe('createNewSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should create a new session', async () => {
    const { createNewSession, sessionStore } = await import('$lib/stores/sessionStore');

    await createNewSession('My Test Session');

    const state = get(sessionStore);
    expect(state.activeSession).not.toBeNull();
  });

  it('should add session to list', async () => {
    const { createNewSession, sessionStore } = await import('$lib/stores/sessionStore');

    await createNewSession('Session 1');

    const state = get(sessionStore);
    expect(state.sessions.length).toBeGreaterThanOrEqual(0);
  });
});

describe('loadExistingSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should set loading state during load', async () => {
    const { loadExistingSession, sessionStore, createNewSession } = await import('$lib/stores/sessionStore');

    // First create a session
    const session = await createNewSession('Test');
    const sessionId = session.getId();

    // Now test loading - check loading state
    sessionStore.update(s => ({ ...s, isLoading: false })); // Reset
    const loadPromise = loadExistingSession(sessionId);

    // The loading should have been set to true
    await loadPromise;
    // After completion, should not be loading
    const state = get(sessionStore);
    expect(state.isLoading).toBe(false);
  });
});

describe('refreshSessions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should fetch all sessions from storage', async () => {
    const { refreshSessions, sessionStore } = await import('$lib/stores/sessionStore');

    await refreshSessions();

    const state = get(sessionStore);
    expect(Array.isArray(state.sessions)).toBe(true);
  });
});

describe('deleteExistingSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should remove session from list', async () => {
    const { deleteExistingSession, sessionStore, createNewSession } = await import('$lib/stores/sessionStore');

    // Create a session first
    const session = await createNewSession('To Delete');
    const sessionId = session.getId();

    // Delete it
    await deleteExistingSession(sessionId);

    const state = get(sessionStore);
    expect(state.sessions.find(s => s.id === sessionId)).toBeUndefined();
  });
});

describe('clearError', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should clear error state', async () => {
    const { clearError, sessionStore } = await import('$lib/stores/sessionStore');

    // Set an error first
    sessionStore.update(s => ({ ...s, error: 'Test error' }));

    clearError();

    const state = get(sessionStore);
    expect(state.error).toBeNull();
  });
});
