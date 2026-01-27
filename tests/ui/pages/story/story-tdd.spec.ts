/**
 * Stage 2: Story - E2E Tests
 * Based on STATE-WORKFLOW-SPEC.md Story section
 *
 * Tests cover:
 * - Story section UI layout
 * - Story generation form (prompt, duration, style)
 * - Story generation states
 * - Generated story display
 * - Edit modes (manual and with prompt)
 * - Smart expand behavior
 * - Story history and branching
 */

import { test, expect, setupApiMocks, setupProjectInLocalStorage, createStory } from '../../shared/fixtures';
import { clearAllData, navigateAndWait } from '../../shared/test-helpers';

test.describe('Stage 2: Story @story', () => {
	test.beforeEach(async ({ page }) => {
		await clearAllData(page);
		await setupApiMocks(page);
	});

	// ===========================================================================
	// STORY SECTION UI LAYOUT
	// ===========================================================================

	test.describe('Story Section UI', () => {
		test('displays STORY header and subtitle', async ({ page }) => {
			await navigateAndWait(page, '/');

			await expect(page.getByRole('heading', { name: 'STORY' })).toBeVisible();
			await expect(page.getByText('Create your story text')).toBeVisible();
		});

		test('/story route shows story section', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await expect(page.getByRole('heading', { name: 'STORY' })).toBeVisible();
		});
	});

	// ===========================================================================
	// STORY GENERATION FORM (EMPTY STATE)
	// ===========================================================================

	test.describe('Story Generation Form', () => {
		test('shows prompt input field', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const promptInput = page.getByRole('textbox', { name: /prompt|story idea|concept/i });
			await expect(promptInput).toBeVisible();
		});

		test('shows duration selector', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const durationSelect = page.getByRole('combobox', { name: /duration|length/i });
			await expect(durationSelect).toBeVisible();
		});

		test('duration options are in 5-second increments', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const durationSelect = page.getByRole('combobox', { name: /duration|length/i });
			await durationSelect.click();

			// Check for 5-second increment options
			await expect(page.getByRole('option', { name: /5s|5 seconds/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /10s|10 seconds/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /15s|15 seconds/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /20s|20 seconds/i })).toBeVisible();
		});

		test('shows style selector with presets', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const styleSelect = page.getByRole('combobox', { name: /style/i });
			await expect(styleSelect).toBeVisible();
		});

		test('style selector includes all preset options per spec', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const styleSelect = page.getByRole('combobox', { name: /style/i });
			await styleSelect.click();

			// Check all presets from spec
			await expect(page.getByRole('option', { name: /anime/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /photorealistic/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /3d.animated|3d animated|pixar/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /watercolor/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /comic/i })).toBeVisible();
			await expect(page.getByRole('option', { name: /custom/i })).toBeVisible();
		});

		test('selecting custom style shows custom prompt input', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const styleSelect = page.getByRole('combobox', { name: /style/i });
			await styleSelect.selectOption({ label: /custom/i });

			const customPromptInput = page.getByRole('textbox', { name: /custom.*(prompt|style)/i });
			await expect(customPromptInput).toBeVisible();
		});

		test('shows generate button', async ({ page }) => {
			await navigateAndWait(page, '/story');

			const generateButton = page.getByRole('button', { name: /generate/i });
			await expect(generateButton).toBeVisible();
		});
	});

	// ===========================================================================
	// STORY GENERATION (STATE TRANSITIONS)
	// ===========================================================================

	test.describe('Story Generation', () => {
		test('EMPTY -> GENERATING: shows spinner during generation', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Fill form
			await page.getByRole('textbox', { name: /prompt/i }).fill('A detective story');
			await page.getByRole('combobox', { name: /duration/i }).selectOption('15');

			// Mock slow response
			await page.route('**/api/story/generate', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				await route.fulfill({ status: 200, body: JSON.stringify({ story: {} }) });
			});

			// Click generate
			await page.getByRole('button', { name: /generate/i }).click();

			// Should show loading state
			await expect(page.getByRole('progressbar')).toBeVisible();
		});

		test('GENERATING -> GENERATED: shows story after completion', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('textbox', { name: /prompt/i }).fill('A space adventure');
			await page.getByRole('combobox', { name: /duration/i }).selectOption('15');
			await page.getByRole('button', { name: /generate/i }).click();

			// Wait for generation
			await page.waitForResponse('**/api/story/generate');

			// Should show generated story
			await expect(page.getByText('Generated Story')).toBeVisible();
		});

		test('GENERATING -> ERROR: shows error message on failure', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Mock error response
			await page.route('**/api/story/generate', async (route) => {
				await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Generation failed' }) });
			});

			await page.getByRole('textbox', { name: /prompt/i }).fill('A story');
			await page.getByRole('button', { name: /generate/i }).click();

			// Should show error
			await expect(page.getByText(/error|failed/i)).toBeVisible();
		});

		test('ERROR -> GENERATING: retry button works', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// First, cause an error
			let callCount = 0;
			await page.route('**/api/story/generate', async (route) => {
				callCount++;
				if (callCount === 1) {
					await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Failed' }) });
				} else {
					await route.fulfill({ status: 200, body: JSON.stringify({ story: { title: 'Success' } }) });
				}
			});

			await page.getByRole('textbox', { name: /prompt/i }).fill('A story');
			await page.getByRole('button', { name: /generate/i }).click();

			// Wait for error
			await expect(page.getByText(/error|failed/i)).toBeVisible();

			// Click retry
			await page.getByRole('button', { name: /retry/i }).click();

			// Should succeed
			await expect(page.getByText('Success')).toBeVisible();
		});
	});

	// ===========================================================================
	// GENERATED STORY DISPLAY
	// ===========================================================================

	test.describe('Generated Story Display', () => {
		test.beforeEach(async ({ page }) => {
			// Setup project with existing story
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);
		});

		test('shows story title', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await expect(page.getByRole('heading', { name: 'Test Story' })).toBeVisible();
		});

		test('shows story narrative', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await expect(page.getByText('Once upon a time...')).toBeVisible();
		});

		test('shows scenes with badges', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Scene badge format: [Scene x] [ys] then [title]
			await expect(page.getByText(/Scene 1/)).toBeVisible();
			await expect(page.getByText(/5s/)).toBeVisible();
			await expect(page.getByText('Opening Scene')).toBeVisible();
		});

		test('shows scene count matching targetDuration / 5', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// 15s duration = 3 scenes
			await expect(page.getByText(/Scene 1/)).toBeVisible();
			await expect(page.getByText(/Scene 2/)).toBeVisible();
			await expect(page.getByText(/Scene 3/)).toBeVisible();
		});

		test('shows action buttons at GENERATED state', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Per spec: Regenerate, Edit Manually, Edit with Prompt, Smart Expand
			await expect(page.getByRole('button', { name: /regenerate/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /edit.*manually|manual.*edit/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /edit.*prompt|prompt.*edit/i })).toBeVisible();
			await expect(page.getByRole('button', { name: /smart.*expand|expand/i })).toBeVisible();
		});
	});

	// ===========================================================================
	// EDIT MODES
	// ===========================================================================

	test.describe('Edit Story Manually', () => {
		test.beforeEach(async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);
		});

		test('clicking Edit Manually enters EDITING state', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('button', { name: /edit.*manually|manual.*edit/i }).click();

			// Should show editable fields
			await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();
			await expect(page.getByRole('textbox', { name: /narrative/i })).toBeVisible();
		});

		test('scene cards show editable fields in EDITING mode', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('button', { name: /edit.*manually|manual.*edit/i }).click();

			// Scene cards should have editable fields per spec
			await expect(page.getByRole('textbox', { name: /scene.*title|title.*scene/i }).first()).toBeVisible();
			await expect(page.getByRole('textbox', { name: /description/i }).first()).toBeVisible();
		});

		test('Save button saves changes and returns to GENERATED', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('button', { name: /edit.*manually/i }).click();

			// Edit title
			await page.getByRole('textbox', { name: /title/i }).fill('Edited Title');

			// Save
			await page.getByRole('button', { name: /save/i }).click();

			// Should show edited title and exit edit mode
			await expect(page.getByRole('heading', { name: 'Edited Title' })).toBeVisible();
			await expect(page.getByRole('textbox', { name: /title/i })).not.toBeVisible();
		});

		test('Cancel button discards changes and returns to GENERATED', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('button', { name: /edit.*manually/i }).click();

			// Edit title
			await page.getByRole('textbox', { name: /title/i }).fill('Cancelled Edit');

			// Cancel
			await page.getByRole('button', { name: /cancel/i }).click();

			// Should show original title
			await expect(page.getByRole('heading', { name: 'Test Story' })).toBeVisible();
		});
	});

	test.describe('Edit Story with Prompt', () => {
		test.beforeEach(async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);
		});

		test('shows prompt input for editing', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.getByRole('button', { name: /edit.*prompt/i }).click();

			await expect(page.getByRole('textbox', { name: /edit.*instruction|instruction/i })).toBeVisible();
		});

		test('submitting edit prompt triggers EDITING_WITH_PROMPT state', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Mock edit response
			await page.route('**/api/story/edit', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 500));
				await route.fulfill({ status: 200, body: JSON.stringify({ story: createStory() }) });
			});

			await page.getByRole('button', { name: /edit.*prompt/i }).click();
			await page.getByRole('textbox', { name: /instruction/i }).fill('Add more drama');
			await page.getByRole('button', { name: /submit|apply/i }).click();

			// Should show loading
			await expect(page.getByRole('progressbar')).toBeVisible();
		});
	});

	// ===========================================================================
	// SMART EXPAND
	// ===========================================================================

	test.describe('Smart Expand', () => {
		test.beforeEach(async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);
		});

		test('Smart Expand button triggers expansion', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Mock expand endpoint
			await page.route('**/api/story/expand', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						story: {
							...createStory(),
							narrative: 'Expanded narrative with more detail...',
							isSmartExpanded: true
						}
					})
				});
			});

			await page.getByRole('button', { name: /smart.*expand|expand/i }).click();

			// Should show expanded content
			await expect(page.getByText('Expanded narrative with more detail...')).toBeVisible();
		});

		test('After expansion, isSmartExpanded is true', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.route('**/api/story/expand', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						story: {
							...createStory(),
							isSmartExpanded: true,
							preExpansionNarrative: 'Original'
						}
					})
				});
			});

			await page.getByRole('button', { name: /expand/i }).click();

			// Verify state via localStorage
			const projectData = await page.evaluate(() => {
				return JSON.parse(localStorage.getItem('sidvid-current-project') || '{}');
			});

			expect(projectData.currentStory?.isSmartExpanded).toBe(true);
		});
	});

	// ===========================================================================
	// STORY HISTORY
	// ===========================================================================

	test.describe('Story History', () => {
		test('shows story history versions', async ({ page }) => {
			// Setup project with history
			const story1 = createStory({ id: 'story-1', title: 'Version 1' });
			const story2 = createStory({ id: 'story-2', title: 'Version 2' });

			await page.evaluate(
				([s1, s2]) => {
					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							currentStory: s2,
							storyHistory: [s1, s2],
							storyHistoryIndex: 1
						})
					);
				},
				[story1, story2]
			);

			await navigateAndWait(page, '/story');

			// History section should show versions
			await expect(page.getByText('Version 1')).toBeVisible();
			await expect(page.getByText('Version 2')).toBeVisible();
		});

		test('clicking history version shows branch option', async ({ page }) => {
			const story1 = createStory({ id: 'story-1', title: 'Version 1' });
			const story2 = createStory({ id: 'story-2', title: 'Version 2' });

			await page.evaluate(
				([s1, s2]) => {
					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							currentStory: s2,
							storyHistory: [s1, s2],
							storyHistoryIndex: 1
						})
					);
				},
				[story1, story2]
			);

			await navigateAndWait(page, '/story');

			// Click on Version 1
			await page.getByText('Version 1').click();

			// Should show branch option
			await expect(page.getByRole('button', { name: /branch|continue from/i })).toBeVisible();
		});

		test('branching from history discards subsequent versions', async ({ page }) => {
			const story1 = createStory({ id: 'story-1', title: 'Version 1' });
			const story2 = createStory({ id: 'story-2', title: 'Version 2' });
			const story3 = createStory({ id: 'story-3', title: 'Version 3' });

			await page.evaluate(
				([s1, s2, s3]) => {
					localStorage.setItem(
						'sidvid-current-project',
						JSON.stringify({
							id: 'test-proj',
							name: 'Test',
							currentStory: s3,
							storyHistory: [s1, s2, s3],
							storyHistoryIndex: 2
						})
					);
				},
				[story1, story2, story3]
			);

			await navigateAndWait(page, '/story');

			// Branch from Version 1
			await page.getByText('Version 1').click();
			await page.getByRole('button', { name: /branch/i }).click();

			// Version 2 and 3 should be gone
			await expect(page.getByText('Version 2')).not.toBeVisible();
			await expect(page.getByText('Version 3')).not.toBeVisible();

			// Current should be Version 1
			await expect(page.getByRole('heading', { name: 'Version 1' })).toBeVisible();
		});
	});

	// ===========================================================================
	// REGENERATE
	// ===========================================================================

	test.describe('Regenerate Story', () => {
		test.beforeEach(async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);
		});

		test('Regenerate button generates new variation', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// Mock regenerate response with different story
			await page.route('**/api/story/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						story: createStory({ title: 'Regenerated Story' })
					})
				});
			});

			await page.getByRole('button', { name: /regenerate/i }).click();

			await expect(page.getByRole('heading', { name: 'Regenerated Story' })).toBeVisible();
		});

		test('Regeneration adds to history', async ({ page }) => {
			await navigateAndWait(page, '/story');

			await page.route('**/api/story/generate', async (route) => {
				await route.fulfill({
					status: 200,
					body: JSON.stringify({
						story: createStory({ id: 'new-story', title: 'New Version' })
					})
				});
			});

			await page.getByRole('button', { name: /regenerate/i }).click();

			// Should have both versions in history
			await expect(page.getByText('Test Story')).toBeVisible();
			await expect(page.getByText('New Version')).toBeVisible();
		});
	});

	// ===========================================================================
	// STATE TRANSITIONS
	// ===========================================================================

	test.describe('State Transitions', () => {
		test('EMPTY -> GENERATING -> GENERATED (full flow)', async ({ page }) => {
			await navigateAndWait(page, '/story');

			// EMPTY: form visible
			await expect(page.getByRole('textbox', { name: /prompt/i })).toBeVisible();

			// Fill and submit
			await page.getByRole('textbox', { name: /prompt/i }).fill('Test story');
			await page.getByRole('button', { name: /generate/i }).click();

			// GENERATING: spinner
			await expect(page.getByRole('progressbar')).toBeVisible();

			// GENERATED: story visible
			await expect(page.getByText('Generated Story')).toBeVisible();
		});

		test('GENERATED -> EDITING -> GENERATED (edit flow)', async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);

			await navigateAndWait(page, '/story');

			// GENERATED: story visible
			await expect(page.getByRole('heading', { name: 'Test Story' })).toBeVisible();

			// -> EDITING
			await page.getByRole('button', { name: /edit.*manually/i }).click();
			await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();

			// -> GENERATED
			await page.getByRole('button', { name: /save/i }).click();
			await expect(page.getByRole('textbox', { name: /title/i })).not.toBeVisible();
		});

		test('GENERATED -> GENERATING -> GENERATED (regenerate flow)', async ({ page }) => {
			const story = createStory();
			await page.evaluate((storyData) => {
				localStorage.setItem(
					'sidvid-current-project',
					JSON.stringify({
						id: 'test-proj',
						name: 'Test',
						currentStory: storyData,
						storyHistory: [storyData],
						storyHistoryIndex: 0
					})
				);
			}, story);

			await navigateAndWait(page, '/story');

			// Mock slow response for visibility
			await page.route('**/api/story/generate', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 300));
				await route.fulfill({
					status: 200,
					body: JSON.stringify({ story: createStory({ title: 'Regenerated' }) })
				});
			});

			await page.getByRole('button', { name: /regenerate/i }).click();

			// GENERATING
			await expect(page.getByRole('progressbar')).toBeVisible();

			// GENERATED
			await expect(page.getByRole('heading', { name: 'Regenerated' })).toBeVisible();
		});
	});
});
