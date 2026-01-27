import { describe, it, expect } from 'vitest';
import {
  sidVidConfigSchema,
  storyOptionsSchema,
  characterOptionsSchema,
  sceneOptionsSchema,
  videoOptionsSchema,
} from '../../src/lib/sidvid/schemas';

describe('sidVidConfigSchema', () => {
  it('validates valid config', () => {
    const result = sidVidConfigSchema.safeParse({
      openaiApiKey: 'sk-test-key-123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty API key', () => {
    const result = sidVidConfigSchema.safeParse({
      openaiApiKey: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing API key', () => {
    const result = sidVidConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('storyOptionsSchema', () => {
  it('validates valid story options', () => {
    const result = storyOptionsSchema.safeParse({
      prompt: 'A detective story',
      scenes: 5,
    });
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = storyOptionsSchema.parse({
      prompt: 'A detective story',
    });
    expect(result.scenes).toBe(5);
    expect(result.maxTokens).toBe(2000);
  });

  it('rejects empty prompt', () => {
    const result = storyOptionsSchema.safeParse({
      prompt: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects scenes out of range', () => {
    const tooMany = storyOptionsSchema.safeParse({
      prompt: 'Test',
      scenes: 25,
    });
    expect(tooMany.success).toBe(false);

    const tooFew = storyOptionsSchema.safeParse({
      prompt: 'Test',
      scenes: 0,
    });
    expect(tooFew.success).toBe(false);
  });
});

describe('characterOptionsSchema', () => {
  it('validates valid character options', () => {
    const result = characterOptionsSchema.safeParse({
      description: 'A tall detective in a trenchcoat',
    });
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = characterOptionsSchema.parse({
      description: 'A character',
    });
    expect(result.style).toBe('realistic');
    expect(result.size).toBe('1024x1024');
    expect(result.quality).toBe('hd');
  });

  it('validates style enum', () => {
    const valid = characterOptionsSchema.safeParse({
      description: 'A character',
      style: 'anime',
    });
    expect(valid.success).toBe(true);

    const invalid = characterOptionsSchema.safeParse({
      description: 'A character',
      style: 'invalid-style',
    });
    expect(invalid.success).toBe(false);
  });
});

describe('sceneOptionsSchema', () => {
  it('validates valid scene options', () => {
    const result = sceneOptionsSchema.safeParse({
      description: 'A rainy street at night',
    });
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = sceneOptionsSchema.parse({
      description: 'A scene',
    });
    expect(result.style).toBe('cinematic');
    expect(result.aspectRatio).toBe('16:9');
    expect(result.quality).toBe('hd');
  });
});

describe('videoOptionsSchema', () => {
  it('validates valid video options', () => {
    const result = videoOptionsSchema.safeParse({
      prompt: 'A cat playing piano',
    });
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const result = videoOptionsSchema.parse({
      prompt: 'A video',
    });
    expect(result.duration).toBe(5);
    expect(result.size).toBe('1280x720');
    expect(result.model).toBe('kling-2.6');
  });

  it('validates duration values', () => {
    const valid = videoOptionsSchema.safeParse({
      prompt: 'Test',
      duration: 10,
    });
    expect(valid.success).toBe(true);

    const invalid = videoOptionsSchema.safeParse({
      prompt: 'Test',
      duration: 7, // 7 is not a valid duration option
    });
    expect(invalid.success).toBe(false);
  });
});
