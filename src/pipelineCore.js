// ═══════════════════════════════════════════════════════════════════
//  PIPELINE CORE — Del Valle Lending Co. powered by Barrett Financial
//  Step 1: clocks, house-hunt cadence, lender history, split BPS.
//
//  All clocks run on CALENDAR days, not business days. A lender that
//  promises "24 hours" from an Eastern-time desk answers in two days
//  when you submit at 3pm Pacific. Calendar days measure what happens.
// ═══════════════════════════════════════════════════════════════════

import LENDER_DATA from "./lenders2026.json";

export const LENDERS = LENDER_DATA.lenders;
export const PRODUCT_CAPABILITIES = LENDER_DATA.productCapabilities;
export const LENDER_DATA_YEAR = LENDER_DATA.year;

// ─── 1. DATES ──────────────────────────────────────────────────────
// LOCAL date, not UTC. toISOString() converts to UTC first, so in Las Vegas
// (UTC-7) anything after 5pm local came back as tomorrow's date. That shifted
// stageEnteredAt, fileOpenedAt and every review date by one day.
function localISO(d) {
  // The year MUST be padded to four digits. Without this, year 2 came back
  // as "2-09-06", the next new Date() returned Invalid Date, and localISO
  // then produced "NaN-NaN-NaN" forever. A date input fires an event on
  // every keystroke, so typing "2026" hands us year 2 before year 2026 —
  // and any loop reading that value never terminated.
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 1A. DATE GUARD ────────────────────────────────────────────────
// Nothing downstream may consume a date this rejects. A half-typed year
// is not a date, it is a keystroke, and it must never reach the math.
const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidISO(iso) {
  if (typeof iso !== "string" || !ISO_SHAPE.test(iso)) return false;
  const y = Number(iso.slice(0, 4));
  if (y < 1970 || y > 2200) return false;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return localISO(d) === iso;          // rejects 2026-02-31 and friends
}
// Read a date field. Returns null for anything unusable.
export const okDate = iso => (isValidISO(iso) ? iso : null);

// Every loop that walks a calendar is capped. Roughly 27 years of steps —
// far past any real deadline, and a guaranteed exit if a bad value ever
// slips through the guard above.
const MAX_DAY_STEPS = 10000;
export function today() { return localISO(new Date()); }

export function daysBetween(from, to) {
  if (!from) return null;
  const utc = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const n = new Date();
  const a = utc(from);
  const b = to ? utc(to) : Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
}

// Days the file has been sitting in its current stage.
// Returns null when the file predates this feature — honest blank
// beats a fake zero. Resolves itself the first time the file moves.
export function daysInStage(file) {
  return file?.stageEnteredAt ? daysBetween(file.stageEnteredAt) : null;
}

// Total age of the file since day one. NEVER resets — not on stage
// change, not on lender change. This is the number you quote to an
// agent when they ask how long this loan has really been working.
export function fileAge(file) {
  // The EARLIEST of the two, never just the first one that exists.
  // stampStage used to write today() into fileOpenedAt on any file that
  // predated the feature, so the first ADVANCE made a two-month-old file
  // read as brand new. Taking the minimum repairs those files without
  // touching the database: createdAt was never lost, only ignored.
  const opened  = okDate(file?.fileOpenedAt);
  const created = okDate(file?.createdAt?.split("T")[0]);
  const start = (opened && created) ? (opened < created ? opened : created) : (opened || created);
  return start ? daysBetween(start) : null;
}

// ─── 2. CONTRACT DAYS BY STATE ─────────────────────────────────────
// Confirmed with APG and the title rep, Aug 2026:
//   NV and TX purchase contracts count in CALENDAR days.
//   FL contracts count in BUSINESS days.
// Same loan, same real duration, two different numbers on the contract.
// This is why the team must never memorize a single number.
export const CONTRACT_DAY_BASIS = { NV: "calendar", TX: "calendar", FL: "business" };

export function businessToCalendar(n) { return n + Math.floor(n / 5) * 2; }
// Worst case: a 3-business-day window starting Thursday spans 5 calendar
// days. Legal deadlines must always be budgeted at the worst case.
export function businessToCalendarWorst(n) { return n + Math.ceil(n / 5) * 2; }
export function calendarToBusiness(n) { return n - Math.floor(n / 7) * 2; }

// How many real (calendar) days a contract written in `state` for
// `contractDays` actually gives you.
export function contractDaysToCalendar(state, contractDays) {
  return CONTRACT_DAY_BASIS[state] === "business"
    ? businessToCalendar(contractDays)
    : contractDays;
}
// What to write on the contract in `state` to get `calendarDays` of real time.
export function calendarToContractDays(state, calendarDays) {
  return CONTRACT_DAY_BASIS[state] === "business"
    ? calendarToBusiness(calendarDays)
    : calendarDays;
}

// ─── 2A. PRODUCT TARGETS ───────────────────────────────────────────
// All figures are CALENDAR days measured from the purchase contract.
//   internal  — what the team works to; drives the stage budgets
//   committed — what goes to the agent and onto the contract
// The gap between them is the buffer where an extra condition round
// or a slow appraisal lives. DPA has no gap on purpose: APG writes
// 45-day offers as a competitive strategy, and that strategy is worth
// more than the buffer — but it only works on a pre-documented file.
export const PRODUCT_TARGETS = {
  conventional: { internal: 30, committed: 35 },
  fha:          { internal: 32, committed: 38 },
  va:           { internal: 35, committed: 40 },
  usda:         { internal: 55, committed: 65 },
  jumbo:        { internal: 40, committed: 45 },
  nonqm:        { internal: 40, committed: 45 },
  dscr:         { internal: 35, committed: 40 },
  dpa:          { internal: 45, committed: 45, requiresGate1PreContract: true },
  refi:         { internal: 35, committed: 45 },
  heloc:        { internal: 30, committed: 40 },
};

export function productKeyForLoanType(type = "") {
  const tipo = String(type).toLowerCase();
  if (/dpa|hip|chenoa|nhf|hometown heroes|tsahc|tdhca|seth|chfa|metrodpa|home in five|home at last|hfa|tvlb/.test(tipo)) return "dpa";
  if (/streamline|irrrl|refinow|refi possible|streamlined assist/.test(tipo)) return "refi";
  if (/heloc|second/.test(tipo)) return "heloc";
  if (/dscr/.test(tipo)) return "dscr";
  if (/non-qm|nonqm|bank statement|1099|p&l/.test(tipo)) return "nonqm";
  if (/jumbo/.test(tipo)) return "jumbo";
  if (/usda/.test(tipo)) return "usda";
  if (/\bva\b/.test(tipo)) return "va";
  if (/fha/.test(tipo)) return "fha";
  return "conventional";
}
export function targetsFor(file) {
  return PRODUCT_TARGETS[productKeyForLoanType(file?.type)] || PRODUCT_TARGETS.conventional;
}

// ─── 2B. STAGE BUDGETS ─────────────────────────────────────────────
// Stage budgets are WEIGHTS, not fixed days. The product target is
// divided across them, so changing a product target automatically
// rebalances every stage instead of leaving the two out of sync.
//
// This fixes a real defect in the first version: the fixed clocks
// summed to 65 days from contract to funding. A file could sit yellow
// at every stage, never trip a single red alert, and still blow the
// contract by three weeks.
// ─── 2B. STAGE BUDGETS — bottom up, from how the branch actually runs ──
// The branch pre-underwrites: Laura collects everything during Intake and
// the loan is NOT registered until the file is complete. So by the time
// underwriting asks for something, the branch already has it. Doc
// Collection is finished at Gate 1 and costs nothing after contract.
//
// Martha orders appraisal, title and HOI on day 1 of receipt, so those run
// underneath the underwriting clock instead of after it.
//
// These are explicit days, not scaled from a target. The critical path
// SUM tells us what is achievable — not the other way around. Deriving
// stage budgets from a product target was backwards and produced numbers
// that matched no one's experience.
// `warn` is the target the team works to. `late` is the ceiling before
// the file turns red — and the ceiling is NOT uniform. It is set by who
// you are waiting on:
//   team   — our own work. Tight ceiling. This is where discipline lives
//            and where a red is a coaching conversation.
//   vendor — appraiser, title, underwriter. Moderate. Nobody can rush them.
//   client — the borrower pays, signs, or sends. Widest ceiling, because
//            clients do not answer the way the team answers. A red here
//            is a follow-up problem, not a performance problem.
//   legal  — a statutory clock. The ceiling does NOT widen here; it is
//            the law's deadline, and the alert fires EARLY so there is
//            still time to chase the signature. Missing an initial
//            disclosure window pushes the file into adverse action and
//            forces re-disclosure — the cost of being late is not delay,
//            it is a compliance problem. The team forces the client on
//            these; the client does not set the pace.
export const CEILING_BY_WAIT = { team: 1.35, vendor: 1.6, client: 2.0, legal: 1.0 };

// ─── 2B-0. PROCESADORAS ────────────────────────────────────────────
// Siete etapas decian owner: "Martha" escrito a mano. Con una sola
// procesadora eso funcionaba; con dos, un archivo de Laura decia que el
// dueño era Martha y el tablero mentia.
//
// Ahora esas etapas llevan el simbolo PROCESSOR y se resuelven POR
// ARCHIVO. Quien procesa no es una propiedad de la etapa, es una
// propiedad del archivo.
//
// Por defecto Martha, que es lo que Arive hace solo al registrar. El
// campo no asigna nada en Arive — registra la decision que ya se tomo.
export const PROCESSOR_TOKEN = "PROCESSOR";

export const PROCESSORS = {
  martha: { id: "martha", name: "Martha", full: "Martha Samaniego", color: "#BD65E8", external: true },
  laura:  { id: "laura",  name: "Laura",  full: "Laura de Armas",   color: "#F5A623", external: false },
};
export const PROCESSOR_IDS = Object.keys(PROCESSORS);
export const DEFAULT_PROCESSOR = "martha";

export const processorId = file =>
  (PROCESSORS[file?.processor] ? file.processor : DEFAULT_PROCESSOR);
export const processorOf = file => PROCESSORS[processorId(file)];

// Traduce el simbolo al nombre de quien procesa ESTE archivo. Cualquier
// otro dueño (LO, Tina, Laura en Doc Collection) pasa sin tocarse.
export function resolveOwner(owner, file) {
  return owner === PROCESSOR_TOKEN ? processorOf(file).name : owner;
}

export const STAGE_DAYS = {
  "Under Contract":           { warn: 1, wait: "team",   owner: "LO",    note: "verify Gate 1" },
  "Full Application":         { warn: 2, wait: "team",   owner: "Tina",  note: "register with lender" },
  "Initial Disclosures Sent": { warn: 2, wait: "legal",  owner: "Tina",  note: "borrower must sign within 3 business days", legalBusinessDays: 3 },
  "Doc Collection":           { warn: 4, wait: "client", owner: "Laura", note: "exceptions only — done at Gate 1", offPath: true },
  "Title Ordered":            { warn: 2, wait: "vendor", owner: PROCESSOR_TOKEN },
  "Appraisal Ordered":        { warn: 6, wait: "vendor", owner: PROCESSOR_TOKEN, note: "5-7 in Las Vegas, plus borrower payment" },
  "Insurance Ordered":        { warn: 2, wait: "client", owner: PROCESSOR_TOKEN, note: "borrower picks the policy" },
  "Submitted to UW":          { warn: 1, wait: "team",   owner: PROCESSOR_TOKEN },
  "UW Review":                { warn: 3, wait: "vendor", owner: PROCESSOR_TOKEN, dpa: { warn: 5 } },
  "Conditional Approval":     { warn: 1, wait: "team",   owner: "Tina" },
  "Condition Clearing":       { warn: 4, wait: "client", owner: "Tina",  dpa: { warn: 7 } },
  "Clear to Close":           { warn: 1, wait: "team",   owner: "Tina" },
  "CD Issued":                { warn: 2, wait: "legal",  owner: "Tina",  note: "TRID: received 3 business days before closing", legalBusinessDays: 3 },
  "Closing Scheduled":        { warn: 2, wait: "team",   owner: "Tina" },
  "Final Verifications":      { warn: 1, wait: "team",   owner: PROCESSOR_TOKEN },
  "Closing Docs Drawn":       { warn: 1, wait: "team",   owner: "Tina" },
  "Signing":                  { warn: 2, wait: "client", owner: "Tina",  note: "borrower has to show up" },
  "Funded":                   { warn: 1, wait: "team",   owner: "Tina" },
};

// Ordered together on day 1 — the block costs the slowest, not the sum.
const PARALLEL_ORDERS = ["Title Ordered", "Appraisal Ordered", "Insurance Ordered"];

// Tracks that run at the same time. Each group costs its slowest track.
const CONCURRENT_TRACKS = [
  [PARALLEL_ORDERS, ["Submitted to UW", "UW Review"]],
  [["CD Issued"], ["Closing Scheduled", "Final Verifications"]],
];
const IN_TRACKS = new Set(CONCURRENT_TRACKS.flat(2));

export function stageBudget(stage, file) {
  const s = STAGE_DAYS[stage];
  if (!s) return null;
  const isDpa = productKeyForLoanType(file?.type) === "dpa";
  const warn = (isDpa && s.dpa?.warn) || s.warn;
  // A legal stage's ceiling is the statute's own deadline, at worst case.
  // Everything else scales by who we are waiting on.
  const late = s.legalBusinessDays
    ? businessToCalendarWorst(s.legalBusinessDays)
    : Math.max(warn + 1, Math.round(warn * CEILING_BY_WAIT[s.wait]));
  return {
    warn, late, wait: s.wait, owner: resolveOwner(s.owner, file), note: s.note,
    offPath: !!s.offPath, legal: !!s.legalBusinessDays,
    legalBusinessDays: s.legalBusinessDays || null,
  };
}

function trackCost(track, dayOf) {
  const vals = track.map(dayOf);
  return track === PARALLEL_ORDERS ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0);
}

// What this branch can actually do when nothing goes wrong.
export function criticalPathDays(file, mode = "warn") {
  const day = k => stageBudget(k, file)[mode];
  let d = 0;
  for (const [k, v] of Object.entries(STAGE_DAYS))
    if (!IN_TRACKS.has(k) && !v.offPath) d += day(k);
  for (const g of CONCURRENT_TRACKS) d += Math.max(...g.map(tr2 => trackCost(tr2, day)));
  return d;
}

// Pre-contract and post-close stages are not part of the closing budget.
export const FIXED_CLOCKS = {
  "Lead Inquiry":            { warn: 1,  late: 2,  owner: "Laura" },
  "Needs Assessment":        { warn: 2,  late: 3,  owner: "Laura" },
  "Credit Pull":             { warn: 1,  late: 2,  owner: "LO" },
  "Income Verification":     { warn: 2,  late: 3,  owner: "LO" },
  "Pre-Qualification":       { warn: 1,  late: 2,  owner: "LO" },

  // Phase 2 is governed by the house-hunt track below, not by these.
  "Realtor Connected":       { houseHunt: true, owner: "LO" },
  "Active Search":           { houseHunt: true, owner: "LO" },
  "Offer Submitted":         { warn: 3,  late: 5,  owner: "LO" },
  "Under Contract":          { warn: 1,  late: 2,  owner: "LO", gate: "GATE_1" },

  // Contract → funding lives in STAGE_WEIGHTS above; owners only here.
  "Recorded":                { warn: 2,  late: 3,  owner: PROCESSOR_TOKEN },
  "Keys Delivered":          { warn: 1,  late: 2,  owner: "LO" },

  "Welcome Sent":            { warn: 3,  late: 7,  owner: "Laura" },
  "30-Day Follow-Up":        { warn: 30, late: 40, owner: "LO" },
  "Review Requested":        { warn: 7,  late: 14, owner: "Laura" },
  "Nurture Active":          { warn: 90, late: 180, owner: "LO" },
};

export const STAGE_OWNERS = {
  "Under Contract": "LO", "Full Application": "Tina", "Initial Disclosures Sent": "Tina",
  "Doc Collection": "Laura", "Title Ordered": PROCESSOR_TOKEN, "Appraisal Ordered": PROCESSOR_TOKEN,
  "Insurance Ordered": PROCESSOR_TOKEN, "Submitted to UW": PROCESSOR_TOKEN, "UW Review": PROCESSOR_TOKEN,
  "Conditional Approval": "Tina", "Condition Clearing": "Tina", "Clear to Close": "Tina",
  "CD Issued": "Tina", "Closing Scheduled": "Tina", "Final Verifications": PROCESSOR_TOKEN,
  "Closing Docs Drawn": "Tina", "Signing": "Tina", "Funded": "Tina",
};

export function stageClock(stage, file) {
  const fixed = FIXED_CLOCKS[stage];
  if (fixed) return { ...fixed, owner: resolveOwner(fixed.owner, file) };
  const b = stageBudget(stage, file);
  return b ? { ...b, owner: resolveOwner(STAGE_OWNERS[stage], file) || null } : null;
}

// ─── 2Z. EL ESTÁNDAR DE TRES DÍAS ──────────────────────────────────
// La promesa que la sucursal le hace a un agente: un lead que entra se
// decide en tres días hábiles. Es lo que se le dice a Abdel, a Lela y a
// APG, y por eso el sistema tiene que poder medirlo — un estándar que solo
// vive como un color en el tablero es una intención que se rompe callada.
//
// El reloj es de FASE, no de etapa. Las cinco etapas de Pre-Qual tenían un
// reloj cada una que sumaba siete días, así que un archivo podía saltar de
// escalón en escalón sin disparar nada nunca y llevar tres semanas ahí.
// Contando desde que el lead ENTRÓ, eso deja de poder pasar.
//
// DÍAS HÁBILES, no calendario, y con la definición del contrato —lunes a
// viernes menos feriados federales— no la de TRID, que cuenta el sábado
// porque es para el CD. Un lead que entra el viernes vence el miércoles y
// nadie tiene que trabajar el fin de semana para sostener la promesa.
export const LEAD_STANDARD_DAYS = 3;
export const PREQUAL_STAGES = [
  "Lead Inquiry", "Needs Assessment", "Credit Pull",
  "Income Verification", "Pre-Qualification",
];
export const inPreQual = file => PREQUAL_STAGES.includes(file?.stage);

// Cuándo entró el lead a la fase. Se relee del sello de la PRIMERA etapa
// que tocó: un lead que entró directo a Needs Assessment no tiene sello de
// Lead Inquiry, y contar desde hoy lo daría por recién llegado.
//
// Al volver de Preparación el reloj SE REINICIA: un cliente que estuvo dos
// meses arreglando crédito es un lead nuevo en la práctica, y arrastrarle
// el tiempo viejo lo dejaría en rojo el día que regresa.
export function preQualEnteredAt(file) {
  if (!inPreQual(file)) return null;
  const log = stageLogOf(file);
  const sellos = PREQUAL_STAGES.map(s => okDate(log[s])).filter(Boolean).sort();
  const primero = sellos[0] || null;
  // Si volvió de Preparación, manda la fecha de regreso.
  const regreso = okDate(file?.stageEnteredAt);
  if (primero && regreso && regreso > primero && (file?.prep?.reschedules !== undefined || !file?.prep)) {
    const volvio = (file?.history || []).some(h => h?.action === "returned_from_prep");
    if (volvio) return regreso;
  }
  return primero || regreso;
}

// Días hábiles transcurridos. El día de entrada es CERO, no uno: quien
// promete 72 horas cuenta así.
export function leadBusinessDays(file) {
  const desde = preQualEnteredAt(file);
  if (!desde) return null;
  return contractDaysBetween("FL", desde, today());   // FL = base de días hábiles
}

// El estado del lead contra el estándar. `broken` es rojo DE RITMO: nadie
// perdió dinero, pero la promesa se rompió y eso también cuesta.
export function leadStandard(file) {
  if (!inPreQual(file)) return { applies: false };
  const dias = leadBusinessDays(file);
  if (dias === null) return { applies: true, days: null, signal: "idle", met: null };
  const met = dias <= LEAD_STANDARD_DAYS;
  return {
    applies: true, days: dias, met,
    over: Math.max(0, dias - LEAD_STANDARD_DAYS),
    enteredAt: preQualEnteredAt(file),
    dueBy: addBusinessDays(preQualEnteredAt(file), LEAD_STANDARD_DAYS, "contract"),
    signal: dias > LEAD_STANDARD_DAYS ? "broken"
      : dias === LEAD_STANDARD_DAYS ? "soon" : "idle",
  };
}

// ─── LA MEDIDA ─────────────────────────────────────────────────────
// Un lead está DECIDIDO cuando salió de Pre-Qual por cualquiera de las tres
// puertas: precalificó y siguió, se mandó a Preparación, o se archivó. Lo
// que cuenta no es que califique — es que alguien decidió.
//
// Quedarse no es una salida, y por eso los que siguen en Pre-Qual pasados
// los tres días cuentan como incumplidos aunque todavía no se sepa el final.
export function leadStandardReport(files, { dias = LEAD_STANDARD_DAYS } = {}) {
  const salidas = [];
  for (const f of files || []) {
    const log = stageLogOf(f);
    const sellos = PREQUAL_STAGES.map(s => okDate(log[s])).filter(Boolean).sort();
    const entro = sellos[0];
    if (!entro) continue;

    let salio = null, puerta = null;
    // Salió hacia adelante: el primer sello de una etapa posterior.
    const despues = ALL_STAGE_ORDER.slice(ALL_STAGE_ORDER.indexOf("Realtor Connected"));
    const adelante = despues.map(s => okDate(log[s])).filter(Boolean).sort()[0];
    if (adelante) { salio = adelante; puerta = "prequalified"; }
    if (f.prep?.enteredAt && (!salio || okDate(f.prep.enteredAt) < salio)) {
      salio = okDate(f.prep.enteredAt); puerta = "preparation";
    }
    if (f.archived && f.archivedAt && (!salio || okDate(f.archivedAt) < salio)) {
      salio = okDate(f.archivedAt); puerta = "archived";
    }

    const abierto = !salio && inPreQual(f);
    const transcurrido = contractDaysBetween("FL", entro, salio || today());
    if (transcurrido === null) continue;
    salidas.push({
      file: f, enteredAt: entro, exitedAt: salio, gate: puerta,
      days: transcurrido, open: abierto,
      met: salio ? transcurrido <= dias : (transcurrido <= dias ? null : false),
    });
  }
  const decididos = salidas.filter(x => x.exitedAt);
  const cumplidos = salidas.filter(x => x.met === true).length;
  const rotos = salidas.filter(x => x.met === false).length;
  const medibles = cumplidos + rotos;
  return {
    standard: dias,
    rows: salidas.sort((a, b) => b.days - a.days),
    total: salidas.length,
    decided: decididos.length,
    open: salidas.filter(x => x.open).length,
    met: cumplidos, broken: rotos,
    pct: medibles ? Math.round(100 * cumplidos / medibles) : null,
    avgDays: decididos.length
      ? Math.round(10 * decididos.reduce((a, x) => a + x.days, 0) / decididos.length) / 10
      : null,
  };
}
// The alert that was missing. Not "is this stage slow" but "will this
// file make its contract date" — the only question the borrower's
// earnest money depends on.
export function addDays(iso, n) {
  if (!isValidISO(iso) || !Number.isFinite(n)) return null;
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localISO(d);
}

export function closingOutlook(file) {
  const meta = targetsFor(file);
  const state = file?.state || "NV";
  if (!file?.contractDate) return { targets: meta, state, ready: false };

  const projected = addDays(file.contractDate, meta.internal);
  const contracted = file.closing || null;
  const slack = contracted ? daysBetween(projected, contracted) : null;
  const short = contracted && new Date(contracted) < new Date(projected);

  return {
    ready: true, state, targets: meta,
    projectedClose: projected,
    contractedClose: contracted,
    slackDays: short ? -daysBetween(contracted, projected) : slack,
    tooShort: !!short,
    // What to ask for on the contract, in the units that state uses.
    askForContractDays: calendarToContractDays(state, meta.committed),
    askForCalendarDays: meta.committed,
    gate1Required: !!meta.requiresGate1PreContract,
    gate1Ready: !!file?.gate1CompletedAt,
    // A DPA on a 45-day APG contract has zero buffer. If the file was
    // not Gate-1 ready before the offer, do not promise 45.
    promiseRisk: !!meta.requiresGate1PreContract && !file?.gate1CompletedAt,
  };
}

// ─── 2D. FEDERAL HOLIDAYS ──────────────────────────────────────────
// Computed by rule, never by table. A hard-coded list expires quietly:
// it keeps returning answers after the last year in it, and the answers
// are wrong. These rules are the statute (5 U.S.C. 6103) and do not age.
//
// Observance shift: a holiday on Saturday is observed the Friday before,
// on Sunday the Monday after.
function nthWeekday(y, m, wd, n) {          // m 0-based, wd 0=Sunday
  const d = new Date(y, m, 1);
  d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (n - 1) * 7);
  return d;
}
function lastWeekday(y, m, wd) {
  const d = new Date(y, m + 1, 0);
  d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7));
  return d;
}
function observedShift(d) {
  const x = new Date(d);
  if (x.getDay() === 6) x.setDate(x.getDate() - 1);
  if (x.getDay() === 0) x.setDate(x.getDate() + 1);
  return x;
}

export const FEDERAL_HOLIDAY_NAMES = [
  "New Year's Day", "Martin Luther King Jr. Day", "Presidents' Day",
  "Memorial Day", "Juneteenth", "Independence Day", "Labor Day",
  "Columbus Day", "Veterans Day", "Thanksgiving", "Christmas Day",
];

export function federalHolidays(year) {
  const raw = [
    new Date(year, 0, 1),        nthWeekday(year, 0, 1, 3),   nthWeekday(year, 1, 1, 3),
    lastWeekday(year, 4, 1),     new Date(year, 5, 19),       new Date(year, 6, 4),
    nthWeekday(year, 8, 1, 1),   nthWeekday(year, 9, 1, 2),   new Date(year, 10, 11),
    nthWeekday(year, 10, 4, 4),  new Date(year, 11, 25),
  ];
  return raw.map((d, i) => ({ date: localISO(observedShift(d)), name: FEDERAL_HOLIDAY_NAMES[i] }));
}

const _holCache = new Map();
function holidayMap(year) {
  if (!_holCache.has(year)) {
    const m = new Map();
    for (const h of federalHolidays(year)) m.set(h.date, h.name);
    _holCache.set(year, m);
  }
  return _holCache.get(year);
}
export function federalHolidayName(iso) {
  if (!iso) return null;
  return holidayMap(Number(iso.slice(0, 4))).get(iso) || null;
}
export function isFederalHoliday(iso) { return !!federalHolidayName(iso); }

function weekday(iso) { return new Date(iso + "T00:00:00").getDay(); }
export function isWeekend(iso) { const w = weekday(iso); return w === 0 || w === 6; }

// ─── TWO DEFINITIONS OF "BUSINESS DAY" ─────────────────────────────
// They are not interchangeable and using the wrong one moves a legal
// deadline by a full day.
//
//   trid     — Regulation Z's precise definition, used for the CD
//              waiting period: every calendar day EXCEPT Sundays and
//              federal legal public holidays. SATURDAY COUNTS. Almost
//              everyone gets this wrong and gives the borrower a day
//              that does not exist.
//   contract — how a purchase contract counts (FL FAR/BAR and the
//              ordinary commercial meaning): Monday through Friday,
//              minus federal holidays. Saturday does NOT count.
export const BUSINESS_DAY_BASIS = {
  trid:     iso => weekday(iso) !== 0 && !isFederalHoliday(iso),
  contract: iso => weekday(iso) !== 0 && weekday(iso) !== 6 && !isFederalHoliday(iso),
};

export function addBusinessDays(iso, n, basis = "contract") {
  if (!isValidISO(iso) || !Number.isFinite(n)) return null;
  const isBiz = BUSINESS_DAY_BASIS[basis] || BUSINESS_DAY_BASIS.contract;
  let cur = iso, counted = 0, steps = 0;
  const step = n < 0 ? -1 : 1, target = Math.abs(n);
  while (counted < target) {
    if (++steps > MAX_DAY_STEPS) return null;
    cur = addDays(cur, step);
    if (!cur) return null;
    if (isBiz(cur)) counted++;
  }
  return cur;
}
export const subBusinessDays = (iso, n, basis = "contract") => addBusinessDays(iso, -n, basis);

// Closest working day at or before `iso` — where a deadline actually lands
// when the calculated date is a Sunday or a holiday.
export function previousBusinessDay(iso, basis = "contract") {
  if (!isValidISO(iso)) return null;
  const isBiz = BUSINESS_DAY_BASIS[basis] || BUSINESS_DAY_BASIS.contract;
  let cur = iso, steps = 0;
  while (!isBiz(cur)) {
    if (++steps > MAX_DAY_STEPS) return null;
    cur = addDays(cur, -1);
    if (!cur) return null;
  }
  return cur;
}

// A contract deadline of N days from acceptance, in the units that
// state actually uses. NV and TX count calendar; FL counts business.
export function contractDeadline(state, fromISO, days) {
  return CONTRACT_DAY_BASIS[state] === "business"
    ? addBusinessDays(fromISO, days, "contract")
    : addDays(fromISO, days);
}
// The inverse: how many days a written contingency date represents on
// that state's own clock. This is the number the agent wrote.
export function contractDaysBetween(state, fromISO, toISO) {
  if (!isValidISO(fromISO) || !isValidISO(toISO)) return null;
  // Signed on purpose. A contingency dated BEFORE contract acceptance is a
  // real data-entry error, and clamping it to 0 hid that error behind a
  // number that looked plausible.
  const sign = toISO < fromISO ? -1 : 1;
  const [a, b] = sign < 0 ? [toISO, fromISO] : [fromISO, toISO];
  const span = daysBetween(a, b);
  if (span > MAX_DAY_STEPS) return null;
  if (CONTRACT_DAY_BASIS[state] !== "business") return sign * span;
  const isBiz = BUSINESS_DAY_BASIS.contract;
  let cur = a, n = 0;
  for (let i = 0; i < span; i++) { cur = addDays(cur, 1); if (!cur) return null; if (isBiz(cur)) n++; }
  return sign * n;
}

// ─── 2E. CONTINGENCIES ─────────────────────────────────────────────
// Five dates plus the anchor. They are NOT the same kind of date and
// the system must never treat them as one list.
//
//   contract  — appraisal and loan. These live in the purchase contract.
//               Blowing one puts the borrower's earnest money at risk.
//               The consequence is the client's money, not our schedule.
//   delivery  — CTC, COE, funding. These are our chain of delivery.
//               Blowing one costs credibility with the agent and may
//               cost a per-diem, but the deposit is not on the line.
//
// Every date is CAPTURED from the contract, never averaged. Real
// contracts are written by real agents and deviate from every average
// we could compute. The engine derives deadlines FROM these dates —
// it does not invent the dates.
export const CONTINGENCY_KINDS = {
  contract: {
    es: "Del contrato", en: "Contract",
    risk_es: "El depósito del cliente está en riesgo",
    risk_en: "The client's earnest money is at risk",
    color: "#E85D75",
  },
  delivery: {
    es: "Cadena de entrega", en: "Delivery chain",
    risk_es: "Riesgo de credibilidad y per diem, no del depósito",
    risk_en: "Credibility and per-diem risk, not the deposit",
    color: "#F5A623",
  },
};

export const CONTINGENCIES = [
  {
    id: "appraisal", field: "appraisalContingency", kind: "contract", order: 1,
    es: "Tasación", en: "Appraisal", short: "APR",
    chain: ["Appraisal Ordered"],
    note_es: "El último día para pedirla se calcula hacia atrás desde esta fecha",
    note_en: "The last day to order it is derived backward from this date",
  },
  {
    id: "loan", field: "loanContingency", kind: "contract", order: 2,
    es: "Préstamo", en: "Loan", short: "LOAN",
    chain: ["Submitted to UW", "UW Review", "Conditional Approval"],
    note_es: "La aprobación condicional va dentro de esta contingencia",
    note_en: "Conditional approval sits inside this contingency",
  },
  {
    id: "ctc", field: "ctcTarget", kind: "delivery", order: 3,
    es: "Clear to Close", en: "Clear to Close", short: "CTC",
    chain: ["Condition Clearing", "Clear to Close"],
    note_es: "Debe caer antes de la fecha legal del CD",
    note_en: "Must land before the CD's legal date",
  },
  {
    id: "coe", field: "coe", kind: "delivery", order: 4,
    es: "Cierre de escrow (COE)", en: "Close of escrow (COE)", short: "COE",
    chain: ["Closing Scheduled", "Final Verifications", "Closing Docs Drawn", "Signing"],
    note_es: "El CD debe estar recibido 3 días hábiles antes, por ley",
    note_en: "The CD must be received 3 business days before, by law",
  },
  {
    id: "funding", field: "fundingDate", kind: "delivery", order: 5,
    es: "Fondeo", en: "Funding", short: "FUND",
    chain: ["Funded"],
    note_es: "24-48 horas después de la firma",
    note_en: "24-48 hours after signing",
  },
];
export const contingencyById = id => CONTINGENCIES.find(c => c.id === id) || null;
export const CONTINGENCY_ANCHOR_FIELD = "contractAccepted";

// ─── LA FECHA QUE VA ANTES DEL ANCLA ───────────────────────────────
// En la forma de Barrett, Contract Signal Date abre el bloque RPA Review,
// antes de Contract Date. Es cuando el comprador FIRMO la oferta; el ancla
// sigue siendo cuando el vendedor la ACEPTO.
//
// NO mueve ningun calculo. Todas las contingencias siguen contando desde
// la aceptacion, que es la fecha con consecuencia legal y de la que depende
// el deposito. Esta se guarda porque la distancia entre las dos es tiempo
// que el archivo ya gasto antes de que arrancara nuestro reloj — y si esa
// distancia crece de forma sistematica, es una conversacion con el agente.
export const CONTRACT_SIGNAL_FIELD = "contractSignal";
export const contractSignalDate = file =>
  okDate(file?.contingencies?.[CONTRACT_SIGNAL_FIELD]);

// Dias entre la firma del comprador y la aceptacion del vendedor.
export function signalToAcceptDays(file) {
  const s = contractSignalDate(file);
  const a = okDate(file?.contingencies?.[CONTINGENCY_ANCHOR_FIELD]);
  return s && a ? daysBetween(s, a) : null;
}

// ─── OUTCOMES ──────────────────────────────────────────────────────
// A contingency without a recorded result is a contingency nobody
// closed out. `pending` is the honest default and it is not neutral —
// a pending contingency whose date has passed is the loudest alert
// this system can produce.
export const CONTINGENCY_OUTCOMES = [
  { id: "pending",  es: "Pendiente",  en: "Pending",   color: "#8B949E", terminal: false },
  { id: "met",      es: "Cumplida",   en: "Met",       color: "#06D6A0", terminal: true  },
  { id: "waived",   es: "Renunciada", en: "Waived",    color: "#4A90D9", terminal: true,
    note_es: "El cliente renunció por escrito — el depósito queda expuesto",
    note_en: "Client waived in writing — the deposit is now exposed" },
  { id: "extended", es: "Extendida",  en: "Extended",  color: "#F5A623", terminal: false,
    requiresNewDate: true,
    note_es: "Requiere addendum firmado y fecha nueva",
    note_en: "Requires a signed addendum and a new date" },
  { id: "missed",   es: "Incumplida", en: "Missed",    color: "#E85D75", terminal: true,
    note_es: "Pasó sin resolverse — escalar hoy",
    note_en: "Passed unresolved — escalate today" },
  { id: "na",       es: "No aplica",  en: "Not applicable", color: "#484F58", terminal: true },
];
export const outcomeById = id => CONTINGENCY_OUTCOMES.find(o => o.id === id) || CONTINGENCY_OUTCOMES[0];

// The legal waiting period between the borrower RECEIVING the Closing
// Disclosure and consummation. Counted on the TRID basis, so Saturday
// is a business day and Sunday is not.
export const CD_WAITING_BUSINESS_DAYS = 3;

// The last day the CD can go out and still make this closing date.
// Assumes electronic delivery with confirmed receipt. If the CD is
// mailed, receipt is presumed three business days after sending —
// subtract another three.
export function cdIssueDeadline(coeISO) {
  return isValidISO(coeISO) ? subBusinessDays(coeISO, CD_WAITING_BUSINESS_DAYS, "trid") : null;
}
export function cdMailDeadline(coeISO) {
  const received = cdIssueDeadline(coeISO);
  return received ? subBusinessDays(received, CD_WAITING_BUSINESS_DAYS, "trid") : null;
}

// ─── BACKWARD DERIVATION ───────────────────────────────────────────
// Working backward is the whole point. A contingency date on its own
// tells you nothing you can act on today. "Order the appraisal by
// Wednesday" does.
//
// Each stage is budgeted at its LATE ceiling, not its target. The
// doctrine in this file is that deadlines are budgeted at the worst
// case; a plan built on everything going right is not a plan.
function chainBackward(file, completeByISO, stages) {
  const out = [];
  let deadline = completeByISO;
  for (let i = stages.length - 1; i >= 0; i--) {
    const b = stageBudget(stages[i], file);
    const days = b ? b.late : 1;
    const startBy = addDays(deadline, -days);
    out.unshift({
      stage: stages[i], startBy, completeBy: deadline, days,
      owner: b?.owner || resolveOwner(STAGE_OWNERS[stages[i]], file) || null,
      atTargetStartBy: addDays(deadline, -(b ? b.warn : 1)),
    });
    deadline = startBy;
  }
  return out;
}

// Every derived stage deadline on the file, keyed by stage name.
// A stage that appears in two chains keeps the EARLIER deadline —
// the tighter constraint is the one that governs.
export function derivedStageDeadlines(file) {
  const map = {};
  const push = row => {
    const prior = map[row.stage];
    if (!prior || row.startBy < prior.startBy) map[row.stage] = row;
  };
  for (const c of CONTINGENCIES) {
    const anchor = okDate(file?.contingencies?.[c.field]);
    if (!anchor) continue;
    for (const row of chainBackward(file, anchor, c.chain)) push({ ...row, from: c.id });
  }
  // The CD is not budgeted, it is legislated. Its start is the statute's
  // date and it overrides anything a stage budget would have produced.
  const coe = okDate(file?.contingencies?.coe);
  if (coe) {
    map["CD Issued"] = {
      stage: "CD Issued", startBy: cdIssueDeadline(coe), completeBy: coe,
      days: daysBetween(cdIssueDeadline(coe), coe), owner: "Tina",
      atTargetStartBy: cdIssueDeadline(coe), from: "coe", legal: true,
      mailBy: cdMailDeadline(coe),
    };
  }
  return map;
}

// Las fechas derivadas ordenadas para leerse. Empatadas en el mismo día
// —y empatan seguido, porque salen de la misma cadena— el desempate lo
// decidía el orden del mapa, o sea el azar: CD Issued salía DESPUÉS de
// Signing con la misma fecha, cuando en la vida real el CD va antes.
// Dentro del mismo día manda la secuencia real del préstamo.
export function sortedDeadlines(file) {
  const orden = st => {
    const i = ALL_STAGE_ORDER.indexOf(st);
    return i === -1 ? 999 : i;
  };
  return Object.values(derivedStageDeadlines(file))
    .filter(r => r.startBy)
    .sort((a, b) => a.startBy.localeCompare(b.startBy) || orden(a.stage) - orden(b.stage));
}

// What is due next, in order. This is the list the LO works from.
export function upcomingDeadlines(file, limit = 4) {
  const map = derivedStageDeadlines(file);
  const hoy = today();
  return Object.values(map)
    .filter(r => r.startBy)
    .sort((a, b) => a.startBy < b.startBy ? -1 : 1)
    .map(r => ({ ...r, daysOut: daysBetween(hoy, r.startBy), overdue: r.startBy < hoy }))
    .slice(0, limit);
}

// ─── STATUS PER CONTINGENCY ────────────────────────────────────────
// Levels are set by days remaining, but a `contract` contingency gets
// a wider warning band than a `delivery` one. Losing the deposit and
// annoying the agent are not the same event and must not share a color.
const CONTINGENCY_BANDS = {
  contract: { critical: 3, warn: 7 },
  delivery: { critical: 2, warn: 5 },
};

export function contingencyStatus(file, id) {
  const def = contingencyById(id);
  if (!def) return null;
  const box = file?.contingencies || {};
  const date = okDate(box[def.field]);
  const rec = (file?.contingencyResults || {})[id] || {};
  const outcome = rec.outcome || "pending";
  const o = outcomeById(outcome);
  const hoy = today();
  const daysLeft = date ? (date >= hoy ? daysBetween(hoy, date) : -daysBetween(date, hoy)) : null;
  const anchor = okDate(box.contractAccepted);
  const band = CONTINGENCY_BANDS[def.kind];

  let level = "normal";
  if (!date) level = "missing";
  else if (o.terminal) level = outcome === "missed" ? "critical" : "done";
  else if (daysLeft < 0) level = "critical";                 // passed, unresolved
  else if (daysLeft <= band.critical) level = "critical";
  else if (daysLeft <= band.warn) level = "warn";

  return {
    ...def, date, daysLeft, level, outcome, outcomeMeta: o,
    kindMeta: CONTINGENCY_KINDS[def.kind],
    depositAtRisk: def.kind === "contract" && !o.terminal && daysLeft !== null && daysLeft < 0,
    recordedAt: rec.at || null, recordedBy: rec.by || null, notes: rec.notes || null,
    // How many days the contract itself gave, on that state's clock.
    contractDays: anchor && date
      ? contractDaysBetween(file?.state || "NV", anchor, date) : null,
    basis: CONTRACT_DAY_BASIS[file?.state || "NV"],
  };
}

export function allContingencyStatus(file) {
  return CONTINGENCIES.map(c => contingencyStatus(file, c.id)).filter(Boolean);
}

// The single worst thing happening on this file right now.
export function contingencyHeadline(file) {
  const rows = allContingencyStatus(file).filter(r => r.date && r.level !== "done");
  if (!rows.length) return null;
  const rank = { critical: 0, warn: 1, normal: 2, missing: 3 };
  rows.sort((a, b) => (rank[a.level] - rank[b.level]) || (a.daysLeft - b.daysLeft));
  return rows[0];
}

export function hasContingencies(file) {
  const b = file?.contingencies || {};
  return CONTINGENCIES.some(c => !!okDate(b[c.field])) || !!okDate(b.contractAccepted);
}

// ─── CONFLICTS ─────────────────────────────────────────────────────
// Dates that are each fine on their own and impossible together. This
// is what nobody catches by reading the contract, because catching it
// requires holding five dates in your head at once.
export function contingencyConflicts(file) {
  const b = file?.contingencies || {};
  const out = [];
  const add = (sev, es, en) => out.push({ sev, es, en });

  const contractAccepted   = okDate(b.contractAccepted);
  const appraisalContingency = okDate(b.appraisalContingency);
  const loanContingency    = okDate(b.loanContingency);
  const ctcTarget          = okDate(b.ctcTarget);
  const coe                = okDate(b.coe);
  const fundingDate        = okDate(b.fundingDate);

  if (contractAccepted && coe) {
    const meta = targetsFor(file);
    const need = addDays(contractAccepted, meta.internal);
    if (need > coe) add("critical",
      `El producto necesita ${meta.internal} días desde el contrato y el COE llega antes (${daysBetween(coe, need)} días corto)`,
      `The product needs ${meta.internal} days from contract and the COE arrives sooner (${daysBetween(coe, need)} days short)`);
  }
  if (appraisalContingency && loanContingency && appraisalContingency > loanContingency)
    add("warn", "La contingencia de tasación vence después que la de préstamo — revisar el contrato",
                "The appraisal contingency expires after the loan contingency — check the contract");

  if (coe) {
    const cd = cdIssueDeadline(coe);
    if (ctcTarget && ctcTarget > cd) add("critical",
      `El CTC (${ctcTarget}) cae después del último día para el CD (${cd}). El COE no se sostiene`,
      `CTC (${ctcTarget}) lands after the last day to issue the CD (${cd}). The COE does not hold`);
    if (loanContingency && loanContingency > cd) add("warn",
      `La contingencia de préstamo (${loanContingency}) vence después del último día del CD (${cd})`,
      `The loan contingency (${loanContingency}) expires after the CD's last day (${cd})`);
    const hol = federalHolidayName(coe);
    if (hol) add("critical",
      `El COE cae en ${hol}, feriado federal. Título y registro están cerrados`,
      `The COE falls on ${hol}, a federal holiday. Title and recording are closed`);
    else if (isWeekend(coe)) add("warn",
      "El COE cae en fin de semana — confirmar con título antes de prometerlo",
      "The COE falls on a weekend — confirm with title before promising it");
  }
  if (fundingDate && coe && fundingDate < coe) add("critical",
    "La fecha de fondeo es anterior al COE", "The funding date is before the COE");
  if (ctcTarget && coe && ctcTarget > coe) add("critical",
    "El CTC es posterior al COE", "CTC is after the COE");
  if (contractAccepted && appraisalContingency && appraisalContingency < contractAccepted)
    add("critical", "La contingencia de tasación es anterior a la aceptación del contrato",
                    "The appraisal contingency predates contract acceptance");

  // A derived deadline that is already behind us, for a stage the file
  // has not reached. Sorted so the worst one reads first.
  const map = derivedStageDeadlines(file);
  const hoy = today();
  const reached = ALL_STAGE_ORDER.indexOf(file?.stage);
  for (const r of Object.values(map)) {
    const idx = ALL_STAGE_ORDER.indexOf(r.stage);
    if (idx > -1 && reached > -1 && idx <= reached) continue;   // already done
    if (r.startBy && r.startBy < hoy) add("critical",
      `${r.stage}: el último día para empezar era ${r.startBy}`,
      `${r.stage}: the last day to start was ${r.startBy}`);
  }
  const rank = { critical: 0, warn: 1 };
  return out.sort((x, y) => rank[x.sev] - rank[y.sev]);
}

// Stage order for "has this file already passed that stage" checks.
const ALL_STAGE_ORDER = [
  "Lead Inquiry", "Needs Assessment", "Credit Pull", "Income Verification", "Pre-Qualification",
  "Realtor Connected", "Active Search", "Offer Submitted", "Under Contract",
  "Full Application", "Initial Disclosures Sent", "Doc Collection", "Title Ordered",
  "Appraisal Ordered", "Insurance Ordered",
  "Submitted to UW", "UW Review", "Conditional Approval", "Condition Clearing", "Clear to Close",
  "CD Issued", "Closing Scheduled", "Final Verifications", "Closing Docs Drawn",
  "Signing", "Funded", "Recorded", "Keys Delivered",
];

// ─── WRITING ───────────────────────────────────────────────────────
// Captured at Full Application. The anchor is contract acceptance, not
// the day we opened the application — the clock was already running
// while the file sat in Under Contract.
export function setContingencyDates(file, dates) {
  const clean = {};
  for (const k of [CONTINGENCY_ANCHOR_FIELD, CONTRACT_SIGNAL_FIELD,
                   ...CONTINGENCIES.map(c => c.field)])
    clean[k] = okDate(dates[k]);
  return {
    ...file,
    contingencies: { ...(file.contingencies || {}), ...clean, capturedAt: today() },
  };
}

// Recording a result is a permanent entry, not an edit. `extended`
// moves the date AND keeps the old one, because "we extended twice"
// is the fact that matters at the post-mortem.
export function recordContingencyOutcome(file, id, { outcome, notes, newDate, by }) {
  const def = contingencyById(id);
  if (!def) return file;
  const o = outcomeById(outcome);
  const prevDate = file?.contingencies?.[def.field] || null;
  const entry = {
    id, outcome, at: today(), by: by || null,
    notes: (notes || "").trim() || null,
    fromDate: prevDate,
    toDate: o.requiresNewDate ? (newDate || null) : null,
  };
  const nextBox = { ...(file.contingencies || {}) };
  if (o.requiresNewDate && newDate) nextBox[def.field] = newDate;
  return {
    ...file,
    contingencies: nextBox,
    contingencyResults: {
      ...(file.contingencyResults || {}),
      [id]: { outcome, at: today(), by: by || null, notes: entry.notes },
    },
    contingencyLog: [...(file.contingencyLog || []), entry],
  };
}

export function contingencyExtensionCount(file, id) {
  return (file?.contingencyLog || []).filter(e => e.id === id && e.outcome === "extended").length;
}

// ─── 2F. CHANNEL, LENDER, RATE AND LOCK ────────────────────────────
// The channel is not a label on the file. It decides which lenders are
// even available and what the compensation ceiling is, so it is chosen
// FIRST and everything else filters from it.
//
//   broker         — lender-paid. 183 lenders available. The plan caps
//                    at 275 bps regardless of what the lender publishes.
//   correspondent  — 11 lenders. Rate price and origination fees COMBINED
//                    are capped at 400 bps. Combined, not stacked.
export const BROKER_COMP_CAP_BPS = 275;
export const CORRESPONDENT_COMP_CAP_BPS = 400;

export const CHANNELS = {
  broker: {
    es: "Broker", en: "Broker", capBps: BROKER_COMP_CAP_BPS, color: "#4A90D9",
    note_es: "Pagado por el lender · tope del plan 275 bps",
    note_en: "Lender-paid · plan caps at 275 bps",
  },
  correspondent: {
    es: "Correspondent", en: "Correspondent", capBps: CORRESPONDENT_COMP_CAP_BPS, color: "#BD65E8",
    requiresCapability: "correspondent",
    note_es: "Precio de la tasa y origination COMBINADOS · tope 400 bps",
    note_en: "Rate price and origination COMBINED · 400 bps cap",
  },
};
export const CHANNEL_IDS = Object.keys(CHANNELS);

// The pipeline's product keys and the lender file's product keys are not
// the same vocabulary. A streamline is still an FHA loan to the lender;
// a HELOC is a "second"; a DSCR lives under non-QM.
export function lenderProductKey(type = "") {
  const tipo = String(type).toLowerCase();
  if (/irrrl/.test(tipo)) return "va";
  if (/fha streamline/.test(tipo)) return "fha";
  if (/usda streamlined/.test(tipo)) return "usda";
  if (/refinow|refi possible/.test(tipo)) return "conventional";
  if (/heloc|second/.test(tipo)) return "second";
  const k = productKeyForLoanType(type);
  return ({ dscr: "nonqm", refi: "conventional", heloc: "second" })[k] || k;
}

// Which lenders can actually take this file. Channel first, then product.
export function lendersFor(file, channel) {
  const key = lenderProductKey(file?.type);
  const needsCorr = CHANNELS[channel]?.requiresCapability === "correspondent";
  return LENDERS
    .filter(l => {
      const p = l.products || {};
      if (needsCorr && !p.correspondent) return false;
      return !!p[key];
    })
    // Alfabético. Ordenar por bps escondía a eLend en medio del grupo de 275
    // entre ochenta nombres: encontrarlo dependía de la suerte.
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

// What this file can earn, and what the lender publishing a higher number
// does not change. Broker comp is capped by the plan, not by the lender.
// ─── COMPENSATION ──────────────────────────────────────────────────
// Three models. All three are typed in, because all three can differ
// from what any reference file says.
//
//   lender_paid    — broker channel. Defaults to the plan figure carried
//                    in the lender record, but that record is a snapshot
//                    of Lender_List_2026 and comp plans change. The typed
//                    value wins; the snapshot is shown beside it so a
//                    drift is visible instead of silent.
//   borrower_paid  — broker channel, lenders that pay nothing. Negotiated
//                    with the borrower.
//   correspondent  — rate price plus origination fees, COMBINED under
//                    400 bps.
export const COMP_MODELS = {
  lender_paid: {
    es: "Lender-paid", en: "Lender-paid", editable: true, capBps: BROKER_COMP_CAP_BPS,
    note_es: "Pagado por el lender · arranca en tu plan, lo ajustas tú",
    note_en: "Lender-paid · starts from your plan, you adjust it",
  },
  borrower_paid: {
    es: "Borrower-paid", en: "Borrower-paid", editable: true, capBps: BROKER_COMP_CAP_BPS,
    note_es: "Lo paga el cliente · se negocia por préstamo",
    note_en: "Paid by the borrower · negotiated per loan",
  },
  correspondent: {
    es: "Correspondent", en: "Correspondent", editable: true, capBps: CORRESPONDENT_COMP_CAP_BPS,
    note_es: "Precio de la tasa + origination, combinados bajo 400 bps",
    note_en: "Rate price + origination, combined under 400 bps",
  },
};

export function compModelFor(file) {
  if (file?.channel === "correspondent") return "correspondent";
  return lenderById(file?.lenderId)?.borrowerPaidOnly ? "borrower_paid" : "lender_paid";
}

// The lines that make up this file's revenue, what each is worth in
// dollars, and how much room is left under the ceiling.
export function compBreakdown(file) {
  const model = compModelFor(file);
  const m = COMP_MODELS[model];
  const loan = file?.loan || 0;
  const c = file?.comp || {};
  const $ = bps => Math.round(loan * (bps || 0) / 10000);
  // Number(null) and Number("") are both 0, not NaN — so an empty field
  // came back as a real zero and overwrote the plan default with $0.
  const num = v => (v === null || v === undefined || v === ""
    ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

  let lines;
  if (model === "correspondent") {
    lines = [
      { id: "ratePrice",   es: "Precio de la tasa", en: "Rate price",       bps: num(c.ratePriceBps),   editable: true },
      { id: "origination", es: "Origination",       en: "Origination fees", bps: num(c.originationBps), editable: true },
    ];
  } else if (model === "borrower_paid") {
    lines = [{ id: "borrowerPaid", es: "Pagado por el cliente", en: "Borrower-paid", bps: num(c.borrowerPaidBps), editable: true }];
  } else {
    const raw = lenderById(file?.lenderId)?.lenderPaidBps ?? null;
    const planBps = raw === null ? null : Math.min(raw, BROKER_COMP_CAP_BPS);
    // Typed value wins. Falls back to the plan snapshot when nothing typed.
    const typed = num(c.lenderPaidBps);
    lines = [{ id: "lenderPaid", es: "Pagado por el lender", en: "Lender-paid",
               bps: typed !== null ? typed : planBps, editable: true,
               published: raw, planBps, fromPlan: typed === null }];
  }

  const entered = lines.some(l => l.bps !== null);
  const totalBps = entered ? lines.reduce((a, l) => a + (l.bps || 0), 0) : null;
  const forfeited = model === "lender_paid"
    ? Math.max(0, (lines[0].published ?? 0) - (lines[0].bps ?? 0)) : 0;
  // The typed figure disagreeing with the snapshot is worth seeing, not hiding.
  const planDrift = model === "lender_paid" && !lines[0].fromPlan
    && lines[0].planBps !== null && lines[0].bps !== lines[0].planBps
    ? { typed: lines[0].bps, plan: lines[0].planBps } : null;

  return {
    model, meta: m, ceilingBps: m.capBps, ceilingDollars: $(m.capBps),
    lines: lines.map(l => ({ ...l, dollars: l.bps === null ? null : $(l.bps) })),
    totalBps, totalDollars: totalBps === null ? null : $(totalBps),
    remainingBps: totalBps === null ? null : m.capBps - totalBps,
    overCeiling: totalBps !== null && totalBps > m.capBps,
    pctOfCeiling: totalBps === null ? null : Math.round(100 * totalBps / m.capBps),
    forfeited, planDrift,
    entered,
  };
}

// Enforces the ceiling on write. Nothing above the cap is ever stored,
// so a typo cannot become a number the team quotes to a borrower.
export function setComp(file, patch) {
  const model = compModelFor(file);
  const cap = COMP_MODELS[model].capBps;
  const KEYS = { correspondent: ["ratePriceBps", "originationBps"],
                 borrower_paid: ["borrowerPaidBps"], lender_paid: ["lenderPaidBps"] }[model];
  const merged = { ...(file.comp || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    const n = Number(v);
    merged[k] = (v === "" || v === null || !Number.isFinite(n)) ? null : Math.max(0, n);
  }
  // The correspondent ceiling is COMBINED, not per line. Capping each line
  // at 400 let 300 + 250 through as 550. Each value is clamped to whatever
  // the other lines have left, so the sum can never exceed the cap.
  const edited = Object.keys(patch || {});
  for (const k of KEYS) {
    if (merged[k] === null || merged[k] === undefined) continue;
    const others = KEYS.filter(x => x !== k).reduce((a, x) => a + (merged[x] || 0), 0);
    const room = Math.max(0, cap - others);
    if (merged[k] > room) merged[k] = edited.includes(k) ? room : merged[k];
  }
  // If a stale combination still exceeds, trim the line the user did not touch.
  let total = KEYS.reduce((a, x) => a + (merged[x] || 0), 0);
  if (total > cap) for (const k of KEYS.filter(x => !edited.includes(x))) {
    if (total <= cap) break;
    const cut = Math.min(merged[k] || 0, total - cap);
    merged[k] = (merged[k] || 0) - cut; total -= cut;
  }
  return { ...file, comp: { ...merged, model, updatedAt: today() } };
}

// Kept for the card and for compDeltaBetween: the ceiling only.
// Lenders que hacen el producto pero quedan fuera por el canal elegido. Se
// listan para que la ausencia sea una explicación y no un misterio.
export function lendersHiddenByChannel(file, channel) {
  if (CHANNELS[channel]?.requiresCapability !== "correspondent") return [];
  const key = lenderProductKey(file?.type);
  return LENDERS.filter(l => l.products?.[key] && !l.products?.correspondent)
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

// Un lender que no está en el catálogo. Se guarda por nombre para que el
// archivo quede completo; el catálogo se actualiza después.
export const OTHER_LENDER_ID = "__other__";
export const lenderNameOf = file =>
  file?.lenderId === OTHER_LENDER_ID
    ? (String(file?.lenderOther || "").trim() || "Otro lender")
    : (lenderById(file?.lenderId)?.name || null);

export function compCeiling(file) {
  const b = compBreakdown(file);
  const line = b.model === "lender_paid" ? b.lines[0] : null;
  return {
    bps: line ? line.bps : (b.totalBps ?? b.ceilingBps),
    source: b.model === "lender_paid" ? (line?.published > b.ceilingBps ? "plan_cap" : "lender") : "channel",
    published: line?.published ?? null,
    forfeited: b.forfeited,
  };
}
// ─── THE ONE NUMBER THE REPORTS READ ───────────────────────────────
// `bps` is it. Nothing else.
//
// The comp block does not compete with this field, it WRITES to it: on
// save, whatever the block resolves to is mirrored into `bps`, and every
// dashboard keeps reading the single field it always read. The detailed
// breakdown still lives in `comp` for correspondent files, where the
// total is the sum of rate price and origination — but the total is what
// gets reported, and there is only one of it.
//
// The earlier version had a four-step priority chain instead. It worked,
// but nobody should have to remember which of four sources won.
export function resolvedCompBps(file) {
  const b = compBreakdown(file);
  return (b.totalBps !== null && b.totalBps !== undefined) ? b.totalBps : null;
}
export function fileCompBps(file, branchDefault = 150) {
  if (Number.isFinite(Number(file?.bps)) && file?.bps) return Number(file.bps);
  return resolvedCompBps(file) ?? branchDefault;
}
export function fileCompDollars(file, branchDefault = 150, amount = null) {
  return Math.round((amount ?? compBasisAmount(file)) * fileCompBps(file, branchDefault) / 10000);
}
export function fileCompSource(file) {
  if (Number.isFinite(Number(file?.bps)) && file?.bps) return "field";
  return resolvedCompBps(file) !== null ? "lender_plan" : "branch_default";
}

export function compCeilingDollars(file) {
  const c = compCeiling(file);
  return c.bps === null ? null : Math.round((file?.loan || 0) * c.bps / 10000);
}
// What changing lenders costs, in dollars.
//
// The first version compared CEILING to CEILING, which was wrong and wrong
// in the dangerous direction: with 275 published at one lender and 200 at
// the other it reported a 75 bps loss even when the file only ever took
// 220. That overstated the cost of a backup by nearly four times and would
// have talked the branch out of a move that was fine.
//
// What matters is what this file actually earns today versus the most it
// could earn at the new lender. You keep what you take unless the new
// lender's ceiling is lower than that.
export function compDeltaBetween(file, fromId, toId) {
  const ceilingAt = id => {
    if (file?.channel === "correspondent") return CORRESPONDENT_COMP_CAP_BPS;
    const l = lenderById(id);
    return l?.lenderPaidBps == null ? null : Math.min(l.lenderPaidBps, BROKER_COMP_CAP_BPS);
  };
  const toCeiling = ceilingAt(toId);
  if (toCeiling === null) return null;

  // What the file earns right now. compBreakdown already falls back to the
  // plan figure when nothing has been typed, so this works either way.
  const current = compBreakdown(file).totalBps ?? ceilingAt(fromId);
  if (current === null) return null;

  const after = Math.min(current, toCeiling);
  const bps = after - current;
  return {
    bps, dollars: Math.round((file?.loan || 0) * bps / 10000),
    current, after, toCeiling, fromCeiling: ceilingAt(fromId),
    // True when the new lender simply cannot pay what this file takes today.
    cappedByNewLender: toCeiling < current,
  };
}

// ─── LOCK ──────────────────────────────────────────────────────────
// Two states only. There is no "requested" — the branch treats a lock as
// done or not done, and a maybe-lock is a float with extra confidence.
//
// The term is chosen by PRICE, not by need: sometimes 15 prices better
// than 30. That is exactly why the system has to check the term against
// the closing date. A cheaper lock that expires before the COE is not
// cheaper — the extension gives the savings back.
export const LOCK_TERMS = [15, 30, 45, 60];
export const LOCK_STATES = {
  float:  { es: "Flotando", en: "Floating", color: "#F5A623" },
  locked: { es: "Lockeado", en: "Locked",   color: "#7EC8A4" },
};

// The lender needs the lock in hand to produce the CD, and the CD has a
// statutory date. So floating has a deadline even though nobody writes
// one on a contract. One business day before the CD must issue.
export function lastDayToLock(file) {
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  const cd = cdIssueDeadline(coe);
  return cd ? previousBusinessDay(addDays(cd, -1), "contract") : null;
}

export function lockExpiration(lockedAt, termDays) {
  return isValidISO(lockedAt) && Number.isFinite(termDays) ? addDays(lockedAt, termDays) : null;
}

// Of 15 / 30 / 45 / 60, which ones actually reach the closing date.
export function lockTermsCovering(file, fromISO) {
  const from = okDate(fromISO) || today();
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  return LOCK_TERMS.map(dias => {
    const exp = lockExpiration(from, dias);
    const covers = !!(coe && exp && exp >= coe);
    return {
      term: dias, expires: exp, covers,
      shortBy: coe && exp && exp < coe ? daysBetween(exp, coe) : 0,
      spare:   coe && exp && exp >= coe ? daysBetween(coe, exp) : 0,
    };
  });
}

export function lockStatus(file) {
  const state = file?.lockState === "locked" ? "locked" : "float";
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  const hoy = today();

  if (state === "float") {
    const by = lastDayToLock(file);
    const daysLeft = by ? (by >= hoy ? daysBetween(hoy, by) : -daysBetween(by, hoy)) : null;
    return {
      state, meta: LOCK_STATES.float, mustLockBy: by, daysLeft, coe,
      // No closing date means no derivable deadline. Blank, not a guess.
      level: by === null ? "unknown" : daysLeft < 0 ? "critical" : daysLeft <= 5 ? "warn" : "normal",
      terms: lockTermsCovering(file, hoy),
    };
  }

  const lockedAt = okDate(file?.lockedAt);
  const expires  = okDate(file?.lockExpires) || lockExpiration(lockedAt, file?.lockTermDays);
  const daysLeft = expires ? (expires >= hoy ? daysBetween(hoy, expires) : -daysBetween(expires, hoy)) : null;
  const covers   = !!(coe && expires && expires >= coe);
  return {
    state, meta: LOCK_STATES.locked, lockedAt, expires, daysLeft, coe,
    termDays: file?.lockTermDays ?? (lockedAt && expires ? daysBetween(lockedAt, expires) : null),
    coversClose: covers,
    shortBy: coe && expires && expires < coe ? daysBetween(expires, coe) : 0,
    spare:   covers ? daysBetween(coe, expires) : 0,
    level: expires === null ? "unknown"
      : daysLeft < 0 ? "critical"
      : !covers ? "critical"          // expiring before the COE is not a warning
      : daysLeft <= 7 ? "warn" : "normal",
  };
}

// Problems that only appear when lender, channel and lock are read together.
export function lenderConflicts(file) {
  const out = [];
  const add = (sev, es, en) => out.push({ sev, es, en });
  const l = lenderById(file?.lenderId);

  if (file?.channel === "correspondent" && l && !l.products?.correspondent)
    add("critical", `${l.name} no opera en canal correspondent`,
                    `${l.name} does not operate in the correspondent channel`);
  if (l) {
    const key = lenderProductKey(file?.type);
    if (!l.products?.[key]) add("critical",
      `${l.name} no hace ${key} — el archivo está registrado con el lender equivocado`,
      `${l.name} does not do ${key} — the file is registered with the wrong lender`);
    if (l.borrowerPaidOnly && file?.channel === "broker") add("warn",
      `${l.name} es borrower-paid únicamente — la compensación no la paga el lender`,
      `${l.name} is borrower-paid only — the lender does not pay compensation`);
  }
  const ls = lockStatus(file);
  if (ls.state === "locked" && ls.expires && !ls.coversClose) add("critical",
    `El lock vence el ${ls.expires}, ${ls.shortBy} días antes del cierre — habrá extensión`,
    `The lock expires ${ls.expires}, ${ls.shortBy} days before closing — an extension is coming`);
  if (ls.state === "float" && ls.mustLockBy && ls.daysLeft < 0) add("critical",
    `Pasó el último día para lockear (${ls.mustLockBy}) y el archivo sigue flotando`,
    `The last day to lock (${ls.mustLockBy}) has passed and the file is still floating`);
  return out;
}

export function hasLenderData(file) {
  return !!(file?.lenderId || file?.channel || file?.rate || file?.lockState);
}

// ─── 2G. CHANGING LENDERS ──────────────────────────────────────────
// What a lender change actually costs, measured against this file's own
// closing date rather than a remembered average.
//
// The branch does NOT restart the file. Appraisal, title, HOI and docs
// are already done and they travel. What does not travel:
//   · Disclosures. A new creditor issues new ones, and the borrower has
//     a statutory window to sign. That tramo cannot be compressed.
//   · Underwriting. The new lender underwrites from zero. This is the
//     expensive part, not the transfer.
//   · The rate lock. It is released and re-locked at that day's market.
//     If rates moved, the borrower pays the difference — a cost that
//     never appears in a comparison of lender compensation.
// Empieza en Full Application, no en las divulgaciones. El lender nuevo hay
// que REGISTRARLO —Tina lo hace de nuevo en Arive— y ese tramo cuesta dias
// que la primera version no contaba. El resultado es una fecha tope para
// decidir un cambio de lender DOS DIAS mas temprana que la que el sistema
// decia. Es un numero peor y es el verdadero.
export const REREGISTRATION_CHAIN = [
  "Full Application", "Initial Disclosures Sent", "Submitted to UW", "UW Review",
  "Conditional Approval", "Condition Clearing", "Clear to Close",
];
// Transfer out plus registration in, counted at both ends.
export const TRANSFER_DAYS = { best: 2, worst: 4 };
// El archivo aterriza donde Tina puede volver a registrarlo. Aterrizar en
// las divulgaciones dejaba el boton de REGISTRADO fuera de alcance y la
// obligaba a retroceder la etapa a mano — que es justo el movimiento que
// borraba stageLog.
export const LENDER_CHANGE_LANDING_STAGE = "Full Application";

export function reregistrationCost(file) {
  let best = TRANSFER_DAYS.best, worst = TRANSFER_DAYS.worst;
  const steps = [{ stage: "Traslado y re-registro", warn: TRANSFER_DAYS.best, late: TRANSFER_DAYS.worst }];
  for (const s of REREGISTRATION_CHAIN) {
    const b = stageBudget(s, file);
    if (!b) continue;
    best += b.warn; worst += b.late;
    steps.push({ stage: s, warn: b.warn, late: b.late, owner: b.owner, legal: b.legal });
  }
  return { best, worst, steps };
}

// The date the cushion stops being a cushion. Not the contingency date —
// the operational date, which lands earlier and is the one that governs.
export function backupViability(file) {
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  const cd = cdIssueDeadline(coe);
  if (!cd) return { ready: false };
  const { best, worst, steps } = reregistrationCost(file);
  const bestBy = addDays(cd, -best), worstBy = addDays(cd, -worst);
  const hoy = today();
  const loanC = okDate(file?.contingencies?.loanContingency);
  return {
    ready: true, coe, cdDeadline: cd, steps,
    bestDays: best, worstDays: worst,
    decideByBest: bestBy, decideByWorst: worstBy,
    daysToBest: bestBy >= hoy ? daysBetween(hoy, bestBy) : -daysBetween(bestBy, hoy),
    daysToWorst: worstBy >= hoy ? daysBetween(hoy, worstBy) : -daysBetween(worstBy, hoy),
    // The trap: the cushion can expire while the contingency still looks alive.
    loanContingency: loanC,
    expiresBeforeContingency: !!(loanC && worstBy < loanC),
    gapDays: loanC && worstBy < loanC ? daysBetween(worstBy, loanC) : 0,
    // Three windows, not two. The earlier date is the safe one because the
    // worst case takes MORE days, so it has to be decided sooner.
    //   before decideByWorst  — works even if everything drags
    //   between the two dates — only works if everything goes right
    //   after decideByBest    — cannot make the closing at all
    // The first version returned "normal" right up to the safe date and
    // then jumped straight to critical, so five days out read as green.
    window: hoy >= bestBy ? "impossible" : hoy >= worstBy ? "best_case_only" : "safe",
    level: hoy >= bestBy ? "critical"
         : hoy >= worstBy ? "warn"
         : daysBetween(hoy, worstBy) <= 5 ? "warn" : "normal",
    urgent: hoy < worstBy && daysBetween(hoy, worstBy) <= 5,
  };
}

// Everything the change costs, priced, before anyone commits to it.
export function changeCost(file, toLenderId) {
  const comp = compDeltaBetween(file, file?.lenderId, toLenderId);
  const ls = lockStatus(file);
  const v = backupViability(file);
  return {
    comp,
    lockLost: ls.state === "locked",
    lockedRate: ls.state === "locked" ? (file?.rate ?? null) : null,
    landsAt: LENDER_CHANGE_LANDING_STAGE,
    days: reregistrationCost(file),
    viability: v,
    // Moving after this date cannot make the closing at worst-case pace.
    tooLate: v.ready && v.decideByWorst < today(),
  };
}

// The change itself. The file does NOT restart: fileOpenedAt is untouched,
// so the age quoted to the agent stays honest. Only the stage clock resets,
// because the stage genuinely began again.
export function applyLenderChange(file, { lenderId, reasonId, notes, by, newClosingDate }) {
  const prev = file.lenderId || null;
  const entry = {
    from: prev, to: lenderId,
    fromName: lenderById(prev)?.name || null, toName: lenderById(lenderId)?.name || null,
    reasonId: reasonId || null,
    category: reasonById(reasonId)?.cat || null,
    notes: (notes || "").trim() || null,
    at: today(), by: by || null,
    daysWithPrevLender: file.lenderSince ? daysBetween(file.lenderSince) : null,
    stageWhenChanged: file.stage,
    compDeltaBps: compDeltaBetween(file, prev, lenderId)?.bps ?? null,
    compDeltaDollars: compDeltaBetween(file, prev, lenderId)?.dollars ?? null,
    lockWasActive: file.lockState === "locked",
    rateAtChange: file.rate ?? null,
  };
  return {
    ...file,
    lenderId,
    lenderSince: today(),
    lenderHistory: [...(file.lenderHistory || []), entry],
    // Los ciclos se MATERIALIZAN antes de soltar el lender viejo. Si se
    // dejaran sin escribir, la siembra los reconstruiria despues con el
    // lender NUEVO y el archivo se daria por registrado sin estarlo.
    registrations: registrationsOf(file),
    stage: LENDER_CHANGE_LANDING_STAGE,
    stageEnteredAt: today(),
    daysInStage: 0,
    // The lock does not travel. Back to float at today's market.
    lockState: "float", lockedAt: null, lockTermDays: null, lockExpires: null,
    // Comp is per lender, so the previous figures no longer describe this file.
    comp: null,
    closing: newClosingDate || file.closing,
    backupLenderId: file.backupLenderId === lenderId ? null : file.backupLenderId,
    // fileOpenedAt deliberately untouched. The file did not restart.
  };
}

export function lenderChangeCount(file) { return (file?.lenderHistory || []).length; }
export function lenderFaultChanges(file) {
  return (file?.lenderHistory || []).filter(h => h.category === "lender").length;
}

// ─── 2H. NOTES AS ENTRIES ──────────────────────────────────────────
// A single long note field cannot tell you which end is new. Laura writes
// at the bottom, Tina pastes at the top when she is in a hurry, and three
// weeks later nobody knows — and neither does the system, because to it
// the note is one block of text with one edit timestamp.
//
// So the note stops being a field and becomes a log. Each update is its
// own entry with its own date and author. The card shows the LAST entry,
// always, without anyone having to remember a convention.
//
// Existing notes are NOT migrated in the database. They are read as a
// single legacy entry whose date is the file's last edit — the best
// approximation available, and marked as such so nobody trusts it more
// than it deserves.
export function noteEntries(file) {
  const log = Array.isArray(file?.noteLog) ? file.noteLog : [];
  if (log.length) return [...log].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  const legacy = String(file?.note || "").trim();
  if (!legacy) return [];
  // No date and no author. `lastEditedAt` is when somebody last touched the
  // file, not when this text was written, and `lastEditedBy` is whoever
  // saved last — attributing Tina's note to Jose because Jose hit save is
  // worse than admitting we do not know.
  return [{ at: null, by: null, text: legacy, legacy: true }];
}
export const latestNote = file => noteEntries(file)[0] || null;

// El hilo agrupado por fase, en el orden en que ocurrieron. Las notas
// viejas sin sello caen en un grupo aparte en vez de inventarles etapa.
export function notesByStage(file) {
  const out = new Map();
  for (const n of [...noteEntries(file)].reverse()) {
    const k = n.stage || null;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(n);
  }
  return [...out.entries()].map(([stage, notes]) => ({ stage, notes: notes.reverse() }));
}
export const noteCount = file => noteEntries(file).length;

// La nota se sella con la ETAPA en que se escribio, no se guarda una nota
// por etapa. Un campo por etapa se fragmenta y envejece; un hilo sellado
// deja leer la historia por fase sin partir el dato.
//
// Las notas van SIEMPRE en ingles, por regla de la sucursal: Martha no
// lee espanol y el 1003, Arive, los lenders y las condiciones del
// underwriter estan todos en ingles. El sistema traduce SU propio texto,
// nunca el que escribe la gente.
export function addNoteEntry(file, text, by, stage) {
  const txt = String(text || "").trim();
  if (!txt) return file;
  // Seed the log with whatever was already in the old field, so the first
  // new entry does not appear to be the only thing ever written.
  const existing = Array.isArray(file?.noteLog) ? file.noteLog : [];
  const seed = (!existing.length && String(file?.note || "").trim())
    ? [{ at: null, by: null, text: String(file.note).trim(), legacy: true }]
    : [];
  return {
    ...file,
    noteLog: [...seed, ...existing, {
      at: new Date().toISOString(), by: by || null, text: txt,
      stage: stage || file?.stage || null,
    }],
  };
}

// ─── 2I. BARRETT COMPENSATION ──────────────────────────────────────
// Replaces the PRMG model entirely. That one was 25 flat bps on eligible
// volume, monthly, with HELOCs and seconds excluded and a "submit by the
// 15th" process. None of it survives the move to Barrett.
//
// What replaces it: every party takes a PERCENTAGE of the NET, and the
// percentage depends on who originated, what stage they are in, whether a
// trainer is assigned, what year of the Paulo agreement we are in, and
// what the branch's own volume can afford.
export const LO_STAGES = {
  newbie:       { es: "Newbie",         en: "Newbie",         split: 0.50, order: 1 },
  intermediate: { es: "Intermediate",   en: "Intermediate",   split: 0.60, order: 2 },
  senior:       { es: "Senior",         en: "Senior",         split: 0.70, order: 3 },
  bm:           { es: "Branch Manager", en: "Branch Manager", split: 0.85, order: 4 },
};
// Three stages plus the BM. Advancement is by funded volume, never by
// calendar, and a split never moves down.
export const STAGE_THRESHOLDS = { intermediate: 5_000_000, senior: 15_000_000 };

export function stageForVolume(fundedVolume, isBM = false) {
  if (isBM) return "bm";
  const v = Number(fundedVolume) || 0;
  if (v >= STAGE_THRESHOLDS.senior) return "senior";
  if (v >= STAGE_THRESHOLDS.intermediate) return "intermediate";
  return "newbie";
}

// The Team Lead share sunsets over three years. Note for the record: the
// internal structure document called this "Barrett's platform share". It
// is not Barrett's — it is the Paulo Maria Team override.
export const TEAM_LEAD_SCHEDULE = { 1: 0.15, 2: 0.07, 3: 0 };
export const teamLeadShare = year => TEAM_LEAD_SCHEDULE[Math.min(3, Math.max(1, Number(year) || 1))];

// Trainer earns until the trainee reaches Senior. Production-based, with
// no calendar expiration.
export const TRAINER_RATES = { newbie: 0.15, intermediate: 0.10, senior: 0, bm: 0 };

// ─── ORIGEN DEL LEAD ───────────────────────────────────────────────
// De dónde vino el cliente decide si el LO cobra su split completo o el
// reducido. La clasificación se GUARDA en el archivo cuando se asigna, no
// se deriva de esta tabla al mostrarlo: si mañana APG cambia de categoría,
// los archivos ya cerrados conservan la clasificación con la que se pagaron.
// Reescribir cheques viejos al cambiar una regla es lo que rompe la confianza.
export const LEAD_ORIGINS = [
  { id: "self",     es: "Self-Generated",   en: "Self-Generated",   klass: "self",     note_es: "Esfera y marketing propios del originador", note_en: "The originator's own sphere and marketing" },
  { id: "partner",  es: "Referral Partner", en: "Referral Partner", klass: "self",     note_es: "Socio referidor del originador", note_en: "A referral partner of the originator" },
  { id: "inhouse",  es: "In-House Lead",    en: "In-House Lead",    klass: "in_house", note_es: "Asignado por la sucursal — sin importar de dónde venga", note_en: "Assigned by the branch — no matter where it came from" },
  { id: "smartb",   es: "Smart Bee Client", en: "Smart Bee Client", klass: "in_house", note_es: "Base de la práctica de taxes · misma regla para todos los LO", note_en: "The tax practice database · same rule for every LO" },
  { id: "apg",      es: "APG Realty",       en: "APG Realty",       klass: "pending",  note_es: "Clasificación pendiente de definir", note_en: "Classification still to be defined" },
];
export const leadOrigin = id => LEAD_ORIGINS.find(o => o.id === id) || null;

// El descuento por lead de la casa: 10 puntos, uniforme, arriba de Newbie.
// El Newbie no lo recibe porque el flujo de leads es parte de su desarrollo.
export const IN_HOUSE_REDUCTION = 0.10;

// La clasificación efectiva de un archivo. Un origen pendiente NO se resuelve
// solo: se trata como del LO y se marca, para que nadie descubra después que
// el sistema decidió por él.
export function leadClassOf(file) {
  if (file?.leadClass === "in_house" || file?.leadClass === "self") return file.leadClass;
  const o = leadOrigin(file?.leadOrigin);
  if (!o) return "self";
  return o.klass === "pending" ? "self" : o.klass;
}
export const leadClassPending = file =>
  !file?.leadClass && leadOrigin(file?.leadOrigin)?.klass === "pending";

// ─── VOLUME LADDER ─────────────────────────────────────────────────
// The LO ceiling is not a promise, it is what the branch's volume can pay.
// More files spread the fixed cost, which is what funds a higher split.
export const BRANCH_COSTS = {
  fixedMonthly: 4000 + 13.5 * 40 * 52 / 12,   // Tina + Laura full time
  perFile: 250 + 150,                          // LP branch portion + Laura
  targetMarginPerFile: 400,
};
export function branchCostPerFile(filesPerMonth, costs = BRANCH_COSTS) {
  const n = Math.max(1, Number(filesPerMonth) || 1);
  return costs.fixedMonthly / n + costs.perFile;
}
// The highest LO split the branch can fund at this volume, after the team
// lead takes their share and the branch keeps its margin.
export function affordableSplit(filesPerMonth, net, year, costs = BRANCH_COSTS) {
  if (!net) return null;
  const need = (branchCostPerFile(filesPerMonth, costs) + costs.targetMarginPerFile) / net;
  return Math.max(0, 1 - teamLeadShare(year) - need);
}
// Rounded down to the nearest 2.5 points, so the published ladder is a
// clean number rather than 82.63%.
export function ladderCeiling(filesPerMonth, net, year, costs = BRANCH_COSTS) {
  const raw = affordableSplit(filesPerMonth, net, year, costs);
  return raw === null ? null : Math.floor(raw * 40) / 40;
}

// ─── THE SPLIT ON ONE FILE ─────────────────────────────────────────
// A contractual floor is a FLOOR, not a premium: it does not stack on top
// of ladder increases. Ana's signed 70% means she never earns less than
// 70%, not that she earns 70% plus every future raise.
export function loanSplit(file, ctx = {}) {
  const {
    year = 1, filesPerMonth = 8, leadSource = "self",
    trainerAssigned = false, costs = BRANCH_COSTS,
  } = ctx;
  const net = fileNet(file);
  const stage = file?.loStage || stageForVolume(file?.loFundedVolume, file?.isBM);
  const isBM = stage === "bm";
  const paulo = teamLeadShare(year);

  // The ladder LIFTS the published splits, it does not cap them. The first
  // version took min(stageBase, ceiling), which pinned Senior at 70% even
  // in year 3 when the branch could afford 82.5% — the raise never arrived.
  //
  // Lift is measured against the Senior base, and the Newbie does not
  // receive it: their split moves when they advance a stage, not when the
  // branch grows.
  const ceiling = ladderCeiling(filesPerMonth, net, year, costs);
  const lift = ceiling === null ? 0 : Math.max(0, ceiling - LO_STAGES.senior.split);
  const base = LO_STAGES[stage]?.split ?? 0.50;
  const floor = Number(file?.loSplitFloor) || 0;

  // The Branch Manager and the branch are the same pocket: whatever the
  // team lead does not take is theirs.
  const earned = isBM ? (1 - paulo)
                      : Math.max(floor, base + (stage === "newbie" ? 0 : lift));
  // El descuento de lead de la casa se aplica DESPUÉS del piso. El piso de
  // Ana es contractual sobre producción propia; los leads de la sucursal se
  // rigen por su propio acuerdo. Si el piso cubriera también los in-house,
  // el descuento nunca aplicaría a quien más leads recibe.
  const inHouse = !isBM && stage !== "newbie" && leadClassOf(file) === "in_house";
  const lo = inHouse ? Math.max(0, earned - IN_HOUSE_REDUCTION) : earned;

  const trainer = (!isBM && trainerAssigned) ? (TRAINER_RATES[stage] || 0) : 0;
  const branch = Math.max(0, 1 - lo - paulo - trainer);

  const cost = Math.round(branchCostPerFile(filesPerMonth, costs));
  const $ = p => Math.round(net * p);
  // Cada parte redondeada por separado no suma el todo: 85% y 15% de $4,950
  // dan $4,208 y $743, que son $4,951. El sobrante se asigna a la parte más
  // grande para que el request de payroll cuadre siempre con el NET.
  const cents = { lo: $(lo), trainer: $(trainer), branch: $(branch), paulo: $(paulo) };
  const residual = net - (cents.lo + cents.trainer + cents.branch + cents.paulo);
  if (residual !== 0) {
    const biggest = Object.keys(cents).reduce((a, k) => cents[k] > cents[a] ? k : a, "lo");
    cents[biggest] += residual;
  }
  return {
    net, stage, stageMeta: LO_STAGES[stage], leadSource, isBM,
    ceiling, lift, floor, earned,
    leadClass: leadClassOf(file), inHouseApplied: inHouse,
    leadPending: leadClassPending(file),
    inHousePoints: inHouse ? IN_HOUSE_REDUCTION : 0,
    floorApplied: !isBM && floor > base + (stage === "newbie" ? 0 : lift),
    floorOverriddenByLead: !isBM && inHouse && floor > lo,
    shares: { lo, trainer, branch, paulo },
    dollars: cents, roundingResidual: residual,
    costPerFile: cost,
    // Lo que cobra el BM en un archivo: la retención de la sucursal MÁS su
    // propio split cuando él fue el originador. Mostrar solo la retención
    // ponía $0 en cada archivo suyo y dejaba fuera el grueso de su ingreso.
    toBM: cents.branch + (isBM ? cents.lo : 0),
    // On a BM file there is no branch share to measure — the cost comes out
    // of the BM's own split, so it is reported against that instead.
    margin: isBM ? cents.lo - cost : cents.branch - cost,
    marginBasis: isBM ? "propio" : "sucursal",
    checksum: Number((lo + trainer + branch + paulo).toFixed(6)),
  };
}

// ─── DEDUCCIONES POR ARCHIVO ───────────────────────────────────────
// El catálogo de cargos que pueden salir del bruto antes de repartir. Por
// defecto los paga el cliente y el NET es igual al bruto; cuando el archivo
// los absorbe, todos los participantes los comparten en proporción a su
// split — incluido quien no tomó la decisión de absorberlos.
export const STANDARD_FEES = [
  { id: "broker",     es: "Broker fee (Barrett)",     en: "Broker fee (Barrett)",  amount: 695 },
  { id: "uw",         es: "Underwriting fee (lender)", en: "Underwriting fee",     amount: 1195 },
  { id: "processing", es: "Processing fee",            en: "Processing fee",       amount: 650 },
];

export function grossComp(file) {
  return Math.round(compBasisAmount(file) * fileCompBps(file) / 10000);
}

// Los ajustes tienen tipo explícito. Un crédito guardado como "descuento
// negativo" se lee al revés meses después; el signo va en el dato, no en la
// cabeza de quien lo mira.
export const ADJUSTMENT_KINDS = {
  fee:    { es: "Descuento", en: "Fee",    sign: -1, color: "#E85D75" },
  credit: { es: "Crédito",   en: "Credit", sign: +1, color: "#7EC8A4" },
};

// La cascada completa: bruto, cada ajuste con nombre y signo, y el neto.
export function feeWaterfall(file) {
  const gross = grossComp(file);
  const lines = (file?.absorbedFees || []).map(f => {
    const std = STANDARD_FEES.find(s => s.id === f.id);
    const kind = f.kind === "credit" ? "credit" : "fee";
    return {
      id: f.id, kind, sign: ADJUSTMENT_KINDS[kind].sign,
      es: f.label || std?.es || f.id, en: f.label || std?.en || f.id,
      amount: Math.abs(Number(f.amount) || 0),
    };
  }).filter(l => l.amount > 0);

  const fees = lines.filter(l => l.kind === "fee");
  const credits = lines.filter(l => l.kind === "credit");
  const deducted = fees.reduce((a, l) => a + l.amount, 0);
  const credited = credits.reduce((a, l) => a + l.amount, 0);
  const net = Math.max(0, gross - deducted + credited);
  return {
    gross, lines, fees, credits, deducted, credited,
    netChange: credited - deducted, net,
    bpsLost: Math.round((deducted - credited) / (file?.loan || 1) * 10000),
  };
}

export function setAbsorbedFees(file, fees) {
  // Un descuento sin nombre no entra: en el reparto aparecería como un monto
  // anónimo y nadie podría explicarlo tres meses después.
  return { ...file, absorbedFees: (fees || [])
    .filter(f => Math.abs(Number(f.amount)) > 0 &&
      (STANDARD_FEES.some(s => s.id === f.id) || String(f.label || "").trim()))
    .map(f => ({ ...f, kind: f.kind === "credit" ? "credit" : "fee",
                 amount: Math.abs(Number(f.amount) || 0) })) };
}

// Quién cobra cuánto en este archivo, con nombre y en dólares. Es la tabla
// que evita que alguien calcule sobre el bruto y se lleve una sorpresa.
export function payoutBreakdown(file, ctx = {}) {
  const w = feeWaterfall(file);
  const split = loanSplit(file, ctx);
  const names = ctx.names || {};
  const rows = [
    { id: "lo",      who: file?.lo || names.lo || "Originador", pct: split.shares.lo,      amount: Math.round(w.net * split.shares.lo) },
    { id: "trainer", who: names.trainer || "Trainer",           pct: split.shares.trainer, amount: Math.round(w.net * split.shares.trainer) },
    { id: "branch",  who: names.branch || "Sucursal",           pct: split.shares.branch,  amount: Math.round(w.net * split.shares.branch) },
    { id: "paulo",   who: names.teamLead || "Team Lead",        pct: split.shares.paulo,   amount: Math.round(w.net * split.shares.paulo) },
  ].filter(r => r.pct > 0);
  // Redondear cada parte por separado deja centavos sueltos: sobre un NET de
  // $7,829 las tres partes sumaban $7,828. El resto se asigna a la sucursal,
  // que es la que absorbe la diferencia en la vida real, para que las partes
  // siempre sumen exactamente el todo.
  const rounded = rows.reduce((a, r) => a + r.amount, 0);
  const residual = w.net - rounded;
  if (residual !== 0) {
    const target = rows.find(r => r.id === "branch") || rows[rows.length - 1];
    if (target) target.amount += residual;
  }

  return {
    ...w, split, rows,
    total: rows.reduce((a, r) => a + r.amount, 0),
    residual,
    // Lo que habría cobrado cada uno si el cálculo fuera sobre el bruto.
    // Se muestra para que la diferencia sea explícita y no un descubrimiento.
    onGross: rows.map(r => ({ ...r, amount: Math.round(w.gross * r.pct) })),
  };
}

// NET is gross commission less only the fees the BRANCH absorbs. When the
// borrower pays them — the normal case — NET equals gross.
export function fileNet(file) {
  const gross = Math.round((file?.loan || 0) * fileCompBps(file) / 10000);
  const absorbed = (file?.absorbedFees || []).reduce((a, f) => a + (Number(f?.amount) || 0), 0);
  return Math.max(0, gross - absorbed);
}

// ─── PAYROLL PERIODS ───────────────────────────────────────────────
// Barrett closes on the 1st and the 15th. A file funded on a cut-off date
// can be claimed in that period or held for the next — it is optional, and
// it stops being optional once payroll has been submitted for the period.
// Todo lo fondeado antes de esta fecha se liquidó bajo PRMG y no vuelve a
// entrar a payroll. Sin este corte, cada archivo cerrado en la historia de la
// sucursal aparecía como pendiente de reclamo.
export const BARRETT_CUTOVER = "2026-07-13";   // fecha real del NMLS

export const fundedDate = file => okDate(file?.fundedAt) || okDate(file?.closedAt) || null;

export function payrollPeriod(iso) {
  if (!isValidISO(iso)) return null;
  const y = iso.slice(0, 4), m = iso.slice(5, 7), d = Number(iso.slice(8, 10));
  return d <= 15 ? `${y}-${m}-A` : `${y}-${m}-B`;
}
// La fecha en que el dinero llega de verdad. Barrett paga con un periodo de
// atraso: lo fondeado del 1 al 15 de agosto se deposita el 1 de SEPTIEMBRE,
// no el 15 de agosto. El sistema decía "corte del 15" y el equipo esperaba el
// dinero dos semanas y media antes de tiempo.
export function payrollPayDate(id) {
  if (!id) return null;
  const [y, m, h] = id.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1 + 1, h === "A" ? 1 : 15));
  return localISO(d);
}

export function payrollPeriodLabel(id, lang = "es") {
  if (!id) return "—";
  const [y, m, h] = id.split("-");
  const rango = h === "A" ? `${m}/01–${m}/15` : `${m}/16–${m}/fin`;
  const pago = payrollPayDate(id);
  return lang === "en"
    ? `Funded ${rango}/${y} · paid ${pago}`
    : `Fondeado ${rango}/${y} · se paga ${pago}`;
}

// Etiqueta corta, para tablas donde no cabe la larga.
export function payrollPeriodShort(id, lang = "es") {
  if (!id) return "—";
  const [, m, h] = id.split("-");
  return `${m}${h === "A" ? "A" : "B"} → ${payrollPayDate(id)}`;
}

// ─── REQUISITOS DE BARRETT PARA PAGAR ──────────────────────────────
// Fondear no basta. Barrett paga cuando además recibió el cheque y los
// documentos están en Arive. Un archivo fondeado sin cheque no entra al
// corte, y el pipeline lo daba por cobrable.
export const PAYROLL_DOCS = [
  { id: "commission_worksheet", es: "Commission Worksheet",            en: "Commission Worksheet" },
  { id: "initial_disclosures",  es: "Initial Disclosures firmadas",     en: "Signed Initial Disclosures" },
  { id: "closing_package",      es: "Closing Package firmado",          en: "Signed Closing Package" },
  { id: "barrett_disclosures",  es: "Barrett Disclosures firmadas",     en: "Signed Barrett Disclosures" },
  { id: "lender_docs",          es: "Documentos que pide el lender",    en: "Lender-required documents" },
];

// Tolerante a lo que venga: la casilla guarda booleano, pero un backup viejo
// o una importación pueden traer 1, "true" o "x". Un requisito de pago no
// debería fallar por el formato del dato.
const marcado = v => v === true || v === 1 || v === "1" ||
  (typeof v === "string" && ["true","x","yes","si","sí"].includes(v.trim().toLowerCase()));

export const checkReceived = file => marcado(file?.brokerCheckReceived);
export const docsDone = file => {
  const c = file?.compliance || {};
  return PAYROLL_DOCS.filter(d => marcado(c[d.id])).length;
};
export const docsMissing = file => {
  const c = file?.compliance || {};
  return PAYROLL_DOCS.filter(d => !marcado(c[d.id]));
};

// Qué le falta a un archivo fondeado para poder cobrarse.
export function payrollBlockers(file) {
  const out = [];
  if (!checkReceived(file))
    out.push({ id: "check", es: "Falta el cheque de Barrett", en: "Broker check not received" });
  for (const d of docsMissing(file))
    out.push({ id: d.id, es: "Falta " + d.es, en: "Missing " + d.en });
  return out;
}
export const payrollReady = file => payrollBlockers(file).length === 0;
export function currentPayrollPeriod() { return payrollPeriod(today()); }

export const CLAIM_STATES = {
  unclaimed: { es: "Sin reclamar", en: "Unclaimed", color: "#F5A623" },
  claimed:   { es: "Reclamado",    en: "Claimed",   color: "#4A90D9" },
  paid:      { es: "Pagado",       en: "Paid",      color: "#7EC8A4" },
};

// Funded files that have not been submitted to payroll yet. The ones from
// earlier periods matter most: a file held back and then forgotten is
// money nobody ever misses, because it never appeared on a list.
// ─── REFERIDOS SALIENTES ───────────────────────────────────────────
// Un archivo que no se puede cerrar aquí se manda a otro banco y genera un
// fee de referido. Ese dinero se cobraba en un tablero pero nunca entraba a
// la lista de payroll, porque su fecha vive en referredOut.closeDate y no en
// el campo que lee el corte. Se ganaba y no se reclamaba.
export const REFERRAL_FEE_BPS_DEFAULT = 50;

// El fee de un archivo referido a otro banco es del LO. A veces se negocia
// una parte para la sucursal, a veces no — así que por defecto la sucursal
// no toma nada. Repartirlo con la escalera de comisiones, como hacía la
// primera versión, le quitaba al LO un dinero que nadie había acordado.
export const referralBranchPct = file =>
  Math.min(1, Math.max(0, Number(file?.referralBranchPct) || 0));

export const isReferredOut = file =>
  !!(file?.referredOut && file.referredOut.status === "Closed (Funded)");

export function referralFunded(file) {
  const ro = file?.referredOut;
  if (!ro || ro.status !== "Closed (Funded)") return null;
  const date = okDate(ro.closeDate) || okDate(file?.closedAt);
  if (!date) return null;
  const amount = Number(ro.finalLoanAmount) || Number(file?.loan) || 0;
  const bps = Number(file?.referralFeeBps) || REFERRAL_FEE_BPS_DEFAULT;
  return { date, amount, bps, fee: Math.round(amount * bps / 10000), banker: ro.bankerCompany || ro.bankerName || null };
}

export function unclaimedFiles(files, ctx = {}) {
  const now = currentPayrollPeriod();
  return (files || [])
    // La app guarda la fecha de fondeo en closedAt desde la tanda 1 — el
    // botón CLOSE pide "funded date" y la escribe ahí. Leer solo fundedAt
    // dejaba la lista vacía para todos los archivos existentes.
    .filter(f => {
      const d = fundedDate(f);
      if (!d || d < (ctx.cutover || BARRETT_CUTOVER)) return false;
      return (f.claimState || "unclaimed") === "unclaimed";
    })
    .map(f => {
      const per = payrollPeriod(fundedDate(f));
      const enriched = withLoContext(f, files, ctx.roster || {});
      const hit = rosterLookup(f.lo, ctx.roster || {});
      // Un archivo fondeado sin cheque o sin documentos no entra al corte de
      // Barrett. Se muestra igual —hay que ver qué está trabado— pero no se
      // puede meter en el request.
      const blockers = payrollBlockers(f);
      return { file: f, period: per, kind: "loan", rosterMissing: enriched.rosterMissing,
        blockers, ready: blockers.length === 0,
        split: loanSplit(enriched, { ...ctx, trainerAssigned: !!hit?.entry?.trainer }),
        stale: per < now };
    })
    .concat((files || []).filter(f => (f.claimState || "unclaimed") === "unclaimed")
      .map(f => ({ f, r: referralFunded(f) }))
      .filter(x => x.r && x.r.date >= (ctx.cutover || BARRETT_CUTOVER))
      .map(({ f, r }) => {
        const per = payrollPeriod(r.date);
        const enriched = withLoContext(f, files, ctx.roster || {});
        const hit = rosterLookup(f.lo, ctx.roster || {});
        // Sin reparto automático: el fee es del LO salvo lo que se negocie.
        const branchPct = referralBranchPct(f);
        const isOwn = !!(hit?.entry?.isBM || enriched.isBM);
        const toBM = Math.round(r.fee * branchPct) + (isOwn ? Math.round(r.fee * (1 - branchPct)) : 0);
        const split = {
          net: r.fee, isBM: isOwn, stageMeta: enriched.loStage ? LO_STAGES[enriched.loStage] : null,
          shares: { lo: 1 - branchPct, trainer: 0, branch: branchPct, paulo: 0 },
          dollars: { lo: Math.round(r.fee * (1 - branchPct)), trainer: 0,
                     branch: Math.round(r.fee * branchPct), paulo: 0 },
          toBM, floorApplied: false, margin: 0, checksum: 1,
        };
        return { file: f, period: per, kind: "referral", referral: r, branchPct,
          rosterMissing: false, blockers: [], ready: true, split, stale: per < now };
      }))
    .sort((a, b) => String(a.kind === "referral" ? a.referral.date : fundedDate(a.file))
      .localeCompare(String(b.kind === "referral" ? b.referral.date : fundedDate(b.file))));
}

// El volumen fondeado de cada LO, calculado de sus propios archivos cerrados.
// Sin esto todos calculaban como Newbie al 50%, porque ningún archivo trae
// la etapa escrita encima.
export function loVolumes(files) {
  const v = {};
  for (const f of files || []) {
    if (!fundedDate(f) || !f.lo) continue;
    v[f.lo] = (v[f.lo] || 0) + (Number(f.loan) || 0);
  }
  return v;
}

// Enriquece un archivo con la etapa de su LO antes de repartir.
// La búsqueda es tolerante al nombre: "Ana Plasencia" en el roster contra
// "Ana M Plasencia" en el sistema no encontraba nada, caía al cálculo
// automático, y a Ana la pagaba al 60% en vez de su 70% firmado. Un fallo
// de tecleo no puede cambiarle el cheque a nadie.
const normName = s => String(s || "").toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean);
function rosterLookup(name, roster) {
  if (!name) return null;
  if (roster[name]) return { key: name, entry: roster[name] };
  const want = normName(name);
  for (const k of Object.keys(roster)) {
    const have = normName(k);
    // Coincide si el nombre y el apellido de uno están contenidos en el otro.
    const a = new Set(want), b = new Set(have);
    const shared = [...b].filter(x => a.has(x));
    if (shared.length >= 2 && shared.length >= Math.min(want.length, have.length) - 1)
      return { key: k, entry: roster[k] };
  }
  return null;
}

export function withLoContext(file, files, roster = {}) {
  const vols = loVolumes(files);
  const hit = rosterLookup(file?.lo, roster);
  const r = hit?.entry || {};
  return {
    ...file,
    isBM: r.isBM ?? file?.isBM ?? false,
    loSplitFloor: r.floor ?? file?.loSplitFloor ?? 0,
    loFundedVolume: file?.loFundedVolume ?? (r.priorVolume || 0) + (vols[file?.lo] || 0),
    loStage: file?.loStage || r.stage || null,
    // Sin regla escrita, el reparto es una suposición. Se marca para que
    // nadie mire un número de dinero sin saber de dónde salió.
    rosterMissing: !hit,
    rosterKey: hit?.key || null,
  };
}

// Los LOs con archivos fondeados y sin regla de compensación.
export function losWithoutCompRule(files, roster = {}) {
  const names = new Set();
  for (const f of files || []) {
    if (!fundedDate(f) || !f.lo) continue;
    if (!rosterLookup(f.lo, roster)) names.add(f.lo);
  }
  return [...names];
}

export function payrollSummary(files, ctx = {}) {
  const rows = unclaimedFiles(files, ctx);
  const sum = k => rows.reduce((a, r) => a + (k === "toBM" ? r.split.toBM : r.split.dollars[k]), 0);
  const stale = rows.filter(r => r.stale);
  const blocked = rows.filter(r => !r.ready);
  return {
    period: currentPayrollPeriod(), rows, count: rows.length,
    blocked, blockedCount: blocked.length,
    blockedDollars: blocked.reduce((a, r) => a + r.split.toBM, 0),
    staleCount: stale.length,
    staleDollars: stale.reduce((a, r) => a + r.split.toBM, 0),
    branch: sum("branch"), lo: sum("lo"), trainer: sum("trainer"), paulo: sum("paulo"),
    toBM: sum("toBM"),
    net: rows.reduce((a, r) => a + r.split.net, 0),
    cost: rows.reduce((a, r) => a + r.split.costPerFile, 0),
  };
}

// ─── REQUEST DE PAYROLL ────────────────────────────────────────────
// La lista en pantalla no es un request. Barrett necesita saber a quién se
// le paga cuánto, así que el documento se agrupa por persona y no por
// archivo — y queda copia de lo que se mandó, porque dentro de dos meses
// nadie va a recordar qué entró en qué corte.
export function buildPayrollRequest(rows, { period, by, branch = {} } = {}) {
  const payees = new Map();
  const add = (name, role, file, amount, detail) => {
    if (!amount) return;
    const key = `${name}||${role}`;
    if (!payees.has(key)) payees.set(key, { name, role, lines: [], subtotal: 0 });
    const p = payees.get(key);
    p.lines.push({ ...detail, borrower: file.borrower, amount });
    p.subtotal += amount;
  };

  for (const r of rows) {
    const f = r.file, s = r.split;
    const detail = r.kind === "referral"
      ? { kind: "referral", loan: r.referral.amount, bps: r.referral.bps,
          net: r.referral.fee, date: r.referral.date, note: `referido · ${r.referral.banker || "banco externo"}` }
      : { kind: "loan", loan: f.loan, bps: fileCompBps(f), net: s.net, date: fundedDate(f),
          note: leadOrigin(f.leadOrigin)?.es || null };
    add(f.lo || "Sin asignar", "Originador", f, s.dollars.lo, { ...detail, pct: s.shares.lo });
    if (s.dollars.trainer) add(branch.trainer || "Trainer", "Trainer", f, s.dollars.trainer, { ...detail, pct: s.shares.trainer });
    if (s.dollars.branch)  add(branch.name || "Del Valle Lending", "Sucursal", f, s.dollars.branch, { ...detail, pct: s.shares.branch });
    if (s.dollars.paulo)   add(branch.teamLead || "Paulo Maria", "Team Lead", f, s.dollars.paulo, { ...detail, pct: s.shares.paulo });
  }

  const list = [...payees.values()].sort((a, b) => b.subtotal - a.subtotal);
  return {
    period: period || currentPayrollPeriod(),
    periodLabel: payrollPeriodLabel(period || currentPayrollPeriod()),
    generatedAt: today(), by: by || null,
    fileCount: rows.length,
    netTotal: rows.reduce((a, r) => a + (r.kind === "referral" ? r.referral.fee : r.split.net), 0),
    payees: list,
    total: list.reduce((a, p) => a + p.subtotal, 0),
  };
}

// Texto plano listo para pegar en un correo a payroll.
export function payrollRequestText(req, branchLine = "Del Valle Lending Co. · Barrett Financial Group · NMLS 181106") {
  const $ = n => "$" + n.toLocaleString();
  const L = [];
  L.push(`REQUEST DE PAYROLL — ${req.periodLabel}`);
  L.push(branchLine);
  L.push(`Generado ${req.generatedAt}${req.by ? " por " + req.by : ""}`);
  L.push("");
  L.push(`${req.fileCount} archivo${req.fileCount === 1 ? "" : "s"} · NET total ${$(req.netTotal)}`);
  L.push("");
  for (const p of req.payees) {
    L.push(`${p.name.toUpperCase()} — ${p.role}`);
    for (const ln of p.lines) {
      L.push(`  ${ln.date}  ${ln.borrower.padEnd(28).slice(0, 28)}  ${$(ln.net).padStart(9)}  ` +
             `${(ln.pct * 100).toFixed(1).padStart(5)}%  ${$(ln.amount).padStart(9)}` +
             (ln.kind === "referral" ? "  (fee de referido)" : ""));
    }
    L.push(`  ${"Subtotal".padEnd(30)}${" ".repeat(19)}${$(p.subtotal).padStart(9)}`);
    L.push("");
  }
  L.push(`TOTAL A DISTRIBUIR   ${$(req.total)}`);
  return L.join(String.fromCharCode(10));
}

export function markClaimed(file, periodId, by) {
  return {
    ...file, claimState: "claimed", claimedPeriod: periodId || currentPayrollPeriod(),
    claimedAt: today(), claimedBy: by || null,
  };
}
export function markPaid(file, by) {
  return { ...file, claimState: "paid", paidAt: today(), paidBy: by || null };
}

// ─── 2J. SCORECARD DE LENDERS ──────────────────────────────────────
// La pregunta que contesta: ¿con quién trabajar de verdad?
//
// El volumen colocado no lo dice. Un lender que recibe muchos archivos y
// los devuelve a mitad de camino cuesta más que uno que recibe pocos y los
// cierra. Lo que separa a los dos es la CATEGORÍA de las salidas: un archivo
// que se fue por el prestatario se habría ido de cualquier lender; uno que
// se fue por el lender es culpa suya y solo suya.
//
// Sin esa distinción, "Eleven nos tumbó tres archivos" y "esos clientes no
// calificaban en ningún lado" se ven igual en un reporte de volumen.
export function lenderScorecard(files, { cutover = null, minFiles = 1 } = {}) {
  const rows = new Map();
  const get = id => {
    if (!rows.has(id)) rows.set(id, {
      id, name: lenderById(id)?.name || id,
      placed: 0, funded: 0, active: 0, volume: 0, fundedVolume: 0,
      exits: 0, exitsLender: 0, exitsBorrower: 0, exitsProperty: 0, exitsOther: 0,
      daysWith: [], daysToClose: [], bps: [], compLost: 0,
      inbound: 0, reasons: {},
    });
    return rows.get(id);
  };

  for (const f of files || []) {
    if (cutover && fundedDate(f) && fundedDate(f) < cutover) continue;

    // Salidas: cada entrada del historial es un archivo que ESTE lender perdió.
    for (const h of f.lenderHistory || []) {
      if (h.from) {
        const r = get(h.from);
        r.exits++;
        const cat = h.category || "other";
        if (cat === "lender") r.exitsLender++;
        else if (cat === "borrower") r.exitsBorrower++;
        else if (cat === "property") r.exitsProperty++;
        else r.exitsOther++;
        if (h.reasonId) r.reasons[h.reasonId] = (r.reasons[h.reasonId] || 0) + 1;
        if (Number.isFinite(h.daysWithPrevLender)) r.daysWith.push(h.daysWithPrevLender);
        // Lo que costó la salida: solo cuenta si fue culpa del lender.
        if (cat === "lender" && Number.isFinite(h.compDeltaDollars) && h.compDeltaDollars < 0)
          r.compLost += Math.abs(h.compDeltaDollars);
      }
      if (h.to) get(h.to).inbound++;
    }

    if (!f.lenderId) continue;
    const r = get(f.lenderId);
    r.placed++;
    r.volume += Number(f.loan) || 0;
    const bps = fileCompBps(f, 0);
    if (bps) r.bps.push(bps);

    const funded = fundedDate(f);
    if (funded) {
      r.funded++;
      r.fundedVolume += Number(f.loan) || 0;
      if (okDate(f.lenderSince)) r.daysToClose.push(daysBetween(f.lenderSince, funded));
    } else if (f.stage) {
      r.active++;
    }
  }

  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const out = [...rows.values()].map(r => {
    // Pull-through: de los archivos que tocaron a este lender, cuántos cerró.
    const touched = r.funded + r.active + r.exits;
    return {
      ...r, touched,
      pullThrough: touched ? Math.round(100 * r.funded / touched) : null,
      // Solo las salidas por culpa del lender miden al lender.
      faultRate: touched ? Math.round(100 * r.exitsLender / touched) : null,
      avgDaysWith: avg(r.daysWith), avgDaysToClose: avg(r.daysToClose), avgBps: avg(r.bps),
      topReason: Object.entries(r.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    };
  }).filter(r => r.touched >= minFiles);

  // Ordenar por lo que importa: primero quien más cierra, luego quien menos falla.
  out.sort((a, b) => (b.funded - a.funded) || (a.exitsLender - b.exitsLender) || (b.volume - a.volume));
  return out;
}

// Concentración: qué parte de tu volumen vive en cada lender. Es la pregunta
// que se hace un LO al escoger — "ya le puse mucho a este, muevo el próximo".
// Un solo lender con demasiado peso es riesgo operativo, no eficiencia.
export function lenderConcentration(scorecard) {
  const total = scorecard.reduce((a, r) => a + (r.fundedVolume || 0), 0);
  return scorecard.map(r => ({
    ...r,
    sharePct: total ? Math.round(100 * (r.fundedVolume || 0) / total) : 0,
  }));
}

// Lo que el scorecard concluye, en una frase por lender.
export function lenderVerdict(r) {
  if (r.touched < 3) return { id: "thin", es: "Pocos datos todavía", en: "Not enough data yet", tone: "neutral" };
  if (r.exitsLender === 0 && r.pullThrough >= 80)
    return { id: "solid", es: "Cierra y no devuelve archivos", en: "Closes and does not send files back", tone: "good" };
  if (r.faultRate >= 30)
    return { id: "risky", es: "Devuelve demasiado por decisión suya", en: "Sends too much back on its own call", tone: "bad" };
  if (r.exitsLender > 0 && r.exitsLender <= 1)
    return { id: "ok", es: "Una salida por su cuenta — vigilar", en: "One exit on its own call — watch it", tone: "warn" };
  return { id: "mixed", es: "Mezclado", en: "Mixed", tone: "neutral" };
}


// ─── DESGLOSE POR PRODUCTO ─────────────────────────────────────────
// Un promedio general esconde lo que importa: un lender puede cerrar todo
// lo que le mandas en FHA y devolverte la mitad de los DSCR. La decisión
// real no es "¿con quién trabajo?" sino "¿a quién le mando ESTE archivo?".
//
// Se distingue lo que el lender OFRECE (del catálogo) de aquello en lo que
// tiene HISTORIAL contigo. Ofrecer un producto no es evidencia de nada.
export function lenderProductBreakdown(files, { cutover = null } = {}) {
  const map = new Map();
  const key = (lid, prod) => lid + "||" + prod;
  const get = (lid, prod) => {
    const k = key(lid, prod);
    if (!map.has(k)) map.set(k, {
      lenderId: lid, lenderName: lenderById(lid)?.name || lid, product: prod,
      placed: 0, funded: 0, active: 0, volume: 0,
      exits: 0, exitsLender: 0, days: [], bps: [],
    });
    return map.get(k);
  };

  for (const f of files || []) {
    if (cutover && fundedDate(f) && fundedDate(f) < cutover) continue;
    const prod = lenderProductKey(f?.type) || "other";

    for (const h of f.lenderHistory || []) {
      if (!h.from) continue;
      const r = get(h.from, prod);
      r.exits++;
      if ((h.category || "") === "lender") r.exitsLender++;
    }

    if (!f.lenderId) continue;
    const r = get(f.lenderId, prod);
    r.placed++;
    r.volume += Number(f.loan) || 0;
    const b = fileCompBps(f, 0);
    if (b) r.bps.push(b);
    const funded = fundedDate(f);
    if (funded) {
      r.funded++;
      if (okDate(f.lenderSince)) r.days.push(daysBetween(f.lenderSince, funded));
    } else r.active++;
  }

  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  return [...map.values()].map(r => {
    const touched = r.funded + r.active + r.exits;
    return { ...r, touched,
      pullThrough: touched ? Math.round(100 * r.funded / touched) : null,
      avgDays: avg(r.days), avgBps: avg(r.bps),
      offers: !!lenderById(r.lenderId)?.products?.[r.product] };
  }).filter(r => r.touched > 0);
}

// Vista al revés: dado un producto, con quién te ha ido mejor.
// `offersOnly` completa con lenders del catálogo que lo hacen pero con los
// que nunca has cerrado — para que la lista no se limite a lo ya probado.
export function productScorecard(files, product, { cutover = null, includeUntried = true } = {}) {
  const rows = lenderProductBreakdown(files, { cutover }).filter(r => r.product === product);
  const seen = new Set(rows.map(r => r.lenderId));
  const out = rows.map(r => ({ ...r, tried: true }));
  if (includeUntried) {
    for (const l of LENDERS) {
      if (seen.has(l.id) || !l.products?.[product]) continue;
      out.push({ lenderId: l.id, lenderName: l.name, product, tried: false,
        placed: 0, funded: 0, active: 0, exits: 0, exitsLender: 0, touched: 0,
        volume: 0, pullThrough: null, avgDays: null, avgBps: l.lenderPaidBps ?? null,
        offers: true });
    }
  }
  // Primero lo probado y que cierra; después lo que solo ofrece.
  out.sort((a, b) =>
    (b.tried - a.tried) ||
    ((b.pullThrough ?? -1) - (a.pullThrough ?? -1)) ||
    (b.funded - a.funded) ||
    ((b.avgBps ?? 0) - (a.avgBps ?? 0)));
  return out;
}

// Qué productos has trabajado, con volumen, para llenar el selector.
export function productsWorked(files, { cutover = null } = {}) {
  const m = new Map();
  for (const f of files || []) {
    if (cutover && fundedDate(f) && fundedDate(f) < cutover) continue;
    const k = lenderProductKey(f?.type) || "other";
    const e = m.get(k) || { product: k, files: 0, funded: 0 };
    e.files++;
    if (fundedDate(f)) e.funded++;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.files - a.files);
}


// ─── ESPECIALIDADES DEL CATÁLOGO ───────────────────────────────────
// El archivo de lenders guarda 17 categorías y cada una trae su sublista:
// no solo "hace non-QM" sino ITIN, DSCR, bank statement, P&L, foreign
// national. No solo "hace FHA" sino FICO 500, sin FICO, manual underwrite.
//
// La primera versión solo leía la lista de DPA e ignoraba las otras
// dieciséis. Aquí vale cualquier especialidad, que es lo que convierte el
// catálogo en una respuesta a "¿a quién le mando ESTE archivo?".
export const SPECIALTY_LABELS = {
  // DPA
  fha_dpa:{es:"FHA DPA",en:"FHA DPA"}, conventional_dpa:{es:"Conventional DPA",en:"Conventional DPA"},
  chenoa:{es:"Chenoa",en:"Chenoa"}, calhfa:{es:"CalHFA",en:"CalHFA"},
  state_bond_grants:{es:"Bonos y grants estatales",en:"State bonds & grants"},
  // Non-QM
  itin:{es:"ITIN",en:"ITIN"}, dscr:{es:"DSCR",en:"DSCR"},
  bank_statement:{es:"Bank statement",en:"Bank statement"},
  profit_and_loss:{es:"P&L",en:"P&L"}, foreign_national:{es:"Extranjero",en:"Foreign national"},
  wvoe:{es:"WVOE",en:"WVOE"}, stated_income:{es:"Ingreso declarado",en:"Stated income"},
  no_ratio:{es:"Sin ratio",en:"No ratio"},
  asset_depletion_utilization:{es:"Uso de activos",en:"Asset depletion"},
  recent_credit_events:{es:"Crédito reciente afectado",en:"Recent credit events"},
  non_warrantable_condo:{es:"Condo no warrantable",en:"Non-warrantable condo"},
  close_in_llc:{es:"Cierra en LLC",en:"Close in LLC"},
  cross_collateral_blanket:{es:"Garantía cruzada",en:"Cross collateral"},
  // FHA / VA
  down_to_500_fico:{es:"FICO desde 500",en:"FICO down to 500"},
  no_fico:{es:"Sin FICO",en:"No FICO"},
  manual_underwrite:{es:"Manual underwrite",en:"Manual underwrite"},
  tbd_underwrite:{es:"TBD underwrite",en:"TBD underwrite"},
  streamline:{es:"Streamline",en:"Streamline"}, irrrl:{es:"IRRRL",en:"IRRRL"},
  arm:{es:"ARM",en:"ARM"},
  // Convencional
  home_ready_possible:{es:"HomeReady / Home Possible",en:"HomeReady / Home Possible"},
  // Segundas
  heloc:{es:"HELOC",en:"HELOC"}, heloan:{es:"HELOAN",en:"HELOAN"},
  piggyback:{es:"Piggyback",en:"Piggyback"}, fixed_2nd:{es:"Segunda fija",en:"Fixed 2nd"},
  dscr_heloc:{es:"HELOC DSCR",en:"DSCR HELOC"},
  bank_statement_heloc:{es:"HELOC bank statement",en:"Bank statement HELOC"},
  st_lien_heloc:{es:"HELOC primera",en:"1st lien HELOC"},
  // Otros
  fix_n_flip:{es:"Fix & flip",en:"Fix & flip"}, ground_up:{es:"Construcción desde cero",en:"Ground up"},
  one_time_close:{es:"One-time close",en:"One-time close"},
  construction_to_perm:{es:"Construcción a permanente",en:"Construction to perm"},
  fha_203k:{es:"FHA 203k",en:"FHA 203k"}, homestyle_reno:{es:"HomeStyle Reno",en:"HomeStyle Reno"},
  physician:{es:"Médicos",en:"Physician"}, section_184:{es:"Section 184",en:"Section 184"},
  land_loans:{es:"Terrenos",en:"Land loans"},
  real_property:{es:"Propiedad real",en:"Real property"}, single_wide:{es:"Single wide",en:"Single wide"},
};
export const CATEGORY_LABELS = {
  dpa:{es:"DPA",en:"DPA"}, nonqm:{es:"Non-QM",en:"Non-QM"},
  fha:{es:"FHA",en:"FHA"}, va:{es:"VA",en:"VA"}, usda:{es:"USDA",en:"USDA"},
  conventional:{es:"Conventional",en:"Conventional"}, jumbo:{es:"Jumbo",en:"Jumbo"},
  second:{es:"Segundas y HELOC",en:"Seconds & HELOC"},
  construction:{es:"Construcción",en:"Construction"}, renovation:{es:"Renovación",en:"Renovation"},
  mfh:{es:"Manufacturada",en:"Manufactured"}, commercial:{es:"Comercial",en:"Commercial"},
  bridge:{es:"Bridge",en:"Bridge"}, other:{es:"Otros",en:"Other"},
  correspondent:{es:"Correspondent",en:"Correspondent"},
  reverse:{es:"Reverse",en:"Reverse"}, private:{es:"Privado",en:"Private"},
};
export const specialtyLabel = id => SPECIALTY_LABELS[id] ||
  { es: String(id).replace(/_/g," "), en: String(id).replace(/_/g," ") };
export const categoryLabel = id => CATEGORY_LABELS[id] ||
  { es: String(id), en: String(id) };

// Todas las especialidades que existen en el catálogo, con cuántos lenders
// las manejan. Ordenadas de más escasa a más común dentro de su categoría —
// las escasas son las que limitan tus opciones.
export function specialtyCatalog() {
  const cats = new Map();
  for (const l of LENDERS) {
    for (const [cat, list] of Object.entries(l.products || {})) {
      if (!Array.isArray(list)) continue;
      if (!cats.has(cat)) cats.set(cat, new Map());
      const m = cats.get(cat);
      for (const sp of list) m.set(sp, (m.get(sp) || 0) + 1);
    }
  }
  return [...cats.entries()].map(([cat, m]) => ({
    category: cat, label: categoryLabel(cat),
    lenders: LENDERS.filter(l => Array.isArray(l.products?.[cat]) && l.products[cat].length).length,
    specialties: [...m.entries()]
      .map(([id, n]) => ({ id, label: specialtyLabel(id), lenders: n }))
      .sort((a, b) => a.lenders - b.lenders),
  })).filter(c => c.specialties.length).sort((a, b) => b.lenders - a.lenders);
}

// Quién maneja una especialidad, con el historial que tengas en su categoría.
export function lendersBySpecialty(files, category, specialty, { cutover = null } = {}) {
  const perf = new Map();
  for (const r of lenderProductBreakdown(files, { cutover })) {
    if (r.product === category) perf.set(r.lenderId, r);
  }
  return LENDERS
    .filter(l => Array.isArray(l.products?.[category]) && l.products[category].includes(specialty))
    .map(l => {
      const p = perf.get(l.id);
      return {
        lenderId: l.id, name: l.name, bps: l.lenderPaidBps ?? null,
        borrowerPaidOnly: !!l.borrowerPaidOnly,
        correspondent: !!l.products?.correspondent,
        siblings: (l.products?.[category] || []).filter(x => x !== specialty),
        tried: !!p, funded: p?.funded ?? 0, touched: p?.touched ?? 0,
        pullThrough: p?.pullThrough ?? null, exitsLender: p?.exitsLender ?? 0,
        avgDays: p?.avgDays ?? null,
      };
    })
    .sort((a, b) => (b.tried - a.tried) ||
      ((b.pullThrough ?? -1) - (a.pullThrough ?? -1)) || ((b.bps ?? 0) - (a.bps ?? 0)));
}


// ─── DETALLE DE DPA ────────────────────────────────────────────────
// El catálogo de Barrett dice QUÉ programas maneja cada lender, pero no
// cómo son: ni el porcentaje, ni si se perdona, ni si es grant o segunda,
// ni si fija la tasa. Eso vive en las guías de cada lender.
//
// Este detalle se captura a mano y NO puede vivir en lenders2026.json:
// ese archivo se regenera desde el Excel de Barrett y borraría lo escrito.
// Se guarda aparte, junto al pipeline, con clave lenderId::programa.
export const DPA_STRUCTURES = {
  grant:             { es: "Grant",                  en: "Grant",
                       note_es: "No se devuelve nunca", note_en: "Never repaid" },
  forgivable_second: { es: "Segunda perdonable",     en: "Forgivable second",
                       note_es: "Se perdona al cumplir el plazo", note_en: "Forgiven after the term" },
  repayable_second:  { es: "Segunda pagadera",       en: "Repayable second",
                       note_es: "El cliente la devuelve", note_en: "The borrower repays it" },
  deferred_second:   { es: "Segunda diferida",       en: "Deferred second",
                       note_es: "Sin pagos hasta venta o refinanciamiento", en_note: "No payments until sale or refi",
                       note_en: "No payments until sale or refinance" },
};
export const dpaStructure = id => DPA_STRUCTURES[id] || null;

export const specKey = (lenderId, category, specialty) => `${lenderId}::${category}::${specialty}`;
// Las capturas viejas usaban lenderId::programa sin categoría. Se leen igual.
export const dpaKey = (lenderId, program) => `${lenderId}::${program}`;

// Un registro vacío. Los cinco primeros campos valen para las 88
// especialidades; los de DPA solo aparecen cuando la categoría es dpa.
export const emptySpecDetail = () => ({
  minFico: null, maxLtv: null, maxDti: null, reservesMonths: null,
  states: [],
  // solo DPA
  pct: null, pctOf: "purchase", structure: null,
  forgivenessMonths: null, fixesRate: null,
  // El aprendizaje sobre un lender se acumula: un overlay que aparece en
  // agosto y otro en noviembre son dos datos, no uno que reemplaza al otro.
  notes: [],
  updatedAt: null, updatedBy: null,
});
export const emptyDpaDetail = emptySpecDetail;

export const DPA_ONLY_FIELDS = ["pct","pctOf","structure","forgivenessMonths","fixesRate"];

export function specDetail(details, lenderId, category, specialty) {
  const d = details || {};
  return d[specKey(lenderId, category, specialty)] || d[dpaKey(lenderId, specialty)] || null;
}
export const dpaDetail = (details, lenderId, program) =>
  specDetail(details, lenderId, "dpa", program);

export function setSpecDetail(details, lenderId, category, specialty, patch, by) {
  const k = specKey(lenderId, category, specialty);
  const cur = specDetail(details, lenderId, category, specialty) || emptySpecDetail();
  const num = v => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)))
    ? null : Number(v);
  const next = { ...cur, ...patch };
  for (const f of ["minFico","maxLtv","maxDti","reservesMonths","pct","forgivenessMonths"])
    if (patch[f] !== undefined) next[f] = num(patch[f]);
  next.notes = Array.isArray(cur.notes) ? cur.notes : [];
  const txt = String(patch.newNote || "").trim();
  if (txt) next.notes = [...next.notes, { at: today(), by: by || null, text: txt }];
  delete next.newNote;
  next.updatedAt = today();
  next.updatedBy = by || null;
  const out = { ...(details || {}), [k]: next };
  // Si venía de una captura vieja sin categoría, se retira la clave anterior.
  if (category === "dpa" && out[dpaKey(lenderId, specialty)]) delete out[dpaKey(lenderId, specialty)];
  return out;
}
export const setDpaDetail = (details, lenderId, program, patch, by) =>
  setSpecDetail(details, lenderId, "dpa", program, patch, by);

export function specDetailCoverage(details, category) {
  const key = category || null;
  let total = 0;
  for (const l of LENDERS) {
    for (const [cat, list] of Object.entries(l.products || {})) {
      if (!Array.isArray(list)) continue;
      if (key && cat !== key) continue;
      total += list.length;
    }
  }
  const filled = Object.entries(details || {}).filter(([k, d]) => {
    if (!d) return false;
    if (key) {
      // Las claves nuevas llevan categoría; las viejas de DPA no la tienen.
      const nueva = k.includes("::" + key + "::");
      const vieja = key === "dpa" && k.split("::").length === 2;
      if (!nueva && !vieja) return false;
    }
    return d.minFico !== null || d.maxLtv !== null || d.pct !== null || d.structure ||
           (Array.isArray(d.notes) && d.notes.length);
  }).length;
  return { total, filled, pct: total ? Math.round(100 * filled / total) : 0 };
}
export const dpaDetailCoverage = details => specDetailCoverage(details, "dpa");

// Un resumen en una línea, para la fila del lender.
export function specDetailSummary(d, lang = "es", isDpa = false) {
  if (!d) return null;
  const es = lang === "es";
  const bits = [];
  if (isDpa) {
    if (d.pct !== null) bits.push(d.pct + "%");
    if (d.structure) bits.push((DPA_STRUCTURES[d.structure] || {})[lang] || d.structure);
    if (d.forgivenessMonths) bits.push(es ? `perdón a ${d.forgivenessMonths} meses` : `forgiven at ${d.forgivenessMonths} months`);
    if (d.fixesRate === true) bits.push(es ? "fija la tasa" : "fixes the rate");
  }
  if (d.minFico) bits.push("FICO " + d.minFico + "+");
  if (d.maxLtv) bits.push("LTV " + d.maxLtv + "%");
  if (d.maxDti) bits.push("DTI " + d.maxDti + "%");
  if (d.reservesMonths) bits.push(es ? `${d.reservesMonths} meses de reservas` : `${d.reservesMonths} months reserves`);
  if (Array.isArray(d.states) && d.states.length) bits.push(d.states.join("/"));
  const n = Array.isArray(d.notes) ? d.notes.length : 0;
  if (n) bits.push(es ? `${n} nota${n === 1 ? "" : "s"}` : `${n} note${n === 1 ? "" : "s"}`);
  return bits.length ? bits.join(" · ") : null;
}
export const dpaDetailSummary = (d, lang) => specDetailSummary(d, lang, true);



// ─── CARGOS FINANCIADOS · LA BASE DE LA COMISIÓN ───────────────────
// FHA, VA y USDA financian un cargo dentro del préstamo, así que el pagaré
// es mayor que el monto base. Arive paga la comisión sobre el TOTAL, y el
// pipeline la calculaba sobre el base — de ahí que los dólares no cuadraran
// entre los dos sistemas.
//
// En un FHA de $482,500 el UFMIP son $8,443.75 y a 312 bps eso es $263 por
// archivo que no se estaban reportando.
export const FINANCED_FEES = {
  fha:  { pct: 1.75, es: "UFMIP financiado",        en: "Financed UFMIP" },
  va:   { pct: 2.15, es: "Funding fee financiado",  en: "Financed funding fee" },
  usda: { pct: 1.00, es: "Guarantee fee financiado",en: "Financed guarantee fee" },
};

// El porcentaje que aplica. Se puede sobrescribir por archivo: el VA cambia
// según servicio y enganche, y a veces el cliente paga el UFMIP en efectivo
// en vez de financiarlo — en ese caso se pone 0.
export function financedFeePct(file) {
  const o = file?.financedFeePct;
  if (o !== undefined && o !== null && o !== "" && Number.isFinite(Number(o))) return Number(o);
  return FINANCED_FEES[baseProductOf(file?.type)]?.pct ?? 0;
}
export const financedFeeMeta = file => FINANCED_FEES[baseProductOf(file?.type)] || null;

export function financedFeeAmount(file) {
  const base = Number(file?.loan) || 0;
  return Math.round(base * financedFeePct(file)) / 100;
}

// El monto sobre el que se paga la comisión: base + lo financiado.
export function compBasisAmount(file) {
  return (Number(file?.loan) || 0) + financedFeeAmount(file);
}

// ─── PRODUCCIÓN POR PRODUCTO ───────────────────────────────────────
// Un préstamo pertenece a dos dimensiones a la vez: "NV HIP FHA" es DPA y
// es FHA. Contar solo una de las dos esconde la mitad de la mezcla, así que
// el reporte las separa y ambas suman el total.
export const BASE_PRODUCTS = [
  { id: "fha",          es: "FHA",          en: "FHA",          match: /\bfha\b/i },
  { id: "conventional", es: "Conventional", en: "Conventional", match: /conv/i },
  { id: "va",           es: "VA",           en: "VA",           match: /\bva\b|irrrl/i },
  { id: "usda",         es: "USDA",         en: "USDA",         match: /usda/i },
  { id: "nonqm",        es: "Non-QM",       en: "Non-QM",       match: /non-?qm|dscr|bank statement/i },
  { id: "jumbo",        es: "Jumbo",        en: "Jumbo",        match: /jumbo/i },
  { id: "second",       es: "Segunda / HELOC", en: "Second / HELOC", match: /heloc|second|piggyback/i },
];
export function baseProductOf(type) {
  const tipo = String(type || "");
  for (const p of BASE_PRODUCTS) if (p.match.test(tipo)) return p.id;
  return "other";
}
export const baseProductLabel = id =>
  BASE_PRODUCTS.find(p => p.id === id) || { es: "Otro", en: "Other" };

// Agrupa por lo que se le pase: una función que devuelve la clave.
function tally(files, keyOf, { cutover = null, bpsDefault = 150 } = {}) {
  const m = new Map();
  const get = k => {
    if (!m.has(k)) m.set(k, { key: k, funded: 0, fundedVolume: 0, comp: 0,
      active: 0, activeVolume: 0, loans: [] });
    return m.get(k);
  };
  for (const f of files || []) {
    const k = keyOf(f);
    if (k === null || k === undefined) continue;
    const d = fundedDate(f);
    if (d && cutover && d < cutover) continue;
    const r = get(k);
    const amt = Number(f.loan) || 0;
    if (d) {
      r.funded++; r.fundedVolume += amt;
      r.comp += fileCompDollars(f, bpsDefault);
      r.loans.push(amt);
    } else if (f.stage) { r.active++; r.activeVolume += amt; }
  }
  const totF = [...m.values()].reduce((a, r) => a + r.funded, 0);
  const totV = [...m.values()].reduce((a, r) => a + r.fundedVolume, 0);
  return [...m.values()].map(r => ({
    ...r,
    avgLoan: r.loans.length ? Math.round(r.fundedVolume / r.loans.length) : null,
    unitShare: totF ? Math.round(100 * r.funded / totF) : 0,
    volumeShare: totV ? Math.round(100 * r.fundedVolume / totV) : 0,
  })).sort((a, b) => b.fundedVolume - a.fundedVolume || b.funded - a.funded);
}

// Por producto base: FHA, Conventional, Non-QM…
export const productionByProduct = (files, opts = {}) =>
  tally(files, f => baseProductOf(f?.type), opts);

// Por grupo del tipo: Standard, NV — DPA, Refi… La función que traduce
// tipo→grupo vive en la interfaz, así que se recibe como parámetro.
export const productionByGroup = (files, groupOf, opts = {}) =>
  tally(files, f => groupOf(f?.type), opts);

// Por originador. `roster` completa a quien no tiene archivos: un LO en cero
// es un dato, no una ausencia, y es justo lo que un BM necesita ver.
export function productionByLo(files, opts = {}) {
  const rows = tally(files, f => f?.lo || null, opts);
  const seen = new Set(rows.map(r => r.key));
  for (const name of opts.roster || []) {
    if (seen.has(name)) continue;
    rows.push({ key: name, funded: 0, fundedVolume: 0, comp: 0, active: 0,
      activeVolume: 0, loans: [], avgLoan: null, unitShare: 0, volumeShare: 0 });
  }
  return rows;
}

// Comparación contra la mezcla planeada. `plan` es {claveDelGrupo: porcentaje}.
export function mixVsPlan(rows, plan) {
  if (!plan) return rows;
  return rows.map(r => {
    const target = plan[r.key];
    return { ...r, planPct: target ?? null,
      delta: target === undefined || target === null ? null : r.unitShare - target };
  });
}


// ─── SOCIOS REFERIDORES · UN SOLO NOMBRE ───────────────────────────
// El campo es texto libre y cada quien escribe distinto: "APG Realty Group",
// "APG REALTY", "Apg Realty Group" y "APG Realty" eran cuatro filas en el
// tablero con 29 archivos repartidos entre ellas.
//
// Tres capas, porque ninguna sola alcanza:
//   1. Normalizar   junta lo que solo cambia en mayúsculas o puntuación.
//   2. Autocompletar evita que nazcan variantes nuevas al escribir.
//   3. Alias        para lo que la máquina no puede saber: que "APG Realty"
//                   y "APG Realty Group" son el mismo, o que no lo son.
// "Client" entra aquí porque en un campo de socio referidor nunca distingue a
// nadie: "Smart Bee" y "Smart Bee Client" son el mismo. Lo mismo con las
// palabras de tipo de negocio.
const PALABRAS_GENERICAS =
  /\b(re|realty|real estate|realtor|group|team|llc|inc|corp|company|co|client|clients|cliente|clientes|partner|partners|mortgage|lending|loans|the|de|del)\b/g;

export function canonicalPartner(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(PALABRAS_GENERICAS, " ")
    .replace(/\s+/g, "");
}

// Agrupa los archivos por socio, ya unificado. `aliases` mapea clave
// canónica → nombre que se muestra, y también permite forzar separaciones.
export function partnerLeaderboard(files, { aliases = {}, cutover = null } = {}) {
  const g = new Map();
  for (const f of files || []) {
    const raw = String(f?.referralPartner || "").trim();
    if (!raw) continue;
    const key = aliases[raw] ? canonicalPartner(aliases[raw]) : canonicalPartner(raw);
    if (!key) continue;
    if (!g.has(key)) g.set(key, { key, variants: new Map(), files: 0, closed: 0,
      active: 0, fundedVolume: 0, activeVolume: 0 });
    const r = g.get(key);
    r.variants.set(raw, (r.variants.get(raw) || 0) + 1);
    r.files++;
    const amt = Number(f.loan) || 0;
    const d = fundedDate(f);
    if (d && (!cutover || d >= cutover)) { r.closed++; r.fundedVolume += amt; }
    else if (!d && f.stage) { r.active++; r.activeVolume += amt; }
  }
  return [...g.values()].map(r => {
    const vs = [...r.variants.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    return {
      ...r,
      // El nombre que se muestra: el más usado, y a igualdad el más completo.
      name: aliases["__display__" + r.key] || vs[0][0],
      variants: vs.map(([n, count]) => ({ name: n, count })),
      merged: vs.length > 1,
    };
  }).sort((a, b) => b.fundedVolume - a.fundedVolume || b.files - a.files);
}

// Nombres ya usados, para autocompletar y no crear variantes nuevas.
export function knownPartners(files) {
  const seen = new Map();
  for (const f of files || []) {
    const raw = String(f?.referralPartner || "").trim();
    if (!raw) continue;
    const k = canonicalPartner(raw);
    const cur = seen.get(k);
    if (!cur || raw.length > cur.length) seen.set(k, raw);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

// ─── 3. HOUSE HUNT — the 60-day track ──────────────────────────────
// APG Realty reassigns a buyer to another agent if they are not under
// contract in 60 days. So this is not a follow-up rhythm; it is a
// countdown with a real consequence for the referral partner.
//
// Two independent clocks run here:
//   contact clock — days since last touch, drives the 7-day cadence
//   search clock  — days in the phase, drives the escalation ladder
export const HOUSE_HUNT = {
  contactEveryDays: 7,
  alternate: ["client", "agent"],   // day 7 client, 14 agent, 21 client…
  ladder: [
    { day: 7,  level: "ok",       es: "Contacto de rutina",              en: "Routine contact" },
    { day: 15, level: "ok",       es: "Segundo contacto — confirmar búsqueda activa",
                                  en: "Second contact — confirm search is active" },
    { day: 30, level: "watch",    es: "Revisar presupuesto y expectativas con el cliente",
                                  en: "Review budget and expectations with the client" },
    { day: 45, level: "warn",     es: "Quedan 15 días del plazo de APG — llamar al agente",
                                  en: "15 days left on the APG window — call the agent" },
    { day: 60, level: "critical", es: "Plazo de APG cumplido — el agente puede perder al cliente",
                                  en: "APG window reached — the agent may lose this client" },
  ],
  letterExpiresDays: 90,
  creditExpiresDays: 120,
};

export function nextContactTarget(file) {
  const n = file?.contactCount || 0;
  return HOUSE_HUNT.alternate[n % HOUSE_HUNT.alternate.length];
}

export function houseHuntStatus(file) {
  const searching = daysInStage(file);
  const sinceContact = file?.lastContactAt ? daysBetween(file.lastContactAt) : null;
  let rung = null;
  for (const step of HOUSE_HUNT.ladder) if (searching !== null && searching >= step.day) rung = step;
  return {
    daysSearching: searching,
    daysSinceContact: sinceContact,
    contactDue: sinceContact === null || sinceContact >= HOUSE_HUNT.contactEveryDays,
    nextTarget: nextContactTarget(file),
    rung,
    level: rung ? rung.level : "ok",
    letterExpiresIn: file?.preApprovalLetterAt
      ? HOUSE_HUNT.letterExpiresDays - daysBetween(file.preApprovalLetterAt) : null,
    creditExpiresIn: file?.creditPulledAt
      ? HOUSE_HUNT.creditExpiresDays - daysBetween(file.creditPulledAt) : null,
  };
}

// When APG moves the buyer to a new agent, the 60-day window restarts
// with that agent. Without this the file stays permanently red and the
// team learns to ignore red — the worst thing that can happen to an alert.
export function restartHouseHuntWindow(file, newAgent) {
  return {
    ...file,
    stageEnteredAt: today(),
    lastContactAt: today(),
    contactCount: 0,
    agentHistory: [
      ...(file.agentHistory || []),
      { agent: file.referralPartner || null, endedAt: today(), reason: "60_day_window" },
    ],
    referralPartner: newAgent || file.referralPartner,
  };
}

// ─── 4. URGENCY ────────────────────────────────────────────────────
export function stageUrgency(file) {
  // En Pre-Qual manda el reloj de FASE. Los cinco relojes de etapa siguen
  // ahí para informar, pero no deciden el color: con seis relojes sobre el
  // mismo archivo, los rojos dejan de significar algo.
  if (inPreQual(file)) {
    const ld = leadStandard(file);
    if (ld.days !== null) return {
      level: ld.signal === "broken" ? "late" : ld.signal === "soon" ? "watch" : "normal",
      days: ld.days, lead: ld,
    };
  }
  const clock = stageClock(file?.stage, file);
  if (!clock) return { level: "normal", days: null };
  if (clock.houseHunt) {
    const hh = houseHuntStatus(file);
    return { level: hh.level === "ok" ? "normal" : hh.level, days: hh.daysSearching, houseHunt: hh };
  }
  const d = daysInStage(file);
  if (d === null) return { level: "unknown", days: null };
  if (d >= clock.late) return { level: "late", days: d, clock };
  if (d >= clock.warn) return { level: "watch", days: d, clock };
  return { level: "normal", days: d, clock };
}

// ─── 5. LENDER CHANGE REASONS ──────────────────────────────────────
// Split by category on purpose. "Declining income" follows the borrower
// to every lender on the list — moving the file fixes nothing. "Overlay"
// means the file was clean and this lender alone said no.
//
// Only LENDER-category losses belong in the scorecard. Mixing the two
// would let a hard borrower make a good lender look bad.
export const REASON_CATEGORIES = {
  borrower: { es: "Del prestatario", en: "Borrower",  note_es: "Viaja con el archivo a cualquier lender", note_en: "Follows the file to any lender" },
  lender:   { es: "Del lender",      en: "Lender",    note_es: "El archivo estaba limpio — este lender dijo no", note_en: "File was clean — this lender alone said no" },
  property: { es: "De la propiedad", en: "Property",  note_es: "Cambiar de lender no lo resuelve", note_en: "Changing lenders does not fix it" },
  other:    { es: "Otro",            en: "Other",     note_es: "No es rechazo", note_en: "Not a decline" },
};

export const LENDER_CHANGE_REASONS = [
  // ── BORROWER ──
  { id: "high_depreciation",      cat: "borrower", es: "Depreciación muy alta",                            en: "Depreciation too high" },
  { id: "voe_mismatch",           cat: "borrower", es: "Verificación de empleo (VOE) no coincide",         en: "Employment verification (VOE) does not match" },
  { id: "se_amend_no_deposits",   cat: "borrower", es: "Enmienda de self-employment sin respaldo en depósitos bancarios", en: "Self-employment amendment unsupported by bank deposits" },
  { id: "declining_income",       cat: "borrower", es: "Ingreso en descenso",                              en: "Declining income" },
  { id: "insufficient_reserves",  cat: "borrower", es: "Reservas insuficientes",                           en: "Insufficient reserves" },
  { id: "large_deposits",         cat: "borrower", es: "Large deposits sin explicar",                      en: "Large deposits unexplained" },
  { id: "employment_gaps",        cat: "borrower", es: "Gaps de empleo sin explicación",                   en: "Employment gaps unexplained" },
  { id: "business_under_2yr",     cat: "borrower", es: "Ingreso de negocio con menos de 2 años de historial", en: "Business income with less than 2 years of history" },
  { id: "active_disputes",        cat: "borrower", es: "Credit disputes activas",                          en: "Active credit disputes" },
  { id: "recent_bk_fc",           cat: "borrower", es: "Bankruptcy o foreclosure reciente",                en: "Recent bankruptcy or foreclosure" },
  { id: "coborrower_debts",       cat: "borrower", es: "Co-borrower o non-purchasing spouse con deudas altas", en: "Co-borrower or non-purchasing spouse with high debts" },

  // ── LENDER ──
  { id: "fico_below_min",         cat: "lender", es: "Credit score bajo el mínimo del lender (640)",       en: "Credit score below lender minimum (640)" },
  { id: "amended_taxes",          cat: "lender", es: "Enmiendas de taxes no aceptadas",                    en: "Amended tax returns not accepted" },
  { id: "dti_over_limit",         cat: "lender", es: "DTI o ratios que exceden el límite del lender",      en: "DTI or ratios exceed lender limit" },
  { id: "itin_not_accepted",      cat: "lender", es: "No acepta ITIN",                                     en: "ITIN not accepted" },
  { id: "short_ead",              cat: "lender", es: "Estatus migratorio o EAD con vencimiento corto",     en: "Immigration status or EAD expiring soon" },
  { id: "ead_expired_no_pending", cat: "lender", es: "ID o EAD vencido y no aceptan renovación en trámite", en: "ID or EAD expired, renewal in process not accepted" },
  { id: "manual_uw_required",     cat: "lender", es: "Requiere manual underwriting y el lender no lo hace", en: "Manual underwriting required, lender will not do it" },
  { id: "property_type",          cat: "lender", es: "Tipo de propiedad no aceptado",                      en: "Property type not accepted" },
  { id: "income_type",            cat: "lender", es: "Tipo de ingreso no aceptado",                        en: "Income type not accepted" },
  { id: "overlay",                cat: "lender", es: "Overlay del lender",                                 en: "Lender overlay" },
  { id: "pricing",                cat: "lender", es: "Pricing o tasa no competitiva",                      en: "Pricing or rate not competitive" },
  { id: "dpa_unavailable",        cat: "lender", es: "DPA agotado o suspendido",                           en: "DPA funds exhausted or suspended" },
  { id: "turn_times",             cat: "lender", es: "Tiempos de respuesta demasiado lentos",              en: "Turn times too slow" },
  { id: "loan_limit",             cat: "lender", es: "Límite de préstamo excedido",                        en: "Loan limit exceeded" },
  { id: "state_not_covered",      cat: "lender", es: "No opera en el estado",                              en: "Does not lend in this state" },

  // ── PROPERTY ──
  { id: "low_appraisal",          cat: "property", es: "Appraisal bajo el valor de compra",                en: "Appraisal below purchase price" },
  { id: "condo_not_approved",     cat: "property", es: "Condominio no aprobado o no garantizable",         en: "Condo not approved or non-warrantable" },
  { id: "title_hoa",              cat: "property", es: "Problema de título o de HOA",                      en: "Title or HOA issue" },

  // ── OTHER ──
  { id: "borrower_withdrew",      cat: "other", es: "El cliente se retiró",                                en: "Borrower withdrew" },
  { id: "contract_cancelled",     cat: "other", es: "Contrato cancelado",                                  en: "Contract cancelled" },
  { id: "client_chose_other",     cat: "other", es: "El cliente se fue con otro lender",                   en: "Client went with another lender" },
];

export const reasonById = id => LENDER_CHANGE_REASONS.find(r => r.id === id) || null;
export const reasonsByCategory = cat => LENDER_CHANGE_REASONS.filter(r => r.cat === cat);
export const isLenderFault = id => reasonById(id)?.cat === "lender";

// ─── 6. LENDER HISTORY ─────────────────────────────────────────────
export function changeLender(file, { lenderId, reasonId, notes, newClosingDate, notifyAgents }) {
  const prev = file.lenderId || null;
  const entry = {
    from: prev,
    to: lenderId,
    reasonId: reasonId || null,
    category: reasonById(reasonId)?.cat || null,
    notes: (notes || "").trim() || null,
    at: today(),
    daysWithPrevLender: file.lenderSince ? daysBetween(file.lenderSince) : null,
    stageWhenChanged: file.stage,
    agentsNotified: !!notifyAgents,   // step 2 turns this into a real record
  };
  return {
    ...file,
    lenderId,
    lenderSince: today(),
    lenderHistory: [...(file.lenderHistory || []), entry],
    closing: newClosingDate || file.closing,
    // fileOpenedAt is deliberately untouched. The file did not restart.
  };
}

// Filter the lender dropdown to those who actually do this product.
export function lendersForProduct(productKey, requiredCaps = []) {
  return LENDERS.filter(l => {
    const caps = l.products?.[productKey];
    if (!caps) return false;
    return requiredCaps.every(c => caps.includes(c));
  });
}
export const lenderById = id => LENDERS.find(l => l.id === id) || null;

// ─── 7. SPLIT BPS ──────────────────────────────────────────────────
// Two numbers that today's single `bps` field confuses into one:
//   lenderPaidBps  — what the lender pays. From the workbook. Not editable.
//   appliedBps     — what you actually took on this file. Editable DOWN only.
//
// COMPLIANCE NOTE: under the LO Comp Rule, lender-paid compensation is
// set by a plan for a period, not per loan. Confirm with Barrett
// compliance how this field may be used before the team relies on it.
export const BPS_ADJUST_REASONS = [
  { id: "improve_rate",     cat: "structure",    es: "Mejorar la tasa",                  en: "Improve the rate" },
  { id: "cover_costs",      cat: "structure",    es: "Cubrir costos de cierre",          en: "Cover closing costs" },
  { id: "adjust_dpa",       cat: "structure",    es: "Ajustar el DPA",                   en: "Adjust the DPA" },
  { id: "competition",      cat: "relationship", es: "Igualar a la competencia",         en: "Match competition" },
  { id: "long_term_client", cat: "relationship", es: "Cliente de largo plazo",           en: "Long-term client" },
  { id: "partner_referral", cat: "relationship", es: "Referido de socio",                en: "Partner referral" },
  { id: "smartbee",         cat: "relationship", es: "Referido de Smart Bee",             en: "Smart Bee referral" },
  { id: "other_courtesy",   cat: "relationship", es: "Otra cortesía al cliente",         en: "Other client courtesy" },
];

export const BPS_ADJUST_CATEGORIES = {
  structure:    { es: "Estructura del préstamo", en: "Loan structure" },
  relationship: { es: "Relación",                en: "Relationship" },
};

export function bpsCeiling(file) {
  return lenderById(file?.lenderId)?.lenderPaidBps ?? null;
}

// Enforces the ceiling. You can never take more than the lender pays.
export function setAppliedBps(file, value, reasonId) {
  const ceiling = bpsCeiling(file);
  const asked = parseInt(value, 10);
  if (!Number.isFinite(asked)) return file;
  const applied = ceiling !== null ? Math.min(asked, ceiling) : asked;
  const givenUp = ceiling !== null ? ceiling - applied : 0;
  return {
    ...file,
    appliedBps: applied,
    bpsGivenUp: givenUp,
    bpsAdjustReason: givenUp > 0 ? (reasonId || null) : null,
    bpsAdjustCategory: givenUp > 0
      ? (BPS_ADJUST_REASONS.find(r => r.id === reasonId)?.cat || null) : null,
    bpsCappedAt: ceiling,
  };
}

export function effectiveBps(file, branchDefault = 150) {
  return file?.appliedBps ?? bpsCeiling(file) ?? file?.bps ?? branchDefault;
}
export function compDollars(file, branchDefault = 150) {
  return Math.round((file?.loan || 0) * effectiveBps(file, branchDefault) / 10000);
}
export function compGivenUpDollars(file) {
  return Math.round((file?.loan || 0) * (file?.bpsGivenUp || 0) / 10000);
}

// ─── 7Z. DUPLICADOS ────────────────────────────────────────────────
// El sistema dejo entrar dos veces a la misma clienta: "YANET ARAFET
// CALDERIN" y "YANET ARAFET", con montos distintos y el telefono escrito
// de dos formas. Lo unico identico era el correo.
//
// Por eso el chequeo NO es por nombre. Un nombre hispano de dos
// apellidos se escribe de cuatro maneras distintas y ninguna coincide
// por igualdad. El correo y el telefono normalizados son estables.

export function normPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  // 1 al frente en numeros de 11 digitos: es el codigo de pais de EE.UU.
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export const normEmail = v => String(v || "").trim().toLowerCase();

// Nombre sin acentos, sin puntuacion y sin orden: "Zamora Cordova, Katia"
// y "KATIA ZAMORA CORDOVA" producen el mismo conjunto de palabras.
export function nameTokens(v) {
  return new Set(String(v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/).filter(w => w.length > 1));
}

// Un nombre contenido en el otro cuenta como sospecha: a "Yanet Arafet"
// le falta el apellido que si trae "Yanet Arafet Calderin".
export function nameOverlap(a, b) {
  const A = nameTokens(a), B = nameTokens(b);
  if (!A.size || !B.size) return false;
  const chico = A.size <= B.size ? A : B;
  const grande = A.size <= B.size ? B : A;
  let hits = 0;
  for (const w of chico) if (grande.has(w)) hits += 1;
  return hits === chico.size && chico.size >= 2;
}

export const DUP_REASONS = {
  email: { es: "mismo correo",   en: "same email",   strong: true  },
  phone: { es: "mismo teléfono", en: "same phone",   strong: true  },
  name:  { es: "mismo nombre",   en: "same name",    strong: false },
};

// Que otros archivos parecen ser esta misma persona. Devuelve el motivo
// para que quien decida vea POR QUE se parecen, no solo que se parecen.
export function duplicateMatches(candidate, files) {
  const em = normEmail(candidate?.email);
  const ph = normPhone(candidate?.phone);
  const out = [];
  for (const f of files || []) {
    if (!f || f.id === candidate?.id) continue;
    if (f.archived) continue;                       // archivado ya se decidio
    const reasons = [];
    if (em && normEmail(f.email) === em) reasons.push("email");
    if (ph && ph.length >= 10 && normPhone(f.phone) === ph) reasons.push("phone");
    if (nameOverlap(candidate?.borrower, f.borrower)) reasons.push("name");
    if (reasons.length) out.push({ file: f, reasons, strong: reasons.some(r => DUP_REASONS[r].strong) });
  }
  // Primero los que coinciden por correo o telefono, que son los seguros.
  return out.sort((a, b) => (b.strong ? 1 : 0) - (a.strong ? 1 : 0) || b.reasons.length - a.reasons.length);
}

// Barrido de todo el pipeline. Para encontrar los que YA entraron.
export function findDuplicates(files) {
  const seen = new Set();
  const grupos = [];
  for (const f of files || []) {
    if (!f || seen.has(f.id)) continue;
    const m = duplicateMatches(f, files).filter(x => !seen.has(x.file.id));
    if (!m.length) continue;
    seen.add(f.id);
    for (const x of m) seen.add(x.file.id);
    grupos.push({ files: [f, ...m.map(x => x.file)], reasons: [...new Set(m.flatMap(x => x.reasons))] });
  }
  return grupos;
}

// ─── 7Y. HALLAZGOS ─────────────────────────────────────────────────
// El problema real: las cosas salen al final cuando no debian. Tina
// encuentra un hueco de empleo sin carta, decide registrar igual porque
// el resto esta completo, y ese hallazgo se queda en su cabeza. El
// mensaje que le manda a la procesadora dice "listo". Tres semanas
// despues reaparece como condicion del underwriter.
//
// El hallazgo no falta por comunicacion. Falta porque NO TIENE DONDE
// VIVIR. Aqui vive: pegado al archivo, con quien lo vio, de quien se
// espera, y cuando se resolvio.
//
// Con cuatro personas mirando el mismo archivo, mas ojos NO reducen
// fallas por si solos — cada uno supone que otro ya lo levanto. Los ojos
// sirven solo si cada hallazgo tiene dueño con nombre. Por eso
// `waitingOn` nunca queda vacio.

// Los doce puntos de la pagina 2 del checklist de Barrett. Son los
// unicos que requieren que una persona abra un documento y mire; el
// resto de la forma son datos que el sistema ya sabe o captura una vez.
export const GATE1_ITEMS = [
  { id: "form_1003",     es: "1003 revisado y completo",       en: "1003 reviewed and completed" },
  { id: "residence",     es: "Residencia actual",              en: "Current residence" },
  { id: "residence_2y",  es: "Historial de vivienda · 2 años",  en: "Residence history · 2 years" },
  { id: "employment",    es: "Empleo completo",                en: "Employment completed" },
  { id: "employment_2y", es: "Historial de empleo · 2 años",    en: "Employment history · 2 years" },
  { id: "income",        es: "Ingresos completos",             en: "Income completed" },
  { id: "assets",        es: "Activos completos",              en: "Assets completed" },
  { id: "gift_letter",   es: "Carta de regalo",                en: "Gift letter" },
  { id: "donor_ability", es: "Capacidad del donante",          en: "Proof of donor ability" },
  { id: "declarations",  es: "Declaraciones completas",        en: "Declarations completed" },
  { id: "liabilities",   es: "Pasivos completos",              en: "Liabilities completed" },
  { id: "mi_verified",   es: "MI / MIP verificado",            en: "MI / MIP verified" },
  { id: "other",         es: "Otro",                           en: "Other" },
];
export const gate1Item = id => GATE1_ITEMS.find(x => x.id === id) || null;

// ─── 7Y2. VERIFICADO, NO SOLO ROTO ─────────────────────────────────
// La pagina 2 del checklist de Barrett son doce revisiones. Hasta aqui
// solo se les podia colgar un HALLAZGO — o sea que el sistema sabia
// registrar cuando algo salia mal y no tenia donde anotar que alguien
// reviso y salio bien.
//
// Y eso empujaba a usar el rojo al reves: se levantaba un "hallazgo" que
// decia "Done" para dejar constancia, el archivo caia en BLOQUEADO, y la
// procesadora abria un problema que no existia. Un rojo que a veces
// significa "listo" deja de significar nada.
//
// Cuatro estados, ningun color nuevo:
//   pendiente  gris    nadie lo ha mirado
//   verificado verde   se reviso y salio limpio
//   no aplica  gris    no hay regalo, no hay co-prestatario — el gris ya
//                      significa "estancado o SIN FUNCION"
//   hallazgo   rojo    hay algo abierto en ese punto
//
// El estado de hallazgo NO se guarda: se deriva de los hallazgos abiertos.
// Dos fuentes para el mismo hecho es como se desincronizan los datos.
export const GATE1_VERIFY_IDS = GATE1_ITEMS.filter(i => i.id !== "other").map(i => i.id);

export const GATE1_STATES = {
  pending:  { id: "pending",  es: "Pendiente",  en: "Pending",  signal: "idle" },
  verified: { id: "verified", es: "Verificado", en: "Verified", signal: "done" },
  na:       { id: "na",       es: "No aplica",  en: "N/A",      signal: "idle" },
  finding:  { id: "finding",  es: "Hallazgo",   en: "Finding",  signal: "broken" },
};
export const gate1Of = file =>
  (file?.gate1 && typeof file.gate1 === "object") ? file.gate1 : {};

export function gate1State(file, id) {
  // Un hallazgo abierto gana sobre cualquier marca: alguien reviso, salio
  // mal, y eso es lo que hay que ver.
  if (openFindings(file).some(f => f.item === id)) return "finding";
  const e = gate1Of(file)[id];
  if (!e) return "pending";
  return e.na ? "na" : "verified";
}
export const gate1StateMeta = file => id => GATE1_STATES[gate1State(file, id)];
export const gate1At = (file, id) => okDate(gate1Of(file)[id]?.at) || null;
export const gate1By = (file, id) => gate1Of(file)[id]?.by || null;

// Un toque gira: pendiente -> verificado -> no aplica -> pendiente. Tres
// estados en un boton, sin menu, porque la procesadora marca de a doce.
// Con un hallazgo abierto no se puede marcar: primero se resuelve.
export function cycleGate1(file, id, by) {
  if (!gate1Item(id) || id === "other") return file;
  if (gate1State(file, id) === "finding") return file;
  const cur = gate1Of(file)[id];
  const next = { ...gate1Of(file) };
  if (!cur) next[id] = { at: today(), by: by || null, na: false };
  else if (!cur.na) next[id] = { at: today(), by: by || null, na: true };
  else delete next[id];
  return { ...file, gate1: next };
}

export function gate1Coverage(file) {
  const s = GATE1_VERIFY_IDS.map(id => gate1State(file, id));
  return {
    total: GATE1_VERIFY_IDS.length,
    verified: s.filter(x => x === "verified").length,
    na: s.filter(x => x === "na").length,
    findings: s.filter(x => x === "finding").length,
    pending: s.filter(x => x === "pending").length,
    done: s.filter(x => x === "verified" || x === "na").length,
  };
}
export const gate1Complete = file => gate1Coverage(file).pending === 0
  && gate1Coverage(file).findings === 0;

// De quien se espera la solucion. Un hallazgo sin dueño es una queja.
export const FINDING_WAITING = {
  lo:        { es: "del LO",           en: "on the LO",        color: "#4A90D9" },
  borrower:  { es: "del prestatario",  en: "on the borrower",  color: "#F5A623" },
  processor: { es: "de procesamiento", en: "on processing",    color: "#BD65E8" },
  lender:    { es: "del lender",       en: "on the lender",    color: "#E85D75" },
  title:     { es: "de titulo",        en: "on title",         color: "#7EC8A4" },
};
export const WAITING_IDS = Object.keys(FINDING_WAITING);
export const waitingMeta = id => FINDING_WAITING[id] || null;

export const findingsOf = file => Array.isArray(file?.findings) ? file.findings : [];
export const openFindings = file => findingsOf(file).filter(f => !f.resolvedAt);
export const resolvedFindings = file => findingsOf(file).filter(f => !!f.resolvedAt);
export const hasOpenFindings = file => openFindings(file).length > 0;

// Un hallazgo se agrega, nunca se edita. Corregir el texto de ayer borra
// lo que de verdad se penso ayer, que es justo lo que sirve al revisar.
export function addFinding(file, { item, text, waitingOn, by }) {
  // `txt` y no `t`: la letra t ya es el helper bilingue al final del
  // archivo, y taparla aqui dispara no-shadow.
  const txt = String(text || "").trim();
  if (!txt) return file;
  const id = gate1Item(item) ? item : "other";
  // Si ese punto estaba marcado como verificado, la marca se retira: quien
  // levanta un hallazgo esta diciendo que la revision anterior fallo. Dejar
  // las dos cosas seria el archivo afirmando que algo esta bien y mal a la vez.
  const g = { ...gate1Of(file) };
  delete g[id];
  return {
    ...file,
    gate1: g,
    findings: [...findingsOf(file), {
      id: "fd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      item: id,
      text: txt,
      waitingOn: FINDING_WAITING[waitingOn] ? waitingOn : "lo",
      stage: file?.stage || null,
      at: today(), by: by || null,
      resolvedAt: null, resolvedBy: null, resolutionNote: null,
    }],
  };
}

// Resolver tampoco borra: marca. El hallazgo sigue en el archivo con su
// fecha de apertura y de cierre, que es lo que deja medir cuanto tardo.
export function resolveFinding(file, id, opts) {
  const o = opts || {};
  return {
    ...file,
    findings: findingsOf(file).map(f => (f.id !== id || f.resolvedAt) ? f : {
      ...f, resolvedAt: today(), resolvedBy: o.by || null,
      resolutionNote: String(o.note || "").trim() || null,
    }),
  };
}

// Cuantos dias lleva abierto, o cuantos tardo en cerrarse.
export const findingAge = f =>
  f?.resolvedAt ? daysBetween(f.at, f.resolvedAt) : (f?.at ? daysBetween(f.at) : null);

// El peor hallazgo abierto es el mas VIEJO. La antiguedad es la señal:
// uno de ayer es trabajo normal, uno de dos semanas es un archivo parado
// que nadie esta mirando.
export function worstFinding(file) {
  const abiertos = openFindings(file);
  if (!abiertos.length) return null;
  return [...abiertos].sort((a, b) => String(a.at).localeCompare(String(b.at)))[0];
}

// ─── 7T. ASISTENCIA AL ENGANCHE (DPA) ──────────────────────────────
// El catalogo viejo tenia 39 tipos de prestamo que eran DPA estatales:
// NV HIP, Home at Last, FL Hometown Heroes, TX TSAHC, AZ Home in Five,
// CO CHFA. Eso era de la epoca de PRMG como direct lender. Hoy la
// sucursal coloca DPA in-house de los lenders mayoristas.
//
// El error de fondo de aquel diseño: metia el DPA DENTRO del tipo de
// prestamo. Un "NV HIP FHA" dejaba de contar como FHA en los reportes,
// porque el tipo solo puede tener un valor.
//
// Un prestamo pertenece a DOS dimensiones a la vez: es FHA y lleva DPA.
// Por eso el tipo vuelve a ser lo que es —FHA, Conventional, VA— y el
// DPA se describe con atributos propios. Asi el mismo archivo cuenta en
// los dos lados y se puede preguntar "cuanto 3.5% perdonable cerre",
// que con nombres de programa no se puede.
//
// Y por atributos NO hay catalogo que mantener: el lender ya esta en el
// archivo, y el dia que aparezca un programa nuevo se describe con las
// mismas cuatro casillas sin registrar nada de antemano.

// El DPA NO lleva producto propio. Ese campo repetia el tipo de
// prestamo que ya esta arriba en el archivo, y el dia que los dos no
// coincidian —Conventional arriba, FHA DPA abajo— el reporte mentia sin
// que nadie se enterara.
//
// El producto base vive en un solo lugar: el tipo de prestamo. El DPA
// solo describe CUANTO y COMO SE DEVUELVE. El reporte los cruza, asi
// que "Conventional 5% pagadera" sigue saliendo identificado y contado
// aparte — sin una casilla que lo diga dos veces.
//
// De paso esto abre lo que antes no cabia: VA con DPA, USDA con DPA, o
// un Non-QM con asistencia. Con la casilla de producto solo existian
// dos opciones y todo lo demas quedaba fuera.

// Los porcentajes que se ofrecen de verdad. 3.5 existe porque cubre el
// enganche completo de FHA; 5 cubre enganche mas parte de los costos.
export const DPA_PCTS = [1, 2, 3, 3.5, 5];

// Como se devuelve. Es el eje que decide para que cliente sirve.
export const DPA_FORMS = [
  { id: "grant",      es: "Grant",              en: "Grant",
    note_es: "No se devuelve", note_en: "Never repaid" },
  { id: "forgivable", es: "Segunda perdonable", en: "Forgivable second",
    needsYears: true,
    note_es: "Se perdona al cumplir el plazo de pagos",
    note_en: "Forgiven once the payment term is met" },
  { id: "repayable",  es: "Segunda pagadera",   en: "Repayable second",
    note_es: "El cliente la paga cada mes", note_en: "The borrower repays it monthly" },
];
export const dpaForm = id => DPA_FORMS.find(f => f.id === id) || null;

export const dpaOf = file => (file?.dpa && typeof file.dpa === "object") ? file.dpa : {};
export const hasDpa = file => !!dpaOf(file).on;

export function setDpa(file, patch) {
  const cur = dpaOf(file);
  const next = { ...cur, ...patch };
  if (patch.on === false) return { ...file, dpa: { on: false } };
  next.on = true;
  // Los archivos de prueba pueden traer `product` de la version anterior.
  // Se retira para que no quede un campo huerfano contradiciendo al tipo.
  delete next.product;
  if (patch.pct !== undefined) {
    const n = Number(String(patch.pct).replace(/[^\d.]/g, ""));
    next.pct = Number.isFinite(n) && n > 0 ? n : null;
  }
  // Los años de perdon solo existen en la forma perdonable.
  if (next.form !== "forgivable") delete next.forgivenessYears;
  if (patch.forgivenessYears !== undefined) {
    const n = Number(patch.forgivenessYears);
    next.forgivenessYears = Number.isFinite(n) && n > 0 ? n : null;
  }
  return { ...file, dpa: next };
}

// La linea que se lee de un vistazo: "Conventional DPA 5% forgivable".
// El lender no va aqui — ya esta en el archivo.
export function dpaLabel(file, lang = "es") {
  if (!hasDpa(file)) return null;
  const d = dpaOf(file);
  const f = dpaForm(d.form);
  const bits = ["DPA"];
  if (d.pct) bits.push(d.pct + "%");
  if (f) bits.push((lang === "en" ? f.en : f.es).toLowerCase());
  if (d.form === "forgivable" && d.forgivenessYears)
    bits.push(lang === "en" ? `${d.forgivenessYears}yr` : `${d.forgivenessYears} años`);
  return bits.join(" · ");
}

// Que tan descrito esta. Producto y forma son lo minimo para poder
// contar; el porcentaje afina.
export const dpaComplete = file => {
  const d = dpaOf(file);
  return !!(d.on && d.form && d.pct);
};

// ─── PRODUCCION POR DPA ────────────────────────────────────────────
// La pregunta que contesta: que se esta vendiendo mas. No cuantos
// programas existen — cuales cierras tu.
export function productionByDpa(files, { cutover = null, bpsDefault = 150 } = {}) {
  const m = new Map();
  for (const f of files || []) {
    const d = dpaOf(f), con = hasDpa(f);
    // El producto sale del TIPO, no de una casilla del DPA. Y los
    // archivos SIN asistencia tambien salen en la tabla: "FHA sin DPA"
    // contra "FHA con 3.5% perdonable" es justo la comparacion util.
    const base = baseProductOf(f?.type);
    const key = [base, con ? (d.pct ?? "?") : "-", con ? (d.form || "?") : "-"].join("|");
    if (!m.has(key)) m.set(key, {
      key, base, dpa: con, pct: con ? (d.pct ?? null) : null,
      form: con ? (d.form || null) : null,
      funded: 0, fundedVolume: 0, comp: 0, active: 0, activeVolume: 0, days: [],
    });
    const r = m.get(key);
    const amt = Number(f.loan) || 0;
    const fecha = fundedDate(f);
    if (fecha) {
      if (cutover && fecha < cutover) continue;
      r.funded++; r.fundedVolume += amt;
      r.comp += fileCompDollars(f, bpsDefault);
      if (okDate(f.lenderSince)) r.days.push(daysBetween(f.lenderSince, fecha));
    } else if (f.stage) { r.active++; r.activeVolume += amt; }
  }
  const tot = [...m.values()].reduce((a, r) => a + r.funded, 0);
  return [...m.values()].map(r => ({
    ...r,
    avgDays: r.days.length ? Math.round(r.days.reduce((a, b) => a + b, 0) / r.days.length) : null,
    unitShare: tot ? Math.round(100 * r.funded / tot) : 0,
  })).sort((a, b) => b.funded - a.funded || b.fundedVolume - a.fundedVolume);
}

// Solo por forma, sin partir por porcentaje. Grant contra perdonable
// contra pagadera — la mezcla gruesa.
export const productionByDpaForm = (files, opts = {}) =>
  tally(files.filter(hasDpa), f => dpaOf(f).form || null, opts);

// Por estado. El dato ya se captura para el calculo de contingencias
// (NV y TX cuentan calendario, FL cuenta habiles), asi que esta vista
// no cuesta captura nueva.
export const productionByState = (files, opts = {}) =>
  tally(files, f => f?.state || "NV", opts);

// ─── 7U. CAMPOS DE ADMISION ────────────────────────────────────────
// El checklist de Barrett tiene 51 campos. Veintiuno los sabe el sistema
// y solo hay que imprimirlos; doce requieren que una persona abra un
// documento y mire. Estos DIECIOCHO son los que faltaban: nadie los
// escribe y la procesadora los reconstruye de los documentos en cada
// archivo.
//
// Valen doble. Primer comprador, ocupacion, tipo de propiedad y
// enganche son exactamente las preguntas que deciden que programa de
// DPA aplica. Se capturan una vez y sirven para el checklist Y para el
// sistema de decision de DPA.
//
// El LO ya hace estas preguntas para precalificar — las sabe antes del
// contrato. Aqui solo se escriben.
export const INTAKE_GROUPS = [
  { id: "property", es: "Propiedad", en: "Property" },
  { id: "borrower", es: "Prestatario", en: "Borrower" },
  { id: "loan",     es: "Prestamo", en: "Loan" },
];

// `dpa` marca los que alimentan la decision de DPA. `only` los condiciona
// a otro campo: el nombre del condominio no tiene sentido si no es condo.
export const INTAKE_FIELDS = [
  { id: "occupancy", group: "property", type: "pick", dpa: true,
    es: "Ocupacion", en: "Occupancy",
    opts: [
      { v: "primary",    es: "Primaria",   en: "Primary" },
      { v: "secondary",  es: "Segunda",    en: "Secondary" },
      { v: "investment", es: "Inversion",  en: "Investment" },
    ] },
  { id: "propertyType", group: "property", type: "pick", dpa: true,
    es: "Tipo de propiedad", en: "Property type",
    opts: [
      { v: "sfr",          es: "Casa sola",     en: "Single family" },
      { v: "condo",        es: "Condominio",    en: "Condo" },
      { v: "townhome",     es: "Townhome",      en: "Townhome" },
      { v: "manufactured", es: "Manufacturada", en: "Manufactured" },
      { v: "multi",        es: "2-4 unidades",  en: "2-4 units" },
    ] },
  { id: "condoName", group: "property", type: "text", only: { propertyType: "condo" },
    es: "Nombre del condominio", en: "Condo name" },
  { id: "condoUnit", group: "property", type: "text", only: { propertyType: "condo" },
    es: "Unidad #", en: "Unit #" },
  { id: "hoa", group: "property", type: "yesno",
    es: "HOA", en: "HOA",
    note_es: "Si tiene HOA, marcar PUD en el sistema",
    note_en: "If it has an HOA, flag PUD in the system" },
  { id: "address", group: "property", type: "text",
    es: "Direccion", en: "Address" },
  { id: "parcelNumber", group: "property", type: "text",
    es: "Parcela #", en: "Parcel #" },

  { id: "firstTimeBuyer", group: "borrower", type: "yesno", dpa: true,
    es: "Primer comprador", en: "First-time buyer" },
  { id: "coBorrower", group: "borrower", type: "text",
    es: "Co-prestatario", en: "Co-borrower" },
  { id: "creditFileNumber", group: "borrower", type: "text",
    es: "Reporte de credito #", en: "Credit report file #" },

  { id: "salesPrice", group: "loan", type: "money", dpa: true,
    es: "Precio de compra", en: "Sales price" },
  { id: "downPaymentPct", group: "loan", type: "pct", dpa: true,
    es: "Enganche %", en: "Down payment %" },
  { id: "loanTerm", group: "loan", type: "pick",
    es: "Plazo", en: "Term",
    opts: [{ v: "30", es: "30 años", en: "30 yr" },
           { v: "20", es: "20 años", en: "20 yr" },
           { v: "15", es: "15 años", en: "15 yr" }] },
  { id: "sellerConcessions", group: "loan", type: "money",
    es: "Concesiones del vendedor", en: "Seller concessions" },
  { id: "earnestMoney", group: "loan", type: "money",
    es: "Deposito de garantia", en: "Earnest money" },
  { id: "miRequired", group: "loan", type: "yesno",
    es: "MI requerido", en: "MI required" },
  { id: "miPct", group: "loan", type: "pct", only: { miRequired: "yes" },
    es: "MI %", en: "MI %" },
  { id: "purposeOfLoan", group: "loan", type: "pick",
    es: "Proposito del prestamo", en: "Purpose of loan",
    note_es: "Decide si la hoja de procesamiento dice PURCHASE o REFINANCE",
    note_en: "Decides whether the processing sheet says PURCHASE or REFINANCE",
    opts: [
      { v: "purchase",     es: "Compra",              en: "Purchase" },
      { v: "cashout",      es: "Refi con retiro",     en: "Cash-out refi" },
      { v: "rateterm",     es: "Refi sin retiro R/T", en: "No cash-out refi R/T" },
      { v: "construction", es: "Construccion",        en: "Construction" },
      { v: "other",        es: "Otro",                en: "Other" },
    ] },
  { id: "escrowWaiver", group: "loan", type: "yesno",
    es: "Waiver de escrows", en: "Escrow waiver" },
];
export const intakeField = id => INTAKE_FIELDS.find(f => f.id === id) || null;

export const intakeOf = file => (file?.intake && typeof file.intake === "object") ? file.intake : {};
export const intakeValue = (file, id) => {
  const v = intakeOf(file)[id];
  return v === undefined || v === "" ? null : v;
};

// Un campo condicionado no aplica hasta que su condicion se cumple. Un
// campo que no aplica NO cuenta como incompleto: pedir el nombre del
// condominio en una casa sola es ruido, no un dato faltante.
export function intakeApplies(file, id) {
  const f = intakeField(id);
  if (!f?.only) return true;
  return Object.entries(f.only).every(([k, want]) => String(intakeValue(file, k)) === String(want));
}
export const intakeVisible = file => INTAKE_FIELDS.filter(f => intakeApplies(file, f.id));

// Los numeros se guardan como numero, no como texto: "450000" y 450000
// se comparan distinto y el dia que alguien filtre por precio se rompe.
export function setIntake(file, id, value) {
  const f = intakeField(id);
  if (!f) return file;
  let v = value;
  if (v === "" || v === null || v === undefined) v = null;
  else if (f.type === "money" || f.type === "pct") {
    const n = Number(String(v).replace(/[^\d.]/g, ""));
    v = Number.isFinite(n) ? n : null;
  }
  const next = { ...intakeOf(file), [id]: v };
  // Al cambiar el campo que condiciona, se limpia lo que dejo de aplicar.
  for (const c of INTAKE_FIELDS) {
    if (!c.only || !(id in c.only)) continue;
    if (String(v) !== String(c.only[id])) delete next[c.id];
  }
  return { ...file, intake: { ...next, updatedAt: today() } };
}

export function intakeCompleteness(file) {
  const aplican = intakeVisible(file);
  const llenos = aplican.filter(f => intakeValue(file, f.id) !== null);
  return { total: aplican.length, filled: llenos.length,
    pct: aplican.length ? Math.round(100 * llenos.length / aplican.length) : 0 };
}

// Lo que el sistema de DPA necesita saber. Se separa porque un archivo
// puede tener admision a medias y aun asi poder decidir el programa.
export const dpaReady = file =>
  INTAKE_FIELDS.filter(f => f.dpa && intakeApplies(file, f.id))
    .every(f => intakeValue(file, f.id) !== null);

export const isCondo = file => intakeValue(file, "propertyType") === "condo";

// Un MI de 55 es un decimal que se cayo: 0.55 se convirtio en 55. El
// seguro hipotecario nunca pasa de un dígito, asi que cualquier cosa
// arriba de 10 es error de tecleo, no un caso raro.
export const miLooksWrong = file => {
  const v = intakeValue(file, "miPct");
  return v !== null && Number(v) > 10;
};

// ─── EL ENGANCHE ───────────────────────────────────────────────────
// El campo dice "Enganche %" y alguien escribio 32000 — el enganche en
// DOLARES de una casa de $640,000. En el checklist de Barrett salio
// "Other 32000%" y ninguna casilla marcada.
//
// El fallo no es de quien lo escribio: es del campo, que pedia un
// porcentaje sin decir que pasaba si le daban otra cosa. El MI ya tenia
// su guardia desde el dia del decimal caido; el enganche no tenia ninguno.
//
// Y aqui hay algo mejor que un aviso: el sistema YA SABE la respuesta.
// Con precio y monto del prestamo el porcentaje se calcula solo.
export function downPaymentFromAmounts(file) {
  const precio = Number(intakeValue(file, "salesPrice")) || 0;
  const prestamo = Number(file?.loan) || 0;
  if (precio <= 0 || prestamo <= 0 || prestamo > precio) return null;
  return Math.round(((precio - prestamo) / precio) * 1000) / 10;   // un decimal
}

// Arriba de 100 es imposible; arriba de 50 no existe en esta sucursal.
export const downPaymentLooksWrong = file => {
  const v = intakeValue(file, "downPaymentPct");
  return v !== null && Number(v) > 50;
};

// El porcentaje que de verdad se imprime: lo capturado si es creible, y
// si no, lo calculado. Un dato malo no debe llegar al papel de Barrett.
export function downPaymentPct(file) {
  const v = intakeValue(file, "downPaymentPct");
  if (v !== null && Number(v) > 0 && Number(v) <= 50) return Number(v);
  return downPaymentFromAmounts(file);
}

// ─── PROJECTED COE ─────────────────────────────────────────────────
// La forma de Barrett lo pide y en el PDF salia SIEMPRE en blanco: le
// pasabamos cadena vacia. `closingOutlook` sabia calcularlo, pero lee
// `file.contractDate` — un campo que no existe en este modelo, porque el
// nuestro es `contingencies.contractAccepted`. Nunca se conectaron.
//
// Es la fecha en que el archivo cerraria al ritmo INTERNO del producto,
// contra la que dice el contrato. La distancia entre las dos es el colchon.
export function projectedCoe(file) {
  const ancla = okDate(file?.contingencies?.[CONTINGENCY_ANCHOR_FIELD]);
  return ancla ? addDays(ancla, targetsFor(file).internal) : null;
}

// Dias de colchon contra el COE del contrato. Negativo = el contrato pide
// mas rapido de lo que el producto da.
export function coeCushionDays(file) {
  const proy = projectedCoe(file);
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  if (!proy || !coe) return null;
  return coe >= proy ? daysBetween(proy, coe) : -daysBetween(coe, proy);
}

// ─── 7W. PEDIDOS A VENDORS ─────────────────────────────────────────
// Martha ordena titulo, HOI y tasacion el MISMO DIA que recibe el
// archivo — su "one day, one shot". En sus ocho archivos, la fecha de
// titulo y la de HOI son la misma o van a un dia habil de distancia.
//
// Estos cinco pedidos son las unicas columnas de su Excel que stageLog
// NUNCA va a poder saber. Un avance de etapa no sabe que llego el
// binder de HOI, ni que se firmaron las divulgaciones del investor, ni
// que se pidieron los docs del condominio. Si ella los toca aqui, esas
// columnas se llenan solas y nadie las teclea.
//
// Dos fechas por pedido, no una: pedido y recibido. En su hoja escribe
// "REQ 07/17" y despues lo cambia a "RECEIVED 07/28" — o sea que ya
// distingue los dos momentos, solo que pisando el dato anterior.
export const ORDERS = [
  { id: "title",      col: 14, es: "Titulo y fees",     en: "Title and fees" },
  { id: "hoi_quote",  col: 15, es: "HOI quote",         en: "HOI quote" },
  { id: "hoi_binder", col: 16, es: "HOI binder",        en: "HOI binder" },
  { id: "appraisal",  col: 20, es: "Tasacion",          en: "Appraisal" },
  { id: "condo_docs", col: 21, es: "Docs de condominio",en: "Condo docs" },
];
export const orderById = id => ORDERS.find(o => o.id === id) || null;

// Los tres que salen de un tiro el dia del registro. El binder llega
// despues (lo manda la aseguradora) y los docs de condominio solo
// aplican si la propiedad es condominio.
export const ONE_SHOT_ORDERS = ["title", "hoi_quote", "appraisal"];

export const ordersOf = file => (file?.orders && typeof file.orders === "object") ? file.orders : {};

export function orderState(file, id) {
  const o = ordersOf(file)[id] || {};
  const req = okDate(o.req), rec = okDate(o.rec);
  return {
    id, req, rec,
    state: rec ? "received" : req ? "ordered" : "pending",
    // Cuantos dias lleva esperando al vendor, o cuantos tardo en llegar.
    days: req ? (rec ? daysBetween(req, rec) : daysBetween(req)) : null,
    by: o.by || null, recBy: o.recBy || null,
    due: okDate(o.due) || null,
    note: o.note || null, noteAt: o.noteAt || null, noteBy: o.noteBy || null,
  };
}
export const allOrderStates = file => ORDERS.map(o => orderState(file, o.id));

// Los pedidos que ya se hicieron y siguen sin llegar. Es la cola de
// "esperando vendor" de la procesadora.
export const pendingOrders = file =>
  allOrderStates(file).filter(o => o.state === "ordered");

// Un toque estampa hoy. `which` es "req" o "rec". No se puede recibir
// algo que no se pidio: marcar recibido tambien estampa el pedido, con
// la misma fecha, porque un recibido sin pedido deja el dato cojo.
export function stampOrder(file, id, which, by) {
  if (!orderById(id)) return file;
  const prev = ordersOf(file)[id] || {};
  const hoy = today();
  const next = which === "rec"
    ? { ...prev, req: okDate(prev.req) || hoy, rec: hoy, recBy: by || null }
    : { ...prev, req: hoy, by: by || null };
  return { ...file, orders: { ...ordersOf(file), [id]: next } };
}

// La fecha que PROMETE el vendor, en el futuro. No es un toque de hoy: sale
// del correo del tasador y hay que escogerla. Una vez capturada, el sistema
// puede decir que el tasador se paso de su propia promesa — hoy nadie lo mide.
export function setOrderDue(file, id, iso) {
  if (!orderById(id)) return file;
  const prev = ordersOf(file)[id] || {};
  return { ...file, orders: { ...ordersOf(file), [id]: { ...prev, due: okDate(iso) || null } } };
}
export const orderDue = (file, id) => okDate(ordersOf(file)[id]?.due) || null;

// El vendor prometio una fecha y no llego. Rojo, no dorado: se rompio.
export function orderPastDue(file, id) {
  const o = orderState(file, id);
  const d = orderDue(file, id);
  return !!(d && !o.rec && d < today());
}

// Lo que el vendor contesto. "Titulo dice tres dias mas" no cabe en una
// fecha, y sin este campo termina en un correo o en la cabeza de nadie —
// que es el mismo agujero que tapamos con los hallazgos.
export function setOrderNote(file, id, texto, by) {
  if (!orderById(id)) return file;
  const prev = ordersOf(file)[id] || {};
  // `txt` y no `t`: la letra t es el helper bilingue del final del archivo.
  const txt = String(texto || "").trim();
  return { ...file, orders: { ...ordersOf(file), [id]: {
    ...prev, note: txt || null, noteAt: txt ? today() : null,
    noteBy: txt ? (by || null) : null,
  } } };
}

// Quitar un sello puesto por error. Solo el ultimo: si se borra el
// pedido y queda el recibido, el dato queda imposible.
export function clearOrder(file, id, which) {
  const prev = ordersOf(file)[id];
  if (!prev) return file;
  const next = which === "rec"
    ? { ...prev, rec: null, recBy: null }
    : { req: null, by: null, rec: null, recBy: null };
  return { ...file, orders: { ...ordersOf(file), [id]: next } };
}

// El "one shot": titulo, HOI y tasacion pedidos de un tiro. Es la
// conducta de Martha convertida en boton — y lo que Laura tiene que
// aprender de ella.
export function stampOneShot(file, by) {
  let out = file;
  for (const id of ONE_SHOT_ORDERS) {
    if (orderState(out, id).state === "pending") out = stampOrder(out, id, "req", by);
  }
  return out;
}
export const oneShotDone = file =>
  ONE_SHOT_ORDERS.every(id => orderState(file, id).state !== "pending");

// ─── 7X. REGISTRO CON EL LENDER ────────────────────────────────────
// Tina registra en Arive y Arive asigna la procesadora en ese mismo
// acto. En la hoja de Martha, "File Assigned to LOA/Processor" y "Loan
// Registered Date" son la MISMA fecha en las ocho filas, sin excepcion.
// Un evento, no dos.
//
// El registro no es una etapa: un archivo no se queda "en registrado" ni
// un dia. Es una marca dentro de Full Application, igual que en su hoja
// es una columna de fecha y no una columna de estado.
export const REGISTRATION_STAGE = "Full Application";
export const AFTER_REGISTRATION_STAGE = "Initial Disclosures Sent";

// ─── EL REGISTRO NO ES UNO SOLO ────────────────────────────────────
// Un archivo que cambia de lender vuelve a Tina y se registra OTRA VEZ:
// lender nuevo, fecha de registro nueva, divulgaciones nuevas que el
// prestatario tiene que volver a firmar. Con un campo plano
// `registeredAt` la segunda vez pisaba a la primera —o peor, no se
// escribia nunca— y tres columnas de la hoja de Martha se quedaban
// describiendo un lender que ya no esta en el archivo.
//
// Por eso es una SERIE: una entrada por cada vez que se registra. La
// hoja lee siempre la ultima; el historial completo queda para saber
// cuantas veces se re-registro y con quien.
export function registrationsOf(file) {
  const arr = Array.isArray(file?.registrations) ? file.registrations : null;
  if (arr && arr.length) return arr;
  // Siembra para los archivos que ya existen, y SOLO para esos.
  //
  // Entrar a Full Application NO es haberse registrado: es la etapa donde
  // Tina registra, no la prueba de que lo hizo. Sembrar desde ahi le daba
  // por registrado a todo archivo nuevo y le escondia el boton — el mismo
  // agujero que este bloque existe para tapar. La fecha de etapa solo vale
  // como respaldo cuando el archivo YA PASO de Full Application, porque
  // entonces el registro tuvo que ocurrir para poder avanzar.
  const idx = ALL_STAGE_ORDER.indexOf(file?.stage);
  const yaPaso = (idx > -1 && idx > ALL_STAGE_ORDER.indexOf(REGISTRATION_STAGE))
    || !!okDate(file?.closedAt);
  const at = okDate(file?.registeredAt)
    || (yaPaso ? okDate(stageLogOf(file)[REGISTRATION_STAGE]) : null);
  if (!at) return [];
  return [{
    lenderId: file?.lenderId || null,
    lenderName: lenderNameOf(file),
    at, by: file?.registeredBy || null,
    discSentAt: okDate(stageLogOf(file)[AFTER_REGISTRATION_STAGE]) || null,
    discEsignedAt: null,
    seeded: true,
  }];
}

export function currentRegistration(file) {
  const a = registrationsOf(file);
  return a.length ? a[a.length - 1] : null;
}
export const registrationCount = file => registrationsOf(file).length;

// Registrado CON EL LENDER QUE TIENE HOY. Un archivo que cambio de lender
// tiene ciclos viejos y NO esta registrado: le toca volver a Tina.
export function isRegistered(file) {
  const r = currentRegistration(file);
  return !!r && (r.lenderId || null) === (file?.lenderId || null);
}

// Un ciclo abierto SIN lender no es "otro lender": es un dato que falta.
// Sin esta salvedad, el archivo de prueba que se registro en blanco
// gritaria "cambio de lender" el dia que se le asigne uno de verdad.
export const registrationLenderUnknown = file => {
  const r = currentRegistration(file);
  return !!r && !r.lenderId;
};

// Hubo registro antes, pero con otro lender. Es el estado que la pantalla
// tiene que gritar: el archivo retrocedio y espera a Tina.
export const needsReRegistration = file =>
  registrationCount(file) > 0 && !isRegistered(file) && !registrationLenderUnknown(file);

export const registeredAt = file => okDate(currentRegistration(file)?.at) || null;
export const registeredBy = file => currentRegistration(file)?.by || null;
export const discSentAt = file => okDate(currentRegistration(file)?.discSentAt) || null;
export const discEsignedAt = file => okDate(currentRegistration(file)?.discEsignedAt) || null;

export const canRegister = file =>
  file?.stage === REGISTRATION_STAGE && !isRegistered(file) && !file?.archived;

// Registrar es registrar CON ALGUIEN. Sin lender el ciclo nace con
// lenderId null, y el dia que se asigne el lender de verdad el sistema
// gritaria "cambio de lender" sobre un archivo que solo llenaba un campo
// vacio. El boton no se esconde: se queda apagado diciendo que falta.
export function hasLender(file) {
  const id = file?.lenderId;
  if (!id) return false;
  if (id === OTHER_LENDER_ID) return !!String(file?.lenderOther || "").trim();
  return true;
}
export const registerBlocked = file => canRegister(file) && !hasLender(file);
export const registerReady = file => canRegister(file) && hasLender(file);

// Los numeros que Arive devuelve al registrar. Viven DENTRO del ciclo: el
// lender nuevo asigna numeros nuevos, y los del lender viejo se quedan en
// su ciclo sin ensuciar al vigente. En mini correspondent son dos —investor
// y lender—; en broker suele bastar uno.
export function setRegistrationField(file, patch) {
  const a = registrationsOf(file);
  if (!a.length) return file;
  const i = a.length - 1;
  const limpio = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === "discEsignedAt" || k === "barrettDiscSentAt") limpio[k] = okDate(v) || null;
    else limpio[k] = String(v ?? "").trim() || null;
  }
  return { ...file, registrations: a.map((r, j) => j === i ? { ...r, ...limpio } : r) };
}
export const loanNumberInvestor = file => currentRegistration(file)?.loanNumberInvestor || null;
export const loanNumberLender   = file => currentRegistration(file)?.loanNumberLender || null;
export const barrettDiscSentAt  = file => okDate(currentRegistration(file)?.barrettDiscSentAt) || null;

// Un toque sella hoy en el ciclo vigente. Segundo toque lo quita.
export function stampRegistrationDate(file, campo) {
  const cur = currentRegistration(file);
  if (!cur) return file;
  return setRegistrationField(file, { [campo]: cur[campo] ? null : today() });
}

// ─── 7X2. HITOS SUELTOS ────────────────────────────────────────────
// Cuatro fechas de la forma de Barrett que ningun avance de etapa produce
// y que tampoco son un pedido a un vendor. Son sellos: paso o no paso.
//
// `only` los condiciona igual que en admision — pedir el numero de caso FHA
// en un Conventional es ruido, no un dato faltante.
export const MILESTONES = [
  { id: "fha_case",     es: "Numero de caso FHA pedido", en: "FHA case number requested",
    only: f => baseProductOf(f?.type) === "fha" },
  { id: "icd_task",     es: "Task de ICD",               en: "File task for ICD" },
  { id: "resubmit_ctc", es: "Re-sometido para CTC",      en: "File resubmitted for CTC",
    note_es: "Enciende el NARANJA de la leyenda de Martha",
    note_en: "Turns on the ORANGE in Martha's legend" },
  { id: "vvoe",         es: "VVOE",                      en: "VVOE",
    note_es: "Verbal, justo antes de fondear", note_en: "Verbal, right before funding" },
];
export const milestoneById = id => MILESTONES.find(m => m.id === id) || null;
export const milestonesOf = file =>
  (file?.milestones && typeof file.milestones === "object") ? file.milestones : {};
export const milestoneAt = (file, id) => okDate(milestonesOf(file)[id]) || null;
export const milestoneApplies = (file, id) => {
  const m = milestoneById(id);
  return !!m && (!m.only || m.only(file));
};
export const visibleMilestones = file => MILESTONES.filter(m => milestoneApplies(file, m.id));

// Un toque sella hoy; el segundo lo quita. Marcar por error es inevitable y
// no puede costar una llamada.
export function stampMilestone(file, id) {
  if (!milestoneById(id)) return file;
  const cur = milestoneAt(file, id);
  return { ...file, milestones: { ...milestonesOf(file), [id]: cur ? null : today() } };
}

// ─── 7X3. RESULTADO DE UNDERWRITING ────────────────────────────────
// La forma dice "File Approved / Denied or Suspended Date" en un solo
// renglon, pero son TRES resultados distintos y una sola fecha no los
// distingue. Guardarlos como fecha suelta perderia justo lo que importa.
//
// Y aqui se encienden los dos colores que la leyenda de Martha traia
// muertos: suspendido es su ROJO, y el re-sometido para CTC su NARANJA.
export const UW_OUTCOMES = {
  approved:  { es: "Aprobado",   en: "Approved",  signal: "done" },
  suspended: { es: "Suspendido", en: "Suspended", signal: "broken",
               note_es: "Es el rojo de la hoja de Martha — el archivo esta detenido",
               note_en: "This is the red on Martha's sheet — the file is on hold" },
  denied:    { es: "Denegado",   en: "Denied",    signal: "broken",
               note_es: "Salida: este archivo va a cambio de lender",
               note_en: "An exit: this file is heading to a lender change" },
};
export const UW_OUTCOME_IDS = Object.keys(UW_OUTCOMES);
export const uwOutcomeMeta = id => UW_OUTCOMES[id] || null;
export const uwOutcome = file => {
  const o = file?.uwResult?.outcome;
  return UW_OUTCOMES[o] ? o : null;
};
export const uwOutcomeAt = file => okDate(file?.uwResult?.at) || null;

// Se guarda con su fecha, su nota y su autor, y queda historial: un archivo
// suspendido que despues se aprueba tuvo las dos cosas, y el post-mortem
// necesita las dos.
export function setUwOutcome(file, { outcome, at, note, by }) {
  if (!UW_OUTCOMES[outcome]) return file;
  const cuando = okDate(at) || today();
  const entry = { outcome, at: cuando, note: String(note || "").trim() || null, by: by || null };
  return {
    ...file,
    uwResult: entry,
    uwLog: [...(file?.uwLog || []), entry],
  };
}
export const clearUwOutcome = file => ({ ...file, uwResult: null });

// Un toque: abre el ciclo, estampa la fecha, avanza la etapa, y con eso el
// turno pasa solo a la procesadora asignada. Tina no captura nada extra —
// cierra su tramo, que es lo que ya hace en Arive.
//
// Las divulgaciones se sellan en el MISMO toque: registrar en Arive las
// emite en el acto, igual que registrar y asignar procesadora son un solo
// evento. Pedirle un toque aparte seria pedirle que registre un dato que
// el sistema ya sabe.
export function stampRegistration(file, by) {
  const next = stampStage(file, AFTER_REGISTRATION_STAGE);
  const hoy = today();
  return {
    ...next,
    registrations: [...registrationsOf(file), {
      lenderId: file?.lenderId || null,
      lenderName: lenderNameOf(file),
      at: hoy,
      by: by || null,
      discSentAt: hoy,
      discEsignedAt: null,
      barrettDiscSentAt: null,
      loanNumberInvestor: null,
      loanNumberLender: null,
    }],
    // Espejo plano del ultimo ciclo. No es la fuente de verdad — se
    // mantiene para que nada que todavia lea el campo viejo se rompa.
    registeredAt: hoy,
    registeredBy: by || null,
    // La procesadora queda congelada: despues del registro Arive ya
    // asigno, y cambiarla aqui no cambiaria nada alla.
    processor: processorId(file),
  };
}

// ─── 7X4. RELLENO DE ARCHIVOS ANTERIORES ───────────────────────────
// Los archivos que ya existían cuando se construyó todo esto tienen tres
// clases de hueco, y ninguno se puede inventar:
//
//   · Nunca pasaron por el botón de REGISTRADO —no existía— así que no
//     tienen ciclo de registro ni fecha de divulgaciones.
//   · Avanzaron de etapa antes de que arregláramos la fuga de stampStage,
//     así que stageLog quedó sin sellar en las etapas por las que pasaron.
//
// En el checklist de Barrett eso son seis renglones en blanco de un
// archivo que sí se registró y sí se sometió — solo que nadie lo anotó.
//
// La regla que ordena esto: SOLO se pregunta por lo que TUVO que ocurrir.
// Si el archivo está en CD Issued, pasó por Submitted to UW por fuerza. Si
// está en UW Review, la fecha de fondeo no se pregunta porque todavía no
// existe. Pedir un dato que aún no ha pasado invita a inventarlo.
export const BACKFILL_STAGES = [
  "Initial Disclosures Sent", "Submitted to UW", "Conditional Approval",
  "Clear to Close", "CD Issued", "Closing Docs Drawn", "Funded",
];

// Los huecos de UN archivo, en el orden en que ocurrieron.
//
// Tres exclusiones, y las tres por la misma razon: el relleno existe para
// que el checklist de Barrett salga completo en un archivo que alguien va
// a imprimir. Donde no hay papel que imprimir, no hay hueco que tapar.
//
//   · CERRADO o REFERIDO — ya fondeo, ya cobro, ya se fue. Nadie va a
//     imprimir su checklist. La primera version daba por pasadas TODAS
//     las etapas de un archivo cerrado, que es cierto en la vida real y
//     jalaba los 44 cerrados y referidos a una pantalla de relleno.
//   · SIN LENDER — pedir la fecha de registro con un lender que no
//     existe es pedir que se invente. Cristobal Godinez salio asi.
//   · ANTERIOR AL CORTE — se liquido bajo PRMG. Mismo criterio que ya
//     usa payroll: nada de antes del 13 de julio vuelve a entrar.
export function backfillGaps(file, cutover = BARRETT_CUTOVER) {
  if (!file || file.archived) return [];
  if (okDate(file.closedAt)) return [];
  if (file.stage === "REFERRED OUT — EXTERNAL BANK" || file.referredOut) return [];
  if (file.prep) return [];
  if (!hasLender(file)) return [];
  // Un archivo abierto antes del corte pero que sigue vivo SI cuenta: se va
  // a cerrar con Barrett y su checklist va a Barrett. Lo que se excluye es
  // el que ya nacio y murio del otro lado.
  const abierto = okDate(file.fileOpenedAt) || okDate(String(file.createdAt || "").split("T")[0]);
  if (abierto && cutover && abierto < cutover && !file.stage) return [];

  const idx = ALL_STAGE_ORDER.indexOf(file.stage);
  const paso = etapa => idx > -1 && ALL_STAGE_ORDER.indexOf(etapa) > -1
    && ALL_STAGE_ORDER.indexOf(etapa) < idx;

  const out = [];
  if (paso(AFTER_REGISTRATION_STAGE) && !isRegistered(file))
    out.push({ id: "registration", kind: "registration",
      es: "Registro con el lender", en: "Registered with lender" });
  if (isRegistered(file) || paso(AFTER_REGISTRATION_STAGE)) {
    if (!discEsignedAt(file))
      out.push({ id: "discEsignedAt", kind: "registration",
        es: "Divulgaciones firmadas", en: "Disclosures signed" });
  }
  for (const st of BACKFILL_STAGES) {
    if (!paso(st)) continue;
    if (okDate(stageLogOf(file)[st])) continue;
    out.push({ id: st, kind: "stage", es: st, en: st });
  }
  return out;
}

// Los que de verdad hay que cerrar, y en el orden que importa: el que
// firma antes necesita su papel antes.
export const filesNeedingBackfill = files =>
  (files || []).filter(f => backfillGaps(f).length > 0)
    .sort((a, b) => {
      const ca = okDate(a?.contingencies?.coe) || okDate(a?.closing) || "9999-12-31";
      const cb = okDate(b?.contingencies?.coe) || okDate(b?.closing) || "9999-12-31";
      return ca.localeCompare(cb);
    });

export const backfillCount = files =>
  filesNeedingBackfill(files).reduce((a, f) => a + backfillGaps(f).length, 0);

// Escribe el relleno en las MISMAS estructuras que el trabajo del día a
// día: stageLog y el ciclo de registro. Nada río abajo cambia — la hoja de
// Martha y el checklist leen lo de siempre.
//
// Queda constancia de que fue relleno y de quién lo hizo. Una fecha
// escrita a mano meses después no es lo mismo que una sellada el día que
// ocurrió, y el día que un número no cuadre hay que poder distinguirlas.
export function applyBackfill(file, valores, by) {
  const v = valores || {};
  let out = { ...file };
  const puestos = [];

  const log = { ...stageLogFromHistory(file), ...stageLogOf(file) };
  for (const [k, val] of Object.entries(v)) {
    const d = okDate(val);
    if (!d) continue;
    if (k === "registration") continue;
    if (k === "discEsignedAt") continue;
    if (!log[k]) { log[k] = d; puestos.push(k); }
  }
  out.stageLog = log;

  const reg = okDate(v.registration);
  if (reg && !isRegistered(out)) {
    out.registrations = [...registrationsOf(out), {
      lenderId: out.lenderId || null,
      lenderName: lenderNameOf(out),
      at: reg, by: by || null,
      // Las divulgaciones salen el mismo día del registro, igual que en el
      // toque normal. Si stageLog ya trae la fecha real, esa manda.
      discSentAt: okDate(log[AFTER_REGISTRATION_STAGE]) || reg,
      discEsignedAt: null,
      barrettDiscSentAt: null,
      loanNumberInvestor: null, loanNumberLender: null,
      backfilled: true,
    }];
    out.registeredAt = reg;
    out.registeredBy = by || null;
    puestos.push("registration");
  }

  const firmadas = okDate(v.discEsignedAt);
  if (firmadas) {
    out = setRegistrationField(out, { discEsignedAt: firmadas });
    if (out !== file) puestos.push("discEsignedAt");
  }

  if (!puestos.length) return file;
  return {
    ...out,
    backfill: [...(file.backfill || []),
      { at: today(), by: by || null, fields: puestos }],
  };
}

export const wasBackfilled = file => (file?.backfill || []).length > 0;
// El color se acumulo sin decidirse. Hoy el rojo dice cinco cosas
// distintas: urgencia, conflicto, hallazgo abierto, borrar y contingencia
// vencida. Y el caso que lo delato: una tasacion YA ORDENADA salia en
// rojo porque la fecha derivada habia pasado — el rojo decia "tarde"
// sobre algo que ya estaba hecho.
//
// Un color que significa cinco cosas no significa ninguna. Y cuando
// alguien nuevo entra al pipeline, el color es lo primero que su cerebro
// lee, antes que el texto.
//
// SEIS COLORES, UN SIGNIFICADO CADA UNO, SIN EXCEPCION:
//
//   ROJO    · vencido o roto. Ya paso y sigue sin hacerse, o dos datos
//             se contradicen y el plan no se sostiene. Hay daño.
//   DORADO  · se avecina. Falta poco, falta un dato, hay que decidir.
//             Nada se rompio todavia.
//   VERDE   · hecho y correcto. Cumplido, recibido, cerrado, resuelto.
//   AZUL    · dato del sistema. Lo que el pipeline calculo o trajo.
//             Ni bueno ni malo — informacion.
//   MORADO  · legal. Solo TRID, el CD y los plazos de ley. Un solo uso,
//             por eso siempre se reconoce.
//   GRIS    · estancado o sin funcion. No aplica, no hay dato, o nadie
//             lo esta moviendo.
//
// Reservar el rojo lo vuelve raro, y por eso creible.
export const SIGNALS = {
  broken:  { id: "broken",  color: "#E85D75", es: "Vencido o roto",   en: "Overdue or broken" },
  soon:    { id: "soon",    color: "#F5A623", es: "Se avecina",       en: "Coming up" },
  done:    { id: "done",    color: "#7EC8A4", es: "Hecho",            en: "Done" },
  info:    { id: "info",    color: "#4A90D9", es: "Dato del sistema", en: "System data" },
  legal:   { id: "legal",   color: "#BD65E8", es: "Legal",            en: "Legal" },
  idle:    { id: "idle",    color: "#6E7681", es: "Estancado",        en: "Idle" },
};
export const signalColor = id => (SIGNALS[id] || SIGNALS.idle).color;

// Cuantos dias antes empieza a avisar. Menos de esto es dorado; mas,
// gris — todavia no le toca a nadie.
export const SOON_DAYS = 7;

// La señal de una fecha derivada. Este es el caso que rompio el sistema
// viejo: si la etapa YA se alcanzo, la fecha se cumplio y va en verde,
// aunque el calendario haya quedado atras. Rojo solo si paso Y sigue
// sin hacerse.
export function deadlineSignal(row, file) {
  if (!row?.startBy) return "idle";
  const alcanzada = ALL_STAGE_ORDER.indexOf(file?.stage) >= ALL_STAGE_ORDER.indexOf(row.stage);
  if (alcanzada) return "done";
  // `hoy` y no `t`: la letra t es el helper bilingue del final del archivo.
  const hoy = today();
  if (row.startBy < hoy) return "broken";
  return daysBetween(hoy, row.startBy) <= SOON_DAYS ? "soon" : "idle";
}

// La señal de una contingencia, con la misma vara.
export function contingencySignal(st) {
  if (!st?.date) return "idle";
  if (st.outcome === "missed") return "broken";
  if (st.outcomeMeta?.terminal) return "done";
  if (st.daysLeft < 0) return "broken";
  return st.daysLeft <= SOON_DAYS ? "soon" : "idle";
}

// ─── 7Q. RITMO · ADELANTADO O ATRASADO ─────────────────────────────
// El sistema ya sabia que un archivo iba adelantado —ocho de doce fechas
// derivadas en verde— pero no lo decia. Solo hablaba cuando algo se
// atrasaba, y eso deja al equipo sin la mitad de la informacion.
//
// La medida NO es proyectado contra COE. Ese numero no se mueve nunca:
// es el mismo el dia del contrato que hoy, porque los dos lados son
// fechas fijas. Mide el plan contra el plan.
//
// La medida buena es DONDE ESTAS contra DONDE DEBERIAS ESTAR: la etapa
// actual tiene su fecha derivada, y la distancia contra hoy es el ritmo
// real. Ese numero SI se mueve cada vez que el archivo avanza.
//
// Adelantado NO mueve el COE. Cerrar antes necesita addendum firmado por
// comprador y vendedor — el sistema avisa, la llamada al agente la hace
// una persona.
export function filePace(file) {
  const mapa = derivedStageDeadlines(file);
  const fila = mapa[file?.stage];
  if (!fila?.startBy) return { ready: false };

  const hoy = today();
  // Positivo = adelantado. Si la etapa debia empezar el 27 y hoy es 17,
  // el archivo llego diez dias antes de lo planeado.
  const dias = fila.startBy >= hoy
    ? daysBetween(hoy, fila.startBy)
    : -daysBetween(fila.startBy, hoy);

  // Un dia de diferencia no es ritmo, es ruido de calendario.
  const estado = dias >= 2 ? "ahead" : dias <= -2 ? "behind" : "onplan";
  return {
    ready: true, days: Math.abs(dias), raw: dias, state: estado,
    shouldStartBy: fila.startBy,
    signal: estado === "ahead" ? "done" : estado === "behind" ? "broken" : "idle",
    // Cuanto se PODRIA adelantar el cierre si mantiene el ritmo. Solo se
    // calcula; nadie mueve nada sin addendum.
    couldCloseBy: estado === "ahead"
      ? addDays(okDate(file?.contingencies?.coe) || okDate(file?.closing), -dias)
      : null,
  };
}

// ─── 7S. QUE ACCIONES APLICAN EN CADA FASE ─────────────────────────
// Los siete botones del pie estaban todos iguales: mismo tamaño, mismo
// peso, siempre disponibles. BORRAR —el unico que no se deshace— al
// lado de GUARDAR, que se toca veinte veces al dia.
//
// La regla que ordena esto: mientras el archivo AVANZA, las salidas se
// CIERRAN. Al principio caben todas —puede irse a preparacion, referirse,
// archivarse. Cerca del cierre solo queda una: cerrarlo.
//
// Apagado NO es prohibido. El boton sigue ahi, en el mismo sitio y del
// mismo tamaño, y si se toca pregunta con la razon. Que no se muevan de
// posicion es lo que deja ir con el dedo sin leer la barra cada vez.
export function fileActions(file, { isAdmin = false } = {}) {
  const s = file?.stage;
  const idx = ALL_STAGE_ORDER.indexOf(s);
  const bajoContrato = idx >= ALL_STAGE_ORDER.indexOf("Under Contract");
  const enUW = idx >= ALL_STAGE_ORDER.indexOf("Submitted to UW");
  const alCierre = idx >= ALL_STAGE_ORDER.indexOf("Clear to Close");
  const cerrado = !!okDate(file?.closedAt);
  const archivado = !!file?.archived;

  return {
    save:    { on: true },
    advance: { on: !cerrado && !archivado && idx > -1 && idx < ALL_STAGE_ORDER.length - 1 },
    // Cerrar solo se ilumina cuando de verdad esta cerca. Antes lucia
    // igual en Lead Inquiry que en Funded.
    close:   { on: alCierre && !cerrado && !archivado,
               why_es: "Se ilumina desde Clear to Close",
               why_en: "Lights up from Clear to Close" },
    // Referir despues de underwriting ya no llega: el lender nuevo
    // suscribe desde cero y no alcanza la fecha del CD.
    refer:   { on: !enUW && !cerrado && !archivado,
               why_es: "Después de someter a UW un traslado ya no llega al cierre",
               why_en: "After UW submission a transfer no longer reaches closing" },
    // Preparacion es para clientes vivos que aun no compran. Un archivo
    // bajo contrato no se estaciona.
    prep:    { on: !bajoContrato && !cerrado && !archivado,
               why_es: "Un archivo bajo contrato no se estaciona esperando al cliente",
               why_en: "A file under contract is not parked waiting on the client" },
    // Archivar algo que va a fondear seria un error caro.
    archive: { on: !alCierre && !cerrado && !archivado,
               why_es: "Un archivo camino al cierre no se archiva",
               why_en: "A file heading to closing does not get archived" },
    del:     { on: isAdmin, admin: true },
  };
}

// ─── 7V. LA COLA DE LA PROCESADORA ─────────────────────────────────
// Un LO abre el sistema y piensa "mis archivos". Una procesadora abre y
// piensa "que hago hoy". Son dos productos distintos sobre el mismo dato.
//
// Por eso la cola NO se agrupa por etapa. Se agrupa por lo que hay que
// HACER, y el orden de los grupos es el orden en que se atienden. Un
// archivo cae en el PRIMER grupo que le toca, nunca en dos.
export const QUEUE_GROUPS = [
  { id: "blocked",  order: 1, color: "#E85D75",
    es: "Bloqueado", en: "Blocked",
    note_es: "Hay un hallazgo abierto — no avanza hasta resolverlo",
    note_en: "There is an open finding — it does not move until it is resolved" },
  { id: "new",      order: 2, color: "#F5A623",
    es: "Nuevos · sin ordenar", en: "New · nothing ordered",
    note_es: "Recien registrados. Titulo, HOI y tasacion de un tiro",
    note_en: "Just registered. Title, HOI and appraisal in one shot" },
  { id: "vendor",   order: 3, color: "#4A90D9",
    es: "Esperando vendor", en: "Waiting on vendor",
    note_es: "Pedido hecho, todavia no llega",
    note_en: "Ordered, not received yet" },
  { id: "ready_uw", order: 4, color: "#BD65E8",
    es: "Listos para someter", en: "Ready to submit",
    note_es: "Los pedidos llegaron y el archivo no se ha sometido",
    note_en: "Orders are in and the file has not been submitted" },
  { id: "in_uw",    order: 5, color: "#9999FF",
    es: "En underwriting", en: "In underwriting",
    note_es: "En manos del underwriter",
    note_en: "With the underwriter" },
  { id: "conditions", order: 6, color: "#FFD166",
    es: "Condiciones abiertas", en: "Open conditions",
    note_es: "Aprobado, esperando al prestatario",
    note_en: "Approved, waiting on the borrower" },
  { id: "closing",  order: 7, color: "#7EC8A4",
    es: "Camino al cierre", en: "Heading to closing",
    note_es: "CD, CTC, firma y fondeo",
    note_en: "CD, CTC, signing and funding" },
];
export const queueGroup = id => QUEUE_GROUPS.find(g => g.id === id) || null;

const UW_STAGES   = ["Submitted to UW", "UW Review"];
const COND_STAGES = ["Conditional Approval", "Condition Clearing"];
const CLOSE_STAGES = ["Clear to Close", "CD Issued", "Closing Scheduled",
  "Final Verifications", "Closing Docs Drawn", "Signing", "Funded"];

// A que grupo pertenece este archivo. El orden de los if ES el diseño:
// un hallazgo abierto gana sobre todo lo demas, porque un archivo que
// nadie puede mover no es "esperando vendor", es un archivo parado.
export function queueGroupOf(file) {
  if (hasOpenFindings(file)) return "blocked";
  const s = file?.stage;
  if (CLOSE_STAGES.includes(s)) return "closing";
  if (COND_STAGES.includes(s))  return "conditions";
  if (UW_STAGES.includes(s))    return "in_uw";
  if (!oneShotDone(file))       return "new";
  if (pendingOrders(file).length) return "vendor";
  return "ready_uw";
}

// La cola completa de una procesadora, agrupada y ordenada. Dentro de
// cada grupo, primero lo que cierra antes: el COE es la fecha que le
// importa al cliente y al agente.
export function processingQueue(files, quien = DEFAULT_PROCESSOR) {
  const mios = (files || []).filter(f => {
    if (!f || f.archived || okDate(f.closedAt) || f.prep) return false;
    if (quien && processorId(f) !== quien) return false;
    // Antes de Full Application el archivo todavia no es de nadie en
    // procesamiento; despues del cierre ya salio.
    return ALL_STAGE_ORDER.indexOf(f.stage) >= ALL_STAGE_ORDER.indexOf("Full Application");
  });

  const porGrupo = new Map();
  for (const f of mios) {
    const g = queueGroupOf(f);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g).push(f);
  }
  return QUEUE_GROUPS
    .filter(g => porGrupo.has(g.id))
    .map(g => ({
      ...g,
      files: porGrupo.get(g.id).sort((a, b) => {
        const ca = okDate(a?.contingencies?.coe) || okDate(a?.closing) || "9999-12-31";
        const cb = okDate(b?.contingencies?.coe) || okDate(b?.closing) || "9999-12-31";
        return ca.localeCompare(cb);
      }),
    }));
}

// Cuantos archivos tiene cada procesadora. Para el selector de cola.
export function queueCounts(files) {
  const out = {};
  for (const id of PROCESSOR_IDS) out[id] = processingQueue(files, id).reduce((a, g) => a + g.files.length, 0);
  return out;
}

// ─── 8. STAMPING ───────────────────────────────────────────────────

// ─── 8A. SELLOS DE ETAPA ───────────────────────────────────────────
// stampStage pisaba stageEnteredAt en cada avance. Eso significa que la
// fecha en que un archivo entro a "Submitted to UW" se perdia en cuanto
// pasaba a la etapa siguiente, y la hoja de Martha pide NUEVE de esas
// fechas. stageLog las guarda: etapa -> dia de PRIMERA entrada. Se
// escribe una sola vez por etapa y no se pisa nunca.
//
// Sin tope, a diferencia de history: son 18 etapas como maximo, o sea
// menos de 400 bytes por archivo. history esta cortado a 20 entradas y
// lo comparten todos los tipos de edicion, por eso no sirve para esto.
export const stageLogOf = file => file?.stageLog || {};

// La fecha en que este archivo entro a esa etapa, o null si nunca entro.
export function stageStampedAt(file, stage) {
  return okDate(stageLogOf(file)[stage]);
}

// Rescate para archivos que ya existen. history todavia carga entradas
// stage_advanced de antes de este cambio, asi que recuperamos lo que
// haya sobrevivido al corte de 20. No es el historial completo — es lo
// que quedo — y por eso solo se usa como base, nunca pisa a stageLog.
//
// h.at viene de toISOString(), que es UTC. Partirlo en la "T" devuelve
// el dia UTC, y en Las Vegas eso adelanta un dia todo lo que se registro
// despues de las 5pm. Hay que convertirlo a dia local igual que today().
export function stageLogFromHistory(file) {
  const out = {};
  for (const h of file?.history || []) {
    if (h?.action !== "stage_advanced" || !h?.to || !h?.at) continue;
    const iso = localISO(new Date(h.at));
    if (!isValidISO(iso)) continue;
    if (!out[h.to] || iso < out[h.to]) out[h.to] = iso;   // la primera entrada gana
  }
  return out;
}

export function stampStage(file, newStage) {
  // El orden importa: lo rescatado de history es la BASE y stageLog lo
  // pisa, porque stageLog es el dato bueno y history es una reconstruccion.
  const log = { ...stageLogFromHistory(file), ...stageLogOf(file) };
  if (!log[newStage]) log[newStage] = today();          // se sella una sola vez

  return {
    ...file,
    stage: newStage,
    stageEnteredAt: today(),
    daysInStage: 0,                                  // legacy field, kept for old views
    stageLog: log,
    // Set once, never again — and when it was never set, fall back to the
    // day the file was created. today() here restarted the clock on every
    // legacy file the moment somebody advanced it.
    fileOpenedAt: file.fileOpenedAt || file.createdAt?.split("T")[0] || today(),
  };
}

export function stampContact(file, target) {
  return {
    ...file,
    lastContactAt: today(),
    contactCount: (file.contactCount || 0) + 1,
    contactLog: [...(file.contactLog || []), { at: today(), target: target || nextContactTarget(file) }],
  };
}

// ─── 9. BILINGUAL HELPER ───────────────────────────────────────────
export function t(obj, lang = "es") { return obj?.[lang] ?? obj?.en ?? ""; }
