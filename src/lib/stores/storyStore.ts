import { writable } from 'svelte/store';
import type { ActionData } from '../../routes/story/$types';

// Style presets per STATE-WORKFLOW-SPEC.md
export type StylePreset = 'anime' | 'photorealistic' | '3d-animated' | 'watercolor' | 'comic' | 'custom';

export const STYLE_OPTIONS: { value: StylePreset; label: string }[] = [
	{ value: 'anime', label: 'Anime' },
	{ value: 'photorealistic', label: 'Photorealistic' },
	{ value: '3d-animated', label: '3D Animated' },
	{ value: 'watercolor', label: 'Watercolor' },
	{ value: 'comic', label: 'Comic' },
	{ value: 'custom', label: 'Custom' }
];

export interface StoryEntry {
	story: NonNullable<ActionData['story']>;
	prompt: string;
	length: string;
	style?: StylePreset;
	customStylePrompt?: string;
}

export interface StoryState {
	prompt: string;
	selectedLength: { value: string; label: string };
	selectedStyle: StylePreset;
	customStylePrompt: string;
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
	prompt: '',
	selectedLength: { value: '5s', label: '5s' },
	selectedStyle: 'anime',
	customStylePrompt: '',
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
