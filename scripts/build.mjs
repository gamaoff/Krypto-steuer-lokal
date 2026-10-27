// Production build: one JS file, one CSS file, one HTML file in dist/.
// No CDN, no fonts, no analytics. The sample CSV is bundled as text.
import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

export const options = {
  entryPoints: { app: "src/main.tsx" },
  bundle: true,
  format: "esm",
  target: ["es2022"],
  outdir: "dist",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  loader: { ".csv": "text" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });
  await build(options);
  await copyFile("index.html", "dist/index.html");
  console.log("Built dist/");
}
