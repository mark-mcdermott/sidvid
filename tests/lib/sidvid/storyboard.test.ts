/**
 * Stage 4: Storyboard - Unit Tests
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 *
 * Tests cover:
 * - Scene structure and creation
 * - Scene CRUD operations
 * - Scene cloning behavior
 * - Scene archiving
 * - Scene reordering
 * - Scene image management
 * - Smart expand for scenes
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types based on SCHEMAS-SPEC.md
type SceneStatus = 'empty' | 'pending' | 'generating' | 'completed' | 'failed';

interface SceneImage {
	id: string;
	imageUrl: string;
	revisedPrompt: string;
	isActive: boolean;
	createdAt: Date;
}

interface Scene {
	id: string;
	title: string;
	description: string;
	customDescription?: string;
	enhancedDescription?: string;
	isSmartExpanded?: boolean;
	preExpansionDescription?: string;
	isArchived?: boolean;
	dialog?: string;
	action?: string;
	assignedElements: string[];
	images: SceneImage[];
	duration: number;
	status: SceneStatus;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

// Mock SceneManager
class SceneManager {
	private scenes: Scene[] = [];
	private nextId = 1;

	async createScene(title?: string): Promise<Scene> {
		const now = new Date();
		const scene: Scene = {
			id: `scene-${this.nextId++}`,
			title: title || `Scene ${this.scenes.filter((s) => !s.isArchived).length + 1}`,
			description: '',
			assignedElements: [],
			images: [],
			duration: 5, // Fixed 5s per spec
			status: 'empty',
			createdAt: now,
			updatedAt: now
		};

		this.scenes.push(scene);
		return scene;
	}

	async getScene(id: string): Promise<Scene | null> {
		return this.scenes.find((s) => s.id === id) || null;
	}

	async listScenes(includeArchived = false): Promise<Scene[]> {
		if (includeArchived) {
			return [...this.scenes];
		}
		return this.scenes.filter((s) => !s.isArchived);
	}

	async updateScene(scene: Scene): Promise<void> {
		const index = this.scenes.findIndex((s) => s.id === scene.id);
		if (index === -1) {
			throw new Error(`Scene ${scene.id} not found`);
		}
		scene.updatedAt = new Date();
		this.scenes[index] = scene;
	}

	async deleteScene(id: string): Promise<void> {
		const index = this.scenes.findIndex((s) => s.id === id);
		if (index === -1) {
			throw new Error(`Scene ${id} not found`);
		}
		this.scenes.splice(index, 1);
	}

	async cloneScene(id: string): Promise<Scene> {
		const original = await this.getScene(id);
		if (!original) {
			throw new Error(`Scene ${id} not found`);
		}

		// Generate unique title
		const baseTitle = original.title.replace(/\s*\(\d+\)$/, ''); // Remove existing (N) suffix
		const existingTitles = this.scenes.map((s) => s.title);
		let suffix = 1;
		let newTitle = `${baseTitle} (${suffix})`;
		while (existingTitles.includes(newTitle)) {
			suffix++;
			newTitle = `${baseTitle} (${suffix})`;
		}

		const now = new Date();
		const clone: Scene = {
			...original,
			id: `scene-${this.nextId++}`,
			title: newTitle,
			isArchived: false, // Always active per spec
			createdAt: now,
			updatedAt: now
		};

		// Insert after original
		const originalIndex = this.scenes.findIndex((s) => s.id === id);
		this.scenes.splice(originalIndex + 1, 0, clone);

		return clone;
	}

	async archiveScene(id: string): Promise<Scene> {
		const scene = await this.getScene(id);
		if (!scene) {
			throw new Error(`Scene ${id} not found`);
		}

		scene.isArchived = true;
		await this.updateScene(scene);
		return scene;
	}

	async unarchiveScene(id: string, insertAtIndex?: number): Promise<Scene> {
		const scene = await this.getScene(id);
		if (!scene) {
			throw new Error(`Scene ${id} not found`);
		}

		scene.isArchived = false;

		// If insertAtIndex specified, move to that position
		if (insertAtIndex !== undefined) {
			const currentIndex = this.scenes.findIndex((s) => s.id === id);
			this.scenes.splice(currentIndex, 1);
			this.scenes.splice(insertAtIndex, 0, scene);
		}

		await this.updateScene(scene);
		return scene;
	}

	async moveScene(id: string, toIndex: number): Promise<void> {
		const currentIndex = this.scenes.findIndex((s) => s.id === id);
		if (currentIndex === -1) {
			throw new Error(`Scene ${id} not found`);
		}

		const [scene] = this.scenes.splice(currentIndex, 1);
		this.scenes.splice(toIndex, 0, scene);
	}

	getSceneNumber(scene: Scene): number {
		const activeScenes = this.scenes.filter((s) => !s.isArchived);
		const index = activeScenes.findIndex((s) => s.id === scene.id);
		return index === -1 ? -1 : index + 1; // 1-indexed
	}

	async addImage(sceneId: string, image: Omit<SceneImage, 'isActive'>): Promise<Scene> {
		const scene = await this.getScene(sceneId);
		if (!scene) {
			throw new Error(`Scene ${sceneId} not found`);
		}

		// Set all existing images to inactive
		scene.images.forEach((img) => (img.isActive = false));

		// Add new image as active
		scene.images.push({
			...image,
			isActive: true
		});

		scene.status = 'completed';
		await this.updateScene(scene);
		return scene;
	}

	async smartExpand(sceneId: string): Promise<Scene> {
		const scene = await this.getScene(sceneId);
		if (!scene) {
			throw new Error(`Scene ${sceneId} not found`);
		}

		// First expansion: save original
		if (!scene.isSmartExpanded) {
			scene.preExpansionDescription = scene.customDescription || scene.description;
		}

		// Generate enhanced description (mock)
		scene.enhancedDescription = `Expanded: ${scene.preExpansionDescription} with vivid cinematic details...`;
		scene.isSmartExpanded = true;

		await this.updateScene(scene);
		return scene;
	}
}

describe('Stage 4: Storyboard - Unit Tests', () => {
	let manager: SceneManager;

	beforeEach(() => {
		manager = new SceneManager();
	});

	// ===========================================================================
	// SCENE CREATION
	// ===========================================================================

	describe('createScene', () => {
		it('creates scene with required fields', async () => {
			const scene = await manager.createScene();

			expect(scene).toHaveProperty('id');
			expect(scene).toHaveProperty('title');
			expect(scene).toHaveProperty('description');
			expect(scene).toHaveProperty('assignedElements');
			expect(scene).toHaveProperty('images');
			expect(scene).toHaveProperty('duration');
			expect(scene).toHaveProperty('status');
		});

		it('scene duration is 5 seconds per spec', async () => {
			const scene = await manager.createScene();

			expect(scene.duration).toBe(5);
		});

		it('scene starts in empty status', async () => {
			const scene = await manager.createScene();

			expect(scene.status).toBe('empty');
		});

		it('generates unique ID', async () => {
			const scene1 = await manager.createScene();
			const scene2 = await manager.createScene();

			expect(scene1.id).not.toBe(scene2.id);
		});

		it('initializes with empty assignedElements', async () => {
			const scene = await manager.createScene();

			expect(scene.assignedElements).toEqual([]);
		});

		it('initializes with empty images array', async () => {
			const scene = await manager.createScene();

			expect(scene.images).toEqual([]);
		});

		it('auto-generates title based on scene count', async () => {
			const scene1 = await manager.createScene();
			const scene2 = await manager.createScene();
			const scene3 = await manager.createScene();

			expect(scene1.title).toBe('Scene 1');
			expect(scene2.title).toBe('Scene 2');
			expect(scene3.title).toBe('Scene 3');
		});

		it('allows custom title', async () => {
			const scene = await manager.createScene('Custom Title');

			expect(scene.title).toBe('Custom Title');
		});
	});

	// ===========================================================================
	// SCENE CRUD
	// ===========================================================================

	describe('getScene', () => {
		it('returns scene by ID', async () => {
			const created = await manager.createScene('Test');
			const fetched = await manager.getScene(created.id);

			expect(fetched?.title).toBe('Test');
		});

		it('returns null for non-existent ID', async () => {
			const fetched = await manager.getScene('non-existent');

			expect(fetched).toBeNull();
		});
	});

	describe('listScenes', () => {
		it('returns only non-archived scenes by default', async () => {
			const scene1 = await manager.createScene('Active');
			const scene2 = await manager.createScene('Archived');
			await manager.archiveScene(scene2.id);

			const scenes = await manager.listScenes();

			expect(scenes).toHaveLength(1);
			expect(scenes[0].id).toBe(scene1.id);
		});

		it('returns all scenes including archived when requested', async () => {
			await manager.createScene('Active');
			const archived = await manager.createScene('Archived');
			await manager.archiveScene(archived.id);

			const scenes = await manager.listScenes(true);

			expect(scenes).toHaveLength(2);
		});
	});

	describe('updateScene', () => {
		it('updates scene data', async () => {
			const scene = await manager.createScene();
			scene.description = 'Updated description';

			await manager.updateScene(scene);
			const fetched = await manager.getScene(scene.id);

			expect(fetched?.description).toBe('Updated description');
		});

		it('updates updatedAt timestamp', async () => {
			const scene = await manager.createScene();
			const originalUpdatedAt = scene.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			scene.description = 'Changed';
			await manager.updateScene(scene);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
		});

		it('throws for non-existent scene', async () => {
			const fakeScene: Scene = {
				id: 'fake',
				title: '',
				description: '',
				assignedElements: [],
				images: [],
				duration: 5,
				status: 'empty',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await expect(manager.updateScene(fakeScene)).rejects.toThrow('not found');
		});
	});

	describe('deleteScene', () => {
		it('removes scene', async () => {
			const scene = await manager.createScene();
			await manager.deleteScene(scene.id);

			const fetched = await manager.getScene(scene.id);
			expect(fetched).toBeNull();
		});

		it('throws for non-existent scene', async () => {
			await expect(manager.deleteScene('non-existent')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// CLONE SCENE
	// ===========================================================================

	describe('cloneScene', () => {
		it('creates copy of scene', async () => {
			const original = await manager.createScene('Original');
			original.description = 'Test description';
			await manager.updateScene(original);

			const clone = await manager.cloneScene(original.id);

			expect(clone.description).toBe('Test description');
		});

		it('clone gets new ID', async () => {
			const original = await manager.createScene();
			const clone = await manager.cloneScene(original.id);

			expect(clone.id).not.toBe(original.id);
		});

		it('clone title has (1) suffix', async () => {
			const original = await manager.createScene('My Scene');
			const clone = await manager.cloneScene(original.id);

			expect(clone.title).toBe('My Scene (1)');
		});

		it('sequential clones get incrementing suffixes', async () => {
			const original = await manager.createScene('My Scene');
			const clone1 = await manager.cloneScene(original.id);
			const clone2 = await manager.cloneScene(original.id);

			expect(clone1.title).toBe('My Scene (1)');
			expect(clone2.title).toBe('My Scene (2)');
		});

		it('clone is always active (not archived)', async () => {
			const original = await manager.createScene('To Archive');
			await manager.archiveScene(original.id);

			const clone = await manager.cloneScene(original.id);

			expect(clone.isArchived).toBe(false);
		});

		it('clone inserted after original', async () => {
			await manager.createScene('First');
			const original = await manager.createScene('Original');
			await manager.createScene('Third');

			const clone = await manager.cloneScene(original.id);

			const scenes = await manager.listScenes(true);
			const originalIndex = scenes.findIndex((s) => s.id === original.id);
			const cloneIndex = scenes.findIndex((s) => s.id === clone.id);

			expect(cloneIndex).toBe(originalIndex + 1);
		});

		it('copies assignedElements', async () => {
			const original = await manager.createScene();
			original.assignedElements = ['elem-1', 'elem-2'];
			await manager.updateScene(original);

			const clone = await manager.cloneScene(original.id);

			expect(clone.assignedElements).toEqual(['elem-1', 'elem-2']);
		});

		it('copies images', async () => {
			const original = await manager.createScene();
			await manager.addImage(original.id, {
				id: 'img-1',
				imageUrl: 'url',
				revisedPrompt: '',
				createdAt: new Date()
			});

			const clone = await manager.cloneScene(original.id);

			expect(clone.images).toHaveLength(1);
		});

		it('throws for non-existent scene', async () => {
			await expect(manager.cloneScene('non-existent')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// ARCHIVE SCENE
	// ===========================================================================

	describe('archiveScene', () => {
		it('sets isArchived to true', async () => {
			const scene = await manager.createScene();
			await manager.archiveScene(scene.id);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.isArchived).toBe(true);
		});

		it('archived scene excluded from default list', async () => {
			const scene = await manager.createScene();
			await manager.archiveScene(scene.id);

			const scenes = await manager.listScenes();
			expect(scenes.find((s) => s.id === scene.id)).toBeUndefined();
		});

		it('throws for non-existent scene', async () => {
			await expect(manager.archiveScene('non-existent')).rejects.toThrow('not found');
		});
	});

	describe('unarchiveScene', () => {
		it('sets isArchived to false', async () => {
			const scene = await manager.createScene();
			await manager.archiveScene(scene.id);
			await manager.unarchiveScene(scene.id);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.isArchived).toBe(false);
		});

		it('can specify insert position', async () => {
			await manager.createScene('First');
			const archived = await manager.createScene('Archived');
			await manager.createScene('Third');
			await manager.archiveScene(archived.id);

			await manager.unarchiveScene(archived.id, 0);

			const scenes = await manager.listScenes();
			expect(scenes[0].id).toBe(archived.id);
		});
	});

	// ===========================================================================
	// SCENE REORDERING
	// ===========================================================================

	describe('moveScene', () => {
		it('moves scene to specified index', async () => {
			const scene1 = await manager.createScene('First');
			const scene2 = await manager.createScene('Second');
			const scene3 = await manager.createScene('Third');

			await manager.moveScene(scene3.id, 0);

			const scenes = await manager.listScenes();
			expect(scenes[0].id).toBe(scene3.id);
			expect(scenes[1].id).toBe(scene1.id);
			expect(scenes[2].id).toBe(scene2.id);
		});

		it('throws for non-existent scene', async () => {
			await expect(manager.moveScene('non-existent', 0)).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// SCENE NUMBERING
	// ===========================================================================

	describe('getSceneNumber', () => {
		it('returns 1-indexed number', async () => {
			const scene = await manager.createScene();

			expect(manager.getSceneNumber(scene)).toBe(1);
		});

		it('only counts active scenes', async () => {
			const active1 = await manager.createScene('Active 1');
			const archived = await manager.createScene('Archived');
			const active2 = await manager.createScene('Active 2');

			await manager.archiveScene(archived.id);

			expect(manager.getSceneNumber(active1)).toBe(1);
			expect(manager.getSceneNumber(active2)).toBe(2);
		});

		it('returns -1 for archived scene', async () => {
			const scene = await manager.createScene();
			await manager.archiveScene(scene.id);

			const fetched = await manager.getScene(scene.id);
			expect(manager.getSceneNumber(fetched!)).toBe(-1);
		});
	});

	// ===========================================================================
	// SCENE IMAGE MANAGEMENT
	// ===========================================================================

	describe('addImage', () => {
		it('adds image to scene', async () => {
			const scene = await manager.createScene();

			const updated = await manager.addImage(scene.id, {
				id: 'img-1',
				imageUrl: 'url',
				revisedPrompt: '',
				createdAt: new Date()
			});

			expect(updated.images).toHaveLength(1);
		});

		it('new image is active by default', async () => {
			const scene = await manager.createScene();

			const updated = await manager.addImage(scene.id, {
				id: 'img-1',
				imageUrl: 'url',
				revisedPrompt: '',
				createdAt: new Date()
			});

			expect(updated.images[0].isActive).toBe(true);
		});

		it('updates scene status to completed', async () => {
			const scene = await manager.createScene();
			expect(scene.status).toBe('empty');

			const updated = await manager.addImage(scene.id, {
				id: 'img-1',
				imageUrl: 'url',
				revisedPrompt: '',
				createdAt: new Date()
			});

			expect(updated.status).toBe('completed');
		});

		it('adding new image makes previous inactive', async () => {
			const scene = await manager.createScene();

			await manager.addImage(scene.id, {
				id: 'img-1',
				imageUrl: 'url1',
				revisedPrompt: '',
				createdAt: new Date()
			});

			const updated = await manager.addImage(scene.id, {
				id: 'img-2',
				imageUrl: 'url2',
				revisedPrompt: '',
				createdAt: new Date()
			});

			expect(updated.images.find((i) => i.id === 'img-1')?.isActive).toBe(false);
			expect(updated.images.find((i) => i.id === 'img-2')?.isActive).toBe(true);
		});
	});

	// ===========================================================================
	// SMART EXPAND
	// ===========================================================================

	describe('smartExpand', () => {
		it('first expand sets isSmartExpanded to true', async () => {
			const scene = await manager.createScene();
			scene.description = 'Original';
			await manager.updateScene(scene);

			const expanded = await manager.smartExpand(scene.id);

			expect(expanded.isSmartExpanded).toBe(true);
		});

		it('first expand saves preExpansionDescription', async () => {
			const scene = await manager.createScene();
			scene.description = 'Original description';
			await manager.updateScene(scene);

			const expanded = await manager.smartExpand(scene.id);

			expect(expanded.preExpansionDescription).toBe('Original description');
		});

		it('uses customDescription over description if set', async () => {
			const scene = await manager.createScene();
			scene.description = 'Default';
			scene.customDescription = 'Custom';
			await manager.updateScene(scene);

			const expanded = await manager.smartExpand(scene.id);

			expect(expanded.preExpansionDescription).toBe('Custom');
		});

		it('sets enhancedDescription', async () => {
			const scene = await manager.createScene();

			const expanded = await manager.smartExpand(scene.id);

			expect(expanded.enhancedDescription).toBeDefined();
		});

		it('subsequent expand uses preExpansionDescription', async () => {
			const scene = await manager.createScene();
			scene.description = 'Original';
			await manager.updateScene(scene);

			await manager.smartExpand(scene.id);
			const reExpanded = await manager.smartExpand(scene.id);

			expect(reExpanded.preExpansionDescription).toBe('Original');
		});
	});

	// ===========================================================================
	// ASSIGNED ELEMENTS
	// ===========================================================================

	describe('Assigned Elements', () => {
		it('can add element to scene', async () => {
			const scene = await manager.createScene();
			scene.assignedElements.push('elem-1');
			await manager.updateScene(scene);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.assignedElements).toContain('elem-1');
		});

		it('can remove element from scene', async () => {
			const scene = await manager.createScene();
			scene.assignedElements = ['elem-1', 'elem-2'];
			await manager.updateScene(scene);

			scene.assignedElements = scene.assignedElements.filter((id) => id !== 'elem-1');
			await manager.updateScene(scene);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.assignedElements).toEqual(['elem-2']);
		});

		it('can have multiple elements', async () => {
			const scene = await manager.createScene();
			scene.assignedElements = ['char-1', 'loc-1', 'obj-1'];
			await manager.updateScene(scene);

			const fetched = await manager.getScene(scene.id);
			expect(fetched?.assignedElements).toHaveLength(3);
		});
	});
});
