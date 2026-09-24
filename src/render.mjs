// ─── EL RENDER DE VERDAD ───────────────────────────────────────────
// Las dos pantallas en blanco (TDZ en la v08.30e, orden de hooks en la
// v09.01a) compilaban perfecto. La unica forma de cacharlas es montar
// el componente. Aqui se monta DetailModal con un archivo real y se
// comprueba que lo que se acaba de tocar aparece de verdad.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { renderToString } from "react-dom/server";
import React from "react";

mkdirSync(".tmp", { recursive: true });
// Copia con DetailModal exportado. No se toca App.jsx.
writeFileSync("_app_export.jsx",
  readFileSync("App.jsx", "utf8") + "\nexport { DetailModal, AddModal };\nexport { default as ProcessingView } from \"./processing\";\n");

const alias = {
  "./marthaExport": "./.stub/marthaExport.js",
  "./barrettChecklist": "./.stub/barrettChecklist.js",
  "./lenders2026.json": "./.stub/lenders2026.json",
  "firebase/app": "./.stub/firebase-app.js",
  "firebase/firestore": "./.stub/firebase-firestore.js",
  "firebase/auth": "./.stub/firebase-auth.js",
};
const r = await build({
  stdin: { contents: `export * from "./_app_export.jsx";`, resolveDir: ".", loader: "jsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic",
  loader: { ".js": "jsx", ".jsx": "jsx" },
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [{ name: "alias", setup(b) {
    b.onResolve({ filter: /.*/ }, a => {
      // Los stubs solo sustituyen al importarse DESDE el codigo fuente,
      // no cuando el propio stub se resuelve a si mismo.
      if (alias[a.path] && !a.importer.includes("/.stub/"))
        return { path: new URL(alias[a.path], "file://" + process.cwd() + "/").pathname };
      return null;
    });
  }}],
  logLevel: "silent",
});
writeFileSync(".tmp/bundle.mjs", r.outputFiles[0].text);
const M = await import("./.tmp/bundle.mjs");

let ok = 0, mal = 0;
const t = (n, cond) => { if (cond) ok++; else { mal++; console.log("  ✕ " + n); } };

const perfil = { uid:"u1", name:"Jose Del Valle", role:"admin" };
const base = {
  id:"f1", borrower:"IDALAIS MARTINEZ BARBAN", loan:350000, type:"FHA",
  stage:"Under Contract", lo:"Jose Del Valle", closing:"2026-11-20",
  fileOpenedAt:"2026-09-01", stageLog:{ "Under Contract":"2026-09-01" },
  phone:"", email:"", contingencies:{},
};
const pintar = (file, props={}) => renderToString(React.createElement(M.DetailModal, {
  file, profile:perfil, allFiles:[file], lang:"es",
  L:k=>k, TXX:k=>k, onSetLang(){}, onClose(){}, onSave(){}, onStagePick:()=>true,
  onDelete(){}, onAdvance(){}, onCloseFile(){}, onReopen(){}, onPrep(){},
  onArchive(){}, onRestore(){}, onContinuePrep(){}, isClosed:false, ...props,
}));

// ─── el nombre editable ───
let h = pintar(base);
t("el modal monta sin reventar", h.length > 1000);
t("el nombre sale en el encabezado", h.includes("IDALAIS MARTINEZ BARBAN"));
t("hay un campo con el nombre dentro", h.includes('value="IDALAIS MARTINEZ BARBAN"'));
t("con su etiqueta NOMBRE DEL CLIENTE", h.includes("NOMBRE DEL CLIENTE"));
t("telefono y correo siguen ahi", h.includes("PHONE") && h.includes("EMAIL"));
t("un archivo sin registrar NO trae el aviso de Arive", !h.includes("Arive"));

// ─── las fechas del contrato en Under Contract ───
// La solapa FECHAS se monta solo si es la activa (`tab==="dates"`), no con
// display:none — por eso hay que abrirla con `abrirEn`.
const enFechas = f => pintar(f, { abrirEn:"dates" });
// El caso exacto del callejon: Under Contract con `contingencies` vacio, que
// es justo el archivo que la puerta `contract_dates` frena.
const hUC = enFechas({ ...base, contingencies:{} });
t("en Under Contract con contingencias vacias, FECHAS trae el panel",
  hUC.includes("DEL CONTRATO"));
t("y trae las dos fechas que la puerta exige",
  hUC.includes("TASACIÓN") && hUC.includes("PRÉSTAMO"));
t("con el ancla del contrato, que es de donde el motor calcula",
  hUC.includes("ESTADO") && hUC.includes("COE"));

// ─── lo de antes sigue en pie ───
t("un archivo en Full Application tambien pinta las fechas",
  enFechas({ ...base, stage:"Full Application", contingencies:{} }).includes("DEL CONTRATO"));
t("uno en Credit Pull, sin contrato todavia, NO las pinta",
  !enFechas({ ...base, stage:"Credit Pull", contingencies:{} }).includes("DEL CONTRATO"));
t("pero si ya tiene fechas capturadas, se pintan aunque este atras",
  enFechas({ ...base, stage:"Credit Pull", contingencies:{ contractAccepted:"2026-09-01" } }).includes("DEL CONTRATO"));

// ─── el aviso de Arive solo cuando toca ───
t("el bloque del CD no aparece en Under Contract",
  !hUC.includes("CLOSING DISCLOSURE"));
t("pero si aparece en CD Issued",
  enFechas({ ...base, stage:"CD Issued", contingencies:{} }).includes("CLOSING DISCLOSURE"));

// Un archivo ya registrado monta igual. El aviso de Arive no se puede ver
// aqui: solo sale cuando el nombre tecleado difiere del guardado, y en el
// primer render son el mismo. Lo que se comprueba es que no revienta.
const reg = { ...base, stage:"Initial Disclosures Sent", lenderId:"elend",
  registrations:[{ lenderId:"elend", at:"2026-09-10", by:"Tina", discSentAt:"2026-09-10" }] };
const hReg = pintar(reg);
t("un archivo registrado monta", hReg.length > 1000);
t("y tambien trae el campo del nombre", hReg.includes("NOMBRE DEL CLIENTE"));

console.log(mal ? `✕ render: ${ok} pasaron, ${mal} fallaron` : `render: ${ok}/${ok} monta y pinta`);
process.exit(mal ? 1 : 0);
