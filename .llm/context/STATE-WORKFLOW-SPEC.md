# SidVid Workflow State Machine

This document defines all possible states and transitions in the SidVid video generation workflow. Use this as a reference when implementing UI, CLI, or library features.

## Data

See [SCHEMAS-SPEC.md](./SCHEMAS-SPEC.md) for JSON structures produced at each stage.

## Workflow Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SESSION LIFECYCLE                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────┐   ┌────────┐   ┌───────┐   ┌───────────┐   ┌─────┐             │
│  │ PROJECT │──▸│ STORY  │◂─▸│ WORLD │──▸│STORYBOARD │──▸│VIDEO│             │
│  └─────────┘   └────────┘   └───────┘   └───────────┘   └─────┘             │
│                     │            │             │            │                 │
│                     ▼            ▼             ▼            ▼                 │
│               ◂─────────── Users can go back and modify any stage ──────────▸│
│               ◂─────────── Users can START at any content stage ────────────▸│
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**5 Stages:** Project → Story → World → Storyboard → Video

---

## UI Layout

### Top Bar

The top bar changes based on sidebar state:

**Sidebar Open:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [☰]                                                         [🌙/☀️]         │
└──────────────────────────────────────────────────────────────────────────────┘
     ↑                                                              ↑
  Collapse                                                    Light/Dark
  sidebar                                                       toggle
```

**Sidebar Collapsed:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [☰]                        [SidVid logo small]                [🌙/☀️]       │
└──────────────────────────────────────────────────────────────────────────────┘
     ↑                              ↑                               ↑
  Expand                     Centered logo                    Light/Dark
  sidebar                    (horizontal)                       toggle
```

### Left Sidebar

The sidebar is collapsible. When collapsed, it is completely hidden.

**Sidebar Layout (when open):**

```
┌──────────────────────────────────┐
│                                  │
│  ┌────────────────────────────┐  │
│  │  [SidVid Graffiti Logo]    │  │  ← logo-no-ice.png (light mode)
│  │                            │  │    logo-no-ice-white.png (dark mode)
│  └────────────────────────────┘  │
│                                  │
│  Dashboard                       │  ← Links to / (bold if current page)
│    Project                       │  ← Indented, links to /project
│    Story                         │  ← Indented, links to /story
│    World                         │  ← Indented, links to /world
│    Storyboard                    │  ← Indented, links to /storyboard
│    Video                         │  ← Indented, links to /video
│                                  │
│  ─────────────────────────────── │  ← Divider (only if content below)
│                                  │
│  World Elements                  │  ← Only shows if any exist
│    Characters                    │  ← Only shows if characters exist
│      [🖼][🖼][🖼]                 │  ← Tiny thumbnails, horizontal row
│    Locations                     │  ← Only shows if locations exist
│      [🖼][🖼]                     │
│    Objects                       │  ← Only shows if objects exist
│      [🖼]                         │
│    Concepts                      │  ← Only shows if concepts exist
│      [🖼][🖼]                     │
│                                  │
│  ─────────────────────────────── │
│                                  │
│  ┌────────────────────────────┐  │
│  │   [Sid mascot image]       │  │  ← Punk rock character at bottom
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

### Sidebar Behavior

| Element | Behavior |
|---------|----------|
| **Navigation links** | Click to navigate; **bold** indicates current page |
| **World Element thumbnails** | Show active image; draggable to Storyboard on `/` or `/storyboard` |
| **Sidebar width** | Fixed width |

### Drag and Drop

**Visual Feedback:**
- Semi-transparent ghost of dragged thumbnail follows cursor
- Original thumbnail stays in place, slightly dimmed
- Valid drop zones get highlighted border (e.g., dashed blue)
- Invalid areas show "no-drop" cursor
- On drop, brief settle animation

**Context-Aware Dragging:**

| Current Page | World Elements Draggable To |
|--------------|----------------------------|
| `/` (Dashboard) | Storyboard section |
| `/storyboard` | Storyboard section |
| Other pages | Not draggable |

### Mobile Behavior

On mobile/small screens:
- Sidebar replaced by hamburger menu icon
- Menu opens as overlay/drawer
- Same content as desktop sidebar
- Drag and drop not supported on mobile

### Routes

| Route | Content |
|-------|---------|
| `/` | Dashboard - all 5 sections stacked vertically |
| `/project` | Project section + list of all projects with pencil/trash icons |
| `/story` | Story section only |
| `/world` | World section only |
| `/storyboard` | Storyboard section only |
| `/video` | Video section only |

**Route-specific behavior:**
- Each route shows same content as its section on dashboard
- Exception: `/project` includes a full project list (see below)

### Project Page (`/project`)

The `/project` page extends the dashboard Project section with a full list:

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT                                                         │
│  Name your project                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  New Project [✏️] [🗑️]                                           │
│                                                                  │
│  (when 2+ projects exist:)                                      │
│  [Select project... ▼]                                          │
│                                                                  │
│  [+ New Project]                                                │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  All Projects:                                                   │
│                                                                  │
│  My First Video [✏️] [🗑️]                                        │
│  Anime Short [✏️] [🗑️]                                           │
│  New Project [✏️] [🗑️]    ← current project highlighted         │
│  Test Project [✏️] [🗑️]                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Each project in the list has pencil (rename) and trash (delete) icons that behave identically to those next to the current project name.

---

## Non-Linear Workflow

Users can start at **any stage**, not just Story. The workflow is flexible:

### Core Principles

1. **Any stage can be the entry point** - Users may start by creating world elements, scenes, or story
2. **Existing elements are NEVER auto-deleted** - Nothing is overwritten without explicit user action
3. **Append-only auto-generation** - New elements from story are added to existing ones
4. **User controls deletion** - To start fresh, user manually deletes elements first

### Cross-Stage Interaction

| Starting Point | Later Action | Behavior |
|----------------|--------------|----------|
| World elements created first | Generate story | Story is written *about* existing elements; new elements from story are appended |
| Scenes created first | Generate story | Story incorporates existing scenes; new scenes from story are appended |
| Story created first | Generate story again | New elements from updated story are appended to existing world elements |

### Example Flows

**Traditional flow:** Story → World → Storyboard → Video

**Character-first flow:** Create "Alice" and "Bob" in World → Generate story about them → Story references Alice and Bob, may add new elements → Scenes generated

**Scene-first flow:** Create scene descriptions → Generate story from scenes → World elements extracted from story

## Story Generation Behavior

When generating, editing, or smart-expanding a story, the system uses existing world elements as context.

### Smart Matching Rules

The system matches references in the story to existing world elements using (in priority order):

1. **Exact name match** - "Alice" → existing element named Alice
2. **Partial/nickname match** - "Al" or "Captain Alice" → Alice
3. **Role match** - "the pirate" → element with role/type pirate
4. **Description match** - "the tall woman with red hair" → element matching that description
5. **Contextual match** - "the ship's captain" → element who captains a ship

### Matching Behavior

- **Assume existing over new** - When in doubt, match to existing element rather than creating new
- **Only create new when unmatched** - New elements are only created when no existing element fits
- **Apply to all element types** - Characters, locations, objects, and concepts all use smart matching

### Story Generation System Prompt (Internal)

When generating stories, the LLM receives:
- All existing world elements as context
- Instructions to incorporate existing elements where they fit naturally
- Smart matching rules to avoid creating duplicates
- Output metadata indicating which elements were used vs. newly introduced

### Output Metadata

Story generation returns:
- `existingElementsUsed: [ids...]` - Which existing elements were referenced
- `newElementsIntroduced: [{name, type, description}...]` - New elements to be appended

## Story Creation Pipeline

When a user submits a story prompt, the following auto-generation sequence executes:

```
User submits story prompt
    │
    ▼
┌─────────────────────────────────────────┐
│  1. STORY GENERATION (ChatGPT)          │
│  - Generate story from prompt           │
│  - Extract characters, locations,       │
│    objects, concepts                    │
│  - Smart match against existing         │
│    world elements                       │
└─────────────────────────────────────────┘
    │
    │  Story + newElementsIntroduced
    ▼
┌─────────────────────────────────────────┐
│  2. WORLD ELEMENT CREATION              │
│  - Create WorldElement for each new     │
│    element from story                   │
│  - Existing matched elements unchanged  │
└─────────────────────────────────────────┘
    │
    │  WorldElement[] (with IDs)
    ▼
┌─────────────────────────────────────────┐
│  3. WORLD ELEMENT IMAGE GENERATION      │
│  - Generate DALL-E image for each       │
│    NEWLY CREATED element only           │
│  - Matched existing elements: NO        │
│    image regeneration                   │
│  - User-edited elements: NO             │
│    image regeneration                   │
└─────────────────────────────────────────┘
    │
    │  WorldElement[] (with images)
    ▼
┌─────────────────────────────────────────┐
│  4. SCENE CREATION                      │
│  - Create Scene for each story.scenes[]│
│  - Auto-assign referenced world         │
│    elements to each scene               │
└─────────────────────────────────────────┘
    │
    │  Scene[] (with assigned elements)
    ▼
┌─────────────────────────────────────────┐
│  5. SCENE POSTER IMAGE GENERATION       │
│  - Generate DALL-E poster image for     │
│    each scene                           │
│  - Uses scene description + assigned    │
│    world element images as context      │
└─────────────────────────────────────────┘
    │
    │  Scene[] (with images)
    ▼
┌─────────────────────────────────────────┐
│  6. STORYBOARD AUTO-POPULATION          │
│  - Create storyboard with all scenes    │
│    in order                             │
│  - Each entry: 5s duration              │
│  - User can reorder/remove/add later    │
└─────────────────────────────────────────┘
    │
    ▼
Pipeline complete - UI shows all stages populated
```

### Image Generation Rules on Story Regeneration

When a story is regenerated or edited:

| Element Type | Condition | Image Behavior |
|--------------|-----------|----------------|
| World Element | Newly created from story | Auto-generate image |
| World Element | Matched existing element | **No image regeneration** |
| World Element | User has edited description | **No image regeneration** |
| World Element | User manually regenerated | Keep user's image |
| Scene | Newly created from story | Auto-generate poster image |
| Scene | Existing scene updated | **No image regeneration** |

**Key principle**: User modifications are respected. If a user has customized an element or its image, story regeneration will not overwrite their work.

### Manual Regeneration

Users can always manually regenerate images:
- World elements: Click regenerate button on element
- Scenes: Click regenerate button on scene

Manual regeneration adds a new image version (see Image Version Management sections).

## Stage 1: Project

The Project stage is the entry point for all SidVid workflows. Every session operates within a project context.

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT                                                         │
│  Name your project                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  New Project [✏️] [🗑️]                                           │
│                                                                  │
│  (when 2+ projects exist:)                                      │
│  [Select project... ▼]                                          │
│                                                                  │
│  [+ New Project]                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Project Actions

| Element | Action |
|---------|--------|
| **Project name (H2)** | Displays current project name, defaults to "New Project" |
| **Pencil icon (✏️)** | Click to edit project name inline; Enter or blur saves |
| **Trash icon (🗑️)** | Delete project with confirmation modal |
| **Project dropdown** | Only visible when 2+ projects exist; switch between projects |
| **+ New Project button** | Create new project (name: "New Project", or "New Project (1)" if taken) |

### States

| State | Description |
|-------|-------------|
| `ACTIVE` | Project loaded, user working in it |
| `RENAMING` | Project name being edited inline |
| `LOADING` | Switching to a different project |
| `DELETING` | Delete confirmation modal shown |

### Transitions

```
ACTIVE ──[click pencil]──▸ RENAMING
RENAMING ──[enter/blur]──▸ ACTIVE
ACTIVE ──[select from dropdown]──▸ LOADING
LOADING ──[success]──▸ ACTIVE
ACTIVE ──[click trash]──▸ DELETING
DELETING ──[confirm]──▸ ACTIVE (new blank project)
DELETING ──[cancel]──▸ ACTIVE
ACTIVE ──[click + New Project]──▸ ACTIVE (new blank project)
```

### Persistence

- Current project saved to **localStorage/cookies** automatically
- On page refresh, current project reloads (SPA-style, no data loss)
- Switching projects or creating new project does NOT cause page reload
- All project data (story, world elements, scenes, storyboard, video) persisted per-project

### Delete Confirmation Modal

```
┌─────────────────────────────────────────────────┐
│  Delete Project                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Are you sure you want to delete "My Video"?    │
│                                                  │
│  This action is irreversible. All story,        │
│  characters, scenes, and video data will be     │
│  permanently deleted.                           │
│                                                  │
│                    [Cancel]  [Delete]           │
└─────────────────────────────────────────────────┘
```

### Default Naming

- New projects default to "New Project"
- If "New Project" exists, use "New Project (1)", "New Project (2)", etc.
- Name uniqueness is enforced across all user projects

### Auto-Save Behavior

- Auto-save triggers on significant changes (debounced)
- Save indicator shows sync status
- Unsaved changes warning on close/switch

### CLI Commands

```bash
# List all projects
sidvid project list

# Create new project
sidvid project create "My Video"

# Open/switch to project
sidvid project open <project-id>

# Show current project info
sidvid project info

# Delete project
sidvid project delete <project-id>

# Rename project
sidvid project rename <project-id> "New Name"

# Export project to JSON
sidvid project export <project-id> --output ./backup.json

# Import project from JSON
sidvid project import ./backup.json
```

## Stage 2: Story

### Section Header

```
┌─────────────────────────────────────────────────────────────────┐
│  STORY                                                           │
│  Create your story text                                          │
├─────────────────────────────────────────────────────────────────┤
```

### Story Generation Input

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | Yes | Story idea/concept |
| `targetDuration` | Yes | Total video length in **5-second increments** (5, 10, 15, 20, ...) |
| `style` | Yes | Visual style preset or custom prompt (see Style System below) |

The AI generates `targetDuration / 5` scenes, each with a fixed 5-second duration.

> **v2 TODO**: Support variable scene durations (5s or 10s) based on scene complexity.

### Style System

The style setting controls the visual aesthetic of all generated images and videos. It is set at story creation and applies project-wide.

**Style Presets:**

| Preset | Description |
|--------|-------------|
| `anime` | Anime/cel-shaded, 2D animation style |
| `photorealistic` | Cinematic, hyperrealistic rendering |
| `3d-animated` | Pixar/3D animated style |
| `watercolor` | Soft, painterly watercolor aesthetic |
| `comic` | Bold lines, comic book style |
| `custom` | User-defined style prompt |

**UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Style: [Anime ▼]                                               │
│                                                                  │
│  (or if custom selected:)                                       │
│  Style: [Custom ▼]                                              │
│  Custom prompt: [anime style, cel-shaded, studio ghibli...]    │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Style prompt is prepended to all DALL-E (world elements, scenes) and video generation calls
- Presets include optimized prompts with positive and negative terms (e.g., "NOT photorealistic")
- Custom style allows full control for advanced users
- Changing style does NOT auto-regenerate existing images (user must manually regenerate)

### States

| State | Description |
|-------|-------------|
| `EMPTY` | No story exists, prompt input shown |
| `GENERATING` | API call in progress, spinner shown |
| `GENERATED` | Story exists, can edit or proceed |
| `EDITING` | Manual edit mode (structured text fields) |
| `EDITING_WITH_PROMPT` | Prompt-based edit in progress |
| `ERROR` | Generation failed, error shown |

### Transitions

```
EMPTY ──[enter prompt]──▸ GENERATING
GENERATING ──[success]──▸ GENERATED
GENERATING ──[failure]──▸ ERROR
GENERATED ──[regenerate]──▸ GENERATING
GENERATED ──[edit manually]──▸ EDITING
GENERATED ──[edit with prompt]──▸ EDITING_WITH_PROMPT
GENERATED ──[smart expand]──▸ GENERATING
GENERATED ──[branch from history]──▸ GENERATED (continue from earlier version)
GENERATED ──[auto]──▸ WORLD stage (world elements auto-populated from story)
EDITING ──[save]──▸ GENERATED
EDITING ──[cancel]──▸ GENERATED
EDITING_WITH_PROMPT ──[success]──▸ GENERATED
EDITING_WITH_PROMPT ──[failure]──▸ ERROR
ERROR ──[retry]──▸ GENERATING
ERROR ──[dismiss]──▸ EMPTY or GENERATED (depending on history)
```

### User Actions at GENERATED State

1. **Regenerate** - Generate a different story variation using the same prompt
2. **Edit Story Manually** - Edit story fields directly
3. **Edit Story with Prompt** - Send edit instruction to ChatGPT
4. **Smart Expand** - AI automatically expands story with more detail
5. **Branch from History** - Continue from any previous version

Note: World elements (characters, locations, objects, concepts) are automatically extracted from the story. See "World Element Auto-Generation" below for details on how this interacts with existing elements.

### Smart Expand Behavior (Story)

| Condition | Action |
|-----------|--------|
| **First smart expand** (`!isSmartExpanded`) | Save `narrative` → `preExpansionNarrative`, generate expanded narrative, set `isSmartExpanded = true` |
| **Subsequent smart expand** (redo) | Regenerate from `preExpansionNarrative` (get different result, NOT longer) |
| **After manual edit** | If user edits narrative after expansion, the edited content becomes the new source for future expansions |

**Smart Expand AI Prompt Inputs (Story):**

| Input | Source | Purpose |
|-------|--------|---------|
| **Narrative to expand** | `preExpansionNarrative` (redo) or `narrative` (first) | Core content to enhance |
| **Original prompt** | `story.prompt` | User's original intent |
| **Style** | `story.style` | Tone/aesthetic guidance |
| **Target duration** | `story.targetDuration` | Pacing context (scene count) |
| **Existing world elements** | `project.worldElements` (names + types) | Characters/locations to incorporate |

The redo ensures users can get variations without infinite expansion.

### History Model

All story versions remain visible in the UI. Each version shows its prompt and the resulting story. Each version has action buttons, allowing users to branch from any point. When branching, subsequent versions are discarded and the user continues from the selected version.

### Scene Display in Story

When viewing a generated story, scenes are displayed with badges:
- First line: "Scene [x]" badge + "[y]s" duration badge
- Second line: "[title]" badge (if title exists)
- Example: [Scene 1] [5s] then [Castle Approach] on next line

**In Manual Edit mode**, scene cards show:
- Header: [Scene [x]] [5s] badges (not editable in header)
- Title field: editable text input with current title
- Editable fields for description, dialog, and action

## Stage 3: World

The World section (UI label: "World") contains all reusable story elements. On the backend, these are called "world elements."

### Section Header

```
┌─────────────────────────────────────────────────────────────────┐
│  WORLD                                                           │
│  Create world elements                                           │
├─────────────────────────────────────────────────────────────────┤
```

### Element Types

| Type | Description | Examples |
|------|-------------|----------|
| `character` | People, creatures, anything with agency | Alice, the pirate Jim, a wise wizard |
| `location` | Places where scenes occur | The castle, dark forest, spaceship bridge |
| `object` | Physical items, props, vehicles | Magic gem, treasure map, the spaceship |
| `concept` | Abstract ideas key to the plot | A curse, a prophecy, a family secret |

### States

| State | Description |
|-------|-------------|
| `EMPTY` | No elements, can add manually |
| `EXTRACTED` | Elements extracted from story metadata |
| `ENHANCING` | Element description being enhanced |
| `GENERATING_IMAGE` | Element image being generated |
| `READY` | Element has enhanced description and/or image |
| `ERROR` | Enhancement or image generation failed |

### Per-Element State

Each world element independently tracks:
- `id` - Unique identifier
- `name` - Display name
- `type` - character | location | object | concept
- `description` - Original or enhanced description
- `enhancedDescription` - ChatGPT-enhanced description (optional)
- `images` - Array of generated images, each with:
  - `id` - Unique identifier
  - `imageUrl` - Generated image URL
  - `revisedPrompt` - DALL-E's revised prompt
  - `isActive` - Whether this is the active image (only one can be active)
  - `createdAt` - Timestamp of generation
- `historyIndex` - Current position in element history
- `history` - Array of all versions

### Image Version Management

- Latest generated image is **active by default**
- Only one image can be active at a time per element
- Non-active images display a **trashcan icon** for deletion
- Non-active images can be **selected to become active**
- Active image is used in scenes and storyboard

### World Element Auto-Generation

When a story is generated, edited, or smart-expanded:

| Scenario | Behavior |
|----------|----------|
| No world elements exist | All elements (characters, locations, objects, concepts) are auto-extracted from story |
| World elements exist | Only NEW elements implied by the story are auto-created and appended |
| Element matches existing | Existing element is referenced, not duplicated (see Smart Matching below) |

**Key principle: Existing elements are NEVER auto-deleted or overwritten.** Users must manually delete elements if they want a fresh start.

### Transitions

```
EMPTY ──[extract from story]──▸ EXTRACTED
EMPTY ──[add custom element]──▸ EXTRACTED
EXTRACTED ──[enhance description]──▸ ENHANCING
ENHANCING ──[success]──▸ READY (with enhanced description)
ENHANCING ──[failure]──▸ ERROR
READY ──[generate image]──▸ GENERATING_IMAGE
GENERATING_IMAGE ──[success]──▸ READY (with image)
GENERATING_IMAGE ──[failure]──▸ ERROR
READY ──[branch from history]──▸ READY (continue from earlier version)
READY ──[re-enhance]──▸ ENHANCING
READY ──[regenerate image]──▸ GENERATING_IMAGE
READY ──[auto]──▸ SCENES stage (scenes auto-populated from story)
ERROR ──[retry]──▸ ENHANCING or GENERATING_IMAGE
```

### User Actions at READY State (per element)

1. **Enhance Description** - Get ChatGPT to expand description
2. **Generate Image** - Create new image with DALL-E (becomes active, previous images retained)
3. **Re-enhance** - Enhance again (different result)
4. **Select Active Image** - Choose which image version to use (non-active images only)
5. **Delete Image** - Remove a non-active image version (trashcan icon)
6. **Branch from History** - Continue from earlier element version
7. **Edit Manually** - Edit description text
8. **Remove** - Delete element (see Cascade Deletion below)

### Enhance Description Behavior (World Elements)

| Condition | Action |
|-----------|--------|
| **First enhance** (`!isEnhanced`) | Save `description` → `preEnhancementDescription`, generate enhanced description, set `isEnhanced = true` |
| **Subsequent enhance** (redo) | Regenerate `enhancedDescription` from `preEnhancementDescription` (get different result, NOT longer) |
| **After manual edit of description** | Clear `isEnhanced`, edited `description` becomes new source for future enhancements |

**Enhance AI Prompt Inputs (World Element):**

| Input | Source | Purpose |
|-------|--------|---------|
| **Description to enhance** | `preEnhancementDescription` (redo) or `description` (first) | Core content to expand |
| **Element name** | `element.name` | Identity context |
| **Element type** | `element.type` | character/location/object/concept - guides detail focus |
| **Project style** | `project.currentStory.style` | Tone/aesthetic guidance |
| **Story context** | `project.currentStory.title` + brief narrative summary (if exists) | How element fits in story |

The redo ensures users can get variations without infinite enhancement.

### Cascade Deletion (World Elements)

When deleting a world element that is assigned to scenes:

1. **Warning dialog** - "This element is used in X scenes. Deleting it will remove it from those scenes."
2. **User confirms** - Element is deleted
3. **Cascade behavior**:
   - Element removed from all scenes' `assignedElements` arrays
   - Scenes remain (just with fewer elements)
   - Scene poster images NOT auto-regenerated (user can manually regenerate if desired)

### UI Filtering

The World section can display filter tabs or tags:
- `All` | `Characters` | `Locations` | `Objects` | `Concepts`

### Sidebar Thumbnails

World elements appear as **thumbnails in the left sidebar** (see UI Layout section for full sidebar spec):
- Grouped by type: Characters, Locations, Objects, Concepts
- Each category only shows if elements of that type exist
- Shows the element's **active image** (or placeholder if none)
- Thumbnails display in horizontal rows, wrapping if needed
- Hover shows element name in tooltip
- **Thumbnails are draggable** onto scenes (on Dashboard or `/storyboard` page only)
- Elements in the main World section are NOT directly draggable (only sidebar thumbnails)

## Stage 4: Storyboard

The Storyboard is where scenes are created, arranged, and prepared for video generation. Each scene generates a "poster image" that serves as the visual for that segment of the video.

### Section Header

```
┌─────────────────────────────────────────────────────────────────┐
│  STORYBOARD                                                      │
│  Create and arrange your scenes                                  │
├─────────────────────────────────────────────────────────────────┤
```

### Pipeline States

| State | Description |
|-------|-------------|
| `UNINITIALIZED` | No scenes, needs initialization from story |
| `INITIALIZED` | Scenes created from story |
| `GENERATING` | One or more scenes generating images |
| `COMPLETE` | All scenes have images |
| `PARTIAL` | Some scenes complete, some pending/failed |

### Per-Scene States

| State | Description |
|-------|-------------|
| `EMPTY` | Scene created, no elements assigned |
| `PENDING` | Elements assigned, awaiting image generation |
| `GENERATING` | Poster image generation in progress |
| `COMPLETED` | Poster image generated successfully |
| `FAILED` | Image generation failed |

### Scene Properties

Each scene tracks:
- `id` - Unique identifier
- `description` - From story or custom
- `customDescription` - User override (optional)
- `enhancedDescription` - ChatGPT-enhanced description (optional)
- `assignedElements` - World element IDs (characters, locations, objects, concepts)
- `images` - Array of generated poster images, each with:
  - `id` - Unique identifier
  - `imageUrl` - Generated image URL
  - `revisedPrompt` - DALL-E's revised prompt
  - `isActive` - Whether this is the active image (only one can be active)
  - `createdAt` - Timestamp of generation
- `status` - empty | pending | generating | completed | failed
- `error` - Error message (if failed)

### Scene Image Version Management

- Latest generated image is **active by default**
- Only one image can be active at a time per scene
- Non-active images display a **trashcan icon** for deletion (except when only one image exists)
- Non-active images can be **selected to become active**
- Active image is used in Storyboard
- When world element images change, Storyboard auto-shows the new active scene image

### Scene Titles

Each scene has a short descriptive title:
- **3 words preferred**, 5 words max
- Avoid filler words: "of", "the", "a", "an", etc.
- Example: "Cyber Capybara Hack" NOT "Hack Tactics of the Cyber Capybaras"
- Generated by AI when story creates scenes
- Editable by user in scene edit modal

### Scene Card UI

**World Element Pill Colors:**

| Element Type | Color |
|--------------|-------|
| Character | Blue (`#3B82F6`) |
| Location | Green (`#22C55E`) |
| Object | Orange (`#F97316`) |
| Concept | Purple (`#A855F7`) |

**Scene Card Layout (without image):**

```
┌───────────────────────────────────────┐
│ [Scene 1] [5s]           [⧉] [📦] [×]│  ← Scene # + duration badges + icons
│ [Castle Approach]                     │  ← Title badge (2nd line)
│                                       │
│ Alice approaches the ancient castle   │  ← Description (2 lines max,
│ gates as the sun sets behind...       │     truncated with "...")
│                                       │
│ [Alice] [Bob]   [Castle]              │  ← World element pills (2 cols)
│ [Gem]           [Forest]              │     colored by type
└───────────────────────────────────────┘
   (solid border - all scenes have solid borders)
```

**Scene Card Layout (with image):**

```
┌───────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Semi-transparent black overlay
│▓[Scene 1] [5s]          [⧉] [📦] [×]▓│  ← Scene # + duration + icons
│▓[Castle Approach]                    ▓│  ← Title badge (2nd line)
│▓                                     ▓│
│▓Alice approaches the ancient castle  ▓│  ← Description (2 lines max)
│▓gates as the sun sets behind...      ▓│
│▓                                     ▓│
│▓[Alice] [Bob]   [Castle]             ▓│  ← World element pills
│▓[Gem]           [Forest]             ▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ [Abc]                                 │  ← Text toggle icon (bottom left)
│         [    Poster Image    ]        │  ← Image visible below overlay
│                                       │
└───────────────────────────────────────┘
```

**Text Visibility Toggle:**
- `[Abc]` icon (bottom left): Shows text/badges/overlay (default state)
- Click `[Abc]` → hides text, badges, overlay; shows `[👁]` eye icon
- Click `[👁]` → restores text, badges, overlay; shows `[Abc]` icon
- Hover anywhere on scene card: pointer cursor (hand)

**New Scene Button (always rightmost):**

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                  │
│                  │
│       [+]        │  ← Centered plus icon
│                  │
│                  │
└ ─ ─ ─ ─ ─ ─ ─ ─ ┘
   (dashed border)
```

- Always appears to the right of the last scene
- Click: Creates new blank scene (solid border) to its left
- Drag world element onto it: Creates new scene with that element, title "Scene [x]"

### Scene Card Elements

| Element | Description |
|---------|-------------|
| **Scene number badge** | "Scene [x]" - blue badge, left side of first line. |
| **Duration badge** | "[y]s" (e.g., "5s") - blue badge, to right of scene number badge. |
| **Title badge** | "[title]" - blue badge on second line (only shows if title exists). |
| **Clone icon (⧉)** | Right side of first line, left of archive icon. Click to clone scene. |
| **Archive icon (📦)** | Right side of first line, between clone and delete. Click to archive scene. |
| **Red X** | To the right of archive icon. Deletes the scene (with confirmation). |
| **Description** | 2 lines max, truncated with "..." |
| **Element pills** | Colored by type, 2 columns max. Shows "..." pill if overflow. Contains element name (truncated if needed). |
| **Text toggle** | Bottom left when image exists. Toggles text/overlay visibility. |
| **Poster image** | Shows below overlay when scene has generated image. |

### Scene Numbering

- Scenes numbered 1, 2, 3... from left to right
- Reordering scenes **instantly renumbers** all scenes
- Moving a scene to position 1 gives it number 1; all others shift accordingly

### Scene Click Actions

| Click Target | Action |
|--------------|--------|
| **Scene/duration/title badges / description / pills** | Opens scene edit modal |
| **Clone icon (⧉)** | Clones scene (inserts copy immediately after, see Clone Scene Behavior) |
| **Archive icon (📦)** | Archives scene (moves to Archived Scenes section) |
| **Red X** | Deletes the scene (with confirmation) |
| **Text toggle icon** | Toggles text/overlay visibility |
| **Scene card body** (when dragging) | Drag to reorder within Storyboard |
| **New Scene button (+)** | Creates new blank scene |

### Scene Edit Modal

Single-clicking a scene card opens a centered modal with semi-transparent black page overlay:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [Scene 3] [5s]                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  Title                                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Castle Approach                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Description                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Alice approaches the ancient castle gates as the sun sets   ││
│  │ behind the mountains. The drawbridge is down.               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Dialog                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ "We've finally arrived," Alice whispered.                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Action                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Alice walks slowly toward the gate, looking up in wonder.   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│  (World Elements section - only shows if scene has elements)     │
│                                                                  │
│  Characters        Locations        Objects         Concepts     │
│  [🖼 Alice]        [🖼 Castle]      [🖼 Gem]                     │
│  [🖼 Bob]          [🖼 Forest]                                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│                                    [Cancel]  [Save Changes]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Modal World Elements Section:**
- Only displays if scene has assigned world elements
- 4 columns: Characters, Locations, Objects, Concepts
- Each column only shows if scene has elements of that type
- Pills show: tiny thumbnail + element name (truncated with "..." if needed)
- Pills are colored by type (same colors as scene card)
- Pills are **not clickable** (display only)

### Archived Scenes Section

At the bottom of the Storyboard section, below all active scenes and the New Scene button:

**When no archived scenes exist:**
```
───────────────────────────────────────────────────────────────

Archived Scenes

You have no archived scenes                    ← Small gray text
```

**When archived scenes exist:**
```
───────────────────────────────────────────────────────────────

Archived Scenes

[🖼] [🖼] [🖼]                                  ← Small thumbnails (poster images)
```

**Archived Scene Behavior:**
- Thumbnails show the scene's active poster image (or placeholder if none)
- Click thumbnail → opens same scene edit modal as active scenes
- In modal, archive icon shows as "unarchive" action (📤 or similar)
- Clicking unarchive moves scene back to active scenes (appended to end)
- **Drag-to-unarchive**: Drag archived thumbnail to a position in the active scenes area → unarchives AND inserts at that position
- Archived scenes do NOT count toward scene numbering (Scene 1, 2, 3... only counts active)
- Archived scenes can still be edited, regenerated, etc. via modal

### UI Visual States

| Visual State | Border |
|--------------|--------|
| Scene (any state) | Solid, rounded |
| New Scene button | Dashed, rounded |

### World Element Sidebar (UI)

See UI Layout section for full sidebar specification. When on the Dashboard (`/`) or Storyboard page (`/storyboard`), world element thumbnails in the sidebar can be dragged onto scenes:

```
┌──────────┬──────────────────────────────────────────────┐
│ SIDEBAR  │  STORYBOARD                                  │
├──────────┤                                              │
│Characters│  ┌───────────────┐  ┌ ─ ─ ─ ─ ─ ─ ┐        │
│ [🖼][🖼] │  │ Alice, Castle │  │              │        │
│Locations │  │               │  │              │        │
│ [🖼]     │  │ [+]      [🗑] │  │  [+]         │        │
│          │  └───────────────┘  └ ─ ─ ─ ─ ─ ─ ┘        │
│  drag ─────────────▶                                   │
└──────────┴──────────────────────────────────────────────┘
```

### Image Generation

- **Manual trigger required** - Adding/removing elements does NOT auto-generate
- User must click "Generate" to create/regenerate the poster image
- Poster image incorporates all assigned world elements

### Transitions

```
UNINITIALIZED ──[initialize from story]──▸ INITIALIZED
INITIALIZED ──[generate all pending]──▸ GENERATING
INITIALIZED ──[generate single scene]──▸ GENERATING
GENERATING ──[all complete]──▸ COMPLETE
GENERATING ──[some complete, some pending]──▸ PARTIAL
GENERATING ──[all failed]──▸ PARTIAL
PARTIAL ──[generate pending]──▸ GENERATING
PARTIAL ──[regenerate failed]──▸ GENERATING
COMPLETE ──[regenerate scene]──▸ GENERATING
COMPLETE ──[add scene]──▸ PARTIAL
COMPLETE ──[remove scene]──▸ COMPLETE or PARTIAL
```

### User Actions

1. **Generate All Pending** - Generate poster images for all pending scenes
2. **Generate Single Scene** - Generate poster image for one scene
3. **Regenerate Scene** - Generate new poster image for completed scene (adds to image versions)
4. **Add Scene** - Create new empty scene
5. **Clone Scene** - Create a copy of an existing scene (see Clone Scene Behavior below)
6. **Remove Scene** - Delete a scene (with confirmation)
7. **Archive Scene** - Move scene to Archived Scenes section
8. **Unarchive Scene** - Restore archived scene to active scenes
9. **Reorder Scenes** - Drag and drop to reorder within Storyboard
10. **Assign Element** - Add world element via + dropdown or sidebar drag
11. **Unassign Element** - Remove world element from scene
12. **Set Custom Description** - Override scene description
13. **Edit with Prompt** - Send edit instruction to ChatGPT
14. **Smart Expand** - AI automatically expands scene description
15. **Select Active Image** - Choose which image version to use
16. **Delete Image Version** - Remove a non-active image (trashcan icon)

### Clone Scene Behavior

When cloning a scene:

| Property | Behavior |
|----------|----------|
| **New ID** | Clone gets a new unique ID |
| **Title** | Original title + " (1)", or " (2)" if "(1)" exists, etc. |
| **Position** | Inserted immediately after the original scene |
| **isArchived** | Always `false` (clone as active, even if original was archived) |
| **All other fields** | Copied from original (description, customDescription, enhancedDescription, isSmartExpanded, preExpansionDescription, dialog, action, assignedElements, images, duration, status) |
| **Timestamps** | `createdAt` and `updatedAt` set to current time |

**Example:** Cloning "Castle Approach" (Scene 2) creates "Castle Approach (1)" as new Scene 3, shifting subsequent scenes.

### Smart Expand Behavior (Scenes)

| Condition | Action |
|-----------|--------|
| **First smart expand** (`!isSmartExpanded`) | Save `customDescription ?? description` → `preExpansionDescription`, generate enhanced, set `isSmartExpanded = true` |
| **Subsequent smart expand** (redo) | Regenerate `enhancedDescription` from `preExpansionDescription` with full context (get different result, NOT longer) |
| **After manual edit** | If user edits description after expansion, clear `isSmartExpanded`, edited content becomes new source |

**Smart Expand AI Prompt Inputs (Scene):**

| Input | Source | Purpose |
|-------|--------|---------|
| **Description to expand** | `preExpansionDescription` (redo) or `customDescription ?? description` (first) | Core content to enhance |
| **Scene title** | `scene.title` | Context for what scene is about |
| **Scene dialog** | `scene.dialog` (if any) | Spoken lines to incorporate |
| **Scene action** | `scene.action` (if any) | Physical actions to describe |
| **Assigned world elements** | Lookup by `scene.assignedElements` IDs → names + brief descriptions | Who/what to describe in detail |
| **Project style** | `project.currentStory.style` | Tone/aesthetic guidance (anime, photorealistic, etc.) |
| **Other scenes context** | Other scenes' `title` + `description` (brief) | Narrative flow and coherence |

This ensures the AI has sufficient context to generate a rich, coherent scene description that fits the overall story and visual style.

### Cascade Deletion (Scenes)

When deleting a scene:

1. **Warning dialog** - "Are you sure you want to delete this scene? This action cannot be undone."
2. **User confirms** - Scene is deleted
3. **Cascade behavior**:
   - Scene removed from project's `scenes` array
   - Remaining scenes automatically renumber
   - World elements are NOT affected (they exist independently)

### Auto-Population

When a story is generated, the storyboard is **automatically populated** with all scenes in order (see Story Creation Pipeline). Each scene gets:
- Duration: 5 seconds (default)

Users can then reorder, edit, clone, archive, or add new scenes.

### Storyboard Actions

| Element | Action |
|---------|--------|
| **Generate Video** | Proceed to Stage 5 (Video Generation) |
| **Scene card** | Click to open scene edit modal |
| **Clone icon (⧉)** | Clone scene (insert copy after original) |
| **Archive icon (📦)** | Archive scene (move to Archived Scenes section) |
| **Red X** | Delete scene (with confirmation) |
| **Drag scene** | Reorder within storyboard |
| **New Scene (+)** | Create new blank scene |

### CLI Commands

```bash
# List all scenes in storyboard
sidvid storyboard list

# Show scene details (metadata)
sidvid storyboard show <scene-id>

# Add element to scene
sidvid storyboard add-element <scene-id> <element-id>

# Remove element from scene
sidvid storyboard remove-element <scene-id> <element-id>

# Generate poster image for scene
sidvid storyboard generate <scene-id>

# Generate all pending scenes
sidvid storyboard generate-all

# Clone scene (creates new scene with copied content)
sidvid storyboard clone <scene-id>

# Archive scene
sidvid storyboard archive <scene-id>

# Unarchive scene
sidvid storyboard unarchive <scene-id>

# Reorder scene
sidvid storyboard move <scene-id> --to <index>
```

## Stage 5: Video

### States

| State | Description |
|-------|-------------|
| `NOT_STARTED` | Video generation not initiated |
| `GENERATING` | Video generation in progress |
| `POLLING` | Waiting for completion (async) |
| `COMPLETED` | Video ready for download/preview |
| `FAILED` | Video generation failed |

### UI Layout

**Video Area Styling:**
- White border, no background fill
- No rounded corners (square)
- Horizontally centered

**NOT_STARTED state:**
```
┌─────────────────────────────────────────────────────────────────┐
│  VIDEO                                                           │
│  Generate your video                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                                                            │  │
│  │                    No video yet                            │  │
│  │                                                            │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                    [Preview]  [Generate Video]                   │
└─────────────────────────────────────────────────────────────────┘
```

**GENERATING/POLLING state:**
```
┌─────────────────────────────────────────────────────────────────┐
│  VIDEO                                                           │
│  Generate your video                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                                                            │  │
│  │                       [spinner]                            │  │
│  │                                                            │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                    [Preview]  [Generate Video]                   │
└─────────────────────────────────────────────────────────────────┘
```

**COMPLETED state (single version):**
```
┌─────────────────────────────────────────────────────────────────┐
│  VIDEO                                                           │
│  Generate your video                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                    [Video Player]                          │  │
│  │                                                            │  │
│  │                         [▶]                                │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│               [Preview]  [Generate Video]  [Download]            │
└─────────────────────────────────────────────────────────────────┘
```

**COMPLETED state (multiple versions):**
```
┌─────────────────────────────────────────────────────────────────┐
│  VIDEO                                                           │
│  Generate your video                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                    [Video Player]                          │  │
│  │                    (active version)                        │  │
│  │                                                            │  │
│  │                         [▶]                                │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                      [🖼] [🖼•] [🖼]                              │  ← Version thumbnails
│                      [🗑]      [🗑]                              │  ← Trash on non-active
│                                                                  │
│               [Preview]  [Generate Video]  [Download]            │
└─────────────────────────────────────────────────────────────────┘
```

**FAILED state:**
```
┌─────────────────────────────────────────────────────────────────┐
│  VIDEO                                                           │
│  Generate your video                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                                                            │  │
│  │                    No video yet                            │  │
│  │                                                            │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Error: Video generation failed. Please try again.              │
│                                                                  │
│                    [Preview]  [Generate Video]                   │
└─────────────────────────────────────────────────────────────────┘
```

### Video Actions

| Element | Action |
|---------|--------|
| **Video Player** | Play/pause the active video version |
| **Preview** | Always visible; plays slideshow of storyboard poster images (each shown for scene duration) |
| **Generate Video** | Always visible; generate video from storyboard scenes |
| **Download** | Only visible after COMPLETED; download the active video file |
| **Version thumbnail** | Click to make that version active |
| **Trashcan (🗑)** | Delete non-active video version |

### Video Version Management

- **Version thumbnails**: Tiny thumbnails below video area, using scene poster images
- **Visibility**: Only shown when 2+ versions exist
- **Active version**: Large light gray border; shown in main player
- **Non-active versions**: Clickable to select; displays trashcan icon for deletion
- **Single version**: No version thumbnails shown, no trash icon (can't delete last version)
- Latest generated video is **active by default**

### Implementation Note

Video provider selection and cost estimates may be included in the implementation but are not part of the core spec. If implemented, they should be commented out or feature-flagged for future use.

### Transitions

```
NOT_STARTED ──[generate]──▸ GENERATING
GENERATING ──[submitted]──▸ POLLING
POLLING ──[complete]──▸ COMPLETED
POLLING ──[failed]──▸ FAILED
COMPLETED ──[regenerate]──▸ GENERATING
FAILED ──[retry]──▸ GENERATING
```

### User Actions

**All states:**
1. **Preview** - Play slideshow of storyboard poster images (each shown for its scene duration, no slide transitions)

**NOT_STARTED / FAILED:**
2. **Generate Video** - Start video generation from storyboard scenes

**COMPLETED:**
2. **Play Video** - Watch generated video in player
3. **Download** - Download active video file
4. **Regenerate** - Click "Generate Video" again to create new version (adds to versions, becomes active)
5. **Select Active Version** - Click version thumbnail to make it active (only when 2+ versions)
6. **Delete Version** - Click trashcan on non-active version (only when 2+ versions)

---

## Session-Level State

> **Note:** `SessionState` is now called `Project`. See SCHEMAS-SPEC.md for the current schema.

### Properties

```typescript
interface Project {
  // Metadata
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;

  // Story
  storyHistory: Story[];
  storyHistoryIndex: number;
  currentStory: Story | null;

  // World Elements
  worldElements: Map<string, WorldElement>;

  // Storyboard (scenes array IS the storyboard - scene order = storyboard order)
  scenes: Scene[];

  // Video
  video: Video | null;
}

type ElementType = 'character' | 'location' | 'object' | 'concept';

interface WorldElement {
  id: string;
  name: string;
  type: ElementType;
  description: string;
  enhancedDescription?: string;
  images: ElementImage[];
  historyIndex: number;
  history: WorldElementVersion[];
}

interface ElementImage {
  id: string;
  imageUrl: string;
  revisedPrompt: string;
  isActive: boolean;
  createdAt: Date;
}
```

### History Management

For Story and World Elements:
- All versions remain visible in the UI
- Each modification appends to history
- Users can branch from any historical version
- Branching discards subsequent versions

## Implementation Notes

### UI Considerations

1. **Loading States** - Show spinners/skeletons during GENERATING states
2. **Error Handling** - Show error messages with retry options
3. **Progress Indicators** - Show progress for multi-step operations
4. **Disabled Actions** - Disable buttons during transitions
5. **Confirmation Dialogs** - Confirm destructive actions (remove, regenerate)
6. **History UI** - Show all versions with action buttons on each

### CLI Considerations

1. **Interactive Mode** - Prompt for each stage
2. **Batch Mode** - Run full pipeline with defaults
3. **Resume** - Load session and continue from any stage
4. **Progress Output** - Show status during generation
5. **Error Recovery** - Prompt for retry on failure

### Testing Considerations

1. **State Transitions** - Test all valid transitions
2. **Invalid Transitions** - Verify errors for invalid transitions
3. **History** - Test branch from history at each stage
6. **Non-Linear Workflow** - Test starting from World, Scenes, etc. before Story
7. **Smart Matching** - Test element matching by name, role, description
4. **Error States** - Test error handling and recovery
5. **Persistence** - Test save/load roundtrip at each state

## State Complexity Analysis

The exponential complexity comes from:

1. **Independent World Element States** - N elements × M states each (across 4 types)
2. **Independent Slot States** - N slots × M states each
3. **History at Multiple Levels** - Story history + world element history
4. **Cross-Stage Dependencies** - Changes in story affect world elements/scenes
5. **Non-Linear Entry Points** - Any stage can be the starting point

### Recommended Approach

1. **State Machine Pattern** - Formalize transitions
2. **Event-Driven Updates** - React to state changes, not direct mutations
3. **Derived State** - Calculate UI state from core state
4. **Centralized Session** - Single source of truth for all state
