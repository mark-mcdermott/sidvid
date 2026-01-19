import { test, expect } from '@playwright/test';

test.describe('StoryGen @storygen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/story');
  });

  test('generates a story when prompt is filled and user clicks Generate Story', async ({ page }) => {
    // Fill in the prompt
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective solving a mystery');

    // Click Generate Story button
    await page.getByRole('button', { name: 'Generate Story' }).click();

    // Wait for the generating state
    await expect(page.getByText('Generating...')).toBeVisible();

    // Wait for the story to be generated (with longer timeout for API call)
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Check that the story title is displayed
    await expect(page.locator('h2').first()).toBeVisible();

    // Check that at least one scene is displayed
    await expect(page.getByText(/DESCRIPTION:/)).toBeVisible();
  });

  test('generates a longer story when user picks a longer video length', async ({ page }) => {
    // Select a longer video length (10s)
    await page.getByLabel('Video Length').click();
    await page.getByRole('option', { name: '10s' }).click();

    // Fill in the prompt
    await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure');

    // Click Generate Story button
    await page.getByRole('button', { name: 'Generate Story' }).click();

    // Wait for the story to be generated
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Count the number of scenes (longer videos should have more scenes)
    const scenes = await page.getByText(/^Scene \d+$/).count();
    expect(scenes).toBeGreaterThan(3); // Expect more than 3 scenes for longer video

    // Verify the prompt shows the correct length
    await expect(page.getByText('Prompt (10s):')).toBeVisible();
  });

  test('hides length dropdown and initial textarea after response loads', async ({ page }) => {
    // Verify initial elements are visible
    await expect(page.getByLabel('Video Length')).toBeVisible();
    const initialTextarea = page.getByPlaceholder(/Enter your story prompt/);
    await expect(initialTextarea).toBeVisible();

    // Fill in the prompt and submit
    await initialTextarea.fill('A quick story');
    await page.getByRole('button', { name: 'Generate Story' }).click();

    // Wait for the story to be generated
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Verify the initial textarea and dropdown are no longer visible
    await expect(page.getByLabel('Video Length')).not.toBeVisible();
    await expect(initialTextarea).not.toBeVisible();

    // Verify the prompt is displayed above the response
    await expect(page.getByText('Prompt (5s):')).toBeVisible();
    await expect(page.getByText('A quick story')).toBeVisible();
  });

  test('conversation shows in sidebar shortly after response loads', async ({ page }) => {
    const testPrompt = 'Unique test story prompt';

    // Fill in the prompt and submit
    await page.getByPlaceholder(/Enter your story prompt/).fill(testPrompt);
    await page.getByRole('button', { name: 'Generate Story' }).click();

    // Wait for the story to be generated
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Wait a moment for the conversation to be saved and title generated
    await page.waitForTimeout(2000);

    // Check that the conversation appears in the sidebar
    // The title will be the first 5 words of the prompt
    const expectedTitle = testPrompt.split(/\s+/).slice(0, 5).join(' ');

    // Look for the conversation in the sidebar under "Conversations" section
    const sidebarConversation = page.getByRole('link', { name: new RegExp(expectedTitle, 'i') });
    await expect(sidebarConversation).toBeVisible({ timeout: 5000 });
  });

  test('allows user to edit story with prompt', async ({ page }) => {
    // Generate initial story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A robot story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Click Edit Story with Prompt button
    await page.getByRole('button', { name: 'Edit Story with Prompt' }).click();

    // Fill in the edit prompt
    await page.getByPlaceholder(/Add more action/).fill('Add more explosions');

    // Submit the edit
    await page.getByRole('button', { name: 'Regenerate Story' }).click();

    // Wait for the regenerated story
    await expect(page.getByText('Regenerating...')).toBeVisible();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Verify we now have two story cards
    const promptHeaders = await page.getByText(/^Prompt \(/).count();
    expect(promptHeaders).toBe(2);
  });

  test('allows user to try again with same prompt', async ({ page }) => {
    const testPrompt = 'A space adventure';

    // Generate initial story
    await page.getByPlaceholder(/Enter your story prompt/).fill(testPrompt);
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Get the initial story title
    const firstTitle = await page.locator('h2').first().textContent();

    // Click Try Again button
    await page.getByRole('button', { name: 'Try Again' }).click();

    // Verify the prompt is pre-filled
    const tryAgainTextarea = page.getByRole('textbox', { name: /prompt/i }).last();
    await expect(tryAgainTextarea).toHaveValue(testPrompt);

    // Submit try again
    await page.getByRole('button', { name: 'Regenerate Story' }).last().click();

    // Wait for the new story
    await expect(page.getByText('Regenerating...')).toBeVisible();
    await expect(page.getByText(/Scene 1/).nth(1)).toBeVisible({ timeout: 30000 });

    // Verify we have two stories
    const storyTitles = await page.locator('h2').count();
    expect(storyTitles).toBe(2);

    // The new story should have a different title (due to temperature=1.0)
    const secondTitle = await page.locator('h2').nth(1).textContent();
    // Note: Due to randomness, titles might be the same, so we just verify two stories exist
    expect(storyTitles).toBeGreaterThanOrEqual(2);
  });

  test('keyboard shortcuts work - Enter submits, Shift+Enter adds line', async ({ page }) => {
    const textarea = page.getByPlaceholder(/Enter your story prompt/);

    // Type some text
    await textarea.fill('First line');

    // Press Shift+Enter to add a new line
    await textarea.press('Shift+Enter');
    await textarea.type('Second line');

    // Verify the textarea has two lines
    const textareaValue = await textarea.inputValue();
    expect(textareaValue).toContain('\n');
    expect(textareaValue).toBe('First line\nSecond line');

    // Now press Enter without Shift to submit
    await textarea.press('Enter');

    // Verify the form was submitted (generating state appears)
    await expect(page.getByText('Generating...')).toBeVisible();
  });
});
