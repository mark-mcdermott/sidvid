<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
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
	import { Play, Pause, X } from '@lucide/svelte';

	// Mock scenes for sidebar (in real app, would come from scene store)
	let availableScenes = $state<WireframeScene[]>([]);
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

		// Load scenes from localStorage (mocked for now)
		const savedScenes = localStorage.getItem('generated-scenes');
		if (savedScenes) {
			try {
				const parsed = JSON.parse(savedScenes);
				availableScenes = parsed.map((s: { url: string; prompt: string }, i: number) => ({
					id: `scene-${i + 1}`,
					name: `Scene ${i + 1}`,
					imageUrl: s.url
				}));
			} catch (e) {
				console.error('Failed to load scenes:', e);
			}
		}

		return () => {
			unsubscribe();
			if (playbackInterval) clearInterval(playbackInterval);
		};
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

	function handleRemoveCharacter(wireframeId: string, characterId: string, characterName: string) {
		removeCharacterFromWireframe(wireframeId, characterId);
	}

	function handleNewStoryboard() {
		createNewStoryboard();
	}

	function handleSendToVideo() {
		goto('/video');
	}

	function formatTime(seconds: number): string {
		return `${Math.floor(seconds)}s`;
	}

	// Calculate total duration
	let totalDuration = $derived(
		$storyboardStore.timelineItems.reduce((sum, item) => sum + item.duration, 0)
	);
</script>

<div class="flex h-full gap-4">
	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col gap-4">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">Storyboard Editor</h1>
				<p class="text-muted-foreground">Arrange your characters and scenes with drag-and-drop</p>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={handleNewStoryboard}>New Storyboard</Button>
				<Button
					disabled={$storyboardStore.timelineItems.length === 0}
					onclick={handleSendToVideo}
				>
					Send to Video
				</Button>
			</div>
		</div>

		<!-- Wireframe Grid -->
		<div class="grid grid-cols-3 gap-4">
			{#each $storyboardStore.wireframes as wireframe}
				<div
					data-storyboard-wireframe={wireframe.id}
					class="relative flex min-h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 p-4 transition-colors hover:border-muted-foreground/50"
					class:border-primary={$storyboardStore.selectedWireframeId === wireframe.id}
					class:border-solid={wireframe.scene !== null || wireframe.characters.length > 0}
					ondragover={handleDragOver}
					ondrop={(e) => handleDrop(e, wireframe.id)}
					onclick={() => handleWireframeClick(wireframe.id)}
					role="button"
					tabindex="0"
				>
					{#if wireframe.scene || wireframe.characters.length > 0}
						<!-- Scene background -->
						{#if wireframe.scene}
							<img
								src={wireframe.scene.imageUrl}
								alt={wireframe.scene.name}
								class="absolute inset-0 h-full w-full rounded-lg object-cover"
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
											class="h-16 w-16 rounded-full border-2 border-white object-cover shadow-lg"
										/>
										<button
											class="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
											onclick={(e) => { e.stopPropagation(); handleRemoveCharacter(wireframe.id, character.id, character.name); }}
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
			{/each}
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
				<p class="text-sm text-muted-foreground">No scenes generated yet</p>
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

		<!-- Storyboard Thumbnails Section -->
		<div data-sidebar-section="storyboard">
			<h3 class="mb-2 font-semibold">Storyboards</h3>
			{#if $storyboardStore.storyboards.length === 0}
				<p class="text-sm text-muted-foreground">No storyboards saved yet</p>
			{:else}
				<div class="grid grid-cols-2 gap-2">
					{#each $storyboardStore.storyboards as storyboard}
						<div
							class="cursor-pointer rounded border p-1 transition-colors hover:bg-muted"
							data-storyboard-thumbnail
						>
							{#if storyboard.thumbnailUrl}
								<img
									src={storyboard.thumbnailUrl}
									alt={storyboard.name}
									class="h-16 w-full rounded object-cover"
								/>
							{:else}
								<div class="flex h-16 w-full items-center justify-center rounded bg-muted">
									<span class="text-xs text-muted-foreground">No preview</span>
								</div>
							{/if}
							<span class="text-xs">{storyboard.name}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Conversations for storyboard (placeholder) -->
			{#if $storyboardStore.storyboards.length > 0}
				<div class="mt-4">
					<h4 class="mb-2 text-sm font-medium">Conversations</h4>
					<div data-conversation-item class="rounded border p-2 text-xs text-muted-foreground">
						Storyboard created
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
