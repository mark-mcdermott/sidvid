<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	interface Wireframe {
		id: number;
		textDescription: string;
		showTextArea: boolean;
		hasImage: boolean;
	}

	let wireframes = $state<Wireframe[]>([
		{ id: 0, textDescription: '', showTextArea: false, hasImage: false }
	]);

	function addWireframe() {
		const newId = wireframes.length;
		wireframes = [...wireframes, { id: newId, textDescription: '', showTextArea: false, hasImage: false }];
	}

	function toggleTextDescription(index: number) {
		wireframes = wireframes.map((w, i) =>
			i === index ? { ...w, showTextArea: true } : w
		);
	}

	function updateTextDescription(index: number, value: string) {
		wireframes = wireframes.map((w, i) =>
			i === index ? { ...w, textDescription: value } : w
		);
	}

	// Count wireframes with content (text description filled)
	let wireframesWithContent = $derived(
		wireframes.filter(w => w.textDescription.trim() !== '')
	);

	let showGenerateButton = $derived(wireframesWithContent.length > 0);
	let generateButtonText = $derived(
		wireframesWithContent.length === 1 ? 'Generate Scene Image' : 'Generate Scene Images'
	);

	// Show send to video button only when images have been generated
	let hasGeneratedImages = $derived(wireframes.some(w => w.hasImage));
</script>

<div class="flex flex-col gap-4">
	<h1 class="text-3xl font-bold">Scene Generation</h1>
	<p class="text-muted-foreground">Drag a story and/or characters into a scene wireframe</p>

	<div class="flex flex-wrap gap-4 items-start" data-wireframes-container>
		{#each wireframes as wireframe, index (wireframe.id)}
			<div>
				<div
					data-scene-wireframe={index}
					class="wireframe relative flex flex-col items-center justify-center w-64 border border-dashed border-black rounded-lg p-2"
					style="aspect-ratio: 16/9;"
				>
					{#if wireframe.showTextArea}
						<textarea
							placeholder="Enter scene description..."
							class="w-full h-16 p-2 text-sm border rounded resize-none mb-2"
							bind:value={wireframe.textDescription}
						></textarea>
					{/if}
					<button
						type="button"
						class="text-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5"
						onclick={() => toggleTextDescription(index)}
					>
						+ Text Description
					</button>
				</div>
			</div>
		{/each}

		<div>
			<button
				type="button"
				data-add-wireframe
				class="wireframe flex items-center justify-center w-64 border border-dashed border-black rounded-lg cursor-pointer hover:bg-muted/50 bg-transparent"
				style="aspect-ratio: 16/9;"
				onclick={addWireframe}
			>
				<span class="text-4xl text-muted-foreground">+</span>
			</button>
		</div>
	</div>

	{#if showGenerateButton}
		<div class="flex gap-2">
			<Button>{generateButtonText}</Button>
		</div>
	{/if}

	{#if hasGeneratedImages}
		<div class="flex gap-2">
			<Button>Send to Video Generation</Button>
		</div>
	{/if}
</div>
