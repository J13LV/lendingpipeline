// ═══════════════════════════════════════════════════════════════════
//  catalogo.js · el equipo, las fases y las constantes de la sucursal
//
//  Salió de App.jsx sin cambiar una línea. Lo usan App y Producción; si
//  viviera en App, Producción tendría que importar App y eso es un ciclo.
// ═══════════════════════════════════════════════════════════════════
import { daysBetween, fileClock, stageUrgency } from "./pipelineCore";
import { TX } from "./idioma";

// ─── TEAM ROSTER ───
// `lang` decide en que idioma aterriza cada persona en su primer login.
// Martha no lee espanol: sin este campo entraria a una pantalla que no
// entiende, buscando un boton que tampoco entiende para cambiarla.
export const TEAM = {
  // Jose has two accounts during the PRMG → Barrett transition. Both point to
  // the same person and the same admin rights. The PRMG one gets disabled in
  // Firebase once the new login is confirmed working.
  "a7gM7SK7GhUuomyL8apuw68PptA2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  "vllTjiE2Aba8CKIC3UWGxMdzBcM2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  // Ana salio del equipo. NO se borra de aqui, y la diferencia importa:
  // borrarla dejaria todos sus archivos huerfanos y la sacaria del tablero
  // de produccion, o sea que su volumen dejaria de contar en el año. Lo que
  // se le quita es el acceso, y eso vive en firestore.rules y en Firebase,
  // no en esta tabla.
  //
  // `active:false` la saca del menu de asignacion — nadie le puede dar un
  // archivo nuevo — y deja intacto todo lo que ya cerro.
  "rGY5FGA7P3N5lXE74TjZ07tHQWg1": { name: "Ana M Plasencia",    short: "Ana",      role: "lo",        nmls: "2683283", color: "#BD65E8", active: false },
  "iXcEzyc2nTTy2CJirLUz1FJ1oye2": { name: "Ana M Plasencia",    short: "Ana",      role: "lo",        nmls: "2683283", color: "#BD65E8", active: false },
  "0dpbvxe4RZUmCDhm03Zne6JSKE32": { name: "Marelis Pinales",    short: "Marelis",  role: "lo",        nmls: "2723306", color: "#06D6A0" },
  // Manny entra sin fila en COMP_ROSTER a proposito. Arranca en cero volumen,
  // asi que stageForVolume lo pone en Newbie al 50% solo — escribirlo seria
  // repetir lo que la escalera ya dice. Y derivado SUBE solo al llegar a los
  // $5M, igual que Marelis; fijarle la etapa lo dejaria clavado en 50%.
  // `lang: "en"` para que aterrice en ingles desde su primer login.
  "W2rvVzo6f0Z3zBVLzR66dn82COr2": { name: "Manny Estrada",      short: "Manny",    role: "lo",        nmls: "2876792", color: "#5AC8D8", lang: "en" },
  "qMVqzjs59yMIcZfvsWACpjm1o4F2": { name: "Tina",              short: "Tina",     role: "assistant", nmls: null, color: "#7EC8A4" },
  // Laura pasa a procesar. `processorId` la amarra a su propia cola: ve
  // la suya y no la de Martha. El rol sigue dandole lo de assistant.
  "Hj0KI0wmGfTHinHxxx8mrdLx5jw2": { name: "Laura de Armas",     short: "Laura",    role: "processor", nmls: "",        color: "#F5A623", processorId: "laura" },
};
export function getProfile(uid){ return TEAM[uid] || { name:"Unknown User", short:"Unknown", role:"assistant", nmls:"", color:"#ADBAC7", lang:"es" }; }

// Millones en M y miles en k. Con jumbo en la mezcla, "$7500k" vuelve
// a salir en un archivo real.
export const fmtLoan = n => Number(n)>=1e6 ? "$"+(n/1e6).toFixed(2)+"M" : "$"+Math.round(n/1000)+"k";
// La clave lleva el uid: sin el, dos personas en el mismo navegador
// compartian idioma, que es justo lo contrario de lo que se queria.
export const LANG_KEY = uid => "pipe_lang:" + (uid || "anon");
export const BPS_RATE = 150;
export const OVERRIDE_RATE = 0.0025;
export const JOSE_LO = "Jose Del Valle";
export const EXCLUDED_TYPES = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite",
  "CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)",
  "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
  "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist"];

// ─── BANK-TO-BANK REFERRAL CONSTANTS ───
// Cuando la sucursal no puede colocar un archivo (producto, crédito, nicho), se refiere
// it to another banker and earns a referral fee. We also track inbound deals
// where another banker sent us business.
export const REFERRED_OUT_STAGE = "REFERRED OUT — EXTERNAL BANK";
export const REFERRAL_FEE_BPS = 50; // bps earned on referred-out closed deals
export const REFERRAL_REASONS = [
  "Credit Score Too Low",
  "DTI / Income Issue",
  "Product Not Offered",
  "Property Type Restriction",
  "LTV / Down Payment Issue",
  "Bankruptcy / Credit Event",
  "Foreign National Buyer",
  "Self-Employed Documentation",
  "Investor / Non-Owner Restriction",
  "Other",
];
export const REFERRAL_STATUSES = [
  "Pending at Banker",
  "Closed (Funded)",
  "Fell Through",
  "Withdrawn by Borrower",
];

// ─── PREPARATION BANK ───
// Clients who are ALIVE but not buyable yet: repairing credit, saving money,
// waiting on taxes, new job, next season. They used to sit in Pre-Qual aging
// against a stage clock that did not apply to them, which made the whole phase
// look old and stopped anyone from reading it. Here the clock changes jobs:
// it no longer measures days in stage, it measures against a review date.
export const PREP_STAGE = "PREPARATION — NOT READY YET";

// Credit reports expire at ~120 days. Past that the file has to be re-pulled
// anyway, so that is the natural point to force a decision instead of letting
// Preparation quietly become the new graveyard.
export const PREP_MAX_DAYS = 120;

// `id` es lo que se guarda en Firestore; `label` y `why` son pantalla y
// por eso van bilingues. Traducir el id romperia archivos ya escritos —
// la misma razon por la que "Withdrawn by Borrower" se queda en ingles.
export const PREP_REASONS = [
  { id:"credit",   label:{es:"Reparación de crédito",  en:"Credit repair"},      mode:"days", days:30,
    why:{es:"El crédito se reporta en ciclo mensual. 30 días es un ciclo completo — antes desperdicias el pull, después desperdicias el mes.",
         en:"Credit reports on a monthly cycle. 30 days = one full cycle — earlier wastes the pull, later wastes the month."} },
  { id:"reserves", label:{es:"Ahorro / reservas",      en:"Saving / reserves"},  mode:"days", days:90,
    why:{es:"Llamar cada 30 días a alguien que está ahorrando solo produce «todavía no» y desgasta la relación.",
         en:"Calling a saver every 30 days only produces «not yet» and wears out the relationship."} },
  { id:"taxes",    label:{es:"Taxes por presentar",    en:"Taxes to be filed"},  mode:"date",
    why:{es:"Hay una fecha de presentación en el calendario. Úsala, no adivines 30/60/90.",
         en:"There is a real filing date on the calendar. Use it — don't guess at 30/60/90."} },
  { id:"income",   label:{es:"Trabajo o ingreso nuevo",en:"New job / income"},   mode:"date",
    why:{es:"Primer día de trabajo más 30 días de talones. Es una fecha calculada, no una estimación.",
         en:"First day of work + 30 days of pay stubs. This is a calculated date, not an estimate."} },
  { id:"docs",     label:{es:"Faltan documentos",      en:"Missing documents"},  mode:"days", days:30,
    why:null },
  { id:"season",   label:{es:"Compra la próxima temporada", en:"Buying next season"}, mode:"date",
    why:{es:"El mes que el cliente te dijo, no el que te conviene.",
         en:"Pick the month the client actually told you."} },
  { id:"other",    label:{es:"Otro",                   en:"Other"},              mode:"days", days:30,
    why:null },
];
export function prepReasonById(id){ return PREP_REASONS.find(r=>r.id===id) || PREP_REASONS[PREP_REASONS.length-1]; }

export const ARCHIVE_REASONS = [
  "Went with another lender",
  "Dead / no contact",
  "Referred out (transition)",
  "Duplicate file",
  "Client changed mind",
  "Other",
];

export function isPrep(f){ return f.stage === PREP_STAGE; }
export function isArchived(f){ return !!f.archived; }

// Days elapsed since the file entered Preparation. This is the 120-day clock.
export function prepAge(f){ return daysBetween(f.prep?.enteredAt) ?? 0; }

// Days until the review date. Negative = overdue.
// Counted in UTC on purpose. Subtracting two local dates picks up the extra
// hour from the daylight-saving change in November/March, and Math.ceil turned
// that into a whole phantom day. Date.UTC has no DST, so the count is exact.
export function daysUntilISO(iso){
  if(!iso) return 0;
  const [y,m,d] = iso.split("-").map(Number);
  const n = new Date();
  return Math.round((Date.UTC(y, m-1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))/86400000);
}
export function prepDaysToReview(f){ return daysUntilISO(f.prep?.reviewOn); }

// A file is "due" when its review date has arrived, OR when it has been sitting
// in Preparation past the 120-day cap regardless of what date was set.
export function prepDue(f){
  if(!isPrep(f) || isArchived(f)) return false;
  if(prepAge(f) >= PREP_MAX_DAYS) return true;
  return prepDaysToReview(f) <= 0;
}
// Past the cap, "reschedule" is no longer an option — return it or archive it.
export function prepLocked(f){ return prepAge(f) >= PREP_MAX_DAYS; }

export const PHASES = [
  { id: 1, label: "Pre-Qual", short: "PQ", color: "#4A90D9", bg: "#1a2a3a", stages: ["Lead Inquiry","Needs Assessment","Credit Pull","Income Verification","Pre-Qualification"] },
  { id: 2, label: "House Hunt", short: "HH", color: "#7EC8A4", bg: "#1a2e25", stages: ["Realtor Connected","Active Search","Offer Submitted","Under Contract"] },
  { id: 3, label: "Processing", short: "PR", color: "#F5A623", bg: "#2e2210", stages: ["Full Application","Initial Disclosures Sent","Doc Collection","Title Ordered","Appraisal Ordered","Insurance Ordered"] },
  { id: 4, label: "Underwriting", short: "UW", color: "#BD65E8", bg: "#261535", stages: ["Submitted to UW","UW Review","Conditional Approval","Condition Clearing","Clear to Close"] },
  { id: 5, label: "Close Prep", short: "CP", color: "#E85D75", bg: "#2e1520", stages: ["CD Issued","Closing Scheduled","Final Verifications","Closing Docs Drawn"] },
  { id: 6, label: "Closing", short: "CL", color: "#FFD166", bg: "#2e2800", stages: ["Signing","Funded","Recorded","Keys Delivered"] },
  { id: 7, label: "Post-Close", short: "PC", color: "#06D6A0", bg: "#00281e", stages: ["Welcome Sent","30-Day Follow-Up","Review Requested","Nurture Active"] },
];

export const CLOSED_STAGE = "CLOSED — FUNDED";
export const ALL_STAGES = PHASES.flatMap(p => p.stages.map(s => ({ stage: s, phase: p })));
// El catalogo bajo de 58 tipos a 26. Salieron 39 productos de DPA
// estatal —NV HIP, FL Hometown Heroes, TX TSAHC, AZ Home in Five,
// CO CHFA— que eran de la epoca de PRMG como direct lender. El DPA ya
// no vive aqui: se describe con sus propias casillas en el archivo, y
// asi un FHA con asistencia sigue contando como FHA.
//
// Y entraron los Non-QM POR NOMBRE. Antes solo habia "Non-QM", un
// generico: si Ana cerraba un DSCR, el reporte de mezcla nunca podia
// decir cuanto DSCR se hizo. El motor ya los distinguia y el catalogo
// de lenders tambien — solo el menu no.
export const LOAN_TYPE_GROUPS = [
  { group: "Standard", types: ["Conventional","FHA","VA","USDA","Jumbo"] },
  { group: "Non-QM", types: [
    "DSCR","Bank Statement","P&L Only","1099 Only","ITIN",
    "Foreign National","Asset Depletion","WVOE","Non-QM (other)"
  ]},
  { group: "Refi", types: [
    "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
    "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist"
  ]},
  { group: "HELOC & Second", types: [
    "Lightning Equity Hybrid HELOC","Symmetry HELOC",
    "CE Second Elite","CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)"
  ]},
];
export const LOAN_TYPES = LOAN_TYPE_GROUPS.flatMap(g => g.types);

// Jose tiene dos UIDs durante la transición PRMG → Barrett. Son la misma
// persona, así que la lista se colapsa por nombre — si no, sale duplicado en
// producción con sus cifras contadas dos veces.
export const LO_LIST = Object.entries(TEAM)
  .filter(([_,p]) => p.role === "admin" || p.role === "lo")
  .filter(([_,p],i,arr) => arr.findIndex(([__,q]) => q.name === p.name) === i)
  .map(([uid,p]) => ({
    uid,
    name: p.name,
    nmls: p.nmls,
    role: p.role === "admin" ? "BM/MLO" : "LO",
    color: p.color,
    active: p.active !== false,
  }));

// A quien se le PUEDE asignar un archivo nuevo. LO_LIST completo sigue
// mandando en produccion: quien salio del equipo se lleva su historia
// consigo y sus cierres siguen contando en el año.
export const LO_ASSIGNABLE = LO_LIST.filter(l => l.active);


// Quién es quién para el reparto. El piso de Ana es contractual y firmado con
// Barrett; nunca baja, y nunca se suma a los aumentos de la escalera.
// La etapa de Ana va escrita porque la app solo conoce su volumen desde que
// existe el sistema, no su carrera — derivarlo la dejaba como Newbie. La de
// Marelis se deriva a propósito: su $5M empieza a contar en Barrett y quiere
// avanzar sola cuando lo alcance.
//
//   isBM     · el BM y la sucursal son el mismo bolsillo
//   floor    · piso contractual, nunca baja, nunca se suma a la escalera
//   stage    · fija la etapa e ignora el volumen derivado
//   trainer  · hay un trainer asignado a los archivos de este LO
//   isTrainer· ES el trainer de la sucursal, y cobra ese 15%
// Contexto de reparto para las pantallas de archivo. Vive aquí para que la
// tarjeta, el modal y el payroll usen exactamente los mismos supuestos.
export const COMP_YEAR = 1;
export const BRANCH_FILES_MO = 8;

export const COMP_ROSTER = {
  "Jose Del Valle":  { isBM:true },
  // Ana se queda aqui aunque ya no este en el equipo. Sus archivos cerrados
  // se siguen calculando con el piso que se le pago de verdad; quitarla
  // reescribiria dinero del pasado, que es lo peor que puede hacer un
  // sistema de compensacion.
  "Ana M Plasencia": { stage:"senior", floor:0.70 },
  // Marelis pasa de entrenada a entrenadora. Pierde `trainer` —el 15% que
  // cobraba Ana por sus archivos ya no lo cobra nadie— y gana `isTrainer`,
  // que es de donde sale su nombre en el reparto y en el request de payroll.
  "Marelis Pinales": { isTrainer:true },
  // Manny entra con trainer asignado: Marelis. El 15% sale de la parte de
  // la SUCURSAL, no del 50% de el — su neto no cambia por esto.
  // El 15% baja a 10% cuando llegue a Intermediate y se apaga en Senior,
  // segun TRAINER_RATES. Nadie tiene que acordarse de bajarlo.
  "Manny Estrada":   { trainer:true },
};

// Quien cobra el 15% de trainer. Sale del roster, NO escrito a mano: antes
// el request de payroll decia "Ana M Plasencia" fijo mientras la pantalla
// del archivo decia "Trainer" a secas. Dos sitios, dos respuestas, y de por
// medio dinero de alguien.
export const TRAINER_NAME =
  Object.entries(COMP_ROSTER).find(([, r]) => r.isTrainer)?.[0] || "Trainer";

export const SAMPLE = [
  { id:"f1", lo:"Jose Del Valle", borrower:"Ariel Villalobos", loan:385000, type:"Conventional", stage:"Condition Clearing", daysInStage:3, closing:"2026-04-14", note:TX("phNoteSample"), bps:null, closedAt:null },
  { id:"f2", lo:"Jose Del Valle", borrower:"Maria Santos", loan:420000, type:"FHA", stage:"Appraisal Ordered", daysInStage:6, closing:"2026-04-28", note:"", bps:null, closedAt:null },
];

export function getPhase(stageName) {
  if (stageName === CLOSED_STAGE) return { id:99, label:"Closed", short:"✓", color:"#06D6A0", bg:"#00281e", stages:[CLOSED_STAGE] };
  if (stageName === REFERRED_OUT_STAGE) return { id:98, label:"Referred Out", short:"REF", color:"#A78BFA", bg:"#1f1830", stages:[REFERRED_OUT_STAGE] };
  if (stageName === PREP_STAGE) return { id:97, label:"Preparation", short:"PREP", color:"#7EC8A4", bg:"#16261f", stages:[PREP_STAGE] };
  return PHASES.find(p => p.stages.includes(stageName)) || PHASES[0];
}
export function daysTil(d) { return d ? Math.ceil((new Date(d)-new Date())/86400000) : null; }
export function urgency(f) {
  if (f.stage===CLOSED_STAGE) return "closed";
  if (f.stage===REFERRED_OUT_STAGE) return "referred";
  // A file in Preparation is not late — it is waiting on purpose. The only
  // thing that can be wrong is a review date that came and went.
  if (f.stage===PREP_STAGE) return prepDue(f) ? "critical" : "normal";
  // The contract date wins: the borrower's earnest money depends on it.
  const d=daysTil(f.closing);
  if(d!==null&&d<=3)return"critical";
  if(d!==null&&d<=7)return"warning";
  // Otherwise the stage's own budget. Two days in Registration is late;
  // four days in Conditions is normal. One shared threshold said neither.
  const u=stageUrgency(f);
  if(u.level==="late"||u.level==="critical")return"critical";
  if(u.level==="watch"||u.level==="warn")return"stale";
  return"normal";
}

// Lo peor de un archivo, mire por donde se mire.
//
// El encabezado contaba solo `urgency` —la etapa pasada de techo— pero la
// tarjeta esconde la palabra CRITICAL cuando hay un reloj vigente que
// manda: el COE, la ventana de House Hunt, el estandar de tres dias.
// Resultado: el numero decia ocho y en el tablero se veian cuatro.
//
// Ahora el numero significa "archivos que necesitan atencion hoy", que es
// lo que uno pregunta al mirarlo, y no "etapas pasadas de techo".
export function fileSeverity(f) {
  const u = urgency(f);
  if (u === "critical") return "critical";
  const ck = fileClock(f);
  if (ck?.applies && ck.signal === "broken") return "critical";
  if (u === "warning" || (ck?.applies && ck.signal === "soon")) return "warning";
  return u;
}
