/**
 * Client-side video assembly utility
 *
 * Calls the server-side FFmpeg assembly endpoint and creates a blob URL
 * for the stitched video.
 */

export interface VideoClip {
	url: string;
	duration?: number;
}

export interface AssemblyResult {
	success: boolean;
	blobUrl?: string;
	error?: string;
}

/**
 * Assemble multiple video clips into a single video.
 *
 * @param clips - Array of video clips with URLs
 * @returns Result with blob URL for the assembled video or error
 *
 * @example
 * ```typescript
 * const result = await assembleVideoClips([
 *   { url: 'https://example.com/clip1.mp4', duration: 5 },
 *   { url: 'https://example.com/clip2.mp4', duration: 5 }
 * ]);
 *
 * if (result.success && result.blobUrl) {
 *   videoElement.src = result.blobUrl;
 * }
 * ```
 */
export async function assembleVideoClips(clips: VideoClip[]): Promise<AssemblyResult> {
	if (clips.length === 0) {
		return { success: false, error: 'No clips provided' };
	}

	if (clips.length === 1) {
		// Single clip - no assembly needed, return the URL directly
		return { success: true, blobUrl: clips[0].url };
	}

	try {
		console.log(`[Video Assembly] Requesting assembly of ${clips.length} clips`);

		const response = await fetch('/api/videos/assemble', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ clips })
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('[Video Assembly] API error:', error);
			return { success: false, error: `API error: ${response.status}` };
		}

		const data = await response.json();

		if (!data.success || !data.videoBase64) {
			return { success: false, error: data.error || 'Assembly failed' };
		}

		// Convert base64 to blob
		const binaryString = atob(data.videoBase64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const blob = new Blob([bytes], { type: data.mimeType || 'video/mp4' });

		// Create blob URL
		const blobUrl = URL.createObjectURL(blob);

		console.log(`[Video Assembly] Successfully created blob URL for assembled video`);

		return { success: true, blobUrl };
	} catch (err) {
		console.error('[Video Assembly] Client error:', err);
		return {
			success: false,
			error: err instanceof Error ? err.message : 'Failed to assemble videos'
		};
	}
}

/**
 * Revoke a blob URL to free memory.
 * Call this when done with the assembled video.
 */
export function revokeBlobUrl(blobUrl: string): void {
	if (blobUrl.startsWith('blob:')) {
		URL.revokeObjectURL(blobUrl);
	}
}
