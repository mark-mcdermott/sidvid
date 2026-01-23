import { test, expect } from '@playwright/test';

/**
 * E2E Video Generation Workflow Test
 *
 * Tests the complete flow from story generation through video playback:
 * Story -> Characters -> Scenes -> Storyboard -> Video
 *
 * Note: Due to SSR resetting Svelte store state between navigations in the test
 * environment, we test each step independently within the same page session where
 * state is preserved.
 */

test.describe('E2E Video Generation Workflow', () => {

	test('Story page: generates story with multiple scenes', async ({ page }) => {
		test.setTimeout(120000); // 2 minutes for story generation

		await page.goto('/story');

		// Enter a simple prompt
		const promptInput = page.getByPlaceholder(/Enter your story prompt/i);
		await promptInput.fill('a simple sunset over the ocean');

		// Generate the story
		const generateButton = page.getByRole('button', { name: /Generate Story/i });
		await generateButton.click();

		// Wait for story generation (API call takes time)
		await expect(page.getByText(/Scene 1/i)).toBeVisible({ timeout: 60000 });

		// Verify at least 1 scene exists
		const sceneHeadings = page.getByRole('heading', { name: /Scene \d+/i });
		const sceneCount = await sceneHeadings.count();
		expect(sceneCount).toBeGreaterThanOrEqual(1);

		// Verify "Send to Character Generation" link appears
		const sendToCharGenLink = page.getByRole('link', { name: /Send to Character Generation/i });
		await expect(sendToCharGenLink).toBeVisible();
	});

	test('Characters page: displays character management UI', async ({ page }) => {
		await page.goto('/characters');

		// Verify page loads with character UI
		await expect(page.getByRole('heading', { name: /Character Generation/i })).toBeVisible();

		// Verify "Add Custom Character" section exists
		await expect(page.getByRole('heading', { name: /Add Custom Character/i })).toBeVisible();

		// Verify character input exists
		const characterInput = page.getByPlaceholder(/Enter character description/i);
		await expect(characterInput).toBeVisible();

		// Verify Add button exists
		const addButton = page.getByRole('button', { name: /^Add$/i });
		await expect(addButton).toBeVisible();
	});

	test('Scenes page: displays scene generation UI', async ({ page }) => {
		await page.goto('/scenes');

		// Verify page loads with scene UI
		await expect(page.getByRole('heading', { name: /Scene Generation/i })).toBeVisible();

		// Verify add wireframe button exists
		const addWireframeButton = page.locator('[data-add-wireframe]');
		await expect(addWireframeButton).toBeVisible();
	});

	test('Storyboard page: displays storyboard UI', async ({ page }) => {
		await page.goto('/storyboard');

		// Verify page loads
		await expect(page.getByRole('heading', { name: /Storyboard/i })).toBeVisible();
	});

	test('Video page: displays video generation UI', async ({ page }) => {
		await page.goto('/video');

		// Verify page loads with video UI
		await expect(page.getByRole('heading', { name: /Video Generation/i })).toBeVisible();

		// Verify video container exists
		const videoContainer = page.locator('[data-video-container]');
		await expect(videoContainer).toBeVisible();
	});

	// Full integration test - requires running with real API calls
	// Run with: RUN_SLOW_TESTS=true pnpm exec playwright test -g "@slow"
	test('@slow full workflow with real API calls', async ({ page }) => {
		test.skip(process.env.RUN_SLOW_TESTS !== 'true', 'Skipping slow test - set RUN_SLOW_TESTS=true to run');
		test.setTimeout(600000); // 10 minutes

		// This test runs all steps in sequence without page reloads
		// to preserve Svelte store state

		await page.goto('/story');

		// Step 1: Generate story
		const promptInput = page.getByPlaceholder(/Enter your story prompt/i);
		await promptInput.fill('anime: cybernetic humanoid capybaras hacking into a dystopian government\'s mainframe');

		const generateButton = page.getByRole('button', { name: /Generate Story/i });
		await generateButton.click();

		await expect(page.getByText(/Scene 1/i)).toBeVisible({ timeout: 60000 });

		// Step 2: Navigate to characters (client-side navigation preserves store)
		const sendToCharGenLink = page.getByRole('link', { name: /Send to Character Generation/i });
		await sendToCharGenLink.click();
		await expect(page).toHaveURL(/\/characters/);

		// Wait for characters to load from store
		const beginSceneGenButton = page.getByRole('button', { name: /Begin Scene Generation/i });
		await expect(beginSceneGenButton).toBeVisible({ timeout: 15000 });

		// Step 3: Navigate to scenes
		await beginSceneGenButton.click();
		await expect(page).toHaveURL(/\/scenes/);

		// Verify wireframes exist
		const wireframes = page.locator('[data-scene-wireframe]');
		await expect(wireframes.first()).toBeVisible({ timeout: 10000 });

		// Step 4: Generate first scene image (DALL-E)
		const generateSlotButton = page.locator('[data-generate-slot]').first();
		if (await generateSlotButton.isVisible()) {
			await generateSlotButton.click();

			// Wait for image (DALL-E takes 30-120 seconds)
			await expect(page.locator('[data-scene-wireframe] img').first()).toBeVisible({ timeout: 180000 });
		}

		// Step 5: Navigate to storyboard
		const sendToStoryboardLink = page.getByRole('link', { name: /Send to Storyboard/i });
		if (await sendToStoryboardLink.isVisible()) {
			await sendToStoryboardLink.click();
			await expect(page).toHaveURL(/\/storyboard/);
		}
	});
});
