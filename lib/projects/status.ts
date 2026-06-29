import type { ProjectStatus } from "@/lib/schema";

/** Badge classes per portfolio status (token-driven; label text also carries meaning). */
export function statusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "shipped":
      return "border-accent/30 bg-accent/10 text-accent";
    case "active":
      return "border-primary/30 bg-primary/10 text-primary";
    case "paused":
      return "border-border bg-muted text-muted-foreground";
    case "prototype":
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}
