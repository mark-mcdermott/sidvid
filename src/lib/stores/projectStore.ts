import { writable, get } from 'svelte/store';
import { ProjectManager, MemoryStorageAdapter, BrowserStorageAdapter } from '$lib/sidvid';
import type { Project, ProjectSummary } from '$lib/sidvid';
import { browser } from '$app/environment';
import { resetStoryStore, getStoryStoreState, loadStoryStoreState } from './storyStore';
import { resetWorldStore, getWorldStoreState, loadWorldStoreState } from './worldStore';
import { resetStoryboardStore } from './storyboardStore';
import { resetVideoStore } from './videoStore';
import { resetCharacterStore, getCharacterStoreState, loadCharacterStoreState } from './characterStore';
import { resetConversationStore } from './conversationStore';

const UI_STATE_KEY_PREFIX = 'sidvid-ui-state-';

/**
 * Save current UI state for a project to localStorage
 */
function saveUIStateForProject(projectId: string): void {
	if (!browser) return;

	const uiState = {
		story: getStoryStoreState(),
		world: getWorldStoreState(),
		character: getCharacterStoreState()
	};

	try {
		localStorage.setItem(UI_STATE_KEY_PREFIX + projectId, JSON.stringify(uiState));
	} catch (error) {
		console.error('Failed to save UI state:', error);
	}
}

/**
 * Load UI state for a project from localStorage
 */
function loadUIStateForProject(projectId: string): void {
	if (!browser) return;

	try {
		const saved = localStorage.getItem(UI_STATE_KEY_PREFIX + projectId);
		if (saved) {
			const uiState = JSON.parse(saved);
			if (uiState.story) loadStoryStoreState(uiState.story);
			if (uiState.world) loadWorldStoreState(uiState.world);
			if (uiState.character) loadCharacterStoreState(uiState.character);
		}
	} catch (error) {
		console.error('Failed to load UI state:', error);
	}
}

/**
 * Delete UI state for a project from localStorage
 */
function deleteUIStateForProject(projectId: string): void {
	if (!browser) return;

	try {
		localStorage.removeItem(UI_STATE_KEY_PREFIX + projectId);
	} catch (error) {
		console.error('Failed to delete UI state:', error);
	}
}

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
 * Reset all content stores to their initial state
 */
function resetAllContentStores(): void {
	resetStoryStore();
	resetWorldStore();
	resetStoryboardStore();
	resetVideoStore();
	resetCharacterStore();
	resetConversationStore();
}

/**
 * Create a new project
 */
export async function createNewProject(name?: string): Promise<Project> {
	projectStore.update((s) => ({ ...s, isLoading: true, error: null }));

	try {
		// Save current project's UI state before switching
		const currentState = get(projectStore);
		if (currentState.currentProject) {
			saveUIStateForProject(currentState.currentProject.id);
		}

		// Reset all content stores for the new project
		resetAllContentStores();

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
		// Save current project's UI state before switching
		const currentState = get(projectStore);
		if (currentState.currentProject && currentState.currentProject.id !== id) {
			saveUIStateForProject(currentState.currentProject.id);
		}

		// Reset all content stores when switching projects
		resetAllContentStores();

		const project = await manager.switchProject(id);

		// Load UI state for the new project
		loadUIStateForProject(id);

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
		// Also delete the UI state for this project
		deleteUIStateForProject(id);

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
 * Save current UI state (call this when content changes)
 */
export function saveCurrentUIState(): void {
	const state = get(projectStore);
	if (state.currentProject) {
		saveUIStateForProject(state.currentProject.id);
	}
}

// Track initialization state to prevent duplicate initialization
let isInitialized = false;

/**
 * Initialize the project store (load projects list)
 * This function is idempotent - safe to call multiple times
 */
export async function initializeProjectStore(): Promise<void> {
	if (isInitialized) return;
	isInitialized = true;

	await refreshProjects();

	// Auto-create a project if none exist
	const state = get(projectStore);
	if (state.projects.length === 0) {
		await createNewProject();
	} else if (!state.currentProject) {
		// Load the most recently opened project
		await loadProject(state.projects[0].id);
	} else {
		// Current project exists (e.g., from SSR), load its UI state
		loadUIStateForProject(state.currentProject.id);
	}

	// Set up auto-save on page unload and periodic save
	if (browser) {
		window.addEventListener('beforeunload', () => {
			saveCurrentUIState();
		});

		// Periodic auto-save every 5 seconds
		setInterval(() => {
			saveCurrentUIState();
		}, 5000);
	}
}
