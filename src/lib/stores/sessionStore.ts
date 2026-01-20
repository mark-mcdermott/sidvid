import { writable } from 'svelte/store';
import { SessionManager, MemoryStorageAdapter, type SessionMetadata } from '$lib/sidvid';
import type { Session } from '$lib/sidvid';

export interface SessionState {
  manager: SessionManager;
  activeSession: Session | null;
  sessions: SessionMetadata[];
  isLoading: boolean;
  error: string | null;
}

// Create singleton storage and manager instances
// Note: BrowserStorageAdapter will be used once Instance 4 implements it
// For now, using MemoryStorageAdapter as a placeholder
const storage = new MemoryStorageAdapter();

// Get API key from environment or use empty string for client-side
// The actual API key is handled server-side in +page.server.ts
const config = { openaiApiKey: '' };
const manager = new SessionManager(config, storage);

// Enable auto-save for convenience
manager.enableAutoSave();

const initialState: SessionState = {
  manager,
  activeSession: null,
  sessions: [],
  isLoading: false,
  error: null
};

export const sessionStore = writable<SessionState>(initialState);

/**
 * Create a new session
 */
export async function createNewSession(name?: string): Promise<Session> {
  sessionStore.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const session = manager.createSession(name);

    sessionStore.update(s => ({
      ...s,
      activeSession: session,
      sessions: manager.listSessions(),
      isLoading: false
    }));

    return session;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
    sessionStore.update(s => ({ ...s, isLoading: false, error: errorMessage }));
    throw error;
  }
}

/**
 * Load an existing session by ID
 */
export async function loadExistingSession(id: string): Promise<Session> {
  sessionStore.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const session = await manager.loadSession(id);

    sessionStore.update(s => ({
      ...s,
      activeSession: session,
      isLoading: false
    }));

    return session;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load session';
    sessionStore.update(s => ({ ...s, isLoading: false, error: errorMessage }));
    throw error;
  }
}

/**
 * Set the active session
 */
export function setActiveSession(session: Session | null): void {
  if (session) {
    manager.setActiveSession(session.getId());
  }

  sessionStore.update(s => ({
    ...s,
    activeSession: session
  }));
}

/**
 * Refresh the sessions list from storage
 */
export async function refreshSessions(): Promise<void> {
  sessionStore.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    const sessions = await manager.listAllSessions();

    sessionStore.update(s => ({
      ...s,
      sessions,
      isLoading: false
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh sessions';
    sessionStore.update(s => ({ ...s, isLoading: false, error: errorMessage }));
  }
}

/**
 * Delete a session
 */
export async function deleteExistingSession(id: string): Promise<void> {
  sessionStore.update(s => ({ ...s, isLoading: true, error: null }));

  try {
    await manager.deleteSession(id);

    sessionStore.update(s => ({
      ...s,
      sessions: s.sessions.filter(session => session.id !== id),
      activeSession: s.activeSession?.getId() === id ? null : s.activeSession,
      isLoading: false
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete session';
    sessionStore.update(s => ({ ...s, isLoading: false, error: errorMessage }));
  }
}

/**
 * Clear error state
 */
export function clearError(): void {
  sessionStore.update(s => ({ ...s, error: null }));
}

/**
 * Get current active session from store
 */
export function getActiveSession(): Session | null {
  let session: Session | null = null;
  sessionStore.subscribe(s => {
    session = s.activeSession;
  })();
  return session;
}
