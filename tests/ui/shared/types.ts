/**
 * Test types aligned with SCHEMAS-SPEC.md
 * These types mirror the production types for test fixture creation
 */

// =============================================================================
// STYLE
// =============================================================================

export type StylePreset = 'anime' | 'photorealistic' | '3d-animated' | 'watercolor' | 'comic' | 'custom';

export interface Style {
	preset: StylePreset;
	customPrompt?: string;
}

// =============================================================================
// STORY
// =============================================================================

export interface StoryScene {
	number: number;
	title: string;
	description: string;
	dialogue: string;
	action: string;
	elementsPresent: string[];
	duration: number;
}

export interface StoryCharacter {
	name: string;
	description: string;
	physical: string;
	profile: string;
}

export interface StoryLocation {
	name: string;
	description: string;
}

export interface StoryObject {
	name: string;
	description: string;
}

export interface StoryConcept {
	name: string;
	description: string;
}

export interface Story {
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

// =============================================================================
// WORLD ELEMENT
// =============================================================================

export type ElementType = 'character' | 'location' | 'object' | 'concept';

export interface ElementImage {
	id: string;
	imageUrl: string;
	revisedPrompt: string;
	isActive: boolean;
	createdAt: Date;
}

export interface WorldElementVersion {
	description: string;
	enhancedDescription?: string;
	isEnhanced?: boolean;
	preEnhancementDescription?: string;
	images: ElementImage[];
	createdAt: Date;
}

export interface WorldElement {
	id: string;
	name: string;
	type: ElementType;
	description: string;
	enhancedDescription?: string;
	isEnhanced?: boolean;
	preEnhancementDescription?: string;
	images: ElementImage[];
	historyIndex: number;
	history: WorldElementVersion[];
	createdAt: Date;
	updatedAt: Date;
}

// =============================================================================
// SCENE
// =============================================================================

export type SceneStatus = 'empty' | 'pending' | 'generating' | 'completed' | 'failed';

export interface SceneImage {
	id: string;
	imageUrl: string;
	revisedPrompt: string;
	isActive: boolean;
	createdAt: Date;
}

export interface Scene {
	id: string;
	title: string;
	description: string;
	customDescription?: string;
	enhancedDescription?: string;
	isSmartExpanded?: boolean;
	preExpansionDescription?: string;
	isArchived?: boolean;
	dialog?: string;
	action?: string;
	assignedElements: string[];
	images: SceneImage[];
	duration: number;
	status: SceneStatus;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

// =============================================================================
// VIDEO
// =============================================================================

export type VideoStatus = 'not_started' | 'generating' | 'polling' | 'completed' | 'failed';

export interface VideoVersion {
	id: string;
	videoUrl: string;
	thumbnailUrl?: string;
	duration: number;
	isActive: boolean;
	createdAt: Date;
}

export interface Video {
	id: string;
	projectId: string;
	status: VideoStatus;
	versions: VideoVersion[];
	error?: string;
	createdAt: Date;
}

// =============================================================================
// PROJECT
// =============================================================================

export interface Project {
	id: string;
	name: string;
	description?: string;
	thumbnail?: string;
	createdAt: Date;
	updatedAt: Date;
	lastOpenedAt: Date;
	storyHistory: Story[];
	storyHistoryIndex: number;
	currentStory: Story | null;
	worldElements: Map<string, WorldElement>;
	scenes: Scene[];
	video: Video | null;
}

export interface ProjectSummary {
	id: string;
	name: string;
	description?: string;
	thumbnail?: string;
	updatedAt: Date;
	lastOpenedAt: Date;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface NewElement {
	name: string;
	type: ElementType;
	description: string;
}

export interface StoryGenerationResult {
	story: Story;
	existingElementsUsed: string[];
	newElementsIntroduced: NewElement[];
}
