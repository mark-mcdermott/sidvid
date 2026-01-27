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
		SidebarTrigger,
		useSidebar
	} from '$lib/components/ui/sidebar';
	import { conversationStore, loadConversations } from '$lib/stores/conversationStore';
	import { storyStore } from '$lib/stores/storyStore';
	import {
		worldStore,
		getActiveElementImageUrl,
		getElementsByType,
		ELEMENT_TYPE_COLORS
	} from '$lib/stores/worldStore';
	import { sessionStore, refreshSessions } from '$lib/stores/sessionStore';
	import { apiTimingStore } from '$lib/stores/apiTimingStore';
	import { SessionList, SessionDialog } from '$lib/components/sessions';
	import { ChevronDown, ChevronUp, Sun, Moon } from '@lucide/svelte';

	let { children } = $props();

	let showNewSessionDialog = $state(false);
	let showAllConversations = $state(false);

	// Dark mode: default true, sync with localStorage (FOUC prevented in app.html)
	let darkMode = $state(browser ? localStorage.getItem('sidvid-dark-mode') !== 'false' : true);

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (browser) {
			document.documentElement.classList.toggle('dark', darkMode);
			localStorage.setItem('sidvid-dark-mode', String(darkMode));
		}
	}

	// Testing mode: check localStorage to determine if sidebar should start closed
	let testingMode = $state(browser ? localStorage.getItem('sidvid-testing-mode') === 'true' : false);

	// Sidebar open state: closed by default in testing mode
	let sidebarOpen = $state(!testingMode);

	const menuItems = [
		{ title: 'Dashboard', href: '/' },
		{ title: 'Project', href: '/project' },
		{ title: 'Story', href: '/story' },
		{ title: 'World', href: '/world' },
		{ title: 'Storyboard', href: '/storyboard' },
		{ title: 'Video', href: '/video' }
	];

	async function handleNewSession() {
		showNewSessionDialog = true;
	}

	onMount(async () => {
		// Remove sidebar FOUC prevention class now that Svelte has hydrated
		document.documentElement.classList.remove('sidebar-closed-initial');

		await loadConversations();
		await refreshSessions();
		await apiTimingStore.load();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<SidebarProvider bind:open={sidebarOpen}>
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
									class={$page.url.pathname === item.href ? 'font-bold' : ''}
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

			{#if $page.url.pathname === '/' || $page.url.pathname === '/storyboard'}
				<!-- World Elements section for dashboard/storyboard pages -->
				{@const characters = getElementsByType($worldStore.elements, 'character')}
				{@const locations = getElementsByType($worldStore.elements, 'location')}
				{@const objects = getElementsByType($worldStore.elements, 'object')}
				{@const concepts = getElementsByType($worldStore.elements, 'concept')}

				{#if $worldStore.elements.length > 0}
					<SidebarGroup data-sidebar-section="world-elements">
						<SidebarGroupLabel>World Elements</SidebarGroupLabel>
						<SidebarGroupContent>
							<div class="px-2 flex flex-col gap-3">
								{#if characters.length > 0}
									<div>
										<div class="text-xs font-medium text-muted-foreground mb-1">Characters</div>
										<div class="flex flex-wrap gap-1">
											{#each characters as element}
												<div
													data-element-thumbnail
													class="w-8 h-8 rounded cursor-move hover:ring-2 hover:ring-primary"
													style="border: 2px solid {ELEMENT_TYPE_COLORS.character};"
													draggable="true"
													title={element.name}
													ondragstart={(e) => {
														e.dataTransfer?.setData('application/json', JSON.stringify({
															type: 'world-element',
															elementType: 'character',
															id: element.id,
															name: element.name,
															imageUrl: getActiveElementImageUrl(element)
														}));
													}}
												>
													{#if getActiveElementImageUrl(element)}
														<img src={getActiveElementImageUrl(element)} alt={element.name} class="w-full h-full rounded object-cover" />
													{:else}
														<div class="w-full h-full rounded bg-muted flex items-center justify-center text-xs">
															{element.name.charAt(0)}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								{#if locations.length > 0}
									<div>
										<div class="text-xs font-medium text-muted-foreground mb-1">Locations</div>
										<div class="flex flex-wrap gap-1">
											{#each locations as element}
												<div
													data-element-thumbnail
													class="w-8 h-8 rounded cursor-move hover:ring-2 hover:ring-primary"
													style="border: 2px solid {ELEMENT_TYPE_COLORS.location};"
													draggable="true"
													title={element.name}
													ondragstart={(e) => {
														e.dataTransfer?.setData('application/json', JSON.stringify({
															type: 'world-element',
															elementType: 'location',
															id: element.id,
															name: element.name,
															imageUrl: getActiveElementImageUrl(element)
														}));
													}}
												>
													{#if getActiveElementImageUrl(element)}
														<img src={getActiveElementImageUrl(element)} alt={element.name} class="w-full h-full rounded object-cover" />
													{:else}
														<div class="w-full h-full rounded bg-muted flex items-center justify-center text-xs">
															{element.name.charAt(0)}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								{#if objects.length > 0}
									<div>
										<div class="text-xs font-medium text-muted-foreground mb-1">Objects</div>
										<div class="flex flex-wrap gap-1">
											{#each objects as element}
												<div
													data-element-thumbnail
													class="w-8 h-8 rounded cursor-move hover:ring-2 hover:ring-primary"
													style="border: 2px solid {ELEMENT_TYPE_COLORS.object};"
													draggable="true"
													title={element.name}
													ondragstart={(e) => {
														e.dataTransfer?.setData('application/json', JSON.stringify({
															type: 'world-element',
															elementType: 'object',
															id: element.id,
															name: element.name,
															imageUrl: getActiveElementImageUrl(element)
														}));
													}}
												>
													{#if getActiveElementImageUrl(element)}
														<img src={getActiveElementImageUrl(element)} alt={element.name} class="w-full h-full rounded object-cover" />
													{:else}
														<div class="w-full h-full rounded bg-muted flex items-center justify-center text-xs">
															{element.name.charAt(0)}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}

								{#if concepts.length > 0}
									<div>
										<div class="text-xs font-medium text-muted-foreground mb-1">Concepts</div>
										<div class="flex flex-wrap gap-1">
											{#each concepts as element}
												<div
													data-element-thumbnail
													class="w-8 h-8 rounded cursor-move hover:ring-2 hover:ring-primary"
													style="border: 2px solid {ELEMENT_TYPE_COLORS.concept};"
													draggable="true"
													title={element.name}
													ondragstart={(e) => {
														e.dataTransfer?.setData('application/json', JSON.stringify({
															type: 'world-element',
															elementType: 'concept',
															id: element.id,
															name: element.name,
															imageUrl: getActiveElementImageUrl(element)
														}));
													}}
												>
													{#if getActiveElementImageUrl(element)}
														<img src={getActiveElementImageUrl(element)} alt={element.name} class="w-full h-full rounded object-cover" />
													{:else}
														<div class="w-full h-full rounded bg-muted flex items-center justify-center text-xs">
															{element.name.charAt(0)}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}
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
		{@const sidebar = useSidebar()}
		<header class="flex h-12 items-center justify-between border-b px-4">
			<div class="flex items-center">
				<SidebarTrigger />
				{#if !sidebar.open}
					<a href="/" class="hover:opacity-80 transition-opacity">
						<img src={darkMode ? "/logo-white.png" : "/logo.png"} alt="SidVid" class="h-12" />
					</a>
				{/if}
				{#if $sessionStore.activeSession}
					<span class="text-sm text-muted-foreground">
						Session: {$sessionStore.activeSession.getName() || 'Untitled'}
					</span>
				{/if}
			</div>
			<button
				onclick={toggleDarkMode}
				class="flex cursor-pointer items-center rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors"
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
