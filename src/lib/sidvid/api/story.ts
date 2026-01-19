import type OpenAI from 'openai';
import type { StoryOptions, EditStoryOptions, Story, StoryScene, StoryCharacter, StorySceneVisual } from '../types';
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
    temperature: 1.0,
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

export async function editStory(
  client: OpenAI,
  options: EditStoryOptions
): Promise<Story> {
  const { currentStory, editPrompt, length = '5s', maxTokens = 2000 } = options;

  const fullPrompt = `You are editing a story for a ${length} video. Here is the current story in JSON format:

${currentStory.rawContent}

Please modify the story based on this instruction: ${editPrompt}

CRITICAL EDITING RULES:
1. PRESERVE THE EXACT SAME NUMBER OF SCENES - Do not reduce or increase the scene count unless explicitly requested
2. Keep the existing story structure intact - only modify the parts requested in the edit instruction
3. If the edit asks to add something (like "needs exploding stars"), incorporate it INTO the existing scenes
4. DO NOT start over from scratch - build upon the current story
5. Only reduce scenes if explicitly asked (e.g., "make it shorter", "combine scenes", "remove scene X")
6. Only increase scenes if explicitly asked (e.g., "make it longer", "add more scenes")

Return the updated story in the same JSON format with the following structure:
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

Update the characters and sceneVisuals arrays to reflect any changes from the edit.
Extract information directly from the story text without adding creative embellishments.
Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: fullPrompt }],
    max_tokens: maxTokens,
    temperature: 0.8,
    response_format: { type: 'json_object' }
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
