// ═══════════════════════════════════════════════════════════════════
//  sondeo.mjs · LOS BORDES
//
//  `e2e.mjs` recorre el camino feliz. Esto empuja los bordes: fechas en
//  feriados, contingencias imposibles juntas, un lender que cambia, un
//  contrato que se cae, un archivo sin datos. Cada prueba nace de algo
//  que de verdad se rompió o se puede romper.
// ═══════════════════════════════════════════════════════════════════
import "./_corebundle.mjs";
const C = await import("./_core.mjs");

let ok = 0, mal = 0;
const t = (n, cond) => { if (cond) ok++; else { mal++; console.log("  ✕ " + n); } };
const d = k => C.addDays(C.today(), k);

// ─── fechas ────────────────────────────────────────────────────────
t("una fecha vacía no pasa por buena", C.okDate("") === null || C.okDate("") === undefined);
t("una fecha inventada tampoco", !C.okDate("2026-13-45"));
t("una fecha buena sí", C.okDate("2026-09-10") === "2026-09-10");
t("sumar días cruza el mes", C.addDays("2026-08-30", 3) === "2026-09-02");
t("restar días cruza el año", C.addDays("2026-01-02", -3) === "2025-12-30");
t("los días entre dos fechas cuadran", C.daysBetween("2026-09-01", "2026-09-11") === 10);

// Tres varas distintas de día hábil. Confundirlas mueve fechas reales.
t("Nevada cuenta calendario", C.contractDeadline("NV", "2026-09-01", 10) === "2026-09-11");
t("Texas también", C.contractDeadline("TX", "2026-09-01", 10) === "2026-09-11");
t("Florida cuenta hábiles y da más tarde",
  C.contractDeadline("FL", "2026-09-01", 10) > C.contractDeadline("NV", "2026-09-01", 10));

// ─── el 1003 ───────────────────────────────────────────────────────
let g = { id: "g", stage: "Under Contract" };
t("vacío: doce pendientes", C.gate1Coverage(g).pending === 12);
t("y no está completo", C.gate1Complete(g) === false);
for (const id of C.GATE1_VERIFY_IDS) g = C.cycleGate1(g, id, "Tina");
t("los doce verificados", C.gate1Coverage(g).verified === 12);
t("ahora sí está completo", C.gate1Complete(g) === true);

const h = C.addFinding(g, { item: C.GATE1_VERIFY_IDS[0],
  text: "Hueco de 4 meses sin carta", waitingOn: "borrower", by: "Tina" });
t("un hallazgo retira la marca verde", C.gate1State(h, C.GATE1_VERIFY_IDS[0]) === "finding");
t("y rompe la completitud", C.gate1Complete(h) === false);
t("no se puede re-marcar con el hallazgo abierto",
  C.gate1State(C.cycleGate1(h, C.GATE1_VERIFY_IDS[0], "Tina"), C.GATE1_VERIFY_IDS[0]) === "finding");
t("un hallazgo sin texto se rechaza",
  C.findingsOf(C.addFinding(g, { item: "x", text: "   ", waitingOn: "lo" })).length === 0);
const res = C.resolveFinding(h, C.openFindings(h)[0].id, { by: "Tina", note: "recibida" });
t("resolver no borra: marca", C.resolvedFindings(res).length === 1);
t("y deja el punto en pendiente, no en verde",
  C.gate1State(res, C.GATE1_VERIFY_IDS[0]) === "pending");
t("resolver dos veces no pisa al primero",
  C.resolvedFindings(C.resolveFinding(res, C.openFindings(res)[0]?.id || "x", { by: "Otro" }))[0].resolvedBy === "Tina");

// ─── puertas ───────────────────────────────────────────────────────
t("una etapa sin puerta no bloquea", C.stageGate({ stage: "Signing" }).blocked === false);
t("un archivo sin etapa tampoco revienta", C.stageGate({}).blocked === false);
t("las fechas se leen de `contingencies`, no de la raíz",
  C.stageGate({ ...g, appraisalContingency: d(10), loanContingency: d(20) }).blocked === true);
t("y desde `contingencies` sí abren",
  C.stageGate({ ...g, contingencies: { appraisalContingency: d(10), loanContingency: d(20) } }).blocked === false);

// ─── registro y cambio de lender ───────────────────────────────────
let r = C.stampRegistration({ id: "r", stage: "Full Application", lenderId: "elend", stageLog: {} }, "Tina");
t("queda registrado", C.isRegistered(r) === true);
t("un ciclo, no dos", C.registrationCount(r) === 1);
const cambio = C.applyLenderChange(r, { lenderId: "cnc", reasonId: "overlay", by: "Jose" });
t("el cambio devuelve el archivo a Full Application", cambio.stage === "Full Application");
t("y deja de estar registrado", C.isRegistered(cambio) === false);
t("el sistema lo grita", C.needsReRegistration(cambio) === true);
t("el ciclo viejo NO se borra", C.registrationCount(cambio) >= 1);
t("el lock no viaja", !cambio.lockState || cambio.lockState === "float");

// ─── contrato cancelado ────────────────────────────────────────────
const vivo = { id: "v", borrower: "V", type: "FHA", stage: "Under Contract",
  fileOpenedAt: d(-40), lenderId: "elend", closing: d(20),
  contingencies: { contractAccepted: d(-25), coe: d(20) }, stageLog: { "Lead Inquiry": d(-40) } };
const cae = C.cancelContract(vivo, { reasonId: "inspection", by: "Jose" });
t("el cliente sobrevive al contrato caído", cae.borrower === "V");
t("la edad del archivo NO se reinicia", C.fileAge(cae) >= 40);
t("el lender se suelta", !cae.lenderId);
t("las contingencias se limpian", !C.okDate(cae.contingencies?.coe));
t("queda registrado cuántos contratos se cayeron", C.cancelCount(cae) === 1);

// ─── relojes ───────────────────────────────────────────────────────
t("un archivo cerrado no tiene reloj",
  C.fileClock({ stage: "CLOSED — FUNDED", closedAt: d(-1) }).applies === false);
t("uno archivado tampoco", C.fileClock({ stage: "UW Review", archived: true }).applies === false);
t("el COE manda cuando el cierre está cerca",
  C.fileClock({ stage: "UW Review", closing: d(3), contingencies: { coe: d(3) } }).kind === "coe");

// ─── el CD ───
t("sin CD no hay recibo", C.cdReceivedAt({}) === null);
const cdE = C.stampCdSent({ id:"cd", stage:"CD Issued", closing:"2026-09-25" },
  "2026-09-21", "Tina", "electronic");
t("electrónico recibe el mismo día", C.cdReceivedAt(cdE) === "2026-09-21");
t("la primera firma es 3 hábiles después", C.cdEarliestSigning(cdE) === "2026-09-24");
t("firmar el 25 está bien", C.cdTooEarly(cdE) === null);
const cdM = C.stampCdSent({ ...cdE }, "2026-09-21", "Tina", "mail");
t("postal presume 3 hábiles de recibo", C.cdReceivedAt(cdM) === "2026-09-24");
t("y empuja la primera firma", C.cdEarliestSigning(cdM) === "2026-09-28");
t("firmar el 25 rompe el plazo", !!C.cdTooEarly(cdM));
t("una fecha inventada se rechaza", !C.cdSentAt(C.stampCdSent({}, "no", "Tina")));
t("los fees guardan quién y cuándo",
  C.cdFeesReviewedBy(C.stampCdFees(cdE, "Ana")) === "Ana" && !!C.cdFeesReviewedAt(C.stampCdFees(cdE, "Ana")));
t("la puerta de CD Issued exige las dos cosas",
  C.stageGate({ id:"g", stage:"CD Issued" }).hard.length === 2);
t("con fecha queda una", C.stageGate(cdE).hard.length === 1);
t("con fees abre", C.stageGate(C.stampCdFees(cdE, "Ana")).blocked === false);

// ─── callejones sin salida ───
// Un archivo que se paso de Full Application sin registrarse no tenia
// donde registrarse ni donde escribir la fecha de envio. La puerta le
// pedia un dato que no existia en ninguna pantalla.
t("se puede registrar aunque ya se haya pasado de la etapa",
  C.canRegister({ id:"a", stage:"Initial Disclosures Sent", lenderId:"elend" }) === true);
t("y también estando en la etapa",
  C.canRegister({ id:"a", stage:"Full Application", lenderId:"elend" }) === true);
t("pero no antes de tiempo",
  C.canRegister({ id:"a", stage:"Credit Pull", lenderId:"elend" }) === false);
t("ni dos veces",
  C.canRegister(C.stampRegistration({ id:"a", stage:"Full Application", lenderId:"elend", stageLog:{} }, "Tina")) === false);
t("registrar desde Full Application avanza",
  C.stampRegistration({ id:"b", stage:"Full Application", lenderId:"elend", stageLog:{} }, "Tina").stage === "Initial Disclosures Sent");
t("registrar un archivo adelantado NO lo tira hacia atrás",
  C.stampRegistration({ id:"c", stage:"UW Review", lenderId:"elend", stageLog:{} }, "Tina").stage === "UW Review");
const reg = C.stampRegistration({ id:"d", stage:"Full Application", lenderId:"elend", stageLog:{} }, "Tina");
t("la fecha de envío se puede corregir a la real",
  C.discSentAt(C.setRegistrationDate(reg, "discSentAt", "2026-08-25")) === "2026-08-25");
t("una fecha inválida la deja vacía, no la inventa",
  C.discSentAt(C.setRegistrationDate(reg, "discSentAt", "no")) === null);

// ─── cartas ───
t("el catálogo tiene las quince", Object.keys(C.LOE_KINDS).length === 15);
let lt = C.addLetter({ id:"lt", stage:"UW Review" },
  { kind:"gift", text:"Regalo de $8,000 de la mamá", from:"borrower", by:"Ana" });
t("nace levantada", C.letterState(C.openLetters(lt)[0]) === "raised");
const lid = C.openLetters(lt)[0].id;
lt = C.stampLetterRequested(lt, lid, "Ana");
t("pedida guarda fecha y autor",
  C.letterState(C.lettersOf(lt)[0]) === "requested" && C.lettersOf(lt)[0].requestedBy === "Ana");
lt = C.stampLetterReceived(lt, lid, "Tina");
t("recibida cierra la carta", C.openLetters(lt).length === 0 && C.receivedLetters(lt).length === 1);
t("pedir dos veces no pisa al primero",
  C.stampLetterRequested(lt, lid, "Otro").letters[0].requestedBy === "Ana");
const directa = C.addLetter({ id:"d" }, { kind:"nsf", text:"Tres NSF en junio", by:"Tina" });
const did = C.openLetters(directa)[0].id;
t("recibir sin pedir estampa la petición también",
  !!C.stampLetterReceived(directa, did, "Tina").letters[0].requestedAt);
t("una carta sin texto se rechaza",
  C.lettersOf(C.addLetter({ id:"z" }, { kind:"nsf", text:"   " })).length === 0);
t("un tipo inventado cae en «otra»",
  C.lettersOf(C.addLetter({ id:"w" }, { kind:"xx", text:"algo" }))[0].kind === "other");
t("la petición al cliente no redacta la explicación",
  /puño/.test(C.letterRequestText({ text:"por qué", from:"borrower" }, "es")));
t("la del LO va directa a underwriting",
  /underwriting/i.test(C.letterRequestText({ text:"el cálculo", from:"lo" }, "es")));

// ─── catálogos bilingües ───────────────────────────────────────────
const sinPar = [];
for (const x of [...C.SUBMISSION_DOCS, ...C.DOC_FLAGS, ...C.CONTINGENCIES, ...C.MILESTONES])
  if (!x.es || !x.en) sinPar.push(x.id);
t("todo el catálogo tiene par ES/EN: " + (sinPar.join(", ") || "sí"), sinPar.length === 0);
t("las seis señales existen", Object.keys(C.SIGNALS).length === 6);

console.log(mal
  ? `✕ sondeo: ${ok} pasaron, ${mal} fallaron`
  : `sondeo: ${ok}/${ok} los bordes aguantan`);
process.exit(mal ? 1 : 0);
