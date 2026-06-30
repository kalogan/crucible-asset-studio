"use server";

import { cookies } from "next/headers";
import { getDemoBrain } from "@/lib/npc/demo";

const CID_COOKIE = "crucible.npc.cid";

/** Stable per-browser character id (so the NPC's memory is yours across the session). */
async function characterId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CID_COOKIE)?.value;
  if (existing) return existing;
  const id = `c_${Math.random().toString(36).slice(2, 12)}`;
  store.set(CID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export interface NpcReply {
  ok: boolean;
  text?: string;
  source?: "llm" | "scripted";
  end?: boolean;
  mood?: string;
  error?: string;
}

/** Send a free-text line to the demo NPC; returns its reply (with memory + recall applied). */
export async function talkToNpcAction(text: string): Promise<NpcReply> {
  const line = text.trim();
  if (!line) return { ok: false, error: "Say something to Mira." };
  try {
    const cid = await characterId();
    const res = await getDemoBrain().say({
      npcId: "mira",
      playerKey: cid,
      characterId: cid,
      text: line,
    });
    if (!res) return { ok: false, error: "Mira has nothing to say." };
    return {
      ok: true,
      text: res.text,
      source: res.source,
      end: res.end,
      ...(res.mood ? { mood: res.mood } : {}),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to reach Mira." };
  }
}
