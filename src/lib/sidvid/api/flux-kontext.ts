/**
 * Flux Kontext API client for image generation with reference image support.
 * Uses the Kie.ai API endpoint which provides access to Flux Kontext models.
 *
 * Key features:
 * - Text-to-image generation
 * - Image editing with reference images for character consistency
 * - Multiple aspect ratios and output formats
 */

export interface FluxKontextConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface FluxKontextGenerateOptions {
  /** Text description for generation or editing */
  prompt: string;
  /** Reference image URL for editing mode (maintains character consistency) */
  inputImage?: string;
  /** Aspect ratio: 16:9 (default), 21:9, 4:3, 1:1, 3:4, 9:16, 16:21 */
  aspectRatio?: '16:9' | '21:9' | '4:3' | '1:1' | '3:4' | '9:16' | '16:21';
  /** Model: flux-kontext-pro (default) or flux-kontext-max for higher quality */
  model?: 'flux-kontext-pro' | 'flux-kontext-max';
  /** Output format: jpeg (default) or png */
  outputFormat?: 'jpeg' | 'png';
  /** Safety tolerance: 0-6 for generation, 0-2 for editing */
  safetyTolerance?: number;
  /** Enable prompt translation to English */
  enableTranslation?: boolean;
  /** Enable prompt upsampling for better results */
  promptUpsampling?: boolean;
  /** Callback URL for task completion notifications */
  callBackUrl?: string;
}

export interface FluxKontextCreateResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

export interface FluxKontextStatusResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    successFlag: 0 | 1 | 2 | 3; // 0=GENERATING, 1=SUCCESS, 2=CREATE_FAILED, 3=GENERATE_FAILED
    response?: {
      resultImageUrl?: string;
      originImageUrl?: string;
    };
  };
}

export interface FluxKontextImage {
  id: string;
  status: 'generating' | 'completed' | 'failed';
  imageUrl?: string;
  progress: number;
}

/**
 * Flux Kontext API client for image generation with reference images.
 * Enables character consistency across multiple generations.
 */
export class FluxKontextClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: FluxKontextConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.kie.ai';
  }

  /**
   * Create an image generation task.
   * If inputImage is provided, the image will be edited/modified while
   * maintaining character consistency.
   */
  async createTask(options: FluxKontextGenerateOptions): Promise<string> {
    const body: Record<string, unknown> = {
      prompt: options.prompt,
      model: options.model || 'flux-kontext-pro',
      aspectRatio: options.aspectRatio || '16:9',
      outputFormat: options.outputFormat || 'jpeg',
      enableTranslation: options.enableTranslation ?? true,
      promptUpsampling: options.promptUpsampling ?? false,
    };

    // Add reference image if provided (for character consistency)
    if (options.inputImage) {
      body.inputImage = options.inputImage;
      // Use lower safety tolerance for editing mode
      body.safetyTolerance = options.safetyTolerance ?? 2;
    } else {
      body.safetyTolerance = options.safetyTolerance ?? 2;
    }

    if (options.callBackUrl) {
      body.callBackUrl = options.callBackUrl;
    }

    console.log(`[Flux Kontext] Creating task with prompt: ${options.prompt.substring(0, 100)}...`);
    if (options.inputImage) {
      console.log(`[Flux Kontext] Using reference image: ${options.inputImage}`);
    }

    const response = await fetch(`${this.baseUrl}/api/v1/flux/kontext/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flux Kontext API error: ${response.status} - ${errorText}`);
    }

    const result: FluxKontextCreateResponse = await response.json();

    if (result.code !== 200 || !result.data?.taskId) {
      throw new Error(`Flux Kontext API error: ${result.msg || 'Unknown error'}`);
    }

    console.log(`[Flux Kontext] Task created: ${result.data.taskId}`);
    return result.data.taskId;
  }

  /**
   * Get the status of an image generation task.
   */
  async getTaskStatus(taskId: string): Promise<FluxKontextStatusResponse['data']> {
    console.log(`[Flux Kontext] Getting task status for: ${taskId}`);

    const response = await fetch(
      `${this.baseUrl}/api/v1/flux/kontext/record-info?taskId=${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Flux Kontext] Error response: ${response.status} - ${errorText}`);
      throw new Error(`Flux Kontext API error: ${response.status} - ${errorText}`);
    }

    const result: FluxKontextStatusResponse = await response.json();
    console.log(`[Flux Kontext] Task status response:`, result);

    if (result.code !== 200 || !result.data) {
      throw new Error(`Flux Kontext API error: ${result.msg || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Check the status of an image generation task and return normalized result.
   */
  async checkImageStatus(taskId: string): Promise<FluxKontextImage> {
    const taskData = await this.getTaskStatus(taskId);

    const mapStatus = (
      successFlag: number | undefined
    ): FluxKontextImage['status'] => {
      switch (successFlag) {
        case 0:
          return 'generating';
        case 1:
          return 'completed';
        case 2:
        case 3:
          return 'failed';
        default:
          return 'generating';
      }
    };

    const status = mapStatus(taskData?.successFlag);
    const progress =
      status === 'completed' ? 100 : status === 'failed' ? 0 : 50;

    return {
      id: taskId,
      status,
      imageUrl: taskData?.response?.resultImageUrl,
      progress,
    };
  }

  /**
   * Generate an image from a text prompt.
   * Returns immediately with a task ID for polling.
   */
  async generateImage(options: FluxKontextGenerateOptions): Promise<FluxKontextImage> {
    const taskId = await this.createTask(options);

    return {
      id: taskId,
      status: 'generating',
      progress: 0,
      imageUrl: undefined,
    };
  }

  /**
   * Generate a scene image with character reference images for consistency.
   * Pass character image URLs as inputImage to maintain visual consistency.
   */
  async generateSceneWithReferences(
    scenePrompt: string,
    characterImageUrl: string,
    options?: Partial<FluxKontextGenerateOptions>
  ): Promise<FluxKontextImage> {
    return this.generateImage({
      prompt: scenePrompt,
      inputImage: characterImageUrl,
      aspectRatio: options?.aspectRatio || '16:9',
      model: options?.model || 'flux-kontext-max', // Use max for better character consistency
      ...options,
    });
  }

  /**
   * Wait for an image generation task to complete.
   */
  async waitForImage(
    taskId: string,
    options: { pollInterval?: number; timeout?: number } = {}
  ): Promise<FluxKontextImage> {
    const { pollInterval = 3000, timeout = 120000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const image = await this.checkImageStatus(taskId);

      if (image.status === 'completed') {
        console.log(`[Flux Kontext] Image completed: ${taskId}`);
        return image;
      }

      if (image.status === 'failed') {
        throw new Error(`Image generation failed for ID: ${taskId}`);
      }

      console.log(`[Flux Kontext] Image ${taskId} progress: ${image.progress}%`);
      await sleep(pollInterval);
    }

    throw new Error(`Image generation timed out after ${timeout}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
