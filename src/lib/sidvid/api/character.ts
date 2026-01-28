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
    realistic: 'professional photograph shot on Canon EOS R5 with 85mm f/1.4 lens. Sharp focus, natural lighting, shallow depth of field, 8K resolution. Real photo with authentic skin textures and natural colors - not a painting or digital art',
    anime: 'hand-drawn 2D anime illustration in the style of classic 1980s-1990s Japanese animation (Akira, Dragon Ball Z). Bold black ink outlines, cel-shaded flat colors, dramatic anime lighting, expressive face. 2D illustration only - absolutely no 3D render, no photorealism, no CGI, no realistic textures, no ray tracing',
    cartoon: '3D animated character in the style of modern Pixar/Disney animation. Clean geometric forms, soft three-point lighting, exaggerated expressive features, vibrant saturated colors, smooth subsurface scattering on skin, award-winning animation studio quality rendering',
    cinematic: 'cinematic film still shot on ARRIFLEX camera with anamorphic lenses. Dramatic key lighting with strong shadows, shallow depth of field, teal and orange color grading, film grain texture, movie poster quality, professional cinematography',
  };

  const styleDesc = styleMap[options.style || 'realistic'];

  return `Character portrait: ${options.description}. Style: ${styleDesc}. Full body or upper body shot, clear details, suitable for video production.`;
}
