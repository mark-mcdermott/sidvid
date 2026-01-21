#!/usr/bin/env node

import 'dotenv/config';
import { SessionManager, type Session } from '../lib/sidvid';
import { FileStorageAdapter } from '../lib/sidvid/storage/file-adapter';
import { join } from 'path';

const commands = {
  // Session commands
  session: sessionCommand,

  // Story commands
  story: generateStory,

  // Character commands (use active session)
  characters: charactersCommand,
  character: characterCommand,
  'enhance-character': enhanceCharacter,

  // Scene/video commands (legacy, now session-aware)
  scene: generateScene,
  video: generateVideo,
  status: checkVideoStatus,

  // Help
  help: showHelp,
};

let isVerbose = false;
let sessionManager: SessionManager | null = null;

const spinnerFrames = ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'];

function startSpinner(message: string): { stop: () => void } {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${message}\n`);
    return { stop: () => {} };
  }

  let frameIndex = 0;
  const write = (text: string) => process.stdout.write(text);

  write(`${spinnerFrames[frameIndex]} ${message}`);

  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
    write(`\r${spinnerFrames[frameIndex]} ${message}`);
  }, 100);

  return {
    stop: () => {
      clearInterval(interval);
      write('\r' + ' '.repeat(message.length + 2) + '\r');
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  isVerbose = args.includes('-v') || args.includes('--verbose');
  const filteredArgs = args.filter(arg => arg !== '-v' && arg !== '--verbose');
  const command = filteredArgs[0] || 'help';

  if (command in commands) {
    await commands[command as keyof typeof commands](filteredArgs.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
}

function getSessionManager(): SessionManager {
  if (sessionManager) {
    return sessionManager;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Set it in your .env file or export it in your shell');
    process.exit(1);
  }

  const storage = new FileStorageAdapter(join(process.cwd(), '.sidvid'));
  sessionManager = new SessionManager({ openaiApiKey: apiKey }, storage);
  sessionManager.enableAutoSave();

  return sessionManager;
}

async function getOrCreateActiveSession(): Promise<Session> {
  const manager = getSessionManager();
  let session = manager.getActiveSession();

  if (!session) {
    session = manager.createSession();
    console.log(`Created new session: ${session.getId()}`);
  }

  return session;
}

// ===== Session Commands =====

async function sessionCommand(args: string[]) {
  const subcommand = args[0];

  if (!subcommand || subcommand === 'help') {
    console.log(`
Session Commands:
  session new [name]        Create a new session
  session list              List all sessions
  session use <id>          Switch to a session
  session current           Show current session
  session delete <id>       Delete a session
  session export <id> <file> Export session to JSON
  session import <file>     Import session from JSON
`);
    return;
  }

  switch (subcommand) {
    case 'new':
      await createSession(args.slice(1));
      break;
    case 'list':
      await listSessions();
      break;
    case 'use':
      await switchSession(args.slice(1));
      break;
    case 'current':
      await showCurrentSession();
      break;
    case 'delete':
      await deleteSession(args.slice(1));
      break;
    case 'export':
      await exportSession(args.slice(1));
      break;
    case 'import':
      await importSession(args.slice(1));
      break;
    default:
      console.error(`Unknown session command: ${subcommand}`);
      console.error('Run "sidvid session help" for usage');
      process.exit(1);
  }
}

async function createSession(args: string[]) {
  const name = args.join(' ') || undefined;
  const manager = getSessionManager();
  const session = manager.createSession(name);

  await session.save();

  console.log('Created session:', session.getId());
  if (name) console.log('Name:', name);
  console.log('\nNow using this session for all commands.');
}

async function listSessions() {
  const manager = getSessionManager();
  const sessions = await manager.listAllSessions();

  if (sessions.length === 0) {
    console.log('No sessions found');
    console.log('\nCreate a new session with: sidvid session new');
    return;
  }

  const activeId = manager.getActiveSession()?.getId();

  console.log('Sessions:\n');
  sessions.forEach(s => {
    const active = activeId === s.id ? '* ' : '  ';
    const name = s.name ? ` "${s.name}"` : '';
    console.log(`${active}${s.id}${name}`);
    console.log(`   Stories: ${s.storyCount || 0}, Characters: ${s.characterCount || 0}`);
    console.log(`   Updated: ${new Date(s.updatedAt).toLocaleString()}`);
    console.log();
  });
}

async function switchSession(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error('Usage: sidvid session use <session-id>');
    process.exit(1);
  }

  const manager = getSessionManager();

  try {
    await manager.loadSession(id);
    manager.setActiveSession(id);
    console.log('Now using session:', id);
  } catch (error) {
    console.error('Session not found:', id);
    console.error('\nList available sessions with: sidvid session list');
    process.exit(1);
  }
}

async function showCurrentSession() {
  const manager = getSessionManager();
  const session = manager.getActiveSession();

  if (!session) {
    console.log('No active session');
    console.log('\nCreate a new session with: sidvid session new');
    return;
  }

  const metadata = session.getMetadata();
  console.log('Current session:', metadata.id);
  if (metadata.name) console.log('Name:', metadata.name);
  console.log('Stories:', metadata.storyCount || 0);
  console.log('Characters:', metadata.characterCount || 0);
  console.log('Created:', new Date(metadata.createdAt).toLocaleString());
  console.log('Updated:', new Date(metadata.updatedAt).toLocaleString());
}

async function deleteSession(args: string[]) {
  const id = args[0];
  if (!id) {
    console.error('Usage: sidvid session delete <session-id>');
    process.exit(1);
  }

  const manager = getSessionManager();

  try {
    await manager.deleteSession(id);
    console.log('Deleted session:', id);
  } catch (error) {
    console.error('Session not found:', id);
    process.exit(1);
  }
}

async function exportSession(args: string[]) {
  const [id, filename] = args;
  if (!id || !filename) {
    console.error('Usage: sidvid session export <session-id> <filename>');
    process.exit(1);
  }

  const manager = getSessionManager();

  try {
    const json = await manager.exportSession(id);
    const fs = await import('fs/promises');
    await fs.writeFile(filename, json, 'utf-8');
    console.log('Exported session to:', filename);
  } catch (error) {
    console.error('Error exporting session:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function importSession(args: string[]) {
  const filename = args[0];
  if (!filename) {
    console.error('Usage: sidvid session import <filename>');
    process.exit(1);
  }

  const manager = getSessionManager();

  try {
    const fs = await import('fs/promises');
    const json = await fs.readFile(filename, 'utf-8');
    const session = await manager.importSession(json);
    console.log('Imported session:', session.getId());
    if (session.getName()) console.log('Name:', session.getName());
  } catch (error) {
    console.error('Error importing session:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ===== Story Commands =====

async function generateStory(args: string[]) {
  const subcommand = args[0];

  // Check for subcommands
  if (subcommand === 'improve' || subcommand === 'history' || subcommand === 'revert') {
    switch (subcommand) {
      case 'improve':
        await improveStory(args.slice(1));
        return;
      case 'history':
        await showStoryHistory();
        return;
      case 'revert':
        await revertStory(args.slice(1));
        return;
    }
  }

  // Otherwise, generate new story
  const prompt = args.join(' ');
  if (!prompt) {
    console.error('Usage: sidvid story <prompt>');
    console.error('       sidvid story improve [prompt]');
    console.error('       sidvid story history');
    console.error('       sidvid story revert <index>');
    process.exit(1);
  }

  const session = await getOrCreateActiveSession();

  const spinner = startSpinner('Generating story...');
  const story = await session.generateStory(prompt);
  await session.save();
  spinner.stop();

  console.log('Title:', story.title);
  console.log('\nScenes:');
  story.scenes.forEach((scene) => {
    console.log(`\n${scene.number}. ${scene.description}`);
    if (scene.dialogue) console.log(`   Dialogue: "${scene.dialogue}"`);
    if (scene.action) console.log(`   Action: ${scene.action}`);
  });

  if (isVerbose && story.characters && story.characters.length > 0) {
    console.log('\nCharacters:');
    story.characters.forEach((char) => {
      console.log(`\n- ${char.name}: ${char.description}`);
    });
  }

  console.log('\n---');
  console.log('Session:', session.getId());
}

async function improveStory(args: string[]) {
  const session = await getOrCreateActiveSession();

  const currentStory = session.getCurrentStory();
  if (!currentStory) {
    console.error('No story to improve. Generate a story first with: sidvid story <prompt>');
    process.exit(1);
  }

  const prompt = args.join(' ') || undefined;

  const spinner = startSpinner('Improving story...');
  const story = await session.improveStory(prompt);
  await session.save();
  spinner.stop();

  console.log('Improved story');
  console.log('\nTitle:', story.title);
  console.log('\nScenes:');
  story.scenes.forEach((scene) => {
    console.log(`\n${scene.number}. ${scene.description}`);
    if (scene.dialogue) console.log(`   Dialogue: "${scene.dialogue}"`);
    if (scene.action) console.log(`   Action: ${scene.action}`);
  });
}

async function showStoryHistory() {
  const session = await getOrCreateActiveSession();
  const history = session.getStoryHistory();

  if (history.length === 0) {
    console.log('No story history');
    return;
  }

  console.log(`Story History (${history.length} versions):\n`);
  history.forEach((story, index) => {
    const current = index === history.length - 1 ? ' (current)' : '';
    console.log(`Version ${index + 1}${current}: ${story.title}`);
    console.log(`  Scenes: ${story.scenes.length}`);
    if (story.characters) {
      console.log(`  Characters: ${story.characters.length}`);
    }
    console.log();
  });
}

async function revertStory(args: string[]) {
  const indexStr = args[0];
  if (!indexStr) {
    console.error('Usage: sidvid story revert <version>');
    console.error('Example: sidvid story revert 1');
    process.exit(1);
  }

  const index = parseInt(indexStr, 10) - 1; // User sees 1-indexed
  const session = await getOrCreateActiveSession();

  try {
    session.revertToStory(index);
    await session.save();
    const story = session.getCurrentStory();
    console.log(`Reverted to version ${index + 1}`);
    console.log('Title:', story!.title);
  } catch (error) {
    console.error('Invalid version number');
    console.error('Run "sidvid story history" to see available versions');
    process.exit(1);
  }
}

// ===== Character Commands =====

async function charactersCommand(args: string[]) {
  const subcommand = args[0];

  if (!subcommand || subcommand === 'list') {
    await listCharacters();
    return;
  }

  console.error('Usage: sidvid characters list');
  process.exit(1);
}

async function listCharacters() {
  const session = await getOrCreateActiveSession();
  const characters = session.extractCharacters();

  if (characters.length === 0) {
    console.log('No characters found');
    console.log('\nGenerate a story first with: sidvid story <prompt>');
    return;
  }

  console.log(`Characters (${characters.length}):\n`);
  characters.forEach((char, index) => {
    console.log(`[${index}] ${char.name}`);
    console.log(`    ${char.description}`);
    if (char.enhancedDescription) {
      console.log(`    Enhanced: ${char.enhancedDescription.substring(0, 60)}...`);
    }
    if (char.imageUrl) {
      console.log(`    Image: ${char.imageUrl}`);
    }
    console.log();
  });
}

async function characterCommand(args: string[]) {
  const subcommand = args[0];

  if (subcommand === 'enhance') {
    await enhanceCharacterFromSession(args.slice(1));
    return;
  }

  if (subcommand === 'image') {
    await generateCharacterImageFromSession(args.slice(1));
    return;
  }

  // Legacy: standalone character generation
  await generateCharacter(args);
}

async function enhanceCharacterFromSession(args: string[]) {
  const characterId = args[0];
  const prompt = args.slice(1).join(' ') || undefined;

  if (!characterId) {
    console.error('Usage: sidvid character enhance <character-index> [prompt]');
    console.error('Run "sidvid characters list" to see character indices');
    process.exit(1);
  }

  const session = await getOrCreateActiveSession();
  const characters = session.extractCharacters();
  const index = parseInt(characterId, 10);

  if (isNaN(index) || index < 0 || index >= characters.length) {
    console.error('Invalid character index');
    process.exit(1);
  }

  const char = characters[index];
  const spinner = startSpinner('Enhancing character...');
  const enhanced = await session.enhanceCharacter(char.id, prompt);
  await session.save();
  spinner.stop();

  console.log('Enhanced Description:');
  console.log(enhanced.enhancedDescription);
}

async function generateCharacterImageFromSession(args: string[]) {
  const characterId = args[0];

  if (!characterId) {
    console.error('Usage: sidvid character image <character-index>');
    console.error('Run "sidvid characters list" to see character indices');
    process.exit(1);
  }

  const session = await getOrCreateActiveSession();
  const characters = session.extractCharacters();
  const index = parseInt(characterId, 10);

  if (isNaN(index) || index < 0 || index >= characters.length) {
    console.error('Invalid character index');
    process.exit(1);
  }

  const char = characters[index];
  const spinner = startSpinner('Generating character image...');
  const withImage = await session.generateCharacterImage(char.id, {
    style: 'realistic',
    size: '1024x1024',
    quality: 'standard'
  });
  await session.save();
  spinner.stop();

  console.log('Image URL:', withImage.imageUrl);
  if (withImage.revisedPrompt) {
    console.log('Revised prompt:', withImage.revisedPrompt);
  }
}

// ===== Legacy Commands (kept for backward compatibility) =====

async function generateCharacter(args: string[]) {
  const description = args.join(' ');
  if (!description) {
    console.error('Usage: sidvid character <description>');
    console.error('Example: sidvid character "A tall detective in a trenchcoat"');
    console.error('\nOr use session-based workflow:');
    console.error('  sidvid characters list');
    console.error('  sidvid character enhance <index>');
    console.error('  sidvid character image <index>');
    process.exit(1);
  }

  // Use legacy SidVid client for standalone character generation
  const { SidVid } = await import('../lib/sidvid');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new SidVid({ openaiApiKey: apiKey });

  const spinner = startSpinner('Generating character image...');
  const character = await client.generateCharacter({
    description,
    style: 'realistic',
  });
  spinner.stop();

  console.log('Image URL:', character.imageUrl);
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

  const { SidVid } = await import('../lib/sidvid');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new SidVid({ openaiApiKey: apiKey });

  const spinner = startSpinner('Enhancing character description...');
  const enhanced = await client.enhanceCharacterDescription({
    description
  });
  spinner.stop();

  console.log('Enhanced Description:');
  console.log(enhanced);
  console.log('\n---');
  console.log('Use this enhanced description to generate an image:');
  console.log(`sidvid character "${enhanced}"`);
}

async function generateScene(args: string[]) {
  const description = args.join(' ');
  if (!description) {
    console.error('Usage: sidvid scene <description>');
    process.exit(1);
  }

  const { SidVid } = await import('../lib/sidvid');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new SidVid({ openaiApiKey: apiKey });

  const spinner = startSpinner('Generating scene image...');
  const scene = await client.generateScene({
    description,
    style: 'cinematic',
    aspectRatio: '16:9',
  });
  spinner.stop();

  console.log('Image URL:', scene.imageUrl);
  if (scene.revisedPrompt) {
    console.log('Revised prompt:', scene.revisedPrompt);
  }
}

async function generateVideo(args: string[]) {
  const prompt = args.join(' ');
  if (!prompt) {
    console.error('Usage: sidvid video <prompt>');
    process.exit(1);
  }

  const { SidVid } = await import('../lib/sidvid');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new SidVid({ openaiApiKey: apiKey });

  const spinner = startSpinner('Generating video...');
  const video = await client.generateVideo({
    prompt,
    duration: 4,
  });
  spinner.stop();

  console.log('Video ID:', video.id);
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

  const { SidVid } = await import('../lib/sidvid');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new SidVid({ openaiApiKey: apiKey });

  const spinner = startSpinner('Checking video status...');
  const video = await client.getVideoStatus(videoId);
  spinner.stop();

  console.log('Video ID:', video.id);
  console.log('Status:', video.status);
  console.log('Progress:', `${video.progress}%`);

  if (video.url) {
    console.log('URL:', video.url);
  }
}

function showHelp() {
  console.log(`
SidVid CLI - AI Video Generation with Session Management

Usage: sidvid [-v|--verbose] <command> [options]

Options:
  -v, --verbose              Show full output including characters and JSON

Session Commands:
  session new [name]         Create a new session
  session list               List all sessions
  session use <id>           Switch to a session
  session current            Show current session
  session delete <id>        Delete a session
  session export <id> <file> Export session to JSON
  session import <file>      Import session from JSON

Story Commands (Session-Based):
  story <prompt>             Generate a story in current session
  story improve [prompt]     Improve the current story
  story history              Show story version history
  story revert <version>     Revert to a previous story version

Character Commands (Session-Based):
  characters list            List characters from current story
  character enhance <index> [prompt]  Enhance a character description
  character image <index>    Generate image for a character

Legacy Commands (Stateless):
  character <description>    Generate a standalone character image
  enhance-character <desc>   Enhance a standalone character description
  scene <description>        Generate a scene image (DALL-E 3)
  video <prompt>             Generate a video (Sora)
  status <video-id>          Check video generation status
  help                       Show this help message

Environment:
  OPENAI_API_KEY            Your OpenAI API key (required)

Examples:
  # Create a session and generate a story
  sidvid session new "My Detective Story"
  sidvid story "A detective solving a mystery"

  # Improve the story
  sidvid story improve "Add more tension"

  # Work with characters
  sidvid characters list
  sidvid character enhance 0 "Make them more mysterious"
  sidvid character image 0

  # View session history
  sidvid story history
  sidvid story revert 1

  # Manage sessions
  sidvid session list
  sidvid session export abc-123 my-story.json
  sidvid session import my-story.json

Data Storage:
  Sessions are stored in: .sidvid/
  Add .sidvid/ to .gitignore to keep sessions local
`);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
