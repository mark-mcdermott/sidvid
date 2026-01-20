import OpenAI from 'openai';
import type { StorageAdapter } from './storage/adapter';
import type {
  SidVidConfig,
  Story,
  Character,
  Scene,
  StoryCharacter,
  StoryScene,
  CharacterOptions,
  SceneOptions
} from './types';
import { generateStory, editStory } from './api/story';
import { generateCharacter, enhanceCharacterDescription } from './api/character';
import { generateScene } from './api/scene';

export interface SessionMetadata {
  id: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
  storyCount?: number;
  characterCount?: number;
}

export interface StoryboardFrame {
  id: string;
  imageUrl: string;
  type: 'character' | 'scene';
  sourceId: string;
  duration?: number;
  transition?: string;
}

export interface Storyboard {
  frames: StoryboardFrame[];
}

export class Session {
  private id: string;
  private name?: string;
  private client: OpenAI;
  private storage: StorageAdapter;
  private autoSave: boolean = false;

  // Story state
  private storyHistory: Story[] = [];
  private currentStoryIndex: number = -1;

  // Character state
  private characterMap = new Map<string, Character[]>(); // characterId -> history
  private characters: Character[] = [];

  // Scene state
  private sceneMap = new Map<string, Scene[]>(); // sceneId -> history
  private scenes: Scene[] = [];

  // Storyboard state
  private storyboard?: Storyboard;

  // Metadata
  private createdAt: number;
  private updatedAt: number;

  constructor(id: string, config: SidVidConfig, storage: StorageAdapter, name?: string) {
    this.id = id;
    this.name = name;
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.storage = storage;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  // ===== Core Methods =====

  getId(): string {
    return this.id;
  }

  getName(): string | undefined {
    return this.name;
  }

  setName(name: string): void {
    this.name = name;
    this.touch();
  }

  enableAutoSave(): void {
    this.autoSave = true;
  }

  disableAutoSave(): void {
    this.autoSave = false;
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }

  private async autoSaveIfEnabled(): Promise<void> {
    if (this.autoSave) {
      await this.save();
    }
  }

  // ===== Story Workflow =====

  async generateStory(prompt: string, options?: { scenes?: number }): Promise<Story> {
    const story = await generateStory(this.client, {
      prompt,
      scenes: options?.scenes || 5
    });

    this.storyHistory.push(story);
    this.currentStoryIndex = this.storyHistory.length - 1;

    // Extract characters and scenes
    if (story.characters) {
      this.characters = story.characters.map((char, index) => ({
        id: `char-${Date.now()}-${index}`,
        name: char.name,
        description: char.description
      }));

      // Initialize character history
      this.characters.forEach(char => {
        this.characterMap.set(char.id, [char]);
      });
    }

    if (story.scenes) {
      this.scenes = story.scenes.map((scene, index) => ({
        id: `scene-${Date.now()}-${index}`,
        title: scene.title || `Scene ${scene.number}`,
        description: scene.description
      }));

      // Initialize scene history
      this.scenes.forEach(scene => {
        this.sceneMap.set(scene.id, [scene]);
      });
    }

    this.touch();
    await this.autoSaveIfEnabled();

    return story;
  }

  async improveStory(prompt?: string): Promise<Story> {
    if (this.currentStoryIndex === -1) {
      throw new Error('No story to improve. Generate a story first.');
    }

    const currentStory = this.storyHistory[this.currentStoryIndex];
    const editPrompt = prompt || 'Improve this story and make it more engaging';

    const story = await editStory(this.client, {
      currentStory,
      editPrompt,
      length: '5s'
    });

    this.storyHistory.push(story);
    this.currentStoryIndex = this.storyHistory.length - 1;

    // Update characters and scenes
    if (story.characters) {
      this.characters = story.characters.map((char, index) => ({
        id: `char-${Date.now()}-${index}`,
        name: char.name,
        description: char.description
      }));
    }

    if (story.scenes) {
      this.scenes = story.scenes.map((scene, index) => ({
        id: `scene-${Date.now()}-${index}`,
        title: scene.title || `Scene ${scene.number}`,
        description: scene.description
      }));
    }

    this.touch();
    await this.autoSaveIfEnabled();

    return story;
  }

  getCurrentStory(): Story | null {
    if (this.currentStoryIndex === -1) {
      return null;
    }
    return this.storyHistory[this.currentStoryIndex];
  }

  getStoryHistory(): Story[] {
    return [...this.storyHistory];
  }

  revertToStory(index: number): void {
    if (index < 0 || index >= this.storyHistory.length) {
      throw new Error('Invalid story index');
    }

    // Remove all stories after the target index
    this.storyHistory = this.storyHistory.slice(0, index + 1);
    this.currentStoryIndex = index;

    this.touch();
  }

  // ===== Character Workflow =====

  extractCharacters(): Character[] {
    return [...this.characters];
  }

  async enhanceCharacter(characterId: string, prompt?: string): Promise<Character> {
    const character = this.characters.find(c => c.id === characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    const description = prompt
      ? `${character.description}. Additionally: ${prompt}`
      : character.description;

    const enhancedDescription = await enhanceCharacterDescription(this.client, {
      description
    });

    const enhanced: Character = {
      ...character,
      enhancedDescription
    };

    // Update character in list
    const index = this.characters.findIndex(c => c.id === characterId);
    this.characters[index] = enhanced;

    // Add to history
    const history = this.characterMap.get(characterId) || [];
    history.push(enhanced);
    this.characterMap.set(characterId, history);

    this.touch();
    await this.autoSaveIfEnabled();

    return enhanced;
  }

  async generateCharacterImage(
    characterId: string,
    options?: Partial<CharacterOptions>
  ): Promise<Character> {
    const character = this.characters.find(c => c.id === characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    const description = character.enhancedDescription || character.description;

    const result = await generateCharacter(this.client, {
      description,
      style: options?.style || 'realistic',
      size: options?.size || '1024x1024',
      quality: options?.quality || 'standard'
    });

    const withImage: Character = {
      ...character,
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt
    };

    // Update character in list
    const index = this.characters.findIndex(c => c.id === characterId);
    this.characters[index] = withImage;

    // Add to history
    const history = this.characterMap.get(characterId) || [];
    history.push(withImage);
    this.characterMap.set(characterId, history);

    this.touch();
    await this.autoSaveIfEnabled();

    return withImage;
  }

  getCharacterHistory(characterId: string): Character[] {
    const history = this.characterMap.get(characterId);
    if (!history) {
      throw new Error('Character not found');
    }
    return [...history];
  }

  // ===== Scene Workflow =====

  extractScenes(): Scene[] {
    return [...this.scenes];
  }

  async generateSceneImage(
    sceneId: string,
    options?: Partial<SceneOptions>
  ): Promise<Scene> {
    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) {
      throw new Error('Scene not found');
    }

    const description = scene.enhancedDescription || scene.description;

    const result = await generateScene(this.client, {
      description,
      style: options?.style || 'cinematic',
      aspectRatio: options?.aspectRatio || '16:9',
      size: options?.size || '1024x1024',
      quality: options?.quality || 'standard'
    });

    const withImage: Scene = {
      ...scene,
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt
    };

    // Update scene in list
    const index = this.scenes.findIndex(s => s.id === sceneId);
    this.scenes[index] = withImage;

    // Add to history
    const history = this.sceneMap.get(sceneId) || [];
    history.push(withImage);
    this.sceneMap.set(sceneId, history);

    this.touch();
    await this.autoSaveIfEnabled();

    return withImage;
  }

  async enhanceScene(sceneId: string, prompt?: string): Promise<Scene> {
    const scene = this.scenes.find(s => s.id === sceneId);
    if (!scene) {
      throw new Error('Scene not found');
    }

    const description = prompt
      ? `${scene.description}. Additionally: ${prompt}`
      : scene.description;

    const enhancedDescription = await enhanceCharacterDescription(this.client, {
      description
    });

    const enhanced: Scene = {
      ...scene,
      enhancedDescription
    };

    // Update scene in list
    const index = this.scenes.findIndex(s => s.id === sceneId);
    this.scenes[index] = enhanced;

    // Add to history
    const history = this.sceneMap.get(sceneId) || [];
    history.push(enhanced);
    this.sceneMap.set(sceneId, history);

    this.touch();
    await this.autoSaveIfEnabled();

    return enhanced;
  }

  // ===== Storyboard Workflow =====

  createStoryboard(): Storyboard {
    const frames: StoryboardFrame[] = [];

    // Add character frames
    this.characters.forEach(char => {
      if (char.imageUrl) {
        frames.push({
          id: `frame-${Date.now()}-${char.id}`,
          imageUrl: char.imageUrl,
          type: 'character',
          sourceId: char.id
        });
      }
    });

    // Add scene frames
    this.scenes.forEach(scene => {
      if (scene.imageUrl) {
        frames.push({
          id: `frame-${Date.now()}-${scene.id}`,
          imageUrl: scene.imageUrl,
          type: 'scene',
          sourceId: scene.id
        });
      }
    });

    this.storyboard = { frames };
    this.touch();

    return this.storyboard;
  }

  reorderStoryboardFrames(newOrder: number[]): void {
    if (!this.storyboard) {
      throw new Error('No storyboard exists');
    }

    const reordered = newOrder.map(index => this.storyboard!.frames[index]);
    this.storyboard.frames = reordered;
    this.touch();
  }

  updateStoryboardFrame(index: number, updates: Partial<StoryboardFrame>): void {
    if (!this.storyboard) {
      throw new Error('No storyboard exists');
    }

    if (index < 0 || index >= this.storyboard.frames.length) {
      throw new Error('Invalid frame index');
    }

    this.storyboard.frames[index] = {
      ...this.storyboard.frames[index],
      ...updates
    };
    this.touch();
  }

  getStoryboard(): Storyboard | undefined {
    return this.storyboard;
  }

  // ===== Persistence =====

  async save(): Promise<void> {
    const data = {
      id: this.id,
      name: this.name,
      storyHistory: this.storyHistory,
      currentStoryIndex: this.currentStoryIndex,
      characters: this.characters,
      characterMap: Array.from(this.characterMap.entries()),
      scenes: this.scenes,
      sceneMap: Array.from(this.sceneMap.entries()),
      storyboard: this.storyboard,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };

    await this.storage.save(`sessions/${this.id}`, data);
  }

  async load(): Promise<void> {
    const data = await this.storage.load(`sessions/${this.id}`);

    this.name = data.name;
    this.storyHistory = data.storyHistory || [];
    this.currentStoryIndex = data.currentStoryIndex ?? -1;
    this.characters = data.characters || [];
    this.characterMap = new Map(data.characterMap || []);
    this.scenes = data.scenes || [];
    this.sceneMap = new Map(data.sceneMap || []);
    this.storyboard = data.storyboard;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  getMetadata(): SessionMetadata {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      storyCount: this.storyHistory.length,
      characterCount: this.characters.length
    };
  }
}
