# JavaScript Test Writing Workflow (Vitest + Playwright)

## Purpose
Write high-quality JavaScript/TypeScript tests following strict TDD: tests are the spec. Primary frameworks: Vitest (unit/component) and Playwright (E2E).

## Core Principles
- **TDD-first**: Write failing tests before implementation (Red → Green → Refactor).
- **Behavior-focused**: Tests should describe expected behavior, not implementation details.
- **Fast & Deterministic**: Keep unit tests fast; E2E tests cover critical user journeys.

## File Layout & Naming
- Unit/component tests colocated with source: `src/lib/utils/*.test.ts` or `src/lib/components/*.test.ts`.
- E2E tests under `tests/e2e/**/*.spec.ts` using Playwright.

## Test Types & When to Use
- **Unit (Vitest)**: Pure functions, utilities, Zod schemas, stores.
- **Component (Vitest + Testing Library)**: Svelte component behavior.
- **E2E (Playwright)**: User flows in the browser (auth, forms, navigation).

## Test Authoring Checklist
1. Write a clear test name describing behavior.
2. Parameterize inputs where useful (`it.each`).
3. Use Testing Library idioms for components (`render`, `screen`, `fireEvent`).
4. Mock Supabase client in unit tests; prefer dependency injection.
5. For Playwright, prefer role/aria/data-testid selectors over brittle CSS.
6. Record traces/screenshots for failed E2E runs.
7. Keep tests independent and idempotent.

## Example (Vitest + Svelte Testing Library)
```ts
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect } from 'vitest';
import Login from './Login.svelte';

describe('Login', () => {
  it('shows error for invalid email', async () => {
    render(Login);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await fireEvent.input(emailInput, { target: { value: 'invalid' } });
    await fireEvent.click(submitButton);

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

## Example (Zod Schema Test)
```ts
import { describe, it, expect } from 'vitest';
import { noteSchema } from '$lib/schemas/note';

describe('noteSchema', () => {
  it('validates valid note', () => {
    const result = noteSchema.safeParse({ title: 'Test', content: 'Content' });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = noteSchema.safeParse({ title: '', content: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Title is required');
  });
});
```

## Running Tests
- Unit: `pnpm test:unit`
- E2E: `pnpm test:e2e` (ensure `npx playwright install` ran at least once)
- Coverage: `pnpm test:coverage`

## Output
- Tests added/updated next to code.
- Clear test names and fixtures.
- Playwright traces/screenshots for failures attached to CI artifacts.
