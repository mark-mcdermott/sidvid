import { writable } from 'svelte/store';
import type { Conversation, ConversationMetadata, Message } from '$lib/types/conversation';

interface ConversationState {
  currentConversationId: string | null;
  conversations: ConversationMetadata[];
  activeConversation: Conversation | null;
  isLoading: boolean;
}

export const conversationStore = writable<ConversationState>({
  currentConversationId: null,
  conversations: [],
  activeConversation: null,
  isLoading: false
});

export async function loadConversations(): Promise<void> {
  conversationStore.update(s => ({ ...s, isLoading: true }));

  try {
    const response = await fetch('/api/conversations');
    if (!response.ok) throw new Error('Failed to load conversations');

    const conversations = await response.json();
    conversationStore.update(s => ({ ...s, conversations, isLoading: false }));
  } catch (error) {
    console.error('Error loading conversations:', error);
    conversationStore.update(s => ({ ...s, isLoading: false }));
  }
}

export async function loadConversation(id: string): Promise<void> {
  conversationStore.update(s => ({ ...s, isLoading: true }));

  try {
    const response = await fetch(`/api/conversations/${id}`);
    if (!response.ok) throw new Error('Failed to load conversation');

    const conversation = await response.json();
    conversationStore.update(s => ({
      ...s,
      activeConversation: conversation,
      currentConversationId: id,
      isLoading: false
    }));
  } catch (error) {
    console.error('Error loading conversation:', error);
    conversationStore.update(s => ({ ...s, isLoading: false }));
  }
}

export async function createMessage(
  content: string,
  route?: string,
  conversationId?: string
): Promise<Conversation> {
  const response = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: content,
      conversationId,
      route
    })
  });

  if (!response.ok) throw new Error('Failed to create message');

  const { conversation } = await response.json();

  conversationStore.update(s => ({
    ...s,
    currentConversationId: conversation.id,
    activeConversation: conversation
  }));

  await loadConversations();

  return conversation;
}

export async function addMessageToConversation(
  conversationId: string,
  message: Message
): Promise<void> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  if (!response.ok) throw new Error('Failed to add message');

  const { conversation } = await response.json();

  conversationStore.update(s => ({
    ...s,
    activeConversation: conversation
  }));

  await loadConversations();
}

export async function downloadAndReplaceImage(
  url: string,
  conversationId: string
): Promise<string> {
  const response = await fetch('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, conversationId })
  });

  if (!response.ok) throw new Error('Failed to download image');

  const { localPath } = await response.json();
  return localPath;
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) throw new Error('Failed to delete conversation');

  conversationStore.update(s => {
    const filtered = s.conversations.filter(c => c.id !== id);
    return {
      ...s,
      conversations: filtered,
      currentConversationId: s.currentConversationId === id ? null : s.currentConversationId,
      activeConversation: s.activeConversation?.id === id ? null : s.activeConversation
    };
  });
}

export function resetConversationStore(): void {
  conversationStore.set({
    currentConversationId: null,
    conversations: [],
    activeConversation: null,
    isLoading: false
  });
}
