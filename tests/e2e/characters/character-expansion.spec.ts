import { test, expect } from '@playwright/test';

// Skip all tests in this file - they depend on story generation API which is slow/unreliable.
// Character expansion functionality is thoroughly tested in character-expansion-simple.spec.ts
// using custom characters instead of story-generated characters.
test.describe.skip('Character Expansion @characters', () => {
	test.beforeEach(async ({ page }) => {
		// Start from story page to get characters
		await page.goto('/story');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test('clicking first character button expands that character content', async ({ page }) => {
		// Generate a story with multiple characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with Captain Nova and Robo the robot');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

		// Navigate to characters directly
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Get the first character button
		const firstCharButton = page.getByRole('button', { name: /Captain Nova|Robo/i }).first();
		const buttonText = await firstCharButton.textContent();

		// Click first character
		await firstCharButton.click();

		// Verify character content area appears
		const characterContent = page.locator('[data-character-content="0"]');
		await expect(characterContent).toBeVisible();
		await expect(characterContent.getByRole('heading', { name: buttonText!, level: 2 })).toBeVisible();
	});

	test('clicking second character button expands second character content above first', async ({ page }) => {
		// Generate story and navigate to characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with Captain Nova and Robo the robot');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Click first character
		const buttons = page.getByRole('button', { name: /Captain Nova|Robo/i });
		const firstButton = buttons.first();
		await firstButton.click();

		// Wait for first character content
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();

		// Click second character
		const secondButton = buttons.nth(1);
		await secondButton.click();

		// Verify both character content areas are visible
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();

		// Verify button states - both should be in 'default' variant (highlighted)
		await expect(firstButton).toHaveAttribute('data-variant', 'default');
		await expect(secondButton).toHaveAttribute('data-variant', 'default');
	});

	test('clicking third character expands third character content', async ({ page }) => {
		// Generate story with 3+ characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A fantasy story with a wizard, a knight, and a dragon');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Click all three character buttons
		const buttons = page.getByRole('button', { name: /wizard|knight|dragon/i });

		// Verify we have at least 3 characters
		const count = await buttons.count();
		if (count < 3) {
			test.skip();
			return;
		}

		await buttons.nth(0).click();
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();

		await buttons.nth(1).click();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();

		await buttons.nth(2).click();
		await expect(page.locator('[data-character-content="2"]')).toBeVisible();

		// Verify all three are visible simultaneously
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();
		await expect(page.locator('[data-character-content="2"]')).toBeVisible();
	});

	test('clicking already-expanded character scrolls to that character', async ({ page }) => {
		// Generate story and navigate to characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with Captain Nova and Robo');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Click first character
		const firstButton = page.getByRole('button', { name: /Captain Nova|Robo/i }).first();
		await firstButton.click();
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();

		// Click second character
		const secondButton = page.getByRole('button', { name: /Captain Nova|Robo/i }).nth(1);
		await secondButton.click();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();

		// Get initial scroll position of first character
		const firstCharContent = page.locator('[data-character-content="0"]');

		// Click first character button again
		await firstButton.click();

		// Verify first character content is still visible (not collapsed)
		await expect(firstCharContent).toBeVisible();

		// Verify it scrolled into view by checking if it's in viewport
		const isInViewport = await firstCharContent.evaluate((el) => {
			const rect = el.getBoundingClientRect();
			return (
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
				rect.right <= (window.innerWidth || document.documentElement.clientWidth)
			);
		});

		expect(isInViewport).toBeTruthy();
	});

	test('character content does not get duplicated when clicking same button twice', async ({ page }) => {
		// Generate story and navigate to characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure with Captain Nova');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Click first character twice
		const firstButton = page.getByRole('button', { name: /Captain Nova/i }).first();
		await firstButton.click();
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();

		await firstButton.click();

		// Verify only one instance of character content exists
		const contentAreas = page.locator('[data-character-content="0"]');
		expect(await contentAreas.count()).toBe(1);
	});

	test('multiple characters can have their Enhance Description buttons clicked', async ({ page }) => {
		// Generate story with multiple characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A story with Alice and Bob');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		// Expand both characters
		const buttons = page.getByRole('button', { name: /Alice|Bob/i });
		await buttons.first().click();
		await buttons.nth(1).click();

		// Verify both have independent Enhance Description buttons
		const firstCharContent = page.locator('[data-character-content="0"]');
		const secondCharContent = page.locator('[data-character-content="1"]');

		await expect(firstCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
		await expect(secondCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
	});

	test('button state reflects expanded/collapsed state', async ({ page }) => {
		// Generate story and navigate to characters
		await page.getByPlaceholder(/Enter your story prompt/).fill('A story with multiple characters');
		await page.getByRole('button', { name: 'Generate Story' }).click();
		await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });
		await page.goto('/characters');
		await page.waitForTimeout(1000); // Wait for characters to load from story

		const firstButton = page.getByRole('button').filter({ hasText: /^[A-Z]/ }).first();

		// Initially, button should be outline variant (not expanded)
		// Note: The exact class/attribute depends on shadcn-svelte Button implementation
		const initialClasses = await firstButton.getAttribute('class');

		// Click to expand
		await firstButton.click();
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();

		// Button should now have default variant (expanded)
		const expandedClasses = await firstButton.getAttribute('class');
		expect(expandedClasses).not.toBe(initialClasses);
	});
});
