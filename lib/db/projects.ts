import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import {
  Project,
  ProjectInsert,
  ProjectUpdate,
  type ProjectInsert as ProjectInsertT,
  type ProjectUpdate as ProjectUpdateT,
} from "@/lib/schema";

export async function createProject(input: ProjectInsertT): Promise<Project> {
  const supabase = createServiceClient();
  const payload = ProjectInsert.parse(input);
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`createProject: ${error.message}`);
  return Project.parse(data);
}

export async function listProjects(): Promise<Project[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listProjects: ${error.message}`);
  // Tolerant parse: a single malformed row (e.g. an unexpected status) must NOT
  // 500 the whole gallery — skip + warn so the front door always renders.
  const projects: Project[] = [];
  for (const row of data ?? []) {
    const parsed = Project.safeParse(row);
    if (parsed.success) {
      projects.push(parsed.data);
    } else {
      const id = (row as { id?: unknown })?.id;
      console.warn(`listProjects: skipping malformed project row ${String(id)}:`, parsed.error.message);
    }
  }
  return projects;
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getProject: ${error.message}`);
  return data ? Project.parse(data) : null;
}

export async function updateProject(id: string, patch: ProjectUpdateT): Promise<Project> {
  const supabase = createServiceClient();
  const payload = ProjectUpdate.parse(patch);
  const { data, error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateProject: ${error.message}`);
  return Project.parse(data);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getProjectBySlug: ${error.message}`);
  return data ? Project.parse(data) : null;
}
