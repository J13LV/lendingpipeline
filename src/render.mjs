// ═══════════════════════════════════════════════════════════════════
//  render.mjs · LA VERIFICACIÓN QUE FALTABA
//
//  Las otras seis leen el código quieto. Ninguna lo ejecuta, y por eso
//  dos pantallas blancas llegaron a producción en una semana:
//
//    · v2026.08.30e — `langUid` usado en una lista de dependencias
//      antes de su declaración. ReferenceError en zona muerta temporal.
//      Compiló limpio. ESLint no-undef no lo vio: la variable existía.
//
//    · v2026.09.01a — un useState después de tres `return` tempranos.
//      React tumbó el árbol entero.
//
//  Esto monta la aplicación de verdad con React fuera del navegador. Si
//  el componente lanza al renderizar, aquí revienta — en un segundo, no
//  en producción.
//
//  Lo que SÍ atrapa: errores al ejecutar el cuerpo del componente —
//  zona muerta temporal, funciones que no existen, destructuring roto,
//  JSX mal formado, `.map` sobre undefined.
//  Lo que NO atrapa: lo que solo pasa al hacer clic o al re-renderizar.
//  Para eso está `rules-of-hooks` en ESLint.
// ═══════════════════════════════════════════════════════════════════
import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { renderToString } from "react-dom/server";
import React from "react";

const FALSO = {
  // Firebase entero, en blanco. No queremos red ni credenciales: solo
  // queremos que el componente se ejecute.
  "firebase/app": "export const initializeApp=()=>({});",
  "firebase/firestore": `export const getFirestore=()=>({});export const doc=()=>({});
    export const setDoc=async()=>{};export const onSnapshot=()=>()=>{};
    export const collection=()=>({});export const writeBatch=()=>({set(){},commit:async()=>{}});
    export const getDocs=async()=>({docs:[],forEach(){}});export const deleteDoc=async()=>{};`,
  "firebase/auth": `export const getAuth=()=>({currentUser:null});
    export const signInWithEmailAndPassword=async()=>({});export const signOut=async()=>{};
    export const onAuthStateChanged=(a,cb)=>{cb(null);return()=>{};};
    export const sendPasswordResetEmail=async()=>{};`,
  "./lenders2026.json": "export default {year:2026,productCapabilities:{},lenders:[]};",
};

const parches = {
  name: "parches",
  setup(b) {
    b.onResolve({ filter: /^(firebase\/|\.\/lenders2026\.json)/ }, a => {
      const clave = a.path.startsWith("firebase") ? a.path : "./lenders2026.json";
      return FALSO[clave] ? { path: clave, namespace: "falso" } : null;
    });
    b.onLoad({ filter: /.*/, namespace: "falso" }, a => ({ contents: FALSO[a.path], loader: "js" }));
  },
};

let salida;
try {
  const r = await esbuild.build({
    entryPoints: ["App.jsx"], bundle: true, write: false, format: "esm",
    jsx: "automatic", loader: { ".js": "jsx" }, plugins: [parches],
    external: ["react", "react/jsx-runtime", "react-dom"], logLevel: "silent",
  });
  salida = r.outputFiles[0].text;
} catch (e) {
  console.log("✕ no compila:", String(e.message).split("\n")[0]);
  process.exit(1);
}

// El bundle se escribe JUNTO a node_modules para que `react` resuelva.
writeFileSync("./_render_bundle.mjs", salida);
const mod = await import("./_render_bundle.mjs");
const App = mod.default;

if (typeof App !== "function") {
  console.log("✕ App.jsx no exporta un componente por defecto");
  process.exit(1);
}

// El navegador que React espera. Mínimo, pero suficiente para que el
// componente corra: localStorage, matchMedia y un document de mentira.
const almacen = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: k => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)), removeItem: k => almacen.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.matchMedia = q => ({ matches: /max-width/.test(q) === false, media: q,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.document = { querySelectorAll: () => [], getElementById: () => null,
  addEventListener() {}, removeEventListener() {}, documentElement: { style: { setProperty() {} } } };
// `navigator` en Node 22 es de solo lectura: se define, no se asigna.
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node", language: "es" }, configurable: true });
globalThis.location = { href: "https://lendingpipeline.vercel.app/", reload() {} };
globalThis.fetch = async () => ({ ok: true, text: async () => "", json: async () => ({}) });

let html = "";
try {
  html = renderToString(React.createElement(App));
} catch (e) {
  console.log("✕ LA APLICACIÓN NO PINTA — pantalla blanca");
  console.log("  " + String(e.message).split("\n")[0]);
  if (/before initialization/i.test(e.message))
    console.log("  → una variable se usa antes de declararse (zona muerta temporal)");
  if (/hook/i.test(e.message))
    console.log("  → un hook corre en un orden distinto entre renders");
  process.exit(1);
}

const largo = html.replace(/<[^>]+>/g, "").trim().length;
if (largo < 20) {
  console.log("✕ pinta vacío — el árbol se montó pero no hay contenido");
  process.exit(1);
}

console.log("7/7 render: OK — la aplicación monta y pinta (" + largo + " caracteres de texto)");
