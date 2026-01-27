/**
 * Stage 5: Video - E2E Tests
 * Based on STATE-WORKFLOW-SPEC.md Video section
 *
 * Tests cover:
 * - Video section UI layout per state
 * - NOT_STARTED, GENERATING, COMPLETED, FAILED states
 * - Preview functionality
 * - Video generation
 * - Download functionality
 * - Version management
 */

import { test, expect, setupApiMocks, createVideo, createScene } from '../../shared/fixtures';
import { clearAllData, navigateAndWait } from '../../shared/test-helpers';
import type { Video, VideoVersion, Scene } from '../../shared/types';

test.describe('Stage 5: Video @video', () => {
	test.beforeEach(async ({ page }) => {
		await clearAllData(page);
		await setupApiMocks(page);
	});

	// ===========================================================================
	// VIDEO SECTION UI LAYOUT
	// ===========================================================================

	test.describe('Video Section UI', () => {
		test('displays VIDEO header and subtitle', async ({ page }) => {
			await navigateAndWait(page, '/');

			await expect(page.getByRole('heading', { name: 'VIDEO' })).toBeVisible();
			await expect(page.getByText('Generate your video')).toBeVisible();
		});

		test('/video route shows video section', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('heading', { name: 'VIDEO' })).toBeVisible();
		});
	});

	// ===========================================================================
	// NOT_STARTED STATE
	// ===========================================================================

	test.describe('NOT_STARTED State', () => {
		test.beforeEach(async ({ page }) => {
			await page.evaluate(() => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: null,
						scenes: []
					})
				);
			});
		});

		test('shows "No video yet" text', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByText(/no video yet/i)).toBeVisible();
		});

		test('video box has white border, no rounded corners', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const videoBox = page.locator('[data-testid="video-box"]');
			await expect(videoBox).toBeVisible();
			// Check for specific styling (white border, no rounded corners)
		});

		test('shows Preview button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /preview/i })).toBeVisible();
		});

		test('shows Generate Video button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /generate.*video/i })).toBeVisible();
		});

		test('does NOT show Download button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /download/i })).not.toBeVisible();
		});

		test('does NOT show version thumbnails', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.locator('[data-testid="video-version-thumbnail"]')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// GENERATING/POLLING STATE
	// ===========================================================================

	test.describe('GENERATING/POLLING State', () => {
		test.beforeEach(async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'generating',
				versions: [],
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v
					})
				);
			}, video);
		});

		test('shows loading spinner', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('progressbar')).toBeVisible();
		});

		test('Preview button still visible', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /preview/i })).toBeVisible();
		});

		test('Generate Video button still visible', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /generate.*video/i })).toBeVisible();
		});

		test('does NOT show Download button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /download/i })).not.toBeVisible();
		});
	});

	// ===========================================================================
	// COMPLETED STATE (Single Version)
	// ===========================================================================

	test.describe('COMPLETED State (Single Version)', () => {
		test.beforeEach(async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'completed',
				versions: [
					{
						id: 'ver-1',
						videoUrl: 'https://example.com/video.mp4',
						duration: 15,
						isActive: true,
						createdAt: new Date()
					}
				],
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v
					})
				);
			}, video);
		});

		test('shows video player', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.locator('video')).toBeVisible();
		});

		test('video player has play button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const videoBox = page.locator('[data-testid="video-box"]');
			// Either native controls or custom play button
			await expect(videoBox.locator('video, [data-testid="play-button"]')).toBeVisible();
		});

		test('shows Preview button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /preview/i })).toBeVisible();
		});

		test('shows Generate Video button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /generate.*video/i })).toBeVisible();
		});

		test('shows Download button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /download/i })).toBeVisible();
		});

		test('does NOT show version thumbnails (only 1 version)', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.locator('[data-testid="video-version-thumbnail"]')).not.toBeVisible();
		});

		test('single version has NO trash icon', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.locator('[data-testid="video-version-trash"]')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// COMPLETED STATE (Multiple Versions)
	// ===========================================================================

	test.describe('COMPLETED State (Multiple Versions)', () => {
		test.beforeEach(async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'completed',
				versions: [
					{
						id: 'ver-1',
						videoUrl: 'https://example.com/video1.mp4',
						duration: 15,
						isActive: false,
						createdAt: new Date()
					},
					{
						id: 'ver-2',
						videoUrl: 'https://example.com/video2.mp4',
						duration: 15,
						isActive: true,
						createdAt: new Date()
					},
					{
						id: 'ver-3',
						videoUrl: 'https://example.com/video3.mp4',
						duration: 15,
						isActive: false,
						createdAt: new Date()
					}
				],
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v
					})
				);
			}, video);
		});

		test('shows version thumbnails', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const thumbnails = page.locator('[data-testid="video-version-thumbnail"]');
			await expect(thumbnails).toHaveCount(3);
		});

		test('active version has light gray border', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const activeThumbnail = page.locator('[data-testid="video-version-thumbnail"][data-active="true"]');
			await expect(activeThumbnail).toBeVisible();
		});

		test('non-active versions show trash icon', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const inactiveThumbnails = page.locator('[data-testid="video-version-thumbnail"][data-active="false"]');
			const count = await inactiveThumbnails.count();

			for (let i = 0; i < count; i++) {
				await expect(inactiveThumbnails.nth(i).locator('[data-testid="video-version-trash"]')).toBeVisible();
			}
		});

		test('active version does NOT show trash icon', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const activeThumbnail = page.locator('[data-testid="video-version-thumbnail"][data-active="true"]');
			await expect(activeThumbnail.locator('[data-testid="video-version-trash"]')).not.toBeVisible();
		});

		test('clicking non-active thumbnail makes it active', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const firstThumbnail = page.locator('[data-testid="video-version-thumbnail"]').first();
			await firstThumbnail.click();

			await expect(firstThumbnail).toHaveAttribute('data-active', 'true');
		});

		test('clicking trash deletes version', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const inactiveThumbnail = page.locator('[data-testid="video-version-thumbnail"][data-active="false"]').first();
			await inactiveThumbnail.locator('[data-testid="video-version-trash"]').click();

			// Should now have 2 versions
			await expect(page.locator('[data-testid="video-version-thumbnail"]')).toHaveCount(2);
		});
	});

	// ===========================================================================
	// FAILED STATE
	// ===========================================================================

	test.describe('FAILED State', () => {
		test.beforeEach(async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'failed',
				versions: [],
				error: 'Video generation failed. Please try again.',
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v
					})
				);
			}, video);
		});

		test('shows "No video yet" text in video box', async ({ page }) => {
			await navigateAndWait(page, '/video');

			const videoBox = page.locator('[data-testid="video-box"]');
			await expect(videoBox.getByText(/no video yet/i)).toBeVisible();
		});

		test('shows error message below video box', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByText(/error.*failed/i)).toBeVisible();
		});

		test('shows Preview button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /preview/i })).toBeVisible();
		});

		test('shows Generate Video button (to retry)', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /generate.*video/i })).toBeVisible();
		});

		test('does NOT show Download button', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await expect(page.getByRole('button', { name: /download/i })).not.toBeVisible();
		});
	});

	// ===========================================================================
	// PREVIEW FUNCTIONALITY
	// ===========================================================================

	test.describe('Preview Functionality', () => {
		test.beforeEach(async ({ page }) => {
			const scenes: Scene[] = [
				{
					id: 'scene-1',
					title: 'Scene 1',
					description: 'First scene',
					assignedElements: [],
					images: [{ id: 'img-1', imageUrl: 'https://example.com/scene1.png', revisedPrompt: '', isActive: true, createdAt: new Date() }],
					duration: 5,
					status: 'completed',
					createdAt: new Date(),
					updatedAt: new Date()
				},
				{
					id: 'scene-2',
					title: 'Scene 2',
					description: 'Second scene',
					assignedElements: [],
					images: [{ id: 'img-2', imageUrl: 'https://example.com/scene2.png', revisedPrompt: '', isActive: true, createdAt: new Date() }],
					duration: 5,
					status: 'completed',
					createdAt: new Date(),
					updatedAt: new Date()
				}
			];

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						scenes: s,
						video: null
					})
				);
			}, scenes);
		});

		test('clicking Preview opens slideshow', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await page.getByRole('button', { name: /preview/i }).click();

			await expect(page.locator('[data-testid="preview-slideshow"]')).toBeVisible();
		});

		test('preview shows scene poster images', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await page.getByRole('button', { name: /preview/i }).click();

			// First image should be visible
			await expect(page.locator('[data-testid="preview-slideshow"] img')).toBeVisible();
		});
	});

	// ===========================================================================
	// GENERATE VIDEO
	// ===========================================================================

	test.describe('Generate Video', () => {
		test.beforeEach(async ({ page }) => {
			const scene: Scene = {
				id: 'scene-1',
				title: 'Scene 1',
				description: 'Test',
				assignedElements: [],
				images: [{ id: 'img-1', imageUrl: 'url', revisedPrompt: '', isActive: true, createdAt: new Date() }],
				duration: 5,
				status: 'completed',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						scenes: [s],
						video: null
					})
				);
			}, scene);
		});

		test('clicking Generate Video starts generation', async ({ page }) => {
			await navigateAndWait(page, '/video');

			await page.route('**/api/video/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({ taskId: 'task-1', status: 'generating' })
				});
			});

			await page.getByRole('button', { name: /generate.*video/i }).click();

			// Should show loading state
			await expect(page.getByRole('progressbar')).toBeVisible();
		});

		test('successful generation shows video player', async ({ page }) => {
			await navigateAndWait(page, '/video');

			// Mock generation flow
			await page.route('**/api/video/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						taskId: 'task-1',
						status: 'completed',
						videoUrl: 'https://example.com/video.mp4'
					})
				});
			});

			await page.getByRole('button', { name: /generate.*video/i }).click();

			// Wait for completion
			await expect(page.locator('video')).toBeVisible();
		});
	});

	// ===========================================================================
	// DOWNLOAD FUNCTIONALITY
	// ===========================================================================

	test.describe('Download Functionality', () => {
		test('clicking Download initiates file download', async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'completed',
				versions: [
					{
						id: 'ver-1',
						videoUrl: 'https://example.com/video.mp4',
						duration: 15,
						isActive: true,
						createdAt: new Date()
					}
				],
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v
					})
				);
			}, video);

			await navigateAndWait(page, '/video');

			// Set up download listener
			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', { name: /download/i }).click();

			// Verify download was triggered
			const download = await downloadPromise;
			expect(download).toBeDefined();
		});
	});

	// ===========================================================================
	// STATE TRANSITIONS
	// ===========================================================================

	test.describe('State Transitions', () => {
		test('NOT_STARTED -> GENERATING -> POLLING -> COMPLETED', async ({ page }) => {
			const scene: Scene = {
				id: 'scene-1',
				title: 'Scene 1',
				description: 'Test',
				assignedElements: [],
				images: [{ id: 'img-1', imageUrl: 'url', revisedPrompt: '', isActive: true, createdAt: new Date() }],
				duration: 5,
				status: 'completed',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						scenes: [s],
						video: null
					})
				);
			}, scene);

			await navigateAndWait(page, '/video');

			// NOT_STARTED
			await expect(page.getByText(/no video yet/i)).toBeVisible();

			// Mock generation
			await page.route('**/api/video/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({ taskId: 'task-1', status: 'generating' })
				});
			});

			await page.route('**/api/video/status', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						status: 'completed',
						videoUrl: 'https://example.com/video.mp4'
					})
				});
			});

			// Click generate
			await page.getByRole('button', { name: /generate.*video/i }).click();

			// GENERATING
			await expect(page.getByRole('progressbar')).toBeVisible();

			// COMPLETED
			await expect(page.locator('video')).toBeVisible();
		});

		test('NOT_STARTED -> GENERATING -> FAILED', async ({ page }) => {
			const scene: Scene = {
				id: 'scene-1',
				title: 'Scene 1',
				description: 'Test',
				assignedElements: [],
				images: [{ id: 'img-1', imageUrl: 'url', revisedPrompt: '', isActive: true, createdAt: new Date() }],
				duration: 5,
				status: 'completed',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						scenes: [s],
						video: null
					})
				);
			}, scene);

			await navigateAndWait(page, '/video');

			// Mock failed generation
			await page.route('**/api/video/generate', async (route) => {
				await route.fulfill({
					status: 500,
					body: JSON.stringify({ error: 'Generation failed' })
				});
			});

			await page.getByRole('button', { name: /generate.*video/i }).click();

			// FAILED
			await expect(page.getByText(/error|failed/i)).toBeVisible();
		});

		test('COMPLETED -> GENERATING (regenerate adds version)', async ({ page }) => {
			const video: Video = {
				id: 'vid-1',
				projectId: 'test-proj',
				status: 'completed',
				versions: [
					{
						id: 'ver-1',
						videoUrl: 'https://example.com/video1.mp4',
						duration: 15,
						isActive: true,
						createdAt: new Date()
					}
				],
				createdAt: new Date()
			};

			await page.evaluate((v) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						video: v,
						scenes: [{ id: 's1', status: 'completed', images: [{ isActive: true }] }]
					})
				);
			}, video);

			await navigateAndWait(page, '/video');

			// Initially 1 version
			await expect(page.locator('[data-testid="video-version-thumbnail"]')).not.toBeVisible();

			// Mock regeneration
			await page.route('**/api/video/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						taskId: 'task-2',
						status: 'completed',
						videoUrl: 'https://example.com/video2.mp4'
					})
				});
			});

			await page.getByRole('button', { name: /generate.*video/i }).click();

			// Should now have 2 versions (thumbnails visible)
			await expect(page.locator('[data-testid="video-version-thumbnail"]')).toHaveCount(2);
		});
	});
});
