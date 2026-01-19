import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StorageService } from '$lib/server/storage';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const storage = new StorageService();
    const conversation = await storage.loadConversation(params.id);
    return json(conversation);
  } catch (error) {
    console.error('Error loading conversation:', error);
    return json({ error: 'Conversation not found' }, { status: 404 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const storage = new StorageService();
    await storage.deleteConversation(params.id);
    return json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
};
