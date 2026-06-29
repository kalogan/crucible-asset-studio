export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          Crucible
        </p>
        <h1 className="text-3xl font-semibold text-zinc-50 sm:text-4xl">
          Multi-game asset studio
        </h1>
      </header>
      <p className="text-base leading-relaxed text-zinc-300">
        The canon is the source of truth. Each game gets its own style guide and
        trained LoRA; generation, finishing (Kiln), and CDN publish all read it.
      </p>
      <p className="text-sm text-zinc-400">
        Phase 1 — platform spine. Project switcher, schema, and the generation
        pipeline land here.
      </p>
    </main>
  );
}
