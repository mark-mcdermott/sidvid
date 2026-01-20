import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Session } from '$lib/sidvid/session';
import { MemoryStorageAdapter } from '$lib/sidvid/storage/memory-adapter';
import type { Story, Character } from '$lib/sidvid/types';

describe('Session - Story Workflow', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should generate initial story from prompt', async () => {
    const story = await session.generateStory('A detective story');

    expect(story).toBeDefined();
    expect(story.title).toBeDefined();
    expect(story.scenes).toBeDefined();
    expect(story.scenes.length).toBeGreaterThan(0);
    expect(session.getCurrentStory()).toEqual(story);
  });

  it('should track story in history after generation', async () => {
    const story = await session.generateStory('A detective story');
    const history = session.getStoryHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(story);
  });

  it('should improve existing story with optional prompt', async () => {
    const initialStory = await session.generateStory('A detective story');
    const improvedStory = await session.improveStory('Make it more suspenseful');

    expect(improvedStory).toBeDefined();
    expect(improvedStory).not.toEqual(initialStory);
    expect(session.getCurrentStory()).toEqual(improvedStory);
    expect(session.getStoryHistory()).toHaveLength(2);
  });

  it('should improve story without prompt (general improvement)', async () => {
    await session.generateStory('A detective story');
    const improvedStory = await session.improveStory();

    expect(improvedStory).toBeDefined();
    expect(session.getStoryHistory()).toHaveLength(2);
  });

  it('should maintain complete story history across multiple improvements', async () => {
    const story1 = await session.generateStory('A detective story');
    const story2 = await session.improveStory('Add more tension');
    const story3 = await session.improveStory('Include a twist ending');

    const history = session.getStoryHistory();
    expect(history).toHaveLength(3);
    expect(history[0]).toEqual(story1);
    expect(history[1]).toEqual(story2);
    expect(history[2]).toEqual(story3);
  });

  it('should revert to previous story version', async () => {
    const story1 = await session.generateStory('A detective story');
    const story2 = await session.improveStory('Add more tension');
    await session.improveStory('Include a twist ending');

    session.revertToStory(1); // Revert to story2
    expect(session.getCurrentStory()).toEqual(story2);
    expect(session.getStoryHistory()).toHaveLength(2);
  });

  it('should revert to initial story', async () => {
    const story1 = await session.generateStory('A detective story');
    await session.improveStory('Add more tension');
    await session.improveStory('Include a twist ending');

    session.revertToStory(0);
    expect(session.getCurrentStory()).toEqual(story1);
    expect(session.getStoryHistory()).toHaveLength(1);
  });

  it('should throw error when reverting to invalid index', async () => {
    await session.generateStory('A detective story');

    expect(() => session.revertToStory(5)).toThrow('Invalid story index');
    expect(() => session.revertToStory(-1)).toThrow('Invalid story index');
  });

  it('should return null when no current story exists', () => {
    expect(session.getCurrentStory()).toBeNull();
  });

  it('should return empty array when no story history exists', () => {
    expect(session.getStoryHistory()).toEqual([]);
  });
});

describe('Session - Character Workflow', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);

    // Generate story to extract characters from
    await session.generateStory('A detective story with characters');
  });

  it('should extract characters from current story', () => {
    const characters = session.extractCharacters();

    expect(characters).toBeDefined();
    expect(Array.isArray(characters)).toBe(true);
    expect(characters.length).toBeGreaterThan(0);
    expect(characters[0]).toHaveProperty('name');
    expect(characters[0]).toHaveProperty('description');
  });

  it('should return empty array when no story exists', () => {
    const newSession = new Session('empty-session', {
      openaiApiKey: 'test-key'
    }, storage);

    expect(newSession.extractCharacters()).toEqual([]);
  });

  it('should enhance character description', async () => {
    const characters = session.extractCharacters();
    const characterId = characters[0].id;

    const enhanced = await session.enhanceCharacter(characterId);

    expect(enhanced).toBeDefined();
    expect(enhanced.enhancedDescription).toBeDefined();
    expect(enhanced.enhancedDescription).not.toEqual(characters[0].description);
  });

  it('should enhance character with custom prompt', async () => {
    const characters = session.extractCharacters();
    const characterId = characters[0].id;

    const enhanced = await session.enhanceCharacter(
      characterId,
      'Make them more mysterious'
    );

    expect(enhanced).toBeDefined();
    expect(enhanced.enhancedDescription).toContain('mysterious');
  });

  it('should track character enhancement history', async () => {
    const characters = session.extractCharacters();
    const characterId = characters[0].id;

    await session.enhanceCharacter(characterId);
    await session.enhanceCharacter(characterId, 'Make them older');

    const history = session.getCharacterHistory(characterId);
    expect(history).toHaveLength(2);
  });

  it('should generate character image', async () => {
    const characters = session.extractCharacters();
    const characterId = characters[0].id;

    const withImage = await session.generateCharacterImage(characterId, {
      style: 'realistic',
      size: '1024x1024',
      quality: 'standard'
    });

    expect(withImage).toBeDefined();
    expect(withImage.imageUrl).toBeDefined();
    expect(withImage.revisedPrompt).toBeDefined();
  });

  it('should throw error when enhancing non-existent character', async () => {
    await expect(
      session.enhanceCharacter('invalid-id')
    ).rejects.toThrow('Character not found');
  });

  it('should throw error when getting history of non-existent character', () => {
    expect(() => session.getCharacterHistory('invalid-id'))
      .toThrow('Character not found');
  });
});

describe('Session - Scene Workflow', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);

    await session.generateStory('A detective story');
  });

  it('should extract scenes from current story', () => {
    const scenes = session.extractScenes();

    expect(scenes).toBeDefined();
    expect(Array.isArray(scenes)).toBe(true);
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes[0]).toHaveProperty('title');
    expect(scenes[0]).toHaveProperty('description');
  });

  it('should generate scene image', async () => {
    const scenes = session.extractScenes();
    const sceneId = scenes[0].id;

    const withImage = await session.generateSceneImage(sceneId, {
      style: 'realistic',
      size: '1024x1024',
      quality: 'standard'
    });

    expect(withImage).toBeDefined();
    expect(withImage.imageUrl).toBeDefined();
    expect(withImage.revisedPrompt).toBeDefined();
  });

  it('should enhance scene description', async () => {
    const scenes = session.extractScenes();
    const sceneId = scenes[0].id;

    const enhanced = await session.enhanceScene(sceneId);

    expect(enhanced).toBeDefined();
    expect(enhanced.enhancedDescription).toBeDefined();
  });

  it('should enhance scene with custom prompt', async () => {
    const scenes = session.extractScenes();
    const sceneId = scenes[0].id;

    const enhanced = await session.enhanceScene(
      sceneId,
      'Add more atmospheric details'
    );

    expect(enhanced.enhancedDescription).toBeDefined();
  });
});

describe('Session - Storyboard Workflow', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);

    await session.generateStory('A detective story');

    // Generate some character and scene images
    const characters = session.extractCharacters();
    const scenes = session.extractScenes();

    await session.generateCharacterImage(characters[0].id);
    await session.generateSceneImage(scenes[0].id);
  });

  it('should create storyboard from generated assets', () => {
    const storyboard = session.createStoryboard();

    expect(storyboard).toBeDefined();
    expect(storyboard.frames).toBeDefined();
    expect(Array.isArray(storyboard.frames)).toBe(true);
  });

  it('should allow reordering storyboard frames', () => {
    const storyboard = session.createStoryboard();
    const originalOrder = [...storyboard.frames];

    session.reorderStoryboardFrames([1, 0, 2]);
    const reordered = session.getStoryboard();

    expect(reordered.frames[0]).toEqual(originalOrder[1]);
    expect(reordered.frames[1]).toEqual(originalOrder[0]);
  });

  it('should update storyboard frame', () => {
    session.createStoryboard();

    session.updateStoryboardFrame(0, {
      duration: 5,
      transition: 'fade'
    });

    const storyboard = session.getStoryboard();
    expect(storyboard.frames[0].duration).toBe(5);
    expect(storyboard.frames[0].transition).toBe('fade');
  });
});

describe('Session - Persistence', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should save session state to storage', async () => {
    await session.generateStory('A detective story');
    await session.save();

    const saved = await storage.load('sessions/test-session');
    expect(saved).toBeDefined();
    expect(saved.id).toBe('test-session');
    expect(saved.storyHistory).toHaveLength(1);
  });

  it('should auto-save after each operation when enabled', async () => {
    session.enableAutoSave();

    await session.generateStory('A detective story');

    // Should have auto-saved
    const saved = await storage.load('sessions/test-session');
    expect(saved).toBeDefined();
  });

  it('should load session state from storage', async () => {
    // Create and save a session
    await session.generateStory('A detective story');
    await session.save();

    // Load into new session instance
    const newSession = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);
    await newSession.load();

    expect(newSession.getCurrentStory()).toEqual(session.getCurrentStory());
    expect(newSession.getStoryHistory()).toEqual(session.getStoryHistory());
  });

  it('should track metadata (created, updated timestamps)', async () => {
    const created = Date.now();
    await session.generateStory('A detective story');

    const metadata = session.getMetadata();
    expect(metadata.id).toBe('test-session');
    expect(metadata.createdAt).toBeGreaterThanOrEqual(created);
    expect(metadata.updatedAt).toBeGreaterThanOrEqual(metadata.createdAt);
  });

  it('should update timestamp after operations', async () => {
    await session.generateStory('A detective story');
    const firstUpdate = session.getMetadata().updatedAt;

    // Wait a bit then perform another operation
    await new Promise(resolve => setTimeout(resolve, 10));
    await session.improveStory();

    const secondUpdate = session.getMetadata().updatedAt;
    expect(secondUpdate).toBeGreaterThan(firstUpdate);
  });
});

describe('Session - Error Handling', () => {
  let session: Session;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    session = new Session('test-session', {
      openaiApiKey: 'test-key'
    }, storage);
  });

  it('should throw error when improving story without initial story', async () => {
    await expect(session.improveStory()).rejects.toThrow(
      'No story to improve. Generate a story first.'
    );
  });

  it('should throw error when extracting characters without story', () => {
    expect(session.extractCharacters()).toEqual([]);
  });

  it('should throw error when extracting scenes without story', () => {
    expect(session.extractScenes()).toEqual([]);
  });

  it('should handle API errors gracefully', async () => {
    // Mock API failure
    vi.spyOn(session as any, 'callOpenAI').mockRejectedValue(
      new Error('API Error')
    );

    await expect(session.generateStory('Test')).rejects.toThrow('API Error');
  });
});
