import Link from "next/link";
import { RobloxGallery } from "@/components/roblox/RobloxGallery";

export const dynamic = "force-dynamic";

export default function RobloxPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12 lg:max-w-5xl xl:max-w-6xl">
      <header className="flex flex-col gap-2">
        <Link href="/" className="w-fit text-sm text-primary underline underline-offset-2">
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold">Roblox bridge</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          web↔Roblox descriptor bridge — Phase 1: greybox render from the
          engine-agnostic socket/DNA schema. An archetype defines named sockets
          (position + size, in studs); a descriptor maps DNA + a greybox color +
          scale over them. Each tile below is a descriptor assembled in three.js
          and normalized to fit. Next: DNA part loading, GLB export, and
          web→Roblox Luau emit.
        </p>
      </header>

      <RobloxGallery />
    </main>
  );
}
