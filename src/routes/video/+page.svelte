<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';

	let isGenerating = $state(false);

	onMount(() => {
		// Check if video generation is in progress
		const generating = sessionStorage.getItem('videoGenerating');
		if (generating === 'true') {
			isGenerating = true;
		}
	});
</script>

<div class="flex flex-col gap-4">
	<h1 class="text-3xl font-bold">Video Generation</h1>
	<p class="text-muted-foreground">Generate your final video using Sora</p>

	{#if isGenerating}
		<div
			data-video-placeholder
			class="relative flex items-center justify-center bg-muted rounded-lg"
			style="width: 800px; height: 450px;"
		>
			<div data-spinner class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
		</div>
	{:else}
		<div class="flex gap-2">
			<Button>Generate Video</Button>
		</div>
	{/if}
</div>
