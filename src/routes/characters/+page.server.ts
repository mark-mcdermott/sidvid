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
		const styleParam = data.get('style');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required' };
		}

		// Map UI style presets to API style values
		const styleMapping: Record<string, 'realistic' | 'anime' | 'cartoon' | 'cinematic'> = {
			'anime': 'anime',
			'photorealistic': 'realistic',
			'3d-animated': 'cartoon',
			'watercolor': 'realistic',
			'comic': 'cartoon',
			'custom': 'realistic',
			'realistic': 'realistic',
			'cartoon': 'cartoon',
			'cinematic': 'cinematic'
		};

		const style = typeof styleParam === 'string' && styleMapping[styleParam]
			? styleMapping[styleParam]
			: 'realistic';

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const character = await sidvid.generateCharacter({
				description,
				style,
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
	},

	improveDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const userPrompt = data.get('userPrompt');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// If user prompt provided, include it in the enhancement request
			const promptSuffix = userPrompt && typeof userPrompt === 'string'
				? `. Additionally: ${userPrompt}`
				: '';

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
				error: error instanceof Error ? error.message : 'Failed to improve character description'
			};
		}
	}
} satisfies Actions;
