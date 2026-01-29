# Project Structure

## Top-Level Layout

```
sidvid-core/
├── src/
│   ├── lib/sidvid/          # Headless library (framework-agnostic, published to npm)
│   │   ├── api/             # API implementations
│   │   │   ├── story.ts     # Story generation & editing
│   │   │   ├── character.ts # Character generation & enhancement
│   │   │   ├── scene.ts     # Scene generation
│   │   │   └── video.ts     # Video generation
│   │   ├── storage/         # Storage adapters for session persistence
│   │   │   ├── adapter.ts   # StorageAdapter interface
│   │   │   ├── memory-adapter.ts   # In-memory storage
│   │   │   ├── browser-adapter.ts  # localStorage/IndexedDB
│   │   │   └── file-adapter.ts     # File system (Node.js only)
│   │   ├── types/           # TypeScript interfaces
│   │   ├── schemas/         # Zod validation schemas
│   │   ├── client.ts        # Main SidVid class (stateless)
│   │   ├── session.ts       # Session class (stateful workflows)
│   │   ├── session-manager.ts # SessionManager (session CRUD)
│   │   └── index.ts         # Public exports
│   │
│   ├── routes/              # Reference UI (SvelteKit, not published)
│   │   ├── +page.svelte     # Single-page dashboard (Settings, Story, World, Storyboard, Video)
│   │   ├── +layout.svelte   # App layout with mobile menu
│   │   └── projects/        # All Projects page
│   │
│   ├── lib/                 # UI-specific shared code (not part of headless library)
│   │   ├── components/      # Svelte UI components
│   │   │   └── ui/          # shadcn-svelte components
│   │   ├── stores/          # Svelte stores for UI state
│   │   └── utils/           # UI utility functions
│   │
│   ├── cli/                 # CLI wrapper (published as bin)
│   │   └── index.ts         # Command-line interface
│   │
│   └── app.html             # HTML template for UI
│
├── static/                  # Static assets (UI only)
├── tests/                   # Tests
│   ├── unit/                # Unit tests (Vitest)
│   ├── e2e/                 # E2E tests (Playwright)
│   └── fixtures/            # Test fixtures and mock data
│
├── data/                    # Sample data and development files
├── .llm/                    # LLM context and guidelines
├── package.json             # Package configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
├── svelte.config.js         # SvelteKit configuration
└── README.md                # Project documentation
```

## Key Directories

### `/src/lib/sidvid` - Headless Library (Published to npm)

This is the core library that gets published to npm. Framework-agnostic and usable in any JavaScript/TypeScript project.

**API Layer** (`api/`):
- `story.ts` - Story generation and editing with ChatGPT
- `character.ts` - Character enhancement and image generation with DALL-E
- `scene.ts` - Scene image generation with DALL-E
- `video.ts` - Video generation with Kling AI

**Storage Adapters** (`storage/`):
- `adapter.ts` - StorageAdapter interface
- `memory-adapter.ts` - In-memory storage (default)
- `browser-adapter.ts` - localStorage/IndexedDB for web apps
- `file-adapter.ts` - File system storage for Node.js/CLI

**Core Classes**:
- `client.ts` - `SidVid` class (stateless API methods)
- `session.ts` - `Session` class (stateful workflow management)
- `session-manager.ts` - `SessionManager` (session CRUD operations)

**Type Definitions**:
- `types/` - TypeScript interfaces and types
- `schemas/` - Zod schemas for validation

**Public API**:
- `index.ts` - Public exports (what users import from `sidvid`)

### `/src/routes` - Reference UI (SvelteKit, Not Published)

Web interface for local development and testing. Not included in npm package.

- `+page.svelte` - Single-page dashboard with collapsible sections (Settings, Story, World, Storyboard, Video)
- `+layout.svelte` - App layout with mobile menu navigation
- `projects/` - All Projects page for managing multiple projects

### `/src/lib` - UI-Specific Code (Not Part of Headless Library)

**Important**: This is separate from `/src/lib/sidvid`!

- `components/` - Svelte UI components
- `components/ui/` - shadcn-svelte primitives
- `stores/` - Svelte stores for UI state management
- `utils/` - UI-specific utility functions

This code is **only** for the reference UI and is **not** part of the published library.

### `/src/cli` - CLI Wrapper (Published)

Command-line interface that wraps the headless library. Published as a bin script with the npm package.

- Uses the same headless library (`src/lib/sidvid`) as the UI
- Provides command-line access to all library functionality
- Currently minimal implementation (~10% complete)

### `/tests` - Test Files

- `unit/` - Vitest unit tests for library and UI
- `e2e/` - Playwright E2E tests for UI workflows
- `fixtures/` - Test data and mock responses

### `/data` - Development Data

Sample stories, characters, and session data for development and testing.

## Import Paths

### For Library Users (Published Package)

```typescript
// Main library exports
import { SidVid, Session, SessionManager } from 'sidvid';

// Storage adapters (browser/memory included by default)
import { MemoryStorageAdapter, BrowserStorageAdapter } from 'sidvid';

// File adapter (Node.js only, separate import)
import { FileStorageAdapter } from 'sidvid/storage/file-adapter';

// Types
import type { Story, Character, Scene, Video } from 'sidvid';
```

### For Internal Development (UI and CLI)

```typescript
// Headless library
import { SidVid, Session } from '$lib/sidvid';

// UI-specific (not exported to users)
import Button from '$lib/components/ui/button.svelte';
import { uiStateStore } from '$lib/stores/uiState';
```

## Naming Conventions

- **Library files**: camelCase (`client.ts`, `sessionManager.ts`)
- **UI Components**: PascalCase (`StoryEditor.svelte`, `CharacterCard.svelte`)
- **Routes**: lowercase (`/story`, `/characters`, `/storyboard`)
- **Stores**: camelCase with Store suffix (`uiStateStore.ts`)
- **Tests**: mirror source with `.test.ts` or `.spec.ts` suffix
- **Types**: PascalCase (`Story`, `Character`, `Session`)
- **Schemas**: camelCase with Schema suffix (`storySchema`, `characterSchema`)

## Build & Package

### Development
```bash
pnpm dev           # Start UI dev server
pnpm cli <command> # Run CLI commands
```

### Building
```bash
pnpm build         # Build SvelteKit UI
pnpm build:lib     # Build headless library for npm
```

### Testing
```bash
pnpm test          # Run all tests
pnpm test:unit     # Unit tests
pnpm test:e2e      # E2E tests
```

## Published Package Structure

When published to npm, only these are included:

```
sidvid/
├── dist/               # Compiled library code
│   ├── index.js        # ESM entry
│   ├── index.cjs       # CommonJS entry
│   ├── index.d.ts      # Type definitions
│   └── storage/        # Storage adapter modules
├── package.json
└── README.md
```

The UI code (`src/routes`, `src/lib/components`) is **not** published, only the headless library (`src/lib/sidvid`).

## Development Focus Areas

### Current Work (~50% UI, ~30% Library, ~10% CLI)
- Reference UI workflow implementation
- Session management and history
- Storyboard editor
- CLI basic commands

### Planned
- Complete UI workflows
- Full CLI parity with UI
- Comprehensive testing
- Performance optimizations
- Documentation and examples
