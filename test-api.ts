import 'dotenv/config';
import { SidVid } from './src/index.js';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in .env');
  process.exit(1);
}

console.log('✓ API key found');

const sidvid = new SidVid({ openaiApiKey: apiKey });

// Test ChatGPT
console.log('\n--- Testing ChatGPT ---');
try {
  const story = await sidvid.generateStory({
    prompt: 'A cat learning to play piano',
    scenes: 2,
  });

  console.log('✓ ChatGPT working!');
  console.log('Title:', story.title);
  console.log('Scenes:', story.scenes.length);
} catch (error) {
  console.error('❌ ChatGPT Error:', error instanceof Error ? error.message : error);
}

// Test DALL-E
console.log('\n--- Testing DALL-E 3 ---');
try {
  const scene = await sidvid.generateScene({
    description: 'A cozy coffee shop on a rainy day',
    style: 'cinematic',
    aspectRatio: '16:9',
  });

  console.log('✓ DALL-E working!');
  console.log('Image URL:', scene.imageUrl.substring(0, 80) + '...');
  console.log('Revised prompt:', scene.revisedPrompt?.substring(0, 100) + '...');
} catch (error) {
  console.error('❌ DALL-E Error:', error instanceof Error ? error.message : error);
}

// Test Sora
console.log('\n--- Testing Sora Video ---');
try {
  const video = await sidvid.generateVideo({
    prompt: 'A cat playing piano in a cozy living room',
    duration: 4,
  });

  console.log('✓ Sora working!');
  console.log('Video ID:', video.id);
  console.log('Status:', video.status);
  if (video.url) {
    console.log('Video URL:', video.url.substring(0, 80) + '...');
  }
} catch (error) {
  console.error('❌ Sora Error:', error instanceof Error ? error.message : error);
}

console.log('\n--- All tests complete ---');
