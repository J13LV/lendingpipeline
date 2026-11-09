import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, writeBatch, getDocs } from "firebase/firestore";
import { helpSections, searchHelp } from "./helpContent";
import { tr, defaultLang, irAlAncla, PL_ES } from "./ui";
import { downloadMarthaSheet } from "./marthaExport";
// Producción es la pantalla más pesada y la que menos gente abre: se baja
// solo cuando alguien entra a ella, no en cada inicio de sesión.
const ProductionDashboard = lazy(() => import("./production"));
import ProcessingView, { IntakePane, HistoryPane, SubmissionPane, Gate1Grid } from "./processing";
import { downloadChecklist } from "./barrettChecklist";
import { TourPanel, useTour, useTourTab, trainingFileId, trainingSampleName, isTraining,
         excludeTraining, clearProgress } from "./tour";

import { CURRENT_LANG, fijarIdioma, P, TX, PL, PN } from "./idioma";
import {
  TEAM, getProfile, fmtLoan, LANG_KEY, BPS_RATE, OVERRIDE_RATE, JOSE_LO, EXCLUDED_TYPES, REFERRED_OUT_STAGE, REFERRAL_FEE_BPS, REFERRAL_REASONS, REFERRAL_STATUSES, PREP_STAGE, PREP_MAX_DAYS, PREP_REASONS, prepReasonById, ARCHIVE_REASONS, isPrep, isArchived, prepAge, daysUntilISO, prepDaysToReview, prepDue, prepLocked, PHASES, CLOSED_STAGE, ALL_STAGES, LOAN_TYPE_GROUPS, LOAN_TYPES, LO_LIST, LO_ASSIGNABLE, COMP_YEAR, BRANCH_FILES_MO, COMP_ROSTER, TRAINER_NAME, SAMPLE, getPhase, daysTil, urgency, fileSeverity,
} from "./catalogo";
import {
  stageUrgency, stageClock, stageCeilingLabel, daysInStage, fileAge, stampStage, today,
  hasContract, coeOf,
  leadStandard, LEAD_STANDARD_DAYS, leadStandardReport, inPreQual, fileClock,
  CONTRACT_CANCEL_REASONS, canCancelContract, cancelContract, cancelCount,
  overdueReport, overdueByOwner, TASK_SEVERITY,
  cancelReason, lastCancellation,
  daysBetween, addDays as addDaysISO,
  // ─── 2B-1 contingencies ───
  CONTINGENCIES, CONTINGENCY_OUTCOMES, CONTRACT_DAY_BASIS,
  contingencyById, outcomeById, allContingencyStatus, contingencyStatus,
  contingencyConflicts, contingencyHeadline, hasContingencies,
  derivedStageDeadlines, sortedDeadlines, upcomingDeadlines, recordContingencyOutcome,
  contingencyExtensionCount, cdIssueDeadline, cdMailDeadline,
  federalHolidayName, contractDaysBetween, isValidISO, okDate,
  // ─── 2B-2a lender, channel, rate, lock ───
  CHANNELS, CHANNEL_IDS, LOCK_TERMS, LOCK_STATES, lendersFor, lenderById,
  lenderProductKey, compCeiling, compCeilingDollars, compDeltaBetween,
  lockStatus, lockExpiration, lockTermsCovering, lastDayToLock,
  lenderConflicts, hasLenderData,
  COMP_MODELS, compModelFor, compBreakdown, setComp, fileCompBps, fileCompDollars, fileCompSource, resolvedCompBps,
  // ─── 2B-2b change, backup, history ───
  REASON_CATEGORIES, reasonsByCategory, reasonById, isLenderFault,
  backupViability, changeCost, applyLenderChange, reregistrationCost,
  lenderChangeCount, lenderFaultChanges, LENDER_CHANGE_LANDING_STAGE,
  lenderScorecard, lenderVerdict, lenderProductBreakdown, productScorecard, productsWorked,
  partnerLeaderboard, knownPartners, canonicalPartner,
  lenderConcentration, productionByProduct, productionByGroup, productionByLo,
  mixVsPlan, baseProductLabel,
  specialtyCatalog, lendersBySpecialty, specialtyLabel, categoryLabel,
  DPA_STRUCTURES, dpaStructure, specDetail, setSpecDetail, specDetailCoverage,
  specDetailSummary, emptySpecDetail,
  noteEntries, latestNote, noteCount, addNoteEntry,
  duplicateMatches, DUP_REASONS, fileActions,
  SIGNALS, signalColor, deadlineSignal, contingencySignal, SOON_DAYS, filePace,
  PROCESSORS, PROCESSOR_IDS, processorId, processorOf, DEFAULT_PROCESSOR,
  NEW_FILE_PROCESSOR,
  DPA_PCTS, DPA_FORMS, dpaForm, dpaOf, hasDpa, miLooksWrong,
  setDpa, dpaLabel, dpaComplete, productionByDpa, productionByState,
  GATE1_ITEMS, gate1Item, FINDING_WAITING, WAITING_IDS, waitingMeta,
  backfillByOwner, BF_ERA_PENDING,
  backfillGaps, filesNeedingBackfill, backfillCount, applyBackfill, wasBackfilled,
  submissionCoverage, submissionReady, stampSubmissionComplete,
  gate1Coverage, visibleMilestones, milestoneAt, uwOutcome, uwOutcomeAt,
  uwOutcomeMeta, discEsignedAt,
  stageGate, gateFix,
  openFindings, resolvedFindings, hasOpenFindings, addFinding, resolveFinding,
  LOE_KINDS, LETTER_FROM, lettersOf, openLetters, receivedLetters, letterKind,
  letterFrom, letterState, letterAge, letterRequestText, addLetter,
  stampLetterRequested, stampLetterReceived,
  cdSentAt, cdDelivery, cdReceivedAt, cdFeesReviewedAt, cdFeesReviewedBy,
  cdEarliestSigning, cdTooEarly, stampCdSent, stampCdFees,
  findingAge, worstFinding, canRegister, isRegistered, stampRegistration,
  registeredAt, registeredBy, registrationCount, needsReRegistration,
  registerReady, registerBlocked, CONTRACT_SIGNAL_FIELD, signalToAcceptDays,
  LO_STAGES, STAGE_THRESHOLDS, teamLeadShare, branchCostPerFile, ladderCeiling,
  loanSplit, lendersHiddenByChannel, OTHER_LENDER_ID, lenderNameOf, payrollPeriodLabel, currentPayrollPeriod, payrollSummary, fundedDate,
  losWithoutCompRule, BARRETT_CUTOVER, referralFunded, referralBranchPct,
  PAYROLL_DOCS, checkReceived, docsDone, payrollBlockers, payrollReady, payrollPayDate,
  buildPayrollRequest, payrollRequestText, STANDARD_FEES, payoutBreakdown, feeWaterfall,
  ADJUSTMENT_KINDS, withLoContext, financedFeePct, financedFeeMeta,
  financedFeeAmount, compBasisAmount, LEAD_ORIGINS, leadOrigin, IN_HOUSE_REDUCTION,
} from "./pipelineCore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAiWBmWJ0eogqBuGiPnBzmv7kE76gc-SGA",
  authDomain: "mortage-pipeline.firebaseapp.com",
  projectId: "mortage-pipeline",
  storageBucket: "mortage-pipeline.firebasestorage.app",
  messagingSenderId: "55441151195",
  appId: "1:55441151195:web:61fabc6bc0b1fafd8ca8fe"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
// ═══════════════════════════════════════════════════════════════════
// UN DOCUMENTO POR PRÉSTAMO
// ═══════════════════════════════════════════════════════════════════
// Hasta aquí el pipeline entero —101 archivos— vivía dentro de UN documento.
// Dos consecuencias, y la segunda es la que de verdad importa:
//
//   1. El techo. Firestore no acepta documentos de más de 1 MB, y ese
//      límite NO se compra: es de diseño, no una cuota. A 5.4 KB por
//      archivo, el documento reventaba a los 182.
//
//   2. El pisón. `setDoc(..., {files}, {merge:true})` fusiona campos de
//      primer nivel, pero `files` es un ARREGLO: se reemplaza entero. Si
//      Tina registra a las 10:02 y Martha guarda a las 10:03 con una copia
//      de las 10:00, Martha BORRA el registro de Tina. Sin error y sin
//      aviso. Con un usuario no se nota; con cinco a la vez, sí.
//
// Ahora cada préstamo es su propio documento en `loans`. Dos personas solo
// chocan si están en el MISMO archivo, que casi nunca pasa.
//
// `pipeline/main` NO se borra: sigue guardando payroll y el detalle de DPA
// —que no son de ningún préstamo— y conserva el arreglo viejo intacto como
// respaldo. Volver atrás es cambiar una línea.
const PIPELINE_DOC = doc(db, "pipeline", "main");
const LOANS = collection(db, "loans");

// Firestore acepta 500 operaciones por lote. Se parte antes por margen.
const LOTE = 400;
async function escribirLote(cambiados, borrados) {
  const ops = [
    ...cambiados.map(f => ({ tipo: "set", f })),
    ...borrados.map(id => ({ tipo: "del", id })),
  ];
  for (let i = 0; i < ops.length; i += LOTE) {
    const lote = writeBatch(db);
    for (const op of ops.slice(i, i + LOTE)) {
      if (op.tipo === "set") lote.set(doc(LOANS, String(op.f.id)), op.f);
      else lote.delete(doc(LOANS, String(op.id)));
    }
    await lote.commit();
  }
}


// ─── AUDIT HELPERS ───
// El historial se come el 38% del peso de un archivo, y la mayor parte es
// relleno: guardaba el UID de Firebase —28 caracteres— VEINTE veces por
// archivo, un dato que ninguna pantalla muestra. Lo que se ve es el nombre,
// que ya está al lado.
//
// Sin UID y con diez entradas, un archivo baja de 7.3 KB a 5.5 KB. Sobre el
// techo de 1 MB de Firestore eso son 134 archivos → 176. No resuelve el
// techo, pero mueve la fecha en que llega.
//
// Y no se pierde nada real: lo que de verdad importa vive en stageLog,
// noteLog, uwLog, findings y el ciclo de registro, cada uno con su fecha y
// su autor. `history` es solo el rastro de ediciones sueltas.
function stampEdit(file, profile, action, extra={}){
  const entry = {
    name: profile.name,
    action: action,
    at: new Date().toISOString(),
    ...extra,
  };
  const newHistory = [...(file.history||[]), entry].slice(-10);
  return {
    ...file,
    lastEditedBy: { uid: profile.uid, name: profile.name },
    lastEditedAt: entry.at,
    history: newHistory,
  };
}

// Un cambio de etapa SIEMPRE tiene que pasar por stampStage. Cuando no pasa,
// stageLog no se sella — y de stageLog salen SEIS columnas de la hoja de
// Martha: divulgaciones enviadas, file to underwriting, approved, CD out,
// CTC y docs out. Se perdian para siempre en ese archivo, sin error y sin
// aviso, cada vez que alguien movia la etapa desde el desplegable en vez de
// usar ADVANCE.
//
// stampStage necesita el archivo entero y onSave solo acepta un parche, asi
// que aqui se sella contra el archivo y se extraen los campos resultantes.
function stagePatch(file, newStage, extra = {}){
  const s = stampStage(file, newStage);
  return {
    stage: s.stage,
    stageEnteredAt: s.stageEnteredAt,
    daysInStage: 0,
    stageLog: s.stageLog,
    fileOpenedAt: s.fileOpenedAt,
    ...extra,
  };
}

// La rueda del raton sobre una fila que se desplaza de lado deberia
// moverla de lado. Por defecto el navegador hace scroll VERTICAL de la
// pagina y la fila no se entera, asi que la unica forma de moverla es
// agarrar la barra — que es justo lo que costaba trabajo.
function ruedaHorizontal(e){
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth) return;   // cabe entera, no hay que mover
  // Un raton normal manda deltaY; un trackpad de lado manda deltaX. Se
  // toma el que traiga movimiento.
  const paso = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (!paso) return;
  el.scrollLeft += paso;
  e.preventDefault();
}

// ═══════════════════════════════════════════════════════════════════
// MENÚ DESPLEGABLE
// ═══════════════════════════════════════════════════════════════════
// La barra de arriba tenía 13 controles y el usuario y SALIR bajaban a una
// segunda línea. Lo que se usa una vez por semana (respaldo, hoja de Martha,
// restaurar, entrenamiento, tamaño de letra) vive aquí; lo de todos los días
// se queda a la vista.
//
// El panel es position:fixed y se calcula al abrir: la fila de pestañas
// tiene overflow-x:auto y recortaría un panel absoluto. Y se queda montado
// (solo se oculta) porque RESTAURAR es un <input type=file>: si el panel se
// desmontara al elegir el archivo, el onChange llegaría a un input que ya
// no existe y el respaldo no se cargaría nunca.
// Un elemento con data-cierra cierra el menú al hacerle clic.
function Menu({ label, style, title, align = "left", children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({});
  const boton = useRef(null);
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return;
    const fuera = e => {
      if (!boton.current?.contains(e.target) && !panel.current?.contains(e.target)) setOpen(false);
    };
    const tecla = e => { if (e.key === "Escape") { setOpen(false); boton.current?.focus(); } };
    const cerrar = () => setOpen(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", cerrar);
    window.addEventListener("scroll", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", cerrar);
      window.removeEventListener("scroll", cerrar);
    };
  }, [open]);
  const abrir = () => {
    const r = boton.current.getBoundingClientRect();
    setPos(align === "right"
      ? { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }
      : { top: r.bottom + 6, left: Math.max(8, r.left) });
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={boton} className="hov" onClick={abrir} title={title}
        aria-haspopup="menu" aria-expanded={open} style={style}>
        {label} <span style={{ fontSize: "var(--fs-1)", opacity: .8 }}>▾</span>
      </button>
      <div ref={panel} role="menu" className="menu-panel"
        onClick={e => { if (e.target.closest("[data-cierra]")) setOpen(false); }}
        style={{ display: open ? "flex" : "none", ...pos }}>
        {children}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UN VALOR QUE NO ESTA EN LA LISTA
// ═══════════════════════════════════════════════════════════════════
// Un <select> cuyo `value` no coincide con ninguna <option> muestra la
// PRIMERA como si fuera el valor guardado. El navegador no avisa.
//
// Manuel Estrada lo dejo a la vista: el encabezado decia "Laura de Armas"
// y el desplegable "Jose Del Valle". El dato guardado era Laura —que es
// procesadora, no originadora— y venia de la migracion de los 102
// archivos, donde el nombre entra como texto sin validar contra la lista.
//
// Peor todavia: al abrir y guardar sin tocar el control, React no manda
// evento y el valor malo sobrevive. Habia que escoger otro y volver.
//
// Con 102 archivos migrados y una hoja de Excel que entra por fuera, esto
// puede estar pasando en mas sitios de los que se ven. Y en produccion
// significa numeros atribuidos a la persona equivocada.
//
// La opcion huerfana se añade al principio, en rojo y diciendo que no
// esta en la lista. El archivo deja de mentir y se arregla con un toque.
function orphanOption(valor, dentro, texto){
  const v = String(valor ?? "").trim();
  if (!v) return null;
  if (dentro) return null;
  return <option value={v}>{`⚑ ${v} — ${texto}`}</option>;
}

function timeAgo(iso){
  if(!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if(m<1) return "just now";
  if(m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if(h<24) return `${h}h ago`;
  const d = Math.floor(h/24);
  if(d<30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════════
// VERSIÓN Y DETECCIÓN DE DESPLIEGUE
// ═══════════════════════════════════════════════════════════════════
// Safari en iOS guarda el JavaScript con mucha insistencia: si la app
// estaba abierta cuando se desplegó, se queda con lo que ya tenía cargado
// y no hay forma de notarlo desde adentro. El móvil de Jose seguía
// mostrando "MORTGAGE BY DELVALLE" y el CRITICAL viejo, varias tandas
// después de haberlos cambiado.
//
// Con una persona eso es una molestia. Con cinco es un problema de datos:
// alguien captura con reglas viejas sin saber que las suyas caducaron.
//
// Cómo se detecta sin tocar la configuración de compilación: Vite le pone
// un hash al nombre del bundle y lo referencia desde index.html. Si el
// index.html del servidor cambia, es que hay un despliegue nuevo. Se lee
// cada pocos minutos, sin caché, y se compara con el del arranque.
// El número ya no se escribe a mano: se quedó en 2026.09.16e durante dos
// meses de despliegues. Ahora lo pone vite.config.js al compilar — fecha del
// build y los 7 primeros caracteres del commit (el mismo que muestra GitHub
// y Vercel). Así "¿qué versión tienes?" se contesta mirando la esquina.
/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

function huellaTexto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return String(h);
}

async function huellaDelServidor() {
  try {
    const r = await fetch(`/index.html?_=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return huellaTexto(await r.text());
  } catch { return null; }
}

// Recargar de verdad. `location.reload()` en iOS puede volver a servir lo
// mismo del caché; cambiar la URL obliga a pedir el index de nuevo, y con
// él el bundle nuevo, que tiene otro nombre.
function recargarDeVerdad() {
  // La huella del arranque se guarda una sola vez por sesion de pestaña y
  // no se volvia a escribir nunca. Al recargar desde este boton la pestaña
  // es la MISMA, asi que `sessionStorage` sobrevive: el build nuevo se
  // comparaba contra la huella vieja y el aviso volvia a salir enseguida,
  // en una pestaña que ya estaba al dia. Se borra antes de navegar para que
  // la carga nueva tome su huella limpia.
  try { sessionStorage.removeItem("pipe_build"); } catch { /* modo privado */ }
  const base = window.location.pathname;
  window.location.replace(`${base}?v=${Date.now()}`);
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function attempt() {
    if (!email.trim() || !pw) {
      setError(TX("errNeedBoth"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
    } catch (err) {
      setBusy(false);
      const code = err.code || "";
      const msg = code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
        ? TX("errBadLogin")
        : code === "auth/too-many-requests"
          ? TX("errTooMany")
          : code === "auth/network-request-failed"
            ? TX("errNoNet")
            : TX("errSignIn");
      setError(msg);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  }

  async function sendReset() {
    if (!email.trim()) {
      setError(TX("errNeedEmail"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(TX("errResetFail"));
    }
  }

  return (
    <div style={{
      background:"var(--bg)", minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"var(--ff-body)", padding:20
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117.

           El SUELO subio mas que el techo, a proposito. El contenido de los
           paneles vive casi todo en --fs-1 y --fs-2 —en la pantalla de
           procesamiento son 101 de 120 tamanos— mientras el marco usa --fs-3
           y arriba: lo de dentro se leia mas chico que lo de fuera. Subir
           todo por igual no era la respuesta, porque eso es justo lo que
           hace el control A+/A-; lo que hacia falta era comprimir el rango.
           De ahi +1px hasta --fs-6, +0.5px en el 7 y el 8, y nada en los dos
           de display, que ya estaban bien. La escala tiene que quedar
           SIEMPRE estrictamente creciente: con 11.5/12.5/13.5 el fondo era
           tan estrecho que mover un nivel colapsaba el de al lado. */
        :root{
          --fs-scale:1;
          --fs-1:calc(12.5px * var(--fs-scale));
          --fs-2:calc(13.5px * var(--fs-scale));
          --fs-3:calc(14.5px * var(--fs-scale));
          --fs-4:calc(15.5px * var(--fs-scale));
          --fs-5:calc(16.5px * var(--fs-scale));
          --fs-6:calc(18px   * var(--fs-scale));
          --fs-7:calc(19.5px   * var(--fs-scale));
          --fs-8:calc(21.5px   * var(--fs-scale));
          --fs-9:calc(25px   * var(--fs-scale));
          --fs-10:calc(30px  * var(--fs-scale));
          --t1:#F0F6FC;
          --t2:#ADBAC7;
          --t3:#8B98A5;
          --t4:#737F8C;
        }
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

        /* ─── DOS CLASES DE TEXTO PEQUENO ──────────────────────────
           Hasta aqui, tres cosas distintas se veian identicas: lo que
           explica como funciona un campo, lo que le pide a una persona
           que haga algo, y lo que dice donde se edita. Todo gris chico.

           .sys  nota del sistema. Explica. No pide nada. Si la borras,
                 nadie deja de trabajar — solo entiende menos.
           .act  instruccion. Dice que hacer o que escribir. Si la
                 borras, alguien no sabe que hacer.

           La flecha dorada le hace un alto a la lectura: obliga a fijar
           la vista donde hay una tarea. No compite con el dorado de
           señal porque aquel siempre cae sobre un DATO —una fecha, un
           contador— y este sobre texto explicativo.

           Dos clases y no tres: mas de dos y nadie las distingue. */
        .ver{position:absolute;top:12px;right:24px;font-family:'DM Mono','Courier New',monospace;
          font-size:var(--fs-1);color:var(--t3);letter-spacing:.5px;pointer-events:none;}
        @media (max-width:900px){
          .ver{position:static;order:99;width:100%;text-align:left;
            margin-top:2px;color:var(--t4);}
        }
        .sys{font-size:var(--fs-1);color:var(--t4);line-height:1.55;}
        .act{font-size:var(--fs-2);color:var(--t3);line-height:1.6;font-style:italic;}
        .act::before{content:"→";color:#F5A623;font-style:normal;
          margin-right:6px;font-weight:500;}
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .shake{animation:shake .5s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn .4s ease;}
        input:focus{outline:none;}
      `}</style>
      <div className="fade" style={{width:"100%", maxWidth:430,
        display:"flex", flexDirection:"column", alignItems:"stretch", gap:0}}>

        {/* MARCA — el nombre primero, la herramienta después */}
        <div style={{textAlign:"center", marginBottom:24}}>
          <div style={{
            width:62, height:62, borderRadius:16, margin:"0 auto 15px",
            background:"linear-gradient(140deg,var(--gold),#B87F1E)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--ff-title)", fontWeight:800, fontSize:"var(--fs-10)", color:"var(--bg)",
            letterSpacing:"-1px", boxShadow:"0 10px 30px rgba(245,166,35,.16)"
          }}>DV</div>
          <div style={{fontFamily:"var(--ff-title)", fontWeight:800, fontSize:"var(--fs-10)", color:"var(--t1)",
            letterSpacing:"-0.7px", lineHeight:1.15}}>Del Valle Lending Co.</div>
            <div style={{fontFamily:"var(--ff-mono)",fontSize:"var(--fs-2)",color:"var(--t2)",letterSpacing:"0.5px",marginTop:4}}>powered by Barrett Financial Group</div>
          {/* Barrett ya está en el renglón de arriba. Decirlo dos veces en
              tres líneas no refuerza la marca: la diluye. */}
          <div style={{fontSize:"var(--fs-3)", color:"var(--t3)", letterSpacing:"2.5px", marginTop:8}}>
            PIPELINE
          </div>
          <div style={{width:34, height:2, background:"var(--gold)", margin:"16px auto 13px",
            borderRadius:2, opacity:.7}}/>
          <div style={{fontFamily:"var(--ff-title)", fontWeight:700, fontSize:"var(--fs-4)", color:"var(--gold)",
            letterSpacing:"0.3px"}}>Trust the Numbers. Trust the Name.</div>
        </div>

        <div style={{background:"var(--s1)", border:"1px solid var(--bd)", borderRadius:14,
          padding:"26px 24px", display:"flex", flexDirection:"column", gap:16}}>

        {resetSent ? (
          <div style={{width:"100%", display:"flex", flexDirection:"column", gap:12, textAlign:"center"}}>
            <div style={{color:"var(--ok)", fontSize:"var(--fs-6)", lineHeight:1.5}}>
              ✓ Reset email sent to:<br/>
              <strong style={{color:"var(--t1)"}}>{email}</strong>
            </div>
            <div style={{fontSize:"var(--fs-4)", color:"var(--t2)", lineHeight:1.5}}>
              Check your inbox (and spam folder). Click the link to set a new password, then come back and sign in.
            </div>
            <button onClick={()=>{setResetSent(false);setResetMode(false);setError("");}}
              style={{background:"var(--s2)", color:"var(--t2)", borderRadius:8, padding:"10px 0",
                fontFamily:"var(--ff-mono)", fontSize:"var(--fs-4)", border:"1px solid var(--bd)", cursor:"pointer", marginTop:4}}>
              ← BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <div className={shake ? "shake" : ""} style={{width:"100%", display:"flex", flexDirection:"column", gap:14}}>
            <div>
              <div style={{fontSize:"var(--fs-3)", color:"var(--t3)", letterSpacing:"1px", marginBottom:6}}>EMAIL</div>
              <input
                type="email"
                value={email}
                autoComplete="username"
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && (resetMode ? sendReset() : attempt())}
                placeholder="tu@barrettfinancial.com"
                autoFocus
                disabled={busy}
                style={{
                  background:"var(--bg)",
                  border: error ? "1px solid var(--bad)" : "1px solid var(--bd)",
                  borderRadius:8, padding:"12px 14px",
                  color:"var(--t1)", fontSize:"var(--fs-6)",
                  fontFamily:"var(--ff-body)",
                  width:"100%", transition:"border .15s",
                  opacity: busy ? 0.6 : 1,
                }}
              />
            </div>

            {!resetMode && (
              <div>
                <div style={{fontSize:"var(--fs-3)", color:"var(--t3)", letterSpacing:"1px", marginBottom:6, display:"flex", justifyContent:"space-between"}}>
                  <span>PASSWORD</span>
                  <button onClick={()=>{setResetMode(true);setError("");}}
                    style={{background:"transparent", border:"none", color:"var(--gold)", fontSize:"var(--fs-3)", fontFamily:"var(--ff-mono)", cursor:"pointer", letterSpacing:"1px"}}>
                    FORGOT?
                  </button>
                </div>
                <input
                  type="password"
                  value={pw}
                  autoComplete="current-password"
                  onChange={e => { setPw(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && attempt()}
                  placeholder={TX("phPassword")}
                  disabled={busy}
                  style={{
                    background:"var(--bg)",
                    border: error ? "1px solid var(--bad)" : "1px solid var(--bd)",
                    borderRadius:8, padding:"12px 14px",
                    color:"var(--t1)", fontSize:"var(--fs-6)",
                    fontFamily:"var(--ff-body)",
                    width:"100%", transition:"border .15s",
                    opacity: busy ? 0.6 : 1,
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{fontSize:"var(--fs-4)", color:"var(--bad)", lineHeight:1.4}}>{error}</div>
            )}

            <button
              onClick={resetMode ? sendReset : attempt}
              disabled={busy}
              style={{
                width:"100%", background: busy ? "#8B6914" : "var(--gold-d)", color:"var(--bg)",
                borderRadius:8, padding:"13px 0", fontFamily:"var(--ff-mono)",
                fontSize:"var(--fs-5)", fontWeight:500, border:"none", cursor: busy ? "wait" : "pointer",
                transition:"opacity .15s", marginTop:4
              }}
              onMouseOver={e => !busy && (e.target.style.opacity=".85")}
              onMouseOut={e => e.target.style.opacity="1"}
            >
              {busy ? "WORKING…" : resetMode ? "SEND RESET LINK →" : "SIGN IN →"}
            </button>

            {resetMode && (
              <button onClick={()=>{setResetMode(false);setError("");}}
                style={{background:"transparent", border:"none", color:"var(--t2)", fontSize:"var(--fs-3)", fontFamily:"var(--ff-mono)", cursor:"pointer", letterSpacing:"1px"}}>
                ← BACK TO SIGN IN
              </button>
            )}
          </div>
        )}

        </div>

        <div style={{fontSize:"var(--fs-3)", color:"var(--t4)", textAlign:"center", lineHeight:1.6, marginTop:18}}>
          Solo personal autorizado · Authorized personnel only<br/>
          Toda la actividad queda registrada · All activity is logged
        </div>
      </div>
    </div>
  );
}



const IS = { background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",padding:"9px 12px",fontSize:"var(--fs-5)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%" };

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [files,setFiles]=useState([]);
  // Historial de requests enviados. Vive en el mismo documento que los
  // archivos, pero aparte: un request es lo que se mandó ese día, y no
  // debe cambiar aunque después se edite un archivo.
  const [payrollLog,setPayrollLog]=useState([]);
  const [docBytes,setDocBytes]=useState(0);
  const [migrado,setMigrado]=useState(null);
  // Lo que ya está en el servidor, por archivo. Es contra esto que se
  // compara para saber qué escribir.
  const huella = useRef(new Map());
  const [sizeAlert,setSizeAlert]=useState(null);
  const [idsBackfilled,setIdsBackfilled]=useState(0);
  // Detalle de DPA capturado a mano. Vive junto al pipeline, NO en
  // lenders2026.json: ese archivo se regenera desde el Excel de Barrett y
  // borraría todo lo escrito.
  const [dpaDetails,setDpaDetails]=useState({});
  // El idioma es del usuario, no de la sesión: Ana entra siempre en español
  // aunque Jose haya usado el mismo navegador en inglés.
  // Arranca en español y se corrige en cuanto se sabe quien entro. No
  // puede leer el perfil aqui: `profile` se arma mas abajo.
  const [lang,setLang]=useState("es");
  const [langReady,setLangReady]=useState(false);
  const L=(k,v)=>tr(k,lang,v);
  fijarIdioma(lang);
  const [view,setView]=useState("active");
  const [activePhase,setActivePhase]=useState(null);
  const [critOnly,setCritOnly]=useState(false);
  // Solapa a la que abrir el modal del archivo. La usa el relleno para
  // dejar a la persona parada donde vive el hueco.
  const [detailTab,setDetailTab]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [trainingMode,setTrainingMode]=useState(false);
  // Aqui arriba a la fuerza: mas abajo quedaria despues de los return
  // tempranos de authReady, currentUser y loaded, y un hook que solo corre
  // en algunos renders tumba React entero.
  const [gateBlock,setGateBlock]=useState(null);
  // A donde acaba de mandar una puerta. `n` cambia siempre para que pedir dos
  // veces el mismo destino vuelva a moverse.
  const [irA,setIrA]=useState(null);
  const [showHelp,setShowHelp]=useState(false);
  const [showBackfill,setShowBackfill]=useState(false);
  // Hay un despliegue más nuevo que el que este navegador tiene cargado.
  const [versionVieja,setVersionVieja]=useState(false);
  // ESCALA DEL TEXTO. `--fs-scale` existia en los tokens desde el principio,
  // con el comentario de que era la unica perilla de la escala completa — y
  // nunca se conecto a nada. Cada quien pasa horas en esta pantalla y no todos
  // ven igual. Vive en el navegador, no en el perfil: es de este ojo en esta
  // pantalla, y Tina en su laptop no tiene por que heredar lo de nadie.
  const [escala,setEscala]=useState(()=>{
    try{ const v=parseFloat(window.localStorage.getItem("pipe_fs")); 
      return Number.isFinite(v)&&v>=.9&&v<=1.4 ? v : 1; }catch{ return 1; }
  });
  // Se pone en el elemento raiz: gana sobre la regla de :root de los cuatro
  // bloques <style> sin tener que tocar ninguno.
  useEffect(()=>{
    try{ document.documentElement.style.setProperty("--fs-scale",String(escala));
      window.localStorage.setItem("pipe_fs",String(escala)); }catch{ /* modo privado */ }
  },[escala]);
  const [detail,setDetail]=useState(null);
  const [prepFor,setPrepFor]=useState(null);
  const [archiveFor,setArchiveFor]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle");

  // ─── VIGILANCIA DE VERSIÓN ───
  // Se toma la huella al arrancar y se vuelve a mirar cada cinco minutos, y
  // también cada vez que alguien vuelve a la pestaña — que es justo cuando
  // pasa: se despliega mientras la app está abierta en otra ventana.
  useEffect(()=>{
    let vivo = true;
    // La huella del arranque se guarda en la sesion del navegador. Si la
    // pestana se abre con un bundle viejo servido desde cache, la del
    // servidor ya viene distinta y se detecta en el primer vistazo, sin
    // esperar los cinco minutos.
    let alArrancar = null;
    try { alArrancar = sessionStorage.getItem("pipe_build") || null; } catch {}
    const mirar = async () => {
      const h = await huellaDelServidor();
      if (!vivo || !h) return;
      if (alArrancar === null) {
        alArrancar = h;
        try { sessionStorage.setItem("pipe_build", h); } catch {}
        return;
      }
      if (h !== alArrancar) setVersionVieja(true);
    };
    mirar();
    const t = setInterval(mirar, 5 * 60 * 1000);
    const alVolver = () => { if (document.visibilityState === "visible") mirar(); };
    document.addEventListener("visibilitychange", alVolver);
    return ()=>{ vivo=false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver); };
  },[]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setFiles([]);
        setLoaded(false);
      }
    });
    return () => unsub();
  }, []);

  const profile = currentUser
    ? { uid: currentUser.uid, email: currentUser.email, ...getProfile(currentUser.uid) }
    : null;
  const langUid = profile?.uid || null;
  // Guardar el idioma vive AQUI y no arriba con el resto del estado:
  // su lista de dependencias nombra `langUid`, y una lista se evalua
  // durante el render. Declarado despues, era ReferenceError y
  // pantalla blanca. Compila igual — solo revienta al ejecutar.
  useEffect(()=>{ if(langReady) try{localStorage.setItem(LANG_KEY(langUid),lang);}catch{} },[lang,langReady,langUid]);
  useEffect(()=>{
    if(!profile){ setLangReady(false); return; }
    let guardado = null;
    try{ guardado = localStorage.getItem(LANG_KEY(profile.uid)); }catch{ /* modo privado */ }
    setLang(guardado || defaultLang(profile));
    setLangReady(true);
  }, [profile?.uid]);

  const isAdmin     = profile?.role === "admin";
  const isLO        = profile?.role === "lo";
  const isAssistant = profile?.role === "assistant" || profile?.role === "processor";
  const isProcessor = profile?.role === "processor";

  // Payroll y el detalle de DPA no son de ningún préstamo: siguen en el
  // documento de configuración de siempre.
  useEffect(()=>{
    if (!currentUser) return;
    const unsub = onSnapshot(PIPELINE_DOC, (snap) => {
      if(!snap.exists()) return;
      const data = snap.data();
      if(Array.isArray(data.payrollRequests)) setPayrollLog(data.payrollRequests);
      if(data.dpaDetails && typeof data.dpaDetails==="object") setDpaDetails(data.dpaDetails);
    }, ()=>{});
    return ()=>unsub();
  },[currentUser]);

  // ─── LOS PRÉSTAMOS ───
  // Un documento por archivo. El listener entrega la colección entera la
  // primera vez y después SOLO lo que cambió — que es justo lo contrario de
  // lo que hacía el documento único.
  useEffect(()=>{
    if (!currentUser) return;
    const unsub = onSnapshot(LOANS, (snap) => {
      const vivos = snap.docs.map(d2 => ({ ...d2.data(), id: d2.id }));
      if (vivos.length > 0) {
        setFiles(vivos);
        // La huella de lo que YA está en el servidor. Sin esto, el primer
        // guardado creería que los 101 archivos cambiaron y los reescribiría
        // todos — o sea, el mismo problema con otro nombre.
        huella.current = new Map(vivos.map(f => [String(f.id), JSON.stringify(f)]));
        setLoaded(true);
        return;
      }
      // Colección vacía: o es la primera vez, o hay que migrar.
      migrarSiHaceFalta();
    }, ()=>{
      try{
        const local = localStorage.getItem("pipe_v3");
        if(local) setFiles(JSON.parse(local));
      } catch{}
      setLoaded(true);
      setSaveStatus("error");
    });
    return ()=>unsub();
  },[currentUser]);

  // ─── MIGRACIÓN ───
  // Una sola vez, y solo si hace falta: la colección está vacía y el
  // documento viejo trae archivos. El documento viejo NO se toca — queda de
  // respaldo, y volver atrás es revertir el despliegue.
  const [migrando,setMigrando]=useState(false);
  async function migrarSiHaceFalta(){
    if (migrando) return;
    try{
      const previo = await getDocs(LOANS);
      if (!previo.empty) return;                 // otro navegador ya migró
      const snap = await new Promise((res)=>{
        const u = onSnapshot(PIPELINE_DOC, x => { u(); res(x); }, ()=>res(null));
      });
      const viejos = snap?.exists() ? (snap.data().files || []) : [];
      if (!viejos.length) {
        // Ni colección ni documento viejo: pipeline nuevo de verdad.
        setFiles(SAMPLE); setLoaded(true);
        await escribirLote(SAMPLE.map((f,i)=>({...f,id:f.id||`f_seed_${i}`})), []);
        return;
      }
      setMigrando(true);
      // Un archivo sin id no se puede guardar como documento: el id ES el
      // nombre del documento. Se le asigna uno estable, igual que antes.
      let sinId = 0;
      const conIds = viejos.map((f,i)=>{
        if (f && f.id) return f;
        sinId++;
        return { ...f, id: `f_r${i}_${String(f?.borrower||"x").replace(/\W/g,"").slice(0,8)}` };
      });
      if (sinId > 0) setIdsBackfilled(sinId);
      await escribirLote(conIds, []);
      setMigrado(conIds.length);
      // Es un aviso de "acaba de pasar algo", no un estado. Los otros avisos
      // del sistema se apagan solos; este se quedaba hasta recargar.
      setTimeout(()=>setMigrado(null), 12000);
      setMigrando(false);
    }catch{
      setSaveStatus("error");
      setMigrando(false);
    }
  }

  useEffect(()=>{
    if(!loaded || !currentUser) return;
    setDoc(PIPELINE_DOC, {payrollRequests: payrollLog}, {merge:true}).catch(()=>{});
  },[payrollLog,loaded,currentUser]);

  // ─── GUARDADO POR DIFERENCIA ───
  // La clave de que NINGUNA pantalla cambie: las veinte funciones que mueven
  // archivos —avanzar, cerrar, archivar, rellenar— siguen llamando a
  // setFiles como siempre. Aquí se compara contra lo que ya está en el
  // servidor y se escribe SOLO lo que cambió.
  //
  // Un toque escribía 533 KB. Ahora escribe 5.
  useEffect(()=>{
    if(!loaded || !currentUser) return;
    const antes = huella.current;
    const ahora = new Map();
    const cambiados = [];
    for (const f of files) {
      if (!f || !f.id) continue;
      const id = String(f.id);
      const json = JSON.stringify(f);
      ahora.set(id, json);
      if (antes.get(id) !== json) cambiados.push(f);
    }
    const borrados = [...antes.keys()].filter(id => !ahora.has(id));
    // Cuánto pesa el archivo MÁS GRANDE, no la suma: el techo de 1 MB es por
    // documento. Un archivo con cientos de notas es el único que puede
    // acercarse, y ahora se ve cuál.
    try{
      const mayor = files.reduce((a,f)=> Math.max(a, JSON.stringify(f||{}).length), 0);
      setDocBytes(mayor);
      setSizeAlert(mayor > 850000 ? mayor : null);
    }catch{}
    if (!cambiados.length && !borrados.length) return;

    setSaveStatus("saving");
    escribirLote(cambiados, borrados).then(()=>{
      huella.current = ahora;
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(s2=>s2==="saved"?"idle":s2), 2000);
    }).catch(()=>{
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("error");
    });
  },[files,loaded,currentUser]);

  // ─── HOJA DE MARTHA ───
  // Genera SU Excel con las columnas que ya sabemos. ExcelJS se baja del
  // CDN en el primer clic, por eso hay estado de carga: son ~950 KB y en
  // conexion lenta el boton parece muerto si no avisa.
  const [marthaBusy, setMarthaBusy] = useState(false);

  async function exportMarthaSheet(){
    if(marthaBusy) return;
    setMarthaBusy(true);
    try{
      const n = await downloadMarthaSheet(files, DEFAULT_PROCESSOR);
      if(n === 0) alert(TX("marthaEmpty"));
    }catch(err){
      alert(TX("marthaFailed"));
    }finally{
      setMarthaBusy(false);
    }
  }

  function exportBackup(){
    const payload = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      branch: "Del Valle Lending Co. powered by Barrett Financial Group",
      fileCount: files.length,
      files: files,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(event){
    const file = event.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const incomingFiles = Array.isArray(parsed) ? parsed : parsed.files;
        if(!Array.isArray(incomingFiles) || incomingFiles.length === 0){
          alert(TX("errNotBackup"));
          return;
        }
        const ok = confirm(
          `Restore ${incomingFiles.length} loan files from backup?\n\n` +
          `This will REPLACE your current pipeline of ${files.length} files.\n\n` +
          `Tip: export a backup of the current pipeline first if you want to be safe.`
        );
        if(ok){
          setFiles(incomingFiles);
          alert(`Restored ${incomingFiles.length} files from backup.`);
        }
      } catch(err){
        alert(TX("errBadJson"));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!authReady) {
    return (
      <div style={{
        background:"var(--bg)", minHeight:"100vh",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        fontFamily:"var(--ff-body)", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117.

           El SUELO subio mas que el techo, a proposito. El contenido de los
           paneles vive casi todo en --fs-1 y --fs-2 —en la pantalla de
           procesamiento son 101 de 120 tamanos— mientras el marco usa --fs-3
           y arriba: lo de dentro se leia mas chico que lo de fuera. Subir
           todo por igual no era la respuesta, porque eso es justo lo que
           hace el control A+/A-; lo que hacia falta era comprimir el rango.
           De ahi +1px hasta --fs-6, +0.5px en el 7 y el 8, y nada en los dos
           de display, que ya estaban bien. La escala tiene que quedar
           SIEMPRE estrictamente creciente: con 11.5/12.5/13.5 el fondo era
           tan estrecho que mover un nivel colapsaba el de al lado. */
        :root{
          --fs-scale:1;
          --fs-1:calc(12.5px * var(--fs-scale));
          --fs-2:calc(13.5px * var(--fs-scale));
          --fs-3:calc(14.5px * var(--fs-scale));
          --fs-4:calc(15.5px * var(--fs-scale));
          --fs-5:calc(16.5px * var(--fs-scale));
          --fs-6:calc(18px   * var(--fs-scale));
          --fs-7:calc(19.5px   * var(--fs-scale));
          --fs-8:calc(21.5px   * var(--fs-scale));
          --fs-9:calc(25px   * var(--fs-scale));
          --fs-10:calc(30px  * var(--fs-scale));
          --t1:#F0F6FC;
          --t2:#ADBAC7;
          --t3:#8B98A5;
          --t4:#737F8C;
        }
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

        /* ─── DOS CLASES DE TEXTO PEQUENO ──────────────────────────
           Hasta aqui, tres cosas distintas se veian identicas: lo que
           explica como funciona un campo, lo que le pide a una persona
           que haga algo, y lo que dice donde se edita. Todo gris chico.

           .sys  nota del sistema. Explica. No pide nada. Si la borras,
                 nadie deja de trabajar — solo entiende menos.
           .act  instruccion. Dice que hacer o que escribir. Si la
                 borras, alguien no sabe que hacer.

           La flecha dorada le hace un alto a la lectura: obliga a fijar
           la vista donde hay una tarea. No compite con el dorado de
           señal porque aquel siempre cae sobre un DATO —una fecha, un
           contador— y este sobre texto explicativo.

           Dos clases y no tres: mas de dos y nadie las distingue. */
        .ver{position:absolute;top:12px;right:24px;font-family:'DM Mono','Courier New',monospace;
          font-size:var(--fs-1);color:var(--t3);letter-spacing:.5px;pointer-events:none;}
        @media (max-width:900px){
          .ver{position:static;order:99;width:100%;text-align:left;
            margin-top:2px;color:var(--t4);}
        }
        .sys{font-size:var(--fs-1);color:var(--t4);line-height:1.55;}
        .act{font-size:var(--fs-2);color:var(--t3);line-height:1.6;font-style:italic;}
        .act::before{content:"→";color:#F5A623;font-style:normal;
          margin-right:6px;font-weight:500;}
          @keyframes spin{to{transform:rotate(360deg)}}
          .spinner{width:40px;height:40px;border:3px solid #21262D;border-top-color:#F5A623;border-radius:50%;animation:spin .8s linear infinite;}
        `}</style>
        <div className="spinner"/>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen />;

  if (!loaded) {
    return (
      <div style={{
        background:"var(--bg)", minHeight:"100vh",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        fontFamily:"var(--ff-body)", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117.

           El SUELO subio mas que el techo, a proposito. El contenido de los
           paneles vive casi todo en --fs-1 y --fs-2 —en la pantalla de
           procesamiento son 101 de 120 tamanos— mientras el marco usa --fs-3
           y arriba: lo de dentro se leia mas chico que lo de fuera. Subir
           todo por igual no era la respuesta, porque eso es justo lo que
           hace el control A+/A-; lo que hacia falta era comprimir el rango.
           De ahi +1px hasta --fs-6, +0.5px en el 7 y el 8, y nada en los dos
           de display, que ya estaban bien. La escala tiene que quedar
           SIEMPRE estrictamente creciente: con 11.5/12.5/13.5 el fondo era
           tan estrecho que mover un nivel colapsaba el de al lado. */
        :root{
          --fs-scale:1;
          --fs-1:calc(12.5px * var(--fs-scale));
          --fs-2:calc(13.5px * var(--fs-scale));
          --fs-3:calc(14.5px * var(--fs-scale));
          --fs-4:calc(15.5px * var(--fs-scale));
          --fs-5:calc(16.5px * var(--fs-scale));
          --fs-6:calc(18px   * var(--fs-scale));
          --fs-7:calc(19.5px   * var(--fs-scale));
          --fs-8:calc(21.5px   * var(--fs-scale));
          --fs-9:calc(25px   * var(--fs-scale));
          --fs-10:calc(30px  * var(--fs-scale));
          --t1:#F0F6FC;
          --t2:#ADBAC7;
          --t3:#8B98A5;
          --t4:#737F8C;
        }
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

        /* ─── DOS CLASES DE TEXTO PEQUENO ──────────────────────────
           Hasta aqui, tres cosas distintas se veian identicas: lo que
           explica como funciona un campo, lo que le pide a una persona
           que haga algo, y lo que dice donde se edita. Todo gris chico.

           .sys  nota del sistema. Explica. No pide nada. Si la borras,
                 nadie deja de trabajar — solo entiende menos.
           .act  instruccion. Dice que hacer o que escribir. Si la
                 borras, alguien no sabe que hacer.

           La flecha dorada le hace un alto a la lectura: obliga a fijar
           la vista donde hay una tarea. No compite con el dorado de
           señal porque aquel siempre cae sobre un DATO —una fecha, un
           contador— y este sobre texto explicativo.

           Dos clases y no tres: mas de dos y nadie las distingue. */
        .ver{position:absolute;top:12px;right:24px;font-family:'DM Mono','Courier New',monospace;
          font-size:var(--fs-1);color:var(--t3);letter-spacing:.5px;pointer-events:none;}
        @media (max-width:900px){
          .ver{position:static;order:99;width:100%;text-align:left;
            margin-top:2px;color:var(--t4);}
        }
        .sys{font-size:var(--fs-1);color:var(--t4);line-height:1.55;}
        .act{font-size:var(--fs-2);color:var(--t3);line-height:1.6;font-style:italic;}
        .act::before{content:"→";color:#F5A623;font-style:normal;
          margin-right:6px;font-weight:500;}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
          .spinner{width:40px;height:40px;border:3px solid #21262D;border-top-color:#F5A623;border-radius:50%;animation:spin .8s linear infinite;}
          .pulse{animation:pulse 1.4s ease-in-out infinite;}
        `}</style>
        <div className="spinner"/>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.5px"}}>
            LOADING PIPELINE
          </div>
          <div className="pulse" style={{fontSize:"var(--fs-3)",color:"var(--t3)",letterSpacing:"2px",marginTop:6}}>
            SYNCING WITH CLOUD DATABASE…
          </div>
        </div>
      </div>
    );
  }

  // ─── FILE PARTITIONING ───
  // Active = working pipeline (not closed, not referred out)
  // Closed = funded loans
  // ReferredOut = loans we sent to another bank
  // Inbound = loans another banker sent to us (flag, can be in any stage)
  // Archived files are out of every count. Preparation files are out of the
  // active board but still very much alive — they have their own view.
  // El archivo de entrenamiento SI se ve en el tablero — es persistente y
  // crece con la persona. Pero solo lo ve su dueno: el de Ana no aparece
  // en el tablero de Marelis ni en el mio.
  const myTraining=trainingFileId(profile);
  const live=files.filter(f=>!isArchived(f) && (!isTraining(f) || f.id===myTraining));
  const active=live.filter(f=>f.stage!==CLOSED_STAGE && f.stage!==REFERRED_OUT_STAGE && f.stage!==PREP_STAGE);
  const closed=live.filter(f=>f.stage===CLOSED_STAGE);
  const referredOut=live.filter(f=>f.stage===REFERRED_OUT_STAGE);
  const inbound=live.filter(f=>f.isInbound && f.stage!==PREP_STAGE);
  const prep=live.filter(isPrep).sort((a,b)=>(a.prep?.reviewOn||"")<(b.prep?.reviewOn||"")?-1:1);
  const dueReview=prep.filter(prepDue);
  const archived=files.filter(isArchived);

  const display=(
    view==="closed" ? closed :
    view==="referred" ? referredOut :
    view==="inbound" ? inbound :
    view==="prep" ? prep :
    view==="review" ? dueReview :
    view==="archived" ? archived :
    active
  )
    .filter(f=>!search||f.borrower.toLowerCase().includes(search.toLowerCase()))
    .filter(f=>!activePhase||getPhase(f.stage).id===activePhase)
    .filter(f=>!critOnly||fileSeverity(f)==="critical");

  // La puerta se evalua ANTES de tocar el estado: si bloquea, no se
  // avanza y se abre el aviso. `override` solo llega desde el boton de
  // admin, y trae la razon escrita que queda en el historial.
  const advance=(id,override)=>{
    const f0=files.find(x=>x.id===id);
    if(f0 && !override){
      const g=stageGate(f0);
      if(g.blocked || g.soft.length){ setGateBlock({id, gate:g, borrower:f0.borrower}); return false; }
    }
    setFiles(p=>p.map(f=>{
    if(f.id!==id)return f;
    // Don't auto-advance referred-out or closed files
    if(f.stage===CLOSED_STAGE || f.stage===REFERRED_OUT_STAGE || f.stage===PREP_STAGE)return f;
    if(f.archived)return f;
    const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);
    if(i===-1)return f; // unknown stage — don't silently drop it back to the start
    const n=ALL_STAGES[i+1];
    if(!n)return f;
    const g=stageGate(f);
    // Queda escrito QUE quedo abierto al avanzar. Sin esto el archivo se
    // ve sano y en tres meses no se puede contar cuantas veces se salto
    // cada paso — que es el dato que dice si el proceso esta mal puesto.
    const pend=[...g.hard,...g.soft].map(r=>r.id);
    return stampEdit(stampStage(f, n.stage), profile, "stage_advanced", {
      from:f.stage, to:n.stage,
      ...(pend.length?{skipped:pend}:{}),
      ...(override?{override:true, overrideReason:override.reason, overrideBy:profile?.name}:{}),
    });
  }));
    return true;
  };
  const closeFile=(id,fechaFondeo)=>{
    setFiles(p=>p.map(f=>{
      if(f.id!==id) return f;
      if(f.stage===REFERRED_OUT_STAGE) return f; // un archivo referido afuera lo cierra el otro banco, no nosotros
      // No llamarla fundedDate: ese nombre ya existe importado del motor.
      const fundedOn = okDate(fechaFondeo) || f.closing || today();
      return stampEdit({...f, stage:CLOSED_STAGE, closedAt:fundedOn, daysInStage:0}, profile, "closed", {from:f.stage, closedAt:fundedOn});
    }));
    setDetail(null);
  };
  const reopenFile=id=>{
    setFiles(p=>p.map(f=>f.id===id
      ? stampEdit({...stampStage(f, "Welcome Sent"), closedAt:null}, profile, "reopened")
      : f));
    setDetail(null);
  };
  // ─── PREPARATION ACTIONS ───
  // Send a live-but-not-ready file out of the active board. We remember the
  // stage it came from so "CONTINUE" can put it back where it was.
  const sendToPrep=(id,{reason,reviewOn,note})=>{
    setFiles(p=>p.map(f=>{
      if(f.id!==id)return f;
      const prior = isPrep(f) ? (f.prep?.prevStage||"Lead Inquiry") : f.stage;
      const reschedules = isPrep(f) ? (f.prep?.reschedules||0)+1 : 0;
      const enteredAt = isPrep(f) ? (f.prep?.enteredAt||today()) : today();
      return stampEdit({
        ...f,
        stage: PREP_STAGE,
        prep: { reason, reviewOn, note:(note||"").trim(), prevStage:prior, enteredAt, reschedules },
      }, profile, isPrep(f)?"prep_rescheduled":"sent_to_prep", {reason, reviewOn, from:prior});
    }));
    setDetail(null);
  };
  // Back onto the active board. The stage clock starts TODAY — this file has
  // not been worked in months, it does not get credit for time served.
  const continueFromPrep=id=>{
    setFiles(p=>p.map(f=>{
      if(f.id!==id)return f;
      const back = f.prep?.prevStage || "Lead Inquiry";
      return stampEdit({...stampStage(f, back), prep:null}, profile, "returned_from_prep", {to:back});
    }));
    setDetail(null);
  };
  const archiveFile=(id,reason)=>{
    setFiles(p=>p.map(f=>f.id===id
      ? stampEdit({...f, archived:true, archivedAt:today(), archiveReason:reason||"Other"}, profile, "archived", {reason})
      : f));
    setDetail(null);
  };
  const restoreFile=id=>{
    setFiles(p=>p.map(f=>f.id===id
      ? stampEdit({...f, archived:false, archivedAt:null, archiveReason:null}, profile, "unarchived")
      : f));
    setDetail(null);
  };

  const updateFile=(id,patch)=>setFiles(p=>p.map(f=>{
    if(f.id!==id)return f;
    const cleanPatch = {};
    for(const [k,v] of Object.entries(patch)){
      cleanPatch[k] = typeof v === "string" ? v.trim() : v;
    }
    const changedFields = Object.keys(cleanPatch).filter(k=>JSON.stringify(f[k])!==JSON.stringify(cleanPatch[k]));
    if(changedFields.length===0)return f;
    return stampEdit({...f, ...cleanPatch}, profile, "edited", {fields:changedFields});
  }));
  const deleteFile=id=>{
    if(!isAdmin){
      alert(TX("errAdminOnly"));
      return;
    }
    setFiles(p=>p.filter(f=>f.id!==id));
    setDetail(null);
  };

  const startTraining=()=>{
    const id=trainingFileId(profile);
    if(files.some(f=>f.id===id)){
      if(!window.confirm(TX("trainResetAsk"))) return;
      setFiles(p=>p.filter(f=>f.id!==id));
    }
    clearProgress(profile?.uid);
    setTrainingMode(true); setShowAdd(true);
  };

  const vol=active.reduce((s,f)=>s+(f.loan||0),0);
  // Cuenta lo peor de cada archivo, sea la etapa o el reloj que manda.
  // Antes solo miraba la etapa y el numero no cuadraba con el tablero.
  const crit=active.filter(f=>fileSeverity(f)==="critical").length;
  const phaseCounts=PHASES.map(p=>({...p,count:active.filter(f=>getPhase(f.stage).id===p.id).length}));

  return(
    <div style={{fontFamily:"var(--ff-body)",background:"var(--bg)",minHeight:"100vh",color:"var(--t1)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ESTAS DOS VIVEN AQUI, NO EN EL BLOQUE DE LOGIN.
           Estuvieron en el <style> de LoginScreen, que solo se monta en la
           pantalla de entrada: las clases se ponian bien en el DOM y no habia
           ninguna regla que las pintara. El destello de ARREGLAR AHORA nunca
           se vio —lo que funcionaba era el scroll y el foco, que son JS— y el
           resaltado del recorrido tampoco se veia. coherencia.mjs ahora
           comprueba que toda clase que el codigo añade exista en ESTE bloque. */
        /* EL RECORRIDO. El resaltado era dorado de 2px y se perdia: el dorado
           significa "se avecina" en toda la app. Blanco no significa nada en
           el sistema, asi que se lee como atencion. El pulso es lo que de
           verdad se ve cuando dos bloques estan pegados —el ojo caza el
           movimiento antes que el color— y apagar el resto hace el contraste
           que un borde solo no puede hacer. */
        @keyframes tourPulse{
          0%{box-shadow:0 0 0 0 rgba(255,255,255,.95), 0 0 0 0 rgba(255,255,255,.45)}
          60%{box-shadow:0 0 0 3px rgba(255,255,255,.95), 0 0 0 16px rgba(255,255,255,0)}
          100%{box-shadow:0 0 0 3px rgba(255,255,255,.9), 0 0 0 16px rgba(255,255,255,0)}}
        .tour-on{animation:tourPulse 1.1s ease-out both;border-radius:8px;
          position:relative;z-index:5;scroll-margin:90px;}
        .tour-off{opacity:.3;transition:opacity .22s ease;}

        /* El campo al que ARREGLAR AHORA acaba de llevar. Dos segundos y se
           apaga: un resaltado permanente deja de verse a los diez minutos. */
        @keyframes fixFlash{
          0%{box-shadow:0 0 0 0 rgba(245,166,35,0)}
          15%{box-shadow:0 0 0 3px rgba(245,166,35,.55)}
          100%{box-shadow:0 0 0 3px rgba(245,166,35,0)}}
        .fix-flash{animation:fixFlash 2s ease-out;border-radius:8px;
          scroll-margin:80px;}
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117.

           El SUELO subio mas que el techo, a proposito. El contenido de los
           paneles vive casi todo en --fs-1 y --fs-2 —en la pantalla de
           procesamiento son 101 de 120 tamanos— mientras el marco usa --fs-3
           y arriba: lo de dentro se leia mas chico que lo de fuera. Subir
           todo por igual no era la respuesta, porque eso es justo lo que
           hace el control A+/A-; lo que hacia falta era comprimir el rango.
           De ahi +1px hasta --fs-6, +0.5px en el 7 y el 8, y nada en los dos
           de display, que ya estaban bien. La escala tiene que quedar
           SIEMPRE estrictamente creciente: con 11.5/12.5/13.5 el fondo era
           tan estrecho que mover un nivel colapsaba el de al lado. */
        :root{
          --fs-scale:1;
          --fs-1:calc(12.5px * var(--fs-scale));
          --fs-2:calc(13.5px * var(--fs-scale));
          --fs-3:calc(14.5px * var(--fs-scale));
          --fs-4:calc(15.5px * var(--fs-scale));
          --fs-5:calc(16.5px * var(--fs-scale));
          --fs-6:calc(18px   * var(--fs-scale));
          --fs-7:calc(19.5px   * var(--fs-scale));
          --fs-8:calc(21.5px   * var(--fs-scale));
          --fs-9:calc(25px   * var(--fs-scale));
          --fs-10:calc(30px  * var(--fs-scale));
          --t1:#F0F6FC;
          --t2:#ADBAC7;
          --t3:#8B98A5;
          --t4:#737F8C;
        }
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

        /* ─── DOS CLASES DE TEXTO PEQUENO ──────────────────────────
           Hasta aqui, tres cosas distintas se veian identicas: lo que
           explica como funciona un campo, lo que le pide a una persona
           que haga algo, y lo que dice donde se edita. Todo gris chico.

           .sys  nota del sistema. Explica. No pide nada. Si la borras,
                 nadie deja de trabajar — solo entiende menos.
           .act  instruccion. Dice que hacer o que escribir. Si la
                 borras, alguien no sabe que hacer.

           La flecha dorada le hace un alto a la lectura: obliga a fijar
           la vista donde hay una tarea. No compite con el dorado de
           señal porque aquel siempre cae sobre un DATO —una fecha, un
           contador— y este sobre texto explicativo.

           Dos clases y no tres: mas de dos y nadie las distingue. */
        .ver{position:absolute;top:12px;right:24px;font-family:'DM Mono','Courier New',monospace;
          font-size:var(--fs-1);color:var(--t3);letter-spacing:.5px;pointer-events:none;}
        @media (max-width:900px){
          .ver{position:static;order:99;width:100%;text-align:left;
            margin-top:2px;color:var(--t4);}
        }
        .sys{font-size:var(--fs-1);color:var(--t4);line-height:1.55;}
        .act{font-size:var(--fs-2);color:var(--t3);line-height:1.6;font-style:italic;}
        .act::before{content:"→";color:#F5A623;font-style:normal;
          margin-right:6px;font-weight:500;}
        *{box-sizing:border-box;margin:0;padding:0;}
        /* De 4px a 10. Cuatro pixeles es imposible de agarrar: al
           arrastrar la fila de pestanas el cursor se sale de la barra y el
           clic cae en otra cosa. Y el pulgar va SIEMPRE visible, no solo al
           pasar el raton: con cinco personas entrando esta semana, una
           barra que hay que encontrar es una barra que no se usa. */
        /* El modal del archivo en el telefono. Sin esto el encabezado y el
           pie se comian el 85% de la pantalla y al contenido —lo unico que
           uno fue a ver— le quedaba una franja.
           No es una pantalla aparte: es la misma, mostrada distinto. Dos
           pantallas se desfasan, y esta semana ya paso tres veces. */
        .dm-strip{display:none;}
        .dm-acc{display:none;}
        @media (max-width:900px){
          .dm-head{padding:10px 14px 8px !important;gap:8px !important;}
          .dm-head .dm-name{font-size:var(--fs-5) !important;line-height:1.15;}
          .dm-facts{display:none !important;}
          .dm-strip{display:block;margin-top:5px;font-size:var(--fs-2);
            color:var(--t2);font-family:"DM Mono";}
          .dm-tabs{display:flex !important;overflow-x:auto;
            scrollbar-width:none;-webkit-overflow-scrolling:touch;}
          .dm-tabs::-webkit-scrollbar{display:none;}
          .dm-tab{flex:0 0 auto !important;padding:11px 15px !important;
            border-right:1px solid #21262D;}
          .dm-acc{display:inline-block;}
          .dm-foot{padding:9px 14px !important;}
          .dm-foot > *{display:none !important;}
          .dm-foot > .dm-save,
          .dm-foot > .dm-acc{display:inline-block !important;}
          .dm-foot.dm-foot-open > *{display:inline-block !important;}
          /* Borrar es la unica accion del pie que no se deshace. En un
             telefono que se usa para mirar, y con el pulgar, no tiene por
             que estar al alcance. Se queda en la computadora. */
          .dm-foot.dm-foot-open > .dm-del{display:none !important;}
          .dm-acc{order:2;}
        }
        /* Sin esto los hijos de la reticula no pueden encogerse por debajo
           de su contenido y empujan el ancho: aparecia scroll horizontal y
           la columna editable de contingencias quedaba fuera de pantalla. */
        .dm-body > *{min-width:0;}
        .dm-body input,.dm-body select{max-width:100%;}
        ::-webkit-scrollbar{width:10px;height:10px;}
        ::-webkit-scrollbar-track{background:#161B22;border-radius:5px;}
        ::-webkit-scrollbar-thumb{background:#484F58;border-radius:5px;
          border:2px solid #161B22;}
        ::-webkit-scrollbar-thumb:hover{background:#6E7681;}
        ::-webkit-scrollbar-thumb:active{background:#F5A623;}
        /* Firefox no usa las reglas de arriba. */
        *{scrollbar-width:thin;scrollbar-color:#484F58 #161B22;}
        .hov{transition:all .15s;cursor:pointer;border:none;}
        .hov:hover{opacity:.85;transform:translateY(-1px);}
        .card{transition:transform .15s,box-shadow .15s;cursor:pointer;}
        .card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.5)!important;}
        input,select,textarea{outline:none;}
        input::placeholder,textarea::placeholder{color:var(--t3);}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .2s ease;}
        tr.row:hover td{background:rgba(255,255,255,.03)!important;}
        /* Con cinco pestañas ya cabe todo: en la computadora la fila se
           acomoda en dos líneas si hace falta, sin barra de lado. En el
           teléfono sigue deslizándose de lado como antes. */
        @media (max-width:900px){
          .tabbar{flex-wrap:nowrap !important;overflow-x:auto;overscroll-behavior-x:contain;}
        }
        .hdr-ico{display:none;}
        /* CELULAR · la barra de arriba. Ocupaba media pantalla: cada bloque
           caía en su propia línea y el quinto número se salía por la
           derecha. Aquí queda en tres filas cortas: marca, números en una
           rejilla de cinco, y búsqueda con las acciones. */
        @media (max-width:640px){
          .hdr{padding:10px 12px !important;gap:8px 8px !important;}
          .hdr-titulo{font-size:var(--fs-7) !important;}
          .hdr-powered{display:none;}
          .ver{position:absolute !important;top:12px;right:12px;width:auto !important;margin:0 !important;}
          .hdr-stats{order:2;width:100%;margin-left:0 !important;gap:4px !important;
            display:grid !important;grid-template-columns:repeat(5,minmax(0,1fr));}
          .hdr-stats > div{padding:0 !important;min-width:0;}
          .hdr-stats > div > div:first-child{font-size:var(--fs-6) !important;}
          .hdr-stats > div > div:last-child{letter-spacing:0 !important;font-size:10.5px !important;
            line-height:1.2;overflow-wrap:anywhere;}
          .hdr-acts{order:3;width:100%;margin-left:0 !important;gap:6px !important;}
          .hdr-buscar{flex:1 1 130px;min-width:0;width:auto !important;}
          .hdr-acts button{font-size:var(--fs-2) !important;}
          .hdr-acts > button{padding:8px 9px !important;}
          .hdr-user > div:first-child{display:none !important;}
          .hdr-lbl{display:none;}
          .hdr-ico{display:inline;}
          .hdr-quien{display:none !important;}
          .hdr-user{margin-left:auto !important;padding-left:6px !important;border-left:none !important;}
        }
        /* CELULAR · tablas. Con nueve columnas en 390px cada celda quedaba
           de dos letras de ancho y el nombre partido en cuatro líneas. Ahora
           la tabla se desliza de lado dentro de su caja —la página no— y el
           nombre del cliente se queda fijo a la izquierda para no perder de
           quién es cada renglón. */
        @media (max-width:640px){
          table{display:block;overflow-x:auto;overscroll-behavior-x:contain;
            -webkit-overflow-scrolling:touch;max-width:100%;font-size:var(--fs-3) !important;}
          th{white-space:nowrap;padding:8px 10px !important;letter-spacing:.3px !important;}
          td{padding:9px 10px !important;min-width:72px;}
          tbody td:first-child{position:sticky;left:0;z-index:1;min-width:120px;background:inherit;
            box-shadow:1px 0 0 var(--bd);}
          thead th:first-child{position:sticky;left:0;z-index:2;background:var(--s1);}
          .kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:8px !important;}
          .kpi-grid > div > div:first-child{white-space:normal !important;line-height:1.25;}
          .barras > div:nth-child(odd) .mes-lbl{visibility:hidden;}
          .barras{gap:3px !important;}
          .mes-lbl{font-size:10px !important;letter-spacing:0 !important;}
          tbody tr{background-color:var(--bg);}
          /* La ventana del archivo: una columna, la ✕ fija en su esquina y
             la etapa del encabezado fuera —el selector de abajo ya la dice—. */
          .dm-head{padding-right:46px !important;}
          .dm-x{position:absolute;top:8px;right:10px;padding:6px !important;}
          .dm-hright{width:100%;gap:14px !important;align-items:center !important;}
          .dm-hright > div{text-align:left !important;}
          .dm-hstage{display:none;}
          .dm-lang{margin-left:auto;}
          .dm-etapa{padding:8px 12px !important;flex-wrap:wrap;justify-content:flex-start !important;gap:6px 10px !important;}
          .dm-etapa select{min-width:0 !important;flex:1 1 100%;}
          .dm-body{grid-template-columns:minmax(0,1fr) !important;padding:12px !important;}
          .proc-grid{grid-template-columns:minmax(0,1fr) !important;}
          .proc-cola{border-right:none !important;max-height:46vh !important;
            border-bottom:1px solid var(--bd);}
        }
        /* MENÚ DESPLEGABLE (Herramientas y Más) */
        .menu-panel{position:fixed;z-index:60;flex-direction:column;gap:2px;
          min-width:230px;max-width:calc(100vw - 16px);padding:6px;
          background:var(--s1);border:1px solid var(--bd);border-radius:8px;
          box-shadow:0 12px 32px rgba(0,0,0,.55);}
        .mi{display:flex;align-items:center;gap:10px;width:100%;
          background:transparent;border:none;border-radius:6px;padding:9px 10px;
          color:var(--t2);text-align:left;font-family:var(--ff-mono);
          font-size:var(--fs-3);cursor:pointer;white-space:nowrap;}
        .mi:hover:not(div){background:var(--s2);color:var(--t1);}
        .mi:disabled{opacity:.5;}
        .mi-sep{height:1px;background:var(--bd);margin:4px 2px;}
        .mas-alerta{display:inline-block;margin-left:7px;padding:0 6px;
          border-radius:9px;background:var(--bad);color:var(--bg);
          font-size:var(--fs-1);line-height:1.5;}
        /* EX-MIEMBRO: la tarjeta sigue en producción porque su volumen
           cuenta en el año, pero apagada para que nadie la lea como activa. */
        .ex-miembro{opacity:.6;filter:grayscale(.55);}
        .ex-tag{display:inline-block;margin-left:8px;padding:0 6px;line-height:1.35;
          border:1px solid var(--t4);border-radius:4px;color:var(--t3);
          font-family:var(--ff-mono);font-size:var(--fs-1);letter-spacing:1px;
          vertical-align:middle;}
      `}</style>

      {/* HEADER */}
      <div className="hdr" style={{background:"var(--s1)",borderBottom:"1px solid var(--s2)",padding:"14px 24px",
        display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",position:"relative"}}>
        {/* LA VERSIÓN, sola en su esquina. Debajo de la marca quedaba en un
            gris casi negro y no se veía; junto al nombre habría cargado más
            una barra que ya tiene demasiado. Aquí está siempre a la vista,
            sin scroll, y no compite con nada: cuando alguien llame diciendo
            que algo no le sale, la primera pregunta tiene respuesta. */}
        <div className="ver">v{APP_VERSION}</div>
        {/* MARCA — "MORTGAGE BY DELVALLE" era de la época de PRMG y se
            quedó sin cambiar. Tres escalones, no dos: qué es, de quién, y
            bajo qué NMLS.

            La marca va en IBM Plex Sans, NO en Syne. PIPELINE ya lleva el
            peso del encabezado; si la marca compite en la misma familia y
            el mismo grosor, los dos pierden y el bloque se vuelve una
            mancha. Syne queda para títulos y números, que es lo que lo hace
            reconocible cuando aparece. */}
        <div className="hdr-marca" style={{minWidth:0}}>
          <div className="hdr-titulo" style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-9)",
            letterSpacing:"-0.5px",lineHeight:1.05}}>PIPELINE</div>
          <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",letterSpacing:".3px",
            marginTop:3,whiteSpace:"nowrap"}}>{TX("branchLending")}</div>
          <div className="hdr-powered" style={{fontSize:"var(--fs-1)",color:"var(--t4)",letterSpacing:".3px",
            marginTop:1,whiteSpace:"nowrap"}}>
            {TX("branchPowered")}
          </div>
        </div>
        <div className="hdr-stats" style={{display:"flex",gap:20,marginLeft:8}}>
          {[["ACTIVE",active.length,"#4A90D9"],["CLOSED",closed.length,"#06D6A0"],["CRITICAL",crit,"#E85D75"],["VOLUME",`$${(vol/1e6).toFixed(1)}M`,"#F5A623"]].map(([l,v,c])=>(
            <div key={l} className={l==="CRITICAL"&&crit>0?"hov":undefined}
              onClick={l==="CRITICAL"&&crit>0?()=>{
                setView("active"); setActivePhase(null); setCritOnly(x=>!x);
              }:undefined}
              title={l==="CRITICAL"&&crit>0?TX("critFilterHint"):undefined}
              style={{textAlign:"center",
                cursor:l==="CRITICAL"&&crit>0?"pointer":"default",
                borderBottom:l==="CRITICAL"&&critOnly?"2px solid var(--bad)":"2px solid transparent",
                paddingBottom:2}}>
              <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",color:c}}>{v}</div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("mvStat_"+l)}</div>
            </div>
          ))}
          {/* Always visible. A hidden list never gets opened; a number up here does. */}
          <div className="hov" onClick={()=>{setView("review");setActivePhase(null);}}
            title={TX("reviewSub")}
            style={{textAlign:"center",cursor:"pointer",padding:"0 10px",borderLeft:"1px solid var(--bd)"}}>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",color:dueReview.length>0?"var(--bad)":"var(--t3)"}}>
              {dueReview.length}
            </div>
            <div style={{fontSize:"var(--fs-1)",color:dueReview.length>0?"var(--bad)":"var(--t3)",letterSpacing:"1px"}}>{TX("dueReview")}</div>
          </div>
        </div>
        <div className="hdr-acts" style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {saveStatus !== "idle" && (
            <div style={{
              fontSize:"var(--fs-2)", letterSpacing:"1px", padding:"4px 10px", borderRadius:12,
              background: saveStatus==="saving" ? "var(--s2)" : saveStatus==="saved" ? "rgba(6,214,160,.1)" : "rgba(232,93,117,.15)",
              color: saveStatus==="saving" ? "var(--t2)" : saveStatus==="saved" ? "var(--ok)" : "var(--bad)",
              border: "1px solid " + (saveStatus==="saving" ? "var(--bd)" : saveStatus==="saved" ? "var(--ok)" : "var(--bad)"),
              fontFamily:"var(--ff-mono)"
            }}>
              {saveStatus==="saving" ? TX("mvSaving") : saveStatus==="saved" ? TX("mvSaved") : TX("mvSaveFailed")}
            </div>
          )}
          <input className="hdr-buscar" placeholder={TX("phSearch")} value={search} onChange={e=>setSearch(e.target.value)}
            style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:6,padding:"7px 12px",color:"var(--t1)",fontSize:"var(--fs-4)",width:170}}/>
          <button className="hov hdr-nuevo" onClick={()=>setShowAdd(true)}
            style={{background:"var(--gold)",color:"var(--bg)",borderRadius:6,padding:"8px 16px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500}}>
            + {TX("mvNewFile")}
          </button>
          {/* Las nueve fechas son de TINA: registro, divulgaciones,
              sometimiento. Ella las tiene en Arive. Un LO no sabe cuándo
              Tina registró, y Martha recibe el archivo ya registrado. */}
          {(()=>{
            const vivos=excludeTraining(files);
            const mios=isAdmin
              ? backfillCount(vivos, null, BF_ERA_PENDING)
              : backfillCount(vivos, profile?.name, BF_ERA_PENDING);
            if(mios<1) return null;
            return (
            <button className="hov" onClick={()=>setShowBackfill(true)}
              title={TX("bfLead")}
              style={{background:"rgba(245,166,35,.1)",color:"var(--gold)",borderRadius:6,
                padding:"8px 12px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
                border:"1px solid #F5A62366",cursor:"pointer"}}>
              {TX("bfBtn")} {mios}
            </button>);
          })()}
          {/* HERRAMIENTAS. Lo de una vez por semana, fuera de la barra. */}
          <Menu label={<>⚙<span className="hdr-lbl"> {TX("mvTools")}</span></>} align="right" title={TX("mvToolsHint")}
            style={{background:"var(--s2)",color:"var(--t2)",borderRadius:6,padding:"8px 12px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:"1px solid var(--bd)",cursor:"pointer",whiteSpace:"nowrap"}}>
            <button data-cierra className="mi" onClick={exportBackup} title={TX("mvBackupHint")}>
              ↓ {TX("backup")}
            </button>
            {isAdmin && (
              <label data-cierra className="mi" title={TX("backupHint")}>
                ↑ {TX("restore")}
                <input type="file" accept="application/json,.json" onChange={importBackup} style={{display:"none"}}/>
              </label>
            )}
            {isAdmin && (
              <button data-cierra className="mi" onClick={exportMarthaSheet} disabled={marthaBusy}
                title={TX("marthaHint")} style={{cursor:marthaBusy?"wait":"pointer"}}>
                {marthaBusy ? TX("marthaBusy") : TX("marthaBtn")}
              </button>
            )}
            <button data-cierra className="mi" onClick={startTraining} style={{color:"var(--gold)"}}>
              ▶ {TX("training")}
            </button>
            <div className="mi-sep"/>
            {/* TAMAÑO DEL TEXTO. Sin data-cierra: se pulsa varias veces
                seguidas mirando cómo cambia la pantalla. */}
            <div className="mi" style={{cursor:"default",justifyContent:"space-between"}}>
              <span>{TX("textSize")}</span>
              <span style={{display:"flex",alignItems:"center",border:"1px solid var(--bd)",borderRadius:6,overflow:"hidden"}}>
                {[["-",-.05],["+",.05]].map(([sig,paso])=>(
                  <button key={sig} className="hov"
                    onClick={()=>setEscala(v=>Math.min(1.4,Math.max(.9,Math.round((v+paso)*100)/100)))}
                    style={{background:"transparent",color:"var(--t2)",border:"none",
                      padding:"5px 9px",fontSize:sig==="+"?"var(--fs-5)":"var(--fs-2)",
                      fontFamily:"var(--ff-mono)",cursor:"pointer",lineHeight:1}}>A{sig}</button>
                ))}
                <button className="hov" onClick={()=>setEscala(1)} title={TX("textSizeReset")}
                  style={{background:"transparent",color:escala!==1?"var(--gold)":"var(--t3)",border:"none",borderLeft:"1px solid var(--bd)",
                    padding:"5px 8px",fontSize:"var(--fs-1)",fontFamily:"var(--ff-mono)",cursor:"pointer",minWidth:44}}>
                  {Math.round(escala*100)}%
                </button>
              </span>
            </div>
          </Menu>

          <div style={{display:"flex",border:"1px solid var(--bd)",borderRadius:6,overflow:"hidden",marginRight:2}}>
            {["es","en"].map(l=>(
              <button key={l} className="hov" onClick={()=>setLang(l)}
                style={{background:lang===l?"var(--gold)":"transparent",color:lang===l?"var(--bg)":"var(--t2)",
                  border:"none",padding:"6px 10px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                {l.toUpperCase()}
              </button>))}
          </div>
          <button className="hov" onClick={()=>setShowHelp(true)}
            title={TX("mvHelpHint")}
            aria-label={TX("help")}
            style={{background:"transparent",color:"var(--t2)",borderRadius:6,padding:"8px 11px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:"1px solid var(--bd)",cursor:"pointer"}}>
            ?
          </button>

          <div className="hdr-user" style={{display:"flex",alignItems:"center",gap:8,paddingLeft:12,marginLeft:4,borderLeft:"1px solid var(--bd)"}}>
            <div title={profile.name} style={{
              width:32, height:32, borderRadius:"50%",
              background: profile.color, color:"var(--bg)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"var(--ff-num)", fontWeight:800, fontSize:"var(--fs-3)"
            }}>
              {profile.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div className="hdr-quien" style={{display:"flex",flexDirection:"column",lineHeight:1.2}}>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"var(--ff-title)",fontWeight:700}}>{profile.short}</span>
              <span style={{fontSize:"var(--fs-1)",color:profile.color,letterSpacing:"1px",textTransform:"uppercase"}}>{profile.role}</span>
            </div>
            <button className="hov"
              onClick={()=>{
                if(confirm(TX("mvSignOutAsk"))) signOut(auth);
              }}
              title={TX("mvSignOutHint")} aria-label={TX("signOut")}
              style={{background:"transparent",color:"var(--t3)",borderRadius:6,padding:"6px 8px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-2)",border:"1px solid var(--bd)",cursor:"pointer"}}>
              <span className="hdr-lbl">{TX("signOut")}</span><span className="hdr-ico" aria-hidden="true">↪</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB BAR — added REFERRED OUT and INBOUND filters */}
      <div onWheel={ruedaHorizontal}
        className="tabbar"
        style={{background:"var(--s1)",borderBottom:"1px solid var(--s2)",padding:"10px 24px 12px",
          display:"flex",gap:8,rowGap:8,alignItems:"center",flexWrap:"wrap"}}>
        {/* PESTAÑAS. Eran nueve en fila y PRODUCCIÓN quedaba cortada a la
            derecha. Se quedan a la vista las cuatro de todos los días; las
            listas de consulta van en MÁS. Cuando estás en una de ellas, MÁS
            toma su nombre y su color: siempre se ve dónde estás. */}
        {(()=>{
          const tabStyle=(on,col)=>({background:on?col:"var(--s2)",color:on?"var(--bg)":col,borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",fontWeight:500,whiteSpace:"nowrap",border:"none",cursor:"pointer"});
          const ir=v=>{setView(v);setActivePhase(null);};
          const principales=[
            [TX("activePipeline")+" · "+active.length,"active","var(--blue)"],
            [TX("closedFiles")+" · "+closed.length,"closed","var(--ok)"],
            ...((isAdmin||isAssistant)?[[TX("processingTab"),"processing","var(--gold)"]]:[]),
            ["📊 "+TX("production"),"production","var(--purple)"],
          ];
          const mas=[
            ["🔀 "+TX("referredOut"),referredOut.length,"referred","var(--violet)"],
            ["🤝 "+TX("inbound"),inbound.length,"inbound","var(--yellow)"],
            ["⏸ "+TX("preparation"),prep.length,"prep","var(--mint)"],
            ["🔔 "+TX("dueReview"),dueReview.length,"review",dueReview.length>0?"var(--bad)":"var(--t3)"],
            ["🗄 "+TX("archived"),archived.length,"archived","var(--t2)"],
          ];
          const enMas=mas.find(m=>m[2]===view);
          return <>
            {principales.map(([l,v,col])=>(
              <button key={v} className="hov" onClick={()=>ir(v)} style={tabStyle(view===v,col)}>{l}</button>
            ))}
            <Menu label={enMas?`${enMas[0]} · ${enMas[1]}`:<>{TX("mvMore")}{dueReview.length>0&&<span className="mas-alerta">{dueReview.length}</span>}</>}
              title={TX("mvMoreHint")}
              style={tabStyle(!!enMas,enMas?enMas[3]:"var(--t2)")}>
              {mas.map(([l,c,v,col])=>(
                <button key={v} data-cierra className="mi" onClick={()=>ir(v)}
                  style={view===v?{background:"var(--s2)",color:"var(--t1)"}:undefined}>
                  <span style={{flex:1,color:col}}>{l}</span>
                  <span style={{color:c>0&&v==="review"?"var(--bad)":"var(--t3)"}}>{c}</span>
                </button>
              ))}
            </Menu>
          </>;
        })()}
        {view==="active"&&<>
          <div style={{width:1,height:20,background:"var(--bd)",margin:"0 4px"}}/>
          <button className="hov" onClick={()=>setActivePhase(null)}
            style={{background:!activePhase?"var(--t1)":"transparent",color:!activePhase?"var(--bg)":"var(--t2)",borderRadius:20,padding:"4px 12px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",border:"1px solid var(--bd)",whiteSpace:"nowrap"}}>
            {TX("mvAll")} · {active.length}
          </button>
          {phaseCounts.map(p=>(
            <button key={p.id} className="hov" onClick={()=>setActivePhase(activePhase===p.id?null:p.id)}
              style={{background:activePhase===p.id?p.color:"transparent",color:activePhase===p.id?"var(--bg)":p.color,borderRadius:20,padding:"4px 12px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",border:`1px solid ${p.color}`,whiteSpace:"nowrap"}}>
              {p.short} · {p.count}
            </button>
          ))}
        </>}
        <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:"var(--fs-2)",color:"var(--t3)",whiteSpace:"nowrap"}}>
          <span style={{color:"var(--bad)"}}>● {TX("mvLegCrit")}</span>
          <span style={{color:"var(--gold)"}}>● {TX("mvLegWarn")}</span>
          <span style={{color:"var(--t3)"}}>● {TX("mvLegStale")}</span>
        </div>
      </div>

      {versionVieja&&(
        <div style={{margin:"0 24px 10px",background:"rgba(245,166,35,.12)",
          border:"1px solid var(--gold)",borderRadius:8,padding:"11px 14px",
          display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:"var(--fs-3)",color:"var(--gold)",lineHeight:1.55,flex:1,minWidth:220}}>
            {TX("newVersion")}
          </span>
          <button className="hov" onClick={recargarDeVerdad}
            style={{background:"var(--gold)",color:"var(--bg)",borderRadius:6,padding:"8px 16px",
              fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",
              cursor:"pointer",whiteSpace:"nowrap"}}>
            {TX("newVersionBtn")}
          </button>
        </div>
      )}

      {migrado!==null&&(
        <div style={{margin:"0 24px 10px",background:"rgba(126,200,164,.1)",
          border:"1px solid var(--mint)",borderRadius:8,padding:"11px 14px",
          fontSize:"var(--fs-3)",color:"var(--mint)",lineHeight:1.6}}>
          {TX("migrated",{n:migrado})}
        </div>
      )}

      {idsBackfilled>0&&(
        <div style={{margin:"0 24px 10px",background:"rgba(74,144,217,.1)",border:"1px solid var(--blue)",
          borderRadius:8,padding:"10px 14px",fontSize:"var(--fs-3)",color:"var(--blue)",lineHeight:1.6}}>
          {TX("idsBackfilledMsg",{n:idsBackfilled})}
        </div>
      )}

      {sizeAlert&&(
        <div style={{margin:"0 24px",background:"rgba(232,93,117,.1)",border:"1px solid var(--bad)",
          borderRadius:8,padding:"11px 14px",fontSize:"var(--fs-3)",color:"var(--bad)",lineHeight:1.6}}>
          {sizeAlert > 1000000
            ? TX("docTooBig",{mb:(sizeAlert/1048576).toFixed(2)})
            : TX("docNearLimit",{mb:(sizeAlert/1048576).toFixed(2)})}
        </div>
      )}

      {/* CONTENT */}
      <div style={{padding:"20px 24px"}}>

        {view==="processing"&&(isAdmin||isAssistant)&&<ProcessingView
          files={files.filter(f=>!isTraining(f)||f.id===myTraining)} profile={profile} lang={lang} onSetLang={setLang}
          onSaveFile={(id,next)=>updateFile(id,next)}
          onOpenFull={f=>setDetail(f)}
          irA={irA&&irA.vista==="processing"?irA:null}
        />}

        {/* Produccion, scorecard, mezcla y payroll no cuentan entrenamiento:
            un archivo falso en las 100 del ano es peor que no entrenar. */}
        {view==="production"&&<Suspense fallback={<div className="sys" style={{padding:40,textAlign:"center"}}>{TX("loadingScreen")}</div>}><ProductionDashboard
          profile={profile}
          files={excludeTraining(files)}
          closed={excludeTraining(closed)}
          active={excludeTraining(active)}
          referredOut={excludeTraining(referredOut)}
          inbound={excludeTraining(inbound)}
          onOpenFile={setDetail}
          payrollLog={payrollLog}
          dpaDetails={dpaDetails}
          onSaveDpa={(next)=>{
            setDpaDetails(next);
            setDoc(PIPELINE_DOC,{dpaDetails:next},{merge:true}).catch(()=>setSaveStatus("error"));
          }}
          onLogPayroll={(entry)=>setPayrollLog(prev=>[...prev,entry])}
          onDeletePayrollLog={(id)=>setPayrollLog(prev=>prev.filter(x=>x.id!==id))}
          onClosePeriod={(entry, updates)=>{
            // Archivar el request y marcar los archivos son dos cosas que
            // TIENEN que viajar juntas. Como escrituras separadas, la primera
            // dispara el listener con la copia vieja del servidor y revierte
            // la segunda antes de que llegue.
            const wanted = new Set(updates.map(u=>u.id).filter(x=>x!=null));
            const matched = files.filter(f=>wanted.has(f.id)).length;
            if(matched===0) return 0;
            const nextFiles = files.map(f=>{
              const u = updates.find(x=>x.id!=null && x.id===f.id);
              if(!u) return f;
              const {id, ...fields} = u;
              return stampEdit({...f, ...fields}, profile, "edited", {fields:Object.keys(fields)});
            });
            const nextLog = [...payrollLog, entry];
            setFiles(nextFiles);
            setPayrollLog(nextLog);
            // El request va al documento de configuración; los archivos, a
            // su colección. El efecto de arriba se encarga de los segundos.
            setDoc(PIPELINE_DOC, {payrollRequests:nextLog}, {merge:true})
              .catch(()=>setSaveStatus("error"));
            return matched;
          }}
          onBulkUpdate={(updates)=>{
            // Acepta cualquier campo, no solo `lo`. Antes descartaba en silencio
            // todo lo demás, así que un cambio de estado nunca se guardaba.
            // Devuelve cuántos encontró: cero coincidencias es un fallo, no un
            // no-op, y quien llama tiene que poder distinguirlo.
            //
            // El conteo va ANTES y contra `files`. Hacerlo dentro del
            // actualizador de setFiles devolvía siempre cero, porque React no
            // ejecuta esa función en el momento sino al renderizar.
            const wanted = new Set(updates.map(u=>u.id).filter(x=>x!=null));
            const matched = files.filter(f=>wanted.has(f.id)).length;
            setFiles(prev=>prev.map(f=>{
              const u = updates.find(x=>x.id!=null && x.id===f.id);
              if(!u) return f;
              const {id, ...fields} = u;
              if (typeof fields.lo === "string") fields.lo = fields.lo.trim();
              return stampEdit({...f, ...fields}, profile, "edited", {fields:Object.keys(fields)});
            }));
            return matched;
          }}
        /></Suspense>}

        {/* REFERRED OUT TABLE */}
        {view==="referred"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--violet)"}}>🔀 {TX("referredOut")} — {referredOut.length} {TX("mvTotal")}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("mvReferredSub")}</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
            {TX("mvReferredEmpty")}<br/><br/>
            <span style={{fontSize:"var(--fs-3)"}}>{TX("mvReferredHow")}</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"2px solid var(--violet)"}}>
                  {["thBorrower","thLoanType","thAmount","thReferredTo","thReason","thStatus","thFeeEarned"].map(k=>TX(k)).map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>{
                  const ro = f.referredOut || {};
                  const isFunded = ro.status === "Closed (Funded)";
                  const finalAmount = parseInt(ro.finalLoanAmount)||f.loan||0;
                  const feeEarned = isFunded ? Math.round(finalAmount * REFERRAL_FEE_BPS / 10000) : 0;
                  return (
                    <tr key={f.id} className="row" style={{borderBottom:"1px solid var(--s2)",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                      <td style={{padding:"11px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"var(--violet)",fontWeight:500,background:i%2===0?"var(--bg)":"var(--s1)"}}>{fmtLoan(f.loan)}</td>
                      <td style={{padding:"11px 14px",color:"var(--t1)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                        {ro.bankerName||"—"}<br/>
                        <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{ro.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{ro.reason||"—"}</td>
                      <td style={{padding:"11px 14px",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                        <span style={{
                          fontSize:"var(--fs-2)",padding:"3px 7px",borderRadius:4,
                          background: ro.status==="Closed (Funded)" ? "rgba(6,214,160,.15)" :
                                      ro.status==="Fell Through" ? "rgba(232,93,117,.15)" :
                                      ro.status==="Withdrawn by Borrower" ? "rgba(139,148,158,.15)" :
                                      "rgba(245,166,35,.15)",
                          color: ro.status==="Closed (Funded)" ? "var(--ok)" :
                                 ro.status==="Fell Through" ? "var(--bad)" :
                                 ro.status==="Withdrawn by Borrower" ? "var(--t2)" :
                                 "var(--gold)",
                        }}>{ro.status||TX("mvPending")}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:isFunded?"var(--ok)":"var(--t3)",fontWeight:500,background:i%2===0?"var(--bg)":"var(--s1)"}}>
                        {feeEarned > 0 ? `$${feeEarned.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>}

        {/* INBOUND VIEW */}
        {view==="inbound"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--yellow)"}}>🤝 {TX("mvInboundTitle")} — {inbound.length} {TX("mvTotal")}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("mvInboundSub")}</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
            {TX("inboundEmpty")}<br/><br/>
            <span style={{fontSize:"var(--fs-3)"}}>{TX("inboundEmptyHow")}</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"2px solid var(--yellow)"}}>
                  {["thBorrower","thLoanType","thAmount","thReferredBy","thStage","thClosing"].map(k=>TX(k)).map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>{
                  const rb = f.referringBanker || {};
                  return (
                    <tr key={f.id} className="row" style={{borderBottom:"1px solid var(--s2)",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                      <td style={{padding:"11px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"var(--yellow)",fontWeight:500,background:i%2===0?"var(--bg)":"var(--s1)"}}>{fmtLoan(f.loan)}</td>
                      <td style={{padding:"11px 14px",color:"var(--t1)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                        {rb.bankerName||"—"}<br/>
                        <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{rb.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:getPhase(f.stage).color,fontWeight:500,fontSize:"var(--fs-3)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.stage}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.closedAt||f.closing||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>}

        {/* CLOSED TABLE */}
        {view==="closed"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--ok)"}}>{TX("closedFiles")} — {closed.length} {TX("mvTotal")}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("mvClosedSub")}</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>{TX("mvClosedEmpty")}</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"2px solid var(--ok)"}}>
                  {["thBorrower","thType","thLoanAmount","thClosedDate","thNotes",""].map(k=>k?TX(k):"").map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid var(--s2)",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"var(--ok)",fontWeight:500,background:i%2===0?"var(--bg)":"var(--s1)"}}>${f.loan.toLocaleString()}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.closedAt||f.closing}</td>
                    <td style={{padding:"11px 14px",color:"var(--t3)",fontStyle:"italic",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.note||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();reopenFile(f.id);}}
                        style={{background:"var(--s2)",color:"var(--t2)",borderRadius:5,padding:"4px 10px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)"}}>{TX("reopen")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>}

        {/* PREPARATION + DUE REVIEW */}
        {(view==="prep"||view==="review")&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:view==="review"?"var(--bad)":"var(--mint)"}}>
              {view==="review" ? `🔔 ${TX("dueReview")} — ${dueReview.length}` : `⏸ ${TX("preparation")} — ${prep.length}`}
            </span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>
              {view==="review"
                ? TX("reviewHint")
                : TX("prepHint")}
            </span>
          </div>
          {critOnly&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              background:"rgba(232,93,117,.08)",border:"1px solid #E85D7544",borderRadius:8,
              padding:"8px 14px",marginBottom:12}}>
              <span style={{fontSize:"var(--fs-3)",color:"var(--bad)",fontFamily:"var(--ff-mono)"}}>
                ⚑ {TX("critFilterOn",{n:display.length,t:active.length})}
              </span>
              <button className="hov" onClick={()=>setCritOnly(false)}
                style={{background:"transparent",border:"1px solid #E85D7566",borderRadius:6,
                  color:"var(--bad)",padding:"4px 12px",fontFamily:"var(--ff-mono)",
                  fontSize:"var(--fs-2)",cursor:"pointer"}}>
                {TX("critFilterOff")}
              </button>
            </div>
          )}
          {display.length===0?(
            <div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
              {view==="review"
                ? TX("reviewEmpty")
                : <>{TX("prepEmpty")}<br/><br/><span style={{fontSize:"var(--fs-3)"}}>{TX("prepEmptyHow")}</span></>}
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:12}}>
              {display.map(f=>{
                const p=f.prep||{};
                const r=prepReasonById(p.reason);
                const dtr=prepDaysToReview(f);
                const due=prepDue(f);
                const locked=prepLocked(f);
                const age=prepAge(f);
                const edge=locked?"#E85D75":due?"#F5A623":"#21262D";
                return(
                  <div key={f.id} className="card" onClick={()=>setDetail(f)}
                    style={{background:"var(--bg)",border:`1px solid ${edge}`,borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                      <div>
                        <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",lineHeight:1.2}}>{f.borrower}</div>
                        <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{f.type} · {fmtLoan(f.loan)}</div>
                        {f.lo&&<div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:1}}>{f.lo.split(" ")[0]}</div>}
                      </div>
                      {locked
                        ? <span style={{background:"var(--bad)",color:"var(--bg)",borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-1)",fontWeight:500,whiteSpace:"nowrap"}}>{TX("mvDecideNow")}</span>
                        : due && <span style={{background:"var(--gold)",color:"var(--bg)",borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-2)",fontWeight:500}}>{TX("mvDue")}</span>}
                    </div>

                    <div style={{background:"rgba(126,200,164,.07)",border:"1px solid #7EC8A433",borderRadius:6,padding:"7px 9px"}}>
                      <div style={{fontSize:"var(--fs-3)",color:"var(--mint)",fontWeight:500}}>{P(r.label)}</div>
                      <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:3}}>
                        {TX("mvReview")} {p.reviewOn||"—"}
                        {" · "}
                        <span style={{color:due?"var(--bad)":"var(--t3)"}}>
                          {dtr>0?TX("mvInDays",{n:dtr}):dtr===0?TX("mvToday"):TX("mvOverdue",{n:Math.abs(dtr)})}
                        </span>
                      </div>
                    </div>

                    <div style={{fontSize:"var(--fs-2)",color:locked?"var(--bad)":"var(--t3)"}}>
                      {TX("mvInPrep",{n:age})}
                      <span style={{color:"var(--t4)"}}> / {PREP_MAX_DAYS} {TX("mvMax")}</span>
                      {(p.reschedules>0)&&<span style={{color:"var(--t4)"}}> · {TX("mvRescheduled",{n:p.reschedules})}</span>}
                    </div>
                    <div style={{height:3,background:"var(--s2)",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(100,(age/PREP_MAX_DAYS)*100)}%`,background:locked?"var(--bad)":age/PREP_MAX_DAYS>0.75?"var(--gold)":"var(--mint)"}}/>
                    </div>

                    {(p.note||f.note)&&<div style={{fontSize:"var(--fs-2)",color:"var(--t2)",borderTop:"1px solid var(--s2)",paddingTop:6,fontStyle:"italic"}}>{p.note||f.note}</div>}
                    {locked&&<div style={{fontSize:"var(--fs-2)",color:"var(--bad)",lineHeight:1.4}}>
                      {TX("mvPrepLocked",{n:PREP_MAX_DAYS})}
                    </div>}

                    <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();if(confirm(TX("mvBringBack",{n:f.borrower,s:p.prevStage||"Lead Inquiry"})))continueFromPrep(f.id);}}
                        style={{flex:1,background:"rgba(74,144,217,.1)",border:"1px solid var(--blue)",borderRadius:5,color:"var(--blue)",fontSize:"var(--fs-2)",padding:"5px 8px",whiteSpace:"nowrap"}}>
                        ✓ {TX("mvContinue")}
                      </button>
                      <button className="hov" disabled={locked} onClick={e=>{e.stopPropagation();if(!locked)setPrepFor(f);}}
                        title={locked?TX("mvLockedAt",{n:PREP_MAX_DAYS}):TX("mvNewReviewDate")}
                        style={{flex:1,background:locked?"var(--s1)":"rgba(245,166,35,.1)",border:`1px solid ${locked?"var(--s2)":"var(--gold)"}`,borderRadius:5,color:locked?"var(--bd)":"var(--gold)",fontSize:"var(--fs-2)",padding:"5px 8px",whiteSpace:"nowrap",cursor:locked?"not-allowed":"pointer"}}>
                        ↻ {TX("mvReschedule")}
                      </button>
                      <button className="hov" onClick={e=>{e.stopPropagation();setArchiveFor(f);}}
                        style={{background:"rgba(110,118,129,.12)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 10px",whiteSpace:"nowrap"}}>
                        🗄
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>}

        {/* ARCHIVED */}
        {view==="archived"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t2)"}}>🗄 {TX("archived")} — {archived.length}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("mvArchivedSub")}</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>{TX("mvArchivedEmpty")}</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"2px solid var(--bd)"}}>
                  {["thBorrower","thType","thAmount","thLastStage","thReason","thArchived",""].map(k=>k?TX(k):"").map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid var(--s2)",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>${((f.loan||0)/1000).toFixed(0)}K</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{isPrep(f)?(f.prep?.prevStage||TX("mvPreparationWord")):f.stage}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.archiveReason||"—"}</td>
                    <td style={{padding:"11px 14px",color:"var(--t3)",fontSize:"var(--fs-3)",background:i%2===0?"var(--bg)":"var(--s1)"}}>{f.archivedAt||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();restoreFile(f.id);}}
                        style={{background:"var(--s2)",color:"var(--mint)",borderRadius:5,padding:"4px 10px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)"}}>↩ {TX("restore")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>}

        {/* ACTIVE PIPELINE */}
        {view==="active"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
          {PHASES.filter(p=>!activePhase||p.id===activePhase).map(phase=>{
            const pf=display.filter(f=>getPhase(f.stage).id===phase.id);
            if(pf.length===0&&activePhase)return null;
            return(
              <div key={phase.id} className="fi" style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
                <div style={{background:phase.bg,borderBottom:`2px solid ${phase.color}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:phase.color,letterSpacing:"1px"}}>{TX("mvPhase")} {phase.id} — {TX("mvPhaseName_"+phase.id).toUpperCase()}</span>
                  <span style={{background:phase.color,color:"var(--bg)",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{pf.length}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:5,flexWrap:"wrap"}}>
                    {phase.stages.map((s,i)=><span key={i} style={{fontSize:"var(--fs-2)",color:"var(--t3)",background:"var(--bg)",borderRadius:4,padding:"2px 6px"}}>{s}</span>)}
                  </div>
                </div>
                {pf.length===0?(
                  <div style={{padding:"18px",color:"var(--t4)",fontSize:"var(--fs-4)",textAlign:"center"}}>{TX("mvPhaseEmpty")}</div>
                ):(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12,padding:12}}>
                    {pf.map(f=>{
                      const u=urgency(f);
                      const ph=getPhase(f.stage);
                      const si=ph.stages.indexOf(f.stage);
                      const cd=daysTil(f.closing);
                      const uc=u==="critical"?"#E85D75":u==="warning"?"#F5A623":u==="stale"?"var(--t3)":"#21262D";
                      return(
                        <div key={f.id} className="card" onClick={()=>setDetail(f)}
                          style={{background:"var(--bg)",
                            border: isTraining(f) ? "1px dashed var(--gold)" : `1px solid ${uc}`,
                            borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",lineHeight:1.2}}>
                                {f.borrower}
                                {f.isInbound && <span title={TX("mvInboundOne")} style={{marginLeft:6,fontSize:"var(--fs-2)",color:"var(--yellow)"}}>🤝</span>}
                                {isTraining(f) && <span style={{marginLeft:8,fontSize:"var(--fs-1)",fontFamily:"var(--ff-mono)",fontWeight:400,color:"var(--gold)",border:"1px solid var(--gold)",borderRadius:4,padding:"1px 6px",verticalAlign:"middle"}}>{TX("trainBadge")}</span>}
                              </div>
                              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{f.type} · {fmtLoan(f.loan)}</div>
                              {f.lo&&<div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:1}}>{f.lo.split(" ")[0]}{f.referralPartner?` · ${f.referralPartner.split(" ")[0]}`:""}</div>}
                            </div>
                            {/* UN SOLO RELOJ, siempre visible, y el que manda:
                                el COE gana sobre la etapa porque de él depende
                                el depósito. Antes desaparecía cuando el archivo
                                iba bien y dejaba en su lugar un CRITICAL que no
                                explicaba nada — Graciela con 1 de 8 días y el
                                cierre a cuatro. */}
                            {(()=>{const ck=fileClock(f);
                              if(!ck.applies){
                                return u!=="normal"?<span style={{background:uc,color:"var(--bg)",
                                  borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-2)",
                                  fontWeight:500}}>
                                  {u==="critical"?TX("critical"):u==="warning"?TX("mvWarn"):TX("mvStale")}
                                </span>:null;
                              }
                              const c=signalColor(ck.signal);
                              // El reloj tapa la palabra CRITICAL. El punto
                              // avisa que la etapa igual se paso del techo.
                              const etapaRoja = u==="critical" && ck.signal!=="broken";
                              const texto = ck.kind==="coe"
                                ? (ck.days<0?`COE ${Math.abs(ck.days)}d ${TX("pastDue")}`:`COE ${ck.days}d`)
                                : `${ck.days}d / ${ck.ceiling}d${ck.legal?" ⚖":""}`;
                              return <div style={{textAlign:"right",flexShrink:0}}>
                                <span style={{background:c,color:"var(--bg)",borderRadius:4,
                                  padding:"2px 7px",fontSize:"var(--fs-2)",fontWeight:500,
                                  whiteSpace:"nowrap",fontFamily:"var(--ff-mono)"}}>{texto}</span>
                                {etapaRoja&&<span title={TX("stageOverCeiling")}
                                  style={{marginLeft:5,color:"var(--bad)",fontSize:"var(--fs-3)"}}>●</span>}
                                {ck.waitOn&&<div style={{fontSize:"var(--fs-1)",color:"var(--t4)",
                                  marginTop:3,whiteSpace:"nowrap"}}>{P(ck.waitOn)}</div>}
                              </div>;})()}
                          </div>
                          <div style={{display:"flex",gap:3}}>
                            {ph.stages.map((_,i)=><div key={i} style={{height:4,flex:1,borderRadius:2,background:i<=si?ph.color:"var(--t4)"}}/>)}
                          </div>
                          <div style={{fontSize:"var(--fs-3)",color:ph.color,fontWeight:500}}>{f.stage}</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                            <span title={TX("mvFileAge",{n:fileAge(f) ?? "—"})}>
                              {daysInStage(f)===null ? TX("mvInStageNone") : TX("mvInStage",{n:daysInStage(f)})}
                              {fileAge(f)!==null && <span style={{color:"var(--t4)"}}> · {TX("mvTotalDays",{n:fileAge(f)})}</span>}
                            </span>
                            {f.closing&&<span style={{color:cd!==null&&cd<=3?"var(--bad)":cd!==null&&cd<=7?"var(--gold)":"var(--t3)"}}>
                              {cd===0?TX("mvClosingToday"):cd!==null&&cd>0?TX("mvCloseIn",{n:cd}):cd!==null?TX("mvPastDue"):f.closing}
                              {/* El ritmo se lee sin abrir el archivo: de un
                                  vistazo se ve cual va adelantado y cual
                                  arrastrado en todo el tablero. */}
                              {(()=>{const p=filePace(f);
                                if(!p.ready||p.state==="onplan") return null;
                                return <span style={{color:signalColor(p.signal),marginLeft:6}}>
                                  {p.state==="ahead"?"▲":"▼"}{p.days}
                                </span>;})()}
                            </span>}
                          </div>
                          {(()=>{const c=lastCancellation(f);
                            if(!c||f.stage!=="Active Search") return null;
                            return (
                              <div style={{background:"rgba(245,166,35,.07)",
                                border:"1px solid #F5A62333",borderLeft:"2px solid var(--gold)",
                                borderRadius:"0 5px 5px 0",padding:"6px 9px",marginTop:8}}>
                                <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",lineHeight:1.45}}>
                                  {TX("cancelWas",{d:c.at,r:P(cancelReason(c.reasonId))})}
                                </div>
                                {cancelCount(f)>1&&(
                                  <div style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginTop:2}}>
                                    {TX("cancelNth",{n:cancelCount(f)})}
                                  </div>
                                )}
                              </div>
                            );})()}
                          <LenderStrip file={f}/>
                          {(()=>{ const w=worstFinding(f); if(!w) return null;
                            const m=waitingMeta(w.waitingOn), edad=findingAge(w);
                            return (
                              <div style={{background:"rgba(232,93,117,.08)",border:"1px solid #E85D7544",
                                borderLeft:"2px solid var(--bad)",borderRadius:"0 5px 5px 0",
                                padding:"6px 8px",marginTop:7}}>
                                <div style={{fontSize:"var(--fs-2)",color:"var(--bad)",lineHeight:1.4,
                                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                                  ⚑ {w.text}
                                </div>
                                <div style={{fontSize:"var(--fs-1)",color:"var(--t2)",marginTop:2}}>
                                  {P(m)}{edad!==null?" · "+TX("findingDaysOpen",{n:edad}):""}
                                  {openFindings(f).length>1?" · "+TX("nMore",{n:openFindings(f).length-1}):""}
                                </div>
                              </div>
                            );})()}
                          <ContingencyStrip file={f}/>
                          {(()=>{const n=latestNote(f); if(!n) return null; const c=noteCount(f);
                            return (
                              <div style={{borderTop:"1px solid var(--s2)",paddingTop:6}}>
                                <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontStyle:"italic",lineHeight:1.45,
                                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                                  {n.text}
                                </div>
                                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>
                                  {n.legacy
                                    ? TX("mvLegacyNote")
                                    : `${timeAgo(n.at)}${n.by?` · ${n.by.split(" ")[0]}`:""}`}
                                  {c>1?" · "+TX("nMore",{n:c-1}):""}
                                </div>
                              </div>
                            );})()}
                          {f.lastEditedBy&&!latestNote(f)&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"0.5px",borderTop:"1px solid var(--s2)",paddingTop:6}}>
                            Edited by {f.lastEditedBy.name?.split(" ")[0]||"?"} · {timeAgo(f.lastEditedAt)}
                          </div>}
                          {(f.phone || f.email) && (
                            <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                              {f.phone && (
                                <a href={`tel:${f.phone.replace(/[^\d+]/g,"")}`} onClick={e=>e.stopPropagation()}
                                  title={TX("mvCall",{n:f.phone})}
                                  style={{background:"rgba(74,144,217,.08)",border:"1px solid #4A90D944",borderRadius:4,padding:"3px 7px",color:"var(--blue)",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                                  📱 {f.phone}
                                </a>
                              )}
                              {f.email && (
                                <a href={`mailto:${f.email}`} onClick={e=>e.stopPropagation()}
                                  title={TX("mvEmail",{n:f.email})}
                                  style={{background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",borderRadius:4,padding:"3px 7px",color:"var(--purple)",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                                  ✉
                                </a>
                              )}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6,marginTop:2}}>
                            <button className="hov" onClick={e=>{e.stopPropagation();advance(f.id);}}
                              style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid var(--s2)",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 0"}}>
                              {TX("advance")} →
                            </button>
                            <button className="hov" onClick={e=>{e.stopPropagation();
                              const ask = isTraining(f)
                                ? TX("trainCloseAsk",{n:f.borrower})
                                : TX("closeAsk",{n:f.borrower});
                              if(!window.confirm(ask)) return;
                              const d=window.prompt(TX("closeDateAsk"), f.closing||today());
                              if(d===null) return;
                              if(!okDate(d)){ window.alert(TX("closeDateBad")); return; }
                              closeFile(f.id,d);}}
                              style={{background:"rgba(6,214,160,.1)",border:"1px solid var(--ok)",borderRadius:5,color:"var(--ok)",fontSize:"var(--fs-2)",padding:"5px 10px"}}>
                              {TX("close")} ✓
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>}
      </div>

      {detail&&<DetailModal file={detail} profile={profile} allFiles={files} L={L} lang={lang} onSetLang={setLang}
        abrirEn={detailTab} irA={irA&&irA.vista==="detail"&&irA.id===detail.id?irA:null}
        onClose={()=>{setDetail(null);setDetailTab(null);setIrA(null);}}
        onSave={p=>{updateFile(detail.id,p);setDetail(f=>({...f,...p}));}}
        onStagePick={next=>{
          const f0=files.find(x=>x.id===detail.id); if(!f0) return true;
          const iCur=ALL_STAGES.findIndex(x=>x.stage===f0.stage);
          const iNew=ALL_STAGES.findIndex(x=>x.stage===next);
          if(iCur<0||iNew<0||iNew<=iCur) return true; // atras o lateral: pasa
          const g=stageGate(f0);
          if(g.blocked||g.soft.length){
            setGateBlock({id:detail.id, gate:g, borrower:f0.borrower, jumpTo:next});
            return false;
          }
          return true;
        }}
        onDelete={()=>deleteFile(detail.id)}
        onAdvance={()=>{
          // La pantalla solo se mueve si el archivo se movio. Antes eran dos
          // acciones sueltas y la puerta frenaba una sola: el archivo se
          // quedaba y el modal mostraba la etapa siguiente.
          if(!advance(detail.id)) return;
          setDetail(f=>{const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);const n=ALL_STAGES[i+1];return n?{...f,stage:n.stage,daysInStage:0}:f;});
        }}
        onCloseFile={d=>closeFile(detail.id,d)}
        onReopen={()=>reopenFile(detail.id)}
        onPrep={()=>setPrepFor(detail)}
        onArchive={()=>setArchiveFor(detail)}
        onRestore={()=>restoreFile(detail.id)}
        onContinuePrep={()=>continueFromPrep(detail.id)}
        isClosed={detail.stage===CLOSED_STAGE}
      />}
      {gateBlock&&(()=>{ const g=gateBlock.gate; const dur=g.hard, sof=g.soft;
        // ARREGLAR AHORA. Un solo camino para las seis puertas: el destino
        // ya viene resuelto de `gateFix` contra el archivo y el rol.
        const irAlFix=(id,fix)=>{
          const f0=files.find(x=>x.id===id); if(!f0) return;
          setGateBlock(null);
          const destino={n:Date.now(), id, vista:fix.vista, tab:fix.tab, sub:fix.sub, ancla:fix.ancla};
          if(fix.vista==="processing"){
            // El detalle se cierra: en movil taparia la pantalla de destino.
            setDetail(null); setDetailTab(null);
            setView("processing");
          }else{
            // Puede venir del tablero, con el modal cerrado. Abrirlo en la
            // solapa correcta desde el principio evita ver la equivocada.
            setView("active");
            setDetail(f0); setDetailTab(fix.tab);
          }
          setIrA(destino);
        };
        const marcarFalta=()=>{
          const el=document.getElementById("gateReason");
          const av=document.getElementById("gateReasonErr");
          if(el){ el.style.border="1px solid #E85D75"; el.focus(); }
          if(av) av.style.display="block";
        };
        const seguir=razon=>{
          const id=gateBlock.id; const salto=gateBlock.jumpTo; setGateBlock(null);
          // Dos caminos: ADVANCE mueve una etapa; el menu salta a la escogida.
          if(salto){
            const f0=files.find(x=>x.id===id); if(!f0) return;
            const parche=stagePatch(f0, salto);
            updateFile(id, parche);
            setDetail(f=>(f&&f.id===id)?{...f,...parche}:f);
            return;
          }
          if(!advance(id,{reason:razon})) return;
          setDetail(f=>{ if(!f||f.id!==id) return f;
            const i=ALL_STAGES.findIndex(x=>x.stage===f.stage); const n=ALL_STAGES[i+1];
            return n?{...f,stage:n.stage,daysInStage:0}:f; });
        };
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:400,
          display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={()=>setGateBlock(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg)",
            border:`1px solid ${dur.length?"var(--bad)":"var(--gold)"}`,borderRadius:10,
            maxWidth:560,width:"100%",padding:"18px 20px"}}>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-5)",
              color:dur.length?"var(--bad)":"var(--gold)",letterSpacing:"1px",marginBottom:4}}>
              {dur.length?TX("gateTitle"):TX("gateSoftTitle")}
            </div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginBottom:14}}>
              {gateBlock.borrower}{dur.length?" · "+TX("gateSub"):""}
            </div>
            {[...dur,...sof].map(r=>{
              // DONDE se arregla. Depende del archivo y del rol: el 1003 vive
              // en dos pantallas, el registro necesita lender antes, y los
              // fees del CD solo los marca el LO dueño.
              const f0=files.find(x=>x.id===gateBlock.id);
              const fix=f0?gateFix(r.id,f0,profile):null;
              return (
              <div key={r.id} style={{borderLeft:`2px solid ${r.hard?"var(--bad)":"var(--gold)"}`,
                paddingLeft:10,marginBottom:12}}>
                <div style={{fontSize:"var(--fs-4)",color:"var(--t1)",marginBottom:3}}>{P(r)}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",lineHeight:1.5}}>
                  {CURRENT_LANG==="en"?r.en_why:r.es_why}
                </div>
                {/* `espera` es el caso de la tasación antes de la firma: el
                    botón existe pero nace apagado, así que la ruta seria un
                    callejón. Se dice qué falta de verdad, no dónde tocar. */}
                {fix&&fix.espera&&(
                  <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:6,lineHeight:1.5}}>
                    ⚖ {P(fix)}
                  </div>
                )}
                {fix&&fix.puede&&(
                  <button className="hov" onClick={()=>irAlFix(gateBlock.id,fix)}
                    style={{marginTop:8,background:"transparent",border:"1px solid var(--gold)",
                      borderRadius:6,color:"var(--gold)",padding:"6px 14px",fontFamily:"var(--ff-mono)",
                      fontSize:"var(--fs-2)",cursor:"pointer"}}>
                    {TX("gateFixNow")}
                  </button>
                )}
                {fix&&!fix.espera&&(
                  <div style={{marginTop:6,fontSize:"var(--fs-2)",lineHeight:1.5}}>
                    <span style={{color:"var(--t4)",letterSpacing:"1px"}}>{TX("gateWhere")}: </span>
                    <span style={{color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{P(fix)}</span>
                  </div>
                )}
                {fix&&!fix.puede&&fix.quien&&(
                  <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:4,lineHeight:1.5}}>
                    {TX("gateWhoFixes",{q:String(fix.quien).split(" ")[0]})}
                  </div>
                )}
              </div>
            );})}
            {dur.length>0&&!isAdmin&&(
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",fontStyle:"italic",marginTop:10}}>
                {TX("gateAskAdmin")}
              </div>
            )}
            {dur.length>0&&isAdmin&&(
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--s2)"}}>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
                  {TX("gateReason")}
                </div>
                <input id="gateReason" placeholder={TX("gateReasonPh")} autoFocus
                  onInput={()=>{const a=document.getElementById("gateReasonErr");
                    const e2=document.getElementById("gateReason");
                    if(a) a.style.display="none"; if(e2) e2.style.border="1px solid #30363D";}}
                  style={{width:"100%",background:"var(--bg)",border:"1px solid var(--bd)",
                    borderRadius:6,padding:"8px 10px",color:"var(--t1)",
                    fontFamily:"var(--ff-body)",fontSize:"var(--fs-3)"}}/>
                <div id="gateReasonErr" style={{display:"none",fontSize:"var(--fs-2)",
                  color:"var(--bad)",marginTop:6}}>{TX("gateNeedReason")}</div>
              </div>
            )}
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="hov" onClick={()=>setGateBlock(null)}
                style={{background:"transparent",color:"var(--t2)",border:"1px solid var(--bd)",
                  borderRadius:6,padding:"8px 16px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",cursor:"pointer"}}>
                {TX("gateGotIt")}
              </button>
              {dur.length===0&&(
                <button className="hov" onClick={()=>seguir(null)}
                  style={{background:"var(--gold)",color:"var(--bg)",border:"none",borderRadius:6,
                    padding:"8px 16px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",cursor:"pointer"}}>
                  {TX("gateAdvanceAnyway")}
                </button>
              )}
              {dur.length>0&&isAdmin&&(
                <button className="hov" onClick={()=>{
                    const el=document.getElementById("gateReason");
                    const razon=(el?.value||"").trim();
                    if(!razon){ marcarFalta(); return; }
                    seguir(razon);
                  }}
                  style={{background:"var(--bad)",color:"var(--bg)",border:"none",borderRadius:6,
                    padding:"8px 16px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",cursor:"pointer"}}>
                  {TX("gateOverride")}
                </button>
              )}
            </div>
          </div>
        </div>);})()}

      {showAdd&&<AddModal profile={profile} existingFiles={files} training={trainingMode} lang={lang}
        onClose={()=>{setShowAdd(false);setTrainingMode(false);}} onAdd={f=>{
        const stamped = stampEdit(f, profile, "created");
        setFiles(p=>[...p.filter(x=>x.id!==stamped.id), {...stamped, createdBy:{uid:profile.uid,name:profile.name}, createdAt:new Date().toISOString()}]);
        setShowAdd(false); setTrainingMode(false);
      }}/>}
      {prepFor&&<PrepModal file={prepFor} onClose={()=>setPrepFor(null)}
        onConfirm={(payload)=>{sendToPrep(prepFor.id,payload);setPrepFor(null);}}/>}
      {archiveFor&&<ArchiveModal file={archiveFor} onClose={()=>setArchiveFor(null)}
        onConfirm={(reason)=>{archiveFile(archiveFor.id,reason);setArchiveFor(null);}}/>}
      {showHelp&&<HelpModal profile={profile} lang={lang} onSetLang={setLang} onClose={()=>setShowHelp(false)}/>}
      {showBackfill&&<BackfillModal files={excludeTraining(files)} profile={profile} lang={lang}
        soyAdmin={isAdmin}
        onOpenFile={(f,tab)=>{setDetail(f);setDetailTab(tab||null);}}
        onClose={()=>setShowBackfill(false)}
        onApply={(updates)=>{
          // Una sola escritura para todos los archivos: en tandas separadas,
          // el listener de Firestore devuelve la copia vieja del servidor y
          // revierte lo anterior. Es el mismo fallo del cierre de corte.
          const mapa=new Map(updates.map(u=>[u.id,u]));
          const next=files.map(f=>{
            const u=mapa.get(f.id);
            return u ? stampEdit(u.file, profile, "backfilled", {fields:u.fields}) : f;
          });
          // setFiles basta: el guardado por diferencia escribe los nueve.
          setFiles(next);
          return updates.length;
        }}/>}
    </div>
  );
}

// ─── PREP MODAL ───
// The reason picks the default date so nobody leaves it blank; the 30/60/90
// buttons are always there so Jose can override. Without a review date this
// whole feature would just be moving the pile from one place to another.
function PrepModal({file, onClose, onConfirm}){
  const existing = file.prep || {};
  const isReschedule = !!file.prep;
  const [reason,setReason]=useState(existing.reason||"credit");
  const [reviewOn,setReviewOn]=useState("");
  const [note,setNote]=useState(existing.note||"");
  const r = prepReasonById(reason);

  // When the reason changes, propose its default. Duration reasons get a
  // computed date; fixed-date reasons stay blank on purpose — inventing a
  // date for a tax filing would be worse than asking for it.
  useEffect(()=>{
    const rr = prepReasonById(reason);
    setReviewOn(rr.mode==="days" ? addDaysISO(today(), rr.days) : "");
  },[reason]);

  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",padding:"9px 11px",fontSize:"var(--fs-5)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};
  const daysOut = reviewOn ? Math.ceil((new Date(reviewOn+"T00:00:00")-new Date(new Date().toDateString()))/86400000) : null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()}
        style={{background:"var(--s1)",border:"1px solid #7EC8A455",borderRadius:12,width:"100%",maxWidth:430,maxHeight:"calc(100vh - 40px)",overflowY:"auto",padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--mint)"}}>
            {isReschedule?"↻ RESCHEDULE":"⏸ SEND TO PREPARATION"}
          </div>
          <div style={{fontSize:"var(--fs-4)",color:"var(--t2)",marginTop:3}}>{file.borrower}</div>
          {!isReschedule&&<div style={{fontSize:"var(--fs-3)",color:"var(--t3)",marginTop:6,lineHeight:1.5}}>
            Leaves the active board and stops the stage clock. It is not closed and not archived — it comes back on the review date.
          </div>}
        </div>

        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>WHY IS THIS CLIENT WAITING?</div>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={fs}>
            {PREP_REASONS.map(x=><option key={x.id} value={x.id}>{P(x.label)}</option>)}
          </select>
          {r.why&&<div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:6,lineHeight:1.5,fontStyle:"italic"}}>{P(r.why)}</div>}
        </div>

        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            REVIEW ON {r.mode==="date"&&<span style={{color:"var(--gold)"}}>— pick the real date</span>}
          </div>
          <input type="date" value={reviewOn} onChange={e=>setReviewOn(e.target.value)} style={fs}/>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {[30,60,90].map(d=>(
              <button key={d} className="hov" onClick={()=>setReviewOn(addDaysISO(today(),d))}
                style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-3)",padding:"5px 12px",fontFamily:"var(--ff-mono)"}}>
                +{d}d
              </button>
            ))}
            {daysOut!==null&&<span style={{fontSize:"var(--fs-2)",color:daysOut>PREP_MAX_DAYS?"var(--bad)":"var(--t3)",alignSelf:"center",marginLeft:4}}>
              {daysOut}d out{daysOut>PREP_MAX_DAYS?` — past the ${PREP_MAX_DAYS}-day cap`:""}
            </span>}
          </div>
        </div>

        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>WHAT HAS TO HAPPEN BEFORE THEY COME BACK?</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
            placeholder="e.g. collections paid off, 2025 taxes filed, 3 months of statements"
            style={{...fs,resize:"vertical"}}/>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",border:"none"}}>CANCEL</button>
          <button className="hov"
            disabled={!reviewOn}
            onClick={()=>{ if(reviewOn) onConfirm({reason, reviewOn, note}); }}
            style={{flex:2,background:reviewOn?"var(--mint)":"var(--s2)",color:reviewOn?"var(--bg)":"var(--t3)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:reviewOn?"pointer":"not-allowed"}}>
            {reviewOn?(isReschedule?"RESCHEDULE":"SEND TO PREPARATION"):"PICK A REVIEW DATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CONTRATO CANCELADO ───
// Un evento, no ocho ediciones. Inspección mala, tasación baja, no hay
// acuerdo: el contrato muere y el cliente vuelve a buscar casa.
function CancelContractModal({file, lang, onClose, onConfirm}){
  const [motivo,setMotivo]=useState("inspection");
  const [nota,setNota]=useState("");
  const P2=o=>(o&&typeof o==="object")?(o[lang]??o.es??o.en??""):o;
  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"9px 11px",fontSize:"var(--fs-3)",fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};
  const n=cancelCount(file);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:130,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"var(--s1)",
        border:"1px solid #F5A62355",borderRadius:12,width:"100%",maxWidth:520,
        maxHeight:"calc(100vh - 40px)",overflowY:"auto",padding:22,
        display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-6)",color:"var(--gold)"}}>
            {TX("cancelTitle")}
          </div>
          <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:4}}>{file.borrower}</div>
          {n>0&&<div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:3}}>
            {TX("cancelNth",{n:n+1})}</div>}
          <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:9,lineHeight:1.6}}>
            {TX("cancelLead")}
          </div>
        </div>

        <div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t4)",letterSpacing:"1px",marginBottom:5}}>
            {TX("cancelWhy")}
          </div>
          <select value={motivo} onChange={e=>setMotivo(e.target.value)} style={fs2}>
            {CONTRACT_CANCEL_REASONS.map(r=><option key={r.id} value={r.id}>{P2(r)}</option>)}
          </select>
        </div>

        <input value={nota} onChange={e=>setNota(e.target.value)}
          placeholder={TX("cancelNote")} style={fs2}/>

        <div className="sys">{TX("cancelWhat")}</div>
        <div className="act">{TX("cancelWhere")}</div>

        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"11px 0",
              fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:"none",cursor:"pointer"}}>
            {TX("cancel")}
          </button>
          <button className="hov" onClick={()=>onConfirm({reasonId:motivo,notes:nota})}
            style={{flex:2,background:"var(--gold)",color:"var(--bg)",borderRadius:7,padding:"11px 0",
              fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
            {TX("cancelDo")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ARCHIVE MODAL ───
// ─── RELLENO DE ARCHIVOS ANTERIORES ───
// Una sentada, no un archivo a la vez. Los nueve o diez archivos que ya
// existían cuando se construyó el registro y el sello de etapas tienen sus
// fechas en la cabeza de alguien y en Arive, no en el sistema — y en el
// checklist de Barrett salen como renglones en blanco de un archivo que sí
// se registró.
//
// Lo que NO hace: pedir fechas que todavía no han ocurrido. Si el archivo
// está en UW Review no se le pregunta cuándo fondeó. Pedir un dato que aún
// no existe es invitar a inventarlo.
// ─── CARTAS ────────────────────────────────────────────────────────
// Registro, petición y entrega. El sistema no redacta la explicación —
// esa la escribe el cliente— pero sí escribe la petición, que es donde
// de verdad se pierde el tiempo: el cliente no entiende qué le piden.
function LettersPanel({file, lang, who, onSave}){
  const [abierto,setAbierto]=useState(false);
  const [kind,setKind]=useState("gift");
  const [texto,setTexto]=useState("");
  const [desde,setDesde]=useState("borrower");
  const [falta,setFalta]=useState(false);
  const [copiado,setCopiado]=useState(null);
  const T=k=>tr(k,lang);
  const P3=o=>(o&&typeof o==="object")?(o[lang]??o.es??o.en??""):o;
  const abiertas=openLetters(file), recibidas=receivedLetters(file);

  const guardar=()=>{
    if(!texto.trim()){ setFalta(true); return; }
    onSave(addLetter(file,{kind,text:texto,from:desde,by:who}));
    setTexto(""); setFalta(false); setAbierto(false);
  };
  const copiar=l=>{
    const t=letterRequestText(l,lang);
    try{ navigator.clipboard.writeText(t); }catch{ /* sin permiso */ }
    setCopiado(l.id); setTimeout(()=>setCopiado(null),2000);
  };
  const bx={background:"#0D1117",border:`1px solid ${falta?"#E85D75":"#30363D"}`,
    borderRadius:5,color:"var(--t1)",padding:"6px 9px",fontSize:"var(--fs-3)",
    fontFamily:"IBM Plex Sans",width:"100%"};

  return (
    <div style={{marginTop:14,background:"rgba(167,139,250,.05)",
      border:"1px solid #A78BFA44",borderRadius:8,padding:14}}>
      <div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
          color:"var(--violet)",letterSpacing:"1px"}}>{T("ltTitle")}</span>
        <span style={{marginLeft:"auto",fontSize:"var(--fs-2)",color:"var(--t3)"}}>
          {abiertas.length>0?T("findingOpen",{n:abiertas.length}):T("ltNone")}
        </span>
      </div>
      <div className="sys" style={{marginTop:4,marginBottom:10}}>{T("ltLead")}</div>

      {abiertas.map(l=>{
        const est=letterState(l), edad=letterAge(l);
        return (
        <div key={l.id} style={{borderLeft:"2px solid var(--violet)",paddingLeft:10,
          marginBottom:10}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--violet)",marginBottom:2}}>
            {P3(letterKind(l.kind))} · {P3(letterFrom(l.from))}
            {edad!==null?` · ${T("ltDaysOpen",{n:edad})}`:""}
          </div>
          <div style={{fontSize:"var(--fs-4)",color:"var(--t1)",lineHeight:1.5,marginBottom:6}}>
            {l.text}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <button className="hov" onClick={()=>copiar(l)}
              style={{background:"transparent",border:"1px solid #A78BFA66",borderRadius:4,
                color:"var(--violet)",padding:"3px 10px",fontSize:"var(--fs-1)",
                fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
              {copiado===l.id?T("ltCopied"):T("ltCopy")}
            </button>
            {est==="raised"&&(
              <button className="hov" onClick={()=>onSave(stampLetterRequested(file,l.id,who))}
                style={{background:"transparent",border:"1px solid #F5A62366",borderRadius:4,
                  color:"var(--gold)",padding:"3px 10px",fontSize:"var(--fs-1)",
                  fontFamily:"var(--ff-mono)",cursor:"pointer"}}>{T("ltMarkReq")}</button>
            )}
            {est==="requested"&&(
              <span style={{fontSize:"var(--fs-1)",color:"var(--gold)",fontFamily:"var(--ff-mono)"}}>
                {T("ltRequested")} {l.requestedAt}
              </span>
            )}
            <button className="hov" onClick={()=>onSave(stampLetterReceived(file,l.id,who))}
              style={{background:"transparent",border:"1px solid var(--ok)",borderRadius:4,
                color:"var(--ok)",padding:"3px 10px",fontSize:"var(--fs-1)",
                fontFamily:"var(--ff-mono)",cursor:"pointer"}}>{T("ltMarkRec")}</button>
          </div>
        </div>);
      })}

      {abierto?(
        <div style={{marginTop:8,display:"grid",gap:8}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>
            <div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>
                {T("ltKind")}
              </div>
              <select value={kind} onChange={e=>setKind(e.target.value)} style={bx}>
                {Object.keys(LOE_KINDS).map(k=>(
                  <option key={k} value={k}>{P3(LOE_KINDS[k])}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>
                {T("ltFrom")}
              </div>
              <select value={desde} onChange={e=>setDesde(e.target.value)} style={bx}>
                {Object.keys(LETTER_FROM).map(k=>(
                  <option key={k} value={k}>{P3(LETTER_FROM[k])}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>
              {T("ltWhat")}
            </div>
            <input value={texto} placeholder={T("ltWhatPh")} style={bx}
              onChange={e=>{setTexto(e.target.value);setFalta(false);}}/>
            {falta&&<div style={{fontSize:"var(--fs-2)",color:"var(--bad)",marginTop:4}}>
              {T("ltNeedText")}
            </div>}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button className="hov" onClick={guardar}
              style={{background:"var(--violet)",color:"var(--bg)",border:"none",borderRadius:5,
                padding:"6px 16px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",
                cursor:"pointer"}}>{T("ltSave")}</button>
            <button className="hov" onClick={()=>{setAbierto(false);setFalta(false);}}
              style={{background:"transparent",border:"1px solid var(--bd)",borderRadius:5,
                color:"var(--t2)",padding:"6px 14px",fontSize:"var(--fs-2)",
                fontFamily:"var(--ff-mono)",cursor:"pointer"}}>{T("gateGotIt")}</button>
          </div>
        </div>
      ):(
        <button className="hov" onClick={()=>setAbierto(true)}
          style={{background:"transparent",border:"1px dashed #A78BFA66",borderRadius:5,
            color:"var(--violet)",padding:"6px 14px",fontSize:"var(--fs-2)",
            fontFamily:"var(--ff-mono)",cursor:"pointer",marginTop:4}}>{T("ltAdd")}</button>
      )}

      {recibidas.length>0&&(
        <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid var(--s2)"}}>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            {T("ltHistory")}
          </div>
          {recibidas.map(l=>(
            <div key={l.id} style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginBottom:3}}>
              ✓ {P3(letterKind(l.kind))} · {l.receivedAt}
              {letterAge(l)!==null?` · ${T("ltTook",{n:letterAge(l)})}`:""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackfillModal({files, profile, lang, soyAdmin, onOpenFile, onClose, onApply}){
  // Quien mira: por defecto uno mismo. El admin arranca viendo todo y
  // puede filtrar por persona, igual que en el reporte de vencidas.
  const [quien, setQuien] = useState(soyAdmin ? null : (profile?.name || null));
  const [epoca, setEpoca] = useState(BF_ERA_PENDING);
  const reparto = [...backfillByOwner(files).entries()].sort((a,b)=>b[1]-a[1]);
  const pendientes = filesNeedingBackfill(files, quien, epoca);
  // Cuantos de los que se ven no se arreglan escribiendo una fecha.
  const huecosAccion = pendientes.reduce((a,f)=>
    a + backfillGaps(f).filter(g=>g.fill==="action"
      && (!quien||g.owner===quien) && (!epoca||g.era===epoca)).length, 0);
  const [datos, setDatos] = useState({});
  const [hecho, setHecho] = useState(null);
  const P2 = o => (o && typeof o === "object") ? (o[lang] ?? o.es ?? o.en ?? "") : o;

  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:5,
    color:"var(--t1)",padding:"5px 8px",fontSize:"var(--fs-2)",
    fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};

  const set=(fid,campo,val)=>setDatos(d=>({...d,[fid]:{...(d[fid]||{}),[campo]:val}}));
  const llenos=Object.values(datos).reduce((a,o)=>a+Object.values(o).filter(Boolean).length,0);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"var(--s1)",
        border:"1px solid #F5A62355",borderRadius:12,width:"100%",maxWidth:960,
        maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid var(--s2)",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-6)",color:"var(--gold)"}}>
                {TX("bfTitle")}
              </div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:5,lineHeight:1.6,maxWidth:720}}>
                {TX("bfLead")}
              </div>
            </div>

            <button onClick={onClose} style={{background:"transparent",border:"none",
              color:"var(--t4)",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
          </div>
          {/* De quien son los huecos, y de que epoca. El contador propio
              es lo que empuja: uno global no le habla a nadie. */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
            {[[BF_ERA_PENDING,TX("bfPending")],["historic",TX("bfHistoric")]].map(([e,l])=>(
              <button key={e} className="hov" onClick={()=>setEpoca(e)}
                style={{background:epoca===e?"var(--gold)":"var(--s2)",
                  color:epoca===e?"var(--bg)":"var(--t2)",border:"none",borderRadius:6,
                  padding:"5px 12px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                {l}
              </button>
            ))}
            {soyAdmin&&<div style={{width:1,height:20,background:"var(--s2)",margin:"0 4px"}}/>}
            {soyAdmin&&(
              <button className="hov" onClick={()=>setQuien(null)}
                style={{background:quien===null?"var(--blue)":"var(--s2)",
                  color:quien===null?"var(--bg)":"var(--t2)",border:"none",borderRadius:6,
                  padding:"5px 12px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                {TX("bfAll")}
              </button>
            )}
            {soyAdmin&&reparto.map(([nombre,n])=>(
              <button key={nombre} className="hov" onClick={()=>setQuien(x=>x===nombre?null:nombre)}
                style={{background:quien===nombre?"var(--blue)":"var(--s2)",
                  color:quien===nombre?"var(--bg)":"var(--t2)",border:"none",borderRadius:6,
                  padding:"5px 12px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                {String(nombre).split(" ")[0]} · {n}
              </button>
            ))}
          </div>
          {huecosAccion>0&&(
            <div className="sys" style={{marginTop:8}}>{TX("bfActionNote")}</div>
          )}
          {epoca!==BF_ERA_PENDING&&(
            <div className="sys" style={{marginTop:8}}>{TX("bfHistNote")}</div>
          )}
          <div className="sys" style={{marginTop:8}}>{TX("bfOnlyPast")}</div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:7}}>
            {TX("bfCount",{f:pendientes.length,n:backfillCount(files)})}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"14px 22px"}}>
          {pendientes.length===0?(
            <div style={{padding:"34px 0",textAlign:"center",color:"var(--t4)",
              fontSize:"var(--fs-3)"}}>{TX("bfNone")}</div>
          ):pendientes.map(f=>{
            const huecos=backfillGaps(f);
            return (
              <div key={f.id} style={{borderBottom:"1px solid var(--s2)",padding:"12px 0"}}>
                <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:8}}>
                  <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
                    color:"var(--t1)"}}>{f.borrower}</span>
                  <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                    {f.type} · {lenderNameOf(f)||TX("unassigned")} · {f.stage}
                  </span>
                  {wasBackfilled(f)&&(
                    <span style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginLeft:"auto"}}>
                      {TX("bfWasBackfilled",{d:f.backfill[f.backfill.length-1].at})}
                    </span>
                  )}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(178px,1fr))",gap:9}}>
                  {huecos.map(h=>(
                    <div key={h.id}>
                      <div style={{fontSize:"var(--fs-1)",
                        color:h.fill==="action"?"var(--gold)":"var(--t4)",marginBottom:3}}>
                        {P2(h)}
                      </div>
                      {h.fill==="action" ? (
                        <button className="hov" onClick={()=>{onClose();onOpenFile&&onOpenFile(f,h.tab);}}
                          style={{background:"transparent",border:"1px dashed #F5A62366",
                            borderRadius:5,color:"var(--gold)",padding:"5px 8px",width:"100%",
                            fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer",
                            textAlign:"left",whiteSpace:"nowrap",overflow:"hidden"}}>
                          {TX("bfOpenFile")} →
                        </button>
                      ) : (
                        <input type="date" value={datos[f.id]?.[h.id]||""}
                          onChange={e=>set(f.id,h.id,e.target.value)} style={fs2}/>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{padding:"13px 22px",borderTop:"1px solid var(--s2)",background:"var(--s1)",
          flexShrink:0,display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
          <button className="hov" disabled={llenos===0}
            onClick={()=>{
              const updates=[];
              for(const f of pendientes){
                const v=datos[f.id];
                if(!v) continue;
                const next=applyBackfill(f,v,profile?.name||null);
                if(next!==f) updates.push({id:f.id,file:next,
                  fields:next.backfill[next.backfill.length-1].fields});
              }
              if(!updates.length) return;
              const n=onApply(updates);
              setHecho(n); setDatos({});
              setTimeout(()=>setHecho(null),4000);
            }}
            style={{background:llenos?"var(--gold)":"var(--s2)",color:llenos?"var(--bg)":"var(--t4)",
              borderRadius:7,padding:"10px 20px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
              fontWeight:500,border:"none",cursor:llenos?"pointer":"not-allowed"}}>
            {TX("bfSave")} · {llenos}
          </button>
          {hecho!==null&&(
            <span style={{fontSize:"var(--fs-2)",color:"var(--mint)"}}>{TX("bfSaved",{n:hecho})}</span>
          )}
          <span className="sys" style={{marginLeft:"auto",maxWidth:420,textAlign:"right"}}>
            {TX("bfBlank")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ArchiveModal({file, onClose, onConfirm}){
  const [reason,setReason]=useState(ARCHIVE_REASONS[0]);
  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",padding:"9px 11px",fontSize:"var(--fs-5)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()}
        style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:12,width:"100%",maxWidth:400,padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--t1)"}}>🗄 ARCHIVE</div>
          <div style={{fontSize:"var(--fs-4)",color:"var(--t2)",marginTop:3}}>{file.borrower}</div>
          <div style={{fontSize:"var(--fs-3)",color:"var(--t3)",marginTop:6,lineHeight:1.5}}>
            Nothing is deleted. The file leaves every count and every average, and can be restored from the ARCHIVED tab.
          </div>
        </div>
        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>REASON</div>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={fs}>
            {ARCHIVE_REASONS.map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",border:"none"}}>CANCEL</button>
          <button className="hov" onClick={()=>onConfirm(reason)}
            style={{flex:2,background:"var(--bd)",color:"var(--t1)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500,border:"none"}}>ARCHIVE</button>
        </div>
      </div>
    </div>
  );
}




// ═══════════════════════════════════════════════════════════════════
//  CONTINGENCIES — card strip (design A) and detail panel
// ═══════════════════════════════════════════════════════════════════

const US_STATES = ["NV","FL","TX","AZ","CO","CA","UT","ID","NM","OR","WA"];
const FULL_APP_STAGE = "Full Application";
// Contingencies are captured at Full Application. Before that there is no
// contract to read them from; after it, they govern everything.
function atOrPastFullApp(stage){
  if(stage===CLOSED_STAGE) return true;
  const i=ALL_STAGES.findIndex(s=>s.stage===stage);
  const f=ALL_STAGES.findIndex(s=>s.stage===FULL_APP_STAGE);
  return i>-1 && f>-1 && i>=f;
}
// Las fechas del contrato se leen del contrato, y el contrato llega en Under
// Contract — una etapa ANTES de Full Application en `ALL_STAGE_ORDER`.
// Pedirlas desde `atOrPastFullApp` dejaba la solapa FECHAS vacia justo en el
// archivo que todavia no tiene ninguna fecha: no habia donde teclearlas, ni
// para la puerta de etapa ni para el hueco que el relleno ya reclamaba.
const CONTRACT_STAGE = "Under Contract";
function atOrPastUnderContract(stage){
  if(stage===CLOSED_STAGE) return true;
  const i=ALL_STAGES.findIndex(s=>s.stage===stage);
  const c=ALL_STAGES.findIndex(s=>s.stage===CONTRACT_STAGE);
  return i>-1 && c>-1 && i>=c;
}
const md = iso => iso ? `${iso.slice(5,7)}/${iso.slice(8,10)}` : "—";
// "Aug 15" reads faster than "08/15" and cannot be mistaken for a day/month swap.
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const mon = iso => iso ? `${MONTHS[Number(iso.slice(5,7))-1]} ${Number(iso.slice(8,10))}` : "—";
// The verb that belongs to each derived stage, so the card reads as an instruction.
const ACTION_VERB={"Appraisal Ordered":"order","Submitted to UW":"submit","Condition Clearing":"clear",
  "Clear to Close":"CTC","CD Issued":"CD","Closing Scheduled":"schedule","Signing":"sign","Funded":"fund"};
// Los niveles de contingencia hablan el mismo idioma que el resto: rojo
// roto, dorado se avecina, verde hecho, gris estancado. Antes "done"
// era gris y "normal" verde — al reves de lo que el ojo espera.
const LEVEL_COLOR = { critical:"#E85D75", warn:"#F5A623", normal:"#4A90D9", done:"#7EC8A4", missing:"var(--t2)" };

// ─── CARD STRIP (design A) ───
// Two contract contingencies on one line, the delivery date and its legal
// CD deadline on the next, and the single next thing somebody has to do.
function ContingencyStrip({file}){
  if(!hasContingencies(file)) return null;
  const st={}; for(const r of allContingencyStatus(file)) st[r.id]=r;
  const conflicts=contingencyConflicts(file);
  const derived=derivedStageDeadlines(file);
  const coe=st.coe?.date, cd=coe?cdIssueDeadline(coe):null;

  // Each contingency sits next to the thing it forces somebody to do.
  // A date on its own is trivia; a date with an action is a task.
  const row=(s,actionStage)=>{
    if(!s?.date) return null;
    const c=LEVEL_COLOR[s.level], done=s.level==="done";
    const act=actionStage?derived[actionStage]:null;
    const late=act&&act.startBy<today();
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,fontSize:"var(--fs-2)"}}>
        <span style={{fontFamily:"var(--ff-mono)",color:done?"var(--t3)":c,whiteSpace:"nowrap"}}>
          <b style={{fontWeight:500,letterSpacing:".5px"}}>{s.short}</b>{" "}
          <span style={{color:done?"var(--bd)":"var(--t2)"}}>{mon(s.date)}</span>
          {done&&<span style={{marginLeft:4,fontSize:"var(--fs-1)"}}>
            {s.outcome==="met"?"✓":s.outcome==="waived"?"⚑":s.outcome==="missed"?"✕":"—"}</span>}
        </span>
        {!done&&(
          <span style={{fontFamily:"var(--ff-mono)",color:late?"var(--bad)":"var(--t2)",textAlign:"right",whiteSpace:"nowrap"}}>
            {act&&<span style={{color:late?"var(--bad)":"var(--t2)"}}>
              {ACTION_VERB[actionStage]||"start"} by {mon(act.startBy)} · </span>}
            <span style={{color:c,fontWeight:500}}>
              {s.daysLeft<0?`${Math.abs(s.daysLeft)}d late`:`${s.daysLeft}d`}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{borderTop:"1px solid var(--s2)",paddingTop:8,display:"flex",flexDirection:"column",gap:5}}>
      {row(st.appraisal,"Appraisal Ordered")}
      {row(st.loan,"Submitted to UW")}
      {(coe||st.ctc?.date)&&(
        <div style={{display:"flex",gap:10,fontSize:"var(--fs-2)",color:"var(--t3)",fontFamily:"var(--ff-mono)",flexWrap:"wrap",
          borderTop:"1px solid var(--s1)",paddingTop:5}}>
          {st.ctc?.date&&<span>CTC <span style={{color:LEVEL_COLOR[st.ctc.level]}}>{mon(st.ctc.date)}</span></span>}
          {coe&&<span>COE <span style={{color:LEVEL_COLOR[st.coe.level]}}>{mon(coe)}</span></span>}
          {cd&&<span title={TX("cdIssueTitle")}>
            CD by <span style={{color:"var(--purple)"}}>{mon(cd)}</span></span>}
        </div>
      )}
      {conflicts.length>0&&(
        <div style={{fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",color:"var(--bad)"}}>
          ⚠ {conflicts.length} {(conflicts.length===1?TX("conflicts"):TX("conflictsPl")).toLowerCase()}
        </div>
      )}
    </div>
  );
}

// ─── LENDER CHANGE MODAL ───
function LenderChangeModal({file,profile,onClose,onConfirm}){
  const [toId,setToId]=useState(file.backupLenderId||"");
  const [reasonId,setReasonId]=useState("");
  const [notes,setNotes]=useState("");
  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"8px 10px",fontSize:"var(--fs-4)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};
  const options=lendersFor(file,file.channel||"broker").filter(l=>l.id!==file.lenderId);
  const cost=toId?changeCost(file,toId):null;
  const from=lenderById(file.lenderId);
  const to=lenderById(toId);
  const ready=toId&&reasonId;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:120,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"var(--s1)",border:"1px solid var(--bd)",
        borderRadius:12,width:"100%",maxWidth:460,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid var(--s2)"}}>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--t1)"}}>{TX("changeLenderTitle")}</div>
          <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:3}}>{file.borrower} · {from?from.name:"sin lender"}</div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"14px 22px",display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("newLender")}</div>
            <select value={toId} onChange={e=>setToId(e.target.value)} style={fs}>
              <option value="">— escoge —</option>
              {options.map(o=><option key={o.id} value={o.id}>
                {o.name}{o.lenderPaidBps?` · ${o.lenderPaidBps} bps`:""}{o.id===file.backupLenderId?" · respaldo":""}
              </option>)}
            </select>
          </div>

          {cost&&(
            <div style={{background:"var(--bg)",border:`1px solid ${cost.tooLate?"var(--bad)":"var(--s2)"}`,
              borderRadius:6,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("whatItCosts")}</div>

              {cost.comp&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                    <span style={{color:"var(--t2)"}}>{TX("compensation")}</span>
                    <span style={{color:cost.comp.bps<0?"var(--bad)":cost.comp.bps>0?"var(--mint)":"var(--t2)",fontFamily:"var(--ff-mono)"}}>
                      {cost.comp.bps>0?"+":""}{cost.comp.bps} bps · {cost.comp.dollars<0?"−":""}${Math.abs(cost.comp.dollars).toLocaleString()}
                    </span>
                  </div>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3,lineHeight:1.5}}>
                    {TX("youChargeToday",{n:cost.comp.current})} {cost.comp.cappedByNewLender
                      ? TX("cappedThere",{name:to?.name,n:cost.comp.toCeiling,a:cost.comp.after})
                      : TX("notCappedThere",{name:to?.name,n:cost.comp.toCeiling})}
                  </div>
                </div>
              )}

              {cost.lockLost&&(
                <div style={{fontSize:"var(--fs-3)",color:"var(--gold)",lineHeight:1.45}}>
                  El lock no se transfiere. Sueltas {cost.lockedRate}% y vuelves a lockear
                  al mercado del día. Si la tasa subió, la paga el cliente.
                </div>
              )}

              <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                <span style={{color:"var(--t2)"}}>{TX("landsAt")}</span>
                <span style={{color:"var(--gold)",fontFamily:"var(--ff-mono)"}}>{cost.landsAt}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                <span style={{color:"var(--t2)"}}>{TX("reunderwrite")}</span>
                <span style={{color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{TX("daysN",{n:cost.days.best+"–"+cost.days.worst})}</span>
              </div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",lineHeight:1.5}}>
                {TX("travelsHint")}</div>

              {cost.tooLate&&(
                <div style={{fontSize:"var(--fs-3)",color:"var(--bad)",background:"rgba(232,93,117,.08)",
                  border:"1px solid #E85D7544",borderRadius:5,padding:"7px 9px",lineHeight:1.45}}>
                  En el peor caso este cambio ya no llega al cierre del {cost.viability.coe}.
                  La fecha tope para decidir era el {cost.viability.decideByWorst}.
                </div>
              )}
            </div>
          )}

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("reason")}</div>
            <select value={reasonId} onChange={e=>setReasonId(e.target.value)} style={fs}>
              <option value="">— escoge —</option>
              {Object.entries(REASON_CATEGORIES).map(([cat,meta])=>(
                <optgroup key={cat} label={P(meta)}>
                  {reasonsByCategory(cat).map(r=><option key={r.id} value={r.id}>{P(r)}</option>)}
                </optgroup>
              ))}
            </select>
            {reasonId&&(
              <div style={{fontSize:"var(--fs-2)",color:isLenderFault(reasonId)?"var(--gold)":"var(--t3)",marginTop:5,lineHeight:1.45}}>
                {PN(REASON_CATEGORIES[reasonById(reasonId).cat])}
                {isLenderFault(reasonId)?" · cuenta contra este lender en el scorecard":""}
              </div>
            )}
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("note")}</div>
            <input value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder={TX("reasonNote")} style={fs}/>
          </div>
        </div>

        <div style={{padding:"12px 22px",borderTop:"1px solid var(--s2)",display:"flex",gap:8}}>
          <button className="hov" disabled={!ready}
            onClick={()=>onConfirm({lenderId:toId,reasonId,notes,by:profile?.name||null})}
            style={{flex:2,background:ready?"var(--gold)":"var(--s2)",color:ready?"var(--bg)":"var(--bd)",borderRadius:7,
              padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500,border:"none",
              cursor:ready?"pointer":"not-allowed"}}>
            {TX("moveTo")} {to?to.name.toUpperCase().slice(0,16):"…"}
          </button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"10px 0",
              fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>CANCELAR</button>
        </div>
      </div>
    </div>
  );
}

// ─── BACKUP + HISTORY ───
function BackupPanel({file,backupId,setBackupId,onChangeLender}){
  const v=backupViability(file);
  const b=lenderById(backupId);
  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"7px 9px",fontSize:"var(--fs-4)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};
  const options=lendersFor(file,file.channel||"broker").filter(l=>l.id!==file.lenderId);
  const cost=backupId?compDeltaBetween(file,file.lenderId,backupId):null;
  const lc=v.level==="critical"?"#E85D75":v.level==="warn"?"#F5A623":"#7EC8A4";

  return (
    <div style={{borderTop:"1px solid var(--s2)",paddingTop:11,display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("backupLender")}</div>
      <select value={backupId} onChange={e=>setBackupId(e.target.value)} style={fs}>
        <option value="">— ninguno —</option>
        {options.map(o=><option key={o.id} value={o.id}>{o.name}{o.lenderPaidBps?` · ${o.lenderPaidBps} bps`:""}</option>)}
      </select>

      {b&&cost&&(
        <div style={{fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",color:cost.bps<0?"var(--bad)":"var(--mint)"}}>
          {cost.bps===0
            ? TX("movingFree",{name:b.name,n:cost.toCeiling})
            : TX("movingCosts",{b:cost.bps,d:Math.abs(cost.dollars).toLocaleString()})}
          <div style={{color:"var(--t3)",fontSize:"var(--fs-1)",marginTop:2}}>
            {TX("youChargeCap",{a:cost.current,b:cost.toCeiling})}
          </div>
        </div>
      )}

      {b&&v.ready&&(
        <div style={{background:"var(--bg)",border:`1px solid ${lc}44`,borderRadius:6,padding:"9px 10px"}}>
          <div style={{fontSize:"var(--fs-3)",color:lc,fontFamily:"var(--ff-mono)"}}>
            {v.window==="impossible"
              ? TX("noLongerMakesIt",{d:v.decideByBest})
              : v.window==="best_case_only"
                ? TX("onlyIfNothingFails",{d:v.decideByBest})
                : TX("safeUntil",{d:v.decideByWorst,n:v.daysToWorst})}
          </div>
          <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:2,fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)"}}>
            <div style={{color:v.window==="safe"?"var(--mint)":"var(--t3)"}}>
              {TX("untilArrivesAnyway",{d:v.decideByWorst,n:v.worstDays})}
            </div>
            <div style={{color:v.window==="best_case_only"?"var(--gold)":"var(--t3)"}}>
              {TX("betweenOnlyIfClean",{a:v.decideByWorst,b:v.decideByBest,n:v.bestDays})}
            </div>
            <div style={{color:v.window==="impossible"?"var(--bad)":"var(--t3)"}}>
              {TX("afterNoMakes",{d:v.decideByBest})}
            </div>
          </div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:5,lineHeight:1.5}}>
            {TX("countedBackFromCd",{d:v.cdDeadline})}
          </div>
          {v.expiresBeforeContingency&&(
            <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:6,lineHeight:1.45}}>
              {TX("cushionBefore",{n:v.gapDays,d:v.loanContingency})}
            </div>
          )}
        </div>
      )}

      <button className="hov" onClick={onChangeLender} disabled={!file.lenderId}
        style={{background:"rgba(245,166,35,.1)",color:file.lenderId?"var(--gold)":"var(--bd)",borderRadius:6,
          padding:"8px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:`1px solid ${file.lenderId?"var(--gold)":"var(--s2)"}`,
          cursor:file.lenderId?"pointer":"not-allowed"}}>{TX("changeLender")}</button>

      {(file.lenderHistory||[]).length>0&&(
        <div style={{marginTop:2}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            HISTORIAL · {lenderChangeCount(file)} cambio{lenderChangeCount(file)===1?"":"s"}
            {lenderFaultChanges(file)>0&&<span style={{color:"var(--gold)"}}> · {lenderFaultChanges(file)} por el lender</span>}
          </div>
          {(file.lenderHistory||[]).slice().reverse().map((h,i)=>(
            <div key={i} style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginBottom:5,lineHeight:1.5}}>
              <span style={{color:"var(--t3)"}}>{h.at}</span>{" · "}
              <span style={{color:"var(--t2)"}}>{h.fromName||"—"} → {h.toName}</span>
              {h.compDeltaDollars!=null&&<span style={{color:h.compDeltaBps<0?"var(--bad)":"var(--mint)"}}>
                {" · "}{h.compDeltaBps>0?"+":""}{h.compDeltaBps} bps</span>}
              <div style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>
                {h.reasonId?P(reasonById(h.reasonId)):"sin motivo"}
                {h.daysWithPrevLender!=null?` · ${h.daysWithPrevLender}d con el anterior`:""}
                {h.by?` · ${h.by.split(" ")[0]}`:""}
              </div>
              {h.notes&&<div style={{color:"var(--t2)",fontSize:"var(--fs-2)",fontStyle:"italic"}}>{h.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMPENSACIÓN DEL ARCHIVO ───
// La cascada completa a la vista: bruto, cada descuento con su nombre, el
// neto, y lo que cobra cada quien. Nadie debería calcular sobre el bruto de
// cabeza y descubrir la diferencia en el cheque.
function PayoutPanel({file,profile,onDraft,allFiles,pendingBps}){
  const isAdmin=profile?.role==="admin";
  const mine=(file.lo||"")===(profile?.name||"");
  const cur=file.absorbedFees||[];
  const [fees,setFees]=useState(()=>STANDARD_FEES.map(s=>{
    const hit=cur.find(f=>f.id===s.id);
    return {id:s.id,es:P(s),amount:hit?Number(hit.amount)||0:s.amount,on:!!hit};
  }));
  // Descuentos que no estaban previstos. Sin esto, el día que aparece un
  // cargo distinto no hay dónde ponerlo y alguien lo mete a mano en otro
  // campo — o peor, no lo mete y el reparto queda mal.
  const [origin,setOrigin]=useState(file.leadOrigin||"self");
  const [feePct,setFeePct]=useState(()=>String(financedFeePct(file)));
  const [extras,setExtras]=useState(()=>cur.filter(f=>String(f.id).startsWith("custom"))
    .map(f=>({id:f.id,label:f.label||"",amount:Math.abs(Number(f.amount))||0,
              kind:f.kind==="credit"?"credit":"fee"})));

  // Los bps sin guardar del bloque de lender mandan sobre los del archivo.
  const effBps = Number.isFinite(Number(pendingBps)) && pendingBps!==null ? Number(pendingBps) : null;
  const draft={...file,leadOrigin:origin,financedFeePct:feePct===""?0:(Number(feePct)||0),
    ...(effBps!==null?{bps:effBps}:{}),absorbedFees:[
    ...fees.filter(f=>f.on).map(f=>({id:f.id,amount:f.amount})),
    ...extras.filter(e=>e.amount>0&&e.label.trim())
      .map(e=>({id:e.id,label:e.label.trim(),amount:e.amount,kind:e.kind})),
  ]};
  const sig=JSON.stringify(draft.absorbedFees)+origin+feePct;
  // Un descuento con monto pero sin nombre no se guarda — un cargo anónimo en
  // el reparto es exactamente lo que causa la discusión del cheque.
  const unnamed=extras.some(e=>e.amount>0&&!e.label.trim());
  // La clasificación se congela al guardar. Si mañana APG cambia de categoría,
  // este archivo conserva la que tenía cuando se pagó.
  useEffect(()=>{ onDraft&&onDraft({
    absorbedFees:draft.absorbedFees, leadOrigin:origin,
    financedFeePct:feePct===""?0:(Number(feePct)||0),
    leadClass:leadOrigin(origin)?.klass==="pending"?(file.leadClass||null):leadOrigin(origin)?.klass,
  }); },[sig,origin]);

  // El roster tiene que aplicarse aquí igual que en payroll. Sin él, un archivo
  // del BM se repartía al 50% de newbie — un número de dinero equivocado en
  // pantalla, que es el peor tipo de error de todos.
  const enriched=withLoContext(draft,allFiles||[],COMP_ROSTER);
  const pay=payoutBreakdown(enriched,{year:COMP_YEAR,filesPerMonth:BRANCH_FILES_MO,
    trainerAssigned:!!(COMP_ROSTER[file.lo]?.trainer),
    names:{branch:"Del Valle Lending",teamLead:"Paulo Maria",trainer:TRAINER_NAME}});
  if(!pay.gross) return null;
  const rows=isAdmin?pay.rows:pay.rows.filter(r=>r.id==="lo"&&mine);

  return (
    <div style={{background:"rgba(6,214,160,.04)",border:"1px solid #06D6A033",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--ok)",letterSpacing:"1px"}}>
          {isAdmin?TX("fileComp"):TX("yourComp")}
        </span>
        <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("savesWithSave")}</span>
      </div>

      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("clientOrigin")}</div>
        {isAdmin?(
          <select value={origin} onChange={e=>setOrigin(e.target.value)}
            style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t1)",
              padding:"6px 9px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:"100%"}}>
            {LEAD_ORIGINS.map(o=><option key={o.id} value={o.id}>{P(o)}</option>)}
          </select>
        ):(
          <div style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>{P(leadOrigin(origin))||"—"}</div>
        )}
        {pay.split.inHouseApplied&&(
          <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:4}}>
            Lead de la sucursal · {(IN_HOUSE_REDUCTION*100).toFixed(0)} puntos menos que producción propia
          </div>
        )}
        {pay.split.leadPending&&isAdmin&&(
          <div style={{fontSize:"var(--fs-2)",color:"var(--purple)",marginTop:4}}>
            {TX("leadPending")}
          </div>
        )}
        {isAdmin&&PN(leadOrigin(origin))&&!pay.split.leadPending&&(
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>{PN(leadOrigin(origin))}</div>
        )}
      </div>

      {/* El renglón se muestra si el PRODUCTO financia un cargo —FHA, VA,
          USDA— no si el cargo es mayor que cero. Colgarlo del monto era una
          trampa: al poner 0 desaparecía el renglón, y con él el campo para
          volver a ponerlo. Un Conventional no lo ve nunca, que es correcto. */}
      {financedFeeMeta(draft)&&(
        <div style={{borderTop:"1px solid var(--s2)",paddingTop:9,fontSize:"var(--fs-3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--t2)",marginBottom:3}}>
            <span>{TX("baseLoan")}</span>
            <span style={{fontFamily:"var(--ff-mono)"}}>${(Number(draft.loan)||0).toLocaleString()}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:3}}>
            <span style={{color:"var(--t2)"}}>+ {P(financedFeeMeta(draft))}</span>
            <span style={{display:"flex",alignItems:"center",gap:6}}>
              {isAdmin?(
                <input value={feePct} inputMode="decimal" placeholder="0"
                  title={TX("financedHint")}
                  onChange={e=>setFeePct(e.target.value.replace(/[^\d.]/g,""))}
                  style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t2)",
                    padding:"2px 5px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:44,textAlign:"right"}}/>
              ):<span style={{color:"var(--t3)",fontSize:"var(--fs-3)"}}>{financedFeePct(draft)}</span>}
              <span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>%</span>
              <span style={{color:"var(--t2)",fontFamily:"var(--ff-mono)",minWidth:74,textAlign:"right"}}>
                ${financedFeeAmount(draft).toLocaleString()}
              </span>
            </span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--t2)",
            borderTop:"1px solid var(--s2)",paddingTop:5}}>
            <span>{TX("compBasis")}</span>
            <span style={{fontFamily:"var(--ff-mono)"}}>${compBasisAmount(draft).toLocaleString()}</span>
          </div>
          {isAdmin&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:5,lineHeight:1.5}}>{TX("financedHint")}</div>}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-4)",borderTop:"1px solid var(--s2)",paddingTop:9}}>
        <span style={{color:"var(--t2)"}}>{TX("grossComm")}{isAdmin?` · ${fileCompBps(draft)} bps`:""}
          {effBps!==null&&effBps!==Number(file.bps)?<span style={{color:"var(--gold)"}}> · sin guardar</span>:null}</span>
        <span style={{color:"var(--t1)",fontFamily:"var(--ff-mono)"}}>${pay.gross.toLocaleString()}</span>
      </div>

      <div style={{borderTop:"1px solid var(--s2)",paddingTop:8}}>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:6}}>
          {TX("adjustments")}
        </div>
        {fees.map((fee,i)=>(
          <div key={fee.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <input type="checkbox" checked={fee.on} disabled={!isAdmin}
              onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,on:e.target.checked}:x))}
              style={{accentColor:"var(--bad)",cursor:isAdmin?"pointer":"not-allowed"}}/>
            <span style={{fontSize:"var(--fs-3)",color:fee.on?"var(--t1)":"var(--t3)",flex:1}}>{P(fee)}</span>
            <input inputMode="numeric" value={fee.amount} disabled={!isAdmin||!fee.on}
              onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,amount:Number(e.target.value.replace(/[^\d]/g,""))||0}:x))}
              style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,
                color:fee.on?"var(--bad)":"var(--bd)",padding:"4px 7px",fontSize:"var(--fs-3)",
                fontFamily:"var(--ff-mono)",width:76,textAlign:"right"}}/>
          </div>
        ))}
        {extras.map((e,i)=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <button className="hov" disabled={!isAdmin}
              onClick={()=>setExtras(extras.map((x,j)=>j===i?{...x,kind:x.kind==="fee"?"credit":"fee"}:x))}
              title={e.kind==="fee"?TX("toCredit"):TX("toFee")}
              style={{background:"transparent",border:"none",width:15,padding:0,
                color:ADJUSTMENT_KINDS[e.kind].color,fontSize:"var(--fs-6)",fontFamily:"var(--ff-mono)",
                cursor:isAdmin?"pointer":"default"}}>{e.kind==="fee"?"−":"+"}</button>
            <input value={e.label} disabled={!isAdmin} placeholder={e.kind==="credit"?TX("creditName"):TX("adjName")}
              onChange={ev=>setExtras(extras.map((x,j)=>j===i?{...x,label:ev.target.value}:x))}
              style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
                padding:"4px 7px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",flex:1}}/>
            <input inputMode="numeric" value={e.amount} disabled={!isAdmin}
              onChange={ev=>setExtras(extras.map((x,j)=>j===i?{...x,amount:Number(ev.target.value.replace(/[^\d]/g,""))||0}:x))}
              style={{background:"var(--bg)",borderRadius:5,
                border:`1px solid ${e.kind==="credit"?"#7EC8A455":"var(--bd)"}`,
                color:ADJUSTMENT_KINDS[e.kind].color,
                padding:"4px 7px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:76,textAlign:"right"}}/>
            {isAdmin&&(
              <button className="hov" onClick={()=>setExtras(extras.filter((_,j)=>j!==i))}
                style={{background:"transparent",border:"none",color:"var(--t3)",fontSize:"var(--fs-5)",
                  cursor:"pointer",padding:"0 3px"}} title="quitar">×</button>
            )}
          </div>
        ))}
        {isAdmin&&(
          <button className="hov"
            onClick={()=>setExtras([...extras,{id:`custom_${Date.now()}`,label:"",amount:0,kind:"fee"}])}
            style={{background:"transparent",border:"1px dashed var(--bd)",borderRadius:5,color:"var(--t2)",
              fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",padding:"5px 0",width:"100%",cursor:"pointer",marginTop:2}}>
            {TX("otherAdj")}
          </button>
        )}
        {!isAdmin&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
          Registrados con el archivo.
        </div>}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
        borderTop:"1px solid var(--s2)",paddingTop:8}}>
        <span style={{fontSize:"var(--fs-4)",color:"var(--t1)",fontWeight:500}}>NET</span>
        <span style={{fontSize:"var(--fs-6)",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>${pay.net.toLocaleString()}</span>
      </div>
      {unnamed&&(
        <div style={{fontSize:"var(--fs-2)",color:"var(--bad)"}}>
          {TX("unnamedAdj")}
        </div>
      )}
      {(pay.deducted>0||pay.credited>0)&&(
        <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:-4}}>
          {pay.deducted>0?TX("adjTotals",{d:pay.deducted.toLocaleString()}):""}
          {pay.deducted>0&&pay.credited>0?"  ":""}
          {pay.credited>0?TX("credTotals",{d:pay.credited.toLocaleString()}):""}
        </div>
      )}

      <div style={{borderTop:"1px solid var(--s2)",paddingTop:8}}>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:6}}>
          {isAdmin?TX("distribution"):TX("yourCompShort")}
        </div>
        {rows.length===0?(
          <div style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("notYourFile")}</div>
        ):rows.map((r)=>{
          const own=r.id==="lo"&&mine;
          return (
            <div key={r.id} style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:"var(--fs-3)",color:own?"var(--ok)":"var(--t2)"}}>
                  {r.who}<span style={{color:"var(--t3)"}}> · {(r.pct*100).toFixed(1)}%</span>
                </span>
                <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:own?"var(--fs-6)":"var(--fs-5)",
                  color:own?"var(--ok)":"var(--t1)"}}>${r.amount.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LENDER STRIP (design A) ───
function LenderStrip({file}){
  if(!hasLenderData(file)) return null;
  const l=lenderById(file.lenderId);
  const ch=CHANNELS[file.channel]||null;
  const ls=lockStatus(file);
  const conf=lenderConflicts(file);
  const bk=lenderById(file.backupLenderId);
  const bv=bk?backupViability(file):{ready:false};
  const lc=ls.level==="critical"?"#E85D75":ls.level==="warn"?"#F5A623":ls.meta.color;

  return (
    <div style={{background:"rgba(74,144,217,.06)",border:`1px solid ${conf.some(c=>c.sev==="critical")?"#E85D7555":"var(--bd)"}`,
      borderRadius:6,padding:"7px 9px",marginTop:9,display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
        <span style={{fontSize:"var(--fs-3)",color:l?"var(--blue)":"var(--t3)",fontFamily:"var(--ff-mono)",fontWeight:500,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {lenderNameOf(file)||"sin lender"}
        </span>
        <span style={{display:"flex",gap:6,alignItems:"baseline",flexShrink:0}}>
          {file.rate&&<span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"var(--ff-mono)"}}>{Number(file.rate).toFixed(3)}%</span>}
          <span style={{fontSize:"var(--fs-1)",color:lc,border:`1px solid ${lc}66`,borderRadius:3,padding:"1px 5px",
            fontFamily:"var(--ff-mono)",letterSpacing:".5px"}}>{ls.state==="locked"?"LOCKED":"FLOAT"}</span>
        </span>
      </div>
      <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontFamily:"var(--ff-mono)",display:"flex",gap:8,flexWrap:"wrap"}}>
        {ch&&<span style={{color:ch.color}}>{P(ch).toLowerCase()}</span>}
        {bk&&bv.ready&&<span style={{color:bv.level==="critical"?"var(--bad)":bv.level==="warn"?"var(--gold)":"var(--t2)"}}>
          respaldo {bk.name.split(" ")[0]} · viable to {mon(bv.decideByWorst)}</span>}
        {ls.state==="float"&&ls.mustLockBy&&(
          <span style={{color:ls.level==="critical"?"var(--bad)":"var(--t2)"}}>
            lock by {mon(ls.mustLockBy)}{ls.daysLeft!==null?` · ${ls.daysLeft<0?`${Math.abs(ls.daysLeft)}d late`:`${ls.daysLeft}d`}`:""}
          </span>
        )}
        {ls.state==="locked"&&ls.expires&&(
          <span style={{color:ls.coversClose?"var(--t2)":"var(--bad)"}}>
            exp {mon(ls.expires)}{ls.coversClose?` · +${ls.spare}d`:` · corto ${ls.shortBy}d`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── LENDER PANEL ───
function LenderPanel({file,profile,onDraft,onChangeLender}){
  // El bloque de compensación escribía en BPS COMP sin guardia de admin,
  // mientras el campo BPS COMP de arriba sí la tenía. La puerta estaba
  // cerrada y la ventana abierta: un LO podía fijarse su propia comp.
  const isAdmin=profile?.role==="admin";
  const [channel,setChannel]=useState(file.channel||"broker");
  const [lenderId,setLenderId]=useState(file.lenderId||"");
  const [rate,setRate]=useState(file.rate!=null?String(file.rate):"");
  const [lockState,setLockState]=useState(file.lockState||"float");
  const [lockedAt,setLockedAt]=useState(file.lockedAt||"");
  const [term,setTerm]=useState(file.lockTermDays?String(file.lockTermDays):"30");
  const c0=file.comp||{};
  const [ratePriceBps,setRatePriceBps]=useState(c0.ratePriceBps!=null?String(c0.ratePriceBps):"");
  const [originationBps,setOriginationBps]=useState(c0.originationBps!=null?String(c0.originationBps):"");
  const [borrowerPaidBps,setBorrowerPaidBps]=useState(c0.borrowerPaidBps!=null?String(c0.borrowerPaidBps):"");
  const [lenderPaidBps,setLenderPaidBps]=useState(c0.lenderPaidBps!=null?String(c0.lenderPaidBps):"");
  const [backupId,setBackupId]=useState(file.backupLenderId||"");
  const [lenderOther,setLenderOther]=useState(file.lenderOther||"");

  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"7px 9px",fontSize:"var(--fs-4)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};

  const draftBase={...file,channel,lenderId:lenderId||null,rate:parseFloat(rate)||null,
    lockState,lockedAt:lockedAt||null,lockTermDays:parseInt(term)||null};
  const draft=setComp(draftBase,{ratePriceBps,originationBps,borrowerPaidBps,lenderPaidBps});
  const comp=compBreakdown(draft);
  const options=lendersFor(draft,channel);
  const hidden=lendersHiddenByChannel(draft,channel);
  const l=lenderById(lenderId);
  const cc=compCeiling(draft);
  const ccD=compCeilingDollars(draft);
  const ls=lockStatus(draft);
  const conf=lenderConflicts(draft);

  // The panel no longer owns a save button. It publishes its patch upward on
  // every keystroke and the modal's single SAVE writes it. Two save buttons
  // meant the obvious one silently discarded this panel's work.
  const patch={
    channel, lenderId:lenderId||null, rate:parseFloat(rate)||null, lockState,
    lockedAt: lockState==="locked"?(okDate(lockedAt)||today()):null,
    lockTermDays: lockState==="locked"?(parseInt(term)||null):null,
    lockExpires: lockState==="locked"?lockExpiration(okDate(lockedAt)||today(),parseInt(term)):null,
    lenderOther: lenderId===OTHER_LENDER_ID?(lenderOther.trim()||null):null,
    lenderSince: !lenderId?null:(file.lenderId===lenderId?(file.lenderSince||today()):today()),
    // La compensación solo viaja si quien edita es admin. Lender, tasa, lock y
    // respaldo son operativos y los maneja el LO en su propio archivo.
    ...(isAdmin?{comp:draft.comp}:{}),
    backupLenderId: backupId||null,
    // Mirror the resolved total into the single field the reports read.
    // The block does not compete with BPS COMP — it fills it in.
    ...(isAdmin?{bps: resolvedCompBps(draft) ?? file.bps ?? null}:{}),
  };
  const sig=JSON.stringify(patch);
  useEffect(()=>{ onDraft&&onDraft(patch); },[sig]);

  return (
    <div style={{background:"rgba(74,144,217,.05)",border:"1px solid #4A90D933",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>{TX("lenderLock")}</span>
        <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{TX("channelDecides")}</span>
        <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("savesWithSave")}</span>
      </div>


      {/* Dos columnas dentro del panel: a la izquierda lo que ESCOGES
          —canal, lender, compensacion—; a la derecha lo que el sistema
          calcula de esa eleccion: tasa, lock, respaldo y viabilidad.
          Antes era una sola columna y a 1240px dejaba media pantalla
          vacia al lado. */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* CHANNEL — chosen first, everything filters from it */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("channel")}</div>
        <div style={{display:"flex",gap:8}}>
          {CHANNEL_IDS.map(id=>{
            const c=CHANNELS[id],on=channel===id,n=lendersFor(draft,id).length;
            return (
              <button key={id} className="hov" onClick={()=>{setChannel(id);
                if(!lendersFor(draft,id).some(x=>x.id===lenderId)) setLenderId("");}}
                style={{flex:1,background:on?`${c.color}18`:"var(--bg)",border:`1px solid ${on?c.color:"var(--t4)"}`,
                  borderRadius:6,padding:"8px 6px",cursor:"pointer",fontFamily:"var(--ff-mono)",textAlign:"left"}}>
                <div style={{fontSize:"var(--fs-3)",color:on?c.color:"var(--t2)",fontWeight:500}}>{P(c)}</div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>{n} lenders · {TX("cap")} {c.capBps}</div>
              </button>
            );
          })}
        </div>
        <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:5}}>{PN(CHANNELS[channel])}</div>
      </div>

      {/* LENDER */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
          LENDER <span style={{color:"var(--t4)"}}>· {options.length} {TX("makesProduct",{p:P(categoryLabel(lenderProductKey(file.type)))})}</span>
        </div>
        <select value={lenderId} onChange={e=>setLenderId(e.target.value)} style={fs}>
          <option value="">{TX("unassigned")}</option>
          {options.map(o=><option key={o.id} value={o.id}>
            {o.name}{o.lenderPaidBps?` · ${o.lenderPaidBps} bps`:""}{o.borrowerPaidOnly?" · borrower-paid":""}
          </option>)}
          <option value={OTHER_LENDER_ID}>— otro lender, escribir a mano —</option>
        </select>
        {lenderId===OTHER_LENDER_ID&&(
          <div style={{marginTop:6}}>
            <input value={lenderOther} onChange={e=>setLenderOther(e.target.value)}
              placeholder={TX("lenderName")} style={fs}/>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>
              {TX("otherLenderHint")}</div>
          </div>
        )}
        {hidden.length>0&&(
          <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:5,lineHeight:1.5}}>
            {TX("hiddenByChannel",{
              n:hidden.length,
              list:hidden.slice(0,4).map(x=>x.name).join(", ")
                   + (hidden.length>4?TX("andNMore",{n:hidden.length-4}):"")
            })}
          </div>
        )}
        {l&&(
          <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)"}}>
            {l.contacts?.[0]?.ae&&<span style={{color:"var(--t2)"}}>AE {l.contacts[0].ae}</span>}
            {l.contacts?.[0]?.phone&&<a href={`tel:${l.contacts[0].phone.replace(/[^\d+]/g,"")}`}
              style={{color:"var(--blue)",textDecoration:"none"}}>{l.contacts[0].phone}</a>}
            {l.guidelines&&<a href={l.guidelines} target="_blank" rel="noreferrer"
              style={{color:"var(--purple)",textDecoration:"none"}}>{TX("guidelines")}</a>}
          </div>
        )}
      </div>

      {/* COMPENSATION — editable where it legitimately varies by loan,
          read-only where the comp plan determines it. */}
      {isAdmin&&lenderId&&(
        <div style={{background:"var(--bg)",border:`1px solid ${comp.overCeiling?"var(--bad)":"var(--s2)"}`,
          borderRadius:6,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("compensation")}</span>
            <span style={{fontSize:"var(--fs-1)",color:comp.meta.editable?"var(--mint)":"var(--t2)"}}>{P(comp.meta)}</span>
          </div>

          {comp.lines.map(ln=>(
            <div key={ln.id} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)",flex:1}}>{P(ln)}</span>
              {ln.editable?(
                <input inputMode="numeric" placeholder={ln.planBps!=null?String(ln.planBps):"0"}
                  value={ln.id==="ratePrice"?ratePriceBps:ln.id==="origination"?originationBps
                    :ln.id==="lenderPaid"?lenderPaidBps:borrowerPaidBps}
                  onChange={e=>{const v=e.target.value.replace(/[^\d]/g,"");
                    ln.id==="ratePrice"?setRatePriceBps(v):ln.id==="origination"?setOriginationBps(v)
                    :ln.id==="lenderPaid"?setLenderPaidBps(v):setBorrowerPaidBps(v);}}
                  style={{...fs,width:66,textAlign:"right",padding:"5px 7px",fontSize:"var(--fs-3)"}}/>
              ):(
                <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontFamily:"var(--ff-mono)",width:66,textAlign:"right"}}>{ln.bps??"—"}</span>
              )}
              <span style={{fontSize:"var(--fs-1)",color:"var(--t3)",width:22}}>bps</span>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"var(--ff-mono)",width:74,textAlign:"right"}}>
                {ln.dollars!==null?`$${ln.dollars.toLocaleString()}`:"—"}
              </span>
            </div>
          ))}

          <div style={{borderTop:"1px solid var(--s2)",paddingTop:7,display:"flex",
            justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>Total</span>
            <span style={{fontSize:"var(--fs-5)",color:comp.overCeiling?"var(--bad)":"var(--gold)",fontFamily:"var(--ff-mono)"}}>
              {comp.totalBps??"—"} bps{comp.totalDollars!==null?` · $${comp.totalDollars.toLocaleString()}`:""}
            </span>
          </div>

          {/* room left under the ceiling, shown as a bar so it reads at a glance */}
          <div>
            <div style={{height:4,background:"var(--s2)",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,comp.pctOfCeiling??0)}%`,
                background:comp.overCeiling?"var(--bad)":comp.pctOfCeiling>=95?"var(--gold)":"var(--mint)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4}}>
              <span>{PN(comp.meta)}</span>
              <span style={{color:comp.overCeiling?"var(--bad)":"var(--t3)"}}>
                {comp.remainingBps>0?TX("ceilingLeftN",{n:comp.ceilingBps,r:comp.remainingBps}):TX("ceilingLeft",{n:comp.ceilingBps})}
              </span>
            </div>
          </div>

          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
            {comp.totalBps!=null
              ? TX("willWriteBps",{n:comp.totalBps})
              : TX("noDataBranch")}
          </div>
          {comp.model==="correspondent"&&(
            <div style={{fontSize:"var(--fs-1)",color:"var(--t2)"}}>
              {TX("combinedCap")}
            </div>
          )}
        </div>
      )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* RATE + LOCK */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("rate")}</div>
          <input value={rate} onChange={e=>setRate(e.target.value)} placeholder="6.990" inputMode="decimal" style={fs}/>
        </div>
        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>ESTADO</div>
          <select value={lockState} onChange={e=>setLockState(e.target.value)} style={fs}>
            <option value="float">{TX("floating")}</option>
            <option value="locked">{TX("locked")}</option>
          </select>
        </div>
      </div>

      {/* FLOATING — the deadline nobody writes on a contract */}
      {lockState==="float"&&(
        <div style={{background:"var(--bg)",border:`1px solid ${ls.level==="critical"?"#E85D7544":"#F5A62333"}`,
          borderRadius:6,padding:"9px 10px"}}>
          {ls.mustLockBy?(
            <>
              <div style={{fontSize:"var(--fs-3)",color:ls.level==="critical"?"var(--bad)":"var(--gold)",fontFamily:"var(--ff-mono)"}}>
                {TX("lastDayToLock",{d:ls.mustLockBy})}
                {ls.daysLeft!==null&&<span style={{color:"var(--t2)"}}> · {ls.daysLeft<0?`${Math.abs(ls.daysLeft)}d tarde`:`faltan ${ls.daysLeft}d`}</span>}
              </div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>
                {TX("cdCarriesRate")}</div>
            </>
          ):(
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{TX("noCloseNoCap")}</div>
          )}
          {ls.coe&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("whichTermQ")}</div>
              {ls.terms.map(t=>(
                <div key={t.term} style={{display:"flex",gap:8,fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",
                  color:t.covers?"var(--mint)":"var(--bad)"}}>
                  <span style={{minWidth:34}}>{t.term}d</span>
                  <span style={{color:"var(--t2)",minWidth:82}}>{t.expires}</span>
                  <span>{t.covers?TX("coversBy",{n:t.spare}):TX("shortByN",{n:t.shortBy})}</span>
                </div>
              ))}
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
                {TX("priceDecides")}</div>
            </div>
          )}
        </div>
      )}

      {/* LOCKED */}
      {lockState==="locked"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("lockDate")}</div>
            <input type="date" value={lockedAt} onChange={e=>setLockedAt(e.target.value)} style={fs}/>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("lockTerm")}</div>
            <select value={term} onChange={e=>setTerm(e.target.value)} style={fs}>
              {LOCK_TERMS.map(t=><option key={t} value={t}>{t} días</option>)}
            </select>
          </div>
          {ls.expires&&(
            <div style={{gridColumn:"1/-1",background:"var(--bg)",
              border:`1px solid ${ls.coversClose?"#7EC8A433":"#E85D7544"}`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",color:ls.coversClose?"var(--mint)":"var(--bad)"}}>
                Vence {ls.expires}
                {ls.coe&&(ls.coversClose
                  ? <span style={{color:"var(--t2)"}}> · cubre el cierre con {ls.spare}d de sobra</span>
                  : <span> · {ls.shortBy}d antes del cierre, habrá extensión</span>)}
              </div>
            </div>
          )}
        </div>
      )}



      <BackupPanel file={draft} backupId={backupId} setBackupId={setBackupId}
        onChangeLender={onChangeLender}/>

      {conf.length>0&&conf.map((c,i)=>(
        <div key={i} style={{fontSize:"var(--fs-3)",color:c.sev==="critical"?"var(--bad)":"var(--gold)",background:"var(--bg)",
          border:`1px solid ${c.sev==="critical"?"#E85D7544":"#F5A62344"}`,borderRadius:5,
          padding:"7px 9px",lineHeight:1.45}}>{P(c)}</div>
      ))}
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ───
function ContingencyPanel({file,profile,onSave,onDraft}){
  const box = file.contingencies||{};
  const [state,setState]=useState(file.state||"NV");
  const [d,setD]=useState({
    contractSignal:box.contractSignal||"",
    contractAccepted:box.contractAccepted||"", appraisalContingency:box.appraisalContingency||"",
    loanContingency:box.loanContingency||"", ctcTarget:box.ctcTarget||"",
    coe:box.coe||file.closing||"", fundingDate:box.fundingDate||"",
  });
  const [openId,setOpenId]=useState(null);
  const [oc,setOc]=useState("met"); const [ocDate,setOcDate]=useState(""); const [ocNote,setOcNote]=useState("");
  const [showDerived,setShowDerived]=useState(false);

  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"7px 9px",fontSize:"var(--fs-4)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};

  // Preview against what is being typed, not against what was last saved.
  const draft={...file,state,contingencies:{...box,...d}};
  const rows=allContingencyStatus(draft);
  const conflicts=contingencyConflicts(draft);
  const derived=sortedDeadlines(draft);
  const cd=d.coe?cdIssueDeadline(d.coe):null;
  const basis=CONTRACT_DAY_BASIS[state];

  const datePatch={state,contingencies:{...box,...Object.fromEntries(
    Object.entries(d).map(([k,v])=>[k,okDate(v)])),capturedAt:today()}};
  const dsig=JSON.stringify(datePatch);
  useEffect(()=>{ onDraft&&onDraft(datePatch); },[dsig]);
  const record=(id)=>{
    const patched=recordContingencyOutcome({...file,contingencies:{...box,...d}},id,
      {outcome:oc,newDate:ocDate||null,notes:ocNote,by:profile?.name||null});
    onSave({contingencies:patched.contingencies,contingencyResults:patched.contingencyResults,
      contingencyLog:patched.contingencyLog});
    setOpenId(null); setOc("met"); setOcDate(""); setOcNote("");
  };

  const field=(key,label,hint)=>{
    const typing = d[key] && !isValidISO(d[key]);
    return (
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{label}</div>
        <input type="date" value={d[key]} onChange={e=>setD({...d,[key]:e.target.value})}
          style={{...fs,borderColor:typing?"var(--gold)":"var(--bd)"}}/>
        {typing&&<div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:3}}>{TX("typingYear")}</div>}
        {!typing&&hint&&<div style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginTop:3}}>{hint}</div>}
      </div>
    );
  };

  return (
    <div style={{background:"rgba(232,93,117,.04)",border:"1px solid #E85D7533",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--bad)",letterSpacing:"1px"}}>{TX("contingencies")}</span>
        <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>
          {TX("contClock")}
        </span>
        <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("savesWithSave")}</span>
      </div>


      {/* Dos columnas: a la izquierda LO QUE DICE EL CONTRATO —lo que
          se teclea del papel—; a la derecha LO QUE EL SISTEMA DERIVA:
          conflictos, resultados, fechas tope e historial.
          Revueltos en un solo scroll, un conflicto como el CTC que
          empata con la fecha tope del CD pasaba desapercibido. */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* STATE — decides whether the contract counts calendar or business days */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,alignItems:"end"}}>
        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>ESTADO</div>
          <select value={state} onChange={e=>setState(e.target.value)} style={fs}>
            {US_STATES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{fontSize:"var(--fs-2)",color:basis==="business"?"var(--gold)":"var(--t2)",paddingBottom:8}}>
          {basis==="business"
            ? TX("businessDays")
            : TX("calendarDays",{s:state})}
        </div>
      </div>

      {/* LA FIRMA DEL COMPRADOR — dato del contrato, NO el ancla. El reloj
          sigue corriendo desde la aceptacion del vendedor. */}
      <div>
        {field("contractSignal",TX("contractSignal"),TX("contractSignalHint"))}
        {(()=>{const n=signalToAcceptDays(draft);
          return n===null?null:(
            <div style={{fontSize:"var(--fs-1)",color:"var(--t2)",marginTop:3}}>{TX("signalGap",{n})}</div>
          );})()}
      </div>

      {/* THE ANCHOR */}
      <div style={{borderLeft:"2px solid var(--bad)",paddingLeft:10}}>
        {field("contractAccepted",TX("contractAccepted"),TX("anchorHint"))}
      </div>

      {/* CONTRACT — deposit at risk */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--bad)",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          {TX("fromContract")}
        </div>
        <div id="fix-contract-dates" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {field("appraisalContingency",TX("appraisal"))}
          {field("loanContingency",TX("loanCont"))}
        </div>
      </div>

      {/* DELIVERY CHAIN */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          {TX("deliveryChain")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {field("ctcTarget","CTC")}
          {field("coe","COE")}
          {field("fundingDate",TX("funding"))}
        </div>
        {cd&&(
          <div style={{marginTop:8,background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",
            borderRadius:6,padding:"8px 10px",fontSize:"var(--fs-3)",color:"var(--purple)",fontFamily:"var(--ff-mono)"}}>
            {TX("cdReceivedBy",{d:cd})}
            <div style={{color:"var(--t2)",fontSize:"var(--fs-2)",marginTop:3}}>
              {TX("cdCounts",{d:cdMailDeadline(d.coe)})}
            </div>
          </div>
        )}
      </div>

        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* RITMO — aviso, nunca accion. Adelantar el cierre necesita
          addendum firmado por comprador y vendedor. */}
      {(()=>{const p=filePace(draft);
        if(!p.ready||p.state==="onplan") return null;
        const col=signalColor(p.signal);
        return (
          <div style={{background:p.state==="ahead"?"rgba(126,200,164,.07)":"rgba(232,93,117,.07)",
            border:`1px solid ${col}44`,borderRadius:6,padding:"10px 12px"}}>
            <div style={{fontSize:"var(--fs-3)",color:col,lineHeight:1.45}}>
              {p.state==="ahead"?TX("paceAheadFull",{n:p.days}):TX("paceBehindFull",{n:p.days})}
            </div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t2)",marginTop:4,lineHeight:1.5}}>
              {TX("paceBasis",{s:file.stage,d:p.shouldStartBy})}
              {p.couldCloseBy?" · "+TX("paceCould",{d:p.couldCloseBy}):""}
            </div>
            {p.state==="ahead"&&(
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,lineHeight:1.5}}>
                {TX("paceAddendum")}
              </div>
            )}
          </div>
        );})()}

      {/* CONFLICTS */}
      {conflicts.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--bad)",letterSpacing:"1px",fontWeight:500}}>
            ⚠ {conflicts.length} {conflicts.length===1?TX("conflicts"):TX("conflictsPl")}
          </div>
          {conflicts.map((c,i)=>(
            <div key={i} style={{fontSize:"var(--fs-3)",color:c.sev==="critical"?"var(--bad)":"var(--gold)",
              background:"var(--bg)",border:`1px solid ${c.sev==="critical"?"#E85D7544":"#F5A62344"}`,
              borderRadius:5,padding:"7px 9px",lineHeight:1.45}}>{P(c)}</div>
          ))}
        </div>
      )}

      {/* RESULTS PER CONTINGENCY */}
      {rows.some(r=>r.date)&&(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("resultPerCont")}</div>
          {rows.filter(r=>r.date).map(r=>{
            const ext=contingencyExtensionCount(file,r.id);
            return (
              <div key={r.id} style={{background:"var(--bg)",border:"1px solid var(--s2)",borderRadius:5,padding:"8px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:"var(--fs-2)",color:LEVEL_COLOR[r.level],fontWeight:500,minWidth:38}}>{r.short}</span>
                  <span style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>{r.date}</span>
                  {r.contractDays!==null&&<span style={{fontSize:"var(--fs-1)",color:r.contractDays<0?"var(--bad)":"var(--bd)"}}>
                    {r.contractDays} {TX("contractDaysOf",{b:r.basis==="business"?TX("bizShort"):TX("calShort")})}
                    {r.contractDays<0?" ⚠":""}</span>}
                  <span style={{fontSize:"var(--fs-2)",color:r.outcomeMeta.color,marginLeft:"auto"}}>
                    {P(r.outcomeMeta)}{ext>0?` ·${ext}×`:""}
                  </span>
                  <button className="hov" onClick={()=>setOpenId(openId===r.id?null:r.id)}
                    style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t2)",
                      fontSize:"var(--fs-1)",padding:"3px 7px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>
                    {openId===r.id?"✕":TX("record")}
                  </button>
                </div>
                {r.depositAtRisk&&(
                  <div style={{fontSize:"var(--fs-2)",color:"var(--bad)",marginTop:5}}>
                    {TX("depositExposed")}
                  </div>
                )}
                {openId===r.id&&(
                  <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:7}}>
                    <select value={oc} onChange={e=>setOc(e.target.value)} style={fs}>
                      {CONTINGENCY_OUTCOMES.filter(o=>o.id!=="pending").map(o=>
                        <option key={o.id} value={o.id}>{P(o)}</option>)}
                    </select>
                    {outcomeById(oc).requiresNewDate&&(
                      <div>
                        <div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginBottom:3}}>
                          {TX("newDateAddendum")}
                        </div>
                        <input type="date" value={ocDate} onChange={e=>setOcDate(e.target.value)} style={fs}/>
                      </div>
                    )}
                    {PN(outcomeById(oc))&&(
                      <div style={{fontSize:"var(--fs-2)",color:outcomeById(oc).color}}>{PN(outcomeById(oc))}</div>
                    )}
                    <input value={ocNote} onChange={e=>setOcNote(e.target.value)}
                      placeholder={TX("outcomeNote")} style={fs}/>
                    <button className="hov" onClick={()=>record(r.id)}
                      disabled={outcomeById(oc).requiresNewDate&&!ocDate}
                      style={{background:outcomeById(oc).requiresNewDate&&!ocDate?"var(--s1)":"var(--s2)",
                        color:outcomeById(oc).requiresNewDate&&!ocDate?"var(--bd)":"var(--mint)",borderRadius:5,
                        padding:"7px 0",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",
                        border:`1px solid ${outcomeById(oc).requiresNewDate&&!ocDate?"var(--s2)":"var(--mint)"}`,
                        cursor:outcomeById(oc).requiresNewDate&&!ocDate?"not-allowed":"pointer"}}>
                      GUARDAR RESULTADO
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DERIVED DEADLINES */}
      {derived.length>0&&(
        <div>
          <button className="hov" onClick={()=>setShowDerived(v=>!v)}
            style={{background:"transparent",border:"none",color:"var(--blue)",fontSize:"var(--fs-2)",
              fontFamily:"var(--ff-mono)",cursor:"pointer",padding:0}}>
            {showDerived?"▾":"▸"} {TX("derivedDates")} ({derived.length})
          </button>
          {showDerived&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginBottom:5,lineHeight:1.5}}>
                {TX("derivedHint")}</div>
              {/* La leyenda va donde se usa el color, no en una pantalla
                  de ayuda que nadie abre. */}
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:7}}>
                {["done","soon","broken"].map(id=>(
                  <span key={id} style={{fontSize:"var(--fs-1)",color:signalColor(id),letterSpacing:".4px"}}>
                    ● {P(SIGNALS[id])}
                  </span>
                ))}
              </div>
              {/* El color sale de deadlineSignal, no de "la fecha ya paso".
                  Una tasacion YA ORDENADA salia en rojo porque el
                  calendario habia quedado atras — el rojo decia "tarde"
                  sobre algo hecho. Si la etapa se alcanzo, va en verde. */}
              {derived.map(r=>{
                const sig=deadlineSignal(r,file);
                const col=r.legal?signalColor("legal"):signalColor(sig);
                return (
                  <div key={r.stage} style={{display:"flex",gap:8,fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",
                    color:col,alignItems:"baseline"}}>
                    <span style={{minWidth:70}}>{r.startBy}</span>
                    <span style={{flex:1}}>{r.stage}{r.legal?" ⚖":""}</span>
                    <span style={{color:"var(--t3)",fontSize:"var(--fs-1)"}}>{r.owner||""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LOG */}
      {(file.contingencyLog||[]).length>0&&(
        <div style={{borderTop:"1px solid var(--s2)",paddingTop:8}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("history")}</div>
          {(file.contingencyLog||[]).slice().reverse().map((e,i)=>(
            <div key={i} style={{fontSize:"var(--fs-2)",color:"var(--t2)",display:"flex",gap:7,marginBottom:3}}>
              <span style={{color:"var(--t3)",minWidth:70}}>{e.at}</span>
              <span style={{color:outcomeById(e.outcome).color,minWidth:70}}>
                {contingencyById(e.id)?.short} {P(outcomeById(e.outcome))}
              </span>
              <span style={{flex:1}}>
                {e.toDate?`${e.fromDate} → ${e.toDate}`:""}{e.notes?` · ${e.notes}`:""}
                {e.by?` · ${e.by.split(" ")[0]}`:""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
        </div>
      </div>
  );
}

// ─── DPA ───
// Tres casillas en escala, no cuatro. El producto NO va aqui: ya vive
// en el tipo de prestamo, y tenerlo en dos lugares era lo que producia
// TX("dpaStackHint") sin que nadie lo notara.
//
// Cuando esta en No se queda en un renglon apagado. No todo prestamo
// lleva asistencia, y un bloque abierto pidiendo datos que no aplican
// se siente como un campo pendiente.
function DpaPanel({file,lang,onSave,readOnly}){
  const d=dpaOf(file);
  const on=hasDpa(file);
  const L2=(k,v)=>tr(k,lang,v);
  const P2=o=>(o&&typeof o==="object")?(o[lang]??o.es??o.en??""):o;
  const chip=(activo,label,onClick,color)=>(
    <button key={label} className="hov" disabled={readOnly} onClick={onClick}
      style={{background:activo?(color||"var(--mint)"):"transparent",
        color:activo?"var(--bg)":(color||"var(--t2)"),
        border:`1px solid ${activo?(color||"var(--mint)"):"var(--bd)"}`,borderRadius:5,
        padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",
        cursor:readOnly?"default":"pointer"}}>{label}</button>
  );

  return (
    <div style={{background:on?"rgba(126,200,164,.05)":"transparent",
      border:`1px solid ${on?"#7EC8A433":"var(--s2)"}`,borderRadius:8,
      padding:on?"12px 14px":"9px 14px",
      display:"flex",flexDirection:"column",gap:on?11:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:on?"var(--fs-5)":"var(--fs-3)",
          color:on?"var(--mint)":"var(--t2)",letterSpacing:"1px"}}>{L2("dpaBlock")}</span>
        {on&&<span style={{fontSize:"var(--fs-3)",color:"var(--mint)",fontFamily:"var(--ff-mono)"}}>{dpaLabel(file,lang)}</span>}
        <div style={{display:"flex",gap:5,marginLeft:"auto"}}>
          {chip(on,L2("yesShort"),()=>onSave(setDpa(file,{on:true})))}
          {chip(!on,L2("noShort"),()=>onSave(setDpa(file,{on:false})),"var(--t2)")}
        </div>
      </div>

      {on&&(<>
        <div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L2("dpaPctLabel")}</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {DPA_PCTS.map(p=>chip(d.pct===p,p+"%",()=>onSave(setDpa(file,{pct:p})),"#F5A623"))}
          </div>
        </div>

        <div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L2("dpaForm")}</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {DPA_FORMS.map(f=>chip(d.form===f.id,P2(f),()=>onSave(setDpa(file,{form:f.id}))))}
          </div>
          {d.form&&(
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4}}>
              {lang==="en"?dpaForm(d.form)?.note_en:dpaForm(d.form)?.note_es}
            </div>
          )}
        </div>

        {d.form==="forgivable"&&(
          <div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L2("dpaYears")}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[3,5,10].map(y=>chip(d.forgivenessYears===y,y+"",
                ()=>onSave(setDpa(file,{forgivenessYears:y})),"#4A90D9"))}
            </div>
          </div>
        )}

        {!dpaComplete(file)&&(
          <div style={{fontSize:"var(--fs-1)",color:"var(--gold)"}}>{L2("dpaIncomplete")}</div>
        )}
        <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",lineHeight:1.5}}>{L2("dpaBlockHint")}</div>
      </>)}
    </div>
  );
}

// ─── HALLAZGOS ───
// Se guardan de inmediato, no con el SAVE del pie. Un hallazgo que se
// pierde porque alguien cerro el modal sin guardar es exactamente el
// fallo que este bloque existe para evitar.
function FindingsPanel({file,profile,onSave}){
  const [open,setOpen]=useState(false);
  const [item,setItem]=useState("employment_2y");
  const [text,setText]=useState("");
  const [waiting,setWaiting]=useState("lo");
  const abiertos=openFindings(file);
  const cerrados=resolvedFindings(file);
  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
    padding:"7px 9px",fontSize:"var(--fs-4)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};

  return (
    <div style={{background:abiertos.length?"rgba(232,93,117,.05)":"rgba(126,200,164,.04)",
      border:`1px solid ${abiertos.length?"#E85D7544":"#7EC8A433"}`,borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",
          color:abiertos.length?"var(--bad)":"var(--mint)",letterSpacing:"1px"}}>{TX("findings")}</span>
        {abiertos.length>0&&(
          <span style={{background:"var(--bad)",color:"var(--bg)",borderRadius:10,padding:"1px 8px",
            fontSize:"var(--fs-2)",fontWeight:500}}>{TX("findingOpen",{n:abiertos.length})}</span>
        )}
      </div>

      {/* La rejilla de los doce puntos NO va aquí. Verificar el 1003 es
          la revisión que hace Tina antes de registrar; un LO marcándola
          deja el nombre equivocado en el papel que va a Barrett. El LO ve
          el conteo en el resumen de arriba y el detalle en PROCESAMIENTO. */}

      {abiertos.length===0&&<div style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{TX("findingNone")}</div>}

      {abiertos.map(f=>{
        const w=waitingMeta(f.waitingOn), edad=findingAge(f);
        return (
          <div key={f.id} style={{background:"var(--bg)",borderLeft:"2px solid var(--bad)",
            borderRadius:"0 5px 5px 0",padding:"8px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{P(gate1Item(f.item))}</span>
              <span style={{fontSize:"var(--fs-2)",color:w?.color||"var(--t2)"}}>{P(w)}</span>
            </div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t1)",lineHeight:1.5,margin:"3px 0"}}>{f.text}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{fontSize:"var(--fs-1)",color:edad>=7?"var(--bad)":"var(--t3)"}}>
                {f.at}{f.by?" · "+String(f.by).split(" ")[0]:""}
                {edad!==null?" · "+TX("findingDaysOpen",{n:edad}):""}
              </span>
              {/* Un LO cierra lo que se espera de ÉL. Si el hallazgo espera
                  a procesamiento o al lender, cerrarlo desde aquí taparía
                  trabajo que no hizo. */}
              {(profile?.role!=="lo"||f.waitingOn==="lo")?(
                <button className="hov" onClick={()=>{
                    const n=resolveFinding(file,f.id,{by:profile?.name||null});
                    onSave({findings:n.findings});
                  }}
                  style={{background:"var(--s2)",border:"1px solid var(--mint)",borderRadius:4,color:"var(--mint)",
                    fontSize:"var(--fs-1)",padding:"3px 9px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>
                  {TX("findingResolve")}
                </button>
              ):(
                <span style={{fontSize:"var(--fs-1)",color:"var(--t4)",fontFamily:"var(--ff-mono)"}}>
                  {TX("findingNotYours",{w:P(waitingMeta(f.waitingOn))})}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {!open?(
        <button className="hov" onClick={()=>setOpen(true)}
          style={{background:"transparent",border:"1px dashed var(--bd)",borderRadius:5,color:"var(--t2)",
            fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",padding:"7px 0",width:"100%",cursor:"pointer"}}>
          {TX("findingAdd")}
        </button>
      ):(
        <div style={{background:"var(--bg)",border:"1px solid var(--s2)",borderRadius:6,
          padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
          <div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("findingItem")}</div>
            <select value={item} onChange={e=>setItem(e.target.value)} style={fs}>
              {GATE1_ITEMS.map(g=><option key={g.id} value={g.id}>{P(g)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("findingWhat")}</div>
            <input value={text} onChange={e=>setText(e.target.value)}
              placeholder={TX("findingWhatPlaceholder")} style={fs}/>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("findingWaiting")}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {WAITING_IDS.map(id=>{
                const on=waiting===id,m=FINDING_WAITING[id];
                return (
                  <button key={id} className="hov" onClick={()=>setWaiting(id)}
                    style={{background:on?m.color:"transparent",color:on?"var(--bg)":m.color,
                      border:`1px solid ${m.color}`,borderRadius:5,padding:"4px 9px",fontSize:"var(--fs-2)",
                      fontFamily:"var(--ff-mono)",cursor:"pointer"}}>{P(m)}</button>
                );
              })}
            </div>
          </div>
          {!text.trim()&&<div style={{fontSize:"var(--fs-1)",color:"var(--gold)"}}>{TX("findingNeedsText")}</div>}
          <div style={{display:"flex",gap:7}}>
            <button className="hov" disabled={!text.trim()}
              onClick={()=>{
                const n=addFinding(file,{item,text,waitingOn:waiting,by:profile?.name||null});
                onSave({findings:n.findings, gate1:n.gate1});
                setText(""); setOpen(false);
              }}
              style={{flex:2,background:text.trim()?"var(--bad)":"var(--s1)",
                color:text.trim()?"var(--bg)":"var(--bd)",borderRadius:6,padding:"8px 0",
                fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",
                cursor:text.trim()?"pointer":"not-allowed"}}>{TX("findingSave")}</button>
            <button className="hov" onClick={()=>{setOpen(false);setText("");}}
              style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:6,padding:"8px 0",
                fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:"none",cursor:"pointer"}}>{TX("cancel")}</button>
          </div>
        </div>
      )}

      {cerrados.length>0&&(
        <div style={{borderTop:"1px solid var(--s2)",paddingTop:8}}>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            {TX("findingHistory")} · {cerrados.length}
          </div>
          {cerrados.slice().reverse().map(f=>(
            <div key={f.id} style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginBottom:4,lineHeight:1.5}}>
              <span style={{color:"var(--t3)"}}>{P(gate1Item(f.item))}</span> · {f.text}
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
                {TX("findingResolved",{d:f.resolvedAt,who:String(f.resolvedBy||"").split(" ")[0]})}
                {findingAge(f)!==null?" · "+TX("findingTookDays",{n:findingAge(f)}):""}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",lineHeight:1.5}}>{TX("findingsHint")}</div>
    </div>
  );
}

function DetailModal({file,profile,allFiles,L,lang,onSetLang,abrirEn,irA,onClose,onSave,onStagePick,onDelete,onAdvance,onCloseFile,onReopen,onPrep,onArchive,onRestore,onContinuePrep,isClosed}){
  const isAdmin = profile?.role === "admin";
  const isAssistant = profile?.role === "assistant";
  const [showHistory, setShowHistory] = useState(false);
  // ─── SOLAPAS ───
  // Dieciocho bloques en una columna de 480px con scroll infinito. El
  // campo que mas se toca —la etapa— quedaba en la pantalla once de doce.
  //
  // Cinco solapas en el orden en que se trabaja un archivo, y una regla
  // que no se rompe en ninguna: IZQUIERDA lo que capturas, DERECHA lo
  // que el sistema deriva. El ojo lo aprende una vez.
  // Abre en FILE: es donde estan las notas y lo primero que uno quiere
  // leer al abrir un archivo — que paso, quien dijo que. El ORDEN de las
  // solapas sigue contando la historia del prestamo (que es, con quien,
  // contra que reloj, cuanto deja, y el expediente que lo acompaña),
  // pero se aterriza en la ultima.
  const [tab, setTab] = useState(abrirEn || "file");
  // Llegada desde una puerta con el modal YA abierto. `abrirEn` solo se lee
  // al montar, asi que sin esto cambiar de solapa desde fuera no hacia nada.
  // `irA.n` cambia en cada salto: pedir dos veces el mismo destino tiene que
  // volver a moverse.
  useEffect(()=>{
    if(!irA) return;
    if(irA.tab) setTab(irA.tab);
    // La solapa se esta montando y el ancla aun no existe en el DOM.
    // `irAlAncla` reintenta sola; esto solo da el primer empujon.
    const t=setTimeout(()=>irAlAncla(irA.ancla),90);
    return ()=>clearTimeout(t);
  },[irA]);
  // Segundo recorrido: solo sobre el archivo de entrenamiento. En un
  // archivo real no aparece, asi que no estorba a quien ya sabe.
  const enTour = isTraining(file);
  const tourDet = useTour(profile, enTour, "detail");
  useTourTab(tourDet.step, setTab, enTour);
  // Whatever the sub-panels are currently showing, ready for the single SAVE.
  const panelDrafts = useRef({});
  // Los bps que el bloque de lender tiene escritos pero aún no guardados. Con
  // solo el ref, el bloque de compensación seguía mostrando el valor viejo —
  // dos bloques en la misma pantalla con dos cifras de dinero distintas.
  const [pendingBps,setPendingBps] = useState(null);
  const [showChange,setShowChange]=useState(false);
  // Pie colapsado en el telefono. Arriba de los return tempranos por las
  // reglas de hooks — la pantalla blanca del 1 de septiembre salio de eso.
  const [accOpen,setAccOpen]=useState(false);
  // Borrador del campo de fecha del CD: sin el, teclear el año borra el día.
  const [cdDraft,setCdDraft]=useState(null);
  // El 1003 es del LO. El admin tambien, porque origina. Procesamiento lo
  // ve y levanta hallazgos, pero no marca los puntos.
  const puede1003 = profile?.role === "lo" || profile?.role === "admin";
  const [chkBusy,setChkBusy]=useState(false);
  const [showCancel,setShowCancel]=useState(false);
  const [newNote,setNewNote]=useState("");
  const [showAllNotes,setShowAllNotes]=useState(false);
  const entries=noteEntries(file);
  const [closing,setClosing]=useState(file.closing||"");
  const [stage,setStage]=useState(file.stage);
  // Si el archivo cambia de etapa por debajo (ADVANCE, override), el menu
  // sigue el cambio. Sin esto la pantalla se queda en la etapa vieja.
  useEffect(()=>{ setStage(file.stage); },[file.stage]);

  // ─── CERRAR SIN PERDER NADA ───
  // Escape no cerraba la ventana, y el clic en el fondo la cerraba en
  // silencio aunque hubiera cambios a medias. Ahora las tres salidas (✕,
  // fondo y Escape) pasan por aquí: si se escribió algo desde que se abrió,
  // pregunta antes de tirarlo. GUARDAR sigue cerrando directo.
  // "Escribió algo" = cualquier cambio en un campo de la ventana. Algunos
  // bloques guardan solos al tocarlos; en esos la pregunta sobra, pero
  // preguntar de más cuesta un clic y no preguntar cuesta el trabajo.
  const sucio=useRef(false);
  const cerrar=()=>{
    if(sucio.current && !window.confirm(TX("dmDiscardAsk"))) return;
    onClose();
  };
  const cerrarRef=useRef(cerrar);
  cerrarRef.current=cerrar;
  const subVentana=showCancel||showChange;
  useEffect(()=>{
    if(subVentana) return;     // Escape es de la ventanita de encima
    const tecla=e=>{ if(e.key==="Escape"&&!e.defaultPrevented) cerrarRef.current(); };
    document.addEventListener("keydown",tecla);
    return ()=>document.removeEventListener("keydown",tecla);
  },[subVentana]);

  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan||""));
  const [bps,setBps]=useState(String(file.bps||""));
  const [loAssigned,setLoAssigned]=useState(file.lo||"Jose Del Valle");
  const [referralPartner,setReferralPartner]=useState(file.referralPartner||"");
  // Un archivo que ya trae procesadora conserva la suya. Uno que nunca la
  // tuvo y todavia no cerro arranca en la de trabajo nuevo — Laura tomo el
  // relevo de Martha. Los cerrados se quedan con quien los proceso.
  const [processor,setProcessor]=useState(
    file?.processor ? processorId(file)
      : (okDate(file?.closedAt) ? DEFAULT_PROCESSOR : NEW_FILE_PROCESSOR));
  const [chkDraft,setChkDraft]=useState(!!file.brokerCheckReceived);
  const [compDraft,setCompDraft]=useState(()=>({...(file.compliance||{})}));
  const [phone,setPhone]=useState(file.phone||"");
  const [email,setEmail]=useState(file.email||"");
  // El nombre NO tenia campo en ninguna parte fuera de la pantalla de crear
  // archivo: para corregir una letra habia que borrar el archivo y volver a
  // escribirlo entero. El `id` es `f{timestamp}` y no sale del nombre, asi
  // que cambiarlo no arrastra nada — las cartas, el checklist de Barrett y
  // el export de Martha leen `file.borrower` en vivo y se corrigen solos.
  const [borrower,setBorrower]=useState(file.borrower||"");
  const [closedAt,setClosedAt]=useState(file.closedAt||"");

  // Outbound referral (when stage = REFERRED_OUT_STAGE)
  const ro = file.referredOut || {};
  const [outBankerName,setOutBankerName]=useState(ro.bankerName||"");
  const [outBankerCompany,setOutBankerCompany]=useState(ro.bankerCompany||"");
  const [outBankerPhone,setOutBankerPhone]=useState(ro.bankerPhone||"");
  const [outBankerEmail,setOutBankerEmail]=useState(ro.bankerEmail||"");
  const [outReason,setOutReason]=useState(ro.reason||"");
  const [outStatus,setOutStatus]=useState(ro.status||"Pending at Banker");
  const [outFinalLoan,setOutFinalLoan]=useState(String(ro.finalLoanAmount||""));
  const [outCloseDate,setOutCloseDate]=useState(ro.closeDate||"");

  // Inbound referral metadata (when isInbound is true)
  const rb = file.referringBanker || {};
  const [inBankerName,setInBankerName]=useState(rb.bankerName||"");
  const [inBankerCompany,setInBankerCompany]=useState(rb.bankerCompany||"");
  const [inBankerPhone,setInBankerPhone]=useState(rb.bankerPhone||"");
  const [inBankerEmail,setInBankerEmail]=useState(rb.bankerEmail||"");

  const ph=getPhase(stage);
  const isReferredOut = stage === REFERRED_OUT_STAGE;
  const inPrep = stage === PREP_STAGE;
  const archivedFile = !!file.archived;
  const isInbound = !!file.isInbound;
  const fs2={background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t1)",padding:"8px 10px",fontSize:"var(--fs-5)",fontFamily:"var(--ff-body)",width:"100%"};

  // Live fee calculations for referred-out files
  const finalLoanForCalc = parseInt(outFinalLoan)||parseInt(loanAmt)||file.loan||0;
  const feeEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * REFERRAL_FEE_BPS / 10000) : 0;
  const wouldHaveEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * (parseInt(bps)||BPS_RATE) / 10000) : 0;
  const lostComp = wouldHaveEarned - feeEarned;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={cerrar}>
      {/* De 480px a casi toda la pantalla. Los dieciocho bloques cabian
          en una columna angosta solo a costa de un scroll interminable;
          con ancho de verdad caben en dos columnas y cinco solapas. */}
      <div className="fi" role="dialog" aria-modal="true" aria-label={file.borrower} style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:12,width:"100%",maxWidth:1240,height:"calc(100vh - 32px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}
        onChangeCapture={()=>{sucio.current=true;}}>
        {/* ENCABEZADO — cada dato con su etiqueta. Antes decia
            "FHA $450,655 eLend Jose Martha" de corrido y habia que
            adivinar quien era quien. */}
        <div className="dm-head" style={{padding:"14px 22px 12px",display:"flex",justifyContent:"space-between",
          alignItems:"flex-start",gap:20,flexWrap:"wrap",flexShrink:0,position:"relative"}}>
          <div style={{minWidth:0}}>
            <div className="dm-name" style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.4px"}}>
              {/* Sigue al campo mientras se teclea. El input vive en la solapa
                  PRESTAMO y no aqui: el encabezado tiene su propio CSS de
                  movil (`.dm-name`, `.dm-strip`) y meterle un input rompe el
                  apilado. */}
              {borrower.trim()||file.borrower}
              {isInbound&&<span title="Inbound referral" style={{marginLeft:9,fontSize:"var(--fs-4)",color:"var(--yellow)"}}>🤝</span>}
            </div>
            {/* En el telefono los cinco campos con etiqueta se comen media
                pantalla. Se reemplazan por una tira de una linea; el dato
                completo vive adentro de las solapas. */}
            <div className="dm-strip">
              {loanType} · ${parseInt(loanAmt||0).toLocaleString()}
              {lenderNameOf(file)?` · ${lenderNameOf(file)}`:""}
              {loAssigned?` · ${String(loAssigned).split(" ")[0]}`:""}
            </div>
            <div className="dm-facts" style={{display:"flex",gap:26,marginTop:11,flexWrap:"wrap"}}>
              {[
                [TX("hdProduct"), loanType, "var(--t1)"],
                [TX("hdAmount"),  "$"+parseInt(loanAmt||0).toLocaleString(), "var(--t1)"],
                ...(lenderNameOf(file)?[[TX("hdLender"), lenderNameOf(file), "var(--t1)"]]:[]),
                [TX("hdLo"), loAssigned||"—", "var(--t2)"],
                ...(!inPrep&&!isReferredOut?[[TX("hdProcessor"), processorOf(file).full, "var(--t2)"]]:[]),
              ].map(([lbl,val,col])=>(
                <div key={lbl}>
                  <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{lbl}</div>
                  <div style={{fontSize:"var(--fs-3)",color:col}}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dm-hright" style={{display:"flex",gap:24,alignItems:"flex-start"}}>
            {!inPrep&&!isReferredOut&&(
              <div className="dm-hstage" style={{textAlign:"right"}}>
                <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{TX("hdStage")}</div>
                <div style={{fontSize:"var(--fs-4)",color:ph.color}}>{stage}</div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
                  {daysInStage(file)===null?"—":`${daysInStage(file)}d`}
                  {(()=>{const e=stageCeilingLabel(file.stage,file,lang);return e?` · ${e}`:"";})()}
                </div>
              </div>
            )}
            {closing&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{TX("hdClosing")}</div>
                <div style={{fontSize:"var(--fs-4)",color:"var(--gold)"}}>{md(closing)}</div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
                  {(()=>{const d=daysTil(closing);
                    return d===null?"":d===0?TX("closingToday"):d>0?TX("hdInDays",{n:d}):TX("pastDue");})()}
                </div>
              </div>
            )}
            {/* RITMO — el sistema ya sabia que iba adelantado y no lo
                decia. Solo hablaba cuando algo se atrasaba. */}
            {(()=>{const p=filePace(file);
              if(!p.ready||p.state==="onplan") return null;
              const col=signalColor(p.signal);
              return (
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{TX("hdPace")}</div>
                  <div style={{fontSize:"var(--fs-4)",color:col}}>
                    {p.state==="ahead"?"▲":"▼"} {TX("paceDays",{n:p.days})}
                  </div>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
                    {p.state==="ahead"?TX("paceAhead"):TX("paceBehind")}
                  </div>
                </div>
              );})()}
            {/* IDIOMA — vivía en el pie, pegado a BORRAR: uno iba a cambiar a
                inglés y tenía al lado lo único que no se deshace. Arriba,
                junto a la ✕, queda con los otros ajustes de la ventana.
                Cambia la preferencia de quien lo toca, no del archivo. */}
            {onSetLang&&(
              <div className="dm-lang" style={{display:"flex",border:"1px solid var(--bd)",borderRadius:6,overflow:"hidden",marginTop:2}}>
                {["es","en"].map(l=>(
                  <button key={l} className="hov" onClick={()=>onSetLang(l)}
                    title={TX("langHint")}
                    style={{background:lang===l?"var(--gold)":"transparent",
                      color:lang===l?"var(--bg)":"var(--t2)",border:"none",padding:"5px 9px",
                      fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                    {l.toUpperCase()}
                  </button>))}
              </div>
            )}
            <button className="dm-x" onClick={cerrar} aria-label={TX("dmClose")} title={TX("dmCloseHint")}
              style={{background:"transparent",border:"none",color:"var(--t3)",
              fontSize:"var(--fs-8)",cursor:"pointer",padding:"2px 0 0 4px",lineHeight:1}}>✕</button>
          </div>
        </div>

        {/* ETAPA — el campo que mas se toca. Estaba al fondo de la solapa
            PRÉSTAMO, despues del DPA y del BPS. Aqui se cambia desde
            cualquier solapa sin ir a buscarlo. */}
        {/* A la DERECHA, en la misma columna del ojo que la etapa del
            encabezado: ves el estado arriba y lo corriges abajo sin
            cruzar la pantalla. Y la izquierda, que ya carga nombre,
            producto, monto, lender, LO y procesadora, se descarga. */}
        {!isClosed&&!inPrep&&!isReferredOut&&(
          <div className="dm-etapa" style={{padding:"9px 22px",borderTop:"1px solid var(--s2)",
            display:"flex",alignItems:"center",gap:11,flexShrink:0,justifyContent:"flex-end"}}>
            <span style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
              {daysInStage(file)===null?"—":`${daysInStage(file)}d`}
              {(()=>{const e=stageCeilingLabel(file.stage,file,lang);return e?` · ${e}`:"";})()}
            </span>
            <span style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)"}}>{TX("hdStage")}</span>
            <select value={stage} onChange={e=>{
                // Si la puerta frena, el menu no se mueve: dejarlo cambiado
                // mostraria una etapa que el archivo no tiene.
                if(onStagePick && !onStagePick(e.target.value)) return;
                setStage(e.target.value);
                onSave(stagePatch(file, e.target.value));}}
              style={{background:"var(--bg)",border:`1px solid ${ph.color}`,borderRadius:6,
                color:ph.color,padding:"7px 11px",fontSize:"var(--fs-4)",fontFamily:"var(--ff-mono)",
                minWidth:280,cursor:"pointer"}}>
              {ALL_STAGES.map((s,i)=><option key={i} value={s.stage} style={{color:s.phase.color,background:"var(--bg)"}}>[{s.phase.short}] {s.stage}</option>)}
              <optgroup label="── Bank-to-Bank Referral ──">
                <option value={REFERRED_OUT_STAGE} style={{color:"var(--violet)",background:"var(--bg)"}}>🔀 REFERRED OUT — EXTERNAL BANK</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* SOLAPAS — estiradas a todo el ancho, en seis partes iguales (eran
            cinco columnas para seis solapas y EXPEDIENTE caía sola abajo).
            La activa lleva fondo Y barra dorada: solo con el subrayado se
            perdian entre el resto del texto. */}
        <div className="dm-tabs" style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",
          borderTop:"1px solid var(--s2)",borderBottom:"1px solid var(--s2)",
          background:"var(--bg)",flexShrink:0}}>
          {/* Sin contadores. Un numero rojo sin explicacion asusta pero no
              informa — vuelven cuando la guia enseñe que significan. */}
          {[
            ["loan",  TX("tabLoan")],
            ["lender",TX("tabLender")],
            ["dates", TX("tabDates")],
            ["money", TX("tabMoney")],
            ["docs",  TX("subTab")],
            ["file",  TX("tabFile")],
          ].map(([id,label],i)=>{
            const on=tab===id;
            return (
              <button key={id} className="hov dm-tab" data-tour={id} onClick={()=>setTab(id)}
                style={{background:on?"var(--s1)":"transparent",border:"none",cursor:"pointer",
                  color:on?"var(--gold)":"var(--t2)",fontSize:"var(--fs-3)",fontFamily:"var(--ff-title)",
                  fontWeight:on?800:500,letterSpacing:"1.6px",padding:"12px 0",
                  textAlign:"center",borderRight:i<5?"1px solid var(--s2)":"none",
                  boxShadow:on?"inset 0 -2px 0 var(--gold)":"none",
                  transition:"color .12s"}}>
                {label}
              </button>
            );
          })}
        </div>

        {enTour && (
          <div style={{padding:"12px 22px 0"}}>
            <TourPanel profile={profile} lang={lang} tour={tourDet} onExit={onClose}/>
          </div>
        )}

        {/* CUERPO — retícula fija 53/47. Los bloques se reparten por
            solapa; dentro de cada una, las columnas se llenan solas y en
            móvil se apilan. */}
        <div className="dm-body" style={{flex:1,overflowY:"auto",padding:"16px 22px",display:"grid",
          gridTemplateColumns:"minmax(0,53fr) minmax(0,47fr)",gap:14,alignItems:"start",alignContent:"start"}}>
        {/* ESTRUCTURA — lo que define el prestamo. Columna izquierda. */}
        <div style={{display:tab==="loan"?"grid":"none",gridTemplateColumns:"1fr 1fr",gap:10,alignSelf:"start"}}>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("loanType")}</div>
            <select value={loanType} onChange={e=>setLoanType(e.target.value)} style={fs2}>
              {LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(lt=><option key={lt}>{lt}</option>)}</optgroup>)}
              {/* Un archivo viejo puede traer un tipo que ya no esta en el
                  catalogo — los 39 DPA estatales de PRMG. Sin esta opcion el
                  select saldria en blanco y guardar encima le cambiaria el
                  producto en silencio. */}
              {loanType&&!LOAN_TYPES.includes(loanType)&&(
                <optgroup label={TX("legacyType")}>
                  <option value={loanType}>{loanType}</option>
                </optgroup>
              )}
            </select>
            {loanType&&!LOAN_TYPES.includes(loanType)&&(
              <div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:4,lineHeight:1.5}}>
                {TX("legacyTypeHint")}
              </div>
            )}
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("loanAmount")}</div>
            <input value={loanAmt} onChange={e=>setLoanAmt(e.target.value)} placeholder="350000" style={fs2}/>
          </div>
          {/* El DPA es parte de COMO ESTA ARMADO el prestamo, igual que el
              tipo y el monto. Pegado al tipo, la contradiccion salta a la
              vista; separado por media pantalla, no. */}
          {!inPrep && !isReferredOut && (
            <div style={{gridColumn:"1/-1"}}>
              <DpaPanel file={file} lang={lang} readOnly={isAssistant}
                onSave={next=>onSave({dpa:next.dpa})}/>
            </div>
          )}
          {isAdmin && (
            <div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("bpsComp")} <span style={{color:"var(--gold)"}}>{TX("reportedByDash")}</span></div>
              <input value={bps} onChange={e=>setBps(e.target.value)} placeholder="150" style={{...fs2,color:"var(--gold)"}}/>
            </div>
          )}
          {isAdmin && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:2}}>
                {TX("bpsFieldHint",{n:BPS_RATE})}
              </div>
            </div>
          )}
        </div>

        {/* EQUIPO Y CLIENTE — quien lo trabaja y como se le contacta.
            Columna derecha, para que las dos se llenen en vez de dejar
            media pantalla vacia al lado de un bloque estirado. */}
        <div style={{display:tab==="loan"?"grid":"none",gridTemplateColumns:"1fr 1fr",gap:10,alignSelf:"start"}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("loanOfficer")}</div>
            {(()=>{const dentro=LO_LIST.some(x=>x.name===loAssigned);
              return (<>
                <select value={loAssigned} onChange={e=>setLoAssigned(e.target.value)}
                  style={{...fs2, ...(dentro?{}:{borderColor:"var(--bad)",color:"var(--bad)"})}}>
                  {orphanOption(loAssigned,dentro,TX("notInList"))}
                  {/* Solo los activos. Quien salio del equipo sigue saliendo
                      en sus archivos viejos y en produccion, pero no se le
                      puede dar uno nuevo. */}
                  {LO_ASSIGNABLE.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}
                </select>
                {!dentro&&<div style={{fontSize:"var(--fs-1)",color:"var(--bad)",marginTop:3,
                  lineHeight:1.45}}>{TX("notInListHint")}</div>}
              </>);})()}
          </div>
          {!inPrep && !isReferredOut && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("processor")}</div>
              {isAdmin?(
                (()=>{const dentro=PROCESSOR_IDS.includes(processor);
                  return (<>
                    <select value={processor} onChange={e=>setProcessor(e.target.value)}
                      style={{...fs2, ...(dentro?{}:{borderColor:"var(--bad)",color:"var(--bad)"})}}>
                      {orphanOption(processor,dentro,TX("notInList"))}
                      {PROCESSOR_IDS.map(id=>(
                        <option key={id} value={id}>{PROCESSORS[id].full}</option>
                      ))}
                    </select>
                    {!dentro&&<div style={{fontSize:"var(--fs-1)",color:"var(--bad)",marginTop:3,
                      lineHeight:1.45}}>{TX("notInListHint")}</div>}
                  </>);})()
              ):(
                <div style={{fontSize:"var(--fs-4)",color:processorOf(file).color}}>{processorOf(file).full}</div>
              )}
              {isRegistered(file)&&(
                <div style={{fontSize:"var(--fs-2)",color:"var(--mint)",marginTop:4}}>
                  {L("registeredOn",{d:registeredAt(file)})}
                  {registeredBy(file)?L("registeredBy",{who:String(registeredBy(file)).split(" ")[0]}):""}
                  {registrationCount(file)>1?` · ${L("registerTimes",{n:registrationCount(file)})}`:""}
                </div>
              )}
              {/* El lender cambió y el archivo volvió a Tina. Dorado: se
                  avecina un trabajo, nada está roto todavía. */}
              {needsReRegistration(file)&&(
                <div style={{fontSize:"var(--fs-2)",color:"var(--gold)",marginTop:4,lineHeight:1.5}}>
                  {L("reRegisterNeeded",{n:lenderNameOf(file)||"—"})}
                </div>
              )}
              {/* El botón existía en el motor y en el diccionario desde la
                  tanda del registro, pero ningún componente lo renderizaba:
                  `registeredAt` estaba vacío en TODOS los archivos y las
                  columnas 13 y 17 de Martha vivían del respaldo de stageLog. */}
              {/* Sin lender el boton NO se esconde: se queda apagado diciendo
                  que falta. Registrar es registrar CON alguien — no es una
                  accion desaconsejable, es imposible, asi que tampoco pregunta
                  "de todas formas". El boton es el mensaje. */}
              {/* LA PUERTA. Los documentos se juntan ANTES de registrar:
                  cuando el archivo llega a underwriting ya está todo en
                  mano, y por eso el presupuesto de 24 días se sostiene.
                  NO bloquea — un bloqueo duro se salta poniendo marcas
                  falsas, y ahí se pierde el dato. */}
              {registerReady(file)&&(isAdmin||isAssistant)&&(()=>{
                const cov=submissionCoverage(file);
                if(!cov.total) return null;
                const ok=cov.complete;
                return (
                  <div style={{marginTop:9,background:ok?"rgba(126,200,164,.08)":"rgba(245,166,35,.08)",
                    border:`1px solid ${ok?"var(--mint)":"var(--gold)"}55`,borderRadius:6,
                    padding:"9px 11px"}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:"var(--fs-1)",color:"var(--t4)",
                        letterSpacing:"1px"}}>{TX("subGate")}</span>
                      <span style={{marginLeft:"auto",fontFamily:"var(--ff-mono)",
                        fontSize:"var(--fs-2)",color:ok?"var(--mint)":"var(--gold)"}}>
                        {cov.held}/{cov.total}
                      </span>
                    </div>
                    <div style={{fontSize:"var(--fs-2)",color:ok?"var(--mint)":"var(--gold)",
                      marginTop:3,lineHeight:1.5}}>
                      {ok?TX("subGateOk"):TX("subGateShort",{n:cov.missing,t:cov.total})}
                    </div>
                    {!ok&&<div className="sys" style={{marginTop:4}}>{TX("subGateWhere")}</div>}
                  </div>
                );})()}

              {registerBlocked(file)&&(isAdmin||isAssistant)&&(
                <div title={TX("registerNoLenderHint")}
                  style={{marginTop:7,width:"100%",background:"transparent",
                    color:"var(--gold)",borderRadius:6,padding:"8px 0",fontFamily:"var(--ff-mono)",
                    fontSize:"var(--fs-3)",border:"1px dashed #F5A62366",textAlign:"center",
                    cursor:"default"}}>
                  {TX("registerNoLender")}
                </div>
              )}
              {registerReady(file)&&(isAdmin||isAssistant)&&(
                <button className="hov" id="fix-register"
                  onClick={()=>{
                    if(!confirm(TX("registerConfirm",{p:processorOf(file).full}))) return;
                    let n=stampRegistration(file,profile?.name||null);
                    // Si la puerta estaba completa, se sella. `closingOutlook`
                    // lleva leyendo `gate1CompletedAt` desde el principio para
                    // calcular el riesgo de la promesa, y nunca lo escribió nadie.
                    if(submissionReady(file)) n=stampSubmissionComplete(n,profile?.name||null);
                    setStage(n.stage);
                    onSave({stage:n.stage, stageEnteredAt:n.stageEnteredAt, daysInStage:0,
                      stageLog:n.stageLog, fileOpenedAt:n.fileOpenedAt,
                      registrations:n.registrations, registeredAt:n.registeredAt,
                      registeredBy:n.registeredBy, processor:n.processor,
                      gate1CompletedAt:n.gate1CompletedAt||null,
                      gate1CompletedBy:n.gate1CompletedBy||null});
                  }}
                  title={TX("registerHint")}
                  style={{marginTop:7,width:"100%",background:"rgba(126,200,164,.1)",
                    color:"var(--mint)",borderRadius:6,padding:"8px 0",fontFamily:"var(--ff-mono)",
                    fontSize:"var(--fs-3)",border:"1px solid var(--mint)",cursor:"pointer"}}>
                  {TX("register")}
                </button>
              )}
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,lineHeight:1.5}}>
                {L("processorHint")}
                {PROCESSORS[processor]?.external?" · "+L("processorExternal"):""}
              </div>
            </div>
          )}
          {/* NOMBRE DEL CLIENTE. Va con telefono y correo porque es el mismo
              bloque de identidad, y se guarda con el mismo SAVE. En blanco NO
              se guarda: se conserva el anterior, que es lo unico sensato
              cuando alguien borra el campo sin querer. */}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{TX("nameLabel")}</div>
            <input value={borrower} onChange={e=>setBorrower(e.target.value)}
              placeholder={TX("phLegalName")} style={fs2}/>
            {!borrower.trim()&&(
              <div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:4}}>{TX("nameEmpty")}</div>
            )}
            {borrower.trim()&&borrower.trim()!==file.borrower&&isRegistered(file)&&(
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,lineHeight:1.5}}>
                {TX("nameRegistered")}
              </div>
            )}
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("referralPartner")}</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)}
              list="socios-conocidos" placeholder={TX("partnerPlaceholder")} style={fs2}/>
            <datalist id="socios-conocidos">
              {knownPartners(allFiles||[]).map(n=><option key={n} value={n}/>)}
            </datalist>
            {referralPartner.trim()&&!knownPartners(allFiles||[]).some(n=>canonicalPartner(n)===canonicalPartner(referralPartner))&&(
              <div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:4}}>{TX("newPartner")}</div>
            )}
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 {TX("phone")}</div>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={fs2}/>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ {TX("email")}</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={TX("phEmail")} style={fs2}/>
          </div>
        </div>

        {/* LENDER — chosen at Full Application; the channel gates the list */}
        {tab==="lender" && !inPrep && !isReferredOut && (atOrPastFullApp(stage) || hasLenderData(file)) && (
          <div id="fix-lender" style={{gridColumn:"1/-1"}}>
          <LenderPanel file={file} profile={profile}
            onDraft={p=>{panelDrafts.current.lender=p; setPendingBps(p.bps ?? null);}}
            onChangeLender={()=>setShowChange(true)}/>
          </div>
        )}


        {/* ADMISION — el LO las sabe al precalificar. La procesadora las
            completa si faltan, pero la captura nace aqui. */}
        {/* DOCUMENTOS. Solapa propia porque el bloque es largo y porque
            lo trabajan el LO y Laura, no procesamiento. Antes vivia solo
            en la pantalla de dos paneles, donde el LO no entra. */}
        {tab==="docs" && !inPrep && !isReferredOut && (
          <div style={{gridColumn:"1 / -1"}}>
            <SubmissionPane file={file} lang={lang}
              onSave={next=>onSave({submissionDocs:next.submissionDocs||null,
                docFlags:next.docFlags||null})}
              who={profile?.name||null} readOnly={false}/>
            <LettersPanel file={file} lang={lang} who={profile?.name||null} onSave={onSave}/>
          </div>
        )}

        {tab==="file" && !inPrep && !isReferredOut && (
          <div style={{background:"rgba(189,101,232,.04)",border:"1px solid #BD65E833",
            borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10,
            gridRow:"span 3"}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--purple)",
              letterSpacing:"1px"}}>{L("intake")}</span>
            {/* La admisión la captura el LO al precalificar y la COMPLETA
                procesamiento si falta algo — lo dice el propio texto del
                bloque. `readOnly={isAssistant}` bloqueaba justamente a Tina
                y a Laura, que son quienes la terminan. */}
            <IntakePane file={file} lang={lang} readOnly={false}
              onSave={next=>onSave({intake:next.intake})}/>
          </div>
        )}

        {/* HALLAZGOS — lo que alguien vio y sigue abierto */}
        {tab==="file" && !inPrep && !isReferredOut && (
          <FindingsPanel file={file} profile={profile} onSave={onSave}/>
        )}

        {/* ESTADO DE PROCESAMIENTO — RESUMEN, NO PANTALLA.
            Aquí vivía la pantalla completa de Martha: la rejilla de los doce
            puntos, los hitos, los números del préstamo y el resultado de UW,
            todos tocables. Era un error de montaje. Un LO que toca un botón
            ahí pisa el trabajo de otra persona, y el papel de Barrett acaba
            diciendo TX("reviewedBy") cuando quien revisó fue Tina.
            El LO ve el estado; el detalle vive en PROCESAMIENTO. */}
        {tab==="file" && !inPrep && !isReferredOut && (
          <div style={{background:"rgba(126,200,164,.04)",border:"1px solid #7EC8A433",
            borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:9}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
                color:"var(--mint)",letterSpacing:"1px"}}>{TX("procStatus")}</span>
              <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",
                color:"var(--t4)"}}>{puede1003?TX("gate1Yours"):TX("procReadOnly")}</span>
            </div>

            {/* La reja del 1003, tocable por su dueño. Tina y la procesadora
                la siguen viendo en PROCESSING y levantan hallazgos si algo
                sale mal — un hallazgo retira la marca verde. */}
            {puede1003&&(
              <div id="fix-gate1">
                <Gate1Grid file={file} lang={lang} who={profile?.name||null}
                  onSave={p2=>onSave(p2)} readOnly={false}/>
              </div>
            )}

            {(()=>{
              const cov=gate1Coverage(file);
              const hitos=visibleMilestones(file);
              const hechos=hitos.filter(m=>milestoneAt(file,m.id)).length;
              const res=uwOutcome(file);
              const dias=daysTil(closing);
              // Once puntos sin revisar en un archivo que firma en once días
              // es lo único que un LO necesita ver de aquí.
              const urgente=cov.pending>0&&dias!==null&&dias<=14;
              const fila=(label,valor,color)=>(
                <div style={{display:"flex",gap:10,fontSize:"var(--fs-2)",alignItems:"baseline"}}>
                  <span style={{color:"var(--t4)",minWidth:112}}>{label}</span>
                  <span style={{color:color||"var(--t2)",fontFamily:"var(--ff-mono)",flex:1}}>{valor}</span>
                </div>
              );
              return (<>
                {fila(TX("gate1Title"),
                  cov.pending===0&&cov.findings===0
                    ? TX("gate1AllDone",{t:cov.total})
                    : TX("gate1Coverage",{d:cov.done,t:cov.total,p:cov.pending}),
                  cov.findings>0||urgente?"#E85D75":cov.pending===0?"#7EC8A4":"#F5A623")}
                {fila(TX("sumRegister"),
                  isRegistered(file)
                    ? `${registeredAt(file)}${registeredBy(file)?" · "+String(registeredBy(file)).split(" ")[0]:""}`
                      + (discEsignedAt(file)?` · ${TX("discEsigned").toLowerCase()} ${discEsignedAt(file)}`:"")
                    : needsReRegistration(file) ? TX("reRegisterNeeded",{n:lenderNameOf(file)||"—"})
                    : TX("sumNone"),
                  isRegistered(file)?"#7EC8A4":needsReRegistration(file)?"#F5A623":"var(--t4)")}
                {fila(TX("uwResult"),
                  res?TX("uwResultOn",{o:P(uwOutcomeMeta(res)),d:uwOutcomeAt(file)}):TX("sumNone"),
                  res?signalColor(uwOutcomeMeta(res).signal):"var(--t4)")}
                {fila(TX("milestones"),
                  hitos.length?TX("sumOf",{a:hechos,b:hitos.length}):TX("sumNone"),
                  hechos===hitos.length&&hitos.length?"#7EC8A4":"var(--t4)")}
              </>);
            })()}

            {/* El papel sí es del BM: va al expediente y a payroll. */}
            {isAdmin&&(
              <button className="hov" disabled={chkBusy}
                onClick={async()=>{
                  setChkBusy(true);
                  try{ await downloadChecklist(file); }
                  catch{ alert(TX("chkFailed")); }
                  finally{ setChkBusy(false); }
                }}
                title={TX("chkHint")}
                style={{marginTop:2,width:"100%",background:"var(--s2)",
                  color:chkBusy?"var(--t4)":"var(--t2)",borderRadius:5,padding:"9px 0",
                  fontFamily:"var(--ff-mono)",fontSize:"var(--fs-2)",border:"1px solid var(--bd)",
                  cursor:chkBusy?"wait":"pointer"}}>
                {chkBusy?TX("chkBusy"):TX("chkPrint")}
              </button>
            )}
            <div className="sys">{TX("procWhere")}</div>
          </div>
        )}

        {/* COMPENSACIÓN — bruto, descuentos, neto y lo que cobra cada quien */}
        {tab==="money" && !inPrep && !isReferredOut && (
          <PayoutPanel file={file} profile={profile} allFiles={allFiles} pendingBps={pendingBps}
            onDraft={p=>{panelDrafts.current.payout=p;}}/>
        )}

        {/* REQUISITOS PARA COBRAR — Barrett no paga solo por fondear */}
        {tab==="money" && !inPrep && !isReferredOut && (
          <div style={{background:"rgba(74,144,217,.05)",border:"1px solid #4A90D933",borderRadius:8,
            padding:14,display:"flex",flexDirection:"column",gap:9}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>
                {TX("compliance")}
              </span>
              <span style={{marginLeft:"auto",fontSize:"var(--fs-2)",
                color:docsDone({compliance:compDraft})===PAYROLL_DOCS.length&&chkDraft?"var(--mint)":"var(--t2)"}}>
                {TX("docsOf",{a:docsDone({compliance:compDraft}),b:PAYROLL_DOCS.length})}
              </span>
            </div>

            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:"var(--fs-3)",
              color:chkDraft?"var(--mint)":"var(--t1)",cursor:"pointer"}}>
              <input type="checkbox" checked={chkDraft} onChange={e=>setChkDraft(e.target.checked)}
                style={{accentColor:"var(--mint)",cursor:"pointer"}}/>
              {TX("checkReceived")}
            </label>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:-4,marginLeft:21}}>{TX("checkWhere")}</div>

            <div style={{borderTop:"1px solid var(--s2)",paddingTop:8}}>
              {PAYROLL_DOCS.map(d=>(
                <label key={d.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:"var(--fs-3)",
                  color:compDraft[d.id]?"var(--mint)":"var(--t2)",cursor:"pointer",marginBottom:5}}>
                  <input type="checkbox" checked={!!compDraft[d.id]}
                    onChange={e=>setCompDraft({...compDraft,[d.id]:e.target.checked})}
                    style={{accentColor:"var(--mint)",cursor:"pointer"}}/>
                  {P(d)}
                </label>
              ))}
            </div>
            <div className="sys">{TX("complianceHint")}</div>
          </div>
        )}

        {/* CONTINGENCIES — captured at Full Application, anchored to the contract */}
        {tab==="dates" && !inPrep && !isReferredOut && (atOrPastUnderContract(stage) || hasContingencies(file)) && (
          <div style={{gridColumn:"1/-1"}}>
            <ContingencyPanel file={file} profile={profile} onSave={onSave}
              onDraft={p=>{panelDrafts.current.dates=p;}}/>
          </div>
        )}

        {/* EL CD. Lo emite el lender; aqui se confirma cuando salio. Dos
            actos de dos dueños: la fecha la ve quien abra el correo, los
            fees solo los revisa el LO. */}
        {tab==="dates" && !inPrep && !isReferredOut && atOrPastFullApp(stage) && (()=>{
          const salio=cdSentAt(file), recibe=cdReceivedAt(file);
          const escribiendo = cdDraft && !isValidISO(cdDraft);
          const primero=cdEarliestSigning(file), pronto=cdTooEarly(file);
          const feesAt=cdFeesReviewedAt(file);
          const esMiLo = profile?.role==="admin" || (profile?.role==="lo" && file.lo===profile?.name);
          const bx={background:"#0D1117",border:"1px solid #30363D",borderRadius:5,
            color:"var(--t1)",padding:"6px 9px",fontSize:"var(--fs-3)",
            fontFamily:"DM Mono",width:"100%"};
          return (
          <div style={{gridColumn:"1/-1",background:"rgba(189,101,232,.05)",
            border:"1px solid #BD65E844",borderRadius:8,padding:14,marginTop:12}}>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
              color:"var(--purple)",letterSpacing:"1px"}}>{TX("cdTitle")}</div>
            <div className="sys" style={{marginTop:4,marginBottom:11}}>{TX("cdLead")}</div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:11}}>
              <div id="fix-cd-sent">
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>
                  {TX("cdSent")}
                </div>
                <input type="date" value={cdDraft ?? (salio||"")}
                  style={{...bx,borderColor:escribiendo?"var(--gold)":"var(--bd)"}}
                  onChange={e=>{
                    const v=e.target.value;
                    setCdDraft(v);
                    // Solo se guarda cuando la fecha esta completa. A medias
                    // se queda en pantalla y no se pierde lo tecleado.
                    if(!v||isValidISO(v)) onSave(stampCdSent(file,v,profile?.name||null,cdDelivery(file)));
                  }}/>
                {escribiendo&&<div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:3}}>
                  {TX("typingYear")}
                </div>}
              </div>
              <div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>
                  {TX("cdHow")}
                </div>
                <div style={{display:"flex",gap:5}}>
                  {[["electronic",TX("cdElec")],["mail",TX("cdMail")]].map(([k,l])=>(
                    <button key={k} className="hov"
                      onClick={()=>salio&&onSave(stampCdSent(file,salio,profile?.name||null,k))}
                      style={{flex:1,background:cdDelivery(file)===k?"var(--purple)":"var(--s2)",
                        color:cdDelivery(file)===k?"var(--bg)":"var(--t2)",border:"none",
                        borderRadius:5,padding:"6px 4px",fontSize:"var(--fs-2)",
                        fontFamily:"var(--ff-mono)",cursor:salio?"pointer":"default"}}>{l}</button>
                  ))}
                </div>
                <div className="sys" style={{marginTop:4}}>
                  {cdDelivery(file)==="mail"?TX("cdMailNote"):TX("cdElecNote")}
                </div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>
                  {TX("cdReceived")}
                </div>
                <div style={{fontSize:"var(--fs-4)",color:recibe?"var(--purple)":"var(--t4)",
                  fontFamily:"var(--ff-mono)",padding:"6px 0"}}>{recibe||"—"}</div>
                {primero&&<div className="sys">{TX("cdEarliest",{d:primero})}</div>}
              </div>
            </div>

            {pronto&&(
              <div style={{marginTop:11,background:"rgba(189,101,232,.10)",
                border:"1px solid var(--purple)",borderRadius:6,padding:"9px 12px",
                fontSize:"var(--fs-3)",color:"var(--purple)",lineHeight:1.55}}>
                ⚖ {TX("cdTooEarly",{f:pronto.signing,d:pronto.earliest})}
              </div>
            )}

            <div id="fix-cd-fees" style={{marginTop:12,paddingTop:11,borderTop:"1px solid var(--s2)",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px"}}>
                {TX("cdFees")}
              </span>
              {feesAt?(
                <span style={{fontSize:"var(--fs-3)",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>
                  ✓ {TX("cdFeesBy",{d:feesAt,who:String(cdFeesReviewedBy(file)||"").split(" ")[0]})}
                </span>
              ):esMiLo?(
                <button className="hov" onClick={()=>onSave(stampCdFees(file,profile?.name||null))}
                  style={{background:"transparent",border:"1px solid var(--ok)",borderRadius:5,
                    color:"var(--ok)",padding:"5px 12px",fontSize:"var(--fs-2)",
                    fontFamily:"var(--ff-mono)",cursor:"pointer"}}>{TX("cdFeesMark")}</button>
              ):(
                <span style={{fontSize:"var(--fs-2)",color:"var(--t4)"}}>{TX("cdFeesWait")}</span>
              )}
              <span className="sys" style={{flexBasis:"100%"}}>{TX("cdFeesNote")}</span>
            </div>
          </div>);
        })()}

        {/* INBOUND REFERRAL SECTION — when file came from another banker */}
        {tab==="loan" && isInbound && (
          <div style={{background:"rgba(255,209,102,.06)",border:"1px solid #FFD16644",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--yellow)",letterSpacing:"1px"}}>🤝 INBOUND — REFERRING BANKER</span>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>who sent you this deal</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                <input value={inBankerName} onChange={e=>setInBankerName(e.target.value)} placeholder="John Doe" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                <input value={inBankerCompany} onChange={e=>setInBankerCompany(e.target.value)} placeholder="XYZ Mortgage" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 BANKER PHONE</div>
                <input type="tel" value={inBankerPhone} onChange={e=>setInBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ BANKER EMAIL</div>
                <input type="email" value={inBankerEmail} onChange={e=>setInBankerEmail(e.target.value)} placeholder="banker@company.com" style={fs2}/>
              </div>
            </div>
            {(inBankerPhone || inBankerEmail) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                {inBankerPhone && (
                  <a href={`tel:${inBankerPhone.replace(/[^\d+]/g,"")}`}
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"var(--yellow)",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {inBankerEmail && (
                  <a href={`mailto:${inBankerEmail}`}
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"var(--yellow)",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                    ✉ Email banker
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {tab==="loan" && inPrep&&(()=>{
          const p=file.prep||{}; const r=prepReasonById(p.reason);
          const dtr=prepDaysToReview(file); const age=prepAge(file); const locked=prepLocked(file);
          return(
            <div style={{background:"rgba(126,200,164,.06)",border:"1px solid #7EC8A444",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--mint)",letterSpacing:"1px"}}>⏸ IN PREPARATION</div>
              <div style={{fontSize:"var(--fs-4)",color:"var(--t1)"}}>{P(r.label)}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>
                {TX("mvReview")} {p.reviewOn||"—"} · <span style={{color:dtr<=0?"var(--bad)":"var(--t3)"}}>{dtr>0?TX("mvInDays",{n:dtr}):dtr===0?TX("mvToday"):TX("mvOverdue",{n:Math.abs(dtr)})}</span>
              </div>
              <div style={{fontSize:"var(--fs-3)",color:locked?"var(--bad)":"var(--t3)"}}>
                {age}d in preparation / {PREP_MAX_DAYS} max{p.reschedules>0?` · rescheduled ${p.reschedules}×`:""}
              </div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>Returns to: <span style={{color:"var(--t2)"}}>{p.prevStage||"Lead Inquiry"}</span></div>
              {p.note&&<div style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontStyle:"italic",borderTop:"1px solid var(--s2)",paddingTop:7}}>{p.note}</div>}
            </div>
          );
        })()}

        {/* OUTBOUND REFERRAL SECTION — when stage = REFERRED OUT */}
        {tab==="loan" && isReferredOut && (
          <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #A78BFA44",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--violet)",letterSpacing:"1px"}}>🔀 OUTBOUND — RECEIVING BANKER</span>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>who you sent this deal to</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                <input value={outBankerName} onChange={e=>setOutBankerName(e.target.value)} placeholder="Jane Smith" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                <input value={outBankerCompany} onChange={e=>setOutBankerCompany(e.target.value)} placeholder="ABC Mortgage" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 BANKER PHONE</div>
                <input type="tel" value={outBankerPhone} onChange={e=>setOutBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ BANKER EMAIL</div>
                <input type="email" value={outBankerEmail} onChange={e=>setOutBankerEmail(e.target.value)} placeholder="banker@company.com" style={fs2}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>REFERRAL REASON</div>
                <select value={outReason} onChange={e=>setOutReason(e.target.value)} style={fs2}>
                  <option value="">-- Select reason --</option>
                  {REFERRAL_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>STATUS</div>
                <select value={outStatus} onChange={e=>setOutStatus(e.target.value)} style={fs2}>
                  {REFERRAL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>CLOSE DATE (AT BANKER)</div>
                <input type="date" value={outCloseDate} onChange={e=>setOutCloseDate(e.target.value)} style={fs2}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>FINAL LOAN AMOUNT AT BANKER <span style={{color:"var(--t3)",fontWeight:400}}>· (may differ from original)</span></div>
                <input value={outFinalLoan} onChange={e=>setOutFinalLoan(e.target.value)} placeholder={String(file.loan||"350000")} style={fs2}/>
              </div>
            </div>
            {(outBankerPhone || outBankerEmail) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                {outBankerPhone && (
                  <a href={`tel:${outBankerPhone.replace(/[^\d+]/g,"")}`}
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"var(--violet)",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {outBankerEmail && (
                  <a href={`mailto:${outBankerEmail}`}
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"var(--violet)",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",textDecoration:"none"}}>
                    ✉ Email banker
                  </a>
                )}
              </div>
            )}
            {/* Live fee calc — admin only */}
            {isAdmin && outStatus === "Closed (Funded)" && (
              <div style={{background:"var(--bg)",border:"1px solid var(--s2)",borderRadius:6,padding:12,marginTop:4}}>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:8}}>COMP CALCULATION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>FEE EARNED ({REFERRAL_FEE_BPS} BPS)</div>
                    <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--gold)"}}>${feeEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>WOULD HAVE ({parseInt(bps)||BPS_RATE} BPS)</div>
                    <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t2)"}}>${wouldHaveEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>LOST COMP</div>
                    <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--bad)"}}>${lostComp.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="dates" && (isClosed && isAdmin ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(6,214,160,.06)",border:"1px solid #06D6A044",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--ok)",letterSpacing:"1px",marginBottom:5,fontWeight:500}}>ACTUAL CLOSE DATE <span style={{color:"var(--t3)"}}>· editable</span></div>
              <input type="date" value={closedAt} onChange={e=>setClosedAt(e.target.value)}
                style={{background:"transparent",border:"none",color:"var(--ok)",fontSize:"var(--fs-5)",fontFamily:"var(--ff-mono)",width:"100%",fontWeight:500}}/>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>The month this counts toward production</div>
            </div>
            <div style={{background:"var(--bg)",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:"var(--fs-5)",fontFamily:"var(--ff-mono)",width:"100%"}}/>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>Original target date</div>
            </div>
          </div>
        ) : !isReferredOut ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"var(--bg)",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("closingDate")}</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"var(--t1)",fontSize:"var(--fs-5)",fontFamily:"var(--ff-mono)",width:"100%"}}/>
            </div>
            <div style={{background:"var(--bg)",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{isClosed ? TX("mvStat_CLOSED") : TX("daysInStage")}</div>
              {/* Syne's zero is indistinguishable from a lowercase o at this
                  size — "0d" rendered as "od". Numbers go in DM Mono, which
                  is what the rest of the app already uses for data. */}
              <div style={{fontSize:isClosed?"var(--fs-6)":"var(--fs-10)",
                fontFamily:isClosed?"var(--ff-title)":"var(--ff-body)",
                fontWeight:isClosed?800:500,letterSpacing:isClosed?0:"-0.5px",
                color:isClosed?"var(--ok)":(stageUrgency(file).level==="late"?"var(--bad)":stageUrgency(file).level==="watch"?"var(--gold)":"var(--t1)")}}>
                {isClosed ? file.closedAt : (
                  daysInStage(file)===null ? "—" : <>
                    {daysInStage(file)}
                    <span style={{fontSize:"var(--fs-5)",color:"var(--t3)",marginLeft:1}}>d</span>
                  </>
                )}
              </div>
              {!isClosed && (()=>{ const c=stageClock(file.stage,file); return (
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>
                  {stageCeilingLabel(file.stage,file,lang)}
                  {fileAge(file)!==null ? ` · ${fileAge(file)}d total` : ""}
                </div>
              );})()}
            </div>
          </div>
        ) : null)}

        {/* NOTAS → EXPEDIENTE */}
        <div style={{display:tab==="file"?"block":"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>
              {TX("notes")} <span style={{color:"var(--t4)"}}>{TX("notesShape")}</span>
            </div>
            <div style={{
              fontSize:"var(--fs-2)",
              color: newNote.length > 200 ? "var(--bad)" : newNote.length > 100 ? "var(--gold)" : "var(--t3)",
              fontFamily:"var(--ff-mono)",
              letterSpacing:"0.5px"
            }}>
              {newNote.length}{newNote.length > 200 ? " · "+L("tooLong") : newNote.length > 100 ? " · "+L("keepShort") : ""}
            </div>
          </div>
          <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} rows={2}
            placeholder={isReferredOut ? L("noteFromBanker") : L("notePlaceholder")}
            style={{background:"var(--bg)",border:`1px solid ${newNote.length>200?"var(--bad)":"var(--bd)"}`,borderRadius:6,color:"var(--t1)",padding:"8px 10px",fontSize:"var(--fs-4)",fontFamily:"var(--ff-mono)",width:"100%",resize:"none"}}/>
          <button className="hov" disabled={!newNote.trim()}
            onClick={()=>{ onSave({noteLog:addNoteEntry(file,newNote,profile?.name||null,file.stage).noteLog}); setNewNote(""); }}
            style={{marginTop:6,width:"100%",background:newNote.trim()?"rgba(126,200,164,.1)":"var(--s1)",
              color:newNote.trim()?"var(--mint)":"var(--bd)",borderRadius:6,padding:"7px 0",fontFamily:"var(--ff-mono)",
              fontSize:"var(--fs-3)",border:`1px solid ${newNote.trim()?"var(--mint)":"var(--s2)"}`,
              cursor:newNote.trim()?"pointer":"not-allowed"}}>{L("addUpdate")}</button>

          {entries.length>0&&(
            <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
              {(showAllNotes?entries:entries.slice(0,2)).map((n,i)=>(
                <div key={i} style={{borderLeft:`2px solid ${i===0?"var(--mint)":"var(--s2)"}`,paddingLeft:9}}>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:".5px"}}>
                    {n.legacy
                      ? L("noteLegacy")
                      : `${String(n.at).slice(0,10)} · ${timeAgo(n.at)}${n.by?` · ${n.by}`:""}`}
                  </div>
                  {n.stage&&(
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t2)",letterSpacing:".5px",marginTop:1}}>{n.stage}</div>
                  )}
                  <div style={{fontSize:"var(--fs-3)",color:i===0?"var(--t1)":"var(--t2)",lineHeight:1.5,marginTop:2,whiteSpace:"pre-wrap"}}>{n.text}</div>
                </div>
              ))}
              {entries.length>2&&(
                <button onClick={()=>setShowAllNotes(v=>!v)}
                  style={{background:"transparent",border:"none",color:"var(--blue)",fontSize:"var(--fs-2)",
                    fontFamily:"var(--ff-mono)",cursor:"pointer",padding:0,textAlign:"left"}}>
                  {showAllNotes?L("seeLast2"):L("seeAll",{n:entries.length})}
                </button>
              )}
            </div>
          )}
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:6,letterSpacing:"0.5px"}}>
            {L("noteHint")}
          </div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--gold)",marginTop:3,letterSpacing:"0.5px"}}>
            {L("notesEnglishOnly")}
          </div>
        </div>

        {tab==="file" && (file.lastEditedBy || (file.history && file.history.length > 0)) && (
          <div style={{background:"var(--bg)",borderRadius:8,padding:12,border:"1px solid var(--s2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{L("activity")}</div>
              <button onClick={()=>setShowHistory(s=>!s)}
                style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer",letterSpacing:"1px"}}>
                {showHistory ? L("hide")+" ↑" : L("showAll")+" ↓"}
              </button>
            </div>
            {file.lastEditedBy && (
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:6}}>
                Last edited by <span style={{color:"var(--t1)",fontWeight:500}}>{file.lastEditedBy.name}</span> · <span style={{color:"var(--t3)"}}>{timeAgo(file.lastEditedAt)}</span>
              </div>
            )}
            {file.createdBy && (
              <div style={{fontSize:"var(--fs-3)",color:"var(--t3)",marginTop:2}}>
                Created by {file.createdBy.name} · {timeAgo(file.createdAt)}
              </div>
            )}
            {showHistory && file.history && file.history.length > 0 && (
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--s2)",display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {[...file.history].reverse().map((h,i)=>(
                  <div key={i} style={{fontSize:"var(--fs-3)",color:"var(--t2)",display:"flex",gap:8}}>
                    <span style={{color:"var(--t3)",minWidth:75,fontSize:"var(--fs-2)"}}>{timeAgo(h.at)}</span>
                    <span style={{color:"var(--t1)",fontWeight:500,minWidth:90}}>{h.name?.split(" ")[0] || "?"}</span>
                    <span style={{flex:1}}>
                      {h.action==="created" && "created file"}
                      {h.action==="edited" && `edited ${h.fields?.join(", ") || "fields"}`}
                      {h.action==="stage_advanced" && <>advanced to <span style={{color:"var(--gold)"}}>{h.to}</span></>}
                      {h.action==="closed" && <span style={{color:"var(--ok)"}}>marked as closed</span>}
                      {h.action==="reopened" && <span style={{color:"var(--gold)"}}>reopened file</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
        {/* END SCROLLABLE BODY */}

        {/* BARRA DE ACCIONES — fija, visible en las cinco solapas. La
            decision de referir o archivar nace donde uno la piensa, no
            en una solapa aparte a la que haya que ir a buscarla.
            Los botones NUNCA cambian de sitio: solo cambia cual esta
            encendido. Si cambiaran de posicion habria que leer la barra
            cada vez en vez de ir con el dedo. */}
        <div className={"dm-foot"+(accOpen?" dm-foot-open":"")}
          style={{padding:"11px 22px",borderTop:"1px solid var(--s2)",background:"var(--s1)",
          flexShrink:0,display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          {/* Solo en el telefono. Abre el resto de las acciones, que ahi
              estan escondidas: nadie archiva ni borra desde el movil, y
              tocarlo por error es peor que no tenerlo. */}
          <button className="hov dm-acc" onClick={()=>setAccOpen(x=>!x)}
            style={{background:"transparent",color:"var(--t2)",border:"1px solid var(--bd)",
              borderRadius:6,padding:"8px 14px",fontFamily:"var(--ff-mono)",
              fontSize:"var(--fs-3)",cursor:"pointer",whiteSpace:"nowrap"}}>
            {TX("mobActions")} {accOpen?"\u25b4":"\u25be"}
          </button>
          {(()=>{
            const A=fileActions(file,{isAdmin});
            const salvar=()=>{
              const patch = {
                note: file.note ?? null,
                closing,
                type: loanType,
                loan: parseInt(loanAmt) || file.loan,
                lo: (loAssigned || JOSE_LO).trim(),
                referralPartner: (referralPartner||"").trim() || null,
                brokerCheckReceived: chkDraft,
                compliance: compDraft,
                phone: (phone||"").trim() || null,
                email: (email||"").trim() || null,
                // En blanco se conserva el anterior. Un archivo sin nombre no
                // se puede buscar, ni sale en la cola, ni en las cartas.
                borrower: (borrower||"").trim() || file.borrower,
              };
              if(isAdmin) patch.bps = parseInt(bps)||null;
              if(isAdmin) patch.processor = processor;
              if(isAdmin && isClosed && closedAt) patch.closedAt = closedAt;
              if(isReferredOut){
                patch.referredOut = {
                  bankerName: (outBankerName||"").trim(),
                  bankerCompany: (outBankerCompany||"").trim(),
                  bankerPhone: (outBankerPhone||"").trim(),
                  bankerEmail: (outBankerEmail||"").trim(),
                  reason: outReason,
                  status: outStatus,
                  finalLoanAmount: parseInt(outFinalLoan) || null,
                  closeDate: outCloseDate || null,
                  referredDate: ro.referredDate || today(),
                };
              }
              if(isInbound){
                patch.referringBanker = {
                  bankerName: (inBankerName||"").trim(),
                  bankerCompany: (inBankerCompany||"").trim(),
                  bankerPhone: (inBankerPhone||"").trim(),
                  bankerEmail: (inBankerEmail||"").trim(),
                };
              }
              Object.assign(patch, panelDrafts.current.lender||{}, panelDrafts.current.dates||{},
                panelDrafts.current.payout||{});
              onSave(patch);
              onClose();
            };
            // Un boton apagado sigue funcionando: pregunta y dice por que
            // no era el momento. La decision sigue siendo del usuario.
            const btn=(id,label,color,accion,meta)=>{
              const on=meta?.on!==false;
              return (
                <button key={id} className="hov"
                  onClick={()=>{
                    if(!on){
                      const why=lang==="en"?meta.why_en:meta.why_es;
                      if(why&&!window.confirm(why+"\n\n"+TX("actionAnyway"))) return;
                    }
                    accion();
                  }}
                  title={!on&&meta?(lang==="en"?meta.why_en:meta.why_es):""}
                  style={{background:"transparent",color:on?color:"#2B323B",
                    border:`1px solid ${on?color:"#1A1F26"}`,borderRadius:6,
                    padding:"8px 14px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
                    cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
              );
            };

            return (<>
              <button className="hov dm-save" onClick={salvar}
                style={{background:"var(--gold)",color:"var(--bg)",borderRadius:6,padding:"8px 22px",
                  fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                {L("save")}
              </button>

              {archivedFile?(
                btn("restore",TX("restoreBtn"),"var(--mint)",onRestore,{on:true})
              ):isClosed?(
                btn("reopen",TX("reopenBtn"),"var(--t2)",onReopen,{on:true})
              ):isReferredOut?(
                btn("pull",TX("pullBack"),"var(--violet)",()=>{
                  if(confirm(TX("pullBackAsk",{n:file.borrower}))){
                    onSave(stagePatch(file, "Lead Inquiry", {referredOut:null}));
                    onClose();
                  }
                },{on:true})
              ):inPrep?(<>
                {btn("continue",TX("continueBtn"),"var(--blue)",onContinuePrep,{on:true})}
                {btn("resched",TX("reschedBtn"),"var(--gold)",onPrep,{on:!prepLocked(file),
                  why_es:`Pasó el tope de ${PREP_MAX_DAYS} días — devuélvelo o archívalo`,
                  why_en:`Past the ${PREP_MAX_DAYS}-day cap — return it or archive it`})}
                {btn("arch",TX("archBtn"),"var(--t2)",onArchive,{on:true})}
              </>):(<>
                {btn("advance",L("advance")+" →","var(--t2)",onAdvance,A.advance)}
                {btn("close",L("closeFile")+" ✓","var(--ok)",
                  ()=>{
                    if(!confirm(TX("closeAsk",{n:file.borrower}))) return;
                    const d=window.prompt(TX("closeDateAsk"), file.closing||today());
                    if(d===null) return;
                    if(!okDate(d)){ window.alert(TX("closeDateBad")); return; }
                    onCloseFile(d);
                  },A.close)}
                {btn("refer",TX("referBtn"),"var(--violet)",()=>{
                  if(confirm(TX("referAsk",{n:file.borrower}))){
                    setStage(REFERRED_OUT_STAGE);
                    onSave(stagePatch(file, REFERRED_OUT_STAGE));
                  }
                },A.refer)}
                {canCancelContract(file)&&btn("cancelct",TX("cancelBtn"),"var(--gold)",
                  ()=>setShowCancel(true),{on:true})}
                {btn("prep",TX("prepBtn"),"var(--mint)",onPrep,A.prep)}
                {btn("arch",TX("archBtn"),"var(--t2)",onArchive,A.archive)}
              </>)}

              <div style={{flex:1,minWidth:12}}/>

              {/* BORRAR — solo, al fondo a la derecha, con un separador de
                  verdad. Un OK por costumbre no basta para lo único que no se
                  deshace: hay que escribir la palabra. ARCHIVAR, que sí se
                  deshace, queda a la izquierda con las acciones de siempre. */}
              {isAdmin&&(<>
                <div style={{width:1,height:22,background:"var(--bd)",margin:"0 10px 0 18px"}}/>
                <button className="hov dm-del"
                  onClick={()=>{
                    const r=window.prompt(TX("deleteTypeAsk",{n:file.borrower,w:TX("delBtn")}));
                    if(r===null) return;
                    if(r.trim().toUpperCase()!==TX("delBtn")){ window.alert(TX("deleteTypeBad",{w:TX("delBtn")})); return; }
                    onDelete();
                  }}
                  title={TX("deleteHint")}
                  style={{background:"transparent",color:"var(--bad)",border:"1px solid rgba(232,93,117,.35)",borderRadius:6,
                    padding:"8px 14px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",cursor:"pointer"}}>
                  🗑 {TX("delBtn")}
                </button>
              </>)}
            </>);
          })()}
        </div>
      </div>
      {showCancel&&(
        <CancelContractModal file={file} lang={lang} onClose={()=>setShowCancel(false)}
          onConfirm={payload=>{
            const next=cancelContract(file,{...payload,by:profile?.name||null});
            setStage(next.stage);
            onSave({stage:next.stage, stageEnteredAt:next.stageEnteredAt, daysInStage:0,
              stageLog:next.stageLog, fileOpenedAt:next.fileOpenedAt,
              contingencies:null, contingencyResults:null, contingencyLog:null,
              closing:null, closedAt:null,
              lenderId:null, lenderOther:null, lenderSince:null, backupLenderId:null,
              channel:null, rate:null, bps:null,
              lockState:null, lockedAt:null, lockTermDays:null, lockExpires:null,
              comp:null, registrations:null, registeredAt:null, registeredBy:null,
              orders:null, milestones:null, uwResult:null,
              noteLog:next.noteLog,
              lastContactAt:next.lastContactAt, contactCount:0,
              contractCancellations:next.contractCancellations});
            setShowCancel(false); onClose();
          }}/>
      )}
      {showChange&&(
        <LenderChangeModal file={file} profile={profile} onClose={()=>setShowChange(false)}
          onConfirm={payload=>{
            const next=applyLenderChange(file,payload);
            onSave({lenderId:next.lenderId,lenderSince:next.lenderSince,lenderHistory:next.lenderHistory,
              registrations:next.registrations,
              ...stagePatch(file, next.stage),
              lockState:next.lockState,lockedAt:null,lockTermDays:null,lockExpires:null,
              comp:null,backupLenderId:next.backupLenderId});
            setShowChange(false); onClose();
          }}/>
      )}
    </div>
  );
}

function AddModal({profile, onClose, onAdd, existingFiles, training, lang}){
  // El recorrido solo existe si se entro por el boton de entrenamiento.
  // La bandera isTraining la pone el motor por eso, no un checkbox que
  // alguien pueda marcar por error ni olvidar marcar.
  const tour = useTour(profile, !!training);
  const [borrower,setBorrower]=useState(training ? trainingSampleName(profile) : "");
  const [loan,setLoan]=useState("");
  const [type,setType]=useState("Conventional");
  const [stage,setStage]=useState("Lead Inquiry");
  const [closing,setClosing]=useState("");
  const [note,setNote]=useState("");
  const [referralPartner,setReferralPartner]=useState("");
  const [phone,setPhone]=useState("");
  const [email,setEmail]=useState("");

  // Inbound referral metadata (set if checkbox is checked)
  const [isInbound,setIsInbound]=useState(false);
  const [inBankerName,setInBankerName]=useState("");
  const [inBankerCompany,setInBankerCompany]=useState("");
  const [inBankerPhone,setInBankerPhone]=useState("");
  const [inBankerEmail,setInBankerEmail]=useState("");

  const isAssistant = profile?.role === "assistant";
  const defaultLo = isAssistant
    ? (LO_LIST.find(l=>l.role==="LO")?.name || LO_LIST[0]?.name || JOSE_LO)
    : profile?.name || JOSE_LO;
  const [lo,setLo]=useState(defaultLo);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid var(--s2)",flexShrink:0}}>
          <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)"}}>NEW FILE</div>
          {isAssistant && (
            <div style={{fontSize:"var(--fs-3)",color:"var(--gold)",marginTop:4,letterSpacing:"0.5px"}}>
              ⚠ Assistant view — please confirm the LOAN OFFICER below before adding.
            </div>
          )}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:14}}>

          {training && <TourPanel profile={profile} lang={lang} tour={tour} onExit={onClose}/>}

          {/* INBOUND REFERRAL TOGGLE — at top so it's visible */}
          <label data-tour="inbound" style={{
            display:"flex",alignItems:"center",gap:10,
            background: isInbound ? "rgba(255,209,102,.08)" : "var(--bg)",
            border: isInbound ? "1px solid #FFD16655" : "1px solid var(--s2)",
            borderRadius:8, padding:"10px 12px", cursor:"pointer"
          }}>
            <input type="checkbox" checked={isInbound} onChange={e=>setIsInbound(e.target.checked)}
              style={{accentColor:"var(--yellow)",width:16,height:16,cursor:"pointer"}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:"var(--fs-4)",color: isInbound ? "var(--yellow)" : "var(--t1)",fontFamily:"var(--ff-title)",fontWeight:700,letterSpacing:"0.5px"}}>
                🤝 This is an inbound referral from another banker
              </div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:2}}>
                Tag this file so you can track who sent it your way + measure reciprocity at year end.
              </div>
            </div>
          </label>

          {/* INBOUND BANKER FIELDS — shown only when checkbox is checked */}
          {isInbound && (
            <div style={{background:"rgba(255,209,102,.04)",border:"1px solid #FFD16633",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:"var(--fs-3)",color:"var(--yellow)",fontFamily:"var(--ff-title)",fontWeight:700,letterSpacing:"1px",marginBottom:2}}>REFERRING BANKER</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                  <input value={inBankerName} onChange={e=>setInBankerName(e.target.value)} placeholder="John Doe" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                  <input value={inBankerCompany} onChange={e=>setInBankerCompany(e.target.value)} placeholder="XYZ Mortgage" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 {TX("phone")}</div>
                  <input type="tel" value={inBankerPhone} onChange={e=>setInBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ {TX("email")}</div>
                  <input type="email" value={inBankerEmail} onChange={e=>setInBankerEmail(e.target.value)} placeholder="banker@company.com" style={IS}/>
                </div>
              </div>
            </div>
          )}

          <div data-tour="borrower">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BORROWER NAME *</div>
            <input value={borrower} onChange={e=>setBorrower(e.target.value)} placeholder={TX("phLegalName")} style={IS} autoFocus/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div data-tour="phone">
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 {TX("phone")}</div>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={IS}/>
            </div>
            <div data-tour="email">
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ {TX("email")}</div>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={TX("phEmail")} style={IS}/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div data-tour="amount">
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>LOAN AMOUNT</div>
              <input value={loan} onChange={e=>setLoan(e.target.value)} placeholder="350000" style={IS}/>
            </div>
            <div data-tour="type">
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>LOAN TYPE</div>
              <select value={type} onChange={e=>setType(e.target.value)} style={IS}>
                {LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}
              </select>
            </div>
          </div>

          <div data-tour="stage">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>STARTING STAGE</div>
            <select value={stage} onChange={e=>setStage(e.target.value)} style={IS}>
              {ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}
            </select>
          </div>

          <div data-tour="lo">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
              LOAN OFFICER {isAssistant && <span style={{color:"var(--gold)"}}>· assigning on behalf of</span>}
            </div>
            <select value={lo} onChange={e=>setLo(e.target.value)} style={IS}>
              {LO_LIST.map(l=><option key={l.name} value={l.name}>{l.name} · {l.role}</option>)}
            </select>
          </div>

          <div data-tour="partner">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>REFERRAL PARTNER</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)} placeholder={TX("phPartner")} style={IS}/>
          </div>

          <div data-tour="closing">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
            <input type="date" value={closing} onChange={e=>setClosing(e.target.value)} style={IS}/>
          </div>

          <div data-tour="note">
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
              {TX("notes")} <span style={{color:"var(--t4)"}}>{TX("notesShape")}</span>
            </div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Subm 4/12 · UW queue · review by 4/15" style={IS}/>
          </div>

        </div>

        <div style={{padding:"14px 24px",borderTop:"1px solid var(--s2)",background:"var(--s1)",flexShrink:0,display:"flex",gap:8}}>
          <button className="hov" data-tour="submit" onClick={()=>{
            if(!borrower.trim()){
              alert(TX("borrowerRequired"));
              return;
            }
            // Se dejo entrar dos veces a la misma clienta porque lo unico
            // que se validaba era que el nombre no estuviera vacio. El
            // aviso NO bloquea: un cliente puede tener un segundo prestamo,
            // y dos familiares pueden compartir telefono. Pero ahora hay
            // que confirmarlo a proposito en vez de por descuido.
            const dups = duplicateMatches(
              {borrower:borrower.trim(), phone:phone.trim(), email:email.trim()}, existingFiles||[]);
            if(dups.length){
              const motivo = {email:"dupEmail", phone:"dupPhone", name:"dupName"};
              const lista = dups.slice(0,3).map(d=>
                `· ${d.file.borrower} — ${d.reasons.map(r=>TX(motivo[r])).join(", ")}`
              ).join("\n");
              if(!window.confirm(TX("dupWarn",{n:dups.length})+"\n\n"+lista+"\n\n"+TX("dupAsk"))) return;
            }
            const newFile = {
              id:`f${Date.now()}`,
              borrower:borrower.trim(),
              loan:parseInt(loan)||0,
              type,
              stage,
              daysInStage:0,
              stageEnteredAt: today(),
              // Un archivo nuevo no pasa por stampStage, asi que su etapa
              // inicial nunca se sellaba. Se siembra aqui.
              stageLog: { [stage]: today() },
              fileOpenedAt: today(),
              closing,
              note:(note||"").trim(),
              bps:null,
              lo:(lo||JOSE_LO).trim(),
              referralPartner:referralPartner.trim()||null,
              phone:phone.trim()||null,
              email:email.trim()||null,
              closedAt:null,
              // Un archivo nuevo nace con procesadora escrita. Sin el campo,
              // processorId() lo leia como DEFAULT_PROCESSOR —Martha, que es
              // lo que significa el vacio en un archivo VIEJO— y el trabajo
              // nuevo caia en su cola en vez de la de Laura, que solo ve la
              // suya y nunca se enteraba.
              processor: NEW_FILE_PROCESSOR,
            };
            // Id fijo por persona: reentrar al entrenamiento reemplaza el
            // archivo anterior en vez de acumular muestras sueltas.
            if(training){
              newFile.id=trainingFileId(profile);
              newFile.isTraining=true;
              // En la cola de quien entrena. Sin esto cae en la de Martha por
              // defecto y Laura, que solo ve la suya, nunca lo encontraria.
              newFile.processor = profile?.processorId || DEFAULT_PROCESSOR;
            }
            if(isInbound){
              newFile.isInbound = true;
              newFile.referringBanker = {
                bankerName: inBankerName.trim(),
                bankerCompany: inBankerCompany.trim(),
                bankerPhone: inBankerPhone.trim(),
                bankerEmail: inBankerEmail.trim(),
              };
            }
            onAdd(newFile);
          }}
            style={{flex:2,background:"var(--gold)",color:"var(--bg)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:"pointer"}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function HelpModal({profile, lang, onSetLang, onClose}){
  // El contenido vive en helpContent.js. Los números que también conoce el
  // motor se le pasan desde aquí, así la guía no puede quedar desfasada.
  // Sin estado propio de idioma: llega por props y el toggle lo cambia
  // arriba, para que el titulo y los articulos no puedan discrepar.
  const setLang = onSetLang;
  const [secId,setSecId]=useState("start");
  const [q,setQ]=useState("");
  const sections=helpSections({
    stages:LO_STAGES, thresholds:STAGE_THRESHOLDS, inHousePoints:IN_HOUSE_REDUCTION,
  });
  const T=o=>typeof o==="object"&&o?(o[lang]??o.es??o.en??""):o;
  const hits=searchHelp(sections,q,lang);
  const sec=sections.find(x=>x.id===secId)||sections[0];
  const shown=hits?hits.map(h=>h.article):sec.articles;

  // Los tonos del wiki son las seis señales. Faltaba `legal`, el morado
  // (SIGNALS.legal = #BD65E8), y la unica nota que lo usa —los tres dias
  // habiles del CD, Regulacion Z— caia en el `||TONE.gold` de abajo y salia
  // dorada. La nota dice "el sistema lo dice en morado" y no era morada.
  const TONE={gold:["#F5A623","rgba(245,166,35,.08)"],green:["#7EC8A4","rgba(126,200,164,.07)"],
              red:["#E85D75","rgba(232,93,117,.08)"],blue:["#4A90D9","rgba(74,144,217,.08)"],
              legal:["#BD65E8","rgba(189,101,232,.08)"]};

  const block=(b,bi)=>{
    const k=b.k;
    if(k==="lead") return <div key={bi} style={{fontSize:"var(--fs-5)",color:"var(--t1)",fontWeight:500,lineHeight:1.6,margin:"0 0 8px"}}>{T(b)}</div>;
    if(k==="p")    return <div key={bi} style={{fontSize:"var(--fs-4)",color:"var(--t2)",lineHeight:1.7,margin:"0 0 9px"}}>{T(b)}</div>;
    if(k==="note"){ const [c,bg]=TONE[b.tone]||TONE.gold;
      return <div key={bi} style={{background:bg,border:`1px solid ${c}44`,borderLeft:`3px solid ${c}`,borderRadius:6,
        padding:"10px 13px",fontSize:"var(--fs-4)",color:"#C9D1D9",lineHeight:1.65,margin:"0 0 10px"}}>{T(b)}</div>; }
    if(k==="list") return (
      <div key={bi} style={{margin:"0 0 10px"}}>
        {(b[lang]||P(b)).map((x,i)=>(
          <div key={i} style={{display:"flex",gap:8,fontSize:"var(--fs-4)",color:"var(--t2)",lineHeight:1.7,marginBottom:2}}>
            <span style={{color:"var(--t3)"}}>—</span><span>{x}</span>
          </div>))}
      </div>);
    if(k==="steps") return (
      <div key={bi} style={{margin:"0 0 10px"}}>
        {(b[lang]||P(b)).map((x,i)=>(
          <div key={i} style={{display:"flex",gap:9,fontSize:"var(--fs-4)",color:"var(--t2)",lineHeight:1.7,marginBottom:5}}>
            <span style={{color:"var(--gold)",fontFamily:"var(--ff-mono)",flexShrink:0}}>{i+1}</span><span>{x}</span>
          </div>))}
      </div>);
    if(k==="table") return (
      <table key={bi} style={{width:"100%",borderCollapse:"collapse",margin:"0 0 12px",fontSize:"var(--fs-4)"}}>
        <thead><tr>{(b.head[lang]||b.head.es).map((h,i)=>(
          <th key={i} style={{textAlign:"left",padding:"7px 10px",background:"var(--bg)",color:"var(--t3)",
            fontSize:"var(--fs-2)",letterSpacing:"1px",fontWeight:500,borderBottom:"1px solid var(--bd)"}}>{h}</th>))}</tr></thead>
        <tbody>{b.rows.map((r,i)=>(
          <tr key={i}>{r.map((cell,j)=>(
            <td key={j} style={{padding:"8px 10px",borderBottom:"1px solid var(--s2)",
              color:j===0?"var(--t1)":"var(--t2)"}}>{T(cell)}</td>))}</tr>))}</tbody>
      </table>);
    if(k==="kv") return (
      <div key={bi} style={{margin:"0 0 10px"}}>
        {b.rows.map((r,i)=>(
          <div key={i} style={{borderTop:"1px solid var(--s2)",padding:"9px 0"}}>
            <div style={{fontSize:"var(--fs-4)",color:"var(--t1)",marginBottom:2}}>{T(r[0])}</div>
            <div style={{fontSize:"var(--fs-4)",color:"var(--t2)",lineHeight:1.65}}>{T(r[1])}</div>
          </div>))}
      </div>);
    return null;
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"var(--s1)",
        border:"1px solid var(--bd)",borderRadius:12,width:"100%",maxWidth:880,
        maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid var(--s2)",display:"flex",
          justifyContent:"space-between",alignItems:"flex-start",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.5px"}}>
              {TX("guideTitle")}
            </div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t3)",letterSpacing:"1px",marginTop:3}}>
              DEL VALLE LENDING CO. · BARRETT FINANCIAL GROUP · NMLS 181106
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",border:"1px solid var(--bd)",borderRadius:6,overflow:"hidden"}}>
              {["es","en"].map(l=>(
                <button key={l} className="hov" onClick={()=>setLang(l)}
                  style={{background:lang===l?"var(--gold)":"transparent",color:lang===l?"var(--bg)":"var(--t2)",
                    border:"none",padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                  {l.toUpperCase()}
                </button>))}
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"var(--t3)",
              fontSize:"var(--fs-8)",cursor:"pointer",padding:"0 0 0 4px"}}>✕</button>
          </div>
        </div>

        <div style={{padding:"11px 22px",borderBottom:"1px solid var(--s2)",background:"var(--bg)",
          display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",flexShrink:0,
          maxHeight:120,overflowY:"auto"}}>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder={TX("searchGuide")}
            style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t1)",
              padding:"6px 10px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",flex:"1 1 200px",minWidth:150}}/>
          {!hits&&sections.map(x=>(
            <button key={x.id} className="hov" onClick={()=>setSecId(x.id)}
              style={{background:secId===x.id?x.color:"var(--t4)",color:secId===x.id?"var(--bg)":"var(--t2)",
                borderRadius:6,padding:"5px 10px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",fontWeight:500,
                border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>
              {x.icon} {T(x)}
            </button>))}
          {hits&&(
            <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>
              {hits.length} {TX("result")}{hits.length===1?"":"s"}
            </span>)}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"18px 22px 26px"}}>
          {shown.length===0&&(
            <div style={{color:"var(--t3)",fontSize:"var(--fs-4)",textAlign:"center",padding:"30px 0"}}>
              {TX("noGuideMatch")}
            </div>)}
          {shown.map((a,i)=>(
            <div key={a.id} style={{marginBottom:26,paddingBottom:i<shown.length-1?18:0,
              borderBottom:i<shown.length-1?"1px solid var(--s2)":"none"}}>
              <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",marginBottom:10}}>
                {T(a)}
              </div>
              {(a.blocks||[]).map((b,j)=>block(b,j))}
            </div>))}
        </div>

        <div style={{padding:"10px 22px",borderTop:"1px solid var(--s2)",background:"var(--bg)",
          fontSize:"var(--fs-2)",color:"var(--t3)",flexShrink:0}}>
          {TX("guideLive")}
        </div>
      </div>
    </div>
  );
}