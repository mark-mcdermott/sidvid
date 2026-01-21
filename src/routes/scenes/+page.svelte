<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	interface DroppedItem {
		type: 'story' | 'character';
		index: number;
		title?: string;
		scenes?: any[];
		name?: string;
		imageUrl?: string;
	}

	interface Wireframe {
		id: number;
		textDescription: string;
		showTextArea: boolean;
		hasImage: boolean;
		droppedItems: DroppedItem[];
	}

	let wireframes = $state<Wireframe[]>([
		{ id: 0, textDescription: '', showTextArea: false, hasImage: false, droppedItems: [] }
	]);

	let dragOverIndex = $state<number | null>(null);

	function addWireframe() {
		const newId = wireframes.length;
		wireframes = [...wireframes, { id: newId, textDescription: '', showTextArea: false, hasImage: false, droppedItems: [] }];
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, index: number) {
		e.preventDefault();
		dragOverIndex = null;

		const data = e.dataTransfer?.getData('application/json');
		if (!data) return;

		try {
			const item: DroppedItem = JSON.parse(data);
			wireframes = wireframes.map((w, i) => {
				if (i !== index) return w;
				// Avoid duplicates
				const exists = w.droppedItems.some(
					(d) => d.type === item.type && d.index === item.index
				);
				if (exists) return w;
				return { ...w, droppedItems: [...w.droppedItems, item] };
			});
		} catch (err) {
			console.error('Failed to parse dropped data:', err);
		}
	}

	function removeDroppedItem(wireframeIndex: number, itemIndex: number) {
		wireframes = wireframes.map((w, i) => {
			if (i !== wireframeIndex) return w;
			return {
				...w,
				droppedItems: w.droppedItems.filter((_, idx) => idx !== itemIndex)
			};
		});
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

	// Count wireframes with content (text description filled or items dropped)
	let wireframesWithContent = $derived(
		wireframes.filter(w => w.textDescription.trim() !== '' || w.droppedItems.length > 0)
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
					class="wireframe relative flex flex-col items-center justify-center w-64 border border-dashed rounded-lg p-2 transition-colors {dragOverIndex === index ? 'border-primary bg-primary/10 border-solid' : 'border-black'}"
					style="aspect-ratio: 16/9;"
					ondragover={(e) => handleDragOver(e, index)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, index)}
				>
					<!-- Dropped items display -->
					{#if wireframe.droppedItems.length > 0}
						<div class="absolute top-1 left-1 right-1 flex flex-wrap gap-1">
							{#each wireframe.droppedItems as item, itemIndex}
								<div
									class="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded {item.type === 'story' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}"
								>
									{#if item.type === 'character' && item.imageUrl}
										<img src={item.imageUrl} alt={item.name} class="w-4 h-4 rounded-full object-cover" />
									{/if}
									<span class="truncate max-w-16">{item.type === 'story' ? item.title : item.name}</span>
									<button
										type="button"
										class="ml-0.5 hover:text-red-600"
										onclick={() => removeDroppedItem(index, itemIndex)}
									>
										×
									</button>
								</div>
							{/each}
						</div>
					{/if}

					{#if wireframe.showTextArea}
						<textarea
							placeholder="Enter scene description..."
							class="w-full h-16 p-2 text-sm border rounded resize-none mb-2 mt-6"
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
