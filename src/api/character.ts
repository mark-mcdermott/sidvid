import type OpenAI from 'openai';
import type { CharacterOptions, Character } from '../types';
import { characterOptionsSchema } from '../schemas';

export async function generateCharacter(
  client: OpenAI,
  options: CharacterOptions
): Promise<Character> {
  const validated = characterOptionsSchema.parse(options);

  const prompt = buildCharacterPrompt(validated);

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: validated.size,
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

function buildCharacterPrompt(options: CharacterOptions): string {
  const styleMap = {
    realistic: 'photorealistic, detailed, high quality photograph',
    anime: 'anime style, vibrant colors, Japanese animation aesthetic',
    cartoon: 'cartoon style, bold lines, colorful, animated',
    cinematic: 'cinematic, dramatic lighting, movie quality, professional',
  };

  const styleDesc = styleMap[options.style || 'realistic'];

  return `Character portrait: ${options.description}. Style: ${styleDesc}. Full body or upper body shot, clear details, suitable for video production.`;
}
