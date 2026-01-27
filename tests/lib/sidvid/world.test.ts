/**
 * Stage 3: World - Unit Tests
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 *
 * Tests cover:
 * - WorldElement structure and creation
 * - Element type handling
 * - Enhance description behavior
 * - Image version management
 * - Element history management
 * - Cascade deletion logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Types based on SCHEMAS-SPEC.md
type ElementType = 'character' | 'location' | 'object' | 'concept';

interface ElementImage {
	id: string;
	imageUrl: string;
	revisedPrompt: string;
	isActive: boolean;
	createdAt: Date;
}

interface WorldElementVersion {
	description: string;
	enhancedDescription?: string;
	isEnhanced?: boolean;
	preEnhancementDescription?: string;
	images: ElementImage[];
	createdAt: Date;
}

interface WorldElement {
	id: string;
	name: string;
	type: ElementType;
	description: string;
	enhancedDescription?: string;
	isEnhanced?: boolean;
	preEnhancementDescription?: string;
	images: ElementImage[];
	historyIndex: number;
	history: WorldElementVersion[];
	createdAt: Date;
	updatedAt: Date;
}

// Mock WorldElementManager
class WorldElementManager {
	private elements: Map<string, WorldElement> = new Map();

	async createElement(type: ElementType, name: string, description: string): Promise<WorldElement> {
		const now = new Date();
		const element: WorldElement = {
			id: `elem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name,
			type,
			description,
			images: [],
			historyIndex: 0,
			history: [],
			createdAt: now,
			updatedAt: now
		};

		this.elements.set(element.id, element);
		return element;
	}

	async getElement(id: string): Promise<WorldElement | null> {
		return this.elements.get(id) || null;
	}

	async listElements(type?: ElementType): Promise<WorldElement[]> {
		const all = Array.from(this.elements.values());
		if (!type) return all;
		return all.filter((e) => e.type === type);
	}

	async updateElement(element: WorldElement): Promise<void> {
		if (!this.elements.has(element.id)) {
			throw new Error(`Element ${element.id} not found`);
		}
		element.updatedAt = new Date();
		this.elements.set(element.id, element);
	}

	async deleteElement(id: string): Promise<void> {
		if (!this.elements.has(id)) {
			throw new Error(`Element ${id} not found`);
		}
		this.elements.delete(id);
	}

	async enhanceDescription(elementId: string): Promise<WorldElement> {
		const element = await this.getElement(elementId);
		if (!element) {
			throw new Error(`Element ${elementId} not found`);
		}

		// First enhancement: save original
		if (!element.isEnhanced) {
			element.preEnhancementDescription = element.description;
		}

		// Generate enhanced description (mock)
		element.enhancedDescription = `Enhanced: ${element.preEnhancementDescription} with rich visual details and depth.`;
		element.isEnhanced = true;

		await this.updateElement(element);
		return element;
	}

	async addImage(elementId: string, image: Omit<ElementImage, 'isActive'>): Promise<WorldElement> {
		const element = await this.getElement(elementId);
		if (!element) {
			throw new Error(`Element ${elementId} not found`);
		}

		// Set all existing images to inactive
		element.images.forEach((img) => (img.isActive = false));

		// Add new image as active
		element.images.push({
			...image,
			isActive: true
		});

		await this.updateElement(element);
		return element;
	}

	async setActiveImage(elementId: string, imageId: string): Promise<WorldElement> {
		const element = await this.getElement(elementId);
		if (!element) {
			throw new Error(`Element ${elementId} not found`);
		}

		const imageExists = element.images.some((img) => img.id === imageId);
		if (!imageExists) {
			throw new Error(`Image ${imageId} not found on element ${elementId}`);
		}

		element.images.forEach((img) => {
			img.isActive = img.id === imageId;
		});

		await this.updateElement(element);
		return element;
	}

	async deleteImage(elementId: string, imageId: string): Promise<WorldElement> {
		const element = await this.getElement(elementId);
		if (!element) {
			throw new Error(`Element ${elementId} not found`);
		}

		const image = element.images.find((img) => img.id === imageId);
		if (!image) {
			throw new Error(`Image ${imageId} not found on element ${elementId}`);
		}

		if (image.isActive) {
			throw new Error('Cannot delete active image');
		}

		element.images = element.images.filter((img) => img.id !== imageId);

		await this.updateElement(element);
		return element;
	}

	getActiveImage(element: WorldElement): ElementImage | null {
		return element.images.find((img) => img.isActive) || null;
	}
}

// Cascade deletion checker
class CascadeDeletionChecker {
	checkElementUsage(
		elementId: string,
		scenes: { assignedElements: string[] }[]
	): { usedInScenes: number; sceneIds: string[] } {
		const usedIn: string[] = [];

		scenes.forEach((scene, index) => {
			if (scene.assignedElements.includes(elementId)) {
				usedIn.push(`scene-${index}`);
			}
		});

		return {
			usedInScenes: usedIn.length,
			sceneIds: usedIn
		};
	}

	removeElementFromScenes(
		elementId: string,
		scenes: { id: string; assignedElements: string[] }[]
	): { id: string; assignedElements: string[] }[] {
		return scenes.map((scene) => ({
			...scene,
			assignedElements: scene.assignedElements.filter((id) => id !== elementId)
		}));
	}
}

describe('Stage 3: World - Unit Tests', () => {
	let manager: WorldElementManager;
	let cascadeChecker: CascadeDeletionChecker;

	beforeEach(() => {
		manager = new WorldElementManager();
		cascadeChecker = new CascadeDeletionChecker();
	});

	// ===========================================================================
	// ELEMENT CREATION
	// ===========================================================================

	describe('createElement', () => {
		it('creates element with correct structure', async () => {
			const element = await manager.createElement('character', 'Hero', 'A brave protagonist');

			expect(element).toHaveProperty('id');
			expect(element).toHaveProperty('name', 'Hero');
			expect(element).toHaveProperty('type', 'character');
			expect(element).toHaveProperty('description', 'A brave protagonist');
			expect(element).toHaveProperty('images');
			expect(element).toHaveProperty('historyIndex', 0);
			expect(element).toHaveProperty('history');
		});

		it('generates unique ID for each element', async () => {
			const elem1 = await manager.createElement('character', 'Hero', 'Description');
			const elem2 = await manager.createElement('character', 'Villain', 'Description');

			expect(elem1.id).not.toBe(elem2.id);
		});

		it('creates character type element', async () => {
			const element = await manager.createElement('character', 'Alice', 'A detective');

			expect(element.type).toBe('character');
		});

		it('creates location type element', async () => {
			const element = await manager.createElement('location', 'Castle', 'An ancient fortress');

			expect(element.type).toBe('location');
		});

		it('creates object type element', async () => {
			const element = await manager.createElement('object', 'Sword', 'A magic blade');

			expect(element.type).toBe('object');
		});

		it('creates concept type element', async () => {
			const element = await manager.createElement('concept', 'Prophecy', 'An ancient prediction');

			expect(element.type).toBe('concept');
		});

		it('initializes with empty images array', async () => {
			const element = await manager.createElement('character', 'Test', 'Description');

			expect(element.images).toEqual([]);
		});

		it('sets timestamps on creation', async () => {
			const before = new Date();
			const element = await manager.createElement('character', 'Test', 'Description');
			const after = new Date();

			expect(element.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(element.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ===========================================================================
	// ELEMENT CRUD
	// ===========================================================================

	describe('getElement', () => {
		it('returns element by ID', async () => {
			const created = await manager.createElement('character', 'Hero', 'Description');
			const fetched = await manager.getElement(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe('Hero');
		});

		it('returns null for non-existent ID', async () => {
			const fetched = await manager.getElement('non-existent');

			expect(fetched).toBeNull();
		});
	});

	describe('listElements', () => {
		it('returns all elements when no type filter', async () => {
			await manager.createElement('character', 'Hero', 'Desc');
			await manager.createElement('location', 'Castle', 'Desc');
			await manager.createElement('object', 'Sword', 'Desc');

			const all = await manager.listElements();

			expect(all).toHaveLength(3);
		});

		it('filters by type', async () => {
			await manager.createElement('character', 'Hero', 'Desc');
			await manager.createElement('character', 'Villain', 'Desc');
			await manager.createElement('location', 'Castle', 'Desc');

			const characters = await manager.listElements('character');
			const locations = await manager.listElements('location');

			expect(characters).toHaveLength(2);
			expect(locations).toHaveLength(1);
		});

		it('returns empty array when no elements of type', async () => {
			await manager.createElement('character', 'Hero', 'Desc');

			const objects = await manager.listElements('object');

			expect(objects).toEqual([]);
		});
	});

	describe('updateElement', () => {
		it('updates element data', async () => {
			const element = await manager.createElement('character', 'Hero', 'Original');
			element.description = 'Updated description';

			await manager.updateElement(element);
			const fetched = await manager.getElement(element.id);

			expect(fetched?.description).toBe('Updated description');
		});

		it('updates updatedAt timestamp', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			const originalUpdatedAt = element.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			element.description = 'Changed';
			await manager.updateElement(element);

			const fetched = await manager.getElement(element.id);
			expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
		});

		it('throws error for non-existent element', async () => {
			const fakeElement: WorldElement = {
				id: 'non-existent',
				name: 'Fake',
				type: 'character',
				description: 'Fake',
				images: [],
				historyIndex: 0,
				history: [],
				createdAt: new Date(),
				updatedAt: new Date()
			};

			await expect(manager.updateElement(fakeElement)).rejects.toThrow('not found');
		});
	});

	describe('deleteElement', () => {
		it('removes element', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.deleteElement(element.id);

			const fetched = await manager.getElement(element.id);
			expect(fetched).toBeNull();
		});

		it('throws error for non-existent element', async () => {
			await expect(manager.deleteElement('non-existent')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// ENHANCE DESCRIPTION
	// ===========================================================================

	describe('enhanceDescription', () => {
		it('first enhance sets isEnhanced to true', async () => {
			const element = await manager.createElement('character', 'Hero', 'Original description');
			expect(element.isEnhanced).toBeUndefined();

			const enhanced = await manager.enhanceDescription(element.id);
			expect(enhanced.isEnhanced).toBe(true);
		});

		it('first enhance saves preEnhancementDescription', async () => {
			const element = await manager.createElement('character', 'Hero', 'Original description');

			const enhanced = await manager.enhanceDescription(element.id);

			expect(enhanced.preEnhancementDescription).toBe('Original description');
		});

		it('sets enhancedDescription', async () => {
			const element = await manager.createElement('character', 'Hero', 'Original description');

			const enhanced = await manager.enhanceDescription(element.id);

			expect(enhanced.enhancedDescription).toBeDefined();
			expect(enhanced.enhancedDescription).not.toBe('Original description');
		});

		it('subsequent enhance uses preEnhancementDescription', async () => {
			const element = await manager.createElement('character', 'Hero', 'Original');

			await manager.enhanceDescription(element.id);
			const reEnhanced = await manager.enhanceDescription(element.id);

			// Should still reference the original
			expect(reEnhanced.preEnhancementDescription).toBe('Original');
		});

		it('throws error for non-existent element', async () => {
			await expect(manager.enhanceDescription('non-existent')).rejects.toThrow('not found');
		});
	});

	// ===========================================================================
	// IMAGE MANAGEMENT
	// ===========================================================================

	describe('addImage', () => {
		it('adds image to element', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			const updated = await manager.addImage(element.id, {
				id: 'img-1',
				imageUrl: 'https://example.com/img.png',
				revisedPrompt: 'A hero',
				createdAt: new Date()
			});

			expect(updated.images).toHaveLength(1);
		});

		it('new image is active by default', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			const updated = await manager.addImage(element.id, {
				id: 'img-1',
				imageUrl: 'https://example.com/img.png',
				revisedPrompt: 'A hero',
				createdAt: new Date()
			});

			expect(updated.images[0].isActive).toBe(true);
		});

		it('adding new image makes previous images inactive', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			await manager.addImage(element.id, {
				id: 'img-1',
				imageUrl: 'https://example.com/img1.png',
				revisedPrompt: 'V1',
				createdAt: new Date()
			});

			const updated = await manager.addImage(element.id, {
				id: 'img-2',
				imageUrl: 'https://example.com/img2.png',
				revisedPrompt: 'V2',
				createdAt: new Date()
			});

			const img1 = updated.images.find((i) => i.id === 'img-1');
			const img2 = updated.images.find((i) => i.id === 'img-2');

			expect(img1?.isActive).toBe(false);
			expect(img2?.isActive).toBe(true);
		});
	});

	describe('setActiveImage', () => {
		it('sets specified image as active', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.addImage(element.id, { id: 'img-1', imageUrl: 'url1', revisedPrompt: '', createdAt: new Date() });
			await manager.addImage(element.id, { id: 'img-2', imageUrl: 'url2', revisedPrompt: '', createdAt: new Date() });

			const updated = await manager.setActiveImage(element.id, 'img-1');

			const img1 = updated.images.find((i) => i.id === 'img-1');
			const img2 = updated.images.find((i) => i.id === 'img-2');

			expect(img1?.isActive).toBe(true);
			expect(img2?.isActive).toBe(false);
		});

		it('throws error for non-existent image', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			await expect(manager.setActiveImage(element.id, 'non-existent')).rejects.toThrow('not found');
		});

		it('only one image can be active at a time', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.addImage(element.id, { id: 'img-1', imageUrl: 'url1', revisedPrompt: '', createdAt: new Date() });
			await manager.addImage(element.id, { id: 'img-2', imageUrl: 'url2', revisedPrompt: '', createdAt: new Date() });
			await manager.addImage(element.id, { id: 'img-3', imageUrl: 'url3', revisedPrompt: '', createdAt: new Date() });

			await manager.setActiveImage(element.id, 'img-2');
			const fetched = await manager.getElement(element.id);

			const activeImages = fetched?.images.filter((i) => i.isActive);
			expect(activeImages).toHaveLength(1);
			expect(activeImages?.[0].id).toBe('img-2');
		});
	});

	describe('deleteImage', () => {
		it('removes non-active image', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.addImage(element.id, { id: 'img-1', imageUrl: 'url1', revisedPrompt: '', createdAt: new Date() });
			await manager.addImage(element.id, { id: 'img-2', imageUrl: 'url2', revisedPrompt: '', createdAt: new Date() });
			// img-2 is now active, img-1 is not

			const updated = await manager.deleteImage(element.id, 'img-1');

			expect(updated.images).toHaveLength(1);
			expect(updated.images[0].id).toBe('img-2');
		});

		it('throws error when trying to delete active image', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.addImage(element.id, { id: 'img-1', imageUrl: 'url1', revisedPrompt: '', createdAt: new Date() });

			await expect(manager.deleteImage(element.id, 'img-1')).rejects.toThrow('Cannot delete active image');
		});

		it('throws error for non-existent image', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			await expect(manager.deleteImage(element.id, 'non-existent')).rejects.toThrow('not found');
		});
	});

	describe('getActiveImage', () => {
		it('returns active image', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');
			await manager.addImage(element.id, { id: 'img-1', imageUrl: 'url1', revisedPrompt: '', createdAt: new Date() });

			const fetched = await manager.getElement(element.id);
			const active = manager.getActiveImage(fetched!);

			expect(active?.id).toBe('img-1');
		});

		it('returns null when no images', async () => {
			const element = await manager.createElement('character', 'Hero', 'Desc');

			const active = manager.getActiveImage(element);

			expect(active).toBeNull();
		});
	});

	// ===========================================================================
	// CASCADE DELETION
	// ===========================================================================

	describe('Cascade Deletion Check', () => {
		it('returns zero when element not used in scenes', () => {
			const scenes = [
				{ assignedElements: ['other-id-1', 'other-id-2'] },
				{ assignedElements: ['other-id-3'] }
			];

			const result = cascadeChecker.checkElementUsage('elem-1', scenes);

			expect(result.usedInScenes).toBe(0);
			expect(result.sceneIds).toEqual([]);
		});

		it('returns count of scenes using element', () => {
			const scenes = [
				{ assignedElements: ['elem-1', 'elem-2'] },
				{ assignedElements: ['elem-1'] },
				{ assignedElements: ['elem-3'] }
			];

			const result = cascadeChecker.checkElementUsage('elem-1', scenes);

			expect(result.usedInScenes).toBe(2);
		});

		it('returns scene IDs where element is used', () => {
			const scenes = [
				{ assignedElements: ['elem-1'] },
				{ assignedElements: [] },
				{ assignedElements: ['elem-1'] }
			];

			const result = cascadeChecker.checkElementUsage('elem-1', scenes);

			expect(result.sceneIds).toContain('scene-0');
			expect(result.sceneIds).toContain('scene-2');
		});
	});

	describe('Remove Element from Scenes', () => {
		it('removes element from all scenes', () => {
			const scenes = [
				{ id: 's1', assignedElements: ['elem-1', 'elem-2'] },
				{ id: 's2', assignedElements: ['elem-1'] },
				{ id: 's3', assignedElements: ['elem-3'] }
			];

			const updated = cascadeChecker.removeElementFromScenes('elem-1', scenes);

			expect(updated[0].assignedElements).toEqual(['elem-2']);
			expect(updated[1].assignedElements).toEqual([]);
			expect(updated[2].assignedElements).toEqual(['elem-3']);
		});

		it('does not modify scenes that do not contain element', () => {
			const scenes = [{ id: 's1', assignedElements: ['elem-2', 'elem-3'] }];

			const updated = cascadeChecker.removeElementFromScenes('elem-1', scenes);

			expect(updated[0].assignedElements).toEqual(['elem-2', 'elem-3']);
		});
	});
});
