import { z } from 'zod';

export const sidVidConfigSchema = z.object({
  openaiApiKey: z.string().min(1, 'OpenAI API key is required'),
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
  duration: z.union([z.literal(4), z.literal(8), z.literal(12)]).optional().default(8),
  size: z.enum(['720x1280', '1280x720', '1024x1792', '1792x1024']).optional().default('1280x720'),
  model: z.enum(['sora-2', 'sora-2-pro']).optional().default('sora-2'),
});
