---
description: JavaScript/TypeScript and Svelte coding standards for SidVid
alwaysApply: false
---
# JavaScript and TypeScript Guidelines

## Purpose
Defines JavaScript/TypeScript coding standards, Svelte 5 patterns, and SvelteKit best practices for SidVid.

## Application Context

SidVid is a TypeScript library for AI video generation with:
- TypeScript with strict mode (core library)
- Svelte 5 with runes (reference UI only)
- SvelteKit 2 for routing and server-side (reference UI only)
- Zod for schema validation
- OpenAI SDK for ChatGPT and DALL-E integration
- No database, no authentication, no backend hosting

## TypeScript Standards

### Type Safety
- **JS.TS-1 (MUST)**: Enable strict mode in `tsconfig.json`
- **JS.TS-2 (MUST)**: Define types for all library exports
- **JS.TS-3 (SHOULD)**: Use explicit return types for functions
- **JS.TS-4 (SHOULD)**: Avoid `any` type; use `unknown` when type is truly unknown
- **JS.TS-5 (MUST)**: Define types for all component props using `$props()`

### Variable Declaration
- **JS.VAR-1 (MUST)**: Use `const` by default; use `let` only when reassignment needed
- **JS.VAR-2 (MUST NOT)**: Use `var`

## Svelte 5 Patterns (UI Only)

### Runes
- **JS.RUNE-1 (MUST)**: Use `$state()` for reactive state
- **JS.RUNE-2 (MUST)**: Use `$derived()` for computed values
- **JS.RUNE-3 (MUST)**: Use `$effect()` for side effects
- **JS.RUNE-4 (MUST)**: Use `$props()` for component props
- **JS.RUNE-5 (SHOULD)**: Keep effects minimal and focused

### Component Structure
- **JS.SVELTE-1 (SHOULD)**: Keep components small and focused (< 200 lines)
- **JS.SVELTE-2 (SHOULD)**: Extract complex logic into utility functions
- **JS.SVELTE-3 (SHOULD)**: Use snippets for reusable template fragments
- **JS.SVELTE-4 (MUST)**: Use TypeScript in `<script lang="ts">`

### Reactivity
- **JS.REACT-1 (SHOULD)**: Prefer `$derived()` over manual state updates
- **JS.REACT-2 (SHOULD)**: Use stores for shared state across components
- **JS.REACT-3 (SHOULD NOT)**: Mutate state directly; use runes

## SvelteKit Patterns (UI Only)

### Data Loading
- **JS.LOAD-1 (MUST)**: Use `+page.server.ts` for server-side data loading
- **JS.LOAD-2 (MUST)**: Return typed data from load functions
- **JS.LOAD-3 (SHOULD)**: Handle errors with `error()` helper
- **JS.LOAD-4 (SHOULD)**: Use library Session for workflow state

### Form Handling
- **JS.FORM-1 (SHOULD)**: Use SvelteKit form actions for mutations
- **JS.FORM-2 (SHOULD)**: Use Zod for validation
- **JS.FORM-3 (SHOULD)**: Implement progressive enhancement

### API Routes
- **JS.API-1 (MUST)**: Use `+server.ts` for REST API endpoints
- **JS.API-2 (MUST)**: Return proper HTTP status codes
- **JS.API-3 (MUST)**: Validate inputs with Zod schemas

## Headless Library Patterns

### SidVid Class (Stateless)
- **JS.LIB-1 (MUST)**: Keep SidVid class methods stateless
- **JS.LIB-2 (MUST)**: Pass all required data as method parameters
- **JS.LIB-3 (SHOULD)**: Return typed results from all methods
- **JS.LIB-4 (MUST)**: Validate inputs before API calls

### Session Class (Stateful)
- **JS.SESSION-1 (MUST)**: Track workflow state in Session instance
- **JS.SESSION-2 (MUST)**: Implement undo/redo with history arrays
- **JS.SESSION-3 (SHOULD)**: Use immutable state updates
- **JS.SESSION-4 (MUST)**: Provide methods for all workflow operations

### Storage Adapters
- **JS.STORAGE-1 (MUST)**: Implement StorageAdapter interface
- **JS.STORAGE-2 (MUST)**: Handle async save/load operations
- **JS.STORAGE-3 (SHOULD)**: Serialize session state to JSON

## OpenAI Integration Patterns

### API Calls
- **JS.OPENAI-1 (MUST)**: Use OpenAI SDK for all API calls
- **JS.OPENAI-2 (MUST)**: Handle API errors gracefully
- **JS.OPENAI-3 (SHOULD)**: Use structured output (JSON) for story generation
- **JS.OPENAI-4 (SHOULD)**: Validate API responses with Zod

### Image Generation
- **JS.DALLE-1 (SHOULD)**: Use DALL-E 3 for character and scene images
- **JS.DALLE-2 (SHOULD)**: Store revised prompts with generated images
- **JS.DALLE-3 (SHOULD)**: Handle image URL expiration appropriately

## File Organization

See @.llm/context/project-structure.md for directory structure.

### File Naming
- **JS.NAME-1 (MUST)**: Use PascalCase for component files (`StoryEditor.svelte`)
- **JS.NAME-2 (MUST)**: Use camelCase for utility files (`parseStory.ts`)
- **JS.NAME-3 (MUST)**: Use camelCase for store files (`sessionStore.ts`)
- **JS.NAME-4 (MUST)**: Use camelCase for library files (`client.ts`, `session.ts`)
- **JS.NAME-5 (MUST)**: Use camelCase with Schema suffix for Zod schemas (`storySchema.ts`)

### Directory Structure
- **JS.ORG-1 (MUST)**: Place Svelte components in `src/lib/components/`
- **JS.ORG-2 (MUST)**: Place shadcn-svelte components in `src/lib/components/ui/`
- **JS.ORG-3 (MUST)**: Place stores in `src/lib/stores/`
- **JS.ORG-4 (MUST)**: Place UI utilities in `src/lib/utils/`
- **JS.ORG-5 (MUST)**: Place library code in `src/lib/sidvid/`
- **JS.ORG-6 (MUST)**: Place Zod schemas in `src/lib/sidvid/schemas/`
- **JS.ORG-7 (MUST)**: Place CLI code in `src/cli/`

## Validation with Zod

### Schema Definition
- **JS.ZOD-1 (MUST)**: Define schemas for all form inputs
- **JS.ZOD-2 (MUST)**: Define schemas for all API request bodies
- **JS.ZOD-3 (SHOULD)**: Use `.transform()` for data normalization
- **JS.ZOD-4 (SHOULD)**: Export inferred types from schemas
- **JS.ZOD-5 (MUST)**: Validate API responses from OpenAI

## Icon Usage with Lucide (UI Only)

- **JS.ICON-1 (MUST)**: Import icons from `lucide-svelte`
- **JS.ICON-2 (SHOULD)**: Use consistent icon sizes via Tailwind classes

## Async Patterns

### Error Handling
- **JS.ASYNC-1 (MUST)**: Use try/catch for all async operations
- **JS.ASYNC-2 (SHOULD)**: Display user-friendly error messages in UI
- **JS.ASYNC-3 (MUST)**: Log detailed errors server-side
- **JS.ASYNC-4 (SHOULD)**: Use AbortController for cancellable operations

### Promises
- **JS.PROM-1 (SHOULD)**: Prefer async/await over raw promises
- **JS.PROM-2 (MUST NOT)**: Leave promises unhandled
- **JS.PROM-3 (SHOULD)**: Use Promise.all() for parallel operations

## Testing Standards

See @.llm/context/testing-strategy.md for test organization.
See @.llm/rules/testing.md for testing quality standards.

- **JS.TEST-1 (MUST)**: Write unit tests for library code and utilities
- **JS.TEST-2 (SHOULD)**: Write component tests for Svelte components
- **JS.TEST-3 (MUST)**: Mock OpenAI API in tests
- **JS.TEST-4 (SHOULD)**: Use Playwright for E2E testing

## Code Quality

### Linting
- **JS.LINT-1 (MUST)**: ESLint must pass with zero errors
- **JS.LINT-2 (MUST)**: Prettier must pass (consistent formatting)
- **JS.LINT-3 (MUST)**: svelte-check must pass with zero errors
- **JS.LINT-4 (SHOULD)**: Fix all ESLint warnings

### Code Style
- **JS.STYLE-1 (MUST)**: Use tabs for indentation (Svelte convention)
- **JS.STYLE-2 (SHOULD)**: Limit line length to 100 characters
- **JS.STYLE-3 (SHOULD)**: Use single quotes for strings

## Performance

### Svelte Performance
- **JS.PERF-1 (SHOULD)**: Use `{#key}` blocks for forcing re-renders
- **JS.PERF-2 (SHOULD)**: Use `$derived()` for expensive computations
- **JS.PERF-3 (SHOULD NOT)**: Optimize prematurely; measure first

### Library Performance
- **JS.PERF-4 (SHOULD)**: Cache API responses where appropriate
- **JS.PERF-5 (SHOULD)**: Use streaming for large responses
- **JS.PERF-6 (SHOULD)**: Provide progress callbacks for long operations
