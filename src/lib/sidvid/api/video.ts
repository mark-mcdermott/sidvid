import type OpenAI from 'openai';
import type { VideoOptions, Video } from '../types';
import { videoOptionsSchema } from '../schemas';
import { KlingClient } from './kling';

// Kling client instance (lazy initialized)
let klingClient: KlingClient | null = null;

// Mock video storage for development
const mockVideoStore = new Map<string, { status: string; progress: number; startTime: number }>();

// Track which provider was used for each video ID
const videoProviderStore = new Map<string, 'mock' | 'kling' | 'sora'>();

/**
 * Initialize the Kling client with an API key.
 * Must be called before using Kling video generation.
 */
export function initKlingClient(apiKey: string): void {
  klingClient = new KlingClient({ apiKey });
}

/**
 * Generate a video from a prompt and optional scene image.
 * Supports multiple providers: mock (default), kling, sora (future).
 */
export async function generateVideo(
  client: OpenAI,
  options: VideoOptions
): Promise<Video> {
  const validated = videoOptionsSchema.parse(options);
  const provider = validated.provider || 'mock';

  console.log(`[Video API] Using provider: ${provider}`);

  if (provider === 'kling') {
    return generateVideoKling(validated);
  }

  // Default to mock provider
  return generateVideoMock(validated);
}

/**
 * Generate video using mock provider (for development/testing).
 */
async function generateVideoMock(options: {
  prompt: string;
  imageUrl?: string;
}): Promise<Video> {
  const videoId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  mockVideoStore.set(videoId, {
    status: 'generating',
    progress: 0,
    startTime: Date.now()
  });
  videoProviderStore.set(videoId, 'mock');

  console.log(`[Video API] Mock video generation started: ${videoId}`);
  console.log(`[Video API] Prompt: ${options.prompt}`);
  if (options.imageUrl) {
    console.log(`[Video API] Image: ${options.imageUrl}`);
  }

  return {
    id: videoId,
    status: 'generating',
    progress: 0,
    url: undefined,
  };
}

/**
 * Generate video using Kling AI provider.
 */
async function generateVideoKling(options: {
  prompt: string;
  imageUrl?: string;
  duration?: number;
  sound?: boolean;
}): Promise<Video> {
  if (!klingClient) {
    throw new Error('Kling client not initialized. Call initKlingClient() with your API key first.');
  }

  if (!options.imageUrl) {
    throw new Error('Kling provider requires an imageUrl for image-to-video generation.');
  }

  console.log(`[Video API] Kling video generation started`);
  console.log(`[Video API] Prompt: ${options.prompt}`);
  console.log(`[Video API] Image: ${options.imageUrl}`);

  const taskId = await klingClient.createTask({
    prompt: options.prompt,
    imageUrl: options.imageUrl,
    sound: options.sound ?? true,
    duration: options.duration === 10 ? '10' : '5',
  });

  videoProviderStore.set(taskId, 'kling');

  console.log(`[Video API] Kling task created: ${taskId}`);

  return {
    id: taskId,
    status: 'in_progress',
    progress: 0,
    url: undefined,
  };
}

/**
 * Get the status of a video generation task.
 * Automatically routes to the correct provider based on the video ID.
 */
export async function getVideoStatus(
  client: OpenAI,
  videoId: string
): Promise<Video> {
  const provider = videoProviderStore.get(videoId);

  if (provider === 'kling') {
    return getVideoStatusKling(videoId);
  }

  // Default to mock provider
  return getVideoStatusMock(videoId);
}

/**
 * Get video status from mock provider.
 */
async function getVideoStatusMock(videoId: string): Promise<Video> {
  const mockVideo = mockVideoStore.get(videoId);

  if (!mockVideo) {
    throw new Error(`Video not found: ${videoId}`);
  }

  // Simulate progress over 30 seconds
  const elapsedMs = Date.now() - mockVideo.startTime;
  const generationTimeMs = 30000;
  const progress = Math.min(100, Math.floor((elapsedMs / generationTimeMs) * 100));

  mockVideo.progress = progress;

  if (progress >= 100) {
    mockVideo.status = 'completed';
    console.log(`[Video API] Mock video completed: ${videoId}`);

    return {
      id: videoId,
      status: 'completed',
      progress: 100,
      url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    };
  }

  return {
    id: videoId,
    status: mockVideo.status as Video['status'],
    progress: mockVideo.progress,
    url: undefined,
  };
}

/**
 * Get video status from Kling provider.
 */
async function getVideoStatusKling(videoId: string): Promise<Video> {
  if (!klingClient) {
    throw new Error('Kling client not initialized.');
  }

  return klingClient.checkVideoStatus(videoId);
}

/**
 * Wait for a video generation task to complete.
 */
export async function waitForVideo(
  client: OpenAI,
  videoId: string,
  options: { pollInterval?: number; timeout?: number } = {}
): Promise<Video> {
  const { pollInterval = 5000, timeout = 600000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const video = await getVideoStatus(client, videoId);

    if (video.status === 'completed') {
      return video;
    }

    if (video.status === 'failed') {
      throw new Error(`Video generation failed for ID: ${videoId}`);
    }

    console.log(`[Video API] Video ${videoId} progress: ${video.progress}%`);
    await sleep(pollInterval);
  }

  throw new Error(`Video generation timed out after ${timeout}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
