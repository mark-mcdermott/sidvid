/**
 * Characters Feature Types
 *
 * This file defines the data structures for the characters feature.
 * These types are used by the scenes feature as input.
 */

import type { StoryOutput } from '../story/types';

/**
 * Character input from story feature
 */
export interface CharactersInput {
	story: StoryOutput;
}

/**
 * Character output passed to the scenes feature
 */
export interface CharacterOutput {
	/** Unique identifier for the character */
	id: string;
	/** Character name */
	name: string;
	/** Character description */
	description: string;
	/** Local path to character image */
	imageUrl: string;
	/** Reference to source story */
	storyId: string;
	/** Timestamp when character was created */
	createdAt: number;
}

/**
 * Character state managed by the store
 */
export interface CharacterState {
	/** Source story data */
	story: StoryOutput | null;
	/** Array of generated characters */
	characters: CharacterOutput[];
	/** Whether currently generating */
	isGenerating: boolean;
	/** Number of characters to generate */
	characterCount: number;
	/** Selected character for editing */
	selectedCharacterId: string | null;
}

/**
 * Form data for character generation
 */
export interface CharacterGenerationRequest {
	storyId: string;
	count: number;
}

/**
 * Response from character generation API
 */
export interface CharacterGenerationResponse {
	characters: CharacterOutput[];
}
