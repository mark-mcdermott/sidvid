<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { History, RotateCcw, Eye } from '@lucide/svelte';
  import type { Story } from '$lib/sidvid';

  interface Props {
    history: Story[];
    currentIndex?: number;
    onRevert?: (index: number) => void;
    onPreview?: (index: number) => void;
    class?: string;
  }

  let {
    history = [],
    currentIndex = -1,
    onRevert,
    onPreview,
    class: className
  }: Props = $props();

  function formatDate(timestamp?: number): string {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getVersionLabel(index: number, total: number): string {
    if (index === 0) return 'Original';
    if (index === total - 1) return 'Current';
    return `Version ${index + 1}`;
  }
</script>

<div class="flex flex-col gap-2 {className}">
  <div class="flex items-center gap-2 px-2">
    <History class="h-4 w-4 text-muted-foreground" />
    <span class="text-xs font-medium text-muted-foreground uppercase">Story History</span>
    <span class="text-xs text-muted-foreground">({history.length})</span>
  </div>

  {#if history.length === 0}
    <div class="px-2 py-4 text-center text-sm text-muted-foreground">
      No story history yet. Generate a story to see versions here.
    </div>
  {:else}
    <div class="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
      {#each history as story, index (index)}
        {@const isCurrent = index === currentIndex || (currentIndex === -1 && index === history.length - 1)}

        <div
          class="group flex items-start gap-2 rounded-md px-2 py-2 transition-colors {isCurrent ? 'bg-muted' : 'hover:bg-muted/50'}"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium truncate">
                {story.title || 'Untitled'}
              </span>
              {#if isCurrent}
                <span class="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  Current
                </span>
              {/if}
            </div>
            <div class="text-xs text-muted-foreground">
              {getVersionLabel(index, history.length)}
              {#if story.scenes}
                &middot; {story.scenes.length} scenes
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {#if onPreview}
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() => onPreview(index)}
                title="Preview this version"
              >
                <Eye class="h-3 w-3" />
              </Button>
            {/if}

            {#if onRevert && !isCurrent}
              <Button
                variant="ghost"
                size="icon-sm"
                onclick={() => onRevert(index)}
                title="Revert to this version"
              >
                <RotateCcw class="h-3 w-3" />
              </Button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
