// ═══════════════════════════════════════════════════════════════════
// CHECKLIST DE BARRETT — PDF
// ═══════════════════════════════════════════════════════════════════
//
// La forma de Barrett tal cual: sin la marca de Del Valle, sin el fondo
// oscuro, sin el dorado. Este papel va al expediente y a payroll, y quien
// lo revisa es Barrett — tiene que parecerse a SU forma, no a nuestro
// pipeline.
//
// Sale de SALIDA, no de entrada. Se trabaja en pantalla y se imprime para
// respaldo. Por eso aquí no hay un solo campo editable: es un retrato de
// lo que el sistema ya sabe.
//
// LO QUE FALTA VA EN BLANCO. En una forma de papel un renglón vacío
// significa "todavía no". Imprimir un guion o un "pendiente" cambiaría ese
// significado sin que nadie lo haya decidido — la misma razón por la que
// la celda vacía en la hoja de Martha es honesta.
//
// pdf-lib se baja del CDN al momento del clic, igual que ExcelJS. No está
// en package.json a propósito: solo pesa cuando alguien imprime.
// ═══════════════════════════════════════════════════════════════════

import {
  okDate, today, lenderNameOf, CHANNELS, intakeValue, isCondo,
  registeredAt, discSentAt, discEsignedAt, barrettDiscSentAt,
  loanNumberInvestor, loanNumberLender, orderState, orderDue,
  milestoneAt, uwOutcome, uwOutcomeAt, contractSignalDate,
  GATE1_VERIFY_IDS, GATE1_STATES, gate1State, gate1At, gate1By, gate1Item,
  openFindings, lockStatus, latestNote, financedFeeAmount, compBasisAmount,
} from "./pipelineCore";

const PDFLIB_CDN = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";

// ─── 1. GEOMETRÍA ──────────────────────────────────────────────────
// Carta en puntos. El margen de 54 (0.75") es el de su forma original.
export const PAGE = { w: 612, h: 792 };
const M = 54;                    // margen izquierdo y derecho
const TOP = PAGE.h - 52;
const LH = 19.5;                 // alto de renglón
const FS = 8.5;                  // cuerpo
const FS_LBL = 8.5;              // etiqueta en negrita
const RULE_PAD = 2.2;            // cuánto baja la línea de firma bajo la base

// ─── 2. DATOS → RENGLONES ──────────────────────────────────────────

const mmddyy = iso => {
  const d = okDate(iso);
  return d ? `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(2, 4)}` : "";
};
const money = n => (Number.isFinite(Number(n)) && Number(n) !== 0)
  ? "$" + Math.round(Number(n)).toLocaleString("en-US") : "";
const yn = v => v === "yes" ? "Yes" : v === "no" ? "No" : "";

// El texto de un pedido en el vocabulario de la forma, no en el de Martha.
// Aquí no dice "REQ 07/17": dice la fecha, que es lo que el renglón pide.
const pedido = (file, id) => {
  const o = orderState(file, id);
  return mmddyy(o.rec || o.req);
};

// "Appraisal Ordered" y "Appraisal Due" son dos renglones distintos en la
// forma, aunque en la hoja de Martha compartan celda.
const tasacionPedida = file => mmddyy(orderState(file, "appraisal").req);
const tasacionDue    = file => mmddyy(orderDue(file, "appraisal"));

// El resultado del underwriter en un solo renglón, como lo escribe la forma:
// "File Approved / Denied or Suspended Date". La palabra importa tanto como
// la fecha, así que van juntas.
function resultadoUw(file) {
  const o = uwOutcome(file);
  if (!o) return "";
  const etiqueta = { approved: "Approved", denied: "Denied", suspended: "Suspended" }[o];
  const d = mmddyy(uwOutcomeAt(file));
  return d ? `${etiqueta} ${d}` : etiqueta;
}

// El monto del pagaré, no el base. Es la misma regla que la comisión: en un
// FHA el UFMIP se financia dentro del préstamo y el papel tiene que decir lo
// que de verdad se firma.
function montoPrestamo(file) {
  const base = Number(file?.loan) || 0;
  if (!base) return "";
  return financedFeeAmount(file) > 0 ? money(compBasisAmount(file)) : money(base);
}

const PROGRAMA_MARCAS = ["CONV", "FHA", "VA", "USDA", "DPA/CALHFA", "DSCR"];
function programaMarcado(file) {
  const t = String(file?.type || "").toLowerCase();
  if (file?.dpa?.on) return "DPA/CALHFA";
  if (/dscr/.test(t)) return "DSCR";
  if (/usda/.test(t)) return "USDA";
  if (/\bva\b|irrrl/.test(t)) return "VA";
  if (/fha/.test(t)) return "FHA";
  if (/conv/.test(t)) return "CONV";
  return null;
}

const PROPOSITO_MARCAS = [
  ["purchase", "Purchase"], ["cashout", "Cash-Out Refi"],
  ["rateterm", "No Cash-Out Refi R/T"], ["construction", "Construction"],
  ["other", "Other"],
];
const OCUPACION_MARCAS = [
  ["primary", "Primary"], ["secondary", "Secondary"], ["investment", "Investment Property"],
];
const PLAZO_MARCAS = [["30", "30 YR"], ["15", "15 YR"], ["20", "20 YR"]];
const ENGANCHE_MARCAS = [["3", "3%"], ["3.5", "3.5%"], ["5", "5%"]];

// ─── 3. CARGA DE PDF-LIB ───────────────────────────────────────────
let libPromise = null;
export function loadPdfLib() {
  if (typeof window !== "undefined" && window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFLIB_CDN;
    s.async = true;
    s.onload = () => window.PDFLib
      ? resolve(window.PDFLib)
      : reject(new Error("pdf-lib cargó pero no se registró"));
    s.onerror = () => { libPromise = null; reject(new Error("No se pudo bajar pdf-lib")); };
    document.head.appendChild(s);
  });
  return libPromise;
}

// ─── 4. EL DIBUJO ──────────────────────────────────────────────────
// Un pincel por página. Encapsula la fuente, el cursor y las tres cosas
// que esta forma hace todo el tiempo: etiqueta + línea de firma, casillas,
// y títulos subrayados.
function pincel(page, fonts, PDFLib) {
  const { rgb } = PDFLib;
  const NEGRO = rgb(0, 0, 0);
  const GRIS = rgb(0.45, 0.45, 0.45);
  let y = TOP;

  const texto = (s, x, yy, { bold = false, size = FS, color = NEGRO } = {}) => {
    if (s === null || s === undefined || s === "") return 0;
    const f = bold ? fonts.bold : fonts.reg;
    page.drawText(String(s), { x, y: yy, size, font: f, color });
    return f.widthOfTextAtSize(String(s), size);
  };

  const linea = (x1, x2, yy, grosor = 0.6) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy },
      thickness: grosor, color: rgb(0.25, 0.25, 0.25) });

  // Etiqueta seguida de una línea de firma con el valor encima. Devuelve
  // dónde termina, para poder encadenar campos en el mismo renglón.
  const campo = (label, valor, x, ancho, { bold = true, yy = y } = {}) => {
    const w = texto(label, x, yy, { bold, size: FS_LBL });
    const x0 = x + w + 3;
    const x1 = x + ancho;
    linea(x0, x1, yy - RULE_PAD);
    if (valor) texto(valor, x0 + 3, yy + 1.5);
    return x1;
  };

  // Casilla. `on` la rellena; la forma de papel se marca a mano, aquí se
  // marca sola con lo que el sistema ya sabe.
  const casilla = (label, on, x, yy = y) => {
    const s = 8;
    page.drawRectangle({ x, y: yy - 1, width: s, height: s,
      borderColor: NEGRO, borderWidth: 0.8,
      color: on ? rgb(0.15, 0.15, 0.15) : undefined });
    if (on) {
      page.drawLine({ start: { x: x + 1.7, y: yy + 3 }, end: { x: x + 3.3, y: yy + 0.6 },
        thickness: 1.1, color: rgb(1, 1, 1) });
      page.drawLine({ start: { x: x + 3.3, y: yy + 0.6 }, end: { x: x + 6.4, y: yy + 6 },
        thickness: 1.1, color: rgb(1, 1, 1) });
    }
    const w = texto(label, x + s + 4, yy, { size: FS });
    return x + s + 6 + w;
  };

  // Fila de casillas de una sola escogencia.
  const opciones = (label, lista, elegido, x, yy = y) => {
    let cx = x;
    if (label) cx += texto(label, x, yy, { bold: true, size: FS_LBL }) + 8;
    for (const [v, txt] of lista) cx = casilla(txt, v === elegido, cx, yy) + 8;
    return cx;
  };

  const titulo = (s, yy = y) => {
    const w = texto(s, M, yy, { bold: true, size: 9 });
    linea(M, M + w, yy - 2.4, 0.8);
  };

  return {
    texto, linea, campo, casilla, opciones, titulo, GRIS, NEGRO,
    salto: (n = 1) => { y -= LH * n; return y; },
    en: v => { y = v; return y; },
    get y() { return y; },
  };
}

// ─── PÁGINA 1 ──────────────────────────────────────────────────────
export function dibujarPagina1(page, fonts, PDFLib, file) {
  const p = pincel(page, fonts, PDFLib);
  const ANCHO = PAGE.w - M * 2;
  const MED = M + ANCHO / 2;

  // ── encabezado ──
  p.campo("Borrower Name:", file?.borrower || "", M, ANCHO / 2 - 10);
  p.campo("Co-Borrower Name:", intakeValue(file, "coBorrower") || "", MED, ANCHO / 2);
  p.salto();
  p.campo("Address:", intakeValue(file, "address") || "", M, ANCHO);
  p.salto();
  p.campo("Parcel #:", intakeValue(file, "parcelNumber") || "", M, ANCHO / 2 - 10);
  p.campo("Credit Report File #:", intakeValue(file, "creditFileNumber") || "", MED, ANCHO / 2);
  p.salto(1.4);

  // ── canal ── el que decide qué lenders existen y cuánto se puede cobrar
  const canal = file?.channel === "correspondent" ? "correspondent" : "broker";
  let cx = p.casilla("BROKER", canal === "broker", M) + 22;
  cx = p.casilla("MINI CORRESPONDENT", canal === "correspondent", cx) + 22;
  p.casilla("SEND BARRETT DISCLOSURE REQUIRED IN ARIVE", !!barrettDiscSentAt(file), cx);
  p.salto(1.5);

  // ── RPA Review ──
  p.titulo("RPA Review");
  p.salto(1.1);
  const c = file?.contingencies || {};
  // Cuatro columnas, NO iguales. "Contract Signal Date:" es una etiqueta
  // mucho mas larga que las otras tres y en un cuarto exacto se comia el
  // valor del campo siguiente.
  const [c1, c2, c3] = [150, 122, 118];
  p.campo("Contract Signal Date:", mmddyy(contractSignalDate(file)), M, c1 - 8);
  p.campo("Contract Date:", mmddyy(c.contractAccepted), M + c1, c2 - 8);
  p.campo("Contract COE:", mmddyy(c.coe || file?.closing), M + c1 + c2, c3 - 8);
  p.campo("Projected COE:", "", M + c1 + c2 + c3, ANCHO - c1 - c2 - c3);
  p.salto();
  p.campo("Loan Contingency Removal:", mmddyy(c.loanContingency), M, ANCHO / 2 - 10);
  p.campo("Appraisal Contingency Removal:", mmddyy(c.appraisalContingency), MED, ANCHO / 2);
  p.salto();
  p.campo("Seller Concessions:", money(intakeValue(file, "sellerConcessions")), M, ANCHO / 2 - 10);
  p.campo("Earnest Money Deposit:", money(intakeValue(file, "earnestMoney")), MED, ANCHO / 2);
  p.salto();
  p.campo("Sales Price:", money(intakeValue(file, "salesPrice")), M, ANCHO / 2 - 10);
  p.campo("Loan Amount:", montoPrestamo(file), MED, ANCHO / 2);
  p.salto();

  const mi = intakeValue(file, "miRequired");
  let mx = p.texto("MI Required:", M, p.y, { bold: true, size: FS_LBL }) + M + 5;
  mx += p.texto(yn(mi), mx, p.y) + 14;
  mx = p.campo("Percentage:", mi === "yes" && intakeValue(file, "miPct") !== null
    ? intakeValue(file, "miPct") + "%" : "", mx, 92, { bold: false }) + 22;
  mx += p.texto("Escrows Waiver:", mx, p.y, { bold: true, size: FS_LBL }) + 5;
  p.texto(yn(intakeValue(file, "escrowWaiver")), mx, p.y);
  p.salto(1.3);

  const px = p.opciones("Loan Term:", PLAZO_MARCAS, String(intakeValue(file, "loanTerm") || ""), M);
  const dp = intakeValue(file, "downPaymentPct");
  const dpStr = dp === null || dp === undefined ? "" : String(dp);
  const dx = p.opciones("Down Payment:", ENGANCHE_MARCAS, dpStr, px + 18);
  const otro = dpStr && !ENGANCHE_MARCAS.some(([v]) => v === dpStr);
  p.campo("Other", otro ? dpStr + "%" : "", dx + 4, 96, { bold: false });
  p.salto(1.5);

  // ── Loan Information ──
  p.titulo("Loan Information:");
  p.salto(1.1);
  p.opciones("Purpose of Loan:", PROPOSITO_MARCAS, intakeValue(file, "purposeOfLoan"), M);
  p.salto();
  p.opciones("Property Will Be:", OCUPACION_MARCAS, intakeValue(file, "occupancy"), M);
  p.salto();
  let fx = p.texto("1st Time Homebuyer:", M, p.y, { bold: true, size: FS_LBL }) + M + 5;
  p.texto(yn(intakeValue(file, "firstTimeBuyer")), fx, p.y);
  p.salto();

  const tipo = intakeValue(file, "propertyType");
  let hx = p.texto("Manufactured Home:", M, p.y, { bold: true, size: FS_LBL }) + M + 5;
  hx += p.texto(tipo ? (tipo === "manufactured" ? "Yes" : "No") : "", hx, p.y) + 22;
  hx += p.texto("Condo:", hx, p.y, { bold: true, size: FS_LBL }) + 5;
  hx += p.texto(tipo ? (isCondo(file) ? "Yes" : "No") : "", hx, p.y) + 12;
  hx = p.campo("If Condo Name:", intakeValue(file, "condoName") || "", hx, 178, { bold: false }) + 8;
  p.campo("#:", intakeValue(file, "condoUnit") || "", hx, 74, { bold: false });
  p.salto();

  let ax = p.texto("HOA:", M, p.y, { bold: true, size: FS_LBL }) + M + 5;
  ax += p.texto(yn(intakeValue(file, "hoa")), ax, p.y) + 22;
  p.texto("Note. If the property has HOA indicate PUD in the system.", ax, p.y, { color: p.GRIS });
  p.salto();
  p.opciones("Loan Program:", PROGRAMA_MARCAS.map(x => [x, x]), programaMarcado(file), M);
  p.salto(1.5);

  // ── lender y fechas ──
  const nombreLender = lenderNameOf(file) || "";
  p.campo("Lender/Investor:", nombreLender, M, ANCHO / 2 - 10);
  p.campo("Loan #:", loanNumberInvestor(file) || "", MED, ANCHO / 2);
  p.salto();
  p.campo("Lender:", nombreLender, M, ANCHO / 2 - 10, { bold: false });
  p.campo("Loan #:", loanNumberLender(file) || "", MED, ANCHO / 2, { bold: false });
  p.salto(1.2);

  const t3 = ANCHO / 3;
  p.campo("Title Fees and Title Docs Requested:", pedido(file, "title"), M, t3 + 62, { bold: false });
  p.campo("HOI Quote:", pedido(file, "hoi_quote"), M + t3 + 70, t3 - 44, { bold: false });
  p.campo("Binder:", pedido(file, "hoi_binder"), M + t3 * 2 + 34, t3 - 34, { bold: false });
  p.salto();
  p.campo("File Registered with Lender Date:", mmddyy(registeredAt(file)), M, ANCHO / 2 + 20, { bold: false });
  p.salto();
  p.campo("Initial Disclosures:", mmddyy(discSentAt(file)), M, ANCHO / 2 - 10, { bold: false });
  p.campo("Initial Disclosures Signed:", mmddyy(discEsignedAt(file)), MED, ANCHO / 2, { bold: false });
  p.salto();
  const lk = lockStatus(file);
  p.campo("Date Locked:", lk.state === "locked" ? mmddyy(lk.lockedAt) : "", M, ANCHO / 2 - 10, { bold: false });
  p.campo("Lock Expires:", lk.state === "locked" ? mmddyy(lk.expires) : "", MED, ANCHO / 2, { bold: false });
  p.salto();
  p.campo("File Submitted to U/W:", mmddyy((file?.stageLog || {})["Submitted to UW"]), M, ANCHO / 2 - 10, { bold: false });
  p.campo("File Approved / Denied or Suspended Date:", resultadoUw(file), MED, ANCHO / 2, { bold: false });
  p.salto();
  p.campo("Appraisal Ordered:", tasacionPedida(file), M, ANCHO / 2 - 10, { bold: false });
  p.campo("Appraisal Due:", tasacionDue(file), MED, ANCHO / 2, { bold: false });
  p.salto();
  p.campo("FHA Case Number Requested:", mmddyy(milestoneAt(file, "fha_case")), M, ANCHO / 2 - 10, { bold: false });
  p.campo("File Task for ICD Date:", mmddyy(milestoneAt(file, "icd_task")), MED, ANCHO / 2, { bold: false });
  p.salto();
  p.campo("File Resubmitted for CTC:", mmddyy(milestoneAt(file, "resubmit_ctc")), M, ANCHO / 2 - 10, { bold: false });
  p.salto();
  const log = file?.stageLog || {};
  p.campo("Docs Out Date:", mmddyy(log["Closing Docs Drawn"]), M, t3 - 10, { bold: false });
  p.campo("Funding Date:", mmddyy(log["Funded"] || file?.closedAt), M + t3, t3 - 10, { bold: false });
  p.campo("VVOE:", mmddyy(milestoneAt(file, "vvoe")), M + t3 * 2, t3, { bold: false });

  // Pie discreto: de dónde salió el papel y cuándo. Sin esto, dos
  // impresiones del mismo archivo en semanas distintas son indistinguibles.
  p.texto(`Del Valle Lending Co. · powered by Barrett Financial Group · printed ${mmddyy(today())}`,
    M, 38, { size: 6.5, color: p.GRIS });
  p.texto("1", PAGE.w / 2, 38, { size: 7.5, color: p.GRIS });
}

// El orden de la página 2 es el de SU forma, no el del motor: residencia
// con su historial al lado, empleo con el suyo, ingresos con activos, la
// carta de regalo con la capacidad del donante. Leerlos en pareja es como
// se revisan. `form_1003` no entra a la rejilla porque encabeza la página.
const PAGE2_ORDER = [
  "residence", "residence_2y",
  "employment", "employment_2y",
  "income", "assets",
  "gift_letter", "donor_ability",
  "declarations", "liabilities",
  "mi_verified",
];

// ─── PÁGINA 2 ──────────────────────────────────────────────────────
export function dibujarPagina2(page, fonts, PDFLib, file) {
  const p = pincel(page, fonts, PDFLib);
  const ANCHO = PAGE.w - M * 2;
  const abiertos = openFindings(file);

  // El renglón que encabeza la página NO es un resumen de los otros once:
  // en la forma es su propio punto, y en el motor es `form_1003`. Decia
  // "Yes" con un hallazgo abierto encima porque preguntaba si algo seguia
  // pendiente en vez de si estaba limpio.
  const revisado = gate1State(file, "form_1003") === "verified";
  let hx = p.texto("1003 Reviewed and Completed:", M, p.y, { bold: true, size: 9 });
  p.linea(M, M + hx, p.y - 2.4, 0.8);
  p.texto(revisado ? "Yes" : "", M + hx + 6, p.y);
  p.salto(1.5);

  // Los doce puntos en dos columnas, con su estado, su fecha y QUIÉN lo
  // marcó. En un papel que va al expediente, la firma importa: no es lo
  // mismo "esto se revisó" que "Tina revisó esto".
  const COL = ANCHO / 2;
  const ETIQ = { verified: "Verified", na: "N/A", finding: "FINDING", pending: "" };
  PAGE2_ORDER.forEach((id, i) => {
    const x = M + (i % 2) * COL;
    if (i % 2 === 0 && i > 0) p.salto(1.25);
    const st = gate1State(file, id);
    const y0 = p.y;
    p.casilla("", st === "verified", x, y0);
    const w = p.texto(gate1Item(id)?.en || id, x + 13, y0, { size: FS });
    const quien = gate1By(file, id);
    const detalle = st === "pending" ? ""
      : st === "finding" ? "FINDING"
      : `${ETIQ[st]} ${mmddyy(gate1At(file, id))}${quien ? " · " + String(quien).split(" ")[0] : ""}`;
    p.texto(detalle, x + 13 + w + 6, y0, { size: 6.8, color: p.GRIS });
  });
  p.salto(1.9);

  // Las cuatro notas de producto que trae su forma, palabra por palabra.
  const NOTAS = [
    "Conventional \u2013 Loans with LTV greater than 80% are required to have mortgage insurance and will have",
    "either an upfront premium or a monthly premium.",
    "FHA \u2013 Verify that the MIP period is selected and that the FILL button is clicked for any red exclamations",
    "next to MIP percent and Annual MIP Premium.",
    "VA \u2013 Verify that the Funding fee TYPE is selected and that the FILL button is clicked for any red circled",
    "exclamation points next to any of the boxes below the MIP Period.",
    "USDA \u2013 Verify that the MIP period is selected and that the FILL button is clicked for any red-circled",
    "exclamation points next to any of the boxes below the MIP Period.",
  ];
  NOTAS.forEach((s, i) => {
    const sangria = i % 2 === 0 ? 0 : 10;
    if (i % 2 === 0) p.texto("\u2022", M + 6, p.y, { size: 7 });
    p.texto(s, M + 18 + sangria, p.y, { size: 7, color: p.GRIS });
    p.salto(0.62);
  });
  p.salto(1.2);

  // ── REMARKS ──
  // Los hallazgos abiertos van aquí porque es donde alguien los va a leer
  // en papel. Un punto en rojo en la pantalla no viaja al expediente.
  p.texto("REMARKS:", M, p.y, { bold: true, size: 9 });
  p.salto(1.2);

  const renglones = [];
  for (const f of abiertos) {
    const punto = gate1Item(f.item)?.en || "Other";
    renglones.push(`${punto} \u2014 ${f.text}${f.at ? "  (" + mmddyy(f.at) + ")" : ""}`);
  }
  const nota = latestNote(file);
  if (nota?.text) renglones.push(nota.text);

  // Catorce líneas de firma, como su forma. Las que sobran quedan en blanco
  // a propósito: el papel tiene que poder escribirse a mano encima.
  for (let i = 0; i < 14; i++) {
    const y0 = p.y;
    if (renglones[i]) p.texto(renglones[i].slice(0, 118), M + 2, y0 + 2, { size: 7.6 });
    p.linea(M, M + ANCHO, y0, 0.5);
    p.salto(0.95);
  }

  p.texto("2", PAGE.w / 2, 38, { size: 7.5, color: p.GRIS });
}

// ─── 5. EL DOCUMENTO ───────────────────────────────────────────────
export async function buildChecklist(PDFLib, file) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();
  const fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  doc.setTitle(`Barrett Checklist \u2014 ${file?.borrower || ""}`);
  dibujarPagina1(doc.addPage([PAGE.w, PAGE.h]), fonts, PDFLib, file);
  dibujarPagina2(doc.addPage([PAGE.w, PAGE.h]), fonts, PDFLib, file);
  return doc;
}

export function checklistFileName(file) {
  const n = String(file?.borrower || "file").replace(/[^A-Za-z0-9 ]/g, "").trim()
    .replace(/\s+/g, "_").slice(0, 40);
  return `Barrett_Checklist_${n}_${today()}.pdf`;
}

export async function downloadChecklist(file) {
  const PDFLib = await loadPdfLib();
  const doc = await buildChecklist(PDFLib, file);
  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = checklistFileName(file);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
