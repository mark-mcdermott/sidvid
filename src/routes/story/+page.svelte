<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { storyStore } from '$lib/stores/storyStore';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// DOM element references (not persisted in store)
	let storyCardElement: HTMLDivElement | undefined = $state();
	let tryAgainElement: HTMLDivElement | undefined = $state();
	let editPromptElement: HTMLDivElement | undefined = $state();
	let latestStoryCardElement: HTMLDivElement | undefined = $state();
	let lastStoryRawContent = $state<string>('');
	let capturedPromptForNextStory = $state<string>('');

	$effect(() => {
		if (form?.success && form?.story) {
			// Check if this is a new story by comparing rawContent
			const currentRawContent = form.story.rawContent;
			const lastContent = untrack(() => lastStoryRawContent);

			if (currentRawContent !== lastContent) {
				untrack(() => {
					// Use the captured prompt if available, otherwise determine from current state
					let storyPrompt: string;
					if (capturedPromptForNextStory) {
						storyPrompt = capturedPromptForNextStory;
						capturedPromptForNextStory = ''; // Clear after use
					} else if ($storyStore.isTryingAgain) {
						storyPrompt = $storyStore.tryAgainPrompt;
					} else {
						storyPrompt = $storyStore.prompt;
					}

					// Store story with its prompt and length
					storyStore.update(state => ({
						...state,
						stories: [...state.stories, {
							story: form.story!,
							prompt: storyPrompt,
							length: (state.isTryingAgain ? state.tryAgainLength?.label : state.selectedLength?.label) || '5s'
						}],
						// Reset edit states when a new story is added
						isEditingManually: false,
						editedStoryContent: ''
					}));
					lastStoryRawContent = currentRawContent;
				});
			}
		}
	});

	function startManualEdit() {
		const latestEntry = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestEntry) {
			storyStore.update(state => ({
				...state,
				editedStoryContent: latestEntry.story.rawContent,
				isEditingManually: true
			}));
			// Scroll to the story card
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
			// Parse the edited JSON content and update the latest story
			try {
				const parsed = JSON.parse($storyStore.editedStoryContent);
				// Update the latest story in the array
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
		// Scroll to the edit prompt form
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
		if ($storyStore.stories.length > 0) {
			storyStore.update(state => ({
				...state,
				tryAgainPrompt: state.prompt,
				tryAgainLength: state.selectedLength,
				isTryingAgain: true
			}));
			// Scroll to the try again section
			setTimeout(() => {
				tryAgainElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 0);
		}
	}

	function cancelTryAgain() {
		storyStore.update(state => ({
			...state,
			isTryingAgain: false,
			tryAgainPrompt: ''
		}));
	}

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
</script>

<form
	method="POST"
	action="?/generateStory"
	use:enhance={() => {
		storyStore.update(state => ({ ...state, isGenerating: true }));
		return async ({ update }) => {
			await update();
			storyStore.update(state => ({ ...state, isGenerating: false }));
		};
	}}
>
	<div class="flex flex-col gap-4">
		<h1 class="text-3xl font-bold">Story Generation</h1>
		<p class="text-muted-foreground">Generate a story from your prompt using ChatGPT</p>

		{#if form?.error}
			<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
				{form.error}
			</div>
		{/if}

		<div class="w-full xl:max-w-[32rem]">
			<div class="mb-2">
				<label for="length" class="mb-1 block text-sm font-medium">Video Length</label>
				<Select.Root bind:selected={$storyStore.selectedLength}>
					<Select.Trigger class="w-32">
						{$storyStore.selectedLength?.label || 'Select length'}
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
				placeholder="Enter your story prompt (e.g., 'A detective solving a mystery in a futuristic city')"
				class="min-h-32"
				required
			/>
		</div>

		<div class="flex gap-2">
			<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.prompt.trim()}>
				{$storyStore.isGenerating ? 'Generating...' : 'Generate Story'}
			</Button>
		</div>

		{#each $storyStore.stories as entry, index}
			{#if index > 0}
				<div class="my-4 rounded-md bg-muted/30 p-3 text-sm">
					<p class="font-medium text-muted-foreground">Prompt ({entry.length}):</p>
					<p class="mt-1">{entry.prompt}</p>
				</div>
			{/if}

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
								<div class="rounded-md bg-muted/50 p-3">
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
				<div class="flex flex-col gap-4 rounded-md border p-4">
					<div>
						<h2 class="text-xl font-semibold">{entry.story.title}</h2>
					</div>
					<div class="space-y-4">
						{#each entry.story.scenes as scene}
							<div class="rounded-md bg-muted/50 p-3">
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
				</div>
			{/if}

			{#if !$storyStore.isEditingManually && index === $storyStore.stories.length - 1}
				<div class="flex gap-2">
					<Button type="button" onclick={startTryAgain} variant="outline">Try Again</Button>
					<Button onclick={startManualEdit} variant="outline">Edit Story Manually</Button>
					<Button onclick={startPromptEdit} variant="outline">Edit Story with Prompt</Button>
					<Button href="/characters">Send to Character Generation</Button>
				</div>

				{#if $storyStore.isEditingWithPrompt}
					<form
						method="POST"
						action="?/editStory"
						use:enhance={() => {
							storyStore.update(state => ({ ...state, isGenerating: true }));
							// Capture the edit prompt for the next story BEFORE form submission
							capturedPromptForNextStory = `Edit: ${$storyStore.editPrompt}`;
							return async ({ update }) => {
								await update();
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
								placeholder="E.g., 'Add more action to scene 2' or 'Make the dialogue more dramatic'"
								class="min-h-32"
							/>
							<div class="flex gap-2">
								<Button type="button" onclick={cancelPromptEdit} variant="outline">Cancel</Button>
								<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.editPrompt.trim()}>
									{$storyStore.isGenerating ? 'Regenerating...' : 'Regenerate Story'}
								</Button>
							</div>
						</div>
					</form>
				{/if}

				{#if $storyStore.isTryingAgain}
					<form
						method="POST"
						action="?/generateStory"
						use:enhance={() => {
							storyStore.update(state => ({ ...state, isGenerating: true }));
							return async ({ update }) => {
								await update();
								storyStore.update(state => ({
									...state,
									isGenerating: false,
									isTryingAgain: false
								}));
							};
						}}
					>
						<div bind:this={tryAgainElement} class="flex flex-col gap-4 rounded-md border p-4">
							<h3 class="text-lg font-semibold">Try Again</h3>
							<p class="text-sm text-muted-foreground">
								Generate a new version of the story
							</p>

							<div>
								<label for="tryAgainLength" class="mb-1 block text-sm font-medium"
									>Video Length</label
								>
								<Select.Root bind:selected={$storyStore.tryAgainLength}>
									<Select.Trigger class="w-32">
										{$storyStore.tryAgainLength?.label || 'Select length'}
									</Select.Trigger>
									<Select.Content>
										{#each lengthOptions as option}
											<Select.Item value={option.value} label={option.label}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input type="hidden" name="length" value={$storyStore.tryAgainLength?.value || '5s'} />
							</div>

							<Textarea
								bind:value={$storyStore.tryAgainPrompt}
								name="prompt"
								placeholder="Enter your story prompt"
								class="min-h-32"
								required
							/>

							<div class="flex gap-2">
								<Button type="button" onclick={cancelTryAgain} variant="outline">Cancel</Button>
								<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.tryAgainPrompt.trim()}>
									{$storyStore.isGenerating ? 'Regenerating...' : 'Regenerate Story'}
								</Button>
							</div>
						</div>
					</form>
				{/if}
			{/if}
		{/each}
	</div>
</form>
