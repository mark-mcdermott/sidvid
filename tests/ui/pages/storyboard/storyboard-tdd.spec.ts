/**
 * Stage 4: Storyboard - E2E Tests
 * Based on STATE-WORKFLOW-SPEC.md Storyboard section
 *
 * Tests cover:
 * - Storyboard section UI layout
 * - Scene cards display and structure
 * - Scene CRUD operations (add, edit, clone, archive, delete)
 * - Scene reordering (drag and drop)
 * - Scene edit modal
 * - Image generation
 * - Archived scenes section
 */

import { test, expect, setupApiMocks, createScene, createWorldElement } from '../../shared/fixtures';
import { clearAllData, navigateAndWait } from '../../shared/test-helpers';

test.describe('Stage 4: Storyboard @storyboard', () => {
	test.beforeEach(async ({ page }) => {
		await clearAllData(page);
		await setupApiMocks(page);
	});

	// ===========================================================================
	// STORYBOARD SECTION UI LAYOUT
	// ===========================================================================

	test.describe('Storyboard Section UI', () => {
		test('displays STORYBOARD header and subtitle', async ({ page }) => {
			await navigateAndWait(page, '/');

			await expect(page.getByRole('heading', { name: 'STORYBOARD' })).toBeVisible();
			await expect(page.getByText('Create and arrange your scenes')).toBeVisible();
		});

		test('/storyboard route shows storyboard section', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await expect(page.getByRole('heading', { name: 'STORYBOARD' })).toBeVisible();
		});

		test('shows New Scene button (dashed border) when no scenes', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const newSceneButton = page.locator('[data-testid="new-scene-button"]');
			await expect(newSceneButton).toBeVisible();
		});
	});

	// ===========================================================================
	// SCENE CARD DISPLAY
	// ===========================================================================

	test.describe('Scene Card Display', () => {
		test.beforeEach(async ({ page }) => {
			const scene1 = createScene({
				id: 'scene-1',
				title: 'Castle Approach',
				description: 'Alice approaches the ancient castle gates',
				assignedElements: ['char-1', 'loc-1'],
				status: 'completed',
				images: [{ id: 'img-1', imageUrl: 'https://example.com/scene1.png', revisedPrompt: '', isActive: true, createdAt: new Date() }]
			});
			const scene2 = createScene({
				id: 'scene-2',
				title: 'Inside the Castle',
				description: 'The interior is dark and mysterious',
				assignedElements: ['char-1'],
				status: 'empty'
			});

			const character = createWorldElement('character', { id: 'char-1', name: 'Alice' });
			const location = createWorldElement('location', { id: 'loc-1', name: 'Castle' });

			await page.evaluate(
				([s1, s2, char, loc]) => {
					const worldElements: Record<string, any> = {};
					worldElements[char.id] = char;
					worldElements[loc.id] = loc;

					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							scenes: [s1, s2],
							worldElements
						})
					);
				},
				[scene1, scene2, character, location]
			);
		});

		test('displays scene number badge', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await expect(page.getByText('Scene 1')).toBeVisible();
			await expect(page.getByText('Scene 2')).toBeVisible();
		});

		test('displays duration badge', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			// Each scene should show 5s badge
			const durationBadges = page.locator('[data-testid="duration-badge"]');
			await expect(durationBadges.first()).toContainText('5s');
		});

		test('displays scene title badge', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await expect(page.getByText('Castle Approach')).toBeVisible();
			await expect(page.getByText('Inside the Castle')).toBeVisible();
		});

		test('displays scene description (truncated)', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await expect(page.getByText(/Alice approaches/)).toBeVisible();
		});

		test('displays world element pills', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.getByText('Alice')).toBeVisible();
			await expect(sceneCard.getByText('Castle')).toBeVisible();
		});

		test('displays clone icon', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.getByRole('button', { name: /clone/i })).toBeVisible();
		});

		test('displays archive icon', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.getByRole('button', { name: /archive/i })).toBeVisible();
		});

		test('displays delete (X) icon', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.getByRole('button', { name: /delete|remove/i })).toBeVisible();
		});

		test('scene with image shows poster image', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.locator('img')).toBeVisible();
		});

		test('text toggle button toggles text visibility', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			const textToggle = sceneCard.getByRole('button', { name: /text|abc/i });

			// Initially text is visible
			await expect(sceneCard.getByText('Castle Approach')).toBeVisible();

			// Click to hide
			await textToggle.click();
			await expect(sceneCard.getByText('Castle Approach')).not.toBeVisible();

			// Click to show again
			await textToggle.click();
			await expect(sceneCard.getByText('Castle Approach')).toBeVisible();
		});
	});

	// ===========================================================================
	// ADD SCENE
	// ===========================================================================

	test.describe('Add Scene', () => {
		test('clicking + button creates new blank scene', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-testid="new-scene-button"]').click();

			// New scene should appear
			await expect(page.getByText('Scene 1')).toBeVisible();
		});

		test('new scene has solid border', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-testid="new-scene-button"]').click();

			const sceneCard = page.locator('[data-testid="scene-card"]').first();
			// Check for solid border class or style
			await expect(sceneCard).not.toHaveClass(/dashed/);
		});

		test('New Scene button always appears after last scene', async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'First Scene' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			// Scene should appear before New Scene button
			const sceneCards = page.locator('[data-testid="scene-card"], [data-testid="new-scene-button"]');
			const firstElement = sceneCards.first();
			const lastElement = sceneCards.last();

			await expect(firstElement).toHaveAttribute('data-testid', 'scene-card');
			await expect(lastElement).toHaveAttribute('data-testid', 'new-scene-button');
		});
	});

	// ===========================================================================
	// CLONE SCENE
	// ===========================================================================

	test.describe('Clone Scene', () => {
		test.beforeEach(async ({ page }) => {
			const scene = createScene({
				id: 'scene-1',
				title: 'Original Scene',
				description: 'Original description',
				assignedElements: ['char-1']
			});

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);
		});

		test('clicking clone creates duplicate scene', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /clone/i }).click();

			// Should now have 2 scenes
			await expect(page.getByText('Scene 1')).toBeVisible();
			await expect(page.getByText('Scene 2')).toBeVisible();
		});

		test('cloned scene title has (1) suffix', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /clone/i }).click();

			await expect(page.getByText('Original Scene (1)')).toBeVisible();
		});

		test('clone inserted immediately after original', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /clone/i }).click();

			const sceneCards = page.locator('[data-testid="scene-card"]');
			const firstCard = sceneCards.first();
			const secondCard = sceneCards.nth(1);

			await expect(firstCard).toContainText('Original Scene');
			await expect(secondCard).toContainText('Original Scene (1)');
		});
	});

	// ===========================================================================
	// ARCHIVE SCENE
	// ===========================================================================

	test.describe('Archive Scene', () => {
		test.beforeEach(async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'To Archive' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);
		});

		test('clicking archive moves scene to archived section', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /archive/i }).click();

			// Scene should move to archived section
			const archivedSection = page.locator('[data-testid="archived-scenes"]');
			await expect(archivedSection).toBeVisible();
		});

		test('archived scene no longer appears in main storyboard', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /archive/i }).click();

			const mainStoryboard = page.locator('[data-testid="storyboard-main"]');
			await expect(mainStoryboard.locator('[data-scene-id="scene-1"]')).not.toBeVisible();
		});

		test('archived scenes section shows thumbnail', async ({ page }) => {
			const scene = createScene({
				id: 'scene-1',
				title: 'To Archive',
				isArchived: true,
				images: [{ id: 'img-1', imageUrl: 'https://example.com/img.png', revisedPrompt: '', isActive: true, createdAt: new Date() }]
			});

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			const archivedSection = page.locator('[data-testid="archived-scenes"]');
			await expect(archivedSection.locator('img')).toBeVisible();
		});
	});

	// ===========================================================================
	// DELETE SCENE
	// ===========================================================================

	test.describe('Delete Scene', () => {
		test.beforeEach(async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'To Delete' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);
		});

		test('clicking X shows delete confirmation', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /delete|remove/i }).click();

			await expect(page.getByRole('dialog')).toBeVisible();
			await expect(page.getByText(/are you sure/i)).toBeVisible();
		});

		test('confirming delete removes scene', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /delete|remove/i }).click();
			await page.getByRole('button', { name: /delete|confirm/i }).click();

			await expect(page.locator('[data-scene-id="scene-1"]')).not.toBeVisible();
		});

		test('canceling delete keeps scene', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.locator('[data-scene-id="scene-1"]').getByRole('button', { name: /delete|remove/i }).click();
			await page.getByRole('button', { name: /cancel/i }).click();

			await expect(page.locator('[data-scene-id="scene-1"]')).toBeVisible();
		});
	});

	// ===========================================================================
	// SCENE EDIT MODAL
	// ===========================================================================

	test.describe('Scene Edit Modal', () => {
		test.beforeEach(async ({ page }) => {
			const scene = createScene({
				id: 'scene-1',
				title: 'Test Scene',
				description: 'Test description',
				dialog: 'Some dialog',
				action: 'Some action',
				assignedElements: ['char-1']
			});
			const character = createWorldElement('character', { id: 'char-1', name: 'Hero' });

			await page.evaluate(
				([s, c]) => {
					const worldElements: Record<string, any> = {};
					worldElements[c.id] = c;

					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s], worldElements })
					);
				},
				[scene, character]
			);
		});

		test('clicking scene card opens edit modal', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			// Click on scene card body (not icons)
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			await expect(page.getByRole('dialog')).toBeVisible();
		});

		test('modal shows scene number and duration badges', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			await expect(page.getByText('Scene 1')).toBeVisible();
			await expect(page.getByText('5s')).toBeVisible();
		});

		test('modal has editable Title field', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			const titleInput = page.getByRole('textbox', { name: /title/i });
			await expect(titleInput).toBeVisible();
			await expect(titleInput).toHaveValue('Test Scene');
		});

		test('modal has editable Description field', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			const descInput = page.getByRole('textbox', { name: /description/i });
			await expect(descInput).toBeVisible();
			await expect(descInput).toHaveValue('Test description');
		});

		test('modal has editable Dialog field', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			const dialogInput = page.getByRole('textbox', { name: /dialog/i });
			await expect(dialogInput).toBeVisible();
		});

		test('modal has editable Action field', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			const actionInput = page.getByRole('textbox', { name: /action/i });
			await expect(actionInput).toBeVisible();
		});

		test('modal shows assigned world elements', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			await expect(page.getByText('Characters')).toBeVisible();
			await expect(page.getByText('Hero')).toBeVisible();
		});

		test('Save Changes button saves edits', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			await page.getByRole('textbox', { name: /title/i }).fill('Updated Title');
			await page.getByRole('button', { name: /save/i }).click();

			await expect(page.getByRole('dialog')).not.toBeVisible();
			await expect(page.getByText('Updated Title')).toBeVisible();
		});

		test('Cancel button discards changes', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');
			await page.locator('[data-scene-id="scene-1"]').locator('[data-testid="scene-card-body"]').click();

			await page.getByRole('textbox', { name: /title/i }).fill('Cancelled Title');
			await page.getByRole('button', { name: /cancel/i }).click();

			await expect(page.getByRole('dialog')).not.toBeVisible();
			await expect(page.getByText('Test Scene')).toBeVisible();
		});
	});

	// ===========================================================================
	// SCENE NUMBERING
	// ===========================================================================

	test.describe('Scene Numbering', () => {
		test('scenes are numbered sequentially from 1', async ({ page }) => {
			const scenes = [
				createScene({ id: 'scene-1', title: 'First' }),
				createScene({ id: 'scene-2', title: 'Second' }),
				createScene({ id: 'scene-3', title: 'Third' })
			];

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: s })
				);
			}, scenes);

			await navigateAndWait(page, '/storyboard');

			await expect(page.getByText('Scene 1')).toBeVisible();
			await expect(page.getByText('Scene 2')).toBeVisible();
			await expect(page.getByText('Scene 3')).toBeVisible();
		});

		test('deleting scene renumbers remaining scenes', async ({ page }) => {
			const scenes = [
				createScene({ id: 'scene-1', title: 'First' }),
				createScene({ id: 'scene-2', title: 'Second' }),
				createScene({ id: 'scene-3', title: 'Third' })
			];

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: s })
				);
			}, scenes);

			await navigateAndWait(page, '/storyboard');

			// Delete scene 2
			await page.locator('[data-scene-id="scene-2"]').getByRole('button', { name: /delete/i }).click();
			await page.getByRole('button', { name: /delete|confirm/i }).click();

			// "Third" should now be Scene 2
			const thirdSceneCard = page.locator('[data-scene-id="scene-3"]');
			await expect(thirdSceneCard).toContainText('Scene 2');
		});

		test('archived scenes do not count toward numbering', async ({ page }) => {
			const scenes = [
				createScene({ id: 'scene-1', title: 'Active First' }),
				createScene({ id: 'scene-2', title: 'Archived', isArchived: true }),
				createScene({ id: 'scene-3', title: 'Active Second' })
			];

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: s })
				);
			}, scenes);

			await navigateAndWait(page, '/storyboard');

			// Active scenes should be 1 and 2
			const mainStoryboard = page.locator('[data-testid="storyboard-main"]');
			await expect(mainStoryboard.getByText('Scene 1')).toBeVisible();
			await expect(mainStoryboard.getByText('Scene 2')).toBeVisible();
			// Scene 3 number should not exist in main area
			await expect(mainStoryboard.getByText('Scene 3')).not.toBeVisible();
		});
	});

	// ===========================================================================
	// IMAGE GENERATION
	// ===========================================================================

	test.describe('Scene Image Generation', () => {
		test.beforeEach(async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'Test Scene', status: 'empty' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);
		});

		test('scene has Generate Image button when no image', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await expect(sceneCard.getByRole('button', { name: /generate/i })).toBeVisible();
		});

		test('clicking generate shows loading state', async ({ page }) => {
			await navigateAndWait(page, '/storyboard');

			await page.route('**/api/images/generate', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 500));
				await route.fulfill({ status: 200, body: JSON.stringify({ imageUrl: 'url' }) });
			});

			const sceneCard = page.locator('[data-scene-id="scene-1"]');
			await sceneCard.getByRole('button', { name: /generate/i }).click();

			await expect(sceneCard.getByRole('progressbar')).toBeVisible();
		});
	});

	// ===========================================================================
	// ARCHIVED SCENES SECTION
	// ===========================================================================

	test.describe('Archived Scenes Section', () => {
		test('shows "You have no archived scenes" when empty', async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'Active' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			await expect(page.getByText(/no archived scenes/i)).toBeVisible();
		});

		test('shows archived scene thumbnails', async ({ page }) => {
			const scene = createScene({
				id: 'scene-1',
				title: 'Archived Scene',
				isArchived: true,
				images: [{ id: 'img-1', imageUrl: 'https://example.com/img.png', revisedPrompt: '', isActive: true, createdAt: new Date() }]
			});

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			const archivedSection = page.locator('[data-testid="archived-scenes"]');
			await expect(archivedSection.locator('[data-archived-thumbnail]')).toBeVisible();
		});

		test('clicking archived thumbnail opens edit modal', async ({ page }) => {
			const scene = createScene({
				id: 'scene-1',
				title: 'Archived Scene',
				isArchived: true
			});

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			const archivedSection = page.locator('[data-testid="archived-scenes"]');
			await archivedSection.locator('[data-archived-thumbnail]').click();

			await expect(page.getByRole('dialog')).toBeVisible();
		});
	});

	// ===========================================================================
	// GENERATE VIDEO BUTTON
	// ===========================================================================

	test.describe('Generate Video Button', () => {
		test('shows Generate Video button when scenes exist', async ({ page }) => {
			const scene = createScene({ id: 'scene-1', title: 'Scene', status: 'completed' });

			await page.evaluate((s) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({ id: 'test-proj', name: 'Test', scenes: [s] })
				);
			}, scene);

			await navigateAndWait(page, '/storyboard');

			await expect(page.getByRole('button', { name: /generate.*video/i })).toBeVisible();
		});
	});
});
