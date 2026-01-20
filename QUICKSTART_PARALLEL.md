# Quick Start: Parallel Development

## What's Been Set Up

✅ Test directory structure for 5 features
✅ Comprehensive test templates with TODO markers
✅ Shared test utilities and fixtures
✅ Interface type contracts between features
✅ Coordination guide
✅ Playwright configuration

## File Structure Created

```
core/
├── tests/e2e/
│   ├── story/
│   │   ├── story.spec.ts        ← Existing tests moved here
│   │   └── README.md            ← Requirements & contracts
│   ├── characters/
│   │   ├── characters.spec.ts   ← Test templates (TODO)
│   │   └── README.md
│   ├── scenes/
│   │   ├── scenes.spec.ts       ← Test templates (TODO)
│   │   └── README.md
│   ├── storyboard/
│   │   ├── storyboard.spec.ts   ← Test templates (TODO)
│   │   └── README.md
│   ├── video/
│   │   ├── video.spec.ts        ← Test templates (TODO)
│   │   └── README.md
│   └── shared/
│       ├── global-setup.ts      ← Shared setup
│       ├── test-helpers.ts      ← Utility functions
│       └── fixtures.ts          ← Mock data
│
├── src/lib/features/
│   ├── story/
│   │   └── types.ts             ← Interface contracts
│   ├── characters/
│   │   └── types.ts
│   ├── scenes/
│   │   └── types.ts
│   ├── storyboard/
│   │   └── types.ts
│   └── video/
│       └── types.ts
│
├── PARALLEL_DEVELOPMENT.md       ← Full coordination guide
└── QUICKSTART_PARALLEL.md        ← This file
```

## How to Start (5 Terminals)

### Terminal 1: Story Feature
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
git checkout -b feature/story
claude
```

Tell Claude:
> Work on the story feature. Make all tests in `tests/e2e/story/` pass. Read `tests/e2e/story/README.md` for requirements. Existing implementation is in `src/routes/story/` - you may need to refactor it to match the new contracts in `src/lib/features/story/types.ts`.

### Terminal 2: Characters Feature
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
git checkout -b feature/characters
claude
```

Tell Claude:
> Work on the characters feature. Make all tests in `tests/e2e/characters/` pass. Read `tests/e2e/characters/README.md` for requirements and `src/lib/features/characters/types.ts` for interface contracts. The tests are templates with TODO markers - implement each test case.

### Terminal 3: Scenes Feature
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
git checkout -b feature/scenes
claude
```

Tell Claude:
> Work on the scenes feature. Make all tests in `tests/e2e/scenes/` pass. Read `tests/e2e/scenes/README.md` for requirements and `src/lib/features/scenes/types.ts` for interface contracts. The tests are templates with TODO markers - implement each test case.

### Terminal 4: Storyboard Feature
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
git checkout -b feature/storyboard
claude
```

Tell Claude:
> Work on the storyboard feature. Make all tests in `tests/e2e/storyboard/` pass. Read `tests/e2e/storyboard/README.md` for requirements and `src/lib/features/storyboard/types.ts` for interface contracts. The tests are templates with TODO markers - implement each test case.

### Terminal 5: Video Feature
```bash
cd /Users/mmcdermott/mark-mcdermott/sidvid-proj/core
git checkout -b feature/video
claude
```

Tell Claude:
> Work on the video feature. Make all tests in `tests/e2e/video/` pass. Read `tests/e2e/video/README.md` for requirements and `src/lib/features/video/types.ts` for interface contracts. The tests are templates with TODO markers - implement each test case.

## Running Tests

Each Claude instance runs only their feature's tests:

```bash
# Story
pnpm exec playwright test tests/e2e/story/

# Characters
pnpm exec playwright test tests/e2e/characters/

# Scenes
pnpm exec playwright test tests/e2e/scenes/

# Storyboard
pnpm exec playwright test tests/e2e/storyboard/

# Video
pnpm exec playwright test tests/e2e/video/
```

## Interface Contracts

Each feature exports types for the next feature to consume:

- **Story** exports `StoryOutput` → used by Characters
- **Characters** exports `CharacterOutput[]` → used by Scenes
- **Scenes** exports `SceneOutput[]` → used by Storyboard
- **Storyboard** exports `StoryboardOutput` → used by Video
- **Video** exports `VideoOutput` → final product

All types are in `src/lib/features/{feature}/types.ts`

## What Each Claude Instance Should Do

### Phase 1: Implement Test Cases (1-2 hours)
1. Read the README.md in your feature's test directory
2. Read the types.ts file for your feature
3. Implement each TODO marker in the test file
4. Run tests to verify they work (they'll fail - no implementation yet)

### Phase 2: Implement Feature (2-3 hours)
1. Create route files in `src/routes/{feature}/`
2. Create store file in `src/lib/features/{feature}/store.ts`
3. Create API routes in `src/routes/api/{feature}/+server.ts`
4. Implement UI components
5. Run tests until they pass

### Phase 3: Integration (30 min)
1. Verify your feature exports the correct types
2. Test that next feature can import your types
3. Manual testing in browser

## Success Criteria

Your feature is done when:
- ✅ All tests pass (`pnpm exec playwright test tests/e2e/{feature}/`)
- ✅ Types match the contracts in `types.ts`
- ✅ No console errors in dev server
- ✅ Manual testing works

## Current Status

- **Story**: Has existing implementation, needs refactoring to match new contracts
- **Characters**: Empty, needs full implementation
- **Scenes**: Empty, needs full implementation
- **Storyboard**: Empty, needs full implementation
- **Video**: Empty, needs full implementation

## Key Files to Read

1. `PARALLEL_DEVELOPMENT.md` - Full coordination guide
2. `tests/e2e/{feature}/README.md` - Feature requirements
3. `src/lib/features/{feature}/types.ts` - Interface contracts
4. `tests/e2e/shared/test-helpers.ts` - Shared utilities

## Questions?

Read `PARALLEL_DEVELOPMENT.md` for detailed guidance on:
- What you can/can't modify
- How to handle conflicts
- Merging strategy
- Communication between instances
- Emergency procedures
