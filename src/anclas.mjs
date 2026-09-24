// ═══════════════════════════════════════════════════════════════════
//  anclas.mjs · EL BOTON NO LLEVA A NINGUN CALLEJON
//
//  `puertas.mjs` prueba que `gateFix` devuelve un destino. Esto prueba
//  que el destino EXISTE: monta la pantalla de verdad —en un DOM, con
//  los efectos corriendo— y busca el ancla que la puerta prometio.
//
//  Si mañana alguien mueve un campo de solapa, el ancla desaparece y
//  esta prueba falla. Es lo unico que impide que "Arreglar ahora" se
//  convierta en un boton que no lleva a ninguna parte.
// ═══════════════════════════════════════════════════════════════════
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id='raiz'></div></body></html>",
  { pretendToBeVisual: true });
// Node 22 ya trae `navigator` como getter, asi que se define, no se asigna.
for (const k of ["window","document","HTMLElement","Element","Node","navigator",
                 "getComputedStyle","requestAnimationFrame","cancelAnimationFrame"]) {
  const v = k === "window" ? dom.window : dom.window[k];
  try { globalThis[k] = v; }
  catch { Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); }
}
// jsdom no implementa el desplazamiento suave.
dom.window.Element.prototype.scrollIntoView = function(){};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
// Se empaqueta sola. `App.jsx` no exporta DetailModal —ni tiene por que—,
// asi que se trabaja sobre una copia con los exports añadidos al final.
// `App.jsx` no se toca.
const M = await (async () => {
  const { build } = await import("esbuild");
  const { readFileSync, writeFileSync, unlinkSync } = await import("fs");
  writeFileSync("_export_prueba.jsx", readFileSync("App.jsx", "utf8")
    + '\nexport { DetailModal, AddModal };'
    + '\nexport { default as ProcessingView } from "./processing";\n');
  const alias = { "./marthaExport":"./.stub/marthaExport.js",
    "./barrettChecklist":"./.stub/barrettChecklist.js",
    "./lenders2026.json":"./.stub/lenders2026.json",
    "firebase/app":"./.stub/firebase-app.js", "firebase/firestore":"./.stub/firebase-firestore.js",
    "firebase/auth":"./.stub/firebase-auth.js",
  };
  const r = await build({
    stdin:{ contents:'export * from "./_export_prueba.jsx";', resolveDir:".", loader:"jsx" },
    bundle:true, write:false, format:"esm", jsx:"automatic",
    loader:{ ".js":"jsx", ".jsx":"jsx" },
    external:["react","react-dom","react/jsx-runtime"],
    plugins:[{ name:"alias", setup(b){ b.onResolve({filter:/.*/}, a => (
      alias[a.path] && !a.importer.includes("/.stub/")
        ? { path: process.cwd() + "/" + alias[a.path].slice(2) } : null)); }}],
    logLevel:"silent",
  });
  writeFileSync("_bundle_prueba.mjs", r.outputFiles[0].text);
  const mod = await import("./_bundle_prueba.mjs");
  try { unlinkSync("_export_prueba.jsx"); } catch { /* da igual */ }
  return mod;
})();
const C = await import("./_core.mjs");

let ok = 0, mal = 0;
const t = (n, cond) => { if (cond) ok++; else { mal++; console.log("  ✕ " + n); } };

// Un aviso de React es un fallo, no ruido. Asi salio la `key` que faltaba en
// los hitos: sin ella React reutiliza el boton de al lado entre renders y
// deja marcado un hito que no lo esta.
const avisos = [];
const errOriginal = console.error;
console.error = (...a) => { avisos.push(String(a[0])); };

const JOSE  = { uid:"u1", role:"admin",     name:"Jose Del Valle" };
const ANA   = { uid:"u2", role:"lo",        name:"Ana M Plasencia" };
const TINA  = { uid:"u3", role:"assistant", name:"Tina" };

const base = (extra={}) => ({ id:"f1", borrower:"Cliente Prueba", lo:"Ana M Plasencia",
  type:"FHA", loan:400000, closing:"2026-11-20", fileOpenedAt:"2026-08-01",
  stageLog:{}, contingencies:{}, processor:"martha", ...extra });

// Monta DetailModal con un destino ya puesto y deja correr los efectos.
function montarDetalle(file, perfil, irA) {
  const cont = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(cont);
  const raiz = createRoot(cont);
  act(() => { raiz.render(React.createElement(M.DetailModal, {
    file, profile:perfil, allFiles:[file], lang:"es", L:k=>k, onSetLang(){},
    abrirEn:irA?.tab||null, irA:irA||null,
    onClose(){}, onSave(){}, onStagePick:()=>true, onDelete(){}, onAdvance(){},
    onCloseFile(){}, onReopen(){}, onPrep(){}, onArchive(){}, onRestore(){},
    onContinuePrep(){}, isClosed:false,
  })); });
  return { cont, raiz };
}

// ─── cada destino del detalle tiene su ancla en pantalla ───────────
// El caso, el archivo que lo produce, y quien choca.
const casos = [
  ["contract_dates", base({ stage:"Under Contract" }),                         JOSE],
  ["gate1",          base({ stage:"Under Contract" }),                         ANA ],
  ["registered",     base({ stage:"Full Application" }),                       JOSE], // sin lender → LENDER
  ["registered",     base({ stage:"Full Application", lenderId:"elend" }),     JOSE], // con lender → PRESTAMO
  ["cd_sent",        base({ stage:"CD Issued", lenderId:"elend" }),            JOSE],
  ["cd_fees",        base({ stage:"CD Issued", lenderId:"elend" }),            ANA ],
];

for (const [regla, file, quien] of casos) {
  const fix = C.gateFix(regla, file, quien);
  if (!fix || !fix.puede || fix.vista !== "detail") {
    t(`${regla}/${quien.role}: el caso de prueba no es del detalle`, false); continue;
  }
  const { cont, raiz } = montarDetalle(file, quien, { n:Date.now(), ...fix });
  const el = cont.querySelector("#" + fix.ancla);
  t(`${regla} · ${quien.role} → ${fix.ancla} existe en pantalla`, !!el);
  // Y tiene que haber algo que tocar dentro, no solo un marco.
  if (el) {
    const campo = el.matches("input,select,button,textarea")
      ? el : el.querySelector("input,select,button,textarea");
    t(`${regla} · y dentro hay un campo o boton de verdad`, !!campo && !campo.disabled);
  }
  act(() => raiz.unmount());
}

// ─── el efecto cambia de solapa con el modal YA abierto ────────────
// Esto es lo que antes no pasaba: `abrirEn` solo se leia al montar.
{
  const file = base({ stage:"CD Issued", lenderId:"elend" });
  const cont = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(cont);
  const raiz = createRoot(cont);
  const pintar = irA => act(() => { raiz.render(React.createElement(M.DetailModal, {
    file, profile:JOSE, allFiles:[file], lang:"es", L:k=>k, onSetLang(){},
    abrirEn:null, irA, onClose(){}, onSave(){}, onStagePick:()=>true, onDelete(){},
    onAdvance(){}, onCloseFile(){}, onReopen(){}, onPrep(){}, onArchive(){},
    onRestore(){}, onContinuePrep(){}, isClosed:false,
  })); });

  pintar(null);
  t("abre en EXPEDIENTE, que es la solapa por defecto",
    !cont.querySelector("#fix-cd-sent"));
  const fix = C.gateFix("cd_sent", file, JOSE);
  pintar({ n:1, ...fix });
  t("el destino mueve la solapa con el modal ya abierto",
    !!cont.querySelector("#fix-cd-sent"));
  // Y pedir OTRO destino de la misma solapa no lo rompe.
  pintar({ n:2, ...C.gateFix("cd_fees", file, JOSE) });
  t("y un segundo salto sigue funcionando", !!cont.querySelector("#fix-cd-fees"));
  act(() => raiz.unmount());
}

// ─── los destinos de PROCESAMIENTO ─────────────────────────────────
{
  const file = base({ stage:"Appraisal Ordered", lenderId:"elend", processor:"martha",
    registrations:[{ lenderId:"elend", at:"2026-09-01", discSentAt:"2026-09-01",
                     discEsignedAt:"2026-09-03" }] });
  const cont = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(cont);
  const raiz = createRoot(cont);
  const pintar = irA => act(() => { raiz.render(React.createElement(M.ProcessingView, {
    files:[file], profile:JOSE, lang:"es", onSetLang(){}, onSaveFile(){}, onOpenFull(){}, irA,
  })); });

  for (const [regla, quien] of [["appr_req",JOSE],["disc_sent",JOSE],["gate1",TINA]]) {
    const fix = C.gateFix(regla, file, quien);
    t(`${regla}/${quien.role}: el destino es PROCESAMIENTO`, fix?.vista === "processing");
    if (fix?.vista !== "processing") continue;
    pintar({ n:Date.now()+Math.random(), id:file.id, ...fix });
    const el = cont.querySelector("#" + fix.ancla);
    t(`${regla} → ${fix.ancla} existe en PROCESAMIENTO`, !!el);
    if (el) {
      const campo = el.matches("input,select,button,textarea")
        ? el : el.querySelector("input,select,button,textarea");
      t(`${regla} · y el campo esta vivo, no apagado`, !!campo && !campo.disabled);
    }
  }
  act(() => raiz.unmount());
}

// ─── la helper: destello y foco ────────────────────────────────────
{
  const { irAlAncla } = await import("./ui.js");
  const d = dom.window.document;
  const caja = d.createElement("div"); caja.id = "prueba-ancla";
  const inp = d.createElement("input"); caja.appendChild(inp);
  d.body.appendChild(caja);
  irAlAncla("prueba-ancla");
  t("enciende el campo al llegar", caja.classList.contains("fix-flash"));
  await new Promise(r => setTimeout(r, 400));
  t("y le pone el cursor encima", d.activeElement === inp);
  await new Promise(r => setTimeout(r, 1800));
  t("el destello se apaga solo a los dos segundos", !caja.classList.contains("fix-flash"));
  t("un ancla que no existe no revienta ni cuelga",
    (() => { try { irAlAncla("no-existe-12345"); return true; } catch { return false; } })());
  t("y un ancla vacia tampoco",
    (() => { try { irAlAncla(null); irAlAncla(""); return true; } catch { return false; } })());
}

console.error = errOriginal;
const graves = avisos.filter(a => !/not wrapped in act|ReactDOMTestUtils/.test(a)
  && !/^\(node:\d+\)/.test(a));  // avisos del propio Node, no de React
t("React no se quejo de nada al montar: " + (graves[0]?.slice(0, 90) || "sí"),
  graves.length === 0);

console.log(mal ? `✕ anclas: ${ok} pasaron, ${mal} fallaron`
                : `anclas: ${ok}/${ok} ningún botón lleva a un callejón`);
process.exit(mal ? 1 : 0);
