"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_WORLD, type WorldDescriptor } from "game-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WorldView = dynamic(() => import("./WorldView").then((m) => m.WorldView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading world…
    </div>
  ),
});

const VARIANTS_KEY = "crucible.biome.variants";
const KNOWN_PROPS = ["conifer-tree", "crystal", "snow-drift", "rock"] as const;

type Terrain = WorldDescriptor["terrain"];
type Palette = WorldDescriptor["palette"];
type Environment = WorldDescriptor["environment"];

const TERRAIN_KNOBS: { key: keyof Terrain; label: string; min: number; max: number; step: number }[] = [
  { key: "maxHeight", label: "Max height", min: 0, max: 30, step: 0.5 },
  { key: "roughness", label: "Roughness", min: 0, max: 1, step: 0.01 },
  { key: "frequency", label: "Frequency", min: 0.005, max: 0.3, step: 0.005 },
  { key: "octaves", label: "Octaves", min: 1, max: 8, step: 1 },
  { key: "zoneSize", label: "Zone size", min: 20, max: 200, step: 5 },
  { key: "meshSegments", label: "Mesh segments", min: 8, max: 120, step: 4 },
  { key: "facetNoise", label: "Facet noise", min: 0, max: 1, step: 0.01 },
];

const PALETTE_KEYS: (keyof Palette)[] = ["low", "mid", "high", "rock", "slope", "peak"];

function deepClone(d: WorldDescriptor): WorldDescriptor {
  return JSON.parse(JSON.stringify(d)) as WorldDescriptor;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="capitalize">{label}</span>
      <input
        type="color"
        aria-label={`${label} color`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function BiomeEditor() {
  const [descriptor, setDescriptor] = useState<WorldDescriptor>(() => deepClone(DEFAULT_WORLD));
  const [variantNames, setVariantNames] = useState<string[]>([]);
  const [variantName, setVariantName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VARIANTS_KEY);
      if (raw) setVariantNames(Object.keys(JSON.parse(raw) as Record<string, unknown>));
    } catch {
      /* ignore */
    }
  }, []);

  const patchTerrain = useCallback((patch: Partial<Terrain>) => {
    setDescriptor((d) => ({ ...d, terrain: { ...d.terrain, ...patch } }));
  }, []);
  const patchPalette = useCallback((patch: Partial<Palette>) => {
    setDescriptor((d) => ({ ...d, palette: { ...d.palette, ...patch } }));
  }, []);
  const patchEnv = useCallback((patch: Partial<Environment>) => {
    setDescriptor((d) => ({ ...d, environment: { ...d.environment, ...patch } }));
  }, []);

  const reroll = useCallback(() => {
    patchTerrain({ seed: Math.floor(Math.random() * 1_000_000) });
  }, [patchTerrain]);

  const setPropDensity = useCallback((i: number, density: number) => {
    setDescriptor((d) => {
      const props = d.props.map((p, idx) => (idx === i ? { ...p, density } : p));
      return { ...d, props };
    });
  }, []);
  const setPropId = useCallback((i: number, id: string) => {
    setDescriptor((d) => {
      const props = d.props.map((p, idx) => (idx === i ? { ...p, id } : p));
      return { ...d, props };
    });
  }, []);
  const addProp = useCallback(() => {
    setDescriptor((d) => ({ ...d, props: [...d.props, { id: "rock", density: 10 }] }));
  }, []);
  const removeProp = useCallback((i: number) => {
    setDescriptor((d) => ({ ...d, props: d.props.filter((_, idx) => idx !== i) }));
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(descriptor, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `biome-${descriptor.terrain.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [descriptor]);

  const importJson = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as WorldDescriptor;
      if (parsed?.terrain && parsed?.palette && parsed?.environment) setDescriptor(parsed);
    } catch {
      /* ignore malformed */
    }
  }, []);

  const saveVariant = useCallback(() => {
    const name = variantName.trim();
    if (!name) return;
    try {
      const raw = localStorage.getItem(VARIANTS_KEY);
      const all = (raw ? JSON.parse(raw) : {}) as Record<string, WorldDescriptor>;
      all[name] = descriptor;
      localStorage.setItem(VARIANTS_KEY, JSON.stringify(all));
      setVariantNames(Object.keys(all));
      setVariantName("");
    } catch {
      /* ignore */
    }
  }, [descriptor, variantName]);

  const loadVariant = useCallback((name: string) => {
    try {
      const raw = localStorage.getItem(VARIANTS_KEY);
      const all = (raw ? JSON.parse(raw) : {}) as Record<string, WorldDescriptor>;
      if (all[name]) setDescriptor(all[name]);
    } catch {
      /* ignore */
    }
  }, []);

  const view = useMemo(() => <WorldView descriptor={descriptor} />, [descriptor]);

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:h-[78vh] lg:flex-row">
      {/* Knobs panel */}
      <aside className="flex w-full flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-4 lg:w-80 lg:shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Biome</span>
          <Button type="button" variant="outline" size="sm" onClick={reroll}>
            Reroll seed
          </Button>
        </div>

        <Section title="Terrain">
          {TERRAIN_KNOBS.map((k) => (
            <SliderRow
              key={k.key}
              label={k.label}
              value={descriptor.terrain[k.key]}
              min={k.min}
              max={k.max}
              step={k.step}
              onChange={(v) => patchTerrain({ [k.key]: v } as Partial<Terrain>)}
            />
          ))}
        </Section>

        <Section title={`Prop fields (${descriptor.props.length})`}>
          {descriptor.props.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={KNOWN_PROPS.includes(p.id as (typeof KNOWN_PROPS)[number]) ? p.id : "rock"}
                onChange={(e) => setPropId(i, e.target.value)}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              >
                {KNOWN_PROPS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={p.density}
                onChange={(e) => setPropDensity(i, Math.max(0, Number(e.target.value)))}
                className="w-16 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeProp(i)}
                aria-label="Remove prop field"
                className="text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addProp}>
            + Prop field
          </Button>
        </Section>

        <Section title="Terrain palette">
          {PALETTE_KEYS.map((key) => (
            <ColorRow
              key={key}
              label={key}
              value={descriptor.palette[key]}
              onChange={(v) => patchPalette({ [key]: v } as Partial<Palette>)}
            />
          ))}
        </Section>

        <Section title="Environment FX">
          <ColorRow label="Sky" value={descriptor.environment.skyColor} onChange={(v) => patchEnv({ skyColor: v })} />
          <ColorRow label="Horizon" value={descriptor.environment.horizonColor} onChange={(v) => patchEnv({ horizonColor: v })} />
          <ColorRow label="Fog" value={descriptor.environment.fogColor} onChange={(v) => patchEnv({ fogColor: v })} />
          <ColorRow label="Ambient" value={descriptor.environment.ambientTint} onChange={(v) => patchEnv({ ambientTint: v })} />
          <SliderRow
            label="Fog density"
            value={descriptor.environment.fogDensity}
            min={0}
            max={0.06}
            step={0.002}
            onChange={(v) => patchEnv({ fogDensity: v })}
          />
        </Section>

        <Section title="Variants (localStorage)">
          <div className="flex gap-2">
            <Input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="variant name…"
              className="h-8 text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={saveVariant}>
              Save
            </Button>
          </div>
          {variantNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {variantNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => loadVariant(n)}
                  className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportJson}>
              ↓ Export JSON
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              ↑ Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </div>
        </Section>
      </aside>

      {/* Live world */}
      <div className="min-h-[50vh] flex-1 overflow-hidden rounded-lg border border-border bg-black/40">
        {view}
      </div>
    </div>
  );
}
