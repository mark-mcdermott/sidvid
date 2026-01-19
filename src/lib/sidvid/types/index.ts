export interface SidVidConfig {
  openaiApiKey: string;
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

export interface StoryCharacter {
  name: string;
  description: string;
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
  description: string;
  imageUrl: string;
  revisedPrompt?: string;
}

export interface SceneOptions {
  description: string;
  style?: 'realistic' | 'anime' | 'cartoon' | 'cinematic';
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'hd';
}

export interface Scene {
  description: string;
  imageUrl: string;
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
  duration?: 4 | 8 | 12;
  size?: '720x1280' | '1280x720' | '1024x1792' | '1792x1024';
  model?: 'sora-2' | 'sora-2-pro';
}

export interface Video {
  id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  url?: string;
}
