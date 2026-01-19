#!/usr/bin/env node

import 'dotenv/config';
import { SidVid } from '../lib/sidvid';

const commands = {
  story: generateStory,
  'edit-story': editStory,
  scene: generateScene,
  character: generateCharacter,
  'enhance-character': enhanceCharacter,
  video: generateVideo,
  status: checkVideoStatus,
  help: showHelp,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command in commands) {
    await commands[command as keyof typeof commands](args.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
}

function getClient(): SidVid {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it in your .env file or export it in your shell');
    process.exit(1);
  }
  return new SidVid({ openaiApiKey: apiKey });
}

async function generateStory(args: string[]) {
  const prompt = args.join(' ');
  if (!prompt) {
    console.error('Usage: sidvid story <prompt>');
    process.exit(1);
  }

  console.log('Generating story...');
  const client = getClient();
  const story = await client.generateStory({ prompt, scenes: 5 });

  console.log('\nTitle:', story.title);
  console.log('\nScenes:');
  story.scenes.forEach((scene) => {
    console.log(`\n${scene.number}. ${scene.description}`);
    if (scene.dialogue) console.log(`   Dialogue: "${scene.dialogue}"`);
    if (scene.action) console.log(`   Action: ${scene.action}`);
  });

  if (story.characters && story.characters.length > 0) {
    console.log('\nCharacters:');
    story.characters.forEach((char) => {
      console.log(`\n- ${char.name}: ${char.description}`);
    });
  }

  console.log('\n---');
  console.log('Raw JSON saved. You can use this for editing:');
  console.log(JSON.stringify(story, null, 2));
}

async function editStory(args: string[]) {
  if (args.length < 2) {
    console.error('Usage: sidvid edit-story <story-json-file> <edit-prompt>');
    console.error('Example: sidvid edit-story story.json "Make it more dramatic"');
    process.exit(1);
  }

  const fs = await import('fs/promises');
  const storyFile = args[0];
  const editPrompt = args.slice(1).join(' ');

  try {
    const storyData = await fs.readFile(storyFile, 'utf-8');
    const currentStory = JSON.parse(storyData);

    console.log('Editing story...');
    const client = getClient();
    const story = await client.editStory({
      currentStory,
      editPrompt,
      length: '5s'
    });

    console.log('\nTitle:', story.title);
    console.log('\nScenes:');
    story.scenes.forEach((scene) => {
      console.log(`\n${scene.number}. ${scene.description}`);
      if (scene.dialogue) console.log(`   Dialogue: "${scene.dialogue}"`);
      if (scene.action) console.log(`   Action: ${scene.action}`);
    });

    console.log('\n---');
    console.log('Updated story JSON:');
    console.log(JSON.stringify(story, null, 2));
  } catch (error) {
    console.error('Error reading story file:', error);
    process.exit(1);
  }
}

async function generateScene(args: string[]) {
  const description = args.join(' ');
  if (!description) {
    console.error('Usage: sidvid scene <description>');
    process.exit(1);
  }

  console.log('Generating scene image...');
  const client = getClient();
  const scene = await client.generateScene({
    description,
    style: 'cinematic',
    aspectRatio: '16:9',
  });

  console.log('\nImage URL:', scene.imageUrl);
  if (scene.revisedPrompt) {
    console.log('Revised prompt:', scene.revisedPrompt);
  }
}

async function generateCharacter(args: string[]) {
  const description = args.join(' ');
  if (!description) {
    console.error('Usage: sidvid character <description>');
    console.error('Example: sidvid character "A tall detective in a trenchcoat"');
    process.exit(1);
  }

  console.log('Generating character image...');
  const client = getClient();
  const character = await client.generateCharacter({
    description,
    style: 'realistic',
  });

  console.log('\nImage URL:', character.imageUrl);
  if (character.revisedPrompt) {
    console.log('Revised prompt:', character.revisedPrompt);
  }
}

async function enhanceCharacter(args: string[]) {
  const description = args.join(' ');
  if (!description) {
    console.error('Usage: sidvid enhance-character <description>');
    console.error('Example: sidvid enhance-character "A detective"');
    process.exit(1);
  }

  console.log('Enhancing character description...');
  const client = getClient();
  const enhanced = await client.enhanceCharacterDescription({
    description
  });

  console.log('\nEnhanced Description:');
  console.log(enhanced);
  console.log('\n---');
  console.log('Use this enhanced description to generate an image:');
  console.log(`sidvid character "${enhanced}"`);
}

async function generateVideo(args: string[]) {
  const prompt = args.join(' ');
  if (!prompt) {
    console.error('Usage: sidvid video <prompt>');
    process.exit(1);
  }

  console.log('Generating video...');
  const client = getClient();
  const video = await client.generateVideo({
    prompt,
    duration: 4,
  });

  console.log('\nVideo ID:', video.id);
  console.log('Status:', video.status);

  if (video.status === 'queued' || video.status === 'in_progress') {
    console.log('\nVideo is being generated. Check status with:');
    console.log(`  sidvid status ${video.id}`);
  }
}

async function checkVideoStatus(args: string[]) {
  const videoId = args[0];
  if (!videoId) {
    console.error('Usage: sidvid status <video-id>');
    process.exit(1);
  }

  console.log('Checking video status...');
  const client = getClient();
  const video = await client.getVideoStatus(videoId);

  console.log('\nVideo ID:', video.id);
  console.log('Status:', video.status);
  console.log('Progress:', `${video.progress}%`);

  if (video.url) {
    console.log('URL:', video.url);
  }
}

function showHelp() {
  console.log(`
SidVid CLI - AI Video Generation

Usage: sidvid <command> [options]

Commands:
  story <prompt>              Generate a story with scenes and characters
  edit-story <file> <prompt>  Edit an existing story from JSON file
  enhance-character <desc>    Enhance a character description with GPT-4
  character <description>     Generate a character image (DALL-E 3)
  scene <description>         Generate a scene image (DALL-E 3)
  video <prompt>              Generate a video (Sora)
  status <video-id>           Check video generation status
  help                        Show this help message

Environment:
  OPENAI_API_KEY             Your OpenAI API key (required)

Examples:
  # Story generation
  sidvid story "A detective solving a mystery"
  sidvid edit-story story.json "Make it more dramatic"

  # Character generation (standalone)
  sidvid enhance-character "A detective"
  sidvid character "A tall detective in a trenchcoat with silver hair"

  # Character generation (from story metadata)
  # 1. Generate story (includes character metadata)
  # 2. Extract character descriptions from story JSON
  # 3. Enhance and generate images for each character

  # Scene and video
  sidvid scene "A rainy street at night with neon lights"
  sidvid video "A cat playing piano"
  sidvid status video_abc123
`);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
