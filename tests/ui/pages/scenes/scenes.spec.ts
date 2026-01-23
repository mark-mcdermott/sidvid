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

	test.skip('scene thumbnail appears in sidebar under Scenes tab', async ({ page }) => {
		// Generate scene
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Wait for thumbnail to save
		await page.waitForTimeout(2000);

		// Check sidebar for thumbnail under Scenes section
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const thumbnail = scenesSidebar.locator('[data-scene-thumbnail]').first();
		await expect(thumbnail).toBeVisible({ timeout: 10000 });

		// Verify thumbnail is a small square image
		const thumbnailImg = thumbnail.locator('img');
		await expect(thumbnailImg).toBeVisible();
	});

	test.skip('multiple scene thumbnails display in grid below Scenes tab', async ({ page }) => {
		// Generate multiple scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Wait for thumbnails to save
		await page.waitForTimeout(2000);

		// Verify multiple thumbnails in sidebar
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const thumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const count = await thumbnails.count();
		expect(count).toBeGreaterThan(2);

		// Verify they're displayed in a grid/line
		await expect(thumbnails.first()).toBeVisible();
		await expect(thumbnails.nth(1)).toBeVisible();
		await expect(thumbnails.nth(2)).toBeVisible();
	});

	test.skip('supports generating both text scenes and image scenes', async ({ page }) => {
		// Generate scenes
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Verify some scenes have images
		const imageScenes = page.locator('[data-scene-type="image"]');
		await expect(imageScenes.first()).toBeVisible();

		// Verify some scenes are text-only
		const textScenes = page.locator('[data-scene-type="text"]');
		await expect(textScenes.first()).toBeVisible();
	});

	test.skip('character thumbnail can be dragged from Characters sidebar into a scene', async ({ page }) => {
		// First generate a character with image
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to scenes and generate a scene
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Get character thumbnail from Characters section
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const characterThumbnail = charactersSidebar.locator('[data-character-thumbnail]').first();

		// Drag to first scene
		const firstScene = page.locator('[data-scene="1"]');
		await characterThumbnail.dragTo(firstScene);

		// Verify character added to scene
		await expect(firstScene.getByText(/Captain Nova/i)).toBeVisible();
	});

	test.skip('character can be dragged into text scene', async ({ page }) => {
		// Generate character
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to scenes and generate scenes
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('[data-scene-type="text"]').first()).toBeVisible({ timeout: 60000 });

		// Get character thumbnail
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const characterThumbnail = charactersSidebar.locator('[data-character-thumbnail]').first();

		// Drag to text scene
		const textScene = page.locator('[data-scene-type="text"]').first();
		await characterThumbnail.dragTo(textScene);

		// Verify character added to text scene
		await expect(textScene.getByText(/Captain Nova/i)).toBeVisible();
	});

	test.skip('character can be dragged into image scene', async ({ page }) => {
		// Generate character
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to scenes and generate scenes
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('[data-scene-type="image"]').first()).toBeVisible({ timeout: 60000 });

		// Get character thumbnail
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const characterThumbnail = charactersSidebar.locator('[data-character-thumbnail]').first();

		// Drag to image scene
		const imageScene = page.locator('[data-scene-type="image"]').first();
		await characterThumbnail.dragTo(imageScene);

		// Verify character added to image scene
		await expect(imageScene.getByText(/Captain Nova/i)).toBeVisible();
	});

	test.skip('multiple characters can be added to a single scene', async ({ page }) => {
		// Generate two characters
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		await page.getByText(/Robo/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Robo"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to scenes
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('[data-scene]').first()).toBeVisible({ timeout: 60000 });

		// Get character thumbnails
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const thumbnails = charactersSidebar.locator('[data-character-thumbnail]');

		// Drag both characters to first scene
		const firstScene = page.locator('[data-scene="1"]');
		await thumbnails.first().dragTo(firstScene);
		await thumbnails.nth(1).dragTo(firstScene);

		// Verify both characters in scene
		await expect(firstScene.getByText(/Captain Nova/i)).toBeVisible();
		await expect(firstScene.getByText(/Robo/i)).toBeVisible();
	});

	test.skip('conversations for Scenes appear below thumbnails in sidebar', async ({ page }) => {
		// Generate scene (creates conversation)
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });
		await page.waitForTimeout(2000);

		// Check sidebar structure: Scenes tab > thumbnails > conversations
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');

		// Thumbnails should be first
		const thumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		await expect(thumbnails.first()).toBeVisible();

		// Conversations should be below thumbnails
		const conversations = scenesSidebar.locator('[data-conversation-item]');
		await expect(conversations.first()).toBeVisible({ timeout: 10000 });
	});
});
