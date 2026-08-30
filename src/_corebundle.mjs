// Empaqueta el motor una vez para que e2e y sondeo lo importen sin
// pelear con el JSON de lenders ni con las extensiones.
import * as esbuild from "esbuild";
import { writeFileSync } from "fs";
const r = await esbuild.build({ entryPoints:["pipelineCore.js"], bundle:true, write:false,
  format:"esm", loader:{".js":"jsx",".json":"json"}, logLevel:"silent" });
writeFileSync("./_core.mjs", r.outputFiles[0].text);
export default true;
