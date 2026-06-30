"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_WORLD, type WorldDescriptor } from "game-kit";
import { NpcChat } from "@/components/npc/NpcChat";
import { Button } from "@/components/ui/button";

const SampleScene = dynamic(() => import("./SampleScene").then((m) => m.SampleScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading the clearing…
    </div>
  ),
});

const NPC = {
  name: "Mira",
  persona: {
    role: "a weary herbalist tending a frost-bitten garden at the edge of Skyhold",
    voice: "warm but tired; plainspoken, a touch wry",
  },
};

export function SampleGame() {
  const [chatOpen, setChatOpen] = useState(false);

  // A small, calm snowy clearing for the demo.
  const descriptor = useMemo<WorldDescriptor>(
    () => ({
      ...DEFAULT_WORLD,
      terrain: { ...DEFAULT_WORLD.terrain, zoneSize: 60, maxHeight: 4, seed: 7 },
      props: [
        { id: "conifer-tree", density: 18 },
        { id: "snow-drift", density: 40 },
        { id: "rock", density: 10 },
      ],
      placements: [{ kind: "landmark", id: "village-longhouse", x: 8, z: -6 }],
    }),
    [],
  );

  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-lg border border-border bg-black/40 lg:h-[78vh]">
      <SampleScene descriptor={descriptor} onTalk={() => setChatOpen(true)} />

      {!chatOpen && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          Click <span className="text-foreground">Mira</span> (the figure in the ring) to talk · drag to orbit
        </div>
      )}

      {chatOpen && (
        <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-border bg-background/95 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Talking to {NPC.name}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setChatOpen(false)}>
              Close
            </Button>
          </div>
          <NpcChat npc={NPC} />
        </div>
      )}
    </div>
  );
}
