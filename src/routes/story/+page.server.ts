import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	generateStory: async ({ request }) => {
		const data = await request.formData();
		const userPrompt = data.get('prompt');

		if (!userPrompt || typeof userPrompt !== 'string') {
			return { success: false, error: 'Prompt is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			const fullPrompt = `Give me the storyline for this short video: ${userPrompt}`;

			const story = await sidvid.generateStory({
				prompt: fullPrompt,
				scenes: 5
			});

			return { success: true, story };
		} catch (error) {
			console.error('Error generating story:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to generate story'
			};
		}
	}
} satisfies Actions;
