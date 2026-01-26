# Coding Patterns

## Svelte 5 Patterns (UI Only)

### Runes
- Use `$state()` for reactive state declarations
- Use `$derived()` for computed values
- Use `$effect()` for side effects (replaces onMount/afterUpdate)
- Use `$props()` for component props
- Use `$bindable()` for two-way binding props

### Component Structure
- Keep components small and focused
- Co-locate related logic within components
- Extract reusable logic into utility functions or stores
- Use snippets for reusable template fragments

### Reactivity
- Prefer derived state over manual updates
- Use stores for shared state across components
- Keep effects minimal and focused on side effects only

## SvelteKit Patterns (UI Only)

### Data Loading
- Use `+page.server.ts` for server-side data loading
- Use `+page.ts` for universal (client + server) loading
- Return typed data from load functions
- Handle errors with `error()` helper

### Form Handling
- Use SvelteKit form actions for mutations
- Use progressive enhancement (forms work without JS)
- Validate with Zod schemas

### API Routes
- Use `+server.ts` for REST API endpoints
- Return JSON responses with proper status codes

## Headless Library Patterns

### Stateless API (SidVid Class)

**Direct API calls for one-off operations:**
```typescript
import { SidVid } from '$lib/sidvid';

const sidvid = new SidVid({
  openaiApiKey: env.OPENAI_API_KEY,
});

// One-off story generation
const story = await sidvid.generateStory({
  prompt: 'A detective story',
  scenes: 5,
});

// One-off character image generation
const character = await sidvid.generateCharacter({
  description: 'A tall detective with silver hair',
  style: 'realistic',
});
```

### Stateful Sessions (Session & SessionManager)

**Workflow state management with history:**
```typescript
import { SessionManager, MemoryStorageAdapter } from '$lib/sidvid';

// Create session manager with storage
const manager = new SessionManager(new MemoryStorageAdapter());

// Create new session
const session = await manager.createSession('My Project', {
  openaiApiKey: env.OPENAI_API_KEY,
});

// Generate story (tracked in history)
await session.generateStory({
  prompt: 'A detective story',
  scenes: 3,
});

// Edit story (new history entry)
await session.editStory({
  editPrompt: 'Make it more dramatic',
});

// Undo/redo
session.undoStory();
session.redoStory();

// Extract and enhance characters
const characters = session.extractCharacters();
for (const char of characters) {
  await session.enhanceCharacter(char.id);
  await session.generateCharacterImage(char.id);
}

// Initialize scene pipeline
session.initializeScenePipeline();
const pipeline = session.getScenePipeline();

// Assign characters to slots
session.assignCharactersToSlot(pipeline.slots[0].id, [char.id]);

// Generate scene images
await session.generateAllPendingSlots();

// Save session
await manager.saveSession(session);
```

### Storage Adapter Pattern

**Pluggable storage for session persistence:**
```typescript
// Memory adapter (default, no persistence)
import { MemoryStorageAdapter } from '$lib/sidvid';
const memoryAdapter = new MemoryStorageAdapter();

// Browser adapter (localStorage/IndexedDB)
import { BrowserStorageAdapter } from '$lib/sidvid';
const browserAdapter = new BrowserStorageAdapter();

// File adapter (Node.js only)
import { FileStorageAdapter } from '$lib/sidvid/storage/file-adapter';
const fileAdapter = new FileStorageAdapter('./sessions');
```

**Custom adapter:**
```typescript
import type { StorageAdapter } from '$lib/sidvid';

class CustomAdapter implements StorageAdapter {
  async save(sessionId: string, data: SessionData): Promise<void> {
    // Save to your storage backend
  }

  async load(sessionId: string): Promise<SessionData | null> {
    // Load from your storage backend
  }

  async delete(sessionId: string): Promise<void> {
    // Delete from your storage backend
  }

  async list(): Promise<string[]> {
    // List all session IDs
  }
}
```

## API Integration Patterns

### OpenAI ChatGPT Integration

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

// Story generation with structured output
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a creative storyteller.' },
    { role: 'user', content: prompt },
  ],
  response_format: { type: 'json_object' },
});

const story = JSON.parse(completion.choices[0].message.content);
```

### OpenAI DALL-E Integration

```typescript
// Image generation
const response = await openai.images.generate({
  model: 'dall-e-3',
  prompt: description,
  size: '1024x1024',
  quality: 'hd',
  n: 1,
});

const imageUrl = response.data[0].url;
const revisedPrompt = response.data[0].revised_prompt;
```

### Kling AI Integration

```typescript
// Video generation (API pattern TBD - Kling SDK)
const video = await klingClient.generateVideo({
  prompt: storyboardDescription,
  duration: 10,
  withAudio: true,
});

// Poll for completion
const completedVideo = await klingClient.waitForCompletion(video.id);
```

## Validation with Zod

### Schema Definition

```typescript
import { z } from 'zod';

export const storySchema = z.object({
  title: z.string().min(1),
  scenes: z.array(z.object({
    description: z.string(),
    dialogue: z.string().optional(),
    action: z.string().optional(),
  })),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
});

export type Story = z.infer<typeof storySchema>;
```

### Runtime Validation

```typescript
// Validate API responses
const result = storySchema.safeParse(apiResponse);
if (!result.success) {
  throw new Error(`Invalid story: ${result.error.message}`);
}
const story: Story = result.data;
```

### Form Validation (UI)

```typescript
// In Svelte components
import { storySchema } from '$lib/sidvid/schemas';

const formData = {
  title: 'My Story',
  scenes: [...],
  characters: [...],
};

const result = storySchema.safeParse(formData);
if (!result.success) {
  // Show validation errors
  errors = result.error.flatten();
}
```

## State Management

### Library State (Session)
- Session state → `Session` class with history tracking
- Storage → Pluggable `StorageAdapter` interface
- No external state management library

### UI State (Svelte Stores)
- Component state → `$state()` rune
- Derived values → `$derived()` rune
- Shared UI state → Svelte stores

```typescript
// UI-specific store (not part of library)
import { writable } from 'svelte/store';

export const uiState = writable({
  currentTab: 'story',
  sidebarOpen: true,
});
```

## Error Handling

### Library Errors

```typescript
// Throw descriptive errors in library code
export class SidVidError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'SidVidError';
  }
}

// Usage
if (!config.openaiApiKey) {
  throw new SidVidError(
    'OpenAI API key is required',
    'MISSING_API_KEY',
  );
}
```

### UI Error Handling

```typescript
// In UI components, catch and display errors
try {
  await session.generateStory({ prompt });
} catch (error) {
  if (error instanceof SidVidError) {
    toast.error(`${error.code}: ${error.message}`);
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

## Async Patterns

- Prefer async/await over raw promises
- Use loading states in UI during async operations
- Handle cancellation with AbortController for long-running operations
- Provide progress callbacks for video generation

```typescript
// Progress tracking
await session.generateVideo({
  prompt: storyboardDescription,
  onProgress: (progress) => {
    console.log(`Video generation: ${progress}%`);
  },
});
```

## TypeScript Patterns

### Strict Type Safety

```typescript
// Use TypeScript strict mode
// Enable in tsconfig.json: "strict": true

// Prefer interfaces for public APIs
export interface SidVidConfig {
  openaiApiKey: string;
  klingApiKey?: string;
}

// Use types for internal structures
export type SessionState = {
  currentStory: Story | null;
  storyHistory: Story[];
  characters: Map<string, Character>;
};
```

### Type Guards

```typescript
export function isStory(value: unknown): value is Story {
  return storySchema.safeParse(value).success;
}
```

## Icon Usage with Lucide (UI)

```svelte
<script>
  import { Video, Image, FileText } from 'lucide-svelte';
</script>

<Video class="h-4 w-4" />
<Image class="h-4 w-4" />
<FileText class="h-4 w-4" />
```

## Testing Patterns

### Library Testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SidVid } from '$lib/sidvid';

describe('SidVid', () => {
  it('generates story', async () => {
    const sidvid = new SidVid({ openaiApiKey: 'test-key' });

    // Mock OpenAI API
    vi.mock('openai');

    const story = await sidvid.generateStory({
      prompt: 'A test story',
      scenes: 3,
    });

    expect(story).toHaveProperty('title');
    expect(story.scenes).toHaveLength(3);
  });
});
```

### Session Testing

```typescript
import { Session, MemoryStorageAdapter } from '$lib/sidvid';

describe('Session', () => {
  it('tracks story history', async () => {
    const session = new Session('test', { openaiApiKey: 'test-key' });

    await session.generateStory({ prompt: 'Story 1' });
    await session.generateStory({ prompt: 'Story 2' });

    expect(session.getStoryHistory()).toHaveLength(2);

    session.undoStory();
    expect(session.getCurrentStory()).toEqual(
      session.getStoryHistory()[0],
    );
  });
});
```

## UI/CLI Code Sharing

**Problem**: UI and CLI duplicate logic

**Solution**: Use shared headless library

```typescript
// ❌ DON'T duplicate logic
// ui/story-page.svelte
async function generate() {
  const response = await fetch('/api/openai', ...);
  const story = await response.json();
  // UI-specific processing
}

// cli/story-command.ts
async function generate() {
  const response = await fetch('/api/openai', ...);
  const story = await response.json();
  // CLI-specific processing
}

// ✅ DO use shared library
// Both UI and CLI use:
import { SidVid } from '$lib/sidvid';
const story = await sidvid.generateStory({ prompt });
```
