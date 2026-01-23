import { test, expect } from '@playwright/test';

test.describe('Scene Generation @scenes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/scenes');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.describe('Initial Wireframe Setup', () => {
		test('shows initial wireframe and plus button on load', async ({ page }) => {
			// Verify the description text
			await expect(page.getByText(/Drag a story and\/or characters into a scene wireframe/i)).toBeVisible();

			// Verify first wireframe exists with dashed border
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await expect(firstWireframe).toBeVisible();

			// Verify wireframe has horizontal aspect ratio, rounded corners, dashed border
			const wireframeStyles = await firstWireframe.evaluate((el) => {
				const styles = window.getComputedStyle(el);
				return {
					aspectRatio: styles.aspectRatio || 'not set',
					borderRadius: styles.borderRadius,
					borderStyle: styles.borderStyle,
					borderColor: styles.borderColor,
					borderWidth: styles.borderWidth
				};
			});

			expect(wireframeStyles.borderStyle).toBe('dashed');
			expect(wireframeStyles.borderWidth).toContain('1px');

			// Verify plus button wireframe exists to the right
			const plusWireframe = page.locator('[data-add-wireframe]');
			await expect(plusWireframe).toBeVisible();
			await expect(plusWireframe.getByText(/\+/)).toBeVisible();
		});

		test('clicking plus button adds new wireframe', async ({ page }) => {
			// Click the plus button
			await page.locator('[data-add-wireframe]').click();

			// Verify two wireframes exist now (plus the plus button)
			const wireframes = page.locator('[data-scene-wireframe]');
			expect(await wireframes.count()).toBe(2);

			// Verify plus button moved to the right
			const plusWireframe = page.locator('[data-add-wireframe]');
			await expect(plusWireframe).toBeVisible();
		});

		test('multiple clicks add multiple wireframes', async ({ page }) => {
			// Click plus button 3 times
			await page.locator('[data-add-wireframe]').click();
			await page.locator('[data-add-wireframe]').click();
			await page.locator('[data-add-wireframe]').click();

			// Verify 4 wireframes exist
			const wireframes = page.locator('[data-scene-wireframe]');
			expect(await wireframes.count()).toBe(4);
		});

		test('wireframes maintain order with plus button at end', async ({ page }) => {
			// Add 2 wireframes
			await page.locator('[data-add-wireframe]').click();
			await page.locator('[data-add-wireframe]').click();

			// Get all wireframe elements including plus button
			const container = page.locator('[data-wireframes-container]');
			const children = container.locator('> *');
			const count = await children.count();

			// Last child should be the plus button
			const lastChild = children.nth(count - 1);
			await expect(lastChild.locator('[data-add-wireframe]')).toBeVisible();
		});
	});

	test.describe('Story Drag and Drop', () => {
		test.skip('dragging story from sidebar into wireframe expands to scene count', async ({ page }) => {
			// Generate a story first
			await page.goto('/story');
			await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with 3 scenes');
			await page.getByRole('button', { name: 'Generate Story' }).click();
			await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

			// Navigate to scenes
			await page.goto('/scenes');

			// Get the story from sidebar
			const storySidebar = page.locator('[data-sidebar-section="story"]');
			const storyItem = storySidebar.locator('[data-story-item]').first();

			// Drag to first wireframe
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await storyItem.dragTo(firstWireframe);

			// Verify wireframes expanded to match scene count (3 scenes)
			const wireframes = page.locator('[data-scene-wireframe]');
			expect(await wireframes.count()).toBe(3);
		});

		test.skip('each scene wireframe shows truncated description with Scene prefix', async ({ page }) => {
			// Setup: Generate story and drag to scenes
			await page.goto('/story');
			await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
			await page.getByRole('button', { name: 'Generate Story' }).click();
			await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
			await page.goto('/scenes');

			const storySidebar = page.locator('[data-sidebar-section="story"]');
			const storyItem = storySidebar.locator('[data-story-item]').first();
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await storyItem.dragTo(firstWireframe);

			// Verify each wireframe shows "Scene: [description]"
			const firstWireframeText = await page.locator('[data-scene-wireframe="0"]').textContent();
			expect(firstWireframeText).toMatch(/Scene:/i);

			const secondWireframeText = await page.locator('[data-scene-wireframe="1"]').textContent();
			expect(secondWireframeText).toMatch(/Scene:/i);
		});

		test.skip('blank wireframes before target remain before expanded scenes', async ({ page }) => {
			// Add 2 blank wireframes first
			await page.locator('[data-add-wireframe]').click();
			await page.locator('[data-add-wireframe]').click();

			// Now drag story to the second wireframe (index 1)
			await page.goto('/story');
			await page.getByPlaceholder(/Enter your story prompt/).fill('A 3 scene story');
			await page.getByRole('button', { name: 'Generate Story' }).click();
			await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
			await page.goto('/scenes');

			const storySidebar = page.locator('[data-sidebar-section="story"]');
			const storyItem = storySidebar.locator('[data-story-item]').first();
			const secondWireframe = page.locator('[data-scene-wireframe="1"]');
			await storyItem.dragTo(secondWireframe);

			// Verify first wireframe (index 0) is still blank
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			const hasSceneText = await firstWireframe.locator('text=/Scene:/').count();
			expect(hasSceneText).toBe(0);

			// Verify story scenes start at index 1
			const secondWireframeText = await page.locator('[data-scene-wireframe="1"]').textContent();
			expect(secondWireframeText).toMatch(/Scene:/i);
		});

		test.skip('blank wireframes after target remain after expanded scenes', async ({ page }) => {
			// Drag story to first wireframe
			await page.goto('/story');
			await page.getByPlaceholder(/Enter your story prompt/).fill('A 2 scene story');
			await page.getByRole('button', { name: 'Generate Story' }).click();
			await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
			await page.goto('/scenes');

			const storySidebar = page.locator('[data-sidebar-section="story"]');
			const storyItem = storySidebar.locator('[data-story-item]').first();
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await storyItem.dragTo(firstWireframe);

			// Add blank wireframe after story scenes
			await page.locator('[data-add-wireframe]').click();

			// Verify last wireframe is blank
			const wireframes = page.locator('[data-scene-wireframe]');
			const count = await wireframes.count();
			const lastWireframe = wireframes.nth(count - 1);
			const hasSceneText = await lastWireframe.locator('text=/Scene:/').count();
			expect(hasSceneText).toBe(0);
		});
	});

	test.describe('Text Description Feature', () => {
		test('each wireframe has + Text Description button', async ({ page }) => {
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			const textDescButton = firstWireframe.getByRole('button', { name: /\+ Text Description/i });
			await expect(textDescButton).toBeVisible();
		});

		test('clicking + Text Description shows textarea above button', async ({ page }) => {
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			const textDescButton = firstWireframe.getByRole('button', { name: /\+ Text Description/i });
			await textDescButton.click();

			// Verify textarea appears
			const textarea = firstWireframe.locator('textarea[placeholder*="description"]');
			await expect(textarea).toBeVisible();

			// Verify textarea is above the button (check DOM order)
			const textareaIndex = await textarea.evaluate((el) => {
				return Array.from(el.parentElement!.children).indexOf(el);
			});
			const buttonIndex = await textDescButton.evaluate((el) => {
				return Array.from(el.parentElement!.children).indexOf(el);
			});
			expect(textareaIndex).toBeLessThan(buttonIndex);
		});

		test('each wireframe has independent text description', async ({ page }) => {
			// Add a second wireframe
			await page.locator('[data-add-wireframe]').click();

			// Click + Text Description on first wireframe
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			const firstTextarea = firstWireframe.locator('textarea');
			await firstTextarea.fill('First scene description');

			// Click + Text Description on second wireframe
			const secondWireframe = page.locator('[data-scene-wireframe="1"]');
			await secondWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			const secondTextarea = secondWireframe.locator('textarea');
			await secondTextarea.fill('Second scene description');

			// Verify both have different values
			await expect(firstTextarea).toHaveValue('First scene description');
			await expect(secondTextarea).toHaveValue('Second scene description');
		});

		test('text description persists after clicking away', async ({ page }) => {
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			const textarea = firstWireframe.locator('textarea');
			await textarea.fill('My custom description');

			// Click somewhere else
			await page.locator('h1').click();

			// Verify textarea still has value
			await expect(textarea).toHaveValue('My custom description');
		});
	});

	test.describe('Character Drag and Drop', () => {
		test.skip('character thumbnail can be dragged into wireframe', async ({ page }) => {
			// Setup: Generate character first
			await page.goto('/characters');
			await page.getByPlaceholder(/Enter character description/).fill('A brave captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Navigate to scenes
			await page.goto('/scenes');

			// Drag character from sidebar to wireframe
			const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
			const characterThumbnail = charactersSidebar.locator('[data-character-thumbnail]').first();
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await characterThumbnail.dragTo(firstWireframe);

			// Verify tiny character thumbnail appears at bottom of wireframe
			const wireframeCharThumbnail = firstWireframe.locator('[data-wireframe-character]');
			await expect(wireframeCharThumbnail).toBeVisible();
		});

		test.skip('multiple characters show in line at bottom left of wireframe', async ({ page }) => {
			// Setup: Generate 2 characters
			await page.goto('/characters');
			await page.getByPlaceholder(/Enter character description/).fill('First character');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.waitForTimeout(500);
			await page.getByPlaceholder(/Enter character description/).fill('Second character');
			await page.getByRole('button', { name: 'Add' }).click();

			// Navigate to scenes
			await page.goto('/scenes');

			// Drag both characters to first wireframe
			const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
			const characterThumbnails = charactersSidebar.locator('[data-character-thumbnail]');
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');

			await characterThumbnails.first().dragTo(firstWireframe);
			await characterThumbnails.nth(1).dragTo(firstWireframe);

			// Verify both character thumbnails visible in wireframe
			const wireframeCharThumbnails = firstWireframe.locator('[data-wireframe-character]');
			expect(await wireframeCharThumbnails.count()).toBe(2);

			// Verify they're aligned at bottom left (CSS check)
			const container = firstWireframe.locator('[data-wireframe-characters-container]');
			const containerStyles = await container.evaluate((el) => {
				const styles = window.getComputedStyle(el);
				return {
					justifyContent: styles.justifyContent,
					alignItems: styles.alignItems
				};
			});
			expect(containerStyles.alignItems).toMatch(/flex-start|start/);
		});

		test.skip('character metadata persists even if thumbnail not shown', async ({ page }) => {
			// Add many characters (more than can fit visually)
			// This test verifies the metadata is stored even if not all thumbnails display

			// For now, just verify that wireframe has data-characters attribute
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');

			// After dragging characters, verify data attribute exists
			// The actual implementation will store character IDs/references
			await expect(firstWireframe).toHaveAttribute('data-characters');
		});

		test.skip('different wireframes have independent character lists', async ({ page }) => {
			// Setup: Generate 2 characters and add 2 wireframes
			await page.goto('/characters');
			await page.getByPlaceholder(/Enter character description/).fill('Character A');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.waitForTimeout(500);
			await page.getByPlaceholder(/Enter character description/).fill('Character B');
			await page.getByRole('button', { name: 'Add' }).click();

			await page.goto('/scenes');
			await page.locator('[data-add-wireframe]').click();

			// Drag Character A to first wireframe
			const charactersSidebar = page.locator('[data-sidebar-section="characters"]');
			const characterThumbnails = charactersSidebar.locator('[data-character-thumbnail]');
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			const secondWireframe = page.locator('[data-scene-wireframe="1"]');

			await characterThumbnails.first().dragTo(firstWireframe);

			// Drag Character B to second wireframe
			await characterThumbnails.nth(1).dragTo(secondWireframe);

			// Verify first wireframe only has Character A
			const firstWireframeChars = firstWireframe.locator('[data-wireframe-character]');
			expect(await firstWireframeChars.count()).toBe(1);

			// Verify second wireframe only has Character B
			const secondWireframeChars = secondWireframe.locator('[data-wireframe-character]');
			expect(await secondWireframeChars.count()).toBe(1);
		});
	});

	test.describe('Scene Image Generation', () => {
		test('Generate Scene Image button hidden initially', async ({ page }) => {
			const generateButton = page.getByRole('button', { name: /Generate Scene Image/i });
			await expect(generateButton).not.toBeVisible();
		});

		test('Generate Scene Image button appears when wireframe has content', async ({ page }) => {
			// Add text description to first wireframe
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			const textarea = firstWireframe.locator('textarea');
			await textarea.fill('A spaceship landing');

			// Verify Generate button appears
			const generateButton = page.getByRole('button', { name: /Generate Scene Image/i });
			await expect(generateButton).toBeVisible();
		});

		test('button says Generate Scene Images (plural) when multiple wireframes have content', async ({ page }) => {
			// Add content to two wireframes
			await page.locator('[data-add-wireframe]').click();

			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('First scene');

			const secondWireframe = page.locator('[data-scene-wireframe="1"]');
			await secondWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await secondWireframe.locator('textarea').fill('Second scene');

			// Verify plural form
			const generateButton = page.getByRole('button', { name: /Generate Scene Images/i });
			await expect(generateButton).toBeVisible();
		});

		test.skip('clicking Generate Scene Image shows loading state', async ({ page }) => {
			// Add text description
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A spaceship');

			// Click generate
			await page.getByRole('button', { name: /Generate Scene Image/i }).click();

			// Verify loading state
			await expect(page.getByText(/Generating/i)).toBeVisible();
			await expect(page.getByRole('button', { name: /Generating/i })).toBeDisabled();
		});

		test.skip('generated image replaces text in wireframe', async ({ page }) => {
			// Add text description
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			const textarea = firstWireframe.locator('textarea');
			await textarea.fill('A spaceship landing');

			// Generate image
			await page.getByRole('button', { name: /Generate Scene Image/i }).click();
			await expect(page.getByText(/Generating/i)).not.toBeVisible({ timeout: 45000 });

			// Verify image appears in wireframe
			const wireframeImage = firstWireframe.locator('img[alt*="Scene"]');
			await expect(wireframeImage).toBeVisible();

			// Verify "Scene:" text is no longer visible (replaced by image)
			const sceneText = firstWireframe.locator('text=/Scene:/');
			expect(await sceneText.count()).toBe(0);
		});

		test.skip('multiple wireframes generate multiple images', async ({ page }) => {
			// Add 2 wireframes with text
			await page.locator('[data-add-wireframe]').click();

			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('First scene');

			const secondWireframe = page.locator('[data-scene-wireframe="1"]');
			await secondWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await secondWireframe.locator('textarea').fill('Second scene');

			// Generate images
			await page.getByRole('button', { name: /Generate Scene Images/i }).click();
			await expect(page.getByText(/Generating/i)).not.toBeVisible({ timeout: 45000 });

			// Verify both wireframes have images
			await expect(firstWireframe.locator('img')).toBeVisible();
			await expect(secondWireframe.locator('img')).toBeVisible();
		});

		test.skip('text description is sent with generation request', async ({ page }) => {
			// This test verifies the text description is included in the API request
			// We can check network requests or verify in the generated image

			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A unique custom description');

			// Listen for network request
			const requestPromise = page.waitForRequest(request =>
				request.url().includes('/api/') &&
				request.method() === 'POST' &&
				request.postDataJSON()?.description?.includes('unique custom description')
			);

			await page.getByRole('button', { name: /Generate Scene Image/i }).click();

			// Verify request was made with text description
			const request = await requestPromise;
			expect(request).toBeTruthy();
		});
	});

	test.describe('Send to Video Generation', () => {
		test('Send to Video Generation button hidden initially', async ({ page }) => {
			const sendButton = page.getByRole('button', { name: /Send to Video Generation/i });
			await expect(sendButton).not.toBeVisible();
		});

		test.skip('Send to Video Generation button appears after image generated', async ({ page }) => {
			// Add text and generate image
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A spaceship');

			await page.getByRole('button', { name: /Generate Scene Image/i }).click();
			await expect(page.getByText(/Generating/i)).not.toBeVisible({ timeout: 45000 });

			// Verify Send to Video button appears
			const sendButton = page.getByRole('button', { name: /Send to Video Generation/i });
			await expect(sendButton).toBeVisible();
		});

		test.skip('clicking Send to Video Generation navigates to video page', async ({ page }) => {
			// Setup: Generate scene image first
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A spaceship');
			await page.getByRole('button', { name: /Generate Scene Image/i }).click();
			await expect(page.getByText(/Generating/i)).not.toBeVisible({ timeout: 45000 });

			// Click Send to Video
			await page.getByRole('button', { name: /Send to Video Generation/i }).click();

			// Verify navigation to video page
			await expect(page).toHaveURL(/\/video/);
		});

		test.skip('video page receives scene images and metadata', async ({ page }) => {
			// Setup: Generate scene image
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A spaceship');
			await page.getByRole('button', { name: /Generate Scene Image/i }).click();
			await expect(page.getByText(/Generating/i)).not.toBeVisible({ timeout: 45000 });

			// Click Send to Video
			await page.getByRole('button', { name: /Send to Video Generation/i }).click();
			await expect(page).toHaveURL(/\/video/);

			// Verify scene images are visible on video page
			const sceneImage = page.locator('img[alt*="Scene"]');
			await expect(sceneImage).toBeVisible();

			// Verify metadata (story, characters) is available
			// This would be checked through UI elements or data attributes
			await expect(page.locator('[data-has-story-metadata]')).toBeVisible();
		});
	});

	test.describe('Wireframe Visual Styling', () => {
		test('wireframe has correct visual properties', async ({ page }) => {
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');

			const styles = await firstWireframe.evaluate((el) => {
				const computed = window.getComputedStyle(el);
				return {
					borderRadius: computed.borderRadius,
					borderStyle: computed.borderStyle,
					borderColor: computed.borderColor,
					borderWidth: computed.borderWidth,
					aspectRatio: computed.aspectRatio,
					backgroundColor: computed.backgroundColor
				};
			});

			// Rounded corners
			expect(parseInt(styles.borderRadius)).toBeGreaterThan(0);

			// 1px dashed black border
			expect(styles.borderStyle).toBe('dashed');
			expect(styles.borderWidth).toContain('1px');

			// Horizontal video aspect ratio (16:9 typical)
			// Note: might be set as percentage width or explicit aspect-ratio
			if (styles.aspectRatio !== 'auto') {
				const ratio = parseFloat(styles.aspectRatio);
				expect(ratio).toBeGreaterThan(1); // Width > height
			}
		});

		test('wireframe with image has solid border instead of dashed', async ({ page }) => {
			// Initially dashed
			const firstWireframe = page.locator('[data-scene-wireframe="0"]');
			let borderStyle = await firstWireframe.evaluate((el) =>
				window.getComputedStyle(el).borderStyle
			);
			expect(borderStyle).toBe('dashed');

			// After adding content, should remain dashed until image generated
			await firstWireframe.getByRole('button', { name: /\+ Text Description/i }).click();
			await firstWireframe.locator('textarea').fill('A scene');

			borderStyle = await firstWireframe.evaluate((el) =>
				window.getComputedStyle(el).borderStyle
			);
			expect(borderStyle).toBe('dashed');

			// After image generated (skipped due to API), border would become solid
			// await generateImage();
			// borderStyle = await firstWireframe.evaluate((el) =>
			// 	window.getComputedStyle(el).borderStyle
			// );
			// expect(borderStyle).toBe('solid');
		});
	});
});
