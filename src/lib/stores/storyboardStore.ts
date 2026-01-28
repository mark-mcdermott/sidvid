import { writable, derived, get, type Readable } from 'svelte/store';
import type { ElementType } from './worldStore';

// Scene status per STATE-WORKFLOW-SPEC.md
export type SceneStatus = 'empty' | 'pending' | 'generating' | 'completed' | 'failed';

// Pipeline status per STATE-WORKFLOW-SPEC.md
export type PipelineStatus = 'uninitialized' | 'initialized' | 'generating' | 'complete' | 'partial';

export interface SceneImage {
	id: string;
	imageUrl: string;
	revisedPrompt?: string;
	usedCharacterReference?: boolean;
	isActive: boolean;
	createdAt: Date;
}

export interface Scene {
	id: string;
	title: string;
	description: string;
	customDescription?: string;
	enhancedDescription?: string;
	preExpansionDescription?: string;
	isSmartExpanded: boolean;
	dialog?: string;
	action?: string;
	assignedElements: string[]; // World element IDs
	images: SceneImage[];
	duration: number; // in seconds (5s increments)
	status: SceneStatus;
	error?: string;
	isArchived: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface StoryboardState {
	scenes: Scene[];
	pipelineStatus: PipelineStatus;
	generatingSceneId: string | null;
	selectedSceneId: string | null;
	isPlaying: boolean;
	currentTime: number;
}

// Forward declarations of legacy wireframe types (full exports below)
export interface WireframeScene {
	id: string;
	imageUrl: string;
	name: string;
}

export interface WireframeCharacter {
	id: string;
	imageUrl: string;
	name: string;
}

export interface Wireframe {
	id: string;
	scene: WireframeScene | null;
	characters: WireframeCharacter[];
	duration: number;
}

export interface TimelineItem {
	id: string;
	wireframeId: string;
	scene: WireframeScene | null;
	characters: WireframeCharacter[];
	duration: number;
	transition?: string;
}

// Extended state type with legacy wireframe support
export interface StoryboardStoreValue extends StoryboardState {
	wireframes: Wireframe[];
	timelineItems: TimelineItem[];
	totalDuration: number;
}

function generateId(): string {
	return `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const initialState: StoryboardState = {
	scenes: [],
	pipelineStatus: 'uninitialized',
	generatingSceneId: null,
	selectedSceneId: null,
	isPlaying: false,
	currentTime: 0
};

// Internal writable store
const _internalStore = writable<StoryboardState>(initialState);

// Helper to get active image URL
function _getActiveSceneImageUrl(scene: Scene): string | undefined {
	if (!scene.images || scene.images.length === 0) return undefined;
	const active = scene.images.find((img) => img.isActive);
	return active?.imageUrl || scene.images[scene.images.length - 1]?.imageUrl;
}

// Compute wireframes from scenes
function computeWireframes(scenes: Scene[]): Wireframe[] {
	const activeScenes = scenes.filter((s) => !s.isArchived);
	return activeScenes.map((scene) => {
		const imageUrl = _getActiveSceneImageUrl(scene);
		return {
			id: scene.id,
			scene: imageUrl ? { id: scene.id, imageUrl, name: scene.title } : null,
			characters: [],
			duration: scene.duration
		};
	});
}

// Compute timeline items from wireframes
function computeTimelineItems(wireframes: Wireframe[]): TimelineItem[] {
	return wireframes
		.filter((wf) => wf.scene !== null)
		.map((wf) => ({
			id: `timeline-${wf.id}`,
			wireframeId: wf.id,
			scene: wf.scene,
			characters: wf.characters,
			duration: wf.duration
		}));
}

// Derived store that adds wireframes, timelineItems, and totalDuration
const _derivedStore = derived(_internalStore, ($state): StoryboardStoreValue => {
	const wireframes = computeWireframes($state.scenes);
	const timelineItems = computeTimelineItems(wireframes);
	const activeScenes = $state.scenes.filter((s) => !s.isArchived);
	const totalDuration = activeScenes.reduce((sum, s) => sum + s.duration, 0);
	return {
		...$state,
		wireframes,
		timelineItems,
		totalDuration
	};
});

// Custom store type that combines readable with update/set
interface StoryboardStore extends Readable<StoryboardStoreValue> {
	update: (updater: (state: StoryboardState) => StoryboardState) => void;
	set: (state: StoryboardState) => void;
}

// Create custom store that has subscribe from derived but update/set from writable
export const storyboardStore: StoryboardStore = {
	subscribe: _derivedStore.subscribe,
	update: _internalStore.update,
	set: _internalStore.set
};

export function resetStoryboardStore() {
	_internalStore.set({ ...initialState });
}

// Get active scenes (not archived)
export function getActiveScenes(scenes: Scene[]): Scene[] {
	return scenes.filter((s) => !s.isArchived);
}

// Get archived scenes
export function getArchivedScenes(scenes: Scene[]): Scene[] {
	return scenes.filter((s) => s.isArchived);
}

// Get active image URL for a scene
export function getActiveSceneImageUrl(scene: Scene): string | undefined {
	if (!scene.images || scene.images.length === 0) return undefined;
	const active = scene.images.find((img) => img.isActive);
	return active?.imageUrl || scene.images[scene.images.length - 1]?.imageUrl;
}

// Add a new scene
export function addScene(title?: string, description?: string): string {
	const id = generateId();
	const now = new Date();

	storyboardStore.update((state) => {
		const activeScenes = getActiveScenes(state.scenes);
		const sceneNumber = activeScenes.length + 1;

		const newScene: Scene = {
			id,
			title: title || `Scene ${sceneNumber}`,
			description: description || '',
			isSmartExpanded: false,
			assignedElements: [],
			images: [],
			duration: 5,
			status: 'empty',
			isArchived: false,
			createdAt: now,
			updatedAt: now
		};

		return {
			...state,
			scenes: [...state.scenes, newScene],
			pipelineStatus: state.pipelineStatus === 'uninitialized' ? 'initialized' : state.pipelineStatus
		};
	});

	return id;
}

// Update scene properties
export function updateScene(sceneId: string, updates: Partial<Scene>): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) =>
			scene.id === sceneId
				? { ...scene, ...updates, updatedAt: new Date() }
				: scene
		)
	}));
}

// Add world element to scene
export function assignElementToScene(sceneId: string, elementId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) => {
			if (scene.id !== sceneId) return scene;
			if (scene.assignedElements.includes(elementId)) return scene;
			return {
				...scene,
				assignedElements: [...scene.assignedElements, elementId],
				status: scene.status === 'empty' ? 'pending' : scene.status,
				updatedAt: new Date()
			};
		})
	}));
}

// Remove world element from scene
export function unassignElementFromScene(sceneId: string, elementId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) => {
			if (scene.id !== sceneId) return scene;
			const newAssigned = scene.assignedElements.filter((id) => id !== elementId);
			return {
				...scene,
				assignedElements: newAssigned,
				status: newAssigned.length === 0 && !scene.description ? 'empty' : scene.status,
				updatedAt: new Date()
			};
		})
	}));
}

// Add image to scene
export function addSceneImage(sceneId: string, imageUrl: string, revisedPrompt?: string, usedCharacterReference?: boolean): void {
	const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) =>
			scene.id === sceneId
				? {
						...scene,
						images: [
							...scene.images.map((img) => ({ ...img, isActive: false })),
							{
								id: imageId,
								imageUrl,
								revisedPrompt,
								usedCharacterReference,
								isActive: true,
								createdAt: new Date()
							}
						],
						status: 'completed',
						updatedAt: new Date()
					}
				: scene
		),
		generatingSceneId: state.generatingSceneId === sceneId ? null : state.generatingSceneId
	}));

	// Update pipeline status
	updatePipelineStatus();
}

// Set active image for scene
export function setActiveSceneImage(sceneId: string, imageId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) =>
			scene.id === sceneId
				? {
						...scene,
						images: scene.images.map((img) => ({
							...img,
							isActive: img.id === imageId
						})),
						updatedAt: new Date()
					}
				: scene
		)
	}));
}

// Delete image from scene
export function deleteSceneImage(sceneId: string, imageId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) => {
			if (scene.id !== sceneId) return scene;

			const updatedImages = scene.images.filter((img) => img.id !== imageId);
			const hasActive = updatedImages.some((img) => img.isActive);
			if (!hasActive && updatedImages.length > 0) {
				updatedImages[updatedImages.length - 1].isActive = true;
			}

			return {
				...scene,
				images: updatedImages,
				status: updatedImages.length === 0 ? 'pending' : scene.status,
				updatedAt: new Date()
			};
		})
	}));
}

// Clone scene
export function cloneScene(sceneId: string): string {
	const newId = generateId();
	const now = new Date();

	storyboardStore.update((state) => {
		const originalIndex = state.scenes.findIndex((s) => s.id === sceneId);
		if (originalIndex === -1) return state;

		const original = state.scenes[originalIndex];

		// Generate title with (1), (2), etc.
		const baseTitle = original.title.replace(/\s*\(\d+\)$/, '');
		const existingClones = state.scenes.filter((s) =>
			s.title.startsWith(baseTitle) && s.title !== baseTitle
		);
		const cloneNumber = existingClones.length + 1;
		const newTitle = `${baseTitle} (${cloneNumber})`;

		const clonedScene: Scene = {
			...original,
			id: newId,
			title: newTitle,
			isArchived: false, // Clone as active even if original was archived
			createdAt: now,
			updatedAt: now
		};

		// Insert after original
		const newScenes = [...state.scenes];
		newScenes.splice(originalIndex + 1, 0, clonedScene);

		return {
			...state,
			scenes: newScenes
		};
	});

	return newId;
}

// Archive scene
export function archiveScene(sceneId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) =>
			scene.id === sceneId
				? { ...scene, isArchived: true, updatedAt: new Date() }
				: scene
		)
	}));
}

// Unarchive scene (append to end of active scenes)
export function unarchiveScene(sceneId: string): void {
	storyboardStore.update((state) => {
		const sceneIndex = state.scenes.findIndex((s) => s.id === sceneId);
		if (sceneIndex === -1) return state;

		const scene = { ...state.scenes[sceneIndex], isArchived: false, updatedAt: new Date() };
		const otherScenes = state.scenes.filter((s) => s.id !== sceneId);

		// Find position after last active scene
		const lastActiveIndex = otherScenes.reduce(
			(maxIdx, s, idx) => (!s.isArchived ? idx : maxIdx),
			-1
		);

		const newScenes = [...otherScenes];
		newScenes.splice(lastActiveIndex + 1, 0, scene);

		return {
			...state,
			scenes: newScenes
		};
	});
}

// Delete scene
export function deleteScene(sceneId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.filter((s) => s.id !== sceneId),
		selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId
	}));

	updatePipelineStatus();
}

// Reorder scenes (drag and drop)
export function reorderScenes(fromIndex: number, toIndex: number): void {
	storyboardStore.update((state) => {
		const activeScenes = getActiveScenes(state.scenes);
		const archivedScenes = getArchivedScenes(state.scenes);

		if (fromIndex < 0 || fromIndex >= activeScenes.length) return state;
		if (toIndex < 0 || toIndex >= activeScenes.length) return state;

		const newActiveScenes = [...activeScenes];
		const [moved] = newActiveScenes.splice(fromIndex, 1);
		newActiveScenes.splice(toIndex, 0, moved);

		return {
			...state,
			scenes: [...newActiveScenes, ...archivedScenes]
		};
	});
}

// Select scene
export function selectScene(sceneId: string | null): void {
	storyboardStore.update((state) => ({
		...state,
		selectedSceneId: sceneId
	}));
}

// Set scene status
export function setSceneStatus(sceneId: string, status: SceneStatus, error?: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) =>
			scene.id === sceneId
				? { ...scene, status, error, updatedAt: new Date() }
				: scene
		),
		generatingSceneId: status === 'generating' ? sceneId :
			(state.generatingSceneId === sceneId ? null : state.generatingSceneId)
	}));

	updatePipelineStatus();
}

// Update pipeline status based on scene statuses
function updatePipelineStatus(): void {
	storyboardStore.update((state) => {
		const activeScenes = getActiveScenes(state.scenes);
		if (activeScenes.length === 0) {
			return { ...state, pipelineStatus: 'uninitialized' };
		}

		const hasGenerating = activeScenes.some((s) => s.status === 'generating');
		const allCompleted = activeScenes.every((s) => s.status === 'completed');
		const someCompleted = activeScenes.some((s) => s.status === 'completed');

		let pipelineStatus: PipelineStatus;
		if (hasGenerating) {
			pipelineStatus = 'generating';
		} else if (allCompleted) {
			pipelineStatus = 'complete';
		} else if (someCompleted) {
			pipelineStatus = 'partial';
		} else {
			pipelineStatus = 'initialized';
		}

		return { ...state, pipelineStatus };
	});
}

// Initialize scenes from story
export function initializeScenesFromStory(
	storyScenes: Array<{
		title: string;
		description: string;
		dialog?: string;
		action?: string;
		assignedElements?: string[];
	}>,
	sceneDuration?: number
): void {
	const now = new Date();
	// Default to 5 seconds if no duration provided
	const duration = sceneDuration ?? 5;

	storyboardStore.update((state) => {
		const newScenes: Scene[] = storyScenes.map((s, index) => ({
			id: generateId(),
			title: s.title || `Scene ${index + 1}`,
			description: s.description,
			dialog: s.dialog,
			action: s.action,
			assignedElements: s.assignedElements || [],
			isSmartExpanded: false,
			images: [],
			duration,
			status: 'pending' as SceneStatus,
			isArchived: false,
			createdAt: now,
			updatedAt: now
		}));

		return {
			...state,
			scenes: [...state.scenes, ...newScenes],
			pipelineStatus: 'initialized'
		};
	});
}

// Playback controls
export function togglePlayback(): void {
	storyboardStore.update((state) => ({
		...state,
		isPlaying: !state.isPlaying
	}));
}

export function setCurrentTime(time: number): void {
	storyboardStore.update((state) => ({
		...state,
		currentTime: time
	}));
}

// Get total duration of active scenes
export function getTotalDuration(scenes: Scene[]): number {
	return getActiveScenes(scenes).reduce((sum, s) => sum + s.duration, 0);
}

// Load from localStorage
export function loadStoryboardFromStorage(): void {
	if (typeof window === 'undefined') return;

	const saved = localStorage.getItem('storyboard-state-v2');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			// Convert date strings back to Date objects
			const scenes = (parsed.scenes || []).map((s: Scene) => ({
				...s,
				createdAt: new Date(s.createdAt),
				updatedAt: new Date(s.updatedAt),
				images: (s.images || []).map((img: SceneImage) => ({
					...img,
					createdAt: new Date(img.createdAt)
				}))
			}));
			storyboardStore.set({
				...initialState,
				...parsed,
				scenes
			});
		} catch (e) {
			console.error('Failed to load storyboard state:', e);
		}
	}
}

// Save to localStorage
export function saveStoryboardToStorage(): void {
	if (typeof window === 'undefined') return;

	const state = get(storyboardStore);
	localStorage.setItem('storyboard-state-v2', JSON.stringify(state));
}

// Remove element from all scenes (for cascade deletion)
export function removeElementFromAllScenes(elementId: string): void {
	storyboardStore.update((state) => ({
		...state,
		scenes: state.scenes.map((scene) => ({
			...scene,
			assignedElements: scene.assignedElements.filter((id) => id !== elementId),
			updatedAt: new Date()
		}))
	}));
}

// ============= LEGACY WIREFRAME SUPPORT =============
// These types are defined and exported at the top of the file

// Legacy derived state for dashboard compatibility
export function getLegacyWireframes(scenes: Scene[]): Wireframe[] {
	const activeScenes = getActiveScenes(scenes);
	return activeScenes.map((scene, index) => {
		const imageUrl = getActiveSceneImageUrl(scene);
		return {
			id: scene.id,
			scene: imageUrl ? { id: scene.id, imageUrl, name: scene.title } : null,
			characters: [], // Characters now come from assignedElements
			duration: scene.duration
		};
	});
}

export function getLegacyTimelineItems(scenes: Scene[]): TimelineItem[] {
	const wireframes = getLegacyWireframes(scenes);
	return wireframes
		.filter((wf) => wf.scene !== null)
		.map((wf) => ({
			id: `timeline-${wf.id}`,
			wireframeId: wf.id,
			scene: wf.scene,
			characters: wf.characters,
			duration: wf.duration
		}));
}

// Legacy functions for wireframe manipulation (no-ops or adapters)
export function addSceneToWireframe(wireframeId: string, scene: WireframeScene): void {
	// In the new model, scenes are created directly, not added to wireframes
	// This is a compatibility shim that creates a new scene with the image
	const now = new Date();
	storyboardStore.update((state) => {
		const existingScene = state.scenes.find((s) => s.id === wireframeId);
		if (existingScene) {
			// Update existing scene with the image
			return {
				...state,
				scenes: state.scenes.map((s) =>
					s.id === wireframeId
						? {
								...s,
								images: [
									...s.images.map((img) => ({ ...img, isActive: false })),
									{
										id: `img-${Date.now()}`,
										imageUrl: scene.imageUrl,
										isActive: true,
										createdAt: now
									}
								],
								status: 'completed' as SceneStatus,
								updatedAt: now
							}
						: s
				)
			};
		}
		return state;
	});
}

export function addCharacterToWireframe(wireframeId: string, character: WireframeCharacter): void {
	// Characters are now world elements, assigned via assignElementToScene
	assignElementToScene(wireframeId, character.id);
}

export function removeCharacterFromWireframe(wireframeId: string, characterId: string): void {
	unassignElementFromScene(wireframeId, characterId);
}

export function setWireframeDuration(wireframeId: string, duration: number): void {
	updateScene(wireframeId, { duration });
}

export function selectWireframe(wireframeId: string | null): void {
	selectScene(wireframeId);
}

export function createNewStoryboard(): string {
	// Create a new empty scene
	return addScene();
}

// Legacy support: setScenes for backwards compatibility
export interface SceneData {
	id: string;
	sceneNumber: number;
	description: string;
	imageUrl: string;
	characterIds: string[];
}

export function setScenes(scenesData: SceneData[]): void {
	const now = new Date();

	storyboardStore.update((state) => {
		const newScenes: Scene[] = scenesData.map((s, index) => ({
			id: s.id || generateId(),
			title: `Scene ${s.sceneNumber}`,
			description: s.description,
			assignedElements: s.characterIds || [],
			isSmartExpanded: false,
			images: s.imageUrl
				? [
						{
							id: `img-${Date.now()}-${index}`,
							imageUrl: s.imageUrl,
							isActive: true,
							createdAt: now
						}
					]
				: [],
			duration: 5,
			status: s.imageUrl ? 'completed' : 'pending',
			isArchived: false,
			createdAt: now,
			updatedAt: now
		}));

		return {
			...state,
			scenes: newScenes,
			pipelineStatus: newScenes.some((s) => s.status === 'completed') ? 'partial' : 'initialized'
		};
	});
}
