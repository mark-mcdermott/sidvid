import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { rm, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');
const TEST_SESSION_DIR = join(process.cwd(), '.test-cli-sessions');

// Helper to run CLI commands
function runCLI(command: string, env: Record<string, string> = {}): string {
  try {
    return execSync(`tsx ${CLI_PATH} ${command}`, {
      env: { ...process.env, ...env },
      encoding: 'utf-8'
    });
  } catch (error: any) {
    // If command fails, return stderr for error testing
    return error.stderr || error.stdout || '';
  }
}

describe('CLI - Session Management', () => {
  beforeEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_SESSION_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });

  it('should create new session', () => {
    const output = runCLI('session new "My Detective Story"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Created session');
    expect(output).toContain('My Detective Story');
  });

  it('should create session with auto-generated name', () => {
    const output = runCLI('session new', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Created session');
  });

  it('should list all sessions', () => {
    // Create two sessions
    runCLI('session new "Session 1"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });
    runCLI('session new "Session 2"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const output = runCLI('session list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Session 1');
    expect(output).toContain('Session 2');
  });

  it('should show empty message when no sessions exist', () => {
    const output = runCLI('session list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('No sessions found');
  });

  it('should delete session by ID', () => {
    const createOutput = runCLI('session new "To Delete"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    // Extract session ID from output
    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];

    const deleteOutput = runCLI(`session delete ${sessionId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(deleteOutput).toContain('Deleted session');
  });

  it('should switch active session', () => {
    const createOutput = runCLI('session new "Active Session"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];

    const switchOutput = runCLI(`session use ${sessionId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(switchOutput).toContain('Now using session');
  });

  it('should show current active session', () => {
    runCLI('session new "Current Session"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const output = runCLI('session current', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Current Session');
  });
});

describe('CLI - Story Generation with Sessions', () => {
  beforeEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_SESSION_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });

  it('should generate story in active session', () => {
    // Create session first
    runCLI('session new "Story Session"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const output = runCLI('story "A detective mystery"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Title:');
    expect(output).toContain('Scenes:');
  });

  it('should create new session if none exists when generating story', () => {
    const output = runCLI('story "A detective mystery"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Created new session');
    expect(output).toContain('Title:');
  });

  it('should improve story in active session', () => {
    // Generate initial story
    runCLI('story "A detective mystery"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const output = runCLI('story improve "Add more tension"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Title:');
    expect(output).toContain('Improved story');
  });

  it('should show story history', () => {
    // Generate and improve story
    runCLI('story "A detective mystery"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });
    runCLI('story improve "Add more tension"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const output = runCLI('story history', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Version 1');
    expect(output).toContain('Version 2');
  });

  it('should revert to previous story version', () => {
    // Generate and improve story
    runCLI('story "A detective mystery"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });
    runCLI('story improve', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const output = runCLI('story revert 0', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Reverted to version 1');
  });
});

describe('CLI - Character Workflow with Sessions', () => {
  beforeEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_SESSION_DIR, { recursive: true });

    // Create session with story
    runCLI('session new "Character Test"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });
    runCLI('story "A detective story with characters"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });
  });

  afterEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });

  it('should list characters from current story', () => {
    const output = runCLI('characters list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Characters:');
  });

  it('should enhance character description', () => {
    // Get character ID first
    const listOutput = runCLI('characters list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const idMatch = listOutput.match(/\[([a-z0-9-]+)\]/);
    const characterId = idMatch?.[1];

    const output = runCLI(`character enhance ${characterId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Enhanced Description:');
  });

  it('should generate character image', () => {
    const listOutput = runCLI('characters list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const idMatch = listOutput.match(/\[([a-z0-9-]+)\]/);
    const characterId = idMatch?.[1];

    const output = runCLI(`character image ${characterId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Image URL:');
  });

  it('should show character history', () => {
    const listOutput = runCLI('characters list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const idMatch = listOutput.match(/\[([a-z0-9-]+)\]/);
    const characterId = idMatch?.[1];

    // Enhance character to create history
    runCLI(`character enhance ${characterId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const output = runCLI(`character history ${characterId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    expect(output).toContain('Version');
  });
});

describe('CLI - Export/Import Sessions', () => {
  beforeEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_SESSION_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });

  it('should export session to JSON file', async () => {
    const createOutput = runCLI('session new "Export Test"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];

    const exportPath = join(TEST_SESSION_DIR, 'exported.json');
    const output = runCLI(`session export ${sessionId} ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Exported session');
    expect(existsSync(exportPath)).toBe(true);
  });

  it('should import session from JSON file', async () => {
    // Create and export session
    const createOutput = runCLI('session new "Import Test"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];

    const exportPath = join(TEST_SESSION_DIR, 'exported.json');
    runCLI(`session export ${sessionId} ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    // Delete session
    runCLI(`session delete ${sessionId}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    // Import it back
    const output = runCLI(`session import ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Imported session');
    expect(output).toContain('Import Test');
  });

  it('should export all sessions', async () => {
    runCLI('session new "Session 1"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });
    runCLI('session new "Session 2"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const exportPath = join(TEST_SESSION_DIR, 'all-sessions.json');
    const output = runCLI(`session export-all ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Exported 2 sessions');
    expect(existsSync(exportPath)).toBe(true);
  });

  it('should import multiple sessions', async () => {
    runCLI('session new "Session 1"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });
    runCLI('session new "Session 2"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const exportPath = join(TEST_SESSION_DIR, 'all-sessions.json');
    runCLI(`session export-all ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    // Clear sessions
    runCLI('session delete-all', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    // Import them back
    const output = runCLI(`session import-all ${exportPath}`, {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Imported 2 sessions');
  });
});

describe('CLI - Session Persistence', () => {
  beforeEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_SESSION_DIR, { recursive: true });
  });

  afterEach(async () => {
    if (existsSync(TEST_SESSION_DIR)) {
      await rm(TEST_SESSION_DIR, { recursive: true, force: true });
    }
  });

  it('should persist session to disk automatically', async () => {
    const createOutput = runCLI('session new "Persistent Session"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];

    // Check that session file exists
    const sessionFile = join(TEST_SESSION_DIR, `${sessionId}.json`);
    expect(existsSync(sessionFile)).toBe(true);
  });

  it('should load session from disk on next command', () => {
    // Create session and generate story
    runCLI('session new "Load Test"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });
    runCLI('story "A detective story"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    // List sessions (should load from disk)
    const output = runCLI('session list', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Load Test');
    expect(output).toContain('1 story');
  });

  it('should update session file after each operation', async () => {
    const createOutput = runCLI('session new "Update Test"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    const idMatch = createOutput.match(/ID: ([a-z0-9-]+)/);
    const sessionId = idMatch?.[1];
    const sessionFile = join(TEST_SESSION_DIR, `${sessionId}.json`);

    // Read initial file
    const before = await readFile(sessionFile, 'utf-8');
    const beforeData = JSON.parse(before);

    // Generate story
    runCLI('story "A detective story"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key'
    });

    // Read updated file
    const after = await readFile(sessionFile, 'utf-8');
    const afterData = JSON.parse(after);

    expect(afterData.storyHistory.length).toBeGreaterThan(beforeData.storyHistory?.length || 0);
  });
});

describe('CLI - Error Handling', () => {
  it('should show error when OPENAI_API_KEY not set', () => {
    const output = runCLI('story "test"', {
      OPENAI_API_KEY: ''
    });

    expect(output).toContain('OPENAI_API_KEY');
    expect(output).toContain('required');
  });

  it('should show error when session not found', () => {
    const output = runCLI('session delete non-existent-id', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Session not found');
  });

  it('should show error when improving story without initial story', () => {
    runCLI('session new "Empty Session"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    const output = runCLI('story improve "Add tension"', {
      SIDVID_SESSION_DIR: TEST_SESSION_DIR,
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('No story to improve');
  });

  it('should show help when no command provided', () => {
    const output = runCLI('', {
      OPENAI_API_KEY: 'test-key'
    });

    expect(output).toContain('Usage:');
    expect(output).toContain('Commands:');
  });
});
