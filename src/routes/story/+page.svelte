<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { storyStore, STYLE_OPTIONS, type StylePreset } from '$lib/stores/storyStore';
	import { Input } from '$lib/components/ui/input';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import { truncateTitle } from '$lib/sidvid/utils/conversation-helpers';
	import { HistoryViewer } from '$lib/components/sessions';
	import { Loader2 } from '@lucide/svelte';
	import type { ActionData } from './$types';
	import type { Story } from '$lib/sidvid';
	import { loadElementsFromStory, addElementImage, type WorldElement } from '$lib/stores/worldStore';

	let { form }: { form: ActionData } = $props();

	// DOM element references (not persisted in store)
	let storyCardElement: HTMLDivElement | undefined = $state();
	let editPromptElement: HTMLDivElement | undefined = $state();
	let latestStoryCardElement: HTMLDivElement | undefined = $state();
	let lastStoryRawContent = $state<string>('');
	let capturedPromptForNextStory = $state<string>('');
	let mainFormElement: HTMLFormElement | undefined = $state();
	let editFormElement: HTMLFormElement | undefined = $state();
	let tryAgainFormElement: HTMLFormElement | undefined = $state();
	let showHistory = $state(false);

	// Get session story history
	let sessionStoryHistory = $derived.by(() => {
		const session = $sessionStore.activeSession;
		if (!session) return [] as Story[];
		return session.getStoryHistory();
	});

	function handleKeydown(e: KeyboardEvent, formElement?: HTMLFormElement) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			formElement?.requestSubmit();
		}
	}

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

					// Save to conversation
					(async () => {
						try {
							// Use truncated story title for conversation name
							const conversationTitle = truncateTitle(form.story!.title);

							// Create conversation with user message
							const conversation = await createMessage(
								storyPrompt,
								'/story',
								$conversationStore.currentConversationId || undefined,
								conversationTitle
							);

							// Add assistant response (use rawContent which is already a string)
							await addMessageToConversation(conversation.id, {
								role: 'assistant',
								content: form.story.rawContent,
								timestamp: Date.now(),
								route: '/story'
							});
						} catch (error) {
							console.error('Error saving conversation:', error);
						}
					})();

					// Auto-extract characters to World section and trigger image generation
					console.log('Story generation complete. Characters:', form.story.characters);
					if (form.story.characters && form.story.characters.length > 0) {
						// Map story characters to world elements format
						// Use physical description for image generation, fall back to description
						const characters = form.story.characters.map((c: { name: string; description: string; physical?: string }) => ({
							name: c.name,
							description: c.physical || c.description
						}));

						// Add characters to world store and get newly added ones
						const newElements = loadElementsFromStory(characters);
						console.log('Added elements to world store:', newElements);

						// Auto-generate images for new characters
						if (newElements.length > 0) {
							const currentStyle = $storyStore.selectedStyle;
							// Map style preset to image generation style
							const styleMap: Record<string, string> = {
								anime: 'anime',
								photorealistic: 'realistic',
								'3d-animated': 'cartoon',
								watercolor: 'realistic',
								comic: 'cartoon',
								custom: 'realistic'
							};
							const imageStyle = styleMap[currentStyle] || 'realistic';

							// Generate images for each new character in parallel
							console.log('Starting image generation for', newElements.length, 'characters with style:', imageStyle);
							newElements.forEach(async (element: WorldElement) => {
								try {
									console.log('Generating image for:', element.name, 'description:', element.description);
									const formData = new FormData();
									formData.append('description', element.description);
									formData.append('elementType', element.type);
									formData.append('style', imageStyle);

									const response = await fetch('/world?/generateImage', {
										method: 'POST',
										body: formData
									});

									const result = await response.json();
									console.log('Image generation result for', element.name, ':', result);

									if (result.type === 'success' && result.data) {
										// Parse the data array to find the imageUrl
										const dataArray = JSON.parse(result.data);
										const successData = dataArray.find((item: { success?: boolean }) => item.success === true);

										if (successData?.imageUrl) {
											// Download and save image locally
											const localPath = await downloadAndReplaceImage(
												successData.imageUrl,
												$conversationStore.currentConversationId || ''
											);
											// Add image to the element
											addElementImage(element.id, `/data/images/${localPath}`, successData.revisedPrompt);
										}
									}
								} catch (error) {
									console.error(`Error generating image for ${element.name}:`, error);
								}
							});
						}
					}
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
		console.log('startTryAgain called', {
			hasStories: $storyStore.stories.length > 0,
			hasFormElement: !!tryAgainFormElement,
			prompt: $storyStore.prompt,
			length: $storyStore.selectedLength.value
		});

		if ($storyStore.stories.length > 0 && tryAgainFormElement) {
			// Update form values right before submission to ensure they're current
			const promptInput = tryAgainFormElement.querySelector('input[name="prompt"]') as HTMLInputElement;
			const lengthInput = tryAgainFormElement.querySelector('input[name="length"]') as HTMLInputElement;

			console.log('Found inputs:', { promptInput, lengthInput });

			if (promptInput) promptInput.value = $storyStore.prompt;
			if (lengthInput) lengthInput.value = $storyStore.selectedLength.value;

			console.log('Submitting form...');
			tryAgainFormElement.requestSubmit();
		} else {
			console.log('Not submitting - missing stories or form element');
		}
	}

	function handleRevertToVersion(index: number) {
		const session = $sessionStore.activeSession;
		if (!session) return;

		try {
			session.revertToStory(index);
			// Force reactivity update
			sessionStore.update(s => ({ ...s }));
		} catch (error) {
			console.error('Error reverting to story version:', error);
		}
	}

	function handlePreviewVersion(index: number) {
		const history = sessionStoryHistory;
		if (history && history[index]) {
			console.log('Preview story version:', history[index]);
			// Could open a modal or scroll to display the version
		}
	}

	function toggleHistory() {
		showHistory = !showHistory;
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

	// Create reactive state variable for the Select component
	let selectedLengthValue = $state($storyStore.selectedLength.value);

	// Sync changes from Select back to store
	$effect(() => {
		const selectedOption = lengthOptions.find(opt => opt.value === selectedLengthValue);
		if (selectedOption && selectedOption.value !== $storyStore.selectedLength.value) {
			storyStore.update(state => ({
				...state,
				selectedLength: selectedOption
			}));
		}
	});

	// Sync changes from store back to local state
	$effect(() => {
		selectedLengthValue = $storyStore.selectedLength.value;
	});

	// Style selector state
	let selectedStyleValue = $state<StylePreset>($storyStore.selectedStyle);

	// Sync style changes from Select back to store
	$effect(() => {
		if (selectedStyleValue !== $storyStore.selectedStyle) {
			storyStore.update(state => ({
				...state,
				selectedStyle: selectedStyleValue
			}));
		}
	});

	// Sync style changes from store back to local state
	$effect(() => {
		selectedStyleValue = $storyStore.selectedStyle;
	});

	// Get the label for current style
	let selectedStyleLabel = $derived(
		STYLE_OPTIONS.find(opt => opt.value === $storyStore.selectedStyle)?.label || 'Anime'
	);
</script>

<section id="story" class="scroll-mt-16">
	<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
		<!-- Left Column: Section Header -->
		<div>
			<h1 class="text-3xl font-bold mb-3">Story</h1>
			<p class="text-muted-foreground">Generate a story from your prompt using ChatGPT</p>
			{#if $sessionStore.activeSession && sessionStoryHistory.length > 0}
				<Button variant="outline" size="sm" class="mt-4" onclick={toggleHistory}>
					{showHistory ? 'Hide' : 'Show'} History ({sessionStoryHistory.length})
				</Button>
			{/if}
		</div>

		<!-- Right Column: Content -->
		<div class="flex flex-col gap-4 w-full xl:max-w-[32rem]">
			<form
				bind:this={mainFormElement}
				method="POST"
				action="?/generateStory"
				use:enhance={() => {
					// Capture the prompt before form submission
					const currentPrompt = $storyStore.prompt;
					storyStore.update(state => ({ ...state, isGenerating: true }));
					return async ({ update }) => {
						await update({ reset: false }); // Don't reset the form
						storyStore.update(state => ({
							...state,
							isGenerating: false,
							// Restore prompt if it was cleared
							prompt: currentPrompt
						}));
					};
				}}
			>
				<div class="flex flex-col gap-4">
					{#if showHistory && $sessionStore.activeSession}
						<div class="rounded-md border p-4">
							<HistoryViewer
								history={sessionStoryHistory}
								onRevert={handleRevertToVersion}
								onPreview={handlePreviewVersion}
							/>
						</div>
					{/if}

					{#if form?.error}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{form.error}
						</div>
					{/if}

					{#if $storyStore.stories.length === 0}
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
							placeholder="Enter your story prompt (e.g., 'A detective solving a mystery in a futuristic city'). Press Enter to submit, Shift+Enter for new line."
							class="min-h-32"
							required
							onkeydown={(e) => handleKeydown(e, mainFormElement)}
						/>

						<div class="flex gap-2">
							<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.prompt.trim()}>
								{#if $storyStore.isGenerating}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Generating...
								{:else}
									Generate Story
								{/if}
							</Button>
						</div>
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
							<div class="flex flex-col gap-4 rounded-md border p-4">
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
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										Regenerating...
									{:else}
										Try Again
									{/if}
								</Button>
								<Button onclick={startManualEdit} variant="outline">Edit Story Manually</Button>
								<Button onclick={startPromptEdit} variant="outline">Edit Story with Prompt</Button>
								<Button href="/characters">Send to Character Generation</Button>
							</div>

							{#if $storyStore.isEditingWithPrompt}
								<form
									bind:this={editFormElement}
									method="POST"
									action="?/editStory"
									use:enhance={() => {
										storyStore.update(state => ({ ...state, isGenerating: true }));
										// Capture the edit prompt for the next story BEFORE form submission
										capturedPromptForNextStory = `Edit: ${$storyStore.editPrompt}`;
										return async ({ update }) => {
											await update({ reset: false }); // Don't reset the form
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
										<input type="hidden" name="style" value={$storyStore.selectedStyle} />
										<input type="hidden" name="customStylePrompt" value={$storyStore.customStylePrompt} />
										<Textarea
											bind:value={$storyStore.editPrompt}
											name="editPrompt"
											placeholder="E.g., 'Add more action to scene 2' or 'Make the dialogue more dramatic'. Press Enter to submit, Shift+Enter for new line."
											class="min-h-32"
											onkeydown={(e) => handleKeydown(e, editFormElement)}
										/>
										<div class="flex gap-2">
											<Button type="button" onclick={cancelPromptEdit} variant="outline">Cancel</Button>
											<Button type="submit" disabled={$storyStore.isGenerating || !$storyStore.editPrompt.trim()}>
												{#if $storyStore.isGenerating}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Regenerating...
												{:else}
													Regenerate Story
												{/if}
											</Button>
										</div>
									</div>
								</form>
							{/if}
						{/if}
					{/each}
				</div>
			</form>
		</div>
	</div>
</section>

<!-- Hidden form for Try Again functionality -->
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
