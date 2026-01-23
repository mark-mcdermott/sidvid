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
  SceneOptions,
  ScenePipeline,
  SceneSlot,
  VideoPipeline,
  VideoSceneThumbnail,
  Video,
  VideoOptions
} from './types';
import { generateStory, editStory } from './api/story';
import { generateCharacter, enhanceCharacterDescription } from './api/character';
import { generateScene } from './api/scene';
import { generateVideo, getVideoStatus, waitForVideo } from './api/video';

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

  // Scene pipeline state
  private scenePipeline?: ScenePipeline;

  // Video pipeline state
  private videoPipeline?: VideoPipeline;

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
        if (char.id) {
          this.characterMap.set(char.id, [char]);
        }
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
        if (scene.id) {
          this.sceneMap.set(scene.id, [scene]);
        }
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

  // ===== Scene Pipeline Workflow =====

  /**
   * Initialize a scene pipeline from the current story.
   * Creates a slot for each scene in the story.
   */
  initializeScenePipeline(): ScenePipeline {
    const story = this.getCurrentStory();
    if (!story) {
      throw new Error('No story available. Generate a story first.');
    }

    const slots: SceneSlot[] = story.scenes.map((scene, index) => ({
      id: `slot-${Date.now()}-${index}`,
      storySceneIndex: index,
      storyScene: scene,
      characterIds: [],
      status: 'pending' as const
    }));

    this.scenePipeline = {
      sourceStoryIndex: this.currentStoryIndex,
      slots,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.touch();
    return this.scenePipeline;
  }

  /**
   * Get the current scene pipeline state.
   */
  getScenePipeline(): ScenePipeline | undefined {
    return this.scenePipeline;
  }

  /**
   * Assign characters to a scene slot.
   */
  assignCharactersToSlot(slotId: string, characterIds: string[]): SceneSlot {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const slotIndex = this.scenePipeline.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) {
      throw new Error('Scene slot not found');
    }

    // Validate character IDs exist
    for (const charId of characterIds) {
      const exists = this.characters.some(c => c.id === charId);
      if (!exists) {
        throw new Error(`Character ${charId} not found`);
      }
    }

    this.scenePipeline.slots[slotIndex] = {
      ...this.scenePipeline.slots[slotIndex],
      characterIds
    };
    this.scenePipeline.updatedAt = Date.now();

    this.touch();
    return this.scenePipeline.slots[slotIndex];
  }

  /**
   * Set a custom description for a scene slot (overrides story scene description).
   */
  setSlotCustomDescription(slotId: string, description: string): SceneSlot {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const slotIndex = this.scenePipeline.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) {
      throw new Error('Scene slot not found');
    }

    this.scenePipeline.slots[slotIndex] = {
      ...this.scenePipeline.slots[slotIndex],
      customDescription: description
    };
    this.scenePipeline.updatedAt = Date.now();

    this.touch();
    return this.scenePipeline.slots[slotIndex];
  }

  /**
   * Add a new empty slot to the pipeline.
   */
  addSlot(afterSlotId?: string): SceneSlot {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const newSlot: SceneSlot = {
      id: `slot-${Date.now()}-custom`,
      storySceneIndex: -1, // Custom slot, not from story
      storyScene: {
        number: this.scenePipeline.slots.length + 1,
        description: ''
      },
      characterIds: [],
      status: 'pending'
    };

    if (afterSlotId) {
      const afterIndex = this.scenePipeline.slots.findIndex(s => s.id === afterSlotId);
      if (afterIndex === -1) {
        throw new Error('Slot not found');
      }
      this.scenePipeline.slots.splice(afterIndex + 1, 0, newSlot);
    } else {
      this.scenePipeline.slots.push(newSlot);
    }

    this.scenePipeline.updatedAt = Date.now();
    this.touch();
    return newSlot;
  }

  /**
   * Remove a slot from the pipeline.
   */
  removeSlot(slotId: string): void {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const index = this.scenePipeline.slots.findIndex(s => s.id === slotId);
    if (index === -1) {
      throw new Error('Scene slot not found');
    }

    this.scenePipeline.slots.splice(index, 1);
    this.scenePipeline.updatedAt = Date.now();
    this.touch();
  }

  /**
   * Reorder slots in the pipeline.
   */
  reorderSlots(newOrder: string[]): void {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const reordered = newOrder.map(id => {
      const slot = this.scenePipeline!.slots.find(s => s.id === id);
      if (!slot) {
        throw new Error(`Slot ${id} not found`);
      }
      return slot;
    });

    this.scenePipeline.slots = reordered;
    this.scenePipeline.updatedAt = Date.now();
    this.touch();
  }

  /**
   * Generate image for a single scene slot.
   */
  async generateSlotImage(slotId: string, options?: Partial<SceneOptions>): Promise<SceneSlot> {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const slotIndex = this.scenePipeline.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) {
      throw new Error('Scene slot not found');
    }

    const slot = this.scenePipeline.slots[slotIndex];

    // Build description from story scene + characters
    let description = slot.customDescription || slot.storyScene.description;

    // Add character descriptions if assigned
    if (slot.characterIds.length > 0) {
      const charDescriptions = slot.characterIds
        .map(id => this.characters.find(c => c.id === id))
        .filter(Boolean)
        .map(c => c!.enhancedDescription || c!.description)
        .join('. ');

      if (charDescriptions) {
        description = `${description}. Characters in scene: ${charDescriptions}`;
      }
    }

    // Update status to generating
    this.scenePipeline.slots[slotIndex] = {
      ...slot,
      status: 'generating'
    };
    this.scenePipeline.updatedAt = Date.now();

    try {
      const result = await generateScene(this.client, {
        description,
        style: options?.style || 'cinematic',
        aspectRatio: options?.aspectRatio || '16:9',
        quality: options?.quality || 'standard'
      });

      this.scenePipeline.slots[slotIndex] = {
        ...this.scenePipeline.slots[slotIndex],
        status: 'completed',
        generatedScene: {
          description,
          imageUrl: result.imageUrl,
          revisedPrompt: result.revisedPrompt
        },
        error: undefined
      };
    } catch (error) {
      this.scenePipeline.slots[slotIndex] = {
        ...this.scenePipeline.slots[slotIndex],
        status: 'failed',
        error: error instanceof Error ? error.message : 'Generation failed'
      };
    }

    this.scenePipeline.updatedAt = Date.now();
    this.touch();
    await this.autoSaveIfEnabled();

    return this.scenePipeline.slots[slotIndex];
  }

  /**
   * Generate images for all pending slots in the pipeline.
   */
  async generateAllPendingSlots(options?: Partial<SceneOptions>): Promise<SceneSlot[]> {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const pendingSlots = this.scenePipeline.slots.filter(s => s.status === 'pending');
    const results: SceneSlot[] = [];

    for (const slot of pendingSlots) {
      const result = await this.generateSlotImage(slot.id, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Regenerate a specific slot (reset to pending and generate again).
   */
  async regenerateSlot(slotId: string, options?: Partial<SceneOptions>): Promise<SceneSlot> {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize it first.');
    }

    const slotIndex = this.scenePipeline.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) {
      throw new Error('Scene slot not found');
    }

    // Reset to pending first
    this.scenePipeline.slots[slotIndex] = {
      ...this.scenePipeline.slots[slotIndex],
      status: 'pending',
      generatedScene: undefined,
      error: undefined
    };

    // Generate new image
    return this.generateSlotImage(slotId, options);
  }

  /**
   * Clear the scene pipeline (start fresh).
   */
  clearScenePipeline(): void {
    this.scenePipeline = undefined;
    this.touch();
  }

  // ===== Video Pipeline Workflow =====

  /**
   * Initialize the video pipeline from completed scene slots.
   * Collects all completed scene images as thumbnails for video generation.
   */
  initializeVideoPipeline(): VideoPipeline {
    if (!this.scenePipeline) {
      throw new Error('No scene pipeline. Initialize and generate scene images first.');
    }

    const completedSlots = this.scenePipeline.slots.filter(
      s => s.status === 'completed' && s.generatedScene?.imageUrl
    );

    if (completedSlots.length === 0) {
      throw new Error('No completed scene images. Generate scene images first.');
    }

    const sceneThumbnails: VideoSceneThumbnail[] = completedSlots.map(slot => ({
      id: slot.id,
      sceneNumber: slot.storyScene.number,
      imageUrl: slot.generatedScene!.imageUrl!, // Already filtered to ensure imageUrl exists
      description: slot.customDescription || slot.storyScene.description
    }));

    this.videoPipeline = {
      status: 'idle',
      progress: 0,
      sceneThumbnails,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.touch();
    return this.videoPipeline;
  }

  /**
   * Get the current video pipeline state.
   */
  getVideoPipeline(): VideoPipeline | undefined {
    return this.videoPipeline;
  }

  /**
   * Build a video prompt from the scene thumbnails and story.
   */
  buildVideoPrompt(): string {
    if (!this.videoPipeline) {
      throw new Error('No video pipeline. Initialize it first.');
    }

    const story = this.getCurrentStory();
    const storyContext = story ? `Story: "${story.title}". ` : '';

    const sceneDescriptions = this.videoPipeline.sceneThumbnails
      .map(t => `Scene ${t.sceneNumber}: ${t.description}`)
      .join('. ');

    return `${storyContext}Create a cinematic video showing: ${sceneDescriptions}`;
  }

  /**
   * Generate a video from the scene pipeline.
   * This starts the video generation and returns immediately with the video ID.
   */
  async generateVideo(options?: Partial<VideoOptions>): Promise<Video> {
    if (!this.videoPipeline) {
      // Auto-initialize if scene pipeline exists
      this.initializeVideoPipeline();
    }

    if (!this.videoPipeline) {
      throw new Error('Cannot generate video without scene images.');
    }

    // Build prompt from scenes
    const prompt = options?.prompt || this.buildVideoPrompt();
    this.videoPipeline.generatedPrompt = prompt;

    // Update status to generating
    this.videoPipeline.status = 'generating';
    this.videoPipeline.progress = 0;
    this.videoPipeline.updatedAt = Date.now();

    try {
      const video = await generateVideo(this.client, {
        prompt,
        duration: options?.duration || 8,
        size: options?.size || '1280x720',
        model: options?.model || 'sora-2'
      });

      this.videoPipeline.currentVideoId = video.id;
      this.videoPipeline.progress = video.progress;
      this.videoPipeline.updatedAt = Date.now();

      this.touch();
      await this.autoSaveIfEnabled();

      return video;
    } catch (error) {
      this.videoPipeline.status = 'failed';
      this.videoPipeline.error = error instanceof Error ? error.message : 'Video generation failed';
      this.videoPipeline.updatedAt = Date.now();
      this.touch();
      throw error;
    }
  }

  /**
   * Check the status of the current video generation.
   */
  async checkVideoStatus(): Promise<Video> {
    if (!this.videoPipeline?.currentVideoId) {
      throw new Error('No video generation in progress.');
    }

    const video = await getVideoStatus(this.client, this.videoPipeline.currentVideoId);

    this.videoPipeline.progress = video.progress;
    this.videoPipeline.updatedAt = Date.now();

    if (video.status === 'completed') {
      this.videoPipeline.status = 'completed';
      this.videoPipeline.video = video;
    } else if (video.status === 'failed') {
      this.videoPipeline.status = 'failed';
      this.videoPipeline.error = 'Video generation failed';
    }

    this.touch();
    return video;
  }

  /**
   * Wait for the current video generation to complete.
   * Polls the video status until completed or failed.
   */
  async waitForVideoCompletion(options?: { pollInterval?: number; timeout?: number }): Promise<Video> {
    if (!this.videoPipeline?.currentVideoId) {
      throw new Error('No video generation in progress.');
    }

    const video = await waitForVideo(this.client, this.videoPipeline.currentVideoId, options);

    this.videoPipeline.status = 'completed';
    this.videoPipeline.video = video;
    this.videoPipeline.progress = 100;
    this.videoPipeline.updatedAt = Date.now();

    this.touch();
    await this.autoSaveIfEnabled();

    return video;
  }

  /**
   * Reset the video pipeline to regenerate.
   */
  resetVideoPipeline(): void {
    if (this.videoPipeline) {
      this.videoPipeline.status = 'idle';
      this.videoPipeline.currentVideoId = undefined;
      this.videoPipeline.video = undefined;
      this.videoPipeline.progress = 0;
      this.videoPipeline.error = undefined;
      this.videoPipeline.generatedPrompt = undefined;
      this.videoPipeline.updatedAt = Date.now();
      this.touch();
    }
  }

  /**
   * Clear the video pipeline entirely.
   */
  clearVideoPipeline(): void {
    this.videoPipeline = undefined;
    this.touch();
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
          sourceId: char.id || ''
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
          sourceId: scene.id || ''
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
      scenePipeline: this.scenePipeline,
      videoPipeline: this.videoPipeline,
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
    this.scenePipeline = data.scenePipeline;
    this.videoPipeline = data.videoPipeline;
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
