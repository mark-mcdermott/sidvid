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
});
