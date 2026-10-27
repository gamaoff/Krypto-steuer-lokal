// Development: rebuilds on change and serves dist/ on http://localhost:5173.
// Reload the page by hand after a change: live reload would need a network
// connection that the page's Content Security Policy forbids, on purpose.
import { context } from "esbuild";
import { copyFile, mkdir, watch } from "node:fs/promises";
import { options } from "./build.mjs";

await mkdir("dist", { recursive: true });
await copyFile("index.html", "dist/index.html");
const ctx = await context({ ...options, minify: false, sourcemap: "inline", define: { "process.env.NODE_ENV": '"development"' } });
await ctx.watch();
const { port } = await ctx.serve({ servedir: "dist", port: 5173, host: "127.0.0.1" });
console.log(`Serving on http://localhost:${port}`);

for await (const event of watch("index.html")) {
  if (event.eventType === "change") await copyFile("index.html", "dist/index.html");
}
