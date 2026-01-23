<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
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
	import { sessionStore, refreshSessions, createNewSession } from '$lib/stores/sessionStore';
	import { SessionList, SessionDialog } from '$lib/components/sessions';
	import { ChevronDown, ChevronUp, Sun, Moon } from '@lucide/svelte';

	let { children } = $props();

	let showNewSessionDialog = $state(false);
	let showAllConversations = $state(false);
	let darkMode = $state(false);

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (browser) {
			document.documentElement.classList.toggle('dark', darkMode);
		}
	}

	// Active section for homepage single-page nav
	let activeSection = $state<string>('story');

	const menuItems = [
		{ title: 'Story', href: '/', section: 'story' },
		{ title: 'Characters', href: '/', section: 'characters' },
		{ title: 'Scenes', href: '/', section: 'scenes' },
		{ title: 'Storyboard', href: '/', section: 'storyboard' },
		{ title: 'Video', href: '/', section: 'video' }
	];

	async function handleNewSession() {
		showNewSessionDialog = true;
	}

	function scrollToSection(section: string) {
		if (!browser) return;

		const element = document.getElementById(section);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			activeSection = section;
		}
	}

	function handleSectionClick(e: Event, section: string) {
		// Only handle section scrolling on homepage
		if ($page.url.pathname === '/') {
			e.preventDefault();
			scrollToSection(section);
		}
	}

	// Set up intersection observer to detect which section is in view
	function setupScrollObserver() {
		if (!browser) return;

		const sections = ['story', 'characters', 'scenes', 'storyboard', 'video'];
		const observerOptions = {
			root: null,
			rootMargin: '-20% 0px -70% 0px',
			threshold: 0
		};

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					activeSection = entry.target.id;
				}
			});
		}, observerOptions);

		sections.forEach((section) => {
			const element = document.getElementById(section);
			if (element) {
				observer.observe(element);
			}
		});

		return () => observer.disconnect();
	}

	onMount(async () => {
		await loadConversations();
		await refreshSessions();

		// Set up scroll observer for homepage
		let cleanup: (() => void) | undefined;
		if ($page.url.pathname === '/') {
			cleanup = setupScrollObserver();
		}

		return () => {
			if (cleanup) cleanup();
		};
	});

	// Re-setup observer when navigating to homepage
	$effect(() => {
		if (browser && $page.url.pathname === '/') {
			setupScrollObserver();
		}
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
					<img src={darkMode ? "/logo-no-ice-white.png" : "/logo-no-ice.png"} alt="SidVid" class="h-[10.125rem]" />
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
									class={($page.url.pathname === '/' && activeSection === item.section) ? 'font-bold' : ''}
									onclick={(e) => handleSectionClick(e, item.section)}
								>
									{item.title}
								</SidebarMenuButton>
							</SidebarMenuItem>
						{/each}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<SidebarGroup data-sidebar-section="sessions">
				<SidebarGroupContent>
					<SessionList onNewSession={handleNewSession} />
				</SidebarGroupContent>
			</SidebarGroup>

			{#if $page.url.pathname === '/' && (activeSection === 'scenes' || activeSection === 'storyboard')}
				<!-- Story section for scenes/storyboard sections -->
				{#if $storyStore.stories.length > 0}
					<SidebarGroup data-sidebar-section="story">
						<SidebarGroupLabel>Story</SidebarGroupLabel>
						<SidebarGroupContent>
							<div class="px-2">
								{#each $storyStore.stories as story, index}
									<div
										data-story-draggable
										class="p-2 cursor-move hover:bg-muted rounded"
										draggable="true"
										ondragstart={(e) => {
											e.dataTransfer?.setData('application/json', JSON.stringify({
												type: 'story',
												index,
												title: story.story.title,
												scenes: story.story.scenes
											}));
										}}
									>
										<div class="text-sm font-medium">{story.story.title || 'Untitled Story'}</div>
										<div class="text-xs text-muted-foreground">{story.story.scenes.length} scenes</div>
									</div>
								{/each}
							</div>
						</SidebarGroupContent>
					</SidebarGroup>
				{/if}

				<!-- Characters section for scenes/storyboard sections -->
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
										ondragstart={(e) => {
											e.dataTransfer?.setData('application/json', JSON.stringify({
												type: 'character',
												index,
												name: char.name,
												imageUrl: char.imageUrl
											}));
										}}
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

			{#if $page.url.pathname === '/' && activeSection === 'video'}
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
						{#each $conversationStore.conversations.slice(0, 2) as conv}
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
						{#if $conversationStore.conversations.length > 2}
							<SidebarMenuItem>
								<div class="flex w-full justify-start px-2 py-1">
									<button
										onclick={() => showAllConversations = !showAllConversations}
										class="flex cursor-pointer items-center gap-2 rounded-full border px-2 py-1 text-sm font-medium transition-colors border-muted-foreground bg-muted text-muted-foreground hover:bg-muted/80"
										title={showAllConversations ? 'Show fewer conversations' : 'Show more conversations'}
									>
										{#if showAllConversations}
											<ChevronDown class="h-4 w-4" />
										{:else}
											<ChevronUp class="h-4 w-4" />
										{/if}
									</button>
								</div>
							</SidebarMenuItem>
							{#if showAllConversations}
								{#each $conversationStore.conversations.slice(2) as conv}
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
							{/if}
						{/if}
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
		<header class="flex h-12 items-center justify-between border-b px-4">
			<div class="flex items-center gap-2">
				<SidebarTrigger />
				{#if $sessionStore.activeSession}
					<span class="text-sm text-muted-foreground">
						Session: {$sessionStore.activeSession.getName() || 'Untitled'}
					</span>
				{/if}
			</div>
			<button
				onclick={toggleDarkMode}
				class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors border-muted-foreground bg-muted text-muted-foreground hover:bg-muted/80"
				title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{#if darkMode}
					<Moon class="h-4 w-4" />
				{:else}
					<Sun class="h-4 w-4" />
				{/if}
			</button>
		</header>
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</SidebarInset>
</SidebarProvider>

<SessionDialog bind:open={showNewSessionDialog} mode="create" />
