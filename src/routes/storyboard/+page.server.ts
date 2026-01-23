import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	editSlotWithPrompt: async ({ request }) => {
		const data = await request.formData();
		const wireframeId = data.get('wireframeId');
		const originalDescription = data.get('originalDescription');
		const editPrompt = data.get('editPrompt');

		if (!wireframeId || typeof wireframeId !== 'string') {
			return { success: false, error: 'Wireframe ID is required' };
		}

		if (!editPrompt || typeof editPrompt !== 'string' || !editPrompt.trim()) {
			return { success: false, error: 'Edit prompt is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Combine original description with edit prompt
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
	}
} satisfies Actions;
