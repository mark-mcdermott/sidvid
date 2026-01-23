import { test, expect } from '@playwright/test';

test.describe('Video @video', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/video');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.skip('displays Generate Video button when storyboard ready', async ({ page }) => {
		// Verify page loaded with storyboard data
		await expect(page.getByRole('button', { name: /Generate Video/i })).toBeVisible();
	});

	test.skip('shows video settings before generation', async ({ page }) => {
		// Verify resolution dropdown
		await expect(page.getByLabel(/Resolution/i)).toBeVisible();

		// Verify format dropdown
		await expect(page.getByLabel(/Format/i)).toBeVisible();

		// Verify FPS dropdown
		await expect(page.getByLabel(/Frame Rate|FPS/i)).toBeVisible();
	});

	test.skip('generates video using Sora when Generate clicked', async ({ page }) => {
		// Click Generate Video
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Verify progress indicator appears
		await expect(page.getByText(/Generating|Processing/i)).toBeVisible({ timeout: 5000 });

		// Wait for Sora to complete (can take several minutes)
		// Use very long timeout for video generation
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 }); // 5 minutes

		// Verify video player loaded
		await expect(page.locator('video')).toHaveAttribute('src', /.+/);
	});

	test.skip('shows generation progress with percentage', async ({ page }) => {
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Verify progress bar appears
		await expect(page.locator('[role="progressbar"]')).toBeVisible({ timeout: 5000 });

		// Verify percentage text (e.g., "35%")
		await expect(page.getByText(/\d+%/)).toBeVisible({ timeout: 10000 });
	});

	test.skip('shows estimated time remaining during generation', async ({ page }) => {
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Verify ETA displayed
		await expect(page.getByText(/Estimated time|Time remaining/i)).toBeVisible({ timeout: 10000 });
	});

	test.skip('shows generation stages during processing', async ({ page }) => {
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Verify stages appear
		// Example: "Preparing...", "Rendering...", "Encoding...", "Finalizing..."
		await expect(page.getByText(/Preparing|Rendering|Encoding/i)).toBeVisible({ timeout: 10000 });
	});

	test.skip('allows canceling video generation', async ({ page }) => {
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Wait for generation to start
		await expect(page.getByText(/Generating/i)).toBeVisible({ timeout: 5000 });

		// Click cancel
		await page.getByRole('button', { name: /Cancel/i }).click();

		// Verify generation stopped
		await expect(page.getByText(/Cancelled|Stopped/i)).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: /Generate Video/i })).toBeVisible();
	});

	test.skip('video player has play/pause controls', async ({ page }) => {
		// Assume video is generated
		const video = page.locator('video');
		await expect(video).toBeVisible();

		// Verify play button exists
		const playButton = page.getByRole('button', { name: /Play/i });
		await expect(playButton).toBeVisible();

		// Click play
		await playButton.click();

		// Verify pause button appears
		await expect(page.getByRole('button', { name: /Pause/i })).toBeVisible();
	});

	test.skip('video player allows scrubbing through video', async ({ page }) => {
		const video = page.locator('video');
		await expect(video).toBeVisible();

		// Find timeline/scrubber
		const timeline = page.locator('[data-video-timeline]');

		// Click at 50% position
		const box = await timeline.boundingBox();
		if (box) {
			await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
		}

		// Verify video position changed
		const currentTime = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
		expect(currentTime).toBeGreaterThan(0);
	});

	test.skip('video player supports fullscreen', async ({ page }) => {
		const video = page.locator('video');
		await expect(video).toBeVisible();

		// Click fullscreen button
		await page.getByRole('button', { name: /Fullscreen|Full Screen/i }).click();

		// Note: Actual fullscreen testing in Playwright is limited
		// Just verify the button exists and can be clicked
	});

	test.skip('displays video metadata after generation', async ({ page }) => {
		// Assume video generated
		await expect(page.locator('video')).toBeVisible();

		// Verify duration shown
		await expect(page.getByText(/Duration:/i)).toBeVisible();

		// Verify resolution shown
		await expect(page.getByText(/Resolution:|1080p|720p/i)).toBeVisible();

		// Verify file size shown
		await expect(page.getByText(/File Size:|MB/i)).toBeVisible();
	});

	test.skip('allows downloading video file', async ({ page }) => {
		// Assume video generated
		await expect(page.locator('video')).toBeVisible();

		// Set up download listener
		const downloadPromise = page.waitForEvent('download');

		// Click download button
		await page.getByRole('button', { name: /Download/i }).click();

		// Verify download initiated
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.(mp4|webm|mov)$/);
	});

	test.skip('video downloads to local storage', async ({ page }) => {
		// Generate video
		await page.getByRole('button', { name: /Generate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Wait for automatic download
		await page.waitForTimeout(3000);

		// Verify video src changed from remote to local
		const videoSrc = await page.locator('video').getAttribute('src');
		expect(videoSrc).toContain('/data/videos/');
	});

	test.skip('allows regenerating video with different settings', async ({ page }) => {
		// Assume video already generated
		await expect(page.locator('video')).toBeVisible();

		// Get original video src
		const originalSrc = await page.locator('video').getAttribute('src');

		// Change settings (e.g., resolution)
		await page.getByLabel(/Resolution/i).selectOption('720p');

		// Regenerate
		await page.getByRole('button', { name: /Regenerate Video/i }).click();

		// Wait for new video
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Verify video changed
		const newSrc = await page.locator('video').getAttribute('src');
		expect(newSrc).not.toBe(originalSrc);
	});

	test.skip('maintains version history of generated videos', async ({ page }) => {
		// Assume multiple video versions exist
		// Verify version list
		await expect(page.getByText(/Version History|Previous Versions/i)).toBeVisible();

		// Verify can select different versions
		const versions = page.locator('[data-video-version]');
		const count = await versions.count();
		expect(count).toBeGreaterThan(1);
	});

	test.skip('allows switching between video versions', async ({ page }) => {
		// Select version 1
		await page.locator('[data-video-version="1"]').click();
		const version1Src = await page.locator('video').getAttribute('src');

		// Select version 2
		await page.locator('[data-video-version="2"]').click();
		const version2Src = await page.locator('video').getAttribute('src');

		// Verify different videos
		expect(version2Src).not.toBe(version1Src);
	});

	test.skip('generates shareable link for video', async ({ page }) => {
		// Assume video generated
		await expect(page.locator('video')).toBeVisible();

		// Click Share button
		await page.getByRole('button', { name: /Share/i }).click();

		// Verify share dialog appears
		await expect(page.getByText(/Share Video/i)).toBeVisible();

		// Verify shareable link generated
		await expect(page.getByLabel(/Share Link/i)).toHaveValue(/.+/);
	});

	test.skip('allows copying share link to clipboard', async ({ page }) => {
		await expect(page.locator('video')).toBeVisible();
		await page.getByRole('button', { name: /Share/i }).click();

		// Click copy button
		await page.getByRole('button', { name: /Copy Link/i }).click();

		// Verify copied feedback
		await expect(page.getByText(/Copied|Link copied/i)).toBeVisible();
	});

	test.skip('can return to storyboard to make changes', async ({ page }) => {
		// Click Back to Storyboard
		await page.getByRole('button', { name: /Back to Storyboard|Edit Storyboard/i }).click();

		// Verify navigation
		await expect(page).toHaveURL(/\/storyboard/);
	});

	test.skip('video persists when navigating away and back', async ({ page }) => {
		// Assume video generated
		await expect(page.locator('video')).toBeVisible();
		const videoSrc = await page.locator('video').getAttribute('src');

		// Navigate away
		await page.goto('/storyboard');

		// Navigate back
		await page.goto('/video');

		// Verify video still there
		await expect(page.locator('video')).toBeVisible();
		const newVideoSrc = await page.locator('video').getAttribute('src');
		expect(newVideoSrc).toBe(videoSrc);
	});

	test.skip('video thumbnail appears in sidebar under Videos tab', async ({ page }) => {
		// Generate video
		await page.getByRole('button', { name: /Generate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Wait for thumbnail to be created
		await page.waitForTimeout(2000);

		// Check sidebar for thumbnail under Videos section
		const videosSidebar = page.locator('[data-sidebar-section="videos"]');
		const thumbnail = videosSidebar.locator('[data-video-thumbnail]').first();
		await expect(thumbnail).toBeVisible({ timeout: 10000 });

		// Verify thumbnail is a small square image
		const thumbnailImg = thumbnail.locator('img');
		await expect(thumbnailImg).toBeVisible();
	});

	test.skip('multiple video thumbnails display in grid below Videos tab', async ({ page }) => {
		// Generate first video
		await page.getByRole('button', { name: /Generate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Change settings and regenerate
		await page.getByLabel(/Resolution/i).selectOption('720p');
		await page.getByRole('button', { name: /Regenerate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Wait for thumbnails to save
		await page.waitForTimeout(2000);

		// Verify multiple thumbnails in sidebar
		const videosSidebar = page.locator('[data-sidebar-section="videos"]');
		const thumbnails = videosSidebar.locator('[data-video-thumbnail]');
		const count = await thumbnails.count();
		expect(count).toBe(2);

		// Verify they're displayed in a grid/line
		await expect(thumbnails.first()).toBeVisible();
		await expect(thumbnails.nth(1)).toBeVisible();
	});

	test.skip('clicking video thumbnail loads that video in main area', async ({ page }) => {
		// Generate two videos
		await page.getByRole('button', { name: /Generate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });
		const firstVideoSrc = await page.locator('video').getAttribute('src');

		await page.getByRole('button', { name: /Regenerate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });
		const secondVideoSrc = await page.locator('video').getAttribute('src');

		expect(firstVideoSrc).not.toBe(secondVideoSrc);

		// Wait for thumbnails
		await page.waitForTimeout(2000);

		// Click first thumbnail
		const videosSidebar = page.locator('[data-sidebar-section="videos"]');
		const thumbnails = videosSidebar.locator('[data-video-thumbnail]');
		await thumbnails.first().click();

		// Verify first video loaded
		const currentVideoSrc = await page.locator('video').getAttribute('src');
		expect(currentVideoSrc).toBe(firstVideoSrc);
	});

	test.skip('conversations for Videos appear below thumbnails in sidebar', async ({ page }) => {
		// Generate video (creates conversation)
		await page.getByRole('button', { name: /Generate Video/i }).click();
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });
		await page.waitForTimeout(2000);

		// Check sidebar structure: Videos tab > thumbnails > conversations
		const videosSidebar = page.locator('[data-sidebar-section="videos"]');

		// Thumbnails should be first
		const thumbnails = videosSidebar.locator('[data-video-thumbnail]');
		await expect(thumbnails.first()).toBeVisible();

		// Conversations should be below thumbnails
		const conversations = videosSidebar.locator('[data-conversation-item]');
		await expect(conversations.first()).toBeVisible({ timeout: 10000 });
	});

	test.skip('storyboard thumbnail can be dragged to video generation area', async ({ page }) => {
		// First create a storyboard
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Build storyboard
		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		await sceneThumbnails.first().dragTo(wireframes.first());
		await sceneThumbnails.nth(1).dragTo(wireframes.nth(1));
		await page.waitForTimeout(2000);

		// Navigate to video generation page
		await page.goto('/video');

		// Get storyboard thumbnail from Storyboard section
		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const storyboardThumbnail = storyboardSidebar.locator('[data-storyboard-thumbnail]').first();

		// Drag to video generation area
		const videoGenerationArea = page.locator('[data-video-generation-area]');
		await storyboardThumbnail.dragTo(videoGenerationArea);

		// Verify storyboard loaded for video generation
		await expect(videoGenerationArea.getByText(/Storyboard loaded/i)).toBeVisible();

		// Verify Generate Video button is enabled
		await expect(page.getByRole('button', { name: /Generate Video/i })).toBeEnabled();
	});

	test.skip('generates video from dragged storyboard', async ({ page }) => {
		// Create and drag storyboard
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		await sceneThumbnails.first().dragTo(wireframes.first());
		await sceneThumbnails.nth(1).dragTo(wireframes.nth(1));
		await page.waitForTimeout(2000);

		await page.goto('/video');

		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const storyboardThumbnail = storyboardSidebar.locator('[data-storyboard-thumbnail]').first();
		const videoGenerationArea = page.locator('[data-video-generation-area]');
		await storyboardThumbnail.dragTo(videoGenerationArea);

		// Generate video from storyboard
		await page.getByRole('button', { name: /Generate Video/i }).click();

		// Verify progress indicator appears
		await expect(page.getByText(/Generating|Processing/i)).toBeVisible({ timeout: 5000 });

		// Wait for Sora to complete (can take several minutes)
		await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

		// Verify video player loaded
		await expect(page.locator('video')).toHaveAttribute('src', /.+/);
	});

	test.skip('different storyboards can be dragged for different videos', async ({ page }) => {
		// Create two storyboards
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// First storyboard
		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		await sceneThumbnails.first().dragTo(wireframes.first());
		await page.waitForTimeout(2000);

		// Second storyboard
		await page.getByRole('button', { name: /New Storyboard/i }).click();
		await sceneThumbnails.nth(1).dragTo(wireframes.first());
		await page.waitForTimeout(2000);

		// Navigate to video
		await page.goto('/video');

		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const storyboardThumbnails = storyboardSidebar.locator('[data-storyboard-thumbnail]');

		// Drag first storyboard
		const videoGenerationArea = page.locator('[data-video-generation-area]');
		await storyboardThumbnails.first().dragTo(videoGenerationArea);
		await expect(videoGenerationArea.getByText(/Storyboard.*1.*loaded/i)).toBeVisible();

		// Drag second storyboard (should replace first)
		await storyboardThumbnails.nth(1).dragTo(videoGenerationArea);
		await expect(videoGenerationArea.getByText(/Storyboard.*2.*loaded/i)).toBeVisible();
	});

	test.skip('shows storyboard preview in video area after drag', async ({ page }) => {
		// Create storyboard
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		await sceneThumbnails.first().dragTo(wireframes.first());
		await sceneThumbnails.nth(1).dragTo(wireframes.nth(1));
		await page.waitForTimeout(2000);

		// Drag to video
		await page.goto('/video');
		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const storyboardThumbnail = storyboardSidebar.locator('[data-storyboard-thumbnail]').first();
		const videoGenerationArea = page.locator('[data-video-generation-area]');
		await storyboardThumbnail.dragTo(videoGenerationArea);

		// Verify storyboard preview shows scenes
		const preview = page.locator('[data-storyboard-preview]');
		await expect(preview).toBeVisible();

		// Verify preview shows multiple scene thumbnails
		const previewScenes = preview.locator('[data-preview-scene]');
		const count = await previewScenes.count();
		expect(count).toBeGreaterThan(1);
	});
});
