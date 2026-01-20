import { test as base } from '@playwright/test';

/**
 * Shared test fixtures for all features
 */

export type TestFixtures = {
	mockStory: {
		id: string;
		content: string;
		prompt: string;
		length: string;
	};
	mockCharacter: {
		id: string;
		name: string;
		description: string;
		imageUrl: string;
		storyId: string;
	};
	mockScene: {
		id: string;
		description: string;
		imageUrl: string;
		characterIds: string[];
	};
	mockStoryboard: {
		id: string;
		scenes: string[];
		duration: number;
	};
	mockVideo: {
		id: string;
		url: string;
		storyboardId: string;
	};
};

export const test = base.extend<TestFixtures>({
	mockStory: async ({}, use) => {
		await use({
			id: 'test-story-1',
			content: 'Once upon a time in a distant galaxy...',
			prompt: 'A space adventure story',
			length: '5s'
		});
	},

	mockCharacter: async ({}, use) => {
		await use({
			id: 'test-character-1',
			name: 'Captain Nova',
			description: 'A brave space explorer',
			imageUrl: 'https://example.com/character.png',
			storyId: 'test-story-1'
		});
	},

	mockScene: async ({}, use) => {
		await use({
			id: 'test-scene-1',
			description: 'A spaceship launching from Earth',
			imageUrl: 'https://example.com/scene.png',
			characterIds: ['test-character-1']
		});
	},

	mockStoryboard: async ({}, use) => {
		await use({
			id: 'test-storyboard-1',
			scenes: ['test-scene-1', 'test-scene-2'],
			duration: 30
		});
	},

	mockVideo: async ({}, use) => {
		await use({
			id: 'test-video-1',
			url: 'https://example.com/video.mp4',
			storyboardId: 'test-storyboard-1'
		});
	}
});

export { expect } from '@playwright/test';
