# Scenes Feature E2E Tests

## Overview
Tests for scene generation from story and characters using DALL-E 3.

## Test Coverage

### Core Functionality
- [ ] Generate scenes from story/characters
- [ ] Specify number of scenes
- [ ] Edit scene descriptions
- [ ] Regenerate scene images
- [ ] Add/remove scenes
- [ ] Reorder scenes
- [ ] Split/merge scenes
- [ ] Set scene durations

### Timeline Management
- [ ] Display chronological order
- [ ] Calculate total duration
- [ ] Update durations

### Integration Points
**Input:** Story + Characters from previous steps
```typescript
// Story
{
  id: string;
  content: string;
  prompt: string;
  length: string;
}

// Characters
{
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}[]
```

**Output:** Scene data for `/storyboard`
```typescript
{
  id: string;
  description: string;
  imageUrl: string; // local path
  characterIds: string[];
  duration: number; // seconds
  order: number;
}[]
```

## Dependencies
- OpenAI DALL-E 3 API (for scene images)
- OpenAI GPT-4o API (for scene descriptions)
- Image storage API
- Conversation storage API
