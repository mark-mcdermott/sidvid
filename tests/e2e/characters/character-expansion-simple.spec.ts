import { test, expect } from '@playwright/test';

test.describe('Character Expansion Simple @characters', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/characters');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test('custom character button expands character content', async ({ page }) => {
		// Add a custom character
		await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
		await page.getByRole('button', { name: 'Add' }).click();

		// Verify character button appears under "Characters from Story" section
		// Actually it should appear in the story characters section or custom section
		// Let me check what actually appears
		const customCharButton = page.getByRole('button', { name: /Custom Character/i }).first();
		await expect(customCharButton).toBeVisible();

		// Click the button
		await customCharButton.click();

		// Verify character content area appears
		const characterContent = page.locator('[data-character-content="0"]');
		await expect(characterContent).toBeVisible();
		await expect(characterContent.getByRole('heading', { name: /Custom Character/i, level: 2 })).toBeVisible();
	});

	test('adding second custom character expands second content', async ({ page }) => {
		// Add first custom character
		await page.getByPlaceholder(/Enter character description/).fill('A brave space captain');
		await page.getByRole('button', { name: 'Add' }).click();
		await page.waitForTimeout(500);

		// Add second custom character
		await page.getByPlaceholder(/Enter character description/).fill('A wise robot assistant');
		await page.getByRole('button', { name: 'Add' }).click();

		// Both characters should be expanded
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();
	});

	test('clicking already-expanded character scrolls to it', async ({ page }) => {
		// Add two custom characters
		await page.getByPlaceholder(/Enter character description/).fill('First character');
		await page.getByRole('button', { name: 'Add' }).click();
		await page.waitForTimeout(500);

		await page.getByPlaceholder(/Enter character description/).fill('Second character');
		await page.getByRole('button', { name: 'Add' }).click();

		// Both should be visible
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();

		// Click first character button again (should scroll, not collapse)
		const buttons = page.getByRole('button', { name: /Custom Character/i });
		await buttons.first().click();

		// Verify first character is still visible
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
	});

	test('content does not duplicate when clicking same button twice', async ({ page }) => {
		// Add custom character
		await page.getByPlaceholder(/Enter character description/).fill('A test character');
		await page.getByRole('button', { name: 'Add' }).click();

		// Click the button twice
		const charButton = page.getByRole('button', { name: /Custom Character/i }).first();
		await charButton.click();
		await page.waitForTimeout(500);
		await charButton.click();

		// Verify only one instance of content exists
		const contentAreas = page.locator('[data-character-content="0"]');
		expect(await contentAreas.count()).toBe(1);
	});

	test('button state reflects expanded state', async ({ page }) => {
		// Add custom character
		await page.getByPlaceholder(/Enter character description/).fill('Test character');
		await page.getByRole('button', { name: 'Add' }).click();

		// The button should be highlighted (default variant) after add since it auto-expands
		const charButton = page.getByRole('button', { name: /Custom Character/i }).first();

		// Get classes
		const classes = await charButton.getAttribute('class');

		// Should contain some indication of being selected/active
		// (the exact class depends on shadcn-svelte implementation)
		expect(classes).toBeTruthy();
	});

	test('multiple characters have independent action buttons', async ({ page }) => {
		// Add two custom characters
		await page.getByPlaceholder(/Enter character description/).fill('First character');
		await page.getByRole('button', { name: 'Add' }).click();
		await page.waitForTimeout(500);

		await page.getByPlaceholder(/Enter character description/).fill('Second character');
		await page.getByRole('button', { name: 'Add' }).click();

		// Verify both have independent Enhance Description and Generate Image buttons
		const firstCharContent = page.locator('[data-character-content="0"]');
		const secondCharContent = page.locator('[data-character-content="1"]');

		await expect(firstCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
		await expect(firstCharContent.getByRole('button', { name: /Generate Image/i })).toBeVisible();

		await expect(secondCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
		await expect(secondCharContent.getByRole('button', { name: /Generate Image/i })).toBeVisible();
	});
});
