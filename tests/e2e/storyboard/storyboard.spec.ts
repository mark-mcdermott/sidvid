import { test, expect } from '@playwright/test';

test.describe('Storyboard @storyboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/storyboard');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.skip('displays scenes in timeline view when loaded', async ({ page }) => {
		// Assume scenes were generated in previous step
		// Verify timeline displays scenes in order
		await expect(page.getByText(/Timeline/i)).toBeVisible();
		await expect(page.locator('[data-scene-timeline]')).toBeVisible();
	});

	test.skip('shows scene thumbnails in timeline', async ({ page }) => {
		// Verify each scene has a thumbnail in timeline
		const thumbnails = page.locator('[data-scene-thumbnail]');
		const count = await thumbnails.count();
		expect(count).toBeGreaterThan(0);

		// Verify first thumbnail is visible
		await expect(thumbnails.first()).toBeVisible();
	});

	test.skip('displays total storyboard duration', async ({ page }) => {
		// Should show total duration (sum of all scenes)
		await expect(page.getByText(/Total Duration:/i)).toBeVisible();
		await expect(page.getByText(/\d+s/)).toBeVisible(); // e.g., "45s"
	});

	test.skip('allows adjusting scene order by dragging', async ({ page }) => {
		// Get initial order
		const firstScene = page.locator('[data-scene-timeline-item]').first();
		const firstSceneId = await firstScene.getAttribute('data-scene-id');

		// Drag first scene to second position
		const secondScene = page.locator('[data-scene-timeline-item]').nth(1);
		await firstScene.dragTo(secondScene);

		// Verify order changed
		await page.waitForTimeout(500);
		const newFirstScene = page.locator('[data-scene-timeline-item]').first();
		const newFirstSceneId = await newFirstScene.getAttribute('data-scene-id');
		expect(newFirstSceneId).not.toBe(firstSceneId);
	});

	test.skip('allows setting scene duration with slider', async ({ page }) => {
		// Click on first scene to select it
		await page.locator('[data-scene-timeline-item]').first().click();

		// Find duration slider
		const slider = page.getByLabel(/Duration/i);
		await expect(slider).toBeVisible();

		// Adjust duration
		await slider.fill('10'); // 10 seconds

		// Verify total duration updated
		await expect(page.getByText(/Total Duration:/i)).toBeVisible();
	});

	test.skip('allows setting transition effects between scenes', async ({ page }) => {
		// Select transition between scene 1 and 2
		await page.locator('[data-transition="1-2"]').click();

		// Open transition menu
		await page.getByRole('button', { name: /Transition Effect/i }).click();

		// Select fade transition
		await page.getByRole('option', { name: /Fade/i }).click();

		// Verify transition set
		await expect(page.locator('[data-transition="1-2"]')).toContainText(/Fade/i);
	});

	test.skip('allows adding text overlay to scene', async ({ page }) => {
		// Select first scene
		await page.locator('[data-scene-timeline-item]').first().click();

		// Click Add Text
		await page.getByRole('button', { name: /Add Text/i }).click();

		// Enter text
		await page.getByLabel(/Text Content/i).fill('Once upon a time...');

		// Set position
		await page.getByLabel(/Position X/i).fill('50');
		await page.getByLabel(/Position Y/i).fill('50');

		// Save
		await page.getByRole('button', { name: /Save|Add/i }).click();

		// Verify text overlay added
		await expect(page.getByText(/Once upon a time.../i)).toBeVisible();
	});

	test.skip('timeline playback plays through scenes', async ({ page }) => {
		// Click play button
		await page.getByRole('button', { name: /Play/i }).click();

		// Verify playback started
		await expect(page.getByRole('button', { name: /Pause/i })).toBeVisible();

		// Wait a bit for playback
		await page.waitForTimeout(2000);

		// Pause
		await page.getByRole('button', { name: /Pause/i }).click();

		// Verify can resume
		await expect(page.getByRole('button', { name: /Play/i })).toBeVisible();
	});

	test.skip('scrubber allows jumping to specific time', async ({ page }) => {
		// Find timeline scrubber
		const scrubber = page.locator('[data-timeline-scrubber]');

		// Drag scrubber to 50% position
		await scrubber.hover();
		await page.mouse.down();
		await page.mouse.move(100, 0); // Move right
		await page.mouse.up();

		// Verify current time updated
		const currentTime = await page.getByText(/Current Time:/i).textContent();
		expect(currentTime).toMatch(/\d+s/);
	});

	test.skip('shows current playback time during playback', async ({ page }) => {
		await page.getByRole('button', { name: /Play/i }).click();

		// Verify time updates
		const initialTime = await page.locator('[data-current-time]').textContent();
		await page.waitForTimeout(2000);
		const updatedTime = await page.locator('[data-current-time]').textContent();

		expect(updatedTime).not.toBe(initialTime);
	});

	test.skip('allows exporting storyboard as PDF', async ({ page }) => {
		// Click Export
		await page.getByRole('button', { name: /Export/i }).click();

		// Select PDF
		await page.getByRole('option', { name: /PDF/i }).click();

		// Verify download initiated (check for download event)
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: /Download/i }).click();
		const download = await downloadPromise;

		// Verify filename
		expect(download.suggestedFilename()).toContain('.pdf');
	});

	test.skip('Send to Video button enabled when storyboard complete', async ({ page }) => {
		// Verify button is enabled (storyboard has scenes)
		const sendButton = page.getByRole('button', { name: /Send to Video|Generate Video/i });
		await expect(sendButton).toBeEnabled();
	});

	test.skip('navigates to video generation page', async ({ page }) => {
		await page.getByRole('button', { name: /Send to Video|Generate Video/i }).click();

		// Verify navigation
		await expect(page).toHaveURL(/\/video/);
		await expect(page.getByText(/Video Generation/i)).toBeVisible();
	});

	test.skip('storyboard persists when navigating away and back', async ({ page }) => {
		// Get scene count
		const sceneCount = await page.locator('[data-scene-timeline-item]').count();

		// Navigate away
		await page.goto('/scenes');

		// Navigate back
		await page.goto('/storyboard');

		// Verify scenes still there
		const newSceneCount = await page.locator('[data-scene-timeline-item]').count();
		expect(newSceneCount).toBe(sceneCount);
	});
});
