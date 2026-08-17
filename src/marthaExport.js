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
  productKeyForLoanType, stageLogOf, latestNote, lockStatus, STAGE_DAYS,
  processorId, processorOf, DEFAULT_PROCESSOR, orderState, isCondo,
  registeredAt, discSentAt,
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
  12.9, 17.9, 15.4, 17.0, 14.4, 11.9, 60.0];   // NOTES bajo de 111.4 a 60: a 111 hay que
// scrollear medio metro para leer la nota y en impresion se sale de la pagina.

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

// Etapa del pipeline → color de su columna Status.
//
// TODA etapa que puede salir en la hoja tiene color. La primera version
// dejo fuera seis y esos archivos salieron en crema, que en su sistema
// no significa nada — parece un archivo que nadie ha tocado.
//
// Dos colores de su leyenda quedan sin usar a proposito:
//
//   NARANJA "re-sometido a U/W"  — es un EVENTO, no una etapa. El
//     archivo vuelve a underwriting y sigue en Condition Clearing. El
//     pipeline no observa ese momento, y pintarlo naranja seria afirmar
//     algo que no sabemos. Se queda amarillo y ella lo cambia cuando
//     resomete, que es cuando de verdad ocurre.
//
//   ROJO "hold / suspendido"     — no existe como etapa. Un archivo
//     detenido aqui sigue marcado donde estaba.
//
// Los dos son suyos para marcar. Nosotros no se los quitamos.
const ESTADO_FILL = {
  // Antes de someter: para ella todo esto es "archivo nuevo".
  "Full Application":         "FFCCECFF",
  "Initial Disclosures Sent": "FFCCECFF",
  "Doc Collection":           "FFCCECFF",
  "Title Ordered":            "FFCCECFF",
  "Appraisal Ordered":        "FFCCECFF",
  "Insurance Ordered":        "FFCCECFF",
  // En manos del underwriter.
  "Submitted to UW":          "FF9999FF",
  "UW Review":                "FF9999FF",
  // Aprobado, esperando al prestatario.
  "Conditional Approval":     "FFFFFF00",
  "Condition Clearing":       "FFFFFF00",
  // Limpio, camino al cierre.
  "Clear to Close":           "FF92F694",
  "CD Issued":                "FF92F694",
  "Closing Scheduled":        "FF92F694",
  "Final Verifications":      "FF92F694",
  "Closing Docs Drawn":       "FF92F694",
  "Signing":                  "FF92F694",
  "Funded":                   "FF92F694",
};

// ─── PALETA DE LA TABLA ────────────────────────────────────────────
// Estos no son colores de ella: son el marco. Salen de su propio tema de
// Excel (dk2 = 44546A) para que no se sienta un color prestado de fuera.
const NAVY   = "FF44546A";   // banda de titulo y de seccion
const BAND   = "FF8497B0";   // fila de encabezados
const HAIRLINE = "FFBFBFBF"; // borde fino
const WHITE  = "FFFFFFFF";
const BLACK  = "FF000000";

// Columnas que van centradas: todas las de fecha y las de pedido. El
// texto va a la izquierda con sangria. Alinear por tipo de dato es la
// mitad de lo que hace que una tabla se lea como tabla.
const CENTRADAS = new Set([8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28]);

const hair = { style: "thin", color: { argb: HAIRLINE } };
const BOX  = { top: hair, left: hair, bottom: hair, right: hair };

// ─── LEYENDA ───────────────────────────────────────────────────────
// Su leyenda original mezclaba MAYUSCULAS con Capitalizacion Normal y el
// texto se derramaba sobre las columnas B, C y D porque no cabia en la A.
//
// Aqui va partida en etiqueta + descripcion. El corte no es invento: son
// SUS propias barras. "CLEAR TO CLOSE // TASK FOR DOCS" ya venia con la
// division marcada. No se cambio una sola palabra, solo la caja.
//
// El canal se separo del estado. Son dos ejes distintos y estaban
// revueltos en la misma lista como si fueran la misma pregunta.
const LEYENDA = [
  { fill: "FFCCECFF", label: "New file",          desc: "Initial disclosures emailed out to borrower" },
  { fill: "FF9999FF", label: "Submitted to U/W",  desc: "Initial approval pending" },
  { fill: "FFFFFF00", label: "Approved",          desc: "Borrower conditions pending" },
  { fill: "FFFF9900", label: "Re-submitted",      desc: "All conditions received, back to U/W to clear" },
  { fill: "FF92F694", label: "Clear to close",    desc: "Task for docs" },
  { fill: "FFFF0000", label: "Hold / suspended",  desc: "Issues, or waiting on borrower to sign investor disclosures", fg: WHITE },
];
const LEYENDA_CANAL = [
  { fill: CANAL_FILL.correspondent, label: "Mini correspondent", desc: "Registered and funded through Barrett", fg: WHITE, key: "correspondent" },
  { fill: CANAL_FILL.broker,        label: "Broker",             desc: "Brokered out to the wholesale lender",  key: "broker" },
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
// Ahora sale del CICLO VIGENTE, no de un campo plano. Un archivo que
// cambió de lender se registra de nuevo, y la hoja tiene que describir
// ese registro — no el primero. `registeredAt` del motor ya cae de vuelta
// a Full Application para los archivos que nunca se sellaron.

// ─── QUE ARCHIVOS SALEN EN SU HOJA ─────────────────────────────────
// La primera version filtraba por fecha de registro y la hoja salio
// VACIA: esa fecha se deriva de stageLog, que empezo a sellar hoy, asi
// que ningun archivo existente la tiene. El filtro no puede depender de
// un dato que apenas nace — tiene que leer algo que ya esta ahi.
//
// Lo que si esta desde siempre es la ETAPA. Un archivo que ya llego a
// Full Application o mas alla es un archivo registrado, o en camino de
// serlo, y es exactamente lo que Martha tiene en su escritorio. La fecha
// se queda como dato de la columna, no como condicion de entrada: una
// celda en blanco es honesta, una fila ausente es un archivo perdido.
const PROCESSING_STAGES = Object.keys(STAGE_DAYS);
const FIRST_STAGE = "Full Application";

export function stageRank(stage) {
  return PROCESSING_STAGES.indexOf(stage);
}

// Toda etapa que entra en la hoja tiene que tener color. Se exporta para
// que la prueba lo verifique y no vuelva a salir un archivo en crema.
export const stagesWithoutColor = () =>
  PROCESSING_STAGES.filter(s => stageRank(s) >= stageRank(FIRST_STAGE) && !ESTADO_FILL[s]);

// `quien` filtra por procesadora asignada. Sin dos colas, la hoja de
// Martha saldria con los archivos de Laura adentro — y ella preguntaria
// por prestatarios que nunca ha visto.
export function inMarthaSheet(file, quien = DEFAULT_PROCESSOR) {
  if (file?.archived || okDate(file?.closedAt) || file?.prep) return false;
  if (quien && processorId(file) !== quien) return false;
  const rank = stageRank(file?.stage);
  // -1 son las etapas de antes del contrato y las de despues del cierre.
  // Ni unas ni otras estan en su hoja.
  return rank >= stageRank(FIRST_STAGE);
}

// Su formato de texto para pedidos: "REQ 07/17", y cuando llega lo
// cambia a "RECEIVED 07/28". No son fechas de Excel, es texto, y hay que
// respetarlo o la columna se le desalinea.
const mmdd = iso => { const [, m, d] = String(iso).split("-"); return `${m}/${d}`; };

function reqText(iso) {
  const d = okDate(iso);
  return d ? `REQ ${mmdd(d)}` : null;
}

// El estado de un pedido en SU vocabulario. Los sellos que pone la
// procesadora en la pantalla de procesamiento salen aqui — estas son
// las columnas que stageLog nunca iba a poder llenar.
function orderText(file, id) {
  const o = orderState(file, id);
  if (o.rec) return `RECEIVED ${mmdd(o.rec)}`;
  if (o.req) return `REQ ${mmdd(o.req)}`;
  return null;
}

const asDate = iso => (okDate(iso) ? new Date(iso + "T12:00:00") : null);

// ─── 4. UNA FILA ───────────────────────────────────────────────────
// Devuelve un mapa columna(1-29) → valor. Con los pedidos sellados en la
// pantalla de procesamiento, HOI Binder y Condo Docs ya se llenan solos.
// Lo que sigue siendo suyo: Investor Disc firmado, y el TEXTO de Status,
// que es su juicio y no nuestro.
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
    5:  processorOf(file).name,
    6:  lenderNameOf(file) || "",
    8:  asDate(c.contractAccepted),
    9:  asDate(coe),
    10: asDate(criticalDocOut(coe)),
    11: asDate(c.loanContingency),
    12: asDate(c.appraisalContingency),
    13: asDate(reg),
    // Los sellos de la procesadora mandan; stageLog queda de respaldo
    // para los archivos que se movieron antes de que existieran.
    14: orderText(file, "title")      || reqText(log["Title Ordered"]),
    15: orderText(file, "hoi_quote")  || reqText(log["Insurance Ordered"]),
    16: orderText(file, "hoi_binder"),
    17: asDate(reg),
    // Las divulgaciones salen el mismo dia del registro y viajan en el
    // ciclo. stageLog queda de respaldo para los archivos anteriores.
    18: asDate(discSentAt(file) || log["Initial Disclosures Sent"]),
    20: orderText(file, "appraisal")  || reqText(log["Appraisal Ordered"]),
    // Ella escribe N/A cuando no es condominio — en sus ocho archivos
    // esa columna dice N/A en todos. Ahora el sistema lo sabe.
    21: orderText(file, "condo_docs") || (isCondo(file) ? null : "N/A"),
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
  return `BARRETT FINANCIAL — ${MESES[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export function fileName(iso = today()) {
  const [y, m, d] = String(iso).split("-");
  return `Barrett Financial ${m}-${d}-${y.slice(2)}.xlsx`;
}

const solid = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

export async function buildMarthaWorkbook(files, quien = DEFAULT_PROCESSOR) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Barrett Financial", {
    // showGridLines false es el cambio visual mas grande de todos y no
    // cuesta nada: con la cuadricula encendida esto parece una hoja de
    // calculo, apagada y con bordes propios parece una tabla.
    // Congela columna A Y las dos filas de arriba, no solo la columna.
    views: [{ state: "frozen", xSplit: 1, ySplit: 2, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.pageSetup.printTitlesRow = "1:2";

  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ─── Banda de titulo, fusionada de A a AC ───
  ws.mergeCells(1, 1, 1, 29);
  ws.getRow(1).height = 34;
  const t = ws.getCell(1, 1);
  t.value = sheetTitle();
  t.font = { name: "Arial", size: 15, bold: true, color: { argb: WHITE } };
  t.fill = solid(NAVY);
  t.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  // ─── Encabezados: mas altos y con texto ajustado, para que
  // "File Assigned to LOA/Processor" quepa en dos renglones en vez de
  // estirar la columna a lo ancho. ───
  ws.getRow(2).height = 42;
  const navyEdge = { style: "thin", color: { argb: NAVY } };
  MARTHA_HEADERS.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = solid(BAND);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: navyEdge, left: navyEdge, bottom: navyEdge, right: navyEdge };
  });

  // El que cierra primero va arriba. Sin COE se va al final, no al
  // principio: un archivo sin fecha de cierre no es urgente, es incompleto.
  const rows = files.filter(f => inMarthaSheet(f, quien)).sort((a, b) => {
    const ca = okDate(a?.contingencies?.coe) || okDate(a?.closing) || "9999-12-31";
    const cb = okDate(b?.contingencies?.coe) || okDate(b?.closing) || "9999-12-31";
    return ca.localeCompare(cb) || String(a?.borrower || "").localeCompare(String(b?.borrower || ""));
  });

  // Conteo por estado y por canal, para la leyenda de abajo.
  const porEstado = {};
  const porCanal = { broker: 0, correspondent: 0 };

  // Los archivos empiezan en la fila 3, pegados al encabezado. La fila
  // en blanco de su hoja original solo existia porque no habia borde
  // que separara; ahora el borde lo hace.
  rows.forEach((file, i) => {
    const r = 3 + i;
    const data = marthaRow(file);
    const canalId = file?.channel === "correspondent" ? "correspondent" : "broker";
    const canal = CANAL_FILL[canalId];
    const estado = ESTADO_FILL[file?.stage] || CREMA;
    porCanal[canalId] += 1;
    porEstado[estado] = (porEstado[estado] || 0) + 1;

    ws.getRow(r).height = 19;
    for (let col = 1; col <= 29; col++) {
      const cell = ws.getCell(r, col);
      const esCanal = col === 1;
      cell.fill = solid(esCanal ? canal : col === 7 ? estado : CREMA);
      cell.font = {
        name: "Calibri", size: 11, bold: esCanal,
        // Texto blanco sobre el azul de mini correspondent, negro sobre
        // el gris de broker. Negro sobre azul fuerte no se lee.
        color: { argb: esCanal && canalId === "correspondent" ? WHITE : BLACK },
      };
      cell.border = BOX;
      const centrada = CENTRADAS.has(col);
      cell.alignment = {
        horizontal: centrada ? "center" : "left", vertical: "middle",
        indent: centrada ? 0 : 1, wrapText: col === 29,
      };
      const v = data[col];
      if (v === undefined) continue;
      cell.value = v;
      if (v instanceof Date) cell.numFmt = "mm/dd/yy";
    }
  });

  // ─── Leyenda ───
  const banda = (r, texto) => {
    ws.mergeCells(r, 1, r, 5);
    const c = ws.getCell(r, 1);
    c.value = texto;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    c.fill = solid(NAVY);
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(r).height = 24;
  };

  const renglon = (r, { fill, label, desc, fg }, conteo) => {
    const a = ws.getCell(r, 1);
    a.value = label;
    a.fill = solid(fill);
    a.font = { name: "Calibri", size: 11, bold: true, color: { argb: fg || BLACK } };
    a.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    a.border = BOX;
    ws.mergeCells(r, 2, r, 4);
    const b = ws.getCell(r, 2);
    b.value = desc;
    b.font = { name: "Calibri", size: 11 };
    b.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    for (let col = 2; col <= 4; col++) ws.getCell(r, col).border = BOX;
    const e = ws.getCell(r, 5);
    e.value = conteo;
    e.font = { name: "Calibri", size: 11, bold: true };
    e.alignment = { horizontal: "center", vertical: "middle" };
    e.border = BOX;
    ws.getRow(r).height = 20;
  };

  const base = 3 + rows.length + 2;
  banda(base, "PIPELINE STATUS");
  LEYENDA.forEach((row, i) => renglon(base + 1 + i, row, porEstado[row.fill] || 0));

  const baseCanal = base + LEYENDA.length + 2;
  banda(baseCanal, "LOAN CHANNEL");
  LEYENDA_CANAL.forEach((row, i) => renglon(baseCanal + 1 + i, row, porCanal[row.key] || 0));

  // Filtro sobre los encabezados: puede ordenar por LO, lender o estado
  // sin aprender nada. Cero costo visual y es lo mas util de todo.
  if (rows.length) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2 + rows.length, column: 29 } };

  return { wb, count: rows.length };
}

// ─── 7. DESCARGA ───────────────────────────────────────────────────
export async function downloadMarthaSheet(files, quien = DEFAULT_PROCESSOR) {
  const { wb, count } = await buildMarthaWorkbook(files, quien);
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
