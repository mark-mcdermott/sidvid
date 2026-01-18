import type OpenAI from 'openai';
import type { SceneOptions, Scene } from '../types';
import { sceneOptionsSchema } from '../schemas';

export async function generateScene(
  client: OpenAI,
  options: SceneOptions
): Promise<Scene> {
  const validated = sceneOptionsSchema.parse(options);

  const size = aspectRatioToSize(validated.aspectRatio || '16:9');
  const prompt = buildScenePrompt(validated);

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality: validated.quality,
    style: 'vivid',
    response_format: 'url',
  });

  const imageData = response.data[0];
  if (!imageData?.url) {
    throw new Error('No image URL returned from DALL-E');
  }

  return {
    description: validated.description,
    imageUrl: imageData.url,
    revisedPrompt: imageData.revised_prompt,
  };
}

function aspectRatioToSize(aspectRatio: string): '1024x1024' | '1792x1024' | '1024x1792' {
  switch (aspectRatio) {
    case '16:9':
      return '1792x1024';
    case '9:16':
      return '1024x1792';
    case '1:1':
    default:
      return '1024x1024';
  }
}

function buildScenePrompt(options: SceneOptions): string {
  const styleMap = {
    realistic: 'photorealistic, detailed, high quality photograph',
    anime: 'anime style, vibrant colors, Japanese animation aesthetic',
    cartoon: 'cartoon style, bold lines, colorful, animated',
    cinematic: 'cinematic, dramatic lighting, movie quality, professional cinematography',
  };

  const styleDesc = styleMap[options.style || 'cinematic'];

  return `Scene: ${options.description}. Style: ${styleDesc}. Wide shot, suitable for video background, no text or watermarks.`;
}
