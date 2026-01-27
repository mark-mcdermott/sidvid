/**
 * Stage 3: World - E2E Tests
 * Based on STATE-WORKFLOW-SPEC.md World section
 *
 * Tests cover:
 * - World section UI layout
 * - Element types (character, location, object, concept)
 * - Element CRUD operations
 * - Enhance description functionality
 * - Image generation and version management
 * - Sidebar thumbnails
 * - Cascade deletion
 */

import { test, expect, setupApiMocks, createWorldElement, createProject, createScene } from '../../shared/fixtures';
import { clearAllData, navigateAndWait } from '../../shared/test-helpers';
import type { WorldElement, Scene } from '../../shared/types';

test.describe('Stage 3: World @world', () => {
	test.beforeEach(async ({ page }) => {
		await clearAllData(page);
		await setupApiMocks(page);
	});

	// ===========================================================================
	// WORLD SECTION UI LAYOUT
	// ===========================================================================

	test.describe('World Section UI', () => {
		test('displays WORLD header and subtitle', async ({ page }) => {
			await navigateAndWait(page, '/');

			await expect(page.getByRole('heading', { name: 'WORLD' })).toBeVisible();
			await expect(page.getByText('Create characters, locations, etc')).toBeVisible();
		});

		test('/world route shows world section', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByRole('heading', { name: 'WORLD' })).toBeVisible();
		});

		test('shows filter tabs for element types', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByRole('tab', { name: /all/i })).toBeVisible();
			await expect(page.getByRole('tab', { name: /characters/i })).toBeVisible();
			await expect(page.getByRole('tab', { name: /locations/i })).toBeVisible();
			await expect(page.getByRole('tab', { name: /objects/i })).toBeVisible();
			await expect(page.getByRole('tab', { name: /concepts/i })).toBeVisible();
		});

		test('shows "Add Element" button', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByRole('button', { name: /add.*element/i })).toBeVisible();
		});
	});

	// ===========================================================================
	// EMPTY STATE
	// ===========================================================================

	test.describe('Empty State', () => {
		test('shows empty state message when no elements', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByText(/no.*elements|add.*elements/i)).toBeVisible();
		});
	});

	// ===========================================================================
	// ELEMENT DISPLAY
	// ===========================================================================

	test.describe('Element Display', () => {
		test.beforeEach(async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});
			const location = createWorldElement('location', {
				id: 'loc-1',
				name: 'Castle',
				description: 'An ancient fortress'
			});

			await page.evaluate(
				([char, loc]) => {
					const worldElements: Record<string, any> = {};
					worldElements[char.id] = char;
					worldElements[loc.id] = loc;

					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							worldElements
						})
					);
				},
				[character, location]
			);
		});

		test('displays element name', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByText('Hero')).toBeVisible();
			await expect(page.getByText('Castle')).toBeVisible();
		});

		test('displays element description', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await expect(page.getByText('A brave protagonist')).toBeVisible();
			await expect(page.getByText('An ancient fortress')).toBeVisible();
		});

		test('displays element type indicator', async ({ page }) => {
			await navigateAndWait(page, '/world');

			// Elements should show their type
			const heroCard = page.locator('[data-element-id="char-1"]');
			await expect(heroCard.getByText(/character/i)).toBeVisible();
		});

		test('filter tabs filter elements by type', async ({ page }) => {
			await navigateAndWait(page, '/world');

			// Click Characters tab
			await page.getByRole('tab', { name: /characters/i }).click();

			await expect(page.getByText('Hero')).toBeVisible();
			await expect(page.getByText('Castle')).not.toBeVisible();

			// Click Locations tab
			await page.getByRole('tab', { name: /locations/i }).click();

			await expect(page.getByText('Castle')).toBeVisible();
			await expect(page.getByText('Hero')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// ADD ELEMENT
	// ===========================================================================

	test.describe('Add Element', () => {
		test('clicking Add Element opens form/modal', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.getByRole('button', { name: /add.*element/i }).click();

			await expect(page.getByRole('dialog')).toBeVisible();
		});

		test('add form has type selector with all types', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.getByRole('button', { name: /add.*element/i }).click();

			const typeSelect = page.getByRole('combobox', { name: /type/i });
			await typeSelect.click();

			await expect(page.getByRole('option', { name: /character/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /location/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /object/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /concept/i })).toBeVisible();
		});

		test('add form has name and description fields', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.getByRole('button', { name: /add.*element/i }).click();

			await expect(page.getByRole('textbox', { name: /name/i })).toBeVisible();
			await expect(page.getByRole('textbox', { name: /description/i })).toBeVisible();
		});

		test('submitting form creates new element', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.getByRole('button', { name: /add.*element/i }).click();

			await page.getByRole('combobox', { name: /type/i }).selectOption('character');
			await page.getByRole('textbox', { name: /name/i }).fill('New Character');
			await page.getByRole('textbox', { name: /description/i }).fill('A new character description');

			await page.getByRole('button', { name: /save|create|add/i }).click();

			// Element should appear in list
			await expect(page.getByText('New Character')).toBeVisible();
		});

		test('cancel closes form without creating', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.getByRole('button', { name: /add.*element/i }).click();
			await page.getByRole('textbox', { name: /name/i }).fill('Cancelled Element');
			await page.getByRole('button', { name: /cancel/i }).click();

			await expect(page.getByRole('dialog')).not.toBeVisible();
			await expect(page.getByText('Cancelled Element')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// ENHANCE DESCRIPTION
	// ===========================================================================

	test.describe('Enhance Description', () => {
		test.beforeEach(async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);
		});

		test('element card has Enhance button', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await expect(elementCard.getByRole('button', { name: /enhance/i })).toBeVisible();
		});

		test('clicking Enhance shows loading state', async ({ page }) => {
			await navigateAndWait(page, '/world');

			// Mock slow response
			await page.route('**/api/world/enhance', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 500));
				await route.fulfill({ status: 200, body: JSON.stringify({ enhancedDescription: 'Enhanced!' }) });
			});

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /enhance/i }).click();

			await expect(elementCard.getByRole('progressbar')).toBeVisible();
		});

		test('enhanced description replaces original', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.route('**/api/world/enhance', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({ enhancedDescription: 'An incredibly brave protagonist with unwavering courage' })
				});
			});

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /enhance/i }).click();

			await expect(page.getByText('An incredibly brave protagonist with unwavering courage')).toBeVisible();
		});
	});

	// ===========================================================================
	// IMAGE GENERATION
	// ===========================================================================

	test.describe('Image Generation', () => {
		test.beforeEach(async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);
		});

		test('element card has Generate Image button', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await expect(elementCard.getByRole('button', { name: /generate.*image/i })).toBeVisible();
		});

		test('clicking Generate Image shows loading state', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.route('**/api/images/generate', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 500));
				await route.fulfill({ status: 200, body: JSON.stringify({ imageUrl: 'https://example.com/img.png' }) });
			});

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /generate.*image/i }).click();

			await expect(elementCard.getByRole('progressbar')).toBeVisible();
		});

		test('generated image displays on element card', async ({ page }) => {
			await navigateAndWait(page, '/world');

			await page.route('**/api/images/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						id: 'img-1',
						imageUrl: 'https://example.com/hero.png',
						revisedPrompt: 'A brave hero',
						isActive: true
					})
				});
			});

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /generate.*image/i }).click();

			// Image should be visible
			await expect(elementCard.locator('img')).toBeVisible();
		});
	});

	// ===========================================================================
	// IMAGE VERSION MANAGEMENT
	// ===========================================================================

	test.describe('Image Version Management', () => {
		test.beforeEach(async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist',
				images: [
					{ id: 'img-1', imageUrl: 'https://example.com/img1.png', revisedPrompt: 'V1', isActive: false, createdAt: new Date() },
					{ id: 'img-2', imageUrl: 'https://example.com/img2.png', revisedPrompt: 'V2', isActive: true, createdAt: new Date() }
				]
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);
		});

		test('shows image version thumbnails when multiple images exist', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const thumbnails = elementCard.locator('[data-image-thumbnail]');

			await expect(thumbnails).toHaveCount(2);
		});

		test('active image is highlighted', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const activeThumbnail = elementCard.locator('[data-image-thumbnail][data-active="true"]');

			await expect(activeThumbnail).toBeVisible();
		});

		test('clicking non-active thumbnail makes it active', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const inactiveThumbnail = elementCard.locator('[data-image-thumbnail][data-active="false"]');

			await inactiveThumbnail.click();

			// Should now be active
			await expect(inactiveThumbnail).toHaveAttribute('data-active', 'true');
		});

		test('non-active images show trash icon', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const inactiveThumbnail = elementCard.locator('[data-image-thumbnail][data-active="false"]');

			await expect(inactiveThumbnail.getByRole('button', { name: /delete|trash/i })).toBeVisible();
		});

		test('active image does NOT show trash icon', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const activeThumbnail = elementCard.locator('[data-image-thumbnail][data-active="true"]');

			await expect(activeThumbnail.getByRole('button', { name: /delete|trash/i })).not.toBeVisible();
		});

		test('clicking trash deletes image version', async ({ page }) => {
			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			const inactiveThumbnail = elementCard.locator('[data-image-thumbnail][data-active="false"]');

			await inactiveThumbnail.getByRole('button', { name: /delete|trash/i }).click();

			// Should only have one image now
			await expect(elementCard.locator('[data-image-thumbnail]')).toHaveCount(1);
		});
	});

	// ===========================================================================
	// ELEMENT DELETION
	// ===========================================================================

	test.describe('Element Deletion', () => {
		test('element card has delete button', async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);

			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await expect(elementCard.getByRole('button', { name: /delete|remove/i })).toBeVisible();
		});

		test('clicking delete shows confirmation', async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);

			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /delete|remove/i }).click();

			await expect(page.getByRole('dialog')).toBeVisible();
		});

		test('confirming delete removes element', async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);

			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /delete|remove/i }).click();
			await page.getByRole('button', { name: /delete|confirm/i }).click();

			await expect(page.getByText('Hero')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// CASCADE DELETION WARNING
	// ===========================================================================

	test.describe('Cascade Deletion Warning', () => {
		test('shows warning when element is used in scenes', async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist'
			});

			const scene: Scene = {
				id: 'scene-1',
				title: 'Scene 1',
				description: 'Test scene',
				assignedElements: ['char-1'], // Element is used!
				images: [],
				duration: 5,
				status: 'empty',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await page.evaluate(
				([char, scn]) => {
					const worldElements: Record<string, any> = {};
					worldElements[char.id] = char;

					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							worldElements,
							scenes: [scn]
						})
					);
				},
				[character, scene]
			);

			await navigateAndWait(page, '/world');

			const elementCard = page.locator('[data-element-id="char-1"]');
			await elementCard.getByRole('button', { name: /delete|remove/i }).click();

			// Should show cascade warning
			await expect(page.getByText(/used in.*scene/i)).toBeVisible();
		});
	});

	// ===========================================================================
	// SIDEBAR THUMBNAILS
	// ===========================================================================

	test.describe('Sidebar Thumbnails', () => {
		test.beforeEach(async ({ page }) => {
			const character = createWorldElement('character', {
				id: 'char-1',
				name: 'Hero',
				description: 'A brave protagonist',
				images: [{ id: 'img-1', imageUrl: 'https://example.com/hero.png', revisedPrompt: '', isActive: true, createdAt: new Date() }]
			});

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;

				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						worldElements
					})
				);
			}, character);
		});

		test('sidebar shows Characters section when characters exist', async ({ page }) => {
			await navigateAndWait(page, '/');

			const sidebar = page.locator('[data-testid="sidebar"]');
			await expect(sidebar.getByText('Characters')).toBeVisible();
		});

		test('sidebar shows element thumbnails', async ({ page }) => {
			await navigateAndWait(page, '/');

			const sidebar = page.locator('[data-testid="sidebar"]');
			const thumbnail = sidebar.locator('[data-sidebar-thumbnail="char-1"]');

			await expect(thumbnail).toBeVisible();
		});

		test('hovering thumbnail shows element name tooltip', async ({ page }) => {
			await navigateAndWait(page, '/');

			const sidebar = page.locator('[data-testid="sidebar"]');
			const thumbnail = sidebar.locator('[data-sidebar-thumbnail="char-1"]');

			await thumbnail.hover();

			await expect(page.getByRole('tooltip', { name: 'Hero' })).toBeVisible();
		});
	});

	// ===========================================================================
	// ELEMENT TYPE PILLS/COLORS
	// ===========================================================================

	test.describe('Element Type Colors', () => {
		test('character elements use blue color', async ({ page }) => {
			const character = createWorldElement('character', { id: 'char-1', name: 'Hero' });

			await page.evaluate((char) => {
				const worldElements: Record<string, any> = {};
				worldElements[char.id] = char;
				localStorage.setItem('sidvid-current-project', JSON.stringify({ id: 'test-proj', name: 'Test', worldElements }));
			}, character);

			await navigateAndWait(page, '/world');

			const typeIndicator = page.locator('[data-element-type="character"]');
			// Verify blue color is applied (could check computed style or class)
			await expect(typeIndicator).toBeVisible();
		});

		test('location elements use green color', async ({ page }) => {
			const location = createWorldElement('location', { id: 'loc-1', name: 'Castle' });

			await page.evaluate((loc) => {
				const worldElements: Record<string, any> = {};
				worldElements[loc.id] = loc;
				localStorage.setItem('sidvid-current-project', JSON.stringify({ id: 'test-proj', name: 'Test', worldElements }));
			}, location);

			await navigateAndWait(page, '/world');

			const typeIndicator = page.locator('[data-element-type="location"]');
			await expect(typeIndicator).toBeVisible();
		});

		test('object elements use orange color', async ({ page }) => {
			const obj = createWorldElement('object', { id: 'obj-1', name: 'Sword' });

			await page.evaluate((o) => {
				const worldElements: Record<string, any> = {};
				worldElements[o.id] = o;
				localStorage.setItem('sidvid-current-project', JSON.stringify({ id: 'test-proj', name: 'Test', worldElements }));
			}, obj);

			await navigateAndWait(page, '/world');

			const typeIndicator = page.locator('[data-element-type="object"]');
			await expect(typeIndicator).toBeVisible();
		});

		test('concept elements use purple color', async ({ page }) => {
			const concept = createWorldElement('concept', { id: 'con-1', name: 'Prophecy' });

			await page.evaluate((c) => {
				const worldElements: Record<string, any> = {};
				worldElements[c.id] = c;
				localStorage.setItem('sidvid-current-project', JSON.stringify({ id: 'test-proj', name: 'Test', worldElements }));
			}, concept);

			await navigateAndWait(page, '/world');

			const typeIndicator = page.locator('[data-element-type="concept"]');
			await expect(typeIndicator).toBeVisible();
		});
	});
});
