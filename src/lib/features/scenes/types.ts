/**
 * Scenes Feature Types
 *
 * This file defines the data structures for the scenes feature.
 * These types are used by the storyboard feature as input.
 */

import type { StoryOutput } from '../story/types';
import type { CharacterOutput } from '../characters/types';

/**
 * Scenes input from previous features
 */
export interface ScenesInput {
	story: StoryOutput;
	characters: CharacterOutput[];
}

/**
 * Scene output passed to the storyboard feature
 */
export interface SceneOutput {
	/** Unique identifier for the scene */
	id: string;
	/** Scene description */
	description: string;
	/** Local path to scene image */
	imageUrl: string;
	/** Characters appearing in this scene */
	characterIds: string[];
	/** Scene duration in seconds */
	duration: number;
	/** Scene order in sequence */
	order: number;
	/** Timestamp when scene was created */
	createdAt: number;
}

/**
 * Scene state managed by the store
 */
export interface SceneState {
	/** Source story data */
	story: StoryOutput | null;
	/** Available characters */
	characters: CharacterOutput[];
	/** Array of generated scenes */
	scenes: SceneOutput[];
	/** Whether currently generating */
	isGenerating: boolean;
	/** Number of scenes to generate */
	sceneCount: number;
	/** Selected scene for editing */
	selectedSceneId: string | null;
	/** Total duration of all scenes */
	totalDuration: number;
}

/**
 * Form data for scene generation
 */
export interface SceneGenerationRequest {
	storyId: string;
	characterIds: string[];
	count: number;
}

/**
 * Response from scene generation API
 */
export interface SceneGenerationResponse {
	scenes: SceneOutput[];
}
