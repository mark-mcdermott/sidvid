/**
 * Storyboard Feature Types
 *
 * This file defines the data structures for the storyboard feature.
 * These types are used by the video feature as input.
 */

import type { SceneOutput } from '../scenes/types';

/**
 * Storyboard input from scenes feature
 */
export interface StoryboardInput {
	scenes: SceneOutput[];
}

/**
 * Transition effect between scenes
 */
export interface SceneTransition {
	/** Type of transition effect */
	type: 'fade' | 'cut' | 'wipe' | 'dissolve' | 'slide';
	/** Transition duration in milliseconds */
	duration: number;
}

/**
 * Text overlay on a scene
 */
export interface TextOverlay {
	/** Text content */
	text: string;
	/** Position on screen */
	position: { x: number; y: number };
	/** Text styling */
	style: {
		fontSize: number;
		fontFamily: string;
		color: string;
		backgroundColor?: string;
	};
	/** When text appears (ms from scene start) */
	startTime: number;
	/** How long text shows (ms) */
	duration: number;
}

/**
 * Scene with storyboard enhancements
 */
export interface StoryboardScene extends SceneOutput {
	/** Transition to next scene */
	transition: SceneTransition;
	/** Text overlays for this scene */
	textOverlays?: TextOverlay[];
	/** Audio note URLs */
	audioNotes?: string[];
	/** Comments from collaborators */
	comments?: {
		id: string;
		text: string;
		author: string;
		timestamp: number;
	}[];
	/** Whether scene is flagged for review */
	flaggedForReview: boolean;
}

/**
 * Storyboard output passed to the video feature
 */
export interface StoryboardOutput {
	/** Unique identifier for the storyboard */
	id: string;
	/** Enhanced scenes with transitions and overlays */
	scenes: StoryboardScene[];
	/** Total duration including transitions */
	totalDuration: number;
	/** Timestamp when storyboard was created */
	createdAt: number;
}

/**
 * Storyboard state managed by the store
 */
export interface StoryboardState {
	/** Current storyboard */
	storyboard: StoryboardOutput | null;
	/** Source scenes */
	sourceScenes: SceneOutput[];
	/** Whether currently saving */
	isSaving: boolean;
	/** Current playback position (ms) */
	playbackPosition: number;
	/** Whether timeline is playing */
	isPlaying: boolean;
	/** Selected scene for editing */
	selectedSceneId: string | null;
}

/**
 * Export options for storyboard
 */
export interface StoryboardExportOptions {
	format: 'pdf' | 'json';
	includeComments: boolean;
	includeAudioNotes: boolean;
}
