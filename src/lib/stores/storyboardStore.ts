import { writable, get } from 'svelte/store';

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
	duration: number; // in seconds
}

export interface TimelineItem {
	id: string;
	wireframeId: string;
	scene: WireframeScene | null;
	characters: WireframeCharacter[];
	duration: number;
	transition?: string;
}

export interface StoryboardEntry {
	id: string;
	name: string;
	wireframes: Wireframe[];
	createdAt: number;
	thumbnailUrl?: string;
}

export interface StoryboardState {
	storyboards: StoryboardEntry[];
	currentStoryboardId: string | null;
	wireframes: Wireframe[];
	timelineItems: TimelineItem[];
	isPlaying: boolean;
	currentTime: number;
	totalDuration: number;
	selectedWireframeId: string | null;
}

const DEFAULT_WIREFRAME_COUNT = 6;

function createDefaultWireframes(): Wireframe[] {
	return Array.from({ length: DEFAULT_WIREFRAME_COUNT }, (_, i) => ({
		id: `wireframe-${i + 1}`,
		scene: null,
		characters: [],
		duration: 5
	}));
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const initialState: StoryboardState = {
	storyboards: [],
	currentStoryboardId: null,
	wireframes: createDefaultWireframes(),
	timelineItems: [],
	isPlaying: false,
	currentTime: 0,
	totalDuration: 0,
	selectedWireframeId: null
};

export const storyboardStore = writable<StoryboardState>(initialState);

export function resetStoryboardStore() {
	storyboardStore.set({
		...initialState,
		wireframes: createDefaultWireframes()
	});
}

export function createNewStoryboard(): string {
	const id = generateId();
	storyboardStore.update(state => {
		const newStoryboard: StoryboardEntry = {
			id,
			name: `Storyboard ${state.storyboards.length + 1}`,
			wireframes: createDefaultWireframes(),
			createdAt: Date.now()
		};
		return {
			...state,
			storyboards: [...state.storyboards, newStoryboard],
			currentStoryboardId: id,
			wireframes: newStoryboard.wireframes,
			timelineItems: []
		};
	});
	return id;
}

export function addSceneToWireframe(wireframeId: string, scene: WireframeScene) {
	storyboardStore.update(state => {
		const wireframes = state.wireframes.map(wf => {
			if (wf.id === wireframeId) {
				return { ...wf, scene };
			}
			return wf;
		});
		return {
			...state,
			wireframes,
			timelineItems: buildTimelineFromWireframes(wireframes)
		};
	});
}

export function addCharacterToWireframe(wireframeId: string, character: WireframeCharacter) {
	storyboardStore.update(state => {
		const wireframes = state.wireframes.map(wf => {
			if (wf.id === wireframeId) {
				// Don't add duplicates
				const exists = wf.characters.some(c => c.id === character.id);
				if (exists) return wf;
				return { ...wf, characters: [...wf.characters, character] };
			}
			return wf;
		});
		return {
			...state,
			wireframes,
			timelineItems: buildTimelineFromWireframes(wireframes)
		};
	});
}

export function removeCharacterFromWireframe(wireframeId: string, characterId: string) {
	storyboardStore.update(state => {
		const wireframes = state.wireframes.map(wf => {
			if (wf.id === wireframeId) {
				return {
					...wf,
					characters: wf.characters.filter(c => c.id !== characterId)
				};
			}
			return wf;
		});
		return {
			...state,
			wireframes,
			timelineItems: buildTimelineFromWireframes(wireframes)
		};
	});
}

export function setWireframeDuration(wireframeId: string, duration: number) {
	storyboardStore.update(state => {
		const wireframes = state.wireframes.map(wf => {
			if (wf.id === wireframeId) {
				return { ...wf, duration };
			}
			return wf;
		});
		const timelineItems = buildTimelineFromWireframes(wireframes);
		return {
			...state,
			wireframes,
			timelineItems,
			totalDuration: calculateTotalDuration(timelineItems)
		};
	});
}

export function setTransition(fromWireframeId: string, toWireframeId: string, transition: string) {
	storyboardStore.update(state => {
		const timelineItems = state.timelineItems.map((item, index) => {
			if (item.wireframeId === fromWireframeId && index < state.timelineItems.length - 1) {
				return { ...item, transition };
			}
			return item;
		});
		return { ...state, timelineItems };
	});
}

export function reorderWireframes(fromIndex: number, toIndex: number) {
	storyboardStore.update(state => {
		const wireframes = [...state.wireframes];
		const [moved] = wireframes.splice(fromIndex, 1);
		wireframes.splice(toIndex, 0, moved);
		return {
			...state,
			wireframes,
			timelineItems: buildTimelineFromWireframes(wireframes)
		};
	});
}

export function selectWireframe(wireframeId: string | null) {
	storyboardStore.update(state => ({
		...state,
		selectedWireframeId: wireframeId
	}));
}

export function togglePlayback() {
	storyboardStore.update(state => ({
		...state,
		isPlaying: !state.isPlaying
	}));
}

export function setCurrentTime(time: number) {
	storyboardStore.update(state => ({
		...state,
		currentTime: time
	}));
}

function buildTimelineFromWireframes(wireframes: Wireframe[]): TimelineItem[] {
	return wireframes
		.filter(wf => wf.scene !== null || wf.characters.length > 0)
		.map(wf => ({
			id: `timeline-${wf.id}`,
			wireframeId: wf.id,
			scene: wf.scene,
			characters: wf.characters,
			duration: wf.duration
		}));
}

function calculateTotalDuration(items: TimelineItem[]): number {
	return items.reduce((total, item) => total + item.duration, 0);
}

// Load storyboard state from localStorage
// Only loads if current state has no wireframes with scenes (i.e., fresh data wasn't just set)
export function loadStoryboardFromStorage() {
	if (typeof window === 'undefined') return;

	// Check if we already have wireframes with scenes (set by setScenes)
	const currentState = get(storyboardStore);
	const hasActiveScenes = currentState.wireframes.some(wf => wf.scene !== null);
	if (hasActiveScenes) {
		// Don't overwrite fresh data from scenes page
		return;
	}

	const saved = localStorage.getItem('storyboard-state');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			storyboardStore.set({
				...initialState,
				...parsed,
				wireframes: parsed.wireframes || createDefaultWireframes()
			});
		} catch (e) {
			console.error('Failed to load storyboard state:', e);
		}
	}
}

// Save storyboard state to localStorage
export function saveStoryboardToStorage() {
	if (typeof window === 'undefined') return;

	const state = get(storyboardStore);
	localStorage.setItem('storyboard-state', JSON.stringify(state));
}

// Scene data from scene pipeline
export interface SceneData {
	id: string;
	sceneNumber: number;
	description: string;
	imageUrl: string;
	characterIds: string[];
}

// Set scenes from scene pipeline
export function setScenes(scenes: SceneData[]) {
	storyboardStore.update(state => {
		// Create wireframes from scenes
		const wireframes: Wireframe[] = scenes.map((scene, index) => ({
			id: `wireframe-scene-${scene.id}`,
			scene: {
				id: scene.id,
				imageUrl: scene.imageUrl,
				name: `Scene ${scene.sceneNumber}`
			},
			characters: [], // Characters can be added via drag/drop
			duration: 5
		}));

		// Add an empty wireframe at the end for adding more
		wireframes.push({
			id: `wireframe-empty-${Date.now()}`,
			scene: null,
			characters: [],
			duration: 5
		});

		const timelineItems = buildTimelineFromWireframes(wireframes);

		return {
			...state,
			wireframes,
			timelineItems,
			totalDuration: calculateTotalDuration(timelineItems)
		};
	});
}

// Wrapper object for the store with methods
export const storyboardStoreActions = {
	subscribe: storyboardStore.subscribe,
	set: storyboardStore.set,
	update: storyboardStore.update,
	setScenes
};
