import { describe, it, expect } from 'vitest';
import { calculateSceneCount, getComplexityGuidance } from "../../../../src/lib/sidvid/utils/story-helpers";

describe('calculateSceneCount', () => {
  it('returns 1 scene for very short videos (1-3s)', () => {
    expect(calculateSceneCount('1s')).toBe(1);
    expect(calculateSceneCount('2s')).toBe(1);
    expect(calculateSceneCount('3s')).toBe(1);
  });

  it('returns 2-3 scenes for short videos (4-10s)', () => {
    expect(calculateSceneCount('4s')).toBe(2);
    expect(calculateSceneCount('6s')).toBe(2);
    expect(calculateSceneCount('9s')).toBe(3);
    expect(calculateSceneCount('10s')).toBe(4);
  });

  it('returns 4-6 scenes for medium videos (11-30s)', () => {
    expect(calculateSceneCount('15s')).toBe(3);
    expect(calculateSceneCount('20s')).toBe(4);
    expect(calculateSceneCount('25s')).toBe(5);
    expect(calculateSceneCount('30s')).toBe(6);
  });

  it('returns 7-9 scenes for long videos (31-60s)', () => {
    expect(calculateSceneCount('35s')).toBe(5);
    expect(calculateSceneCount('45s')).toBe(7);
    expect(calculateSceneCount('60s')).toBe(9);
  });

  it('handles minute format', () => {
    expect(calculateSceneCount('1m')).toBe(9); // 60s / 7 = 8.57 rounds to 9
    expect(calculateSceneCount('2m')).toBe(15);
  });

  it('caps at 15 scenes for very long videos', () => {
    expect(calculateSceneCount('3m')).toBe(15);
    expect(calculateSceneCount('5m')).toBe(15);
  });

  it('returns 5 for invalid format', () => {
    expect(calculateSceneCount('invalid')).toBe(5);
    expect(calculateSceneCount('abc')).toBe(5);
    expect(calculateSceneCount('')).toBe(5);
  });
});

describe('getComplexityGuidance', () => {
  it('provides extreme brevity guidance for 1-3s videos', () => {
    const guidance = getComplexityGuidance('2s');
    expect(guidance).toContain('EXTREMELY SHORT');
    expect(guidance).toContain('single');
    expect(guidance).toContain('NO dialogue');
  });

  it('provides minimal dialogue guidance for 4-10s videos', () => {
    const guidance = getComplexityGuidance('5s');
    expect(guidance).toContain('SHORT');
    expect(guidance).toContain('VERY brief');
    expect(guidance).toContain('minimal or no dialogue');
  });

  it('provides concise scene guidance for 11-30s videos', () => {
    const guidance = getComplexityGuidance('20s');
    expect(guidance).toContain('MEDIUM-length');
    expect(guidance).toContain('concise');
    expect(guidance).toContain('brief dialogue');
  });

  it('provides full dialogue guidance for 31-60s videos', () => {
    const guidance = getComplexityGuidance('45s');
    expect(guidance).toContain('FULL-LENGTH');
    expect(guidance).toContain('dialogue and action');
  });

  it('provides detailed scene guidance for 60s+ videos', () => {
    const guidance = getComplexityGuidance('2m');
    expect(guidance).toContain('EXTENDED');
    expect(guidance).toContain('detailed');
    expect(guidance).toContain('character development');
  });

  it('returns default guidance for invalid format', () => {
    const guidance = getComplexityGuidance('invalid');
    expect(guidance).toContain('concise');
  });
});
