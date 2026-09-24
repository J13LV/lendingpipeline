// ═══════════════════════════════════════════════════════════════════
//  puertas.mjs · DONDE SE ARREGLA CADA PUERTA
//
//  Cada fila de la auditoria, convertida en prueba. Lo que se comprueba
//  no es que `gateFix` devuelva algo: es que lo que devuelve sea REAL y
//  ALCANZABLE para el rol que choca. Dos veces se construyo un gate sin
//  punto de entrada; esto es lo que impide que pase una tercera.
// ═══════════════════════════════════════════════════════════════════
const C = await import("./_core.mjs");

let ok = 0, mal = 0;
const t = (n, cond) => { if (cond) ok++; else { mal++; console.log("  ✕ " + n); } };

const JOSE   = { role:"admin",     name:"Jose Del Valle" };
const ANA    = { role:"lo",        name:"Ana M Plasencia" };
const OTRO   = { role:"lo",        name:"Marelis Pinales" };
const TINA   = { role:"assistant", name:"Tina" };
const LAURA  = { role:"processor", name:"Laura de Armas", processorId:"laura" };

const f = (extra={}) => ({ id:"f1", borrower:"Cliente", lo:"Ana M Plasencia",
  type:"FHA", loan:400000, stageLog:{}, contingencies:{}, ...extra });

// ─── la regla blanda no ofrece arreglo ─────────────────────────────
// La firma es del cliente. Un boton aqui empuja a inventar una fecha.
t("la firma del cliente no tiene arreglo que ofrecer",
  C.gateFix("disc_signed", f(), TINA) === null);
t("ni para el admin", C.gateFix("disc_signed", f(), JOSE) === null);
t("una regla que no existe tampoco", C.gateFix("inventada", f(), JOSE) === null);

// ─── 1 · el 1003 · dos pantallas, segun el rol ─────────────────────
const g1 = w => C.gateFix("gate1", f({ stage:"Under Contract" }), w);
t("el LO lo marca en el detalle, solapa EXPEDIENTE",
  g1(ANA).puede && g1(ANA).vista === "detail" && g1(ANA).tab === "file");
t("el admin igual", g1(JOSE).puede && g1(JOSE).tab === "file");
t("Tina va a PROCESAMIENTO, no al detalle",
  g1(TINA).puede && g1(TINA).vista === "processing" && g1(TINA).sub === "findings");
t("y las dos rutas dicen cosas distintas", g1(ANA).es !== g1(TINA).es);
// Laura sobre un archivo de Martha entra en solo lectura: no es alcanzable.
const g1Martha = C.gateFix("gate1", f({ stage:"Under Contract", processor:"martha" }), LAURA);
t("Laura sobre la cola de Martha NO puede, y se le dice quien",
  g1Martha.puede === false && g1Martha.quien === "Ana M Plasencia");
t("pero sobre la suya si",
  C.gateFix("gate1", f({ stage:"Under Contract", processor:"laura" }), LAURA).puede === true);

// ─── 2 · fechas del contrato · sin guardia de rol ──────────────────
for (const [n, w] of [["el LO",ANA],["Tina",TINA],["Laura",LAURA],["el admin",JOSE]]) {
  const x = C.gateFix("contract_dates", f({ stage:"Under Contract" }), w);
  t(`${n} puede teclear las fechas del contrato`,
    x.puede && x.vista === "detail" && x.tab === "dates");
}

// ─── 3 · registro · dos destinos, no uno ───────────────────────────
// Sin lender el boton de registrar ni aparece. El destino real es LENDER.
const sinLender = f({ stage:"Full Application" });
t("sin lender manda a LENDER, no a PRESTAMO",
  C.gateFix("registered", sinLender, ANA).tab === "lender");
t("y el LO SI puede escoger lender (LenderPanel no tiene guardia de rol)",
  C.gateFix("registered", sinLender, ANA).puede === true);
const conLender = f({ stage:"Full Application", lenderId:"elend" });
t("con lender, Tina registra desde PRESTAMO",
  C.gateFix("registered", conLender, TINA).puede &&
  C.gateFix("registered", conLender, TINA).tab === "loan");
t("el LO NO registra, y se le dice que es de Tina",
  C.gateFix("registered", conLender, ANA).puede === false &&
  C.gateFix("registered", conLender, ANA).quien === "Tina");
t("el admin si", C.gateFix("registered", conLender, JOSE).puede === true);

// ─── 4 · fecha de envio de disclosures · solo PROCESAMIENTO ────────
const d = f({ stage:"Initial Disclosures Sent", lenderId:"elend" });
t("Tina la escribe en PROCESAMIENTO → LISTA",
  C.gateFix("disc_sent", d, TINA).puede &&
  C.gateFix("disc_sent", d, TINA).vista === "processing" &&
  C.gateFix("disc_sent", d, TINA).sub === "checklist");
t("el LO no tiene camino: MilestonesPane no existe en el detalle",
  C.gateFix("disc_sent", d, ANA).puede === false &&
  C.gateFix("disc_sent", d, ANA).quien === "Tina");

// ─── 6 y 7 · el CD · la fecha es de todos, los fees son del LO ─────
const cd = f({ stage:"CD Issued", lenderId:"elend" });
t("la fecha de salida del CD la escribe cualquiera",
  C.gateFix("cd_sent", cd, TINA).puede && C.gateFix("cd_sent", cd, JOSE).puede);
t("los fees solo el LO dueño del archivo", C.gateFix("cd_fees", cd, ANA).puede === true);
t("otro LO no, y se le dice de quien es",
  C.gateFix("cd_fees", cd, OTRO).puede === false &&
  C.gateFix("cd_fees", cd, OTRO).quien === "Ana M Plasencia");
t("Tina tampoco", C.gateFix("cd_fees", cd, TINA).puede === false);
t("el admin si, porque origina", C.gateFix("cd_fees", cd, JOSE).puede === true);

// ─── 8 · la tasacion · el callejon encadenado ──────────────────────
// Reg Z: no se pide antes de la firma. El boton existe pero nace apagado.
const sinFirma = f({ stage:"Appraisal Ordered", lenderId:"elend" });
const a1 = C.gateFix("appr_req", sinFirma, TINA);
t("sin firma del cliente NO se manda a PEDIDOS", a1.espera === true && a1.vista === null);
t("y se dice que lo que falta es la firma", /firme|sign/i.test(a1.es + a1.en));
t("le pasa igual al admin", C.gateFix("appr_req", sinFirma, JOSE).espera === true);
// Con la firma puesta, el boton ya no nace apagado.
const conFirma = f({ stage:"Appraisal Ordered", lenderId:"elend",
  registrations:[{ lenderId:"elend", at:"2026-09-01", discSentAt:"2026-09-01",
                   discEsignedAt:"2026-09-03" }] });
t("el motor confirma que ya se puede pedir", C.canOrderAppraisal(conFirma) === true);
const a2 = C.gateFix("appr_req", conFirma, TINA);
t("con firma, Tina va a PROCESAMIENTO → PEDIDOS",
  a2.puede && a2.vista === "processing" && a2.sub === "orders");
t("el LO no la pide, y se le dice que es de la procesadora",
  C.gateFix("appr_req", conFirma, ANA).puede === false &&
  C.gateFix("appr_req", conFirma, ANA).quien === "Martha Samaniego");

// ─── forma · lo que la pantalla necesita para pintar ───────────────
const todas = ["gate1","contract_dates","registered","disc_sent","cd_sent","cd_fees","appr_req"];
for (const id of todas) {
  const x = C.gateFix(id, f({ stage:"Under Contract", lenderId:"elend" }), JOSE);
  t(`${id}: trae ruta en los dos idiomas`, !!x && !!x.es && !!x.en && x.es !== x.en);
  if (x && x.puede) t(`${id}: si se puede arreglar, trae ancla y vista`, !!x.ancla && !!x.vista);
  if (x && !x.puede && !x.espera) t(`${id}: si no se puede, trae a quien`, !!x.quien);
}

// Toda regla dura de STAGE_GATES tiene que tener su fila aqui. Si mañana
// se añade una puerta y se olvida el destino, esto lo caza.
const sinDestino = [];
for (const [etapa, reglas] of Object.entries(C.STAGE_GATES))
  for (const r of reglas) {
    if (!r.hard) continue;
    const x = C.gateFix(r.id, f({ stage:etapa, lenderId:"elend" }), JOSE);
    if (!x) sinDestino.push(`${etapa}/${r.id}`);
  }
t("ninguna puerta dura se quedo sin destino: " + (sinDestino.join(", ") || "sí"),
  sinDestino.length === 0);

console.log(mal ? `✕ puertas: ${ok} pasaron, ${mal} fallaron`
                : `puertas: ${ok}/${ok} cada puerta tiene salida real`);
process.exit(mal ? 1 : 0);
