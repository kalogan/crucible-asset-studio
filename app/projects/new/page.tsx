import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config";
import { CreateGameForm } from "@/components/games/CreateGameForm";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12 lg:max-w-4xl xl:max-w-5xl">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="w-fit rounded text-sm text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Games
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">New game</h1>
        <p className="text-sm text-muted-foreground">
          Register a game — fill in what you have; you can edit it all later on its page.
        </p>
      </header>
      {configured ? (
        <CreateGameForm />
      ) : (
        <p className="text-sm text-foreground">Connect Supabase first (see the home page).</p>
      )}
    </main>
  );
}
