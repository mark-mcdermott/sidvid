<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Loader2, Play, Pause, RotateCcw, Volume2, VolumeX, Check, X, Edit, FlaskConical } from '@lucide/svelte';

	// Stores
	import { storyStore } from '$lib/stores/storyStore';
	import { characterStore, loadStoryCharacters, ensureCharacterExpanded } from '$lib/stores/characterStore';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import {
		storyboardStore,
		addSceneToWireframe,
		addCharacterToWireframe,
		removeCharacterFromWireframe,
		setWireframeDuration,
		selectWireframe,
		togglePlayback,
		setCurrentTime,
		createNewStoryboard,
		loadStoryboardFromStorage,
		saveStoryboardToStorage,
		setScenes,
		type WireframeScene,
		type WireframeCharacter
	} from '$lib/stores/storyboardStore';

	// Utils
	import { truncateTitle } from '$lib/sidvid/utils/conversation-helpers';
	import type { SceneSlot, Story } from '$lib/sidvid';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// ========== Testing Mode ==========
	let testingMode = $state(false);

	// ========== Active Section State ==========
	type Section = 'story' | 'characters' | 'scenes' | 'storyboard' | 'video';
	let activeSection = $state<Section>('story');

	// Section refs for scrolling
	let sectionRefs: Record<Section, HTMLElement | undefined> = {
		story: undefined,
		characters: undefined,
		scenes: undefined,
		storyboard: undefined,
		video: undefined
	};

	function scrollToSection(section: Section) {
		activeSection = section;
		sectionRefs[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ========== Story State ==========
	let storyCardElement: HTMLDivElement | undefined = $state();
	let editPromptElement: HTMLDivElement | undefined = $state();
	let latestStoryCardElement: HTMLDivElement | undefined = $state();
	let lastStoryRawContent = $state<string>('');
	let capturedPromptForNextStory = $state<string>('');
	let mainFormElement: HTMLFormElement | undefined = $state();
	let editFormElement: HTMLFormElement | undefined = $state();
	let tryAgainFormElement: HTMLFormElement | undefined = $state();

	const lengthOptions = [
		{ value: '2s', label: '2s' },
		{ value: '5s', label: '5s' },
		{ value: '10s', label: '10s' },
		{ value: '15s', label: '15s' },
		{ value: '30s', label: '30s' },
		{ value: '1m', label: '1m' },
		{ value: '2m', label: '2m' },
		{ value: '5m', label: '5m' },
		{ value: '10m', label: '10m' },
		{ value: '15m', label: '15m' },
		{ value: '30m', label: '30m' }
	];

	let selectedLengthValue = $state($storyStore.selectedLength.value);

	function handleStoryKeydown(e: KeyboardEvent, formElement?: HTMLFormElement) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			formElement?.requestSubmit();
		}
	}

	// ========== Character State ==========
	let isCharacterGenerating = $state(false);
	let isImproving = $state(false);
	let improvingType = $state<'smart' | 'regenerate' | null>(null);
	let activeCharacterIndex = $state(0);
	let lastProcessedEnhancedText = $state<string>('');
	let lastProcessedImageUrl = $state<string>('');
	let characterRefs: { [key: number]: HTMLDivElement } = {};
	let enhancedCharacters = $state<Set<number>>(new Set());
	let showPromptTextarea = $state<Set<number>>(new Set());
	let userPrompts = $state<{ [key: number]: string }>({});

	function getCurrentDescription(index: number) {
		const char = $characterStore.characters[index];
		return char?.enhancedDescription || char?.description || '';
	}

	function handleCharacterKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			addCustomCharacter();
		}
	}

	async function addCustomCharacter() {
		if ($characterStore.customDescription.trim()) {
			const customDesc = $characterStore.customDescription;
			characterStore.update(state => ({
				...state,
				characters: [
					...state.characters,
					{
						name: 'Custom Character',
						description: customDesc,
						isExpanded: false
					}
				],
				customDescription: ''
			}));
			await tick();
			const newIndex = $characterStore.characters.length - 1;
			await handleCharacterClick(newIndex);
		}
	}

	async function handleCharacterClick(index: number) {
		if ($characterStore.expandedCharacterIndices.has(index)) {
			await tick();
			characterRefs[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			ensureCharacterExpanded(index);
			activeCharacterIndex = index;
			await tick();
			characterRefs[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function openPromptTextarea(index: number) {
		showPromptTextarea = new Set([...showPromptTextarea, index]);
	}

	function closePromptTextarea(index: number) {
		showPromptTextarea = new Set([...showPromptTextarea].filter(i => i !== index));
		userPrompts[index] = '';
	}

	// ========== Scene State ==========
	let dragOverIndex = $state<number | null>(null);
	let generatingSlots = $state<Set<string>>(new Set());
	let localSlots = $state<SceneSlot[]>([]);
	let lastProcessedFormId = $state<string | null>(null);
	let sessionPipeline = $derived($sessionStore.activeSession?.getScenePipeline());
	let slots = $derived(sessionPipeline?.slots || localSlots);

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleSceneDrop(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = null;
		// Scene drop handling
	}

	function getCharacterById(characterId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return null;
		return session.extractCharacters().find(c => c.id === characterId);
	}

	function getCharacterDescriptions(slot: SceneSlot): string {
		const session = $sessionStore.activeSession;
		if (!session || slot.characterIds.length === 0) return '';

		const chars = session.extractCharacters();
		return slot.characterIds
			.map(id => chars.find(c => c.id === id))
			.filter(Boolean)
			.map(c => c!.enhancedDescription || c!.description)
			.join('. ');
	}

	function addSlot() {
		const session = $sessionStore.activeSession;
		if (!session) return;

		let currentPipeline = session.getScenePipeline();
		if (!currentPipeline) {
			session.initializeScenePipeline();
		}

		session.addSlot();
		sessionStore.update(s => ({ ...s }));
	}

	function removeSlot(slotId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return;

		session.removeSlot(slotId);
		sessionStore.update(s => ({ ...s }));
	}

	let slotsWithContent = $derived(
		slots.filter(s => s.storyScene.description || s.customDescription || s.characterIds.length > 0)
	);

	let showGenerateButton = $derived(slotsWithContent.length > 0);
	let hasGeneratedImages = $derived(slots.some(s => s.status === 'completed' && s.generatedScene?.imageUrl));
	let isAnyGenerating = $derived(generatingSlots.size > 0 || slots.some(s => s.status === 'generating'));
	let pendingCount = $derived(slots.filter(s => s.status === 'pending').length);
	let completedCount = $derived(slots.filter(s => s.status === 'completed').length);
	let generatingCount = $derived(slots.filter(s => s.status === 'generating').length + generatingSlots.size);

	// ========== Storyboard State ==========
	let editingWireframes = $state<Set<string>>(new Set());
	let editPrompts = $state<Record<string, string>>({});
	let regeneratingWireframes = $state<Set<string>>(new Set());
	let availableCharacters = $state<WireframeCharacter[]>([]);
	let playbackInterval: ReturnType<typeof setInterval> | null = null;

	function handleStoryboardDragStart(e: DragEvent, type: 'scene' | 'character', data: WireframeScene | WireframeCharacter) {
		e.dataTransfer?.setData('application/json', JSON.stringify({ type, data }));
	}

	function handleStoryboardDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleStoryboardDrop(e: DragEvent, wireframeId: string) {
		e.preventDefault();
		const json = e.dataTransfer?.getData('application/json');
		if (!json) return;

		try {
			const { type, data } = JSON.parse(json);
			if (type === 'scene') {
				addSceneToWireframe(wireframeId, data as WireframeScene);
			} else if (type === 'character') {
				addCharacterToWireframe(wireframeId, data as WireframeCharacter);
			}
		} catch (error) {
			console.error('Drop error:', error);
		}
	}

	function handleWireframeClick(wireframeId: string) {
		selectWireframe(wireframeId);
	}

	function handleDurationChange(wireframeId: string, value: string) {
		const duration = parseInt(value, 10);
		if (!isNaN(duration) && duration > 0) {
			setWireframeDuration(wireframeId, duration);
		}
	}

	function handleRemoveCharacter(wireframeId: string, characterId: string) {
		removeCharacterFromWireframe(wireframeId, characterId);
	}

	function handleNewStoryboard() {
		createNewStoryboard();
	}

	function toggleEditMode(wireframeId: string) {
		if (editingWireframes.has(wireframeId)) {
			editingWireframes = new Set([...editingWireframes].filter(id => id !== wireframeId));
		} else {
			editingWireframes = new Set([...editingWireframes, wireframeId]);
		}
	}

	function formatTime(seconds: number): string {
		return `${Math.floor(seconds)}s`;
	}

	let availableScenes = $derived(
		$storyboardStore.wireframes
			.filter(wf => wf.scene !== null)
			.map(wf => wf.scene!)
	);

	let totalStoryboardDuration = $derived(
		$storyboardStore.timelineItems.reduce((sum, item) => sum + item.duration, 0)
	);

	let hasStoryboardContent = $derived(
		$storyboardStore.wireframes.some(wf => wf.scene !== null || wf.characters.length > 0)
	);

	// ========== Video State ==========
	interface SceneVideo {
		sceneIndex: number;
		sceneId: string;
		sceneName: string;
		sceneImageUrl: string;
		videoId: string | null;
		videoUrl: string | null;
		status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
		progress: number;
		error: string | null;
		retryCount: number;
	}

	const MAX_RETRIES = 3;
	const RETRY_DELAY_MS = 10000;

	let sceneVideos = $state<SceneVideo[]>([]);
	let currentGeneratingIndex = $state<number>(-1);
	let isVideoGenerating = $state(false);
	let overallProgress = $state(0);
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

	let selectedProvider = $state<'mock' | 'kling'>('kling');
	let enableSound = $state(true);

	let videoElement = $state<HTMLVideoElement | null>(null);
	let currentPlayingIndex = $state(0);
	let isPlaying = $state(false);

	const mockScenes = [
		{
			id: 'mock-1',
			imageUrl: 'https://picsum.photos/seed/capybara1/1280/720',
			name: 'Cybernetic capybaras in neon-lit server room'
		},
		{
			id: 'mock-2',
			imageUrl: 'https://picsum.photos/seed/capybara2/1280/720',
			name: 'Capybaras hacking mainframe terminal'
		}
	];

	let sceneThumbnails = $derived(
		$storyboardStore.wireframes.filter(wf => wf.scene !== null).length > 0
			? $storyboardStore.wireframes
					.filter(wf => wf.scene !== null)
					.map(wf => ({
						id: wf.id,
						imageUrl: wf.scene!.imageUrl,
						name: wf.scene!.name
					}))
			: mockScenes
	);

	let pollInterval: ReturnType<typeof setInterval> | null = null;

	let allCompleted = $derived(
		sceneVideos.length > 0 && sceneVideos.every(sv => sv.status === 'completed')
	);

	let currentVideoUrl = $derived(
		sceneVideos[currentPlayingIndex]?.videoUrl || null
	);

	let completedVideos = $derived(
		sceneVideos.filter(sv => sv.status === 'completed')
	);

	let hasScenes = $derived(sceneThumbnails.length > 0);
	let totalVideoDuration = $derived(sceneVideos.length * 5);

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(() => {
			const generatingScene = sceneVideos.find(sv =>
				sv.videoId && (sv.status === 'queued' || sv.status === 'generating')
			);
			if (generatingScene) {
				const statusForm = document.getElementById(`status-check-form-${generatingScene.sceneIndex}`) as HTMLFormElement;
				if (statusForm) {
					statusForm.requestSubmit();
				}
			} else {
				stopPolling();
			}
		}, 5000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function startGeneratingAllScenes() {
		isVideoGenerating = true;
		currentGeneratingIndex = 0;

		if (retryTimeoutId) {
			clearTimeout(retryTimeoutId);
			retryTimeoutId = null;
		}

		sceneVideos = sceneVideos.map(sv => ({
			...sv,
			videoId: null,
			videoUrl: null,
			status: 'pending' as const,
			progress: 0,
			error: null,
			retryCount: 0
		}));

		generateNextScene();
	}

	function generateNextScene(delay: number = 0) {
		const nextPendingIndex = sceneVideos.findIndex(sv => sv.status === 'pending');

		if (nextPendingIndex === -1) {
			isVideoGenerating = false;
			currentGeneratingIndex = -1;
			stopPolling();
			return;
		}

		currentGeneratingIndex = nextPendingIndex;

		const submitForm = () => {
			const form = document.getElementById(`generate-form-${nextPendingIndex}`) as HTMLFormElement;
			if (form) {
				form.requestSubmit();
			}
		};

		if (delay > 0) {
			retryTimeoutId = setTimeout(submitForm, delay);
		} else {
			submitForm();
		}
	}

	function handleVideoEnded() {
		if (currentPlayingIndex < completedVideos.length - 1) {
			currentPlayingIndex++;
			setTimeout(() => {
				videoElement?.play();
			}, 100);
		} else {
			isPlaying = false;
		}
	}

	function handleRegenerate() {
		if (retryTimeoutId) {
			clearTimeout(retryTimeoutId);
			retryTimeoutId = null;
		}

		sceneVideos = sceneVideos.map(sv => ({
			...sv,
			videoId: null,
			videoUrl: null,
			status: 'pending' as const,
			progress: 0,
			error: null,
			retryCount: 0
		}));
		currentPlayingIndex = 0;
		isPlaying = false;
	}

	function playFromScene(index: number) {
		currentPlayingIndex = index;
		setTimeout(() => {
			videoElement?.play();
			isPlaying = true;
		}, 100);
	}

	function loadTestVideos() {
		sceneVideos = sceneVideos.map((sv, idx) => ({
			...sv,
			videoUrl: idx === 0
				? 'https://tempfile.aiquickdraw.com/h/7606ab4948924b782c10b86a797717ee_1769128334.mp4'
				: 'https://tempfile.aiquickdraw.com/h/0debb33d4be73af035dc263ebe58b06f_1769129630.mp4',
			status: 'completed' as const,
			progress: 100
		}));
		isVideoGenerating = false;
		stopPolling();
	}

	// ========== Test Data ==========
	const TEST_DATA = {
		story: {
			title: 'Neon Capybara Heist',
			rawContent: JSON.stringify({
				title: 'Neon Capybara Heist',
				scenes: [
					{
						number: 1,
						description: 'A neon-lit server room in a dystopian megacity. Rows of humming mainframes cast an eerie blue glow. Two cybernetic capybaras crouch behind a terminal.',
						dialogue: 'Chip, disable the firewall. We have 30 seconds.',
						action: 'Byte types furiously on a holographic keyboard while Chip plugs into the mainframe.'
					},
					{
						number: 2,
						description: 'Alarms blare as red lights flood the room. Security drones descend from the ceiling. The capybaras exchange a knowing glance.',
						dialogue: 'Time to go swimming.',
						action: 'They dive into a cooling vent, escaping into the city sewers below.'
					}
				],
				characters: [
					{ name: 'Byte', description: 'A sleek cybernetic capybara with glowing blue circuit patterns across their fur, expert hacker' },
					{ name: 'Chip', description: 'A muscular capybara with a chrome-plated arm and infrared eye implant, the muscle of the operation' }
				]
			}),
			scenes: [
				{
					number: 1,
					description: 'A neon-lit server room in a dystopian megacity. Rows of humming mainframes cast an eerie blue glow. Two cybernetic capybaras crouch behind a terminal.',
					dialogue: 'Chip, disable the firewall. We have 30 seconds.',
					action: 'Byte types furiously on a holographic keyboard while Chip plugs into the mainframe.'
				},
				{
					number: 2,
					description: 'Alarms blare as red lights flood the room. Security drones descend from the ceiling. The capybaras exchange a knowing glance.',
					dialogue: 'Time to go swimming.',
					action: 'They dive into a cooling vent, escaping into the city sewers below.'
				}
			],
			characters: [
				{ name: 'Byte', description: 'A sleek cybernetic capybara with glowing blue circuit patterns across their fur, expert hacker' },
				{ name: 'Chip', description: 'A muscular capybara with a chrome-plated arm and infrared eye implant, the muscle of the operation' }
			]
		},
		characters: [
			{
				name: 'Byte',
				description: 'A sleek cybernetic capybara with glowing blue circuit patterns across their fur, expert hacker',
				enhancedDescription: 'Byte is a sleek, medium-sized capybara with dark brown fur interlaced with bioluminescent blue circuit patterns that pulse gently when processing data. Their eyes have been replaced with advanced optical implants that glow cyan. A neural interface port sits behind their left ear.',
				imageUrl: 'https://picsum.photos/seed/byte-capybara/512/512'
			},
			{
				name: 'Chip',
				description: 'A muscular capybara with a chrome-plated arm and infrared eye implant, the muscle of the operation',
				enhancedDescription: 'Chip is a large, imposing capybara with sandy brown fur and a fully chrome-plated cybernetic right arm capable of interfacing with any system. Their left eye has been replaced with a red infrared sensor that can see through walls. Battle scars cross their snout.',
				imageUrl: 'https://picsum.photos/seed/chip-capybara/512/512'
			}
		],
		scenes: [
			{
				id: 'test-scene-1',
				storySceneIndex: 0,
				storyScene: {
					number: 1,
					description: 'A neon-lit server room in a dystopian megacity. Rows of humming mainframes cast an eerie blue glow. Two cybernetic capybaras crouch behind a terminal.',
					dialogue: 'Chip, disable the firewall. We have 30 seconds.',
					action: 'Byte types furiously on a holographic keyboard while Chip plugs into the mainframe.'
				},
				characterIds: [],
				status: 'completed' as const,
				generatedScene: {
					description: 'A neon-lit server room in a dystopian megacity',
					imageUrl: 'https://picsum.photos/seed/neon-server-room/1280/720'
				}
			},
			{
				id: 'test-scene-2',
				storySceneIndex: 1,
				storyScene: {
					number: 2,
					description: 'Alarms blare as red lights flood the room. Security drones descend from the ceiling. The capybaras exchange a knowing glance.',
					dialogue: 'Time to go swimming.',
					action: 'They dive into a cooling vent, escaping into the city sewers below.'
				},
				characterIds: [],
				status: 'completed' as const,
				generatedScene: {
					description: 'Alarms blare as red lights flood the room',
					imageUrl: 'https://picsum.photos/seed/alarm-room/1280/720'
				}
			}
		],
		storyboard: [
			{
				id: 'test-wf-1',
				scene: {
					id: 'test-scene-1',
					sceneNumber: 1,
					name: 'A neon-lit server room in a dystopian megacity',
					imageUrl: 'https://picsum.photos/seed/neon-server-room/1280/720',
					characterIds: []
				},
				characters: [],
				duration: 5
			},
			{
				id: 'test-wf-2',
				scene: {
					id: 'test-scene-2',
					sceneNumber: 2,
					name: 'Alarms blare as red lights flood the room',
					imageUrl: 'https://picsum.photos/seed/alarm-room/1280/720',
					characterIds: []
				},
				characters: [],
				duration: 5
			}
		],
		videos: [
			{
				sceneIndex: 0,
				sceneId: 'test-scene-1',
				sceneName: 'A neon-lit server room in a dystopian megacity',
				sceneImageUrl: 'https://picsum.photos/seed/neon-server-room/1280/720',
				videoUrl: 'https://tempfile.aiquickdraw.com/h/7606ab4948924b782c10b86a797717ee_1769128334.mp4'
			},
			{
				sceneIndex: 1,
				sceneId: 'test-scene-2',
				sceneName: 'Alarms blare as red lights flood the room',
				sceneImageUrl: 'https://picsum.photos/seed/alarm-room/1280/720',
				videoUrl: 'https://tempfile.aiquickdraw.com/h/0debb33d4be73af035dc263ebe58b06f_1769129630.mp4'
			}
		]
	};

	function loadTestStory() {
		storyStore.update(state => ({
			...state,
			prompt: 'anime: cybernetic humanoid capybaras hacking into a dystopian government mainframe',
			stories: [{
				story: TEST_DATA.story as Story,
				prompt: 'anime: cybernetic humanoid capybaras hacking into a dystopian government mainframe',
				length: '10s'
			}]
		}));
	}

	function loadTestCharacters() {
		// First load story if not present
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}

		characterStore.update(state => ({
			...state,
			storyCharacters: TEST_DATA.characters,
			characters: TEST_DATA.characters.map(c => ({
				...c,
				isExpanded: false
			})),
			expandedCharacterIndices: new Set([0, 1])
		}));
		enhancedCharacters = new Set([0, 1]);
	}

	function loadTestScenes() {
		// First load story and characters if not present
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}
		if ($characterStore.characters.length === 0) {
			loadTestCharacters();
		}

		localSlots = TEST_DATA.scenes.map(s => ({
			...s,
			status: s.status as 'pending' | 'generating' | 'completed' | 'failed'
		}));
	}

	function loadTestStoryboard() {
		// First load all previous steps if not present
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}
		if ($characterStore.characters.length === 0) {
			loadTestCharacters();
		}
		if (slots.length === 0 || !slots.some(s => s.status === 'completed')) {
			loadTestScenes();
		}

		storyboardStore.update(state => ({
			...state,
			wireframes: TEST_DATA.storyboard.map(wf => ({
				...wf,
				scene: wf.scene as WireframeScene | null,
				characters: wf.characters as WireframeCharacter[]
			})),
			selectedWireframeId: TEST_DATA.storyboard[0].id
		}));
	}

	function loadTestVideo() {
		// First load all previous steps if not present
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}
		if ($characterStore.characters.length === 0) {
			loadTestCharacters();
		}
		if (slots.length === 0 || !slots.some(s => s.status === 'completed')) {
			loadTestScenes();
		}
		if ($storyboardStore.wireframes.length === 0 || !$storyboardStore.wireframes.some(wf => wf.scene !== null)) {
			loadTestStoryboard();
		}

		sceneVideos = TEST_DATA.videos.map(v => ({
			...v,
			videoId: `test-video-${v.sceneIndex}`,
			status: 'completed' as const,
			progress: 100,
			error: null,
			retryCount: 0
		}));
		isVideoGenerating = false;
		stopPolling();
	}

	// ========== Effects ==========

	// Story effects
	$effect(() => {
		const selectedOption = lengthOptions.find(opt => opt.value === selectedLengthValue);
		if (selectedOption && selectedOption.value !== $storyStore.selectedLength.value) {
			storyStore.update(state => ({
				...state,
				selectedLength: selectedOption
			}));
		}
	});

	$effect(() => {
		selectedLengthValue = $storyStore.selectedLength.value;
	});

	// Story form effect
	$effect(() => {
		if (form?.action === 'generateStory' && form?.success && form?.story) {
			const currentRawContent = form.story.rawContent;
			const lastContent = untrack(() => lastStoryRawContent);

			if (currentRawContent !== lastContent) {
				untrack(() => {
					let storyPrompt: string;
					if (capturedPromptForNextStory) {
						storyPrompt = capturedPromptForNextStory;
						capturedPromptForNextStory = '';
					} else if ($storyStore.isTryingAgain) {
						storyPrompt = $storyStore.tryAgainPrompt;
					} else {
						storyPrompt = $storyStore.prompt;
					}

					storyStore.update(state => ({
						...state,
						stories: [...state.stories, {
							story: form.story!,
							prompt: storyPrompt,
							length: (state.isTryingAgain ? state.tryAgainLength?.label : state.selectedLength?.label) || '5s'
						}],
						isEditingManually: false,
						editedStoryContent: ''
					}));
					lastStoryRawContent = currentRawContent;
				});
			}
		}
	});

	// Character effects
	$effect(() => {
		if (form?.action === 'enhanceDescription' && form?.success && form?.enhancedText && form.enhancedText !== lastProcessedEnhancedText) {
			lastProcessedEnhancedText = form.enhancedText;

			characterStore.update(state => {
				const updatedCharacters = [...state.characters];
				if (activeCharacterIndex < updatedCharacters.length) {
					updatedCharacters[activeCharacterIndex] = {
						...updatedCharacters[activeCharacterIndex],
						enhancedDescription: form.enhancedText
					};
				}
				return { ...state, characters: updatedCharacters };
			});

			enhancedCharacters = new Set([...enhancedCharacters, activeCharacterIndex]);
			showPromptTextarea = new Set([...showPromptTextarea].filter(i => i !== activeCharacterIndex));
		}

		if (form?.action === 'generateImage' && form?.success && form?.character && form.character.imageUrl !== lastProcessedImageUrl) {
			lastProcessedImageUrl = form.character.imageUrl;

			characterStore.update(state => {
				const updatedCharacters = [...state.characters];
				if (activeCharacterIndex < updatedCharacters.length) {
					updatedCharacters[activeCharacterIndex] = {
						...updatedCharacters[activeCharacterIndex],
						imageUrl: form.character.imageUrl,
						revisedPrompt: form.character.revisedPrompt
					};
				}
				return { ...state, characters: updatedCharacters };
			});
		}
	});

	// Scene effects
	$effect(() => {
		if (!form?.slotId) return;

		const formResultId = `${form.action}-${form.slotId}-${form.success}-${form.imageUrl || 'no-image'}`;

		if (formResultId === lastProcessedFormId) return;

		if (form?.action === 'generateSlotImage' || form?.action === 'regenerateSlotImage') {
			lastProcessedFormId = formResultId;

			if (form.success && form.slotId && form.imageUrl) {
				const session = $sessionStore.activeSession;
				if (session) {
					const pipeline = session.getScenePipeline();
					if (pipeline) {
						const slotIndex = pipeline.slots.findIndex(s => s.id === form.slotId);
						if (slotIndex !== -1) {
							pipeline.slots[slotIndex] = {
								...pipeline.slots[slotIndex],
								status: 'completed',
								generatedScene: {
									description: pipeline.slots[slotIndex].customDescription || pipeline.slots[slotIndex].storyScene.description,
									imageUrl: form.imageUrl,
									revisedPrompt: form.revisedPrompt
								},
								error: undefined
							};
							sessionStore.update(s => ({ ...s }));
						}
					}
				} else {
					const slotIndex = localSlots.findIndex(s => s.id === form.slotId);
					if (slotIndex !== -1) {
						localSlots = localSlots.map((s, i) =>
							i === slotIndex ? {
								...s,
								status: 'completed' as const,
								generatedScene: {
									description: s.customDescription || s.storyScene.description,
									imageUrl: form.imageUrl!,
									revisedPrompt: form.revisedPrompt
								},
								error: undefined
							} : s
						);
					}
				}
			}
		}
	});

	// Storyboard effects
	$effect(() => {
		if (form?.action === 'editSlotWithPrompt') {
			if (form.success && form.wireframeId && form.imageUrl) {
				storyboardStore.update(state => {
					const wireframes = state.wireframes.map(wf => {
						if (wf.id === form.wireframeId && wf.scene) {
							return {
								...wf,
								scene: {
									...wf.scene,
									imageUrl: form.imageUrl
								}
							};
						}
						return wf;
					});
					return { ...state, wireframes };
				});
				editingWireframes = new Set([...editingWireframes].filter(id => id !== form.wireframeId));
				regeneratingWireframes = new Set([...regeneratingWireframes].filter(id => id !== form.wireframeId));
			}
		}
	});

	$effect(() => {
		if ($storyboardStore.isPlaying) {
			playbackInterval = setInterval(() => {
				const newTime = $storyboardStore.currentTime + 0.1;
				if (newTime >= $storyboardStore.totalDuration) {
					togglePlayback();
					setCurrentTime(0);
				} else {
					setCurrentTime(newTime);
				}
			}, 100);
		} else {
			if (playbackInterval) {
				clearInterval(playbackInterval);
				playbackInterval = null;
			}
		}
	});

	$effect(() => {
		if ($storyboardStore.wireframes) {
			saveStoryboardToStorage();
		}
	});

	// Video effects
	$effect(() => {
		if (sceneThumbnails.length > 0 && sceneVideos.length === 0) {
			sceneVideos = sceneThumbnails.map((thumb, index) => ({
				sceneIndex: index,
				sceneId: thumb.id,
				sceneName: thumb.name,
				sceneImageUrl: thumb.imageUrl,
				videoId: null,
				videoUrl: null,
				status: 'pending',
				progress: 0,
				error: null,
				retryCount: 0
			}));
		}
	});

	$effect(() => {
		if (sceneVideos.length > 0) {
			const totalProgress = sceneVideos.reduce((sum, sv) => sum + sv.progress, 0);
			overallProgress = Math.round(totalProgress / sceneVideos.length);
		}
	});

	$effect(() => {
		if (form?.action === 'generateSceneVideo') {
			if (form.success && form.videoId && form.sceneIndex !== undefined) {
				const videoId = form.videoId;
				const sceneIdx = form.sceneIndex;
				sceneVideos = sceneVideos.map((sv, idx) =>
					idx === sceneIdx
						? { ...sv, videoId: videoId, status: 'queued' as const, progress: 0 }
						: sv
				);
				setTimeout(() => startPolling(), 100);
			} else if (!form.success && form.sceneIndex !== undefined) {
				const failedIndex = form.sceneIndex;
				const currentScene = sceneVideos[failedIndex];
				const isRateLimited = form.error?.includes('frequency') || form.error?.includes('rate');

				if (isRateLimited && currentScene && currentScene.retryCount < MAX_RETRIES) {
					const retryCount = currentScene.retryCount + 1;
					const delayMs = RETRY_DELAY_MS * retryCount;

					sceneVideos = sceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, retryCount, error: `Rate limited, retrying in ${delayMs/1000}s...` }
							: sv
					);

					retryTimeoutId = setTimeout(() => {
						const retryForm = document.getElementById(`generate-form-${failedIndex}`) as HTMLFormElement;
						if (retryForm) {
							retryForm.requestSubmit();
						}
					}, delayMs);
				} else {
					sceneVideos = sceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, status: 'failed' as const, error: form.error || 'Failed to start' }
							: sv
					);
					generateNextScene();
				}
			}
		} else if (form?.action === 'checkSceneVideoStatus') {
			if (form.success && form.sceneIndex !== undefined) {
				const sceneIndex = form.sceneIndex;
				const newStatus = form.status === 'completed' ? 'completed' :
					form.status === 'failed' ? 'failed' :
					form.status === 'in_progress' ? 'generating' : 'queued';

				sceneVideos = sceneVideos.map((sv, idx) =>
					idx === sceneIndex
						? {
								...sv,
								status: newStatus as SceneVideo['status'],
								progress: form.progress || 0,
								videoUrl: form.videoUrl || sv.videoUrl,
								error: form.status === 'failed' ? (form.error || 'Generation failed') : null
							}
						: sv
				);

				if (form.status === 'completed' || form.status === 'failed') {
					generateNextScene(5000);
				}
			}
		}
	});

	// ========== Helper functions ==========

	function startManualEdit() {
		const latestEntry = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestEntry) {
			storyStore.update(state => ({
				...state,
				editedStoryContent: latestEntry.story.rawContent,
				isEditingManually: true
			}));
			setTimeout(() => {
				latestStoryCardElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 0);
		}
	}

	function cancelEdit() {
		storyStore.update(state => ({
			...state,
			isEditingManually: false,
			editedStoryContent: ''
		}));
	}

	function saveChanges() {
		const latestEntry = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestEntry && $storyStore.editedStoryContent) {
			try {
				const parsed = JSON.parse($storyStore.editedStoryContent);
				storyStore.update(state => {
					const updatedStories = [...state.stories];
					updatedStories[updatedStories.length - 1] = {
						...latestEntry,
						story: {
							...latestEntry.story,
							rawContent: state.editedStoryContent,
							title: parsed.title || latestEntry.story.title,
							scenes: parsed.scenes || latestEntry.story.scenes
						}
					};
					return {
						...state,
						stories: updatedStories,
						isEditingManually: false
					};
				});
			} catch (error) {
				alert('Invalid JSON format. Please check your edits.');
			}
		}
	}

	function startPromptEdit() {
		storyStore.update(state => ({
			...state,
			isEditingWithPrompt: true,
			editPrompt: ''
		}));
		setTimeout(() => {
			editPromptElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 0);
	}

	function cancelPromptEdit() {
		storyStore.update(state => ({
			...state,
			isEditingWithPrompt: false,
			editPrompt: ''
		}));
	}

	function startTryAgain() {
		if ($storyStore.stories.length > 0 && tryAgainFormElement) {
			const promptInput = tryAgainFormElement.querySelector('input[name="prompt"]') as HTMLInputElement;
			const lengthInput = tryAgainFormElement.querySelector('input[name="length"]') as HTMLInputElement;

			if (promptInput) promptInput.value = $storyStore.prompt;
			if (lengthInput) lengthInput.value = $storyStore.selectedLength.value;

			tryAgainFormElement.requestSubmit();
		}
	}

	function goToCharacters() {
		const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestStory?.story.characters && latestStory.story.characters.length > 0) {
			loadStoryCharacters(latestStory.story.characters);
		}
		scrollToSection('characters');
	}

	function goToScenes() {
		// Initialize scene slots from story
		if (!$sessionStore.activeSession && $storyStore.stories.length > 0) {
			const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
			if (latestStory?.story?.scenes) {
				localSlots = latestStory.story.scenes.map((scene, index) => ({
					id: `slot-local-${Date.now()}-${index}`,
					storySceneIndex: index,
					storyScene: scene,
					characterIds: [],
					status: 'pending' as const
				}));
			}
		}
		scrollToSection('scenes');
	}

	function goToStoryboard() {
		// Store completed scenes in storyboardStore
		const completedSlots = slots.filter(s => s.status === 'completed' && s.generatedScene?.imageUrl);
		setScenes(completedSlots.map(s => ({
			id: s.id,
			sceneNumber: s.storyScene.number,
			description: s.customDescription || s.storyScene.description,
			imageUrl: s.generatedScene!.imageUrl,
			characterIds: s.characterIds
		})));
		scrollToSection('storyboard');
	}

	function goToVideo() {
		// Initialize video pipeline from session if available
		const session = $sessionStore.activeSession;
		if (session) {
			try {
				session.initializeVideoPipeline();
				sessionStore.update(s => ({ ...s }));
			} catch (e) {
				console.log('Could not initialize video pipeline:', e);
			}
		}
		scrollToSection('video');
	}

	onMount(() => {
		loadStoryboardFromStorage();

		const unsubscribe = characterStore.subscribe(charState => {
			availableCharacters = charState.characters
				.filter(c => c.imageUrl)
				.map((c, i) => ({
					id: `char-${i}`,
					name: c.name,
					imageUrl: c.imageUrl!
				}));
		});

		// Initialize scene slots if needed
		if (!$sessionStore.activeSession && $storyStore.stories.length > 0) {
			const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
			if (latestStory?.story?.scenes) {
				localSlots = latestStory.story.scenes.map((scene, index) => ({
					id: `slot-local-${Date.now()}-${index}`,
					storySceneIndex: index,
					storyScene: scene,
					characterIds: [],
					status: 'pending' as const
				}));
			}
		}

		return () => {
			unsubscribe();
			if (playbackInterval) clearInterval(playbackInterval);
			if (pollInterval) clearInterval(pollInterval);
			if (retryTimeoutId) clearTimeout(retryTimeoutId);
		};
	});
</script>

<!-- Testing Mode Toggle -->
<button
	onclick={() => testingMode = !testingMode}
	class="fixed bottom-4 right-4 z-50 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors {testingMode ? 'border-yellow-800 bg-yellow-200 text-yellow-800' : 'border-muted-foreground bg-muted text-muted-foreground hover:bg-muted/80'}"
	title="Toggle testing mode"
>
	<FlaskConical class="h-4 w-4" />
</button>

<div class="flex flex-col gap-8">
	<!-- ========== STORY SECTION ========== -->
	<section
		id="story"
		bind:this={sectionRefs.story}
		class="scroll-mt-16 border-b pb-8"
	>
		<form
			bind:this={mainFormElement}
			method="POST"
			action="?/generateStory"
			use:enhance={() => {
				const currentPrompt = $storyStore.prompt;
				storyStore.update(state => ({ ...state, isGenerating: true }));
				return async ({ update }) => {
					await update({ reset: false });
					storyStore.update(state => ({
						...state,
						isGenerating: false,
						prompt: currentPrompt
					}));
				};
			}}
		>
			<div class="flex flex-col gap-4">
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-3xl font-bold">Story Generation</h1>
						<p class="text-muted-foreground">Generate a story from your prompt using ChatGPT</p>
					</div>
					{#if testingMode}
						<div class="flex gap-1">
							<Button variant="outline" size="sm" onclick={() => storyStore.update(s => ({ ...s, prompt: 'anime: cybernetic humanoid capybaras hacking into a dystopian government mainframe' }))} title="Insert test prompt">
								<FlaskConical class="h-4 w-4 opacity-50" />
							</Button>
							<Button variant="outline" size="sm" onclick={loadTestStory} title="Load test data">
								<FlaskConical class="h-4 w-4" />
							</Button>
						</div>
					{/if}
				</div>

				{#if form?.action === 'generateStory' && form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				{#if $storyStore.stories.length === 0}
					<div class="w-full xl:max-w-[32rem]">
						<div class="mb-2">
							<label for="length" class="mb-1 block text-sm font-medium">Video Length</label>
							<Select.Root type="single" bind:value={selectedLengthValue}>
								<Select.Trigger class="w-32">
									{$storyStore.selectedLength.label}
								</Select.Trigger>
								<Select.Content>
									{#each lengthOptions as option}
										<Select.Item value={option.value} label={option.label}>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="length" value={$storyStore.selectedLength?.value || '5s'} />
						</div>

						<Textarea
							bind:value={$storyStore.prompt}
							name="prompt"
							placeholder="Enter your story prompt (e.g., 'A detective solving a mystery in a futuristic city'). Press Enter to submit, Shift+Enter for new line."
							class="min-h-32"
							required
							onkeydown={(e) => handleStoryKeydown(e, mainFormElement)}
						/>
					</div>

					<div class="flex gap-2">
						<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.prompt.trim()}>
							{#if $storyStore.isGenerating}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Generating...
							{:else}
								Generate Story
							{/if}
						</Button>
					</div>
				{/if}

				{#each $storyStore.stories as entry, index}
					<div class="my-4 rounded-md bg-muted/30 p-3 text-sm">
						<p class="font-medium text-muted-foreground">Prompt ({entry.length}):</p>
						<p class="mt-1">{entry.prompt}</p>
					</div>

					{#if index === $storyStore.stories.length - 1}
						<div bind:this={latestStoryCardElement} class="flex flex-col gap-4 rounded-md border p-4">
							{#if $storyStore.isEditingManually}
								<div class="flex flex-col gap-4">
									<h2 class="text-xl font-semibold">Edit Story</h2>
									<Textarea
										bind:value={$storyStore.editedStoryContent}
										class="min-h-96 font-mono text-sm"
										placeholder="Edit your story here..."
									/>
									<div class="flex gap-2">
										<Button onclick={cancelEdit} variant="outline">Cancel</Button>
										<Button onclick={saveChanges}>Save Changes</Button>
									</div>
								</div>
							{:else}
								<div>
									<h2 class="text-xl font-semibold">{entry.story.title}</h2>
								</div>
								<div class="space-y-4">
									{#each entry.story.scenes as scene}
										<div class="rounded-md bg-muted/50 p-3" data-scene-number={scene.number}>
											<h3 class="mb-2 font-semibold">Scene {scene.number}</h3>

											<div class="mb-2">
												<p class="text-xs font-medium text-muted-foreground uppercase">Description:</p>
												<p class="text-sm">{scene.description}</p>
											</div>

											{#if scene.dialogue}
												<div class="mb-2">
													<p class="text-xs font-medium text-muted-foreground uppercase">Dialogue:</p>
													<p class="text-sm italic">"{scene.dialogue}"</p>
												</div>
											{/if}

											{#if scene.action}
												<div>
													<p class="text-xs font-medium text-muted-foreground uppercase">Action:</p>
													<p class="text-sm">{scene.action}</p>
												</div>
											{/if}
										</div>
									{/each}
								</div>
								<details class="text-sm">
									<summary class="cursor-pointer font-medium">View raw content</summary>
									<p class="mt-2 whitespace-pre-wrap text-muted-foreground">{entry.story.rawContent}</p>
								</details>
							{/if}
						</div>
					{:else}
						<div class="flex flex-col gap-4 rounded-md border p-4 opacity-60">
							<div>
								<h2 class="text-xl font-semibold">{entry.story.title}</h2>
							</div>
							<div class="space-y-4">
								{#each entry.story.scenes as scene}
									<div class="rounded-md bg-muted/50 p-3">
										<h3 class="mb-2 font-semibold">Scene {scene.number}</h3>
										<p class="text-sm">{scene.description}</p>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					{#if !$storyStore.isEditingManually && index === $storyStore.stories.length - 1}
						<div class="flex gap-2">
							<Button
								type="button"
								onclick={startTryAgain}
								variant="outline"
								disabled={$storyStore.isGenerating}
							>
								{#if $storyStore.isGenerating}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Regenerating...
								{:else}
									Try Again
								{/if}
							</Button>
							<Button onclick={startManualEdit} variant="outline">Edit Story Manually</Button>
							<Button onclick={startPromptEdit} variant="outline">Edit Story with Prompt</Button>
							<Button onclick={goToCharacters}>Send to Character Generation</Button>
						</div>

						{#if $storyStore.isEditingWithPrompt}
							<form
								bind:this={editFormElement}
								method="POST"
								action="?/editStory"
								use:enhance={() => {
									storyStore.update(state => ({ ...state, isGenerating: true }));
									capturedPromptForNextStory = `Edit: ${$storyStore.editPrompt}`;
									return async ({ update }) => {
										await update({ reset: false });
										storyStore.update(state => ({
											...state,
											isGenerating: false,
											isEditingWithPrompt: false,
											editPrompt: ''
										}));
									};
								}}
							>
								<div bind:this={editPromptElement} class="flex flex-col gap-4 rounded-md border p-4">
									<h3 class="text-lg font-semibold">Edit Story with Prompt</h3>
									<p class="text-sm text-muted-foreground">
										Describe the changes you want to make to the story
									</p>
									<input type="hidden" name="currentStory" value={entry.story.rawContent} />
									<input type="hidden" name="length" value={$storyStore.selectedLength?.value || '5s'} />
									<Textarea
										bind:value={$storyStore.editPrompt}
										name="editPrompt"
										placeholder="E.g., 'Add more action to scene 2' or 'Make the dialogue more dramatic'. Press Enter to submit, Shift+Enter for new line."
										class="min-h-32"
										onkeydown={(e) => handleStoryKeydown(e, editFormElement)}
									/>
									<div class="flex gap-2">
										<Button type="button" onclick={cancelPromptEdit} variant="outline">Cancel</Button>
										<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.editPrompt.trim()}>
											{#if $storyStore.isGenerating}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Regenerating...
											{:else}
												Regenerate Story
											{/if}
										</Button>
									</div>
								</div>
							</form>
						{/if}
					{/if}
				{/each}
			</div>
		</form>

		<form
			bind:this={tryAgainFormElement}
			method="POST"
			action="?/generateStory"
			class="hidden"
			use:enhance={() => {
				const currentPrompt = $storyStore.prompt;
				storyStore.update(state => ({ ...state, isGenerating: true }));
				return async ({ update }) => {
					await update({ reset: false });
					storyStore.update(state => ({
						...state,
						isGenerating: false,
						prompt: currentPrompt
					}));
				};
			}}
		>
			<input type="hidden" name="prompt" value={$storyStore.prompt} />
			<input type="hidden" name="length" value={$storyStore.selectedLength.value} />
		</form>
	</section>

	<!-- ========== CHARACTERS SECTION ========== -->
	<section
		id="characters"
		bind:this={sectionRefs.characters}
		class="scroll-mt-16 border-b pb-8"
	>
		<div class="flex flex-col gap-4">
			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-bold">Character Generation</h1>
					<p class="text-muted-foreground">
						{#if $characterStore.storyCharacters.length > 0}
							Generate character images from your story, or add custom characters
						{:else}
							Create and generate character images
						{/if}
					</p>
				</div>
				{#if testingMode}
					<Button variant="outline" size="sm" onclick={loadTestCharacters} title="Load test data">
						<FlaskConical class="h-4 w-4" />
					</Button>
				{/if}
			</div>

			{#if form?.action?.includes('Description') && form?.error}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}

			{#if $characterStore.characters.length > 0}
				<div class="rounded-md border p-4">
					<h2 class="mb-3 text-lg font-semibold">
						{#if $characterStore.storyCharacters.length > 0}
							Characters from Story
						{:else}
							Characters
						{/if}
					</h2>
					<div class="flex flex-wrap gap-2">
						{#each $characterStore.characters as char, index}
							<Button
								variant={$characterStore.expandedCharacterIndices.has(index) ? 'default' : 'outline'}
								size="sm"
								onclick={() => handleCharacterClick(index)}
							>
								{char.name}
							</Button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="rounded-md border p-4">
				<h2 class="mb-3 text-lg font-semibold">Add Custom Character</h2>
				<div class="flex gap-2">
					<Textarea
						bind:value={$characterStore.customDescription}
						placeholder="Enter character description (e.g., 'A brave space captain with short silver hair'). Press Enter to add, Shift+Enter for new line."
						class="min-h-24 flex-1"
						onkeydown={handleCharacterKeydown}
					/>
					<Button onclick={addCustomCharacter} variant="outline">Add</Button>
				</div>
			</div>

			{#if $characterStore.characters.length > 0}
				<div class="flex justify-center">
					<Button onclick={goToScenes} size="lg">
						Begin Scene Generation
					</Button>
				</div>
			{/if}

			{#each $characterStore.characters as char, index}
				{#if $characterStore.expandedCharacterIndices.has(index)}
					<div
						bind:this={characterRefs[index]}
						class="flex flex-col gap-4 rounded-md border p-4"
						data-character-content={index}
					>
						<div>
							<h2 class="mb-2 text-xl font-semibold">{char.name}</h2>
							<p class="text-sm text-muted-foreground">{char.description}</p>
						</div>

						{#if char.enhancedDescription}
							<div class="rounded-md bg-muted/50 p-3">
								<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
									Enhanced Description:
								</p>
								<p class="text-sm">{char.enhancedDescription}</p>
							</div>
						{/if}

						{#if char.imageUrl}
							<div>
								<img src={char.imageUrl} alt={char.name} class="rounded-md" />
							</div>
						{/if}

						<div class="flex flex-col gap-3">
							<div class="flex flex-wrap gap-2">
								{#if !enhancedCharacters.has(index)}
									<form
										method="POST"
										action="?/enhanceDescription"
										use:enhance={() => {
											isCharacterGenerating = true;
											activeCharacterIndex = index;
											return async ({ update }) => {
												await update();
												isCharacterGenerating = false;
											};
										}}
									>
										<input type="hidden" name="description" value={getCurrentDescription(index)} />
										<Button
											type="submit"
											variant="outline"
											disabled={isCharacterGenerating || !char.description}
										>
											{#if isCharacterGenerating && activeCharacterIndex === index}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Enhancing...
											{:else}
												Enhance Description
											{/if}
										</Button>
									</form>
								{:else if !showPromptTextarea.has(index)}
									<form
										method="POST"
										action="?/improveDescription"
										use:enhance={() => {
											isImproving = true;
											improvingType = 'smart';
											activeCharacterIndex = index;
											return async ({ update }) => {
												await update();
												isImproving = false;
												improvingType = null;
											};
										}}
									>
										<input type="hidden" name="description" value={getCurrentDescription(index)} />
										<Button
											type="submit"
											variant="outline"
											disabled={isImproving || isCharacterGenerating}
										>
											{#if isImproving && activeCharacterIndex === index && improvingType === 'smart'}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Improving...
											{:else}
												Smart Improve Description
											{/if}
										</Button>
									</form>
									<Button
										variant="outline"
										onclick={() => openPromptTextarea(index)}
										disabled={isImproving || isCharacterGenerating}
									>
										Improve Description With Prompt
									</Button>
								{/if}

								<form
									method="POST"
									action="?/generateImage"
									use:enhance={() => {
										isCharacterGenerating = true;
										activeCharacterIndex = index;
										return async ({ update }) => {
											await update();
											isCharacterGenerating = false;
										};
									}}
								>
									<input type="hidden" name="description" value={getCurrentDescription(index)} />
									<Button type="submit" disabled={isCharacterGenerating || !getCurrentDescription(index)}>
										{#if isCharacterGenerating && activeCharacterIndex === index && form?.action === 'generateImage'}
											<Loader2 class="mr-2 h-4 w-4 animate-spin" />
											Generating...
										{:else}
											Generate Image
										{/if}
									</Button>
								</form>
							</div>

							{#if showPromptTextarea.has(index)}
								<div class="flex flex-col gap-2 rounded-md border p-3">
									<Textarea
										bind:value={userPrompts[index]}
										placeholder="Describe how you'd like to change the description..."
										class="min-h-20"
									/>
									<div class="flex gap-2">
										<form
											method="POST"
											action="?/improveDescription"
											use:enhance={() => {
												isImproving = true;
												improvingType = 'regenerate';
												activeCharacterIndex = index;
												return async ({ update }) => {
													await update();
													isImproving = false;
													improvingType = null;
												};
											}}
										>
											<input type="hidden" name="description" value={getCurrentDescription(index)} />
											<input type="hidden" name="userPrompt" value={userPrompts[index] || ''} />
											<Button
												type="submit"
												disabled={isImproving || !userPrompts[index]?.trim()}
											>
												{#if isImproving && activeCharacterIndex === index && improvingType === 'regenerate'}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Regenerating...
												{:else}
													Regenerate Description
												{/if}
											</Button>
										</form>
										<Button variant="outline" onclick={() => closePromptTextarea(index)}>
											Cancel
										</Button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</section>

	<!-- ========== SCENES SECTION ========== -->
	<section
		id="scenes"
		bind:this={sectionRefs.scenes}
		class="scroll-mt-16 border-b pb-8"
	>
		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold">Scene Generation</h1>
					<p class="text-muted-foreground">Generate scene images using DALL-E</p>
				</div>
				<div class="flex items-center gap-2">
					{#if slots.length > 0}
						<div class="text-sm text-muted-foreground">
							{completedCount}/{slots.length} generated
							{#if generatingCount > 0}
								<span class="text-blue-600">({generatingCount} in progress)</span>
							{/if}
						</div>
					{/if}
					{#if testingMode}
						<Button variant="outline" size="sm" onclick={loadTestScenes} title="Load test data">
							<FlaskConical class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap gap-4 items-start" data-wireframes-container>
				{#each slots as slot, index (slot.id)}
					<div>
						<div
							data-scene-wireframe={index}
							data-scene-number={slot.storyScene.number}
							class="wireframe relative flex flex-col w-64 border rounded-lg p-2 transition-colors {dragOverIndex === index ? 'border-primary bg-primary/10 border-solid' : slot.status === 'completed' ? 'border-green-500 border-solid' : slot.status === 'generating' || generatingSlots.has(slot.id) ? 'border-blue-500 border-solid animate-pulse' : slot.status === 'failed' ? 'border-red-500 border-solid' : 'border-dashed border-black'}"
							style="aspect-ratio: 16/9;"
						>
							{#if slot.generatedScene?.imageUrl}
								<img
									src={slot.generatedScene.imageUrl}
									alt="Scene {slot.storyScene.number}"
									class="absolute inset-0 w-full h-full object-cover rounded-lg"
								/>
								<div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
									<form
										method="POST"
										action="?/regenerateSlotImage"
										use:enhance={() => {
											generatingSlots = new Set([...generatingSlots, slot.id]);
											return async ({ update }) => {
												await update();
												generatingSlots = new Set([...generatingSlots].filter(id => id !== slot.id));
											};
										}}
									>
										<input type="hidden" name="slotId" value={slot.id} />
										<input type="hidden" name="description" value={slot.customDescription || slot.storyScene.description} />
										<input type="hidden" name="characterDescriptions" value={getCharacterDescriptions(slot)} />
										<Button type="submit" size="sm" variant="secondary" disabled={isAnyGenerating}>
											{#if generatingSlots.has(slot.id)}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" data-spinner />
												Regenerating...
											{:else}
												Regenerate
											{/if}
										</Button>
									</form>
								</div>
							{:else}
								<div class="flex flex-col gap-1 h-full">
									<div class="flex items-start justify-between">
										<div class="text-xs font-medium text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">
											Scene {slot.storyScene.number}
										</div>
										<button
											type="button"
											class="text-xs text-red-500 hover:text-red-700"
											onclick={() => removeSlot(slot.id)}
										>
											×
										</button>
									</div>

									<div class="flex-1 overflow-hidden">
										<p class="text-[10px] text-muted-foreground line-clamp-2">
											{slot.customDescription || slot.storyScene.description}
										</p>
									</div>

									{#if slot.status === 'generating' || generatingSlots.has(slot.id)}
										<div class="text-[10px] text-blue-600 flex items-center gap-1">
											<Loader2 class="h-3 w-3 animate-spin" data-spinner />
											Generating...
										</div>
									{:else if slot.status === 'failed'}
										<div class="text-[10px] text-red-600">{slot.error || 'Failed'}</div>
									{/if}
								</div>
							{/if}
						</div>

						{#if !slot.generatedScene?.imageUrl && (slot.storyScene.description || slot.customDescription)}
							<form
								method="POST"
								action="?/generateSlotImage"
								class="mt-2"
								use:enhance={() => {
									generatingSlots = new Set([...generatingSlots, slot.id]);
									const session = $sessionStore.activeSession;
									if (session) {
										const pipeline = session.getScenePipeline();
										if (pipeline) {
											const slotIndex = pipeline.slots.findIndex(s => s.id === slot.id);
											if (slotIndex !== -1) {
												pipeline.slots[slotIndex] = { ...pipeline.slots[slotIndex], status: 'generating' };
												sessionStore.update(s => ({ ...s }));
											}
										}
									}
									return async ({ update }) => {
										await update();
										generatingSlots = new Set([...generatingSlots].filter(id => id !== slot.id));
									};
								}}
							>
								<input type="hidden" name="slotId" value={slot.id} />
								<input type="hidden" name="description" value={slot.customDescription || slot.storyScene.description} />
								<input type="hidden" name="characterDescriptions" value={getCharacterDescriptions(slot)} />
								<Button
									type="submit"
									size="sm"
									class="w-full"
									data-generate-slot={slot.id}
									disabled={isAnyGenerating}
								>
									{#if generatingSlots.has(slot.id) || slot.status === 'generating'}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" data-spinner />
										Generating...
									{:else}
										Generate
									{/if}
								</Button>
							</form>
						{/if}
					</div>
				{/each}

				<div>
					<button
						type="button"
						data-add-wireframe
						class="wireframe flex items-center justify-center w-64 border border-dashed border-black rounded-lg cursor-pointer hover:bg-muted/50 bg-transparent"
						style="aspect-ratio: 16/9;"
						onclick={addSlot}
					>
						<span class="text-4xl text-muted-foreground">+</span>
					</button>
				</div>
			</div>

			{#if hasGeneratedImages}
				<div class="flex gap-2">
					<Button onclick={goToStoryboard}>Send to Storyboard</Button>
				</div>
			{/if}
		</div>
	</section>

	<!-- ========== STORYBOARD SECTION ========== -->
	<section
		id="storyboard"
		bind:this={sectionRefs.storyboard}
		class="scroll-mt-16 border-b pb-8"
	>
		<div class="flex h-full gap-4">
			<div class="flex flex-1 flex-col gap-4">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="text-3xl font-bold">Storyboard Editor</h1>
						<p class="text-muted-foreground">Arrange your scenes and edit with prompts</p>
					</div>
					<div class="flex gap-2">
						{#if testingMode}
							<Button variant="outline" size="sm" onclick={loadTestStoryboard} title="Load test data">
								<FlaskConical class="h-4 w-4" />
							</Button>
						{/if}
						<Button variant="outline" onclick={handleNewStoryboard}>New Storyboard</Button>
						<Button
							disabled={!hasStoryboardContent}
							onclick={goToVideo}
							data-send-to-video
						>
							Send to Video
						</Button>
					</div>
				</div>

				<div class="flex flex-wrap gap-4" data-wireframes-container>
					{#each $storyboardStore.wireframes as wireframe, index}
						<div class="flex flex-col gap-2">
							<div
								data-storyboard-wireframe={wireframe.id}
								class="relative flex w-64 flex-col items-center justify-center rounded-lg border-2 transition-colors
									{$storyboardStore.selectedWireframeId === wireframe.id ? 'border-primary' : ''}
									{wireframe.scene === null && wireframe.characters.length === 0 ? 'border-dashed border-gray-300' : 'border-solid'}
									{wireframe.scene !== null ? 'border-green-500' : ''}
									hover:border-gray-400"
								style="aspect-ratio: 16/9;"
								ondragover={handleStoryboardDragOver}
								ondrop={(e) => handleStoryboardDrop(e, wireframe.id)}
								onclick={() => handleWireframeClick(wireframe.id)}
								role="button"
								tabindex="0"
							>
								{#if regeneratingWireframes.has(wireframe.id)}
									<div class="flex items-center justify-center">
										<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" data-spinner />
									</div>
								{:else if wireframe.scene || wireframe.characters.length > 0}
									{#if wireframe.scene}
										<img
											src={wireframe.scene.imageUrl}
											alt={wireframe.scene.name}
											class="absolute inset-0 h-full w-full rounded-lg object-cover"
											data-scene-image
										/>
									{/if}

									{#if wireframe.characters.length > 0}
										<div class="relative z-10 flex flex-wrap gap-2 p-2">
											{#each wireframe.characters as character}
												<div class="group relative">
													<img
														src={character.imageUrl}
														alt={character.name}
														class="h-12 w-12 rounded-full border-2 border-white object-cover shadow-lg"
													/>
													<button
														class="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
														onclick={(e) => { e.stopPropagation(); handleRemoveCharacter(wireframe.id, character.id); }}
														aria-label={`Remove ${character.name}`}
													>
														<X class="h-3 w-3" />
													</button>
												</div>
											{/each}
										</div>
									{/if}
								{:else}
									<span class="text-sm text-muted-foreground">Drop scene or character here</span>
								{/if}
							</div>

							{#if wireframe.scene}
								{#if editingWireframes.has(wireframe.id)}
									<form
										method="POST"
										action="?/editSlotWithPrompt"
										class="flex flex-col gap-2"
										use:enhance={() => {
											regeneratingWireframes = new Set([...regeneratingWireframes, wireframe.id]);
											return async ({ update }) => {
												await update();
												regeneratingWireframes = new Set([...regeneratingWireframes].filter(id => id !== wireframe.id));
											};
										}}
									>
										<input type="hidden" name="wireframeId" value={wireframe.id} />
										<input type="hidden" name="originalDescription" value={wireframe.scene.name} />
										<Textarea
											name="editPrompt"
											placeholder="Describe changes..."
											class="text-xs h-16"
											bind:value={editPrompts[wireframe.id]}
										/>
										<div class="flex gap-1">
											<Button type="submit" size="sm" class="flex-1" disabled={regeneratingWireframes.has(wireframe.id)}>
												{#if regeneratingWireframes.has(wireframe.id)}
													<Loader2 class="mr-1 h-3 w-3 animate-spin" />
													Regenerating...
												{:else}
													Regenerate
												{/if}
											</Button>
											<Button type="button" size="sm" variant="outline" onclick={() => toggleEditMode(wireframe.id)}>
												Cancel
											</Button>
										</div>
									</form>
								{:else}
									<Button
										size="sm"
										variant="outline"
										class="w-full"
										onclick={() => toggleEditMode(wireframe.id)}
										data-edit-with-prompt={wireframe.id}
									>
										<Edit class="mr-1 h-3 w-3" />
										Edit With Prompt
									</Button>
								{/if}
							{/if}
						</div>
					{/each}

					<div>
						<div
							data-add-wireframe
							class="flex w-64 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/20"
							style="aspect-ratio: 16/9;"
							onclick={handleNewStoryboard}
							role="button"
							tabindex="0"
						>
							<span class="text-4xl text-muted-foreground">+</span>
						</div>
					</div>
				</div>

				<div class="mt-4 rounded-lg border p-4">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-lg font-semibold">Timeline</h2>
						<div class="flex items-center gap-4">
							<span class="text-sm text-muted-foreground">
								Total Duration: <span class="font-medium">{formatTime(totalStoryboardDuration)}</span>
							</span>
							<span class="text-sm text-muted-foreground" data-current-time>
								Current Time: <span class="font-medium">{formatTime($storyboardStore.currentTime)}</span>
							</span>
						</div>
					</div>

					<div class="mb-4 flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onclick={togglePlayback}
							disabled={$storyboardStore.timelineItems.length === 0}
						>
							{#if $storyboardStore.isPlaying}
								<Pause class="h-4 w-4" />
							{:else}
								<Play class="h-4 w-4" />
							{/if}
						</Button>

						<div
							class="relative flex-1 h-2 bg-muted rounded-full cursor-pointer"
							data-timeline-scrubber
						>
							<div
								class="absolute h-full bg-primary rounded-full"
								style="width: {totalStoryboardDuration > 0 ? ($storyboardStore.currentTime / totalStoryboardDuration) * 100 : 0}%"
							></div>
						</div>
					</div>

					<div class="flex gap-2 overflow-x-auto pb-2" data-scene-timeline>
						{#if $storyboardStore.timelineItems.length === 0}
							<p class="text-sm text-muted-foreground">Add scenes to wireframes to build your timeline</p>
						{:else}
							{#each $storyboardStore.timelineItems as item, index}
								<div
									class="flex min-w-32 flex-col rounded-lg border bg-card p-2"
									data-scene-timeline-item
									data-scene-id={item.id}
								>
									{#if item.scene}
										<img
											src={item.scene.imageUrl}
											alt={item.scene.name}
											class="mb-2 h-20 w-full rounded object-cover"
											data-scene-thumbnail
										/>
									{:else if item.characters.length > 0}
										<div class="mb-2 flex h-20 items-center justify-center bg-muted rounded">
											<span class="text-xs text-muted-foreground">{item.characters.length} characters</span>
										</div>
									{/if}
									<span class="text-xs font-medium">{item.duration}s</span>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ========== VIDEO SECTION ========== -->
	<section
		id="video"
		bind:this={sectionRefs.video}
		class="scroll-mt-16 pb-8"
	>
		<div class="flex flex-col gap-4">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold">Video Generation</h1>
					<p class="text-muted-foreground">
						Generate {sceneVideos.length} video clip{sceneVideos.length !== 1 ? 's' : ''} ({totalVideoDuration}s total) using {selectedProvider === 'kling' ? 'Kling AI (with audio)' : 'Mock (for testing)'}
					</p>
				</div>
				<div class="flex gap-2">
					{#if testingMode}
						<Button variant="outline" size="sm" onclick={loadTestVideo} title="Load test data">
							<FlaskConical class="h-4 w-4" />
						</Button>
					{/if}
					{#if allCompleted}
						<Button variant="outline" onclick={handleRegenerate}>
							<RotateCcw class="mr-2 h-4 w-4" />
							Regenerate All
						</Button>
					{/if}
				</div>
			</div>

			{#if !allCompleted && !isVideoGenerating}
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium">Provider:</span>
						<select
							bind:value={selectedProvider}
							class="rounded border px-2 py-1 text-sm"
						>
							<option value="mock">Mock (Testing)</option>
							<option value="kling">Kling AI (Real Video + Audio)</option>
						</select>
					</div>

					{#if selectedProvider === 'kling'}
						<button
							type="button"
							class="flex items-center gap-1 text-sm"
							onclick={() => enableSound = !enableSound}
						>
							{#if enableSound}
								<Volume2 class="h-4 w-4" />
								<span>Audio On</span>
							{:else}
								<VolumeX class="h-4 w-4" />
								<span>Audio Off</span>
							{/if}
						</button>
					{/if}
				</div>
			{/if}

			<div
				data-video-container
				class="relative rounded-lg border border-black overflow-hidden bg-black"
				style="width: 800px; max-width: 100%; aspect-ratio: 16/9;"
			>
				{#if currentVideoUrl}
					<video
						bind:this={videoElement}
						src={currentVideoUrl}
						class="w-full h-full object-contain"
						data-video-player
						onended={handleVideoEnded}
						controls
					>
						<track kind="captions" />
					</video>
				{:else if isVideoGenerating}
					<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
						<Loader2 class="h-12 w-12 animate-spin text-white mb-4" data-spinner />
						<p class="text-white text-sm">
							Generating scene {currentGeneratingIndex + 1} of {sceneVideos.length}
						</p>
						<div class="w-48 h-2 bg-gray-700 rounded-full mt-2">
							<div
								class="h-full bg-primary rounded-full transition-all"
								style="width: {Math.max(5, overallProgress)}%"
							></div>
						</div>
						<p class="text-white/70 text-xs mt-1">
							Overall: {overallProgress}%
						</p>
					</div>
				{:else}
					{#if sceneThumbnails.length > 0}
						<div class="absolute inset-0 flex items-center justify-center p-4" data-video-placeholder>
							<div class="flex gap-2 overflow-x-auto">
								{#each sceneThumbnails as thumbnail, index}
									<div
										class="flex-shrink-0 rounded border-2 border-white/50 overflow-hidden"
										data-scene-thumbnail={index}
									>
										<img
											src={thumbnail.imageUrl}
											alt={thumbnail.name}
											class="h-32 w-auto object-cover"
										/>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center" data-video-placeholder>
							<p class="text-white/50">No scenes available. Generate scenes first.</p>
						</div>
					{/if}
				{/if}
			</div>

			{#if isVideoGenerating || completedVideos.length > 0}
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
					{#each sceneVideos as sceneVideo, index}
						<div
							class="relative rounded border overflow-hidden cursor-pointer transition-all {sceneVideo.status === 'completed' ? 'border-green-500' : sceneVideo.status === 'failed' ? 'border-red-500' : 'border-gray-300'}"
							onclick={() => sceneVideo.videoUrl && playFromScene(index)}
						>
							<img
								src={sceneVideo.sceneImageUrl}
								alt={sceneVideo.sceneName}
								class="w-full aspect-video object-cover"
							/>
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								{#if sceneVideo.status === 'completed'}
									<div class="bg-green-500 rounded-full p-1">
										<Check class="h-4 w-4 text-white" />
									</div>
								{:else if sceneVideo.status === 'queued' || sceneVideo.status === 'generating'}
									<Loader2 class="h-6 w-6 animate-spin text-white" />
								{:else if sceneVideo.status === 'failed'}
									<span class="text-red-500 text-xs">Failed</span>
								{:else}
									<span class="text-white/50 text-xs">Pending</span>
								{/if}
							</div>
							<div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center">
								Scene {index + 1} • 5s
								{#if sceneVideo.status === 'generating'}
									({sceneVideo.progress}%)
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#each sceneVideos.filter(sv => sv.error) as errorScene}
				<div class="text-red-500 text-sm">
					Scene {errorScene.sceneIndex + 1}: {errorScene.error}
				</div>
			{/each}

			{#if !allCompleted}
				<Button
					onclick={startGeneratingAllScenes}
					disabled={isVideoGenerating || !hasScenes}
					data-generate-video
				>
					{#if isVideoGenerating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" data-spinner />
						Generating {currentGeneratingIndex + 1}/{sceneVideos.length}...
					{:else}
						Generate All Videos ({sceneVideos.length} clips)
					{/if}
				</Button>
			{/if}

			{#each sceneVideos as sceneVideo, index}
				<form
					id="generate-form-{index}"
					method="POST"
					action="?/generateSceneVideo"
					class="hidden"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<input type="hidden" name="sceneIndex" value={index} />
					<input type="hidden" name="sceneDescription" value={sceneVideo.sceneName} />
					<input type="hidden" name="sceneImageUrl" value={sceneVideo.sceneImageUrl} />
					<input type="hidden" name="provider" value={selectedProvider} />
					<input type="hidden" name="sound" value={enableSound.toString()} />
				</form>

				{#if sceneVideo.videoId}
					<form
						id="status-check-form-{index}"
						method="POST"
						action="?/checkSceneVideoStatus"
						class="hidden"
						use:enhance
					>
						<input type="hidden" name="sceneIndex" value={index} />
						<input type="hidden" name="videoId" value={sceneVideo.videoId} />
					</form>
				{/if}
			{/each}

			{#if selectedProvider === 'kling' && !allCompleted && !isVideoGenerating}
				<div class="text-xs text-muted-foreground border rounded p-2 bg-muted/50">
					<strong>Kling AI 2.6:</strong> Generates 5-second video clips with native audio from each scene image.
					Cost: ~$0.35-0.70 per clip ({enableSound ? 'with' : 'without'} audio).
					<strong>Total estimate: ~${(sceneVideos.length * 0.5).toFixed(2)}</strong>
				</div>
			{/if}
		</div>
	</section>
</div>
