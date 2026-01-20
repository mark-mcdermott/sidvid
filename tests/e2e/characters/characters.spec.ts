import { test, expect } from '@playwright/test';

test.describe('Characters @characters', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/characters');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.skip('generates characters when coming from story page', async ({ page }) => {
		// First generate a story
		await page.goto('/story');
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with Captain Nova and Robo');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

		// Navigate to characters
		await page.getByRole('button', { name: 'Send to Character Generation' }).click();
		await expect(page).toHaveURL(/\/characters/);

		// Verify characters page shows story data
		await expect(page.getByText(/Character Generation/i)).toBeVisible();
	});

	test.skip('displays list of characters extracted from story', async ({ page }) => {
		// Setup: Navigate from story
		// Verify character names from story are displayed
		// Example: "Captain Nova", "Robo" should be visible as buttons/cards
		await expect(page.getByText(/Captain Nova/i)).toBeVisible();
		await expect(page.getByText(/Robo/i)).toBeVisible();
	});

	test.skip('generates character image when Generate Image clicked', async ({ page }) => {
		// Select a character
		await page.getByText(/Captain Nova/i).click();

		// Click Generate Image
		await page.getByRole('button', { name: /Generate Image/i }).click();

		// Wait for DALL-E response (can be slow)
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Verify image is from OpenAI initially
		const imgSrc = await page.locator('img[alt*="Captain Nova"]').getAttribute('src');
		expect(imgSrc).toContain('oaidalleapiprodscus');
	});

	test.skip('shows loading spinner during image generation', async ({ page }) => {
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();

		// Verify loading state
		await expect(page.getByText(/Generating/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /Generating/i })).toBeDisabled();

		// Wait for completion
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Verify loading state cleared
		await expect(page.getByText(/Generating/i)).not.toBeVisible();
	});

	test.skip('downloads image and stores locally', async ({ page }) => {
		// Generate image first
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Wait for download to complete (automatic)
		await page.waitForTimeout(2000);

		// Verify image URL changed to local path
		const imgSrc = await page.locator('img[alt*="Captain Nova"]').getAttribute('src');
		expect(imgSrc).toContain('/data/images/');

		// Verify image still displays
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible();
	});

	test.skip('allows editing character name', async ({ page }) => {
		await page.getByText(/Captain Nova/i).click();

		// Click edit button
		await page.getByRole('button', { name: /Edit Name/i }).click();

		// Change name
		const nameInput = page.getByLabel(/Character Name/i);
		await nameInput.fill('Commander Nova');

		// Save
		await page.getByRole('button', { name: /Save/i }).click();

		// Verify name updated
		await expect(page.getByText(/Commander Nova/i)).toBeVisible();
		await expect(page.getByText(/Captain Nova/i)).not.toBeVisible();
	});

	test.skip('allows editing character description', async ({ page }) => {
		await page.getByText(/Captain Nova/i).click();

		// Edit description
		const descInput = page.getByLabel(/Description/i);
		await descInput.fill('A brave and skilled pilot with years of experience');

		// Save
		await page.getByRole('button', { name: /Save/i }).click();

		// Verify description saved
		await expect(page.getByText(/brave and skilled pilot/i)).toBeVisible();
	});

	test.skip('allows regenerating character image', async ({ page }) => {
		// Setup: Have character with image
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Get original image src
		const originalSrc = await page.locator('img[alt*="Captain Nova"]').getAttribute('src');

		// Regenerate
		await page.getByRole('button', { name: /Regenerate Image/i }).click();
		await expect(page.getByText(/Generating/i)).toBeVisible();
		await page.waitForTimeout(5000); // Wait for new image

		// Verify new image is different
		const newSrc = await page.locator('img[alt*="Captain Nova"]').getAttribute('src');
		expect(newSrc).not.toBe(originalSrc);
	});

	test.skip('Send to Scenes button enabled when characters have images', async ({ page }) => {
		// Generate images for characters
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Verify Send to Scenes is enabled
		const sendButton = page.getByRole('button', { name: /Send to Scene Generation/i });
		await expect(sendButton).toBeEnabled();
	});

	test.skip('Send to Scenes button disabled when no images', async ({ page }) => {
		// Don't generate any images
		const sendButton = page.getByRole('button', { name: /Send to Scene Generation/i });
		await expect(sendButton).toBeDisabled();
	});

	test.skip('navigates to scenes page with character data', async ({ page }) => {
		// Setup: Generate character images
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Navigate to scenes
		await page.getByRole('button', { name: /Send to Scene Generation/i }).click();
		await expect(page).toHaveURL(/\/scenes/);

		// Verify characters are available in scenes
		await expect(page.getByText(/Scene Generation/i)).toBeVisible();
	});

	test.skip('characters persist when navigating away and back', async ({ page }) => {
		// Generate character
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Navigate away
		await page.goto('/story');

		// Navigate back
		await page.goto('/characters');

		// Verify character still visible with image
		await expect(page.getByText(/Captain Nova/i)).toBeVisible();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible();
	});

	test.skip('conversation shows character generation in sidebar', async ({ page }) => {
		// Generate character
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		// Wait for conversation to save
		await page.waitForTimeout(2000);

		// Check sidebar
		const sidebarEntry = page.getByRole('link', { name: /Character/i });
		await expect(sidebarEntry).toBeVisible({ timeout: 10000 });
	});
});
