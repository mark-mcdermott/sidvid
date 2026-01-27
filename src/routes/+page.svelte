<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Loader2, Play, Pause, RotateCcw, Volume2, VolumeX, Check, X, Edit, FlaskConical, Pencil, Sparkles, Plus, Wand2, Video, Trash2, Download, Copy, Archive, ArchiveRestore, Eye, Type } from '@lucide/svelte';
	import { ProgressBar } from '$lib/components/ui/progress-bar';
	import { createTimingContext } from '$lib/utils/apiTiming';
	import type { ApiCallType } from '$lib/sidvid/types';

	// Stores
	import { storyStore, STYLE_OPTIONS, type StylePreset } from '$lib/stores/storyStore';

	// Components
	import ProjectSection from '$lib/components/project/ProjectSection.svelte';
	import { characterStore, loadStoryCharacters, ensureCharacterExpanded, getActiveImageUrl, resetCharacterStore } from '$lib/stores/characterStore';
	import {
		worldStore,
		addElement,
		deleteElement,
		toggleElementExpanded,
		setFilterType,
		addElementImage,
		updateElementDescription,
		setActiveElementImage,
		deleteElementImage,
		loadElementsFromStory,
		getElementsByType,
		ELEMENT_TYPE_LABELS,
		ELEMENT_TYPE_COLORS,
		getActiveElementImageUrl,
		type ElementType
	} from '$lib/stores/worldStore';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import {
		storyboardStore,
		addScene,
		updateScene,
		deleteScene,
		cloneScene,
		archiveScene,
		unarchiveScene,
		reorderScenes,
		selectScene,
		assignElementToScene,
		unassignElementFromScene,
		togglePlayback,
		setCurrentTime,
		loadStoryboardFromStorage,
		saveStoryboardToStorage,
		resetStoryboardStore,
		getActiveScenes,
		getArchivedScenes,
		getActiveSceneImageUrl,
		getTotalDuration,
		type Scene,
		type WireframeScene,
		type WireframeCharacter
	} from '$lib/stores/storyboardStore';

	// Utils
	import { truncateTitle } from '$lib/sidvid/utils/conversation-helpers';
	import type { SceneSlot, Story } from '$lib/sidvid';
	import type { ActionData } from './$types';
	import { browser } from '$app/environment';

	let { form }: { form: ActionData } = $props();

	// ========== Testing Mode ==========
	let testingMode = $state(false);

	// Load testing mode preference from localStorage on init
	if (browser) {
		const savedTestingMode = localStorage.getItem('sidvid-testing-mode');
		if (savedTestingMode !== null) {
			testingMode = savedTestingMode === 'true';
		}
	}

	function toggleTestingMode() {
		testingMode = !testingMode;
		if (browser) {
			localStorage.setItem('sidvid-testing-mode', String(testingMode));
		}
	}

	// ========== Active Section State ==========
	type Section = 'story' | 'world' | 'storyboard' | 'video';
	let activeSection = $state<Section>('story');

	// Section refs for scrolling
	let sectionRefs: Record<Section, HTMLElement | undefined> = {
		story: undefined,
		world: undefined,
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
	let smartExpandFormElement: HTMLFormElement | undefined = $state();
	let shouldNavigateToCharactersAfterStory = $state(false);

	// Derived value for the latest story object (stringified) - ensures we always get the current version for editing
	let latestStoryForEdit = $derived(
		$storyStore.stories.length > 0
			? JSON.stringify($storyStore.stories[$storyStore.stories.length - 1].story)
			: ''
	);

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

	// Style selector state
	let selectedStyleValue = $state<StylePreset>($storyStore.selectedStyle);

	// Get the label for current style
	let selectedStyleLabel = $derived(
		STYLE_OPTIONS.find(opt => opt.value === $storyStore.selectedStyle)?.label || 'Anime'
	);

	// Editable story fields for Manual Edit mode
	interface EditableScene {
		number: number;
		description: string;
		dialogue: string;
		action: string;
	}
	interface EditableCharacter {
		name: string;
		description: string;
		physical: string;
		profile: string;
	}
	let editableTitle = $state('');
	let editableScenes = $state<EditableScene[]>([]);
	let editableCharacters = $state<EditableCharacter[]>([]);

	function handleStoryKeydown(e: KeyboardEvent, formElement?: HTMLFormElement) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			formElement?.requestSubmit();
		}
	}

	function handleUseThisStory() {
		shouldNavigateToCharactersAfterStory = true;
		mainFormElement?.requestSubmit();
	}

	// ========== Character State ==========
	let isCharacterGenerating = $state(false);
	let isImproving = $state(false);
	let improvingType = $state<'smart' | 'regenerate' | null>(null);
	let activeCharacterIndex = $state(0);
	let lastProcessedEnhancedText = $state<string>('');
	let showAddCharacterForm = $state(false);
	let lastProcessedImageUrl = $state<string>('');
	let characterRefs: { [key: number]: HTMLDivElement } = {};
	let enhancedCharacters = $state<Set<number>>(new Set());
	let showPromptTextarea = $state<Set<number>>(new Set());
	let userPrompts = $state<{ [key: number]: string }>({});
	let generatingCharacterImages = $state<Set<number>>(new Set());
	let autoGenerateCharacterImages = $state(false);

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
						slug: 'Custom Character',
						description: customDesc,
						images: [],
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

	function selectCharacterImage(charIndex: number, imageId: string) {
		characterStore.update(state => {
			const updatedCharacters = [...state.characters];
			if (charIndex < updatedCharacters.length) {
				updatedCharacters[charIndex] = {
					...updatedCharacters[charIndex],
					selectedImageId: imageId
				};
			}
			return { ...state, characters: updatedCharacters };
		});
	}

	function deleteCharacterImage(charIndex: number, imageId: string) {
		characterStore.update(state => {
			const updatedCharacters = [...state.characters];
			if (charIndex < updatedCharacters.length) {
				const char = updatedCharacters[charIndex];
				const newImages = char.images.filter(img => img.id !== imageId);
				// If deleted image was selected, select the last remaining image
				let newSelectedId = char.selectedImageId;
				if (char.selectedImageId === imageId && newImages.length > 0) {
					newSelectedId = newImages[newImages.length - 1].id;
				}
				updatedCharacters[charIndex] = {
					...char,
					images: newImages,
					selectedImageId: newSelectedId
				};
			}
			return { ...state, characters: updatedCharacters };
		});
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

	async function generateCharacterImageForIndex(index: number, forceRegenerate = false) {
		const char = $characterStore.characters[index];
		if (!char || (char.images.length > 0 && !forceRegenerate)) return; // Skip if already has image and not regenerating

		const description = char.enhancedDescription || char.description;
		if (!description) return;

		generatingCharacterImages = new Set([...generatingCharacterImages, index]);

		try {
			const formData = new FormData();
			formData.append('description', description);
			formData.append('characterIndex', index.toString());

			const response = await fetch('?/generateCharacterImage', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			console.log('Character image generation result:', result);

			// SvelteKit form actions return data in a specific format
			// The data is in result.data as a serialized array: [[action_index, action_data]]
			let actionData = null;

			if (result.data) {
				try {
					const parsed = JSON.parse(result.data);
					// SvelteKit uses devalue format where object values are indices into the array
					// e.g., [{success: 1, character: 2}, true, {imageUrl: 3}, "url..."]
					// means success=parsed[1]=true, character=parsed[2]={imageUrl: 3}, etc.
					if (Array.isArray(parsed) && parsed.length > 0) {
						const mainObj = parsed[0];
						if (typeof mainObj === 'object' && mainObj !== null) {
							// Resolve devalue references
							const resolveValue = (val: any): any => {
								if (typeof val === 'number' && parsed[val] !== undefined) {
									const resolved = parsed[val];
									if (typeof resolved === 'object' && resolved !== null) {
										// Recursively resolve nested objects
										const resolvedObj: any = Array.isArray(resolved) ? [] : {};
										for (const key in resolved) {
											resolvedObj[key] = resolveValue(resolved[key]);
										}
										return resolvedObj;
									}
									return resolved;
								}
								return val;
							};

							actionData = {};
							for (const key in mainObj) {
								actionData[key] = resolveValue(mainObj[key]);
							}
						}
					}
				} catch (e) {
					console.error('Error parsing result.data:', e);
				}
			} else if (result.success !== undefined) {
				actionData = result;
			}

			console.log('Parsed action data:', actionData);

			if (actionData?.success && actionData?.character?.imageUrl) {
				const newImageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				characterStore.update(state => {
					const updatedCharacters = [...state.characters];
					if (index < updatedCharacters.length) {
						const existingImages = updatedCharacters[index].images || [];
						const newImage = {
							id: newImageId,
							imageUrl: actionData.character.imageUrl,
							revisedPrompt: actionData.character.revisedPrompt
						};
						updatedCharacters[index] = {
							...updatedCharacters[index],
							images: [...existingImages, newImage],
							selectedImageId: newImageId
						};
					}
					return { ...state, characters: updatedCharacters };
				});
			} else {
				console.error('Character image generation failed or no imageUrl:', actionData);
			}
		} catch (error) {
			console.error(`Error generating image for character ${index}:`, error);
		} finally {
			generatingCharacterImages = new Set([...generatingCharacterImages].filter(i => i !== index));
		}
	}

	async function generateAllCharacterImages() {
		const characters = $characterStore.characters;
		// Generate images sequentially to avoid rate limiting
		for (let i = 0; i < characters.length; i++) {
			if (!characters[i].imageUrl) {
				await generateCharacterImageForIndex(i);
			}
		}
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

	// ========== World State ==========
	let isWorldGenerating = $state(false);
	let isWorldEnhancing = $state(false);
	let activeElementId = $state<string | null>(null);
	let lastProcessedWorldEnhancedText = $state<string>('');
	let lastProcessedWorldImageUrl = $state<string>('');

	// Track which elements have prompt textarea open
	let worldShowPromptTextarea = $state<Set<string>>(new Set());
	let worldUserPrompts = $state<{ [key: string]: string }>({});

	// Custom element form
	let customElementName = $state('');
	let customElementDescription = $state('');
	let customElementType = $state<ElementType>('character');

	// Filter tabs
	const worldFilterOptions: Array<{ value: ElementType | 'all'; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'character', label: 'Characters' },
		{ value: 'location', label: 'Locations' },
		{ value: 'object', label: 'Objects' },
		{ value: 'concept', label: 'Concepts' }
	];

	// Type select options
	const worldTypeOptions: Array<{ value: ElementType; label: string }> = [
		{ value: 'character', label: 'Character' },
		{ value: 'location', label: 'Location' },
		{ value: 'object', label: 'Object' },
		{ value: 'concept', label: 'Concept' }
	];

	// Get filtered elements
	let filteredWorldElements = $derived(
		$worldStore.filterType === 'all'
			? $worldStore.elements
			: $worldStore.elements.filter((el) => el.type === $worldStore.filterType)
	);

	// Get counts by type
	let characterCount = $derived(getElementsByType($worldStore.elements, 'character').length);
	let locationCount = $derived(getElementsByType($worldStore.elements, 'location').length);
	let objectCount = $derived(getElementsByType($worldStore.elements, 'object').length);
	let conceptCount = $derived(getElementsByType($worldStore.elements, 'concept').length);

	function handleAddWorldElement() {
		if (customElementName.trim() && customElementDescription.trim()) {
			addElement(customElementName.trim(), customElementType, customElementDescription.trim());
			customElementName = '';
			customElementDescription = '';
		}
	}

	function handleWorldKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleAddWorldElement();
		}
	}

	function getWorldCurrentDescription(element: typeof $worldStore.elements[0]) {
		return element?.enhancedDescription || element?.description || '';
	}

	function openWorldPromptTextarea(elementId: string) {
		worldShowPromptTextarea = new Set([...worldShowPromptTextarea, elementId]);
	}

	function closeWorldPromptTextarea(elementId: string) {
		worldShowPromptTextarea = new Set([...worldShowPromptTextarea].filter((id) => id !== elementId));
		worldUserPrompts[elementId] = '';
	}

	function handleDeleteWorldElement(elementId: string) {
		if (confirm('Are you sure you want to delete this element?')) {
			deleteElement(elementId);
		}
	}

	// ========== Storyboard State ==========
	let playbackInterval: ReturnType<typeof setInterval> | null = null;

	// Scene edit modal state
	let sceneEditModalOpen = $state(false);
	let editingScene = $state<Scene | null>(null);
	let editSceneTitle = $state('');
	let editSceneDescription = $state('');
	let editSceneDialog = $state('');
	let editSceneAction = $state('');

	// Delete confirmation state
	let sceneDeleteConfirmOpen = $state(false);
	let sceneToDelete = $state<string | null>(null);

	// Text visibility toggle per scene
	let sceneTextVisibility = $state<Record<string, boolean>>({});

	// Drag state for scene reordering
	let draggedSceneIndex = $state<number | null>(null);

	// Derived values
	let activeScenes = $derived(getActiveScenes($storyboardStore.scenes));
	let archivedScenes = $derived(getArchivedScenes($storyboardStore.scenes));
	let totalStoryboardDuration = $derived(getTotalDuration($storyboardStore.scenes));
	let hasStoryboardContent = $derived(activeScenes.length > 0);

	// Get world element by ID
	function getWorldElement(id: string) {
		return $worldStore.elements.find((el) => el.id === id);
	}

	function openSceneEditModal(scene: Scene) {
		editingScene = scene;
		editSceneTitle = scene.title;
		editSceneDescription = scene.customDescription || scene.description;
		editSceneDialog = scene.dialog || '';
		editSceneAction = scene.action || '';
		sceneEditModalOpen = true;
	}

	function saveSceneEdits() {
		if (!editingScene) return;

		updateScene(editingScene.id, {
			title: editSceneTitle,
			customDescription: editSceneDescription,
			dialog: editSceneDialog || undefined,
			action: editSceneAction || undefined
		});

		sceneEditModalOpen = false;
		editingScene = null;
	}

	function handleAddScene() {
		addScene();
	}

	function handleCloneScene(sceneId: string, e: Event) {
		e.stopPropagation();
		cloneScene(sceneId);
	}

	function handleArchiveScene(sceneId: string, e: Event) {
		e.stopPropagation();
		archiveScene(sceneId);
	}

	function handleUnarchiveScene(sceneId: string) {
		unarchiveScene(sceneId);
	}

	function confirmDeleteScene(sceneId: string, e: Event) {
		e.stopPropagation();
		sceneToDelete = sceneId;
		sceneDeleteConfirmOpen = true;
	}

	function handleDeleteScene() {
		if (sceneToDelete) {
			deleteScene(sceneToDelete);
			sceneToDelete = null;
			sceneDeleteConfirmOpen = false;
		}
	}

	function toggleSceneTextVisibility(sceneId: string, e: Event) {
		e.stopPropagation();
		sceneTextVisibility[sceneId] = !sceneTextVisibility[sceneId];
	}

	function handleStoryboardSceneDragStart(e: DragEvent, index: number) {
		draggedSceneIndex = index;
		e.dataTransfer?.setData('text/plain', index.toString());
	}

	function handleStoryboardSceneDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleStoryboardSceneDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		if (draggedSceneIndex !== null && draggedSceneIndex !== toIndex) {
			reorderScenes(draggedSceneIndex, toIndex);
		}
		draggedSceneIndex = null;
	}

	function handleStoryboardSceneDragEnd() {
		draggedSceneIndex = null;
	}

	// Handle world element drop from sidebar onto scene
	function handleStoryboardElementDrop(e: DragEvent, sceneId: string) {
		e.preventDefault();
		const json = e.dataTransfer?.getData('application/json');
		if (!json) return;

		try {
			const data = JSON.parse(json);
			if (data.type === 'world-element') {
				assignElementToScene(sceneId, data.id);
			}
		} catch (error) {
			console.error('Drop error:', error);
		}
	}

	// Handle drop on new scene button
	function handleNewStoryboardElementDrop(e: DragEvent) {
		e.preventDefault();
		const json = e.dataTransfer?.getData('application/json');
		if (!json) return;

		try {
			const data = JSON.parse(json);
			if (data.type === 'world-element') {
				const newId = addScene();
				assignElementToScene(newId, data.id);
			}
		} catch (error) {
			console.error('Drop error:', error);
		}
	}

	function formatTime(seconds: number): string {
		return `${Math.floor(seconds)}s`;
	}

	function truncateSceneText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}

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

	function downloadVideo() {
		const completedVideo = sceneVideos.find(sv => sv.videoUrl);
		if (completedVideo?.videoUrl) {
			const link = document.createElement('a');
			link.href = completedVideo.videoUrl;
			link.download = `sidvid-video-${Date.now()}.mp4`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
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

	// Style selector sync effects
	$effect(() => {
		if (selectedStyleValue !== $storyStore.selectedStyle) {
			storyStore.update(state => ({
				...state,
				selectedStyle: selectedStyleValue
			}));
		}
	});

	$effect(() => {
		selectedStyleValue = $storyStore.selectedStyle;
	});

	// Story form effect - handles generateStory, editStory, and smartExpandStory actions
	$effect(() => {
		if ((form?.action === 'generateStory' || form?.action === 'editStory' || form?.action === 'smartExpandStory') && form?.success && form?.story) {
			const currentRawContent = form.story.rawContent;
			const lastContent = untrack(() => lastStoryRawContent);

			if (currentRawContent !== lastContent) {
				untrack(() => {
					const isEdit = form.action === 'editStory' || form.action === 'smartExpandStory';

					let storyPrompt: string;
					if (capturedPromptForNextStory) {
						storyPrompt = capturedPromptForNextStory;
						capturedPromptForNextStory = '';
					} else if ($storyStore.isTryingAgain) {
						storyPrompt = $storyStore.tryAgainPrompt;
					} else {
						storyPrompt = $storyStore.prompt;
					}

					if (isEdit) {
						// For edits, add new entry to keep visual history (like Try Again)
						// and clear downstream data
						resetCharacterStore();
						resetStoryboardStore();
						localSlots = [];
						sceneVideos = [];

						storyStore.update(state => ({
							...state,
							stories: [...state.stories, {
								story: form.story!,
								prompt: storyPrompt,
								length: state.selectedLength?.label || '5s'
							}],
							isEditingManually: false,
							isEditingWithPrompt: false,
							editedStoryContent: '',
							editPrompt: ''
						}));
					} else {
						// For new stories, add to the list
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
					}
					lastStoryRawContent = currentRawContent;

					// Always populate characters and scenes from the story
					if (form.story!.characters && form.story!.characters.length > 0) {
						loadStoryCharacters(form.story!.characters);
						// Auto-generate character images after loading
						autoGenerateCharacterImages = true;

						// Also populate World section with characters
						const worldCharacters = form.story!.characters.map((c: { name: string; description: string; physical?: string }) => ({
							name: c.name,
							description: c.physical || c.description
						}));
						loadElementsFromStory(worldCharacters);
					}
					if (form.story!.scenes && form.story!.scenes.length > 0) {
						localSlots = form.story!.scenes.map((scene, index) => ({
							id: `slot-local-${Date.now()}-${index}`,
							storySceneIndex: index,
							storyScene: scene,
							characterIds: [],
							status: 'pending' as const
						}));
					}

					// Auto-navigate to characters if "Generate Video Now" was clicked
					if (shouldNavigateToCharactersAfterStory) {
						shouldNavigateToCharactersAfterStory = false;
						// Scroll to characters section after a small delay to allow DOM update
						setTimeout(() => scrollToSection('world'), 100);
					}
				});
			}
		}
	});

	// Auto-generate character images effect
	$effect(() => {
		if (autoGenerateCharacterImages && $characterStore.characters.length > 0) {
			autoGenerateCharacterImages = false;
			// Small delay to ensure the store is updated
			setTimeout(() => {
				generateAllCharacterImages();
			}, 100);
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
			// Populate editable fields from the story
			editableTitle = latestEntry.story.title;
			editableScenes = latestEntry.story.scenes.map(scene => ({
				number: scene.number,
				description: scene.description || '',
				dialogue: scene.dialogue || '',
				action: scene.action || ''
			}));
			editableCharacters = (latestEntry.story.characters || []).map(char => ({
				name: char.name,
				description: char.description,
				physical: char.physical || '',
				profile: char.profile || ''
			}));
			storyStore.update(state => ({
				...state,
				isEditingManually: true
			}));
			setTimeout(() => {
				latestStoryCardElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 0);
		}
	}

	function cancelEdit() {
		editableTitle = '';
		editableScenes = [];
		editableCharacters = [];
		storyStore.update(state => ({
			...state,
			isEditingManually: false
		}));
	}

	function saveChanges() {
		const latestEntry = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestEntry && editableTitle && editableScenes.length > 0) {
			// Build updated scenes from editable fields
			const updatedScenes = editableScenes.map(scene => ({
				number: scene.number,
				description: scene.description,
				dialogue: scene.dialogue || undefined,
				action: scene.action || undefined
			}));

			// Build updated characters from editable fields
			const updatedCharacters = editableCharacters.map(char => ({
				name: char.name,
				description: char.description,
				physical: char.physical || undefined,
				profile: char.profile || undefined
			}));

			// Build new rawContent JSON from edited fields
			const newRawContent = JSON.stringify({
				title: editableTitle,
				scenes: updatedScenes,
				characters: updatedCharacters,
				sceneVisuals: latestEntry.story.sceneVisuals
			});

			// Clear all downstream data (characters, scenes, storyboard, videos)
			resetCharacterStore();
			resetStoryboardStore();
			localSlots = [];
			sceneVideos = [];

			// Update the story
			storyStore.update(state => {
				const updatedStories = [...state.stories];
				updatedStories[updatedStories.length - 1] = {
					...latestEntry,
					story: {
						...latestEntry.story,
						rawContent: newRawContent,
						title: editableTitle,
						scenes: updatedScenes,
						characters: updatedCharacters
					}
				};
				return {
					...state,
					stories: updatedStories,
					isEditingManually: false
				};
			});

			// Clear editable fields
			editableTitle = '';
			editableScenes = [];
			editableCharacters = [];

			// Reload characters from edited data and trigger auto-generation
			if (updatedCharacters.length > 0) {
				loadStoryCharacters(updatedCharacters);
				autoGenerateCharacterImages = true;
				// Also populate World section
				const worldCharacters = updatedCharacters.map((c: { name: string; description: string; physical?: string }) => ({
					name: c.name,
					description: c.physical || c.description
				}));
				loadElementsFromStory(worldCharacters);
			}

			// Reload scenes from updated story
			if (updatedScenes.length > 0) {
				localSlots = updatedScenes.map((scene, index) => ({
					id: `slot-local-${Date.now()}-${index}`,
					storySceneIndex: index,
					storyScene: scene,
					characterIds: [],
					status: 'pending' as const
				}));
			}
		}
	}

	function startPromptEdit() {
		storyStore.update(state => ({
			...state,
			isEditingWithPrompt: true,
			editPrompt: ''
		}));
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

	function startSmartExpand() {
		if ($storyStore.stories.length > 0 && smartExpandFormElement) {
			const currentStoryInput = smartExpandFormElement.querySelector('input[name="currentStory"]') as HTMLInputElement;
			const lengthInput = smartExpandFormElement.querySelector('input[name="length"]') as HTMLInputElement;

			if (currentStoryInput) currentStoryInput.value = latestStoryForEdit;
			if (lengthInput) lengthInput.value = $storyStore.selectedLength.value;

			capturedPromptForNextStory = 'Smart Expand';
			smartExpandFormElement.requestSubmit();
		}
	}

	function goToCharacters() {
		const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestStory?.story.characters && latestStory.story.characters.length > 0) {
			loadStoryCharacters(latestStory.story.characters);
			// Also populate World section
			const worldCharacters = latestStory.story.characters.map((c: { name: string; description: string; physical?: string }) => ({
				name: c.name,
				description: c.physical || c.description
			}));
			loadElementsFromStory(worldCharacters);
		}
		scrollToSection('world');
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
			if (playbackInterval) clearInterval(playbackInterval);
			if (pollInterval) clearInterval(pollInterval);
			if (retryTimeoutId) clearTimeout(retryTimeoutId);
		};
	});
</script>

<!-- Testing Mode Toggle -->
<button
	onclick={toggleTestingMode}
	class="fixed bottom-4 right-4 z-50 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors {testingMode ? 'border-yellow-800 bg-yellow-200 text-yellow-800' : 'border-muted-foreground bg-muted text-muted-foreground hover:bg-muted/80'}"
	title="Toggle testing mode"
>
	<FlaskConical class="!mr-0 h-4 w-4" />
</button>

<div class="flex flex-col gap-8">
	<!-- ========== PROJECT SECTION ========== -->
	<ProjectSection />

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
				const timing = createTimingContext('generateStory');
				timing.start();
				storyStore.update(state => ({ ...state, isGenerating: true }));
				return async ({ result, update }) => {
					timing.complete(result.type === 'success');
					await update({ reset: false });
					storyStore.update(state => ({
						...state,
						isGenerating: false,
						prompt: currentPrompt
					}));
				};
			}}
		>
			<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
				<div class="flex items-start justify-between sm:flex-col sm:gap-2">
					<div>
						<h1 class="text-3xl font-bold mb-3">Story</h1>
						<p class="text-muted-foreground">Create your story text</p>
					</div>
					{#if testingMode}
						<div class="flex gap-1">
							<Button variant="outline" size="sm" onclick={() => storyStore.update(s => ({ ...s, prompt: 'anime cartoon (akira drawing/animation/aesthetic style) cybernetic humanoid capybaras hacking into a dystopian government mainframe', stories: [] }))} title="Insert test prompt and clear history">
								<FlaskConical class="!mr-0 h-4 w-4 opacity-50" />
							</Button>
							<Button variant="outline" size="sm" onclick={loadTestStory} title="Load test data">
								<FlaskConical class="!mr-0 h-4 w-4" />
							</Button>
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-4">
				{#if form?.action === 'generateStory' && form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				{#if $storyStore.stories.length === 0}
					<div class="w-full xl:max-w-[32rem]">
						<div class="mb-2 flex gap-4">
							<div>
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

							<div>
								<label for="style" class="mb-1 block text-sm font-medium">Style</label>
								<Select.Root type="single" bind:value={selectedStyleValue}>
									<Select.Trigger class="w-40" aria-label="style selector">
										{selectedStyleLabel}
									</Select.Trigger>
									<Select.Content>
										{#each STYLE_OPTIONS as option}
											<Select.Item value={option.value} label={option.label}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input type="hidden" name="style" value={$storyStore.selectedStyle} />
							</div>
						</div>

						{#if $storyStore.selectedStyle === 'custom'}
							<div class="mb-2">
								<label for="customStylePrompt" class="mb-1 block text-sm font-medium">Custom Style Prompt</label>
								<Input
									bind:value={$storyStore.customStylePrompt}
									name="customStylePrompt"
									placeholder="e.g., anime style, cel-shaded, studio ghibli inspired..."
									class="w-full"
								/>
							</div>
						{/if}

						<Textarea
							bind:value={$storyStore.prompt}
							name="prompt"
							placeholder="An anime cartoon about cybernetic capybara hackers infiltrating an encrypted government network in a Brazilian favela."
							class="min-h-32"
							required
							onkeydown={(e) => handleStoryKeydown(e, mainFormElement)}
						/>
					</div>

					<div class="flex gap-2">
						<Button
							onclick={handleUseThisStory}
							disabled={$storyStore.isGenerating || !$storyStore.prompt.trim()}
						>
							{#if $storyStore.isGenerating && shouldNavigateToCharactersAfterStory}
								<Loader2 class="h-4 w-4 animate-spin" />
								Generating...
							{:else}
								<Video class="h-4 w-4" />
								Generate Video
							{/if}
						</Button>
						<Button type="submit" variant="outline" disabled={$storyStore.isGenerating || !$storyStore.prompt.trim()}>
							{#if $storyStore.isGenerating && !shouldNavigateToCharactersAfterStory}
								<Loader2 class="h-4 w-4 animate-spin" />
								Expanding...
							{:else}
								<Pencil class="h-4 w-4" />
								Fine-tune
							{/if}
						</Button>
					</div>
					{#if $storyStore.isGenerating}
						<ProgressBar type="generateStory" isActive={true} class="mt-2 max-w-md" />
					{/if}
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
									<div>
										<Input
											bind:value={editableTitle}
											class="text-xl font-semibold"
											placeholder="Story title..."
										/>
									</div>
									<div class="space-y-4">
										{#each editableScenes as scene, sceneIndex}
											<div class="rounded-md bg-muted/50 p-3">
												<h3 class="mb-2 font-semibold">Scene {scene.number}</h3>

												<div class="mb-2">
													<p class="text-xs font-medium text-muted-foreground uppercase">Description:</p>
													<Textarea
														bind:value={editableScenes[sceneIndex].description}
														class="mt-1 min-h-20 text-sm"
														placeholder="Scene description..."
													/>
												</div>

												<div class="mb-2">
													<p class="text-xs font-medium text-muted-foreground uppercase">Dialogue:</p>
													<Textarea
														bind:value={editableScenes[sceneIndex].dialogue}
														class="mt-1 min-h-16 text-sm italic"
														placeholder="Dialogue (optional)..."
													/>
												</div>

												<div>
													<p class="text-xs font-medium text-muted-foreground uppercase">Action:</p>
													<Textarea
														bind:value={editableScenes[sceneIndex].action}
														class="mt-1 min-h-16 text-sm"
														placeholder="Action (optional)..."
													/>
												</div>
											</div>
										{/each}
									</div>

									{#if editableCharacters.length > 0}
										<div class="space-y-4">
											<h3 class="font-semibold">Characters</h3>
											{#each editableCharacters as char, charIndex}
												<div class="rounded-md bg-muted/50 p-3">
													<div class="mb-2">
														<p class="text-xs font-medium text-muted-foreground uppercase">Name:</p>
														<Input
															bind:value={editableCharacters[charIndex].name}
															class="mt-1 text-sm font-medium"
															placeholder="Character name..."
														/>
													</div>
													<div class="mb-2">
														<p class="text-xs font-medium text-muted-foreground uppercase">Description:</p>
														<Textarea
															bind:value={editableCharacters[charIndex].description}
															class="mt-1 min-h-12 text-sm"
															placeholder="Brief overall description..."
														/>
													</div>
													<div class="mb-2">
														<p class="text-xs font-medium text-muted-foreground uppercase">Physical Description:</p>
														<Textarea
															bind:value={editableCharacters[charIndex].physical}
															class="mt-1 min-h-16 text-sm"
															placeholder="Appearance, clothing, distinguishing features..."
														/>
													</div>
													<div>
														<p class="text-xs font-medium text-muted-foreground uppercase">Personality & Background:</p>
														<Textarea
															bind:value={editableCharacters[charIndex].profile}
															class="mt-1 min-h-16 text-sm"
															placeholder="Personality traits, background, motivations..."
														/>
													</div>
												</div>
											{/each}
										</div>
									{/if}

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
									<Loader2 class="h-4 w-4 animate-spin" />
									Regenerating...
								{:else}
									<RotateCcw class="h-4 w-4" />
									Regenerate
								{/if}
							</Button>
							<Button onclick={startManualEdit} variant="outline">
								<Pencil class="h-4 w-4" />
								Manual Edit
							</Button>
							<Button onclick={startPromptEdit} variant="outline">
								<Sparkles class="h-4 w-4" />
								Prompt Edit
							</Button>
							<Button onclick={startSmartExpand} variant="outline" disabled={$storyStore.isGenerating}>
								<Wand2 class="h-4 w-4" />
								Smart Expand
							</Button>
						</div>

						{#if $storyStore.isEditingWithPrompt}
							<form
								bind:this={editFormElement}
								method="POST"
								action="?/editStory"
								use:enhance={({ formData }) => {
									// Set currentStory at submission time to ensure we have the latest version (full Story object)
									const currentStoryJSON = latestStoryForEdit;
									formData.set('currentStory', currentStoryJSON);
									const timing = createTimingContext('editStory');
									timing.start();
									storyStore.update(state => ({ ...state, isGenerating: true }));
									capturedPromptForNextStory = `Edit: ${$storyStore.editPrompt}`;
									return async ({ result, update }) => {
										timing.complete(result.type === 'success');
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
									<h3 class="text-lg font-semibold">Prompt Edit</h3>
									<p class="text-sm text-muted-foreground">
										Describe the changes you want to make to the story
									</p>
									<input type="hidden" name="currentStory" value="" />
									<input type="hidden" name="length" value={$storyStore.selectedLength?.value || '5s'} />
									<input type="hidden" name="style" value={$storyStore.selectedStyle} />
									<input type="hidden" name="customStylePrompt" value={$storyStore.customStylePrompt} />
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
												<Loader2 class="h-4 w-4 animate-spin" />
												Regenerating...
											{:else}
												Regenerate Story
											{/if}
										</Button>
									</div>
									{#if $storyStore.isGenerating}
										<ProgressBar type="editStory" isActive={true} class="mt-2" />
									{/if}
								</div>
							</form>
						{/if}
					{/if}
				{/each}
				</div>
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
			<input type="hidden" name="style" value={$storyStore.selectedStyle} />
			<input type="hidden" name="customStylePrompt" value={$storyStore.customStylePrompt} />
		</form>

		<form
			bind:this={smartExpandFormElement}
			method="POST"
			action="?/smartExpandStory"
			class="hidden"
			use:enhance={() => {
				const timing = createTimingContext('editStory');
				timing.start();
				storyStore.update(state => ({ ...state, isGenerating: true }));
				return async ({ result, update }) => {
					timing.complete(result.type === 'success');
					await update({ reset: false });
					storyStore.update(state => ({
						...state,
						isGenerating: false
					}));
				};
			}}
		>
			<input type="hidden" name="currentStory" value="" />
			<input type="hidden" name="length" value={$storyStore.selectedLength.value} />
			<input type="hidden" name="style" value={$storyStore.selectedStyle} />
			<input type="hidden" name="customStylePrompt" value={$storyStore.customStylePrompt} />
		</form>
	</section>

	<!-- ========== WORLD SECTION ========== -->
	<section
		id="world"
		bind:this={sectionRefs.world}
		class="scroll-mt-16 border-b pb-8"
	>
		<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
			<!-- Left Column: Section Header -->
			<div>
				<h1 class="text-3xl font-bold mb-3">World</h1>
				<p class="text-muted-foreground">Create characters, locations, etc</p>
			</div>

			<!-- Right Column: Content -->
			<div class="flex flex-col gap-4 w-full xl:max-w-[32rem]">
				{#if form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				<!-- Filter Tabs -->
				<div class="flex flex-wrap gap-2">
					{#each worldFilterOptions as option}
						{@const count =
							option.value === 'all'
								? $worldStore.elements.length
								: option.value === 'character'
									? characterCount
									: option.value === 'location'
										? locationCount
										: option.value === 'object'
											? objectCount
											: conceptCount}
						<Button
							variant={$worldStore.filterType === option.value ? 'default' : 'outline'}
							size="sm"
							onclick={() => setFilterType(option.value)}
						>
							{option.label}
							{#if count > 0}
								<span class="ml-1 text-xs">({count})</span>
							{/if}
						</Button>
					{/each}
				</div>

				<!-- Element Pills/Buttons -->
				{#if $worldStore.elements.length > 0}
					<div class="rounded-md border p-4">
						<div class="flex flex-wrap gap-2">
							{#each filteredWorldElements as element}
								<Button
									variant={$worldStore.expandedElementIds.has(element.id) ? 'default' : 'outline'}
									size="sm"
									onclick={() => toggleElementExpanded(element.id)}
									style="border-color: {ELEMENT_TYPE_COLORS[element.type]}; {$worldStore.expandedElementIds.has(element.id) ? `background-color: ${ELEMENT_TYPE_COLORS[element.type]};` : ''}"
								>
									{element.name}
								</Button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Add Custom Element -->
				<div class="rounded-md border p-4">
					<h2 class="mb-3 text-lg font-semibold">Add Element</h2>
					<div class="flex flex-col gap-3">
						<div class="flex gap-2">
							<Input
								bind:value={customElementName}
								placeholder="Element name"
								class="flex-1"
							/>
							<Select.Root type="single" bind:value={customElementType}>
								<Select.Trigger class="w-36">
									{ELEMENT_TYPE_LABELS[customElementType]}
								</Select.Trigger>
								<Select.Content>
									{#each worldTypeOptions as option}
										<Select.Item value={option.value} label={option.label}>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<Textarea
							bind:value={customElementDescription}
							placeholder="Describe this element... Press Enter to add, Shift+Enter for new line."
							class="min-h-24"
							onkeydown={handleWorldKeydown}
						/>
						<Button
							onclick={handleAddWorldElement}
							variant="outline"
							disabled={!customElementName.trim() || !customElementDescription.trim()}
						>
							<Plus class="mr-2 h-4 w-4" />
							Add {ELEMENT_TYPE_LABELS[customElementType]}
						</Button>
					</div>
				</div>

				<!-- Expanded Elements -->
				{#each filteredWorldElements as element}
					{#if $worldStore.expandedElementIds.has(element.id)}
						<div
							class="flex flex-col gap-4 rounded-md border p-4"
							style="border-left: 4px solid {ELEMENT_TYPE_COLORS[element.type]};"
							data-element-content={element.id}
						>
							<div class="flex items-start justify-between">
								<div>
									<div class="flex items-center gap-2">
										<h2 class="text-xl font-semibold">{element.name}</h2>
										<span
											class="rounded-full px-2 py-0.5 text-xs text-white"
											style="background-color: {ELEMENT_TYPE_COLORS[element.type]};"
										>
											{ELEMENT_TYPE_LABELS[element.type]}
										</span>
									</div>
									<p class="text-sm text-muted-foreground mt-1">{element.description}</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => handleDeleteWorldElement(element.id)}
									class="text-destructive hover:text-destructive"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>

							{#if element.enhancedDescription && element.enhancedDescription !== element.description}
								<div class="rounded-md bg-muted/50 p-3">
									<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
										Enhanced Description:
									</p>
									<p class="text-sm">{element.enhancedDescription}</p>
								</div>
							{/if}

							<!-- Images -->
							{#if element.images.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each element.images as img}
										<div class="relative">
											<img
												src={img.imageUrl}
												alt={element.name}
												class="w-32 h-32 rounded-md object-cover cursor-pointer {img.isActive ? 'ring-2 ring-primary' : ''}"
												onclick={() => setActiveElementImage(element.id, img.id)}
											/>
											{#if !img.isActive && element.images.length > 1}
												<button
													class="absolute top-1 right-1 rounded-full bg-destructive p-1 text-white hover:bg-destructive/80"
													onclick={() => deleteElementImage(element.id, img.id)}
												>
													<Trash2 class="h-3 w-3" />
												</button>
											{/if}
										</div>
									{/each}
								</div>
							{/if}

							<!-- Action Buttons -->
							<div class="flex flex-col gap-3">
								<div class="flex flex-wrap gap-2">
									{#if !element.isEnhanced}
										<!-- Initial Enhance Description button -->
										<form
											method="POST"
											action="?/enhanceDescription"
											use:enhance={() => {
												isWorldEnhancing = true;
												activeElementId = element.id;
												return async ({ update }) => {
													await update();
													isWorldEnhancing = false;
												};
											}}
										>
											<input type="hidden" name="description" value={getWorldCurrentDescription(element)} />
											<input type="hidden" name="elementType" value={element.type} />
											<input type="hidden" name="elementName" value={element.name} />
											<Button
												type="submit"
												variant="outline"
												disabled={isWorldEnhancing || !element.description}
											>
												{#if isWorldEnhancing && activeElementId === element.id}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Enhancing...
												{:else}
													Enhance Description
												{/if}
											</Button>
										</form>
									{:else if !worldShowPromptTextarea.has(element.id)}
										<!-- Smart Improve and Improve With Prompt buttons -->
										<form
											method="POST"
											action="?/improveDescription"
											use:enhance={() => {
												isWorldEnhancing = true;
												activeElementId = element.id;
												return async ({ update }) => {
													await update();
													isWorldEnhancing = false;
												};
											}}
										>
											<input type="hidden" name="description" value={getWorldCurrentDescription(element)} />
											<input type="hidden" name="elementType" value={element.type} />
											<Button
												type="submit"
												variant="outline"
												disabled={isWorldEnhancing || isWorldGenerating}
											>
												{#if isWorldEnhancing && activeElementId === element.id}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Improving...
												{:else}
													Re-enhance Description
												{/if}
											</Button>
										</form>
										<Button
											variant="outline"
											onclick={() => openWorldPromptTextarea(element.id)}
											disabled={isWorldEnhancing || isWorldGenerating}
										>
											Enhance With Prompt
										</Button>
									{/if}

									<form
										method="POST"
										action="?/generateImage"
										use:enhance={() => {
											isWorldGenerating = true;
											activeElementId = element.id;
											return async ({ update }) => {
												await update();
												isWorldGenerating = false;
											};
										}}
									>
										<input type="hidden" name="description" value={getWorldCurrentDescription(element)} />
										<input type="hidden" name="elementType" value={element.type} />
										<Button type="submit" disabled={isWorldGenerating || !getWorldCurrentDescription(element)}>
											{#if isWorldGenerating && activeElementId === element.id}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Generating...
											{:else}
												Generate Image
											{/if}
										</Button>
									</form>
								</div>

								{#if worldShowPromptTextarea.has(element.id)}
									<!-- Prompt textarea for improving description -->
									<div class="flex flex-col gap-2 rounded-md border p-3">
										<Textarea
											bind:value={worldUserPrompts[element.id]}
											placeholder="Describe how you'd like to enhance the description..."
											class="min-h-20"
										/>
										<div class="flex gap-2">
											<form
												method="POST"
												action="?/improveDescription"
												use:enhance={() => {
													isWorldEnhancing = true;
													activeElementId = element.id;
													return async ({ update }) => {
														await update();
														isWorldEnhancing = false;
													};
												}}
											>
												<input type="hidden" name="description" value={getWorldCurrentDescription(element)} />
												<input type="hidden" name="userPrompt" value={worldUserPrompts[element.id] || ''} />
												<input type="hidden" name="elementType" value={element.type} />
												<Button
													type="submit"
													disabled={isWorldEnhancing || !worldUserPrompts[element.id]?.trim()}
												>
													{#if isWorldEnhancing && activeElementId === element.id}
														<Loader2 class="mr-2 h-4 w-4 animate-spin" />
														Enhancing...
													{:else}
														Enhance
													{/if}
												</Button>
											</form>
											<Button variant="outline" onclick={() => closeWorldPromptTextarea(element.id)}>
												Cancel
											</Button>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{/each}

				<!-- Empty State -->
				{#if $worldStore.elements.length === 0}
					<div class="rounded-md border border-dashed p-8 text-center">
						<p class="text-muted-foreground">
							No world elements yet. Add characters, locations, objects, or concepts to build your story world.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- ========== STORYBOARD SECTION ========== -->
	<section
		id="storyboard"
		bind:this={sectionRefs.storyboard}
		class="scroll-mt-16 border-b pb-8"
	>
		<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
			<!-- Left Column: Section Header -->
			<div class="flex items-start justify-between sm:flex-col sm:gap-2">
				<div>
					<h1 class="text-3xl font-bold mb-3">Storyboard</h1>
					<p class="text-muted-foreground">Create and arrange your scenes</p>
				</div>
				{#if testingMode}
					<Button variant="outline" size="sm" onclick={loadTestStoryboard} title="Load test data">
						<FlaskConical class="!mr-0 h-4 w-4" />
					</Button>
				{/if}
			</div>

			<!-- Right Column: Content -->
			<div class="flex flex-col gap-4 w-full xl:max-w-[32rem]">
				<!-- New Scene Button (at top of right column) -->
				<div
					class="w-72 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/20 transition-colors"
					onclick={handleAddScene}
					ondragover={handleStoryboardSceneDragOver}
					ondrop={handleNewStoryboardElementDrop}
					role="button"
					tabindex="0"
					data-add-scene
				>
					<Plus class="h-12 w-12 text-muted-foreground" />
				</div>

				<!-- Timeline info -->
				{#if activeScenes.length > 0}
					<div class="flex items-center gap-4 text-sm text-muted-foreground">
						<span>Total Duration: <span class="font-medium">{formatTime(totalStoryboardDuration)}</span></span>
						<span>Scenes: <span class="font-medium">{activeScenes.length}</span></span>
					</div>
				{/if}

				<!-- Scene Cards Grid -->
				{#if activeScenes.length > 0}
				<div class="flex flex-wrap gap-4">
					{#each activeScenes as scene, index}
					{@const sceneImageUrl = getActiveSceneImageUrl(scene)}
					{@const showText = sceneTextVisibility[scene.id] !== false}
					<div
						class="relative w-72 rounded-lg border bg-card overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
						draggable="true"
						ondragstart={(e) => handleStoryboardSceneDragStart(e, index)}
						ondragover={handleStoryboardSceneDragOver}
						ondrop={(e) => handleStoryboardSceneDrop(e, index)}
						ondragend={handleStoryboardSceneDragEnd}
						onclick={() => openSceneEditModal(scene)}
						role="button"
						tabindex="0"
						data-scene-card={scene.id}
					>
						<!-- Scene image background -->
						{#if sceneImageUrl}
							<div class="relative aspect-video">
								<img
									src={sceneImageUrl}
									alt={scene.title}
									class="absolute inset-0 h-full w-full object-cover"
								/>
								<!-- Overlay when showing text -->
								{#if showText}
									<div class="absolute inset-0 bg-black/60"></div>
								{/if}
							</div>
						{:else}
							<div class="aspect-video bg-muted"></div>
						{/if}

						<!-- Content overlay -->
						<div
							class="absolute inset-0 p-3 flex flex-col {sceneImageUrl && showText ? 'text-white' : ''}"
							ondragover={handleStoryboardSceneDragOver}
							ondrop={(e) => {
								e.stopPropagation();
								handleStoryboardElementDrop(e, scene.id);
							}}
						>
							{#if showText || !sceneImageUrl}
								<!-- Top row: badges and icons -->
								<div class="flex items-start justify-between">
									<div class="flex flex-wrap gap-1">
										<span class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
											Scene {index + 1}
										</span>
										<span class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
											{scene.duration}s
										</span>
									</div>
									<div class="flex gap-1">
										<button
											class="rounded p-1 hover:bg-white/20 transition-colors"
											onclick={(e) => handleCloneScene(scene.id, e)}
											title="Clone scene"
										>
											<Copy class="h-4 w-4" />
										</button>
										<button
											class="rounded p-1 hover:bg-white/20 transition-colors"
											onclick={(e) => handleArchiveScene(scene.id, e)}
											title="Archive scene"
										>
											<Archive class="h-4 w-4" />
										</button>
										<button
											class="rounded p-1 hover:bg-red-500/80 text-red-400 transition-colors"
											onclick={(e) => confirmDeleteScene(scene.id, e)}
											title="Delete scene"
										>
											<X class="h-4 w-4" />
										</button>
									</div>
								</div>

								<!-- Title badge (second line) -->
								{#if scene.title && scene.title !== `Scene ${index + 1}`}
									<div class="mt-1">
										<span class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
											{truncateSceneText(scene.title, 25)}
										</span>
									</div>
								{/if}

								<!-- Description (2 lines max) -->
								<p class="mt-2 text-sm line-clamp-2 flex-1">
									{scene.customDescription || scene.description || 'No description'}
								</p>

								<!-- World element pills -->
								{#if scene.assignedElements.length > 0}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each scene.assignedElements.slice(0, 4) as elementId}
											{@const element = getWorldElement(elementId)}
											{#if element}
												<span
													class="rounded px-2 py-0.5 text-xs font-medium text-white"
													style="background-color: {ELEMENT_TYPE_COLORS[element.type]}"
												>
													{truncateSceneText(element.name, 12)}
												</span>
											{/if}
										{/each}
										{#if scene.assignedElements.length > 4}
											<span class="rounded bg-gray-500 px-2 py-0.5 text-xs font-medium text-white">
												+{scene.assignedElements.length - 4}
											</span>
										{/if}
									</div>
								{/if}
							{/if}
						</div>

						<!-- Text toggle button (only when image exists) -->
						{#if sceneImageUrl}
							<button
								class="absolute bottom-2 left-2 rounded p-1 bg-black/50 text-white hover:bg-black/70 transition-colors"
								onclick={(e) => toggleSceneTextVisibility(scene.id, e)}
								title={showText ? 'Hide text' : 'Show text'}
							>
								{#if showText}
									<Type class="h-4 w-4" />
								{:else}
									<Eye class="h-4 w-4" />
								{/if}
							</button>
						{/if}

						<!-- Status indicator -->
						{#if scene.status === 'generating'}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<Loader2 class="h-8 w-8 animate-spin text-white" />
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{/if}

			<!-- Archived Scenes Section -->
			<div class="border-t pt-6 mt-6">
				<h2 class="text-lg font-semibold mb-4">Archived Scenes</h2>
				{#if archivedScenes.length === 0}
					<p class="text-sm text-muted-foreground">You have no archived scenes</p>
				{:else}
					<div class="flex flex-wrap gap-2">
						{#each archivedScenes as scene}
							{@const sceneImageUrl = getActiveSceneImageUrl(scene)}
							<button
								class="w-24 h-16 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
								onclick={() => openSceneEditModal(scene)}
								title={scene.title}
							>
								{#if sceneImageUrl}
									<img
										src={sceneImageUrl}
										alt={scene.title}
										class="w-full h-full object-cover"
									/>
								{:else}
									<div class="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
										{scene.title.charAt(0)}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
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
		<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
			<!-- Left Column: Section Header -->
			<div class="flex items-start justify-between sm:flex-col sm:gap-2">
				<div>
					<h1 class="text-3xl font-bold mb-3">Video</h1>
					<p class="text-muted-foreground">Generate video clips from your scenes</p>
				</div>
				{#if testingMode}
					<Button variant="outline" size="sm" onclick={loadTestVideo} title="Load test data">
						<FlaskConical class="!mr-0 h-4 w-4" />
					</Button>
				{/if}
			</div>

			<!-- Right Column: Content -->
			<div class="flex flex-col gap-4 w-full xl:max-w-[32rem]">
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

			<div class="flex items-center justify-center gap-2">
				<Button variant="outline" onclick={() => togglePlayback()} disabled={!hasScenes}>
					{#if $storyboardStore.isPlaying}
						<Pause class="mr-2 h-4 w-4" />
						Stop Preview
					{:else}
						<Play class="mr-2 h-4 w-4" />
						Preview
					{/if}
				</Button>

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
							Generate Video
						{/if}
					</Button>
				{:else}
					<Button onclick={handleRegenerate} variant="outline">
						<RotateCcw class="mr-2 h-4 w-4" />
						Regenerate
					</Button>
				{/if}

				{#if allCompleted}
					<Button onclick={downloadVideo}>
						<Download class="mr-2 h-4 w-4" />
						Download
					</Button>
				{/if}
			</div>

			{#each sceneVideos as sceneVideo, index}
				<form
					id="generate-form-{index}"
					method="POST"
					action="?/generateSceneVideo"
					class="hidden"
					use:enhance={() => {
						const timing = createTimingContext('generateVideo');
						timing.start();
						return async ({ result, update }) => {
							timing.complete(result.type === 'success');
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
				<div class="text-xs rounded p-2" style="background-color: #f5f5f5; color: #666; border: 1px solid #ddd;">
					<strong>Kling AI 2.6:</strong> Generates 5-second video clips with native audio from each scene image.
					Cost: ~$0.35-0.70 per clip ({enableSound ? 'with' : 'without'} audio).
					<strong>Total estimate: ~${(sceneVideos.length * 0.5).toFixed(2)}</strong>
				</div>
			{/if}
		</div>
	</section>
</div>

<!-- Scene Edit Modal -->
<Sheet.Root bind:open={sceneEditModalOpen}>
	<Sheet.Content side="right" class="w-[600px] overflow-y-auto">
		<Sheet.Header>
			<Sheet.Title class="flex items-center gap-2">
				{#if editingScene}
					<span class="rounded bg-blue-500 px-2 py-0.5 text-sm font-medium text-white">
						Scene {activeScenes.findIndex((s) => s.id === editingScene?.id) + 1 ||
							archivedScenes.findIndex((s) => s.id === editingScene?.id) + 1}
					</span>
					<span class="rounded bg-blue-500 px-2 py-0.5 text-sm font-medium text-white">
						{editingScene.duration}s
					</span>
					{#if editingScene.isArchived}
						<span class="rounded bg-yellow-500 px-2 py-0.5 text-sm font-medium text-white">
							Archived
						</span>
					{/if}
				{/if}
			</Sheet.Title>
		</Sheet.Header>

		<div class="space-y-4 py-4">
			<div>
				<label for="scene-title" class="text-sm font-medium">Title</label>
				<Input id="scene-title" bind:value={editSceneTitle} placeholder="Scene title" />
			</div>

			<div>
				<label for="scene-description" class="text-sm font-medium">Description</label>
				<Textarea
					id="scene-description"
					bind:value={editSceneDescription}
					placeholder="Describe what happens in this scene..."
					rows={3}
				/>
			</div>

			<div>
				<label for="scene-dialog" class="text-sm font-medium">Dialog</label>
				<Textarea
					id="scene-dialog"
					bind:value={editSceneDialog}
					placeholder="Character dialog for this scene..."
					rows={2}
				/>
			</div>

			<div>
				<label for="scene-action" class="text-sm font-medium">Action</label>
				<Textarea
					id="scene-action"
					bind:value={editSceneAction}
					placeholder="Physical actions in this scene..."
					rows={2}
				/>
			</div>

			<!-- World Elements in Modal -->
			{#if editingScene && editingScene.assignedElements.length > 0}
				{@const characters = editingScene.assignedElements
					.map((id) => getWorldElement(id))
					.filter((el) => el?.type === 'character')}
				{@const locations = editingScene.assignedElements
					.map((id) => getWorldElement(id))
					.filter((el) => el?.type === 'location')}
				{@const objects = editingScene.assignedElements
					.map((id) => getWorldElement(id))
					.filter((el) => el?.type === 'object')}
				{@const concepts = editingScene.assignedElements
					.map((id) => getWorldElement(id))
					.filter((el) => el?.type === 'concept')}
				<div class="border-t pt-4">
					<h4 class="text-sm font-medium mb-3">World Elements</h4>
					<div class="grid grid-cols-4 gap-4">
						{#if characters.length > 0}
							<div>
								<div class="text-xs font-medium text-muted-foreground mb-1">Characters</div>
								{#each characters as element}
									{#if element}
										<div class="flex items-center gap-1 mb-1">
											{#if getActiveElementImageUrl(element)}
												<img
													src={getActiveElementImageUrl(element)}
													alt={element.name}
													class="w-6 h-6 rounded object-cover"
												/>
											{/if}
											<span
												class="rounded px-1.5 py-0.5 text-xs text-white"
												style="background-color: {ELEMENT_TYPE_COLORS.character}"
											>
												{truncateSceneText(element.name, 10)}
											</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}

						{#if locations.length > 0}
							<div>
								<div class="text-xs font-medium text-muted-foreground mb-1">Locations</div>
								{#each locations as element}
									{#if element}
										<div class="flex items-center gap-1 mb-1">
											{#if getActiveElementImageUrl(element)}
												<img
													src={getActiveElementImageUrl(element)}
													alt={element.name}
													class="w-6 h-6 rounded object-cover"
												/>
											{/if}
											<span
												class="rounded px-1.5 py-0.5 text-xs text-white"
												style="background-color: {ELEMENT_TYPE_COLORS.location}"
											>
												{truncateSceneText(element.name, 10)}
											</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}

						{#if objects.length > 0}
							<div>
								<div class="text-xs font-medium text-muted-foreground mb-1">Objects</div>
								{#each objects as element}
									{#if element}
										<div class="flex items-center gap-1 mb-1">
											{#if getActiveElementImageUrl(element)}
												<img
													src={getActiveElementImageUrl(element)}
													alt={element.name}
													class="w-6 h-6 rounded object-cover"
												/>
											{/if}
											<span
												class="rounded px-1.5 py-0.5 text-xs text-white"
												style="background-color: {ELEMENT_TYPE_COLORS.object}"
											>
												{truncateSceneText(element.name, 10)}
											</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}

						{#if concepts.length > 0}
							<div>
								<div class="text-xs font-medium text-muted-foreground mb-1">Concepts</div>
								{#each concepts as element}
									{#if element}
										<div class="flex items-center gap-1 mb-1">
											{#if getActiveElementImageUrl(element)}
												<img
													src={getActiveElementImageUrl(element)}
													alt={element.name}
													class="w-6 h-6 rounded object-cover"
												/>
											{/if}
											<span
												class="rounded px-1.5 py-0.5 text-xs text-white"
												style="background-color: {ELEMENT_TYPE_COLORS.concept}"
											>
												{truncateSceneText(element.name, 10)}
											</span>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<Sheet.Footer class="flex justify-between">
			<div>
				{#if editingScene?.isArchived}
					<Button
						variant="outline"
						onclick={() => {
							if (editingScene) handleUnarchiveScene(editingScene.id);
							sceneEditModalOpen = false;
						}}
					>
						<ArchiveRestore class="mr-2 h-4 w-4" />
						Unarchive
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (sceneEditModalOpen = false)}>Cancel</Button>
				<Button onclick={saveSceneEdits}>Save Changes</Button>
			</div>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>

<!-- Scene Delete Confirmation Sheet -->
<Sheet.Root bind:open={sceneDeleteConfirmOpen}>
	<Sheet.Content side="right" class="w-[400px]">
		<Sheet.Header>
			<Sheet.Title>Delete Scene</Sheet.Title>
			<Sheet.Description>
				Are you sure you want to delete this scene? This action cannot be undone.
			</Sheet.Description>
		</Sheet.Header>
		<Sheet.Footer>
			<Button variant="outline" onclick={() => (sceneDeleteConfirmOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleDeleteScene}>Delete</Button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
