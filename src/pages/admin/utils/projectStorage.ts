import type { Project } from "../context/AdminTypes";

const PROJECT_STORAGE_KEY = "worktime_projects_v1";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: unknown): Project => {
      const p = item as Record<string, unknown>;
      return {
        id: p.id as number,
        name: typeof p.name === "string" ? p.name : "",
        description: typeof p.description === "string" ? p.description : "",
        leaderId: typeof p.leaderId === "number" ? p.leaderId : 0,
        dueDate: typeof p.dueDate === "string" ? p.dueDate : undefined,
        createdAt:
          typeof p.createdAt === "string"
            ? p.createdAt
            : new Date().toISOString(),
        files: Array.isArray(p.files) ? (p.files as Project["files"]) : [],
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
        memberIds: Array.isArray(p.memberIds)
          ? (p.memberIds as number[])
          : [],
      };
    });
  } catch (err) {
    console.error("Failed to load projects:", err);
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save projects:", err);
  }
}