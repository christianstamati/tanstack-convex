import { defineConfig } from "cf/config";

// The Worker's configuration, read by the Cloudflare Vite plugin. The build writes it to
// dist/server/wrangler.json, which `wrangler deploy` and `wrangler preview` use.
export default defineConfig({
  worker: {
    name: "tanstack-convex-starter",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    // Answers /health and the /auth routes, and passes the session to TanStack Start's server entry.
    entrypoint: "src/server.ts",
    // Production is served at tanstack-convex-starter.<subdomain>.workers.dev; branches get Preview URLs.
    workersDev: true,
    previewUrls: true,
    observability: { enabled: true },
  },
});
