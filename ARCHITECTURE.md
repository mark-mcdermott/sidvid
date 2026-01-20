# SidVid Architecture - Parallel Development

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SidVid Pipeline                              │
└─────────────────────────────────────────────────────────────────────┘

  Story              Characters           Scenes           Storyboard         Video
┌────────┐         ┌──────────┐         ┌──────┐         ┌──────────┐      ┌───────┐
│ User   │         │          │         │      │         │          │      │       │
│ Prompt ├────────►│ Generate ├────────►│ Gen  ├────────►│ Timeline ├─────►│ Sora  │
│        │         │ with     │         │ with │         │ + Trans  │      │ Gen   │
│ GPT-4o │         │ DALL-E   │         │ DALLE│         │ + Text   │      │       │
└────┬───┘         └─────┬────┘         └──┬───┘         └─────┬────┘      └───┬───┘
     │                   │                 │                   │               │
     │                   │                 │                   │               │
     v                   v                 v                   v               v
StoryOutput      CharacterOutput[]    SceneOutput[]    StoryboardOutput   VideoOutput
┌────────────┐   ┌─────────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────┐
│ id         │   │ id              │ │ id           │ │ id            │ │ id       │
│ content    │   │ name            │ │ description  │ │ scenes[]      │ │ url      │
│ prompt     │   │ description     │ │ imageUrl     │ │ totalDuration │ │ settings │
│ length     │   │ imageUrl        │ │ characterIds │ │ createdAt     │ │ metadata │
│ createdAt  │   │ storyId         │ │ duration     │ └───────────────┘ │ versions │
└────────────┘   │ createdAt       │ │ order        │                   └──────────┘
                 └─────────────────┘ │ createdAt    │
                                     └──────────────┘
```

## Feature Ownership

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      5 Claude Instances                                  │
└─────────────────────────────────────────────────────────────────────────┘

Instance 1          Instance 2         Instance 3        Instance 4       Instance 5
┌──────────┐       ┌────────────┐      ┌───────┐        ┌───────────┐    ┌───────┐
│  Story   │       │ Characters │      │ Scenes│        │Storyboard │    │ Video │
├──────────┤       ├────────────┤      ├───────┤        ├───────────┤    ├───────┤
│          │       │            │      │       │        │           │    │       │
│ Routes   │       │  Routes    │      │Routes │        │  Routes   │    │Routes │
│ /story   │       │ /characters│      │/scenes│        │/storyboard│    │/video │
│          │       │            │      │       │        │           │    │       │
│ Store    │       │  Store     │      │ Store │        │  Store    │    │ Store │
│ story    │       │ character  │      │ scene │        │storyboard │    │ video │
│          │       │            │      │       │        │           │    │       │
│ Tests    │       │  Tests     │      │ Tests │        │  Tests    │    │ Tests │
│ e2e/story│       │e2e/chars   │      │e2e/   │        │e2e/       │    │e2e/   │
│          │       │            │      │scenes │        │storyboard │    │video  │
│          │       │            │      │       │        │           │    │       │
│ API      │       │   API      │      │  API  │        │   API     │    │  API  │
│ /api/    │       │ /api/      │      │/api/  │        │ /api/     │    │/api/  │
│ story    │       │ characters │      │scenes │        │storyboard │    │video  │
└──────────┘       └────────────┘      └───────┘        └───────────┘    └───────┘
```

## Directory Structure

```
core/
│
├── tests/e2e/
│   ├── story/           ← Instance 1 owns this
│   │   ├── story.spec.ts
│   │   └── README.md
│   ├── characters/      ← Instance 2 owns this
│   │   ├── characters.spec.ts
│   │   └── README.md
│   ├── scenes/          ← Instance 3 owns this
│   │   ├── scenes.spec.ts
│   │   └── README.md
│   ├── storyboard/      ← Instance 4 owns this
│   │   ├── storyboard.spec.ts
│   │   └── README.md
│   ├── video/           ← Instance 5 owns this
│   │   ├── video.spec.ts
│   │   └── README.md
│   └── shared/          ← READ ONLY - nobody modifies
│       ├── global-setup.ts
│       ├── test-helpers.ts
│       └── fixtures.ts
│
├── src/
│   ├── routes/
│   │   ├── story/       ← Instance 1
│   │   ├── characters/  ← Instance 2
│   │   ├── scenes/      ← Instance 3
│   │   ├── storyboard/  ← Instance 4
│   │   ├── video/       ← Instance 5
│   │   └── api/
│   │       ├── story/       ← Instance 1
│   │       ├── characters/  ← Instance 2
│   │       ├── scenes/      ← Instance 3
│   │       ├── storyboard/  ← Instance 4
│   │       └── video/       ← Instance 5
│   │
│   └── lib/
│       ├── features/
│       │   ├── story/       ← Instance 1
│       │   │   ├── store.ts
│       │   │   ├── types.ts
│       │   │   └── api.ts
│       │   ├── characters/  ← Instance 2
│       │   │   ├── store.ts
│       │   │   ├── types.ts
│       │   │   └── api.ts
│       │   ├── scenes/      ← Instance 3
│       │   │   ├── store.ts
│       │   │   ├── types.ts
│       │   │   └── api.ts
│       │   ├── storyboard/  ← Instance 4
│       │   │   ├── store.ts
│       │   │   ├── types.ts
│       │   │   └── api.ts
│       │   └── video/       ← Instance 5
│       │       ├── store.ts
│       │       ├── types.ts
│       │       └── api.ts
│       │
│       ├── components/ui/   ← READ ONLY
│       └── shared/          ← READ ONLY
│
└── Documentation
    ├── PARALLEL_DEVELOPMENT.md    ← Full guide
    ├── QUICKSTART_PARALLEL.md     ← Quick start
    ├── SETUP_COMPLETE.md          ← Status
    └── ARCHITECTURE.md            ← This file
```

## Test Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test-Driven Development                       │
└─────────────────────────────────────────────────────────────────┘

1. Write Tests First
   ├── Each test has TODO markers
   ├── Implement test logic
   └── Run test (will fail - no implementation)

2. Implement Feature
   ├── Create routes
   ├── Create store
   ├── Create UI components
   └── Create API endpoints

3. Run Tests
   ├── Fix failures
   ├── Iterate until green
   └── Verify manual testing

4. Integration
   ├── Verify type contracts
   ├── Test with next feature
   └── Run full test suite
```

## Communication Pattern

```
┌──────────────────────────────────────────────────────────┐
│           How Features Communicate                        │
└──────────────────────────────────────────────────────────┘

Story Feature                     Characters Feature
┌─────────────────┐              ┌──────────────────┐
│                 │              │                  │
│ Generate story  │              │ import type {    │
│                 │              │   StoryOutput    │
│ export story as:│─────────────►│ } from           │
│ StoryOutput     │              │ '../story/types' │
│                 │              │                  │
│ {               │              │ Use StoryOutput  │
│   id,           │              │ as input to      │
│   content,      │              │ generate chars   │
│   prompt,       │              │                  │
│   length        │              │ Export as:       │
│ }               │              │ CharacterOutput[]│
└─────────────────┘              └─────────┬────────┘
                                           │
                                           v
                                    Scenes Feature
                                   ┌─────────────────┐
                                   │                 │
                                   │ import type {   │
                                   │  CharacterOutput│
                                   │ }               │
                                   │                 │
                                   │ Use characters  │
                                   │ to generate     │
                                   │ scenes          │
                                   └─────────────────┘
```

## Shared Resources

```
┌────────────────────────────────────────────────────────┐
│              Shared (Read-Only)                         │
└────────────────────────────────────────────────────────┘

UI Components                Test Utilities
┌──────────────┐            ┌─────────────────┐
│ Button       │            │ test-helpers.ts │
│ Input        │            │ - waitForNetworkIdle()
│ Select       │            │ - navigateAndWait()
│ Textarea     │            │ - fillAndVerify()
│ Loader2      │            │ - expectVisibleWithText()
│ etc...       │            └─────────────────┘
└──────────────┘
                            Mock Data
Layout                      ┌─────────────────┐
┌──────────────┐            │ fixtures.ts     │
│ +layout.svelte│           │ - mockStory     │
│ Sidebar      │            │ - mockCharacter │
│ Navigation   │            │ - mockScene     │
└──────────────┘            │ - mockStoryboard│
                            │ - mockVideo     │
                            └─────────────────┘
```

## Isolation Strategy

Each feature is isolated by:

1. **Separate test directories** - No test file conflicts
2. **Separate route directories** - No route conflicts
3. **Separate stores** - No state conflicts
4. **Separate API routes** - No endpoint conflicts
5. **Type contracts** - Clear interfaces between features
6. **Git branches** - No merge conflicts during development

## Integration Points

```
┌───────────────────────────────────────────────────┐
│            When Features Must Coordinate          │
└───────────────────────────────────────────────────┘

1. Type Contract Changes
   Problem: Story changes StoryOutput interface
   Solution: Update characters/types.ts import
   Who: Story and Characters instances coordinate

2. Shared UI Component Needs
   Problem: Need new Button variant
   Solution: Add to shared/components once
   Who: One instance makes change, others pull

3. Navigation Links
   Problem: All features add sidebar links
   Solution: Each adds their own link independently
   Who: Each instance adds one link

4. API Route Conflicts
   Problem: Both want /api/generate
   Solution: Use /api/{feature}/generate pattern
   Who: Follow naming convention
```

## Success Path

```
┌─────────────────────────────────────────────────────┐
│              Development Timeline                    │
└─────────────────────────────────────────────────────┘

Hour 0:  Setup complete ✅
         5 branches created
         5 Claude instances started

Hour 1:  All instances read requirements
         All instances implement test cases

Hour 2:  All instances begin feature implementation
         Story refactors existing code
         Others build from scratch

Hour 4:  Features start passing tests
         Story exports StoryOutput
         Characters can import it

Hour 6:  Most tests passing
         Features communicate via types
         Integration testing begins

Hour 8:  All tests green ✅
         Manual testing complete
         Ready to merge

Hour 9:  Sequential merge to main
         Story → Characters → Scenes → Storyboard → Video

Hour 10: Full integration test
         End-to-end manual test
         DONE! 🎉
```

## Visual Test Coverage

```
Story Feature (Existing - 9 tests)
████████░░ 6 passing, 3 failing

Characters Feature (New - ~25 tests)
░░░░░░░░░░ 0 passing (all TODO)

Scenes Feature (New - ~30 tests)
░░░░░░░░░░ 0 passing (all TODO)

Storyboard Feature (New - ~25 tests)
░░░░░░░░░░ 0 passing (all TODO)

Video Feature (New - ~30 tests)
░░░░░░░░░░ 0 passing (all TODO)

Total: ~140 tests
```

## Key Principles

1. **Isolation First** - Each feature is independent
2. **Contracts Clear** - Types define all interfaces
3. **Tests Lead** - Write tests before implementation
4. **Communicate** - Type changes need coordination
5. **Merge Sequential** - Story first, Video last
