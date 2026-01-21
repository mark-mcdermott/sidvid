<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { characterStore } from '$lib/stores/characterStore';
	import type { SceneSlot, ScenePipeline } from '$lib/sidvid';

	// Local UI state for drag/drop visual feedback
	let dragOverIndex = $state<number | null>(null);

	// Get pipeline from session (reactive)
	let pipeline = $derived($sessionStore.activeSession?.getScenePipeline());

	// Derived slots for rendering
	let slots = $derived(pipeline?.slots || []);

	// Initialize pipeline when story is dropped
	function initializePipelineIfNeeded() {
		const session = $sessionStore.activeSession;
		if (!session) return;

		const existingPipeline = session.getScenePipeline();
		if (!existingPipeline) {
			session.initializeScenePipeline();
			// Force reactivity update
			sessionStore.update(s => ({ ...s }));
		}
	}

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

	function setCustomDescription(slotId: string, description: string) {
		const session = $sessionStore.activeSession;
		if (!session) return;

		session.setSlotCustomDescription(slotId, description);
		sessionStore.update(s => ({ ...s }));
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

	async function generateSlotImage(slotId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return;

		await session.generateSlotImage(slotId);
		sessionStore.update(s => ({ ...s }));
	}

	async function generateAllPending() {
		const session = $sessionStore.activeSession;
		if (!session) return;

		await session.generateAllPendingSlots();
		sessionStore.update(s => ({ ...s }));
	}

	// Get character info by ID
	function getCharacterById(characterId: string) {
		const session = $sessionStore.activeSession;
		if (!session) return null;
		return session.extractCharacters().find(c => c.id === characterId);
	}

	// Count slots with content
	let slotsWithContent = $derived(
		slots.filter(s => s.storyScene.description || s.customDescription || s.characterIds.length > 0)
	);

	let showGenerateButton = $derived(slotsWithContent.length > 0);
	let generateButtonText = $derived(
		slotsWithContent.length === 1 ? 'Generate Scene Image' : 'Generate Scene Images'
	);

	// Show send to video button only when images have been generated
	let hasGeneratedImages = $derived(slots.some(s => s.status === 'completed' && s.generatedScene?.imageUrl));

	// Show pipeline status
	let pendingCount = $derived(slots.filter(s => s.status === 'pending').length);
	let completedCount = $derived(slots.filter(s => s.status === 'completed').length);
	let generatingCount = $derived(slots.filter(s => s.status === 'generating').length);
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
					class="wireframe relative flex flex-col w-64 border rounded-lg p-2 transition-colors {dragOverIndex === index ? 'border-primary bg-primary/10 border-solid' : slot.status === 'completed' ? 'border-green-500 border-solid' : slot.status === 'generating' ? 'border-blue-500 border-solid animate-pulse' : slot.status === 'failed' ? 'border-red-500 border-solid' : 'border-dashed border-black'}"
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
							<Button size="sm" variant="secondary" onclick={() => generateSlotImage(slot.id)}>
								Regenerate
							</Button>
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
							{#if slot.status === 'generating'}
								<div class="text-[10px] text-blue-600">Generating...</div>
							{:else if slot.status === 'failed'}
								<div class="text-[10px] text-red-600">{slot.error || 'Failed'}</div>
							{/if}
						</div>
					{/if}
				</div>
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

	{#if showGenerateButton}
		<div class="flex gap-2">
			<Button onclick={generateAllPending} disabled={generatingCount > 0}>
				{#if generatingCount > 0}
					Generating...
				{:else}
					{generateButtonText}
				{/if}
			</Button>
		</div>
	{/if}

	{#if hasGeneratedImages}
		<div class="flex gap-2">
			<Button href="/storyboard">Send to Storyboard</Button>
		</div>
	{/if}
</div>
