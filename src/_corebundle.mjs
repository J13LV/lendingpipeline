// Empaqueta el motor para poder probarlo en Node.
import { build } from "esbuild";
build({
  entryPoints: ["pipelineCore.js"], bundle: true, outfile: "_core.mjs",
  format: "esm", platform: "node", logLevel: "silent",
}).catch(e => { console.error(String(e).slice(0,400)); process.exit(1); });
