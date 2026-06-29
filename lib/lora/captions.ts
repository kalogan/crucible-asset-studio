/**
 * LoRA caption schema (CANON_INTAKE §5.1): `<trigger>, <content>, <style tags>`.
 * Caption *consistency* across the set is what locks the style — keep the trigger
 * and style tags identical; vary only the content description.
 */
export function contentFromFilename(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "") // drop extension
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function captionFor(
  trigger: string,
  content: string,
  styleTags: string[] = [],
): string {
  const parts = [trigger.trim(), content.trim(), ...styleTags.map((t) => t.trim())];
  return parts.filter((p) => p.length > 0).join(", ");
}
