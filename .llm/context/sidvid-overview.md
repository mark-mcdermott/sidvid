# SidVid Project Overview

## What is SidVid?

SidVid is an open-source TypeScript library (~30% complete) for AI-powered video generation. It provides a headless, implementation-agnostic core that developers can integrate into their own projects, plus a reference UI and planned CLI for local development and testing.

## Core Value Proposition

While SidVid integrates with ChatGPT, DALL-E, and Kling APIs, its real value lies in **state management and workflow orchestration** for the complete video creation process:

1. **Story text generation** - Generate narrative with scenes, characters, dialogue
2. **World building** - Create and manage characters, locations, objects, and concepts
3. **Scene composition** - Assemble world elements into scenes with poster images
4. **Storyboarding** - Arrange scenes with drag-and-drop, edit timing and transitions
5. **Video generation** - Produce final video from storyboard

Each step can be:
- Manually edited by users
- Re-generated with new ChatGPT prompts
- Branched from any point in history
- Fine-tuned extensively or used with defaults

SidVid brings all these individual steps into **one place with a smooth, intuitive workflow** that supports both quick generation and extensive iteration.

## Architecture

SidVid follows a **headless library** pattern:

```
┌─────────────────────────────────────────────────┐
│       Headless Library (src/lib/sidvid)         │
│  ─────────────────────────────────────────────  │
│  Session & SessionManager (stateful workflows)  │
│  - Story history with branching                 │
│  - World elements (characters, locations, etc.) │
│  - Scene composition and poster images          │
│  - Storyboard with timing/transitions           │
│  - State persistence (save/load sessions)       │
│  ─────────────────────────────────────────────  │
│  SidVid class (stateless API methods)           │
│  - generateStory() / editStory()                │
│  - enhanceElementDescription()                  │
│  - generateElementImage() / generateSceneImage()|
│  - generateVideo()                              │
└─────────────────────────────────────────────────┘
                ↑              ↑
                │              │
         ┌──────┴──────┐  ┌───┴──────┐
         │   Web UI    │  │   CLI    │
         │  (routes/)  │  │  (cli/)  │
         │  SvelteKit  │  │  Node.js │
         └─────────────┘  └──────────┘
```

### Headless Library (Framework-Agnostic)

**Stateless API** (`SidVid` class):
- Direct API method calls for one-off operations
- No state tracking, no history
- For simple scripts and integrations

**Stateful Sessions** (`Session` and `SessionManager`):
- Complete workflow state management
- History with branching for stories and world elements
- Scene pipeline with element composition
- Storyboard with timing and transitions
- Persistence with pluggable storage adapters

### Reference UI (SvelteKit)

A lightweight web interface (~50% complete) for local development:
- Story generation and editing
- World element creation (characters, locations, objects, concepts)
- Scene composition with drag-and-drop from sidebar
- Storyboard editor with reordering and transitions
- Video generation and preview
- Built with SvelteKit, Svelte 5, Tailwind CSS, Zod

### CLI (Planned, Not Complete)

Command-line interface to match UI functionality:
- Should do everything the UI can do
- Must avoid code/logic duplication with UI
- Uses the same headless library core
- Currently minimal implementation

## Workflow: Non-Linear Design

**Users can start at any stage**, not just Story. The workflow is flexible:

### Core Principles

1. **Any stage can be the entry point** - Start with world elements, scenes, or story
2. **Existing elements are NEVER auto-deleted** - Nothing is overwritten without explicit user action
3. **Append-only auto-generation** - New elements from story are added to existing ones
4. **Smart matching** - Story generation matches existing elements by name, role, description

### Current Workflow Stages

**Story Stage:**
- Generate new story from prompt
- Edit existing story with new prompt
- Edit story manually
- Smart expand with AI
- Branch from any version in history
- Auto-extracts world elements from story

**World Stage:** (UI label: "World")
World elements are reusable across scenes. Four types:
- `character` - People, creatures, anything with agency
- `location` - Places where scenes occur
- `object` - Physical items, props, vehicles
- `concept` - Abstract ideas key to the plot (curses, prophecies, secrets)

Each element can:
- Have description enhanced with ChatGPT
- Have multiple images generated (latest is active by default)
- Be dragged (via sidebar thumbnail) into scenes

**Scene Stage:**
- Compose scenes by assigning world elements
- Generate poster images for each scene
- Drag scenes to Storyboard
- Manual generation trigger (not automatic)

**Storyboard Stage:**
- Drag scenes from Scene section
- Reorder scenes within storyboard
- Edit timing and transitions
- Preview storyboard
- Send to video generation

**Video Stage:**
- Generate video from storyboard
- Poll for completion status
- Preview completed video
- Download final output

## State Management

The library manages complex state transitions through the video creation process. This is **the core complexity** and value of SidVid.

### Key Design Decisions

- **No undo/redo** - Use branching from history instead
- **Non-linear workflow** - Any stage can be entry point
- **Append-only** - New elements added, never auto-deleted
- **Smart matching** - Story generation references existing elements

### State Machine Documentation

See `@.llm/context/STATE-WORKFLOW-SPEC.md` for complete state machine specification including:
- All states and transitions
- UI visual states and interactions
- CLI commands
- Session-level state interfaces

## Development Status

### Completed (~30%)
- Headless library core structure
- Stateless API methods (SidVid class)
- Session management with history
- Storage adapters (memory, browser, file)
- API integrations (ChatGPT, DALL-E, Kling)
- TypeScript types and Zod schemas

### In Progress (~50% UI, ~10% CLI)
- Reference UI workflow implementation
- World element management UI
- Scene composition UI
- Storyboard editor
- CLI basic commands

### Planned
- Complete CLI parity with UI
- More robust error handling
- Performance optimizations
- Plugin system for custom AI providers

## Technical Architecture

### API Integrations
- **OpenAI ChatGPT** - Story generation, element enhancement, prompts
- **OpenAI DALL-E 3** - Element and scene image generation
- **Kling AI** - Video generation with audio

### State Management
- Session-based workflow tracking
- History management with branching
- Pluggable storage adapters:
  - `MemoryStorageAdapter` - In-memory (default)
  - `BrowserStorageAdapter` - localStorage/IndexedDB
  - `FileStorageAdapter` - File system (Node.js)

### Data Validation
- Zod schemas for all data types
- Runtime type safety
- API response validation

### UI Stack (Reference Implementation)
- SvelteKit 2 (full-stack framework)
- Svelte 5 (with runes)
- Tailwind CSS (styling)
- shadcn-svelte (UI components)
- Zod (validation)

## Design Philosophy

1. **Headless First**: Core library is framework-agnostic
2. **State Management**: Focus on workflow orchestration, not just API calls
3. **Developer Tool**: Build for developers to integrate, not end-users
4. **Exploratory Workflow**: Support iteration and fine-tuning
5. **Clean Code**: Maintainable, well-typed, well-tested
6. **Open Source**: MIT license, community-driven

## Use Cases

### For Library Users (Developers)
Integrate SidVid into custom applications:
```typescript
import { SidVid } from 'sidvid';
const sidvid = new SidVid({ openaiApiKey });
const story = await sidvid.generateStory({ prompt: 'A detective story' });
```

### For Content Creators (UI)
Use reference UI for video creation:
1. Enter story prompt (or start with world elements)
2. Generate and refine story
3. Create world element images
4. Compose scenes
5. Build storyboard
6. Generate final video

### For Automation (CLI)
Script video generation workflows:
```bash
sidvid story generate "A detective story"
sidvid world list
sidvid scene add-element scene-1 alice-id
sidvid storyboard add-scene scene-1
sidvid video generate
```

## Non-Features (Deliberately Excluded)

- Real-time collaboration
- Cloud hosting/backend services
- User authentication (library doesn't need it)
- Video editing (focus on generation)
- Direct video upload to platforms
- Undo/redo (use history branching instead)
