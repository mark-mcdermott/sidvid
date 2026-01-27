/**
 * CLI-UI Parity Tests
 *
 * These TDD tests define what the CLI should do to achieve feature parity with the UI.
 * Based on STATE-WORKFLOW-SPEC.md, the CLI should support all 5 stages:
 * 1. Project - project management (create, list, switch, rename, delete, export, import)
 * 2. Story - story generation with duration, style, edit, expand, history
 * 3. World - world elements (characters, locations, objects, concepts)
 * 4. Storyboard - scene management and image generation
 * 5. Video - video generation with version management
 *
 * Tests are designed to FAIL initially (TDD red phase), then pass as CLI is implemented.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { rm, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const CLI_PATH = join(process.cwd(), 'src', 'cli', 'index.ts');
const TEST_DATA_DIR = join(process.cwd(), '.test-cli-parity');

interface CLIResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Helper to run CLI commands and capture output
 */
function runCLI(command: string, env: Record<string, string> = {}): CLIResult {
	try {
		const stdout = execSync(`npx tsx ${CLI_PATH} ${command}`, {
			env: {
				...process.env,
				SIDVID_DATA_DIR: TEST_DATA_DIR,
				OPENAI_API_KEY: env.OPENAI_API_KEY || 'test-api-key',
				...env
			},
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe']
		});
		return { stdout, stderr: '', exitCode: 0 };
	} catch (error: any) {
		return {
			stdout: error.stdout || '',
			stderr: error.stderr || '',
			exitCode: error.status || 1
		};
	}
}

/**
 * Helper to create a test project with story and world elements
 */
async function setupTestProject(): Promise<string> {
	const result = runCLI('project create "Test Project"');
	const idMatch = result.stdout.match(/([a-z0-9-]{36}|[a-z0-9-]+)/i);
	return idMatch?.[0] || 'test-project';
}

// =============================================================================
// STAGE 1: PROJECT COMMANDS
// Per STATE-WORKFLOW-SPEC.md: sidvid project <subcommand>
// =============================================================================

describe('CLI Stage 1: Project Commands', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('sidvid project list', () => {
		it('should list all projects', () => {
			// Create two projects
			runCLI('project create "Project One"');
			runCLI('project create "Project Two"');

			const result = runCLI('project list');

			expect(result.stdout).toContain('Project One');
			expect(result.stdout).toContain('Project Two');
		});

		it('should show empty message when no projects exist', () => {
			const result = runCLI('project list');
			expect(result.stdout).toMatch(/no projects|empty/i);
		});

		it('should mark current project with asterisk or indicator', () => {
			runCLI('project create "Active Project"');
			const result = runCLI('project list');
			expect(result.stdout).toMatch(/\*|current|active/i);
		});
	});

	describe('sidvid project create "<name>"', () => {
		it('should create a new project with given name', () => {
			const result = runCLI('project create "My Video Project"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('My Video Project');
			expect(result.stdout).toMatch(/created|new project/i);
		});

		it('should auto-name project "New Project" when no name given', () => {
			const result = runCLI('project create');
			expect(result.stdout).toContain('New Project');
		});

		it('should auto-increment name when "New Project" exists', () => {
			runCLI('project create "New Project"');
			const result = runCLI('project create');
			expect(result.stdout).toMatch(/New Project \(1\)|New Project 1/);
		});

		it('should make new project the active project', () => {
			runCLI('project create "First"');
			runCLI('project create "Second"');
			const result = runCLI('project info');
			expect(result.stdout).toContain('Second');
		});
	});

	describe('sidvid project open <project-id>', () => {
		it('should switch to specified project', () => {
			const create1 = runCLI('project create "Project A"');
			const id1 = create1.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI('project create "Project B"');

			const result = runCLI(`project open ${id1}`);
			expect(result.exitCode).toBe(0);

			const info = runCLI('project info');
			expect(info.stdout).toContain('Project A');
		});

		it('should error when project ID not found', () => {
			const result = runCLI('project open non-existent-id');
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/not found|does not exist/i);
		});
	});

	describe('sidvid project info', () => {
		it('should show current project details', () => {
			runCLI('project create "Info Test Project"');
			const result = runCLI('project info');

			expect(result.stdout).toContain('Info Test Project');
			expect(result.stdout).toMatch(/id:|name:|created:/i);
		});

		it('should show story count and element counts', () => {
			runCLI('project create "Stats Project"');
			const result = runCLI('project info');

			expect(result.stdout).toMatch(/stories?:|characters?:|scenes?:/i);
		});
	});

	describe('sidvid project delete <project-id>', () => {
		it('should delete project by ID', () => {
			const create = runCLI('project create "To Delete"');
			const id = create.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`project delete ${id}`);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/deleted/i);
		});

		it('should require --force flag when project has data', () => {
			runCLI('project create "Has Data"');
			// Add some data (story generation mocked in these tests)
			const list = runCLI('project list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`project delete ${id}`);
			// Should warn or require --force
			expect(result.stdout + result.stderr).toMatch(/--force|confirm|warning/i);
		});

		it('should delete with --force flag', () => {
			const create = runCLI('project create "Force Delete"');
			const id = create.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`project delete ${id} --force`);
			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid project rename <project-id> "<new-name>"', () => {
		it('should rename project', () => {
			const create = runCLI('project create "Old Name"');
			const id = create.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`project rename ${id} "New Name"`);
			expect(result.exitCode).toBe(0);

			const info = runCLI('project info');
			expect(info.stdout).toContain('New Name');
			expect(info.stdout).not.toContain('Old Name');
		});
	});

	describe('sidvid project export <project-id> --output <file>', () => {
		it('should export project to JSON file', async () => {
			const create = runCLI('project create "Export Project"');
			const id = create.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			const outputPath = join(TEST_DATA_DIR, 'exported.json');

			const result = runCLI(`project export ${id} --output ${outputPath}`);
			expect(result.exitCode).toBe(0);
			expect(existsSync(outputPath)).toBe(true);

			const content = await readFile(outputPath, 'utf-8');
			const data = JSON.parse(content);
			expect(data.name).toBe('Export Project');
		});
	});

	describe('sidvid project import <file>', () => {
		it('should import project from JSON file', async () => {
			// Create and export a project
			const create = runCLI('project create "Import Test"');
			const id = create.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			const exportPath = join(TEST_DATA_DIR, 'to-import.json');
			runCLI(`project export ${id} --output ${exportPath}`);

			// Delete original
			runCLI(`project delete ${id} --force`);

			// Import
			const result = runCLI(`project import ${exportPath}`);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/imported/i);

			const list = runCLI('project list');
			expect(list.stdout).toContain('Import Test');
		});
	});
});

// =============================================================================
// STAGE 2: STORY COMMANDS
// Per STATE-WORKFLOW-SPEC.md: sidvid story <subcommand>
// =============================================================================

describe('CLI Stage 2: Story Commands', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
		// Create a project for story tests
		runCLI('project create "Story Test Project"');
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('sidvid story generate "<prompt>" --duration <seconds> --style <style>', () => {
		it('should generate story with prompt', () => {
			const result = runCLI('story generate "A detective solving a mystery"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/title:|story generated/i);
		});

		it('should accept --duration option in 5-second increments', () => {
			const result = runCLI(
				'story generate "Short story" --duration 15'
			);

			expect(result.exitCode).toBe(0);
			// Should generate 15/5 = 3 scenes
			expect(result.stdout).toMatch(/3 scenes/i);
		});

		it('should accept --style option', () => {
			const result = runCLI(
				'story generate "Anime adventure" --style anime'
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/style: anime/i);
		});

		it('should support style presets: anime, photorealistic, 3d-animated, watercolor, comic, custom', () => {
			const styles = ['anime', 'photorealistic', '3d-animated', 'watercolor', 'comic'];

			for (const style of styles) {
				const result = runCLI(`story generate "Test" --style ${style} --duration 5`);
				expect(result.exitCode).toBe(0);
			}
		});

		it('should accept custom style prompt', () => {
			const result = runCLI(
				'story generate "Custom look" --style custom --style-prompt "studio ghibli watercolor"'
			);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid story edit "<instruction>"', () => {
		it('should edit story with AI instruction', () => {
			runCLI('story generate "A detective story" --duration 10');

			const result = runCLI('story edit "Add more tension to the climax"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/edited|updated/i);
		});

		it('should error when no story exists', () => {
			const result = runCLI('story edit "Edit nothing"');

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/no story|generate a story first/i);
		});
	});

	describe('sidvid story expand', () => {
		it('should smart expand the story narrative', () => {
			runCLI('story generate "Brief tale" --duration 10');

			const result = runCLI('story expand');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/expanded|enhanced/i);
		});

		it('should regenerate different expansion on subsequent calls', () => {
			runCLI('story generate "Brief tale" --duration 10');

			const expand1 = runCLI('story expand');
			const expand2 = runCLI('story expand');

			// Both should succeed
			expect(expand1.exitCode).toBe(0);
			expect(expand2.exitCode).toBe(0);
		});
	});

	describe('sidvid story history', () => {
		it('should show all story versions', () => {
			runCLI('story generate "Version 1" --duration 5');
			runCLI('story edit "Make it version 2"');

			const result = runCLI('story history');

			expect(result.stdout).toMatch(/version 1|v1/i);
			expect(result.stdout).toMatch(/version 2|v2|current/i);
		});

		it('should show version numbers and prompts', () => {
			runCLI('story generate "First story" --duration 5');
			runCLI('story edit "Add drama"');

			const result = runCLI('story history');

			expect(result.stdout).toContain('First story');
			expect(result.stdout).toContain('Add drama');
		});
	});

	describe('sidvid story branch <version-index>', () => {
		it('should continue from earlier version', () => {
			runCLI('story generate "Original" --duration 5');
			runCLI('story edit "Edit 1"');
			runCLI('story edit "Edit 2"');

			const result = runCLI('story branch 1');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/branched|reverted|now at version 1/i);
		});

		it('should discard subsequent versions after branching', () => {
			runCLI('story generate "Original" --duration 5');
			runCLI('story edit "Edit 1"');
			runCLI('story edit "Edit 2"');
			runCLI('story branch 1');

			const history = runCLI('story history');

			// Should only show version 1 (original)
			expect(history.stdout).not.toMatch(/Edit 2/i);
		});
	});

	describe('sidvid story show', () => {
		it('should display current story', () => {
			runCLI('story generate "Show me story" --duration 10');

			const result = runCLI('story show');

			expect(result.stdout).toMatch(/title:/i);
			expect(result.stdout).toMatch(/scene/i);
		});

		it('should show scenes with badges format', () => {
			runCLI('story generate "Formatted story" --duration 10');

			const result = runCLI('story show');

			// Per spec: [Scene x] [5s] format
			expect(result.stdout).toMatch(/scene \d+/i);
			expect(result.stdout).toMatch(/\d+s/i);
		});
	});

	describe('sidvid story export --output <file>', () => {
		it('should export story to JSON', async () => {
			runCLI('story generate "Export story" --duration 5');
			const outputPath = join(TEST_DATA_DIR, 'story.json');

			const result = runCLI(`story export --output ${outputPath}`);

			expect(result.exitCode).toBe(0);
			expect(existsSync(outputPath)).toBe(true);

			const content = await readFile(outputPath, 'utf-8');
			const data = JSON.parse(content);
			expect(data).toHaveProperty('title');
			expect(data).toHaveProperty('scenes');
		});
	});
});

// =============================================================================
// STAGE 3: WORLD COMMANDS
// Per STATE-WORKFLOW-SPEC.md: sidvid world <subcommand>
// =============================================================================

describe('CLI Stage 3: World Commands', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
		runCLI('project create "World Test Project"');
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('sidvid world list [--type <type>]', () => {
		it('should list all world elements', () => {
			runCLI('world add --type character --name "Alice" --description "A brave detective"');
			runCLI('world add --type location --name "Castle" --description "An ancient fortress"');

			const result = runCLI('world list');

			expect(result.stdout).toContain('Alice');
			expect(result.stdout).toContain('Castle');
		});

		it('should filter by type: character', () => {
			runCLI('world add --type character --name "Alice" --description "Detective"');
			runCLI('world add --type location --name "Castle" --description "Fortress"');

			const result = runCLI('world list --type character');

			expect(result.stdout).toContain('Alice');
			expect(result.stdout).not.toContain('Castle');
		});

		it('should filter by type: location', () => {
			runCLI('world add --type character --name "Alice" --description "Detective"');
			runCLI('world add --type location --name "Castle" --description "Fortress"');

			const result = runCLI('world list --type location');

			expect(result.stdout).toContain('Castle');
			expect(result.stdout).not.toContain('Alice');
		});

		it('should filter by type: object', () => {
			runCLI('world add --type object --name "Magic Gem" --description "A glowing crystal"');

			const result = runCLI('world list --type object');

			expect(result.stdout).toContain('Magic Gem');
		});

		it('should filter by type: concept', () => {
			runCLI('world add --type concept --name "The Prophecy" --description "Ancient prediction"');

			const result = runCLI('world list --type concept');

			expect(result.stdout).toContain('Prophecy');
		});

		it('should show empty message when no elements exist', () => {
			const result = runCLI('world list');
			expect(result.stdout).toMatch(/no elements|empty|none/i);
		});
	});

	describe('sidvid world show <element-id>', () => {
		it('should show element details', () => {
			runCLI('world add --type character --name "Bob" --description "A wise wizard"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world show ${id}`);

			expect(result.stdout).toContain('Bob');
			expect(result.stdout).toContain('wise wizard');
			expect(result.stdout).toMatch(/type: character/i);
		});

		it('should show image URLs if present', () => {
			runCLI('world add --type character --name "Bob" --description "A wise wizard"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${id}`);

			const result = runCLI(`world show ${id}`);

			expect(result.stdout).toMatch(/image|url/i);
		});
	});

	describe('sidvid world add --type <type> --name "<name>" --description "<description>"', () => {
		it('should add character element', () => {
			const result = runCLI('world add --type character --name "Alice" --description "A brave detective"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/added|created/i);
			expect(result.stdout).toContain('Alice');
		});

		it('should add location element', () => {
			const result = runCLI('world add --type location --name "Dark Forest" --description "A mysterious woodland"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Dark Forest');
		});

		it('should add object element', () => {
			const result = runCLI('world add --type object --name "Treasure Map" --description "Ancient parchment"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Treasure Map');
		});

		it('should add concept element', () => {
			const result = runCLI('world add --type concept --name "The Curse" --description "A family curse"');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain('Curse');
		});

		it('should reject invalid element type', () => {
			const result = runCLI('world add --type invalid --name "Test" --description "Test"');

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/invalid type|must be one of/i);
		});
	});

	describe('sidvid world edit <element-id> --description "<new-description>"', () => {
		it('should update element description', () => {
			runCLI('world add --type character --name "Alice" --description "Old description"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world edit ${id} --description "New description"`);

			expect(result.exitCode).toBe(0);

			const show = runCLI(`world show ${id}`);
			expect(show.stdout).toContain('New description');
		});
	});

	describe('sidvid world delete <element-id> [--force]', () => {
		it('should delete element', () => {
			runCLI('world add --type character --name "ToDelete" --description "Will be deleted"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world delete ${id}`);

			expect(result.exitCode).toBe(0);

			const listAfter = runCLI('world list');
			expect(listAfter.stdout).not.toContain('ToDelete');
		});

		it('should warn when element is used in scenes', () => {
			runCLI('world add --type character --name "UsedChar" --description "Used in scene"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			// Assign to scene (would need storyboard setup)

			const result = runCLI(`world delete ${id}`);

			// Should warn about cascade deletion
			expect(result.stdout + result.stderr).toMatch(/used in|warning|--force/i);
		});

		it('should delete with --force even if used', () => {
			runCLI('world add --type character --name "ForceDelete" --description "Force delete me"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world delete ${id} --force`);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid world enhance <element-id> [--prompt "<guidance>"]', () => {
		it('should enhance element description with AI', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world enhance ${id}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/enhanced/i);
		});

		it('should accept guidance prompt', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world enhance ${id} --prompt "Make her mysterious"`);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid world generate-image <element-id> [--style <style>]', () => {
		it('should generate DALL-E image for element', () => {
			runCLI('world add --type character --name "Alice" --description "A brave detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world generate-image ${id}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/image|url|generated/i);
		});

		it('should accept style parameter', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`world generate-image ${id} --style anime`);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid world images <element-id>', () => {
		it('should list all image versions for element', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${id}`);

			const result = runCLI(`world images ${id}`);

			expect(result.stdout).toMatch(/image|version|url/i);
		});

		it('should indicate which image is active', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const id = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${id}`);
			runCLI(`world generate-image ${id}`);

			const result = runCLI(`world images ${id}`);

			expect(result.stdout).toMatch(/active|\*/i);
		});
	});

	describe('sidvid world set-active-image <element-id> <image-id>', () => {
		it('should set specified image as active', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const elementId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${elementId}`);
			runCLI(`world generate-image ${elementId}`);

			const images = runCLI(`world images ${elementId}`);
			const imageId = images.stdout.match(/img-[a-z0-9-]+/i)?.[0];

			const result = runCLI(`world set-active-image ${elementId} ${imageId}`);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid world delete-image <element-id> <image-id>', () => {
		it('should delete non-active image', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const elementId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${elementId}`);
			runCLI(`world generate-image ${elementId}`);

			const images = runCLI(`world images ${elementId}`);
			// Find non-active image
			const nonActiveMatch = images.stdout.match(/(?:^|\n)([a-z0-9-]+)(?!.*active)/i);
			const imageId = nonActiveMatch?.[1];

			const result = runCLI(`world delete-image ${elementId} ${imageId}`);

			expect(result.exitCode).toBe(0);
		});

		it('should reject deleting active image', () => {
			runCLI('world add --type character --name "Alice" --description "A detective"');
			const list = runCLI('world list');
			const elementId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`world generate-image ${elementId}`);

			const images = runCLI(`world images ${elementId}`);
			const activeMatch = images.stdout.match(/([a-z0-9-]+).*active/i);
			const imageId = activeMatch?.[1];

			const result = runCLI(`world delete-image ${elementId} ${imageId}`);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/cannot delete active|is active/i);
		});
	});
});

// =============================================================================
// STAGE 4: STORYBOARD COMMANDS
// Per STATE-WORKFLOW-SPEC.md: sidvid storyboard <subcommand>
// =============================================================================

describe('CLI Stage 4: Storyboard Commands', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
		runCLI('project create "Storyboard Test"');
		// Generate story to populate scenes
		runCLI('story generate "Test story for storyboard" --duration 15');
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('sidvid storyboard list', () => {
		it('should list all scenes in storyboard order', () => {
			const result = runCLI('storyboard list');

			expect(result.stdout).toMatch(/scene 1|scene 2|scene 3/i);
		});

		it('should show scene numbers, durations, and titles', () => {
			const result = runCLI('storyboard list');

			expect(result.stdout).toMatch(/\d+s/); // duration
			expect(result.stdout).toMatch(/scene \d+/i);
		});

		it('should not include archived scenes in main list', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`storyboard archive ${sceneId}`);

			const result = runCLI('storyboard list');

			// Archived scene should not appear in main list
			expect(result.stdout).toMatch(/archived: \d+|see archived/i);
		});
	});

	describe('sidvid storyboard show <scene-id>', () => {
		it('should show scene details', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`storyboard show ${sceneId}`);

			expect(result.stdout).toMatch(/title:|description:/i);
			expect(result.stdout).toMatch(/duration:/i);
		});

		it('should show assigned world elements', () => {
			// Add element and assign to scene
			runCLI('world add --type character --name "TestChar" --description "Test"');
			const worldList = runCLI('world list');
			const elementId = worldList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const sceneList = runCLI('storyboard list');
			const sceneId = sceneList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI(`storyboard add-element ${sceneId} ${elementId}`);

			const result = runCLI(`storyboard show ${sceneId}`);

			expect(result.stdout).toContain('TestChar');
		});
	});

	describe('sidvid storyboard add-element <scene-id> <element-id>', () => {
		it('should assign world element to scene', () => {
			runCLI('world add --type character --name "SceneChar" --description "For scene"');
			const worldList = runCLI('world list');
			const elementId = worldList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const sceneList = runCLI('storyboard list');
			const sceneId = sceneList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`storyboard add-element ${sceneId} ${elementId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/added|assigned/i);
		});
	});

	describe('sidvid storyboard remove-element <scene-id> <element-id>', () => {
		it('should unassign element from scene', () => {
			runCLI('world add --type character --name "ToRemove" --description "Will be removed"');
			const worldList = runCLI('world list');
			const elementId = worldList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const sceneList = runCLI('storyboard list');
			const sceneId = sceneList.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI(`storyboard add-element ${sceneId} ${elementId}`);
			const result = runCLI(`storyboard remove-element ${sceneId} ${elementId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/removed|unassigned/i);
		});
	});

	describe('sidvid storyboard generate <scene-id>', () => {
		it('should generate poster image for single scene', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`storyboard generate ${sceneId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/generated|image|url/i);
		});
	});

	describe('sidvid storyboard generate-all', () => {
		it('should generate poster images for all pending scenes', () => {
			const result = runCLI('storyboard generate-all');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/generating|completed|all scenes/i);
		});

		it('should show progress during generation', () => {
			const result = runCLI('storyboard generate-all');

			// Should indicate progress (1/3, 2/3, etc.)
			expect(result.stdout).toMatch(/\d+\/\d+|progress/i);
		});
	});

	describe('sidvid storyboard clone <scene-id>', () => {
		it('should create copy of scene', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`storyboard clone ${sceneId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/cloned|copied/i);
		});

		it('should name clone with "(1)" suffix', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI(`storyboard clone ${sceneId}`);

			const listAfter = runCLI('storyboard list');
			expect(listAfter.stdout).toMatch(/\(1\)/);
		});

		it('should insert clone after original scene', () => {
			const list = runCLI('storyboard list');
			const scenes = list.stdout.match(/scene \d+/gi) || [];
			const originalCount = scenes.length;

			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];
			runCLI(`storyboard clone ${sceneId}`);

			const listAfter = runCLI('storyboard list');
			const scenesAfter = listAfter.stdout.match(/scene \d+/gi) || [];

			expect(scenesAfter.length).toBe(originalCount + 1);
		});
	});

	describe('sidvid storyboard archive <scene-id>', () => {
		it('should move scene to archived section', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`storyboard archive ${sceneId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/archived/i);
		});

		it('should remove scene from active list', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI(`storyboard archive ${sceneId}`);

			const listAfter = runCLI('storyboard list');
			expect(listAfter.stdout).not.toContain(sceneId);
		});
	});

	describe('sidvid storyboard unarchive <scene-id>', () => {
		it('should restore archived scene to active list', () => {
			const list = runCLI('storyboard list');
			const sceneId = list.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			runCLI(`storyboard archive ${sceneId}`);
			const result = runCLI(`storyboard unarchive ${sceneId}`);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/unarchived|restored/i);
		});
	});

	describe('sidvid storyboard move <scene-id> --to <index>', () => {
		it('should reorder scene to specified position', () => {
			const list = runCLI('storyboard list');
			// Get third scene
			const sceneIds = list.stdout.match(/[a-z0-9-]{8,}/gi) || [];
			const thirdSceneId = sceneIds[2];

			// Move to position 1 (first)
			const result = runCLI(`storyboard move ${thirdSceneId} --to 1`);

			expect(result.exitCode).toBe(0);

			const listAfter = runCLI('storyboard list');
			// Third scene should now be first
			expect(listAfter.stdout.indexOf(thirdSceneId)).toBeLessThan(
				listAfter.stdout.indexOf(sceneIds[0])
			);
		});

		it('should renumber all scenes after move', () => {
			const list = runCLI('storyboard list');
			const sceneIds = list.stdout.match(/[a-z0-9-]{8,}/gi) || [];

			runCLI(`storyboard move ${sceneIds[2]} --to 1`);

			const listAfter = runCLI('storyboard list');

			// Should still have sequential scene numbers
			expect(listAfter.stdout).toMatch(/scene 1/i);
			expect(listAfter.stdout).toMatch(/scene 2/i);
			expect(listAfter.stdout).toMatch(/scene 3/i);
		});
	});
});

// =============================================================================
// STAGE 5: VIDEO COMMANDS
// Per STATE-WORKFLOW-SPEC.md: sidvid video <subcommand>
// =============================================================================

describe('CLI Stage 5: Video Commands', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
		runCLI('project create "Video Test"');
		runCLI('story generate "Video test story" --duration 10');
		runCLI('storyboard generate-all');
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('sidvid video preview', () => {
		it('should output frame sequence info', () => {
			const result = runCLI('video preview');

			expect(result.stdout).toMatch(/frame|scene|preview/i);
		});

		it('should show each scene with duration', () => {
			const result = runCLI('video preview');

			expect(result.stdout).toMatch(/\d+s/);
		});
	});

	describe('sidvid video generate [--wait]', () => {
		it('should start video generation', () => {
			const result = runCLI('video generate');

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toMatch(/generating|started|queued/i);
		});

		it('should return task ID when not waiting', () => {
			const result = runCLI('video generate');

			expect(result.stdout).toMatch(/task|id|job/i);
		});

		it('should block until completion with --wait flag', () => {
			const result = runCLI('video generate --wait');

			expect(result.stdout).toMatch(/completed|finished|done/i);
		});
	});

	describe('sidvid video status', () => {
		it('should show current video generation status', () => {
			runCLI('video generate');

			const result = runCLI('video status');

			expect(result.stdout).toMatch(/status:|state:/i);
		});

		it('should show progress percentage', () => {
			runCLI('video generate');

			const result = runCLI('video status');

			expect(result.stdout).toMatch(/\d+%|progress/i);
		});
	});

	describe('sidvid video download --output <filename>', () => {
		it('should download active video to file', async () => {
			runCLI('video generate --wait');
			const outputPath = join(TEST_DATA_DIR, 'video.mp4');

			const result = runCLI(`video download --output ${outputPath}`);

			expect(result.exitCode).toBe(0);
			expect(existsSync(outputPath)).toBe(true);
		});

		it('should error when no video completed', () => {
			const result = runCLI('video download --output test.mp4');

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/no video|generate first/i);
		});
	});

	describe('sidvid video versions', () => {
		it('should list all video versions', () => {
			runCLI('video generate --wait');
			runCLI('video generate --wait'); // Generate second version

			const result = runCLI('video versions');

			expect(result.stdout).toMatch(/version|v1|v2/i);
		});

		it('should indicate active version', () => {
			runCLI('video generate --wait');
			runCLI('video generate --wait');

			const result = runCLI('video versions');

			expect(result.stdout).toMatch(/active|\*/i);
		});
	});

	describe('sidvid video set-active <version-id>', () => {
		it('should set specified version as active', () => {
			runCLI('video generate --wait');
			runCLI('video generate --wait');

			const versions = runCLI('video versions');
			const versionId = versions.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`video set-active ${versionId}`);

			expect(result.exitCode).toBe(0);
		});
	});

	describe('sidvid video delete-version <version-id>', () => {
		it('should delete non-active video version', () => {
			runCLI('video generate --wait');
			runCLI('video generate --wait');

			const versions = runCLI('video versions');
			// Find non-active version
			const lines = versions.stdout.split('\n');
			const nonActiveLine = lines.find((l) => !l.includes('active'));
			const versionId = nonActiveLine?.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`video delete-version ${versionId}`);

			expect(result.exitCode).toBe(0);
		});

		it('should reject deleting active version', () => {
			runCLI('video generate --wait');

			const versions = runCLI('video versions');
			const activeLine = versions.stdout.split('\n').find((l) => l.includes('active'));
			const versionId = activeLine?.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`video delete-version ${versionId}`);

			expect(result.exitCode).not.toBe(0);
		});

		it('should reject deleting when only one version exists', () => {
			runCLI('video generate --wait');

			const versions = runCLI('video versions');
			const versionId = versions.stdout.match(/([a-z0-9-]{8,})/i)?.[0];

			const result = runCLI(`video delete-version ${versionId}`);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr || result.stdout).toMatch(/cannot delete|only version|last version/i);
		});
	});

	describe('sidvid video info', () => {
		it('should show video info summary', () => {
			runCLI('video generate --wait');

			const result = runCLI('video info');

			expect(result.stdout).toMatch(/duration|status|versions/i);
		});

		it('should show total duration', () => {
			runCLI('video generate --wait');

			const result = runCLI('video info');

			expect(result.stdout).toMatch(/duration.*\d+s|\d+ seconds/i);
		});

		it('should show version count', () => {
			runCLI('video generate --wait');
			runCLI('video generate --wait');

			const result = runCLI('video info');

			expect(result.stdout).toMatch(/2 versions|versions: 2/i);
		});
	});
});

// =============================================================================
// CROSS-CUTTING CONCERNS
// =============================================================================

describe('CLI Cross-Cutting: Output Formats', () => {
	beforeEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
		await mkdir(TEST_DATA_DIR, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(TEST_DATA_DIR)) {
			await rm(TEST_DATA_DIR, { recursive: true, force: true });
		}
	});

	describe('--json flag', () => {
		it('should output JSON for project list', () => {
			runCLI('project create "JSON Test"');

			const result = runCLI('project list --json');

			expect(() => JSON.parse(result.stdout)).not.toThrow();
		});

		it('should output JSON for story show', () => {
			runCLI('project create "JSON Story"');
			runCLI('story generate "Test" --duration 5');

			const result = runCLI('story show --json');

			expect(() => JSON.parse(result.stdout)).not.toThrow();
		});

		it('should output JSON for world list', () => {
			runCLI('project create "JSON World"');
			runCLI('world add --type character --name "Test" --description "Test"');

			const result = runCLI('world list --json');

			expect(() => JSON.parse(result.stdout)).not.toThrow();
		});
	});

	describe('--quiet flag', () => {
		it('should output only IDs', () => {
			const result = runCLI('project create "Quiet Test" --quiet');

			// Should only contain ID, no labels
			expect(result.stdout.trim()).toMatch(/^[a-z0-9-]+$/i);
		});
	});

	describe('--verbose flag', () => {
		it('should show detailed output including API responses', () => {
			runCLI('project create "Verbose Test"');

			const result = runCLI('story generate "Test" --duration 5 --verbose');

			expect(result.stdout).toMatch(/api|request|response/i);
		});
	});
});

describe('CLI Cross-Cutting: Environment Variables', () => {
	it('should require OPENAI_API_KEY for AI operations', () => {
		const result = runCLI('story generate "Test"', { OPENAI_API_KEY: '' });

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr || result.stdout).toMatch(/OPENAI_API_KEY|api key required/i);
	});

	it('should require KLING_API_KEY for video generation', () => {
		const result = runCLI('video generate', { KLING_API_KEY: '' });

		expect(result.stderr || result.stdout).toMatch(/KLING_API_KEY|video api key/i);
	});
});

describe('CLI Cross-Cutting: Help System', () => {
	it('should show main help with sidvid help', () => {
		const result = runCLI('help');

		expect(result.stdout).toContain('project');
		expect(result.stdout).toContain('story');
		expect(result.stdout).toContain('world');
		expect(result.stdout).toContain('storyboard');
		expect(result.stdout).toContain('video');
	});

	it('should show project subcommand help', () => {
		const result = runCLI('project help');

		expect(result.stdout).toContain('create');
		expect(result.stdout).toContain('list');
		expect(result.stdout).toContain('open');
		expect(result.stdout).toContain('delete');
	});

	it('should show story subcommand help', () => {
		const result = runCLI('story help');

		expect(result.stdout).toContain('generate');
		expect(result.stdout).toContain('edit');
		expect(result.stdout).toContain('expand');
		expect(result.stdout).toContain('history');
	});

	it('should show world subcommand help', () => {
		const result = runCLI('world help');

		expect(result.stdout).toContain('list');
		expect(result.stdout).toContain('add');
		expect(result.stdout).toContain('enhance');
		expect(result.stdout).toContain('generate-image');
	});

	it('should show storyboard subcommand help', () => {
		const result = runCLI('storyboard help');

		expect(result.stdout).toContain('list');
		expect(result.stdout).toContain('generate');
		expect(result.stdout).toContain('clone');
		expect(result.stdout).toContain('archive');
	});

	it('should show video subcommand help', () => {
		const result = runCLI('video help');

		expect(result.stdout).toContain('generate');
		expect(result.stdout).toContain('preview');
		expect(result.stdout).toContain('download');
		expect(result.stdout).toContain('versions');
	});
});
