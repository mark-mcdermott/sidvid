import { test, expect } from '@playwright/test';

test.describe('Video Generation @video', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/video');
		await page.evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await page.reload();
	});

	test.describe('Video Sidebar Thumbnails', () => {
		test('video thumbnails section exists in sidebar', async ({ page }) => {
			const videoSidebar = page.locator('[data-sidebar-section="video"]');
			await expect(videoSidebar).toBeVisible();

			// Verify "Video" or "Videos" label exists
			await expect(videoSidebar.getByText(/Video/i)).toBeVisible();
		});

		test('no thumbnails shown initially', async ({ page }) => {
			const videoSidebar = page.locator('[data-sidebar-section="video"]');
			const thumbnails = videoSidebar.locator('[data-video-thumbnail]');
			expect(await thumbnails.count()).toBe(0);
		});

		test.skip('generated video appears as thumbnail in sidebar', async ({ page }) => {
			// Setup: Navigate from storyboard with scene images
			// Generate video
			// This is skipped due to Sora API timeout

			// After video generation, verify thumbnail appears
			const videoSidebar = page.locator('[data-sidebar-section="video"]');
			const thumbnails = videoSidebar.locator('[data-video-thumbnail]');
			expect(await thumbnails.count()).toBe(1);

			// Verify thumbnail shows poster image
			const thumbnail = thumbnails.first();
			const img = thumbnail.locator('img');
			await expect(img).toBeVisible();
		});

		test.skip('multiple videos show multiple thumbnails', async ({ page }) => {
			// Generate 2 videos
			// Verify 2 thumbnails appear in sidebar
			const videoSidebar = page.locator('[data-sidebar-section="video"]');
			const thumbnails = videoSidebar.locator('[data-video-thumbnail]');
			expect(await thumbnails.count()).toBe(2);
		});

		test.skip('clicking video thumbnail loads that video in main area', async ({ page }) => {
			// Generate a video
			// Click the thumbnail
			const videoSidebar = page.locator('[data-sidebar-section="video"]');
			const thumbnail = videoSidebar.locator('[data-video-thumbnail]').first();
			await thumbnail.click();

			// Verify video displays in main area
			const mainVideo = page.locator('video').first();
			await expect(mainVideo).toBeVisible();
		});
	});

	test.describe('Video Generation from Storyboard', () => {
		test('shows placeholder with loading text when navigating from storyboard', async ({ page }) => {
			// Simulate navigation from storyboard with Send to Video Generation
			// Set flag or state that indicates video generation in progress
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Verify video-sized rectangle appears
			const videoPlaceholder = page.locator('[data-video-placeholder]');
			await expect(videoPlaceholder).toBeVisible();

			// Verify spinner is visible inside placeholder
			const spinner = videoPlaceholder.locator('[data-spinner]');
			await expect(spinner).toBeVisible();
		});

		test('placeholder has video aspect ratio', async ({ page }) => {
			// Set generating state
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			const videoPlaceholder = page.locator('[data-video-placeholder]');
			await expect(videoPlaceholder).toBeVisible();

			// Check aspect ratio is typical video size (16:9)
			const dimensions = await videoPlaceholder.evaluate((el) => {
				const rect = el.getBoundingClientRect();
				const styles = window.getComputedStyle(el);
				return {
					width: rect.width,
					height: rect.height,
					aspectRatio: styles.aspectRatio || 'not set'
				};
			});

			if (dimensions.aspectRatio !== 'auto' && dimensions.aspectRatio !== 'not set') {
				const ratio = parseFloat(dimensions.aspectRatio);
				expect(ratio).toBeCloseTo(16/9, 0.1);
			} else if (dimensions.width && dimensions.height) {
				const ratio = dimensions.width / dimensions.height;
				expect(ratio).toBeCloseTo(16/9, 0.1);
			}
		});

		test.skip('spinner disappears when video returns from Sora', async ({ page }) => {
			// Setup: Start video generation
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Verify spinner exists
			const spinner = page.locator('[data-spinner]');
			await expect(spinner).toBeVisible();

			// Wait for video to generate (Sora API call - very slow)
			await expect(spinner).not.toBeVisible({ timeout: 300000 }); // 5 minutes

			// Verify video element appears
			const video = page.locator('video');
			await expect(video).toBeVisible();
		});

		test.skip('video poster image replaces placeholder', async ({ page }) => {
			// Setup: Start video generation
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Wait for video to generate
			const videoPlaceholder = page.locator('[data-video-placeholder]');
			await expect(videoPlaceholder).toBeVisible();

			// After generation, placeholder should be replaced by video
			await expect(videoPlaceholder).not.toBeVisible({ timeout: 300000 });

			// Verify video with poster attribute
			const video = page.locator('video');
			await expect(video).toBeVisible();
			await expect(video).toHaveAttribute('poster');
		});

		test.skip('video metadata from StoryGen and CharGen is preserved', async ({ page }) => {
			// This test verifies that story and character data sent to Sora
			// is available for reference or display

			// After video generation, check for metadata indicators
			const metadataSection = page.locator('[data-video-metadata]');
			await expect(metadataSection).toBeVisible();

			// Could check for story title, character names, etc.
			await expect(page.getByText(/Story:/i)).toBeVisible();
			await expect(page.getByText(/Characters:/i)).toBeVisible();
		});
	});

	test.describe('Video Improvement Feature', () => {
		test.skip('Improve Vid With Prompt button appears after video generated', async ({ page }) => {
			// Setup: Generate video first
			// This is skipped due to Sora API timeout

			// After video generation, verify button appears
			const improveButton = page.getByRole('button', { name: /Improve Vid With Prompt/i });
			await expect(improveButton).toBeVisible();
		});

		test.skip('Improve Vid With Prompt button not visible before video generated', async ({ page }) => {
			// While video is generating
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			const improveButton = page.getByRole('button', { name: /Improve Vid With Prompt/i });
			await expect(improveButton).not.toBeVisible();
		});

		test.skip('clicking Improve Vid With Prompt shows textarea', async ({ page }) => {
			// Setup: Generate video first
			// Click improve button
			const improveButton = page.getByRole('button', { name: /Improve Vid With Prompt/i });
			await improveButton.click();

			// Verify textarea appears above button
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await expect(textarea).toBeVisible();

			// Check textarea is above button in DOM
			const textareaIndex = await textarea.evaluate((el) => {
				return Array.from(el.parentElement!.children).indexOf(el);
			});
			const buttonIndex = await improveButton.evaluate((el) => {
				return Array.from(el.parentElement!.children).indexOf(el);
			});
			expect(textareaIndex).toBeLessThan(buttonIndex);
		});

		test.skip('textarea has placeholder for video improvements', async ({ page }) => {
			// Click improve button
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();

			// Verify textarea has appropriate placeholder
			const textarea = page.locator('textarea');
			const placeholder = await textarea.getAttribute('placeholder');
			expect(placeholder).toMatch(/video|change|improve|describe/i);
		});

		test.skip('submitting improvement prompt sends request to Sora', async ({ page }) => {
			// Click improve button
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();

			// Enter improvement text
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await textarea.fill('Make the video more cinematic with dramatic lighting');

			// Listen for API request
			const requestPromise = page.waitForRequest(request =>
				request.url().includes('/api/') &&
				request.method() === 'POST' &&
				request.postDataJSON()?.improvePrompt?.includes('cinematic')
			);

			// Submit (look for Regenerate or Submit button)
			const submitButton = page.getByRole('button', { name: /Regenerate|Submit|Improve/i });
			await submitButton.click();

			// Verify request was made
			const request = await requestPromise;
			expect(request).toBeTruthy();
		});

		test.skip('improvement request includes original metadata', async ({ page }) => {
			// Click improve button and submit improvement
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await textarea.fill('Add more action');

			// Listen for API request with original metadata
			const requestPromise = page.waitForRequest(request => {
				if (!request.url().includes('/api/') || request.method() !== 'POST') {
					return false;
				}
				const postData = request.postDataJSON();
				// Verify original story/character data is included
				return postData?.originalMetadata || postData?.storyData || postData?.characterData;
			});

			const submitButton = page.getByRole('button', { name: /Regenerate|Submit|Improve/i });
			await submitButton.click();

			const request = await requestPromise;
			expect(request).toBeTruthy();
		});

		test.skip('shows loading state during improvement generation', async ({ page }) => {
			// Submit improvement
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await textarea.fill('Make it better');
			const submitButton = page.getByRole('button', { name: /Regenerate|Submit|Improve/i });
			await submitButton.click();

			// Verify loading state
			await expect(page.getByText(/Regenerating|Improving|Generating/i)).toBeVisible();

			// Verify button is disabled during generation
			await expect(submitButton).toBeDisabled();

			// Verify spinner appears
			const spinner = page.locator('[data-spinner]');
			await expect(spinner).toBeVisible();
		});

		test.skip('improved video replaces original video', async ({ page }) => {
			// Get original video source
			const originalVideo = page.locator('video');
			const originalSrc = await originalVideo.getAttribute('src');

			// Submit improvement
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await textarea.fill('Improve lighting');
			await page.getByRole('button', { name: /Regenerate|Submit|Improve/i }).click();

			// Wait for new video
			await expect(page.getByText(/Regenerating/i)).not.toBeVisible({ timeout: 300000 });

			// Verify video source changed
			const newVideo = page.locator('video');
			const newSrc = await newVideo.getAttribute('src');
			expect(newSrc).not.toBe(originalSrc);
		});

		test.skip('Cancel button hides textarea', async ({ page }) => {
			// Click improve button
			await page.getByRole('button', { name: /Improve Vid With Prompt/i }).click();
			const textarea = page.getByPlaceholder(/describe.*change.*video/i);
			await expect(textarea).toBeVisible();

			// Click Cancel
			await page.getByRole('button', { name: /Cancel/i }).click();

			// Verify textarea is hidden
			await expect(textarea).not.toBeVisible();

			// Verify Improve button is back
			await expect(page.getByRole('button', { name: /Improve Vid With Prompt/i })).toBeVisible();
		});
	});

	test.describe('Video Playback', () => {
		test.skip('video has play controls', async ({ page }) => {
			// After video generation, verify controls exist
			const video = page.locator('video');
			await expect(video).toHaveAttribute('controls');
		});

		test.skip('clicking play button starts video playback', async ({ page }) => {
			const video = page.locator('video');

			// Click play (either video controls or custom play button)
			await video.click();

			// Verify video is playing
			const isPlaying = await video.evaluate((v: HTMLVideoElement) => !v.paused);
			expect(isPlaying).toBeTruthy();
		});

		test.skip('video can be paused', async ({ page }) => {
			const video = page.locator('video');

			// Start playing
			await video.click();
			await page.waitForTimeout(1000);

			// Pause
			await video.click();

			// Verify video is paused
			const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
			expect(isPaused).toBeTruthy();
		});

		test.skip('video can be downloaded', async ({ page }) => {
			// Look for download button or link
			const downloadButton = page.getByRole('button', { name: /Download/i });
			await expect(downloadButton).toBeVisible();

			// Verify it has download attribute or triggers download
			const downloadLink = page.locator('a[download]');
			if (await downloadLink.count() > 0) {
				await expect(downloadLink).toHaveAttribute('download');
			}
		});
	});

	test.describe('Video Generation Status', () => {
		test.skip('shows estimated time remaining during generation', async ({ page }) => {
			// During video generation
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Look for time remaining indicator
			const timeRemaining = page.getByText(/Estimated time|Time remaining|minutes?/i);
			await expect(timeRemaining).toBeVisible();
		});

		test.skip('shows progress bar during generation', async ({ page }) => {
			// During video generation
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Look for progress bar
			const progressBar = page.locator('[role="progressbar"]');
			await expect(progressBar).toBeVisible();
		});

		test.skip('shows success message when video completes', async ({ page }) => {
			// Setup: Start generation and wait for completion
			await page.evaluate(() => {
				sessionStorage.setItem('videoGenerating', 'true');
			});
			await page.reload();

			// Wait for completion
			await expect(page.locator('video')).toBeVisible({ timeout: 300000 });

			// Verify success message or indicator
			const successMessage = page.getByText(/Video generated successfully|Complete/i);
			await expect(successMessage).toBeVisible();
		});

		test.skip('shows error message if generation fails', async ({ page }) => {
			// Simulate error condition
			// This would require mocking the API to return an error

			// Verify error message appears
			const errorMessage = page.getByText(/Failed|Error|Could not generate/i);
			await expect(errorMessage).toBeVisible();

			// Verify retry button appears
			const retryButton = page.getByRole('button', { name: /Try Again|Retry/i });
			await expect(retryButton).toBeVisible();
		});
	});

	test.describe('Multiple Videos', () => {
		test.skip('each video has independent Improve button', async ({ page }) => {
			// Generate 2 videos
			// Both should have their own Improve button

			const firstVideo = page.locator('[data-video-item="0"]');
			const secondVideo = page.locator('[data-video-item="1"]');

			await expect(firstVideo.getByRole('button', { name: /Improve Vid With Prompt/i })).toBeVisible();
			await expect(secondVideo.getByRole('button', { name: /Improve Vid With Prompt/i })).toBeVisible();
		});

		test.skip('improving one video does not affect others', async ({ page }) => {
			// Generate 2 videos
			// Improve first video
			const firstVideo = page.locator('[data-video-item="0"]');
			await firstVideo.getByRole('button', { name: /Improve Vid With Prompt/i }).click();
			await firstVideo.getByPlaceholder(/describe.*change/i).fill('Add more action');
			await firstVideo.getByRole('button', { name: /Regenerate/i }).click();

			// Verify second video unchanged
			const secondVideo = page.locator('[data-video-item="1"]');
			const secondVideoSrc = await secondVideo.locator('video').getAttribute('src');

			// Wait for first video improvement to complete
			await expect(firstVideo.getByText(/Regenerating/i)).not.toBeVisible({ timeout: 300000 });

			// Verify second video source unchanged
			const secondVideoSrcAfter = await secondVideo.locator('video').getAttribute('src');
			expect(secondVideoSrcAfter).toBe(secondVideoSrc);
		});
	});
});
