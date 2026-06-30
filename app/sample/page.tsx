import Link from "next/link";
import { SampleGame } from "@/components/sample/SampleGame";

export const dynamic = "force-dynamic";

export default function SamplePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-6 py-8 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link href="/kit" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">Sample game — the clearing</h1>
        <p className="text-sm text-muted-foreground">
          The whole kit, end to end: a procgen world (
          <code className="rounded bg-muted px-1 py-0.5 text-xs">buildWorld</code>) with an NPC who
          wanders it (<code className="rounded bg-muted px-1 py-0.5 text-xs">nav</code> +{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">behavior</code>) and talks +
          remembers you (<code className="rounded bg-muted px-1 py-0.5 text-xs">npc</code>). Click
          Mira to start a conversation.
        </p>
      </header>

      <SampleGame />
    </main>
  );
}
