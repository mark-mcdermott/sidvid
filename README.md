# SidVid Core

Local-first SvelteKit app with the sidvid library for AI video generation.

## Features

- **sidvid library**: OpenAI wrapper for ChatGPT, DALL-E 3, Sora (npm exportable)
- **Local UI**: SvelteKit interface with SQLite storage
- **Workflow**: Prompt → Story → Characters → Scenes → Storyboard → Video
- **Desktop**: Optional Tauri wrapper for standalone app

## Installation

```bash
pnpm install
```

## Development

```bash
# Start dev server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check

# Build SvelteKit app
pnpm build

# Build npm library
pnpm build:lib
```

## Using the Library

The sidvid library can be used independently:

```typescript
import { SidVid } from 'sidvid';

const sidvid = new SidVid({
  openaiApiKey: process.env.OPENAI_API_KEY,
});

// Generate a story
const story = await sidvid.generateStory({
  prompt: 'A detective solving a mystery',
  scenes: 5,
});

// Generate a scene image
const scene = await sidvid.generateScene({
  description: 'A rainy street at night',
  style: 'cinematic',
  aspectRatio: '16:9',
});

// Generate a video
const video = await sidvid.generateVideo({
  prompt: 'A cat playing piano',
  duration: 4, // 4, 8, or 12 seconds
});

// Wait for video completion
const completed = await sidvid.waitForVideo(video.id);
```

## API

### `new SidVid(config)`

- `config.openaiApiKey` - Your OpenAI API key (required)

### Methods

| Method | API | Description |
|--------|-----|-------------|
| `generateStory(options)` | ChatGPT | Generate story scripts |
| `generateCharacter(options)` | DALL-E 3 | Generate character images |
| `generateScene(options)` | DALL-E 3 | Generate scene images |
| `generateStoryboard(options)` | ChatGPT + DALL-E | Generate full storyboard |
| `generateVideo(options)` | Sora | Generate video clips |
| `getVideoStatus(videoId)` | Sora | Check video status |
| `waitForVideo(videoId)` | Sora | Poll until complete |

## Environment Variables

Copy `.env.example` to `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-api-key-here
```

## License

MIT
