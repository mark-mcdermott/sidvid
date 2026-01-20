export { SidVid } from './client';
export { Session, type SessionMetadata } from './session';
export { SessionManager } from './session-manager';
export { MemoryStorageAdapter } from './storage/memory-adapter';
export type { StorageAdapter } from './storage/adapter';

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
} from './types';

export {
  sidVidConfigSchema,
  storyOptionsSchema,
  characterOptionsSchema,
  sceneOptionsSchema,
  videoOptionsSchema,
} from './schemas';
