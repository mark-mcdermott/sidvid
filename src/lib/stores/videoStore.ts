import { writable, get } from 'svelte/store';

// Video status per STATE-WORKFLOW-SPEC.md
export type VideoStatus = 'not_started' | 'generating' | 'polling' | 'completed' | 'failed';

export interface VideoVersion {
	id: string;
	videoUrl: string;
	thumbnailUrl: string;
	duration: number;
	createdAt: Date;
	isActive: boolean;
}

export interface VideoState {
	status: VideoStatus;
	versions: VideoVersion[];
	currentVideoId: string | null;
	generationProgress: number;
	error: string | null;
	isPreviewPlaying: boolean;
	previewCurrentFrame: number;
}

function generateId(): string {
	return `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const initialState: VideoState = {
	status: 'not_started',
	versions: [],
	currentVideoId: null,
	generationProgress: 0,
	error: null,
	isPreviewPlaying: false,
	previewCurrentFrame: 0
};

export const videoStore = writable<VideoState>(initialState);

export function resetVideoStore(): void {
	videoStore.set({ ...initialState });
}

// Get active video version
export function getActiveVersion(versions: VideoVersion[]): VideoVersion | undefined {
	return versions.find((v) => v.isActive);
}

// Set video status
export function setVideoStatus(status: VideoStatus, error?: string): void {
	videoStore.update((state) => ({
		...state,
		status,
		error: error || null
	}));
}

// Set generation progress
export function setGenerationProgress(progress: number): void {
	videoStore.update((state) => ({
		...state,
		generationProgress: Math.min(100, Math.max(0, progress))
	}));
}

// Add new video version (becomes active by default)
export function addVideoVersion(videoUrl: string, thumbnailUrl: string, duration: number): void {
	const id = generateId();
	const now = new Date();

	videoStore.update((state) => {
		// Deactivate all existing versions
		const updatedVersions = state.versions.map((v) => ({ ...v, isActive: false }));

		return {
			...state,
			status: 'completed',
			generationProgress: 100,
			error: null,
			versions: [
				...updatedVersions,
				{
					id,
					videoUrl,
					thumbnailUrl,
					duration,
					createdAt: now,
					isActive: true
				}
			],
			currentVideoId: id
		};
	});
}

// Set active version
export function setActiveVersion(versionId: string): void {
	videoStore.update((state) => ({
		...state,
		versions: state.versions.map((v) => ({
			...v,
			isActive: v.id === versionId
		})),
		currentVideoId: versionId
	}));
}

// Delete video version (can't delete if only one version or if active)
export function deleteVideoVersion(versionId: string): boolean {
	const state = get(videoStore);

	// Can't delete if only one version
	if (state.versions.length <= 1) {
		return false;
	}

	// Can't delete active version
	const version = state.versions.find((v) => v.id === versionId);
	if (version?.isActive) {
		return false;
	}

	videoStore.update((s) => ({
		...s,
		versions: s.versions.filter((v) => v.id !== versionId)
	}));

	return true;
}

// Start preview (slideshow mode)
export function startPreview(): void {
	videoStore.update((state) => ({
		...state,
		isPreviewPlaying: true,
		previewCurrentFrame: 0
	}));
}

// Stop preview
export function stopPreview(): void {
	videoStore.update((state) => ({
		...state,
		isPreviewPlaying: false
	}));
}

// Advance preview frame
export function advancePreviewFrame(totalFrames: number): void {
	videoStore.update((state) => {
		const nextFrame = state.previewCurrentFrame + 1;
		if (nextFrame >= totalFrames) {
			return {
				...state,
				isPreviewPlaying: false,
				previewCurrentFrame: 0
			};
		}
		return {
			...state,
			previewCurrentFrame: nextFrame
		};
	});
}

// Load from localStorage
export function loadVideoFromStorage(): void {
	if (typeof window === 'undefined') return;

	const saved = localStorage.getItem('video-state-v1');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			const versions = (parsed.versions || []).map((v: VideoVersion) => ({
				...v,
				createdAt: new Date(v.createdAt)
			}));
			videoStore.set({
				...initialState,
				...parsed,
				versions,
				isPreviewPlaying: false, // Always start with preview stopped
				previewCurrentFrame: 0
			});
		} catch (e) {
			console.error('Failed to load video state:', e);
		}
	}
}

// Save to localStorage
export function saveVideoToStorage(): void {
	if (typeof window === 'undefined') return;

	const state = get(videoStore);
	localStorage.setItem('video-state-v1', JSON.stringify(state));
}
