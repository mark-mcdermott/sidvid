<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		SidebarProvider,
		Sidebar,
		SidebarHeader,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupLabel,
		SidebarGroupContent,
		SidebarMenu,
		SidebarMenuItem,
		SidebarMenuButton,
		SidebarInset,
		SidebarTrigger
	} from '$lib/components/ui/sidebar';
	import { conversationStore, loadConversations } from '$lib/stores/conversationStore';
	import { characterStore } from '$lib/stores/characterStore';
	import { storyStore } from '$lib/stores/storyStore';

	let { children } = $props();

	const menuItems = [
		{ title: 'Story', href: '/story' },
		{ title: 'Characters', href: '/characters' },
		{ title: 'Scenes', href: '/scenes' },
		{ title: 'Storyboard', href: '/storyboard' },
		{ title: 'Video', href: '/video' }
	];

	onMount(async () => {
		await loadConversations();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<SidebarProvider>
	<Sidebar>
		<SidebarHeader>
			<div class="flex items-center gap-2 px-4 py-2">
				<a href="/" class="hover:opacity-80 transition-opacity">
					<img src="/logo.png" alt="SidVid" class="h-12" />
				</a>
			</div>
		</SidebarHeader>
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						{#each menuItems as item}
							<SidebarMenuItem>
								<SidebarMenuButton
									href={item.href}
									class={$page.url.pathname === item.href ? 'font-bold' : ''}
								>
									{item.title}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			{#if $page.url.pathname === '/scenes'}
				<!-- Story section for scenes page -->
				{#if $storyStore.stories.length > 0}
					<SidebarGroup data-sidebar-section="story">
						<SidebarGroupLabel>Story</SidebarGroupLabel>
						<SidebarGroupContent>
							<div class="px-2">
								{#each $storyStore.stories as story}
									<div data-story-draggable class="p-2 cursor-move hover:bg-muted rounded">
										<div class="text-sm font-medium">{story.story.title || 'Untitled Story'}</div>
										<div class="text-xs text-muted-foreground">{story.story.scenes.length} scenes</div>
									</div>
								{/each}
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
				{/if}

				<!-- Characters section for scenes page -->
				{#if $characterStore.characters.length > 0}
					<SidebarGroup data-sidebar-section="characters">
						<SidebarGroupLabel>Characters</SidebarGroupLabel>
						<SidebarGroupContent>
							<div class="px-2 flex flex-col gap-2">
								{#each $characterStore.characters as char, index}
									<div
										data-character-thumbnail
										class="flex items-center gap-2 p-2 cursor-move hover:bg-muted rounded"
										draggable="true"
									>
										{#if char.imageUrl}
											<img src={char.imageUrl} alt={char.name} class="w-12 h-12 rounded object-cover" />
										{:else}
											<div class="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs">
												{char.name.charAt(0)}
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="text-sm font-medium truncate">{char.name}</div>
										</div>
									</div>
								{/each}
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
				{/if}
			{/if}

			{#if $page.url.pathname === '/video'}
				<SidebarGroup data-sidebar-section="video">
					<SidebarGroupLabel>Video</SidebarGroupLabel>
					<SidebarGroupContent>
						<div class="px-2">
							<!-- Video thumbnails will be added here -->
						</div>
					</SidebarGroupContent>
				</SidebarGroup>
			{/if}

			<SidebarGroup>
				<SidebarGroupLabel>Conversations</SidebarGroupLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{#each $conversationStore.conversations as conv}
							<SidebarMenuItem>
								<SidebarMenuButton
									href="/conversation/{conv.id}"
									class={$page.url.pathname === `/conversation/${conv.id}` ? 'font-bold' : ''}
									title={conv.title}
								>
									{conv.title}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
		<SidebarFooter>
			<div class="py-4 pr-4">
				<img src="/sid.png" alt="Sid" class="w-full rounded-lg" />
			</div>
		</SidebarFooter>
	</Sidebar>
	<SidebarInset>
		<header class="flex h-12 items-center gap-2 border-b px-4">
			<SidebarTrigger />
		</header>
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</SidebarInset>
</SidebarProvider>
