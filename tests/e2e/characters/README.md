# Characters Feature E2E Tests

## Overview
Tests for character generation from story content using DALL-E 3.

## Test Coverage

### Core Functionality
- [ ] Generate characters from story
- [ ] Specify number of characters
- [ ] Edit character names/descriptions
- [ ] Regenerate character images
- [ ] Add/remove characters
- [ ] Reorder characters

### Image Handling
- [ ] Download images from OpenAI
- [ ] Store images locally
- [ ] Replace remote URLs with local paths
- [ ] Display image placeholders
- [ ] Handle image errors

### Data Persistence
- [ ] Save characters to conversation
- [ ] Load from conversation history

### Integration Points
**Input:** Story data from `/story`
```typescript
{
  id: string;
  content: string;
  prompt: string;
  length: string;
}
```

**Output:** Character data for `/scenes`
```typescript
{
  id: string;
  name: string;
  description: string;
  imageUrl: string; // local path
  storyId: string;
}[]
```

## Dependencies
- OpenAI DALL-E 3 API (for character images)
- OpenAI GPT-4o API (for character descriptions)
- Image storage API
- Conversation storage API

## Mock Data Strategy
- Mock story input from previous step
- Mock DALL-E responses for images
- Mock file system for local image storage
