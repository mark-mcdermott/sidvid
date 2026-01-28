<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Pencil, Trash2, Plus } from '@lucide/svelte';
	import {
		projectStore,
		createNewProject,
		loadProject,
		deleteProject,
		renameProject,
		initializeProjectStore
	} from '$lib/stores/projectStore';
	import type { ProjectSummary } from '$lib/sidvid';

	// State
	let isEditing = $state(false);
	let editName = $state('');
	let showDeleteModal = $state(false);
	let editingProjectId = $state<string | null>(null);
	let editingListProjectId = $state<string | null>(null);
	let editingListName = $state('');
	let deletingProjectId = $state<string | null>(null);
	let nameInputElement: HTMLInputElement | null = $state(null);
	let listNameInputElement: HTMLInputElement | null = $state(null);

	// Derived state
	let currentProject = $derived($projectStore.currentProject);
	let projects = $derived($projectStore.projects);
	let hasMultipleProjects = $derived(projects.length > 1);

	// Initialize on mount
	onMount(async () => {
		await initializeProjectStore();
	});

	// === Current Project Editing ===

	function startEditing() {
		editName = currentProject?.name ?? 'My New Project';
		isEditing = true;
		setTimeout(() => nameInputElement?.focus(), 0);
	}

	async function saveEdit() {
		if (!currentProject || !editName.trim()) {
			cancelEdit();
			return;
		}

		try {
			await renameProject(currentProject.id, editName.trim());
		} catch (e) {
			// Revert on error
		}
		isEditing = false;
	}

	function cancelEdit() {
		isEditing = false;
		editName = '';
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		}
	}

	function handleEditBlur() {
		saveEdit();
	}

	// === List Item Editing ===

	function startListEditing(project: ProjectSummary) {
		editingListProjectId = project.id;
		editingListName = project.name;
		setTimeout(() => listNameInputElement?.focus(), 0);
	}

	async function saveListEdit() {
		if (!editingListProjectId || !editingListName.trim()) {
			cancelListEdit();
			return;
		}

		try {
			await renameProject(editingListProjectId, editingListName.trim());
		} catch (e) {
			// Revert on error
		}
		editingListProjectId = null;
		editingListName = '';
	}

	function cancelListEdit() {
		editingListProjectId = null;
		editingListName = '';
	}

	function handleListEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveListEdit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelListEdit();
		}
	}

	function handleListEditBlur() {
		saveListEdit();
	}

	// === Delete Modal ===

	function openDeleteModal() {
		deletingProjectId = currentProject?.id ?? null;
		showDeleteModal = true;
	}

	function openDeleteModalForProject(projectId: string) {
		deletingProjectId = projectId;
		showDeleteModal = true;
	}

	function closeDeleteModal() {
		showDeleteModal = false;
		deletingProjectId = null;
	}

	async function confirmDelete() {
		if (!deletingProjectId) return;

		const wasCurrentProject = deletingProjectId === currentProject?.id;
		await deleteProject(deletingProjectId);

		// If no projects left, create a new one
		if ($projectStore.projects.length === 0) {
			await createNewProject();
		} else if (wasCurrentProject) {
			// Switch to first available project
			await loadProject($projectStore.projects[0].id);
		}

		closeDeleteModal();
	}

	// === Actions ===

	async function handleNewProject() {
		await createNewProject();
	}

	async function handleProjectSwitch(e: Event) {
		const select = e.target as HTMLSelectElement;
		const projectId = select.value;
		if (projectId && projectId !== currentProject?.id) {
			await loadProject(projectId);
		}
	}

	async function handleProjectClick(projectId: string) {
		if (projectId !== currentProject?.id) {
			await loadProject(projectId);
		}
	}

	function getDeletingProjectName(): string {
		if (!deletingProjectId) return '';
		if (deletingProjectId === currentProject?.id) return currentProject.name;
		const project = projects.find((p) => p.id === deletingProjectId);
		return project?.name ?? '';
	}
</script>

<section id="project" class="scroll-mt-16">
	<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
		<!-- Left Column: Section Header -->
		<div>
			<h1 class="text-3xl font-bold mb-3">Project</h1>
			<p class="text-muted-foreground">Name your project</p>
		</div>

		<!-- Right Column: Content -->
		<div class="flex flex-col gap-4 w-full xl:max-w-[32rem]">
			<!-- Project Name Row -->
			<div class="flex items-center gap-3">
				{#if isEditing}
					<input
						bind:this={nameInputElement}
						bind:value={editName}
						onkeydown={handleEditKeydown}
						onblur={handleEditBlur}
						aria-label="project name"
						class="h-9 w-64 rounded-md border border-input bg-background px-3 py-1 text-lg font-medium outline-none focus:ring-2 focus:ring-ring"
					/>
				{:else}
					<h2 class="text-lg font-medium">
						{currentProject?.name ?? 'My New Project'}
					</h2>
				{/if}

				<!-- Edit Button -->
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8"
					onclick={startEditing}
					aria-label="edit project name"
				>
					<Pencil class="h-4 w-4" />
				</Button>

				<!-- Delete Button -->
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 text-destructive hover:text-destructive"
					onclick={openDeleteModal}
					aria-label="delete project"
				>
					<Trash2 class="h-4 w-4" />
				</Button>

				<!-- Project Dropdown (only shown when 2+ projects) -->
				{#if hasMultipleProjects}
					<select
						class="ml-4 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
						onchange={handleProjectSwitch}
						value={currentProject?.id ?? ''}
						aria-label="select project"
					>
						{#each projects as project}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				{/if}

				<!-- New Project Button -->
				<Button variant="outline" size="sm" onclick={handleNewProject}>
					<Plus class="mr-1 h-4 w-4" />
					New Project
				</Button>
			</div>

			<!-- Divider -->
			<hr class="border-border" />

			<!-- All Projects List -->
			<div class="flex flex-col gap-2">
				<h2 class="text-lg font-semibold">All Projects</h2>
				{#each projects as project}
					<div
						data-testid="project-list-item"
						data-current={project.id === currentProject?.id ? 'true' : 'false'}
						class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 {project.id ===
						currentProject?.id
							? 'border-primary bg-primary/5'
							: 'border-border'}"
					>
						<!-- Project Name (clickable) -->
						{#if editingListProjectId === project.id}
							<input
								bind:this={listNameInputElement}
								bind:value={editingListName}
								onkeydown={handleListEditKeydown}
								onblur={handleListEditBlur}
								aria-label="project name"
								class="h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 outline-none focus:ring-2 focus:ring-ring"
							/>
						{:else}
							<button
								class="flex-1 text-left font-medium"
								onclick={() => handleProjectClick(project.id)}
							>
								{project.name}
							</button>
						{/if}

						<!-- Edit Button -->
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8"
							onclick={() => startListEditing(project)}
							aria-label="edit project"
						>
							<Pencil class="h-4 w-4" />
						</Button>

						<!-- Delete Button -->
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 text-destructive hover:text-destructive"
							onclick={() => openDeleteModalForProject(project.id)}
							aria-label="delete project"
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg dark:border-[5px] dark:border-zinc-700">
				<h3 class="text-lg font-semibold">Delete Project</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					Are you sure you want to delete "{getDeletingProjectName()}"?
				</p>
				<p class="mt-1 text-sm text-muted-foreground">This action is irreversible.</p>
				<div class="mt-4 flex justify-end gap-2">
					<Button variant="outline" onclick={closeDeleteModal}>Cancel</Button>
					<Button variant="destructive" onclick={confirmDelete}>Delete</Button>
				</div>
			</div>
		</div>
	{/if}
