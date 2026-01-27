import { writable, get } from 'svelte/store';
import { ProjectManager, MemoryStorageAdapter, BrowserStorageAdapter } from '$lib/sidvid';
import type { Project, ProjectSummary } from '$lib/sidvid';
import { browser } from '$app/environment';

export interface ProjectState {
	manager: ProjectManager;
	currentProject: Project | null;
	projects: ProjectSummary[];
	isLoading: boolean;
	error: string | null;
}

// Use BrowserStorageAdapter in browser, MemoryStorageAdapter for SSR
const storage = browser ? new BrowserStorageAdapter() : new MemoryStorageAdapter();
const manager = new ProjectManager(storage);

// Enable auto-save for convenience
manager.enableAutoSave();

const initialState: ProjectState = {
	manager,
	currentProject: null,
	projects: [],
	isLoading: false,
	error: null
};

export const projectStore = writable<ProjectState>(initialState);

/**
 * Create a new project
 */
export async function createNewProject(name?: string): Promise<Project> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		const project = await manager.createProject(name);
		const projects = await manager.listProjects();

		projectStore.update((s) => ({
			...s,
			currentProject: project,
			projects,
			isLoading: false
		}));

		return project;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
		throw error;
	}
}

/**
 * Load an existing project by ID
 */
export async function loadProject(id: string): Promise<Project> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		const project = await manager.switchProject(id);

		projectStore.update((s) => ({
			...s,
			currentProject: project,
			isLoading: false
		}));

		return project;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to load project';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
		throw error;
	}
}

/**
 * Set the current project
 */
export function setCurrentProject(project: Project | null): void {
	projectStore.update((s) => ({
		...s,
		currentProject: project
	}));
}

/**
 * Refresh the projects list from storage
 */
export async function refreshProjects(): Promise<void> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		const projects = await manager.listProjects();

		projectStore.update((s) => ({
			...s,
			projects,
			isLoading: false
		}));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to refresh projects';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
	}
}

/**
 * Delete a project
 */
export async function deleteProject(id: string): Promise<void> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		await manager.deleteProject(id);

		projectStore.update((s) => ({
			...s,
			projects: s.projects.filter((project) => project.id !== id),
			currentProject: s.currentProject?.id === id ? null : s.currentProject,
			isLoading: false
		}));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
	}
}

/**
 * Rename a project
 */
export async function renameProject(id: string, newName: string): Promise<Project> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		const project = await manager.renameProject(id, newName);
		const projects = await manager.listProjects();

		projectStore.update((s) => ({
			...s,
			currentProject: s.currentProject?.id === id ? project : s.currentProject,
			projects,
			isLoading: false
		}));

		return project;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to rename project';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
		throw error;
	}
}

/**
 * Update the current project
 */
export async function updateCurrentProject(updates: Partial<Project>): Promise<void> {
	const state = get(projectStore);
	if (!state.currentProject) {
		throw new Error('No current project');
	}

	const updatedProject: Project = {
		...state.currentProject,
		...updates
	};

	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		await manager.updateProject(updatedProject);

		projectStore.update((s) => ({
			...s,
			currentProject: updatedProject,
			isLoading: false
		}));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
		projectStore.update((s) => ({ ...s, isLoading: false, error: errorMessage }));
		throw error;
	}
}

/**
 * Clear error state
 */
export function clearError(): void {
	projectStore.update((s) => ({ ...s, error: null }));
}

/**
 * Get current project from store synchronously
 */
export function getCurrentProject(): Project | null {
	return get(projectStore).currentProject;
}

/**
 * Initialize the project store (load projects list)
 */
export async function initializeProjectStore(): Promise<void> {
	await refreshProjects();

	// Auto-create a project if none exist
	const state = get(projectStore);
	if (state.projects.length === 0) {
		await createNewProject();
	} else if (!state.currentProject) {
		// Load the most recently opened project
		await loadProject(state.projects[0].id);
	}
}
