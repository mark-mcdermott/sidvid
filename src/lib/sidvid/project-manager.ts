import type { StorageAdapter } from './storage/adapter';
import type { Project, ProjectSummary } from './types';

/**
 * ProjectManager - Manages project lifecycle and persistence
 *
 * Follows the pattern of SessionManager but implements the new Project
 * schema from SCHEMAS-SPEC.md. Handles:
 * - Project CRUD operations
 * - Default naming with uniqueness
 * - Current project tracking
 * - Persistence via StorageAdapter
 */
export class ProjectManager {
	private storage: StorageAdapter;
	private projects = new Map<string, Project>();
	private currentProjectId: string | null = null;
	private autoSave: boolean = false;

	constructor(storage: StorageAdapter) {
		this.storage = storage;
	}

	enableAutoSave(): void {
		this.autoSave = true;
	}

	disableAutoSave(): void {
		this.autoSave = false;
	}

	// ===== Project Creation =====

	async createProject(name: string = 'My Project'): Promise<Project> {
		// Load existing projects to check names
		await this.loadAllFromStorage();

		// Generate unique name if needed
		const uniqueName = this.generateUniqueName(name);

		const project: Project = {
			id: this.generateId(),
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

		if (this.autoSave) {
			await this.saveProject(project);
		}

		return project;
	}

	private generateId(): string {
		return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

	// ===== Project Loading =====

	async getProject(id: string): Promise<Project | null> {
		// Check cache first
		if (this.projects.has(id)) {
			return this.projects.get(id)!;
		}

		// Try loading from storage
		try {
			const data = await this.storage.load(`projects/${id}`);
			const project = this.deserializeProject(data);
			this.projects.set(id, project);
			return project;
		} catch {
			return null;
		}
	}

	async listProjects(): Promise<ProjectSummary[]> {
		await this.loadAllFromStorage();

		return Array.from(this.projects.values())
			.map((p) => ({
				id: p.id,
				name: p.name,
				description: p.description,
				thumbnail: p.thumbnail,
				updatedAt: p.updatedAt,
				lastOpenedAt: p.lastOpenedAt
			}))
			.sort((a, b) => b.lastOpenedAt.getTime() - a.lastOpenedAt.getTime());
	}

	private async loadAllFromStorage(): Promise<void> {
		try {
			const keys = await this.storage.list('projects/');

			for (const key of keys) {
				const id = key.replace('projects/', '');

				// Skip if already cached
				if (this.projects.has(id)) {
					continue;
				}

				try {
					const data = await this.storage.load(key);
					const project = this.deserializeProject(data);
					this.projects.set(id, project);
				} catch {
					// Skip invalid entries
					continue;
				}
			}
		} catch {
			// Storage might be empty, that's okay
		}
	}

	// ===== Project Update =====

	async updateProject(project: Project): Promise<void> {
		if (!this.projects.has(project.id)) {
			// Check storage
			const existing = await this.getProject(project.id);
			if (!existing) {
				throw new Error(`Project ${project.id} not found`);
			}
		}

		project.updatedAt = new Date();
		this.projects.set(project.id, project);

		if (this.autoSave) {
			await this.saveProject(project);
		}
	}

	private async saveProject(project: Project): Promise<void> {
		const data = this.serializeProject(project);
		await this.storage.save(`projects/${project.id}`, data);
	}

	// ===== Project Deletion =====

	async deleteProject(id: string): Promise<void> {
		// Check if exists
		if (!this.projects.has(id)) {
			const existing = await this.getProject(id);
			if (!existing) {
				throw new Error(`Project ${id} not found`);
			}
		}

		// Remove from storage
		try {
			await this.storage.delete(`projects/${id}`);
		} catch {
			// May already be deleted from storage
		}

		// Remove from cache
		this.projects.delete(id);

		// Clear current project if it was deleted
		if (this.currentProjectId === id) {
			this.currentProjectId = null;
		}
	}

	// ===== Project Renaming =====

	async renameProject(id: string, newName: string): Promise<Project> {
		const project = await this.getProject(id);
		if (!project) {
			throw new Error(`Project ${id} not found`);
		}

		// Allow renaming to same name (no-op)
		if (project.name === newName) {
			return project;
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

	// ===== Project Switching =====

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

	// ===== Current Project =====

	getCurrentProjectId(): string | null {
		return this.currentProjectId;
	}

	async getCurrentProject(): Promise<Project | null> {
		if (!this.currentProjectId) return null;
		return this.getProject(this.currentProjectId);
	}

	// ===== Serialization =====

	private serializeProject(project: Project): any {
		return {
			...project,
			createdAt: project.createdAt.toISOString(),
			updatedAt: project.updatedAt.toISOString(),
			lastOpenedAt: project.lastOpenedAt.toISOString(),
			worldElements: this.serializeMap(project.worldElements),
			currentStory: project.currentStory
				? this.serializeStory(project.currentStory)
				: null,
			storyHistory: project.storyHistory.map((s) => this.serializeStory(s)),
			scenes: project.scenes.map((s) => this.serializeScene(s)),
			video: project.video ? this.serializeVideo(project.video) : null
		};
	}

	private deserializeProject(data: any): Project {
		return {
			...data,
			createdAt: new Date(data.createdAt),
			updatedAt: new Date(data.updatedAt),
			lastOpenedAt: new Date(data.lastOpenedAt),
			worldElements: this.deserializeMap(data.worldElements),
			currentStory: data.currentStory
				? this.deserializeStory(data.currentStory)
				: null,
			storyHistory: (data.storyHistory || []).map((s: any) =>
				this.deserializeStory(s)
			),
			scenes: (data.scenes || []).map((s: any) => this.deserializeScene(s)),
			video: data.video ? this.deserializeVideo(data.video) : null
		};
	}

	private serializeMap(map: Map<string, any>): Record<string, any> {
		const obj: Record<string, any> = {};
		map.forEach((value, key) => {
			obj[key] = this.serializeWorldElement(value);
		});
		return obj;
	}

	private deserializeMap(obj: Record<string, any> | null): Map<string, any> {
		const map = new Map<string, any>();
		if (!obj) return map;

		Object.entries(obj).forEach(([key, value]) => {
			map.set(key, this.deserializeWorldElement(value));
		});
		return map;
	}

	private serializeStory(story: any): any {
		return {
			...story,
			createdAt: story.createdAt instanceof Date
				? story.createdAt.toISOString()
				: story.createdAt
		};
	}

	private deserializeStory(data: any): any {
		return {
			...data,
			createdAt: new Date(data.createdAt)
		};
	}

	private serializeWorldElement(element: any): any {
		return {
			...element,
			createdAt: element.createdAt instanceof Date
				? element.createdAt.toISOString()
				: element.createdAt,
			updatedAt: element.updatedAt instanceof Date
				? element.updatedAt.toISOString()
				: element.updatedAt,
			images: (element.images || []).map((img: any) => ({
				...img,
				createdAt: img.createdAt instanceof Date
					? img.createdAt.toISOString()
					: img.createdAt
			})),
			history: (element.history || []).map((v: any) => ({
				...v,
				createdAt: v.createdAt instanceof Date
					? v.createdAt.toISOString()
					: v.createdAt,
				images: (v.images || []).map((img: any) => ({
					...img,
					createdAt: img.createdAt instanceof Date
						? img.createdAt.toISOString()
						: img.createdAt
				}))
			}))
		};
	}

	private deserializeWorldElement(data: any): any {
		return {
			...data,
			createdAt: new Date(data.createdAt),
			updatedAt: new Date(data.updatedAt),
			images: (data.images || []).map((img: any) => ({
				...img,
				createdAt: new Date(img.createdAt)
			})),
			history: (data.history || []).map((v: any) => ({
				...v,
				createdAt: new Date(v.createdAt),
				images: (v.images || []).map((img: any) => ({
					...img,
					createdAt: new Date(img.createdAt)
				}))
			}))
		};
	}

	private serializeScene(scene: any): any {
		return {
			...scene,
			createdAt: scene.createdAt instanceof Date
				? scene.createdAt.toISOString()
				: scene.createdAt,
			updatedAt: scene.updatedAt instanceof Date
				? scene.updatedAt.toISOString()
				: scene.updatedAt,
			images: (scene.images || []).map((img: any) => ({
				...img,
				createdAt: img.createdAt instanceof Date
					? img.createdAt.toISOString()
					: img.createdAt
			}))
		};
	}

	private deserializeScene(data: any): any {
		return {
			...data,
			createdAt: new Date(data.createdAt),
			updatedAt: new Date(data.updatedAt),
			images: (data.images || []).map((img: any) => ({
				...img,
				createdAt: new Date(img.createdAt)
			}))
		};
	}

	private serializeVideo(video: any): any {
		return {
			...video,
			createdAt: video.createdAt instanceof Date
				? video.createdAt.toISOString()
				: video.createdAt,
			versions: (video.versions || []).map((v: any) => ({
				...v,
				createdAt: v.createdAt instanceof Date
					? v.createdAt.toISOString()
					: v.createdAt
			}))
		};
	}

	private deserializeVideo(data: any): any {
		return {
			...data,
			createdAt: new Date(data.createdAt),
			versions: (data.versions || []).map((v: any) => ({
				...v,
				createdAt: new Date(v.createdAt)
			}))
		};
	}
}
