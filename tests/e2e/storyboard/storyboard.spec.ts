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

	test.skip('displays wireframe placeholders in main area', async ({ page }) => {
		// Verify wireframes are displayed
		const wireframes = page.locator('[data-storyboard-wireframe]');
		const count = await wireframes.count();
		expect(count).toBeGreaterThan(0);

		// Verify wireframes are empty/placeholder state
		await expect(wireframes.first()).toBeVisible();
	});

	test.skip('scene thumbnail can be dragged into a wireframe', async ({ page }) => {
		// Generate scenes first
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Get scene thumbnail from Scenes section
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnail = scenesSidebar.locator('[data-scene-thumbnail]').first();

		// Drag to first wireframe
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await sceneThumbnail.dragTo(firstWireframe);

		// Verify scene appears in wireframe
		await expect(firstWireframe.locator('img[alt*="Scene"]')).toBeVisible();
	});

	test.skip('only one scene can be in a wireframe at a time', async ({ page }) => {
		// Generate multiple scenes
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Get scene thumbnails
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const thumbnails = scenesSidebar.locator('[data-scene-thumbnail]');

		// Drag first scene to wireframe
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await thumbnails.first().dragTo(firstWireframe);

		// Get image count in wireframe
		const firstSceneCount = await firstWireframe.locator('img[alt*="Scene"]').count();

		// Drag second scene to same wireframe (should replace)
		await thumbnails.nth(1).dragTo(firstWireframe);

		// Verify still only one scene in wireframe
		const finalSceneCount = await firstWireframe.locator('img[alt*="Scene"]').count();
		expect(finalSceneCount).toBe(1);

		// Verify it's the second scene, not the first
		await expect(firstWireframe.locator('img[alt*="Scene 2"]')).toBeVisible();
	});

	test.skip('character thumbnail can be dragged into a wireframe', async ({ page }) => {
		// Generate character first
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Get character thumbnail from Characters section
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const characterThumbnail = charactersSidebar.locator('[data-character-thumbnail]').first();

		// Drag to first wireframe
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await characterThumbnail.dragTo(firstWireframe);

		// Verify character appears in wireframe
		await expect(firstWireframe.locator('img[alt*="Captain Nova"]')).toBeVisible();
	});

	test.skip('multiple characters can be in a single wireframe', async ({ page }) => {
		// Generate two characters
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		await page.getByText(/Robo/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Robo"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Get character thumbnails
		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const thumbnails = charactersSidebar.locator('[data-character-thumbnail]');

		// Drag both characters to first wireframe
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await thumbnails.first().dragTo(firstWireframe);
		await thumbnails.nth(1).dragTo(firstWireframe);

		// Verify both characters in wireframe
		await expect(firstWireframe.locator('img[alt*="Captain Nova"]')).toBeVisible();
		await expect(firstWireframe.locator('img[alt*="Robo"]')).toBeVisible();
	});

	test.skip('wireframe can contain one scene and multiple characters', async ({ page }) => {
		// Generate scene
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Generate characters
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		await page.getByText(/Robo/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Robo"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Get thumbnails
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnail = scenesSidebar.locator('[data-scene-thumbnail]').first();

		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const characterThumbnails = charactersSidebar.locator('[data-character-thumbnail]');

		// Drag scene to wireframe
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await sceneThumbnail.dragTo(firstWireframe);

		// Drag both characters to same wireframe
		await characterThumbnails.first().dragTo(firstWireframe);
		await characterThumbnails.nth(1).dragTo(firstWireframe);

		// Verify one scene and two characters
		await expect(firstWireframe.locator('img[alt*="Scene"]')).toBeVisible();
		await expect(firstWireframe.locator('img[alt*="Captain Nova"]')).toBeVisible();
		await expect(firstWireframe.locator('img[alt*="Robo"]')).toBeVisible();
	});

	test.skip('characters can be removed from wireframe individually', async ({ page }) => {
		// Setup wireframe with multiple characters
		await page.goto('/characters');
		await page.getByText(/Captain Nova/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Captain Nova"]')).toBeVisible({ timeout: 45000 });

		await page.getByText(/Robo/i).click();
		await page.getByRole('button', { name: /Generate Image/i }).click();
		await expect(page.locator('img[alt*="Robo"]')).toBeVisible({ timeout: 45000 });
		await page.waitForTimeout(2000);

		await page.goto('/storyboard');

		const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
		const thumbnails = charactersSidebar.locator('[data-character-thumbnail]');
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();

		await thumbnails.first().dragTo(firstWireframe);
		await thumbnails.nth(1).dragTo(firstWireframe);

		// Remove Captain Nova
		const captainNovaInWireframe = firstWireframe.locator('img[alt*="Captain Nova"]');
		await captainNovaInWireframe.hover();
		await firstWireframe.getByRole('button', { name: /Remove.*Captain Nova/i }).click();

		// Verify Captain Nova removed but Robo remains
		await expect(firstWireframe.locator('img[alt*="Captain Nova"]')).not.toBeVisible();
		await expect(firstWireframe.locator('img[alt*="Robo"]')).toBeVisible();
	});

	test.skip('wireframe drag-and-drop updates timeline accordingly', async ({ page }) => {
		// Generate scene
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });
		await page.waitForTimeout(2000);

		// Navigate to storyboard
		await page.goto('/storyboard');

		// Drag scene to wireframe
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnail = scenesSidebar.locator('[data-scene-thumbnail]').first();
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await sceneThumbnail.dragTo(firstWireframe);

		// Verify timeline shows the scene
		const timeline = page.locator('[data-scene-timeline]');
		await expect(timeline.locator('[data-scene-timeline-item]').first()).toBeVisible();

		// Verify timeline item matches wireframe content
		const timelineItem = timeline.locator('[data-scene-timeline-item]').first();
		await expect(timelineItem.locator('img[alt*="Scene"]')).toBeVisible();
	});

	test.skip('storyboard thumbnail appears in sidebar under Storyboard tab', async ({ page }) => {
		// Generate scenes and build storyboard
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		// Navigate to storyboard and add scenes to wireframes
		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		// Add scenes to multiple wireframes
		await sceneThumbnails.first().dragTo(wireframes.first());
		await sceneThumbnails.nth(1).dragTo(wireframes.nth(1));

		// Wait for storyboard thumbnail to be created
		await page.waitForTimeout(2000);

		// Check sidebar for storyboard thumbnail under Storyboard section
		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const thumbnail = storyboardSidebar.locator('[data-storyboard-thumbnail]').first();
		await expect(thumbnail).toBeVisible({ timeout: 10000 });

		// Verify thumbnail is a small square composite image
		const thumbnailImg = thumbnail.locator('img');
		await expect(thumbnailImg).toBeVisible();
	});

	test.skip('multiple storyboard thumbnails display in grid below Storyboard tab', async ({ page }) => {
		// Create first storyboard
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnails = scenesSidebar.locator('[data-scene-thumbnail]');
		const wireframes = page.locator('[data-storyboard-wireframe]');

		await sceneThumbnails.first().dragTo(wireframes.first());
		await page.waitForTimeout(2000);

		// Create second storyboard (via "New Storyboard" button or similar)
		await page.getByRole('button', { name: /New Storyboard/i }).click();
		await sceneThumbnails.nth(1).dragTo(wireframes.first());
		await page.waitForTimeout(2000);

		// Verify multiple storyboard thumbnails in sidebar
		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');
		const thumbnails = storyboardSidebar.locator('[data-storyboard-thumbnail]');
		const count = await thumbnails.count();
		expect(count).toBe(2);

		// Verify they're displayed in a grid/line
		await expect(thumbnails.first()).toBeVisible();
		await expect(thumbnails.nth(1)).toBeVisible();
	});

	test.skip('conversations for Storyboard appear below thumbnails in sidebar', async ({ page }) => {
		// Generate storyboard (creates conversation)
		await page.goto('/scenes');
		await page.getByRole('button', { name: /Generate Scenes/i }).click();
		await expect(page.locator('img[alt*="Scene"]').first()).toBeVisible({ timeout: 60000 });

		await page.goto('/storyboard');
		const scenesSidebar = page.locator('[data-sidebar-section="scenes"]');
		const sceneThumbnail = scenesSidebar.locator('[data-scene-thumbnail]').first();
		const firstWireframe = page.locator('[data-storyboard-wireframe]').first();
		await sceneThumbnail.dragTo(firstWireframe);
		await page.waitForTimeout(2000);

		// Check sidebar structure: Storyboard tab > thumbnails > conversations
		const storyboardSidebar = page.locator('[data-sidebar-section="storyboard"]');

		// Thumbnails should be first
		const thumbnails = storyboardSidebar.locator('[data-storyboard-thumbnail]');
		await expect(thumbnails.first()).toBeVisible();

		// Conversations should be below thumbnails
		const conversations = storyboardSidebar.locator('[data-conversation-item]');
		await expect(conversations.first()).toBeVisible({ timeout: 10000 });
	});
});
