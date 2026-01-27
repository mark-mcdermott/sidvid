# Data Schemas

This document describes the JSON structures created and passed between stages. See STATE-WORKFLOW-SPEC.md for the authoritative workflow specification.

## Style

The style setting controls the visual aesthetic applied to all image and video generation.

```typescript
type StylePreset = 'anime' | 'photorealistic' | '3d-animated' | 'watercolor' | 'comic' | 'custom';

interface Style {
  preset: StylePreset;
  customPrompt?: string;             // Required when preset is 'custom'
}

// Internal: Style prompts prepended to generation calls
const STYLE_PROMPTS: Record<Exclude<StylePreset, 'custom'>, string> = {
  'anime': 'anime style, cel-shaded, 2D animation, vibrant colors, NOT photorealistic, NOT 3D',
  'photorealistic': 'photorealistic, cinematic lighting, 8K, hyperrealistic, film grain',
  '3d-animated': '3D animated, Pixar style, stylized characters, soft lighting, NOT photorealistic',
  'watercolor': 'watercolor painting, soft edges, painterly, artistic, muted colors',
  'comic': 'comic book style, bold outlines, halftone dots, dynamic poses, vibrant colors',
};
```

---

## Story Object

Generated in **Stage 2 (Story)** from the user's initial prompt via ChatGPT. This single API call produces the complete story structure.

```typescript
interface Story {
  id: string;
  title: string;
  prompt: string;                    // Original user prompt
  style: Style;                      // Visual style for all generations
  targetDuration: number;            // Target video length in seconds (5s increments)
  narrative: string;                 // Full story text
  scenes: StoryScene[];              // Scene descriptions from story
  characters: StoryCharacter[];      // Characters mentioned in story
  locations: StoryLocation[];        // Locations mentioned in story
  objects: StoryObject[];            // Objects mentioned in story
  concepts: StoryConcept[];          // Concepts mentioned in story
  isSmartExpanded?: boolean;         // True after first smart expand
  preExpansionNarrative?: string;    // Narrative before expansion (used for redo)
  createdAt: Date;
}

// Smart Expand behavior:
// - First click: save narrative → preExpansionNarrative, generate expanded narrative, set isSmartExpanded = true
// - Subsequent clicks (redo): regenerate from preExpansionNarrative (different result, not longer)
// - AI prompt includes: original prompt, style, target duration, existing world elements
// - See STATE-WORKFLOW-SPEC.md "Smart Expand AI Prompt Inputs (Story)" for full input table

interface StoryScene {
  number: number;                    // Scene sequence (1-indexed)
  title: string;                     // Short title (3-5 words, no filler words)
  description: string;               // Setting and visual description
  dialogue: string;                  // Spoken lines (empty if none)
  action: string;                    // What happens
  elementsPresent: string[];         // Names of elements in scene
  duration: number;                  // Scene duration in seconds (default: 5)
}

interface StoryCharacter {
  name: string;
  description: string;
  physical: string;                  // Physical appearance
  profile: string;                   // Personality, motivations
}

interface StoryLocation {
  name: string;
  description: string;
}

interface StoryObject {
  name: string;
  description: string;
}

interface StoryConcept {
  name: string;
  description: string;
}
```

### Duration Constraints

- **Target duration**: User specifies total video length in **5-second increments** (5, 10, 15, 20, etc.)
- **Scene duration**: Each scene is **5 seconds** (fixed) - maps 1:1 to Kling AI video clips
- **Scene count**: `targetDuration / 5` = number of scenes generated
- **Video assembly**: Adapter/implementation responsibility (see Video Assembly below)

> **v2 TODO**: Support variable scene durations (e.g., 5s or 10s per scene based on content complexity). Current limitation due to Kling AI's fixed clip durations.

---

## World Element

Created in **Stage 3 (World)** either auto-extracted from story or manually created. Supports four types: character, location, object, concept.

```typescript
type ElementType = 'character' | 'location' | 'object' | 'concept';

interface WorldElement {
  id: string;
  name: string;
  type: ElementType;
  description: string;
  enhancedDescription?: string;      // ChatGPT-enhanced (optional)
  isEnhanced?: boolean;              // True after first enhance
  preEnhancementDescription?: string; // Description before enhancement (used for redo)
  images: ElementImage[];            // Multiple versions supported
  historyIndex: number;
  history: WorldElementVersion[];
  createdAt: Date;
  updatedAt: Date;
}

// Enhance behavior:
// - First click: save description → preEnhancementDescription, generate enhanced, set isEnhanced = true
// - Subsequent clicks (redo): regenerate enhancedDescription from preEnhancementDescription (different result)
// - If user manually edits description after enhancement: clear isEnhanced, description becomes new source
// - AI prompt includes: element name, element type, project style, story context
// - See STATE-WORKFLOW-SPEC.md "Enhance AI Prompt Inputs (World Element)" for full input table

interface ElementImage {
  id: string;
  imageUrl: string;
  revisedPrompt: string;             // DALL-E's revised prompt
  isActive: boolean;                 // Only one can be active
  createdAt: Date;
}

interface WorldElementVersion {
  description: string;
  enhancedDescription?: string;
  isEnhanced?: boolean;
  preEnhancementDescription?: string;
  images: ElementImage[];
  createdAt: Date;
}
```

### Image Version Management

- Latest generated image is **active by default**
- Only one image can be active at a time per element
- Non-active images can be selected to become active
- Non-active images can be deleted (trashcan icon in UI)
- Active image is used in scenes and storyboard

---

## Scene

Created in **Stage 4 (Storyboard)** by composing world elements. Each scene generates "poster images" (supports versioning like world elements). The scenes array order determines the video sequence.

```typescript
type SceneStatus = 'empty' | 'pending' | 'generating' | 'completed' | 'failed';

interface Scene {
  id: string;
  title: string;                     // Short title (3-5 words, no filler words like "of", "the")
  description: string;               // From story or custom
  customDescription?: string;        // User override
  enhancedDescription?: string;      // ChatGPT-enhanced (optional)
  isSmartExpanded?: boolean;         // True after first smart expand
  preExpansionDescription?: string;  // Description before expansion (used for redo)
  isArchived?: boolean;              // True if excluded from storyboard (default: false)
  dialog?: string;                   // Scene dialog (optional)
  action?: string;                   // Scene action notes (optional)
  assignedElements: string[];        // World element IDs
  images: SceneImage[];              // Multiple versions supported
  duration: number;                  // Scene duration in seconds (default: 5)
  status: SceneStatus;
  error?: string;                    // Error message if failed
  createdAt: Date;
  updatedAt: Date;
}

// Archive behavior:
// - Archived scenes appear in "Archived Scenes" section at bottom of Storyboard
// - Click archive icon (📦) to archive; click unarchive (📤) to restore
// - Drag archived thumbnail to active area to unarchive at specific position
// - Archived scenes can still be edited via modal

// Clone behavior:
// - Click clone icon (⧉) to create a copy of the scene
// - Clone gets new ID, title becomes "Original Title (1)" etc.
// - Clone inserted immediately after original scene
// - Clone is always active (isArchived = false), even if original was archived
// - All other fields copied (description, images, elements, etc.)

// Smart Expand behavior:
// - Source: customDescription ?? description
// - First click: save source → preExpansionDescription, generate enhanced, set isSmartExpanded = true
// - Subsequent clicks (redo): regenerate from preExpansionDescription with full context (different result)
// - AI prompt includes: scene title, dialog, action, assigned world elements (names + descriptions),
//   project style, and other scenes' titles/descriptions for narrative coherence
// - See STATE-WORKFLOW-SPEC.md "Smart Expand AI Prompt Inputs (Scene)" for full input table

// Scene title guidelines:
// - 3 words preferred, 5 words max
// - Avoid filler words: "of", "the", "a", "an", etc.
// - Example: "Cyber Capybara Hack" NOT "Hack Tactics of the Cyber Capybaras"

interface SceneImage {
  id: string;
  imageUrl: string;
  revisedPrompt: string;             // DALL-E's revised prompt
  isActive: boolean;                 // Only one can be active
  createdAt: Date;
}
```

### Scene Image Version Management

- Latest generated image is **active by default**
- Only one image can be active at a time per scene
- Non-active images can be selected to become active
- Non-active images can be deleted (trashcan icon in UI), except when only one image exists
- Active image is used in storyboard

### Scene Visual States (UI)

| State | Border | Has + Icon | Has Trash Icon |
|-------|--------|------------|----------------|
| Scene (any state) | Solid, rounded | N/A | Yes (red) |
| New Scene button | Dashed, rounded | Yes | No |

---

## Video

Generated in **Stage 5 (Video)** from the storyboard scenes.

```typescript
type VideoStatus = 'not_started' | 'generating' | 'polling' | 'completed' | 'failed';

interface VideoVersion {
  id: string;
  videoUrl: string;                  // Generated video URL
  thumbnailUrl?: string;             // Video thumbnail
  duration: number;                  // Video duration in seconds
  isActive: boolean;                 // Only one can be active
  createdAt: Date;
}

interface Video {
  id: string;
  projectId: string;                 // Reference to project this video belongs to
  status: VideoStatus;
  versions: VideoVersion[];          // Multiple versions supported
  error?: string;
  createdAt: Date;
}
```

### Video Version Management

- Latest generated video is **active by default**
- Only one video can be active at a time
- Non-active videos can be selected to become active
- Non-active videos can be deleted (trashcan icon in UI), except when only one exists
- Active video is shown in the main player

---

## Project

Top-level container for all project data. This is the persistable unit that contains the complete workflow state.

```typescript
interface Project {
  // Metadata
  id: string;
  name: string;                           // User-given name ("frunk landing page vid")
  description?: string;                   // Optional project description
  thumbnail?: string;                     // URL/path to project thumbnail
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date;                     // For sorting recents

  // Story
  storyHistory: Story[];
  storyHistoryIndex: number;
  currentStory: Story | null;

  // World Elements
  worldElements: Map<string, WorldElement>;

  // Storyboard (scenes array IS the storyboard - scene order = video sequence)
  scenes: Scene[];

  // Video
  video: Video | null;
}

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  updatedAt: Date;
  lastOpenedAt: Date;
}
```

---

## Persistence Adapter Interface

The core library defines *what* gets persisted, not *how*. Implementations provide their own adapter.

```typescript
interface ProjectPersistenceAdapter {
  // Project CRUD
  createProject(name: string): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  listProjects(): Promise<ProjectSummary[]>;
  updateProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Asset storage (images, videos)
  storeAsset(projectId: string, data: Blob, type: AssetType): Promise<string>;  // Returns URL/path
  getAsset(url: string): Promise<Blob>;
  deleteAsset(url: string): Promise<void>;
}

type AssetType = 'element-image' | 'scene-image' | 'video';
```

### Example Implementations

| Environment | Adapter | Storage |
|-------------|---------|---------|
| Browser (local) | `LocalStorageAdapter` | IndexedDB + localStorage |
| CLI | `FileSystemAdapter` | JSON files + local folders |
| Cloudflare | `CloudflareAdapter` | Neon (Postgres) + R2 |

---

## Cloudflare Implementation (Neon + R2)

Reference implementation for SvelteKit on Cloudflare Pages.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (SvelteKit)                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  sidvid-core library                                     │   │
│  │  └── CloudflarePersistenceAdapter (implements interface) │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ API calls
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE PAGES (Edge Functions / API Routes)                 │
│  /api/projects/*                                                │
│  /api/assets/*                                                  │
└───────────────────────────┬──────────────────┬──────────────────┘
                            │                  │
              ┌─────────────┘                  └─────────────┐
              ▼                                              ▼
┌──────────────────────────┐                ┌──────────────────────────┐
│  NEON (Postgres)         │                │  CLOUDFLARE R2           │
│                          │                │                          │
│  projects                │                │  /projects/{id}/         │
│  ├─ id                   │                │    /elements/{id}.png    │
│  ├─ name                 │                │    /scenes/{id}.png      │
│  ├─ user_id              │                │    /video.mp4            │
│  ├─ state (JSONB)        │                │                          │
│  ├─ created_at           │                │                          │
│  ├─ updated_at           │                │                          │
│  └─ last_opened_at       │                │                          │
└──────────────────────────┘                └──────────────────────────┘
```

### Neon Schema

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  state JSONB NOT NULL DEFAULT '{}',      -- Full project state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_last_opened ON projects(user_id, last_opened_at DESC);
```

### R2 Structure

```
bucket: sidvid-assets
├── projects/
│   └── {project-id}/
│       ├── elements/
│       │   ├── {element-id}-{image-id}.png
│       │   └── ...
│       ├── scenes/
│       │   ├── {scene-id}.png
│       │   └── ...
│       └── videos/
│           └── {video-id}.mp4
```

### API Routes

```
POST   /api/projects              → Create project
GET    /api/projects              → List projects (summary)
GET    /api/projects/:id          → Get full project state
PUT    /api/projects/:id          → Update project state
DELETE /api/projects/:id          → Delete project + assets

POST   /api/projects/:id/assets   → Upload asset to R2
DELETE /api/assets/:path          → Delete asset from R2
```

### Adapter Implementation

```typescript
// src/lib/persistence/cloudflare-adapter.ts
export class CloudflarePersistenceAdapter implements ProjectPersistenceAdapter {
  async createProject(name: string): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return res.json();
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const res = await fetch('/api/projects');
    return res.json();
  }

  async getProject(id: string): Promise<Project | null> {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return null;
    return res.json();
  }

  async updateProject(project: Project): Promise<void> {
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify(project)
    });
  }

  async deleteProject(id: string): Promise<void> {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  }

  async storeAsset(projectId: string, data: Blob, type: AssetType): Promise<string> {
    const formData = new FormData();
    formData.append('file', data);
    formData.append('type', type);

    const res = await fetch(`/api/projects/${projectId}/assets`, {
      method: 'POST',
      body: formData
    });
    const { url } = await res.json();
    return url;
  }

  async getAsset(url: string): Promise<Blob> {
    const res = await fetch(url);
    return res.blob();
  }

  async deleteAsset(url: string): Promise<void> {
    await fetch(`/api/assets?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
  }
}
```

---

## Story Generation Metadata

Returned by story generation API to indicate element matching.

```typescript
interface StoryGenerationResult {
  story: Story;
  existingElementsUsed: string[];    // IDs of matched existing elements
  newElementsIntroduced: NewElement[];
}

interface NewElement {
  name: string;
  type: ElementType;
  description: string;
}
```

---

## Data Flow

```
User Prompt (or existing World Elements)
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 2: Story                         │
│  ChatGPT generates Story JSON           │
│  Smart matching with existing elements  │
└─────────────────────────────────────────┘
    │
    │  Story + newElementsIntroduced
    ▼
┌─────────────────────────────────────────┐
│  Stage 3: World                         │
│  World elements (4 types) created       │
│  Images generated with DALL-E           │
└─────────────────────────────────────────┘
    │
    │  WorldElement[]
    ▼
┌─────────────────────────────────────────┐
│  Stage 4: Storyboard                    │
│  Scenes created and arranged            │
│  Poster images generated                │
│  (scene order = video sequence)         │
└─────────────────────────────────────────┘
    │
    │  Scene[]
    ▼
┌─────────────────────────────────────────┐
│  Stage 5: Video                         │
│  Final video generated                  │
└─────────────────────────────────────────┘
```

---

## Video Assembly

The core library generates **individual video clips** (one per scene via Kling AI). Final video assembly is the **adapter/implementation's responsibility**.

### What the Library Provides

```typescript
interface VideoClip {
  id: string;
  sceneId: string;                   // Reference to source scene
  clipUrl: string;                   // Kling-generated video URL
  duration: number;                  // Clip duration (5 seconds)
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

interface Video {
  id: string;
  projectId: string;                 // Reference to project this video belongs to
  clips: VideoClip[];                // Individual clips per scene
  assembledUrl?: string;             // Final stitched video (if assembled)
  totalDuration: number;             // Sum of clip durations
  status: VideoStatus;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

### Assembly Options (Implementation Choice)

| Option | Pros | Cons |
|--------|------|------|
| **FFmpeg on server** | Full control, no API costs | Needs separate service (not Cloudflare Workers) |
| **FFmpeg.wasm in browser** | No server needed | Heavy (~25MB), slow |
| **Video composition API** (Shotstack, Creatomate) | Easy, handles transitions | API costs, vendor dependency |
| **No assembly** | Simplest | User gets individual clips |

> **v2 TODO**: Provide optional built-in assembly adapter for common platforms.

---

## Notes

- **Non-linear workflow**: Users can start at any stage
- **Append-only**: Existing elements never auto-deleted
- **Smart matching**: Story generation matches existing elements by name, role, description
- **History branching**: Stories and world elements support branching from any version
- **Video assembly**: Stitching clips is adapter/implementation responsibility
- See STATE-WORKFLOW-SPEC.md for complete state machine and UI behavior
