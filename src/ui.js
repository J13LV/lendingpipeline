// ═══════════════════════════════════════════════════════════════════
//  DICCIONARIO DE LA INTERFAZ · UI DICTIONARY
//
//  Se traduce lo que EXPLICA, no lo que NOMBRA.
//
//  Fuera de este diccionario, a propósito:
//    · Nombres de etapa — Full Application, Clear to Close, CD Issued.
//      El equipo los dice en inglés porque así los dice Arive y así los
//      dicen los lenders. Traducirlos rompería la correspondencia con el
//      resto de su día de trabajo.
//    · Productos — FHA, Conventional, DSCR, Jumbo.
//    · Términos de industria — CTC, COE, CD, TRID, DPA, lock, float, bps.
//    · Nombres propios — lenders, personas, Smart Bee, APG Realty.
// ═══════════════════════════════════════════════════════════════════

export const UI = {

  // ─── acciones ───
  save:        { es:"GUARDAR",        en:"SAVE" },
  cancel:      { es:"CANCELAR",       en:"CANCEL" },
  close:       { es:"CERRAR",         en:"CLOSE" },
  advance:     { es:"AVANZAR",        en:"ADVANCE" },
  closeFile:   { es:"CERRAR ARCHIVO", en:"CLOSE FILE" },
  reopen:      { es:"REABRIR",        en:"REOPEN" },
  refer:       { es:"REFERIR",        en:"REFER" },
  prep:        { es:"PREPARACIÓN",    en:"PREP" },
  archive:     { es:"ARCHIVAR",       en:"ARCHIVE" },
  restore:     { es:"RESTAURAR",      en:"RESTORE" },
  del:         { es:"BORRAR",         en:"DELETE" },
  add:         { es:"AGREGAR",        en:"ADD" },
  search:      { es:"Buscar cliente…", en:"Search borrower…" },
  newFile:     { es:"+ ARCHIVO NUEVO", en:"+ NEW FILE" },
  help:        { es:"AYUDA",          en:"HELP" },
  signOut:     { es:"SALIR",          en:"SIGN OUT" },
  backup:      { es:"RESPALDO",       en:"BACKUP" },

  // ─── campos del archivo ───
  borrower:    { es:"CLIENTE",             en:"BORROWER" },
  loanType:    { es:"TIPO DE PRÉSTAMO",    en:"LOAN TYPE" },
  loanAmount:  { es:"MONTO DEL PRÉSTAMO",  en:"LOAN AMOUNT" },
  loanOfficer: { es:"ORIGINADOR",          en:"LOAN OFFICER" },
  referralPartner:{ es:"SOCIO REFERIDOR",  en:"REFERRAL PARTNER" },
  phone:       { es:"TELÉFONO",            en:"PHONE" },
  email:       { es:"CORREO",              en:"EMAIL" },
  stage:       { es:"ETAPA",               en:"STAGE" },
  closingDate: { es:"FECHA DE CIERRE",     en:"CLOSING DATE" },
  actualClose: { es:"FECHA REAL DE CIERRE",en:"ACTUAL CLOSE DATE" },
  daysInStage: { es:"DÍAS EN LA ETAPA",    en:"DAYS IN STAGE" },
  notes:       { es:"NOTAS",               en:"NOTES" },
  activity:    { es:"ACTIVIDAD",           en:"ACTIVITY" },
  showAll:     { es:"VER TODO",            en:"SHOW ALL" },
  state:       { es:"ESTADO",              en:"STATE" },

  // ─── notas ───
  addUpdate:   { es:"+ AGREGAR ACTUALIZACIÓN", en:"+ ADD UPDATE" },
  notePlaceholder: { es:"Qué pasó hoy · quién lo dijo · qué sigue",
                     en:"What happened today · who said it · what's next" },
  noteFromBanker:  { es:"Actualización del banquero receptor…",
                     en:"Update from the receiving banker…" },
  noteHint:    { es:"Cada actualización queda con su fecha y su autor. La tarjeta siempre muestra la última.",
                 en:"Every update is stamped with its date and author. The card always shows the latest." },
  noteLegacy:  { es:"anterior al historial · sin fecha ni autor confiables",
                 en:"predates the log · no reliable date or author" },
  seeLast2:    { es:"▾ ver solo las 2 últimas", en:"▾ show only the last 2" },
  seeAll:      { es:"▸ ver las {n} entradas",   en:"▸ show all {n} entries" },
  tooLong:     { es:"muy larga",  en:"too long" },
  keepShort:   { es:"sé breve",   en:"keep it short" },

  // ─── vistas ───
  activePipeline:{ es:"PIPELINE ACTIVO",   en:"ACTIVE PIPELINE" },
  closedFiles: { es:"ARCHIVOS CERRADOS",   en:"CLOSED FILES" },
  referredOut: { es:"REFERIDOS AFUERA",    en:"REFERRED OUT" },
  inbound:     { es:"REFERIDOS RECIBIDOS", en:"INBOUND" },
  preparation: { es:"PREPARACIÓN",         en:"PREPARATION" },
  dueReview:   { es:"REVISIÓN PENDIENTE",  en:"DUE REVIEW" },
  archived:    { es:"ARCHIVADOS",          en:"ARCHIVED" },
  production:  { es:"PRODUCCIÓN",          en:"PRODUCTION" },

  // ─── estado y avisos ───
  saving:      { es:"guardando…",  en:"saving…" },
  saved:       { es:"guardado",    en:"saved" },
  saveError:   { es:"no se guardó",en:"not saved" },
  critical:    { es:"CRÍTICO",     en:"CRITICAL" },
  warning:     { es:"AVISO",       en:"WARNING" },
  savesWith:   { es:"se guarda con GUARDAR ↓", en:"saves with SAVE ↓" },
  noFiles:     { es:"No hay archivos aquí todavía.", en:"No files here yet." },
  confirmDelete:{ es:"¿Borrar este archivo? No se puede deshacer.",
                  en:"Delete this file? This cannot be undone." },


  // ─── bloques del archivo ───
  contingencies:{ es:"⏱ CONTINGENCIAS", en:"⏱ CONTINGENCIES" },
  contClock:   { es:"el reloj corre desde la aceptación del contrato, no desde hoy",
                 en:"the clock runs from contract acceptance, not from today" },
  fromContract:{ es:"DEL CONTRATO · el depósito está en riesgo",
                 en:"FROM THE CONTRACT · the deposit is at risk" },
  deliveryChain:{ es:"CADENA DE ENTREGA · credibilidad y per diem",
                  en:"DELIVERY CHAIN · credibility and per diem" },
  contractAccepted:{ es:"FECHA DE ACEPTACIÓN DEL CONTRATO", en:"CONTRACT ACCEPTANCE DATE" },
  appraisal:   { es:"TASACIÓN",  en:"APPRAISAL" },
  loanCont:    { es:"PRÉSTAMO",  en:"LOAN" },
  funding:     { es:"FONDEO",    en:"FUNDING" },
  resultPerCont:{ es:"RESULTADO POR CONTINGENCIA", en:"OUTCOME PER CONTINGENCY" },
  conflicts:   { es:"CONFLICTO", en:"CONFLICT" },
  conflictsPl: { es:"CONFLICTOS",en:"CONFLICTS" },
  record:      { es:"REGISTRAR", en:"RECORD" },
  derivedDates:{ es:"FECHAS TOPE DERIVADAS", en:"DERIVED DEADLINES" },
  history:     { es:"HISTORIAL", en:"HISTORY" },

  lenderLock:  { es:"◆ LENDER Y LOCK", en:"◆ LENDER & LOCK" },
  channelDecides:{ es:"el canal decide qué lenders existen",
                   en:"the channel decides which lenders exist" },
  channel:     { es:"CANAL",   en:"CHANNEL" },
  lender:      { es:"LENDER",  en:"LENDER" },
  rate:        { es:"TASA %",  en:"RATE %" },
  lockState:   { es:"ESTADO",  en:"STATUS" },
  floating:    { es:"Flotando",en:"Floating" },
  locked:      { es:"Lockeado",en:"Locked" },
  lockDate:    { es:"FECHA DEL LOCK", en:"LOCK DATE" },
  lockTerm:    { es:"TÉRMINO",       en:"TERM" },
  backupLender:{ es:"LENDER DE RESPALDO", en:"BACKUP LENDER" },
  changeLender:{ es:"⇄ CAMBIAR DE LENDER", en:"⇄ CHANGE LENDER" },
  compensation:{ es:"COMPENSACIÓN", en:"COMPENSATION" },

  fileComp:    { es:"$ COMPENSACIÓN DEL ARCHIVO", en:"$ FILE COMPENSATION" },
  yourComp:    { es:"$ TU COMPENSACIÓN EN ESTE ARCHIVO", en:"$ YOUR COMPENSATION ON THIS FILE" },
  clientOrigin:{ es:"ORIGEN DEL CLIENTE", en:"CLIENT ATTRIBUTION" },
  grossComm:   { es:"Comisión bruta",     en:"Gross commission" },
  adjustments: { es:"AJUSTES",            en:"ADJUSTMENTS" },
  otherAdj:    { es:"+ otro ajuste",      en:"+ another adjustment" },
  distribution:{ es:"DISTRIBUCIÓN",       en:"DISTRIBUTION" },
  yourCompShort:{ es:"TU COMPENSACIÓN",   en:"YOUR COMPENSATION" },
  notYourFile: { es:"Este archivo está asignado a otro originador.",
                 en:"This file is assigned to another originator." },
  loggedWithFile:{ es:"Registrados con el archivo.", en:"Logged with the file." },


  // ─── textos explicativos · los que más importan traducir ───
  savesWithSave:{ es:"se guarda con SAVE ↓", en:"saves with SAVE ↓" },
  unsaved:     { es:" · sin guardar", en:" · unsaved" },
  unassigned:  { es:"— sin asignar —", en:"— unassigned —" },
  typingYear:  { es:"escribiendo el año…", en:"typing the year…" },
  branchLending:{ es:"Del Valle Lending", en:"Del Valle Lending" },

  // contingencias
  anchorHint:  { es:"Todo se cuenta desde aquí. Si el archivo pasó días en Under Contract, ya se gastaron.",
                 en:"Everything counts from here. Days the file spent in Under Contract are already spent." },
  calendarDays:{ es:"{s} cuenta días de calendario en el contrato",
                 en:"{s} counts calendar days in the contract" },
  businessDays:{ es:"FL cuenta DÍAS HÁBILES en el contrato — la misma contingencia da otra fecha",
                 en:"FL counts BUSINESS DAYS in the contract — the same contingency lands on a different date" },
  cdReceivedBy:{ es:"CD debe estar RECIBIDO el {d} — 3 días hábiles antes del cierre, por ley.",
                 en:"The CD must be RECEIVED by {d} — 3 business days before closing, by law." },
  cdCounts:    { es:"Cuenta sábados y salta domingos y feriados federales. Si se manda por correo, sale el {d}.",
                 en:"Saturdays count; Sundays and federal holidays do not. If mailed, it goes out {d}." },
  contractDaysOf:{ es:"días {b} del contrato", en:"{b} days from contract" },
  calShort:    { es:"cal.",     en:"cal." },
  bizShort:    { es:"hábiles",  en:"business" },
  depositExposed:{ es:"Venció sin registrar resultado. El depósito está expuesto.",
                   en:"It passed with no outcome recorded. The deposit is exposed." },
  newDateAddendum:{ es:"Fecha nueva — requiere addendum firmado",
                    en:"New date — requires a signed addendum" },
  outcomeNote: { es:"Nota — qué pasó, quién lo confirmó",
                 en:"Note — what happened, who confirmed it" },
  derivedHint: { es:"Calculadas hacia atrás desde cada contingencia, con el techo de cada etapa — el peor caso, no el promedio.",
                 en:"Derived backward from each contingency using each stage's ceiling — worst case, not average." },

  // lender y lock
  lastDayToLock:{ es:"Último día para lockear: {d}", en:"Last day to lock: {d}" },
  daysLeftN:   { es:"faltan {n}d",  en:"{n}d left" },
  daysLateN:   { es:"{n}d tarde",   en:"{n}d late" },
  cdCarriesRate:{ es:"El CD lleva la tasa final, así que no se puede flotar más allá de su fecha legal.",
                  en:"The CD carries the final rate, so you cannot float past its legal date." },
  noCloseNoCap:{ es:"Sin fecha de cierre no hay tope calculable. Captura el COE primero.",
                 en:"Without a closing date there is no deadline to derive. Capture the COE first." },
  whichTermQ:  { es:"SI LOCKEAS HOY, ¿QUÉ TÉRMINO LLEGA AL CIERRE?",
                 en:"IF YOU LOCK TODAY, WHICH TERM REACHES CLOSING?" },
  coversBy:    { es:"cubre · +{n}d",   en:"covers · +{n}d" },
  shortByN:    { es:"corto por {n}d",  en:"short by {n}d" },
  priceDecides:{ es:"El precio decide el término, pero un lock que vence antes del cierre devuelve lo ganado en la extensión.",
                 en:"Price decides the term, but a lock that expires before closing gives the savings back in the extension." },
  expiresOn:   { es:"Vence {d}",  en:"Expires {d}" },
  coversClose: { es:" · cubre el cierre con {n}d de sobra", en:" · covers closing with {n}d to spare" },
  shortOfClose:{ es:" · {n}d antes del cierre, habrá extensión", en:" · {n}d before closing, an extension is coming" },
  lenderName:  { es:"nombre del lender", en:"lender name" },
  otherLenderHint:{ es:"Sin datos de plan ni de guías. Escribe la comp a mano y avísame para agregarlo al catálogo.",
                    en:"No plan or guideline data. Enter the comp by hand and let me know to add it to the catalog." },
  hiddenByChannel:{ es:"{n} lender(es) hace(n) este producto pero no opera(n) en correspondent, así que no aparece(n): {list}",
                    en:"{n} lender(s) do this product but do not operate in correspondent, so they are hidden: {list}" },
  andNMore:    { es:" y {n} más", en:" and {n} more" },
  makesProduct:{ es:"hacen {p}",  en:"do {p}" },

  // respaldo y cambio de lender
  safeUntil:   { es:"Seguro hasta el {d} · faltan {n}d", en:"Safe until {d} · {n}d left" },
  onlyIfNothingFails:{ es:"solo llega si todo sale bien · imposible después del {d}",
                       en:"only makes it if all goes well · impossible after {d}" },
  noLongerMakesIt:{ es:"Ya no llega · la fecha tope era el {d}", en:"No longer makes it · the deadline was {d}" },
  untilArrivesAnyway:{ es:"hasta {d} · llega aunque todo se atrase ({n}d)",
                       en:"until {d} · makes it even if everything drags ({n}d)" },
  betweenOnlyIfClean:{ es:"{a} a {b} · solo si nada falla ({n}d)",
                       en:"{a} to {b} · only if nothing fails ({n}d)" },
  afterNoMakes:{ es:"después del {d} · no llega", en:"after {d} · does not make it" },
  countedBackFromCd:{ es:"Contado hacia atrás desde el CD del {d}.", en:"Counted backward from the CD on {d}." },
  cushionBefore:{ es:"El colchón vence {n} días ANTES que la contingencia de préstamo ({d}). Dentro de la contingencia parecerá que hay tiempo y no lo habrá.",
                  en:"The cushion expires {n} days BEFORE the loan contingency ({d}). Inside the contingency it will look like there is time, and there will not be." },
  movingCosts: { es:"moverlo cuesta {b} bps · −${d}", en:"moving costs {b} bps · −${d}" },
  movingFree:  { es:"moverlo no cuesta comp · {name} llega a {n} bps",
                 en:"moving costs no comp · {name} reaches {n} bps" },
  youChargeCap:{ es:"cobras {a} · techo allá {b}", en:"you charge {a} · ceiling there {b}" },
  changeLenderTitle:{ es:"Cambiar de lender", en:"Change lender" },
  whatItCosts: { es:"LO QUE CUESTA", en:"WHAT IT COSTS" },
  newLender:   { es:"NUEVO LENDER", en:"NEW LENDER" },
  reason:      { es:"MOTIVO", en:"REASON" },
  note:        { es:"NOTA", en:"NOTE" },
  reasonNote:  { es:"qué dijo el lender, quién lo confirmó", en:"what the lender said, who confirmed it" },
  landsAt:     { es:"Aterriza en", en:"Lands at" },
  reunderwrite:{ es:"Re-suscripción", en:"Re-underwriting" },
  daysN:       { es:"{n} días", en:"{n} days" },
  travelsHint: { es:"Tasación, título, HOI y documentos viajan. Las divulgaciones son nuevas y el lender nuevo suscribe desde cero.",
                 en:"Appraisal, title, HOI and documents travel. Disclosures are new and the new lender underwrites from scratch." },
  lockNotTransfer:{ es:"El lock no se transfiere. Sueltas {r}% y vuelves a lockear al mercado del día. Si la tasa subió, la paga el cliente.",
                    en:"The lock does not transfer. You release {r}% and re-lock at that day's market. If rates rose, the borrower pays." },
  tooLateToMove:{ es:"En el peor caso este cambio ya no llega al cierre del {coe}. La fecha tope para decidir era el {d}.",
                  en:"At worst case this change no longer reaches the {coe} closing. The deadline to decide was {d}." },
  countsAgainstLender:{ es:" · cuenta contra este lender en el scorecard",
                        en:" · counts against this lender on the scorecard" },
  daysWithPrev:{ es:" · {n}d con el anterior", en:" · {n}d with the previous one" },
  moveTo:      { es:"MOVER A", en:"MOVE TO" },

  // compensación
  reportedByDash:{ es:"· lo que reportan los dashboards", en:"· what the dashboards report" },
  bpsFieldHint:{ es:"Este es el número que usan todos los reportes. El bloque de COMPENSACIÓN de abajo lo llena solo al guardar; aquí lo puedes ajustar a mano. En blanco = {n} bps.",
                 en:"This is the number every report uses. The COMPENSATION block below fills it on save; here you can adjust it by hand. Blank = {n} bps." },
  willWriteBps:{ es:"Al guardar, {n} bps pasan a BPS COMP arriba y eso es lo que reportan los dashboards.",
                 en:"On save, {n} bps go to BPS COMP above and that is what the dashboards report." },
  noCompData:  { es:"Sin dato — los reportes usan el default de la sucursal.",
                 en:"No figure — reports use the branch default." },
  combinedCap: { es:"Los 400 son combinados. Si subes uno, el otro se ajusta a lo que quede.",
                 en:"The 400 is combined. If you raise one, the other adjusts to what is left." },
  unnamedAdj:  { es:"Hay un ajuste sin nombre — no se va a guardar hasta que lo escribas.",
                 en:"There is an unnamed adjustment — it will not save until you name it." },
  adjName:     { es:"nombre del descuento", en:"deduction name" },
  creditName:  { es:"nombre del crédito",   en:"credit name" },
  toCredit:    { es:"descuento — clic para crédito", en:"deduction — click for credit" },
  toFee:       { es:"crédito — clic para descuento", en:"credit — click for deduction" },
  adjTotals:   { es:"Ajustes −${d}", en:"Adjustments −${d}" },
  credTotals:  { es:"Créditos +${d}", en:"Credits +${d}" },
  pctOfNet:    { es:"{p}% del NET de ${d}", en:"{p}% of the ${d} NET" },
  leadPending: { es:"Clasificación pendiente. Se calcula como producción propia hasta que se defina.",
                 en:"Classification pending. Counted as own production until it is defined." },
  inHouseLess: { es:"Lead de la sucursal · {n} puntos menos que producción propia",
                 en:"Branch lead · {n} points less than own production" },
  planCeiling: { es:"Pagado por el lender · tope del plan {n} bps",
                 en:"Lender-paid · plan caps at {n} bps" },
  ceilingLeft: { es:"techo {n} bps · quedan {r}", en:"ceiling {n} bps · {r} left" },

  cap:{ es:"tope", en:"cap" },
  guidelines:{ es:"guías ↗", en:"guidelines ↗" },

  // ─── tiempo ───
  inStage:     { es:"d en la etapa", en:"d in stage" },
  total:       { es:"d total",       en:"d total" },
  closeIn:     { es:"Cierra en",     en:"Close in" },
  ago:         { es:"hace",          en:"ago" },
  justNow:     { es:"ahora mismo",   en:"just now" },
};

// Traduce una clave. Si falta la traducción, devuelve el español antes que
// una clave cruda: un texto en el idioma equivocado se entiende; "loanType"
// no se entiende en ninguno.
export function tr(key, lang = "es", vars) {
  const e = UI[key];
  let out = e ? (e[lang] ?? e.es ?? e.en ?? key) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split("{" + k + "}").join(v);
  return out;
}

// Idioma por defecto según el rol. El equipo trabaja en español; quien
// administra puede cambiarlo y queda guardado en su perfil.
export const defaultLang = profile => profile?.lang || "es";
