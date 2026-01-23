import { test, expect } from '@playwright/test';

/**
 * Story Generation Tests - Session-Based Architecture
 *
 * These tests verify that the UI properly integrates with the Session-based
 * library architecture, including:
 * - Automatic session creation
 * - Story history tracking
 * - Session persistence
 * - Session listing in sidebar
 */

test.describe('StoryGen - Session Integration @storygen-session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/story');
    await page.evaluate(() => {
      // Clear IndexedDB and localStorage for clean state
      indexedDB.deleteDatabase('sidvid');
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('creates new session automatically on first story generation', async ({ page }) => {
    // Fill in the prompt
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective solving a mystery');

    // Click Generate Story button
    await page.getByRole('button', { name: 'Generate Story' }).click();

    // Wait for the story to be generated
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Verify session was created and appears in sidebar
    const sidebar = page.locator('[data-sidebar="sessions"]');
    await expect(sidebar).toBeVisible();

    // Session should be listed with story title as name
    const sessionList = page.locator('[data-session-item]').first();
    await expect(sessionList).toBeVisible({ timeout: 5000 });
  });

  test('reuses active session for subsequent story operations', async ({ page }) => {
    // Generate first story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Get session ID from sidebar
    const sessionItem = page.locator('[data-session-item]').first();
    const sessionId = await sessionItem.getAttribute('data-session-id');

    // Improve the story
    await page.getByRole('button', { name: 'Edit Story with Prompt' }).click();
    await page.getByPlaceholder(/Add more action/).fill('Add more tension');
    await page.getByRole('button', { name: 'Regenerate Story' }).click();
    await expect(page.getByText(/Scene 1/).nth(1)).toBeVisible({ timeout: 30000 });

    // Verify we're still in the same session
    const currentSessionId = await sessionItem.getAttribute('data-session-id');
    expect(currentSessionId).toBe(sessionId);

    // Verify story history shows 2 versions
    const historyButton = page.getByRole('button', { name: /History/i });
    await historyButton.click();

    const historyItems = page.locator('[data-story-version]');
    await expect(historyItems).toHaveCount(2);
  });

  test('shows story history in session', async ({ page }) => {
    // Generate and improve story multiple times
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Improve story
    await page.getByRole('button', { name: 'Edit Story with Prompt' }).click();
    await page.getByPlaceholder(/Add more action/).fill('Add more tension');
    await page.getByRole('button', { name: 'Regenerate Story' }).click();
    await expect(page.getByText(/Scene 1/).nth(1)).toBeVisible({ timeout: 30000 });

    // Try again
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page.getByText(/Scene 1/).nth(2)).toBeVisible({ timeout: 30000 });

    // Open history
    await page.getByRole('button', { name: /History/i }).click();

    // Verify 3 versions exist
    const versions = page.locator('[data-story-version]');
    await expect(versions).toHaveCount(3);

    // Verify version labels
    await expect(versions.nth(0)).toContainText('Version 1');
    await expect(versions.nth(1)).toContainText('Version 2');
    await expect(versions.nth(2)).toContainText('Version 3');
  });

  test('can revert to previous story version', async ({ page }) => {
    // Generate initial story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    const firstStoryTitle = await page.locator('h2').first().textContent();

    // Improve story
    await page.getByRole('button', { name: 'Edit Story with Prompt' }).click();
    await page.getByPlaceholder(/Add more action/).fill('Add explosions');
    await page.getByRole('button', { name: 'Regenerate Story' }).click();
    await expect(page.getByText(/Scene 1/).nth(1)).toBeVisible({ timeout: 30000 });

    // Open history and revert to version 1
    await page.getByRole('button', { name: /History/i }).click();
    await page.locator('[data-story-version="0"]').click();
    await page.getByRole('button', { name: /Revert to This Version/i }).click();

    // Verify we're back to the first story
    const currentTitle = await page.locator('h2').first().textContent();
    expect(currentTitle).toBe(firstStoryTitle);

    // History should now only show 1 version
    await page.getByRole('button', { name: /History/i }).click();
    const versions = page.locator('[data-story-version]');
    await expect(versions).toHaveCount(1);
  });

  test('persists session to IndexedDB automatically', async ({ page }) => {
    // Generate story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Wait for auto-save
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();

    // Verify session was loaded from storage
    const sessionItem = page.locator('[data-session-item]').first();
    await expect(sessionItem).toBeVisible({ timeout: 5000 });

    // Verify story is still visible
    await expect(page.getByText(/Scene 1/)).toBeVisible();
  });

  test('creates new session from sidebar', async ({ page }) => {
    // Click new session button in sidebar
    const newSessionButton = page.getByRole('button', { name: /New Session/i });
    await newSessionButton.click();

    // Session creation dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Enter session name
    await page.getByPlaceholder(/Session name/i).fill('My Detective Stories');
    await page.getByRole('button', { name: /Create/i }).click();

    // Dialog should close and new session should be active
    await expect(dialog).not.toBeVisible();

    // Verify new session appears in sidebar
    const sessionItem = page.locator('[data-session-item]', { hasText: 'My Detective Stories' });
    await expect(sessionItem).toBeVisible();
    await expect(sessionItem).toHaveAttribute('data-active', 'true');
  });

  test('switches between sessions', async ({ page }) => {
    // Generate story in first session
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    const firstStoryTitle = await page.locator('h2').first().textContent();

    // Create new session
    await page.getByRole('button', { name: /New Session/i }).click();
    await page.getByPlaceholder(/Session name/i).fill('Second Session');
    await page.getByRole('button', { name: /Create/i }).click();

    // Generate different story in second session
    await page.getByPlaceholder(/Enter your story prompt/).fill('A space adventure');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    const secondStoryTitle = await page.locator('h2').first().textContent();
    expect(secondStoryTitle).not.toBe(firstStoryTitle);

    // Switch back to first session
    const firstSessionItem = page.locator('[data-session-item]').first();
    await firstSessionItem.click();

    // Verify first story is displayed
    const currentTitle = await page.locator('h2').first().textContent();
    expect(currentTitle).toBe(firstStoryTitle);
  });

  test('deletes session and removes from sidebar', async ({ page }) => {
    // Generate story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Right-click session in sidebar to open context menu
    const sessionItem = page.locator('[data-session-item]').first();
    await sessionItem.click({ button: 'right' });

    // Click delete option
    await page.getByRole('menuitem', { name: /Delete/i }).click();

    // Confirm deletion in dialog
    await page.getByRole('button', { name: /Confirm/i }).click();

    // Verify session is removed from sidebar
    await expect(sessionItem).not.toBeVisible();

    // Verify story content is cleared
    await expect(page.getByText(/Scene 1/)).not.toBeVisible();
  });

  test('exports session to JSON file', async ({ page }) => {
    // Generate story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Right-click session to open context menu
    const sessionItem = page.locator('[data-session-item]').first();
    await sessionItem.click({ button: 'right' });

    // Click export option
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /Export/i }).click();

    // Verify download started
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('imports session from JSON file', async ({ page }) => {
    // Click import button
    await page.getByRole('button', { name: /Import Session/i }).click();

    // Mock file upload
    const fileInput = page.locator('input[type="file"]');

    // Create mock session JSON
    const mockSession = {
      id: 'imported-session',
      name: 'Imported Detective Story',
      storyHistory: [{
        title: 'The Imported Mystery',
        scenes: [
          { number: 1, description: 'Imported scene 1' },
          { number: 2, description: 'Imported scene 2' }
        ]
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await fileInput.setInputFiles({
      name: 'session.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(mockSession))
    });

    // Verify imported session appears in sidebar
    const sessionItem = page.locator('[data-session-item]', {
      hasText: 'Imported Detective Story'
    });
    await expect(sessionItem).toBeVisible();

    // Click session to load it
    await sessionItem.click();

    // Verify story is displayed
    await expect(page.getByText(/The Imported Mystery/i)).toBeVisible();
  });

  test('shows session metadata in sidebar', async ({ page }) => {
    // Generate story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Hover over session item
    const sessionItem = page.locator('[data-session-item]').first();
    await sessionItem.hover();

    // Verify metadata tooltip appears
    const tooltip = page.locator('[data-tooltip]');
    await expect(tooltip).toBeVisible();

    // Should show story count
    await expect(tooltip).toContainText(/1 story/i);

    // Should show creation date
    await expect(tooltip).toContainText(/Created/i);
  });

  test('updates session list after story generation', async ({ page }) => {
    // Verify no sessions initially
    const sessionList = page.locator('[data-session-item]');
    await expect(sessionList).toHaveCount(0);

    // Generate story
    await page.getByPlaceholder(/Enter your story prompt/).fill('A detective story');
    await page.getByRole('button', { name: 'Generate Story' }).click();
    await expect(page.getByText(/Scene 1/)).toBeVisible({ timeout: 30000 });

    // Verify session was added to list
    await expect(sessionList).toHaveCount(1);

    // Improve story
    await page.getByRole('button', { name: 'Edit Story with Prompt' }).click();
    await page.getByPlaceholder(/Add more action/).fill('Add tension');
    await page.getByRole('button', { name: 'Regenerate Story' }).click();
    await expect(page.getByText(/Scene 1/).nth(1)).toBeVisible({ timeout: 30000 });

    // Session count should remain 1 (same session)
    await expect(sessionList).toHaveCount(1);

    // But metadata should update to show 2 stories
    await sessionList.first().hover();
    const tooltip = page.locator('[data-tooltip]');
    await expect(tooltip).toContainText(/2 stories/i);
  });
});
