# Video Feature E2E Tests

## Overview
Tests for final video generation using OpenAI Sora.

## Test Coverage

### Core Functionality
- [ ] Generate video from storyboard
- [ ] Show generation progress
- [ ] Handle long generation times
- [ ] Cancel generation
- [ ] Select resolution/format/FPS
- [ ] Add audio/music

### Video Preview
- [ ] Display video player
- [ ] Play/pause controls
- [ ] Scrubbing
- [ ] Fullscreen mode
- [ ] Show metadata

### Video Management
- [ ] Download video
- [ ] Store locally
- [ ] Regenerate with different settings
- [ ] Version history
- [ ] Share video

### Integration Points
**Input:** Storyboard from `/storyboard`
```typescript
{
  id: string;
  scenes: {
    id: string;
    description: string;
    imageUrl: string;
    duration: number;
    order: number;
    transition: object;
    textOverlays?: object[];
  }[];
  totalDuration: number;
}
```

**Output:** Final video
```typescript
{
  id: string;
  url: string; // local path after download
  storyboardId: string;
  settings: {
    resolution: '720p' | '1080p' | '4K';
    format: 'mp4' | 'webm' | 'mov';
    fps: 24 | 30 | 60;
  };
  metadata: {
    duration: number;
    fileSize: number;
    generatedAt: number;
  };
  versions: {
    id: string;
    url: string;
    settings: object;
    createdAt: number;
  }[];
}
```

## Dependencies
- OpenAI Sora API (for video generation)
- Video storage API
- Video player component
- Share/download utilities

## Mock Data Strategy
- Mock Sora API responses (long-running)
- Mock video file downloads
- Mock local video storage
- Use sample video files for testing player
