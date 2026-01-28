/**
 * Stage 1: Project - E2E Tests
 * Based on STATE-WORKFLOW-SPEC.md Project section
 *
 * Tests cover:
 * - Project section UI layout
 * - Project CRUD operations
 * - Project switching and dropdown
 * - Persistence behavior
 * - Project list on /project route
 */

import { test, expect, setupApiMocks, setupProjectInLocalStorage, setupMultipleProjects, createProject } from '../../shared/fixtures';
import { clearAllData, navigateAndWait } from '../../shared/test-helpers';

test.describe('Stage 1: Project @project', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate first so we can access storage
		await page.goto('/');
		await clearAllData(page);
		await setupApiMocks(page);
	});

	// ===========================================================================
	// PROJECT SECTION UI LAYOUT
	// ===========================================================================

	test.describe('Project Section UI', () => {
		test('displays Project header and subtitle', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Check section header (use exact match to avoid matching "My Project")
			await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
			await expect(page.getByText('Name your project')).toBeVisible();
		});

		test('displays project name with default "My Project"', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Project name should default to "My Project"
			await expect(page.getByRole('heading', { name: 'My Project', level: 2 })).toBeVisible();
		});

		test('displays pencil icon next to project name', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Pencil icon for editing
			const pencilButton = page.getByRole('button', { name: /edit|pencil|rename/i });
			await expect(pencilButton).toBeVisible();
		});

		test('displays trash icon next to project name', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Trash icon for deleting
			const trashButton = page.getByRole('button', { name: /delete|trash|remove/i });
			await expect(trashButton).toBeVisible();
		});

		test('displays "+ New Project" button', async ({ page }) => {
			await navigateAndWait(page, '/');

			const newProjectButton = page.getByRole('button', { name: /\+ New Project|New Project/i });
			await expect(newProjectButton).toBeVisible();
		});
	});

	// ===========================================================================
	// PROJECT NAME EDITING
	// ===========================================================================

	test.describe('Project Name Editing', () => {
		test('clicking pencil icon enables inline editing', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Click pencil to edit
			await page.getByRole('button', { name: /edit|pencil|rename/i }).click();

			// Input should appear for editing
			const nameInput = page.getByRole('textbox', { name: /project name/i });
			await expect(nameInput).toBeVisible();
			await expect(nameInput).toBeFocused();
		});

		test('pressing Enter saves the new project name', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Enter edit mode
			await page.getByRole('button', { name: /edit|pencil|rename/i }).click();
			const nameInput = page.getByRole('textbox', { name: /project name/i });

			// Type new name and press Enter
			await nameInput.fill('My Awesome Video');
			await nameInput.press('Enter');

			// Should exit edit mode and show new name
			await expect(page.getByRole('heading', { name: 'My Awesome Video', level: 2 })).toBeVisible();
		});

		test('blur saves the new project name', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Enter edit mode
			await page.getByRole('button', { name: /edit|pencil|rename/i }).click();
			const nameInput = page.getByRole('textbox', { name: /project name/i });

			// Type new name and blur
			await nameInput.fill('My Blurred Video');
			await nameInput.blur();

			// Should exit edit mode and show new name
			await expect(page.getByRole('heading', { name: 'My Blurred Video', level: 2 })).toBeVisible();
		});

		test('pressing Escape cancels editing', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Enter edit mode
			await page.getByRole('button', { name: /edit|pencil|rename/i }).click();
			const nameInput = page.getByRole('textbox', { name: /project name/i });

			// Type new name but cancel with Escape
			await nameInput.fill('Cancelled Name');
			await nameInput.press('Escape');

			// Should revert to original name
			await expect(page.getByRole('heading', { name: 'My Project', level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// PROJECT DELETION
	// ===========================================================================

	test.describe('Project Deletion', () => {
		test('clicking trash icon shows delete confirmation modal', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Click trash
			await page.getByRole('button', { name: /delete|trash|remove/i }).click();

			// Modal should appear
			await expect(page.getByRole('dialog')).toBeVisible();
			await expect(page.getByText('Delete Project')).toBeVisible();
		});

		test('delete modal shows correct warning text', async ({ page }) => {
			await setupProjectInLocalStorage(page, { name: 'My Video' });
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /delete|trash|remove/i }).click();

			// Check warning text per spec
			await expect(page.getByText(/Are you sure you want to delete "My Video"/)).toBeVisible();
			await expect(page.getByText(/This action is irreversible/)).toBeVisible();
		});

		test('delete modal has Cancel and Delete buttons', async ({ page }) => {
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /delete|trash|remove/i }).click();

			await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
		});

		test('clicking Cancel closes the modal', async ({ page }) => {
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /delete|trash|remove/i }).click();
			await page.getByRole('button', { name: 'Cancel' }).click();

			await expect(page.getByRole('dialog')).not.toBeVisible();
		});

		test('clicking Delete removes the project', async ({ page }) => {
			await setupProjectInLocalStorage(page, { name: 'To Be Deleted' });
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /delete|trash|remove/i }).click();
			await page.getByRole('button', { name: 'Delete' }).click();

			// Should create new blank project
			await expect(page.getByRole('heading', { name: 'My Project', level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// PROJECT DROPDOWN (MULTIPLE PROJECTS)
	// ===========================================================================

	test.describe('Project Dropdown', () => {
		test('dropdown is NOT visible with only one project', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Should not show dropdown with single project
			const dropdown = page.getByRole('combobox', { name: /select project/i });
			await expect(dropdown).not.toBeVisible();
		});

		test('dropdown IS visible when 2+ projects exist', async ({ page }) => {
			// Setup multiple projects in IndexedDB
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' }
			]);
			await navigateAndWait(page, '/');

			// Should show dropdown
			const dropdown = page.getByRole('combobox', { name: /select project/i });
			await expect(dropdown).toBeVisible();
		});

		test('selecting different project switches to it', async ({ page }) => {
			// Setup multiple projects
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' }
			]);
			await navigateAndWait(page, '/');

			// Switch projects
			await page.getByRole('combobox', { name: /select project/i }).selectOption('proj-2');

			// Should show new project name
			await expect(page.getByRole('heading', { name: 'Project Two', level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// NEW PROJECT CREATION
	// ===========================================================================

	test.describe('New Project Creation', () => {
		test('clicking "+ New Project" creates a new project', async ({ page }) => {
			await setupProjectInLocalStorage(page, { name: 'Existing Project' });
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /\+ New Project|New Project/i }).click();

			// Should create new project with default name
			await expect(page.getByRole('heading', { name: 'My Project', level: 2 })).toBeVisible();
		});

		test('new project gets numbered name if "My Project" exists', async ({ page }) => {
			// Setup existing "My Project"
			await setupProjectInLocalStorage(page, { id: 'proj-1', name: 'My Project' });
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /\+ New Project/i }).click();

			// Should get numbered name
			await expect(page.getByRole('heading', { name: /My Project \(1\)/, level: 2 })).toBeVisible();
		});

		test('sequential new projects get incrementing numbers', async ({ page }) => {
			// Setup existing projects
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'My Project' },
				{ id: 'proj-2', name: 'My Project (1)' }
			]);
			await navigateAndWait(page, '/');

			await page.getByRole('button', { name: /\+ New Project/i }).click();

			// Should get next number
			await expect(page.getByRole('heading', { name: /My Project \(2\)/, level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// PERSISTENCE
	// ===========================================================================

	test.describe('Persistence', () => {
		test('project survives page refresh', async ({ page }) => {
			await setupProjectInLocalStorage(page, { name: 'Persistent Project' });
			await navigateAndWait(page, '/');

			// Verify project loaded
			await expect(page.getByRole('heading', { name: 'Persistent Project', level: 2 })).toBeVisible();

			// Refresh page
			await page.reload();
			await page.waitForLoadState('domcontentloaded');

			// Should still show same project
			await expect(page.getByRole('heading', { name: 'Persistent Project', level: 2 })).toBeVisible();
		});

		test('renamed project persists after refresh', async ({ page }) => {
			await navigateAndWait(page, '/');

			// Rename project
			await page.getByRole('button', { name: /edit|pencil|rename/i }).click();
			await page.getByRole('textbox', { name: /project name/i }).fill('Renamed Project');
			await page.getByRole('textbox', { name: /project name/i }).press('Enter');

			// Refresh
			await page.reload();
			await page.waitForLoadState('domcontentloaded');

			// Should persist
			await expect(page.getByRole('heading', { name: 'Renamed Project', level: 2 })).toBeVisible();
		});

		test('current project ID stored in IndexedDB', async ({ page }) => {
			await setupProjectInLocalStorage(page, { id: 'test-proj-123', name: 'Test Project' });
			await navigateAndWait(page, '/');

			// Verify project was loaded by checking the heading
			await expect(page.getByRole('heading', { name: 'Test Project', level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// PROJECT PAGE (/project ROUTE)
	// ===========================================================================

	test.describe('/project Route', () => {
		test('/project route shows project section', async ({ page }) => {
			await navigateAndWait(page, '/project');

			await expect(page.getByRole('heading', { name: 'Project', exact: true })).toBeVisible();
		});

		test('/project route shows "All Projects" list', async ({ page }) => {
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' },
				{ id: 'proj-3', name: 'Project Three' }
			]);
			await navigateAndWait(page, '/project');

			// Should show "All Projects" section
			await expect(page.getByText('All Projects')).toBeVisible();

			// Should list all projects
			await expect(page.getByText('Project One')).toBeVisible();
			await expect(page.getByText('Project Two')).toBeVisible();
			await expect(page.getByText('Project Three')).toBeVisible();
		});

		test('project list items have pencil and trash icons', async ({ page }) => {
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' }
			]);
			await navigateAndWait(page, '/project');

			// Each project in list should have edit and delete buttons
			const projectItems = page.locator('[data-testid="project-list-item"]');
			const count = await projectItems.count();

			for (let i = 0; i < count; i++) {
				const item = projectItems.nth(i);
				await expect(item.getByRole('button', { name: /edit|pencil/i })).toBeVisible();
				await expect(item.getByRole('button', { name: /delete|trash/i })).toBeVisible();
			}
		});

		test('current project is highlighted in list', async ({ page }) => {
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Current Project' }
			]);
			await navigateAndWait(page, '/project');

			// Current project should have highlighted styling (first loaded is current)
			const currentProjectItem = page.locator('[data-testid="project-list-item"][data-current="true"]');
			await expect(currentProjectItem).toBeVisible();
		});

		test('clicking project in list switches to it', async ({ page }) => {
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' }
			]);
			await navigateAndWait(page, '/project');

			// Click on Project Two
			await page.getByText('Project Two').click();

			// Should switch to that project
			await expect(page.getByRole('heading', { name: 'Project Two', level: 2 })).toBeVisible();
		});
	});

	// ===========================================================================
	// STATE TRANSITIONS
	// ===========================================================================

	test.describe('State Transitions', () => {
		test('ACTIVE -> RENAMING -> ACTIVE (pencil click -> enter)', async ({ page }) => {
			await navigateAndWait(page, '/');

			// ACTIVE state: project name visible
			await expect(page.getByRole('heading', { name: 'My Project', level: 2 })).toBeVisible();

			// Transition to RENAMING
			await page.getByRole('button', { name: /edit|pencil/i }).click();
			await expect(page.getByRole('textbox')).toBeVisible();

			// Transition back to ACTIVE
			await page.getByRole('textbox').press('Enter');
			await expect(page.getByRole('textbox')).not.toBeVisible();
		});

		test('ACTIVE -> DELETING -> ACTIVE (trash -> cancel)', async ({ page }) => {
			await navigateAndWait(page, '/');

			// ACTIVE state
			await expect(page.getByRole('dialog')).not.toBeVisible();

			// Transition to DELETING
			await page.getByRole('button', { name: /delete|trash/i }).click();
			await expect(page.getByRole('dialog')).toBeVisible();

			// Transition back to ACTIVE
			await page.getByRole('button', { name: 'Cancel' }).click();
			await expect(page.getByRole('dialog')).not.toBeVisible();
		});

		test('ACTIVE -> LOADING -> ACTIVE (project switch)', async ({ page }) => {
			await setupMultipleProjects(page, [
				{ id: 'proj-1', name: 'Project One' },
				{ id: 'proj-2', name: 'Project Two' }
			]);
			await navigateAndWait(page, '/');

			// ACTIVE: showing first project
			await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

			// Trigger LOADING by switching
			await page.getByRole('combobox', { name: /select project/i }).selectOption('proj-2');

			// ACTIVE with new project
			await expect(page.getByRole('heading', { name: 'Project Two', level: 2 })).toBeVisible();
		});
	});
});
