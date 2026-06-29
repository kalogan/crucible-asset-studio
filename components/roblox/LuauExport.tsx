"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { descriptorToLuau } from "@/lib/roblox/descriptorToLuau";
import type { RobloxDescriptor, SocketSchema } from "@/lib/roblox/schema";

/**
 * Per-descriptor "emit to Roblox" controls: copy the generated Luau to the
 * clipboard, or download it as a `.luau` file. Both call the pure
 * `descriptorToLuau(descriptor, schema)` — the script rebuilds this assembly in
 * Roblox Studio (studs, Anchored parts, one Model). Client-only (clipboard +
 * Blob download). Atelier tokens via the shared Button.
 */
export function LuauExport({
  descriptor,
  schema,
}: {
  descriptor: RobloxDescriptor;
  schema: SocketSchema;
}) {
  const [copied, setCopied] = useState(false);

  const generate = useCallback(
    () => descriptorToLuau(descriptor, schema),
    [descriptor, schema],
  );

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generate());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (no permission / insecure context) — no-op; the
      // download path still works.
    }
  }, [generate]);

  const onDownload = useCallback(() => {
    const blob = new Blob([generate()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${descriptor.id}.luau`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [descriptor.id, generate]);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={onCopy}
        aria-label={`Copy Luau for ${descriptor.id}`}
      >
        {copied ? "Copied" : "Copy Luau"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={onDownload}
        aria-label={`Download .luau for ${descriptor.id}`}
      >
        Download
      </Button>
    </div>
  );
}
