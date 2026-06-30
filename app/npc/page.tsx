import Link from "next/link";
import { DEMO_NPC } from "@/lib/npc/demo";
import { NpcChat } from "@/components/npc/NpcChat";

export const dynamic = "force-dynamic";

export default function NpcPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link href="/kit" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">NPC demo</h1>
        <p className="text-sm text-muted-foreground">
          A live demo of <code className="rounded bg-muted px-1 py-0.5 text-xs">game-kit/npc</code>:
          a personaed NPC with a firewalled reasoning brain, semantic-recall memory, and graceful
          scripted fallback. Runs on Claude server-side when{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code> is set,
          else the kit&apos;s deterministic mock.
        </p>
      </header>

      <NpcChat npc={{ name: DEMO_NPC.name, persona: DEMO_NPC.persona }} />
    </main>
  );
}
