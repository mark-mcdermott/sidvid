import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const imagePath = join(process.cwd(), 'data/images', params.path);

    if (!existsSync(imagePath)) {
      throw error(404, 'Image not found');
    }

    const buffer = await readFile(imagePath);

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    console.error('Error serving image:', err);
    throw error(404, 'Image not found');
  }
};
