<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import { characterStore, loadStoryCharacters } from '$lib/stores/characterStore';
	import { storyStore } from '$lib/stores/storyStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import { onMount } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let isGenerating = $state(false);
	let activeCharacterIndex = $state(0);
	let lastProcessedEnhancedText = $state<string>('');
	let lastProcessedImageUrl = $state<string>('');

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

	function addCustomCharacter() {
		if ($characterStore.customDescription.trim()) {
			characterStore.update(state => ({
				...state,
				characters: [
					...state.characters,
					{
						name: 'Custom Character',
						description: state.customDescription
					}
				],
				customDescription: ''
			}));
			activeCharacterIndex = $characterStore.characters.length;
		}
	}

	function getCurrentDescription() {
		const char = $characterStore.characters[activeCharacterIndex];
		return char?.enhancedDescription || char?.description || '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			addCustomCharacter();
		}
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

	<!-- Story Characters -->
	{#if $characterStore.storyCharacters.length > 0}
		<div class="rounded-md border p-4">
			<h2 class="mb-3 text-lg font-semibold">Characters from Story</h2>
			<div class="flex flex-wrap gap-2">
				{#each $characterStore.characters as char, index}
					<Button
						variant={activeCharacterIndex === index ? 'default' : 'outline'}
						size="sm"
						onclick={() => (activeCharacterIndex = index)}
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

	<!-- Active Character Actions -->
	{#if $characterStore.characters.length > 0 && activeCharacterIndex < $characterStore.characters.length}
		{@const activeChar = $characterStore.characters[activeCharacterIndex]}

		<div class="flex flex-col gap-4 rounded-md border p-4">
			<div>
				<h2 class="mb-2 text-xl font-semibold">{activeChar.name}</h2>
				<p class="text-sm text-muted-foreground">{activeChar.description}</p>
			</div>

			{#if activeChar.enhancedDescription}
				<div class="rounded-md bg-muted/50 p-3">
					<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
						Enhanced Description:
					</p>
					<p class="text-sm">{activeChar.enhancedDescription}</p>
				</div>
			{/if}

			{#if activeChar.imageUrl}
				<div>
					<img src={activeChar.imageUrl} alt={activeChar.name} class="rounded-md" />
				</div>
			{/if}

			{#if activeChar.revisedPrompt}
				<details class="text-sm">
					<summary class="cursor-pointer font-medium">View DALL-E revised prompt</summary>
					<p class="mt-2 text-muted-foreground">{activeChar.revisedPrompt}</p>
				</details>
			{/if}

			<div class="flex gap-2">
				<form
					method="POST"
					action="?/enhanceDescription"
					use:enhance={() => {
						isGenerating = true;
						return async ({ update }) => {
							await update();
							isGenerating = false;
						};
					}}
				>
					<input type="hidden" name="description" value={getCurrentDescription()} />
					<Button
						type="submit"
						variant="outline"
						disabled={isGenerating || !activeChar.description}
					>
						{#if isGenerating && form?.action === 'enhance'}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Enhancing...
						{:else}
							Enhance Description
						{/if}
					</Button>
				</form>

				<form
					method="POST"
					action="?/generateImage"
					use:enhance={() => {
						isGenerating = true;
						return async ({ update }) => {
							await update();
							isGenerating = false;
						};
					}}
				>
					<input type="hidden" name="description" value={getCurrentDescription()} />
					<Button type="submit" disabled={isGenerating || !getCurrentDescription()}>
						{#if isGenerating && form?.action === 'image'}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Generating...
						{:else}
							Generate Image
						{/if}
					</Button>
				</form>
			</div>
		</div>
	{/if}
</div>
