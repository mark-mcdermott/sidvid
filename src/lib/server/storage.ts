import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { Conversation, ConversationMetadata } from '$lib/types/conversation';

export class StorageService {
  private dataDir: string;
  private conversationsDir: string;
  private imagesDir: string;
  private indexFile: string;

  constructor() {
    this.dataDir = join(process.cwd(), 'data');
    this.conversationsDir = join(this.dataDir, 'conversations');
    this.imagesDir = join(this.dataDir, 'images');
    this.indexFile = join(this.conversationsDir, 'index.json');
  }

  private async ensureDirectories(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }
    if (!existsSync(this.conversationsDir)) {
      await mkdir(this.conversationsDir, { recursive: true });
    }
    if (!existsSync(this.imagesDir)) {
      await mkdir(this.imagesDir, { recursive: true });
    }
  }

  private async readIndex(): Promise<ConversationMetadata[]> {
    await this.ensureDirectories();

    if (!existsSync(this.indexFile)) {
      return [];
    }

    try {
      const data = await readFile(this.indexFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading index file:', error);
      return [];
    }
  }

  private async writeIndex(index: ConversationMetadata[]): Promise<void> {
    await this.ensureDirectories();
    await writeFile(this.indexFile, JSON.stringify(index, null, 2));
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.ensureDirectories();

    const filePath = join(this.conversationsDir, `${conversation.id}.json`);
    await writeFile(filePath, JSON.stringify(conversation, null, 2));

    const index = await this.readIndex();
    const existingIndex = index.findIndex(c => c.id === conversation.id);

    const metadata: ConversationMetadata = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length
    };

    if (existingIndex >= 0) {
      index[existingIndex] = metadata;
    } else {
      index.push(metadata);
    }

    index.sort((a, b) => b.updatedAt - a.updatedAt);
    await this.writeIndex(index);
  }

  async loadConversation(id: string): Promise<Conversation> {
    const filePath = join(this.conversationsDir, `${id}.json`);

    if (!existsSync(filePath)) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }

  async listConversations(): Promise<ConversationMetadata[]> {
    return await this.readIndex();
  }

  async deleteConversation(id: string): Promise<void> {
    const filePath = join(this.conversationsDir, `${id}.json`);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    const imageDir = join(this.imagesDir, id);
    if (existsSync(imageDir)) {
      const files = await readdir(imageDir);
      for (const file of files) {
        await unlink(join(imageDir, file));
      }
      await unlink(imageDir);
    }

    const index = await this.readIndex();
    const filtered = index.filter(c => c.id !== id);
    await this.writeIndex(filtered);
  }

  async saveImage(conversationId: string, buffer: Buffer): Promise<string> {
    await this.ensureDirectories();

    const conversationImageDir = join(this.imagesDir, conversationId);
    if (!existsSync(conversationImageDir)) {
      await mkdir(conversationImageDir, { recursive: true });
    }

    const hash = createHash('sha256').update(buffer).digest('hex').substring(0, 16);
    const filename = `${hash}.png`;
    const filepath = join(conversationImageDir, filename);

    await writeFile(filepath, buffer);

    return `${conversationId}/${filename}`;
  }

  async getImagePath(conversationId: string, imageId: string): Promise<string> {
    return join(this.imagesDir, conversationId, imageId);
  }

  createConversation(title: string): Conversation {
    const now = Date.now();
    return {
      id: randomUUID(),
      title,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
  }

  async generateTitle(firstMessage: string): Promise<string> {
    // Split into words and take first 3-5 words
    const words = firstMessage.trim().split(/\s+/);
    const targetWords = Math.min(words.length, 5);
    const selectedWords = words.slice(0, targetWords);
    const title = selectedWords.join(' ');

    // Add ellipsis if there are more words
    if (words.length > targetWords) {
      return title + '...';
    }

    return title;
  }
}
