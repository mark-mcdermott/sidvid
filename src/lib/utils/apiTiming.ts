import { apiTimingStore } from '$lib/stores/apiTimingStore';
import type { ApiCallType } from '$lib/sidvid/types';

/**
 * Creates a timing context for tracking API call duration.
 * Useful for form actions where the async call spans multiple operations.
 *
 * @example
 * ```svelte
 * <form use:enhance={() => {
 *   const timing = createTimingContext('generateStory');
 *   timing.start();
 *
 *   return async ({ result, update }) => {
 *     timing.complete(result.type === 'success');
 *     await update({ reset: false });
 *   };
 * }}>
 * ```
 */
export function createTimingContext(type: ApiCallType) {
	const trackerId = crypto.randomUUID();
	let started = false;

	return {
		trackerId,
		type,

		/**
		 * Start tracking the API call.
		 * Call this when the API call begins.
		 */
		start(): void {
			if (!started) {
				apiTimingStore.startTracking(trackerId, type);
				started = true;
			}
		},

		/**
		 * Complete tracking and record the timing.
		 * Call this when the API call completes (success or failure).
		 */
		complete(success: boolean): void {
			if (started) {
				apiTimingStore.completeTracking(trackerId, success);
				started = false;
			}
		},

		/**
		 * Cancel tracking without recording.
		 * Use this if the form submission was cancelled.
		 */
		cancel(): void {
			if (started) {
				apiTimingStore.cancelTracking(trackerId);
				started = false;
			}
		}
	};
}

/**
 * Wraps an async function to automatically track its duration.
 *
 * @example
 * ```typescript
 * const result = await withTiming('generateStory', async () => {
 *   return await generateStory(prompt);
 * });
 * ```
 */
export async function withTiming<T>(type: ApiCallType, fn: () => Promise<T>): Promise<T> {
	const context = createTimingContext(type);
	context.start();

	try {
		const result = await fn();
		context.complete(true);
		return result;
	} catch (error) {
		context.complete(false);
		throw error;
	}
}
