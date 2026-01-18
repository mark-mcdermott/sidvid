import type OpenAI from 'openai';
import type { VideoOptions, Video } from '../types';
import { videoOptionsSchema } from '../schemas';

export async function generateVideo(
  client: OpenAI,
  options: VideoOptions
): Promise<Video> {
  const validated = videoOptionsSchema.parse(options);

  const response = await (client as any).videos.create({
    model: validated.model,
    prompt: validated.prompt,
    size: validated.size,
    seconds: String(validated.duration),
  });

  return {
    id: response.id,
    status: response.status,
    progress: response.progress || 0,
    url: undefined,
  };
}

export async function getVideoStatus(
  client: OpenAI,
  videoId: string
): Promise<Video> {
  const response = await (client as any).videos.retrieve(videoId);

  return {
    id: response.id,
    status: response.status,
    progress: response.progress || 0,
    url: response.url,
  };
}

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

    await sleep(pollInterval);
  }

  throw new Error(`Video generation timed out after ${timeout}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
