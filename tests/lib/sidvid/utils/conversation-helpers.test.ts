import { describe, it, expect } from 'vitest';
import { truncateTitle } from '../../../../src/lib/sidvid/utils/conversation-helpers';

describe('truncateTitle', () => {
  it('returns titles with 3 or fewer words as-is', () => {
    expect(truncateTitle('The Detective')).toBe('The Detective');
    expect(truncateTitle('A New Beginning')).toBe('A New Beginning');
    expect(truncateTitle('Adventure')).toBe('Adventure');
  });

  it('returns 4-word titles as-is', () => {
    expect(truncateTitle('The Mystery of Shadows')).toBe('The Mystery of Shadows');
    expect(truncateTitle('A Journey Through Time')).toBe('A Journey Through Time');
  });

  it('returns 5-word titles as-is', () => {
    expect(truncateTitle('The Secret of the Cave')).toBe('The Secret of the Cave');
    expect(truncateTitle('A Tale of Two Cities')).toBe('A Tale of Two Cities');
  });

  it('truncates 6-word titles to 5 words with ellipsis', () => {
    expect(truncateTitle('The Adventures of Captain Nova Today')).toBe('The Adventures of Captain Nova...');
    expect(truncateTitle('A Long Story About Many Things')).toBe('A Long Story About Many...');
  });

  it('truncates very long titles to 5 words with ellipsis', () => {
    expect(truncateTitle('The Incredible Adventures of a Brave Hero in Space')).toBe('The Incredible Adventures of a...');
    expect(truncateTitle('Once Upon a Time There Was a Great Story')).toBe('Once Upon a Time There...');
  });

  it('handles titles with extra whitespace', () => {
    expect(truncateTitle('  The Detective  ')).toBe('The Detective');
    expect(truncateTitle('The   Adventures   of   Captain   Nova   Today')).toBe('The Adventures of Captain Nova...');
  });

  it('handles empty and single-word titles', () => {
    expect(truncateTitle('')).toBe('');
    expect(truncateTitle('Mystery')).toBe('Mystery');
  });
});
