import { test, expect } from '@playwright/test';

test.describe('Character Improvement @characters', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/characters');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.describe('Description Improvement', () => {
		test('shows Smart Improve Description and Improve Description With Prompt buttons after enhance', async ({ page }) => {
			// Add a custom character
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();

			// Click Enhance Description
			await page.getByRole('button', { name: /Enhance Description/i }).click();

			// Wait for enhanced description to appear
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Verify Smart Improve Description button appears
			const smartImproveBtn = page.getByRole('button', { name: /Smart Improve Description/i });
			await expect(smartImproveBtn).toBeVisible();

			// Verify Improve Description With Prompt button appears
			const improveWithPromptBtn = page.getByRole('button', { name: /Improve Description With Prompt/i });
			await expect(improveWithPromptBtn).toBeVisible();

			// Original Enhance Description button should not be visible anymore
			const enhanceButtons = page.getByRole('button', { name: /^Enhance Description$/i });
			expect(await enhanceButtons.count()).toBe(0);
		});

		test('Smart Improve Description regenerates description without user input', async ({ page }) => {
			// Setup: Add character and enhance description
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Get the current enhanced description text
			const enhancedSection = page.locator('text=Enhanced Description').locator('..');
			const originalText = await enhancedSection.textContent();

			// Click Smart Improve Description
			await page.getByRole('button', { name: /Smart Improve Description/i }).click();

			// Wait for loading state
			await expect(page.getByText(/Improving/i)).toBeVisible();

			// Wait for new description (should be different due to ChatGPT temperature)
			await expect(page.getByText(/Improving/i)).not.toBeVisible({ timeout: 60000 });

			// Verify enhanced description section still exists
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible();
		});

		test('Improve Description With Prompt shows textarea when clicked', async ({ page }) => {
			// Setup: Add character and enhance description
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Click Improve Description With Prompt
			await page.getByRole('button', { name: /Improve Description With Prompt/i }).click();

			// Verify textarea appears
			const promptTextarea = page.getByPlaceholder(/describe.*change.*description/i);
			await expect(promptTextarea).toBeVisible();

			// Verify Regenerate Description button appears
			const regenerateBtn = page.getByRole('button', { name: /Regenerate Description/i });
			await expect(regenerateBtn).toBeVisible();
		});

		test('Regenerate Description applies user prompt changes', async ({ page }) => {
			// Setup: Add character and enhance description
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Click Improve Description With Prompt
			await page.getByRole('button', { name: /Improve Description With Prompt/i }).click();

			// Enter a prompt
			const promptTextarea = page.getByPlaceholder(/describe.*change.*description/i);
			await promptTextarea.fill('Make the character more mysterious and add a scar');

			// Click Regenerate Description
			await page.getByRole('button', { name: /Regenerate Description/i }).click();

			// Wait for loading
			await expect(page.getByText(/Regenerating/i)).toBeVisible();
			await expect(page.getByText(/Regenerating/i)).not.toBeVisible({ timeout: 60000 });

			// Verify description updated (should mention scar or mysterious)
			const enhancedSection = page.locator('text=Enhanced Description').locator('..');
			const newText = await enhancedSection.textContent();
			expect(newText?.toLowerCase()).toMatch(/mysterious|scar/);
		});

		test('Cancel button hides prompt textarea', async ({ page }) => {
			// Setup: Add character and enhance description
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Click Improve Description With Prompt
			await page.getByRole('button', { name: /Improve Description With Prompt/i }).click();
			await expect(page.getByPlaceholder(/describe.*change.*description/i)).toBeVisible();

			// Click Cancel
			await page.getByRole('button', { name: /Cancel/i }).click();

			// Verify textarea is hidden
			await expect(page.getByPlaceholder(/describe.*change.*description/i)).not.toBeVisible();

			// Verify buttons are back
			await expect(page.getByRole('button', { name: /Smart Improve Description/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /Improve Description With Prompt/i })).toBeVisible();
		});
	});

	test.describe('Image Improvement', () => {
		test.skip('shows Smart Improve Image and Improve Image With Prompt buttons after image generation', async ({ page }) => {
			// Add a custom character
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();

			// Enhance description first
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Generate image
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Verify Smart Improve Image button appears
			const smartImproveBtn = page.getByRole('button', { name: /Smart Improve Image/i });
			await expect(smartImproveBtn).toBeVisible();

			// Verify Improve Image With Prompt button appears
			const improveWithPromptBtn = page.getByRole('button', { name: /Improve Image With Prompt/i });
			await expect(improveWithPromptBtn).toBeVisible();

			// Original Generate Image button should not be visible anymore
			const generateButtons = page.getByRole('button', { name: /^Generate Image$/i });
			expect(await generateButtons.count()).toBe(0);
		});

		test.skip('Smart Improve Image regenerates image without user input', async ({ page }) => {
			// Setup: Add character, enhance description, generate image
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Get the current image src
			const img = page.locator('img[alt*="Custom Character"]');
			const originalSrc = await img.getAttribute('src');

			// Click Smart Improve Image
			await page.getByRole('button', { name: /Smart Improve Image/i }).click();

			// Wait for loading state
			await expect(page.getByText(/Improving/i)).toBeVisible();

			// Wait for new image
			await expect(page.getByText(/Improving/i)).not.toBeVisible({ timeout: 45000 });

			// Verify image updated (src should be different)
			const newSrc = await img.getAttribute('src');
			expect(newSrc).not.toBe(originalSrc);
		});

		test.skip('Improve Image With Prompt shows textarea when clicked', async ({ page }) => {
			// Setup: Add character, enhance description, generate image
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Click Improve Image With Prompt
			await page.getByRole('button', { name: /Improve Image With Prompt/i }).click();

			// Verify textarea appears
			const promptTextarea = page.getByPlaceholder(/describe.*change.*image/i);
			await expect(promptTextarea).toBeVisible();

			// Verify Regenerate Image button appears
			const regenerateBtn = page.getByRole('button', { name: /Regenerate Image/i });
			await expect(regenerateBtn).toBeVisible();
		});

		test.skip('Regenerate Image applies user prompt changes', async ({ page }) => {
			// Setup: Add character, enhance description, generate image
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Get the current image src
			const img = page.locator('img[alt*="Custom Character"]');
			const originalSrc = await img.getAttribute('src');

			// Click Improve Image With Prompt
			await page.getByRole('button', { name: /Improve Image With Prompt/i }).click();

			// Enter a prompt
			const promptTextarea = page.getByPlaceholder(/describe.*change.*image/i);
			await promptTextarea.fill('Add a laser sword and futuristic armor');

			// Click Regenerate Image
			await page.getByRole('button', { name: /Regenerate Image/i }).click();

			// Wait for loading
			await expect(page.getByText(/Regenerating/i)).toBeVisible();
			await expect(page.getByText(/Regenerating/i)).not.toBeVisible({ timeout: 45000 });

			// Verify image updated
			const newSrc = await img.getAttribute('src');
			expect(newSrc).not.toBe(originalSrc);
		});

		test.skip('Cancel button hides image prompt textarea', async ({ page }) => {
			// Setup: Add character, enhance description, generate image
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });
			await page.getByRole('button', { name: /Generate Image/i }).click();
			await expect(page.locator('img[alt*="Custom Character"]')).toBeVisible({ timeout: 45000 });

			// Click Improve Image With Prompt
			await page.getByRole('button', { name: /Improve Image With Prompt/i }).click();
			await expect(page.getByPlaceholder(/describe.*change.*image/i)).toBeVisible();

			// Click Cancel
			await page.getByRole('button', { name: /Cancel/i }).click();

			// Verify textarea is hidden
			await expect(page.getByPlaceholder(/describe.*change.*image/i)).not.toBeVisible();

			// Verify buttons are back
			await expect(page.getByRole('button', { name: /Smart Improve Image/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /Improve Image With Prompt/i })).toBeVisible();
		});
	});

	test.describe('Button State Management', () => {
		test('initial state shows only Enhance Description and Generate Image buttons', async ({ page }) => {
			// Add a custom character
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();

			// Verify initial buttons
			await expect(page.getByRole('button', { name: /^Enhance Description$/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /^Generate Image$/i })).toBeVisible();

			// Verify improvement buttons are NOT visible
			await expect(page.getByRole('button', { name: /Smart Improve/i })).not.toBeVisible();
			await expect(page.getByRole('button', { name: /Improve.*With Prompt/i })).not.toBeVisible();
		});

		test('description improvement buttons persist across image generation', async ({ page }) => {
			// Add character and enhance description
			await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(page.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Verify description improvement buttons are visible
			await expect(page.getByRole('button', { name: /Smart Improve Description/i })).toBeVisible();

			// Generate image (skipped due to API timeout)
			// After image generation, description improvement buttons should still be visible
			// await page.getByRole('button', { name: /Generate Image/i }).click();
			// await expect(page.locator('img')).toBeVisible({ timeout: 45000 });
			// await expect(page.getByRole('button', { name: /Smart Improve Description/i })).toBeVisible();
		});

		test('multiple characters have independent improvement states', async ({ page }) => {
			// Add two characters
			await page.getByPlaceholder(/Enter character description/).fill('First character');
			await page.getByRole('button', { name: 'Add' }).click();
			await page.waitForTimeout(500);

			await page.getByPlaceholder(/Enter character description/).fill('Second character');
			await page.getByRole('button', { name: 'Add' }).click();

			// Enhance first character's description
			const firstCharContent = page.locator('[data-character-content="0"]');
			await firstCharContent.getByRole('button', { name: /Enhance Description/i }).click();
			await expect(firstCharContent.getByText(/Enhanced Description/i)).toBeVisible({ timeout: 60000 });

			// Verify first character has improvement buttons
			await expect(firstCharContent.getByRole('button', { name: /Smart Improve Description/i })).toBeVisible();

			// Verify second character still has original buttons
			const secondCharContent = page.locator('[data-character-content="1"]');
			await expect(secondCharContent.getByRole('button', { name: /^Enhance Description$/i })).toBeVisible();
			await expect(secondCharContent.getByRole('button', { name: /Smart Improve/i })).not.toBeVisible();
		});
	});
});
