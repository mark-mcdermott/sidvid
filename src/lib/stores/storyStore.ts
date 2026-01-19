import { writable } from 'svelte/store';
import type { ActionData } from '../../routes/story/$types';

export interface StoryEntry {
	story: NonNullable<ActionData['story']>;
	prompt: string;
	length: string;
}

export interface StoryState {
	prompt: string;
	selectedLength: { value: string; label: string };
	stories: StoryEntry[];
	isGenerating: boolean;
	isEditingManually: boolean;
	isEditingWithPrompt: boolean;
	isTryingAgain: boolean;
	editedStoryContent: string;
	editPrompt: string;
	tryAgainPrompt: string;
	tryAgainLength: { value: string; label: string };
}

const initialState: StoryState = {
	prompt: 'sci-fi anime',
	selectedLength: { value: '5s', label: '5s' },
	stories: [],
	isGenerating: false,
	isEditingManually: false,
	isEditingWithPrompt: false,
	isTryingAgain: false,
	editedStoryContent: '',
	editPrompt: '',
	tryAgainPrompt: '',
	tryAgainLength: { value: '5s', label: '5s' }
};

export const storyStore = writable<StoryState>(initialState);

export function resetStoryStore() {
	storyStore.set(initialState);
}
