/**
 * Stage 1: Project - Unit Tests
 * Based on STATE-WORKFLOW-SPEC.md and SCHEMAS-SPEC.md
 *
 * Tests cover:
 * - Project creation and initialization
 * - Project CRUD operations via ProjectManager
 * - Default naming logic
 * - Project persistence adapter interface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Types based on SCHEMAS-SPEC.md
interface Project {
	id: string;
	name: string;
	description?: string;
	thumbnail?: string;
	createdAt: Date;
	updatedAt: Date;
	lastOpenedAt: Date;
	storyHistory: any[];
	storyHistoryIndex: number;
	currentStory: any | null;
	worldElements: Map<string, any>;
	scenes: any[];
	video: any | null;
}

interface ProjectSummary {
	id: string;
	name: string;
	description?: string;
	thumbnail?: string;
	updatedAt: Date;
	lastOpenedAt: Date;
}

// Mock implementation of what the library should provide
class ProjectManager {
	private projects: Map<string, Project> = new Map();
	private currentProjectId: string | null = null;

	async createProject(name: string = 'New Project'): Promise<Project> {
		// Generate unique name if needed
		const uniqueName = this.generateUniqueName(name);

		const project: Project = {
			id: `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			name: uniqueName,
			createdAt: new Date(),
			updatedAt: new Date(),
			lastOpenedAt: new Date(),
			storyHistory: [],
			storyHistoryIndex: -1,
			currentStory: null,
			worldElements: new Map(),
			scenes: [],
			video: null
		};

		this.projects.set(project.id, project);
		this.currentProjectId = project.id;

		return project;
	}

	async getProject(id: string): Promise<Project | null> {
		return this.projects.get(id) || null;
	}

	async listProjects(): Promise<ProjectSummary[]> {
		return Array.from(this.projects.values()).map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			thumbnail: p.thumbnail,
			updatedAt: p.updatedAt,
			lastOpenedAt: p.lastOpenedAt
		}));
	}

	async updateProject(project: Project): Promise<void> {
		if (!this.projects.has(project.id)) {
			throw new Error(`Project ${project.id} not found`);
		}
		project.updatedAt = new Date();
		this.projects.set(project.id, project);
	}

	async deleteProject(id: string): Promise<void> {
		if (!this.projects.has(id)) {
			throw new Error(`Project ${id} not found`);
		}
		this.projects.delete(id);

		// If deleted project was current, clear current
		if (this.currentProjectId === id) {
			this.currentProjectId = null;
		}
	}

	async renameProject(id: string, newName: string): Promise<Project> {
		const project = await this.getProject(id);
		if (!project) {
			throw new Error(`Project ${id} not found`);
		}

		// Check for name uniqueness (excluding self)
		const existingNames = Array.from(this.projects.values())
			.filter((p) => p.id !== id)
			.map((p) => p.name);

		if (existingNames.includes(newName)) {
			throw new Error(`Project name "${newName}" already exists`);
		}

		project.name = newName;
		await this.updateProject(project);
		return project;
	}

	async switchProject(id: string): Promise<Project> {
		const project = await this.getProject(id);
		if (!project) {
			throw new Error(`Project ${id} not found`);
		}

		project.lastOpenedAt = new Date();
		await this.updateProject(project);
		this.currentProjectId = id;

		return project;
	}

	getCurrentProjectId(): string | null {
		return this.currentProjectId;
	}

	async getCurrentProject(): Promise<Project | null> {
		if (!this.currentProjectId) return null;
		return this.getProject(this.currentProjectId);
	}

	private generateUniqueName(baseName: string): string {
		const existingNames = Array.from(this.projects.values()).map((p) => p.name);

		if (!existingNames.includes(baseName)) {
			return baseName;
		}

		// Find next available number
		let counter = 1;
		let candidateName = `${baseName} (${counter})`;

		while (existingNames.includes(candidateName)) {
			counter++;
			candidateName = `${baseName} (${counter})`;
		}

		return candidateName;
	}
}

describe('Stage 1: Project - Unit Tests', () => {
	let manager: ProjectManager;

	beforeEach(() => {
		manager = new ProjectManager();
	});

	// ===========================================================================
	// PROJECT CREATION
	// ===========================================================================

	describe('createProject', () => {
		it('creates a project with default name "New Project"', async () => {
			const project = await manager.createProject();

			expect(project.name).toBe('New Project');
		});

		it('creates a project with specified name', async () => {
			const project = await manager.createProject('My Video');

			expect(project.name).toBe('My Video');
		});

		it('generates unique ID for each project', async () => {
			const project1 = await manager.createProject('Project 1');
			const project2 = await manager.createProject('Project 2');

			expect(project1.id).not.toBe(project2.id);
		});

		it('initializes project with correct structure per spec', async () => {
			const project = await manager.createProject();

			expect(project).toMatchObject({
				name: 'New Project',
				storyHistory: [],
				storyHistoryIndex: -1,
				currentStory: null,
				scenes: [],
				video: null
			});
			expect(project.worldElements).toBeInstanceOf(Map);
			expect(project.worldElements.size).toBe(0);
		});

		it('sets timestamps on creation', async () => {
			const before = new Date();
			const project = await manager.createProject();
			const after = new Date();

			expect(project.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(project.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(project.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(project.lastOpenedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
		});

		it('sets created project as current', async () => {
			const project = await manager.createProject();

			expect(manager.getCurrentProjectId()).toBe(project.id);
		});
	});

	// ===========================================================================
	// DEFAULT NAMING
	// ===========================================================================

	describe('Default Naming', () => {
		it('generates "New Project (1)" if "New Project" exists', async () => {
			await manager.createProject('New Project');
			const project2 = await manager.createProject('New Project');

			expect(project2.name).toBe('New Project (1)');
		});

		it('generates "New Project (2)" if (1) also exists', async () => {
			await manager.createProject('New Project');
			await manager.createProject('New Project');
			const project3 = await manager.createProject('New Project');

			expect(project3.name).toBe('New Project (2)');
		});

		it('handles gaps in numbering correctly', async () => {
			await manager.createProject('New Project');
			await manager.createProject('New Project'); // (1)
			await manager.createProject('New Project'); // (2)

			// Delete (1)
			const projects = await manager.listProjects();
			const proj1 = projects.find((p) => p.name === 'New Project (1)');
			if (proj1) {
				await manager.deleteProject(proj1.id);
			}

			// Next should be (1) again since it's free
			const newProject = await manager.createProject('New Project');
			expect(newProject.name).toBe('New Project (1)');
		});

		it('applies uniqueness to custom names too', async () => {
			await manager.createProject('My Video');
			const project2 = await manager.createProject('My Video');

			expect(project2.name).toBe('My Video (1)');
		});
	});

	// ===========================================================================
	// PROJECT CRUD
	// ===========================================================================

	describe('getProject', () => {
		it('returns project by ID', async () => {
			const created = await manager.createProject('Test Project');
			const fetched = await manager.getProject(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe('Test Project');
		});

		it('returns null for non-existent ID', async () => {
			const fetched = await manager.getProject('non-existent-id');

			expect(fetched).toBeNull();
		});
	});

	describe('listProjects', () => {
		it('returns empty array when no projects', async () => {
			const projects = await manager.listProjects();

			expect(projects).toEqual([]);
		});

		it('returns all projects as summaries', async () => {
			await manager.createProject('Project A');
			await manager.createProject('Project B');
			await manager.createProject('Project C');

			const projects = await manager.listProjects();

			expect(projects).toHaveLength(3);
			expect(projects.map((p) => p.name)).toContain('Project A');
			expect(projects.map((p) => p.name)).toContain('Project B');
			expect(projects.map((p) => p.name)).toContain('Project C');
		});

		it('returns ProjectSummary shape (not full Project)', async () => {
			await manager.createProject('Test');
			const projects = await manager.listProjects();

			const summary = projects[0];
			expect(summary).toHaveProperty('id');
			expect(summary).toHaveProperty('name');
			expect(summary).toHaveProperty('updatedAt');
			expect(summary).toHaveProperty('lastOpenedAt');
			// Should NOT have full project data
			expect(summary).not.toHaveProperty('storyHistory');
			expect(summary).not.toHaveProperty('worldElements');
			expect(summary).not.toHaveProperty('scenes');
		});
	});

	describe('updateProject', () => {
		it('updates project data', async () => {
			const project = await manager.createProject('Original');
			project.description = 'Updated description';

			await manager.updateProject(project);
			const fetched = await manager.getProject(project.id);

			expect(fetched?.description).toBe('Updated description');
		});

		it('updates updatedAt timestamp', async () => {
			const project = await manager.createProject('Test');
			const originalUpdatedAt = project.updatedAt;

			// Wait a bit to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			project.description = 'Changed';
			await manager.updateProject(project);

			const fetched = await manager.getProject(project.id);
			expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
		});

		it('throws error for non-existent project', async () => {
			const fakeProject: Project = {
				id: 'non-existent',
				name: 'Fake',
				createdAt: new Date(),
				updatedAt: new Date(),
				lastOpenedAt: new Date(),
				storyHistory: [],
				storyHistoryIndex: -1,
				currentStory: null,
				worldElements: new Map(),
				scenes: [],
				video: null
			};

			await expect(manager.updateProject(fakeProject)).rejects.toThrow('not found');
		});
	});

	describe('deleteProject', () => {
		it('removes project from storage', async () => {
			const project = await manager.createProject('To Delete');
			await manager.deleteProject(project.id);

			const fetched = await manager.getProject(project.id);
			expect(fetched).toBeNull();
		});

		it('throws error for non-existent project', async () => {
			await expect(manager.deleteProject('non-existent')).rejects.toThrow('not found');
		});

		it('clears current project if deleted', async () => {
			const project = await manager.createProject('Current');
			expect(manager.getCurrentProjectId()).toBe(project.id);

			await manager.deleteProject(project.id);
			expect(manager.getCurrentProjectId()).toBeNull();
		});

		it('does not affect other projects', async () => {
			await manager.createProject('Keep This');
			const toDelete = await manager.createProject('Delete This');

			await manager.deleteProject(toDelete.id);

			const projects = await manager.listProjects();
			expect(projects).toHaveLength(1);
			expect(projects[0].name).toBe('Keep This');
		});
	});

	// ===========================================================================
	// PROJECT RENAMING
	// ===========================================================================

	describe('renameProject', () => {
		it('changes project name', async () => {
			const project = await manager.createProject('Original Name');
			await manager.renameProject(project.id, 'New Name');

			const fetched = await manager.getProject(project.id);
			expect(fetched?.name).toBe('New Name');
		});

		it('throws error if new name already exists', async () => {
			await manager.createProject('Existing Name');
			const project = await manager.createProject('Original');

			await expect(manager.renameProject(project.id, 'Existing Name')).rejects.toThrow('already exists');
		});

		it('allows renaming to same name (no-op)', async () => {
			const project = await manager.createProject('Same Name');

			// Should not throw
			await manager.renameProject(project.id, 'Same Name');

			const fetched = await manager.getProject(project.id);
			expect(fetched?.name).toBe('Same Name');
		});

		it('throws error for non-existent project', async () => {
			await expect(manager.renameProject('non-existent', 'New Name')).rejects.toThrow('not found');
		});

		it('updates updatedAt timestamp', async () => {
			const project = await manager.createProject('Original');
			const originalUpdatedAt = project.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			await manager.renameProject(project.id, 'Renamed');

			const fetched = await manager.getProject(project.id);
			expect(fetched?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
		});
	});

	// ===========================================================================
	// PROJECT SWITCHING
	// ===========================================================================

	describe('switchProject', () => {
		it('changes current project', async () => {
			const project1 = await manager.createProject('Project 1');
			const project2 = await manager.createProject('Project 2');

			await manager.switchProject(project1.id);

			expect(manager.getCurrentProjectId()).toBe(project1.id);
		});

		it('updates lastOpenedAt timestamp', async () => {
			const project = await manager.createProject('Test');
			const originalLastOpened = project.lastOpenedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			await manager.switchProject(project.id);

			const fetched = await manager.getProject(project.id);
			expect(fetched?.lastOpenedAt.getTime()).toBeGreaterThan(originalLastOpened.getTime());
		});

		it('throws error for non-existent project', async () => {
			await expect(manager.switchProject('non-existent')).rejects.toThrow('not found');
		});

		it('returns the switched-to project', async () => {
			const project = await manager.createProject('Target');

			const result = await manager.switchProject(project.id);

			expect(result.id).toBe(project.id);
			expect(result.name).toBe('Target');
		});
	});

	// ===========================================================================
	// CURRENT PROJECT
	// ===========================================================================

	describe('getCurrentProject', () => {
		it('returns null when no current project', async () => {
			const current = await manager.getCurrentProject();

			expect(current).toBeNull();
		});

		it('returns current project after creation', async () => {
			const created = await manager.createProject('Current');

			const current = await manager.getCurrentProject();

			expect(current?.id).toBe(created.id);
		});

		it('returns switched project as current', async () => {
			await manager.createProject('First');
			const second = await manager.createProject('Second');
			await manager.switchProject(second.id);

			const current = await manager.getCurrentProject();

			expect(current?.name).toBe('Second');
		});
	});

	// ===========================================================================
	// PROJECT STRUCTURE VALIDATION
	// ===========================================================================

	describe('Project Structure', () => {
		it('storyHistory is array for versioning', async () => {
			const project = await manager.createProject();

			expect(Array.isArray(project.storyHistory)).toBe(true);
		});

		it('storyHistoryIndex starts at -1 (no story)', async () => {
			const project = await manager.createProject();

			expect(project.storyHistoryIndex).toBe(-1);
		});

		it('worldElements is Map for element storage', async () => {
			const project = await manager.createProject();

			expect(project.worldElements).toBeInstanceOf(Map);
		});

		it('scenes is array (order = storyboard order)', async () => {
			const project = await manager.createProject();

			expect(Array.isArray(project.scenes)).toBe(true);
		});

		it('video starts as null (not generated)', async () => {
			const project = await manager.createProject();

			expect(project.video).toBeNull();
		});
	});
});
