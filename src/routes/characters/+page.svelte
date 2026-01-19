<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let characterDescription = $state('A brave space captain with short, silver hair');
	let isGenerating = $state(false);
</script>

<div class="flex flex-col gap-4">
	<h1 class="text-3xl font-bold">Character Generation</h1>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{form.error}
		</div>
	{/if}

	<div class="w-full xl:max-w-[32rem]">
		<Textarea
			bind:value={characterDescription}
			name="description"
			placeholder="Enter character description (e.g., 'A brave space captain with short silver hair')"
			class="min-h-32"
			required
		/>
	</div>

	<div class="flex gap-2">
		<form
			method="POST"
			action="?/generateCharacterText"
			use:enhance={() => {
				isGenerating = true;
				return async ({ update }) => {
					await update();
					isGenerating = false;
				};
			}}
		>
			<input type="hidden" name="description" value={characterDescription} />
			<Button type="submit" disabled={isGenerating || !characterDescription.trim()}>
				{isGenerating && form?.action === 'text' ? 'Processing...' : 'Generate Character Text'}
			</Button>
		</form>

		<form
			method="POST"
			action="?/generateCharacterImage"
			use:enhance={() => {
				isGenerating = true;
				return async ({ update }) => {
					await update();
					isGenerating = false;
				};
			}}
		>
			<input type="hidden" name="description" value={characterDescription} />
			<Button type="submit" disabled={isGenerating || !characterDescription.trim()}>
				{isGenerating && form?.action === 'image' ? 'Generating...' : 'Generate Character Image'}
			</Button>
		</form>
	</div>

	{#if form?.success && form?.action === 'text' && form?.characterText}
		<div class="rounded-md border p-4">
			<h2 class="mb-2 font-semibold">Character Description</h2>
			<p class="text-sm">{form.characterText}</p>
		</div>
	{/if}

	{#if form?.success && form?.action === 'image' && form?.character}
		<div class="flex flex-col gap-4 rounded-md border p-4">
			<div>
				<h2 class="mb-2 text-xl font-semibold">Generated Character</h2>
				<p class="mb-4 text-sm text-muted-foreground">{form.character.description}</p>
			</div>
			{#if form.character.imageUrl}
				<img
					src={form.character.imageUrl}
					alt={form.character.description}
					class="rounded-md"
				/>
			{/if}
			{#if form.character.revisedPrompt}
				<details class="text-sm">
					<summary class="cursor-pointer font-medium">View DALL-E revised prompt</summary>
					<p class="mt-2 text-muted-foreground">{form.character.revisedPrompt}</p>
				</details>
			{/if}
		</div>
	{/if}
</div>
