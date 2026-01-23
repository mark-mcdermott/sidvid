import { rmdir, mkdir } from 'fs/promises';
import { join } from 'path';

async function globalSetup() {
  // Clean up conversations directory before tests
  const conversationsDir = join(process.cwd(), 'data', 'conversations');
  const imagesDir = join(process.cwd(), 'data', 'images');

  try {
    await rmdir(conversationsDir, { recursive: true });
  } catch (error) {
    // Directory might not exist
  }

  try {
    await rmdir(imagesDir, { recursive: true });
  } catch (error) {
    // Directory might not exist
  }

  // Recreate directories
  await mkdir(conversationsDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });
}

export default globalSetup;
