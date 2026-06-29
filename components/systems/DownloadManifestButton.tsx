"use client";

import { Button } from "@/components/ui/button";
import type { Manifest } from "@/lib/asset-system/schema";

/**
 * Serialize a system's manifest to a JSON data-URL and trigger a download
 * client-side — no extra route needed.
 */
export function DownloadManifestButton({
  name,
  manifest,
}: {
  name: string;
  manifest: Manifest;
}) {
  function download() {
    const json = JSON.stringify(manifest, null, 2);
    const href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "asset-system";
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={download}>
      Download manifest
    </Button>
  );
}
