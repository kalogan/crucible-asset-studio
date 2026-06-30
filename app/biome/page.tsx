import Link from "next/link";
import { BiomeEditor } from "@/components/biome/BiomeEditor";

export const dynamic = "force-dynamic";

export default function BiomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[110rem] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/kit" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Kit health check
        </Link>
        <h1 className="text-3xl font-semibold">Biome editor</h1>
        <p className="text-sm text-muted-foreground">
          Tune a procgen world live — terrain knobs, prop fields, palette, environment FX —
          driving <code className="rounded bg-muted px-1 py-0.5 text-xs">game-kit</code>&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">buildWorld</code>. Save variants
          to your browser and export the JSON descriptor — a game loads the same descriptor.
        </p>
      </header>

      <BiomeEditor />
    </main>
  );
}
