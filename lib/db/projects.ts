import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { Project, ProjectInsert, type ProjectInsert as ProjectInsertT } from "@/lib/schema";

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
  return (data ?? []).map((row) => Project.parse(row));
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
