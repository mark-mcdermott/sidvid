import { writable } from 'svelte/store';

// Element types per STATE-WORKFLOW-SPEC.md
export type ElementType = 'character' | 'location' | 'object' | 'concept';

export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
	character: 'Character',
	location: 'Location',
	object: 'Object',
	concept: 'Concept'
};

export const ELEMENT_TYPE_COLORS: Record<ElementType, string> = {
	character: '#3B82F6', // Blue
	location: '#22C55E', // Green
	object: '#F97316', // Orange
	concept: '#A855F7' // Purple
};

export interface ElementImage {
	id: string;
	imageUrl: string;
	revisedPrompt?: string;
	isActive: boolean;
	createdAt: Date;
}

export interface WorldElementVersion {
	id: string;
	name: string;
	description: string;
	enhancedDescription?: string;
	images: ElementImage[];
	createdAt: Date;
}

export interface WorldElement {
	id: string;
	name: string;
	type: ElementType;
	description: string;
	enhancedDescription?: string;
	preEnhancementDescription?: string;
	isEnhanced: boolean;
	images: ElementImage[];
	historyIndex: number;
	history: WorldElementVersion[];
	createdAt: Date;
	updatedAt: Date;
}

export interface WorldState {
	elements: WorldElement[];
	isGenerating: boolean;
	generatingElementId: string | null;
	selectedElementId: string | null;
	expandedElementIds: Set<string>;
	filterType: ElementType | 'all';
	customDescription: string;
	customType: ElementType;
}

const initialState: WorldState = {
	elements: [],
	isGenerating: false,
	generatingElementId: null,
	selectedElementId: null,
	expandedElementIds: new Set(),
	filterType: 'all',
	customDescription: '',
	customType: 'character'
};

export const worldStore = writable<WorldState>(initialState);

export function resetWorldStore() {
	worldStore.set({ ...initialState, expandedElementIds: new Set() });
}

/**
 * Get current state for persistence (converts Set to Array for JSON serialization)
 */
export function getWorldStoreState(): WorldState & { expandedElementIds: string[] } {
	let state: WorldState = initialState;
	worldStore.subscribe((s) => (state = s))();
	return {
		...state,
		expandedElementIds: [...state.expandedElementIds]
	};
}

/**
 * Load state from persisted data (converts Array back to Set)
 */
export function loadWorldStoreState(
	state: Partial<WorldState & { expandedElementIds: string[] }>
) {
	worldStore.update((s) => ({
		...s,
		...state,
		expandedElementIds: new Set(state.expandedElementIds || []),
		// Reset transient UI state
		isGenerating: false,
		generatingElementId: null
	}));
}

// Helper to get active image URL for an element
export function getActiveElementImageUrl(element: WorldElement): string | undefined {
	if (!element.images || element.images.length === 0) return undefined;
	const active = element.images.find((img) => img.isActive);
	return active?.imageUrl || element.images[element.images.length - 1]?.imageUrl;
}

// Get elements by type
export function getElementsByType(elements: WorldElement[], type: ElementType): WorldElement[] {
	return elements.filter((el) => el.type === type);
}

// Add a new element
export function addElement(
	name: string,
	type: ElementType,
	description: string
): void {
	const id = `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const now = new Date();

	const newElement: WorldElement = {
		id,
		name,
		type,
		description,
		isEnhanced: false,
		images: [],
		historyIndex: 0,
		history: [
			{
				id: `version-${Date.now()}`,
				name,
				description,
				images: [],
				createdAt: now
			}
		],
		createdAt: now,
		updatedAt: now
	};

	worldStore.update((state) => ({
		...state,
		elements: [...state.elements, newElement],
		customDescription: '',
		expandedElementIds: new Set([...state.expandedElementIds, id])
	}));
}

// Update element description
export function updateElementDescription(
	elementId: string,
	description: string,
	enhancedDescription?: string
): void {
	worldStore.update((state) => ({
		...state,
		elements: state.elements.map((el) =>
			el.id === elementId
				? {
						...el,
						description,
						enhancedDescription,
						updatedAt: new Date()
					}
				: el
		)
	}));
}

// Add image to element
export function addElementImage(
	elementId: string,
	imageUrl: string,
	revisedPrompt?: string
): void {
	const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	worldStore.update((state) => ({
		...state,
		elements: state.elements.map((el) =>
			el.id === elementId
				? {
						...el,
						images: [
							...el.images.map((img) => ({ ...img, isActive: false })),
							{
								id: imageId,
								imageUrl,
								revisedPrompt,
								isActive: true,
								createdAt: new Date()
							}
						],
						updatedAt: new Date()
					}
				: el
		)
	}));
}

// Set active image for element
export function setActiveElementImage(elementId: string, imageId: string): void {
	worldStore.update((state) => ({
		...state,
		elements: state.elements.map((el) =>
			el.id === elementId
				? {
						...el,
						images: el.images.map((img) => ({
							...img,
							isActive: img.id === imageId
						})),
						updatedAt: new Date()
					}
				: el
		)
	}));
}

// Delete image from element
export function deleteElementImage(elementId: string, imageId: string): void {
	worldStore.update((state) => ({
		...state,
		elements: state.elements.map((el) => {
			if (el.id !== elementId) return el;

			const updatedImages = el.images.filter((img) => img.id !== imageId);
			// If we deleted the active image, make the last one active
			const hasActive = updatedImages.some((img) => img.isActive);
			if (!hasActive && updatedImages.length > 0) {
				updatedImages[updatedImages.length - 1].isActive = true;
			}

			return {
				...el,
				images: updatedImages,
				updatedAt: new Date()
			};
		})
	}));
}

// Delete element
export function deleteElement(elementId: string): void {
	worldStore.update((state) => ({
		...state,
		elements: state.elements.filter((el) => el.id !== elementId),
		expandedElementIds: new Set(
			[...state.expandedElementIds].filter((id) => id !== elementId)
		),
		selectedElementId:
			state.selectedElementId === elementId ? null : state.selectedElementId
	}));
}

// Toggle element expanded state
export function toggleElementExpanded(elementId: string): void {
	worldStore.update((state) => {
		const newExpanded = new Set(state.expandedElementIds);
		if (newExpanded.has(elementId)) {
			newExpanded.delete(elementId);
		} else {
			newExpanded.add(elementId);
		}
		return {
			...state,
			expandedElementIds: newExpanded,
			selectedElementId: elementId
		};
	});
}

// Ensure element is expanded
export function ensureElementExpanded(elementId: string): void {
	worldStore.update((state) => {
		const newExpanded = new Set(state.expandedElementIds);
		newExpanded.add(elementId);
		return {
			...state,
			expandedElementIds: newExpanded,
			selectedElementId: elementId
		};
	});
}

// Load elements from story (auto-extraction)
// Returns the IDs of newly added elements for auto image generation
export function loadElementsFromStory(
	characters: Array<{ name: string; description: string }>,
	locations?: Array<{ name: string; description: string }>,
	objects?: Array<{ name: string; description: string }>,
	concepts?: Array<{ name: string; description: string }>
): WorldElement[] {
	let newlyAddedElements: WorldElement[] = [];

	worldStore.update((state) => {
		const existingNames = new Set(state.elements.map((el) => el.name.toLowerCase()));
		const newElements: WorldElement[] = [];
		const now = new Date();

		const createElements = (
			items: Array<{ name: string; description: string }> | undefined,
			type: ElementType
		) => {
			if (!items) return;
			for (const item of items) {
				// Smart matching - don't add if already exists
				if (!existingNames.has(item.name.toLowerCase())) {
					const id = `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
					newElements.push({
						id,
						name: item.name,
						type,
						description: item.description,
						isEnhanced: false,
						images: [],
						historyIndex: 0,
						history: [
							{
								id: `version-${Date.now()}`,
								name: item.name,
								description: item.description,
								images: [],
								createdAt: now
							}
						],
						createdAt: now,
						updatedAt: now
					});
					existingNames.add(item.name.toLowerCase());
				}
			}
		};

		createElements(characters, 'character');
		createElements(locations, 'location');
		createElements(objects, 'object');
		createElements(concepts, 'concept');

		newlyAddedElements = newElements;

		return {
			...state,
			elements: [...state.elements, ...newElements]
		};
	});

	return newlyAddedElements;
}

// Set filter type
export function setFilterType(type: ElementType | 'all'): void {
	worldStore.update((state) => ({
		...state,
		filterType: type
	}));
}
