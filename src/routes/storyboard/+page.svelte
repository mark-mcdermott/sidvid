<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
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
		type WireframeScene,
		type WireframeCharacter
	} from '$lib/stores/storyboardStore';
	import { characterStore } from '$lib/stores/characterStore';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { Play, Pause, X, Edit, Loader2 } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Track which wireframes are being edited with prompt
	let editingWireframes = $state<Set<string>>(new Set());
	let editPrompts = $state<Record<string, string>>({});
	let regeneratingWireframes = $state<Set<string>>(new Set());

	// Available characters from character store
	let availableCharacters = $state<WireframeCharacter[]>([]);

	// Playback interval
	let playbackInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		loadStoryboardFromStorage();

		// Load characters from character store
		const unsubscribe = characterStore.subscribe(charState => {
			availableCharacters = charState.characters
				.filter(c => c.imageUrl)
				.map((c, i) => ({
					id: `char-${i}`,
					name: c.name,
					imageUrl: c.imageUrl!
				}));
		});

		return () => {
			unsubscribe();
			if (playbackInterval) clearInterval(playbackInterval);
		};
	});

	// Handle form action results
	$effect(() => {
		if (form?.action === 'editSlotWithPrompt') {
			if (form.success && form.wireframeId && form.imageUrl) {
				// Update wireframe with new image
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
				// Clear editing state
				editingWireframes = new Set([...editingWireframes].filter(id => id !== form.wireframeId));
				regeneratingWireframes = new Set([...regeneratingWireframes].filter(id => id !== form.wireframeId));
			}
		}
	});

	// Watch for playback state changes
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

	// Save state when wireframes change
	$effect(() => {
		if ($storyboardStore.wireframes) {
			saveStoryboardToStorage();
		}
	});

	function handleDragStart(e: DragEvent, type: 'scene' | 'character', data: WireframeScene | WireframeCharacter) {
		e.dataTransfer?.setData('application/json', JSON.stringify({ type, data }));
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent, wireframeId: string) {
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

	function handleSendToVideo() {
		// Initialize video pipeline from session if available
		const session = $sessionStore.activeSession;
		if (session) {
			try {
				session.initializeVideoPipeline();
				sessionStore.update(s => ({ ...s }));
			} catch (e) {
				// Video pipeline initialization may fail if no scene images
				console.log('Could not initialize video pipeline:', e);
			}
		}
		goto('/video');
	}

	function formatTime(seconds: number): string {
		return `${Math.floor(seconds)}s`;
	}

	// Get scenes from storyboard store (populated by scenes page via setScenes)
	let availableScenes = $derived(
		$storyboardStore.wireframes
			.filter(wf => wf.scene !== null)
			.map(wf => wf.scene!)
	);

	// Calculate total duration
	let totalDuration = $derived(
		$storyboardStore.timelineItems.reduce((sum, item) => sum + item.duration, 0)
	);

	// Check if we have any wireframes with content
	let hasContent = $derived(
		$storyboardStore.wireframes.some(wf => wf.scene !== null || wf.characters.length > 0)
	);
</script>

<div class="flex h-full gap-4">
	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col gap-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">Storyboard Editor</h1>
				<p class="text-muted-foreground">Arrange your scenes and edit with prompts</p>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={handleNewStoryboard}>New Storyboard</Button>
				<Button
					disabled={!hasContent}
					onclick={handleSendToVideo}
					data-send-to-video
				>
					Send to Video
				</Button>
			</div>
		</div>

		<!-- Wireframe Grid -->
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
						ondragover={handleDragOver}
						ondrop={(e) => handleDrop(e, wireframe.id)}
						onclick={() => handleWireframeClick(wireframe.id)}
						role="button"
						tabindex="0"
					>
						{#if regeneratingWireframes.has(wireframe.id)}
							<!-- Loading state -->
							<div class="flex items-center justify-center">
								<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" data-spinner />
							</div>
						{:else if wireframe.scene || wireframe.characters.length > 0}
							<!-- Scene background -->
							{#if wireframe.scene}
								<img
									src={wireframe.scene.imageUrl}
									alt={wireframe.scene.name}
									class="absolute inset-0 h-full w-full rounded-lg object-cover"
									data-scene-image
								/>
							{/if}

							<!-- Characters overlay -->
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

					<!-- Edit With Prompt button/form -->
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

			<!-- Empty + wireframe for adding more -->
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

		<!-- Timeline Section -->
		<div class="mt-4 rounded-lg border p-4">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Timeline</h2>
				<div class="flex items-center gap-4">
					<span class="text-sm text-muted-foreground">
						Total Duration: <span class="font-medium">{formatTime(totalDuration)}</span>
					</span>
					<span class="text-sm text-muted-foreground" data-current-time>
						Current Time: <span class="font-medium">{formatTime($storyboardStore.currentTime)}</span>
					</span>
				</div>
			</div>

			<!-- Playback Controls -->
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

				<!-- Timeline Scrubber -->
				<div
					class="relative flex-1 h-2 bg-muted rounded-full cursor-pointer"
					data-timeline-scrubber
				>
					<div
						class="absolute h-full bg-primary rounded-full"
						style="width: {totalDuration > 0 ? ($storyboardStore.currentTime / totalDuration) * 100 : 0}%"
					></div>
				</div>
			</div>

			<!-- Timeline Items -->
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
							{#if item.transition}
								<span class="text-xs text-muted-foreground" data-transition="{index}-{index+1}">
									{item.transition}
								</span>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Selected Wireframe Controls -->
		{#if $storyboardStore.selectedWireframeId}
			{@const selectedWf = $storyboardStore.wireframes.find(w => w.id === $storyboardStore.selectedWireframeId)}
			{#if selectedWf}
				<div class="rounded-lg border p-4">
					<h3 class="mb-4 font-semibold">Wireframe Settings</h3>
					<div class="flex items-center gap-4">
						<label class="flex items-center gap-2">
							<span class="text-sm">Duration (seconds):</span>
							<Input
								type="range"
								min="1"
								max="30"
								value={selectedWf.duration.toString()}
								oninput={(e: Event) => handleDurationChange(selectedWf.id, (e.currentTarget as HTMLInputElement).value)}
								class="w-32"
								aria-label="Duration"
							/>
							<span class="text-sm font-medium">{selectedWf.duration}s</span>
						</label>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Right Sidebar - Available Assets -->
	<div class="w-64 shrink-0 space-y-4 overflow-y-auto rounded-lg border p-4">
		<!-- Scenes Section -->
		<div data-sidebar-section="scenes">
			<h3 class="mb-2 font-semibold">Scenes</h3>
			{#if availableScenes.length === 0}
				<p class="text-sm text-muted-foreground">No scenes generated yet. Generate scenes first.</p>
			{:else}
				<div class="grid grid-cols-2 gap-2">
					{#each availableScenes as scene}
						<div
							class="cursor-grab rounded border p-1 transition-colors hover:bg-muted"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, 'scene', scene)}
							data-scene-thumbnail
						>
							<img
								src={scene.imageUrl}
								alt={scene.name}
								class="h-16 w-full rounded object-cover"
							/>
							<span class="text-xs">{scene.name}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Characters Section -->
		<div data-sidebar-section="characters">
			<h3 class="mb-2 font-semibold">Characters</h3>
			{#if availableCharacters.length === 0}
				<p class="text-sm text-muted-foreground">No characters generated yet</p>
			{:else}
				<div class="grid grid-cols-2 gap-2">
					{#each availableCharacters as character}
						<div
							class="cursor-grab rounded border p-1 transition-colors hover:bg-muted"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, 'character', character)}
							data-character-thumbnail
						>
							<img
								src={character.imageUrl}
								alt={character.name}
								class="h-16 w-full rounded-full object-cover"
							/>
							<span class="text-xs">{character.name}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
