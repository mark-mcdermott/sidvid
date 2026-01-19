# SidVid

AI-powered video generation platform using OpenAI's ChatGPT, DALL-E 3, and Sora. Create at each stage from idea to finished product (story idea, character generation, still scene generation, storyboard drag and drop and final video) and the product from one stage is input for the next.

## Architecture

SidVid follows a **headless library** architecture with two thin client wrappers:

```
┌─────────────────────────────────────┐
│  Headless Library (src/lib/sidvid)  │
│  --------------------------------   │
│  Pure TypeScript API methods:       │
│  - generateStory()                  │
│  - editStory()                      │
│  - enhanceCharacterDescription()    │
│  - generateCharacter()              │
│  - generateScene()                  │
│  - generateVideo()                  │
└─────────────────────────────────────┘
            ↑              ↑
            │              │
     ┌──────┴──────┐  ┌─── ┴───────┐
     │   Web UI    │  │  CLI       │
     │  (routes/)  │  │  (cli/)    │
     │  SvelteKit  │  │  Node.js   │
     └─────────────┘  └────────────┘
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
│   │   ├── types/           # TypeScript interfaces
│   │   ├── schemas/         # Zod validation schemas
│   │   ├── client.ts        # Main SidVid class
│   │   └── index.ts         # Public exports
│   │
│   ├── routes/              # Web UI (SvelteKit)
│   │   ├── story/           # Story generation page
│   │   ├── characters/      # Character generation page
│   │   └── +layout.svelte   # App layout
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

### API Reference

#### `new SidVid(config)`

Creates a new SidVid client.

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
  Story,
  StoryOptions,
  EditStoryOptions,
  StoryCharacter,
  StorySceneVisual,
  Character,
  CharacterOptions,
  EnhanceCharacterOptions,
  Scene,
  SceneOptions,
  Video,
  VideoOptions,
} from 'sidvid';
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

#### Story Generation (`/story`)
1. Select video length (2s - 30m)
2. Enter a story prompt
3. Click "Generate Story"
4. View generated story with:
   - Scene descriptions, dialogue, and action
   - Extracted character metadata
   - Scene visual metadata

**Story Editing:**
- **Try Again**: Generate a new version with different length/prompt
- **Edit Story Manually**: Edit the raw JSON directly
- **Edit Story with Prompt**: Ask GPT-4 to modify the story
- Click "Send to Character Generation" when done

#### Character Generation (`/characters`)

**Two workflows:**

1. **From Story** (recommended):
   - Navigate from story page using "Send to Character Generation"
   - Automatically loads all characters from story metadata
   - Switch between characters using tabs

2. **Standalone**:
   - Enter custom character descriptions
   - Click "Add" to add to character list

**For each character:**
- **Enhance Description**: Expand basic description using GPT-4
- **Generate Image**: Create character image with DALL-E 3
- View enhanced descriptions and generated images inline

### Building the UI

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Running the CLI Locally

The CLI provides command-line access to the library.

### Setup

1. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=sk-your-api-key-here
   # or add to your .env file
   ```

2. Run commands:
   ```bash
   pnpm cli <command> [options]
   ```

### CLI Commands

#### Story Generation

```bash
# Generate a story
pnpm cli story "A detective solving a mystery"

# Output includes:
# - Story title
# - Scene descriptions, dialogue, actions
# - Character metadata
# - Full JSON for further processing

# Edit a story (save story JSON to file first)
pnpm cli edit-story story.json "Make it more dramatic"
```

#### Character Generation

```bash
# Standalone: Enhance a short description
pnpm cli enhance-character "A detective"

# Generate character image
pnpm cli character "A tall detective in a trenchcoat with silver hair"

# From story metadata workflow:
# 1. Generate story (includes character metadata)
# 2. Extract character descriptions from JSON
# 3. Enhance each description
# 4. Generate images
```

#### Scene Generation

```bash
# Generate a scene image
pnpm cli scene "A rainy street at night with neon lights"
```

#### Video Generation

```bash
# Generate a video
pnpm cli video "A cat playing piano in a jazz club"

# Check video status
pnpm cli status video_abc123
```

#### Help

```bash
# Show all commands
pnpm cli help
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

## License

MIT
