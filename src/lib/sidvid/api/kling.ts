import type { Video, VideoSceneThumbnail } from '../types';

export interface KlingConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface KlingTaskInput {
  prompt: string;
  image_urls: string[];
  sound: boolean;
  duration: '5' | '10';
}

export interface KlingCreateTaskRequest {
  model: 'kling-2.6/image-to-video';
  callBackUrl?: string;
  input: KlingTaskInput;
}

export interface KlingCreateTaskResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

export interface KlingTaskStatus {
  code: number;
  msg: string;
  data?: {
    taskId: string;
    model: string;
    state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
    param?: string;
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    createTime?: number;
    updateTime?: number;
    completeTime?: number;
  };
}

/**
 * Kling AI API client for video generation.
 * Uses the Kie.ai API endpoint which provides access to Kling 2.6 with audio support.
 */
export class KlingClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: KlingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.kie.ai';
  }

  /**
   * Create a video generation task from an image and prompt.
   */
  async createTask(options: {
    prompt: string;
    imageUrl: string;
    sound?: boolean;
    duration?: '5' | '10';
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kling-2.6/image-to-video',
        input: {
          prompt: options.prompt,
          image_urls: [options.imageUrl],
          sound: options.sound ?? true,
          duration: options.duration || '5',
        },
      } satisfies KlingCreateTaskRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kling API error: ${response.status} - ${errorText}`);
    }

    const result: KlingCreateTaskResponse = await response.json();

    if (result.code !== 200 || !result.data?.taskId) {
      throw new Error(`Kling API error: ${result.msg || 'Unknown error'}`);
    }

    return result.data.taskId;
  }

  /**
   * Get the status of a video generation task.
   */
  async getTaskStatus(taskId: string): Promise<KlingTaskStatus['data']> {
    console.log(`[Kling API] Getting task status for: ${taskId}`);

    const response = await fetch(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Kling API] Error response: ${response.status} - ${errorText}`);
      throw new Error(`Kling API error: ${response.status} - ${errorText}`);
    }

    const result: KlingTaskStatus = await response.json();
    console.log(`[Kling API] Task status response:`, result);

    if (result.code !== 200 || !result.data) {
      throw new Error(`Kling API error: ${result.msg || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Generate a video from a scene image and description.
   * Returns immediately with a task ID for polling.
   */
  async generateVideoFromScene(scene: VideoSceneThumbnail, options?: {
    sound?: boolean;
    duration?: '5' | '10';
  }): Promise<Video> {
    console.log(`[Kling API] Starting video generation for scene ${scene.sceneNumber}`);
    console.log(`[Kling API] Prompt: ${scene.description}`);
    console.log(`[Kling API] Image: ${scene.imageUrl}`);

    const taskId = await this.createTask({
      prompt: scene.description,
      imageUrl: scene.imageUrl,
      sound: options?.sound ?? true,
      duration: options?.duration || '5',
    });

    console.log(`[Kling API] Task created: ${taskId}`);

    return {
      id: taskId,
      status: 'in_progress',
      progress: 0,
      url: undefined,
    };
  }

  /**
   * Check the status of a video generation task.
   */
  async checkVideoStatus(videoId: string): Promise<Video> {
    const taskData = await this.getTaskStatus(videoId);

    const mapStatus = (klingState: string): Video['status'] => {
      switch (klingState) {
        case 'waiting':
        case 'queuing':
          return 'queued';
        case 'generating':
          return 'in_progress';
        case 'success':
          return 'completed';
        case 'fail':
          return 'failed';
        default:
          return 'queued';
      }
    };

    // Calculate progress based on state
    let progress = 0;
    const state = taskData?.state || 'waiting';
    if (state === 'waiting') progress = 0;
    else if (state === 'queuing') progress = 10;
    else if (state === 'generating') progress = 50;
    else if (state === 'success') progress = 100;
    else if (state === 'fail') progress = 0;

    // Parse resultJson to get video URL
    let videoUrl: string | undefined;
    if (taskData?.resultJson && state === 'success') {
      try {
        console.log(`[Kling API] Raw resultJson:`, taskData.resultJson);
        const result = JSON.parse(taskData.resultJson);
        console.log(`[Kling API] Parsed resultJson:`, JSON.stringify(result, null, 2));

        // Kling API returns { resultUrls: ["https://..."] }
        if (Array.isArray(result.resultUrls) && result.resultUrls.length > 0) {
          videoUrl = result.resultUrls[0];
          console.log(`[Kling API] Found video URL in resultUrls:`, videoUrl);
        }

        console.log(`[Kling API] Final extracted video URL: ${videoUrl}`);
      } catch (e) {
        console.error(`[Kling API] Failed to parse resultJson:`, e);
        console.error(`[Kling API] Raw resultJson was:`, taskData.resultJson);
      }
    } else {
      console.log(`[Kling API] No resultJson available. State: ${state}, Has resultJson: ${!!taskData?.resultJson}`);
    }

    return {
      id: videoId,
      status: mapStatus(state),
      progress,
      url: videoUrl,
    };
  }

  /**
   * Wait for a video generation task to complete.
   */
  async waitForVideo(
    videoId: string,
    options: { pollInterval?: number; timeout?: number } = {}
  ): Promise<Video> {
    const { pollInterval = 5000, timeout = 600000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const video = await this.checkVideoStatus(videoId);

      if (video.status === 'completed') {
        console.log(`[Kling API] Video completed: ${videoId}`);
        return video;
      }

      if (video.status === 'failed') {
        throw new Error(`Video generation failed for ID: ${videoId}`);
      }

      console.log(`[Kling API] Video ${videoId} progress: ${video.progress}%`);
      await sleep(pollInterval);
    }

    throw new Error(`Video generation timed out after ${timeout}ms`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
