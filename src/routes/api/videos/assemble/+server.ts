import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assembleVideos } from '$lib/sidvid/api/video-assembly';

export interface AssembleRequest {
	clips: Array<{
		url: string;
		duration?: number;
	}>;
}

export interface AssembleResponse {
	success: boolean;
	videoBase64?: string;
	mimeType?: string;
	error?: string;
}

/**
 * POST /api/videos/assemble
 *
 * Assembles multiple video clips into a single video using FFmpeg.
 * Returns the assembled video as base64-encoded data.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as AssembleRequest;

		if (!body.clips || !Array.isArray(body.clips) || body.clips.length === 0) {
			return json(
				{ success: false, error: 'No clips provided' } as AssembleResponse,
				{ status: 400 }
			);
		}

		// Validate all clips have URLs
		for (let i = 0; i < body.clips.length; i++) {
			if (!body.clips[i].url) {
				return json(
					{ success: false, error: `Clip ${i + 1} is missing URL` } as AssembleResponse,
					{ status: 400 }
				);
			}
		}

		console.log(`[API] Assembling ${body.clips.length} video clips`);

		const result = await assembleVideos(body.clips);

		if (!result.success || !result.videoBuffer) {
			return json(
				{ success: false, error: result.error || 'Assembly failed' } as AssembleResponse,
				{ status: 500 }
			);
		}

		// Convert buffer to base64 for transmission
		const videoBase64 = result.videoBuffer.toString('base64');

		console.log(`[API] Assembly successful, returning ${videoBase64.length} bytes base64`);

		return json({
			success: true,
			videoBase64,
			mimeType: 'video/mp4'
		} as AssembleResponse);
	} catch (err) {
		console.error('[API] Video assembly error:', err);
		return json(
			{
				success: false,
				error: err instanceof Error ? err.message : 'Internal server error'
			} as AssembleResponse,
			{ status: 500 }
		);
	}
};
