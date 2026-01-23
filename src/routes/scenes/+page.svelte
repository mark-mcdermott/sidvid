<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { characterStore } from '$lib/stores/characterStore';
	import { storyStore } from '$lib/stores/storyStore';
	import { setScenes } from '$lib/stores/storyboardStore';
	import type { SceneSlot } from '$lib/sidvid';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Loader2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Local UI state for drag/drop visual feedback
	let dragOverIndex = $state<number | null>(null);

	// Track which slots are currently generating (for per-slot loading state)
	let generatingSlots = $state<Set<string>>(new Set());

	// Local slots state (when no session is active)
	let localSlots = $state<SceneSlot[]>([]);

	// Track processed form results to prevent infinite effect loop
	let lastProcessedFormId = $state<string | null>(null);

	// Get pipeline from session (reactive)
	let sessionPipeline = $derived($sessionStore.activeSession?.getScenePipeline());

	// Use session pipeline if available, otherwise use local slots
	let slots = $derived(sessionPipeline?.slots || localSlots);

	// Initialize local slots from storyStore if no session
	onMount(() => {
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
	});

	// Handle form action results
	$effect(() => {
		if (!form?.slotId) return;

		// Create a unique ID for this form result to prevent reprocessing
		const formResultId = `${form.action}-${form.slotId}-${form.success}-${form.imageUrl || 'no-image'}`;

		// Skip if we've already processed this exact result
		if (formResultId === lastProcessedFormId) return;

		if (form?.action === 'generateSlot' || form?.action === 'regenerateSlot') {
			// Mark as processed immediately to prevent infinite loop
			lastProcessedFormId = formResultId;

			if (form.success && form.slotId && form.imageUrl) {
				// Update the slot with the generated image
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
					// Update local slots when no session
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
			} else if (!form.success && form.slotId) {
				// Mark slot as failed
				const session = $sessionStore.activeSession;
				if (session) {
					const pipeline = session.getScenePipeline();
					if (pipeline) {
						const slotIndex = pipeline.slots.findIndex(s => s.id === form.slotId);
						if (slotIndex !== -1) {
							pipeline.slots[slotIndex] = {
								...pipeline.slots[slotIndex],
								status: 'failed',
								error: form.error || 'Generation failed'
							};
							sessionStore.update(s => ({ ...s }));
						}
					}
				} else {
					// Update local slots when no session
					const slotIndex = localSlots.findIndex(s => s.id === form.slotId);
					if (slotIndex !== -1) {
						localSlots = localSlots.map((s, i) =>
							i === slotIndex ? {
								...s,
								status: 'failed' as const,
								error: form.error || 'Generation failed'
							} : s
						);
					}
				}
			}
		}
	});

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = null;

		const data = e.dataTransfer?.getData('application/json');
		if (!data) return;

		const session = $sessionStore.activeSession;
		if (!session) return;

		try {
			const item = JSON.parse(data);

			// If dropping a story, initialize the pipeline from it
			if (item.type === 'story' && item.scenes && item.scenes.length > 0) {
				// Initialize pipeline - this creates slots from story scenes
				session.initializeScenePipeline();
				sessionStore.update(s => ({ ...s }));
			} else if (item.type === 'character') {
				// Assign character to the slot at this index
				const currentSlots = session.getScenePipeline()?.slots || [];
				if (currentSlots[index]) {
					const slot = currentSlots[index];
					const existingCharIds = slot.characterIds || [];

					// Check if character already assigned
					if (!existingCharIds.includes(item.name)) {
						// Find character ID from characterStore by name
						const char = $characterStore.characters.find(c => c.name === item.name);
						if (char) {
							// Get character ID - characters in session have IDs
							const sessionChars = session.extractCharacters();
							const sessionChar = sessionChars.find(c => c.name === item.name);
							if (sessionChar) {
								session.assignCharactersToSlot(slot.id, [...existingCharIds, sessionChar.id]);
								sessionStore.update(s => ({ ...s }));
							}
						}
					}
				}
			}
		} catch (err) {
			console.error('Failed to parse dropped data:', err);
		}
	}

	function removeCharacterFromSlot(slotId: string, characterId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return;

		const slot = session.getScenePipeline()?.slots.find(s => s.id === slotId);
		if (slot) {
			const newCharIds = slot.characterIds.filter(id => id !== characterId);
			session.assignCharactersToSlot(slotId, newCharIds);
			sessionStore.update(s => ({ ...s }));
		}
	}

	function addSlot() {
		const session = $sessionStore.activeSession;
		if (!session) return;

		// Initialize pipeline if needed
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

	// Get character info by ID
	function getCharacterById(characterId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return null;
		return session.extractCharacters().find(c => c.id === characterId);
	}

	// Get character descriptions for a slot
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

	// Count slots with content
	let slotsWithContent = $derived(
		slots.filter(s => s.storyScene.description || s.customDescription || s.characterIds.length > 0)
	);

	let showGenerateButton = $derived(slotsWithContent.length > 0);
	let generateButtonText = $derived(
		slotsWithContent.length === 1 ? 'Generate Scene Image' : 'Generate Scene Images'
	);

	// Show send to storyboard button only when images have been generated
	let hasGeneratedImages = $derived(slots.some(s => s.status === 'completed' && s.generatedScene?.imageUrl));

	// Check if any slot is generating (either from form submission or session state)
	let isAnyGenerating = $derived(generatingSlots.size > 0 || slots.some(s => s.status === 'generating'));

	// Show pipeline status
	let pendingCount = $derived(slots.filter(s => s.status === 'pending').length);
	let completedCount = $derived(slots.filter(s => s.status === 'completed').length);
	let generatingCount = $derived(slots.filter(s => s.status === 'generating').length + generatingSlots.size);

	// Generate all pending slots sequentially
	async function generateAllSlots() {
		const pendingSlots = slots.filter(s =>
			s.status === 'pending' &&
			(s.storyScene.description || s.customDescription)
		);

		for (const slot of pendingSlots) {
			// Find and submit the form for this slot
			const form = document.querySelector(`form:has(input[name="slotId"][value="${slot.id}"])`) as HTMLFormElement;
			if (form) {
				form.requestSubmit();
				// Wait for the generation to complete before moving to next
				await new Promise<void>((resolve) => {
					const checkInterval = setInterval(() => {
						const currentSlot = slots.find(s => s.id === slot.id);
						if (currentSlot && currentSlot.status !== 'generating' && !generatingSlots.has(slot.id)) {
							clearInterval(checkInterval);
							resolve();
						}
					}, 500);
				});
			}
		}
	}

	// Navigate to storyboard and pass scene data
	function goToStoryboard() {
		// Store completed scenes in storyboardStore for the storyboard page to use
		const completedSlots = slots.filter(s => s.status === 'completed' && s.generatedScene?.imageUrl);
		setScenes(completedSlots.map(s => ({
			id: s.id,
			sceneNumber: s.storyScene.number,
			description: s.customDescription || s.storyScene.description,
			imageUrl: s.generatedScene!.imageUrl,
			characterIds: s.characterIds
		})));
		// Navigate after store is updated
		goto('/storyboard');
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Scene Generation</h1>
			<p class="text-muted-foreground">Drag a story and/or characters into a scene wireframe</p>
		</div>
		{#if slots.length > 0}
			<div class="text-sm text-muted-foreground">
				{completedCount}/{slots.length} generated
				{#if generatingCount > 0}
					<span class="text-blue-600">({generatingCount} in progress)</span>
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap gap-4 items-start" data-wireframes-container>
		{#each slots as slot, index (slot.id)}
			<div>
				<div
					data-scene-wireframe={index}
					data-scene-number={slot.storyScene.number}
					class="wireframe relative flex flex-col w-64 border rounded-lg p-2 transition-colors {dragOverIndex === index ? 'border-primary bg-primary/10 border-solid' : slot.status === 'completed' ? 'border-green-500 border-solid' : slot.status === 'generating' || generatingSlots.has(slot.id) ? 'border-blue-500 border-solid animate-pulse' : slot.status === 'failed' ? 'border-red-500 border-solid' : 'border-dashed border-black'}"
					style="aspect-ratio: 16/9;"
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
				>
					<!-- Generated image or slot content -->
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
						<!-- Scene info display -->
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

							<!-- Assigned characters -->
							{#if slot.characterIds.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each slot.characterIds as charId}
										{@const char = getCharacterById(charId)}
										{#if char}
											<div class="flex items-center gap-1 px-1 py-0.5 text-[10px] bg-green-100 text-green-800 rounded">
												{#if char.imageUrl}
													<img src={char.imageUrl} alt={char.name} class="w-3 h-3 rounded-full object-cover" />
												{/if}
												<span class="truncate max-w-12">{char.name}</span>
												<button
													type="button"
													class="hover:text-red-600"
													onclick={() => removeCharacterFromSlot(slot.id, charId)}
												>
													×
												</button>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<!-- Status indicator -->
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

				<!-- Per-slot generate button (below wireframe) -->
				{#if !slot.generatedScene?.imageUrl && (slot.storyScene.description || slot.customDescription)}
					<form
						method="POST"
						action="?/generateSlotImage"
						class="mt-2"
						use:enhance={() => {
							generatingSlots = new Set([...generatingSlots, slot.id]);
							// Mark slot as generating in session
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

		<!-- Add new slot button -->
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

	{#if showGenerateButton && pendingCount > 0}
		<div class="flex gap-2">
			<Button onclick={generateAllSlots} disabled={isAnyGenerating} data-generate-all>
				{#if isAnyGenerating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" data-spinner />
					Generating ({generatingCount}/{pendingCount + completedCount + generatingCount})...
				{:else}
					Generate All ({pendingCount} scene{pendingCount !== 1 ? 's' : ''})
				{/if}
			</Button>
		</div>
	{/if}

	{#if hasGeneratedImages}
		<div class="flex gap-2">
			<Button onclick={goToStoryboard}>Send to Storyboard</Button>
		</div>
	{/if}
</div>
