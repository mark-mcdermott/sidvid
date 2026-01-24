import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { BrowserStorageAdapter } from '$lib/sidvid/storage/browser-adapter';
import type {
	ApiCallType,
	ApiTimingRecord,
	ApiTimingStats,
	ApiTimingData
} from '$lib/sidvid/types';
import { DEFAULT_TIMING_ESTIMATES, MAX_TIMING_RECORDS_PER_TYPE } from '$lib/sidvid/types';

const STORAGE_KEY = 'api-timing-data';

interface ActiveTracker {
	type: ApiCallType;
	startTime: number;
}

interface ApiTimingState {
	data: ApiTimingData | null;
	isLoading: boolean;
	error: string | null;
	activeTrackers: Map<string, ActiveTracker>;
}

const initialState: ApiTimingState = {
	data: null,
	isLoading: false,
	error: null,
	activeTrackers: new Map()
};

function createApiTimingStore() {
	const { subscribe, update, set } = writable<ApiTimingState>(initialState);

	let storage: BrowserStorageAdapter | null = null;

	function initStorage(): BrowserStorageAdapter | null {
		if (!storage && browser) {
			storage = new BrowserStorageAdapter('sidvid-timing');
		}
		return storage;
	}

	function createEmptyData(): ApiTimingData {
		return {
			version: 1,
			records: [],
			stats: {},
			updatedAt: new Date().toISOString()
		};
	}

	function calculateStats(type: ApiCallType, records: ApiTimingRecord[]): ApiTimingStats {
		if (records.length === 0) {
			return {
				type,
				count: 0,
				averageMs: DEFAULT_TIMING_ESTIMATES[type],
				medianMs: DEFAULT_TIMING_ESTIMATES[type],
				minMs: DEFAULT_TIMING_ESTIMATES[type],
				maxMs: DEFAULT_TIMING_ESTIMATES[type]
			};
		}

		const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
		const count = durations.length;

		const averageMs = Math.round(durations.reduce((sum, d) => sum + d, 0) / count);
		const medianMs = durations[Math.floor(count / 2)];
		const minMs = durations[0];
		const maxMs = durations[count - 1];

		return {
			type,
			count,
			averageMs,
			medianMs,
			minMs,
			maxMs
		};
	}

	async function load(): Promise<void> {
		update((s) => ({ ...s, isLoading: true, error: null }));

		try {
			const adapter = initStorage();
			if (!adapter) {
				update((s) => ({ ...s, data: createEmptyData(), isLoading: false }));
				return;
			}

			const data = await adapter.load(STORAGE_KEY);
			update((s) => ({ ...s, data, isLoading: false }));
		} catch {
			// No existing data - initialize empty
			update((s) => ({ ...s, data: createEmptyData(), isLoading: false }));
		}
	}

	async function save(data: ApiTimingData): Promise<void> {
		try {
			const adapter = initStorage();
			if (adapter) {
				await adapter.save(STORAGE_KEY, data);
			}
		} catch (error) {
			console.error('Failed to save timing data:', error);
			update((s) => ({ ...s, error: 'Failed to save timing data' }));
		}
	}

	function startTracking(trackerId: string, type: ApiCallType): void {
		update((s) => {
			const newTrackers = new Map(s.activeTrackers);
			newTrackers.set(trackerId, { type, startTime: Date.now() });
			return { ...s, activeTrackers: newTrackers };
		});
	}

	function completeTracking(trackerId: string, success: boolean): void {
		const state = get({ subscribe });
		const tracker = state.activeTrackers.get(trackerId);

		if (!tracker) {
			console.warn(`No active tracker found for ID: ${trackerId}`);
			return;
		}

		const endTime = Date.now();
		const durationMs = endTime - tracker.startTime;

		const record: ApiTimingRecord = {
			id: crypto.randomUUID(),
			type: tracker.type,
			durationMs,
			startedAt: new Date(tracker.startTime).toISOString(),
			completedAt: new Date(endTime).toISOString(),
			success
		};

		update((s) => {
			const newTrackers = new Map(s.activeTrackers);
			newTrackers.delete(trackerId);

			if (!s.data) return { ...s, activeTrackers: newTrackers };

			// Add new record
			const records = [...s.data.records, record];

			// Trim records per type to MAX_TIMING_RECORDS_PER_TYPE
			const recordsByType = new Map<ApiCallType, ApiTimingRecord[]>();
			for (const r of records) {
				const existing = recordsByType.get(r.type) || [];
				existing.push(r);
				recordsByType.set(r.type, existing);
			}

			const trimmedRecords: ApiTimingRecord[] = [];
			for (const [, typeRecords] of recordsByType) {
				const sorted = typeRecords.sort(
					(a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
				);
				trimmedRecords.push(...sorted.slice(0, MAX_TIMING_RECORDS_PER_TYPE));
			}

			// Recalculate stats for the affected type (only successful calls)
			const newStats = { ...s.data.stats };
			newStats[tracker.type] = calculateStats(
				tracker.type,
				trimmedRecords.filter((r) => r.type === tracker.type && r.success)
			);

			const newData: ApiTimingData = {
				...s.data,
				records: trimmedRecords,
				stats: newStats,
				updatedAt: new Date().toISOString()
			};

			// Persist asynchronously
			save(newData);

			return { ...s, data: newData, activeTrackers: newTrackers };
		});
	}

	function cancelTracking(trackerId: string): void {
		update((s) => {
			const newTrackers = new Map(s.activeTrackers);
			newTrackers.delete(trackerId);
			return { ...s, activeTrackers: newTrackers };
		});
	}

	function getEstimatedDuration(type: ApiCallType): number {
		const state = get({ subscribe });
		const stats = state.data?.stats[type];

		if (stats && stats.count >= 3) {
			// Use median for more stable estimates
			return stats.medianMs;
		}

		return DEFAULT_TIMING_ESTIMATES[type];
	}

	function getStats(type: ApiCallType): ApiTimingStats | null {
		const state = get({ subscribe });
		return state.data?.stats[type] || null;
	}

	async function clear(): Promise<void> {
		try {
			const adapter = initStorage();
			if (adapter) {
				await adapter.delete(STORAGE_KEY);
			}
			update((s) => ({
				...s,
				data: createEmptyData()
			}));
		} catch (error) {
			console.error('Failed to clear timing data:', error);
		}
	}

	return {
		subscribe,
		load,
		startTracking,
		completeTracking,
		cancelTracking,
		getEstimatedDuration,
		getStats,
		clear
	};
}

export const apiTimingStore = createApiTimingStore();
