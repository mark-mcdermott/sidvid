import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StorageService } from '$lib/server/storage';

export const GET: RequestHandler = async () => {
  try {
    const storage = new StorageService();
    const conversations = await storage.listConversations();
    return json(conversations);
  } catch (error) {
    console.error('Error listing conversations:', error);
    return json({ error: 'Failed to list conversations' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { message, conversationId, route } = await request.json();

    if (!message) {
      return json({ error: 'Message content is required' }, { status: 400 });
    }

    const storage = new StorageService();
    let conversation;

    if (conversationId) {
      conversation = await storage.loadConversation(conversationId);
    } else {
      // Create with temporary title first so it appears immediately
      conversation = storage.createConversation('New conversation...');

      // Save immediately so it shows up in sidebar
      await storage.saveConversation(conversation);

      // Generate proper title and update
      const title = await storage.generateTitle(message);
      conversation.title = title;
    }

    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
      route
    });

    conversation.updatedAt = Date.now();
    await storage.saveConversation(conversation);

    return json({ conversation });
  } catch (error) {
    console.error('Error creating message:', error);
    return json({ error: 'Failed to create message' }, { status: 500 });
  }
};
