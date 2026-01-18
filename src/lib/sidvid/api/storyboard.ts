import type OpenAI from 'openai';
import type { StoryboardOptions, Storyboard, StoryboardFrame } from '../types';
import { generateScene } from './scene';

export async function generateStoryboard(
  client: OpenAI,
  options: StoryboardOptions
): Promise<Storyboard> {
  const { story, scenes: existingScenes } = options;

  const frames: StoryboardFrame[] = [];

  for (const storyScene of story.scenes) {
    const existingScene = existingScenes?.find(
      (_, index) => index === storyScene.number - 1
    );

    let imageUrl: string | undefined;

    if (existingScene) {
      imageUrl = existingScene.imageUrl;
    } else {
      const generatedScene = await generateScene(client, {
        description: storyScene.description,
        style: 'cinematic',
        aspectRatio: '16:9',
      });
      imageUrl = generatedScene.imageUrl;
    }

    frames.push({
      sceneNumber: storyScene.number,
      description: storyScene.description,
      imageUrl,
    });
  }

  return { frames };
}
