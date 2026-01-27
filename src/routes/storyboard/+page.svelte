<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Sheet from '$lib/components/ui/sheet';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
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
		loadStoryboardFromStorage,
		saveStoryboardToStorage,
		getActiveScenes,
		getArchivedScenes,
		getActiveSceneImageUrl,
		getTotalDuration,
		togglePlayback,
		setCurrentTime,
		type Scene
	} from '$lib/stores/storyboardStore';
	import {
		worldStore,
		ELEMENT_TYPE_COLORS,
		getActiveElementImageUrl,
		type WorldElement
	} from '$lib/stores/worldStore';
	import { sessionStore } from '$lib/stores/sessionStore';
	import {
		Play,
		Pause,
		X,
		Copy,
		Archive,
		ArchiveRestore,
		Plus,
		Eye,
		Type,
		Loader2
	} from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Scene edit modal state
	let editModalOpen = $state(false);
	let editingScene = $state<Scene | null>(null);
	let editTitle = $state('');
	let editDescription = $state('');
	let editDialog = $state('');
	let editAction = $state('');

	// Delete confirmation state
	let deleteConfirmOpen = $state(false);
	let sceneToDelete = $state<string | null>(null);

	// Text visibility toggle per scene
	let textVisibility = $state<Record<string, boolean>>({});

	// Drag state
	let draggedSceneIndex = $state<number | null>(null);

	// Playback interval
	let playbackInterval: ReturnType<typeof setInterval> | null = null;

	// Derived values
	let activeScenes = $derived(getActiveScenes($storyboardStore.scenes));
	let archivedScenes = $derived(getArchivedScenes($storyboardStore.scenes));
	let totalDuration = $derived(getTotalDuration($storyboardStore.scenes));

	// Get element by ID
	function getElement(id: string): WorldElement | undefined {
		return $worldStore.elements.find((el) => el.id === id);
	}

	onMount(() => {
		loadStoryboardFromStorage();

		return () => {
			if (playbackInterval) clearInterval(playbackInterval);
		};
	});

	// Watch for playback state changes
	$effect(() => {
		if ($storyboardStore.isPlaying) {
			playbackInterval = setInterval(() => {
				const newTime = $storyboardStore.currentTime + 0.1;
				if (newTime >= totalDuration) {
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

	// Save state when scenes change
	$effect(() => {
		if ($storyboardStore.scenes) {
			saveStoryboardToStorage();
		}
	});

	// Initialize text visibility for scenes with images
	$effect(() => {
		activeScenes.forEach((scene) => {
			if (!(scene.id in textVisibility)) {
				textVisibility[scene.id] = true; // Show text by default
			}
		});
	});

	function openEditModal(scene: Scene) {
		editingScene = scene;
		editTitle = scene.title;
		editDescription = scene.customDescription || scene.description;
		editDialog = scene.dialog || '';
		editAction = scene.action || '';
		editModalOpen = true;
	}

	function saveSceneEdits() {
		if (!editingScene) return;

		updateScene(editingScene.id, {
			title: editTitle,
			customDescription: editDescription,
			dialog: editDialog || undefined,
			action: editAction || undefined
		});

		editModalOpen = false;
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
		deleteConfirmOpen = true;
	}

	function handleDeleteScene() {
		if (sceneToDelete) {
			deleteScene(sceneToDelete);
			sceneToDelete = null;
			deleteConfirmOpen = false;
		}
	}

	function toggleTextVisibility(sceneId: string, e: Event) {
		e.stopPropagation();
		textVisibility[sceneId] = !textVisibility[sceneId];
	}

	function handleDragStart(e: DragEvent, index: number) {
		draggedSceneIndex = index;
		e.dataTransfer?.setData('text/plain', index.toString());
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		if (draggedSceneIndex !== null && draggedSceneIndex !== toIndex) {
			reorderScenes(draggedSceneIndex, toIndex);
		}
		draggedSceneIndex = null;
	}

	function handleDragEnd() {
		draggedSceneIndex = null;
	}

	// Handle world element drop from sidebar
	function handleElementDrop(e: DragEvent, sceneId: string) {
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
	function handleNewSceneDrop(e: DragEvent) {
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

	function handleSendToVideo() {
		const session = $sessionStore.activeSession;
		if (session) {
			try {
				session.initializeVideoPipeline();
				sessionStore.update((s) => ({ ...s }));
			} catch (e) {
				console.log('Could not initialize video pipeline:', e);
			}
		}
		goto('/video');
	}

	function formatTime(seconds: number): string {
		return `${Math.floor(seconds)}s`;
	}

	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Storyboard</h1>
			<p class="text-muted-foreground">Create and arrange your scenes</p>
		</div>
		<div class="flex gap-2">
			<Button
				variant="outline"
				onclick={() => togglePlayback()}
				disabled={activeScenes.length === 0}
			>
				{#if $storyboardStore.isPlaying}
					<Pause class="mr-2 h-4 w-4" />
					Pause
				{:else}
					<Play class="mr-2 h-4 w-4" />
					Preview
				{/if}
			</Button>
			<Button disabled={activeScenes.length === 0} onclick={handleSendToVideo}>
				Generate Video
			</Button>
		</div>
	</div>

	<!-- Timeline info -->
	{#if activeScenes.length > 0}
		<div class="flex items-center gap-4 text-sm text-muted-foreground">
			<span>Total Duration: <span class="font-medium">{formatTime(totalDuration)}</span></span>
			<span>Scenes: <span class="font-medium">{activeScenes.length}</span></span>
		</div>
	{/if}

	<!-- Scene Cards Grid -->
	<div class="flex flex-wrap gap-4">
		{#each activeScenes as scene, index}
			{@const sceneImageUrl = getActiveSceneImageUrl(scene)}
			{@const showText = textVisibility[scene.id] !== false}
			<div
				class="relative w-72 rounded-lg border bg-card overflow-hidden cursor-pointer transition-shadow hover:shadow-lg"
				draggable="true"
				ondragstart={(e) => handleDragStart(e, index)}
				ondragover={handleDragOver}
				ondrop={(e) => handleDrop(e, index)}
				ondragend={handleDragEnd}
				onclick={() => openEditModal(scene)}
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
					class="absolute inset-0 p-3 flex flex-col {sceneImageUrl && showText
						? 'text-white'
						: ''}"
					ondragover={handleDragOver}
					ondrop={(e) => {
						e.stopPropagation();
						handleElementDrop(e, scene.id);
					}}
				>
					{#if showText || !sceneImageUrl}
						<!-- Top row: badges and icons -->
						<div class="flex items-start justify-between">
							<div class="flex flex-wrap gap-1">
								<span
									class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white"
								>
									Scene {index + 1}
								</span>
								<span
									class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white"
								>
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
								<span
									class="rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white"
								>
									{truncateText(scene.title, 25)}
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
									{@const element = getElement(elementId)}
									{#if element}
										<span
											class="rounded px-2 py-0.5 text-xs font-medium text-white"
											style="background-color: {ELEMENT_TYPE_COLORS[element.type]}"
										>
											{truncateText(element.name, 12)}
										</span>
									{/if}
								{/each}
								{#if scene.assignedElements.length > 4}
									<span
										class="rounded bg-gray-500 px-2 py-0.5 text-xs font-medium text-white"
									>
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
						onclick={(e) => toggleTextVisibility(scene.id, e)}
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

		<!-- New Scene Button -->
		<div
			class="w-72 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/20 transition-colors"
			onclick={handleAddScene}
			ondragover={handleDragOver}
			ondrop={handleNewSceneDrop}
			role="button"
			tabindex="0"
			data-add-scene
		>
			<Plus class="h-12 w-12 text-muted-foreground" />
		</div>
	</div>

	<!-- Archived Scenes Section -->
	<div class="border-t pt-6">
		<h2 class="text-lg font-semibold mb-4">Archived Scenes</h2>
		{#if archivedScenes.length === 0}
			<p class="text-sm text-muted-foreground">You have no archived scenes</p>
		{:else}
			<div class="flex flex-wrap gap-2">
				{#each archivedScenes as scene}
					{@const sceneImageUrl = getActiveSceneImageUrl(scene)}
					<button
						class="w-24 h-16 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all"
						onclick={() => openEditModal(scene)}
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

<!-- Scene Edit Modal -->
<Sheet.Root bind:open={editModalOpen}>
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
				<Input id="scene-title" bind:value={editTitle} placeholder="Scene title" />
			</div>

			<div>
				<label for="scene-description" class="text-sm font-medium">Description</label>
				<Textarea
					id="scene-description"
					bind:value={editDescription}
					placeholder="Describe what happens in this scene..."
					rows={3}
				/>
			</div>

			<div>
				<label for="scene-dialog" class="text-sm font-medium">Dialog</label>
				<Textarea
					id="scene-dialog"
					bind:value={editDialog}
					placeholder="Character dialog for this scene..."
					rows={2}
				/>
			</div>

			<div>
				<label for="scene-action" class="text-sm font-medium">Action</label>
				<Textarea
					id="scene-action"
					bind:value={editAction}
					placeholder="Physical actions in this scene..."
					rows={2}
				/>
			</div>

			<!-- World Elements in Modal -->
			{#if editingScene && editingScene.assignedElements.length > 0}
				{@const characters = editingScene.assignedElements
					.map((id) => getElement(id))
					.filter((el) => el?.type === 'character')}
				{@const locations = editingScene.assignedElements
					.map((id) => getElement(id))
					.filter((el) => el?.type === 'location')}
				{@const objects = editingScene.assignedElements
					.map((id) => getElement(id))
					.filter((el) => el?.type === 'object')}
				{@const concepts = editingScene.assignedElements
					.map((id) => getElement(id))
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
												{truncateText(element.name, 10)}
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
												{truncateText(element.name, 10)}
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
												{truncateText(element.name, 10)}
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
												{truncateText(element.name, 10)}
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
							editModalOpen = false;
						}}
					>
						<ArchiveRestore class="mr-2 h-4 w-4" />
						Unarchive
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (editModalOpen = false)}>Cancel</Button>
				<Button onclick={saveSceneEdits}>Save Changes</Button>
			</div>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>

<!-- Delete Confirmation Sheet -->
<Sheet.Root bind:open={deleteConfirmOpen}>
	<Sheet.Content side="right" class="w-[400px]">
		<Sheet.Header>
			<Sheet.Title>Delete Scene</Sheet.Title>
			<Sheet.Description>
				Are you sure you want to delete this scene? This action cannot be undone.
			</Sheet.Description>
		</Sheet.Header>
		<Sheet.Footer>
			<Button variant="outline" onclick={() => (deleteConfirmOpen = false)}>Cancel</Button>
			<Button variant="destructive" onclick={handleDeleteScene}>Delete</Button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
