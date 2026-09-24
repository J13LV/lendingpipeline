// ═══════════════════════════════════════════════════════════════════
//  coherencia.mjs · QUE LAS DOS MITADES DIGAN LO MISMO
//
//  El sistema tiene catalogos en dos sitios: el motor (`pipelineCore`)
//  y la pantalla (`App`, `processing`). Cuando uno se edita y el otro
//  no, nada se rompe — se descuadra en silencio, que es peor. Esto
//  cruza los dos y falla cuando se separan.
//
//  No prueba comportamiento; prueba que las listas concuerden.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from "fs";
const C = await import("./_core.mjs");
const app  = readFileSync("App.jsx", "utf8");
const proc = readFileSync("processing.jsx", "utf8");
const core = readFileSync("pipelineCore.js", "utf8");

let ok = 0, mal = 0, avisos = 0;
const t = (n, cond) => { if (cond) ok++; else { mal++; console.log("  ✕ " + n); } };
const w = (n, cond) => { if (!cond) { avisos++; console.log("  ⚠ " + n); } };

// Saca un array de cadenas de un bloque `const NOMBRE = [ ... ];`
const lista = (src, nombre) => {
  const i = src.indexOf("const " + nombre);
  if (i < 0) return null;
  const a = src.indexOf("[", i), b = src.indexOf("];", a);
  return [...src.slice(a, b).matchAll(/"([^"]+)"/g)].map(m => m[1]);
};

// ─── 1 · LAS ETAPAS: dos listas, dos archivos ──────────────────────
// El motor tiene `ALL_STAGE_ORDER` (privada) y la pantalla arma
// `ALL_STAGES` desde `PHASES`. Nada las ata.
const etapasMotor = lista(core, "ALL_STAGE_ORDER");
const bloquePhases = app.slice(app.indexOf("const PHASES = ["), app.indexOf("const ALL_STAGES"));
const etapasApp = [...bloquePhases.matchAll(/stages:\s*\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));

t("el motor declara sus etapas", Array.isArray(etapasMotor) && etapasMotor.length > 20);
t("la pantalla declara las suyas", etapasApp.length > 20);
const soloMotor = etapasMotor.filter(s => !etapasApp.includes(s));
const soloApp   = etapasApp.filter(s => !etapasMotor.includes(s));
t("ninguna etapa existe solo en el motor: " + (soloMotor.join(", ") || "sí"), soloMotor.length === 0);
// El orden importa mas que la presencia: de el cuelgan las puertas,
// `canRegister`, `paso()` del relleno y el boton ADVANCE.
t("lo que el motor conoce va en el mismo orden que la pantalla",
  JSON.stringify(etapasMotor) === JSON.stringify(etapasApp.slice(0, etapasMotor.length)));
// Una etapa que la pantalla ofrece y el motor no conoce da `indexOf` = -1,
// y TODO lo que cuelga del indice se apaga en silencio: sin relleno, sin
// ADVANCE, y `stampRegistration` la arrastraria hacia atras.
t("la pantalla no ofrece etapas que el motor desconozca: " + (soloApp.join(", ") || "sí"),
  soloApp.length === 0);
const dupE = etapasMotor.filter((s,i) => etapasMotor.indexOf(s) !== i);
t("sin etapas repetidas: " + (dupE.join(", ") || "sí"), dupE.length === 0);
// Cada etapa en UNA sola fase, o el color y el filtro se pelean.
const fases = [...bloquePhases.matchAll(/stages:\s*\[([^\]]*)\]/g)].length;
t("las siete fases", fases === 7);

const esEtapa = s => etapasMotor.includes(s);

// ─── 2 · QUIEN ES DUEÑO: tres sitios lo dicen ──────────────────────
// `STAGE_OWNERS` (relojes), `backfillGaps` (huecos) y `gateFix` (puertas).
// Si discrepan, la misma tarea sale con dos dueños distintos.
const conReloj  = Object.keys(C.STAGE_DAYS);
const conDueño  = Object.keys(C.STAGE_OWNERS);
const sinDueño  = conReloj.filter(s => !C.STAGE_OWNERS[s] && !C.FIXED_CLOCKS?.[s]);
const sinReloj  = conDueño.filter(s => !C.STAGE_DAYS[s]);
t("toda etapa con reloj tiene dueño: " + (sinDueño.join(", ") || "sí"), sinDueño.length === 0);
w("etapas con dueño y sin reloj (deuda conocida: son dos mapas separados): "
  + (sinReloj.join(", ") || "ninguna"), sinReloj.length === 0);
const dueñoRaro = conDueño.filter(s => !esEtapa(s));
t("ningún dueño apunta a una etapa que no existe: " + (dueñoRaro.join(", ") || "sí"),
  dueñoRaro.length === 0);
const relojRaro = conReloj.filter(s => !esEtapa(s));
t("ningún reloj apunta a una etapa que no existe: " + (relojRaro.join(", ") || "sí"),
  relojRaro.length === 0);

// ─── 3 · LAS PUERTAS ───────────────────────────────────────────────
const etapasPuerta = Object.keys(C.STAGE_GATES);
t("toda puerta cuelga de una etapa real: " + (etapasPuerta.filter(s=>!esEtapa(s)).join(", ")||"sí"),
  etapasPuerta.every(esEtapa));
const reglas = Object.values(C.STAGE_GATES).flat();
const ids = reglas.map(r => r.id);
t("sin ids repetidos entre puertas: " + (ids.filter((x,i)=>ids.indexOf(x)!==i).join(", ")||"sí"),
  new Set(ids).size === ids.length);
const mudas = reglas.filter(r => !r.es || !r.en || !r.es_why || !r.en_why).map(r=>r.id);
t("toda regla explica qué y por qué, en los dos idiomas: " + (mudas.join(", ")||"sí"),
  mudas.length === 0);
t("toda regla tiene prueba", reglas.every(r => typeof r.test === "function"));

// Las solapas a las que `gateFix` manda tienen que existir en la pantalla.
const solapasApp = (app.match(/\["(loan|lender|dates|money|docs|file)",\s*TX\(/g) || [])
  .map(s => s.match(/"([a-z]+)"/)[1]);
const subApp = [...proc.matchAll(/tab === "([a-z]+)"/g)].map(m => m[1]);
const quienes = [{role:"admin",name:"Jose Del Valle"},{role:"lo",name:"Ana M Plasencia"},
  {role:"assistant",name:"Tina"},{role:"processor",name:"Laura de Armas",processorId:"laura"}];
const archivo = st => ({ id:"f", lo:"Ana M Plasencia", stage:st, lenderId:"elend",
  contingencies:{}, stageLog:{}, processor:"martha" });
const tabsMal = [], subsMal = [], sinIdioma = [];
for (const [etapa, rs] of Object.entries(C.STAGE_GATES))
  for (const r of rs) for (const q of quienes) {
    const f = C.gateFix(r.id, archivo(etapa), q);
    if (!f) continue;
    if (f.tab && !solapasApp.includes(f.tab)) tabsMal.push(`${r.id}→${f.tab}`);
    if (f.sub && !subApp.includes(f.sub))     subsMal.push(`${r.id}→${f.sub}`);
    if (!f.es || !f.en) sinIdioma.push(r.id);
  }
t("toda solapa de destino existe en el modal: " + (tabsMal.join(", ")||"sí"), tabsMal.length===0);
t("toda sub-solapa existe en PROCESAMIENTO: " + (subsMal.join(", ")||"sí"), subsMal.length===0);
t("todo destino habla los dos idiomas: " + ([...new Set(sinIdioma)].join(", ")||"sí"),
  sinIdioma.length===0);
// Y el ancla que promete tiene que estar escrita en algún archivo.
const anclasMal = [];
for (const [etapa, rs] of Object.entries(C.STAGE_GATES))
  for (const r of rs) for (const q of quienes) {
    const f = C.gateFix(r.id, archivo(etapa), q);
    if (f?.ancla && !app.includes(`"${f.ancla}"`) && !proc.includes(`"${f.ancla}"`))
      anclasMal.push(`${r.id}→${f.ancla}`);
  }
t("toda ancla prometida existe en el código: " + ([...new Set(anclasMal)].join(", ")||"sí"),
  anclasMal.length === 0);

// ─── 4 · PEDIDOS, CONTINGENCIAS, RELLENO ───────────────────────────
const pedidoRaro = Object.values(C.ORDER_STAGE).filter(s => !esEtapa(s));
t("todo pedido cuelga de una etapa real: " + (pedidoRaro.join(", ")||"sí"), pedidoRaro.length===0);
// Un pedido sin etapa nunca entra en `backfillGaps`: el bucle lo salta.
const pedidoHuerfano = C.ORDERS.filter(o => !C.ORDER_STAGE[o.id]).map(o => o.id);
t("todo pedido del catálogo tiene etapa, o el relleno lo ignora: "
  + (pedidoHuerfano.join(", ") || "sí"), pedidoHuerfano.length === 0);
const cadenaRara = C.CONTINGENCIES.flatMap(c => (c.chain||[]).filter(s => !esEtapa(s)));
t("toda cadena de contingencia apunta a etapas reales: " + (cadenaRara.join(", ")||"sí"),
  cadenaRara.length === 0);
t("toda contingencia tiene campo y son distintos",
  new Set(C.CONTINGENCIES.map(c=>c.field)).size === C.CONTINGENCIES.length);
const rellenoRaro = C.BACKFILL_STAGES.filter(s => !esEtapa(s));
t("el relleno pide etapas reales: " + (rellenoRaro.join(", ")||"sí"), rellenoRaro.length===0);

// ─── 5 · TODO CATALOGO HABLA LOS DOS IDIOMAS ───────────────────────
const catalogos = {
  SUBMISSION_DOCS:C.SUBMISSION_DOCS, DOC_FLAGS:C.DOC_FLAGS, CONTINGENCIES:C.CONTINGENCIES,
  MILESTONES:C.MILESTONES, ORDERS:C.ORDERS, GATE1_ITEMS:C.GATE1_ITEMS,
  CONTINGENCY_OUTCOMES:C.CONTINGENCY_OUTCOMES, UW_OUTCOMES:C.UW_OUTCOMES,
  LENDER_CHANGE_REASONS:C.LENDER_CHANGE_REASONS, CONTRACT_CANCEL_REASONS:C.CONTRACT_CANCEL_REASONS,
  INTAKE_FIELDS:C.INTAKE_FIELDS, RISK_FLAGS:C.RISK_FLAGS, LEAD_ORIGINS:C.LEAD_ORIGINS,
};
for (const [n, cat] of Object.entries(catalogos)) {
  if (!cat) { t(`${n}: existe`, false); continue; }
  const arr = Array.isArray(cat) ? cat : Object.entries(cat).map(([k,v]) => ({ id:k, ...v }));
  const mudo = arr.filter(x => !x.es || !x.en).map(x => x.id);
  t(`${n} (${arr.length}) con par ES/EN: ` + (mudo.join(", ")||"sí"), mudo.length === 0);
}
const sinPar = Object.entries(C.LOE_KINDS).filter(([,v]) => !v.es || !v.en).map(([k])=>k);
t(`LOE_KINDS (${Object.keys(C.LOE_KINDS).length}) con par: ` + (sinPar.join(", ")||"sí"),
  sinPar.length === 0);
t("las seis señales, todas bilingües",
  Object.keys(C.SIGNALS).length === 6 &&
  Object.values(C.SIGNALS).every(s => s.es && s.en));

// ─── 6 · LA GENTE ──────────────────────────────────────────────────
const gente = new Set([...Object.values(C.PROCESSORS).map(p=>p.full),
  ...Object.values(C.PROCESSORS).map(p=>p.name)]);
const tokens = new Set(Object.values(C.STAGE_OWNERS));
const raros = [...tokens].filter(x => x !== C.PROCESSOR_TOKEN && x !== "LO" && !gente.has(x)
  && !["Tina","Laura"].includes(x));
t("todo dueño es un símbolo conocido o una persona real: " + (raros.join(", ")||"sí"),
  raros.length === 0);
t("la procesadora por defecto existe en el catálogo", !!C.PROCESSORS[C.DEFAULT_PROCESSOR]);

console.log();
console.log(mal ? `✕ coherencia: ${ok} pasaron, ${mal} fallaron${avisos?`, ${avisos} avisos`:""}`
                : `coherencia: ${ok}/${ok} el motor y la pantalla dicen lo mismo${avisos?` · ${avisos} avisos`:""}`);
process.exit(mal ? 1 : 0);
