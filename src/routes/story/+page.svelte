<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let prompt = $state('sci-fi anime');
	let isGenerating = $state(false);
	let isEditingManually = $state(false);
	let isEditingWithPrompt = $state(false);
	let editedStoryContent = $state('');
	let editPrompt = $state('');
	let storyCardElement: HTMLDivElement | undefined = $state();
	let selectedLength = $state<{ value: string; label: string } | undefined>({
		value: '5s',
		label: '5s'
	});

	function startManualEdit() {
		if (form?.story) {
			editedStoryContent = form.story.rawContent;
			isEditingManually = true;
			// Scroll to the story card
			setTimeout(() => {
				storyCardElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 0);
		}
	}

	function cancelEdit() {
		isEditingManually = false;
		editedStoryContent = '';
	}

	function saveChanges() {
		if (form?.story && editedStoryContent) {
			// Parse the edited JSON content and update the form story
			try {
				const parsed = JSON.parse(editedStoryContent);
				if (form.story) {
					form.story.rawContent = editedStoryContent;
					if (parsed.title) form.story.title = parsed.title;
					if (parsed.scenes) form.story.scenes = parsed.scenes;
				}
				isEditingManually = false;
			} catch (error) {
				alert('Invalid JSON format. Please check your edits.');
			}
		}
	}

	function startPromptEdit() {
		isEditingWithPrompt = true;
		editPrompt = '';
		// Scroll to the story card
		setTimeout(() => {
			storyCardElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 0);
	}

	function cancelPromptEdit() {
		isEditingWithPrompt = false;
		editPrompt = '';
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
		isGenerating = true;
		return async ({ update }) => {
			await update();
			isGenerating = false;
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
				<Select.Root bind:selected={selectedLength}>
					<Select.Trigger class="w-32">
						{selectedLength?.label || 'Select length'}
					</Select.Trigger>
					<Select.Content>
						{#each lengthOptions as option}
							<Select.Item value={option.value} label={option.label}>
								{option.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="length" value={selectedLength?.value || '5s'} />
			</div>

			<Textarea
				bind:value={prompt}
				name="prompt"
				placeholder="Enter your story prompt (e.g., 'A detective solving a mystery in a futuristic city')"
				class="min-h-32"
				required
			/>
		</div>

		<div class="flex gap-2">
			<Button type="submit" disabled={isGenerating || !prompt.trim()}>
				{isGenerating ? 'Generating...' : 'Generate Story'}
			</Button>
		</div>

		{#if form?.success && form?.story}
			<div bind:this={storyCardElement} class="flex flex-col gap-4 rounded-md border p-4">
				{#if isEditingManually}
					<div class="flex flex-col gap-4">
						<h2 class="text-xl font-semibold">Edit Story</h2>
						<Textarea
							bind:value={editedStoryContent}
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
						<h2 class="text-xl font-semibold">{form.story.title}</h2>
					</div>
					<div class="space-y-4">
						{#each form.story.scenes as scene}
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
						<p class="mt-2 whitespace-pre-wrap text-muted-foreground">{form.story.rawContent}</p>
					</details>
				{/if}
			</div>

			{#if !isEditingManually}
				<div class="flex gap-2">
					<Button type="submit" variant="outline">Try Again</Button>
					<Button onclick={startManualEdit} variant="outline">Edit Story Manually</Button>
					<Button onclick={startPromptEdit} variant="outline">Edit Story with Prompt</Button>
					<Button href="/characters">Send to Character Generation</Button>
				</div>

				{#if isEditingWithPrompt}
					<form
						method="POST"
						action="?/editStory"
						use:enhance={() => {
							isGenerating = true;
							return async ({ update }) => {
								await update();
								isGenerating = false;
								isEditingWithPrompt = false;
								editPrompt = '';
							};
						}}
					>
						<div class="flex flex-col gap-4 rounded-md border p-4">
							<h3 class="text-lg font-semibold">Edit Story with Prompt</h3>
							<p class="text-sm text-muted-foreground">
								Describe the changes you want to make to the story
							</p>
							<input type="hidden" name="currentStory" value={form.story.rawContent} />
							<input type="hidden" name="length" value={selectedLength?.value || '5s'} />
							<Textarea
								bind:value={editPrompt}
								name="editPrompt"
								placeholder="E.g., 'Add more action to scene 2' or 'Make the dialogue more dramatic'"
								class="min-h-32"
							/>
							<div class="flex gap-2">
								<Button type="button" onclick={cancelPromptEdit} variant="outline">Cancel</Button>
								<Button type="submit" disabled={isGenerating || !editPrompt.trim()}>
									{isGenerating ? 'Regenerating...' : 'Regenerate Story'}
								</Button>
							</div>
						</div>
					</form>
				{/if}
			{/if}
		{/if}
	</div>
</form>
