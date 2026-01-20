/**
 * Video Feature Types
 *
 * This file defines the data structures for the video feature.
 * This is the final output of the SidVid pipeline.
 */

import type { StoryboardOutput } from '../storyboard/types';

/**
 * Video input from storyboard feature
 */
export interface VideoInput {
	storyboard: StoryboardOutput;
}

/**
 * Video generation settings
 */
export interface VideoSettings {
	/** Video resolution */
	resolution: '720p' | '1080p' | '4K';
	/** Output format */
	format: 'mp4' | 'webm' | 'mov';
	/** Frames per second */
	fps: 24 | 30 | 60;
	/** Audio settings */
	audio?: {
		/** Background music URL */
		musicUrl?: string;
		/** Music volume (0-1) */
		musicVolume?: number;
		/** Voice-over URL */
		voiceOverUrl?: string;
		/** Voice-over volume (0-1) */
		voiceOverVolume?: number;
	};
}

/**
 * Video metadata
 */
export interface VideoMetadata {
	/** Video duration in seconds */
	duration: number;
	/** File size in bytes */
	fileSize: number;
	/** When video was generated */
	generatedAt: number;
	/** Sora API version used */
	soraVersion: string;
}

/**
 * Video version (for regeneration history)
 */
export interface VideoVersion {
	/** Version identifier */
	id: string;
	/** Local path to video file */
	url: string;
	/** Settings used for this version */
	settings: VideoSettings;
	/** When this version was created */
	createdAt: number;
	/** Version metadata */
	metadata: VideoMetadata;
}

/**
 * Video output - final product
 */
export interface VideoOutput {
	/** Unique identifier for the video */
	id: string;
	/** Local path to current video file */
	url: string;
	/** Reference to source storyboard */
	storyboardId: string;
	/** Current settings */
	settings: VideoSettings;
	/** Video metadata */
	metadata: VideoMetadata;
	/** Previous versions (for regeneration) */
	versions: VideoVersion[];
	/** Share settings */
	share?: {
		/** Shareable URL */
		url: string;
		/** Share permissions */
		permissions: 'public' | 'private';
		/** Expiration timestamp */
		expiresAt?: number;
	};
}

/**
 * Video state managed by the store
 */
export interface VideoState {
	/** Current video */
	video: VideoOutput | null;
	/** Source storyboard */
	storyboard: StoryboardOutput | null;
	/** Whether currently generating */
	isGenerating: boolean;
	/** Generation progress (0-100) */
	generationProgress: number;
	/** Estimated time remaining (seconds) */
	estimatedTimeRemaining: number | null;
	/** Current settings */
	settings: VideoSettings;
	/** Current playback time (seconds) */
	playbackTime: number;
	/** Whether video is playing */
	isPlaying: boolean;
}

/**
 * Form data for video generation
 */
export interface VideoGenerationRequest {
	storyboardId: string;
	settings: VideoSettings;
}

/**
 * Response from video generation API
 */
export interface VideoGenerationResponse {
	video: VideoOutput;
}

/**
 * Video generation progress update
 */
export interface VideoGenerationProgress {
	/** Progress percentage (0-100) */
	progress: number;
	/** Current stage of generation */
	stage: 'preparing' | 'rendering' | 'encoding' | 'finalizing';
	/** Estimated time remaining (seconds) */
	estimatedTimeRemaining: number | null;
}
