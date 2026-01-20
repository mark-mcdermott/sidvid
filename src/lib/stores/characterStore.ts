import { writable } from 'svelte/store';
import type { StoryCharacter } from '$lib/sidvid';

export interface CharacterEntry {
	name: string;
	description: string;
	enhancedDescription?: string;
	imageUrl?: string;
	revisedPrompt?: string;
	isExpanded?: boolean;
}

export interface CharacterState {
	// Source data
	storyCharacters: StoryCharacter[];
	customDescription: string;

	// Generated characters
	characters: CharacterEntry[];

	// UI state
	isGenerating: boolean;
	selectedCharacterIndex: number | null;
	expandedCharacterIndices: Set<number>;
}

const initialState: CharacterState = {
	storyCharacters: [],
	customDescription: '',
	characters: [],
	isGenerating: false,
	selectedCharacterIndex: null,
	expandedCharacterIndices: new Set()
};

export const characterStore = writable<CharacterState>(initialState);

export function resetCharacterStore() {
	characterStore.set({ ...initialState, expandedCharacterIndices: new Set() });
}

export function loadStoryCharacters(characters: StoryCharacter[]) {
	characterStore.update(state => ({
		...state,
		storyCharacters: characters,
		characters: characters.map(c => ({
			name: c.name,
			description: c.description,
			isExpanded: false
		}))
	}));
}

export function toggleCharacterExpanded(index: number) {
	characterStore.update(state => {
		const newExpanded = new Set(state.expandedCharacterIndices);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		return {
			...state,
			expandedCharacterIndices: newExpanded,
			selectedCharacterIndex: index
		};
	});
}

export function ensureCharacterExpanded(index: number) {
	characterStore.update(state => {
		const newExpanded = new Set(state.expandedCharacterIndices);
		newExpanded.add(index);
		return {
			...state,
			expandedCharacterIndices: newExpanded,
			selectedCharacterIndex: index
		};
	});
}
