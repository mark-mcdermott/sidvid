# SidVid Workflow State Machine

This document defines all possible states and transitions in the SidVid video generation workflow. Use this as a reference when implementing UI, CLI, or library features.

## Data

See [SCHEMAS-SPEC.md](./SCHEMAS-SPEC.md) for JSON structures produced at each stage.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SESSION LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌────────────┐    ┌────────────┐    ┌───────────┐  │
│  │  STORY   │◂──▸│   WORLD    │───▸│   SCENES   │───▸│STORYBOARD │  │
│  └──────────┘    └────────────┘    └────────────┘    └───────────┘  │
│       │                │                 │                 │         │
│       ▼                ▼                 ▼                 ▼         │
│  ┌──────────┐    ┌────────────┐    ┌────────────┐    ┌───────────┐  │
│  │  VIDEO   │◂───│            │◂───│            │◂───│           │  │
│  └──────────┘    └────────────┘    └────────────┘    └───────────┘  │
│                                                                      │
│  ◂─────────── Users can go back and modify any previous stage ──────│
│  ◂─────────── Users can START at any stage (non-linear workflow) ───│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

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

**Traditional flow:** Story → World → Scenes → Storyboard → Video

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
│  - Each entry: 5s duration, no          │
│    transitions (defaults)               │
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

## Stage 1: Story

### Story Generation Input

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | Yes | Story idea/concept |
| `targetDuration` | Yes | Total video length in **5-second increments** (5, 10, 15, 20, ...) |

The AI generates `targetDuration / 5` scenes, each with a fixed 5-second duration.

> **v2 TODO**: Support variable scene durations (5s or 10s) based on scene complexity.

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

### History Model

All story versions remain visible in the UI. Each version shows its prompt and the resulting story. Each version has action buttons, allowing users to branch from any point. When branching, subsequent versions are discarded and the user continues from the selected version.

## Stage 2: World

The World section (UI label: "World") contains all reusable story elements. On the backend, these are called "world elements."

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

### Cascade Deletion (World Elements)

When deleting a world element that is assigned to scenes:

1. **Warning dialog** - "This element is used in X scenes. Deleting it will remove it from those scenes."
2. **User confirms** - Element is deleted
3. **Cascade behavior**:
   - Element removed from all scenes' `assignedElements` arrays
   - Scenes remain (just with fewer elements)
   - Storyboard entries unaffected (they reference scenes, not elements directly)
   - Scene poster images NOT auto-regenerated (user can manually regenerate if desired)

### UI Filtering

The World section can display filter tabs or tags:
- `All` | `Characters` | `Locations` | `Objects` | `Concepts`

### Sidebar Thumbnails

World elements appear as **thumbnails in the left sidebar** (when open):
- Shows the element's active image (or placeholder if none)
- Hover shows element name in tooltip
- **Thumbnails are draggable** onto scenes in the Scenes section
- Elements in the main World section are NOT directly draggable (only sidebar thumbnails)

This separation keeps the World section for element management while enabling quick drag-and-drop scene composition via the sidebar.

## Stage 3: Scenes

Scenes are slots where world elements are assembled. Each scene generates a "poster image" used in the Storyboard.

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

### Scene Card UI

Each scene displays as a card with the following layout:

```
┌─────────────────────────────────────────┐
│  Scene 1: The Castle Entrance           │  ← Title (scene number + name)
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  │         [Poster Image]           │   │  ← Active image
│  │                                  │   │
│  │                          [↻]     │   │  ← Regenerate button (overlay)
│  └─────────────────────────────────┘   │
│                                         │
│  Alice approaches the ancient castle    │  ← Description (truncated)
│  gates as the sun sets behind...        │
│  [Read More]                            │  ← Expands to full description
│                                         │
│  [Manual Edit] [Prompt Edit] [Expand]   │  ← Action buttons
│                                         │
│  Assigned: [Alice] [Castle] [Gem]       │  ← World elements (chips)
│                                         │
│  Image versions: [v1] [v2•] [v3]        │  ← Version selector (• = active)
│                                [🗑]      │  ← Trashcan on non-active versions
└─────────────────────────────────────────┘
```

### Scene Actions

| Button | Action |
|--------|--------|
| **Regenerate (↻)** | Generate new poster image (becomes active, previous retained) |
| **Manual Edit** | Edit scene description directly in text fields |
| **Prompt Edit** | Send edit instruction to ChatGPT to modify description |
| **Expand** | AI automatically expands scene with more detail |
| **Read More/Show Less** | Toggle between truncated and full description |
| **Version selector** | Click to make that version active |
| **Trashcan (🗑)** | Delete non-active image version |
| **Element chip (x)** | Remove element from scene |

### UI Visual States

```
┌─────────────────────────────────────────────────────────────────┐
│  SCENES SECTION                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Empty scene (no elements):       Scene with elements:           │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ┐             ┌───────────────────┐          │
│  │                  │             │                   │          │
│  │                  │             │  [Alice] [Castle] │          │
│  │                  │             │                   │          │
│  │  [+]             │             │  [+]         [🗑] │          │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ┘             └───────────────────┘          │
│  (dashed border)                  (solid border)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Visual State | Border | Has + Icon | Has Trash Icon | Draggable to Storyboard |
|--------------|--------|------------|----------------|-------------------------|
| Empty (no elements) | Dashed, rounded | Yes | No | No |
| Has elements | Solid, rounded | Yes | Yes (red) | Yes |

### Scene Click Actions (UI)

| Click Target | Action |
|--------------|--------|
| **+ icon** | Opens dropdown of all world elements; selected element is added to scene |
| **Trash icon** (red) | Deletes the scene |
| **Scene body** (not + or trash) | Initiates drag to Storyboard |

### World Element Sidebar (UI)

When the left sidebar is open, world elements appear as **thumbnails**:
- Thumbnail shows the element's active image (or placeholder if none)
- **Hover**: Shows element name in tooltip
- **Drag**: Thumbnail can be dragged onto a scene in the Scenes section
- Elements in the main World section are NOT directly draggable

```
┌──────────┬──────────────────────────────────────────────┐
│ SIDEBAR  │  SCENES                                      │
├──────────┤                                              │
│ [Alice]  │  ┌───────────────┐  ┌ ─ ─ ─ ─ ─ ─ ┐        │
│ [Bob]    │  │ Alice, Castle │  │              │        │
│ [Castle] │  │               │  │              │        │
│ [Gem]    │  │ [+]      [🗑] │  │  [+]         │        │
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
5. **Remove Scene** - Delete a scene (see Cascade Deletion below)
6. **Reorder Scenes** - Drag and drop to reorder within Scenes section
7. **Assign Element** - Add world element via + dropdown or sidebar drag
8. **Unassign Element** - Remove world element from scene
9. **Set Custom Description** - Override scene description
10. **Edit with Prompt** - Send edit instruction to ChatGPT
11. **Smart Expand** - AI automatically expands scene description
12. **Select Active Image** - Choose which image version to use
13. **Delete Image Version** - Remove a non-active image (trashcan icon)
14. **Drag to Storyboard** - Click and drag scene to add to Storyboard

### Cascade Deletion (Scenes)

When deleting a scene that is used in the storyboard:

1. **Warning dialog** - "This scene is used in the storyboard. Deleting it will remove it from the storyboard."
2. **User confirms** - Scene is deleted
3. **Cascade behavior**:
   - Scene removed from project's `scenes` array
   - All storyboard entries referencing this scene are removed
   - Storyboard reorders remaining entries automatically
   - World elements are NOT affected (they exist independently)

### CLI Commands

```bash
# List all scenes
sidvid scene list

# Show scene details (metadata)
sidvid scene show <scene-id>

# Add element to scene
sidvid scene add-element <scene-id> <element-id>

# Remove element from scene
sidvid scene remove-element <scene-id> <element-id>

# Generate poster image for scene
sidvid scene generate <scene-id>

# Generate all pending scenes
sidvid scene generate-all
```

## Stage 4: Storyboard

The Storyboard arranges scenes into a timeline with timing and transitions.

### Auto-Population

When a story is generated, the storyboard is **automatically populated** with all scenes in order (see Story Creation Pipeline). Each entry gets:
- Duration: 5 seconds (matches scene duration)
- Transitions: none (defaults)

Users can then reorder, remove, or add additional scenes. Manual scene additions are still supported via drag-and-drop from the Scenes section.

### States

| State | Description |
|-------|-------------|
| `EMPTY` | No storyboard (only if user clears it or starts without story) |
| `EDITING` | User can drag/drop, reorder, edit timing |
| `PREVIEWING` | Playing slideshow preview (poster images with timing, not video) |
| `READY` | Storyboard finalized for video generation |

### Storyboard Entry Properties

Each entry in the storyboard tracks:
- `id` - Unique identifier
- `sceneId` - Reference to source scene
- `duration` - How long this scene plays (seconds)
- `transitionIn` - Transition effect entering this scene
- `transitionOut` - Transition effect exiting this scene
- `order` - Position in storyboard sequence

### UI Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│  STORYBOARD                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌ ─ ─ ─ ─ ┐      │
│  │ Scene 1 │───▸│ Scene 2 │───▸│ Scene 3 │    │  drop   │      │
│  │ (3.5s)  │fade│ (2.0s)  │cut │ (4.0s)  │    │  here   │      │
│  └─────────┘    └─────────┘    └─────────┘    └ ─ ─ ─ ─ ┘      │
│       ↑              ↑              ↑                            │
│  [drag to reorder within storyboard]                            │
│                                                                  │
│  ◂──── Scenes dragged here from Scenes section ────▸            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

- **Auto-populated**: Storyboard starts with all story scenes in order (after story generation)
- **Add scene**: Drag scene from Scenes section into Storyboard (or drop zone)
- **Reorder**: Drag storyboard entries to reorder
- **Remove**: Drag out of storyboard or click remove button
- **Duplicate**: Same scene can appear multiple times in storyboard
- **Scene shows**: Poster image from the scene, with duration and transition indicators
- **Preview**: Plays poster images in sequence with timing (slideshow/animatic) - actual video clips are generated in Stage 5

### Metadata Display

Each storyboard entry shows on hover (UI) or via CLI:
- Scene description
- Assigned world elements
- Duration
- Transition effects
- Poster image URL

### Transitions

```
EMPTY ──[drag scene in]──▸ EDITING
EMPTY ──[initialize from scenes]──▸ EDITING
EDITING ──[preview]──▸ PREVIEWING
PREVIEWING ──[stop]──▸ EDITING
EDITING ──[finalize]──▸ READY
READY ──[edit]──▸ EDITING
READY ──[generate video]──▸ VIDEO stage
```

### User Actions at EDITING State

1. **Add Scene** - Drag scene from Scenes section into Storyboard
2. **Reorder Scenes** - Drag storyboard entries to reorder
3. **Remove Scene** - Remove scene from storyboard (doesn't delete original scene)
4. **Edit Timing** - Adjust scene duration
5. **Add Transition** - Add transition effect between scenes
6. **Preview** - Play storyboard preview
7. **Finalize** - Lock storyboard for video generation

### CLI Commands

```bash
# List storyboard entries
sidvid storyboard list

# Show storyboard entry details
sidvid storyboard show <entry-id>

# Add scene to storyboard
sidvid storyboard add-scene <scene-id> [--position <index>]

# Remove scene from storyboard
sidvid storyboard remove <entry-id>

# Set duration
sidvid storyboard set-duration <entry-id> <seconds>

# Set transition
sidvid storyboard set-transition <entry-id> --in <type> --out <type>

# Reorder
sidvid storyboard move <entry-id> --to <index>

# Preview (opens in default video player or outputs URL)
sidvid storyboard preview
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

### Transitions

```
NOT_STARTED ──[generate]──▸ GENERATING
GENERATING ──[submitted]──▸ POLLING
POLLING ──[complete]──▸ COMPLETED
POLLING ──[failed]──▸ FAILED
COMPLETED ──[regenerate]──▸ GENERATING
FAILED ──[retry]──▸ GENERATING
```

### User Actions at COMPLETED State

1. **Preview** - Watch generated video
2. **Download** - Download video file
3. **Regenerate** - Generate new video
4. **Go Back** - Return to storyboard to make changes

## Project Lifecycle

Projects are the top-level container for all SidVid content. See SCHEMAS-SPEC.md for the `Project` interface and `ProjectPersistenceAdapter`.

### States

| State | Description |
|-------|-------------|
| `CREATING` | New project dialog/wizard open |
| `ACTIVE` | Project loaded, user working in it |
| `SAVING` | Project being persisted |
| `SAVED` | Project persisted to storage |
| `LOADING` | Project being loaded from storage |
| `DELETED` | Project removed (terminal state) |

### Transitions

```
CREATING ──[name entered]──▸ ACTIVE
ACTIVE ──[auto-save / manual save]──▸ SAVING
SAVING ──[success]──▸ SAVED
SAVING ──[failure]──▸ ACTIVE (with error)
SAVED ──[user makes changes]──▸ ACTIVE
SAVED ──[open different project]──▸ LOADING
LOADING ──[success]──▸ ACTIVE
LOADING ──[failure]──▸ SAVED (previous project, with error)
ACTIVE ──[delete]──▸ DELETED
SAVED ──[delete]──▸ DELETED
```

### Sidebar UI (Projects Panel)

```
┌──────────────────────┬─────────────────────────────────────────┐
│ PROJECTS             │  MAIN CONTENT                           │
├──────────────────────┤                                         │
│ + New Project        │  [Story | World | Scenes | ...]         │
│                      │                                         │
│ ● frunk landing vid  │  (active project content)               │
│   tutorial video     │                                         │
│   demo reel          │                                         │
│                      │                                         │
└──────────────────────┴─────────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **+ New Project** | Opens create dialog, prompts for name |
| **Project list** | Shows all saved projects, sorted by lastOpenedAt |
| **Active indicator (●)** | Shows which project is currently loaded |
| **Click project** | Auto-saves current project, loads clicked project |
| **Right-click / menu** | Rename, duplicate, delete options |

### User Actions

1. **Create Project** - Enter name, optionally description
2. **Open Project** - Load project from storage (auto-saves current)
3. **Save Project** - Persist current state (also happens on auto-save)
4. **Rename Project** - Change project name
5. **Duplicate Project** - Copy project with new name
6. **Delete Project** - Remove project and all assets (with confirmation)
7. **Export Project** - Download project as JSON (portable backup)
8. **Import Project** - Load project from JSON file

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

# Export project to JSON
sidvid project export <project-id> --output ./backup.json

# Import project from JSON
sidvid project import ./backup.json
```

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

  // Scenes
  scenes: Scene[];

  // Storyboard
  storyboard: Storyboard | null;

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
