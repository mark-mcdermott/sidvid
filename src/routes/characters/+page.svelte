<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import { characterStore, loadStoryCharacters, ensureCharacterExpanded } from '$lib/stores/characterStore';
	import { storyStore } from '$lib/stores/storyStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { Loader2 } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let isGenerating = $state(false);
	let isImproving = $state(false);
	let improvingType = $state<'smart' | 'regenerate' | null>(null);
	let activeCharacterIndex = $state(0);
	let lastProcessedEnhancedText = $state<string>('');
	let lastProcessedImageUrl = $state<string>('');
	let characterRefs: { [key: number]: HTMLDivElement } = {};

	// Track which characters have had descriptions enhanced (to show improve buttons)
	let enhancedCharacters = $state<Set<number>>(new Set());
	// Track which characters have the prompt textarea open
	let showPromptTextarea = $state<Set<number>>(new Set());
	// Store user prompts for each character
	let userPrompts = $state<{ [key: number]: string }>({});

	// Load story characters if available
	onMount(() => {
		const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
		if (latestStory?.story.characters && latestStory.story.characters.length > 0) {
			loadStoryCharacters(latestStory.story.characters);
		}
	});

	// Handle form success
	$effect(() => {
		if (form?.success && form?.enhancedText && form.enhancedText !== lastProcessedEnhancedText) {
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

			// Mark character as enhanced to show improve buttons
			enhancedCharacters = new Set([...enhancedCharacters, activeCharacterIndex]);
			// Close prompt textarea if open
			showPromptTextarea = new Set([...showPromptTextarea].filter(i => i !== activeCharacterIndex));

			// Save to conversation
			(async () => {
				try {
					const char = $characterStore.characters[activeCharacterIndex];
					const conversation = await createMessage(
						`Enhance character description: ${char?.description}`,
						'/characters',
						$conversationStore.currentConversationId || undefined
					);
					await addMessageToConversation(conversation.id, {
						role: 'assistant',
						content: form.enhancedText,
						timestamp: Date.now(),
						route: '/characters'
					});
				} catch (error) {
					console.error('Error saving conversation:', error);
				}
			})();
		}

		if (form?.success && form?.character && form.character.imageUrl !== lastProcessedImageUrl) {
			lastProcessedImageUrl = form.character.imageUrl;

			(async () => {
				try {
					// Download image and get local path
					const localPath = await downloadAndReplaceImage(
						form.character.imageUrl,
						$conversationStore.currentConversationId || ''
					);

					// Update character store with local path
					characterStore.update(state => {
						const updatedCharacters = [...state.characters];
						if (activeCharacterIndex < updatedCharacters.length) {
							updatedCharacters[activeCharacterIndex] = {
								...updatedCharacters[activeCharacterIndex],
								imageUrl: `/data/images/${localPath}`,
								revisedPrompt: form.character.revisedPrompt
							};
						}
						return { ...state, characters: updatedCharacters };
					});

					// Save to conversation
					const char = $characterStore.characters[activeCharacterIndex];
					const description = char?.enhancedDescription || char?.description || '';
					const conversation = await createMessage(
						`Generate character image: ${description}`,
						'/characters',
						$conversationStore.currentConversationId || undefined
					);
					await addMessageToConversation(conversation.id, {
						role: 'assistant',
						content: JSON.stringify({
							character: char?.name,
							imageUrl: `/data/images/${localPath}`,
							revisedPrompt: form.character.revisedPrompt
						}, null, 2),
						timestamp: Date.now(),
						route: '/characters',
						images: [localPath]
					});
				} catch (error) {
					console.error('Error processing image:', error);
				}
			})();
		}
	});

	async function addCustomCharacter() {
		if ($characterStore.customDescription.trim()) {
			const customDesc = $characterStore.customDescription;
			characterStore.update(state => ({
				...state,
				characters: [
					...state.characters,
					{
						name: 'Custom Character',
						description: customDesc,
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

	async function handleCharacterClick(index: number) {
		// Check if this character is already expanded
		if ($characterStore.expandedCharacterIndices.has(index)) {
			// If already expanded, just scroll to it
			await tick();
			characterRefs[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			// If not expanded, expand it
			ensureCharacterExpanded(index);
			activeCharacterIndex = index;
			await tick();
			characterRefs[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function getCurrentDescription(index: number) {
		const char = $characterStore.characters[index];
		return char?.enhancedDescription || char?.description || '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			addCustomCharacter();
		}
	}

	function openPromptTextarea(index: number) {
		showPromptTextarea = new Set([...showPromptTextarea, index]);
	}

	function closePromptTextarea(index: number) {
		showPromptTextarea = new Set([...showPromptTextarea].filter(i => i !== index));
		userPrompts[index] = '';
	}

	async function beginSceneGeneration() {
		// Navigate to scenes page with character and story data
		// Data will be available through stores
		await goto('/scenes');
	}
</script>

<div class="flex flex-col gap-4">
	<h1 class="text-3xl font-bold">Character Generation</h1>
	<p class="text-muted-foreground">
		{#if $characterStore.storyCharacters.length > 0}
			Generate character images from your story, or add custom characters
		{:else}
			Create and generate character images
		{/if}
	</p>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{form.error}
		</div>
	{/if}

	<!-- Character Buttons -->
	{#if $characterStore.characters.length > 0}
		<div class="rounded-md border p-4">
			<h2 class="mb-3 text-lg font-semibold">
				{#if $characterStore.storyCharacters.length > 0}
					Characters from Story
				{:else}
					Characters
				{/if}
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each $characterStore.characters as char, index}
					<Button
						variant={$characterStore.expandedCharacterIndices.has(index) ? 'default' : 'outline'}
						size="sm"
						onclick={() => handleCharacterClick(index)}
					>
						{char.name}
					</Button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Add Custom Character -->
	<div class="rounded-md border p-4">
		<h2 class="mb-3 text-lg font-semibold">Add Custom Character</h2>
		<div class="flex gap-2">
			<Textarea
				bind:value={$characterStore.customDescription}
				placeholder="Enter character description (e.g., 'A brave space captain with short silver hair'). Press Enter to add, Shift+Enter for new line."
				class="min-h-24 flex-1"
				onkeydown={handleKeydown}
			/>
			<Button onclick={addCustomCharacter} variant="outline">Add</Button>
		</div>
	</div>

	<!-- Begin Scene Generation Button -->
	{#if $characterStore.characters.length > 0}
		<div class="flex justify-center">
			<Button onclick={beginSceneGeneration} size="lg">
				Begin Scene Generation
			</Button>
		</div>
	{/if}

	<!-- Expanded Characters -->
	{#each $characterStore.characters as char, index}
		{#if $characterStore.expandedCharacterIndices.has(index)}
			<div
				bind:this={characterRefs[index]}
				class="flex flex-col gap-4 rounded-md border p-4"
				data-character-content={index}
			>
				<div>
					<h2 class="mb-2 text-xl font-semibold">{char.name}</h2>
					<p class="text-sm text-muted-foreground">{char.description}</p>
				</div>

				{#if char.enhancedDescription}
					<div class="rounded-md bg-muted/50 p-3">
						<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
							Enhanced Description:
						</p>
						<p class="text-sm">{char.enhancedDescription}</p>
					</div>
				{/if}

				{#if char.imageUrl}
					<div>
						<img src={char.imageUrl} alt={char.name} class="rounded-md" />
					</div>
				{/if}

				{#if char.revisedPrompt}
					<details class="text-sm">
						<summary class="cursor-pointer font-medium">View DALL-E revised prompt</summary>
						<p class="mt-2 text-muted-foreground">{char.revisedPrompt}</p>
					</details>
				{/if}

					<div class="flex flex-col gap-3">
					<div class="flex flex-wrap gap-2">
					{#if !enhancedCharacters.has(index)}
						<!-- Initial Enhance Description button -->
						<form
							method="POST"
							action="?/enhanceDescription"
							use:enhance={() => {
								isGenerating = true;
								activeCharacterIndex = index;
								return async ({ update }) => {
									await update();
									isGenerating = false;
								};
							}}
						>
							<input type="hidden" name="description" value={getCurrentDescription(index)} />
							<Button
								type="submit"
								variant="outline"
								disabled={isGenerating || !char.description}
							>
								{#if isGenerating && activeCharacterIndex === index && form?.action === 'enhance'}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Enhancing...
								{:else}
									Enhance Description
								{/if}
							</Button>
						</form>
					{:else if !showPromptTextarea.has(index)}
						<!-- Smart Improve and Improve With Prompt buttons -->
						<form
							method="POST"
							action="?/improveDescription"
							use:enhance={() => {
								isImproving = true;
								improvingType = 'smart';
								activeCharacterIndex = index;
								return async ({ update }) => {
									await update();
									isImproving = false;
									improvingType = null;
								};
							}}
						>
							<input type="hidden" name="description" value={getCurrentDescription(index)} />
							<Button
								type="submit"
								variant="outline"
								disabled={isImproving || isGenerating}
							>
								{#if isImproving && activeCharacterIndex === index && improvingType === 'smart'}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Improving...
								{:else}
									Smart Improve Description
								{/if}
							</Button>
						</form>
						<Button
							variant="outline"
							onclick={() => openPromptTextarea(index)}
							disabled={isImproving || isGenerating}
						>
							Improve Description With Prompt
						</Button>
					{/if}

					<form
						method="POST"
						action="?/generateImage"
						use:enhance={() => {
							isGenerating = true;
							activeCharacterIndex = index;
							return async ({ update }) => {
								await update();
								isGenerating = false;
							};
						}}
					>
						<input type="hidden" name="description" value={getCurrentDescription(index)} />
						<input type="hidden" name="style" value={$storyStore.selectedStyle} />
						<Button type="submit" disabled={isGenerating || !getCurrentDescription(index)}>
							{#if isGenerating && activeCharacterIndex === index && form?.action === 'image'}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Generating...
							{:else}
								Generate Image
							{/if}
						</Button>
					</form>
				</div>

				{#if showPromptTextarea.has(index)}
					<!-- Prompt textarea for improving description -->
					<div class="flex flex-col gap-2 rounded-md border p-3">
						<Textarea
							bind:value={userPrompts[index]}
							placeholder="Describe how you'd like to change the description..."
							class="min-h-20"
						/>
						<div class="flex gap-2">
							<form
								method="POST"
								action="?/improveDescription"
								use:enhance={() => {
									isImproving = true;
									improvingType = 'regenerate';
									activeCharacterIndex = index;
									return async ({ update }) => {
										await update();
										isImproving = false;
										improvingType = null;
									};
								}}
							>
								<input type="hidden" name="description" value={getCurrentDescription(index)} />
								<input type="hidden" name="userPrompt" value={userPrompts[index] || ''} />
								<Button
									type="submit"
									disabled={isImproving || !userPrompts[index]?.trim()}
								>
									{#if isImproving && activeCharacterIndex === index && improvingType === 'regenerate'}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										Regenerating...
									{:else}
										Regenerate Description
									{/if}
								</Button>
							</form>
							<Button variant="outline" onclick={() => closePromptTextarea(index)}>
								Cancel
							</Button>
						</div>
					</div>
				{/if}
			</div>
			</div>
		{/if}
	{/each}
</div>
