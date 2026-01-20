/**
 * Story Feature Types
 *
 * This file defines the data structures for the story feature.
 * These types are used by the characters feature as input.
 */

/**
 * Story output passed to the characters feature
 */
export interface StoryOutput {
	/** Unique identifier for the story */
	id: string;
	/** The generated story content */
	content: string;
	/** The user's original prompt */
	prompt: string;
	/** Selected video length */
	length: string;
	/** Timestamp when story was created */
	createdAt: number;
}

/**
 * Story state managed by the store
 */
export interface StoryState {
	/** Current prompt text */
	prompt: string;
	/** Selected length option */
	selectedLength: { value: string; label: string };
	/** Array of generated stories (supports Try Again) */
	stories: StoryOutput[];
	/** Whether currently generating */
	isGenerating: boolean;
	/** Whether in manual edit mode */
	isEditingManually: boolean;
	/** Whether in AI-assisted edit mode */
	isEditingWithPrompt: boolean;
	/** Manually edited story content */
	editedStoryContent: string;
	/** Prompt for AI-assisted editing */
	editPrompt: string;
}

/**
 * Form data for story generation
 */
export interface StoryGenerationRequest {
	prompt: string;
	length: string;
}

/**
 * Response from story generation API
 */
export interface StoryGenerationResponse {
	story: StoryOutput;
}
