import { SidVid, SessionManager, MemoryStorageAdapter, initKlingClient } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import type { Actions } from './$types';
import { calculateSceneCount } from '$lib/sidvid/utils/story-helpers';

// Initialize Kling client if API key is available
const KLING_API_KEY = env.KLING_API_KEY;
if (KLING_API_KEY) {
	initKlingClient(KLING_API_KEY);
}

// Create a server-side storage adapter and session manager
function createServerSessionManager() {
	const storage = new MemoryStorageAdapter();
	const config = { openaiApiKey: OPENAI_API_KEY };
	const manager = new SessionManager(config, storage);
	return manager;
}

export const actions = {
	// ========== Story Actions ==========
	generateStory: async ({ request }) => {
		const data = await request.formData();
		const userPrompt = data.get('prompt');
		const length = data.get('length');
		const sessionId = data.get('sessionId');

		if (!userPrompt || typeof userPrompt !== 'string') {
			return { success: false, error: 'Prompt is required', action: 'generateStory' };
		}

		try {
			const manager = createServerSessionManager();
			const videoLength = typeof length === 'string' ? length : '5s';
			const sceneCount = calculateSceneCount(videoLength);

			const sessionName =
				typeof sessionId === 'string' && sessionId ? undefined : 'Story Session';

			let session;
			if (typeof sessionId === 'string' && sessionId) {
				try {
					session = await manager.loadSession(sessionId);
				} catch {
					session = manager.createSession(sessionName);
				}
			} else {
				session = manager.createSession(sessionName);
			}

			const story = await session.generateStory(userPrompt, { scenes: sceneCount });
			await session.save();

			return {
				success: true,
				story,
				sessionId: session.getId(),
				sessionMetadata: session.getMetadata(),
				action: 'generateStory'
			};
		} catch (error) {
			console.error('Error generating story:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate story',
				action: 'generateStory'
			};
		}
	},

	editStory: async ({ request }) => {
		const data = await request.formData();
		const editPrompt = data.get('editPrompt');
		const currentStoryJSON = data.get('currentStory');
		const length = data.get('length');
		const sessionId = data.get('sessionId');

		if (!editPrompt || typeof editPrompt !== 'string') {
			return { success: false, error: 'Edit prompt is required', action: 'editStory' };
		}

		if (!currentStoryJSON || typeof currentStoryJSON !== 'string') {
			return { success: false, error: 'Current story is required', action: 'editStory' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			const currentStory = JSON.parse(currentStoryJSON);

			const story = await sidvid.editStory({
				currentStory,
				editPrompt,
				length: typeof length === 'string' ? length : '5s'
			});

			return {
				success: true,
				story,
				sessionId: typeof sessionId === 'string' ? sessionId : undefined,
				action: 'editStory'
			};
		} catch (error) {
			console.error('Error editing story:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to edit story',
				action: 'editStory'
			};
		}
	},

	// ========== Character Actions ==========
	enhanceDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required', action: 'enhanceDescription' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const enhancedText = await sidvid.enhanceCharacterDescription({
				description
			});

			return {
				success: true,
				enhancedText,
				action: 'enhanceDescription'
			};
		} catch (error) {
			console.error('Error enhancing character description:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to enhance character description',
				action: 'enhanceDescription'
			};
		}
	},

	generateImage: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required', action: 'generateImage' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const character = await sidvid.generateCharacter({
				description,
				style: 'realistic',
				size: '1024x1024',
				quality: 'standard'
			});

			return {
				success: true,
				character,
				action: 'generateImage'
			};
		} catch (error) {
			console.error('Error generating character image:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate character image',
				action: 'generateImage'
			};
		}
	},

	generateCharacterImage: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const characterIndex = data.get('characterIndex');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required', action: 'generateCharacterImage' };
		}

		const index = characterIndex ? parseInt(characterIndex as string, 10) : 0;

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const character = await sidvid.generateCharacter({
				description,
				style: 'realistic',
				size: '1024x1024',
				quality: 'standard'
			});

			return {
				success: true,
				character,
				characterIndex: index,
				action: 'generateCharacterImage'
			};
		} catch (error) {
			console.error('Error generating character image:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate character image',
				characterIndex: index,
				action: 'generateCharacterImage'
			};
		}
	},

	improveDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const userPrompt = data.get('userPrompt');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required', action: 'improveDescription' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const promptSuffix =
				userPrompt && typeof userPrompt === 'string' ? `. Additionally: ${userPrompt}` : '';

			const enhancedText = await sidvid.enhanceCharacterDescription({
				description: description + promptSuffix
			});

			return {
				success: true,
				enhancedText,
				action: userPrompt ? 'regenerate' : 'improve'
			};
		} catch (error) {
			console.error('Error improving character description:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to improve character description',
				action: 'improveDescription'
			};
		}
	},

	// ========== Scene Actions ==========
	generateSlotImage: async ({ request }) => {
		console.log('[generateSlotImage] Starting scene generation...');
		const data = await request.formData();
		const slotId = data.get('slotId');
		const description = data.get('description');
		const characterDescriptions = data.get('characterDescriptions');
		const style = data.get('style') || 'cinematic';

		if (!slotId || typeof slotId !== 'string') {
			return { success: false, error: 'Slot ID is required', action: 'generateSlotImage' };
		}

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Scene description is required', action: 'generateSlotImage' };
		}

		try {
			console.log('[generateSlotImage] Creating SidVid instance');
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			let fullDescription = description;
			if (characterDescriptions && typeof characterDescriptions === 'string' && characterDescriptions.trim()) {
				fullDescription = `${description}. Characters in scene: ${characterDescriptions}`;
			}

			console.log('[generateSlotImage] Calling DALL-E with description:', fullDescription);
			const scene = await sidvid.generateScene({
				description: fullDescription,
				style: style as 'realistic' | 'anime' | 'cartoon' | 'cinematic',
				aspectRatio: '16:9',
				quality: 'standard'
			});

			console.log('[generateSlotImage] Success! Got imageUrl:', scene.imageUrl?.substring(0, 50));
			return {
				success: true,
				slotId,
				imageUrl: scene.imageUrl,
				revisedPrompt: scene.revisedPrompt,
				action: 'generateSlotImage'
			};
		} catch (error) {
			console.error('[generateSlotImage] Error generating scene image:', error);
			return {
				success: false,
				slotId,
				error: error instanceof Error ? error.message : 'Failed to generate scene image',
				action: 'generateSlotImage'
			};
		}
	},

	regenerateSlotImage: async ({ request }) => {
		const data = await request.formData();
		const slotId = data.get('slotId');
		const description = data.get('description');
		const characterDescriptions = data.get('characterDescriptions');
		const style = data.get('style') || 'cinematic';

		if (!slotId || typeof slotId !== 'string') {
			return { success: false, error: 'Slot ID is required', action: 'regenerateSlotImage' };
		}

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Scene description is required', action: 'regenerateSlotImage' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			let fullDescription = description;
			if (characterDescriptions && typeof characterDescriptions === 'string' && characterDescriptions.trim()) {
				fullDescription = `${description}. Characters in scene: ${characterDescriptions}`;
			}

			const scene = await sidvid.generateScene({
				description: fullDescription,
				style: style as 'realistic' | 'anime' | 'cartoon' | 'cinematic',
				aspectRatio: '16:9',
				quality: 'standard'
			});

			return {
				success: true,
				slotId,
				imageUrl: scene.imageUrl,
				revisedPrompt: scene.revisedPrompt,
				action: 'regenerateSlotImage'
			};
		} catch (error) {
			console.error('Error regenerating scene image:', error);
			return {
				success: false,
				slotId,
				error: error instanceof Error ? error.message : 'Failed to regenerate scene image',
				action: 'regenerateSlotImage'
			};
		}
	},

	// ========== Storyboard Actions ==========
	editSlotWithPrompt: async ({ request }) => {
		const data = await request.formData();
		const wireframeId = data.get('wireframeId');
		const originalDescription = data.get('originalDescription');
		const editPrompt = data.get('editPrompt');

		if (!wireframeId || typeof wireframeId !== 'string') {
			return { success: false, error: 'Wireframe ID is required', action: 'editSlotWithPrompt' };
		}

		if (!editPrompt || typeof editPrompt !== 'string' || !editPrompt.trim()) {
			return { success: false, error: 'Edit prompt is required', action: 'editSlotWithPrompt' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const description = originalDescription
				? `${originalDescription}. Modifications: ${editPrompt}`
				: editPrompt;

			const scene = await sidvid.generateScene({
				description,
				style: 'cinematic',
				aspectRatio: '16:9',
				quality: 'standard'
			});

			return {
				success: true,
				wireframeId,
				imageUrl: scene.imageUrl,
				revisedPrompt: scene.revisedPrompt,
				action: 'editSlotWithPrompt'
			};
		} catch (error) {
			console.error('Error editing scene with prompt:', error);
			return {
				success: false,
				wireframeId,
				error: error instanceof Error ? error.message : 'Failed to regenerate scene',
				action: 'editSlotWithPrompt'
			};
		}
	},

	// ========== Video Actions ==========
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

		if (provider === 'kling' && !sceneImageUrl) {
			console.log('[Video Server] Error: Kling provider requires a scene image URL');
			return { success: false, error: 'Kling provider requires a scene image URL', action: 'generateSceneVideo', sceneIndex };
		}

		if (provider === 'kling' && !KLING_API_KEY) {
			console.log('[Video Server] Error: KLING_API_KEY not set');
			return { success: false, error: 'KLING_API_KEY environment variable not set', action: 'generateSceneVideo', sceneIndex };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

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

		if (provider === 'kling' && (!sceneImageUrl || typeof sceneImageUrl !== 'string')) {
			console.log('[Video Server] Error: Kling provider requires a scene image URL');
			return { success: false, error: 'Kling provider requires a scene image URL', action: 'generateVideo' };
		}

		if (provider === 'kling' && !KLING_API_KEY) {
			console.log('[Video Server] Error: KLING_API_KEY not set');
			return { success: false, error: 'KLING_API_KEY environment variable not set', action: 'generateVideo' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

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
