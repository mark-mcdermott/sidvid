import { Page, expect } from '@playwright/test';

/**
 * Shared test utilities for all E2E tests
 */

/**
 * Wait for network to be idle (no pending requests)
 */
export async function waitForNetworkIdle(page: Page, timeout = 2000) {
	await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Clear all data stores (localStorage, sessionStorage, IndexedDB)
 */
export async function clearAllData(page: Page) {
	await page.evaluate(async () => {
		// Clear localStorage and sessionStorage
		localStorage.clear();
		sessionStorage.clear();

		// Clear IndexedDB databases
		const databases = await indexedDB.databases();
		for (const db of databases) {
			if (db.name) {
				indexedDB.deleteDatabase(db.name);
			}
		}
	});
}

/**
 * Navigate to a route and wait for it to load
 */
export async function navigateAndWait(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState('domcontentloaded');
}

/**
 * Fill a form field and verify it was filled
 */
export async function fillAndVerify(page: Page, selector: string, value: string) {
	await page.fill(selector, value);
	const actualValue = await page.inputValue(selector);
	expect(actualValue).toBe(value);
}

/**
 * Click a button and wait for navigation or form submission
 */
export async function clickAndWaitForResponse(
	page: Page,
	buttonSelector: string,
	urlPattern: string | RegExp
) {
	const responsePromise = page.waitForResponse(urlPattern);
	await page.click(buttonSelector);
	return await responsePromise;
}

/**
 * Check if an element is visible and contains text
 */
export async function expectVisibleWithText(page: Page, selector: string, text: string | RegExp) {
	const element = page.locator(selector);
	await expect(element).toBeVisible();
	await expect(element).toContainText(text);
}

/**
 * Wait for a specific element to appear with timeout
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
	await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Mock API response for testing
 */
export async function mockApiResponse(
	page: Page,
	urlPattern: string | RegExp,
	responseData: any,
	status = 200
) {
	await page.route(urlPattern, async (route) => {
		await route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify(responseData)
		});
	});
}

/**
 * Get the current conversation ID from the store
 */
export async function getCurrentConversationId(page: Page): Promise<string | null> {
	return await page.evaluate(() => {
		const storeData = localStorage.getItem('conversationStore');
		if (storeData) {
			const parsed = JSON.parse(storeData);
			return parsed.currentConversationId;
		}
		return null;
	});
}

/**
 * Set environment variables for testing
 */
export function getTestEnv() {
	return {
		OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
		AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || 'https://test.openai.azure.com'
	};
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
	return !!process.env.CI;
}
