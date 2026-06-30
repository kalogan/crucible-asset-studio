"use client";

import { useState, useTransition } from "react";
import { talkToNpcAction } from "@/app/actions/npc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Turn = { who: "you" | "npc"; text: string; source?: "llm" | "scripted" };

export function NpcChat({
  npc,
}: {
  npc: { name: string; persona: { role: string; voice: string } };
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    const line = input.trim();
    if (!line || pending) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { who: "you", text: line }]);
    startTransition(async () => {
      const res = await talkToNpcAction(line);
      if (res.ok && res.text) {
        setTurns((t) => [...t, { who: "npc", text: res.text as string, source: res.source }]);
      } else {
        setError(res.error ?? "No reply.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold">{npc.name}</p>
        <p className="text-xs text-muted-foreground">{npc.persona.role}</p>
      </div>

      <div className="flex min-h-64 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
        {turns.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Say hello to {npc.name}. She reasons over your words and remembers this conversation —
            mention something now, ask her about it later.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 ${t.who === "you" ? "items-end" : "items-start"}`}
          >
            <span className="text-xs text-muted-foreground">
              {t.who === "you" ? "You" : npc.name}
              {t.who === "npc" && t.source === "scripted" && " · scripted"}
              {t.who === "npc" && t.source === "llm" && " · ✦ AI"}
            </span>
            <span
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                t.who === "you"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {t.text}
            </span>
          </div>
        ))}
        {pending && <span className="text-xs text-muted-foreground">{npc.name} is thinking…</span>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Say something to ${npc.name}…`}
          autoComplete="off"
        />
        <Button type="submit" disabled={pending || input.trim().length === 0}>
          Send
        </Button>
      </form>
    </div>
  );
}
