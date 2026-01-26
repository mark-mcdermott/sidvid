# Development Commands

## Setup & Install

```bash
pnpm install              # Install all dependencies
cp .env.example .env      # Copy environment template
# Add your OPENAI_API_KEY to .env
```

## Development

```bash
pnpm dev                  # Start SvelteKit dev server with HMR
./sidvid <command>        # Run CLI commands (wrapper script)
pnpm cli <command>        # Run CLI commands (shows build messages)
```

## Lint & Format

```bash
pnpm lint                 # Run ESLint
pnpm lint:fix             # Auto-fix ESLint issues
pnpm format               # Run Prettier
pnpm check                # Run svelte-check (TypeScript + Svelte)
```

## Testing

```bash
pnpm test                 # Run all tests
pnpm test:unit            # Run Vitest unit tests
pnpm test:unit:watch      # Run unit tests in watch mode
pnpm test:e2e             # Run Playwright E2E tests
pnpm test:e2e:debug       # Run E2E tests with Playwright inspector
pnpm test:coverage        # Generate coverage report
```

## Build & Package

```bash
pnpm build                # Build SvelteKit UI for production
pnpm build:lib            # Build headless library for npm distribution
pnpm preview              # Preview production build locally
```

## CLI Commands

```bash
# Story generation
./sidvid story "A detective solving a mystery"
./sidvid -v story "A detective solving a mystery"  # Verbose output

# Edit a story
./sidvid edit-story story.json "Make it more dramatic"

# Character generation
./sidvid enhance-character "A detective"
./sidvid character "A tall detective in a trenchcoat"

# Scene generation
./sidvid scene "A rainy street at night with neon lights"

# Video generation
./sidvid video "A cat playing piano"
./sidvid status video_abc123

# Help
./sidvid help
```

## Clean

```bash
rm -rf .svelte-kit        # Clear SvelteKit cache
rm -rf node_modules       # Full clean (requires reinstall)
rm -rf dist               # Clear library build output
```

## Environment Variables

- `.env` - Environment variables (gitignored)
- `.env.example` - Template with required keys
- `OPENAI_API_KEY` - Required for ChatGPT and DALL-E
- `KLING_API_KEY` - Required for video generation (optional)

## Git Workflow

Development workflow with no CI/CD:

```bash
# 1. Work on main branch (or feature branch)
git checkout main

# 2. Make changes and run tests locally
pnpm test
pnpm lint
pnpm check

# 3. Commit and push
git add .
git commit -m "feat: description"
git push origin main
```

## Pre-Push Checklist

Before pushing:

```bash
pnpm lint                 # No ESLint errors
pnpm check                # No TypeScript/Svelte errors
pnpm test                 # All tests pass
pnpm build                # Build succeeds
```
