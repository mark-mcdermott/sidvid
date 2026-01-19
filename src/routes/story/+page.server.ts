import { SidVid } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';
import OpenAI from 'openai';

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
		const currentStory = data.get('currentStory');
		const length = data.get('length');

		if (!editPrompt || typeof editPrompt !== 'string') {
			return { success: false, error: 'Edit prompt is required' };
		}

		if (!currentStory || typeof currentStory !== 'string') {
			return { success: false, error: 'Current story is required' };
		}

		try {
			const client = new OpenAI({ apiKey: OPENAI_API_KEY });

			const fullPrompt = `You are editing a story for a ${length || '5s'} video. Here is the current story in JSON format:

${currentStory}

Please modify the story based on this instruction: ${editPrompt}

Return the updated story in the same JSON format with the following structure:
{
  "title": "Story Title",
  "scenes": [
    {
      "number": 1,
      "description": "Visual description of the scene",
      "dialogue": "Any dialogue in the scene (optional)",
      "action": "What happens in the scene"
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "description": "Physical description of the character as mentioned in the story, no embellishment"
    }
  ],
  "sceneVisuals": [
    {
      "sceneNumber": 1,
      "setting": "Description of the background/setting",
      "charactersPresent": ["Character Name 1", "Character Name 2"],
      "visualDescription": "How the scene looks as a static image, including setting and character positions/appearance"
    }
  ]
}

Keep the same number of scenes and maintain the overall structure.
Update the characters and sceneVisuals arrays to reflect any changes from the edit.
Extract information directly from the story text without adding creative embellishments.
Return only valid JSON.`;

			const completion = await client.chat.completions.create({
				model: 'gpt-4o',
				messages: [{ role: 'user', content: fullPrompt }],
				max_tokens: 2000,
				temperature: 0.8,
				response_format: { type: 'json_object' }
			});

			const content = completion.choices[0]?.message?.content;
			if (!content) {
				throw new Error('No content returned from ChatGPT');
			}

			const parsed = JSON.parse(content);

			return {
				success: true,
				story: {
					title: parsed.title,
					scenes: parsed.scenes,
					rawContent: content,
					characters: parsed.characters,
					sceneVisuals: parsed.sceneVisuals
				}
			};
		} catch (error) {
			console.error('Error editing story:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Failed to edit story'
			};
		}
	}
} satisfies Actions;
