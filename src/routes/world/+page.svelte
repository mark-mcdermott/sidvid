<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { Loader2, Trash2, Plus, X } from '@lucide/svelte';
	import {
		worldStore,
		addElement,
		deleteElement,
		toggleElementExpanded,
		ensureElementExpanded,
		getActiveElementImageUrl,
		getElementsByType,
		setFilterType,
		addElementImage,
		updateElementDescription,
		setActiveElementImage,
		deleteElementImage,
		loadElementsFromStory,
		setElementImageError,
		clearElementImageError,
		ELEMENT_TYPE_LABELS,
		ELEMENT_TYPE_COLORS,
		type ElementType
	} from '$lib/stores/worldStore';
	import { storyStore } from '$lib/stores/storyStore';
	import { conversationStore, createMessage, addMessageToConversation, downloadAndReplaceImage } from '$lib/stores/conversationStore';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let isGenerating = $state(false);
	let isEnhancing = $state(false);
	let activeElementId = $state<string | null>(null);
	let lastProcessedEnhancedText = $state<string>('');
	let lastProcessedImageUrl = $state<string>('');

	// Track which elements have prompt textarea open
	let showPromptTextarea = $state<Set<string>>(new Set());
	let userPrompts = $state<{ [key: string]: string }>({});

	// Custom element forms (multiple can be open at once)
	interface AddElementForm {
		id: string;
		name: string;
		description: string;
		type: ElementType;
	}
	let addElementForms = $state<AddElementForm[]>([]);

	function createAddElementForm(): AddElementForm {
		return {
			id: `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: '',
			description: '',
			type: 'character'
		};
	}

	function addNewElementForm() {
		addElementForms = [...addElementForms, createAddElementForm()];
	}

	function removeElementForm(formId: string) {
		addElementForms = addElementForms.filter(f => f.id !== formId);
	}

	function submitElementForm(formId: string) {
		const form = addElementForms.find(f => f.id === formId);
		if (form && form.name.trim() && form.description.trim()) {
			addElement(form.name.trim(), form.type, form.description.trim());
			removeElementForm(formId);
		}
	}

	function handleElementFormKeydown(e: KeyboardEvent, formId: string) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submitElementForm(formId);
		}
	}

	// Filter tabs
	const filterOptions: Array<{ value: ElementType | 'all'; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'character', label: 'Characters' },
		{ value: 'location', label: 'Locations' },
		{ value: 'object', label: 'Objects' },
		{ value: 'concept', label: 'Concepts' }
	];

	// Type select options
	const typeOptions: Array<{ value: ElementType; label: string }> = [
		{ value: 'character', label: 'Character' },
		{ value: 'location', label: 'Location' },
		{ value: 'object', label: 'Object' },
		{ value: 'concept', label: 'Concept' }
	];

	// Load story elements on mount (only if worldStore is empty, to avoid overriding persisted state)
	onMount(() => {
		// Only populate from story if worldStore is empty (persisted state takes precedence)
		if ($worldStore.elements.length === 0) {
			const latestStory = $storyStore.stories[$storyStore.stories.length - 1];
			if (latestStory?.story.characters && latestStory.story.characters.length > 0) {
				// Convert story characters to world elements format
				const characters = latestStory.story.characters.map((c) => ({
					name: c.name,
					description: c.description
				}));
				loadElementsFromStory(characters);
			}
		}
	});

	// Handle form success for enhance
	$effect(() => {
		if (form?.success && form?.enhancedText && form.enhancedText !== lastProcessedEnhancedText) {
			lastProcessedEnhancedText = form.enhancedText;

			if (activeElementId) {
				updateElementDescription(activeElementId, form.enhancedText, form.enhancedText);

				// Close prompt textarea if open
				showPromptTextarea = new Set([...showPromptTextarea].filter((id) => id !== activeElementId));

				// Save to conversation
				(async () => {
					try {
						const element = $worldStore.elements.find((el) => el.id === activeElementId);
						if (element) {
							const conversation = await createMessage(
								`Enhance ${element.type} description: ${element.description}`,
								'/world',
								$conversationStore.currentConversationId || undefined
							);
							await addMessageToConversation(conversation.id, {
								role: 'assistant',
								content: form.enhancedText,
								timestamp: Date.now(),
								route: '/world'
							});
						}
					} catch (error) {
						console.error('Error saving conversation:', error);
					}
				})();
			}
		}
	});

	// Handle form success for image generation
	$effect(() => {
		if (form?.success && form?.imageUrl && form.imageUrl !== lastProcessedImageUrl) {
			lastProcessedImageUrl = form.imageUrl;

			if (activeElementId) {
				(async () => {
					try {
						// Download image and get local path
						const localPath = await downloadAndReplaceImage(
							form.imageUrl,
							$conversationStore.currentConversationId || ''
						);

						// Add image to element
						addElementImage(activeElementId!, `/data/images/${localPath}`, form.revisedPrompt);

						// Save to conversation
						const element = $worldStore.elements.find((el) => el.id === activeElementId);
						if (element) {
							const conversation = await createMessage(
								`Generate ${element.type} image: ${element.enhancedDescription || element.description}`,
								'/world',
								$conversationStore.currentConversationId || undefined
							);
							await addMessageToConversation(conversation.id, {
								role: 'assistant',
								content: JSON.stringify(
									{
										element: element.name,
										imageUrl: `/data/images/${localPath}`,
										revisedPrompt: form.revisedPrompt
									},
									null,
									2
								),
								timestamp: Date.now(),
								route: '/world',
								images: [localPath]
							});
						}
					} catch (error) {
						console.error('Error processing image:', error);
					}
				})();
			}
		}
	});

	// Track last processed error to avoid re-processing
	let lastProcessedError = $state<string>('');

	// Handle form error for image generation
	$effect(() => {
		if (form?.error && form.error !== lastProcessedError) {
			lastProcessedError = form.error;
			if (activeElementId) {
				setElementImageError(activeElementId, form.error);
			}
		}
	});

	// Retry image generation function
	async function retryImageGeneration(elementId: string) {
		const element = $worldStore.elements.find(el => el.id === elementId);
		if (!element) return;

		// Clear the error
		clearElementImageError(elementId);

		isGenerating = true;
		activeElementId = elementId;

		try {
			// Include element name so the AI knows what to generate
			const baseDescription = element.enhancedDescription || element.description;
			const description = element.name ? `${element.name}: ${baseDescription}` : baseDescription;

			const formData = new FormData();
			formData.append('description', description);
			formData.append('elementType', element.type);
			formData.append('style', $storyStore.selectedStyle);

			const response = await fetch('?/generateImage', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			// Parse SvelteKit devalue format
			let actionData = null;

			if (result.data) {
				try {
					const parsed = JSON.parse(result.data);
					if (Array.isArray(parsed) && parsed.length > 0) {
						const mainObj = parsed[0];
						if (typeof mainObj === 'object' && mainObj !== null) {
							const resolveValue = (val: any): any => {
								if (typeof val === 'number' && parsed[val] !== undefined) {
									const resolved = parsed[val];
									if (typeof resolved === 'object' && resolved !== null) {
										const resolvedObj: any = Array.isArray(resolved) ? [] : {};
										for (const key in resolved) {
											resolvedObj[key] = resolveValue(resolved[key]);
										}
										return resolvedObj;
									}
									return resolved;
								}
								return val;
							};

							actionData = {};
							for (const key in mainObj) {
								actionData[key] = resolveValue(mainObj[key]);
							}
						}
					}
				} catch (e) {
					console.error('Error parsing result.data:', e);
				}
			} else if (result.success !== undefined) {
				actionData = result;
			}

			if (actionData?.success && actionData?.imageUrl) {
				const localPath = await downloadAndReplaceImage(
					actionData.imageUrl,
					$conversationStore.currentConversationId || ''
				);
				addElementImage(elementId, `/data/images/${localPath}`, actionData.revisedPrompt);
			} else if (actionData?.error) {
				setElementImageError(elementId, actionData.error);
			}
		} catch (error) {
			console.error('Error retrying image generation:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
			setElementImageError(elementId, errorMessage);
		} finally {
			isGenerating = false;
			activeElementId = null;
		}
	}

	function handleAddElement() {
		if (customName.trim() && customDescription.trim()) {
			addElement(customName.trim(), customType, customDescription.trim());
			customName = '';
			customDescription = '';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleAddElement();
		}
	}

	function getCurrentDescription(element: typeof $worldStore.elements[0]) {
		const description = element?.enhancedDescription || element?.description || '';
		// Include element name so the AI knows what to generate (e.g., "Cybernetic Capybara: large and muscular...")
		if (element?.name && description) {
			return `${element.name}: ${description}`;
		}
		return description;
	}

	function openPromptTextarea(elementId: string) {
		showPromptTextarea = new Set([...showPromptTextarea, elementId]);
	}

	function closePromptTextarea(elementId: string) {
		showPromptTextarea = new Set([...showPromptTextarea].filter((id) => id !== elementId));
		userPrompts[elementId] = '';
	}

	function handleDeleteElement(elementId: string) {
		if (confirm('Are you sure you want to delete this element?')) {
			deleteElement(elementId);
		}
	}

	// Get filtered elements
	let filteredElements = $derived(
		$worldStore.filterType === 'all'
			? $worldStore.elements
			: $worldStore.elements.filter((el) => el.type === $worldStore.filterType)
	);

	// Get counts by type
	let characterCount = $derived(getElementsByType($worldStore.elements, 'character').length);
	let locationCount = $derived(getElementsByType($worldStore.elements, 'location').length);
	let objectCount = $derived(getElementsByType($worldStore.elements, 'object').length);
	let conceptCount = $derived(getElementsByType($worldStore.elements, 'concept').length);
</script>

<div class="flex flex-col gap-6">
	<section id="world" class="scroll-mt-16">
		<div class="flex flex-col gap-4 sm:grid sm:grid-cols-[320px_1fr] sm:gap-8">
			<!-- Left Column: Section Header -->
			<div>
				<h1 class="text-3xl font-bold mb-3">World</h1>
				<p class="text-muted-foreground">Create characters, locations, etc</p>
			</div>

			<!-- Right Column: Content -->
			<div class="flex flex-col gap-4">
				{#if form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				<!-- Filter Tabs -->
				<div class="flex flex-wrap gap-2">
					{#each filterOptions as option}
						{@const count =
							option.value === 'all'
								? $worldStore.elements.length
								: option.value === 'character'
									? characterCount
									: option.value === 'location'
										? locationCount
										: option.value === 'object'
											? objectCount
											: conceptCount}
						<Button
							variant={$worldStore.filterType === option.value ? 'default' : 'outline'}
							size="sm"
							onclick={() => setFilterType(option.value)}
						>
							{option.label}
							{#if count > 0}
								<span class="ml-1 text-xs">({count})</span>
							{/if}
						</Button>
					{/each}
				</div>

				<!-- Element Cards (show all elements) -->
				{#each filteredElements as element}
						<div
							class="flex flex-col gap-4 rounded-md border p-4"
							style="border-left: 4px solid {ELEMENT_TYPE_COLORS[element.type]};"
							data-element-content={element.id}
						>
							<div class="flex items-start justify-between">
								<div>
									<div class="flex items-center gap-2">
										<h2 class="text-xl font-semibold">{element.name}</h2>
										<span
											class="rounded-full px-2 py-0.5 text-xs text-white"
											style="background-color: {ELEMENT_TYPE_COLORS[element.type]};"
										>
											{ELEMENT_TYPE_LABELS[element.type]}
										</span>
									</div>
									<p class="text-sm text-muted-foreground mt-1">{element.description}</p>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => handleDeleteElement(element.id)}
									class="text-destructive hover:text-destructive"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>

							{#if element.enhancedDescription && element.enhancedDescription !== element.description}
								<div class="rounded-md bg-muted/50 p-3">
									<p class="mb-1 text-xs font-medium uppercase text-muted-foreground">
										Enhanced Description:
									</p>
									<p class="text-sm">{element.enhancedDescription}</p>
								</div>
							{/if}

							<!-- Images -->
							{#if element.images.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each element.images as img}
										<div class="relative">
											<img
												src={img.imageUrl}
												alt={element.name}
												class="w-32 h-32 rounded-md object-cover cursor-pointer {img.isActive ? 'ring-2 ring-primary' : ''}"
												onclick={() => setActiveElementImage(element.id, img.id)}
											/>
											{#if !img.isActive && element.images.length > 1}
												<button
													class="absolute top-1 right-1 rounded-full bg-destructive p-1 text-white hover:bg-destructive/80"
													onclick={() => deleteElementImage(element.id, img.id)}
												>
													<Trash2 class="h-3 w-3" />
												</button>
											{/if}
										</div>
									{/each}
								</div>
							{/if}

							<!-- Image Error Alert -->
							{#if element.imageError}
								<div class="relative flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
									<button
										class="absolute top-2 right-2 text-destructive/70 hover:text-destructive"
										onclick={() => clearElementImageError(element.id)}
									>
										<X class="h-4 w-4" />
									</button>
									<div class="flex-1 pr-6">
										<p class="font-medium text-destructive">Image generation failed</p>
										<p class="text-muted-foreground mt-1">{element.imageError}</p>
										<Button
											variant="outline"
											size="sm"
											class="mt-2"
											onclick={() => retryImageGeneration(element.id)}
											disabled={isGenerating && activeElementId === element.id}
										>
											{#if isGenerating && activeElementId === element.id}
												<Loader2 class="mr-2 h-3 w-3 animate-spin" />
												Retrying...
											{:else}
												Retry
											{/if}
										</Button>
									</div>
								</div>
							{/if}

							<!-- Action Buttons -->
							<div class="flex flex-col gap-3">
								<div class="flex flex-wrap gap-2">
									{#if !element.isEnhanced}
										<!-- Initial Enhance Description button -->
										<form
											method="POST"
											action="?/enhanceDescription"
											use:enhance={() => {
												isEnhancing = true;
												activeElementId = element.id;
												return async ({ update }) => {
													await update();
													isEnhancing = false;
												};
											}}
										>
											<input type="hidden" name="description" value={getCurrentDescription(element)} />
											<input type="hidden" name="elementType" value={element.type} />
											<input type="hidden" name="elementName" value={element.name} />
											<Button
												type="submit"
												variant="outline"
												disabled={isEnhancing || !element.description}
											>
												{#if isEnhancing && activeElementId === element.id}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Enhancing...
												{:else}
													Enhance Description
												{/if}
											</Button>
										</form>
									{:else if !showPromptTextarea.has(element.id)}
										<!-- Smart Improve and Improve With Prompt buttons -->
										<form
											method="POST"
											action="?/improveDescription"
											use:enhance={() => {
												isEnhancing = true;
												activeElementId = element.id;
												return async ({ update }) => {
													await update();
													isEnhancing = false;
												};
											}}
										>
											<input type="hidden" name="description" value={getCurrentDescription(element)} />
											<input type="hidden" name="elementType" value={element.type} />
											<Button
												type="submit"
												variant="outline"
												disabled={isEnhancing || isGenerating}
											>
												{#if isEnhancing && activeElementId === element.id}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
													Improving...
												{:else}
													Re-enhance Description
												{/if}
											</Button>
										</form>
										<Button
											variant="outline"
											onclick={() => openPromptTextarea(element.id)}
											disabled={isEnhancing || isGenerating}
										>
											Enhance With Prompt
										</Button>
									{/if}

									<form
										method="POST"
										action="?/generateImage"
										use:enhance={() => {
											isGenerating = true;
											activeElementId = element.id;
											return async ({ update }) => {
												await update();
												isGenerating = false;
											};
										}}
									>
										<input type="hidden" name="description" value={getCurrentDescription(element)} />
										<input type="hidden" name="elementType" value={element.type} />
										<input type="hidden" name="style" value={$storyStore.selectedStyle} />
										<Button type="submit" disabled={isGenerating || !getCurrentDescription(element)}>
											{#if isGenerating && activeElementId === element.id}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												Generating...
											{:else}
												Generate Image
											{/if}
										</Button>
									</form>
								</div>

								{#if showPromptTextarea.has(element.id)}
									<!-- Prompt textarea for improving description -->
									<div class="flex flex-col gap-2 rounded-md border p-3">
										<Textarea
											bind:value={userPrompts[element.id]}
											placeholder="Describe how you'd like to enhance the description..."
											class="min-h-20"
										/>
										<div class="flex gap-2">
											<form
												method="POST"
												action="?/improveDescription"
												use:enhance={() => {
													isEnhancing = true;
													activeElementId = element.id;
													return async ({ update }) => {
														await update();
														isEnhancing = false;
													};
												}}
											>
												<input type="hidden" name="description" value={getCurrentDescription(element)} />
												<input type="hidden" name="userPrompt" value={userPrompts[element.id] || ''} />
												<input type="hidden" name="elementType" value={element.type} />
												<Button
													type="submit"
													disabled={isEnhancing || !userPrompts[element.id]?.trim()}
												>
													{#if isEnhancing && activeElementId === element.id}
														<Loader2 class="mr-2 h-4 w-4 animate-spin" />
														Enhancing...
													{:else}
														Enhance
													{/if}
												</Button>
											</form>
											<Button variant="outline" onclick={() => closePromptTextarea(element.id)}>
												Cancel
											</Button>
										</div>
									</div>
								{/if}
							</div>
						</div>
				{/each}

				<!-- Add Element Forms (dynamically rendered) -->
				{#each addElementForms as formData}
					<div class="rounded-md border p-4">
						<div class="flex items-center justify-between mb-3">
							<h2 class="text-lg font-semibold">Add Element</h2>
						</div>
						<div class="flex flex-col gap-3">
							<div class="flex gap-2">
								<Input
									bind:value={formData.name}
									placeholder="Element name"
									class="flex-1"
								/>
								<Select.Root type="single" bind:value={formData.type}>
									<Select.Trigger class="w-36">
										{ELEMENT_TYPE_LABELS[formData.type]}
									</Select.Trigger>
									<Select.Content>
										{#each typeOptions as option}
											<Select.Item value={option.value} label={option.label}>
												{option.label}
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Textarea
								bind:value={formData.description}
								placeholder="Describe this element... Press Enter to add, Shift+Enter for new line."
								class="min-h-24"
								onkeydown={(e) => handleElementFormKeydown(e, formData.id)}
							/>
							<div class="flex justify-end gap-2">
								<Button
									variant="outline"
									onclick={() => removeElementForm(formData.id)}
								>
									Cancel
								</Button>
								<Button
									onclick={() => submitElementForm(formData.id)}
									class="bg-green-600 hover:bg-green-700 text-white"
									disabled={!formData.name.trim() || !formData.description.trim()}
								>
									<Plus class="mr-2 h-4 w-4" />
									Add {ELEMENT_TYPE_LABELS[formData.type]}
								</Button>
							</div>
						</div>
					</div>
				{/each}

				<!-- Add Element Button -->
				<Button
					variant="outline"
					onclick={addNewElementForm}
					class="w-fit"
				>
					<Plus class="mr-2 h-4 w-4" />
					Add Element
				</Button>

				<!-- Empty State -->
				{#if $worldStore.elements.length === 0}
					<div class="rounded-md border border-dashed p-8 text-center">
						<p class="text-muted-foreground">
							No world elements yet. Add characters, locations, objects, or concepts to build your story world.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</section>
</div>
