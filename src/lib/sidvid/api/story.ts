import type OpenAI from 'openai';
import type { StoryOptions, Story, StoryScene, StoryCharacter, StorySceneVisual } from '../types';
import { storyOptionsSchema } from '../schemas';

const STORY_SYSTEM_PROMPT = `You are a creative story writer for video production.
Generate structured stories that can be turned into videos.
Format your response as JSON with the following structure:
{
  "title": "Story Title",
  "scenes": [
    {
      "number": 1,
      "description": "Visual description of the scene",
      "dialogue": "Any dialogue in the scene (optional)",
      "action": "What happens in the scene"
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "description": "Physical description of the character as mentioned in the story, no embellishment"
    }
  ],
  "sceneVisuals": [
    {
      "sceneNumber": 1,
      "setting": "Description of the background/setting",
      "charactersPresent": ["Character Name 1", "Character Name 2"],
      "visualDescription": "How the scene looks as a static image, including setting and character positions/appearance"
    }
  ]
}
Keep descriptions vivid and visual, suitable for video generation.
For characters and sceneVisuals, extract information directly from the story text without adding creative embellishments.`;

export async function generateStory(
  client: OpenAI,
  options: StoryOptions
): Promise<Story> {
  const validated = storyOptionsSchema.parse(options);

  const userPrompt = `Create a ${validated.scenes}-scene story about: ${validated.prompt}
${validated.style ? `Style: ${validated.style}` : ''}
Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: STORY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: validated.maxTokens,
    temperature: 0.8,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from ChatGPT');
  }

  const parsed = JSON.parse(content) as {
    title: string;
    scenes: StoryScene[];
    characters?: StoryCharacter[];
    sceneVisuals?: StorySceneVisual[];
  };

  return {
    title: parsed.title,
    scenes: parsed.scenes,
    rawContent: content,
    characters: parsed.characters,
    sceneVisuals: parsed.sceneVisuals,
  };
}
