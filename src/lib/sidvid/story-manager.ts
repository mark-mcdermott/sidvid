import type {
	Project,
	ProjectStory,
	ProjectStoryScene,
	ProjectStoryCharacter,
	StoryLocation,
	StoryObject,
	StoryConcept,
	Style,
	StylePreset
} from './types';

/**
 * Style prompts for each preset
 * These are prepended to all DALL-E and video generation calls
 */
export const STYLE_PROMPTS: Record<Exclude<StylePreset, 'custom'>, string> = {
	anime: 'anime style, cel-shaded, 2D animation, vibrant colors, NOT photorealistic, NOT 3D',
	photorealistic: 'photorealistic, cinematic lighting, 8K, hyperrealistic, film grain',
	'3d-animated': '3D animated, Pixar style, stylized characters, soft lighting, NOT photorealistic',
	watercolor: 'watercolor painting, soft edges, painterly, artistic, muted colors',
	comic: 'comic book style, bold outlines, halftone dots, dynamic poses, vibrant colors'
};

export interface CreateStoryOptions {
	prompt: string;
	targetDuration: number;
	style: Style;
	title?: string;
	narrative?: string;
}

export interface StoryGenerationResult {
	story: ProjectStory;
	existingElementsUsed: string[];
	newElementsIntroduced: Array<{
		name: string;
		type: 'character' | 'location' | 'object' | 'concept';
		description: string;
	}>;
}

/**
 * StoryManager - Manages story lifecycle within a project
 *
 * Handles:
 * - Story creation with prompt, duration, style
 * - Story history management
 * - Smart expand behavior
 * - Story editing (manual and with prompt)
 * - Scene and world element management within stories
 */
export class StoryManager {
	private project: Project;

	constructor(project: Project) {
		this.project = project;
	}

	// ===== Story Creation =====

	async createStory(options: CreateStoryOptions): Promise<ProjectStory> {
		// Validate duration is 5-second increment
		if (options.targetDuration < 5 || options.targetDuration % 5 !== 0) {
			throw new Error('Duration must be a positive multiple of 5-second increments');
		}

		const story: ProjectStory = {
			id: this.generateId(),
			title: options.title || 'Untitled Story',
			prompt: options.prompt,
			style: options.style,
			targetDuration: options.targetDuration,
			narrative: options.narrative || '',
			scenes: [],
			characters: [],
			locations: [],
			objects: [],
			concepts: [],
			isSmartExpanded: false,
			createdAt: new Date()
		};

		// Add to history
		this.project.storyHistory.push(story);
		this.project.storyHistoryIndex = this.project.storyHistory.length - 1;
		this.project.currentStory = story;

		return story;
	}

	private generateId(): string {
		return `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// ===== Current Story Access =====

	getCurrentStory(): ProjectStory | null {
		return this.project.currentStory;
	}

	// ===== History Management =====

	getHistory(): ProjectStory[] {
		return [...this.project.storyHistory];
	}

	getHistoryIndex(): number {
		return this.project.storyHistoryIndex;
	}

	async branchFromHistory(index: number): Promise<ProjectStory> {
		if (index < 0 || index >= this.project.storyHistory.length) {
			throw new Error(`Invalid history index: ${index}`);
		}

		// Truncate history after branch point
		this.project.storyHistory = this.project.storyHistory.slice(0, index + 1);
		this.project.storyHistoryIndex = index;
		this.project.currentStory = this.project.storyHistory[index];

		return this.project.currentStory;
	}

	// ===== Smart Expand =====

	async smartExpand(): Promise<ProjectStory> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story to expand');
		}

		// First expand: save preExpansionNarrative
		// Subsequent expands: use existing preExpansionNarrative
		const sourceNarrative = current.preExpansionNarrative || current.narrative;

		// Create new expanded version
		const expandedStory: ProjectStory = {
			...current,
			id: this.generateId(),
			isSmartExpanded: true,
			preExpansionNarrative: sourceNarrative,
			// In real implementation, this would call AI to expand
			// For now, just mark as expanded
			narrative: current.narrative,
			createdAt: new Date()
		};

		// Add to history
		this.project.storyHistory.push(expandedStory);
		this.project.storyHistoryIndex = this.project.storyHistory.length - 1;
		this.project.currentStory = expandedStory;

		return expandedStory;
	}

	// ===== Edit with Prompt =====

	async editWithPrompt(instruction: string): Promise<ProjectStory> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story to edit');
		}

		// Create edited version preserving original settings
		const editedStory: ProjectStory = {
			...current,
			id: this.generateId(),
			// In real implementation, this would call AI to apply the edit
			// For now, just copy the story
			createdAt: new Date()
		};

		// Add to history
		this.project.storyHistory.push(editedStory);
		this.project.storyHistoryIndex = this.project.storyHistory.length - 1;
		this.project.currentStory = editedStory;

		return editedStory;
	}

	// ===== Regenerate =====

	async regenerate(): Promise<ProjectStory> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story to regenerate');
		}

		// Create new version with same parameters
		return this.createStory({
			prompt: current.prompt,
			targetDuration: current.targetDuration,
			style: current.style
		});
	}

	// ===== Manual Edits =====

	async updateNarrative(narrative: string): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.narrative = narrative;
		// Clear isSmartExpanded if editing after expansion
		if (current.isSmartExpanded) {
			current.isSmartExpanded = false;
		}
	}

	async updateTitle(title: string): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.title = title;
	}

	// ===== Scene Management =====

	async addScene(scene: Omit<ProjectStoryScene, 'duration'> & { duration?: number }): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		const newScene: ProjectStoryScene = {
			...scene,
			duration: scene.duration ?? 5 // Default to 5 seconds
		};

		current.scenes.push(newScene);
	}

	async updateScene(index: number, updates: Partial<ProjectStoryScene>): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		if (index < 0 || index >= current.scenes.length) {
			throw new Error(`Invalid scene index: ${index}`);
		}

		current.scenes[index] = { ...current.scenes[index], ...updates };
	}

	async removeScene(index: number): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		if (index < 0 || index >= current.scenes.length) {
			throw new Error(`Invalid scene index: ${index}`);
		}

		current.scenes.splice(index, 1);

		// Renumber remaining scenes
		current.scenes.forEach((scene, i) => {
			scene.number = i + 1;
		});
	}

	// ===== World Element Arrays =====

	async addCharacter(character: ProjectStoryCharacter): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.characters.push(character);
	}

	async addLocation(location: StoryLocation): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.locations.push(location);
	}

	async addObject(obj: StoryObject): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.objects.push(obj);
	}

	async addConcept(concept: StoryConcept): Promise<void> {
		const current = this.getCurrentStory();
		if (!current) {
			throw new Error('No current story');
		}

		current.concepts.push(concept);
	}

	// ===== Style Utilities =====

	getStylePrompt(style: Style): string {
		if (style.preset === 'custom') {
			return style.customPrompt || '';
		}
		return STYLE_PROMPTS[style.preset];
	}

	validateDuration(duration: number): boolean {
		return duration > 0 && duration % 5 === 0;
	}

	// ===== Scene Count Calculation =====

	calculateSceneCount(targetDuration: number): number {
		return Math.floor(targetDuration / 5);
	}
}
