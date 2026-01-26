# Testing Strategy

## CRITICAL: Test-Driven Development (TDD)

**ALL development must be fully TDD.** This is mandatory, not optional:

1. Write tests FIRST before implementing features
2. Tests define the expected behavior
3. Implementation makes tests pass
4. Refactor while keeping tests green

**No feature is complete until tests pass.**

## File Organization

- **Unit Tests:** `tests/unit/**/*.test.ts` or co-located `src/**/*.test.ts` (Vitest)
- **E2E Tests:** `tests/e2e/**/*.spec.ts` (Playwright)

## Vitest Configuration

### vitest.config.ts

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '**/*.d.ts', '**/*.config.*'],
    },
    alias: {
      $lib: '/src/lib',
      '$lib/*': '/src/lib/*',
    },
  },
});
```

### Required Dependencies

Add to package.json devDependencies:

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@testing-library/svelte": "^5.0.0",
    "@testing-library/dom": "^10.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0"
  }
}
```

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "pnpm test:unit && pnpm test:e2e",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:debug": "playwright test --debug",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Test Types

| Type        | Tools                    | Purpose                                    |
| ----------- | ------------------------ | ------------------------------------------ |
| Unit        | Vitest                   | Pure functions, utilities, Zod schemas     |
| Component   | Vitest + Testing Library | Svelte component behavior                  |
| E2E         | Playwright               | Full user flows in the web UI              |

## What to Test

### Unit Tests
- Library functions (`src/lib/sidvid/`)
- Utility functions (`src/lib/utils/`)
- Zod schema validation (`src/lib/sidvid/schemas/`)
- Session state management logic
- Storage adapter implementations
- Data transformations

### Component Tests (UI)
- Component rendering with different props
- User interactions (clicks, form inputs)
- Conditional rendering logic
- Slot content rendering

### E2E Tests (UI)
- Story generation workflows
- Character creation and enhancement
- Scene pipeline management
- Full workflow from story to video
- Navigation between pages

## SvelteKit-Specific Testing

### Load Functions
- Test `+page.server.ts` load functions
- Verify returned data structure

### Form Actions
- Test form action handlers
- Verify validation errors

### API Routes
- Test `+server.ts` endpoints
- Verify response status codes

## MSW (Mock Service Worker) Testing

### Setup MSW for Tests
```typescript
// tests/setup.ts
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Define Mock Handlers for OpenAI
```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock ChatGPT API
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Test Story',
            scenes: [{ description: 'Scene 1' }],
            characters: [{ name: 'Hero', description: 'A brave hero' }],
          }),
        },
      }],
    });
  }),

  // Mock DALL-E API
  http.post('https://api.openai.com/v1/images/generations', () => {
    return HttpResponse.json({
      data: [{
        url: 'https://example.com/image.png',
        revised_prompt: 'Enhanced prompt',
      }],
    });
  }),
];
```

### Testing with MSW
```typescript
import { describe, it, expect } from 'vitest';
import { SidVid } from '$lib/sidvid';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';

describe('SidVid', () => {
  it('generates story from API', async () => {
    const sidvid = new SidVid({ openaiApiKey: 'test-key' });
    const story = await sidvid.generateStory({ prompt: 'A test story' });

    expect(story.title).toBe('Test Story');
    expect(story.scenes).toHaveLength(1);
  });

  it('handles API errors', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({ error: 'Rate limit' }, { status: 429 });
      })
    );

    const sidvid = new SidVid({ openaiApiKey: 'test-key' });
    await expect(sidvid.generateStory({ prompt: 'test' })).rejects.toThrow();
  });
});
```

## Session Testing

### Using MemoryStorageAdapter
```typescript
import { describe, it, expect } from 'vitest';
import { SessionManager, MemoryStorageAdapter } from '$lib/sidvid';

describe('Session', () => {
  it('tracks story history with branching', async () => {
    const manager = new SessionManager(new MemoryStorageAdapter());
    const session = await manager.createSession('Test', { openaiApiKey: 'key' });

    await session.generateStory({ prompt: 'Story 1' });
    await session.generateStory({ prompt: 'Story 2' });

    expect(session.getStoryHistory()).toHaveLength(2);

    // Branch from first version
    session.branchFromHistory(0);
    expect(session.getStoryHistory()).toHaveLength(1);
  });

  it('persists and loads session', async () => {
    const adapter = new MemoryStorageAdapter();
    const manager = new SessionManager(adapter);

    const session = await manager.createSession('Test', { openaiApiKey: 'key' });
    await session.generateStory({ prompt: 'test' });
    await manager.saveSession(session);

    const loaded = await manager.loadSession(session.id, { openaiApiKey: 'key' });
    expect(loaded.getCurrentStory()).toEqual(session.getCurrentStory());
  });

  it('manages world elements', async () => {
    const manager = new SessionManager(new MemoryStorageAdapter());
    const session = await manager.createSession('Test', { openaiApiKey: 'key' });

    session.addWorldElement({
      name: 'Alice',
      type: 'character',
      description: 'A curious girl'
    });

    expect(session.getWorldElements()).toHaveLength(1);
    expect(session.getWorldElements()[0].type).toBe('character');
  });
});
```

## Playwright E2E Testing

### Playwright Configuration

Create `playwright.config.ts` in project root:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Required Dependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.48.0"
  }
}
```

Install browsers: `npx playwright install`

### Playwright MCP Server

This project has a Playwright MCP server configured for interactive browser testing and debugging.

**IMPORTANT: Use Playwright MCP sparingly** - it significantly slows development.

**When to use Playwright MCP:**
- Interactive debugging when tests are failing
- Visual verification of UI changes
- Inspecting accessibility tree for element selection

**When NOT to use Playwright MCP:**
- Simple test runs - ask user to run `pnpm test:e2e` instead
- If connection becomes flaky, stop and troubleshoot
- Don't use overly long or tolerant timeouts - fail fast and diagnose

**MCP Tools:**
- `mcp__playwright__browser_snapshot` - Capture accessibility tree
- `mcp__playwright__browser_take_screenshot` - Visual debugging
- `mcp__playwright__browser_navigate` - Navigate to URLs
- Interactive actions: click, type, fill forms

## Principles

- Write tests for critical paths first (workflow operations, API calls)
- Test behavior, not implementation details
- Mock external services (OpenAI, Kling) with MSW
- Use MemoryStorageAdapter for session tests
- Keep tests fast and deterministic
- Avoid testing framework code (SvelteKit, Svelte)

## Development Workflow

- Run all tests locally before pushing
- No CI/CD - tests are developer responsibility
- Use `pnpm test` to run full test suite
- Use `pnpm test:unit:watch` during development

## Coverage Goals

- Target coverage: 80%+ for library code
- Focus on business logic and workflow operations
- Don't chase coverage numbers for UI framework code

## Testing Patterns

### Zod Schema Testing
```typescript
import { describe, it, expect } from 'vitest';
import { storySchema } from '$lib/sidvid/schemas';

describe('storySchema', () => {
  it('validates valid story', () => {
    const result = storySchema.safeParse({
      title: 'Test',
      scenes: [{ description: 'Scene' }],
      characters: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = storySchema.safeParse({ title: '', scenes: [] });
    expect(result.success).toBe(false);
  });
});
```

### Svelte Component Testing
```typescript
import { render, screen } from '@testing-library/svelte';
import Button from '$lib/components/ui/button.svelte';

it('renders button text', () => {
  render(Button, { props: { children: 'Click me' } });
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

### Store Testing
```typescript
import { get } from 'svelte/store';
import { sessionStore } from '$lib/stores/sessionStore';

it('updates session state', () => {
  sessionStore.setSession(mockSession);
  expect(get(sessionStore).session).toBe(mockSession);
});
```

## Test Data

- Use fixture files for test data
- Create test utilities for generating test objects
- Clean up test data after each test run
- Use factories for generating test objects
