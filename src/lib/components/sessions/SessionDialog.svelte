<script lang="ts">
  import { createNewSession, sessionStore } from '$lib/stores/sessionStore';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Sheet from '$lib/components/ui/sheet';
  import { Loader2 } from '@lucide/svelte';

  interface Props {
    open?: boolean;
    mode?: 'create' | 'import';
    onOpenChange?: (open: boolean) => void;
  }

  let { open = $bindable(false), mode = 'create', onOpenChange }: Props = $props();

  let sessionName = $state('');
  let importData = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;
    onOpenChange?.(isOpen);
    if (!isOpen) {
      resetForm();
    }
  }

  function resetForm() {
    sessionName = '';
    importData = '';
    error = null;
  }

  async function handleCreate() {
    if (isSubmitting) return;

    isSubmitting = true;
    error = null;

    try {
      await createNewSession(sessionName || undefined);
      handleOpenChange(false);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create session';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleImport() {
    if (isSubmitting || !importData.trim()) return;

    isSubmitting = true;
    error = null;

    try {
      const manager = $sessionStore.manager;
      await manager.importSession(importData);
      handleOpenChange(false);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to import session';
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && mode === 'create') {
      e.preventDefault();
      handleCreate();
    }
  }
</script>

<Sheet.Root bind:open onOpenChange={handleOpenChange}>
  <Sheet.Content side="right" class="w-[400px] sm:w-[540px]">
    <Sheet.Header>
      <Sheet.Title>
        {mode === 'create' ? 'Create New Session' : 'Import Session'}
      </Sheet.Title>
      <Sheet.Description>
        {#if mode === 'create'}
          Start a new video generation session. You can optionally give it a name.
        {:else}
          Paste exported session JSON data to import a previously saved session.
        {/if}
      </Sheet.Description>
    </Sheet.Header>

    <div class="flex flex-col gap-4 py-4">
      {#if error}
        <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      {/if}

      {#if mode === 'create'}
        <div class="flex flex-col gap-2">
          <label for="session-name" class="text-sm font-medium">
            Session Name (optional)
          </label>
          <Input
            id="session-name"
            bind:value={sessionName}
            placeholder="My Video Project"
            onkeydown={handleKeydown}
          />
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          <label for="import-data" class="text-sm font-medium">
            Session Data (JSON)
          </label>
          <Textarea
            id="import-data"
            bind:value={importData}
            placeholder={`{"id": "...", "name": "...", ...}`}
            class="min-h-[200px] font-mono text-sm"
          />
        </div>
      {/if}
    </div>

    <Sheet.Footer>
      <Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
        Cancel
      </Button>
      {#if mode === 'create'}
        <Button onclick={handleCreate} disabled={isSubmitting}>
          {#if isSubmitting}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          {/if}
          Create Session
        </Button>
      {:else}
        <Button onclick={handleImport} disabled={isSubmitting || !importData.trim()}>
          {#if isSubmitting}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          {/if}
          Import Session
        </Button>
      {/if}
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
