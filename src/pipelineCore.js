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
export function today() { return new Date().toISOString().split("T")[0]; }

export function daysBetween(from, to) {
  if (!from) return null;
  const a = new Date(from + "T00:00:00");
  const b = to ? new Date(to + "T00:00:00") : new Date(new Date().toDateString());
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
  const start = file?.fileOpenedAt || file?.createdAt?.split("T")[0];
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
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
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
    fileOpenedAt: file.fileOpenedAt || today(),      // set once, never again
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
