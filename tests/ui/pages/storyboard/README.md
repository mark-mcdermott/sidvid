# Storyboard Feature E2E Tests

## Overview
Tests for storyboard creation and timeline editing before video generation.

## Test Coverage

### Core Functionality
- [ ] Display scenes in timeline
- [ ] Adjust scene order
- [ ] Adjust scene durations
- [ ] Set transition effects
- [ ] Add text overlays
- [ ] Add audio notes
- [ ] Preview playback
- [ ] Export as PDF/JSON

### Timeline Features
- [ ] Scrub through timeline
- [ ] Play/pause controls
- [ ] Current time display
- [ ] Total duration display

### Collaboration
- [ ] Add comments to scenes
- [ ] Flag scenes for review

### Integration Points
**Input:** Scenes from `/scenes`
```typescript
{
  id: string;
  description: string;
  imageUrl: string;
  characterIds: string[];
  duration: number;
  order: number;
}[]
```

**Output:** Storyboard data for `/video`
```typescript
{
  id: string;
  scenes: {
    id: string;
    description: string;
    imageUrl: string;
    duration: number;
    order: number;
    transition: {
      type: 'fade' | 'cut' | 'wipe' | 'dissolve';
      duration: number;
    };
    textOverlays?: {
      text: string;
      position: { x: number; y: number };
      style: object;
    }[];
    audioNotes?: string[];
  }[];
  totalDuration: number;
}
```

## Dependencies
- Conversation storage API
- PDF export library
- Timeline playback engine
