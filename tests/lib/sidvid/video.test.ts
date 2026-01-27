/**
 * Stage 5: Video - Unit Tests
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 *
 * Tests cover:
 * - Video structure and status management
 * - Video version management
 * - Preview generation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types based on SCHEMAS-SPEC.md
type VideoStatus = 'not_started' | 'generating' | 'polling' | 'completed' | 'failed';

interface VideoVersion {
	id: string;
	videoUrl: string;
	thumbnailUrl?: string;
	duration: number;
	isActive: boolean;
	createdAt: Date;
}

interface Video {
	id: string;
	projectId: string;
	status: VideoStatus;
	versions: VideoVersion[];
	error?: string;
	createdAt: Date;
}

interface SceneImage {
	id: string;
	imageUrl: string;
	isActive: boolean;
}

interface Scene {
	id: string;
	title: string;
	images: SceneImage[];
	duration: number;
	isArchived?: boolean;
}

// Mock VideoManager
class VideoManager {
	private video: Video | null = null;
	private static idCounter = 0;

	initVideo(projectId: string): Video {
		this.video = {
			id: `video-${Date.now()}-${VideoManager.idCounter++}-${Math.random().toString(36).substr(2, 9)}`,
			projectId,
			status: 'not_started',
			versions: [],
			createdAt: new Date()
		};
		return this.video;
	}

	getVideo(): Video | null {
		return this.video;
	}

	setStatus(status: VideoStatus, error?: string): void {
		if (!this.video) {
			throw new Error('No video initialized');
		}
		this.video.status = status;
		if (error) {
			this.video.error = error;
		} else {
			delete this.video.error;
		}
	}

	addVersion(version: Omit<VideoVersion, 'isActive'>): Video {
		if (!this.video) {
			throw new Error('No video initialized');
		}

		// Set all existing versions to inactive
		this.video.versions.forEach((v) => (v.isActive = false));

		// Add new version as active
		this.video.versions.push({
			...version,
			isActive: true
		});

		this.video.status = 'completed';

		return this.video;
	}

	setActiveVersion(versionId: string): Video {
		if (!this.video) {
			throw new Error('No video initialized');
		}

		const versionExists = this.video.versions.some((v) => v.id === versionId);
		if (!versionExists) {
			throw new Error(`Version ${versionId} not found`);
		}

		this.video.versions.forEach((v) => {
			v.isActive = v.id === versionId;
		});

		return this.video;
	}

	deleteVersion(versionId: string): Video {
		if (!this.video) {
			throw new Error('No video initialized');
		}

		const version = this.video.versions.find((v) => v.id === versionId);
		if (!version) {
			throw new Error(`Version ${versionId} not found`);
		}

		if (version.isActive) {
			throw new Error('Cannot delete active version');
		}

		if (this.video.versions.length === 1) {
			throw new Error('Cannot delete last version');
		}

		this.video.versions = this.video.versions.filter((v) => v.id !== versionId);

		return this.video;
	}

	getActiveVersion(): VideoVersion | null {
		if (!this.video) return null;
		return this.video.versions.find((v) => v.isActive) || null;
	}

	getVersionCount(): number {
		return this.video?.versions.length || 0;
	}
}

// Preview generator
class PreviewGenerator {
	generatePreviewFrames(scenes: Scene[]): { imageUrl: string; duration: number }[] {
		// Only include non-archived scenes
		const activeScenes = scenes.filter((s) => !s.isArchived);

		return activeScenes
			.map((scene) => {
				const activeImage = scene.images.find((img) => img.isActive);
				if (!activeImage) return null;

				return {
					imageUrl: activeImage.imageUrl,
					duration: scene.duration
				};
			})
			.filter((frame): frame is { imageUrl: string; duration: number } => frame !== null);
	}

	getTotalPreviewDuration(scenes: Scene[]): number {
		const activeScenes = scenes.filter((s) => !s.isArchived);
		return activeScenes.reduce((total, scene) => total + scene.duration, 0);
	}
}

describe('Stage 5: Video - Unit Tests', () => {
	let manager: VideoManager;
	let previewGenerator: PreviewGenerator;

	beforeEach(() => {
		manager = new VideoManager();
		previewGenerator = new PreviewGenerator();
	});

	// ===========================================================================
	// VIDEO INITIALIZATION
	// ===========================================================================

	describe('initVideo', () => {
		it('creates video with not_started status', () => {
			const video = manager.initVideo('proj-1');

			expect(video.status).toBe('not_started');
		});

		it('creates video with empty versions array', () => {
			const video = manager.initVideo('proj-1');

			expect(video.versions).toEqual([]);
		});

		it('creates video with projectId reference', () => {
			const video = manager.initVideo('proj-1');

			expect(video.projectId).toBe('proj-1');
		});

		it('generates unique ID', () => {
			const video1 = manager.initVideo('proj-1');
			const manager2 = new VideoManager();
			const video2 = manager2.initVideo('proj-2');

			expect(video1.id).not.toBe(video2.id);
		});

		it('sets createdAt timestamp', () => {
			const before = new Date();
			const video = manager.initVideo('proj-1');
			const after = new Date();

			expect(video.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(video.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ===========================================================================
	// STATUS MANAGEMENT
	// ===========================================================================

	describe('setStatus', () => {
		beforeEach(() => {
			manager.initVideo('proj-1');
		});

		it('updates status to generating', () => {
			manager.setStatus('generating');

			expect(manager.getVideo()?.status).toBe('generating');
		});

		it('updates status to polling', () => {
			manager.setStatus('polling');

			expect(manager.getVideo()?.status).toBe('polling');
		});

		it('updates status to completed', () => {
			manager.setStatus('completed');

			expect(manager.getVideo()?.status).toBe('completed');
		});

		it('updates status to failed with error', () => {
			manager.setStatus('failed', 'Generation failed');

			expect(manager.getVideo()?.status).toBe('failed');
			expect(manager.getVideo()?.error).toBe('Generation failed');
		});

		it('clears error when not failed', () => {
			manager.setStatus('failed', 'Error message');
			manager.setStatus('generating');

			expect(manager.getVideo()?.error).toBeUndefined();
		});

		it('throws when no video initialized', () => {
			const emptyManager = new VideoManager();

			expect(() => emptyManager.setStatus('generating')).toThrow('No video initialized');
		});
	});

	// ===========================================================================
	// VERSION MANAGEMENT
	// ===========================================================================

	describe('addVersion', () => {
		beforeEach(() => {
			manager.initVideo('proj-1');
		});

		it('adds version to video', () => {
			manager.addVersion({
				id: 'ver-1',
				videoUrl: 'https://example.com/video.mp4',
				duration: 15,
				createdAt: new Date()
			});

			expect(manager.getVersionCount()).toBe(1);
		});

		it('new version is active by default', () => {
			manager.addVersion({
				id: 'ver-1',
				videoUrl: 'url',
				duration: 15,
				createdAt: new Date()
			});

			const active = manager.getActiveVersion();
			expect(active?.id).toBe('ver-1');
		});

		it('adding version sets previous to inactive', () => {
			manager.addVersion({ id: 'ver-1', videoUrl: 'url1', duration: 15, createdAt: new Date() });
			manager.addVersion({ id: 'ver-2', videoUrl: 'url2', duration: 15, createdAt: new Date() });

			const video = manager.getVideo();
			const ver1 = video?.versions.find((v) => v.id === 'ver-1');
			const ver2 = video?.versions.find((v) => v.id === 'ver-2');

			expect(ver1?.isActive).toBe(false);
			expect(ver2?.isActive).toBe(true);
		});

		it('sets status to completed', () => {
			manager.setStatus('generating');
			manager.addVersion({ id: 'ver-1', videoUrl: 'url', duration: 15, createdAt: new Date() });

			expect(manager.getVideo()?.status).toBe('completed');
		});

		it('throws when no video initialized', () => {
			const emptyManager = new VideoManager();

			expect(() =>
				emptyManager.addVersion({ id: 'ver-1', videoUrl: 'url', duration: 15, createdAt: new Date() })
			).toThrow('No video initialized');
		});
	});

	describe('setActiveVersion', () => {
		beforeEach(() => {
			manager.initVideo('proj-1');
			manager.addVersion({ id: 'ver-1', videoUrl: 'url1', duration: 15, createdAt: new Date() });
			manager.addVersion({ id: 'ver-2', videoUrl: 'url2', duration: 15, createdAt: new Date() });
			manager.addVersion({ id: 'ver-3', videoUrl: 'url3', duration: 15, createdAt: new Date() });
		});

		it('sets specified version as active', () => {
			manager.setActiveVersion('ver-1');

			const active = manager.getActiveVersion();
			expect(active?.id).toBe('ver-1');
		});

		it('sets other versions to inactive', () => {
			manager.setActiveVersion('ver-1');

			const video = manager.getVideo();
			const activeVersions = video?.versions.filter((v) => v.isActive);

			expect(activeVersions).toHaveLength(1);
		});

		it('throws for non-existent version', () => {
			expect(() => manager.setActiveVersion('non-existent')).toThrow('not found');
		});
	});

	describe('deleteVersion', () => {
		beforeEach(() => {
			manager.initVideo('proj-1');
			manager.addVersion({ id: 'ver-1', videoUrl: 'url1', duration: 15, createdAt: new Date() });
			manager.addVersion({ id: 'ver-2', videoUrl: 'url2', duration: 15, createdAt: new Date() });
		});

		it('removes non-active version', () => {
			// ver-1 is inactive (ver-2 is active)
			manager.deleteVersion('ver-1');

			expect(manager.getVersionCount()).toBe(1);
		});

		it('throws when trying to delete active version', () => {
			// ver-2 is active
			expect(() => manager.deleteVersion('ver-2')).toThrow('Cannot delete active version');
		});

		it('throws when trying to delete last version (which is also active)', () => {
			manager.deleteVersion('ver-1'); // Now only ver-2 remains

			// The active check triggers first since last version is always active
			expect(() => manager.deleteVersion('ver-2')).toThrow('Cannot delete active version');
		});

		it('throws for non-existent version', () => {
			expect(() => manager.deleteVersion('non-existent')).toThrow('not found');
		});
	});

	describe('getActiveVersion', () => {
		it('returns null when no video', () => {
			expect(manager.getActiveVersion()).toBeNull();
		});

		it('returns null when no versions', () => {
			manager.initVideo('proj-1');

			expect(manager.getActiveVersion()).toBeNull();
		});

		it('returns active version', () => {
			manager.initVideo('proj-1');
			manager.addVersion({ id: 'ver-1', videoUrl: 'url', duration: 15, createdAt: new Date() });

			const active = manager.getActiveVersion();
			expect(active?.id).toBe('ver-1');
		});
	});

	describe('getVersionCount', () => {
		it('returns 0 when no video', () => {
			expect(manager.getVersionCount()).toBe(0);
		});

		it('returns correct count', () => {
			manager.initVideo('proj-1');
			manager.addVersion({ id: 'ver-1', videoUrl: 'url1', duration: 15, createdAt: new Date() });
			manager.addVersion({ id: 'ver-2', videoUrl: 'url2', duration: 15, createdAt: new Date() });

			expect(manager.getVersionCount()).toBe(2);
		});
	});

	// ===========================================================================
	// PREVIEW GENERATION
	// ===========================================================================

	describe('generatePreviewFrames', () => {
		it('returns frames for each scene', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Scene 1', images: [{ id: 'img1', imageUrl: 'url1', isActive: true }], duration: 5 },
				{ id: 's2', title: 'Scene 2', images: [{ id: 'img2', imageUrl: 'url2', isActive: true }], duration: 5 }
			];

			const frames = previewGenerator.generatePreviewFrames(scenes);

			expect(frames).toHaveLength(2);
		});

		it('uses active image from each scene', () => {
			const scenes: Scene[] = [
				{
					id: 's1',
					title: 'Scene 1',
					images: [
						{ id: 'img1', imageUrl: 'inactive-url', isActive: false },
						{ id: 'img2', imageUrl: 'active-url', isActive: true }
					],
					duration: 5
				}
			];

			const frames = previewGenerator.generatePreviewFrames(scenes);

			expect(frames[0].imageUrl).toBe('active-url');
		});

		it('uses scene duration for each frame', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Scene 1', images: [{ id: 'img1', imageUrl: 'url1', isActive: true }], duration: 5 },
				{ id: 's2', title: 'Scene 2', images: [{ id: 'img2', imageUrl: 'url2', isActive: true }], duration: 10 }
			];

			const frames = previewGenerator.generatePreviewFrames(scenes);

			expect(frames[0].duration).toBe(5);
			expect(frames[1].duration).toBe(10);
		});

		it('excludes scenes without active image', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Scene 1', images: [{ id: 'img1', imageUrl: 'url1', isActive: true }], duration: 5 },
				{ id: 's2', title: 'Scene 2', images: [], duration: 5 }
			];

			const frames = previewGenerator.generatePreviewFrames(scenes);

			expect(frames).toHaveLength(1);
		});

		it('excludes archived scenes', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Active', images: [{ id: 'img1', imageUrl: 'url1', isActive: true }], duration: 5 },
				{ id: 's2', title: 'Archived', images: [{ id: 'img2', imageUrl: 'url2', isActive: true }], duration: 5, isArchived: true }
			];

			const frames = previewGenerator.generatePreviewFrames(scenes);

			expect(frames).toHaveLength(1);
		});

		it('returns empty array for empty scenes', () => {
			const frames = previewGenerator.generatePreviewFrames([]);

			expect(frames).toEqual([]);
		});
	});

	describe('getTotalPreviewDuration', () => {
		it('sums all scene durations', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Scene 1', images: [], duration: 5 },
				{ id: 's2', title: 'Scene 2', images: [], duration: 5 },
				{ id: 's3', title: 'Scene 3', images: [], duration: 5 }
			];

			const total = previewGenerator.getTotalPreviewDuration(scenes);

			expect(total).toBe(15);
		});

		it('excludes archived scenes', () => {
			const scenes: Scene[] = [
				{ id: 's1', title: 'Active', images: [], duration: 5 },
				{ id: 's2', title: 'Archived', images: [], duration: 5, isArchived: true }
			];

			const total = previewGenerator.getTotalPreviewDuration(scenes);

			expect(total).toBe(5);
		});

		it('returns 0 for empty scenes', () => {
			const total = previewGenerator.getTotalPreviewDuration([]);

			expect(total).toBe(0);
		});
	});

	// ===========================================================================
	// VIDEO STRUCTURE VALIDATION
	// ===========================================================================

	describe('Video Structure', () => {
		it('video has required fields per spec', () => {
			const video = manager.initVideo('proj-1');

			expect(video).toHaveProperty('id');
			expect(video).toHaveProperty('projectId');
			expect(video).toHaveProperty('status');
			expect(video).toHaveProperty('versions');
			expect(video).toHaveProperty('createdAt');
		});

		it('version has required fields per spec', () => {
			manager.initVideo('proj-1');
			const video = manager.addVersion({
				id: 'ver-1',
				videoUrl: 'https://example.com/video.mp4',
				duration: 15,
				createdAt: new Date()
			});

			const version = video.versions[0];
			expect(version).toHaveProperty('id');
			expect(version).toHaveProperty('videoUrl');
			expect(version).toHaveProperty('duration');
			expect(version).toHaveProperty('isActive');
			expect(version).toHaveProperty('createdAt');
		});

		it('version can have optional thumbnailUrl', () => {
			manager.initVideo('proj-1');
			const video = manager.addVersion({
				id: 'ver-1',
				videoUrl: 'https://example.com/video.mp4',
				thumbnailUrl: 'https://example.com/thumb.png',
				duration: 15,
				createdAt: new Date()
			});

			expect(video.versions[0].thumbnailUrl).toBe('https://example.com/thumb.png');
		});
	});
});
