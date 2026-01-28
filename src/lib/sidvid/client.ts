import OpenAI from 'openai';
import type {
  SidVidConfig,
  StoryOptions,
  EditStoryOptions,
  ExpandStoryOptions,
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
  FluxKontextImageOptions,
  FluxKontextImage,
} from './types';
import { sidVidConfigSchema } from './schemas';
import { generateStory, editStory, expandStory } from './api/story';
import { generateCharacter, enhanceCharacterDescription } from './api/character';
import { generateScene } from './api/scene';
import { generateStoryboard } from './api/storyboard';
import { generateVideo, getVideoStatus, waitForVideo } from './api/video';
import { FluxKontextClient } from './api/flux-kontext';

export class SidVid {
  private client: OpenAI;
  private fluxKontextClient: FluxKontextClient | null = null;

  constructor(config: SidVidConfig) {
    const validated = sidVidConfigSchema.parse(config);
    this.client = new OpenAI({ apiKey: validated.openaiApiKey });

    // Initialize Flux Kontext client if Kie.ai API key is provided
    const kieApiKey = validated.kieApiKey || validated.klingApiKey;
    if (kieApiKey) {
      this.fluxKontextClient = new FluxKontextClient({ apiKey: kieApiKey });
    }
  }

  async generateStory(options: StoryOptions): Promise<Story> {
    return generateStory(this.client, options);
  }

  async editStory(options: EditStoryOptions): Promise<Story> {
    return editStory(this.client, options);
  }

  async expandStory(options: ExpandStoryOptions): Promise<Story> {
    return expandStory(this.client, options);
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

  // ===== Flux Kontext Image Generation (with reference support) =====

  /**
   * Generate an image using Flux Kontext.
   * Optionally provide a reference image URL to maintain character consistency.
   */
  async generateFluxKontextImage(options: FluxKontextImageOptions): Promise<FluxKontextImage> {
    if (!this.fluxKontextClient) {
      throw new Error('Flux Kontext client not initialized. Provide kieApiKey in config.');
    }
    return this.fluxKontextClient.generateImage({
      prompt: options.prompt,
      inputImage: options.referenceImageUrl,
      aspectRatio: options.aspectRatio,
      model: options.model,
      outputFormat: options.outputFormat,
      safetyTolerance: options.safetyTolerance,
      promptUpsampling: options.promptUpsampling,
    });
  }

  /**
   * Generate a scene image using a character reference image for consistency.
   * The character's appearance will be maintained in the scene.
   */
  async generateSceneWithCharacterReference(
    scenePrompt: string,
    characterImageUrl: string,
    options?: Partial<FluxKontextImageOptions>
  ): Promise<FluxKontextImage> {
    if (!this.fluxKontextClient) {
      throw new Error('Flux Kontext client not initialized. Provide kieApiKey in config.');
    }
    return this.fluxKontextClient.generateSceneWithReferences(
      scenePrompt,
      characterImageUrl,
      {
        aspectRatio: options?.aspectRatio,
        model: options?.model,
        outputFormat: options?.outputFormat,
        safetyTolerance: options?.safetyTolerance,
        promptUpsampling: options?.promptUpsampling,
      }
    );
  }

  /**
   * Check the status of a Flux Kontext image generation task.
   */
  async getFluxKontextImageStatus(taskId: string): Promise<FluxKontextImage> {
    if (!this.fluxKontextClient) {
      throw new Error('Flux Kontext client not initialized. Provide kieApiKey in config.');
    }
    return this.fluxKontextClient.checkImageStatus(taskId);
  }

  /**
   * Wait for a Flux Kontext image generation task to complete.
   */
  async waitForFluxKontextImage(
    taskId: string,
    options?: { pollInterval?: number; timeout?: number }
  ): Promise<FluxKontextImage> {
    if (!this.fluxKontextClient) {
      throw new Error('Flux Kontext client not initialized. Provide kieApiKey in config.');
    }
    return this.fluxKontextClient.waitForImage(taskId, options);
  }
}
