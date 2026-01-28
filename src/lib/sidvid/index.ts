export { SidVid } from './client';
export { Session, type SessionMetadata } from './session';
export { SessionManager } from './session-manager';
export { ProjectManager } from './project-manager';
export { StoryManager, STYLE_PROMPTS, type CreateStoryOptions, type StoryGenerationResult } from './story-manager';
export { MemoryStorageAdapter } from './storage/memory-adapter';
// FileStorageAdapter is NOT exported here because it uses fs/promises which
// can't be bundled for browser code. Import directly from './storage/file-adapter'
// in server/CLI contexts only.
export { BrowserStorageAdapter } from './storage/browser-adapter';
export type { StorageAdapter } from './storage/adapter';

// Video generation API
export { initKlingClient } from './api/video';
export { KlingClient } from './api/kling';

// Image generation API with reference support
export { FluxKontextClient } from './api/flux-kontext';
export type { FluxKontextConfig, FluxKontextGenerateOptions } from './api/flux-kontext';

export type {
  SidVidConfig,
  StoryOptions,
  EditStoryOptions,
  Story,
  StoryScene,
  StoryCharacter,
  StorySceneVisual,
  CharacterOptions,
  EnhanceCharacterOptions,
  Character,
  SceneOptions,
  Scene,
  StoryboardOptions,
  Storyboard,
  StoryboardFrame,
  VideoOptions,
  Video,
  ScenePipeline,
  SceneSlot,
  VideoPipeline,
  VideoSceneThumbnail,
  // Flux Kontext types (for image generation with references)
  FluxKontextModel,
  FluxKontextAspectRatio,
  FluxKontextOutputFormat,
  FluxKontextImageOptions,
  FluxKontextImage,
  // Project types (SCHEMAS-SPEC.md)
  StylePreset,
  Style,
  ElementType,
  ElementImage,
  WorldElementVersion,
  WorldElement,
  StoryLocation,
  StoryObject,
  StoryConcept,
  ProjectStoryScene,
  ProjectStoryCharacter,
  ProjectStory,
  SceneStatus,
  SceneImage,
  ProjectScene,
  VideoStatus,
  VideoVersion,
  ProjectVideo,
  Project,
  ProjectSummary,
} from './types';

export {
  sidVidConfigSchema,
  storyOptionsSchema,
  characterOptionsSchema,
  sceneOptionsSchema,
  videoOptionsSchema,
  fluxKontextImageOptionsSchema,
} from './schemas';
