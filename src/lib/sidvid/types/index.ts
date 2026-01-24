export interface SidVidConfig {
  openaiApiKey: string;
  klingApiKey?: string;
  defaultModel?: string;
  defaultImageModel?: string;
  defaultVideoModel?: string;
}

export interface StoryOptions {
  prompt: string;
  scenes?: number;
  style?: string;
  maxTokens?: number;
}

export interface EditStoryOptions {
  currentStory: Story;
  editPrompt: string;
  length?: string;
  maxTokens?: number;
}

export interface ExpandStoryOptions {
  currentStory: Story;
  length?: string;
  maxTokens?: number;
}

export interface StoryCharacter {
  name: string;
  description: string;
  physical?: string;
  profile?: string;
}

export interface StorySceneVisual {
  sceneNumber: number;
  setting: string;
  charactersPresent: string[];
  visualDescription: string;
}

export interface Story {
  title: string;
  scenes: StoryScene[];
  rawContent: string;
  characters?: StoryCharacter[];
  sceneVisuals?: StorySceneVisual[];
}

export interface StoryScene {
  number: number;
  title?: string;
  description: string;
  dialogue?: string;
  action?: string;
}

export interface CharacterOptions {
  description: string;
  style?: 'realistic' | 'anime' | 'cartoon' | 'cinematic';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface EnhanceCharacterOptions {
  description: string;
  maxTokens?: number;
}

export interface Character {
  id?: string;
  name?: string;
  description: string;
  enhancedDescription?: string;
  imageUrl?: string;
  revisedPrompt?: string;
}

export interface SceneOptions {
  description: string;
  style?: 'realistic' | 'anime' | 'cartoon' | 'cinematic';
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'hd';
}

export interface Scene {
  id?: string;
  description: string;
  enhancedDescription?: string;
  imageUrl?: string;
  revisedPrompt?: string;
}

export interface StoryboardOptions {
  story: Story;
  characters?: Character[];
  scenes?: Scene[];
}

export interface Storyboard {
  frames: StoryboardFrame[];
}

export interface StoryboardFrame {
  sceneNumber: number;
  description: string;
  imageUrl?: string;
}

export interface VideoOptions {
  prompt: string;
  storyboard?: Storyboard;
  /** Scene image URL for image-to-video generation */
  imageUrl?: string;
  /** Duration in seconds (5 or 10 for Kling, 4/8/12 for Sora) */
  duration?: 4 | 5 | 8 | 10 | 12;
  size?: '720x1280' | '1280x720' | '1024x1792' | '1792x1024';
  /** Video generation provider */
  provider?: 'mock' | 'kling' | 'sora';
  /** Kling-specific: enable audio generation */
  sound?: boolean;
  model?: 'sora-2' | 'sora-2-pro' | 'kling-2.6';
}

export interface Video {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'generating';
  progress: number;
  url?: string;
}

// ===== Scene Pipeline Types =====

/**
 * Represents a scene slot in the generation pipeline.
 * Maps a story scene to characters and tracks generation state.
 */
export interface SceneSlot {
  id: string;
  /** Index of the source story scene (from Story.scenes) */
  storySceneIndex: number;
  /** The story scene data */
  storyScene: StoryScene;
  /** Character IDs assigned to this scene */
  characterIds: string[];
  /** Optional user-provided description override */
  customDescription?: string;
  /** Generation state */
  status: 'pending' | 'generating' | 'completed' | 'failed';
  /** Generated scene result (if completed) */
  generatedScene?: Scene;
  /** Error message if generation failed */
  error?: string;
}

/**
 * The scene generation pipeline state.
 * Tracks the mapping from story scenes to generated scene images.
 */
export interface ScenePipeline {
  /** ID of the source story (for tracking which story version this came from) */
  sourceStoryIndex: number;
  /** The scene slots in order */
  slots: SceneSlot[];
  /** When the pipeline was created */
  createdAt: number;
  /** When the pipeline was last modified */
  updatedAt: number;
}

// ===== Video Pipeline Types =====

/**
 * Represents a scene thumbnail for the video pipeline.
 */
export interface VideoSceneThumbnail {
  id: string;
  sceneNumber: number;
  imageUrl: string;
  description: string;
}

/**
 * The video generation pipeline state.
 * Tracks the video generation process from scene images to final video.
 */
export interface VideoPipeline {
  /** Current status of the video pipeline */
  status: 'idle' | 'generating' | 'completed' | 'failed';
  /** ID of the video being generated (from Sora API) */
  currentVideoId?: string;
  /** Generation progress (0-100) */
  progress: number;
  /** The generated video (if completed) */
  video?: Video;
  /** Error message if generation failed */
  error?: string;
  /** Scene thumbnails used as input */
  sceneThumbnails: VideoSceneThumbnail[];
  /** Generated video prompt */
  generatedPrompt?: string;
  /** When the pipeline was created */
  createdAt: number;
  /** When the pipeline was last updated */
  updatedAt: number;
}

// ===== API Timing Types =====

/**
 * Enumeration of API call types to track for progress estimation
 */
export type ApiCallType =
  | 'generateStory'
  | 'editStory'
  | 'enhanceDescription'
  | 'generateCharacter'
  | 'generateScene'
  | 'generateVideo';

/**
 * A single timing record for an API call
 */
export interface ApiTimingRecord {
  /** Unique identifier for this record */
  id: string;
  /** Type of API call */
  type: ApiCallType;
  /** Duration in milliseconds */
  durationMs: number;
  /** When the call started (ISO timestamp) */
  startedAt: string;
  /** When the call completed (ISO timestamp) */
  completedAt: string;
  /** Whether the call succeeded */
  success: boolean;
}

/**
 * Aggregated timing statistics for a single API call type
 */
export interface ApiTimingStats {
  type: ApiCallType;
  /** Number of recorded calls */
  count: number;
  /** Average duration in milliseconds */
  averageMs: number;
  /** Median duration in milliseconds */
  medianMs: number;
  /** Minimum observed duration */
  minMs: number;
  /** Maximum observed duration */
  maxMs: number;
}

/**
 * Complete timing data stored per user
 */
export interface ApiTimingData {
  /** Version for future migrations */
  version: 1;
  /** Raw timing records (last N per type) */
  records: ApiTimingRecord[];
  /** Cached statistics per API type */
  stats: Partial<Record<ApiCallType, ApiTimingStats>>;
  /** When data was last modified */
  updatedAt: string;
}

/**
 * Default timing estimates in milliseconds for first-time users
 */
export const DEFAULT_TIMING_ESTIMATES: Record<ApiCallType, number> = {
  generateStory: 20000,      // 20 seconds
  editStory: 20000,          // 20 seconds
  enhanceDescription: 10000, // 10 seconds
  generateCharacter: 45000,  // 45 seconds
  generateScene: 45000,      // 45 seconds
  generateVideo: 300000,     // 5 minutes
};

/** Maximum number of timing records to keep per API call type */
export const MAX_TIMING_RECORDS_PER_TYPE = 50;
