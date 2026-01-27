export { SidVid } from './client';
export { Session, type SessionMetadata } from './session';
export { SessionManager } from './session-manager';
export { ProjectManager } from './project-manager';
export { MemoryStorageAdapter } from './storage/memory-adapter';
// FileStorageAdapter is NOT exported here because it uses fs/promises which
// can't be bundled for browser code. Import directly from './storage/file-adapter'
// in server/CLI contexts only.
export { BrowserStorageAdapter } from './storage/browser-adapter';
export type { StorageAdapter } from './storage/adapter';

// Video generation API
export { initKlingClient } from './api/video';
export { KlingClient } from './api/kling';

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
} from './schemas';
