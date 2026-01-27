import type OpenAI from 'openai';
import type { StoryOptions, EditStoryOptions, ExpandStoryOptions, Story, StoryScene, StoryCharacter, StoryLocation, StorySceneVisual } from '../types';
import { storyOptionsSchema } from '../schemas';
import { getComplexityGuidance } from '../utils/story-helpers';

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
      "description": "Brief overall description of the character",
      "physical": "Detailed physical description: appearance, clothing, distinguishing features (used for image generation)",
      "profile": "Personality traits, background, motivations, and relevant history"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Detailed visual description of the setting: architecture, atmosphere, lighting, colors, textures, and key visual elements (used for image generation)"
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
For characters, provide detailed physical descriptions for image generation and personality/background for story context.
For locations, provide detailed visual descriptions suitable for generating background/environment images.
For sceneVisuals, extract information directly from the story text without adding creative embellishments.`;

export async function generateStory(
  client: OpenAI,
  options: StoryOptions & { videoLength?: string }
): Promise<Story> {
  const validated = storyOptionsSchema.parse(options);
  const videoLength = (options as any).videoLength || '5s';
  const complexityGuidance = getComplexityGuidance(videoLength);

  const userPrompt = `Create a ${validated.scenes}-scene story for a ${videoLength} video about: ${validated.prompt}

${complexityGuidance}

${validated.style ? `Style: ${validated.style}` : ''}

IMPORTANT: The entire story must fit within a ${videoLength} video. Adjust scene complexity accordingly.
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
    locations?: StoryLocation[];
    sceneVisuals?: StorySceneVisual[];
  };

  return {
    title: parsed.title,
    scenes: parsed.scenes,
    rawContent: content,
    characters: parsed.characters,
    locations: parsed.locations,
    sceneVisuals: parsed.sceneVisuals,
  };
}

export async function editStory(
  client: OpenAI,
  options: EditStoryOptions
): Promise<Story> {
  const { currentStory, editPrompt, length = '5s', maxTokens = 2000 } = options;
  const complexityGuidance = getComplexityGuidance(length);

  const systemPrompt = `You are a story EDITOR, not a story writer. Your job is to make targeted modifications to existing stories while preserving their core identity.

CRITICAL: You must EDIT the given story, not replace it. The output should be recognizable as a modified version of the input.`;

  const userPrompt = `CURRENT STORY (Title: "${currentStory.title}"):
${currentStory.rawContent}

EDIT INSTRUCTION: ${editPrompt}

EDITING RULES - FOLLOW STRICTLY:
1. KEEP THE SAME TITLE unless the edit explicitly asks to change it. Current title is: "${currentStory.title}"
2. KEEP THE SAME NUMBER OF SCENES (${currentStory.scenes.length} scenes) unless explicitly asked to add/remove scenes
3. KEEP THE SAME CHARACTERS and setting - modify their actions/descriptions as needed, don't replace them entirely
4. Apply the edit instruction as a MODIFICATION to the existing story, not as inspiration for a new story
5. The edited story should be recognizable as a version of the original, not a completely different story

${complexityGuidance}

The entire story must fit within a ${length} video.

Return the EDITED story in this JSON format:
{
  "title": "${currentStory.title}",
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
      "description": "Brief overall description of the character",
      "physical": "Detailed physical description: appearance, clothing, distinguishing features",
      "profile": "Personality traits, background, motivations, and relevant history"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Detailed visual description of the setting"
    }
  ],
  "sceneVisuals": [
    {
      "sceneNumber": 1,
      "setting": "Description of the background/setting",
      "charactersPresent": ["Character Name 1", "Character Name 2"],
      "visualDescription": "How the scene looks as a static image"
    }
  ]
}

Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.5,
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
    locations?: StoryLocation[];
    sceneVisuals?: StorySceneVisual[];
  };

  return {
    title: parsed.title,
    scenes: parsed.scenes,
    rawContent: content,
    characters: parsed.characters,
    locations: parsed.locations,
    sceneVisuals: parsed.sceneVisuals,
  };
}

export async function expandStory(
  client: OpenAI,
  options: ExpandStoryOptions
): Promise<Story> {
  const { currentStory, length = '5s', maxTokens = 4000 } = options;

  const systemPrompt = `You are an expert screenwriter and creative artist. Your job is to dramatically expand and enrich story content while preserving its core identity, style, and genre.

CRITICAL: Provide 4-5 times as much detail for EVERY field. Push the creative vision further while staying true to the original tone and direction.`;

  const userPrompt = `CURRENT STORY:
${currentStory.rawContent}

EXPANSION INSTRUCTIONS:
1. EXPAND each scene's description, dialogue, and action with 4-5x more detail
2. EXPAND each character's physical description with vivid, specific visual details (colors, textures, expressions, posture, clothing details)
3. EXPAND each character's profile with deeper personality insights, backstory, and motivations
4. EXPAND each location's description with atmospheric details, lighting, colors, textures, and visual elements
5. EXPAND each sceneVisual with rich atmospheric and compositional details
6. KEEP the same title, number of scenes, and characters - just make everything much more detailed
7. FOLLOW the lead of the existing text in terms of style, genre, and tone - but push it farther
8. Write as an expert screenwriter would for a high-quality production

The entire story must fit within a ${length} video.

Return the EXPANDED story in this JSON format:
{
  "title": "${currentStory.title}",
  "scenes": [
    {
      "number": 1,
      "description": "Greatly expanded visual description of the scene",
      "dialogue": "Expanded dialogue with more nuance and detail (optional)",
      "action": "Greatly expanded action description"
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "description": "Expanded overall description",
      "physical": "Greatly expanded physical description with vivid details",
      "profile": "Greatly expanded personality, background, and motivations"
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Greatly expanded visual description of the setting"
    }
  ],
  "sceneVisuals": [
    {
      "sceneNumber": 1,
      "setting": "Greatly expanded setting description",
      "charactersPresent": ["Character Name 1", "Character Name 2"],
      "visualDescription": "Greatly expanded visual composition details"
    }
  ]
}

Return only valid JSON.`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
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
    locations?: StoryLocation[];
    sceneVisuals?: StorySceneVisual[];
  };

  return {
    title: parsed.title,
    scenes: parsed.scenes,
    rawContent: content,
    characters: parsed.characters,
    locations: parsed.locations,
    sceneVisuals: parsed.sceneVisuals,
  };
}
