import { SessionManager, MemoryStorageAdapter } from '$lib/sidvid';
import { OPENAI_API_KEY } from '$env/static/private';
import type { Actions } from './$types';
import { calculateSceneCount } from '$lib/sidvid/utils/story-helpers';

// Create a server-side storage adapter and session manager
// Note: MemoryStorageAdapter is per-request in serverless environment
// For true persistence, a server-side storage (DB) would be needed
function createServerSessionManager() {
  const storage = new MemoryStorageAdapter();
  const config = { openaiApiKey: OPENAI_API_KEY };
  const manager = new SessionManager(config, storage);
  return manager;
}

export const actions = {
  generateStory: async ({ request }) => {
    const data = await request.formData();
    const userPrompt = data.get('prompt');
    const length = data.get('length');
    const sessionId = data.get('sessionId');

    if (!userPrompt || typeof userPrompt !== 'string') {
      return { success: false, error: 'Prompt is required' };
    }

    try {
      const manager = createServerSessionManager();
      const videoLength = typeof length === 'string' ? length : '5s';
      const sceneCount = calculateSceneCount(videoLength);

      // Create or load session
      const sessionName = typeof sessionId === 'string' && sessionId
        ? undefined // Will load existing
        : 'Story Session';

      let session;
      if (typeof sessionId === 'string' && sessionId) {
        try {
          session = await manager.loadSession(sessionId);
        } catch {
          // Session not found, create new one
          session = manager.createSession(sessionName);
        }
      } else {
        session = manager.createSession(sessionName);
      }

      // Generate story using session
      const story = await session.generateStory(userPrompt, { scenes: sceneCount });

      // Save session state
      await session.save();

      return {
        success: true,
        story,
        sessionId: session.getId(),
        sessionMetadata: session.getMetadata()
      };
    } catch (error) {
      console.error('Error generating story:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate story'
      };
    }
  },

  editStory: async ({ request }) => {
    const data = await request.formData();
    const editPrompt = data.get('editPrompt');
    const currentStoryJSON = data.get('currentStory');
    const length = data.get('length');
    const sessionId = data.get('sessionId');

    if (!editPrompt || typeof editPrompt !== 'string') {
      return { success: false, error: 'Edit prompt is required' };
    }

    if (!currentStoryJSON || typeof currentStoryJSON !== 'string') {
      return { success: false, error: 'Current story is required' };
    }

    try {
      const manager = createServerSessionManager();

      // Create a session for this edit operation
      const session = manager.createSession('Edit Session');

      // For edit operations, we use the session's improveStory method
      // which uses the current story context
      // First, we need to reconstruct session state from the passed story data
      // Since Session.improveStory requires an existing story, we use a workaround:
      // Parse and use the underlying editStory function directly via the session

      // Actually, Session.improveStory needs a story already generated
      // For now, we'll use the original SidVid approach for edits
      // TODO: Enhance Session class to support loading existing story state

      const { SidVid } = await import('$lib/sidvid');
      const sidvid = new SidVid({ openaiApiKey: OPENAI_API_KEY });
      const currentStory = JSON.parse(currentStoryJSON);

      const story = await sidvid.editStory({
        currentStory,
        editPrompt,
        length: typeof length === 'string' ? length : '5s'
      });

      return {
        success: true,
        story,
        sessionId: typeof sessionId === 'string' ? sessionId : undefined
      };
    } catch (error) {
      console.error('Error editing story:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit story'
      };
    }
  }
} satisfies Actions;
