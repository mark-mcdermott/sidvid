import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';
import OpenAI from 'openai';

export const actions = {
	generateCharacterText: async ({ request }) => {
		const data = await request.formData();
		const description = data.get('description');

		if (!description || typeof description !== 'string') {
			return { success: false, error: 'Character description is required' };
		}

		try {
			const client = new OpenAI({ apiKey: OPENAI_API_KEY });

			const fullPrompt = `Create a character description from the following input, about 4 or 5 times longer. If no name was included, create a suitable/appropriate one. In both description and name, be creative. If you can detect a genre, write as if you were a top writer in that genre.\n\nInput: ${description}`;

			const completion = await client.chat.completions.create({
				model: 'gpt-4o',
				messages: [{ role: 'user', content: fullPrompt }],
				max_tokens: 1000,
				temperature: 0.8
			});

			const characterText = completion.choices[0]?.message?.content;
			if (!characterText) {
				throw new Error('No content returned from ChatGPT');
			}

			return {
				success: true,
				characterText,
				action: 'text'
			};
		} catch (error) {
			console.error('Error generating character text:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate character text'
			};
		}
	},

	generateCharacterImage: async ({ request }) => {
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
			console.error('Error generating character:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate character image'
			};
		}
	}
} satisfies Actions;
