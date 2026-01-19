<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let prompt = $state('sci-fi anime');
	let isGenerating = $state(false);
	let selectedLength = $state<{ value: string; label: string } | undefined>({
		value: '5s',
		label: '5s'
	});

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
			<div class="flex flex-col gap-4 rounded-md border p-4">
				<div>
					<h2 class="text-xl font-semibold">{form.story.title}</h2>
				</div>
				<div class="space-y-4">
					{#each form.story.scenes as scene}
						<div class="rounded-md bg-muted/50 p-3">
							<h3 class="mb-2 font-semibold">Scene {scene.number}</h3>
							<p class="text-sm">{scene.description}</p>
							{#if scene.dialogue}
								<p class="mt-2 text-sm italic text-muted-foreground">"{scene.dialogue}"</p>
							{/if}
						</div>
					{/each}
				</div>
				<details class="text-sm">
					<summary class="cursor-pointer font-medium">View raw content</summary>
					<p class="mt-2 whitespace-pre-wrap text-muted-foreground">{form.story.rawContent}</p>
				</details>
			</div>

			<div class="flex gap-2">
				<Button href="/characters">Send to Character Generation</Button>
			</div>
		{/if}
	</div>
</form>
