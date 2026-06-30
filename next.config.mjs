import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // game-kit is VENDORED under vendor/game-kit (private repo — can't be cloned on
  // Vercel), aliased via tsconfig `paths`. Its ESM TS uses explicit ".js" specifiers;
  // map them to ".ts" source so webpack resolves them like tsc's bundler resolution.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  // Pin the tracing root to THIS project — an ancestor pnpm workspace lives at
  // C:/Users/kevin, and without this Next infers that as the root.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  experimental: {
    // Screenshot/hero uploads run through a Server Action (multipart). The default
    // body limit is 1MB, which a full-res game screenshot blows past — raise it so
    // uploads don't throw a server-side exception.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
