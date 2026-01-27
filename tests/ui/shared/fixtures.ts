import { test as base, Page } from '@playwright/test';
import type {
	Project,
	Story,
	WorldElement,
	Scene,
	Video,
	Style,
	ElementType,
	SceneStatus,
	VideoStatus
} from './types';

/**
 * Spec-aligned test fixtures for SidVid TDD
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 */

// =============================================================================
// FIXTURE BUILDERS - Create spec-compliant test data
// =============================================================================

export function createProject(overrides: Partial<Project> = {}): Project {
	const now = new Date();
	return {
		id: `proj-${Date.now()}`,
		name: 'New Project',
		description: undefined,
		thumbnail: undefined,
		createdAt: now,
		updatedAt: now,
		lastOpenedAt: now,
		storyHistory: [],
		storyHistoryIndex: -1,
		currentStory: null,
		worldElements: new Map(),
		scenes: [],
		video: null,
		...overrides
	};
}

export function createStyle(overrides: Partial<Style> = {}): Style {
	return {
		preset: 'anime',
		...overrides
	};
}

export function createStory(overrides: Partial<Story> = {}): Story {
	return {
		id: `story-${Date.now()}`,
		title: 'Test Story',
		prompt: 'A short test story',
		style: createStyle(),
		targetDuration: 15,
		narrative: 'Once upon a time...',
		scenes: [
			{
				number: 1,
				title: 'Opening Scene',
				description: 'The adventure begins',
				dialogue: '',
				action: 'Hero appears',
				elementsPresent: ['Hero'],
				duration: 5
			},
			{
				number: 2,
				title: 'Middle Scene',
				description: 'The challenge',
				dialogue: 'We must continue!',
				action: 'Hero faces obstacle',
				elementsPresent: ['Hero', 'Villain'],
				duration: 5
			},
			{
				number: 3,
				title: 'Ending Scene',
				description: 'Resolution',
				dialogue: 'Victory!',
				action: 'Hero triumphs',
				elementsPresent: ['Hero'],
				duration: 5
			}
		],
		characters: [
			{
				name: 'Hero',
				description: 'The brave protagonist',
				physical: 'Tall with dark hair',
				profile: 'Courageous and kind'
			}
		],
		locations: [
			{
				name: 'Castle',
				description: 'An ancient stone castle'
			}
		],
		objects: [
			{
				name: 'Magic Sword',
				description: 'A glowing blade'
			}
		],
		concepts: [
			{
				name: 'Courage',
				description: 'The theme of bravery'
			}
		],
		createdAt: new Date(),
		...overrides
	};
}

export function createWorldElement(
	type: ElementType,
	overrides: Partial<WorldElement> = {}
): WorldElement {
	const now = new Date();
	return {
		id: `elem-${Date.now()}`,
		name: 'Test Element',
		type,
		description: `A test ${type}`,
		images: [],
		historyIndex: 0,
		history: [],
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

export function createScene(overrides: Partial<Scene> = {}): Scene {
	const now = new Date();
	return {
		id: `scene-${Date.now()}`,
		title: 'Test Scene',
		description: 'A test scene description',
		assignedElements: [],
		images: [],
		duration: 5,
		status: 'empty' as SceneStatus,
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

export function createVideo(overrides: Partial<Video> = {}): Video {
	return {
		id: `video-${Date.now()}`,
		projectId: 'test-project',
		status: 'not_started' as VideoStatus,
		versions: [],
		createdAt: new Date(),
		...overrides
	};
}

// =============================================================================
// API MOCK RESPONSES - Simulate backend responses
// =============================================================================

export const mockApiResponses = {
	// Project API responses
	listProjects: () => [
		{
			id: 'proj-1',
			name: 'My First Video',
			description: 'Test project',
			updatedAt: new Date().toISOString(),
			lastOpenedAt: new Date().toISOString()
		},
		{
			id: 'proj-2',
			name: 'Anime Short',
			description: 'Another project',
			updatedAt: new Date().toISOString(),
			lastOpenedAt: new Date().toISOString()
		}
	],

	createProject: (name: string = 'New Project') => ({
		id: `proj-${Date.now()}`,
		name,
		description: undefined,
		thumbnail: undefined,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		lastOpenedAt: new Date().toISOString(),
		storyHistory: [],
		storyHistoryIndex: -1,
		currentStory: null,
		worldElements: {},
		scenes: [],
		video: null
	}),

	// Story generation API response
	generateStory: (prompt: string, duration: number, style: Style) => ({
		story: {
			id: `story-${Date.now()}`,
			title: 'Generated Story',
			prompt,
			style,
			targetDuration: duration,
			narrative: `A story based on: ${prompt}`,
			scenes: Array.from({ length: duration / 5 }, (_, i) => ({
				number: i + 1,
				title: `Scene ${i + 1}`,
				description: `Scene ${i + 1} description`,
				dialogue: '',
				action: `Action ${i + 1}`,
				elementsPresent: ['Character 1'],
				duration: 5
			})),
			characters: [{ name: 'Character 1', description: 'Main character', physical: '', profile: '' }],
			locations: [{ name: 'Location 1', description: 'Main location' }],
			objects: [],
			concepts: [],
			createdAt: new Date().toISOString()
		},
		existingElementsUsed: [],
		newElementsIntroduced: [
			{ name: 'Character 1', type: 'character', description: 'Main character' },
			{ name: 'Location 1', type: 'location', description: 'Main location' }
		]
	}),

	// Image generation API response
	generateImage: () => ({
		id: `img-${Date.now()}`,
		imageUrl: 'https://example.com/generated-image.png',
		revisedPrompt: 'Generated image prompt',
		isActive: true,
		createdAt: new Date().toISOString()
	}),

	// Video generation API responses
	generateVideo: () => ({
		taskId: `task-${Date.now()}`,
		status: 'generating'
	}),

	videoStatus: (status: VideoStatus = 'completed') => ({
		status,
		videoUrl: status === 'completed' ? 'https://example.com/video.mp4' : undefined,
		error: status === 'failed' ? 'Generation failed' : undefined
	})
};

// =============================================================================
// PAGE MOCK SETUP HELPERS
// =============================================================================

/**
 * Setup all API mocks for a page
 */
export async function setupApiMocks(page: Page) {
	// Project API mocks
	await page.route('**/api/projects', async (route) => {
		const method = route.request().method();
		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockApiResponses.listProjects())
			});
		} else if (method === 'POST') {
			const body = route.request().postDataJSON();
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify(mockApiResponses.createProject(body?.name))
			});
		} else {
			await route.continue();
		}
	});

	// Project by ID
	await page.route('**/api/projects/*', async (route) => {
		const method = route.request().method();
		if (method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(mockApiResponses.createProject())
			});
		} else if (method === 'PUT') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		} else if (method === 'DELETE') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		} else {
			await route.continue();
		}
	});

	// Story generation
	await page.route('**/api/story/generate', async (route) => {
		const body = route.request().postDataJSON();
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(
				mockApiResponses.generateStory(body?.prompt || '', body?.duration || 15, body?.style || { preset: 'anime' })
			)
		});
	});

	// Image generation
	await page.route('**/api/images/generate', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(mockApiResponses.generateImage())
		});
	});

	// Video generation
	await page.route('**/api/video/generate', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(mockApiResponses.generateVideo())
		});
	});

	await page.route('**/api/video/status', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(mockApiResponses.videoStatus('completed'))
		});
	});
}

/**
 * Setup localStorage with initial project data
 */
export async function setupProjectInLocalStorage(page: Page, project: Partial<Project> = {}) {
	const fullProject = createProject(project);
	await page.evaluate((proj) => {
		// Convert Map to object for JSON serialization
		const serializable = {
			...proj,
			worldElements: {}
		};
		localStorage.setItem('sidvid-current-project', JSON.stringify(serializable));
		localStorage.setItem('sidvid-current-project-id', proj.id);
	}, fullProject);
	return fullProject;
}

// =============================================================================
// PLAYWRIGHT TEST FIXTURES
// =============================================================================

export type TestFixtures = {
	// Project fixtures
	mockProject: Project;
	mockProjectWithStory: Project;
	mockProjectComplete: Project;

	// Story fixtures
	mockStory: Story;

	// World element fixtures
	mockCharacter: WorldElement;
	mockLocation: WorldElement;
	mockObject: WorldElement;
	mockConcept: WorldElement;

	// Scene fixtures
	mockScene: Scene;
	mockSceneWithImage: Scene;

	// Video fixtures
	mockVideo: Video;
	mockVideoCompleted: Video;
};

export const test = base.extend<TestFixtures>({
	mockProject: async ({}, use) => {
		await use(createProject());
	},

	mockProjectWithStory: async ({}, use) => {
		const story = createStory();
		await use(
			createProject({
				currentStory: story,
				storyHistory: [story],
				storyHistoryIndex: 0
			})
		);
	},

	mockProjectComplete: async ({}, use) => {
		const story = createStory();
		const character = createWorldElement('character', { name: 'Hero', id: 'char-1' });
		const location = createWorldElement('location', { name: 'Castle', id: 'loc-1' });
		const scene1 = createScene({ id: 'scene-1', title: 'Scene 1', status: 'completed' as SceneStatus });
		const scene2 = createScene({ id: 'scene-2', title: 'Scene 2', status: 'completed' as SceneStatus });

		const worldElements = new Map<string, WorldElement>();
		worldElements.set('char-1', character);
		worldElements.set('loc-1', location);

		await use(
			createProject({
				currentStory: story,
				storyHistory: [story],
				storyHistoryIndex: 0,
				worldElements,
				scenes: [scene1, scene2],
				video: createVideo({ status: 'completed' as VideoStatus })
			})
		);
	},

	mockStory: async ({}, use) => {
		await use(createStory());
	},

	mockCharacter: async ({}, use) => {
		await use(
			createWorldElement('character', {
				name: 'Hero',
				description: 'A brave protagonist with determination'
			})
		);
	},

	mockLocation: async ({}, use) => {
		await use(
			createWorldElement('location', {
				name: 'Ancient Castle',
				description: 'A towering stone fortress'
			})
		);
	},

	mockObject: async ({}, use) => {
		await use(
			createWorldElement('object', {
				name: 'Magic Sword',
				description: 'A glowing enchanted blade'
			})
		);
	},

	mockConcept: async ({}, use) => {
		await use(
			createWorldElement('concept', {
				name: 'Prophecy',
				description: 'An ancient prediction of events'
			})
		);
	},

	mockScene: async ({}, use) => {
		await use(createScene());
	},

	mockSceneWithImage: async ({}, use) => {
		await use(
			createScene({
				status: 'completed' as SceneStatus,
				images: [
					{
						id: 'img-1',
						imageUrl: 'https://example.com/scene.png',
						revisedPrompt: 'Scene image',
						isActive: true,
						createdAt: new Date()
					}
				]
			})
		);
	},

	mockVideo: async ({}, use) => {
		await use(createVideo());
	},

	mockVideoCompleted: async ({}, use) => {
		await use(
			createVideo({
				status: 'completed' as VideoStatus,
				versions: [
					{
						id: 'vid-v1',
						videoUrl: 'https://example.com/video.mp4',
						duration: 15,
						isActive: true,
						createdAt: new Date()
					}
				]
			})
		);
	}
});

export { expect } from '@playwright/test';
