import type OpenAI from 'openai';
import type { CharacterOptions, Character, EnhanceCharacterOptions } from '../types';
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

export async function enhanceCharacterDescription(
  client: OpenAI,
  options: EnhanceCharacterOptions
): Promise<string> {
  const { description, maxTokens = 1000 } = options;

  const fullPrompt = `Create a character description from the following input, about 4 or 5 times longer. If no name was included, create a suitable/appropriate one. In both description and name, be creative. If you can detect a genre, write as if you were a top writer in that genre.\n\nInput: ${description}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: fullPrompt }],
    max_tokens: maxTokens,
    temperature: 0.8
  });

  const characterText = completion.choices[0]?.message?.content;
  if (!characterText) {
    throw new Error('No content returned from ChatGPT');
  }

  return characterText;
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
