#!/usr/bin/env node

import 'dotenv/config';
import { SidVid } from '../lib/sidvid';

const commands = {
  story: generateStory,
  scene: generateScene,
  character: generateCharacter,
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
  story.scenes.forEach((scene, i) => {
    console.log(`\n${i + 1}. ${scene.title}`);
    console.log(`   ${scene.description}`);
  });
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

  if (video.status === 'queued' || video.status === 'processing') {
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
  story <prompt>        Generate a story with scenes
  scene <description>   Generate a scene image (DALL-E 3)
  character <desc>      Generate a character image (DALL-E 3)
  video <prompt>        Generate a video (Sora)
  status <video-id>     Check video generation status
  help                  Show this help message

Environment:
  OPENAI_API_KEY        Your OpenAI API key (required)

Examples:
  sidvid story "A detective solving a mystery"
  sidvid scene "A rainy street at night with neon lights"
  sidvid character "A tall detective in a trenchcoat"
  sidvid video "A cat playing piano"
  sidvid status video_abc123
`);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
