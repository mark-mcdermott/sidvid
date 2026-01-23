<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { sessionStore } from '$lib/stores/sessionStore';
	import { storyboardStore } from '$lib/stores/storyboardStore';
	import { Loader2, Play, Pause, RotateCcw, Volume2, VolumeX, Check } from '@lucide/svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Multi-scene video generation state
	interface SceneVideo {
		sceneIndex: number;
		sceneId: string;
		sceneName: string;
		sceneImageUrl: string;
		videoId: string | null;
		videoUrl: string | null;
		status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
		progress: number;
		error: string | null;
		retryCount: number;
	}

	const MAX_RETRIES = 3;
	const RETRY_DELAY_MS = 10000; // 10 seconds between retries

	let sceneVideos = $state<SceneVideo[]>([]);
	let currentGeneratingIndex = $state<number>(-1);
	let isGenerating = $state(false);
	let overallProgress = $state(0);
	let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Video provider options
	let selectedProvider = $state<'mock' | 'kling'>('kling');
	let enableSound = $state(true);

	// Video player state
	let videoElement = $state<HTMLVideoElement | null>(null);
	let currentPlayingIndex = $state(0);
	let isPlaying = $state(false);

	// Mock scene data for quick testing - use placeholder images
	const mockScenes = [
		{
			id: 'mock-1',
			imageUrl: 'https://picsum.photos/seed/capybara1/1280/720',
			name: 'Cybernetic capybaras in neon-lit server room'
		},
		{
			id: 'mock-2',
			imageUrl: 'https://picsum.photos/seed/capybara2/1280/720',
			name: 'Capybaras hacking mainframe terminal'
		}
	];

	// Scene thumbnails from storyboard (with fallback to mock data for testing)
	let sceneThumbnails = $derived(
		$storyboardStore.wireframes.filter(wf => wf.scene !== null).length > 0
			? $storyboardStore.wireframes
					.filter(wf => wf.scene !== null)
					.map(wf => ({
						id: wf.id,
						imageUrl: wf.scene!.imageUrl,
						name: wf.scene!.name
					}))
			: mockScenes
	);

	// Poll interval for checking video status
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	// Initialize scene videos when thumbnails change
	$effect(() => {
		if (sceneThumbnails.length > 0 && sceneVideos.length === 0) {
			sceneVideos = sceneThumbnails.map((thumb, index) => ({
				sceneIndex: index,
				sceneId: thumb.id,
				sceneName: thumb.name,
				sceneImageUrl: thumb.imageUrl,
				videoId: null,
				videoUrl: null,
				status: 'pending',
				progress: 0,
				error: null,
				retryCount: 0
			}));
		}
	});

	// Calculate overall progress
	$effect(() => {
		if (sceneVideos.length > 0) {
			const totalProgress = sceneVideos.reduce((sum, sv) => sum + sv.progress, 0);
			overallProgress = Math.round(totalProgress / sceneVideos.length);
		}
	});

	// Check if all videos are completed
	let allCompleted = $derived(
		sceneVideos.length > 0 && sceneVideos.every(sv => sv.status === 'completed')
	);

	// Get current video URL for playback
	let currentVideoUrl = $derived(
		sceneVideos[currentPlayingIndex]?.videoUrl || null
	);

	// Get completed video URLs
	let completedVideos = $derived(
		sceneVideos.filter(sv => sv.status === 'completed')
	);

	onMount(() => {
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
			if (retryTimeoutId) {
				clearTimeout(retryTimeoutId);
			}
		};
	});

	// Handle form action results for multi-scene generation
	$effect(() => {
		console.log('[Video Client] Form effect triggered, form:', form);

		if (form?.action === 'generateSceneVideo') {
			console.log('[Video Client] generateSceneVideo response:', form);
			if (form.success && form.videoId && form.sceneIndex !== undefined) {
				const videoId = form.videoId;
				const sceneIdx = form.sceneIndex;
				console.log(`[Video Client] Scene ${sceneIdx} video started, videoId:`, videoId);
				// Update the scene video state
				sceneVideos = sceneVideos.map((sv, idx) =>
					idx === sceneIdx
						? { ...sv, videoId: videoId, status: 'queued' as const, progress: 0 }
						: sv
				);
				console.log('[Video Client] Updated sceneVideos:', sceneVideos.map(sv => ({ idx: sv.sceneIndex, videoId: sv.videoId, status: sv.status })));
				// Start polling after a short delay to ensure form is rendered
				setTimeout(() => {
					console.log('[Video Client] Starting polling...');
					startPolling();
				}, 100);
			} else if (!form.success && form.sceneIndex !== undefined) {
				const failedIndex = form.sceneIndex;
				const currentScene = sceneVideos[failedIndex];
				const isRateLimited = form.error?.includes('frequency') || form.error?.includes('rate');

				console.log(`[Video Client] Scene ${failedIndex} video generation failed:`, form.error);
				console.log(`[Video Client] Retry count: ${currentScene?.retryCount || 0}, isRateLimited: ${isRateLimited}`);

				if (isRateLimited && currentScene && currentScene.retryCount < MAX_RETRIES) {
					// Rate limited - wait and retry
					const retryCount = currentScene.retryCount + 1;
					const delayMs = RETRY_DELAY_MS * retryCount; // Exponential backoff
					console.log(`[Video Client] Rate limited, retrying in ${delayMs}ms (attempt ${retryCount}/${MAX_RETRIES})`);

					sceneVideos = sceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, retryCount, error: `Rate limited, retrying in ${delayMs/1000}s...` }
							: sv
					);

					retryTimeoutId = setTimeout(() => {
						console.log(`[Video Client] Retrying scene ${failedIndex}`);
						const retryForm = document.getElementById(`generate-form-${failedIndex}`) as HTMLFormElement;
						if (retryForm) {
							retryForm.requestSubmit();
						}
					}, delayMs);
				} else {
					// Max retries exceeded or non-rate-limit error - mark as failed and move on
					sceneVideos = sceneVideos.map((sv, idx) =>
						idx === failedIndex
							? { ...sv, status: 'failed' as const, error: form.error || 'Failed to start' }
							: sv
					);
					// Try next scene
					generateNextScene();
				}
			}
		} else if (form?.action === 'checkSceneVideoStatus') {
			console.log('[Video Client] checkSceneVideoStatus response:', form);
			if (form.success && form.sceneIndex !== undefined) {
				const sceneIndex = form.sceneIndex;
				const newStatus = form.status === 'completed' ? 'completed' :
					form.status === 'failed' ? 'failed' :
					form.status === 'in_progress' ? 'generating' : 'queued';

				sceneVideos = sceneVideos.map((sv, idx) =>
					idx === sceneIndex
						? {
								...sv,
								status: newStatus as SceneVideo['status'],
								progress: form.progress || 0,
								videoUrl: form.videoUrl || sv.videoUrl,
								error: form.status === 'failed' ? (form.error || 'Generation failed') : null
							}
						: sv
				);

				console.log(`[Video Client] Scene ${sceneIndex} status:`, newStatus, 'progress:', form.progress, 'url:', form.videoUrl);

				if (form.status === 'completed' || form.status === 'failed') {
					// This scene is done, generate next with delay to avoid rate limiting
					generateNextScene(5000); // 5 second delay between scenes
				}
			}
		}
	});

	function startPolling() {
		if (pollInterval) {
			console.log('[Video Client] Polling already running');
			return;
		}
		console.log('[Video Client] Starting polling interval');
		pollInterval = setInterval(() => {
			// Find scene that's currently generating
			const generatingScene = sceneVideos.find(sv =>
				sv.videoId && (sv.status === 'queued' || sv.status === 'generating')
			);
			console.log('[Video Client] Poll tick - generating scene:', generatingScene ? { idx: generatingScene.sceneIndex, videoId: generatingScene.videoId, status: generatingScene.status } : null);
			if (generatingScene) {
				const statusForm = document.getElementById(`status-check-form-${generatingScene.sceneIndex}`) as HTMLFormElement;
				console.log('[Video Client] Looking for form:', `status-check-form-${generatingScene.sceneIndex}`, 'found:', !!statusForm);
				if (statusForm) {
					console.log('[Video Client] Submitting status check for scene', generatingScene.sceneIndex);
					statusForm.requestSubmit();
				} else {
					console.log('[Video Client] Form not found! All forms:', Array.from(document.querySelectorAll('form[id^="status-check-form"]')).map(f => f.id));
				}
			} else {
				// No scenes generating, stop polling
				console.log('[Video Client] No generating scenes, stopping poll');
				stopPolling();
			}
		}, 5000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function startGeneratingAllScenes() {
		isGenerating = true;
		currentGeneratingIndex = 0;

		// Clear any pending retry
		if (retryTimeoutId) {
			clearTimeout(retryTimeoutId);
			retryTimeoutId = null;
		}

		// Reset all scenes to pending
		sceneVideos = sceneVideos.map(sv => ({
			...sv,
			videoId: null,
			videoUrl: null,
			status: 'pending' as const,
			progress: 0,
			error: null,
			retryCount: 0
		}));

		// Start first scene
		generateNextScene();
	}

	function generateNextScene(delay: number = 0) {
		// Find next pending scene
		const nextPendingIndex = sceneVideos.findIndex(sv => sv.status === 'pending');

		if (nextPendingIndex === -1) {
			// All scenes processed
			isGenerating = false;
			currentGeneratingIndex = -1;
			stopPolling();
			console.log('[Video Client] All scenes processed');
			return;
		}

		currentGeneratingIndex = nextPendingIndex;
		console.log(`[Video Client] Starting scene ${nextPendingIndex} (delay: ${delay}ms)`);

		const submitForm = () => {
			const form = document.getElementById(`generate-form-${nextPendingIndex}`) as HTMLFormElement;
			if (form) {
				form.requestSubmit();
			}
		};

		// Add delay between scenes to avoid rate limiting
		if (delay > 0) {
			console.log(`[Video Client] Waiting ${delay}ms before starting next scene...`);
			retryTimeoutId = setTimeout(submitForm, delay);
		} else {
			submitForm();
		}
	}

	function handleVideoEnded() {
		// Play next video if available
		if (currentPlayingIndex < completedVideos.length - 1) {
			currentPlayingIndex++;
			// Auto-play next video
			setTimeout(() => {
				videoElement?.play();
			}, 100);
		} else {
			isPlaying = false;
		}
	}

	function handleRegenerate() {
		// Clear any pending retry
		if (retryTimeoutId) {
			clearTimeout(retryTimeoutId);
			retryTimeoutId = null;
		}

		sceneVideos = sceneVideos.map(sv => ({
			...sv,
			videoId: null,
			videoUrl: null,
			status: 'pending' as const,
			progress: 0,
			error: null,
			retryCount: 0
		}));
		currentPlayingIndex = 0;
		isPlaying = false;
	}

	function playFromScene(index: number) {
		currentPlayingIndex = index;
		setTimeout(() => {
			videoElement?.play();
			isPlaying = true;
		}, 100);
	}

	// For testing: load previously generated videos
	function loadTestVideos() {
		sceneVideos = sceneVideos.map((sv, idx) => ({
			...sv,
			videoUrl: idx === 0
				? 'https://tempfile.aiquickdraw.com/h/7606ab4948924b782c10b86a797717ee_1769128334.mp4'
				: 'https://tempfile.aiquickdraw.com/h/0debb33d4be73af035dc263ebe58b06f_1769129630.mp4',
			status: 'completed' as const,
			progress: 100
		}));
		isGenerating = false;
		stopPolling();
	}

	let hasScenes = $derived(sceneThumbnails.length > 0);
	let totalDuration = $derived(sceneVideos.length * 5);
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Video Generation</h1>
			<p class="text-muted-foreground">
				Generate {sceneVideos.length} video clip{sceneVideos.length !== 1 ? 's' : ''} ({totalDuration}s total) using {selectedProvider === 'kling' ? 'Kling AI (with audio)' : 'Mock (for testing)'}
			</p>
		</div>
		{#if allCompleted}
			<Button variant="outline" onclick={handleRegenerate}>
				<RotateCcw class="mr-2 h-4 w-4" />
				Regenerate All
			</Button>
		{/if}
	</div>

	<!-- Provider Selection -->
	{#if !allCompleted && !isGenerating}
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium">Provider:</span>
				<select
					bind:value={selectedProvider}
					class="rounded border px-2 py-1 text-sm"
				>
					<option value="mock">Mock (Testing)</option>
					<option value="kling">Kling AI (Real Video + Audio)</option>
				</select>
			</div>

			{#if selectedProvider === 'kling'}
				<button
					type="button"
					class="flex items-center gap-1 text-sm"
					onclick={() => enableSound = !enableSound}
				>
					{#if enableSound}
						<Volume2 class="h-4 w-4" />
						<span>Audio On</span>
					{:else}
						<VolumeX class="h-4 w-4" />
						<span>Audio Off</span>
					{/if}
				</button>
			{/if}

			<!-- Test button to load previously generated videos -->
			<Button variant="outline" size="sm" onclick={loadTestVideos}>
				Load Test Videos
			</Button>
		</div>
	{/if}

	<!-- Video Container -->
	<div
		data-video-container
		class="relative rounded-lg border border-black overflow-hidden bg-black"
		style="width: 800px; max-width: 100%; aspect-ratio: 16/9;"
	>
		{#if currentVideoUrl}
			<!-- Video Player -->
			<video
				bind:this={videoElement}
				src={currentVideoUrl}
				class="w-full h-full object-contain"
				data-video-player
				onended={handleVideoEnded}
				controls
			>
				<track kind="captions" />
			</video>
		{:else if isGenerating}
			<!-- Generating State -->
			<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
				<Loader2 class="h-12 w-12 animate-spin text-white mb-4" data-spinner />
				<p class="text-white text-sm">
					Generating scene {currentGeneratingIndex + 1} of {sceneVideos.length}
				</p>
				<div class="w-48 h-2 bg-gray-700 rounded-full mt-2">
					<div
						class="h-full bg-primary rounded-full transition-all"
						style="width: {Math.max(5, overallProgress)}%"
					></div>
				</div>
				<p class="text-white/70 text-xs mt-1">
					Overall: {overallProgress}%
				</p>
			</div>
		{:else}
			<!-- Scene Thumbnails Preview -->
			{#if sceneThumbnails.length > 0}
				<div class="absolute inset-0 flex items-center justify-center p-4" data-video-placeholder>
					<div class="flex gap-2 overflow-x-auto">
						{#each sceneThumbnails as thumbnail, index}
							<div
								class="flex-shrink-0 rounded border-2 border-white/50 overflow-hidden"
								data-scene-thumbnail={index}
							>
								<img
									src={thumbnail.imageUrl}
									alt={thumbnail.name}
									class="h-32 w-auto object-cover"
								/>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center" data-video-placeholder>
					<p class="text-white/50">No scenes available. Generate scenes first.</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Scene Video Progress Grid -->
	{#if isGenerating || completedVideos.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			{#each sceneVideos as sceneVideo, index}
				<div
					class="relative rounded border overflow-hidden cursor-pointer transition-all {sceneVideo.status === 'completed' ? 'border-green-500' : sceneVideo.status === 'failed' ? 'border-red-500' : 'border-gray-300'}"
					onclick={() => sceneVideo.videoUrl && playFromScene(index)}
				>
					<img
						src={sceneVideo.sceneImageUrl}
						alt={sceneVideo.sceneName}
						class="w-full aspect-video object-cover"
					/>
					<div class="absolute inset-0 flex items-center justify-center bg-black/50">
						{#if sceneVideo.status === 'completed'}
							<div class="bg-green-500 rounded-full p-1">
								<Check class="h-4 w-4 text-white" />
							</div>
						{:else if sceneVideo.status === 'queued' || sceneVideo.status === 'generating'}
							<Loader2 class="h-6 w-6 animate-spin text-white" />
						{:else if sceneVideo.status === 'failed'}
							<span class="text-red-500 text-xs">Failed</span>
						{:else}
							<span class="text-white/50 text-xs">Pending</span>
						{/if}
					</div>
					<div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center">
						Scene {index + 1} • 5s
						{#if sceneVideo.status === 'generating'}
							({sceneVideo.progress}%)
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Error Display -->
	{#each sceneVideos.filter(sv => sv.error) as errorScene}
		<div class="text-red-500 text-sm">
			Scene {errorScene.sceneIndex + 1}: {errorScene.error}
		</div>
	{/each}

	<!-- Generate Button -->
	{#if !allCompleted}
		<Button
			onclick={startGeneratingAllScenes}
			disabled={isGenerating || !hasScenes}
			data-generate-video
		>
			{#if isGenerating}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" data-spinner />
				Generating {currentGeneratingIndex + 1}/{sceneVideos.length}...
			{:else}
				Generate All Videos ({sceneVideos.length} clips)
			{/if}
		</Button>
	{/if}

	<!-- Hidden forms for each scene -->
	{#each sceneVideos as sceneVideo, index}
		<form
			id="generate-form-{index}"
			method="POST"
			action="?/generateSceneVideo"
			class="hidden"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
		>
			<input type="hidden" name="sceneIndex" value={index} />
			<input type="hidden" name="sceneDescription" value={sceneVideo.sceneName} />
			<input type="hidden" name="sceneImageUrl" value={sceneVideo.sceneImageUrl} />
			<input type="hidden" name="provider" value={selectedProvider} />
			<input type="hidden" name="sound" value={enableSound.toString()} />
		</form>

		{#if sceneVideo.videoId}
			<form
				id="status-check-form-{index}"
				method="POST"
				action="?/checkSceneVideoStatus"
				class="hidden"
				use:enhance
			>
				<input type="hidden" name="sceneIndex" value={index} />
				<input type="hidden" name="videoId" value={sceneVideo.videoId} />
			</form>
		{/if}
	{/each}

	<!-- Scene Info -->
	{#if sceneThumbnails.length > 0 && !isGenerating && !allCompleted}
		<div class="text-sm text-muted-foreground">
			{sceneThumbnails.length} scene{sceneThumbnails.length !== 1 ? 's' : ''} ready • {totalDuration}s total duration
		</div>
	{/if}

	<!-- Kling Info -->
	{#if selectedProvider === 'kling' && !allCompleted && !isGenerating}
		<div class="text-xs text-muted-foreground border rounded p-2 bg-muted/50">
			<strong>Kling AI 2.6:</strong> Generates 5-second video clips with native audio from each scene image.
			Cost: ~$0.35-0.70 per clip ({enableSound ? 'with' : 'without'} audio).
			<strong>Total estimate: ~${(sceneVideos.length * 0.5).toFixed(2)}</strong>
		</div>
	{/if}
</div>
