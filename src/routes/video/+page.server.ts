import { SidVid, initKlingClient } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import type { Actions } from './$types';

// Initialize Kling client if API key is available
const KLING_API_KEY = env.KLING_API_KEY;
if (KLING_API_KEY) {
	initKlingClient(KLING_API_KEY);
}

export const actions = {
	// Generate video for a single scene
	generateSceneVideo: async ({ request }) => {
		const data = await request.formData();
		const sceneIndex = parseInt(data.get('sceneIndex') as string, 10);
		const sceneDescription = data.get('sceneDescription') as string;
		const sceneImageUrl = data.get('sceneImageUrl') as string;
		const provider = (data.get('provider') as string) || 'mock';
		const enableSound = data.get('sound') !== 'false';

		console.log('[Video Server] generateSceneVideo called with:', {
			sceneIndex,
			provider,
			enableSound,
			sceneDescription: sceneDescription?.substring(0, 50),
			sceneImageUrl: sceneImageUrl?.substring(0, 50)
		});

		if (isNaN(sceneIndex)) {
			console.log('[Video Server] Error: Scene index is required');
			return { success: false, error: 'Scene index is required', action: 'generateSceneVideo', sceneIndex: 0 };
		}

		if (!sceneDescription || !sceneDescription.trim()) {
			console.log('[Video Server] Error: Scene description is required');
			return { success: false, error: 'Scene description is required', action: 'generateSceneVideo', sceneIndex };
		}

		// Kling requires an image URL
		if (provider === 'kling' && !sceneImageUrl) {
			console.log('[Video Server] Error: Kling provider requires a scene image URL');
			return { success: false, error: 'Kling provider requires a scene image URL', action: 'generateSceneVideo', sceneIndex };
		}

		// Check Kling API key if using Kling provider
		if (provider === 'kling' && !KLING_API_KEY) {
			console.log('[Video Server] Error: KLING_API_KEY not set');
			return { success: false, error: 'KLING_API_KEY environment variable not set', action: 'generateSceneVideo', sceneIndex };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Build prompt for this specific scene
			const prompt = `Create a cinematic video showing: ${sceneDescription}`;

			console.log(`[Video Server] Generating video for scene ${sceneIndex}...`);
			const video = await sidvid.generateVideo({
				prompt,
				imageUrl: sceneImageUrl,
				duration: 5,
				provider: provider as 'mock' | 'kling' | 'sora',
				sound: enableSound,
				size: '1280x720'
			});

			console.log(`[Video Server] Scene ${sceneIndex} video started:`, video);

			return {
				success: true,
				videoId: video.id,
				status: video.status,
				progress: video.progress,
				sceneIndex,
				action: 'generateSceneVideo'
			};
		} catch (error) {
			console.error(`[Video Server] Error generating scene ${sceneIndex} video:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate video',
				sceneIndex,
				action: 'generateSceneVideo'
			};
		}
	},

	// Check status of a scene video
	checkSceneVideoStatus: async ({ request }) => {
		const data = await request.formData();
		const sceneIndex = parseInt(data.get('sceneIndex') as string, 10);
		const videoId = data.get('videoId') as string;

		console.log(`[Video Server] checkSceneVideoStatus called for scene ${sceneIndex}, videoId:`, videoId);

		if (isNaN(sceneIndex)) {
			console.log('[Video Server] Error: Scene index is required');
			return { success: false, error: 'Scene index is required', action: 'checkSceneVideoStatus', sceneIndex: 0 };
		}

		if (!videoId) {
			console.log('[Video Server] Error: Video ID is required');
			return { success: false, error: 'Video ID is required', action: 'checkSceneVideoStatus', sceneIndex };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			const video = await sidvid.getVideoStatus(videoId);

			console.log(`[Video Server] Scene ${sceneIndex} status:`, video);

			return {
				success: true,
				videoId: video.id,
				status: video.status,
				progress: video.progress,
				videoUrl: video.url,
				sceneIndex,
				action: 'checkSceneVideoStatus'
			};
		} catch (error) {
			console.error(`[Video Server] Error checking scene ${sceneIndex} status:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to check video status',
				sceneIndex,
				action: 'checkSceneVideoStatus'
			};
		}
	},

	// Legacy single video generation (kept for backwards compatibility)
	generateVideo: async ({ request }) => {
		const data = await request.formData();
		const sceneDescriptions = data.get('sceneDescriptions');
		const sceneImageUrl = data.get('sceneImageUrl');
		const provider = (data.get('provider') as string) || 'mock';
		const enableSound = data.get('sound') !== 'false';

		console.log('[Video Server] generateVideo called with:', {
			provider,
			enableSound,
			sceneDescriptions: sceneDescriptions?.toString().substring(0, 100),
			sceneImageUrl: sceneImageUrl?.toString().substring(0, 100)
		});

		if (!sceneDescriptions || typeof sceneDescriptions !== 'string' || !sceneDescriptions.trim()) {
			console.log('[Video Server] Error: Scene descriptions are required');
			return { success: false, error: 'Scene descriptions are required', action: 'generateVideo' };
		}

		// Kling requires an image URL
		if (provider === 'kling' && (!sceneImageUrl || typeof sceneImageUrl !== 'string')) {
			console.log('[Video Server] Error: Kling provider requires a scene image URL');
			return { success: false, error: 'Kling provider requires a scene image URL', action: 'generateVideo' };
		}

		// Check Kling API key if using Kling provider
		if (provider === 'kling' && !KLING_API_KEY) {
			console.log('[Video Server] Error: KLING_API_KEY not set');
			return { success: false, error: 'KLING_API_KEY environment variable not set', action: 'generateVideo' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Build prompt from scene descriptions
			const prompt = `Create a cinematic video showing: ${sceneDescriptions}`;

			console.log('[Video Server] Calling sidvid.generateVideo...');
			const video = await sidvid.generateVideo({
				prompt,
				imageUrl: sceneImageUrl as string | undefined,
				duration: 5,
				provider: provider as 'mock' | 'kling' | 'sora',
				sound: enableSound,
				size: '1280x720'
			});

			console.log('[Video Server] generateVideo result:', video);

			return {
				success: true,
				videoId: video.id,
				status: video.status,
				progress: video.progress,
				action: 'generateVideo'
			};
		} catch (error) {
			console.error('[Video Server] Error generating video:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate video',
				action: 'generateVideo'
			};
		}
	},

	checkVideoStatus: async ({ request }) => {
		const data = await request.formData();
		const videoId = data.get('videoId');

		console.log('[Video Server] checkVideoStatus called with videoId:', videoId);

		if (!videoId || typeof videoId !== 'string') {
			console.log('[Video Server] Error: Video ID is required');
			return { success: false, error: 'Video ID is required', action: 'checkVideoStatus' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			console.log('[Video Server] Calling sidvid.getVideoStatus...');
			const video = await sidvid.getVideoStatus(videoId);

			console.log('[Video Server] getVideoStatus result:', video);

			return {
				success: true,
				videoId: video.id,
				status: video.status,
				progress: video.progress,
				videoUrl: video.url,
				action: 'checkVideoStatus'
			};
		} catch (error) {
			console.error('[Video Server] Error checking video status:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to check video status',
				action: 'checkVideoStatus'
			};
		}
	}
} satisfies Actions;
