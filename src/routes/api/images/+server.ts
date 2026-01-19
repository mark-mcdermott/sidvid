import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { StorageService } from '$lib/server/storage';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { url, conversationId } = await request.json();

    if (!url || !conversationId) {
      return json(
        { error: 'URL and conversationId are required' },
        { status: 400 }
      );
    }

    const storage = new StorageService();

    // Download image from OpenAI Azure URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Save to disk and return local path
    const localPath = await storage.saveImage(conversationId, buffer);

    return json({ localPath });
  } catch (error) {
    console.error('Error downloading image:', error);
    return json({ error: 'Failed to download image' }, { status: 500 });
  }
};
