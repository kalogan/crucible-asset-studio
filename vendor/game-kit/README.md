# vendored: game-kit

A **vendored copy** of the `game-kit` source (`github:kalogan/game-kit`), because that repo
is **private** and Vercel can't clone it as a build-time git dependency.

- Source commit: **`85e9b9c`** (`src/` only; tests omitted).
- Aliased via `tsconfig.json` `paths`: `game-kit`, `game-kit/r3f`, `game-kit/npc`,
  `game-kit/brief` → `vendor/game-kit/src/*`. Next/webpack resolves the `.js` ESM
  specifiers via the `extensionAlias` in `next.config.mjs`.
- Runtime deps (`three`, `zod`, `@react-three/*`) come from Crucible's own `package.json`.

## Re-syncing after a game-kit change

```sh
rm -rf vendor/game-kit/src
cp -r ../game-kit/src vendor/game-kit/src
find vendor/game-kit/src -name '*.test.ts' -o -name '*.test.tsx' | xargs rm -f
```

Then bump the commit above. (If game-kit is later made public or published to npm, replace
this vendored copy with a normal dependency.)
