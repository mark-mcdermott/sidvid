import { z } from 'zod';

export const sidVidConfigSchema = z.object({
  openaiApiKey: z.string().min(1, 'OpenAI API key is required'),
  kieApiKey: z.string().optional(),
  /** @deprecated Use kieApiKey instead */
  klingApiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultImageModel: z.string().optional(),
  defaultVideoModel: z.string().optional(),
});

export const storyOptionsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  scenes: z.number().int().min(1).max(20).optional().default(5),
  style: z.string().optional(),
  maxTokens: z.number().int().min(100).max(4000).optional().default(2000),
});

export const characterOptionsSchema = z.object({
  description: z.string().min(1, 'Character description is required'),
  style: z.enum(['realistic', 'anime', 'cartoon', 'cinematic']).optional().default('realistic'),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional().default('1024x1024'),
  quality: z.enum(['standard', 'hd']).optional().default('hd'),
});

export const sceneOptionsSchema = z.object({
  description: z.string().min(1, 'Scene description is required'),
  style: z.enum(['realistic', 'anime', 'cartoon', 'cinematic']).optional().default('cinematic'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional().default('16:9'),
  quality: z.enum(['standard', 'hd']).optional().default('hd'),
});

export const videoOptionsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  imageUrl: z.string().url().optional(),
  duration: z.union([
    z.literal(4),
    z.literal(5),
    z.literal(8),
    z.literal(10),
    z.literal(12)
  ]).optional().default(5),
  size: z.enum(['720x1280', '1280x720', '1024x1792', '1792x1024']).optional().default('1280x720'),
  provider: z.enum(['mock', 'kling', 'sora']).optional().default('mock'),
  sound: z.boolean().optional().default(true),
  model: z.enum(['sora-2', 'sora-2-pro', 'kling-2.6']).optional().default('kling-2.6'),
});

export const fluxKontextImageOptionsSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  referenceImageUrl: z.string().url().optional(),
  aspectRatio: z.enum(['16:9', '21:9', '4:3', '1:1', '3:4', '9:16', '16:21']).optional().default('16:9'),
  model: z.enum(['flux-kontext-pro', 'flux-kontext-max']).optional().default('flux-kontext-pro'),
  outputFormat: z.enum(['jpeg', 'png']).optional().default('jpeg'),
  safetyTolerance: z.number().int().min(0).max(6).optional().default(2),
  promptUpsampling: z.boolean().optional().default(false),
});
