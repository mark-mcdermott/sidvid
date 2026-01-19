import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';

export const actions = {
	generateStory: async ({ request }) => {
		const data = await request.formData();
		const userPrompt = data.get('prompt');
		const length = data.get('length');

		if (!userPrompt || typeof userPrompt !== 'string') {
			return { success: false, error: 'Prompt is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			const fullPrompt = `Give me the storyline for a ${length || '5s'} video: ${userPrompt}`;

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
	},

	editStory: async ({ request }) => {
		const data = await request.formData();
		const editPrompt = data.get('editPrompt');
		const currentStoryJSON = data.get('currentStory');
		const length = data.get('length');

		if (!editPrompt || typeof editPrompt !== 'string') {
			return { success: false, error: 'Edit prompt is required' };
		}

		if (!currentStoryJSON || typeof currentStoryJSON !== 'string') {
			return { success: false, error: 'Current story is required' };
		}

		try {
			const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
			const currentStory = JSON.parse(currentStoryJSON);

			const story = await sidvid.editStory({
				currentStory,
				editPrompt,
				length: typeof length === 'string' ? length : '5s'
			});

			return { success: true, story };
		} catch (error) {
			console.error('Error editing story:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to edit story'
			};
		}
	}
} satisfies Actions;
