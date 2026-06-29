import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { CreateGameForm } from "@/components/games/CreateGameForm";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold text-zinc-50">New game</h1>
        <p className="text-sm text-zinc-400">
          Register a game — fill in what you have; you can edit it all later on its page.
        </p>
      </header>
      {configured ? (
        <CreateGameForm />
      ) : (
        <p className="text-sm text-zinc-300">Connect Supabase first (see the home page).</p>
      )}
    </main>
  );
}
