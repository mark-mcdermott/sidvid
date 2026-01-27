import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	enhanceDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const elementType = data.get('elementType');
		const elementName = data.get('elementName');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Element description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Use different enhancement based on element type
			const enhancedText = await sidvid.enhanceCharacterDescription({
				description,
				context: elementType && elementName
					? `This is a ${elementType} named "${elementName}".`
					: undefined
			});

			return {
				success: true,
				enhancedText,
				action: 'enhance'
			};
		} catch (error) {
			console.error('Error enhancing element description:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to enhance description'
			};
		}
	},

	generateImage: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const elementType = data.get('elementType');
		const style = data.get('style') || 'realistic';

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Element description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			// Build a prompt based on element type
			let prompt = description;
			if (elementType === 'character') {
				prompt = `Portrait of ${description}`;
			} else if (elementType === 'location') {
				prompt = `A scene depicting ${description}`;
			} else if (elementType === 'object') {
				prompt = `A detailed image of ${description}`;
			} else if (elementType === 'concept') {
				prompt = `An artistic representation of ${description}`;
			}

			const result = await sidvid.generateCharacter({
				description: prompt,
				style: typeof style === 'string' ? style : 'realistic',
				size: '1024x1024',
				quality: 'standard'
			});

			return {
				success: true,
				imageUrl: result.imageUrl,
				revisedPrompt: result.revisedPrompt,
				action: 'image'
			};
		} catch (error) {
			console.error('Error generating element image:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate image'
			};
		}
	},

	improveDescription: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');
		const userPrompt = data.get('userPrompt');
		const elementType = data.get('elementType');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Element description is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });

			const promptSuffix =
				userPrompt && typeof userPrompt === 'string' ? `. Additionally: ${userPrompt}` : '';

			const enhancedText = await sidvid.enhanceCharacterDescription({
				description: description + promptSuffix,
				context: elementType ? `This is a ${elementType}.` : undefined
			});

			return {
				success: true,
				enhancedText,
				action: userPrompt ? 'regenerate' : 'improve'
			};
		} catch (error) {
			console.error('Error improving element description:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to improve description'
			};
		}
	}
} satisfies Actions;
