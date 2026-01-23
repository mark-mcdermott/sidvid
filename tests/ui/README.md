# E2E Tests

End-to-end tests for the SidVid UI using Playwright.

## Prerequisites

**IMPORTANT:** You need Node.js version ^20.19, ^22.12, or >=24 to run these tests.

Current Node version: `v21.7.1` (incompatible)

To update Node, use nvm:
```bash
nvm install 22
nvm use 22
```

## Installation

After updating Node, install Playwright:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

## Running Tests

Run all E2E tests:
```bash
pnpm test:e2e
```

Run only StoryGen tests:
```bash
pnpm test:e2e:storygen
```

Run tests in UI mode (interactive):
```bash
pnpm test:e2e:ui
```

Run tests in debug mode:
```bash
pnpm test:e2e:debug
```

## Test Organization

Tests are tagged with `@storygen` to allow selective execution:

```typescript
test.describe('StoryGen @storygen', () => {
  // Tests here
});
```

## StoryGen Tests

The `storygen.spec.ts` file includes the following tests:

1. **Story Generation** - Verifies a story is generated when user fills prompt and clicks "Generate Story"
2. **Longer Video Length** - Tests that selecting a longer video length (10s) generates more scenes
3. **UI State After Generation** - Checks that the initial textarea and dropdown are hidden after response loads and replaced with the actual prompt text
4. **Sidebar Conversation** - Verifies the conversation appears in the sidebar shortly after the response loads
5. **Edit Story with Prompt** - Tests the edit story functionality
6. **Try Again** - Tests regenerating a story with the same prompt
7. **Keyboard Shortcuts** - Verifies Enter submits and Shift+Enter adds a line break

## Environment

Tests require:
- Dev server running at `http://localhost:5173` (automatically started by Playwright)
- Valid OpenAI API key in `.env` file
