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
  const t = String(type).toLowerCase();
  if (/dpa|hip|chenoa|nhf|hometown heroes|tsahc|tdhca|seth|chfa|metrodpa|home in five|home at last|hfa|tvlb/.test(t)) return "dpa";
  if (/streamline|irrrl|refinow|refi possible|streamlined assist/.test(t)) return "refi";
  if (/heloc|second/.test(t)) return "heloc";
  if (/dscr/.test(t)) return "dscr";
  if (/non-qm|nonqm|bank statement|1099|p&l/.test(t)) return "nonqm";
  if (/jumbo/.test(t)) return "jumbo";
  if (/usda/.test(t)) return "usda";
  if (/\bva\b/.test(t)) return "va";
  if (/fha/.test(t)) return "fha";
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
// Marta orders appraisal, title and HOI on day 1 of receipt, so those run
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

export const STAGE_DAYS = {
  "Under Contract":           { warn: 1, wait: "team",   owner: "LO",    note: "verify Gate 1" },
  "Full Application":         { warn: 2, wait: "team",   owner: "Tina",  note: "register with lender" },
  "Initial Disclosures Sent": { warn: 2, wait: "legal",  owner: "Tina",  note: "borrower must sign within 3 business days", legalBusinessDays: 3 },
  "Doc Collection":           { warn: 4, wait: "client", owner: "Laura", note: "exceptions only — done at Gate 1", offPath: true },
  "Title Ordered":            { warn: 2, wait: "vendor", owner: "Marta" },
  "Appraisal Ordered":        { warn: 6, wait: "vendor", owner: "Marta", note: "5-7 in Las Vegas, plus borrower payment" },
  "Insurance Ordered":        { warn: 2, wait: "client", owner: "Marta", note: "borrower picks the policy" },
  "Submitted to UW":          { warn: 1, wait: "team",   owner: "Marta" },
  "UW Review":                { warn: 3, wait: "vendor", owner: "Marta", dpa: { warn: 5 } },
  "Conditional Approval":     { warn: 1, wait: "team",   owner: "Tina" },
  "Condition Clearing":       { warn: 4, wait: "client", owner: "Tina",  dpa: { warn: 7 } },
  "Clear to Close":           { warn: 1, wait: "team",   owner: "Tina" },
  "CD Issued":                { warn: 2, wait: "legal",  owner: "Tina",  note: "TRID: received 3 business days before closing", legalBusinessDays: 3 },
  "Closing Scheduled":        { warn: 2, wait: "team",   owner: "Tina" },
  "Final Verifications":      { warn: 1, wait: "team",   owner: "Marta" },
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
    warn, late, wait: s.wait, owner: s.owner, note: s.note,
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
  for (const g of CONCURRENT_TRACKS) d += Math.max(...g.map(t => trackCost(t, day)));
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
  "Recorded":                { warn: 2,  late: 3,  owner: "Marta" },
  "Keys Delivered":          { warn: 1,  late: 2,  owner: "LO" },

  "Welcome Sent":            { warn: 3,  late: 7,  owner: "Laura" },
  "30-Day Follow-Up":        { warn: 30, late: 40, owner: "LO" },
  "Review Requested":        { warn: 7,  late: 14, owner: "Laura" },
  "Nurture Active":          { warn: 90, late: 180, owner: "LO" },
};

export const STAGE_OWNERS = {
  "Under Contract": "LO", "Full Application": "Tina", "Initial Disclosures Sent": "Tina",
  "Doc Collection": "Laura", "Title Ordered": "Marta", "Appraisal Ordered": "Marta",
  "Insurance Ordered": "Marta", "Submitted to UW": "Marta", "UW Review": "Marta",
  "Conditional Approval": "Tina", "Condition Clearing": "Tina", "Clear to Close": "Tina",
  "CD Issued": "Tina", "Closing Scheduled": "Tina", "Final Verifications": "Marta",
  "Closing Docs Drawn": "Tina", "Signing": "Tina", "Funded": "Tina",
};

export function stageClock(stage, file) {
  const fixed = FIXED_CLOCKS[stage];
  if (fixed) return fixed;
  const b = stageBudget(stage, file);
  return b ? { ...b, owner: STAGE_OWNERS[stage] || null } : null;
}

// ─── 2C. PROJECTED CLOSE AND SLACK ─────────────────────────────────
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
  const t = targetsFor(file);
  const state = file?.state || "NV";
  if (!file?.contractDate) return { targets: t, state, ready: false };

  const projected = addDays(file.contractDate, t.internal);
  const contracted = file.closing || null;
  const slack = contracted ? daysBetween(projected, contracted) : null;
  const short = contracted && new Date(contracted) < new Date(projected);

  return {
    ready: true, state, targets: t,
    projectedClose: projected,
    contractedClose: contracted,
    slackDays: short ? -daysBetween(contracted, projected) : slack,
    tooShort: !!short,
    // What to ask for on the contract, in the units that state uses.
    askForContractDays: calendarToContractDays(state, t.committed),
    askForCalendarDays: t.committed,
    gate1Required: !!t.requiresGate1PreContract,
    gate1Ready: !!file?.gate1CompletedAt,
    // A DPA on a 45-day APG contract has zero buffer. If the file was
    // not Gate-1 ready before the offer, do not promise 45.
    promiseRisk: !!t.requiresGate1PreContract && !file?.gate1CompletedAt,
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
      owner: b?.owner || STAGE_OWNERS[stages[i]] || null,
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

// What is due next, in order. This is the list the LO works from.
export function upcomingDeadlines(file, limit = 4) {
  const map = derivedStageDeadlines(file);
  const t = today();
  return Object.values(map)
    .filter(r => r.startBy)
    .sort((a, b) => a.startBy < b.startBy ? -1 : 1)
    .map(r => ({ ...r, daysOut: daysBetween(t, r.startBy), overdue: r.startBy < t }))
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
  const t = today();
  const daysLeft = date ? (date >= t ? daysBetween(t, date) : -daysBetween(date, t)) : null;
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
    const t = targetsFor(file);
    const need = addDays(contractAccepted, t.internal);
    if (need > coe) add("critical",
      `El producto necesita ${t.internal} días desde el contrato y el COE llega antes (${daysBetween(coe, need)} días corto)`,
      `The product needs ${t.internal} days from contract and the COE arrives sooner (${daysBetween(coe, need)} days short)`);
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
  const t = today();
  const reached = ALL_STAGE_ORDER.indexOf(file?.stage);
  for (const r of Object.values(map)) {
    const idx = ALL_STAGE_ORDER.indexOf(r.stage);
    if (idx > -1 && reached > -1 && idx <= reached) continue;   // already done
    if (r.startBy && r.startBy < t) add("critical",
      `${r.stage}: el último día para empezar era ${r.startBy}`,
      `${r.stage}: the last day to start was ${r.startBy}`);
  }
  const rank = { critical: 0, warn: 1 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
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
  for (const k of ["contractAccepted", ...CONTINGENCIES.map(c => c.field)])
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
  { id: "smartbee",         cat: "relationship", es: "Referido de SmartBee",             en: "SmartBee referral" },
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

// ─── 8. STAMPING ───────────────────────────────────────────────────
export function stampStage(file, newStage) {
  return {
    ...file,
    stage: newStage,
    stageEnteredAt: today(),
    daysInStage: 0,                                  // legacy field, kept for old views
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
