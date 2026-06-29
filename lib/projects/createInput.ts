import { slugify, isValidSlug } from "@/lib/util/slug";

/** Validate + normalize the create-project form into a name + derived slug. */
export function parseCreateProjectForm(rawName: string): { name: string; slug: string } {
  const name = rawName.trim();
  if (name.length < 2) {
    throw new Error("Project name must be at least 2 characters.");
  }
  const slug = slugify(name);
  if (!isValidSlug(slug)) {
    throw new Error("Could not derive a valid slug from that name.");
  }
  return { name, slug };
}
