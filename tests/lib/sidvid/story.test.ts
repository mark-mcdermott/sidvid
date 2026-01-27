/**
 * Stage 2: Story - Unit Tests
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 *
 * Tests cover:
 * - Story generation and structure
 * - Duration and scene count relationship
 * - Style system and presets
 * - Smart expand behavior
 * - Story history management
 * - Story metadata (existingElementsUsed, newElementsIntroduced)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Types based on SCHEMAS-SPEC.md
type StylePreset = 'anime' | 'photorealistic' | '3d-animated' | 'watercolor' | 'comic' | 'custom';

interface Style {
	preset: StylePreset;
	customPrompt?: string;
}

interface StoryScene {
	number: number;
	title: string;
	description: string;
	dialogue: string;
	action: string;
	elementsPresent: string[];
	duration: number;
}

interface StoryCharacter {
	name: string;
	description: string;
	physical: string;
	profile: string;
}

interface StoryLocation {
	name: string;
	description: string;
}

interface StoryObject {
	name: string;
	description: string;
}

interface StoryConcept {
	name: string;
	description: string;
}

interface Story {
	id: string;
	title: string;
	prompt: string;
	style: Style;
	targetDuration: number;
	narrative: string;
	scenes: StoryScene[];
	characters: StoryCharacter[];
	locations: StoryLocation[];
	objects: StoryObject[];
	concepts: StoryConcept[];
	isSmartExpanded?: boolean;
	preExpansionNarrative?: string;
	createdAt: Date;
}

interface NewElement {
	name: string;
	type: 'character' | 'location' | 'object' | 'concept';
	description: string;
}

interface StoryGenerationResult {
	story: Story;
	existingElementsUsed: string[];
	newElementsIntroduced: NewElement[];
}

// Style prompts per spec
const STYLE_PROMPTS: Record<Exclude<StylePreset, 'custom'>, string> = {
	anime: 'anime style, cel-shaded, 2D animation, vibrant colors, NOT photorealistic, NOT 3D',
	photorealistic: 'photorealistic, cinematic lighting, 8K, hyperrealistic, film grain',
	'3d-animated': '3D animated, Pixar style, stylized characters, soft lighting, NOT photorealistic',
	watercolor: 'watercolor painting, soft edges, painterly, artistic, muted colors',
	comic: 'comic book style, bold outlines, halftone dots, dynamic poses, vibrant colors'
};

// Mock StoryManager for testing
class StoryManager {
	private stories: Map<string, Story> = new Map();
	private idCounter = 0;

	private generateId(): string {
		return `story-${Date.now()}-${this.idCounter++}-${Math.random().toString(36).substr(2, 9)}`;
	}

	async generateStory(
		prompt: string,
		targetDuration: number,
		style: Style,
		existingElements: { id: string; name: string; type: string }[] = []
	): Promise<StoryGenerationResult> {
		// Validate duration is 5-second increment
		if (targetDuration % 5 !== 0 || targetDuration < 5) {
			throw new Error('Duration must be a positive multiple of 5');
		}

		// Calculate scene count
		const sceneCount = targetDuration / 5;

		// Generate scenes
		const scenes: StoryScene[] = Array.from({ length: sceneCount }, (_, i) => ({
			number: i + 1,
			title: `Scene ${i + 1}`,
			description: `Scene ${i + 1} description`,
			dialogue: '',
			action: `Action ${i + 1}`,
			elementsPresent: [],
			duration: 5 // Fixed 5-second duration per spec
		}));

		const story: Story = {
			id: this.generateId(),
			title: 'Generated Story',
			prompt,
			style,
			targetDuration,
			narrative: `A story based on: ${prompt}`,
			scenes,
			characters: [],
			locations: [],
			objects: [],
			concepts: [],
			createdAt: new Date()
		};

		this.stories.set(story.id, story);

		return {
			story,
			existingElementsUsed: [],
			newElementsIntroduced: []
		};
	}

	async editStoryWithPrompt(storyId: string, instruction: string): Promise<Story> {
		const story = this.stories.get(storyId);
		if (!story) {
			throw new Error(`Story ${storyId} not found`);
		}

		// Apply edit (mock implementation)
		const editedStory: Story = {
			...story,
			id: this.generateId(),
			narrative: `${story.narrative} [Edited: ${instruction}]`,
			createdAt: new Date()
		};

		this.stories.set(editedStory.id, editedStory);
		return editedStory;
	}

	async smartExpand(storyId: string): Promise<Story> {
		const story = this.stories.get(storyId);
		if (!story) {
			throw new Error(`Story ${storyId} not found`);
		}

		const expandedStory: Story = {
			...story,
			id: this.generateId(),
			isSmartExpanded: true,
			preExpansionNarrative: story.preExpansionNarrative || story.narrative,
			narrative: `Expanded: ${story.preExpansionNarrative || story.narrative} with more vivid details...`,
			createdAt: new Date()
		};

		this.stories.set(expandedStory.id, expandedStory);
		return expandedStory;
	}

	getStylePrompt(style: Style): string {
		if (style.preset === 'custom') {
			return style.customPrompt || '';
		}
		return STYLE_PROMPTS[style.preset];
	}

	validateDuration(duration: number): boolean {
		return duration > 0 && duration % 5 === 0;
	}
}

// StoryHistoryManager for history/branching
class StoryHistoryManager {
	private history: Story[] = [];
	private currentIndex: number = -1;

	addVersion(story: Story): void {
		// Truncate future versions if we branched
		if (this.currentIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.currentIndex + 1);
		}

		this.history.push(story);
		this.currentIndex = this.history.length - 1;
	}

	getCurrentVersion(): Story | null {
		if (this.currentIndex < 0) return null;
		return this.history[this.currentIndex];
	}

	getHistory(): Story[] {
		return [...this.history];
	}

	getHistoryIndex(): number {
		return this.currentIndex;
	}

	branchFromVersion(index: number): Story {
		if (index < 0 || index >= this.history.length) {
			throw new Error(`Invalid history index: ${index}`);
		}

		// Truncate history after branch point
		this.history = this.history.slice(0, index + 1);
		this.currentIndex = index;

		return this.history[index];
	}

	getVersionCount(): number {
		return this.history.length;
	}
}

describe('Stage 2: Story - Unit Tests', () => {
	let manager: StoryManager;
	let historyManager: StoryHistoryManager;

	beforeEach(() => {
		manager = new StoryManager();
		historyManager = new StoryHistoryManager();
	});

	// ===========================================================================
	// STORY GENERATION
	// ===========================================================================

	describe('generateStory', () => {
		it('generates story with required fields', async () => {
			const result = await manager.generateStory('A detective story', 15, { preset: 'anime' });

			expect(result.story).toHaveProperty('id');
			expect(result.story).toHaveProperty('title');
			expect(result.story).toHaveProperty('prompt', 'A detective story');
			expect(result.story).toHaveProperty('narrative');
			expect(result.story).toHaveProperty('scenes');
			expect(result.story).toHaveProperty('createdAt');
		});

		it('stores original prompt in story', async () => {
			const result = await manager.generateStory('A space adventure', 10, { preset: 'photorealistic' });

			expect(result.story.prompt).toBe('A space adventure');
		});

		it('stores style in story', async () => {
			const style: Style = { preset: 'anime' };
			const result = await manager.generateStory('Test', 10, style);

			expect(result.story.style).toEqual(style);
		});

		it('stores targetDuration in story', async () => {
			const result = await manager.generateStory('Test', 20, { preset: 'anime' });

			expect(result.story.targetDuration).toBe(20);
		});

		it('generates unique ID for each story', async () => {
			const result1 = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const result2 = await manager.generateStory('Story 2', 10, { preset: 'anime' });

			expect(result1.story.id).not.toBe(result2.story.id);
		});

		it('returns generation metadata', async () => {
			const result = await manager.generateStory('Test', 10, { preset: 'anime' });

			expect(result).toHaveProperty('existingElementsUsed');
			expect(result).toHaveProperty('newElementsIntroduced');
			expect(Array.isArray(result.existingElementsUsed)).toBe(true);
			expect(Array.isArray(result.newElementsIntroduced)).toBe(true);
		});
	});

	// ===========================================================================
	// DURATION AND SCENE COUNT
	// ===========================================================================

	describe('Duration and Scene Count', () => {
		it('generates sceneCount = targetDuration / 5', async () => {
			const result15 = await manager.generateStory('Test', 15, { preset: 'anime' });
			expect(result15.story.scenes.length).toBe(3);

			const result30 = await manager.generateStory('Test', 30, { preset: 'anime' });
			expect(result30.story.scenes.length).toBe(6);

			const result5 = await manager.generateStory('Test', 5, { preset: 'anime' });
			expect(result5.story.scenes.length).toBe(1);
		});

		it('each scene has 5-second duration per spec', async () => {
			const result = await manager.generateStory('Test', 15, { preset: 'anime' });

			result.story.scenes.forEach((scene) => {
				expect(scene.duration).toBe(5);
			});
		});

		it('scenes are numbered 1-indexed', async () => {
			const result = await manager.generateStory('Test', 15, { preset: 'anime' });

			expect(result.story.scenes[0].number).toBe(1);
			expect(result.story.scenes[1].number).toBe(2);
			expect(result.story.scenes[2].number).toBe(3);
		});

		it('validates duration is multiple of 5', () => {
			expect(manager.validateDuration(5)).toBe(true);
			expect(manager.validateDuration(10)).toBe(true);
			expect(manager.validateDuration(15)).toBe(true);
			expect(manager.validateDuration(7)).toBe(false);
			expect(manager.validateDuration(12)).toBe(false);
		});

		it('rejects invalid duration', async () => {
			await expect(manager.generateStory('Test', 7, { preset: 'anime' })).rejects.toThrow('multiple of 5');
		});

		it('rejects zero or negative duration', async () => {
			await expect(manager.generateStory('Test', 0, { preset: 'anime' })).rejects.toThrow();
			await expect(manager.generateStory('Test', -5, { preset: 'anime' })).rejects.toThrow();
		});
	});

	// ===========================================================================
	// STYLE SYSTEM
	// ===========================================================================

	describe('Style System', () => {
		it('returns correct prompt for anime preset', () => {
			const prompt = manager.getStylePrompt({ preset: 'anime' });

			expect(prompt).toContain('anime');
			expect(prompt).toContain('cel-shaded');
			expect(prompt).toContain('NOT photorealistic');
		});

		it('returns correct prompt for photorealistic preset', () => {
			const prompt = manager.getStylePrompt({ preset: 'photorealistic' });

			expect(prompt).toContain('photorealistic');
			expect(prompt).toContain('cinematic');
			expect(prompt).toContain('8K');
		});

		it('returns correct prompt for 3d-animated preset', () => {
			const prompt = manager.getStylePrompt({ preset: '3d-animated' });

			expect(prompt).toContain('3D animated');
			expect(prompt).toContain('Pixar');
		});

		it('returns correct prompt for watercolor preset', () => {
			const prompt = manager.getStylePrompt({ preset: 'watercolor' });

			expect(prompt).toContain('watercolor');
			expect(prompt).toContain('painterly');
		});

		it('returns correct prompt for comic preset', () => {
			const prompt = manager.getStylePrompt({ preset: 'comic' });

			expect(prompt).toContain('comic book');
			expect(prompt).toContain('bold outlines');
		});

		it('returns custom prompt for custom preset', () => {
			const customPrompt = 'my custom style with specific details';
			const prompt = manager.getStylePrompt({ preset: 'custom', customPrompt });

			expect(prompt).toBe(customPrompt);
		});

		it('returns empty string for custom preset without customPrompt', () => {
			const prompt = manager.getStylePrompt({ preset: 'custom' });

			expect(prompt).toBe('');
		});
	});

	// ===========================================================================
	// SMART EXPAND
	// ===========================================================================

	describe('Smart Expand', () => {
		it('first expand sets isSmartExpanded to true', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });
			expect(story.isSmartExpanded).toBeUndefined();

			const expanded = await manager.smartExpand(story.id);
			expect(expanded.isSmartExpanded).toBe(true);
		});

		it('first expand saves preExpansionNarrative', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });
			const originalNarrative = story.narrative;

			const expanded = await manager.smartExpand(story.id);
			expect(expanded.preExpansionNarrative).toBe(originalNarrative);
		});

		it('subsequent expand uses preExpansionNarrative', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			const expanded1 = await manager.smartExpand(story.id);
			const expanded2 = await manager.smartExpand(expanded1.id);

			// Both should reference the same original
			expect(expanded2.preExpansionNarrative).toBe(expanded1.preExpansionNarrative);
		});

		it('expand creates new story version', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			const expanded = await manager.smartExpand(story.id);

			expect(expanded.id).not.toBe(story.id);
		});

		it('throws error for non-existent story', async () => {
			await expect(manager.smartExpand('non-existent')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// EDIT WITH PROMPT
	// ===========================================================================

	describe('Edit Story with Prompt', () => {
		it('creates new story version with edit applied', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			const edited = await manager.editStoryWithPrompt(story.id, 'Add more action');

			expect(edited.id).not.toBe(story.id);
			expect(edited.narrative).toContain('Add more action');
		});

		it('preserves original story fields', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			const edited = await manager.editStoryWithPrompt(story.id, 'Edit instruction');

			expect(edited.prompt).toBe(story.prompt);
			expect(edited.style).toEqual(story.style);
			expect(edited.targetDuration).toBe(story.targetDuration);
		});

		it('throws error for non-existent story', async () => {
			await expect(manager.editStoryWithPrompt('non-existent', 'Edit')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// STORY HISTORY
	// ===========================================================================

	describe('Story History', () => {
		it('starts with empty history', () => {
			expect(historyManager.getHistory()).toEqual([]);
			expect(historyManager.getCurrentVersion()).toBeNull();
			expect(historyManager.getHistoryIndex()).toBe(-1);
		});

		it('addVersion adds to history', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			historyManager.addVersion(story);

			expect(historyManager.getHistory()).toHaveLength(1);
			expect(historyManager.getCurrentVersion()).toBe(story);
		});

		it('multiple versions tracked in order', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });
			const { story: story3 } = await manager.generateStory('Story 3', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);
			historyManager.addVersion(story3);

			expect(historyManager.getVersionCount()).toBe(3);
			expect(historyManager.getHistory()[0]).toBe(story1);
			expect(historyManager.getHistory()[2]).toBe(story3);
		});

		it('getCurrentVersion returns latest', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);

			expect(historyManager.getCurrentVersion()).toBe(story2);
			expect(historyManager.getHistoryIndex()).toBe(1);
		});
	});

	// ===========================================================================
	// BRANCHING FROM HISTORY
	// ===========================================================================

	describe('Branching from History', () => {
		it('branchFromVersion returns correct version', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });
			const { story: story3 } = await manager.generateStory('Story 3', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);
			historyManager.addVersion(story3);

			const branched = historyManager.branchFromVersion(0);

			expect(branched).toBe(story1);
		});

		it('branching discards subsequent versions', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });
			const { story: story3 } = await manager.generateStory('Story 3', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);
			historyManager.addVersion(story3);

			historyManager.branchFromVersion(0);

			expect(historyManager.getVersionCount()).toBe(1);
			expect(historyManager.getHistory()).toContain(story1);
			expect(historyManager.getHistory()).not.toContain(story2);
			expect(historyManager.getHistory()).not.toContain(story3);
		});

		it('branching updates currentIndex', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);

			expect(historyManager.getHistoryIndex()).toBe(1);

			historyManager.branchFromVersion(0);

			expect(historyManager.getHistoryIndex()).toBe(0);
		});

		it('adding after branch continues from branch point', async () => {
			const { story: story1 } = await manager.generateStory('Story 1', 10, { preset: 'anime' });
			const { story: story2 } = await manager.generateStory('Story 2', 10, { preset: 'anime' });
			const { story: story3 } = await manager.generateStory('Story 3', 10, { preset: 'anime' });

			historyManager.addVersion(story1);
			historyManager.addVersion(story2);

			// Branch from 0
			historyManager.branchFromVersion(0);

			// Add new version
			historyManager.addVersion(story3);

			expect(historyManager.getVersionCount()).toBe(2);
			expect(historyManager.getHistory()[0]).toBe(story1);
			expect(historyManager.getHistory()[1]).toBe(story3);
		});

		it('throws error for invalid index', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });
			historyManager.addVersion(story);

			expect(() => historyManager.branchFromVersion(-1)).toThrow('Invalid history index');
			expect(() => historyManager.branchFromVersion(5)).toThrow('Invalid history index');
		});
	});

	// ===========================================================================
	// STORY SCENE STRUCTURE
	// ===========================================================================

	describe('Story Scene Structure', () => {
		it('scenes have required fields per spec', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			story.scenes.forEach((scene) => {
				expect(scene).toHaveProperty('number');
				expect(scene).toHaveProperty('title');
				expect(scene).toHaveProperty('description');
				expect(scene).toHaveProperty('dialogue');
				expect(scene).toHaveProperty('action');
				expect(scene).toHaveProperty('elementsPresent');
				expect(scene).toHaveProperty('duration');
			});
		});

		it('elementsPresent is array', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			story.scenes.forEach((scene) => {
				expect(Array.isArray(scene.elementsPresent)).toBe(true);
			});
		});
	});

	// ===========================================================================
	// STORY ELEMENTS STRUCTURE
	// ===========================================================================

	describe('Story Elements Structure', () => {
		it('story has characters array', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			expect(Array.isArray(story.characters)).toBe(true);
		});

		it('story has locations array', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			expect(Array.isArray(story.locations)).toBe(true);
		});

		it('story has objects array', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			expect(Array.isArray(story.objects)).toBe(true);
		});

		it('story has concepts array', async () => {
			const { story } = await manager.generateStory('Test', 10, { preset: 'anime' });

			expect(Array.isArray(story.concepts)).toBe(true);
		});
	});
});
