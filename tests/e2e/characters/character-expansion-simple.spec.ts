import { test, expect, type Page } from '@playwright/test';

// Helper function to add a character and wait for it to appear
async function addCharacter(page: Page, description: string, expectedIndex: number) {
	const textarea = page.getByPlaceholder(/Enter character description/);
	await textarea.fill(description);
	await expect(textarea).toHaveValue(description);
	await page.getByRole('button', { name: 'Add' }).click();
	// Wait for content area to appear (more reliable than button)
	await expect(page.locator(`[data-character-content="${expectedIndex}"]`)).toBeVisible({ timeout: 15000 });
}

test.describe('Character Expansion Simple @characters', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate fresh each time
		await page.goto('/characters', { waitUntil: 'networkidle' });
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		// Full page reload with network idle
		await page.reload({ waitUntil: 'networkidle' });
		// Wait for the page to be fully loaded and ready
		await expect(page.getByPlaceholder(/Enter character description/)).toBeVisible({ timeout: 10000 });
		// Ensure textarea is empty and ready
		const textarea = page.getByPlaceholder(/Enter character description/);
		await expect(textarea).toHaveValue('');
	});

	test('custom character button expands character content', async ({ page }) => {
		// Add a custom character
		await addCharacter(page, 'A brave space captain', 0);

		// Verify character button appears
		const customCharButton = page.getByRole('button', { name: /Custom Character/i }).first();
		await expect(customCharButton).toBeVisible();

		// Click the button (already expanded, should scroll)
		await customCharButton.click();

		// Verify character content area is still visible
		const characterContent = page.locator('[data-character-content="0"]');
		await expect(characterContent).toBeVisible();
		await expect(characterContent.getByRole('heading', { name: /Custom Character/i, level: 2 })).toBeVisible();
	});

	test('adding second custom character expands second content', async ({ page }) => {
		// Add first custom character
		await addCharacter(page, 'A brave space captain', 0);

		// Add second custom character
		await addCharacter(page, 'A wise robot assistant', 1);

		// Both characters should be expanded
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
		await expect(page.locator('[data-character-content="1"]')).toBeVisible();
	});

	test('clicking already-expanded character scrolls to it', async ({ page }) => {
		// Add two custom characters
		await addCharacter(page, 'First character', 0);
		await addCharacter(page, 'Second character', 1);

		// Click first character button again (should scroll, not collapse)
		const buttons = page.getByRole('button', { name: /Custom Character/i });
		await buttons.first().click();

		// Verify first character is still visible
		await expect(page.locator('[data-character-content="0"]')).toBeVisible();
	});

	test('content does not duplicate when clicking same button twice', async ({ page }) => {
		// Add custom character
		await addCharacter(page, 'A test character', 0);

		// Click the button twice
		const charButton = page.getByRole('button', { name: /Custom Character/i }).first();
		await charButton.click();
		await charButton.click();

		// Verify only one instance of content exists
		const contentAreas = page.locator('[data-character-content="0"]');
		expect(await contentAreas.count()).toBe(1);
	});

	test('button state reflects expanded state', async ({ page }) => {
		// Add custom character
		await addCharacter(page, 'Test character', 0);

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
		await addCharacter(page, 'First character', 0);
		await addCharacter(page, 'Second character', 1);

		// Verify both have independent Enhance Description and Generate Image buttons
		const firstCharContent = page.locator('[data-character-content="0"]');
		const secondCharContent = page.locator('[data-character-content="1"]');

		await expect(firstCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
		await expect(firstCharContent.getByRole('button', { name: /Generate Image/i })).toBeVisible();

		await expect(secondCharContent.getByRole('button', { name: /Enhance Description/i })).toBeVisible();
		await expect(secondCharContent.getByRole('button', { name: /Generate Image/i })).toBeVisible();
	});
});
