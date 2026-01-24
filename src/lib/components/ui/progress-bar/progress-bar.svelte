<script lang="ts">
	import { onDestroy } from 'svelte';
	import { apiTimingStore } from '$lib/stores/apiTimingStore';
	import type { ApiCallType } from '$lib/sidvid/types';

	interface Props {
		/** The type of API call being tracked */
		type: ApiCallType;
		/** Whether the operation is currently active */
		isActive: boolean;
		/** Optional custom estimated duration in ms (overrides historical data) */
		estimatedDurationMs?: number;
		/** Show time remaining text */
		showTimeRemaining?: boolean;
		/** Additional CSS classes */
		class?: string;
	}

	let {
		type,
		isActive,
		estimatedDurationMs,
		showTimeRemaining = true,
		class: className
	}: Props = $props();

	// State
	let progress = $state(0);
	let elapsedMs = $state(0);
	let startTime = $state<number | null>(null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Get estimated duration from store or use override
	let estimatedDuration = $derived(
		estimatedDurationMs ?? apiTimingStore.getEstimatedDuration(type)
	);

	// Calculate time remaining
	let timeRemainingMs = $derived(Math.max(0, estimatedDuration - elapsedMs));

	// Format time remaining for display as m:ss
	function formatTimeRemaining(ms: number): string {
		if (ms <= 0) return '0:00';

		const totalSeconds = Math.ceil(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	let timeRemainingText = $derived(formatTimeRemaining(timeRemainingMs));

	// Progress update effect
	$effect(() => {
		if (isActive) {
			if (!startTime) {
				startTime = Date.now();
				elapsedMs = 0;
				progress = 0;
			}

			// Start interval to update progress
			if (!intervalId) {
				intervalId = setInterval(() => {
					if (startTime) {
						elapsedMs = Date.now() - startTime;

						// Calculate progress with asymptotic approach to 95%
						// Never shows 100% until actually complete
						const rawProgress = elapsedMs / estimatedDuration;

						if (rawProgress < 0.9) {
							// Linear progress up to 90%
							progress = rawProgress * 90;
						} else {
							// Asymptotic slowdown after 90%
							// Approaches 95% but never reaches it
							const overTime = (rawProgress - 0.9) * 10;
							progress = 90 + 5 * (1 - Math.exp(-overTime));
						}
					}
				}, 100);
			}
		} else {
			// Operation complete
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}

			if (startTime !== null) {
				// Animate to 100% on completion
				progress = 100;

				// Reset after animation
				setTimeout(() => {
					startTime = null;
					elapsedMs = 0;
					progress = 0;
				}, 500);
			}
		}
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	});
</script>

{#if isActive || progress > 0}
	<div class="flex flex-col gap-1 {className || ''}">
		<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full bg-primary transition-all duration-200 ease-out"
				style="width: {Math.min(progress, 100)}%"
				role="progressbar"
				aria-valuenow={Math.round(progress)}
				aria-valuemin={0}
				aria-valuemax={100}
			></div>
		</div>

		{#if showTimeRemaining && isActive}
			<p class="text-xs text-muted-foreground text-right">
				{timeRemainingText}
			</p>
		{/if}
	</div>
{/if}
