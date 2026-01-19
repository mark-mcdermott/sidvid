import { writable } from 'svelte/store';
import type { StoryCharacter } from '$lib/sidvid';

export interface CharacterEntry {
	name: string;
	description: string;
	enhancedDescription?: string;
	imageUrl?: string;
	revisedPrompt?: string;
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
}

const initialState: CharacterState = {
	storyCharacters: [],
	customDescription: '',
	characters: [],
	isGenerating: false,
	selectedCharacterIndex: null
};

export const characterStore = writable<CharacterState>(initialState);

export function resetCharacterStore() {
	characterStore.set(initialState);
}

export function loadStoryCharacters(characters: StoryCharacter[]) {
	characterStore.update(state => ({
		...state,
		storyCharacters: characters,
		characters: characters.map(c => ({
			name: c.name,
			description: c.description
		}))
	}));
}
