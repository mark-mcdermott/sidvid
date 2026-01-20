import { test, expect } from '@playwright/test';

test.describe('Scenes @scenes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/scenes');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.skip('generates scenes when coming from characters page', async ({ page }) => {
		// Full flow: Story → Characters → Scenes
		// Generate story
		await page.goto('/story');
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

		// Navigate to characters and generate
		await page.getByRole('button', { name: 'Send to Character Generation' }).click();
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img')).toBeVisible({ timeout: 45000 });

		// Navigate to scenes
		await page.getByRole('button', { name: /Send to Scene Generation/i }).click();
		await expect(page).toHaveURL(/\/scenes/);
		await expect(page.getByText(/Scene Generation/i)).toBeVisible();
	});

	test.skip('displays Generate Scenes button', async ({ page }) => {
		// Should show button to generate scenes from story+characters
		await expect(page.getByRole('button', { name: /Generate Scenes/i })).toBeVisible();
	});

	test.skip('generates scene images using DALL-E', async ({ page }) => {
		// Click Generate Scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();

		// Wait for scenes to generate (GPT-4 + DALL-E)
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Verify multiple scenes created
		const sceneCount = await page.locator('img[alt*="Scene"]').count();
		expect(sceneCount).toBeGreaterThan(2);
	});

	test.skip('shows scene descriptions with images', async ({ page }) => {
		// Generate scenes first
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Verify each scene has description
		await expect(page.getByText(/Scene 1:/i)).toBeVisible();
		await expect(page.getByText(/Scene 2:/i)).toBeVisible();

		// Verify images are present
		const scene1Img = page.locator('img[alt*="Scene 1"]');
		await expect(scene1Img).toBeVisible();
	});

	test.skip('displays scenes in chronological order', async ({ page }) => {
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Check scene numbers are sequential
		await expect(page.getByText(/Scene 1:/i)).toBeVisible();
		await expect(page.getByText(/Scene 2:/i)).toBeVisible();
		await expect(page.getByText(/Scene 3:/i)).toBeVisible();
	});

	test.skip('allows editing scene description', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Click edit on first scene
		await page.locator('[data-scene="1"]').getByRole('button', { name: /Edit/i }).click();

		// Edit description
		const descInput = page.getByLabel(/Scene Description/i).first();
		await descInput.fill('The spaceship launches into the starry night');

		// Save
		await page.getByRole('button', { name: /Save/i }).first().click();

		// Verify description updated
		await expect(page.getByText(/spaceship launches into the starry night/i)).toBeVisible();
	});

	test.skip('allows regenerating scene image', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Get original image src
		const originalSrc = await page.locator('img[alt*="Scene 1"]').getAttribute('src');

		// Regenerate image for scene 1
		await page.locator('[data-scene="1"]').getByRole('button', { name: /Regenerate Image/i }).click();
		await page.waitForTimeout(5000);

		// Verify new image
		const newSrc = await page.locator('img[alt*="Scene 1"]').getAttribute('src');
		expect(newSrc).not.toBe(originalSrc);
	});

	test.skip('allows reordering scenes with drag and drop', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Get first scene description
		const firstSceneDesc = await page.locator('[data-scene="1"]').textContent();

		// Drag scene 1 to position 2 (swap with scene 2)
		const scene1 = page.locator('[data-scene="1"]');
		const scene2 = page.locator('[data-scene="2"]');
		await scene1.dragTo(scene2);

		// Verify order changed
		await page.waitForTimeout(1000);
		const newFirstSceneDesc = await page.locator('[data-scene="1"]').textContent();
		expect(newFirstSceneDesc).not.toBe(firstSceneDesc);
	});

	test.skip('allows adding new scene', async ({ page }) => {
		// Generate initial scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		const initialCount = await page.locator('[data-scene]').count();

		// Add new scene
		await page.getByRole('button', { name: /Add Scene/i }).click();

		// Fill scene details
		await page.getByLabel(/Scene Description/i).last().fill('A dramatic space battle');

		// Generate image for new scene
		await page.getByRole('button', { name: /Generate Image/i }).last().click();
		await expect(page.locator('img[alt*="Scene"]').last()).toBeVisible({ timeout: 45000 });

		// Verify scene count increased
		const newCount = await page.locator('[data-scene]').count();
		expect(newCount).toBe(initialCount + 1);
	});

	test.skip('allows removing scene', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		const initialCount = await page.locator('[data-scene]').count();

		// Remove scene 2
		await page.locator('[data-scene="2"]').getByRole('button', { name: /Delete|Remove/i }).click();

		// Confirm deletion if prompted
		const confirmButton = page.getByRole('button', { name: /Confirm|Yes/i });
		if (await confirmButton.isVisible()) {
			await confirmButton.click();
		}

		// Verify scene count decreased
		await page.waitForTimeout(500);
		const newCount = await page.locator('[data-scene]').count();
		expect(newCount).toBe(initialCount - 1);
	});

	test.skip('Send to Storyboard button enabled when scenes ready', async ({ page }) => {
		// Generate scenes with images
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Verify button enabled
		const sendButton = page.getByRole('button', { name: /Send to Storyboard/i });
		await expect(sendButton).toBeEnabled();
	});

	test.skip('navigates to storyboard with scene data', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Navigate to storyboard
		await page.getByRole('button', { name: /Send to Storyboard/i }).click();
		await expect(page).toHaveURL(/\/storyboard/);

		// Verify scenes loaded in storyboard
		await expect(page.getByText(/Storyboard/i)).toBeVisible();
	});

	test.skip('scenes persist when navigating away and back', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		const sceneCount = await page.locator('[data-scene]').count();

		// Navigate away
		await page.goto('/characters');

		// Navigate back
		await page.goto('/scenes');

		// Verify scenes still there
		const newSceneCount = await page.locator('[data-scene]').count();
		expect(newSceneCount).toBe(sceneCount);
	});
});
