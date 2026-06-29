import type { Canon } from "@/lib/schema";

/**
 * Assemble the final image prompt from a canon's scaffolding + the asset subject.
 * This is the immediate, pre-LoRA on-canon lever (KERNEL_LESSONS §0): the canon
 * supplies the STYLE (prefix/suffix), the user supplies the SUBJECT.
 *
 * Note: FLUX-schnell has no negative-prompt input, so canon.negative_prompt is
 * stored (for LoRA training / future SDXL) but not sent here.
 */
export function buildFinalPrompt(canon: Pick<
  Canon,
  "prompt_prefix" | "prompt_suffix"
> | null, subject: string): string {
  const clean = (s: string) => s.trim().replace(/^[,\s]+|[,\s]+$/g, "");
  const subj = clean(subject);
  if (!canon) {
    // Canon-free fallback (Phase 1 behavior).
    return `${subj}, isolated object, neutral background`;
  }
  return [clean(canon.prompt_prefix), subj, clean(canon.prompt_suffix)]
    .filter((p) => p.length > 0)
    .join(", ");
}
