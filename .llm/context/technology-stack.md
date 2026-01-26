# Technology Stack

## Runtime Versions

- Node.js 22 (LTS)
- pnpm (package manager)
- TypeScript 5 (strict mode enabled)

## Core Library (Headless)

- TypeScript 5 (strict mode)
- Zod (schema validation and runtime type safety)
- OpenAI SDK (ChatGPT and DALL-E 3 integration)
- Kling AI SDK (video generation with audio)

## Reference UI

- SvelteKit 2 (full-stack web framework)
- Svelte 5 (UI framework with runes)
- Vite 5 (build tool and dev server)
- Tailwind CSS 3 (utility-first styling)
- shadcn-svelte (UI component library)
- Lucide Svelte (icon library)

## CLI

- Node.js (command-line interface)
- Commander.js or similar (CLI framework, TBD)
- Uses same headless library core as UI

## API Integrations

- **OpenAI API**:
  - ChatGPT (GPT-4) for story generation and editing
  - DALL-E 3 for character and scene image generation
- **Kling AI API**:
  - Video generation from storyboards
  - Audio synthesis for video narration

## State Management

- Session-based workflow tracking (custom implementation)
- Pluggable storage adapters:
  - `MemoryStorageAdapter` - In-memory storage (default)
  - `BrowserStorageAdapter` - localStorage/IndexedDB for web
  - `FileStorageAdapter` - File system for Node.js/CLI

## Validation & Type Safety

- Zod (schema validation for all data structures)
- TypeScript strict mode (compile-time type safety)
- Runtime validation for API responses

## Testing & Quality

- Vitest (unit and integration tests)
- Playwright (E2E testing for reference UI)
- ESLint + Prettier (with TypeScript and Svelte plugins)
- TypeScript strict mode

## Development Workflow

- All development runs locally (no Docker)
- No CI/CD for library development
- Hot Module Replacement (HMR) via Vite
- SvelteKit dev server for UI testing
- Tests run locally before publishing

## Build & Distribution

- tsup or similar for library bundling
- ESM and CommonJS outputs
- Type declarations (.d.ts files)
- npm/pnpm for package distribution

## Environment Variables

Required for development and testing:
- `OPENAI_API_KEY` - OpenAI API key (ChatGPT and DALL-E)
- `KLING_API_KEY` - Kling AI API key (video generation)

Copy `.env.example` to `.env` and add your keys.

## Package Structure

```
sidvid/
├── src/lib/sidvid/      # Headless library (published to npm)
├── src/routes/          # Reference UI (not published)
├── src/cli/             # CLI wrapper (published as bin)
└── dist/                # Built library output
```

## Notable Absences (Compared to Typical Full-Stack Apps)

**No Database**: SidVid is a library, not a service
- State persists via storage adapters
- No Neon, Supabase, or PostgreSQL
- No ORM (Drizzle, Prisma, etc.)

**No Authentication**: Library doesn't need user accounts
- No Lucia, Auth.js, or authentication providers
- Users bring their own API keys

**No Backend Hosting**: Library runs in user's environment
- No Cloudflare Pages, Vercel, or hosting setup
- No server-side deployment concerns

**No Data Fetching Library**: Direct API calls
- No TanStack Query (overkill for library use)
- Simple async/await with error handling

## UI-Specific Dependencies

The reference UI uses these (not part of core library):
- SvelteKit form actions (UI forms)
- Svelte stores (UI state management)
- Tailwind CSS (UI styling)
- shadcn-svelte (UI components)

These are **not** dependencies of the core library and won't be included when developers import `sidvid`.
