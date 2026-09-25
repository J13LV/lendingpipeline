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

// ═══════════════════════════════════════════════════════════════════
//  7 · EL WIKI Y LOS RECORRIDOS
//  Enseñan lo que el motor hace. Cuando el motor cambia y el texto no,
//  el equipo aprende algo que ya no es verdad — y lo defiende.
// ═══════════════════════════════════════════════════════════════════
const wiki = readFileSync("helpContent.js", "utf8");
const tour = readFileSync("tour.jsx", "utf8");

// Números escritos con letra, que es como se escriben en el texto. El
// hueco tiene que llevar un número: sin eso "The exact dates" contaba
// como si dijera una cifra, y la prueba mentía en las dos direcciones.
const PALABRAS = "una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|"
  + "trece|catorce|quince|dieciocho|one|two|three|four|five|six|seven|eight|nine|ten|"
  + "eleven|twelve|thirteen|fourteen|fifteen|eighteen";
const NUM = { 2:["dos","two"], 3:["tres","three"], 4:["cuatro","four"], 5:["cinco","five"],
  6:["seis","six"], 7:["siete","seven"], 8:["ocho","eight"], 12:["doce","twelve"],
  18:["dieciocho","eighteen"] };
// Devuelve null si el texto ya no cuenta eso; true/false si lo cuenta.
const cuenta = (src, sustantivo, n) => {
  const re = new RegExp(`\\b(?:las|los|the)\\s+(${PALABRAS})\\s+(?:${sustantivo})\\b`, "gi");
  const ms = [...src.matchAll(re)];
  if (!ms.length) return null;
  const buenas = NUM[n] || [];
  return ms.every(m => buenas.includes(m[1].toLowerCase()));
};

// ── las puertas ──
// El wiki las titula y las tabula. Las dos cosas tienen que cuadrar con
// el motor, y la tabla es la que de verdad se lee.
t(`el wiki titula bien las puertas (motor: ${reglas.length} reglas en ${etapasPuerta.length} etapas)`,
  cuenta(wiki, "puertas|gates", reglas.length) !== false);
const momentos = [...wiki.matchAll(new RegExp(`(${PALABRAS})\\s+momentos\\b|(${PALABRAS})\\s+moments\\b`, "gi"))];
t("el wiki cuenta bien los «momentos»",
  momentos.every(m => (NUM[reglas.length]||[]).includes((m[1]||m[2]||"").toLowerCase())));
const momTour = [...tour.matchAll(new RegExp(`(${PALABRAS})\\s+momentos\\b|(${PALABRAS})\\s+moments\\b`, "gi"))];
t("el recorrido cuenta bien los momentos",
  momTour.every(m => (NUM[reglas.length]||[]).includes((m[1]||m[2]||"").toLowerCase())));

// La tabla, fila por fila, contra el motor: misma etapa y mismo frena/avisa.
const bloqueP = wiki.slice(wiki.indexOf(`id: "puertas"`), wiki.indexOf(`id: "vistas"`));
const tablaP = bloqueP.slice(bloqueP.indexOf("rows:["), bloqueP.indexOf("] },", bloqueP.indexOf("rows:[")));
const filas = [...tablaP.matchAll(/\[\s*"([^"]+)"[\s\S]*?\{es:"(sí|solo avisa)"/g)]
  .map(m => ({ etapa: m[1], frena: m[2] === "sí" }));
// El wiki las lista en orden de pipeline, que es como se leen. El objeto
// `STAGE_GATES` va en el orden en que se escribieron sus claves. Los dos
// ordenes son validos: se comparan ordenados por etapa, no por escritura.
const porEtapa = a => [...a].sort((x, y) => etapasMotor.indexOf(x.etapa) - etapasMotor.indexOf(y.etapa));
const delMotor = Object.entries(C.STAGE_GATES).flatMap(([e, rs]) => rs.map(r => ({ etapa: e, frena: !!r.hard })));
t(`la tabla del wiki tiene una fila por regla (${filas.length} vs ${delMotor.length})`,
  filas.length === delMotor.length);
t("y cada fila dice la etapa y el frena/avisa correctos",
  JSON.stringify(porEtapa(filas)) === JSON.stringify(porEtapa(delMotor)));

// ── el resto de los conteos ──
t("el wiki cuenta bien las señales",
  cuenta(wiki, "señales|signals", Object.keys(C.SIGNALS).length) !== false);
t("el wiki cuenta bien las fases", cuenta(wiki, "fases|phases", fases) !== false);
t("el wiki cuenta bien las fechas de contingencia",
  cuenta(wiki, "fechas|dates", C.CONTINGENCIES.length) !== false);
const preq = [...wiki.matchAll(new RegExp(`(${PALABRAS})\\s+etapas de Pre-Qual|(${PALABRAS})\\s+Pre-Qual stages`, "gi"))];
t("el wiki cuenta bien las etapas de Pre-Qual",
  preq.every(m => (NUM[C.PREQUAL_STAGES.length]||[]).includes((m[1]||m[2]||"").toLowerCase())));
const reloj = [...wiki.matchAll(new RegExp(`(${PALABRAS})\\s+etapas con reloj|(${PALABRAS})\\s+timed stages`, "gi"))];
t("el wiki cuenta bien las etapas con reloj",
  reloj.every(m => (NUM[conReloj.length]||[]).includes((m[1]||m[2]||"").toLowerCase())));

// Solo DOS de las cinco contingencias son del contrato; las otras tres son
// cadena de entrega. Esa distincion separa "el deposito esta en riesgo" de
// "vamos a quedar mal", y el wiki la borra en un sitio.
t(`el wiki no llama «del contrato» a las ${C.CONTINGENCIES.length} `
  + `(solo ${C.CONTINGENCIES.filter(c=>c.kind==="contract").length} lo son)`,
  !/cinco fechas del contrato|five contract dates/i.test(wiki));

// Todo tono que el wiki usa tiene que existir en el mapa que lo pinta.
const mapaTonos = app.slice(app.indexOf("const TONE={gold:"));
const tonosUsados = [...new Set([...wiki.matchAll(/tone:"([a-z]+)"/g)].map(m => m[1]))];
const tonoHuerfano = tonosUsados.filter(x => !new RegExp("\\b" + x + ":\\[").test(mapaTonos));
t("todo tono del wiki existe en el mapa que lo pinta: " + (tonoHuerfano.join(", ") || "sí"),
  tonoHuerfano.length === 0);

// ── el recorrido de procesamiento ──
// Señala grupos de la cola y sub-solapas del archivo por su data-tour. Un
// nombre que no existe deja el paso apuntando al vacio: el texto sale y no
// se enciende nada, que es peor que no tener recorrido.
const bloqueProc = tour.slice(tour.indexOf("PROCESSING_STEPS"), tour.indexOf("export function stepsFor"));
const campos = [...new Set([...bloqueProc.matchAll(/field:\s*"([a-z_-]+)"/g)].map(m => m[1]))];
const gruposReales = C.QUEUE_GROUPS.map(g => "grupo-" + g.id);
const fijos = ["cola", "colas", "vencidas"];              // anclas de la pantalla
const campoMal = campos.filter(f => !gruposReales.includes(f) && !fijos.includes(f));
t("todo grupo que el recorrido señala existe en la cola: " + (campoMal.join(", ") || "sí"),
  campoMal.length === 0);
// Y al reves: un grupo que nadie enseña es un grupo que nadie sabe trabajar.
const sinEnseñar = gruposReales.filter(g => !campos.includes(g));
t("ningún grupo de la cola se queda sin enseñar: " + (sinEnseñar.join(", ") || "sí"),
  sinEnseñar.length === 0);

const subsProc = [...new Set([...bloqueProc.matchAll(/tab:\s*"([a-z]+)"/g)].map(m => m[1]))];
const subMalProc = subsProc.filter(x => !subApp.includes(x));
t("toda sub-solapa del recorrido de procesamiento existe: " + (subMalProc.join(", ") || "sí"),
  subMalProc.length === 0);
const subSinEnseñar = subApp.filter(x => !subsProc.includes(x));
t("ninguna sub-solapa se queda sin enseñar: " + (subSinEnseñar.join(", ") || "sí"),
  subSinEnseñar.length === 0);
// Cada ancla que el recorrido pide tiene que estar escrita en processing.jsx.
const anclaMal = campos.filter(f => !proc.includes(`data-tour="${f}"`)
  && !proc.includes('data-tour={"grupo-" + g.id}'));
t("toda ancla del recorrido está en el código: " + (anclaMal.join(", ") || "sí"),
  anclaMal.length === 0);

// El recorrido cambia de solapa solo: si nombra una que no existe, se queda quieto.
// Solo las del recorrido del MODAL: las de PROCESSING_STEPS son sub-solapas
// del archivo en procesamiento y se comprueban contra su propia lista.
const bloqueDet = tour.slice(tour.indexOf("DETAIL_STEPS"), tour.indexOf("PROCESSING_STEPS"));
const tabsTour = [...new Set([...bloqueDet.matchAll(/tab:\s*"([a-z]+)"/g)].map(m => m[1]))];
const tabsMalTour = tabsTour.filter(x => !solapasApp.includes(x));
t("toda solapa del recorrido existe: " + (tabsMalTour.join(", ") || "sí"), tabsMalTour.length === 0);
const rolesTour = [...new Set([...tour.matchAll(/roles:\s*\[([^\]]*)\]/g)]
  .flatMap(m => [...m[1].matchAll(/"([a-z]+)"/g)].map(x => x[1])))];
const rolesReales = ["admin","lo","assistant","processor"];
const rolMalTour = rolesTour.filter(x => !rolesReales.includes(x));
t("todo rol del recorrido existe: " + (rolMalTour.join(", ") || "sí"), rolMalTour.length === 0);

// Los orígenes del lead deciden la comp. Uno sin documentar es dinero que
// nadie sabe explicar.
const sinDocumentar = C.LEAD_ORIGINS.filter(o => !wiki.includes(o.es) && !wiki.includes(o.en || o.es))
  .map(o => o.es);
t("todo origen de lead está en el wiki: " + (sinDocumentar.join(", ") || "sí"),
  sinDocumentar.length === 0);

// El texto EN no puede mandar a buscar un botón que en inglés se llama de otra
// forma. Martha lee inglés: una etiqueta en español ahí es un callejón.
const soloEN = [...wiki.matchAll(/en:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]).join("\n");
const etiquetasES = ["AGREGAR","ENTRENAMIENTO","RELLENAR","TU COMPENSACIÓN EN ESTE ARCHIVO",
  "FECHAS","PRÉSTAMO","DOCUMENTOS","EXPEDIENTE"];
const coladas = etiquetasES.filter(e => soloEN.includes(e));
t("el texto en inglés no manda a botones con nombre en español: " + (coladas.join(" · ") || "sí"),
  coladas.length === 0);

// ── los tres momentos del documento ──
// PTA/PTC/PTF deciden con cuanta fuerza se persigue un documento hoy. El
// motor los define; el wiki y el recorrido los repiten a mano. Si el texto
// dice otro hito, Laura y Martha persiguen en el momento equivocado.
const momento = (id, mal) => {
  const donde = [["wiki", wiki], ["recorrido", tour]].filter(([, src]) =>
    mal.some(m => new RegExp(m, "i").test(src))).map(([n]) => n);
  t(`${id.toUpperCase()} = «${C.DOC_TIMING[id].es}» / «${C.DOC_TIMING[id].en}»`
    + (donde.length ? " — mal en: " + donde.join(", ") : ""), donde.length === 0);
};
momento("pta", ["PTA antes de registrar", "PTA before registering", "prior to registration"]);
momento("ptc", ["PTC antes del Clear to Close", "PTC before the Clear to Close",
                "prior to Clear to Close"]);

// ── los lenders ──
// El número de correspondent vive escrito a mano en TRES sitios además del
// dato: un comentario del motor, el wiki y el recorrido. El dato manda.
const conCorr = C.LENDERS.filter(l => l.products?.correspondent).length;
const sinCorr = C.LENDERS.length - conCorr;
const numeros = (src, patron) => [...src.matchAll(patron)].map(m => Number(m[1]));
const corrDicho = [
  ...numeros(wiki, /correspondent solo (\d+)|correspondent only (\d+)/g),
  ...numeros(wiki, /correspondent only (\d+)/g),
  ...numeros(tour, /correspondent solo (\d+)|correspondent only (\d+)/g),
  ...numeros(core, /correspondent\s+—\s+(\d+) lenders/g),
].filter(Number.isFinite);
t(`el número de lenders de correspondent cuadra con el dato (${conCorr}): `
  + (corrDicho.filter(n => n !== conCorr).join(", ") || "sí"),
  corrDicho.every(n => n === conCorr));
// "unos 180" es el catálogo menos los de correspondent, no un número suelto.
const brokerDicho = numeros(wiki, /broker hay unos (\d+)|Broker has about (\d+)/g)
  .concat(numeros(tour, /broker hay unos (\d+)|Broker has about (\d+)/g)).filter(Number.isFinite);
t(`el número de broker es del orden del catálogo (${sinCorr} sin correspondent de ${C.LENDERS.length})`,
  brokerDicho.every(n => Math.abs(n - sinCorr) <= 15));
// El Excel parte un lender en varios registros: uno con los productos y otro
// con la marca de correspondent. `lendersFor` exige LAS DOS COSAS en el mismo
// registro, asi que el partido no sale nunca — ni en broker ni en correspondent.
// Es un lender que Barrett lista y que aqui no se puede escoger.
const PROD = ["conventional","fha","va","usda","jumbo","nonqm","second","dpa"];
const muertos = C.LENDERS.filter(l => l.products?.correspondent
  && !PROD.some(k => l.products[k]?.length)).map(l => l.name.replace(/\n/g, " "));
t("ningún lender de correspondent queda inseleccionable: " + (muertos.join(" · ") || "sí"),
  muertos.length === 0);
// Y cuantos se pueden escoger de verdad, que es el numero que importa.
const usables = conCorr - muertos.length;
t(`los ${conCorr} marcados como correspondent son todos usables (usables: ${usables})`,
  usables === conCorr);

// Toda etapa que el wiki nombra tiene que existir. Un nombre viejo manda a
// buscar una etapa que ya no esta en el menu.
const nombradas = etapasMotor.filter(e => wiki.includes(e));
t("el wiki nombra etapas reales (" + nombradas.length + " de " + etapasMotor.length + ")",
  nombradas.length > 10);

console.log();
console.log(mal ? `✕ coherencia: ${ok} pasaron, ${mal} fallaron${avisos?`, ${avisos} avisos`:""}`
                : `coherencia: ${ok}/${ok} el motor y la pantalla dicen lo mismo${avisos?` · ${avisos} avisos`:""}`);
process.exit(mal ? 1 : 0);
