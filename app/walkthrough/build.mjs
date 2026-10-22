// Builds the static public walkthrough into walkthrough/dist (deployed to Vercel as plain static files).
// usage (from app/): node walkthrough/build.mjs [path-to-node_modules]
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const modules = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "node_modules");
const out = resolve(root, "walkthrough/dist");
const { build } = await import(pathToFileURL(resolve(modules, "esbuild/lib/main.js")).href);
mkdirSync(out, { recursive: true });
const to = (file) => () => ({ path: resolve(root, file) });

await build({
  entryPoints: ["walkthrough/entry.tsx"], bundle: true, minify: true, format: "esm", platform: "browser", jsx: "automatic",
  outfile: resolve(out, "bundle.js"), nodePaths: [modules], tsconfig: resolve(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "walkthrough-doubles", setup(b) {
    b.onResolve({ filter: /(^|\/)Session$/ }, to("walkthrough/session.ts"));
    b.onResolve({ filter: /^next\/(link|navigation)$/ }, to("tests/ui/navigation.tsx"));
    b.onResolve({ filter: /^@\/(tide-integration|lib\/tide)\/relationship$/ }, to("walkthrough/relationship.ts"));
    b.onResolve({ filter: /^@tidecloak\/nextjs$/ }, to("walkthrough/tidecloak.ts"));
    b.onResolve({ filter: /^@tideorg\/js$/ }, to("tests/ui/tideorg.ts"));
  } }],
});
copyFileSync(resolve(root, "src/app/globals.css"), resolve(out, "style.css"));
writeFileSync(resolve(out, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Heirloom | interactive walkthrough</title><meta name="description" content="Heirloom: decide today who receives what, when you no longer can. Interactive walkthrough with simulated Tide responses.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700&family=Noto+Sans:wght@400;500;600&family=Noto+Sans+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>`);
writeFileSync(resolve(out, "vercel.json"), JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/index.html" }] }, null, 2));
console.log("built", out);
