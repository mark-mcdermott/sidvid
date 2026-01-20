# Parallel Development Guide

## Overview
This guide explains how to develop the 5 SidVid features in parallel using 5 separate Claude instances.

## Directory Structure

```
core/
├── tests/e2e/
│   ├── story/           ← Claude Instance 1
│   ├── characters/      ← Claude Instance 2
│   ├── scenes/          ← Claude Instance 3
│   ├── storyboard/      ← Claude Instance 4
│   ├── video/           ← Claude Instance 5
│   └── shared/          ← READ ONLY (shared by all)
├── src/
│   ├── routes/
│   │   ├── story/       ← Claude Instance 1
│   │   ├── characters/  ← Claude Instance 2
│   │   ├── scenes/      ← Claude Instance 3
│   │   ├── storyboard/  ← Claude Instance 4
│   │   └── video/       ← Claude Instance 5
│   └── lib/
│       ├── features/
│       │   ├── story/       ← Claude Instance 1
│       │   ├── characters/  ← Claude Instance 2
│       │   ├── scenes/      ← Claude Instance 3
│       │   ├── storyboard/  ← Claude Instance 4
│       │   └── video/       ← Claude Instance 5
│       └── shared/      ← READ ONLY (shared by all)
```

## Setup Instructions

### 1. Create Feature Branches
Each Claude instance should work on a separate branch:

```bash
# Terminal 1
git checkout -b feature/story

# Terminal 2
git checkout -b feature/characters

# Terminal 3
git checkout -b feature/scenes

# Terminal 4
git checkout -b feature/storyboard

# Terminal 5
git checkout -b feature/video
```

### 2. Start Claude in Each Terminal

**Terminal 1 (Story):**
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
claude
```
Then tell Claude: "Work on the story feature. Your goal is to make all tests in `tests/e2e/story/` pass. Read `tests/e2e/story/README.md` for requirements and interface contracts."

**Terminal 2 (Characters):**
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
claude
```
Then tell Claude: "Work on the characters feature. Your goal is to make all tests in `tests/e2e/characters/` pass. Read `tests/e2e/characters/README.md` for requirements and interface contracts."

**Terminal 3 (Scenes):**
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
claude
```
Then tell Claude: "Work on the scenes feature. Your goal is to make all tests in `tests/e2e/scenes/` pass. Read `tests/e2e/scenes/README.md` for requirements and interface contracts."

**Terminal 4 (Storyboard):**
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
claude
```
Then tell Claude: "Work on the storyboard feature. Your goal is to make all tests in `tests/e2e/storyboard/` pass. Read `tests/e2e/storyboard/README.md` for requirements and interface contracts."

**Terminal 5 (Video):**
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
claude
```
Then tell Claude: "Work on the video feature. Your goal is to make all tests in `tests/e2e/video/` pass. Read `tests/e2e/video/README.md` for requirements and interface contracts."

## Rules for Each Instance

### ✅ ALLOWED to Modify
- Your feature's test directory (`tests/e2e/{feature}/`)
- Your feature's route directory (`src/routes/{feature}/`)
- Your feature's lib directory (`src/lib/features/{feature}/`)
- Your feature's API routes (`src/routes/api/{feature}/`)

### ❌ NOT ALLOWED to Modify
- `src/lib/shared/` (read-only reference)
- `src/lib/components/ui/` (read-only UI components)
- `src/routes/+layout.svelte` (shared layout)
- `tests/e2e/shared/` (shared test utilities)
- `playwright.config.ts` (shared test config)
- Other features' directories

### ⚠️ COORDINATION REQUIRED
- `src/lib/stores/` - Each feature has its own store file
- Navigation links in sidebar - Use a consistent pattern
- API route naming - Use `/api/{feature}/*` pattern

## Interface Contracts

Each feature must export and import data according to these contracts:

### Story → Characters
Story exports:
```typescript
// src/lib/features/story/types.ts
export interface StoryOutput {
  id: string;
  content: string;
  prompt: string;
  length: string;
}
```

Characters imports:
```typescript
// src/lib/features/characters/types.ts
import type { StoryOutput } from '../story/types';
```

### Characters → Scenes
Characters exports:
```typescript
// src/lib/features/characters/types.ts
export interface CharacterOutput {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  storyId: string;
}
```

### Scenes → Storyboard
Scenes exports:
```typescript
// src/lib/features/scenes/types.ts
export interface SceneOutput {
  id: string;
  description: string;
  imageUrl: string;
  characterIds: string[];
  duration: number;
  order: number;
}
```

### Storyboard → Video
Storyboard exports:
```typescript
// src/lib/features/storyboard/types.ts
export interface StoryboardOutput {
  id: string;
  scenes: SceneWithTransitions[];
  totalDuration: number;
}
```

## Running Tests

Each instance should run only their feature's tests:

```bash
# Story instance
pnpm exec playwright test tests/e2e/story/

# Characters instance
pnpm exec playwright test tests/e2e/characters/

# Scenes instance
pnpm exec playwright test tests/e2e/scenes/

# Storyboard instance
pnpm exec playwright test tests/e2e/storyboard/

# Video instance
pnpm exec playwright test tests/e2e/video/
```

## Success Criteria

A feature is complete when:
1. ✅ All tests in `tests/e2e/{feature}/` are passing (green)
2. ✅ Feature exports correct data types for next feature
3. ✅ Feature imports work correctly from previous feature
4. ✅ No errors in dev server console
5. ✅ Manual testing confirms UI works

## Merging Strategy

### Option 1: Sequential Merge (Recommended)
Merge features in order to avoid integration issues:
1. Merge `feature/story` to `main`
2. Merge `feature/characters` to `main` (depends on story)
3. Merge `feature/scenes` to `main` (depends on characters)
4. Merge `feature/storyboard` to `main` (depends on scenes)
5. Merge `feature/video` to `main` (depends on storyboard)

### Option 2: Parallel with Integration Branch
1. Create `integration` branch from `main`
2. Each feature merges to `integration` when ready
3. Resolve conflicts on `integration` branch
4. Merge `integration` to `main` when all features complete

## Common Patterns

### 1. Feature Store Pattern
Each feature should have its own store:

```typescript
// src/lib/features/{feature}/store.ts
import { writable } from 'svelte/store';
import type { {Feature}State } from './types';

const initialState: {Feature}State = {
  // ... initial state
};

export const {feature}Store = writable<{Feature}State>(initialState);
```

### 2. Feature API Pattern
Each feature should have its own API routes:

```typescript
// src/routes/api/{feature}/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  // Handle feature-specific API calls
};
```

### 3. Navigation Pattern
Each feature should add itself to the sidebar:

```typescript
// In src/lib/components/ui/sidebar/sidebar-content.svelte
// Each feature adds one link:
<SidebarMenuItem>
  <SidebarMenuButton href="/{feature}">
    {Feature} Generation
  </SidebarMenuButton>
</SidebarMenuItem>
```

## Debugging Tips

### If tests are failing:
1. Check that you've implemented the interface contract correctly
2. Verify mock data matches expected types
3. Check console for runtime errors
4. Use Playwright UI mode: `pnpm exec playwright test --ui`

### If features can't communicate:
1. Verify type exports in `src/lib/features/{feature}/types.ts`
2. Check imports use correct relative paths
3. Verify conversation store is saving/loading data

### If merge conflicts occur:
1. Most conflicts will be in imports - easy to resolve
2. Sidebar navigation - each feature adds one link
3. Type conflicts - discuss with other instances

## Communication Between Instances

Since you're running 5 Claude instances in separate terminals, you'll need to coordinate manually:

1. **Type Changes**: If you need to change an interface contract, post in the coordination channel
2. **Shared Dependencies**: Don't modify shared code without coordinating
3. **Bugs in Previous Features**: File an issue or communicate directly

## Monitoring Progress

Create a checklist to track completion:

- [ ] Story tests passing
- [ ] Characters tests passing
- [ ] Scenes tests passing
- [ ] Storyboard tests passing
- [ ] Video tests passing
- [ ] Integration tests passing
- [ ] Manual E2E test passing

## Emergency Procedures

### If a feature is blocking others:
1. Create a minimal stub implementation
2. Return mock data that matches the interface
3. Continue with dependent features
4. Come back and implement fully later

### If you need to modify shared code:
1. Stop all instances
2. Make the shared change on main
3. Rebase all feature branches
4. Resume work

## Expected Timeline

- **Setup**: 30 minutes
- **Parallel Development**: 2-4 hours per feature
- **Integration**: 1-2 hours
- **Testing**: 1 hour
- **Total**: ~6-10 hours (vs ~20-30 hours sequential)

## Questions?

Read the README.md in each test directory for detailed requirements and interface contracts.
