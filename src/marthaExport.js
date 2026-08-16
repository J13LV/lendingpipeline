// ═══════════════════════════════════════════════════════════════════
// EXPORT DE LA HOJA DE MARTHA
// ═══════════════════════════════════════════════════════════════════
//
// Martha Samaniego lleva años con su propio Excel de 29 columnas y nos
// lo manda dos veces por semana. De esas 29, la mitad de arriba sale de
// nuestro lado — contrato, COE, contingencias, lender — y ella las
// teclea a mano cada vez. Este archivo genera SU hoja, con SU formato,
// con esas columnas ya llenas.
//
// La regla de oro: no le cambiamos nada. Mismo nombre de pestaña, mismos
// encabezados en el mismo orden, mismos anchos, mismos colores, misma
// leyenda abajo. Si abre el archivo y le parece distinto al suyo,
// fallamos, por muy correcto que esté el dato.
//
// ExcelJS se carga desde CDN al momento del clic. No está en
// package.json a propósito: son ~950 KB que solo bajan cuando alguien
// exporta, y así el deploy no depende de un rebuild de dependencias.
// ═══════════════════════════════════════════════════════════════════

import {
  okDate, today, addDays, lenderNameOf, baseProductOf,
  productKeyForLoanType, stageLogOf, latestNote, lockStatus,
} from "./pipelineCore";

const EXCELJS_CDN = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";

// ─── 1. SUS ENCABEZADOS ────────────────────────────────────────────
// Copiados carácter por carácter de su archivo, espacios finales
// incluidos ("Status ", "Approved ", "CTC "). Si alguna vez pegamos su
// hoja de vuelta en la nuestra, esos espacios tienen que cuadrar.
export const MARTHA_HEADERS = [
  "Borrower's Name:", "Loan Program", "Loan Type", "LO", "LOA/Processor",
  "LENDER", "Status ", "Contract Date", "Contract COE", "Critical Doc Out Date",
  "Loan Contingency", "Appraisal Contingency", "File Assigned to LOA/Processor",
  "Title Fees Ordered", "HOI Quote Ordered", "HOI BINDER, RCE AND INVOICE ",
  "Loan Registered Date", "Investor Disc Sent", "Investor Disc Esigned",
  "Appraisal Ordered & Due", "Condo Docs Ordered ", "File to Underwriting",
  "Approved ", "Loan Lock Date", "Lock Exp Date", "CD Out", "CTC ", "Docs Out",
  "NOTES",
];

// Anchos exactos de su hoja, columna A hasta AC.
const WIDTHS = [32.9, 15.7, 16.6, 16.9, 16.1, 22.0, 63.9, 14.6, 14.0, 22.0,
  20.0, 22.6, 31.0, 19.3, 21.6, 32.0, 21.0, 20.9, 21.3, 26.4, 21.6, 21.4,
  12.9, 17.9, 15.4, 17.0, 14.4, 11.9, 111.4];

// ─── 2. SUS COLORES ────────────────────────────────────────────────
// Ella pinta TRES zonas independientes, no la fila entera:
//   columna A  → el canal (broker vs mini correspondent)
//   columna G  → el estado (su leyenda de seis colores)
//   B hasta AC → fondo crema, sin significado
//
// Los tonos salen de sus FILAS DE DATOS, no de su leyenda. Los dos no
// cuadran — su leyenda dice FF9900 para el naranja y 0099FF para el
// azul, pero en las filas usa FFC000 y 3399FF. Escogimos lo que ella ve
// todos los días para que las filas viejas y las nuevas hagan juego.
const CREMA = "FFFFFFC5";
const CANAL_FILL = {
  correspondent: "FF3399FF",   // mini correspondent, azul sólido
  broker:        "FFADB9CA",   // tema 3 al 60%, que es su gris azulado
};

// Etapa del pipeline → color de su columna Status. Las etapas que no
// aparecen aquí no tienen color propio en su sistema y quedan en crema.
const ESTADO_FILL = {
  "Initial Disclosures Sent": "FFCCECFF",   // new file / disclosures fuera
  "Submitted to UW":          "FF9999FF",
  "UW Review":                "FF9999FF",
  "Conditional Approval":     "FFFFFF00",   // condiciones del prestatario
  "Condition Clearing":       "FFFFC000",   // re-sometido
  "Clear to Close":           "FF92F694",
  "CD Issued":                "FF92F694",
  "Closing Scheduled":        "FF92F694",
  "Closing Docs Drawn":       "FF92F694",
  "Signing":                  "FF92F694",
};

const LEYENDA = [
  ["NEW FILE / INITIAL DISCLOSURES EMAILED OUT TO BORROWER ", "FFCCECFF"],
  ["SUBMITTED U/W INITIAL APPV ", "FF9999FF"],
  ["Appv Borr Conditions Pending", "FFFFFF00"],
  ["ALL CONDITIONS RECEIVED / RE-SUBMITTED TO U/W TO CLEAR CONDITIONS  ", "FFFF9900"],
  ["CLEAR TO CLOSE // TASK FOR DOCS ", "FF92F694"],
  ["HOLD / SUSPENDED / ISSUES/ WAITING FOR BORROWER TO SIGN INVESTOR DISCL", "FFFF0000"],
];
const LEYENDA_CANAL = [
  ["MINI CORRESPONDENT LOAN", "FF0099FF"],
  ["BROKER LOAN ", "FF8497B0"],
];

// ─── 3. TRADUCCIONES DE DATO ───────────────────────────────────────

// Su columna "Loan Program" usa las abreviaturas cortas, no los nombres
// largos de nuestro catálogo.
const PROGRAMA = {
  fha: "FHA", conventional: "CONV", va: "VA", usda: "USDA",
  nonqm: "NON-QM", jumbo: "JUMBO", second: "HELOC", other: "",
};

// Su "Loan Type" es compra o refinanciamiento, no el producto.
function loanType(file) {
  return productKeyForLoanType(file?.type) === "refi" ? "REFINANCE " : "PURCHASE ";
}

// El Critical Doc Out Date de ella es COE − 7 en siete de sus ocho
// archivos. El octavo lo puso en COE − 4, o sea que lo ajusta a mano
// cuando le conviene. Calculamos −7 y ella lo corrige si hace falta.
export function criticalDocOut(coeISO) {
  const coe = okDate(coeISO);
  return coe ? addDays(coe, -7) : null;
}

// Cuándo se registró el archivo, que es el mismo instante en que Martha
// lo recibe. En SU hoja, "File Assigned to LOA/Processor" y "Loan
// Registered Date" son la misma fecha en las ocho filas, sin excepción.
//
// El campo dedicado todavía no existe. Mientras tanto se deriva de
// cuándo el archivo entró a Full Application, que es la etapa donde Tina
// registra. Cuando exista `registeredAt`, este código lo prefiere solo
// y no hay que tocar nada aquí.
export function registeredAt(file) {
  return okDate(file?.registeredAt) || okDate(stageLogOf(file)["Full Application"]);
}

// Sale en su hoja solo si ya está registrado. Un archivo sin registrar
// Martha todavía no lo tiene, y ponerlo la haría buscar algo que no
// existe.
export const inMarthaSheet = file =>
  !!registeredAt(file) && !file?.archived && !okDate(file?.closedAt);

// Su formato de texto para pedidos: "REQ 07/17". No es fecha de Excel,
// es texto, y hay que respetarlo o la columna se le desalinea.
function reqText(iso) {
  const d = okDate(iso);
  if (!d) return null;
  const [, m, day] = d.split("-");
  return `REQ ${m}/${day}`;
}

const asDate = iso => (okDate(iso) ? new Date(iso + "T12:00:00") : null);

// ─── 4. UNA FILA ───────────────────────────────────────────────────
// Devuelve un mapa columna(1-29) → valor. Las columnas que solo ella
// conoce se quedan fuera del mapa y salen vacías: HOI Binder recibido,
// Investor Disc firmado, Condo Docs, y el texto de Status, que es su
// juicio y no nuestro.
export function marthaRow(file) {
  const c = file?.contingencies || {};
  const log = stageLogOf(file);
  const coe = okDate(c.coe) || okDate(file?.closing);
  const lock = lockStatus(file);
  const note = latestNote(file);
  const reg = registeredAt(file);

  const row = {
    1:  file?.borrower || "",
    2:  PROGRAMA[baseProductOf(file?.type)] ?? "",
    3:  loanType(file),
    4:  String(file?.lo || "").split(" ")[0].toUpperCase(),
    5:  "Martha",
    6:  lenderNameOf(file) || "",
    8:  asDate(c.contractAccepted),
    9:  asDate(coe),
    10: asDate(criticalDocOut(coe)),
    11: asDate(c.loanContingency),
    12: asDate(c.appraisalContingency),
    13: asDate(reg),
    14: reqText(log["Title Ordered"]),
    15: reqText(log["Insurance Ordered"]),
    17: asDate(reg),
    18: asDate(log["Initial Disclosures Sent"]),
    20: reqText(log["Appraisal Ordered"]),
    22: asDate(log["Submitted to UW"]),
    23: asDate(log["Conditional Approval"]),
    26: asDate(log["CD Issued"]),
    27: asDate(log["Clear to Close"]),
    28: asDate(log["Closing Docs Drawn"]),
    29: note?.text || "",
  };

  // El lock solo se escribe si de verdad está bloqueado. Un archivo en
  // float con fecha inventada le haría creer que hay lock donde no hay.
  if (lock.state === "locked") {
    row[24] = asDate(lock.lockedAt);
    row[25] = asDate(lock.expires);
  }

  // Sin nada en el mapa que sea null: Excel escribe la celda vacía y no
  // un cero ni un "null" de texto.
  for (const k of Object.keys(row)) if (row[k] === null) delete row[k];
  return row;
}

// ─── 5. CARGA DE EXCELJS ───────────────────────────────────────────
// El bundle UMD se inyecta como <script> y deja window.ExcelJS. Se
// guarda la promesa para que dos clics seguidos no bajen el archivo dos
// veces.
let excelPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (excelPromise) return excelPromise;
  excelPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = EXCELJS_CDN;
    s.async = true;
    s.onload = () => window.ExcelJS
      ? resolve(window.ExcelJS)
      : reject(new Error("ExcelJS cargó pero no se registró"));
    s.onerror = () => { excelPromise = null; reject(new Error("No se pudo bajar ExcelJS")); };
    document.head.appendChild(s);
  });
  return excelPromise;
}

// ─── 6. EL LIBRO ───────────────────────────────────────────────────
const MESES = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY",
  "AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

export function sheetTitle(iso = today()) {
  const [y, m, d] = String(iso).split("-");
  return `BARRETT FINANCIAL ${MESES[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export function fileName(iso = today()) {
  const [y, m, d] = String(iso).split("-");
  return `Barrett Financial ${m}-${d}-${y.slice(2)}.xlsx`;
}

const solid = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

export async function buildMarthaWorkbook(files) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Barrett Financial", {
    // Congela la columna A igual que ella, para que el nombre del
    // prestatario no se pierda al correrse a la derecha.
    views: [{ state: "frozen", xSplit: 1 }],
  });

  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const t = ws.getCell(1, 1);
  t.value = sheetTitle();
  t.font = { name: "Arial", size: 16, bold: true };
  t.fill = solid("FF9DC3E6");

  MARTHA_HEADERS.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 12, bold: true };
  });

  // Los archivos empiezan en la fila 4. La 3 va vacía, como en su hoja.
  const rows = files.filter(inMarthaSheet).sort((a, b) => {
    const ca = okDate(a?.contingencies?.coe) || "9999";
    const cb = okDate(b?.contingencies?.coe) || "9999";
    return ca.localeCompare(cb);            // el que cierra primero, arriba
  });

  rows.forEach((file, i) => {
    const r = 4 + i;
    const data = marthaRow(file);
    const canal = CANAL_FILL[file?.channel === "correspondent" ? "correspondent" : "broker"];
    const estado = ESTADO_FILL[file?.stage] || CREMA;

    for (let col = 1; col <= 29; col++) {
      const cell = ws.getCell(r, col);
      cell.font = { name: "Calibri", size: 12 };
      cell.fill = solid(col === 1 ? canal : col === 7 ? estado : CREMA);
      const v = data[col];
      if (v === undefined) continue;
      cell.value = v;
      if (v instanceof Date) cell.numFmt = "mm/dd/yy;@";
    }
  });

  // Su leyenda, siempre debajo de los datos con una fila de aire.
  const base = Math.max(15, 4 + rows.length + 3);
  const head = ws.getCell(base, 1);
  head.value = "PIPELINE STATUS";
  head.font = { name: "Calibri", size: 12, bold: true };

  LEYENDA.forEach(([txt, color], i) => {
    const cell = ws.getCell(base + 1 + i, 1);
    cell.value = txt;
    cell.font = { name: "Calibri", size: 12 };
    cell.fill = solid(color);
  });
  LEYENDA_CANAL.forEach(([txt, color], i) => {
    const cell = ws.getCell(base + 8 + i, 1);
    cell.value = txt;
    cell.font = { name: "Calibri", size: 12 };
    cell.fill = solid(color);
  });

  return { wb, count: rows.length };
}

// ─── 7. DESCARGA ───────────────────────────────────────────────────
export async function downloadMarthaSheet(files) {
  const { wb, count } = await buildMarthaWorkbook(files);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  a.click();
  // Sin esto el blob se queda en memoria hasta que se recargue la página.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return count;
}
