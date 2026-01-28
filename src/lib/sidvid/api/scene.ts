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

  const imageData = response.data?.[0];
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
    realistic: 'professional photograph shot on Sony A7R IV with wide-angle lens. Sharp focus throughout, natural lighting, high dynamic range, 8K resolution. Real photo with authentic textures and natural colors - not a painting or digital art',
    anime: 'hand-drawn 2D anime background illustration in the style of classic 1980s-1990s Japanese animation (Akira, Dragon Ball Z, Studio Ghibli backgrounds). Bold black ink outlines, cel-shaded flat colors, dramatic anime lighting, painterly details. 2D illustration only - absolutely no 3D render, no photorealism, no CGI, no realistic textures, no ray tracing',
    cartoon: '3D animated environment in the style of modern Pixar/Disney animation. Clean geometric forms, soft global illumination, vibrant saturated colors, stylized but detailed scenery, award-winning animation studio quality rendering',
    cinematic: 'cinematic film still shot on ARRIFLEX camera with anamorphic lenses. Dramatic key lighting, atmospheric depth, teal and orange color grading, subtle film grain, widescreen composition, professional cinematography worthy of a major motion picture',
  };

  const styleDesc = styleMap[options.style || 'cinematic'];

  return `Scene: ${options.description}. Style: ${styleDesc}. Wide shot, suitable for video background, no text or watermarks.`;
}
