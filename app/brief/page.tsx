import Link from "next/link";
import { BriefGenerator } from "@/components/brief/BriefGenerator";

export const dynamic = "force-dynamic";

export default function BriefPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl min-[1440px]:max-w-7xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/kit"
          className="w-fit text-sm text-primary underline underline-offset-2"
        >
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">Design brief</h1>
        <p className="text-sm text-muted-foreground">
          Describe a game in a line. An Architect agent (Claude) grills it down to a buildable
          brief — core loop, a few pillars, the first disjoint slice, risks, and which{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">game-kit</code> systems it
          needs — then hands those straight to the{" "}
          <Link href="/kit/scaffold" className="text-primary underline underline-offset-2">
            scaffolder
          </Link>
          . Idea → brief → runnable starter.
        </p>
      </header>

      <BriefGenerator />
    </main>
  );
}
