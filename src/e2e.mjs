// ═══════════════════════════════════════════════════════════════════
//  e2e.mjs · UN PRÉSTAMO DE PUNTA A PUNTA
//
//  No prueba funciones sueltas: recorre un archivo real desde que entra
//  el lead hasta que fondea, y en cada parada pregunta lo que un humano
//  preguntaría. Si el motor cambia y la historia deja de cuadrar, esto
//  falla aunque cada funcion siga pasando su prueba individual.
// ═══════════════════════════════════════════════════════════════════
import "./_corebundle.mjs";
const C = await import("./_core.mjs");

let ok = 0, mal = 0;
const t = (nombre, cond) => { if (cond) { ok++; } else { mal++; console.log("  ✕ " + nombre); } };
const d = k => C.addDays(C.today(), k);

console.log("── el préstamo de Maria Sample, de punta a punta ──\n");

// ─── 1 · PRE-QUAL ──────────────────────────────────────────────────
let f = { id:"e2e", borrower:"Maria Sample", type:"FHA", loan:400000,
  lo:"Ana M Plasencia", stage:"Lead Inquiry", stageEnteredAt:d(-1),
  fileOpenedAt:d(-1), stageLog:{ "Lead Inquiry": d(-1) } };

t("un archivo nuevo no está crítico", C.stageGate(f).blocked === false);
t("Pre-Qual no tiene puerta", (C.STAGE_GATES["Lead Inquiry"] || []).length === 0);

for (const e of ["Needs Assessment","Credit Pull","Income Verification","Pre-Qualification"])
  f = C.stampStage(f, e);
t("la edad total no se reinicia al avanzar", C.fileAge(f) >= 1);
t("el reloj de etapa sí se reinicia", C.daysInStage(f) === 0);

// ─── 2 · HOUSE HUNT ────────────────────────────────────────────────
f = C.stampStage(f, "Realtor Connected");
f = C.stampStage(f, "Active Search");
t("House Hunt corre contra la ventana de APG", C.fileClock(f).kind === "houseHunt"
  || C.fileClock(f).applies === true);

// ─── 3 · CONTRATO Y GATE 1 ─────────────────────────────────────────
f = C.stampStage(f, "Offer Submitted");
f = C.stampStage(f, "Under Contract");
f = { ...f, closing: d(45), contingencies: { contractAccepted: d(0), coe: d(45) } };

t("sin el 1003 ni las fechas, la puerta bloquea", C.stageGate(f).blocked === true);
t("y nombra las dos cosas que faltan", C.stageGate(f).hard.length === 2);

for (const id of C.GATE1_VERIFY_IDS) f = C.cycleGate1(f, id, "Ana");
t("los 12 puntos quedan verificados", C.gate1Coverage(f).verified === 12);
t("pero sin fechas de contrato sigue bloqueando", C.stageGate(f).blocked === true);

f = { ...f, contingencies: { ...f.contingencies,
  appraisalContingency: d(17), loanContingency: d(30) } };
t("con las fechas, la puerta abre", C.stageGate(f).blocked === false);

// ─── 4 · REGISTRO ──────────────────────────────────────────────────
f = C.stampStage(f, "Full Application");
t("sin lender no se puede registrar", C.hasLender(f) === false);
t("y la puerta bloquea la salida", C.stageGate(f).blocked === true);

f = { ...f, lenderId: "elend" };
t("con lender, se puede registrar", C.canRegister(f) === true);
f = C.stampRegistration(f, "Tina");
t("el registro guarda su fecha", !!C.registeredAt(f));
t("y su autor", C.registeredBy(f) === "Tina");
t("el archivo queda registrado", C.isRegistered(f) === true);
t("la puerta abre", C.stageGate(f).blocked === false);
t("y el registro mueve la etapa solo", f.stage === "Initial Disclosures Sent");

// ─── 5 · DISCLOSURES Y LA TASACIÓN ─────────────────────────────────
// Registrar y mandar el paquete son el mismo acto: `stampRegistration`
// estampa las dos cosas. La prueba original asumia que eran dos pasos.
t("registrar también estampa el envío", !!C.discSentAt(f));
t("con el envío, la puerta no bloquea", C.stageGate(f).blocked === false);
t("pero avisa que falta la firma del cliente", C.stageGate(f).soft.length === 1);
t("y el aviso es blando, no duro", C.stageGate(f).hard.length === 0);

t("la tasación no se puede pedir sin la firma", C.canOrderAppraisal(f) === false);
t("y el motor la rechaza aunque se intente",
  !C.orderState(C.stampOrder(f, "appraisal", "req", "Laura"), "appraisal").req);
t("el título SÍ se puede pedir",
  !!C.orderState(C.stampOrder(f, "title", "req", "Laura"), "title").req);

f = C.stampRegistrationDate(f, "discEsignedAt");
t("firmadas, la tasación se destraba", C.canOrderAppraisal(f) === true);
t("y ya no hay aviso", C.stageGate(f).soft.length === 0);

// ─── 6 · ÓRDENES ───────────────────────────────────────────────────
f = C.stampStage(f, "Doc Collection");
f = C.stampStage(f, "Title Ordered");
f = C.stampOrder(f, "title", "req", "Laura");
f = C.stampStage(f, "Appraisal Ordered");
t("en Appraisal Ordered sin pedirla, bloquea", C.stageGate(f).blocked === true);
f = C.stampOrder(f, "appraisal", "req", "Laura");
t("pedida, abre", C.stageGate(f).blocked === false);
t("la orden guarda su fecha", !!C.orderState(f, "appraisal").req);

// ─── 7 · UNDERWRITING Y CIERRE ─────────────────────────────────────
for (const e of ["Insurance Ordered","Submitted to UW","UW Review",
  "Conditional Approval","Condition Clearing","Clear to Close","CD Issued",
  "Closing Scheduled","Final Verifications","Closing Docs Drawn","Signing"])
  f = C.stampStage(f, e);
t("llegó a Signing sin trabarse", f.stage === "Signing");
t("el historial guarda cada etapa", Object.keys(f.stageLog || {}).length >= 15);
t("la edad total nunca se reinició", C.fileAge(f) >= 1);

// ─── 8 · CONTINGENCIAS ─────────────────────────────────────────────
t("hay contingencias capturadas", C.hasContingencies(f) === true);
t("son cinco en el catálogo", C.CONTINGENCIES.length === 5);
t("dos son del contrato",
  C.CONTINGENCIES.filter(c => c.kind === "contract").length === 2);

console.log("\n" + (mal
  ? `✕ A–Z: ${ok} pasaron, ${mal} fallaron`
  : `A–Z: ${ok}/${ok} el préstamo recorre el pipeline completo`));
process.exit(mal ? 1 : 0);
