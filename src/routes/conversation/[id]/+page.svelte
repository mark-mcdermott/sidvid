<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { conversationStore, loadConversation } from '$lib/stores/conversationStore';

	const conversationId = $derived($page.params.id);

	onMount(async () => {
		if (conversationId) {
			await loadConversation(conversationId);
		}
	});

	$effect(() => {
		if (conversationId) {
			loadConversation(conversationId);
		}
	});
</script>

<div class="conversation-view max-w-4xl mx-auto">
	<h1 class="text-2xl font-bold mb-6">
		{$conversationStore.activeConversation?.title || 'Conversation'}
	</h1>

	{#if $conversationStore.isLoading}
		<div class="flex items-center justify-center p-8">
			<div class="text-muted-foreground">Loading conversation...</div>
		</div>
	{:else if $conversationStore.activeConversation}
		<div class="space-y-6">
			{#each $conversationStore.activeConversation.messages as message}
				<div
					class="message rounded-lg p-4 {message.role === 'user'
						? 'bg-primary/10 ml-8'
						: 'bg-muted mr-8'}"
				>
					<div class="flex items-start gap-3">
						<div class="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
							{message.role}
						</div>
						{#if message.route}
							<div class="text-xs px-2 py-1 bg-background rounded">
								{message.route}
							</div>
						{/if}
					</div>

					<div class="mt-2 whitespace-pre-wrap">{message.content}</div>

					{#if message.images && message.images.length > 0}
						<div class="mt-4 grid grid-cols-2 gap-4">
							{#each message.images as imagePath}
								<img
									src="/data/images/{imagePath}"
									alt="Generated"
									class="rounded-lg border shadow-sm"
								/>
							{/each}
						</div>
					{/if}

					<div class="mt-2 text-xs text-muted-foreground">
						{new Date(message.timestamp).toLocaleString()}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex items-center justify-center p-8">
			<div class="text-muted-foreground">Conversation not found</div>
		</div>
	{/if}
</div>
