import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StorageService } from '$lib/server/storage';

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { message } = await request.json();

    if (!message) {
      return json({ error: 'Message is required' }, { status: 400 });
    }

    const storage = new StorageService();
    const conversation = await storage.loadConversation(params.id);

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    await storage.saveConversation(conversation);

    return json({ conversation });
  } catch (error) {
    console.error('Error adding message:', error);
    return json({ error: 'Failed to add message' }, { status: 500 });
  }
};
