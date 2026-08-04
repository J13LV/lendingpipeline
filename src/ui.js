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
