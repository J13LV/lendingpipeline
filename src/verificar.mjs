// ═══════════════════════════════════════════════════════════════════
//  verificar.mjs · LAS SIETE, DE UN TIRÓN
//
//  Se corre antes de cada despliegue:  node verificar.mjs
//  Si algo falla, el proceso termina en 1 y dice cuál.
// ═══════════════════════════════════════════════════════════════════
import { execSync } from "child_process";

const pasos = [
  ["1 · ESLint no-undef · no-shadow · no-use-before-define · rules-of-hooks",
   "npx eslint App.jsx tour.jsx ui.js helpContent.js"],
  ["2 · ESLint sobre el motor (sin no-use-before-define)",
   "npx eslint pipelineCore.js processing.jsx --rule '{\"no-use-before-define\":\"off\"}'"],
  ["3 · auditoría bilingüe del JSX", "node i18n_jsx.mjs"],
  ["4 · compila con esbuild", "node build.mjs"],
  ["5 · la aplicación monta y pinta", "node render.mjs"],
  ["6 · un préstamo de punta a punta", "node e2e.mjs"],
  ["7 · los bordes", "node sondeo.mjs"],
];

let fallos = 0;
for (const [nombre, cmd] of pasos) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const ultima = out.trim().split("\n").filter(Boolean).pop() || "OK";
    console.log("  ✓ " + nombre + "\n      " + ultima);
  } catch (e) {
    fallos++;
    const salida = ((e.stdout || "") + (e.stderr || "")).trim().split("\n").slice(-6).join("\n      ");
    console.log("  ✕ " + nombre + "\n      " + salida);
  }
}
console.log(fallos
  ? `\n✕ ${fallos} de ${pasos.length} fallaron — NO desplegar`
  : `\n${pasos.length}/${pasos.length} · listo para desplegar`);
process.exit(fallos ? 1 : 0);
