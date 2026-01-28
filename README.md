# SidVid

AI-powered video generation platform for **character-driven content** like animated shorts, cartoons, explainer videos with characters, and animated advertisements. SidVid uses ChatGPT, DALL-E 3, Flux Kontext, and Kling AI to provide a complete workflow from story idea to finished video.

## Target Use Cases

- **Animated shorts** with consistent characters
- **Cartoon videos** with recurring cast
- **Animated advertisements** featuring mascots or characters
- **Explainer videos** with animated hosts
- **Social media content** with character-driven narratives

## Workflow Overview

SidVid provides a **World → Storyboard → Video** workflow:

1. **Story**: Generate narrative with AI, including scenes, dialogue, and character metadata
2. **World**: Create and manage world elements (characters, locations, objects, concepts) with AI-enhanced descriptions and generated images
3. **Storyboard**: Compose scenes by assigning world elements, generate scene images, arrange in sequence
4. **Video**: Generate final video from storyboard with Kling AI

### Character Consistency

SidVid supports **Flux Kontext** for character consistency across scenes. When in Production mode, scene images use character reference images to maintain visual consistency throughout the video.

## Architecture

SidVid follows a **headless library** architecture with two thin client wrappers:

```
┌─────────────────────────────────────────────────┐
│       Headless Library (src/lib/sidvid)         │
│  ─────────────────────────────────────────────  │
│  Session & SessionManager (stateful workflows)  │
│  - Story history with undo/redo                 │
│  - Character history with undo/redo             │
│  - Scene pipeline (slots, generation, status)   │
│  - State persistence (save/load sessions)       │
│  ─────────────────────────────────────────────  │
│  SidVid class (stateless API methods)           │
│  - generateStory() / editStory()                │
│  - enhanceCharacterDescription()                │
│  - generateCharacter() / generateScene()        │
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

### Project Structure

```
core/
├── src/
│   ├── lib/sidvid/          # Headless library (framework-agnostic)
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
│   ├── routes/              # Web UI (SvelteKit)
│   │   ├── story/           # Story generation page
│   │   ├── characters/      # Character generation page
│   │   ├── scenes/          # Scene pipeline page
│   │   └── +layout.svelte   # App layout with sidebar
│   │
│   └── cli/                 # CLI wrapper
│       └── index.ts         # Command-line interface
│
└── package.json
```

## Installation

```bash
git clone https://github.com/mark-mcdermott/sidvid-core.git
pnpm install
```

## Using the Headless Library

The core power of SidVid is its **headless TypeScript library**. Use it in any JavaScript/TypeScript project:

### Installation (as a library from NPM)

```bash
npm install sidvid
# or
pnpm add sidvid
```

### Basic Usage

```typescript
import { SidVid } from 'sidvid';

const sidvid = new SidVid({
  openaiApiKey: process.env.OPENAI_API_KEY,
});

// Generate a story with character metadata
const story = await sidvid.generateStory({
  prompt: 'A detective solving a mystery in a futuristic city',
  scenes: 5,
});

console.log(story.title);
console.log(story.scenes);
console.log(story.characters); // Extracted character metadata

// Edit an existing story
const editedStory = await sidvid.editStory({
  currentStory: story,
  editPrompt: 'Make the dialogue more dramatic',
  length: '5s'
});

// Enhance a character description
const enhanced = await sidvid.enhanceCharacterDescription({
  description: 'A detective'
});

// Generate character image
const character = await sidvid.generateCharacter({
  description: enhanced,
  style: 'realistic',
  size: '1024x1024',
  quality: 'hd'
});

// Generate scene image
const scene = await sidvid.generateScene({
  description: 'A rainy street at night with neon lights',
  style: 'cinematic',
  aspectRatio: '16:9',
});

// Generate video
const video = await sidvid.generateVideo({
  prompt: 'A cat playing piano in a jazz club',
  duration: 4, // 4, 8, or 12 seconds
});

// Wait for video completion
const completed = await sidvid.waitForVideo(video.id);
console.log(completed.url);
```

### Stateful Sessions (Recommended)

For iterative, exploratory workflows, use the `Session` and `SessionManager` classes. These provide:
- **State persistence**: Save and load complete project state
- **History tracking**: Full undo/redo support for stories and characters
- **Scene pipeline**: Manage the flow from story → scenes → images → video

```typescript
import { SessionManager, MemoryStorageAdapter } from 'sidvid';
// For Node.js/CLI, import FileStorageAdapter directly:
// import { FileStorageAdapter } from 'sidvid/storage/file-adapter';

// Create a session manager with storage
const manager = new SessionManager(new MemoryStorageAdapter());

// Create a new session
const session = await manager.createSession('My Video Project', {
  openaiApiKey: process.env.OPENAI_API_KEY!
});

// Generate a story (automatically tracked in history)
await session.generateStory({
  prompt: 'A detective solving a mystery',
  scenes: 3
});

// Edit the story (creates new history entry, preserves original)
await session.editStory({
  editPrompt: 'Make it more dramatic'
});

// Undo/redo story changes
session.undoStory();
session.redoStory();

// Extract characters from the story
const characters = session.extractCharacters();
for (const char of characters) {
  // Enhance and generate images (tracked in character history)
  await session.enhanceCharacter(char.id);
  await session.generateCharacterImage(char.id);
}

// Initialize scene pipeline from story
session.initializeScenePipeline();
const pipeline = session.getScenePipeline();

// Assign characters to scene slots
const charIds = session.extractCharacters().map(c => c.id);
session.assignCharactersToSlot(pipeline.slots[0].id, charIds);

// Generate scene images
await session.generateAllPendingSlots();

// Save session for later
await manager.saveSession(session);

// Load session later
const loadedSession = await manager.loadSession(session.id, {
  openaiApiKey: process.env.OPENAI_API_KEY!
});
```

#### Session Methods

**Story Management:**
- `generateStory(options)` - Generate a new story (adds to history)
- `editStory(options)` - Edit current story (adds to history)
- `getCurrentStory()` - Get the current story
- `getStoryHistory()` - Get all story versions
- `undoStory()` / `redoStory()` - Navigate story history

**Character Management:**
- `extractCharacters()` - Extract characters from current story
- `enhanceCharacter(characterId, userPrompt?)` - Enhance character description
- `generateCharacterImage(characterId)` - Generate character image
- `getCharacterHistory(characterId)` - Get character version history
- `undoCharacter(characterId)` / `redoCharacter(characterId)` - Navigate character history

**Scene Pipeline:**
- `initializeScenePipeline()` - Create scene slots from current story
- `getScenePipeline()` - Get current pipeline state
- `assignCharactersToSlot(slotId, characterIds)` - Assign characters to a scene
- `setSlotCustomDescription(slotId, description)` - Override scene description
- `addSlot()` / `removeSlot(slotId)` - Manage scene slots
- `reorderSlots(slotIds)` - Reorder scene slots
- `generateSlotImage(slotId)` - Generate image for one slot
- `generateAllPendingSlots()` - Generate images for all pending slots
- `regenerateSlot(slotId)` - Regenerate a completed slot

### Direct API (Stateless)

For simple, one-off operations without state management, use the `SidVid` class directly:

```typescript
import { SidVid } from 'sidvid';

const sidvid = new SidVid({
  openaiApiKey: process.env.OPENAI_API_KEY,
});

// One-off story generation
const story = await sidvid.generateStory({
  prompt: 'A detective solving a mystery',
  scenes: 5,
});
```

### API Reference

#### `new SidVid(config)`

Creates a new SidVid client for stateless operations.

**Parameters:**
- `config.openaiApiKey` (string, required) - Your OpenAI API key

#### Story Methods

**`generateStory(options): Promise<Story>`**
- `options.prompt` (string, required) - Story prompt
- `options.scenes` (number, optional) - Number of scenes (default: 5)
- `options.style` (string, optional) - Writing style
- Returns: Story with title, scenes, characters, and scene visuals

**`editStory(options): Promise<Story>`**
- `options.currentStory` (Story, required) - Existing story object
- `options.editPrompt` (string, required) - Instructions for editing
- `options.length` (string, optional) - Video length context (e.g., '5s')
- Returns: Updated story with same structure

#### Character Methods

**`enhanceCharacterDescription(options): Promise<string>`**
- `options.description` (string, required) - Basic character description
- `options.maxTokens` (number, optional) - Max response length (default: 1000)
- Returns: Enhanced, detailed character description

**`generateCharacter(options): Promise<Character>`**
- `options.description` (string, required) - Character description
- `options.style` ('realistic' | 'anime' | 'cartoon' | 'cinematic', optional)
- `options.size` ('1024x1024' | '1792x1024' | '1024x1792', optional)
- `options.quality` ('standard' | 'hd', optional)
- Returns: Character with imageUrl and revisedPrompt

#### Scene Methods

**`generateScene(options): Promise<Scene>`**
- `options.description` (string, required) - Scene description
- `options.style` ('realistic' | 'anime' | 'cartoon' | 'cinematic', optional)
- `options.aspectRatio` ('1:1' | '16:9' | '9:16', optional)
- `options.quality` ('standard' | 'hd', optional)
- Returns: Scene with imageUrl and revisedPrompt

#### Video Methods

**`generateVideo(options): Promise<Video>`**
- `options.prompt` (string, required) - Video prompt
- `options.duration` (4 | 8 | 12, optional) - Duration in seconds
- `options.size` ('720x1280' | '1280x720' | '1024x1792' | '1792x1024', optional)
- `options.model` ('sora-2' | 'sora-2-pro', optional)
- Returns: Video with id and status

**`getVideoStatus(videoId): Promise<Video>`**
- `videoId` (string, required) - Video ID from generateVideo
- Returns: Current video status and progress

**`waitForVideo(videoId, options?): Promise<Video>`**
- `videoId` (string, required) - Video ID from generateVideo
- `options.pollInterval` (number, optional) - Polling interval in ms
- `options.timeout` (number, optional) - Maximum wait time in ms
- Returns: Completed video with URL

### TypeScript Types

```typescript
import type {
  // Story types
  Story,
  StoryOptions,
  EditStoryOptions,
  StoryScene,
  StoryCharacter,
  StorySceneVisual,
  // Character types
  Character,
  CharacterOptions,
  EnhanceCharacterOptions,
  // Scene types
  Scene,
  SceneOptions,
  // Video types
  Video,
  VideoOptions,
  // Scene pipeline types
  ScenePipeline,
  SceneSlot,
  // Session types
  SessionMetadata,
} from 'sidvid';

// Session and SessionManager classes
import { Session, SessionManager } from 'sidvid';

// Storage adapters
import { MemoryStorageAdapter, BrowserStorageAdapter } from 'sidvid';
// For Node.js/CLI only (uses fs/promises):
import { FileStorageAdapter } from 'sidvid/storage/file-adapter';
```

## Running the Web UI Locally

The Web UI is a SvelteKit application that provides a visual interface for the library.

### Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open your browser to `http://localhost:5173`

### Using the Web UI

The Web UI follows a **World → Storyboard → Video** workflow with collapsible sections:

#### Story Section
1. Select a visual style preset (Anime, Photorealistic, 3D Animated, etc.)
2. Enter a story prompt describing your video concept
3. Click "Generate Story" to create narrative with scenes and characters
4. Edit story manually or with AI prompts
5. Use "Smart Expand" to add detail to the narrative

#### World Section
World elements are reusable across scenes. Four types:
- **Characters**: People, creatures, anything with agency
- **Locations**: Places where scenes occur
- **Objects**: Physical items, props, vehicles
- **Concepts**: Abstract ideas key to the plot

For each element:
- **Enhance**: Expand description with ChatGPT
- **Generate Image**: Create reference image with DALL-E 3

#### Storyboard Section
1. Scenes are auto-populated from story (or create manually)
2. Assign world elements to scenes via the Elements sidebar
3. Generate poster images for each scene
4. Reorder scenes with drag-and-drop

#### Video Section
1. Review scene thumbnails from storyboard
2. Click "Generate Video" to create video with Kling AI
3. Preview and download final video

### UI Controls (Bottom Right)

The Web UI includes three control buttons in the bottom-right corner:

#### Export Button (Testing Mode only)
- Exports current application state to clipboard/console
- Useful for debugging and test development
- Only visible when Testing Mode is enabled

#### Prototyping / Production Toggle
- **Prototyping Mode (Orange)**: Fast generation using DALL-E only
  - Quicker scene image generation
  - No character consistency across scenes
  - Ideal for rapid iteration and concept exploration
- **Production Mode (Green)**: Character consistency enabled via Flux Kontext
  - Uses character reference images for scene generation
  - Maintains visual consistency across all scenes
  - Requires Kie.ai API key for Flux Kontext

#### Testing Mode Toggle (Flask Icon)
- Enables testing features for development
- Shows Export button
- Displays additional debug information

### Building the UI

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Using the CLI

The CLI provides command-line access to the SidVid library with an interactive spinner and flexible output options.

### Installation Options

#### Option 1: Install from NPM (Global)

```bash
npm install -g sidvid
# or
pnpm add -g sidvid

# Then use anywhere
sidvid story "A detective solving a mystery"
```

#### Option 2: Install from NPM (Local to Project)

```bash
npm install sidvid
# or
pnpm add sidvid

# Then use with npx
npx sidvid story "A detective solving a mystery"
```

#### Option 3: Run Locally from Source

```bash
# Clone the repository
git clone https://github.com/mark-mcdermott/sidvid-core.git
cd sidvid-core/core

# Set your OpenAI API key
export OPENAI_API_KEY=sk-your-api-key-here
# or add to your .env file

# Run commands using the wrapper script (clean output)
./sidvid <command> [options]

# Or using pnpm (shows build messages)
pnpm cli <command> [options]
```

### CLI Features

#### Output Modes

**Default (Concise)**: Shows only essential output
```bash
sidvid story "A detective solving a mystery"
# Output: Title and scenes only
```

**Verbose (`-v` or `--verbose`)**: Shows full output including character metadata and raw JSON
```bash
sidvid -v story "A detective solving a mystery"
# Output: Title, scenes, characters, and full JSON
```

### CLI Commands

#### Story Generation

```bash
# Generate a story (concise output)
sidvid story "A detective solving a mystery"

# Generate a story (verbose output with characters and JSON)
sidvid -v story "A detective solving a mystery"

# Edit a story (save story JSON to file first)
sidvid edit-story story.json "Make it more dramatic"

# Edit a story (verbose output with updated JSON)
sidvid -v edit-story story.json "Make it more dramatic"
```

#### Character Generation

```bash
# Standalone: Enhance a short description
./sidvid enhance-character "A detective"

# Generate character image
./sidvid character "A tall detective in a trenchcoat with silver hair"

# From story metadata workflow:
# 1. Generate story (includes character metadata)
# 2. Extract character descriptions from JSON
# 3. Enhance each description
# 4. Generate images
```

#### Scene Generation

```bash
# Generate a scene image
./sidvid scene "A rainy street at night with neon lights"
```

#### Video Generation

```bash
# Generate a video
./sidvid video "A cat playing piano in a jazz club"

# Check video status
./sidvid status video_abc123
```

#### Help

```bash
# Show all commands and options
sidvid help
```

### CLI Options

**`-v, --verbose`**: Enable verbose output mode
- Can be placed anywhere in the command: before command, after command, or at the end
- Shows full output including character metadata and raw JSON for story commands
- Examples:
  ```bash
  sidvid -v story "test"      # Flag before command
  sidvid story -v "test"      # Flag after command
  sidvid story "test" -v      # Flag at end
  ```

## Development

```bash
# Start dev server (hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check

# Lint
pnpm lint

# Format
pnpm format
```

## Building the Library

Build the headless library for npm distribution:

```bash
pnpm build:lib
```

This creates a distributable package that other developers can use in their projects.

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key

Copy `.env.example` to `.env` and add your keys.

## Use Cases

### For Developers

Use the headless library to power your own tools:

```typescript
// In your own app
import { SidVid } from 'sidvid';

const sidvid = new SidVid({ openaiApiKey: apiKey });
const story = await sidvid.generateStory({ prompt: userInput });
// Use story data in your custom workflow
```

### For Content Creators

Use the Web UI for visual, interactive video creation:
1. Generate and refine stories
2. Create character images from story metadata
3. Generate scene visuals
4. Produce final videos

### For Automation

Use the CLI in scripts and workflows:

```bash
#!/bin/bash
# Automated video generation pipeline
sidvid story "A hero's journey" > story.json
sidvid character "$(jq -r '.characters[0].description' story.json)" > char1.json
sidvid video "$(jq -r '.scenes[0].description' story.json)" > video1.json
```

## Known Limitations & v2 Roadmap

### Current Limitations (v1)

| Limitation | Reason | Workaround |
|------------|--------|------------|
| **Fixed 5-second scenes** | Kling AI generates 5s or 10s clips; we default to 5s for simplicity | None currently - all scenes are 5 seconds |
| **No built-in video stitching** | Video assembly requires FFmpeg or external service; not feasible in Cloudflare Workers | Implement your own assembly using FFmpeg, Shotstack, or similar |
| **Target duration in 5s increments** | Matches Kling's clip duration constraints | Request duration as multiple of 5 |

### v2 Roadmap

- [ ] **Variable scene durations** - Support 5s or 10s per scene based on content complexity
- [ ] **Built-in video assembly adapter** - Optional adapter for common platforms (FFmpeg, cloud services)
- [ ] **Transition effects** - Per-storyboard-scene transition options (fade, dissolve, cut, etc.) applied during video assembly
- [ ] **Style reference images** - Upload reference images to guide visual style (when video providers expose this API)
- [ ] **Video provider abstraction** - Support multiple video generation backends beyond Kling (Runway, Pika, etc.)

## License

MIT
