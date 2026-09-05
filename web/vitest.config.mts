import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws when imported outside an RSC bundler; tests hit server modules directly.
  "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
};

/**
 * Two projects: pure logic and server code run under node; anything that
 * renders React runs under jsdom with Testing Library matchers.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
});
