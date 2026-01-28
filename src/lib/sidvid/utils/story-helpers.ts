/**
 * Calculate the appropriate number of scenes based on video length and scene duration
 *
 * Since Kling only supports 5-second clips, scenes = totalLength / sceneLength
 * with a minimum of 1 scene.
 *
 * @param videoLength - Total video length (e.g., "5s", "30s", "1m")
 * @param sceneDuration - Duration per scene in seconds (default: 5s for Kling)
 */
export function calculateSceneCount(videoLength: string, sceneDuration: number = 5): number {
  // Parse video length (e.g., "2s", "30s", "1m")
  const match = videoLength.match(/^(\d+)([sm])$/);
  if (!match) {
    // Default to 1 scene if format is invalid
    return 1;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  // Convert to seconds
  const totalSeconds = unit === 'm' ? value * 60 : value;

  // Calculate scene count: total video length / scene duration
  // Use Math.max to ensure at least 1 scene
  return Math.max(1, Math.floor(totalSeconds / sceneDuration));
}

/**
 * Parse video length string to seconds
 */
export function parseVideoLengthToSeconds(videoLength: string): number {
  const match = videoLength.match(/^(\d+)([sm])$/);
  if (!match) return 5; // Default to 5 seconds

  const value = parseInt(match[1], 10);
  const unit = match[2];
  return unit === 'm' ? value * 60 : value;
}

/**
 * Calculate per-scene duration based on total video length and scene count
 */
export function calculateSceneDuration(videoLength: string, sceneCount: number): number {
  const totalSeconds = parseVideoLengthToSeconds(videoLength);
  // Round to 1 decimal place for reasonable precision
  return Math.round((totalSeconds / sceneCount) * 10) / 10;
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
