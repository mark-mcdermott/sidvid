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
	import { projectStore } from '$lib/stores/projectStore';

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
		setElementImageError,
		clearElementImageError,
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
		initializeScenesFromStory,
		getActiveScenes,
		getArchivedScenes,
		getActiveSceneImageUrl,
		getTotalDuration,
		addSceneImage,
		setSceneStatus,
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
	let generatingWorldElementIds = $state<Set<string>>(new Set());
	let lastProcessedWorldEnhancedText = $state<string>('');
	let lastProcessedWorldImageUrl = $state<string>('');
	let autoGenerateWorldElementImages = $state(false);
	let pendingWorldElementIds = $state<string[]>([]);
	let autoGenerateStoryboardImages = $state(false);
	let generatingStoryboardSceneIds = $state<Set<string>>(new Set());

	// Track which elements have prompt textarea open
	let worldShowPromptTextarea = $state<Set<string>>(new Set());
	let worldUserPrompts = $state<{ [key: string]: string }>({});

	// Custom element forms (multiple can be open at once)
	interface AddElementForm {
		id: string;
		name: string;
		description: string;
		type: ElementType;
	}
	let addElementForms = $state<AddElementForm[]>([]);

	function createAddElementForm(): AddElementForm {
		return {
			id: `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: '',
			description: '',
			type: 'character'
		};
	}

	function addNewElementForm() {
		addElementForms = [...addElementForms, createAddElementForm()];
	}

	function removeElementForm(formId: string) {
		addElementForms = addElementForms.filter(f => f.id !== formId);
	}

	function submitElementForm(formId: string) {
		const form = addElementForms.find(f => f.id === formId);
		if (form && form.name.trim() && form.description.trim()) {
			addElement(form.name.trim(), form.type, form.description.trim());
			removeElementForm(formId);
		}
	}

	function handleElementFormKeydown(e: KeyboardEvent, formId: string) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submitElementForm(formId);
		}
	}

	// Legacy single form (keeping for backwards compat, will remove)
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

	async function generateWorldElementImage(elementId: string, isRetry = false) {
		const element = $worldStore.elements.find(el => el.id === elementId);
		if (!element || element.images.length > 0) return; // Skip if no element or already has image

		const description = element.enhancedDescription || element.description;
		if (!description) return;

		// Clear any existing error before starting
		clearElementImageError(elementId);

		// Track this element as generating (supports parallel generation)
		generatingWorldElementIds = new Set([...generatingWorldElementIds, elementId]);
		isWorldGenerating = true;

		try {
			const formData = new FormData();
			formData.append('description', description);
			formData.append('elementType', element.type);

			const response = await fetch('?/generateImage', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			console.log('World element image generation result for', element.name, ':', result);

			// Parse SvelteKit devalue format
			let actionData = null;

			if (result.data) {
				try {
					const parsed = JSON.parse(result.data);
					if (Array.isArray(parsed) && parsed.length > 0) {
						const mainObj = parsed[0];
						if (typeof mainObj === 'object' && mainObj !== null) {
							const resolveValue = (val: any): any => {
								if (typeof val === 'number' && parsed[val] !== undefined) {
									const resolved = parsed[val];
									if (typeof resolved === 'object' && resolved !== null) {
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

			console.log('Parsed world element action data for', element.name, ':', actionData);

			if (actionData?.success && actionData?.character?.imageUrl) {
				addElementImage(elementId, actionData.character.imageUrl, actionData.character.revisedPrompt);
			} else if (actionData?.error) {
				// API returned an error
				if (!isRetry) {
					console.log('Image generation failed for', element.name, ', retrying once...', actionData.error);
					generatingWorldElementIds = new Set([...generatingWorldElementIds].filter(id => id !== elementId));
					if (generatingWorldElementIds.size === 0) isWorldGenerating = false;
					await generateWorldElementImage(elementId, true);
					return;
				}
				// Set error on the element after retry fails
				setElementImageError(elementId, actionData.error);
			}
		} catch (error) {
			console.error('Error generating world element image for', element.name, ':', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
			if (!isRetry) {
				console.log('Image generation failed for', element.name, ', retrying once...');
				generatingWorldElementIds = new Set([...generatingWorldElementIds].filter(id => id !== elementId));
				if (generatingWorldElementIds.size === 0) isWorldGenerating = false;
				await generateWorldElementImage(elementId, true);
				return;
			}
			// Set error on the element after retry fails
			setElementImageError(elementId, errorMessage);
		} finally {
			// Remove this element from generating set
			generatingWorldElementIds = new Set([...generatingWorldElementIds].filter(id => id !== elementId));
			if (generatingWorldElementIds.size === 0) isWorldGenerating = false;
		}
	}

	async function generateAllWorldElementImages(elementIds: string[]) {
		// Generate images in parallel
		const elementsToGenerate = elementIds.filter(elementId => {
			const element = $worldStore.elements.find(el => el.id === elementId);
			return element && element.images.length === 0;
		});

		console.log('Starting parallel image generation for', elementsToGenerate.length, 'elements');
		await Promise.all(elementsToGenerate.map(elementId => generateWorldElementImage(elementId)));

		// After world element images are done, trigger storyboard image generation
		console.log('World element images complete, starting storyboard image generation');
		autoGenerateStoryboardImages = true;
	}

	// Generate a single storyboard scene image
	async function generateStoryboardSceneImage(sceneId: string, isRetry = false): Promise<void> {
		const scene = $storyboardStore.scenes.find(s => s.id === sceneId);
		if (!scene) return;

		// Skip if scene already has images
		if (scene.images.length > 0) return;

		// Set scene as generating
		setSceneStatus(sceneId, 'generating');
		generatingStoryboardSceneIds = new Set([...generatingStoryboardSceneIds, sceneId]);

		try {
			// Build the prompt from scene description and assigned elements
			let prompt = scene.customDescription || scene.description;

			// Add character and location details from assigned elements
			const assignedCharacters: string[] = [];
			const assignedLocations: string[] = [];

			for (const elementId of scene.assignedElements) {
				const element = $worldStore.elements.find(el => el.id === elementId);
				if (element) {
					if (element.type === 'character') {
						assignedCharacters.push(`${element.name}: ${element.enhancedDescription || element.description}`);
					} else if (element.type === 'location') {
						assignedLocations.push(`${element.name}: ${element.enhancedDescription || element.description}`);
					}
				}
			}

			// Enhance prompt with character and location context
			if (assignedLocations.length > 0) {
				prompt += `\n\nSetting: ${assignedLocations.join('; ')}`;
			}
			if (assignedCharacters.length > 0) {
				prompt += `\n\nCharacters in scene: ${assignedCharacters.join('; ')}`;
			}

			console.log('Generating storyboard image for scene:', scene.title, 'with prompt:', prompt.substring(0, 100) + '...');

			const formData = new FormData();
			formData.append('description', prompt);
			formData.append('elementType', 'scene');

			const response = await fetch('?/generateImage', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			// Parse SvelteKit devalue format (same as world element parsing)
			let actionData: any = null;

			if (result.data) {
				try {
					const parsed = JSON.parse(result.data);
					if (Array.isArray(parsed) && parsed.length > 0) {
						const mainObj = parsed[0];
						if (typeof mainObj === 'object' && mainObj !== null) {
							const resolveValue = (val: any): any => {
								if (typeof val === 'number' && parsed[val] !== undefined) {
									const resolved = parsed[val];
									if (typeof resolved === 'object' && resolved !== null) {
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

			console.log('Parsed storyboard scene action data for', scene.title, ':', actionData);

			if (actionData?.success && actionData?.character?.imageUrl) {
				addSceneImage(sceneId, actionData.character.imageUrl, actionData.character.revisedPrompt);
				console.log('Successfully added image to scene:', scene.title);
			} else if (actionData?.error) {
				if (!isRetry) {
					console.log('Storyboard image generation failed for', scene.title, ', retrying once...', actionData.error);
					generatingStoryboardSceneIds = new Set([...generatingStoryboardSceneIds].filter(id => id !== sceneId));
					await generateStoryboardSceneImage(sceneId, true);
					return;
				}
				setSceneStatus(sceneId, 'failed', actionData.error);
			} else {
				// Handle case where success is true but no imageUrl, or actionData is malformed
				const errorMsg = actionData?.success
					? 'API returned success but no image URL'
					: 'Failed to parse image generation response';
				console.error('Storyboard image generation issue for', scene.title, ':', errorMsg, 'actionData:', actionData);
				if (!isRetry) {
					generatingStoryboardSceneIds = new Set([...generatingStoryboardSceneIds].filter(id => id !== sceneId));
					await generateStoryboardSceneImage(sceneId, true);
					return;
				}
				setSceneStatus(sceneId, 'failed', errorMsg);
			}
		} catch (error) {
			console.error('Error generating storyboard scene image for', scene.title, ':', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
			if (!isRetry) {
				console.log('Storyboard image generation failed for', scene.title, ', retrying once...');
				generatingStoryboardSceneIds = new Set([...generatingStoryboardSceneIds].filter(id => id !== sceneId));
				await generateStoryboardSceneImage(sceneId, true);
				return;
			}
			setSceneStatus(sceneId, 'failed', errorMessage);
		} finally {
			generatingStoryboardSceneIds = new Set([...generatingStoryboardSceneIds].filter(id => id !== sceneId));
		}
	}

	// Generate images for all storyboard scenes in parallel
	async function generateAllStoryboardImages() {
		// Log current state for debugging
		console.log('generateAllStoryboardImages called. Total activeScenes:', activeScenes.length);
		console.log('Active scenes:', activeScenes.map(s => ({ id: s.id, title: s.title, imagesCount: s.images.length })));

		const scenesToGenerate = activeScenes.filter(scene => scene.images.length === 0);

		if (scenesToGenerate.length === 0) {
			console.log('No storyboard scenes need image generation');
			return;
		}

		console.log('Starting parallel storyboard image generation for', scenesToGenerate.length, 'scenes:', scenesToGenerate.map(s => s.title));
		await Promise.all(scenesToGenerate.map(scene => generateStoryboardSceneImage(scene.id)));
		console.log('Storyboard image generation complete');
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
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

	let selectedProvider = $state<'mock' | 'kling'>('kling');
	let enableSound = $state(true);

	// Track last processed form to prevent re-processing the same error
	// NOTE: This must NOT be $state - updating reactive state inside $effect causes infinite loops
	let lastProcessedVideoFormId: string | null = null;

	let videoElement = $state<HTMLVideoElement | null>(null);
	let currentPlayingIndex = $state(0);
	let isPlaying = $state(false);

	// Track project changes to reset video state
	// NOTE: lastProjectId must NOT be $state - updating it inside $effect would cause infinite loop
	let lastProjectId: string | null = null;
	$effect(() => {
		const currentProjectId = $projectStore.currentProject?.id ?? null;
		if (lastProjectId !== null && currentProjectId !== lastProjectId) {
			// Project changed - reset video state
			sceneVideos = [];
			currentGeneratingIndex = -1;
			isVideoGenerating = false;
			// calculatedProgress is derived from sceneVideos, so resetting sceneVideos resets it
			currentPlayingIndex = 0;
			isPlaying = false;
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
			if (retryTimeoutId) {
				clearTimeout(retryTimeoutId);
				retryTimeoutId = null;
			}
		}
		lastProjectId = currentProjectId;
	});

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

	let selectedVideoCompleted = $derived(
		sceneVideos[currentPlayingIndex]?.status === 'completed'
	);

	let hasScenes = $derived(sceneThumbnails.length > 0);
	let totalVideoDuration = $derived(sceneVideos.length * 5);

	// Calculate current preview scene index based on currentTime and scene durations
	let currentPreviewSceneIndex = $derived.by(() => {
		if (!$storyboardStore.isPlaying) return -1;
		const currentTime = $storyboardStore.currentTime;
		const activeScenes = $storyboardStore.scenes.filter(s => !s.isArchived);
		let elapsed = 0;
		for (let i = 0; i < activeScenes.length; i++) {
			elapsed += activeScenes[i].duration;
			if (currentTime < elapsed) return i;
		}
		return activeScenes.length - 1;
	});

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
		const selectedVideo = sceneVideos[currentPlayingIndex];
		if (selectedVideo?.videoUrl) {
			const link = document.createElement('a');
			link.href = selectedVideo.videoUrl;
			link.download = `sidvid-scene-${currentPlayingIndex + 1}-${Date.now()}.mp4`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	async function downloadAllVideos() {
		const completedVideos = sceneVideos.filter(sv => sv.videoUrl);
		if (completedVideos.length === 0) return;

		// Download each video with a small delay to avoid browser blocking
		for (let i = 0; i < completedVideos.length; i++) {
			const video = completedVideos[i];
			if (video.videoUrl) {
				const link = document.createElement('a');
				link.href = video.videoUrl;
				link.download = `sidvid-scene-${video.sceneIndex + 1}-${Date.now()}.mp4`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				// Small delay between downloads
				if (i < completedVideos.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 300));
				}
			}
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
			title: 'Cyber Capybaras: Mainframe Hack',
			rawContent: JSON.stringify({
				title: 'Cyber Capybaras: Mainframe Hack',
				scenes: [
					{ number: 1, description: 'A shadowy alley with neon lights flickering overhead, wires spiraling down from rooftops.', dialogue: '', action: 'Two cybernetic humanoid capybaras scuttle past, their red LED eyes scanning surroundings.' },
					{ number: 2, description: 'A high-tech control room filled with blinking servers and holographic displays.', dialogue: '', action: 'The capybaras plug cables from their appendages into the mainframe, lights flicker as hacking commences.' },
					{ number: 3, description: 'Close-up of data streams on a screen, displaying rapid-fire code and schematics.', dialogue: '', action: "The capybaras' eyes glow brighter as a progress bar fills to completion." },
					{ number: 4, description: 'An exterior cityscape view, where the dystopian skyline suddenly dims, save for the glow of neon signs.', dialogue: '', action: 'The capybaras retreat into the shadows as city lights flicker in their wake.' }
				],
				characters: [
					{ name: 'Cyber Capybara 1', description: 'A technologically-enhanced capybara with cybernetic features.', physical: 'Sleek metallic fur with embedded circuits, glowing red LED eyes, and mechanical limbs.', profile: 'Stealthy and intelligent, this capybara is experienced in infiltration and data acquisition.' },
					{ name: 'Cyber Capybara 2', description: 'A second cybernetic capybara with similar enhancements.', physical: 'Metallic shell with vibrant neon stripes, camera-like eyes, augmented hearing devices on its head.', profile: 'Strategic and resourceful, specializes in encryption and rapid data processing.' }
				],
				locations: [
					{ name: 'Neon Alley', description: 'A dimly-lit alley in a bustling cyberpunk city, featuring towering buildings with cascading wires and omnipresent neon glow interspersed with graffiti.' },
					{ name: 'Government Control Room', description: 'A sleek, futuristic room filled with wall-to-wall server units, holographic interfaces, and omnipresent blue LED illumination.' },
					{ name: 'Cyberpunk Cityscape', description: 'An expansive, futuristic city skyline at night, dominated by towering skyscrapers with digital billboards and pulsing neon lights.' }
				],
				sceneVisuals: [
					{ sceneNumber: 1, setting: 'Neon-lit alley with dim lighting and glowing wires.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'The capybaras are scampering along the ground, with neon lights casting reflections on their metallic bodies.' },
					{ sceneNumber: 2, setting: 'High-tech control room full of servers and holographic displays.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'Capybaras are interfacing with the mainframe using cables extending from their limbs.' },
					{ sceneNumber: 3, setting: 'Close-up of code on a digital screen.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: "Capybaras' eyes reflecting streams of cascading code as the progress bar fills." },
					{ sceneNumber: 4, setting: 'Cityscape view with neon lights.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'Capybaras silhouetted against the darkened city, moving into a shadow.' }
				]
			}),
			scenes: [
				{ number: 1, description: 'A shadowy alley with neon lights flickering overhead, wires spiraling down from rooftops.', dialogue: '', action: 'Two cybernetic humanoid capybaras scuttle past, their red LED eyes scanning surroundings.' },
				{ number: 2, description: 'A high-tech control room filled with blinking servers and holographic displays.', dialogue: '', action: 'The capybaras plug cables from their appendages into the mainframe, lights flicker as hacking commences.' },
				{ number: 3, description: 'Close-up of data streams on a screen, displaying rapid-fire code and schematics.', dialogue: '', action: "The capybaras' eyes glow brighter as a progress bar fills to completion." },
				{ number: 4, description: 'An exterior cityscape view, where the dystopian skyline suddenly dims, save for the glow of neon signs.', dialogue: '', action: 'The capybaras retreat into the shadows as city lights flicker in their wake.' }
			],
			characters: [
				{ name: 'Cyber Capybara 1', description: 'A technologically-enhanced capybara with cybernetic features.', physical: 'Sleek metallic fur with embedded circuits, glowing red LED eyes, and mechanical limbs.', profile: 'Stealthy and intelligent, this capybara is experienced in infiltration and data acquisition.' },
				{ name: 'Cyber Capybara 2', description: 'A second cybernetic capybara with similar enhancements.', physical: 'Metallic shell with vibrant neon stripes, camera-like eyes, augmented hearing devices on its head.', profile: 'Strategic and resourceful, specializes in encryption and rapid data processing.' }
			],
			locations: [
				{ name: 'Neon Alley', description: 'A dimly-lit alley in a bustling cyberpunk city, featuring towering buildings with cascading wires and omnipresent neon glow interspersed with graffiti.' },
				{ name: 'Government Control Room', description: 'A sleek, futuristic room filled with wall-to-wall server units, holographic interfaces, and omnipresent blue LED illumination.' },
				{ name: 'Cyberpunk Cityscape', description: 'An expansive, futuristic city skyline at night, dominated by towering skyscrapers with digital billboards and pulsing neon lights.' }
			],
			sceneVisuals: [
				{ sceneNumber: 1, setting: 'Neon-lit alley with dim lighting and glowing wires.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'The capybaras are scampering along the ground, with neon lights casting reflections on their metallic bodies.' },
				{ sceneNumber: 2, setting: 'High-tech control room full of servers and holographic displays.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'Capybaras are interfacing with the mainframe using cables extending from their limbs.' },
				{ sceneNumber: 3, setting: 'Close-up of code on a digital screen.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: "Capybaras' eyes reflecting streams of cascading code as the progress bar fills." },
				{ sceneNumber: 4, setting: 'Cityscape view with neon lights.', charactersPresent: ['Cyber Capybara 1', 'Cyber Capybara 2'], visualDescription: 'Capybaras silhouetted against the darkened city, moving into a shadow.' }
			]
		},
		characters: [
			{ name: 'Cyber Capybara 1', description: 'A technologically-enhanced capybara with cybernetic features.', enhancedDescription: 'Sleek metallic fur with embedded circuits, glowing red LED eyes, and mechanical limbs.', imageUrl: '/test-data/cyber-capybara-1.png' },
			{ name: 'Cyber Capybara 2', description: 'A second cybernetic capybara with similar enhancements.', enhancedDescription: 'Metallic shell with vibrant neon stripes, camera-like eyes, augmented hearing devices on its head.', imageUrl: '/test-data/cyber-capybara-2.png' }
		],
		worldElements: [
			{
				id: 'world-capybara-1',
				name: 'Cyber Capybara 1',
				type: 'character' as ElementType,
				description: 'Sleek metallic fur with embedded circuits, glowing red LED eyes, and mechanical limbs.',
				isEnhanced: false,
				images: [{ id: 'capybara-1-img-1', imageUrl: '/test-data/cyber-capybara-1.png', isActive: true, createdAt: new Date() }],
				historyIndex: 0, history: [], createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'world-capybara-2',
				name: 'Cyber Capybara 2',
				type: 'character' as ElementType,
				description: 'Metallic shell with vibrant neon stripes, camera-like eyes, augmented hearing devices on its head.',
				isEnhanced: false,
				images: [{ id: 'capybara-2-img-1', imageUrl: '/test-data/cyber-capybara-2.png', isActive: true, createdAt: new Date() }],
				historyIndex: 0, history: [], createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'world-neon-alley',
				name: 'Neon Alley',
				type: 'location' as ElementType,
				description: 'A dimly-lit alley in a bustling cyberpunk city, featuring towering buildings with cascading wires and omnipresent neon glow interspersed with graffiti.',
				isEnhanced: false,
				images: [{ id: 'neon-alley-img-1', imageUrl: '/test-data/neon-alley.png', isActive: true, createdAt: new Date() }],
				historyIndex: 0, history: [], createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'world-control-room',
				name: 'Government Control Room',
				type: 'location' as ElementType,
				description: 'A sleek, futuristic room filled with wall-to-wall server units, holographic interfaces, and omnipresent blue LED illumination.',
				isEnhanced: false,
				images: [{ id: 'control-room-img-1', imageUrl: '/test-data/control-room.png', isActive: true, createdAt: new Date() }],
				historyIndex: 0, history: [], createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'world-cityscape',
				name: 'Cyberpunk Cityscape',
				type: 'location' as ElementType,
				description: 'An expansive, futuristic city skyline at night, dominated by towering skyscrapers with digital billboards and pulsing neon lights.',
				isEnhanced: false,
				images: [{ id: 'cityscape-img-1', imageUrl: '/test-data/cityscape.png', isActive: true, createdAt: new Date() }],
				historyIndex: 0, history: [], createdAt: new Date(), updatedAt: new Date()
			}
		],
		storyboardScenes: [
			{
				id: 'sb-scene-1', title: 'Scene 1',
				description: 'The capybaras are scampering along the ground, with neon lights casting reflections on their metallic bodies.',
				dialog: '', action: 'Two cybernetic humanoid capybaras scuttle past, their red LED eyes scanning surroundings.',
				assignedElements: ['world-capybara-1', 'world-capybara-2'],
				duration: 5, status: 'completed' as const, isArchived: false, isSmartExpanded: false,
				images: [{ id: 'sb-scene-1-img-1', imageUrl: '/test-data/scene-1.png', isActive: true, createdAt: new Date() }],
				createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'sb-scene-2', title: 'Scene 2',
				description: 'Capybaras are interfacing with the mainframe using cables extending from their limbs.',
				dialog: '', action: 'The capybaras plug cables from their appendages into the mainframe, lights flicker as hacking commences.',
				assignedElements: ['world-capybara-1', 'world-capybara-2'],
				duration: 5, status: 'completed' as const, isArchived: false, isSmartExpanded: false,
				images: [{ id: 'sb-scene-2-img-1', imageUrl: '/test-data/scene-2.png', isActive: true, createdAt: new Date() }],
				createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'sb-scene-3', title: 'Scene 3',
				description: "Capybaras' eyes reflecting streams of cascading code as the progress bar fills.",
				dialog: '', action: "The capybaras' eyes glow brighter as a progress bar fills to completion.",
				assignedElements: ['world-capybara-1', 'world-capybara-2'],
				duration: 5, status: 'completed' as const, isArchived: false, isSmartExpanded: false,
				images: [{ id: 'sb-scene-3-img-1', imageUrl: '/test-data/scene-3.png', isActive: true, createdAt: new Date() }],
				createdAt: new Date(), updatedAt: new Date()
			},
			{
				id: 'sb-scene-4', title: 'Scene 4',
				description: 'Capybaras silhouetted against the darkened city, moving into a shadow.',
				dialog: '', action: 'The capybaras retreat into the shadows as city lights flicker in their wake.',
				assignedElements: ['world-capybara-1', 'world-capybara-2'],
				duration: 5, status: 'completed' as const, isArchived: false, isSmartExpanded: false,
				images: [{ id: 'sb-scene-4-img-1', imageUrl: '/test-data/scene-4.png', isActive: true, createdAt: new Date() }],
				createdAt: new Date(), updatedAt: new Date()
			}
		],
		scenes: [],
		storyboard: [],
		videos: [
			{ sceneIndex: 0, sceneId: 'sb-scene-1', sceneName: 'Scene 1', sceneImageUrl: '/test-data/scene-1.png', videoUrl: '' },
			{ sceneIndex: 1, sceneId: 'sb-scene-2', sceneName: 'Scene 2', sceneImageUrl: '/test-data/scene-2.png', videoUrl: '' },
			{ sceneIndex: 2, sceneId: 'sb-scene-3', sceneName: 'Scene 3', sceneImageUrl: '/test-data/scene-3.png', videoUrl: '' },
			{ sceneIndex: 3, sceneId: 'sb-scene-4', sceneName: 'Scene 4', sceneImageUrl: '/test-data/scene-4.png', videoUrl: '' }
		]
	};

	function loadTestStory() {
		storyStore.update(state => ({
			...state,
			prompt: 'anime cartoon (akira drawing/animation/aesthetic style) cybernetic humanoid capybaras hacking into a dystopian government mainframe',
			stories: [{
				story: TEST_DATA.story as Story,
				prompt: 'anime cartoon (akira drawing/animation/aesthetic style) cybernetic humanoid capybaras hacking into a dystopian government mainframe',
				length: '20s'
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

	function loadTestWorldElements() {
		// First load story if not present
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}

		worldStore.update(state => ({
			...state,
			elements: TEST_DATA.worldElements.map(el => ({
				...el,
				images: el.images.map(img => ({ ...img })),
				history: [...el.history]
			})),
			expandedElementIds: new Set(TEST_DATA.worldElements.map(el => el.id))
		}));
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
		if ($worldStore.elements.length === 0) {
			loadTestWorldElements();
		}

		storyboardStore.update(state => ({
			...state,
			scenes: TEST_DATA.storyboardScenes.map(scene => ({
				...scene,
				images: scene.images.map(img => ({ ...img }))
			})) as Scene[],
			pipelineStatus: 'complete',
			selectedSceneId: TEST_DATA.storyboardScenes[0].id
		}));
	}

	function loadTestVideo() {
		// First load story
		if ($storyStore.stories.length === 0) {
			loadTestStory();
		}
		// Load world elements
		if ($worldStore.elements.length === 0) {
			loadTestWorldElements();
		}
		// Load storyboard scenes
		if ($storyboardStore.scenes.length === 0) {
			loadTestStoryboard();
		}

		// Update video references to use storyboard scene data
		const activeScenes = $storyboardStore.scenes.filter(s => !s.isArchived);
		sceneVideos = activeScenes.map((scene, idx) => {
			const activeImage = scene.images.find(img => img.isActive);
			return {
				sceneIndex: idx,
				sceneId: scene.id,
				sceneName: scene.title,
				sceneImageUrl: activeImage?.imageUrl || '',
				videoUrl: TEST_DATA.videos[idx]?.videoUrl || '',
				videoId: `test-video-${idx}`,
				status: 'completed' as const,
				progress: 100,
				error: null,
				retryCount: 0
			};
		});
		isVideoGenerating = false;
		stopPolling();
	}

	function exportCurrentState() {
		const exportData = {
			story: $storyStore.stories.length > 0 ? {
				title: $storyStore.stories[0].story.title,
				rawContent: $storyStore.stories[0].story.rawContent,
				scenes: $storyStore.stories[0].story.scenes,
				characters: $storyStore.stories[0].story.characters,
				locations: $storyStore.stories[0].story.locations,
				sceneVisuals: $storyStore.stories[0].story.sceneVisuals
			} : null,
			worldElements: $worldStore.elements.map(el => ({
				id: el.id,
				name: el.name,
				type: el.type,
				description: el.description,
				enhancedDescription: el.enhancedDescription,
				images: el.images.map(img => ({
					id: img.id,
					imageUrl: img.imageUrl,
					isActive: img.isActive
				}))
			})),
			storyboardScenes: $storyboardStore.scenes.map(scene => ({
				id: scene.id,
				title: scene.title,
				description: scene.description,
				enhancedDescription: scene.enhancedDescription,
				dialog: scene.dialog,
				action: scene.action,
				assignedElements: scene.assignedElements,
				duration: scene.duration,
				status: scene.status,
				isArchived: scene.isArchived,
				images: scene.images.map(img => ({
					id: img.id,
					imageUrl: img.imageUrl,
					isActive: img.isActive
				}))
			})),
			videos: sceneVideos.map(v => ({
				sceneIndex: v.sceneIndex,
				sceneId: v.sceneId,
				sceneName: v.sceneName,
				sceneImageUrl: v.sceneImageUrl,
				videoUrl: v.videoUrl,
				status: v.status
			}))
		};

		console.log('=== EXPORT CURRENT STATE ===');
		console.log(JSON.stringify(exportData, null, 2));
		console.log('=== END EXPORT ===');

		// Also copy to clipboard if possible
		if (browser && navigator.clipboard) {
			navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
				.then(() => alert('Current state copied to clipboard! Check the console for formatted output.'))
				.catch(() => alert('State logged to console. Copy from there.'));
		} else {
			alert('State logged to console. Copy from there.');
		}
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

					// Reset auto-generate flags to ensure clean state for new story processing
					autoGenerateWorldElementImages = false;
					autoGenerateStoryboardImages = false;

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

						// Populate World section with characters and locations, auto-generate images
						const worldCharacters = form.story!.characters.map((c: { name: string; description: string; physical?: string }) => ({
							name: c.name,
							description: c.physical || c.description
						}));
						const worldLocations = (form.story!.locations || []).map((l: { name: string; description: string }) => ({
							name: l.name,
							description: l.description
						}));
						console.log('Story generation complete. Characters:', form.story!.characters, 'Locations:', form.story!.locations);
						const newElements = loadElementsFromStory(worldCharacters, worldLocations);
						// Track if new world elements need images (will trigger storyboard images after completion)
						const willGenerateWorldImages = newElements.length > 0;
						if (willGenerateWorldImages) {
							pendingWorldElementIds = newElements.map(el => el.id);
							autoGenerateWorldElementImages = true;
						}
					}
					if (form.story!.scenes && form.story!.scenes.length > 0) {
						localSlots = form.story!.scenes.map((scene, index) => ({
							id: `slot-local-${Date.now()}-${index}`,
							storySceneIndex: index,
							storyScene: scene,
							characterIds: [],
							status: 'pending' as const
						}));

						// Populate Storyboard with scenes
						// Build a name-to-ID map from world elements
						const elementNameToId = new Map<string, string>();
						$worldStore.elements.forEach(el => {
							elementNameToId.set(el.name.toLowerCase(), el.id);
						});

						// Map story scenes to storyboard scenes with assigned elements
						const sceneVisuals = form.story!.sceneVisuals || [];
						const storyboardScenes = form.story!.scenes.map((scene, index) => {
							// Find matching sceneVisual
							const visual = sceneVisuals.find((sv: { sceneNumber: number }) => sv.sceneNumber === scene.number) ||
								sceneVisuals[index];

							// Find world element IDs for characters present
							const assignedElements: string[] = [];
							if (visual?.charactersPresent) {
								visual.charactersPresent.forEach((charName: string) => {
									const elementId = elementNameToId.get(charName.toLowerCase());
									if (elementId) {
										assignedElements.push(elementId);
									}
								});
							}
							// Also try to match the setting to a location
							if (visual?.setting) {
								$worldStore.elements.forEach(el => {
									if (el.type === 'location' && visual.setting.toLowerCase().includes(el.name.toLowerCase())) {
										if (!assignedElements.includes(el.id)) {
											assignedElements.push(el.id);
										}
									}
								});
							}

							return {
								title: `Scene ${scene.number}`,
								description: visual?.visualDescription || scene.description,
								dialog: scene.dialogue,
								action: scene.action,
								assignedElements
							};
						});

						// Reset and initialize storyboard with new scenes
						resetStoryboardStore();
						initializeScenesFromStory(storyboardScenes);
						console.log('Initialized storyboard with', storyboardScenes.length, 'scenes');

						// If no new world elements to generate images for, directly trigger storyboard image generation
						// (otherwise, storyboard images will be triggered after world images complete)
						if (!autoGenerateWorldElementImages) {
							console.log('No new world elements - directly triggering storyboard image generation');
							autoGenerateStoryboardImages = true;
						}
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

	// Auto-generate world element images effect
	$effect(() => {
		if (autoGenerateWorldElementImages && pendingWorldElementIds.length > 0) {
			autoGenerateWorldElementImages = false;
			const elementIds = [...pendingWorldElementIds];
			pendingWorldElementIds = [];
			// Small delay to ensure the store is updated
			setTimeout(() => {
				generateAllWorldElementImages(elementIds);
			}, 100);
		}
	});

	// Auto-generate storyboard images effect (triggered after world element images complete)
	$effect(() => {
		if (autoGenerateStoryboardImages && activeScenes.length > 0) {
			console.log('Storyboard image effect triggered. activeScenes.length:', activeScenes.length);
			autoGenerateStoryboardImages = false;
			// Small delay to ensure world element images are saved
			setTimeout(() => {
				generateAllStoryboardImages();
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

		// Handle World element image generation response
		if (form?.action === 'generateImage' && form?.success && form?.character && activeElementId) {
			const element = $worldStore.elements.find(el => el.id === activeElementId);
			if (element && form.character.imageUrl) {
				addElementImage(activeElementId, form.character.imageUrl, form.character.revisedPrompt);
				// Reset activeElementId after processing
				activeElementId = null;
			}
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
		if ($storyboardStore.isPlaying && $storyboardStore.totalDuration > 0) {
			// Clear any existing interval first
			if (playbackInterval) {
				clearInterval(playbackInterval);
			}
			playbackInterval = setInterval(() => {
				const currentTime = $storyboardStore.currentTime;
				const totalDuration = $storyboardStore.totalDuration;
				const newTime = currentTime + 0.1;
				if (newTime >= totalDuration) {
					togglePlayback();
					setCurrentTime(0);
				} else {
					setCurrentTime(newTime);
				}
			}, 100);

			// Cleanup function for when effect re-runs or component unmounts
			return () => {
				if (playbackInterval) {
					clearInterval(playbackInterval);
					playbackInterval = null;
				}
			};
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

	// Video effects - sync sceneVideos with sceneThumbnails
	$effect(() => {
		// Only track sceneThumbnails, not sceneVideos (use untrack to prevent loop)
		const currentSceneVideos = untrack(() => sceneVideos);

		if (sceneThumbnails.length === 0) return;

		// Check if we need to update sceneVideos
		// Case 1: sceneVideos is empty - initialize
		// Case 2: sceneThumbnails has different scene IDs - rebuild with preserved state
		const thumbnailIds = new Set(sceneThumbnails.map(t => t.id));
		const sceneVideoIds = new Set(currentSceneVideos.map(sv => sv.sceneId));

		const needsUpdate =
			currentSceneVideos.length === 0 ||
			sceneThumbnails.length !== currentSceneVideos.length ||
			sceneThumbnails.some(t => !sceneVideoIds.has(t.id));

		if (needsUpdate) {
			// Create a map of existing sceneVideos by sceneId to preserve video state
			const existingBySceneId = new Map(currentSceneVideos.map(sv => [sv.sceneId, sv]));

			sceneVideos = sceneThumbnails.map((thumb, index) => {
				const existing = existingBySceneId.get(thumb.id);
				if (existing) {
					// Preserve existing video state, update index and thumbnail data
					return {
						...existing,
						sceneIndex: index,
						sceneName: thumb.name,
						sceneImageUrl: thumb.imageUrl
					};
				}
				// Create new entry for new scenes
				return {
					sceneIndex: index,
					sceneId: thumb.id,
					sceneName: thumb.name,
					sceneImageUrl: thumb.imageUrl,
					videoId: null,
					videoUrl: null,
					status: 'pending' as const,
					progress: 0,
					error: null,
					retryCount: 0
				};
			});
			console.log('sceneVideos synced with sceneThumbnails:', sceneVideos.length, 'scenes');
		}
	});

	// Progress is now calculated as derived state to avoid effect cascades
	let calculatedProgress = $derived(
		sceneVideos.length > 0
			? Math.round(sceneVideos.reduce((sum, sv) => sum + sv.progress, 0) / sceneVideos.length)
			: 0
	);

	$effect(() => {
		// Read sceneVideos once with untrack to avoid creating a reactive dependency
		// This effect writes to sceneVideos, so tracking it would cause infinite loops
		const currentSceneVideos = untrack(() => sceneVideos);

		if (form?.action === 'generateSceneVideo') {
			// Create unique ID for this form response to prevent re-processing
			const formId = `${form.action}-${form.sceneIndex}-${form.success}-${form.error || ''}`;
			if (formId === lastProcessedVideoFormId) return;
			lastProcessedVideoFormId = formId;

			if (form.success && form.videoId && form.sceneIndex !== undefined) {
				const videoId = form.videoId;
				const sceneIdx = form.sceneIndex;
				sceneVideos = currentSceneVideos.map((sv, idx) =>
					idx === sceneIdx
						? { ...sv, videoId: videoId, status: 'queued' as const, progress: 0 }
						: sv
				);
				setTimeout(() => startPolling(), 100);
			} else if (!form.success && form.sceneIndex !== undefined) {
				const failedIndex = form.sceneIndex;
				const currentScene = currentSceneVideos[failedIndex];
				const isRateLimited = form.error?.includes('frequency') || form.error?.includes('rate');

				// Only handle rate limit if scene is not already queued for retry
				if (currentScene?.status === 'queued') return;

				if (isRateLimited && currentScene && currentScene.retryCount < MAX_RETRIES) {
					const retryCount = currentScene.retryCount + 1;
					const delayMs = RETRY_DELAY_MS * retryCount;

					// Set status to 'queued' to prevent generateNextScene from picking it up again
					sceneVideos = currentSceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, status: 'queued' as const, retryCount, error: `Rate limited, retrying in ${delayMs/1000}s...` }
							: sv
					);

					retryTimeoutId = setTimeout(() => {
						// Reset to pending before retrying so the form can process it
						sceneVideos = sceneVideos.map((sv, idx) =>
							idx === failedIndex
								? { ...sv, status: 'pending' as const, error: null }
								: sv
						);
						const retryForm = document.getElementById(`generate-form-${failedIndex}`) as HTMLFormElement;
						if (retryForm) {
							retryForm.requestSubmit();
						}
					}, delayMs);
				} else {
					sceneVideos = currentSceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, status: 'failed' as const, error: form.error || 'Failed to start' }
							: sv
					);
					generateNextScene();
				}
			}
		} else if (form?.action === 'checkSceneVideoStatus') {
			// Deduplicate status check responses
			const statusFormId = `${form.action}-${form.sceneIndex}-${form.status}-${form.progress}-${form.videoUrl || ''}`;
			if (statusFormId === lastProcessedVideoFormId) return;
			lastProcessedVideoFormId = statusFormId;

			if (form.success && form.sceneIndex !== undefined) {
				const sceneIndex = form.sceneIndex;
				const newStatus = form.status === 'completed' ? 'completed' :
					form.status === 'failed' ? 'failed' :
					form.status === 'in_progress' ? 'generating' : 'queued';

				sceneVideos = currentSceneVideos.map((sv, idx) =>
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
				locations: latestEntry.story.locations,
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
						characters: updatedCharacters,
						locations: latestEntry.story.locations
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
				// Populate World section with characters and locations, auto-generate images
				const worldCharacters = updatedCharacters.map((c: { name: string; description: string; physical?: string }) => ({
					name: c.name,
					description: c.physical || c.description
				}));
				const worldLocations = (latestEntry.story.locations || []).map((l: { name: string; description: string }) => ({
					name: l.name,
					description: l.description
				}));
				const newElements = loadElementsFromStory(worldCharacters, worldLocations);
				// Auto-generate world element images
				if (newElements.length > 0) {
					pendingWorldElementIds = newElements.map(el => el.id);
					autoGenerateWorldElementImages = true;
				}
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
			// Also populate World section with characters and locations
			const worldCharacters = latestStory.story.characters.map((c: { name: string; description: string; physical?: string }) => ({
				name: c.name,
				description: c.physical || c.description
			}));
			const worldLocations = (latestStory.story.locations || []).map((l: { name: string; description: string }) => ({
				name: l.name,
				description: l.description
			}));
			const newElements = loadElementsFromStory(worldCharacters, worldLocations);
			// Auto-generate world element images
			if (newElements.length > 0) {
				pendingWorldElementIds = newElements.map(el => el.id);
				autoGenerateWorldElementImages = true;
			}
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
<div class="fixed bottom-4 right-4 z-50 flex items-center gap-2">
	{#if testingMode}
		<button
			onclick={exportCurrentState}
			class="flex cursor-pointer items-center gap-2 rounded-full border border-blue-800 bg-blue-200 px-3 py-2 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-300"
			title="Export current state to clipboard/console"
		>
			<Download class="!mr-0 h-4 w-4" />
		</button>
	{/if}
	<button
		onclick={toggleTestingMode}
		class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors {testingMode ? 'border-yellow-800 bg-yellow-200 text-yellow-800' : 'border-muted-foreground bg-muted text-muted-foreground hover:bg-muted/80'}"
		title="Toggle testing mode"
	>
		<FlaskConical class="!mr-0 h-4 w-4" />
	</button>
</div>

<div class="flex flex-col gap-8">
	<!-- ========== PROJECT SECTION ========== -->
	<ProjectSection {testingMode} />

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
						<Button variant="outline" size="sm" onclick={() => storyStore.update(s => ({ ...s, prompt: 'anime cartoon (akira drawing/animation/aesthetic style) cybernetic humanoid capybaras hacking into a dystopian government mainframe', stories: [] }))} title="Insert test prompt and clear history">
							<FlaskConical class="!mr-0 h-4 w-4" />
						</Button>
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
						<p class="font-medium text-muted-foreground">Prompt ({entry.length}, {STYLE_OPTIONS.find(opt => opt.value === entry.style)?.label || entry.style || 'Anime'}):</p>
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
			<div class="flex flex-col gap-4 w-full">
				{#if form?.error && (form?.action === 'generateImage' || form?.action === 'enhanceDescription')}
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
							{#if option.value !== 'all'}
								<span
									class="w-2 h-2 rounded-full mr-1.5 inline-block"
									style="background-color: {ELEMENT_TYPE_COLORS[option.value]};"
								></span>
							{/if}
							{option.label}
							{#if count > 0}
								<span class="ml-1 text-xs">({count})</span>
							{/if}
						</Button>
					{/each}
				</div>

				<!-- Element Cards (show all elements) -->
				<div class="flex flex-wrap gap-4">
				{#each filteredWorldElements as element}
						<div
							class="flex flex-col gap-3 rounded-md border p-4 w-80 flex-shrink-0"
							style="border-left: 4px solid {ELEMENT_TYPE_COLORS[element.type]};"
							data-element-content={element.id}
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<h2 class="text-base font-semibold truncate">{element.name}</h2>
										<span
											class="rounded-full px-2 py-0.5 text-xs text-black flex-shrink-0"
											style="background-color: {ELEMENT_TYPE_COLORS[element.type]};"
										>
											{ELEMENT_TYPE_LABELS[element.type]}
										</span>
									</div>
									<p class="text-xs text-muted-foreground mt-1 line-clamp-2">{element.description}</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => handleDeleteWorldElement(element.id)}
									class="text-destructive hover:text-destructive flex-shrink-0"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>

							{#if element.enhancedDescription && element.enhancedDescription !== element.description}
								<div class="rounded-md bg-muted/50 p-2">
									<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
										Enhanced:
									</p>
									<p class="text-xs line-clamp-3">{element.enhancedDescription}</p>
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

							<!-- Image Error Alert -->
							{#if element.imageError}
								<div class="relative flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
									<button
										class="absolute top-2 right-2 text-destructive/70 hover:text-destructive"
										onclick={() => clearElementImageError(element.id)}
									>
										<X class="h-4 w-4" />
									</button>
									<div class="flex-1 pr-6">
										<p class="font-medium text-destructive">Image generation failed</p>
										<p class="text-muted-foreground mt-1">{element.imageError}</p>
										<Button
											variant="outline"
											size="sm"
											class="mt-2"
											onclick={() => generateWorldElementImage(element.id)}
											disabled={generatingWorldElementIds.has(element.id)}
										>
											{#if generatingWorldElementIds.has(element.id)}
												<Loader2 class="mr-2 h-3 w-3 animate-spin" />
												Retrying...
											{:else}
												Retry
											{/if}
										</Button>
									</div>
								</div>
							{/if}

							<!-- Action Buttons -->
							<div class="flex flex-col gap-2">
								<div class="flex flex-wrap gap-1">
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
												size="sm"
												disabled={isWorldEnhancing || !element.description}
											>
												{#if isWorldEnhancing && activeElementId === element.id}
													<Loader2 class="mr-1 h-3 w-3 animate-spin" />
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
												size="sm"
												disabled={isWorldEnhancing || isWorldGenerating}
											>
												{#if isWorldEnhancing && activeElementId === element.id}
													<Loader2 class="mr-1 h-3 w-3 animate-spin" />
													Improving...
												{:else}
													Re-enhance
												{/if}
											</Button>
										</form>
										<Button
											variant="outline"
											size="sm"
											onclick={() => openWorldPromptTextarea(element.id)}
											disabled={isWorldEnhancing || isWorldGenerating}
										>
											With Prompt
										</Button>
									{/if}

									<form
										method="POST"
										action="?/generateImage"
										use:enhance={() => {
											generatingWorldElementIds = new Set([...generatingWorldElementIds, element.id]);
											isWorldGenerating = true;
											return async ({ update }) => {
												await update();
												generatingWorldElementIds = new Set([...generatingWorldElementIds].filter(id => id !== element.id));
												if (generatingWorldElementIds.size === 0) isWorldGenerating = false;
											};
										}}
									>
										<input type="hidden" name="description" value={getWorldCurrentDescription(element)} />
										<input type="hidden" name="elementType" value={element.type} />
										<Button type="submit" size="sm" disabled={generatingWorldElementIds.has(element.id) || !getWorldCurrentDescription(element)}>
											{#if generatingWorldElementIds.has(element.id)}
												<Loader2 class="mr-1 h-3 w-3 animate-spin" />
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
				{/each}
				</div>

				<!-- Add Element Forms (dynamically rendered) -->
				{#each addElementForms as form}
					<div class="rounded-md border p-4">
						<div class="flex items-center justify-between mb-3">
							<h2 class="text-lg font-semibold">Add Element</h2>
						</div>
						<div class="flex flex-col gap-3">
							<div class="flex gap-2">
								<Input
									bind:value={form.name}
									placeholder="Element name"
									class="flex-1"
								/>
								<Select.Root type="single" bind:value={form.type}>
									<Select.Trigger class="w-36">
										{ELEMENT_TYPE_LABELS[form.type]}
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
								bind:value={form.description}
								placeholder="Describe this element... Press Enter to add, Shift+Enter for new line."
								class="min-h-24"
								onkeydown={(e) => handleElementFormKeydown(e, form.id)}
							/>
							<div class="flex justify-end gap-2">
								<Button
									variant="outline"
									onclick={() => removeElementForm(form.id)}
								>
									Cancel
								</Button>
								<Button
									onclick={() => submitElementForm(form.id)}
									class="bg-green-600 hover:bg-green-700 text-white"
									disabled={!form.name.trim() || !form.description.trim()}
								>
									<Plus class="mr-2 h-4 w-4" />
									Add {ELEMENT_TYPE_LABELS[form.type]}
								</Button>
							</div>
						</div>
					</div>
				{/each}

				<!-- Add Element Button -->
				<Button
					variant="outline"
					onclick={addNewElementForm}
					class="w-fit"
				>
					<Plus class="mr-2 h-4 w-4" />
					Add Element
				</Button>

				<!-- Empty State -->
				{#if $worldStore.elements.length === 0}
					<div class="w-full xl:max-w-[32rem] rounded-md border border-dashed p-8 text-center">
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
			</div>

			<!-- Right Column: Content -->
			<div class="flex flex-col gap-4 w-full">
				<!-- Timeline info -->
				{#if activeScenes.length > 0}
					<div class="flex items-center gap-4 text-sm text-muted-foreground">
						<span>Total Duration: <span class="font-medium">{formatTime(totalStoryboardDuration)}</span></span>
						<span>Scenes: <span class="font-medium">{activeScenes.length}</span></span>
					</div>
				{/if}

				<!-- Scene Cards Grid + New Scene Button -->
				<div class="flex flex-wrap gap-4">
					{#each activeScenes as scene, index (scene.id)}
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
											class="rounded p-1 hover:bg-white/20 transition-colors cursor-pointer"
											onclick={(e) => handleCloneScene(scene.id, e)}
											title="Clone scene"
										>
											<Copy class="h-4 w-4" />
										</button>
										<button
											class="rounded p-1 hover:bg-white/20 transition-colors cursor-pointer"
											onclick={(e) => handleArchiveScene(scene.id, e)}
											title="Archive scene"
										>
											<Archive class="h-4 w-4" />
										</button>
										<button
											class="rounded p-1 hover:bg-red-500/80 text-red-400 transition-colors cursor-pointer"
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
									<div class="mt-2 flex gap-1 overflow-hidden {sceneImageUrl ? 'ml-8' : ''}">
										{#each scene.assignedElements.slice(0, 3) as elementId}
											{@const element = getWorldElement(elementId)}
											{#if element}
												<span
													class="rounded px-2 py-0.5 text-xs font-medium text-white truncate max-w-[5rem] flex-shrink-0"
													style="background-color: {ELEMENT_TYPE_COLORS[element.type]}"
												>
													{truncateSceneText(element.name, 8)}
												</span>
											{/if}
										{/each}
										{#if scene.assignedElements.length > 3}
											<span class="rounded bg-gray-500 px-2 py-0.5 text-xs font-medium text-white flex-shrink-0">
												+{scene.assignedElements.length - 3}
											</span>
										{/if}
									</div>
								{/if}
							{/if}
						</div>

						<!-- Text toggle button (only when image exists) -->
						{#if sceneImageUrl}
							<button
								class="absolute bottom-2 left-2 rounded p-1 bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
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
						{#if scene.status === 'generating' || generatingStoryboardSceneIds.has(scene.id)}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<Loader2 class="h-8 w-8 animate-spin text-white" />
							</div>
						{:else if scene.status === 'failed' && scene.error}
							<div class="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 p-2">
								<X class="h-6 w-6 text-red-300 mb-1" />
								<p class="text-red-100 text-xs text-center line-clamp-3">{scene.error}</p>
								<Button
									variant="outline"
									size="sm"
									class="mt-2 text-xs h-6 bg-red-800 border-red-600 text-red-100 hover:bg-red-700"
									onclick={(e) => {
										e.stopPropagation();
										generateStoryboardSceneImage(scene.id);
									}}
								>
									Retry
								</Button>
							</div>
						{/if}
					</div>
				{/each}

					<!-- New Scene Button (at end of row) -->
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
				</div>

				<!-- Archived Scenes Section -->
			<div class="w-full xl:max-w-[32rem] border-t pt-6 mt-6">
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
				{#if form?.error && (form?.action === 'generateSceneVideo' || form?.action === 'checkSceneVideoStatus')}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

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
				class="relative rounded-lg border border-gray-300 overflow-hidden bg-black"
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
								style="width: {Math.max(5, calculatedProgress)}%"
							></div>
						</div>
						<p class="text-white/70 text-xs mt-1">
							Overall: {calculatedProgress}%
						</p>
					</div>
				{:else}
					{#if sceneThumbnails.length > 0}
						{#if $storyboardStore.isPlaying && currentPreviewSceneIndex >= 0 && sceneThumbnails[currentPreviewSceneIndex]}
							<!-- Full-screen preview of current scene -->
							<div class="absolute inset-0" data-video-preview>
								<img
									src={sceneThumbnails[currentPreviewSceneIndex].imageUrl}
									alt={sceneThumbnails[currentPreviewSceneIndex].name}
									class="w-full h-full object-contain"
								/>
								<!-- Scene indicator overlay -->
								<div class="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg">
									<p class="text-sm font-medium">Scene {currentPreviewSceneIndex + 1} of {sceneThumbnails.length}</p>
									<p class="text-xs text-white/70">{sceneThumbnails[currentPreviewSceneIndex].name}</p>
								</div>
								<!-- Progress bar -->
								<div class="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
									<div
										class="h-full bg-primary transition-all duration-100"
										style="width: {($storyboardStore.currentTime % 5) / 5 * 100}%"
									></div>
								</div>
							</div>
						{:else}
							<!-- Thumbnail view when not playing -->
							<div class="absolute inset-0 flex items-center justify-center p-4" data-video-placeholder>
								<div class="flex gap-3 overflow-x-auto items-center">
									{#each sceneThumbnails as thumbnail, index}
										<div
											class="relative flex-shrink-0 rounded overflow-hidden border-2 border-white/50"
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
						{/if}
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
							class="relative rounded border-2 overflow-hidden cursor-pointer transition-all {currentPlayingIndex === index ? 'ring-4 ring-gray-300' : ''} {sceneVideo.status === 'completed' ? 'border-green-500' : sceneVideo.status === 'failed' ? 'border-red-500' : 'border-gray-300'}"
							onclick={() => { currentPlayingIndex = index; if (sceneVideo.videoUrl) playFromScene(index); }}
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
						Preview "Slideshow"
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

				{#if selectedVideoCompleted}
					<Button onclick={downloadVideo} variant="outline">
						<Download class="mr-2 h-4 w-4" />
						Download Selected
					</Button>
				{/if}
				{#if allCompleted}
					<Button onclick={downloadAllVideos}>
						<Download class="mr-2 h-4 w-4" />
						Download All
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
