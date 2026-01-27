import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '$lib/sidvid/session-manager';
import { MemoryStorageAdapter } from '$lib/sidvid/storage/memory-adapter';
import type { Session } from '$lib/sidvid/session';

// Mock OpenAI module - all definitions must be inside the factory due to hoisting
vi.mock('openai', () => {
  const mockStoryResponse = {
    title: 'The Mystery of the Missing Artifact',
    scenes: [
      {
        title: 'The Discovery',
        description: 'Detective arrives at the museum',
        characters: ['Detective Smith']
      },
      {
        title: 'The Investigation',
        description: 'Examining clues at the crime scene',
        characters: ['Detective Smith', 'Museum Guard']
      }
    ],
    characters: [
      { id: 'char-1', name: 'Detective Smith', description: 'A seasoned detective with sharp instincts' },
      { id: 'char-2', name: 'Museum Guard', description: 'A nervous night guard' }
    ]
  };

  class MockOpenAI {
    chat = {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(mockStoryResponse)
            }
          }]
        })
      }
    };
    images = {
      generate: async () => ({
        data: [{
          url: 'https://example.com/generated-image.png',
          revised_prompt: 'A detailed image of the scene'
        }]
      })
    };
  }

  return { default: MockOpenAI };
});

describe('SessionManager - Session Creation', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should create new session with auto-generated ID', () => {
    const session = manager.createSession();

    expect(session).toBeDefined();
    expect(session.getId()).toBeDefined();
    expect(typeof session.getId()).toBe('string');
  });

  it('should create session with custom name', () => {
    const session = manager.createSession('My Detective Story');

    expect(session).toBeDefined();
    expect(session.getName()).toBe('My Detective Story');
  });

  it('should create session with unique IDs', () => {
    const session1 = manager.createSession();
    const session2 = manager.createSession();

    expect(session1.getId()).not.toEqual(session2.getId());
  });

  it('should add created session to session list', () => {
    manager.createSession('Session 1');
    manager.createSession('Session 2');

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(2);
  });

  it('should auto-save session on creation when enabled', async () => {
    manager.enableAutoSave();
    const session = manager.createSession('Auto Save Test');

    // Session should be saved to storage
    const sessions = await storage.load('sessions/index');
    expect(sessions).toBeDefined();
    expect(sessions.length).toBeGreaterThan(0);
  });
});

describe('SessionManager - Session Loading', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should load existing session by ID', async () => {
    const created = manager.createSession('Test Session');
    await created.generateStory('A detective story');
    await created.save();

    const loaded = await manager.loadSession(created.getId());

    expect(loaded).toBeDefined();
    expect(loaded.getId()).toBe(created.getId());
    expect(loaded.getCurrentStory()).toEqual(created.getCurrentStory());
  });

  it('should throw error when loading non-existent session', async () => {
    await expect(
      manager.loadSession('non-existent-id')
    ).rejects.toThrow('Session not found');
  });

  it('should cache loaded sessions', async () => {
    const created = manager.createSession('Test Session');
    await created.save();

    const loaded1 = await manager.loadSession(created.getId());
    const loaded2 = await manager.loadSession(created.getId());

    // Should return the same instance from cache
    expect(loaded1).toBe(loaded2);
  });

  it('should restore full session state', async () => {
    const created = manager.createSession('Complex Session');
    await created.generateStory('A detective story');
    await created.improveStory('Add tension');

    const characters = created.extractCharacters();
    await created.enhanceCharacter(characters[0].id);
    await created.save();

    const loaded = await manager.loadSession(created.getId());

    expect(loaded.getStoryHistory()).toEqual(created.getStoryHistory());
    expect(loaded.extractCharacters()).toEqual(created.extractCharacters());
  });
});

describe('SessionManager - Session Listing', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should list all sessions', () => {
    manager.createSession('Session 1');
    manager.createSession('Session 2');
    manager.createSession('Session 3');

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(3);
  });

  it('should return empty array when no sessions exist', () => {
    const sessions = manager.listSessions();
    expect(sessions).toEqual([]);
  });

  it('should include session metadata in list', async () => {
    const session = manager.createSession('My Session');
    await session.generateStory('A detective story');

    const sessions = manager.listSessions();

    expect(sessions[0]).toMatchObject({
      id: session.getId(),
      name: 'My Session',
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number)
    });
  });

  it('should sort sessions by updatedAt (most recent first)', async () => {
    const session1 = manager.createSession('Old Session');
    await new Promise(resolve => setTimeout(resolve, 10));

    const session2 = manager.createSession('New Session');
    await session2.generateStory('A story');

    const sessions = manager.listSessions();
    expect(sessions[0].id).toBe(session2.getId());
    expect(sessions[1].id).toBe(session1.getId());
  });

  it('should include story count in metadata', async () => {
    const session = manager.createSession('Test');
    await session.generateStory('Story 1');
    await session.improveStory();

    const sessions = manager.listSessions();
    expect(sessions[0].storyCount).toBe(2);
  });

  it('should include character count in metadata', async () => {
    const session = manager.createSession('Test');
    await session.generateStory('A story with characters');

    const sessions = manager.listSessions();
    expect(sessions[0].characterCount).toBeGreaterThan(0);
  });
});

describe('SessionManager - Session Deletion', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should delete session by ID', async () => {
    const session = manager.createSession('To Delete');
    await session.save();

    await manager.deleteSession(session.getId());

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should remove session from storage', async () => {
    const session = manager.createSession('To Delete');
    await session.save();

    await manager.deleteSession(session.getId());

    await expect(
      storage.load(`sessions/${session.getId()}`)
    ).rejects.toThrow('Not found');
  });

  it('should throw error when deleting non-existent session', async () => {
    await expect(
      manager.deleteSession('non-existent')
    ).rejects.toThrow('Session not found');
  });

  it('should clear session from cache', async () => {
    const session = manager.createSession('To Delete');
    await session.save();

    await manager.loadSession(session.getId()); // Load into cache
    await manager.deleteSession(session.getId());

    // Should throw when trying to load deleted session
    await expect(
      manager.loadSession(session.getId())
    ).rejects.toThrow('Session not found');
  });
});

describe('SessionManager - Active Session', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should track active session', () => {
    const session = manager.createSession('Active');
    manager.setActiveSession(session.getId());

    expect(manager.getActiveSession()?.getId()).toBe(session.getId());
  });

  it('should return null when no active session', () => {
    expect(manager.getActiveSession()).toBeNull();
  });

  it('should switch active session', () => {
    const session1 = manager.createSession('Session 1');
    const session2 = manager.createSession('Session 2');

    manager.setActiveSession(session1.getId());
    expect(manager.getActiveSession()?.getId()).toBe(session1.getId());

    manager.setActiveSession(session2.getId());
    expect(manager.getActiveSession()?.getId()).toBe(session2.getId());
  });

  it('should throw error when setting non-existent session as active', () => {
    expect(() => manager.setActiveSession('non-existent'))
      .toThrow('Session not found');
  });

  it('should automatically set new session as active', () => {
    const session = manager.createSession('New');

    expect(manager.getActiveSession()?.getId()).toBe(session.getId());
  });

  it('should clear active session after deletion', async () => {
    const session = manager.createSession('Active');
    manager.setActiveSession(session.getId());

    await manager.deleteSession(session.getId());

    expect(manager.getActiveSession()).toBeNull();
  });
});

describe('SessionManager - Bulk Operations', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should delete all sessions', async () => {
    manager.createSession('Session 1');
    manager.createSession('Session 2');
    manager.createSession('Session 3');

    await manager.deleteAllSessions();

    expect(manager.listSessions()).toEqual([]);
  });

  it('should clear storage when deleting all sessions', async () => {
    const session1 = manager.createSession('Session 1');
    const session2 = manager.createSession('Session 2');

    await session1.save();
    await session2.save();

    await manager.deleteAllSessions();

    await expect(storage.load(`sessions/${session1.getId()}`))
      .rejects.toThrow('Not found');
    await expect(storage.load(`sessions/${session2.getId()}`))
      .rejects.toThrow('Not found');
  });

  it('should clear active session when deleting all', async () => {
    const session = manager.createSession('Active');
    manager.setActiveSession(session.getId());

    await manager.deleteAllSessions();

    expect(manager.getActiveSession()).toBeNull();
  });
});

describe('SessionManager - Export/Import', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    manager = new SessionManager({
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should export session as JSON', async () => {
    const session = manager.createSession('Export Test');
    await session.generateStory('A detective story');

    const exported = await manager.exportSession(session.getId());

    expect(exported).toBeDefined();
    expect(typeof exported).toBe('string');

    const parsed = JSON.parse(exported);
    expect(parsed.id).toBe(session.getId());
    expect(parsed.name).toBe('Export Test');
    expect(parsed.storyHistory).toHaveLength(1);
  });

  it('should import session from JSON', async () => {
    const session = manager.createSession('Original');
    await session.generateStory('A detective story');

    const exported = await manager.exportSession(session.getId());

    // Create new manager and import
    const newManager = new SessionManager({
      openaiApiKey: 'test-key'
    }, new MemoryStorageAdapter());

    const imported = await newManager.importSession(exported);

    expect(imported.getId()).toBe(session.getId());
    expect(imported.getName()).toBe(session.getName());
    expect(imported.getStoryHistory()).toEqual(session.getStoryHistory());
  });

  it('should throw error when importing invalid JSON', async () => {
    await expect(
      manager.importSession('invalid json')
    ).rejects.toThrow('Invalid session data');
  });

  it('should export all sessions', async () => {
    const session1 = manager.createSession('Session 1');
    const session2 = manager.createSession('Session 2');

    await session1.generateStory('Story 1');
    await session2.generateStory('Story 2');

    const exported = await manager.exportAllSessions();

    expect(exported).toBeDefined();
    const parsed = JSON.parse(exported);
    expect(parsed).toHaveLength(2);
  });

  it('should import multiple sessions', async () => {
    const session1 = manager.createSession('Session 1');
    const session2 = manager.createSession('Session 2');

    await session1.generateStory('Story 1');
    await session2.generateStory('Story 2');

    const exported = await manager.exportAllSessions();

    // New manager
    const newManager = new SessionManager({
      openaiApiKey: 'test-key'
    }, new MemoryStorageAdapter());

    await newManager.importAllSessions(exported);

    expect(newManager.listSessions()).toHaveLength(2);
  });
});
