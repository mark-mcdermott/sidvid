import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	generateSlotImage: async ({ request }) => {
		console.log('[generateSlotImage] Starting scene generation...');
		const data = await request.formData();
		const slotId = data.get('slotId');
		const description = data.get('description');
		const characterDescriptions = data.get('characterDescriptions');
		const style = data.get('style') || 'cinematic';

		if (!slotId || typeof slotId !== 'string') {
			return { success: false, error: 'Slot ID is required' };
		}

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Scene description is required' };
		}

		try {
			console.log('[generateSlotImage] Creating SidVid instance with API key:', OPENAI_API_KEY ? 'present' : 'missing');
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Combine scene description with character descriptions if provided
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
				action: 'generateSlot'
			};
		} catch (error) {
			console.error('[generateSlotImage] Error generating scene image:', error);
			return {
				success: false,
				slotId,
				error: error instanceof Error ? error.message : 'Failed to generate scene image',
				action: 'generateSlot'
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
			return { success: false, error: 'Slot ID is required' };
		}

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Scene description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Combine scene description with character descriptions if provided
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
				action: 'regenerateSlot'
			};
		} catch (error) {
			console.error('Error regenerating scene image:', error);
			return {
				success: false,
				slotId,
				error: error instanceof Error ? error.message : 'Failed to regenerate scene image',
				action: 'regenerateSlot'
			};
		}
	}
} satisfies Actions;
