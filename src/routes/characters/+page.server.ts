import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	enhanceDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const enhancedText = await sidvid.enhanceCharacterDescription({
				description
			});

			return {
				success: true,
				enhancedText,
				action: 'enhance'
			};
		} catch (error) {
			console.error('Error enhancing character description:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to enhance character description'
			};
		}
	},

	generateImage: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required' };
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
				action: 'image'
			};
		} catch (error) {
			console.error('Error generating character image:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate character image'
			};
		}
	}
} satisfies Actions;
