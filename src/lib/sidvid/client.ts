import OpenAI from 'openai';
import type {
  SidVidConfig,
  StoryOptions,
  EditStoryOptions,
  Story,
  CharacterOptions,
  EnhanceCharacterOptions,
  Character,
  SceneOptions,
  Scene,
  StoryboardOptions,
  Storyboard,
  VideoOptions,
  Video,
} from './types';
import { sidVidConfigSchema } from './schemas';
import { generateStory, editStory } from './api/story';
import { generateCharacter, enhanceCharacterDescription } from './api/character';
import { generateScene } from './api/scene';
import { generateStoryboard } from './api/storyboard';
import { generateVideo, getVideoStatus, waitForVideo } from './api/video';

export class SidVid {
  private client: OpenAI;

  constructor(config: SidVidConfig) {
    const validated = sidVidConfigSchema.parse(config);
    this.client = new OpenAI({ apiKey: validated.openaiApiKey });
  }

  async generateStory(options: StoryOptions): Promise<Story> {
    return generateStory(this.client, options);
  }

  async editStory(options: EditStoryOptions): Promise<Story> {
    return editStory(this.client, options);
  }

  async generateCharacter(options: CharacterOptions): Promise<Character> {
    return generateCharacter(this.client, options);
  }

  async enhanceCharacterDescription(options: EnhanceCharacterOptions): Promise<string> {
    return enhanceCharacterDescription(this.client, options);
  }

  async generateScene(options: SceneOptions): Promise<Scene> {
    return generateScene(this.client, options);
  }

  async generateStoryboard(options: StoryboardOptions): Promise<Storyboard> {
    return generateStoryboard(this.client, options);
  }

  async generateVideo(options: VideoOptions): Promise<Video> {
    return generateVideo(this.client, options);
  }

  async getVideoStatus(videoId: string): Promise<Video> {
    return getVideoStatus(this.client, videoId);
  }

  async waitForVideo(
    videoId: string,
    options?: { pollInterval?: number; timeout?: number }
  ): Promise<Video> {
    return waitForVideo(this.client, videoId, options);
  }
}
