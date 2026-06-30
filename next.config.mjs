import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
