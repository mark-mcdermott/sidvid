import { spawn } from 'child_process';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Video clip to be assembled
 */
export interface VideoClip {
	url: string;
	duration?: number;
}

/**
 * Video assembly result
 */
export interface AssemblyResult {
	success: boolean;
	videoPath?: string;
	videoBuffer?: Buffer;
	error?: string;
}

/**
 * Get the path to the FFmpeg binary
 */
function getFFmpegPath(): string {
	try {
		// Use @ffmpeg-installer/ffmpeg package
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffmpeg = require('@ffmpeg-installer/ffmpeg');
		return ffmpeg.path;
	} catch {
		// Fall back to system ffmpeg
		return 'ffmpeg';
	}
}

/**
 * Download a video from URL to a local file
 */
async function downloadVideo(url: string, outputPath: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
	}

	const buffer = await response.arrayBuffer();
	await writeFile(outputPath, Buffer.from(buffer));
}

/**
 * Create a concat demuxer file for FFmpeg
 * This file lists all input videos in order
 */
async function createConcatFile(inputPaths: string[], concatFilePath: string): Promise<void> {
	const content = inputPaths
		.map((path) => `file '${path}'`)
		.join('\n');

	await writeFile(concatFilePath, content);
}

/**
 * Run FFmpeg to concatenate videos
 */
function runFFmpeg(
	concatFilePath: string,
	outputPath: string,
	ffmpegPath: string
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			'-f', 'concat',
			'-safe', '0',
			'-i', concatFilePath,
			'-c', 'copy',
			'-y',
			outputPath
		];

		console.log(`[Video Assembly] Running FFmpeg: ${ffmpegPath} ${args.join(' ')}`);

		const process = spawn(ffmpegPath, args);

		let stderr = '';
		process.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		process.on('close', (code) => {
			if (code === 0) {
				console.log('[Video Assembly] FFmpeg completed successfully');
				resolve();
			} else {
				console.error(`[Video Assembly] FFmpeg failed with code ${code}`);
				console.error('[Video Assembly] FFmpeg stderr:', stderr);
				reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
			}
		});

		process.on('error', (err) => {
			console.error('[Video Assembly] FFmpeg process error:', err);
			reject(err);
		});
	});
}

/**
 * Clean up temporary files
 */
async function cleanup(paths: string[]): Promise<void> {
	for (const path of paths) {
		try {
			if (existsSync(path)) {
				await unlink(path);
			}
		} catch (err) {
			console.warn(`[Video Assembly] Failed to clean up ${path}:`, err);
		}
	}
}

/**
 * Assemble multiple video clips into a single video using FFmpeg concat demuxer.
 * This is the most reliable method for concatenating videos with the same codec.
 *
 * @param clips - Array of video clips to concatenate
 * @returns Assembly result with video buffer or error
 */
export async function assembleVideos(clips: VideoClip[]): Promise<AssemblyResult> {
	if (clips.length === 0) {
		return { success: false, error: 'No clips provided' };
	}

	if (clips.length === 1) {
		// Single clip - just return it directly
		try {
			const response = await fetch(clips[0].url);
			if (!response.ok) {
				throw new Error(`Failed to fetch video: ${response.status}`);
			}
			const buffer = Buffer.from(await response.arrayBuffer());
			return { success: true, videoBuffer: buffer };
		} catch (err) {
			return { success: false, error: `Failed to fetch single video: ${err}` };
		}
	}

	const ffmpegPath = getFFmpegPath();
	const tempDir = join(tmpdir(), `sidvid-assembly-${Date.now()}`);
	const inputPaths: string[] = [];
	const concatFilePath = join(tempDir, 'concat.txt');
	const outputPath = join(tempDir, 'output.mp4');

	try {
		// Create temp directory
		await mkdir(tempDir, { recursive: true });

		console.log(`[Video Assembly] Assembling ${clips.length} clips`);
		console.log(`[Video Assembly] Temp directory: ${tempDir}`);

		// Download all clips
		for (let i = 0; i < clips.length; i++) {
			const inputPath = join(tempDir, `input_${i}.mp4`);
			console.log(`[Video Assembly] Downloading clip ${i + 1}/${clips.length}: ${clips[i].url}`);
			await downloadVideo(clips[i].url, inputPath);
			inputPaths.push(inputPath);
		}

		// Create concat file
		await createConcatFile(inputPaths, concatFilePath);

		// Run FFmpeg
		await runFFmpeg(concatFilePath, outputPath, ffmpegPath);

		// Read output file
		const videoBuffer = await readFile(outputPath);

		console.log(`[Video Assembly] Successfully assembled ${clips.length} clips (${videoBuffer.length} bytes)`);

		return {
			success: true,
			videoPath: outputPath,
			videoBuffer
		};
	} catch (err) {
		console.error('[Video Assembly] Assembly failed:', err);
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err)
		};
	} finally {
		// Clean up temp files
		await cleanup([...inputPaths, concatFilePath, outputPath]);
		// Try to remove temp directory
		try {
			const { rmdir } = await import('fs/promises');
			await rmdir(tempDir);
		} catch {
			// Ignore if directory not empty or already removed
		}
	}
}
