<script lang="ts">
  import { sessionStore, loadExistingSession, deleteExistingSession } from '$lib/stores/sessionStore';
  import { Button } from '$lib/components/ui/button';
  import { Loader2, Trash2, FileText } from '@lucide/svelte';
  import type { SessionMetadata } from '$lib/sidvid';

  interface Props {
    onNewSession?: () => void;
    class?: string;
  }

  let { onNewSession, class: className }: Props = $props();

  let loadingSessionId = $state<string | null>(null);
  let deletingSessionId = $state<string | null>(null);

  async function handleSelectSession(session: SessionMetadata) {
    loadingSessionId = session.id;
    try {
      await loadExistingSession(session.id);
    } finally {
      loadingSessionId = null;
    }
  }

  async function handleDeleteSession(e: Event, sessionId: string) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    deletingSessionId = sessionId;
    try {
      await deleteExistingSession(sessionId);
    } finally {
      deletingSessionId = null;
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="flex flex-col gap-2 {className}">
  <div class="flex items-center justify-between px-2">
    <span class="text-xs font-medium text-muted-foreground uppercase">Sessions</span>
    {#if onNewSession}
      <Button variant="ghost" size="sm" onclick={onNewSession}>
        + New
      </Button>
    {/if}
  </div>

  {#if $sessionStore.isLoading && $sessionStore.sessions.length === 0}
    <div class="flex items-center justify-center py-4">
      <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  {:else if $sessionStore.sessions.length === 0}
    <div class="px-2 py-4 text-center text-sm text-muted-foreground">
      No sessions yet. Create one to get started.
    </div>
  {:else}
    <div class="flex flex-col gap-1">
      {#each $sessionStore.sessions as session (session.id)}
        {@const isActive = $sessionStore.activeSession?.getId() === session.id}
        {@const isLoading = loadingSessionId === session.id}
        {@const isDeleting = deletingSessionId === session.id}

        <div
          role="button"
          tabindex="0"
          class="group flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted cursor-pointer {isActive ? 'bg-muted font-medium' : ''} {isLoading || isDeleting ? 'opacity-50 pointer-events-none' : ''}"
          onclick={() => handleSelectSession(session)}
          onkeydown={(e) => e.key === 'Enter' && handleSelectSession(session)}
        >
          {#if isLoading}
            <Loader2 class="h-4 w-4 animate-spin shrink-0" />
          {:else}
            <FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
          {/if}

          <div class="flex-1 min-w-0">
            <div class="truncate text-sm">
              {session.name || 'Untitled Session'}
            </div>
            <div class="text-xs text-muted-foreground">
              {formatDate(session.updatedAt)}
              {#if session.storyCount && session.storyCount > 0}
                &middot; {session.storyCount} {session.storyCount === 1 ? 'story' : 'stories'}
              {/if}
            </div>
          </div>

          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
            disabled={isDeleting}
            onclick={(e) => handleDeleteSession(e, session.id)}
            title="Delete session"
          >
            {#if isDeleting}
              <Loader2 class="h-3 w-3 animate-spin" />
            {:else}
              <Trash2 class="h-3 w-3 text-destructive" />
            {/if}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if $sessionStore.error}
    <div class="mx-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
      {$sessionStore.error}
    </div>
  {/if}
</div>
