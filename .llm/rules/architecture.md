---
description: Design patterns, principles, and function quality standards for building maintainable code
alwaysApply: false
---
# Architecture Guidelines

## Purpose
Defines architectural patterns, design principles, and structural decisions for building maintainable, testable code in SidVid.

## Core Principles
- **MUST** rules are enforced by linting/CI; **SHOULD** rules are strongly recommended.
- Terms "function" and "method" are used interchangeably.

## Design Patterns

### Module Organization
- **ARCH.MOD-1 (SHOULD)**: Organize code by feature/domain, not by type
- **ARCH.MOD-2 (SHOULD)**: Keep related functionality together (colocation)
- **ARCH.MOD-3 (SHOULD)**: Use clear boundaries between headless library, UI, and CLI code

### Utility Functions
- **ARCH.UTIL-1 (SHOULD)**: Extract pure functions for reusable logic
- **ARCH.UTIL-2 (SHOULD)**: Keep utilities stateless and deterministic
- **ARCH.UTIL-3 (SHOULD)**: Place library utilities in `src/lib/sidvid/`, UI utilities in `src/lib/utils/`

### Svelte Stores (UI Only)
- **ARCH.STORE-1 (SHOULD)**: Use stores for shared state across components
- **ARCH.STORE-2 (SHOULD)**: Keep stores focused on single responsibility
- **ARCH.STORE-3 (SHOULD)**: Place stores in `src/lib/stores/`

### Error Handling
- **ARCH.ERR-1 (SHOULD)**: Use SvelteKit `error()` for HTTP errors in UI
- **ARCH.ERR-2 (MUST)**: Handle all async errors with try/catch
- **ARCH.ERR-3 (SHOULD)**: Display user-friendly error messages in UI
- **ARCH.ERR-4 (SHOULD)**: Use custom `SidVidError` class in library code

## Design Principles

### Single Responsibility
- **ARCH.SRP-1 (SHOULD)**: Functions and modules should have one clear purpose
- **ARCH.SRP-2 (SHOULD)**: Components should do one thing well

### Separation of Concerns
- **ARCH.SOC-1 (MUST)**: Keep business logic in headless library, not in UI components
- **ARCH.SOC-2 (MUST)**: Handle data fetching in load functions or library calls, not components
- **ARCH.SOC-3 (SHOULD)**: Separate validation schemas from business logic

### Composition Over Inheritance
- **ARCH.COMP-1 (SHOULD)**: Use stores and functions for shared behavior
- **ARCH.COMP-2 (SHOULD NOT)**: Use class inheritance for code reuse (except for Session/SessionManager)
- **ARCH.COMP-3 (SHOULD)**: Compose small functions to build complex behavior

### Immutability
- **ARCH.IMMUT-1 (SHOULD)**: Prefer immutable data structures
- **ARCH.IMMUT-2 (SHOULD)**: Use spread operators or methods like `map()` instead of mutation

### Pattern Consistency
- **ARCH.PATTERN-1 (SHOULD)**: Follow existing patterns in the codebase before creating new ones
- **ARCH.PATTERN-2 (SHOULD)**: Use consistent naming conventions throughout

## Code Organization

### Naming and Vocabulary
- **ARCH.NAME-1 (MUST)**: Use clear, descriptive names that match domain vocabulary
- **ARCH.NAME-2 (SHOULD)**: Avoid abbreviations unless widely understood
- **ARCH.NAME-3 (SHOULD)**: Use verb-noun pairs for function names (`generateStory`, `extractCharacters`)

### Function Design
- **ARCH.FUNC-1 (SHOULD)**: Prefer small, composable, testable functions
- **ARCH.FUNC-2 (SHOULD)**: Keep functions under 50 lines when possible
- **ARCH.FUNC-3 (SHOULD NOT)**: Extract a new function unless:
  - It will be reused elsewhere
  - It's the only way to unit-test otherwise untestable logic
  - It drastically improves readability

### Comments and Documentation
- **ARCH.DOC-1 (SHOULD NOT)**: Add comments except for critical caveats or complex algorithms
- **ARCH.DOC-2 (SHOULD)**: Rely on self-explanatory code with good naming
- **ARCH.DOC-3 (SHOULD)**: Document complex Zod schemas with JSDoc

## Function Quality Checklist

When evaluating function quality, check:

1. **ARCH.Q-1 (SHOULD)**: Ensure functions are readable and easy to follow
2. **ARCH.Q-2 (SHOULD)**: Avoid high cyclomatic complexity (excessive branching)
3. **ARCH.Q-3 (SHOULD)**: Use appropriate data structures to improve clarity
4. **ARCH.Q-4 (MUST NOT)**: Include unused parameters in function signatures
5. **ARCH.Q-5 (SHOULD NOT)**: Hide dependencies; pass them as arguments
6. **ARCH.Q-6 (MUST)**: Use descriptive function names consistent with domain vocabulary

## SvelteKit-Specific Architecture (UI Only)

### Server vs Client
- **ARCH.SERVER-1 (MUST)**: Use `+page.server.ts` for server-only operations
- **ARCH.SERVER-2 (MUST)**: Use `+server.ts` for API endpoints
- **ARCH.SERVER-3 (MUST NOT)**: Import server-only code in client components

### Data Flow
- **ARCH.DATA-1 (MUST)**: Load data in load functions, not in components
- **ARCH.DATA-2 (SHOULD)**: Pass data to components via props
- **ARCH.DATA-3 (SHOULD)**: Use form actions for mutations

### Route Organization
- **ARCH.ROUTE-1 (SHOULD)**: Group related routes in folders
- **ARCH.ROUTE-2 (SHOULD)**: Use layouts for shared UI
- **ARCH.ROUTE-3 (SHOULD)**: Use route groups for organization without URL segments

## SidVid Headless Library Architecture

### Stateless vs Stateful
- **ARCH.LIB-1 (MUST)**: Keep `SidVid` class stateless - no instance state between calls
- **ARCH.LIB-2 (MUST)**: Use `Session` class for stateful workflow management
- **ARCH.LIB-3 (SHOULD)**: Use `SessionManager` for session CRUD operations
- **ARCH.LIB-4 (MUST)**: Library code must be framework-agnostic (no Svelte/SvelteKit dependencies)

### Storage Adapters
- **ARCH.STORAGE-1 (MUST)**: Use `StorageAdapter` interface for persistence
- **ARCH.STORAGE-2 (SHOULD)**: Default to `MemoryStorageAdapter` for simplicity
- **ARCH.STORAGE-3 (MUST)**: Keep `FileStorageAdapter` in separate entry point (Node.js only)
- **ARCH.STORAGE-4 (SHOULD)**: Implement new adapters by implementing the interface

### API Integration
- **ARCH.API-1 (MUST)**: Wrap all external API calls (OpenAI, Kling) in library methods
- **ARCH.API-2 (MUST)**: Validate API responses with Zod schemas
- **ARCH.API-3 (SHOULD)**: Handle rate limiting and retries in library code
- **ARCH.API-4 (SHOULD)**: Provide progress callbacks for long-running operations

### Session State Management
- **ARCH.SESSION-1 (MUST)**: Track all story versions in history array
- **ARCH.SESSION-2 (MUST)**: Track all character versions in per-character history
- **ARCH.SESSION-3 (SHOULD)**: Use immutable updates for state changes
- **ARCH.SESSION-4 (MUST)**: Maintain history index for undo/redo navigation

### Scene Pipeline
- **ARCH.PIPELINE-1 (SHOULD)**: Initialize pipeline from current story scenes
- **ARCH.PIPELINE-2 (SHOULD)**: Track slot status (pending, generating, completed, failed)
- **ARCH.PIPELINE-3 (SHOULD)**: Allow slot customization without affecting story

## UI/CLI Code Sharing

### Shared Library Pattern
- **ARCH.SHARE-1 (MUST)**: Both UI and CLI use the same headless library (`src/lib/sidvid`)
- **ARCH.SHARE-2 (MUST NOT)**: Duplicate API call logic between UI and CLI
- **ARCH.SHARE-3 (SHOULD)**: Use Session for workflow state in both UI and CLI
- **ARCH.SHARE-4 (SHOULD)**: Keep UI-specific code in `src/routes` and `src/lib/components`

### CLI Architecture
- **ARCH.CLI-1 (SHOULD)**: Use same Session/SessionManager as UI
- **ARCH.CLI-2 (SHOULD)**: Use FileStorageAdapter for session persistence
- **ARCH.CLI-3 (SHOULD)**: Provide interactive prompts for workflow steps

## Validation Architecture

### Zod Schemas
- **ARCH.ZOD-1 (MUST)**: Define schemas for all user input
- **ARCH.ZOD-2 (MUST)**: Validate on both client and server
- **ARCH.ZOD-3 (SHOULD)**: Export inferred types from schemas
- **ARCH.ZOD-4 (SHOULD)**: Reuse schemas between form validation and API validation

## Testability

### Test Design
- **ARCH.TEST-1 (SHOULD)**: Design functions to be easily testable
- **ARCH.TEST-2 (SHOULD)**: Mock external APIs (OpenAI, Kling) in tests
- **ARCH.TEST-3 (SHOULD)**: Use MemoryStorageAdapter for session testing
- **ARCH.TEST-4 (SHOULD)**: Use E2E tests for full workflow scenarios

## Performance Considerations

- **ARCH.PERF-1 (SHOULD)**: Avoid premature optimization
- **ARCH.PERF-2 (SHOULD)**: Profile before optimizing
- **ARCH.PERF-3 (SHOULD)**: Use streaming for large data sets
- **ARCH.PERF-4 (SHOULD)**: Cache API responses where appropriate
