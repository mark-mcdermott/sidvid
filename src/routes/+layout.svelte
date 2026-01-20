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
