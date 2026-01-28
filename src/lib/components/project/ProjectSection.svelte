<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Switch } from '$lib/components/ui/switch';
	import { Bomb, Settings, ChevronDown, Info } from '@lucide/svelte';
	import { storyStore, STYLE_OPTIONS, type StylePreset, type VideoProvider } from '$lib/stores/storyStore';
	import {
		projectStore,
		createNewProject,
		deleteProject,
		initializeProjectStore
	} from '$lib/stores/projectStore';

	// Props
	let { testingMode = false }: { testingMode?: boolean } = $props();

	// State
	let showNukeModal = $state(false);
	let sectionOpen = $state(true);

	// Video/Scene Length Options
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

	const sceneLengthOptions = [
		{ value: '5s', label: '5s' }
	];

	const providerOptions = [
		{ value: 'mock', label: 'Mock' },
		{ value: 'kling', label: 'Kling AI' }
	];

	let selectedLengthValue = $state($storyStore.selectedLength.value);
	let selectedSceneLengthValue = $state('5s');
	let selectedStyleValue = $state<StylePreset>($storyStore.selectedStyle);
	let selectedProviderValue = $state<VideoProvider>($storyStore.selectedProvider);
	let prototypingModeValue = $state($storyStore.prototypingMode);
	let enableSoundValue = $state($storyStore.enableSound);

	// Derived state
	let projects = $derived($projectStore.projects);
	let selectedStyleLabel = $derived(
		STYLE_OPTIONS.find(opt => opt.value === $storyStore.selectedStyle)?.label || 'Anime'
	);
	let selectedProviderLabel = $derived(
		providerOptions.find(opt => opt.value === $storyStore.selectedProvider)?.label || 'Kling'
	);

	// Initialize on mount
	onMount(async () => {
		await initializeProjectStore();
	});

	// Effects to sync select values with store
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

	$effect(() => {
		if (selectedProviderValue !== $storyStore.selectedProvider) {
			storyStore.update(state => ({
				...state,
				selectedProvider: selectedProviderValue
			}));
		}
	});

	$effect(() => {
		selectedProviderValue = $storyStore.selectedProvider;
	});

	// Effect to sync prototyping mode switch with store
	$effect(() => {
		if (prototypingModeValue !== $storyStore.prototypingMode) {
			if (browser) {
				localStorage.setItem('sidvid-prototyping-mode', String(prototypingModeValue));
			}
			storyStore.update(s => ({ ...s, prototypingMode: prototypingModeValue }));
		}
	});

	$effect(() => {
		prototypingModeValue = $storyStore.prototypingMode;
	});

	// Effect to sync audio switch with store
	$effect(() => {
		if (enableSoundValue !== $storyStore.enableSound) {
			storyStore.update(s => ({ ...s, enableSound: enableSoundValue }));
		}
	});

	$effect(() => {
		enableSoundValue = $storyStore.enableSound;
	});

	function openNukeModal() {
		showNukeModal = true;
	}

	function closeNukeModal() {
		showNukeModal = false;
	}

	async function confirmNuke() {
		// Delete all projects
		const allProjectIds = [...projects.map(p => p.id)];
		for (const projectId of allProjectIds) {
			await deleteProject(projectId);
		}

		// Create a fresh project
		await createNewProject();

		closeNukeModal();
	}
</script>

<section id="project" class="scroll-mt-16 border-b pb-8">
	<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
		<!-- Left Column: Section Header -->
		<div class="flex items-start justify-between sm:flex-col sm:gap-2">
			<div>
				<h1 class="text-3xl font-bold mb-3 flex items-center gap-2">
					<Settings class="h-7 w-7" />Settings
					<button
						type="button"
						onclick={() => sectionOpen = !sectionOpen}
						class="ml-2 cursor-pointer hover:text-primary transition-colors"
						title={sectionOpen ? 'Collapse section' : 'Expand section'}
					>
						<ChevronDown class="h-5 w-5 transition-transform duration-200 {sectionOpen ? '' : '-rotate-90'}" />
					</button>
				</h1>
				{#if sectionOpen}
					<p class="text-muted-foreground">Configure your project</p>
				{/if}
			</div>
			{#if testingMode && sectionOpen}
				<Button variant="outline" size="sm" onclick={openNukeModal} title="Delete all projects (nuke)">
					<Bomb class="!mr-0 h-4 w-4" />
				</Button>
			{/if}
		</div>

		<!-- Right Column: Video Settings -->
		{#if sectionOpen}
		<div class="flex flex-col gap-3">
			<!-- Video Settings Row -->
			<div class="flex gap-4">
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
				</div>

				<div>
					<label for="sceneLength" class="mb-1 flex items-center gap-1 text-sm font-medium">
						Scenes Length
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Info class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Kling only offers 5 second clips</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</label>
					<Select.Root type="single" bind:value={selectedSceneLengthValue}>
						<Select.Trigger class="w-32">
							{selectedSceneLengthValue}
						</Select.Trigger>
						<Select.Content>
							{#each sceneLengthOptions as option}
								<Select.Item value={option.value} label={option.label}>
									{option.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
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
				</div>

				<div>
					<label class="mb-1 flex items-center gap-1 text-sm font-medium">
						Prototype
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Info class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Fast generation with DALL-E (no character consistency)</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</label>
					<Switch bind:checked={prototypingModeValue} />
				</div>
			</div>

			<!-- Video Provider Row -->
			<div class="flex gap-4">
				<div>
					<label for="provider" class="mb-1 flex items-center gap-1 text-sm font-medium">
						Video Provider
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Info class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Kling AI 2.6: ~$0.75/clip</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</label>
					<Select.Root type="single" bind:value={selectedProviderValue}>
						<Select.Trigger class="w-32">
							{selectedProviderLabel}
						</Select.Trigger>
						<Select.Content>
							{#each providerOptions as option}
								<Select.Item value={option.value} label={option.label}>
									{option.label}
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<label class="mb-1 flex items-center gap-1 text-sm font-medium">
						Audio
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Info class="h-3.5 w-3.5 text-muted-foreground" />
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>Generate video clips with sound effects</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</label>
					<Switch bind:checked={enableSoundValue} />
				</div>
			</div>

			{#if $storyStore.selectedStyle === 'custom'}
				<div class="mt-2">
					<label for="customStylePrompt" class="mb-1 block text-sm font-medium">Custom Style Prompt</label>
					<Input
						bind:value={$storyStore.customStylePrompt}
						name="customStylePrompt"
						placeholder="e.g., anime style, cel-shaded, studio ghibli inspired..."
						class="w-full"
					/>
				</div>
			{/if}
		</div>
		{/if}
	</div>

	<!-- Nuke Confirmation Modal (Testing Mode) -->
	{#if showNukeModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
			role="dialog"
			aria-modal="true"
		>
			<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg border-4 border-gray-300 dark:border-[12px] dark:border-zinc-700">
				<h3 class="text-lg font-semibold text-destructive">Nuke All Projects</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					This will delete ALL {projects.length} project{projects.length !== 1 ? 's' : ''} and their associated data.
				</p>
				<p class="mt-1 text-sm text-destructive font-medium">
					This action is irreversible!
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<Button variant="outline" onclick={closeNukeModal}>Cancel</Button>
					<Button variant="destructive" onclick={confirmNuke}>Nuke Everything</Button>
				</div>
			</div>
		</div>
	{/if}
</section>
