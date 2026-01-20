/**
 * Calculate the appropriate number of scenes based on video length
 *
 * Guidelines:
 * - Very short videos (1-3s): 1 scene, no dialogue
 * - Short videos (4-10s): 2-3 scenes, minimal dialogue
 * - Medium videos (11-30s): 4-6 scenes, some dialogue
 * - Long videos (31-60s): 7-10 scenes, full dialogue
 * - Extra long videos (60s+): 10-15 scenes, complex dialogue/action
 */
export function calculateSceneCount(videoLength: string): number {
  // Parse video length (e.g., "2s", "30s", "1m")
  const match = videoLength.match(/^(\d+)([sm])$/);
  if (!match) {
    // Default to 5 scenes if format is invalid
    return 5;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  // Convert to seconds
  const seconds = unit === 'm' ? value * 60 : value;

  // Calculate scene count based on video length
  if (seconds <= 3) return 1;
  if (seconds <= 10) return Math.ceil(seconds / 3); // ~2-3 scenes
  if (seconds <= 30) return Math.ceil(seconds / 5); // ~4-6 scenes
  if (seconds <= 60) return Math.ceil(seconds / 7); // ~7-9 scenes
  return Math.min(15, Math.ceil(seconds / 8)); // Up to 15 scenes for very long videos
}

/**
 * Get complexity guidance for ChatGPT based on video length
 */
export function getComplexityGuidance(videoLength: string): string {
  const match = videoLength.match(/^(\d+)([sm])$/);
  if (!match) return 'Keep scenes concise and visual.';

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const seconds = unit === 'm' ? value * 60 : value;

  if (seconds <= 3) {
    return 'This is an EXTREMELY SHORT video. Create a single, simple scene with ONE visual action. NO dialogue. Keep it to a single moment.';
  }
  if (seconds <= 10) {
    return 'This is a SHORT video. Keep each scene VERY brief with minimal or no dialogue. Focus on quick visual moments.';
  }
  if (seconds <= 30) {
    return 'This is a MEDIUM-length video. Keep scenes concise with brief dialogue. Each scene should be 3-5 seconds of screen time.';
  }
  if (seconds <= 60) {
    return 'This is a FULL-LENGTH video. You can include dialogue and action in each scene. Aim for 5-8 seconds per scene.';
  }
  return 'This is an EXTENDED video. You can create detailed scenes with full dialogue, multiple actions, and character development. Aim for 8-12 seconds per scene.';
}
