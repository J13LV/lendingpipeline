import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot, collection, writeBatch, getDocs } from "firebase/firestore";
import { helpSections, searchHelp } from "./helpContent";
import { tr, defaultLang } from "./ui";
import { downloadMarthaSheet } from "./marthaExport";
import ProcessingView, { IntakePane } from "./processing";
import { downloadChecklist } from "./barrettChecklist";

// Idioma vigente, a nivel de módulo. El motor devuelve {es, en} en 84 lugares
// y la interfaz leía siempre `.es`. Pasar `lang` por props a los seis paneles
// anidados sería más frágil que un valor de sesión: hay un usuario por pestaña.
let CURRENT_LANG = "es";
const P = o => (o && typeof o === "object" && !Array.isArray(o))
  ? (o[CURRENT_LANG] ?? o.es ?? o.en ?? "") : o;
const TX = (k, v) => tr(k, CURRENT_LANG, v);
// Las notas del motor viven como note_es / note_en.
const PN = o => o ? (o["note_" + CURRENT_LANG] ?? o.note_es ?? o.note_en ?? "") : "";
import {
  stageUrgency, stageClock, daysInStage, fileAge, stampStage, today,
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
  DPA_PCTS, DPA_FORMS, dpaForm, dpaOf, hasDpa, miLooksWrong,
  setDpa, dpaLabel, dpaComplete, productionByDpa, productionByState,
  GATE1_ITEMS, gate1Item, FINDING_WAITING, WAITING_IDS, waitingMeta,
  backfillGaps, filesNeedingBackfill, backfillCount, applyBackfill, wasBackfilled,
  gate1Coverage, visibleMilestones, milestoneAt, uwOutcome, uwOutcomeAt,
  uwOutcomeMeta, discEsignedAt,
  openFindings, resolvedFindings, hasOpenFindings, addFinding, resolveFinding,
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

// ─── TEAM ROSTER ───
// `lang` decide en que idioma aterriza cada persona en su primer login.
// Martha no lee espanol: sin este campo entraria a una pantalla que no
// entiende, buscando un boton que tampoco entiende para cambiarla.
const TEAM = {
  // Jose has two accounts during the PRMG → Barrett transition. Both point to
  // the same person and the same admin rights. The PRMG one gets disabled in
  // Firebase once the new login is confirmed working.
  "a7gM7SK7GhUuomyL8apuw68PptA2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  "vllTjiE2Aba8CKIC3UWGxMdzBcM2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  // Ana también tiene dos durante la transición: el correo de PRMG ya no le
  // funciona. El viejo se desactiva en Firebase cuando el nuevo esté confirmado.
  "rGY5FGA7P3N5lXE74TjZ07tHQWg1": { name: "Ana M Plasencia",    short: "Ana",      role: "lo",        nmls: "2683283", color: "#BD65E8" },
  "iXcEzyc2nTTy2CJirLUz1FJ1oye2": { name: "Ana M Plasencia",    short: "Ana",      role: "lo",        nmls: "2683283", color: "#BD65E8" },
  "0dpbvxe4RZUmCDhm03Zne6JSKE32": { name: "Marelis Pinales",    short: "Marelis",  role: "lo",        nmls: "",        color: "#06D6A0" },
  "qMVqzjs59yMIcZfvsWACpjm1o4F2": { name: "Tina",              short: "Tina",     role: "assistant", nmls: null, color: "#7EC8A4" },
  // Laura pasa a procesar. `processorId` la amarra a su propia cola: ve
  // la suya y no la de Martha. El rol sigue dandole lo de assistant.
  "Hj0KI0wmGfTHinHxxx8mrdLx5jw2": { name: "Laura de Armas",     short: "Laura",    role: "processor", nmls: "",        color: "#F5A623", processorId: "laura" },
};
function getProfile(uid){ return TEAM[uid] || { name:"Unknown User", short:"Unknown", role:"assistant", nmls:"", color:"#ADBAC7", lang:"es" }; }

const BPS_RATE = 150;
const OVERRIDE_RATE = 0.0025;
const JOSE_LO = "Jose Del Valle";
const EXCLUDED_TYPES = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite",
  "CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)",
  "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
  "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist"];

// ─── BANK-TO-BANK REFERRAL CONSTANTS ───
// Cuando la sucursal no puede colocar un archivo (producto, crédito, nicho), se refiere
// it to another banker and earns a referral fee. We also track inbound deals
// where another banker sent us business.
const REFERRED_OUT_STAGE = "REFERRED OUT — EXTERNAL BANK";
const REFERRAL_FEE_BPS = 50; // bps earned on referred-out closed deals
const REFERRAL_REASONS = [
  "Credit Score Too Low",
  "DTI / Income Issue",
  "Product Not Offered",
  "Property Type Restriction",
  "LTV / Down Payment Issue",
  "Bankruptcy / Credit Event",
  "Foreign National Buyer",
  "Self-Employed Documentation",
  "Investor / Non-Owner Restriction",
  "Other",
];
const REFERRAL_STATUSES = [
  "Pending at Banker",
  "Closed (Funded)",
  "Fell Through",
  "Withdrawn by Borrower",
];

// ─── PREPARATION BANK ───
// Clients who are ALIVE but not buyable yet: repairing credit, saving money,
// waiting on taxes, new job, next season. They used to sit in Pre-Qual aging
// against a stage clock that did not apply to them, which made the whole phase
// look old and stopped anyone from reading it. Here the clock changes jobs:
// it no longer measures days in stage, it measures against a review date.
const PREP_STAGE = "PREPARATION — NOT READY YET";

// Credit reports expire at ~120 days. Past that the file has to be re-pulled
// anyway, so that is the natural point to force a decision instead of letting
// Preparation quietly become the new graveyard.
const PREP_MAX_DAYS = 120;

const PREP_REASONS = [
  { id:"credit",   label:"Credit repair",         mode:"days", days:30,
    why:"Credit reports on a monthly cycle. 30 days = one full cycle — earlier wastes the pull, later wastes the month." },
  { id:"reserves", label:"Saving / reserves",     mode:"days", days:90,
    why:"Calling a saver every 30 days only produces \"not yet\" and wears out the relationship." },
  { id:"taxes",    label:"Taxes to be filed",     mode:"date",
    why:"There is a real filing date on the calendar. Use it — don't guess at 30/60/90." },
  { id:"income",   label:"New job / income",      mode:"date",
    why:"First day of work + 30 days of pay stubs. This is a calculated date, not an estimate." },
  { id:"docs",     label:"Missing documents",     mode:"days", days:30,
    why:"" },
  { id:"season",   label:"Buying next season",    mode:"date",
    why:"Pick the month the client actually told you." },
  { id:"other",    label:"Other",                 mode:"days", days:30,
    why:"" },
];
function prepReasonById(id){ return PREP_REASONS.find(r=>r.id===id) || PREP_REASONS[PREP_REASONS.length-1]; }

const ARCHIVE_REASONS = [
  "Went with another lender",
  "Dead / no contact",
  "Referred out (transition)",
  "Duplicate file",
  "Client changed mind",
  "Other",
];

function isPrep(f){ return f.stage === PREP_STAGE; }
function isArchived(f){ return !!f.archived; }

// Days elapsed since the file entered Preparation. This is the 120-day clock.
function prepAge(f){ return daysBetween(f.prep?.enteredAt) ?? 0; }

// Days until the review date. Negative = overdue.
// Counted in UTC on purpose. Subtracting two local dates picks up the extra
// hour from the daylight-saving change in November/March, and Math.ceil turned
// that into a whole phantom day. Date.UTC has no DST, so the count is exact.
function daysUntilISO(iso){
  if(!iso) return 0;
  const [y,m,d] = iso.split("-").map(Number);
  const n = new Date();
  return Math.round((Date.UTC(y, m-1, d) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))/86400000);
}
function prepDaysToReview(f){ return daysUntilISO(f.prep?.reviewOn); }

// A file is "due" when its review date has arrived, OR when it has been sitting
// in Preparation past the 120-day cap regardless of what date was set.
function prepDue(f){
  if(!isPrep(f) || isArchived(f)) return false;
  if(prepAge(f) >= PREP_MAX_DAYS) return true;
  return prepDaysToReview(f) <= 0;
}
// Past the cap, "reschedule" is no longer an option — return it or archive it.
function prepLocked(f){ return prepAge(f) >= PREP_MAX_DAYS; }

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
      setError("Email and password required.");
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
        ? "Incorrect email or password."
        : code === "auth/too-many-requests"
          ? "Too many failed attempts. Try again in a few minutes or reset your password."
          : code === "auth/network-request-failed"
            ? "No internet connection. Check your network and try again."
            : "Sign in failed. Try again.";
      setError(msg);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  }

  async function sendReset() {
    if (!email.trim()) {
      setError("Enter your email above first, then click Reset.");
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
      setError("Could not send reset email. Check the email address.");
    }
  }

  return (
    <div style={{
      background:"#0D1117", minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif", padding:20
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117. */
        :root{
          --fs-scale:1;
          --fs-1:calc(11.5px * var(--fs-scale));
          --fs-2:calc(12.5px * var(--fs-scale));
          --fs-3:calc(13.5px * var(--fs-scale));
          --fs-4:calc(14.5px * var(--fs-scale));
          --fs-5:calc(15.5px * var(--fs-scale));
          --fs-6:calc(17px   * var(--fs-scale));
          --fs-7:calc(19px   * var(--fs-scale));
          --fs-8:calc(21px   * var(--fs-scale));
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
            background:"linear-gradient(140deg,#F5A623,#B87F1E)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Syne", fontWeight:800, fontSize:"var(--fs-10)", color:"#0D1117",
            letterSpacing:"-1px", boxShadow:"0 10px 30px rgba(245,166,35,.16)"
          }}>DV</div>
          <div style={{fontFamily:"Syne", fontWeight:800, fontSize:"var(--fs-10)", color:"var(--t1)",
            letterSpacing:"-0.7px", lineHeight:1.15}}>Del Valle Lending Co.</div>
            <div style={{fontFamily:"DM Mono",fontSize:"var(--fs-2)",color:"var(--t2)",letterSpacing:"0.5px",marginTop:4}}>powered by Barrett Financial Group</div>
          <div style={{fontSize:"var(--fs-3)", color:"var(--t3)", letterSpacing:"2.5px", marginTop:8}}>
            PIPELINE · BARRETT FINANCIAL GROUP
          </div>
          <div style={{width:34, height:2, background:"#F5A623", margin:"16px auto 13px",
            borderRadius:2, opacity:.7}}/>
          <div style={{fontFamily:"Syne", fontWeight:700, fontSize:"var(--fs-4)", color:"#F5A623",
            letterSpacing:"0.3px"}}>Trust the Numbers. Trust the Name.</div>
        </div>

        <div style={{background:"#161B22", border:"1px solid #30363D", borderRadius:14,
          padding:"26px 24px", display:"flex", flexDirection:"column", gap:16}}>

        {resetSent ? (
          <div style={{width:"100%", display:"flex", flexDirection:"column", gap:12, textAlign:"center"}}>
            <div style={{color:"#06D6A0", fontSize:"var(--fs-6)", lineHeight:1.5}}>
              ✓ Reset email sent to:<br/>
              <strong style={{color:"var(--t1)"}}>{email}</strong>
            </div>
            <div style={{fontSize:"var(--fs-4)", color:"var(--t2)", lineHeight:1.5}}>
              Check your inbox (and spam folder). Click the link to set a new password, then come back and sign in.
            </div>
            <button onClick={()=>{setResetSent(false);setResetMode(false);setError("");}}
              style={{background:"#21262D", color:"var(--t2)", borderRadius:8, padding:"10px 0",
                fontFamily:"DM Mono", fontSize:"var(--fs-4)", border:"1px solid #30363D", cursor:"pointer", marginTop:4}}>
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
                  background:"#0D1117",
                  border: error ? "1px solid #E85D75" : "1px solid #30363D",
                  borderRadius:8, padding:"12px 14px",
                  color:"var(--t1)", fontSize:"var(--fs-6)",
                  fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",
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
                    style={{background:"transparent", border:"none", color:"#F5A623", fontSize:"var(--fs-3)", fontFamily:"DM Mono", cursor:"pointer", letterSpacing:"1px"}}>
                    FORGOT?
                  </button>
                </div>
                <input
                  type="password"
                  value={pw}
                  autoComplete="current-password"
                  onChange={e => { setPw(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && attempt()}
                  placeholder="Enter your password..."
                  disabled={busy}
                  style={{
                    background:"#0D1117",
                    border: error ? "1px solid #E85D75" : "1px solid #30363D",
                    borderRadius:8, padding:"12px 14px",
                    color:"var(--t1)", fontSize:"var(--fs-6)",
                    fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",
                    width:"100%", transition:"border .15s",
                    opacity: busy ? 0.6 : 1,
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{fontSize:"var(--fs-4)", color:"#E85D75", lineHeight:1.4}}>{error}</div>
            )}

            <button
              onClick={resetMode ? sendReset : attempt}
              disabled={busy}
              style={{
                width:"100%", background: busy ? "#8B6914" : "#C8922A", color:"#0D1117",
                borderRadius:8, padding:"13px 0", fontFamily:"DM Mono",
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
                style={{background:"transparent", border:"none", color:"var(--t2)", fontSize:"var(--fs-3)", fontFamily:"DM Mono", cursor:"pointer", letterSpacing:"1px"}}>
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


const PHASES = [
  { id: 1, label: "Pre-Qual", short: "PQ", color: "#4A90D9", bg: "#1a2a3a", stages: ["Lead Inquiry","Needs Assessment","Credit Pull","Income Verification","Pre-Qualification"] },
  { id: 2, label: "House Hunt", short: "HH", color: "#7EC8A4", bg: "#1a2e25", stages: ["Realtor Connected","Active Search","Offer Submitted","Under Contract"] },
  { id: 3, label: "Processing", short: "PR", color: "#F5A623", bg: "#2e2210", stages: ["Full Application","Initial Disclosures Sent","Doc Collection","Title Ordered","Appraisal Ordered","Insurance Ordered"] },
  { id: 4, label: "Underwriting", short: "UW", color: "#BD65E8", bg: "#261535", stages: ["Submitted to UW","UW Review","Conditional Approval","Condition Clearing","Clear to Close"] },
  { id: 5, label: "Close Prep", short: "CP", color: "#E85D75", bg: "#2e1520", stages: ["CD Issued","Closing Scheduled","Final Verifications","Closing Docs Drawn"] },
  { id: 6, label: "Closing", short: "CL", color: "#FFD166", bg: "#2e2800", stages: ["Signing","Funded","Recorded","Keys Delivered"] },
  { id: 7, label: "Post-Close", short: "PC", color: "#06D6A0", bg: "#00281e", stages: ["Welcome Sent","30-Day Follow-Up","Review Requested","Nurture Active"] },
];

const CLOSED_STAGE = "CLOSED — FUNDED";
const ALL_STAGES = PHASES.flatMap(p => p.stages.map(s => ({ stage: s, phase: p })));
// El catalogo bajo de 58 tipos a 26. Salieron 39 productos de DPA
// estatal —NV HIP, FL Hometown Heroes, TX TSAHC, AZ Home in Five,
// CO CHFA— que eran de la epoca de PRMG como direct lender. El DPA ya
// no vive aqui: se describe con sus propias casillas en el archivo, y
// asi un FHA con asistencia sigue contando como FHA.
//
// Y entraron los Non-QM POR NOMBRE. Antes solo habia "Non-QM", un
// generico: si Ana cerraba un DSCR, el reporte de mezcla nunca podia
// decir cuanto DSCR se hizo. El motor ya los distinguia y el catalogo
// de lenders tambien — solo el menu no.
const LOAN_TYPE_GROUPS = [
  { group: "Standard", types: ["Conventional","FHA","VA","USDA","Jumbo"] },
  { group: "Non-QM", types: [
    "DSCR","Bank Statement","P&L Only","1099 Only","ITIN",
    "Foreign National","Asset Depletion","WVOE","Non-QM (other)"
  ]},
  { group: "Refi", types: [
    "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
    "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist"
  ]},
  { group: "HELOC & Second", types: [
    "Lightning Equity Hybrid HELOC","Symmetry HELOC",
    "CE Second Elite","CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)"
  ]},
];
const LOAN_TYPES = LOAN_TYPE_GROUPS.flatMap(g => g.types);

// Jose tiene dos UIDs durante la transición PRMG → Barrett. Son la misma
// persona, así que la lista se colapsa por nombre — si no, sale duplicado en
// producción con sus cifras contadas dos veces.
const LO_LIST = Object.entries(TEAM)
  .filter(([_,p]) => p.role === "admin" || p.role === "lo")
  .filter(([_,p],i,arr) => arr.findIndex(([__,q]) => q.name === p.name) === i)
  .map(([uid,p]) => ({
    uid,
    name: p.name,
    nmls: p.nmls,
    role: p.role === "admin" ? "BM/MLO" : "LO",
    color: p.color,
  }));


// Quién es quién para el reparto. El piso de Ana es contractual y firmado con
// Barrett; nunca baja, y nunca se suma a los aumentos de la escalera.
// La etapa de Ana va escrita porque la app solo conoce su volumen desde que
// existe el sistema, no su carrera — derivarlo la dejaba como Newbie. La de
// Marelis se deriva a propósito: su $5M empieza a contar en Barrett y quiere
// avanzar sola cuando lo alcance.
//
//   isBM   · el BM y la sucursal son el mismo bolsillo
//   floor  · piso contractual, nunca baja, nunca se suma a la escalera
//   stage  · fija la etapa e ignora el volumen derivado
//   trainer· hay un trainer asignado a los archivos de este LO
// Contexto de reparto para las pantallas de archivo. Vive aquí para que la
// tarjeta, el modal y el payroll usen exactamente los mismos supuestos.
const COMP_YEAR = 1;
const BRANCH_FILES_MO = 8;

const COMP_ROSTER = {
  "Jose Del Valle":  { isBM:true },
  "Ana M Plasencia": { stage:"senior", floor:0.70 },
  "Marelis Pinales": { trainer:true },
};

const SAMPLE = [
  { id:"f1", lo:"Jose Del Valle", borrower:"Ariel Villalobos", loan:385000, type:"Conventional", stage:"Condition Clearing", daysInStage:3, closing:"2026-04-14", note:"Waiting on updated pay stubs", bps:null, closedAt:null },
  { id:"f2", lo:"Jose Del Valle", borrower:"Maria Santos", loan:420000, type:"FHA", stage:"Appraisal Ordered", daysInStage:6, closing:"2026-04-28", note:"", bps:null, closedAt:null },
];

function getPhase(stageName) {
  if (stageName === CLOSED_STAGE) return { id:99, label:"Closed", short:"✓", color:"#06D6A0", bg:"#00281e", stages:[CLOSED_STAGE] };
  if (stageName === REFERRED_OUT_STAGE) return { id:98, label:"Referred Out", short:"REF", color:"#A78BFA", bg:"#1f1830", stages:[REFERRED_OUT_STAGE] };
  if (stageName === PREP_STAGE) return { id:97, label:"Preparation", short:"PREP", color:"#7EC8A4", bg:"#16261f", stages:[PREP_STAGE] };
  return PHASES.find(p => p.stages.includes(stageName)) || PHASES[0];
}
function daysTil(d) { return d ? Math.ceil((new Date(d)-new Date())/86400000) : null; }
function urgency(f) {
  if (f.stage===CLOSED_STAGE) return "closed";
  if (f.stage===REFERRED_OUT_STAGE) return "referred";
  // A file in Preparation is not late — it is waiting on purpose. The only
  // thing that can be wrong is a review date that came and went.
  if (f.stage===PREP_STAGE) return prepDue(f) ? "critical" : "normal";
  // The contract date wins: the borrower's earnest money depends on it.
  const d=daysTil(f.closing);
  if(d!==null&&d<=3)return"critical";
  if(d!==null&&d<=7)return"warning";
  // Otherwise the stage's own budget. Two days in Registration is late;
  // four days in Conditions is normal. One shared threshold said neither.
  const u=stageUrgency(f);
  if(u.level==="late"||u.level==="critical")return"critical";
  if(u.level==="watch"||u.level==="warn")return"stale";
  return"normal";
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
  const [lang,setLang]=useState(()=>{
    try{ return localStorage.getItem("pipe_lang") || "es"; }catch{ return "es"; }
  });
  const L=(k,v)=>tr(k,lang,v);
  CURRENT_LANG = lang;
  useEffect(()=>{ try{localStorage.setItem("pipe_lang",lang);}catch{} },[lang]);
  const [view,setView]=useState("active");
  const [activePhase,setActivePhase]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const [showBackfill,setShowBackfill]=useState(false);
  const [detail,setDetail]=useState(null);
  const [prepFor,setPrepFor]=useState(null);
  const [archiveFor,setArchiveFor]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle");

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
          alert("This file does not look like a valid pipeline backup. No files found.");
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
        alert("Could not read backup file. Make sure it is a valid JSON file exported from this app.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!authReady) {
    return (
      <div style={{
        background:"#0D1117", minHeight:"100vh",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117. */
        :root{
          --fs-scale:1;
          --fs-1:calc(11.5px * var(--fs-scale));
          --fs-2:calc(12.5px * var(--fs-scale));
          --fs-3:calc(13.5px * var(--fs-scale));
          --fs-4:calc(14.5px * var(--fs-scale));
          --fs-5:calc(15.5px * var(--fs-scale));
          --fs-6:calc(17px   * var(--fs-scale));
          --fs-7:calc(19px   * var(--fs-scale));
          --fs-8:calc(21px   * var(--fs-scale));
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
        background:"#0D1117", minHeight:"100vh",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117. */
        :root{
          --fs-scale:1;
          --fs-1:calc(11.5px * var(--fs-scale));
          --fs-2:calc(12.5px * var(--fs-scale));
          --fs-3:calc(13.5px * var(--fs-scale));
          --fs-4:calc(14.5px * var(--fs-scale));
          --fs-5:calc(15.5px * var(--fs-scale));
          --fs-6:calc(17px   * var(--fs-scale));
          --fs-7:calc(19px   * var(--fs-scale));
          --fs-8:calc(21px   * var(--fs-scale));
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
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.5px"}}>
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
  const live=files.filter(f=>!isArchived(f));
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
    .filter(f=>!activePhase||getPhase(f.stage).id===activePhase);

  const advance=id=>setFiles(p=>p.map(f=>{
    if(f.id!==id)return f;
    // Don't auto-advance referred-out or closed files
    if(f.stage===CLOSED_STAGE || f.stage===REFERRED_OUT_STAGE || f.stage===PREP_STAGE)return f;
    if(f.archived)return f;
    const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);
    if(i===-1)return f; // unknown stage — don't silently drop it back to the start
    const n=ALL_STAGES[i+1];
    if(!n)return f;
    return stampEdit(stampStage(f, n.stage), profile, "stage_advanced", {from:f.stage, to:n.stage});
  }));
  const closeFile=id=>{
    setFiles(p=>p.map(f=>{
      if(f.id!==id) return f;
      if(f.stage===REFERRED_OUT_STAGE) return f; // un archivo referido afuera lo cierra el otro banco, no nosotros
      // No llamarla fundedDate: ese nombre ya existe importado del motor.
      const fundedOn = f.closing || today();
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
      alert("Only admins can delete files. Ask Jose to delete this for you.");
      return;
    }
    setFiles(p=>p.filter(f=>f.id!==id));
    setDetail(null);
  };

  const vol=active.reduce((s,f)=>s+(f.loan||0),0);
  const crit=active.filter(f=>urgency(f)==="critical").length;
  const phaseCounts=PHASES.map(p=>({...p,count:active.filter(f=>getPhase(f.stage).id===p.id).length}));

  return(
    <div style={{fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",background:"#0D1117",minHeight:"100vh",color:"var(--t1)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        /* ─── TOKENS · una sola fuente de verdad ───────────────────
           Todo tamano y todo color de texto sale de aqui. Para cambiar
           la escala completa solo se toca --fs-scale: el resto se
           recalcula solo. Los colores pasan WCAG AA sobre #0D1117. */
        :root{
          --fs-scale:1;
          --fs-1:calc(11.5px * var(--fs-scale));
          --fs-2:calc(12.5px * var(--fs-scale));
          --fs-3:calc(13.5px * var(--fs-scale));
          --fs-4:calc(14.5px * var(--fs-scale));
          --fs-5:calc(15.5px * var(--fs-scale));
          --fs-6:calc(17px   * var(--fs-scale));
          --fs-7:calc(19px   * var(--fs-scale));
          --fs-8:calc(21px   * var(--fs-scale));
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
        .sys{font-size:var(--fs-1);color:var(--t4);line-height:1.55;}
        .act{font-size:var(--fs-2);color:var(--t3);line-height:1.6;font-style:italic;}
        .act::before{content:"→";color:#F5A623;font-style:normal;
          margin-right:6px;font-weight:500;}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:#161B22;}::-webkit-scrollbar-thumb{background:#30363D;border-radius:2px;}
        .hov{transition:all .15s;cursor:pointer;border:none;}
        .hov:hover{opacity:.85;transform:translateY(-1px);}
        .card{transition:transform .15s,box-shadow .15s;cursor:pointer;}
        .card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.5)!important;}
        input,select,textarea{outline:none;}
        input::placeholder,textarea::placeholder{color:var(--t3);}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .2s ease;}
        tr.row:hover td{background:rgba(255,255,255,.03)!important;}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#161B22",borderBottom:"1px solid #21262D",padding:"14px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",letterSpacing:"-0.5px"}}>PIPELINE</div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"2px",marginTop:1}}>MORTGAGE BY DELVALLE</div>
        </div>
        <div style={{display:"flex",gap:20,marginLeft:8}}>
          {[["ACTIVE",active.length,"#4A90D9"],["CLOSED",closed.length,"#06D6A0"],["CRITICAL",crit,"#E85D75"],["VOLUME",`$${(vol/1e6).toFixed(1)}M`,"#F5A623"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:c}}>{v}</div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px"}}>{l}</div>
            </div>
          ))}
          {/* Always visible. A hidden list never gets opened; a number up here does. */}
          <div className="hov" onClick={()=>{setView("review");setActivePhase(null);}}
            title="Preparation files whose review date has arrived"
            style={{textAlign:"center",cursor:"pointer",padding:"0 10px",borderLeft:"1px solid #30363D"}}>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:dueReview.length>0?"#E85D75":"var(--t3)"}}>
              {dueReview.length}
            </div>
            <div style={{fontSize:"var(--fs-1)",color:dueReview.length>0?"#E85D75":"var(--t3)",letterSpacing:"1px"}}>DUE REVIEW</div>
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {saveStatus !== "idle" && (
            <div style={{
              fontSize:"var(--fs-2)", letterSpacing:"1px", padding:"4px 10px", borderRadius:12,
              background: saveStatus==="saving" ? "#21262D" : saveStatus==="saved" ? "rgba(6,214,160,.1)" : "rgba(232,93,117,.15)",
              color: saveStatus==="saving" ? "var(--t2)" : saveStatus==="saved" ? "#06D6A0" : "#E85D75",
              border: "1px solid " + (saveStatus==="saving" ? "#30363D" : saveStatus==="saved" ? "#06D6A0" : "#E85D75"),
              fontFamily:"DM Mono"
            }}>
              {saveStatus==="saving" ? "● SAVING…" : saveStatus==="saved" ? "✓ SAVED" : "⚠ SAVE FAILED"}
            </div>
          )}
          <input placeholder="Search borrower..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:6,padding:"7px 12px",color:"var(--t1)",fontSize:"var(--fs-4)",width:170}}/>
          <button className="hov" onClick={exportBackup}
            title="Download a JSON backup of your entire pipeline. Save it to Google Drive weekly."
            style={{background:"#21262D",color:"var(--t2)",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"1px solid #30363D"}}>
            ↓ BACKUP
          </button>
          {isAdmin && (
            <button className="hov" onClick={exportMarthaSheet} disabled={marthaBusy}
              title={TX("marthaHint")}
              style={{background:"#21262D",color:marthaBusy?"var(--t3)":"var(--t2)",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"1px solid #30363D",cursor:marthaBusy?"wait":"pointer"}}>
              {marthaBusy ? TX("marthaBusy") : TX("marthaBtn")}
            </button>
          )}
          {/* Las nueve fechas son de TINA: registro, divulgaciones,
              sometimiento. Ella las tiene en Arive. Un LO no sabe cuándo
              Tina registró, y Martha recibe el archivo ya registrado. */}
          {(isAdmin || isAssistant) && backfillCount(files) > 0 && (
            <button className="hov" onClick={()=>setShowBackfill(true)}
              title={TX("bfLead")}
              style={{background:"rgba(245,166,35,.1)",color:"#F5A623",borderRadius:6,
                padding:"8px 12px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",
                border:"1px solid #F5A62366",cursor:"pointer"}}>
              {TX("bfBtn")} {filesNeedingBackfill(files).length}
            </button>
          )}
          {isAdmin && (
            <label className="hov"
              title="Admin only — restore your pipeline from a JSON backup file"
              style={{background:"#21262D",color:"var(--t2)",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"1px solid #30363D",cursor:"pointer"}}>
              ↑ RESTORE
              <input type="file" accept="application/json,.json" onChange={importBackup} style={{display:"none"}}/>
            </label>
          )}
          <button className="hov" onClick={()=>setShowAdd(true)}
            style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 16px",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500}}>
            + NEW FILE
          </button>

          <div style={{display:"flex",border:"1px solid #30363D",borderRadius:6,overflow:"hidden",marginRight:2}}>
            {["es","en"].map(l=>(
              <button key={l} className="hov" onClick={()=>setLang(l)}
                style={{background:lang===l?"#F5A623":"transparent",color:lang===l?"#0D1117":"var(--t2)",
                  border:"none",padding:"6px 10px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",cursor:"pointer"}}>
                {l.toUpperCase()}
              </button>))}
          </div>
          <button className="hov" onClick={()=>setShowHelp(true)}
            title="Help & best practices"
            style={{background:"transparent",color:"var(--t2)",borderRadius:6,padding:"8px 10px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"1px solid #30363D",cursor:"pointer"}}>
            ❓ HELP
          </button>

          <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:12,marginLeft:4,borderLeft:"1px solid #30363D"}}>
            <div style={{
              width:32, height:32, borderRadius:"50%",
              background: profile.color, color:"#0D1117",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"Syne", fontWeight:800, fontSize:"var(--fs-3)"
            }}>
              {profile.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1.2}}>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"Syne",fontWeight:700}}>{profile.short}</span>
              <span style={{fontSize:"var(--fs-1)",color:profile.color,letterSpacing:"1px",textTransform:"uppercase"}}>{profile.role}</span>
            </div>
            <button className="hov"
              onClick={()=>{
                if(confirm("Sign out?")) signOut(auth);
              }}
              title="Sign out"
              style={{background:"transparent",color:"var(--t3)",borderRadius:6,padding:"6px 8px",fontFamily:"DM Mono",fontSize:"var(--fs-2)",border:"1px solid #30363D",cursor:"pointer"}}>
              SIGN OUT
            </button>
          </div>
        </div>
      </div>

      {/* TAB BAR — added REFERRED OUT and INBOUND filters */}
      <div style={{background:"#161B22",borderBottom:"1px solid #21262D",padding:"10px 24px",display:"flex",gap:8,alignItems:"center",overflowX:"auto"}}>
        {[
          ["ACTIVE PIPELINE",active.length,"active","#4A90D9"],
          ["CLOSED FILES",closed.length,"closed","#06D6A0"],
          ["🔀 REFERRED OUT",referredOut.length,"referred","#A78BFA"],
          ["🤝 INBOUND",inbound.length,"inbound","#FFD166"],
          ["⏸ PREPARATION",prep.length,"prep","#7EC8A4"],
          [`🔔 DUE REVIEW`,dueReview.length,"review",dueReview.length>0?"#E85D75":"var(--t3)"],
          ["🗄 ARCHIVED",archived.length,"archived","var(--t2)"],
        ].map(([l,c,v,col])=>(
          <button key={v} className="hov" onClick={()=>{setView(v);setActivePhase(null);}}
            style={{background:view===v?col:"#21262D",color:view===v?"#0D1117":col,borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500,whiteSpace:"nowrap"}}>
            {l} · {c}
          </button>
        ))}
        {(isAdmin||isProcessor)&&(
          <button className="hov" onClick={()=>{setView("processing");setActivePhase(null);}}
            style={{background:view==="processing"?"#F5A623":"#21262D",color:view==="processing"?"#0D1117":"#F5A623",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500,whiteSpace:"nowrap"}}>
            {TX("processingTab")}
          </button>
        )}
        <button className="hov" onClick={()=>{setView("production");setActivePhase(null);}}
          style={{background:view==="production"?"#BD65E8":"#21262D",color:view==="production"?"#0D1117":"#BD65E8",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500,whiteSpace:"nowrap"}}>
          📊 PRODUCTION
        </button>
        {view==="active"&&<>
          <div style={{width:1,height:20,background:"#30363D",margin:"0 4px"}}/>
          <button className="hov" onClick={()=>setActivePhase(null)}
            style={{background:!activePhase?"var(--t1)":"transparent",color:!activePhase?"#0D1117":"var(--t2)",borderRadius:20,padding:"4px 12px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",border:"1px solid #30363D",whiteSpace:"nowrap"}}>
            ALL · {active.length}
          </button>
          {phaseCounts.map(p=>(
            <button key={p.id} className="hov" onClick={()=>setActivePhase(activePhase===p.id?null:p.id)}
              style={{background:activePhase===p.id?p.color:"transparent",color:activePhase===p.id?"#0D1117":p.color,borderRadius:20,padding:"4px 12px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",border:`1px solid ${p.color}`,whiteSpace:"nowrap"}}>
              {p.short} · {p.count}
            </button>
          ))}
        </>}
        <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:"var(--fs-2)",color:"var(--t3)",whiteSpace:"nowrap"}}>
          <span style={{color:"#E85D75"}}>● CRITICAL ≤3d</span>
          <span style={{color:"#F5A623"}}>● WARNING ≤7d</span>
          <span style={{color:"var(--t3)"}}>● STALE 5d+</span>
        </div>
      </div>

      {migrado!==null&&(
        <div style={{margin:"0 24px 10px",background:"rgba(126,200,164,.1)",
          border:"1px solid #7EC8A4",borderRadius:8,padding:"11px 14px",
          fontSize:"var(--fs-3)",color:"#7EC8A4",lineHeight:1.6}}>
          {TX("migrated",{n:migrado})}
        </div>
      )}

      {idsBackfilled>0&&(
        <div style={{margin:"0 24px 10px",background:"rgba(74,144,217,.1)",border:"1px solid #4A90D9",
          borderRadius:8,padding:"10px 14px",fontSize:"var(--fs-3)",color:"#4A90D9",lineHeight:1.6}}>
          {TX("idsBackfilledMsg",{n:idsBackfilled})}
        </div>
      )}

      {sizeAlert&&(
        <div style={{margin:"0 24px",background:"rgba(232,93,117,.1)",border:"1px solid #E85D75",
          borderRadius:8,padding:"11px 14px",fontSize:"var(--fs-3)",color:"#E85D75",lineHeight:1.6}}>
          {sizeAlert > 1000000
            ? TX("docTooBig",{mb:(sizeAlert/1048576).toFixed(2)})
            : TX("docNearLimit",{mb:(sizeAlert/1048576).toFixed(2)})}
        </div>
      )}

      {/* CONTENT */}
      <div style={{padding:"20px 24px"}}>

        {view==="processing"&&(isAdmin||isProcessor)&&<ProcessingView
          files={files} profile={profile} lang={lang} onSetLang={setLang}
          onSaveFile={(id,next)=>updateFile(id,next)}
          onOpenFull={f=>setDetail(f)}
        />}

        {view==="production"&&<ProductionDashboard
          profile={profile}
          files={files}
          closed={closed}
          active={active}
          referredOut={referredOut}
          inbound={inbound}
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
        />}

        {/* REFERRED OUT TABLE */}
        {view==="referred"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#A78BFA"}}>🔀 REFERRED OUT — {referredOut.length} TOTAL</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>Files sent to external bankers. Click any row to view details + track outcome.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
            No referred-out files yet.<br/><br/>
            <span style={{fontSize:"var(--fs-3)"}}>To refer a file: open any active loan → change STAGE to "REFERRED OUT — EXTERNAL BANK" → fill in receiving banker details.</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #A78BFA"}}>
                  {["BORROWER","LOAN TYPE","AMOUNT","REFERRED TO","REASON","STATUS","FEE EARNED"].map((h,i)=>(
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
                    <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                      <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"#A78BFA",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${(f.loan/1000).toFixed(0)}K</td>
                      <td style={{padding:"11px 14px",color:"var(--t1)",background:i%2===0?"#0D1117":"#161B22"}}>
                        {ro.bankerName||"—"}<br/>
                        <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{ro.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"#0D1117":"#161B22"}}>{ro.reason||"—"}</td>
                      <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                        <span style={{
                          fontSize:"var(--fs-2)",padding:"3px 7px",borderRadius:4,
                          background: ro.status==="Closed (Funded)" ? "rgba(6,214,160,.15)" :
                                      ro.status==="Fell Through" ? "rgba(232,93,117,.15)" :
                                      ro.status==="Withdrawn by Borrower" ? "rgba(139,148,158,.15)" :
                                      "rgba(245,166,35,.15)",
                          color: ro.status==="Closed (Funded)" ? "#06D6A0" :
                                 ro.status==="Fell Through" ? "#E85D75" :
                                 ro.status==="Withdrawn by Borrower" ? "var(--t2)" :
                                 "#F5A623",
                        }}>{ro.status||"Pending"}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:isFunded?"#06D6A0":"var(--t3)",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#FFD166"}}>🤝 INBOUND REFERRALS — {inbound.length} TOTAL</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>Files sent TO us by external bankers. They follow normal pipeline stages.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
            No inbound referrals yet.<br/><br/>
            <span style={{fontSize:"var(--fs-3)"}}>To add an inbound: click "+ NEW FILE" → check "This is an inbound referral" at the top.</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #FFD166"}}>
                  {["BORROWER","LOAN TYPE","AMOUNT","REFERRED BY","STAGE","CLOSING"].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>{
                  const rb = f.referringBanker || {};
                  return (
                    <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                      <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"#FFD166",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${(f.loan/1000).toFixed(0)}K</td>
                      <td style={{padding:"11px 14px",color:"var(--t1)",background:i%2===0?"#0D1117":"#161B22"}}>
                        {rb.bankerName||"—"}<br/>
                        <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{rb.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:getPhase(f.stage).color,fontWeight:500,fontSize:"var(--fs-3)",background:i%2===0?"#0D1117":"#161B22"}}>{f.stage}</td>
                      <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.closedAt||f.closing||"—"}</td>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#06D6A0"}}>CLOSED FILES — {closed.length} TOTAL</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>All funded loans. Click any row to view or reopen.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>No closed files yet.</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #06D6A0"}}>
                  {["BORROWER","TYPE","LOAN AMOUNT","CLOSED DATE","NOTES",""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"#06D6A0",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${f.loan.toLocaleString()}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.closedAt||f.closing}</td>
                    <td style={{padding:"11px 14px",color:"var(--t3)",fontStyle:"italic",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",background:i%2===0?"#0D1117":"#161B22"}}>{f.note||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();reopenFile(f.id);}}
                        style={{background:"#21262D",color:"var(--t2)",borderRadius:5,padding:"4px 10px",fontSize:"var(--fs-2)",fontFamily:"DM Mono"}}>REOPEN</button>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:view==="review"?"#E85D75":"#7EC8A4"}}>
              {view==="review" ? `🔔 DUE REVIEW — ${dueReview.length}` : `⏸ PREPARATION — ${prep.length}`}
            </span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>
              {view==="review"
                ? "The review date arrived. Decide: continue, reschedule, or archive."
                : "Alive but not buyable yet. No stage clock — these wait against a review date."}
            </span>
          </div>
          {display.length===0?(
            <div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>
              {view==="review"
                ? "Nothing due today. ✓"
                : <>No files in Preparation.<br/><br/><span style={{fontSize:"var(--fs-3)"}}>To send one here: open any active file → ⏸ PREP → pick a reason and a review date.</span></>}
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
                    style={{background:"#0D1117",border:`1px solid ${edge}`,borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6}}>
                      <div>
                        <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",lineHeight:1.2}}>{f.borrower}</div>
                        <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{f.type} · ${(f.loan/1000).toFixed(0)}k</div>
                        {f.lo&&<div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:1}}>{f.lo.split(" ")[0]}</div>}
                      </div>
                      {locked
                        ? <span style={{background:"#E85D75",color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-1)",fontWeight:500,whiteSpace:"nowrap"}}>DECIDE NOW</span>
                        : due && <span style={{background:"#F5A623",color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-2)",fontWeight:500}}>DUE</span>}
                    </div>

                    <div style={{background:"rgba(126,200,164,.07)",border:"1px solid #7EC8A433",borderRadius:6,padding:"7px 9px"}}>
                      <div style={{fontSize:"var(--fs-3)",color:"#7EC8A4",fontWeight:500}}>{r.label}</div>
                      <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:3}}>
                        Review {p.reviewOn||"—"}
                        {" · "}
                        <span style={{color:due?"#E85D75":"var(--t3)"}}>
                          {dtr>0?`in ${dtr}d`:dtr===0?"today":`${Math.abs(dtr)}d overdue`}
                        </span>
                      </div>
                    </div>

                    <div style={{fontSize:"var(--fs-2)",color:locked?"#E85D75":"var(--t3)"}}>
                      {age}d in preparation
                      <span style={{color:"var(--t4)"}}> / {PREP_MAX_DAYS} max</span>
                      {(p.reschedules>0)&&<span style={{color:"var(--t4)"}}> · rescheduled {p.reschedules}×</span>}
                    </div>
                    <div style={{height:3,background:"#21262D",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(100,(age/PREP_MAX_DAYS)*100)}%`,background:locked?"#E85D75":age/PREP_MAX_DAYS>0.75?"#F5A623":"#7EC8A4"}}/>
                    </div>

                    {(p.note||f.note)&&<div style={{fontSize:"var(--fs-2)",color:"var(--t2)",borderTop:"1px solid #21262D",paddingTop:6,fontStyle:"italic"}}>{p.note||f.note}</div>}
                    {locked&&<div style={{fontSize:"var(--fs-2)",color:"#E85D75",lineHeight:1.4}}>
                      Past {PREP_MAX_DAYS} days — the credit report has expired. Return it or archive it; it can't be rescheduled again.
                    </div>}

                    <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();if(confirm(`Bring ${f.borrower} back to the active pipeline?\n\nStage returns to "${p.prevStage||"Lead Inquiry"}" and the stage clock starts today.`))continueFromPrep(f.id);}}
                        style={{flex:1,background:"rgba(74,144,217,.1)",border:"1px solid #4A90D9",borderRadius:5,color:"#4A90D9",fontSize:"var(--fs-2)",padding:"5px 8px",whiteSpace:"nowrap"}}>
                        ✓ CONTINUE
                      </button>
                      <button className="hov" disabled={locked} onClick={e=>{e.stopPropagation();if(!locked)setPrepFor(f);}}
                        title={locked?`Locked at ${PREP_MAX_DAYS} days`:"Set a new review date"}
                        style={{flex:1,background:locked?"#161B22":"rgba(245,166,35,.1)",border:`1px solid ${locked?"#21262D":"#F5A623"}`,borderRadius:5,color:locked?"#30363D":"#F5A623",fontSize:"var(--fs-2)",padding:"5px 8px",whiteSpace:"nowrap",cursor:locked?"not-allowed":"pointer"}}>
                        ↻ RESCHEDULE
                      </button>
                      <button className="hov" onClick={e=>{e.stopPropagation();setArchiveFor(f);}}
                        style={{background:"rgba(110,118,129,.12)",border:"1px solid #30363D",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 10px",whiteSpace:"nowrap"}}>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t2)"}}>🗄 ARCHIVED — {archived.length}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>Out of every count and every average. Nothing was deleted — restore any row.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>Nothing archived yet.</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #30363D"}}>
                  {["BORROWER","TYPE","AMOUNT","LAST STAGE","REASON","ARCHIVED",""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",background:i%2===0?"#0D1117":"#161B22"}}>${((f.loan||0)/1000).toFixed(0)}K</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"#0D1117":"#161B22"}}>{isPrep(f)?(f.prep?.prevStage||"Preparation"):f.stage}</td>
                    <td style={{padding:"11px 14px",color:"var(--t2)",fontSize:"var(--fs-3)",background:i%2===0?"#0D1117":"#161B22"}}>{f.archiveReason||"—"}</td>
                    <td style={{padding:"11px 14px",color:"var(--t3)",fontSize:"var(--fs-3)",background:i%2===0?"#0D1117":"#161B22"}}>{f.archivedAt||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();restoreFile(f.id);}}
                        style={{background:"#21262D",color:"#7EC8A4",borderRadius:5,padding:"4px 10px",fontSize:"var(--fs-2)",fontFamily:"DM Mono"}}>↩ RESTORE</button>
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
              <div key={phase.id} className="fi" style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
                <div style={{background:phase.bg,borderBottom:`2px solid ${phase.color}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:phase.color,letterSpacing:"1px"}}>PHASE {phase.id} — {phase.label.toUpperCase()}</span>
                  <span style={{background:phase.color,color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{pf.length}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:5,flexWrap:"wrap"}}>
                    {phase.stages.map((s,i)=><span key={i} style={{fontSize:"var(--fs-2)",color:"var(--t3)",background:"#0D1117",borderRadius:4,padding:"2px 6px"}}>{s}</span>)}
                  </div>
                </div>
                {pf.length===0?(
                  <div style={{padding:"18px",color:"var(--t4)",fontSize:"var(--fs-4)",textAlign:"center"}}>No active files in this phase</div>
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
                          style={{background:"#0D1117",border:`1px solid ${uc}`,borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",lineHeight:1.2}}>
                                {f.borrower}
                                {f.isInbound && <span title="Inbound referral" style={{marginLeft:6,fontSize:"var(--fs-2)",color:"#FFD166"}}>🤝</span>}
                              </div>
                              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{f.type} · ${(f.loan/1000).toFixed(0)}k</div>
                              {f.lo&&<div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:1}}>{f.lo.split(" ")[0]}{f.referralPartner?` · ${f.referralPartner.split(" ")[0]}`:""}</div>}
                            </div>
                            {u!=="normal"&&<span style={{background:uc,color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:"var(--fs-2)",fontWeight:500}}>
                              {u==="critical"?"CRITICAL":u==="warning"?"WARN":"STALE"}
                            </span>}
                          </div>
                          <div style={{display:"flex",gap:3}}>
                            {ph.stages.map((_,i)=><div key={i} style={{height:4,flex:1,borderRadius:2,background:i<=si?ph.color:"var(--t4)"}}/>)}
                          </div>
                          <div style={{fontSize:"var(--fs-3)",color:ph.color,fontWeight:500}}>{f.stage}</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                            <span title={`File age: ${fileAge(f) ?? "—"} days`}>
                              {daysInStage(f)===null ? "— in stage" : `${daysInStage(f)}d in stage`}
                              {fileAge(f)!==null && <span style={{color:"var(--t4)"}}> · {fileAge(f)}d total</span>}
                            </span>
                            {f.closing&&<span style={{color:cd!==null&&cd<=3?"#E85D75":cd!==null&&cd<=7?"#F5A623":"var(--t3)"}}>
                              {cd===0?"CLOSING TODAY":cd!==null&&cd>0?`Close in ${cd}d`:cd!==null?"PAST DUE":f.closing}
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
                          <LenderStrip file={f}/>
                          {(()=>{ const w=worstFinding(f); if(!w) return null;
                            const m=waitingMeta(w.waitingOn), edad=findingAge(w);
                            return (
                              <div style={{background:"rgba(232,93,117,.08)",border:"1px solid #E85D7544",
                                borderLeft:"2px solid #E85D75",borderRadius:"0 5px 5px 0",
                                padding:"6px 8px",marginTop:7}}>
                                <div style={{fontSize:"var(--fs-2)",color:"#E85D75",lineHeight:1.4,
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
                              <div style={{borderTop:"1px solid #21262D",paddingTop:6}}>
                                <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontStyle:"italic",lineHeight:1.45,
                                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                                  {n.text}
                                </div>
                                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>
                                  {n.legacy
                                    ? "nota anterior al historial · sin fecha ni autor"
                                    : `${timeAgo(n.at)}${n.by?` · ${n.by.split(" ")[0]}`:""}`}
                                  {c>1?" · "+TX("nMore",{n:c-1}):""}
                                </div>
                              </div>
                            );})()}
                          {f.lastEditedBy&&!latestNote(f)&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"0.5px",borderTop:"1px solid #21262D",paddingTop:6}}>
                            Edited by {f.lastEditedBy.name?.split(" ")[0]||"?"} · {timeAgo(f.lastEditedAt)}
                          </div>}
                          {(f.phone || f.email) && (
                            <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                              {f.phone && (
                                <a href={`tel:${f.phone.replace(/[^\d+]/g,"")}`} onClick={e=>e.stopPropagation()}
                                  title={`Call ${f.phone}`}
                                  style={{background:"rgba(74,144,217,.08)",border:"1px solid #4A90D944",borderRadius:4,padding:"3px 7px",color:"#4A90D9",fontSize:"var(--fs-2)",fontFamily:"DM Mono",textDecoration:"none"}}>
                                  📱 {f.phone}
                                </a>
                              )}
                              {f.email && (
                                <a href={`mailto:${f.email}`} onClick={e=>e.stopPropagation()}
                                  title={`Email ${f.email}`}
                                  style={{background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",borderRadius:4,padding:"3px 7px",color:"#BD65E8",fontSize:"var(--fs-2)",fontFamily:"DM Mono",textDecoration:"none"}}>
                                  ✉
                                </a>
                              )}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6,marginTop:2}}>
                            <button className="hov" onClick={e=>{e.stopPropagation();advance(f.id);}}
                              style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid #21262D",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 0"}}>
                              ADVANCE →
                            </button>
                            <button className="hov" onClick={e=>{e.stopPropagation();if(confirm(`Mark ${f.borrower} as CLOSED?`))closeFile(f.id);}}
                              style={{background:"rgba(6,214,160,.1)",border:"1px solid #06D6A0",borderRadius:5,color:"#06D6A0",fontSize:"var(--fs-2)",padding:"5px 10px"}}>
                              CLOSE ✓
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

      {detail&&<DetailModal file={detail} profile={profile} allFiles={files} L={L} lang={lang} onSetLang={setLang} onClose={()=>setDetail(null)}
        onSave={p=>{updateFile(detail.id,p);setDetail(f=>({...f,...p}));}}
        onDelete={()=>deleteFile(detail.id)}
        onAdvance={()=>{advance(detail.id);setDetail(f=>{const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);const n=ALL_STAGES[i+1];return n?{...f,stage:n.stage,daysInStage:0}:f;});}}
        onCloseFile={()=>closeFile(detail.id)}
        onReopen={()=>reopenFile(detail.id)}
        onPrep={()=>setPrepFor(detail)}
        onArchive={()=>setArchiveFor(detail)}
        onRestore={()=>restoreFile(detail.id)}
        onContinuePrep={()=>continueFromPrep(detail.id)}
        isClosed={detail.stage===CLOSED_STAGE}
      />}
      {showAdd&&<AddModal profile={profile} existingFiles={files} onClose={()=>setShowAdd(false)} onAdd={f=>{
        const stamped = stampEdit(f, profile, "created");
        setFiles(p=>[...p, {...stamped, createdBy:{uid:profile.uid,name:profile.name}, createdAt:new Date().toISOString()}]);
        setShowAdd(false);
      }}/>}
      {prepFor&&<PrepModal file={prepFor} onClose={()=>setPrepFor(null)}
        onConfirm={(payload)=>{sendToPrep(prepFor.id,payload);setPrepFor(null);}}/>}
      {archiveFor&&<ArchiveModal file={archiveFor} onClose={()=>setArchiveFor(null)}
        onConfirm={(reason)=>{archiveFile(archiveFor.id,reason);setArchiveFor(null);}}/>}
      {showHelp&&<HelpModal profile={profile} onClose={()=>setShowHelp(false)}/>}
      {showBackfill&&<BackfillModal files={files} profile={profile} lang={lang}
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
        style={{background:"#161B22",border:"1px solid #7EC8A455",borderRadius:12,width:"100%",maxWidth:430,maxHeight:"calc(100vh - 40px)",overflowY:"auto",padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"#7EC8A4"}}>
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
            {PREP_REASONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {r.why&&<div style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginTop:6,lineHeight:1.5,fontStyle:"italic"}}>{r.why}</div>}
        </div>

        <div>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            REVIEW ON {r.mode==="date"&&<span style={{color:"#F5A623"}}>— pick the real date</span>}
          </div>
          <input type="date" value={reviewOn} onChange={e=>setReviewOn(e.target.value)} style={fs}/>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {[30,60,90].map(d=>(
              <button key={d} className="hov" onClick={()=>setReviewOn(addDaysISO(today(),d))}
                style={{background:"#21262D",border:"1px solid #30363D",borderRadius:5,color:"var(--t2)",fontSize:"var(--fs-3)",padding:"5px 12px",fontFamily:"DM Mono"}}>
                +{d}d
              </button>
            ))}
            {daysOut!==null&&<span style={{fontSize:"var(--fs-2)",color:daysOut>PREP_MAX_DAYS?"#E85D75":"var(--t3)",alignSelf:"center",marginLeft:4}}>
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
            style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",border:"none"}}>CANCEL</button>
          <button className="hov"
            disabled={!reviewOn}
            onClick={()=>{ if(reviewOn) onConfirm({reason, reviewOn, note}); }}
            style={{flex:2,background:reviewOn?"#7EC8A4":"#21262D",color:reviewOn?"#0D1117":"var(--t3)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:reviewOn?"pointer":"not-allowed"}}>
            {reviewOn?(isReschedule?"RESCHEDULE":"SEND TO PREPARATION"):"PICK A REVIEW DATE"}
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
function BackfillModal({files, profile, lang, onClose, onApply}){
  const pendientes = filesNeedingBackfill(files);
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
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"#161B22",
        border:"1px solid #F5A62355",borderRadius:12,width:"100%",maxWidth:960,
        maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #21262D",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-6)",color:"#F5A623"}}>
                {TX("bfTitle")}
              </div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:5,lineHeight:1.6,maxWidth:720}}>
                {TX("bfLead")}
              </div>
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",
              color:"var(--t4)",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
          </div>
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
              <div key={f.id} style={{borderBottom:"1px solid #21262D",padding:"12px 0"}}>
                <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:8}}>
                  <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-4)",
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
                      <div style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginBottom:3}}>
                        {P2(h)}
                      </div>
                      <input type="date" value={datos[f.id]?.[h.id]||""}
                        onChange={e=>set(f.id,h.id,e.target.value)} style={fs2}/>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{padding:"13px 22px",borderTop:"1px solid #21262D",background:"#161B22",
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
            style={{background:llenos?"#F5A623":"#21262D",color:llenos?"#0D1117":"var(--t4)",
              borderRadius:7,padding:"10px 20px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",
              fontWeight:500,border:"none",cursor:llenos?"pointer":"not-allowed"}}>
            {TX("bfSave")} · {llenos}
          </button>
          {hecho!==null&&(
            <span style={{fontSize:"var(--fs-2)",color:"#7EC8A4"}}>{TX("bfSaved",{n:hecho})}</span>
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
        style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:400,padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--t1)"}}>🗄 ARCHIVE</div>
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
            style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",border:"none"}}>CANCEL</button>
          <button className="hov" onClick={()=>onConfirm(reason)}
            style={{flex:2,background:"#30363D",color:"var(--t1)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500,border:"none"}}>ARCHIVE</button>
        </div>
      </div>
    </div>
  );
}


function ProductionDashboard({profile, files, closed, active, referredOut, inbound, onOpenFile, onBulkUpdate, payrollLog, onLogPayroll, onClosePeriod, onDeletePayrollLog, dpaDetails, onSaveDpa}){
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  const isAssistant = profile?.role === "assistant";
  const [compYear,setCompYear]=useState(1);
  const [justClaimed,setJustClaimed]=useState(null);
  const [picked,setPicked]=useState(()=>new Set());
  const [showRequest,setShowRequest]=useState(false);
  const [copied,setCopied]=useState(false);
  const [openLog,setOpenLog]=useState(null);
  const [reqError,setReqError]=useState(null);
  const [scView,setScView]=useState("lender");
  // El equipo de apoyo entra directo a especialidades: consulta y captura,
  // sin las columnas de rendimiento y volumen que no necesitan.
  const [scProduct,setScProduct]=useState(null);
  const [scCat,setScCat]=useState("dpa");
  // El plan de mezcla vive aquí para poder ajustarlo sin tocar el motor.
  const [mixPlan,setMixPlan]=useState({"NV — DPA":50,"Standard":40,"FL — DPA":10});
  const [scSpec,setScSpec]=useState(null);
  const [dpaOpen,setDpaOpen]=useState(null);
  const [dpaDraft,setDpaDraft]=useState(null);
  const [filesMo,setFilesMo]=useState(8);
  const payroll=payrollSummary(files,{year:compYear,filesPerMonth:filesMo,roster:COMP_ROSTER});
  const [prodTab,setProdTab]=useState(profile?.role==="assistant"?"scorecard":"team");
  const [showAutoFixPreview, setShowAutoFixPreview] = useState(false);

  const thisMonth=new Date().toISOString().slice(0,7);
  const closedThisMonth=closed.filter(f=>f.closedAt&&f.closedAt.startsWith(thisMonth));

  const closedVol=closed.reduce((s,f)=>s+(f.loan||0),0);
  const activeVol=active.reduce((s,f)=>s+(f.loan||0),0);
  const monthVol=closedThisMonth.reduce((s,f)=>s+(f.loan||0),0);

  const loStats=LO_LIST.map(lo=>{
    const loFiles=files.filter(f=>f.lo===lo.name);
    const loClosed=closed.filter(f=>f.lo===lo.name);
    const loActive=active.filter(f=>f.lo===lo.name);
    const loClosedVol=loClosed.reduce((s,f)=>s+(f.loan||0),0);
    const loActiveVol=loActive.reduce((s,f)=>s+(f.loan||0),0);
    const loMonthClosed=loClosed.filter(f=>f.closedAt&&f.closedAt.startsWith(thisMonth));
    return {...lo, total:loFiles.length, closedCount:loClosed.length, activeCount:loActive.length,
      closedVol:loClosedVol, activeVol:loActiveVol, monthCount:loMonthClosed.length,
      monthVol:loMonthClosed.reduce((s,f)=>s+(f.loan||0),0)};
  });

  // El override anterior —25 bps planos, excluyendo HELOCs y segundas, ciclo
  // mensual— desapareció con la mudanza a Barrett. Lo reemplaza loanSplit(),
  // que reparte porcentajes del NET según etapa, trainer, año y volumen.
  const myComp=f=>fileCompDollars(f,BPS_RATE);
  const myClosedFiles = closed.filter(f=>f.lo===profile.name);
  const myTotalComp = myClosedFiles.reduce((s,f)=>s+myComp(f),0);

  // El campo es texto libre y APG aparecía cuatro veces con 29 archivos
  // repartidos. partnerLeaderboard unifica lo que solo cambia en mayúsculas,
  // puntuación o palabras genéricas como "Realty" y "Group".
  const topRefs=partnerLeaderboard(files).map(r=>({
    name:r.name, total:r.files, closed:r.closed, active:r.active,
    vol:r.fundedVolume, variants:r.variants, merged:r.merged,
  }));

  // ─── BANK-TO-BANK REFERRAL METRICS ───
  // Outbound: deals we referred to other bankers
  const outboundFunded = (referredOut||[]).filter(f=>(f.referredOut||{}).status==="Closed (Funded)");
  const outboundPending = (referredOut||[]).filter(f=>!(f.referredOut||{}).status || (f.referredOut||{}).status==="Pending at Banker");
  const outboundLost = (referredOut||[]).filter(f=>(f.referredOut||{}).status==="Fell Through" || (f.referredOut||{}).status==="Withdrawn by Borrower");
  const outboundFundedVol = outboundFunded.reduce((s,f)=>{
    const ro = f.referredOut||{};
    return s + (parseInt(ro.finalLoanAmount)||f.loan||0);
  }, 0);
  const outboundTotalVol = (referredOut||[]).reduce((s,f)=>s+(f.loan||0), 0);
  // Fees earned on outbound deals that closed (50 bps × final loan amount)
  const outboundFeesEarned = outboundFunded.reduce((s,f)=>{
    const ro = f.referredOut||{};
    const finalAmt = parseInt(ro.finalLoanAmount)||f.loan||0;
    return s + Math.round(finalAmt * REFERRAL_FEE_BPS / 10000);
  }, 0);
  // Lo que se habría ganado cerrándolo en casa, a comp completa
  const outboundWouldHaveEarned = outboundFunded.reduce((s,f)=>{
    const ro = f.referredOut||{};
    const finalAmt = parseInt(ro.finalLoanAmount)||f.loan||0;
    return s + fileCompDollars(f,BPS_RATE,finalAmt);
  }, 0);
  const outboundLostComp = outboundWouldHaveEarned - outboundFeesEarned;

  // Inbound: deals other bankers sent to us
  const inboundList = inbound || [];
  const inboundClosed = inboundList.filter(f=>f.stage===CLOSED_STAGE);
  const inboundActive = inboundList.filter(f=>f.stage!==CLOSED_STAGE && f.stage!==REFERRED_OUT_STAGE);
  const inboundFundedVol = inboundClosed.reduce((s,f)=>s+(f.loan||0), 0);
  const inboundActiveVol = inboundActive.reduce((s,f)=>s+(f.loan||0), 0);
  // Comp earned on inbound closed deals (full BPS)
  const inboundCompEarned = inboundClosed.reduce((s,f)=>s+fileCompDollars(f,BPS_RATE), 0);

  // Reciprocity by banker (combine outbound + inbound per banker name)
  const bankerMap = {};
  (referredOut||[]).forEach(f=>{
    const ro = f.referredOut||{};
    const name = ro.bankerName || "(unknown)";
    if(!bankerMap[name]) bankerMap[name] = {name, company:ro.bankerCompany||"", sentOut:0, sentOutVol:0, receivedIn:0, receivedInVol:0};
    bankerMap[name].sentOut++;
    bankerMap[name].sentOutVol += (f.loan||0);
  });
  inboundList.forEach(f=>{
    const rb = f.referringBanker||{};
    const name = rb.bankerName || "(unknown)";
    if(!bankerMap[name]) bankerMap[name] = {name, company:rb.bankerCompany||"", sentOut:0, sentOutVol:0, receivedIn:0, receivedInVol:0};
    bankerMap[name].receivedIn++;
    bankerMap[name].receivedInVol += (f.loan||0);
  });
  const bankerReciprocity = Object.values(bankerMap).sort((a,b)=>(b.sentOut+b.receivedIn)-(a.sentOut+a.receivedIn));

  // Monthly production aggregation (closed files)
  const monthlyMap = {};
  closed.forEach(f=>{
    if(!f.closedAt) return;
    const month = f.closedAt.slice(0,7);
    if(!monthlyMap[month]) monthlyMap[month] = {month, units:0, volume:0, files:[]};
    monthlyMap[month].units++;
    monthlyMap[month].volume += (f.loan||0);
    monthlyMap[month].files.push(f);
  });
  const last12Months = [];
  // Se llamaba `today` y tapaba la función today() importada del motor en todo
  // el componente. Tres llamadas quedaban rotas — el botón de reclamar y el
  // cierre de corte fallaban con TX("notAFunction") sin decir por qué.
  const nowDate = new Date();
  for(let i=11; i>=0; i--){
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    last12Months.push(monthlyMap[key] || {month:key, units:0, volume:0, files:[]});
  }
  const maxUnits = Math.max(1, ...last12Months.map(m=>m.units));
  const maxVolume = Math.max(1, ...last12Months.map(m=>m.volume));
  const yearlyMap = {};
  Object.values(monthlyMap).forEach(m=>{
    const yr = m.month.slice(0,4);
    if(!yearlyMap[yr]) yearlyMap[yr] = {year:yr, units:0, volume:0};
    yearlyMap[yr].units += m.units;
    yearlyMap[yr].volume += m.volume;
  });
  const yearlyList = Object.values(yearlyMap).sort((a,b)=>b.year.localeCompare(a.year));

  const validLoNames = new Set(LO_LIST.map(l=>l.name));
  function suggestLoMatch(rawLo){
    if(!rawLo || typeof rawLo !== "string") return null;
    const trimmed = rawLo.trim();
    if(validLoNames.has(trimmed)) return trimmed;
    const lcTrimmed = trimmed.toLowerCase();
    const ciMatch = LO_LIST.find(l=>l.name.toLowerCase() === lcTrimmed);
    if(ciMatch) return ciMatch.name;
    const prefixMatch = LO_LIST.find(l=>lcTrimmed.startsWith(l.name.toLowerCase()) || l.name.toLowerCase().startsWith(lcTrimmed));
    if(prefixMatch) return prefixMatch.name;
    const lastWord = lcTrimmed.split(/\s+/).pop();
    if(lastWord && lastWord.length > 3){
      const surnameMatch = LO_LIST.find(l=>l.name.toLowerCase().includes(lastWord));
      if(surnameMatch) return surnameMatch.name;
    }
    const firstWord = lcTrimmed.split(/\s+/)[0];
    if(firstWord && firstWord.length > 2){
      const firstNameMatch = LO_LIST.find(l=>l.name.toLowerCase().startsWith(firstWord));
      if(firstNameMatch) return firstNameMatch.name;
    }
    return null;
  }
  const orphanFiles = files.filter(f=>!f.lo || !validLoNames.has(f.lo))
    .map(f=>({...f, _suggestedLo: suggestLoMatch(f.lo)}));
  const autoFixableCount = orphanFiles.filter(f=>f._suggestedLo).length;
  const bestMonth = last12Months.reduce((best,m)=>m.units>best.units?m:best, last12Months[0]);
  const worstMonth = last12Months.filter(m=>m.units>0).reduce((worst,m)=>m.units<worst.units?m:worst, last12Months.find(m=>m.units>0)||last12Months[0]);
  function monthLabel(m){
    const [y,mm] = m.split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[parseInt(mm)-1]} '${y.slice(2)}`;
  }

  const loColors = LO_LIST.map(lo=>lo.color||"#4A90D9");

  return(
    <div className="fi" style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* BRANCH STATS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
        {[
          {label:"TOTAL FILES",value:files.length,color:"#4A90D9"},
          {label:"CLOSED LOANS",value:closed.length,color:"#06D6A0"},
          {label:"ACTIVE PIPELINE",value:active.length,color:"#F5A623"},
          {label:"CLOSED THIS MONTH",value:closedThisMonth.length,color:"#BD65E8"},
          {label:"PIPELINE VOLUME",value:`$${(activeVol/1e6).toFixed(2)}M`,color:"#4A90D9"},
          {label:"FUNDED VOLUME",value:`$${(closedVol/1e6).toFixed(2)}M`,color:"#06D6A0"},
          {label:"MONTH VOLUME",value:`$${(monthVol/1000).toFixed(0)}K`,color:"#BD65E8"},
          {label:"BRANCH VOLUME",value:`$${((closedVol+activeVol)/1e6).toFixed(2)}M`,color:"#F5A623"},
        ].map(s=>(
          <div key={s.label} style={{background:"#161B22",border:`1px solid ${s.color}33`,borderTop:`3px solid ${s.color}`,borderRadius:8,padding:"12px"}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{s.label}</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* INNER TAB BAR — now includes BANK REFERRALS */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
          !isAssistant && ["team","🏆 TEAM PRODUCTION"],
          !isAssistant && ["monthly","📅 MONTHLY"],
          !isAssistant && ["referrals","🤝 REFERRAL PARTNERS"],
          !isAssistant && ["bankrefs","🏦 BANK REFERRALS"],
          isLO && ["mycomp","💵 MY COMP"],
          isAdmin && ["override","💰 OVERRIDE & COMP"],
          ["scorecard",TX("scorecardTab")],
          !isAssistant && ["mix",TX("mixTab")],
        ].filter(Boolean).map(([t,l])=>(
          <button key={t} className="hov" onClick={()=>setProdTab(t)}
            style={{background:prodTab===t?"#F5A623":"#21262D",color:prodTab===t?"#0D1117":"var(--t2)",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500}}>
            {l}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",alignSelf:"center"}}>
          {isAdmin ? "ADMIN VIEW · ALL DATA VISIBLE" : isLO ? "LO VIEW · YOUR COMP ONLY" : "ASSISTANT VIEW · NO COMP"}
        </div>
      </div>

      {/* TEAM PRODUCTION TAB */}
      {prodTab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {loStats.map((lo,i)=>(
            <div key={lo.name} style={{background:"#161B22",border:`1px solid ${loColors[i]}44`,borderRadius:10,overflow:"hidden"}}>
              <div style={{background:`${loColors[i]}18`,borderBottom:`2px solid ${loColors[i]}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:loColors[i],display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",color:"#0D1117",flexShrink:0}}>
                  {lo.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:loColors[i]}}>{lo.name}</div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{lo.role}</div>
                </div>
              </div>
              <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {l:"CLOSED",v:lo.closedCount,c:loColors[i]},
                  {l:"ACTIVE",v:lo.activeCount,c:"#F5A623"},
                  {l:"THIS MO",v:lo.monthCount,c:"#BD65E8"},
                ].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"#0D1117",borderRadius:6,padding:"8px 4px"}}>
                    <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:s.c}}>{s.v}</div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"0.5px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"0 14px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{background:"#0D1117",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>FUNDED VOL</div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#06D6A0"}}>${(lo.closedVol/1000).toFixed(0)}K</div>
                </div>
                <div style={{background:"#0D1117",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>PIPELINE</div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#4A90D9"}}>${(lo.activeVol/1000).toFixed(0)}K</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {orphanFiles.length > 0 && (
          <div style={{background:"#161B22",border:"1px solid #E85D7544",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"rgba(232,93,117,.08)",borderBottom:"2px solid #E85D75",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#E85D75",letterSpacing:"1px"}}>⚠ UNASSIGNED LO FILES</span>
              <span style={{background:"#E85D75",color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{orphanFiles.length}</span>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginLeft:6,flex:1,minWidth:200}}>won't show in production stats until fixed · click any row to open & fix manually</span>
              {isAdmin && autoFixableCount > 0 && (
                <button className="hov" onClick={()=>setShowAutoFixPreview(true)}
                  style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"7px 14px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ AUTO-FIX {autoFixableCount}
                </button>
              )}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["BORROWER","TYPE","LOAN","STAGE","CURRENT LO VALUE","SUGGESTED FIX"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":i===2?"center":"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orphanFiles.map((f,i)=>(
                  <tr key={f.id} className="row" onClick={()=>onOpenFile && onOpenFile(f)}
                    style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22",cursor:"pointer"}}>
                    <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)"}}>{f.borrower}</td>
                    <td style={{padding:"10px 14px",color:"var(--t2)"}}>{f.type}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>${(f.loan/1000).toFixed(0)}K</td>
                    <td style={{padding:"10px 14px",color:"var(--t2)"}}>{f.stage}</td>
                    <td style={{padding:"10px 14px",color:"#E85D75",fontWeight:500,fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                    <td style={{padding:"10px 14px"}}>
                      {f._suggestedLo ? (
                        <span style={{color:"#06D6A0",fontWeight:500}}>→ {f._suggestedLo}</span>
                      ) : (
                        <span style={{color:"var(--t3)",fontStyle:"italic"}}>no match · fix manually</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAutoFixPreview && isAdmin && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowAutoFixPreview(false)}>
            <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:680,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"#F5A623"}}>✨ AUTO-FIX PREVIEW</div>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:4,lineHeight:1.5}}>
                    Review the suggested LO assignments below. Click APPLY to update all {autoFixableCount} files at once.
                  </div>
                </div>
                <button onClick={()=>setShowAutoFixPreview(false)} style={{background:"transparent",border:"none",color:"var(--t3)",fontSize:"var(--fs-9)",cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #30363D"}}>
                      {["BORROWER","CURRENT","→","NEW LO"].map((h,i)=>(
                        <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orphanFiles.filter(f=>f._suggestedLo).map((f,i)=>(
                      <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                        <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)"}}>{f.borrower}</td>
                        <td style={{padding:"10px 14px",color:"#E85D75",fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                        <td style={{padding:"10px 14px",color:"var(--t3)",textAlign:"center"}}>→</td>
                        <td style={{padding:"10px 14px",color:"#06D6A0",fontWeight:500}}>{f._suggestedLo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8}}>
                <button className="hov" onClick={()=>{
                  const updates = orphanFiles.filter(f=>f._suggestedLo).map(f=>({id:f.id, lo:f._suggestedLo}));
                  if(onBulkUpdate) onBulkUpdate(updates);
                  setShowAutoFixPreview(false);
                }}
                  style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ APPLY {autoFixableCount} FIXES
                </button>
                <button className="hov" onClick={()=>setShowAutoFixPreview(false)}
                  style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>}

      {/* MONTHLY TAB */}
      {prodTab==="monthly"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>BEST MONTH (12MO)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"#06D6A0"}}>{bestMonth.units > 0 ? monthLabel(bestMonth.month) : "—"}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{bestMonth.units} units · ${(bestMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #E85D7544",borderTop:"3px solid #E85D75",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>SLOWEST MONTH</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"#E85D75"}}>{worstMonth.units > 0 ? monthLabel(worstMonth.month) : "—"}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{worstMonth.units} units · ${(worstMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #4A90D944",borderTop:"3px solid #4A90D9",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>12-MO TOTAL UNITS</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"#4A90D9"}}>{last12Months.reduce((s,m)=>s+m.units,0)}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>loans funded</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #F5A62344",borderTop:"3px solid #F5A623",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>12-MO TOTAL VOLUME</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"#F5A623"}}>${(last12Months.reduce((s,m)=>s+m.volume,0)/1e6).toFixed(2)}M</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>funded</div>
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>UNITS CLOSED · LAST 12 MONTHS</div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>peak: {maxUnits} unit{maxUnits===1?"":"s"}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.units>0 ? Math.max(8, (m.units/maxUnits)*100) : 0;
              const isBest = m.units===maxUnits && m.units>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:"var(--fs-2)",fontFamily:"DM Mono",color:isBest?"#06D6A0":"var(--t2)",fontWeight:isBest?500:400,minHeight:12}}>
                    {m.units>0 ? m.units : ""}
                  </div>
                  <div style={{
                    width:"100%",
                    height:`${heightPct}%`,
                    background: isBest ? "linear-gradient(180deg,#06D6A0,#03A77B)" : isCurrent ? "linear-gradient(180deg,#4A90D9,#2D6BAF)" : "#30363D",
                    borderRadius:"3px 3px 0 0",
                    transition:"all .2s",
                    minHeight: m.units>0 ? 4 : 0,
                  }}/>
                  <div style={{fontSize:"var(--fs-1)",color:isCurrent?"#4A90D9":"var(--t3)",fontFamily:"DM Mono",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#F5A623",letterSpacing:"1px"}}>FUNDED VOLUME · LAST 12 MONTHS</div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>peak: ${(maxVolume/1000).toFixed(0)}K</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.volume>0 ? Math.max(8, (m.volume/maxVolume)*100) : 0;
              const isBest = m.volume===maxVolume && m.volume>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:"var(--fs-1)",fontFamily:"DM Mono",color:isBest?"#F5A623":"var(--t2)",fontWeight:isBest?500:400,minHeight:12,whiteSpace:"nowrap"}}>
                    {m.volume>0 ? `$${(m.volume/1000).toFixed(0)}K` : ""}
                  </div>
                  <div style={{
                    width:"100%",
                    height:`${heightPct}%`,
                    background: isBest ? "linear-gradient(180deg,#F5A623,#C8851A)" : isCurrent ? "linear-gradient(180deg,#4A90D9,#2D6BAF)" : "#30363D",
                    borderRadius:"3px 3px 0 0",
                    transition:"all .2s",
                    minHeight: m.volume>0 ? 4 : 0,
                  }}/>
                  <div style={{fontSize:"var(--fs-1)",color:isCurrent?"#4A90D9":"var(--t3)",fontFamily:"DM Mono",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px"}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>MONTHLY DETAIL · 12-MONTH ROLLING</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["MONTH","UNITS","VOLUME","AVG LOAN"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last12Months].reverse().map((m,i)=>(
                <tr key={m.month} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)"}}>{monthLabel(m.month)}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.units>0?"#06D6A0":"#30363D",fontWeight:500}}>{m.units}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.volume>0?"#F5A623":"#30363D",fontWeight:500}}>${(m.volume/1000).toFixed(0)}K</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"var(--t2)"}}>{m.units>0?`$${(m.volume/m.units/1000).toFixed(0)}K`:"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {yearlyList.length > 0 && (
          <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#261535",borderBottom:"2px solid #BD65E8",padding:"10px 16px"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#BD65E8",letterSpacing:"1px"}}>ANNUAL SUMMARY</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["YEAR","UNITS","VOLUME","AVG LOAN"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyList.map((y,i)=>(
                  <tr key={y.year} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                    <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#BD65E8"}}>{y.year}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>{y.units}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#F5A623",fontWeight:500}}>${(y.volume/1e6).toFixed(2)}M</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--t2)"}}>${(y.volume/y.units/1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* REFERRAL PARTNERS TAB (existing — sources of business) */}
      {prodTab==="referrals"&&<div>
        {topRefs.length===0?<div style={{padding:32,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>No referral partners tracked yet. Add partner names to your files to see them here.</div>:(
          <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#1a2e25",borderBottom:"2px solid #06D6A0",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#06D6A0",letterSpacing:"1px"}}>REFERRAL PARTNER LEADERBOARD</span>
              <span style={{background:"#06D6A0",color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{topRefs.length}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["#","REFERRAL PARTNER","TOTAL FILES","CLOSED","ACTIVE","FUNDED VOLUME"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRefs.map((ref,i)=>(
                  <tr key={ref.name} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                    <td style={{padding:"10px 14px",color:i===0?"#F5A623":i===1?"var(--t2)":i===2?"#CD7F32":"var(--t3)",fontFamily:"Syne",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"10px 14px",color:"var(--t1)",fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-4)"}}>
                      {ref.name}
                      {ref.merged&&(
                        <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",fontFamily:"DM Mono",fontWeight:400,marginTop:2}}>
                          {TX("unifies")} {ref.variants.map(v=>v.name+" ("+v.count+")").join(" · ")}
                        </div>
                      )}
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"center"}}>
                      <span style={{background:"#21262D",color:"var(--t1)",borderRadius:12,padding:"2px 10px",fontSize:"var(--fs-4)",fontWeight:500}}>{ref.total}</span>
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>{ref.closed}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#F5A623",fontWeight:500}}>{ref.active}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>${(ref.vol/1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* BANK REFERRALS TAB — bank-to-bank tracking */}
      {prodTab==="bankrefs"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Headline metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"#161B22",border:"1px solid #A78BFA44",borderTop:"3px solid #A78BFA",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>REFERRED OUT (TOTAL)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#A78BFA"}}>{(referredOut||[]).length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(outboundTotalVol/1000).toFixed(0)}K orig. volume</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>OUTBOUND FUNDED</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#06D6A0"}}>{outboundFunded.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(outboundFundedVol/1000).toFixed(0)}K closed at banker</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #F5A62344",borderTop:"3px solid #F5A623",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>FEES EARNED (50 BPS)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>on referred-out funded</div>
          </div>
          {isAdmin && (
            <div style={{background:"#161B22",border:"1px solid #E85D7544",borderTop:"3px solid #E85D75",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>LOST COMP (GROSS)</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>vs. {BPS_RATE} bps de comp propia</div>
            </div>
          )}
        </div>

        {/* Inbound metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"#161B22",border:"1px solid #FFD16644",borderTop:"3px solid #FFD166",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>INBOUND (TOTAL)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#FFD166"}}>{inboundList.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>from external bankers</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>INBOUND CLOSED</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#06D6A0"}}>{inboundClosed.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(inboundFundedVol/1000).toFixed(0)}K funded</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #4A90D944",borderTop:"3px solid #4A90D9",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>INBOUND ACTIVE</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#4A90D9"}}>{inboundActive.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(inboundActiveVol/1000).toFixed(0)}K in pipeline</div>
          </div>
          {isAdmin && (
            <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>COMP FROM INBOUND</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{BPS_RATE} bps on closed</div>
            </div>
          )}
        </div>

        {/* Reciprocity table */}
        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1f1830",borderBottom:"2px solid #A78BFA",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#A78BFA",letterSpacing:"1px"}}>🏦 BANKER RECIPROCITY</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>who's sending what · spot imbalances</span>
          </div>
          {bankerReciprocity.length === 0 ? (
            <div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>
              No banker referrals tracked yet.<br/>
              <span style={{fontSize:"var(--fs-2)",marginTop:6,display:"block"}}>Refer a file out OR add an inbound referral to populate this table.</span>
            </div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["BANKER","COMPANY","SENT TO THEM","THEY SENT US","VOLUME OUT","VOLUME IN","BALANCE"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bankerReciprocity.map((b,i)=>{
                  const netCount = b.receivedIn - b.sentOut;
                  const netLabel = netCount > 0 ? `+${netCount} (favoring you)` : netCount < 0 ? `${netCount} (favoring them)` : "even";
                  const netColor = netCount > 0 ? "#06D6A0" : netCount < 0 ? "#E85D75" : "var(--t2)";
                  return (
                    <tr key={b.name} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                      <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)"}}>{b.name}</td>
                      <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{b.company || "—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#A78BFA",fontWeight:500}}>{b.sentOut}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#FFD166",fontWeight:500}}>{b.receivedIn}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#A78BFA",fontSize:"var(--fs-3)"}}>${(b.sentOutVol/1000).toFixed(0)}K</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#FFD166",fontSize:"var(--fs-3)"}}>${(b.receivedInVol/1000).toFixed(0)}K</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:netColor,fontWeight:500,fontSize:"var(--fs-3)"}}>{netLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Year-end summary */}
        {isAdmin && (outboundFunded.length > 0 || inboundClosed.length > 0) && (
          <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#1a1000",borderBottom:"2px solid #F5A623",padding:"10px 16px"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#F5A623",letterSpacing:"1px"}}>💰 YEAR-END COMP IMPACT</span>
            </div>
            <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>OUTBOUND — WHAT YOU WOULD HAVE EARNED IN HOUSE</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-8)",color:"var(--t2)"}}>${outboundWouldHaveEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{BPS_RATE} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>WHAT YOU EARNED IN REFERRAL FEES</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-8)",color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{REFERRAL_FEE_BPS} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>NET LOST COMP (OUTBOUND)</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-8)",color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>opportunity cost</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>INBOUND COMP EARNED</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-8)",color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{BPS_RATE} bps × ${(inboundFundedVol/1000).toFixed(0)}K</div>
              </div>
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid #21262D",background:"#0D1117",fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>
              <strong style={{color:"#F5A623"}}>Read it:</strong> Outbound is what the branch could not place and you sent away — you got <strong style={{color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</strong> in referral fees but missed <strong style={{color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</strong> in your own comp. Inbound is what bankers send your way — you earned <strong style={{color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</strong> from those. Use this to decide which lenders or channels are worth adding.
            </div>
          </div>
        )}

      </div>}



      {/* MEZCLA · producción por producto y por programa */}
      {prodTab==="mix"&&(()=>{
        const groupOf=t=>{
          const g=LOAN_TYPE_GROUPS.find(x=>x.types.includes(t));
          return g?g.group:"Standard";
        };
        const byProd=productionByProduct(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE});
        const byGrp=mixVsPlan(productionByGroup(files,groupOf,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE}),mixPlan);
        const byLo=productionByLo(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE,
          roster:LO_LIST.map(x=>x.name)});
        const totF=byProd.reduce((a,r)=>a+r.funded,0);
        const totV=byProd.reduce((a,r)=>a+r.fundedVolume,0);
        const totC=byProd.reduce((a,r)=>a+r.comp,0);
        const th=(t,c)=>(<th style={{padding:"9px 12px",textAlign:c||"center",fontSize:"var(--fs-2)",
          color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{t}</th>);
        const money=n=>"$"+Math.round(n).toLocaleString();
        if(totF===0&&byProd.every(r=>!r.active)) return (
          <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,
            padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>{TX("mixNoData")}</div>
        );
        return (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:8,padding:"12px 16px",
              fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>{TX("mixLead")}</div>

            {totF<20&&(
              <div style={{background:"rgba(245,166,35,.08)",border:"1px solid #F5A62344",borderRadius:8,
                padding:"10px 14px",fontSize:"var(--fs-3)",color:"#F5A623",lineHeight:1.55}}>
                {TX("thinMix",{n:totF})}
              </div>
            )}

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#0D1117",padding:"9px 14px",fontSize:"var(--fs-2)",color:"#F5A623",
                letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("byBaseProduct")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid #21262D"}}>
                  {th(TX("byBaseProduct"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hAvg"))}{th(TX("hComp"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byProd.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid #21262D",background:i%2?"#161B22":"#0D1117"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{P(baseProductLabel(r.key))}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,
                        fontSize:"var(--fs-5)",color:"#F5A623"}}>{r.unitShare?r.unitShare+"%":"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.comp?money(r.comp):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#4A90D9",fontFamily:"DM Mono"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:"#1a1000",borderTop:"2px solid #F5A623"}}>
                  <td style={{padding:"10px 12px",fontFamily:"Syne",fontWeight:700,color:"#F5A623"}}>{TX("mixTotal",{n:totF})}</td>
                  <td/>
                  <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{money(totV)}</td>
                  <td/><td/>
                  <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,color:"#F5A623"}}>{money(totC)}</td>
                  <td/>
                </tr></tfoot>
              </table>
            </div>

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#0D1117",padding:"9px 14px",fontSize:"var(--fs-2)",color:"#7EC8A4",
                letterSpacing:"1px",borderBottom:"1px solid #30363D",display:"flex",
                justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <span>{TX("byGroup")}</span>
                <span className="act">{TX("planEdit")}</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid #21262D"}}>
                  {th(TX("byGroup"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hPlan"))}{th(TX("hDelta"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byGrp.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid #21262D",background:i%2?"#161B22":"#0D1117"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{r.key}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,
                        fontSize:"var(--fs-5)",color:"#F5A623"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <input value={mixPlan[r.key]??""} inputMode="numeric"
                          onChange={e=>{const v=e.target.value.replace(/[^\d]/g,"");
                            setMixPlan({...mixPlan,[r.key]:v===""?undefined:Number(v)});}}
                          style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:4,
                            color:"var(--t2)",padding:"3px 6px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",
                            width:46,textAlign:"center"}}/>
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"DM Mono",
                        color:r.delta===null?"var(--t3)":Math.abs(r.delta)<=5?"#7EC8A4":r.delta>0?"#4A90D9":"#F5A623"}}>
                        {r.delta===null?"—":(r.delta>0?"+":"")+r.delta}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#4A90D9",fontFamily:"DM Mono"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#0D1117",padding:"9px 14px",fontSize:"var(--fs-2)",color:"#7EC8A4",
                letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("byDpaMix")}</div>
              {(()=>{const rows=productionByDpa(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE});
                if(!rows.length) return (
                  <div style={{padding:"18px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{TX("noDpaYet")}</div>
                );
                return (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                    <thead><tr style={{borderBottom:"1px solid #21262D"}}>
                      {th(TX("byBaseProduct"),"left")}{th(TX("hPct"))}{th(TX("hForm"))}
                      {th(TX("hClosed"))}{th(TX("hVolume"))}{th(TX("hShare"))}
                      {th(TX("hDays"))}{th(TX("hActive"))}
                    </tr></thead>
                    <tbody>
                      {rows.map((r,i)=>(
                        <tr key={r.key} style={{borderBottom:"1px solid #21262D",background:i%2?"#161B22":"#0D1117"}}>
                          <td style={{padding:"10px 12px",color:"var(--t1)"}}>{P(baseProductLabel(r.base))}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:r.dpa?"#F5A623":"#30363D",fontFamily:"DM Mono"}}>{r.pct?r.pct+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:r.dpa?"#7EC8A4":"#30363D",fontSize:"var(--fs-3)"}}>{r.dpa?(P(dpaForm(r.form))||"—"):TX("noDpaRow")}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",color:"#F5A623"}}>{r.unitShare?r.unitShare+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>{r.avgDays??"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"#4A90D9",fontFamily:"DM Mono"}}>{r.active||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );})()}
            </div>

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#0D1117",padding:"9px 14px",fontSize:"var(--fs-2)",color:"#4A90D9",
                letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("byState")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid #21262D"}}>
                  {th(TX("byState"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hAvg"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {productionByState(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE}).map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid #21262D",background:i%2?"#161B22":"#0D1117"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{r.key}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",color:"#F5A623"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#4A90D9",fontFamily:"DM Mono"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#0D1117",padding:"9px 14px",fontSize:"var(--fs-2)",color:"#BD65E8",
                letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("byOriginator")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid #21262D"}}>
                  {th("LO","left")}{th(TX("hClosed"))}{th(TX("hVolume"))}{th(TX("hShare"))}
                  {th(TX("hAvg"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byLo.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid #21262D",background:i%2?"#161B22":"#0D1117"}}>
                      <td style={{padding:"10px 12px",color:r.funded||r.active?"var(--t1)":"var(--t2)"}}>
                        {r.key}
                        {!r.funded&&!r.active&&<span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>{"  "}{TX("noProduction")}</span>}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,
                        fontSize:"var(--fs-5)",color:r.unitShare?"#F5A623":"var(--t3)"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"#4A90D9",fontFamily:"DM Mono"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* SCORECARD DE LENDERS */}
      {prodTab==="scorecard"&&(()=>{
        const sc=lenderConcentration(lenderScorecard(files,{cutover:BARRETT_CUTOVER}));
        const vista=isAssistant?"spec":scView;
        const TONE={good:"#7EC8A4",warn:"#F5A623",bad:"#E85D75",neutral:"var(--t2)"};
        return (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:8,padding:"12px 16px",
              fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>
              {vista==="lender"?TX("scorecardLead"):vista==="product"?TX("productStrength"):TX("specLead")}
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:6}}>{TX("autoDerived")}</div>
            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {(isAssistant?["spec"]:["lender","product","spec"]).map(v=>(
                <button key={v} className="hov" onClick={()=>setScView(v)}
                  style={{background:scView===v?"#F5A623":"#21262D",color:scView===v?"#0D1117":"var(--t2)",
                    border:"none",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",
                    fontWeight:500,cursor:"pointer"}}>
                  {v==="lender"?TX("byLender"):v==="product"?TX("byProduct"):TX("bySpecialty")}
                </button>
              ))}
              {vista==="spec"&&specialtyCatalog().map(c=>(
                <button key={c.category} className="hov" onClick={()=>{setScCat(c.category);setScSpec(null);}}
                  style={{background:scCat===c.category?"#4A90D9":"#21262D",color:scCat===c.category?"#0D1117":"var(--t2)",
                    border:"none",borderRadius:6,padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",cursor:"pointer"}}>
                  {P(c.label)} · {c.lenders}
                </button>
              ))}
              {vista==="product"&&productsWorked(files,{cutover:BARRETT_CUTOVER}).map(pw=>(
                <button key={pw.product} className="hov" onClick={()=>setScProduct(pw.product)}
                  style={{background:(scProduct||productsWorked(files,{cutover:BARRETT_CUTOVER})[0]?.product)===pw.product?"#4A90D9":"#21262D",
                    color:(scProduct||productsWorked(files,{cutover:BARRETT_CUTOVER})[0]?.product)===pw.product?"#0D1117":"var(--t2)",
                    border:"none",borderRadius:6,padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",cursor:"pointer"}}>
                  {P(categoryLabel(pw.product))} · {pw.files}
                </button>
              ))}
            </div>

            {vista==="lender"&&(sc.length===0?(
              <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,
                padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>
                {TX("scNoData")}
              </div>
            ):(
              <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                  <thead>
                    <tr style={{background:"#0D1117",borderBottom:"1px solid #30363D"}}>
                      {[TX("scHeadLender"),TX("scHeadTouched"),TX("scHeadFunded"),TX("scHeadPull"),
                        TX("scHeadShare"),TX("scHeadExits"),TX("scHeadFault"),TX("scHeadDays"),TX("scHeadBps"),TX("scHeadVerdict")]
                        .map((h,i)=>(
                        <th key={i} style={{padding:"9px 12px",textAlign:i===0||i===9?"left":"center",
                          fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sc.map((r,i)=>{
                      const v=lenderVerdict(r); const c=TONE[v.tone];
                      return (
                        <tr key={r.id} style={{borderBottom:"1px solid #21262D",
                          background:i%2===0?"#0D1117":"#161B22"}}>
                          <td style={{padding:"10px 12px",color:"var(--t1)"}}>
                            {r.name}
                            {r.compLost>0&&(
                              <div style={{fontSize:"var(--fs-1)",color:"#E85D75"}}>
                                −${r.compLost.toLocaleString()} {TX("scCompLost")}
                              </div>
                            )}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.touched}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>{r.funded}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,
                            fontSize:"var(--fs-6)",color:r.pullThrough>=80?"#7EC8A4":r.pullThrough>=50?"#F5A623":"#E85D75"}}>
                            {r.pullThrough!==null?r.pullThrough+"%":"—"}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"DM Mono",
                            color:r.sharePct>=40?"#F5A623":"var(--t2)"}}>{r.sharePct?r.sharePct+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.exits||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"DM Mono",
                            color:r.exitsLender>0?"#E85D75":"var(--t3)"}}>
                            {r.exitsLender||"—"}{r.exitsLender>0&&r.faultRate!==null?` · ${r.faultRate}%`:""}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.avgDaysToClose??"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono"}}>{r.avgBps??"—"}</td>
                          <td style={{padding:"10px 12px",color:c,fontSize:"var(--fs-3)"}}>{P(v)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {vista==="product"&&(()=>{
              const worked=productsWorked(files,{cutover:BARRETT_CUTOVER});
              const prod=scProduct||worked[0]?.product;
              if(!prod) return (
                <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,
                  padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>{TX("noProductData")}</div>
              );
              const list=productScorecard(files,prod,{cutover:BARRETT_CUTOVER});
              const tried=list.filter(x=>x.tried), untried=list.filter(x=>!x.tried).slice(0,12);
              const prodRow=(r,proven)=>(
                <div key={r.lenderId} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,
                  padding:"9px 14px",borderBottom:"1px solid #21262D",fontSize:"var(--fs-3)"}}>
                  <span style={{color:proven?"var(--t1)":"var(--t2)",flex:1}}>{r.lenderName}</span>
                  {proven?(
                    <>
                      <span style={{color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>
                        {TX("closedOf",{a:r.funded,b:r.touched})}
                      </span>
                      <span style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",minWidth:48,textAlign:"right",
                        color:r.pullThrough>=80?"#7EC8A4":r.pullThrough>=50?"#F5A623":"#E85D75"}}>
                        {r.pullThrough}%
                      </span>
                      <span style={{color:r.exitsLender>0?"#E85D75":"var(--t3)",fontFamily:"DM Mono",
                        fontSize:"var(--fs-2)",minWidth:90,textAlign:"right"}}>
                        {r.exitsLender>0?TX("ownCall",{n:r.exitsLender}):""}
                      </span>
                    </>
                  ):null}
                  <span style={{color:"var(--t3)",fontFamily:"DM Mono",fontSize:"var(--fs-3)",minWidth:56,textAlign:"right"}}>
                    {r.avgBps?r.avgBps+" bps":"—"}
                  </span>
                </div>
              );
              return (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#F5A623"}}>
                    {TX("productQ",{p:P(categoryLabel(prod))})}
                  </div>
                  <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"#0D1117",padding:"8px 14px",fontSize:"var(--fs-2)",color:"#7EC8A4",
                      letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("proven")}</div>
                    {tried.length===0
                      ? <div style={{padding:"16px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>—</div>
                      : tried.map(r=>prodRow(r,true))}
                  </div>
                  <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"#0D1117",padding:"8px 14px",fontSize:"var(--fs-2)",color:"var(--t3)",
                      letterSpacing:"1px",borderBottom:"1px solid #21262D"}}>{TX("untried")}</div>
                    {untried.map(r=>prodRow(r,false))}
                    <div style={{padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--t3)",lineHeight:1.55}}>
                      {TX("offersNotProof")}
                    </div>
                  </div>
                </div>
              );
            })()}


            {vista==="spec"&&(()=>{
              const cat=specialtyCatalog().find(c=>c.category===scCat)||specialtyCatalog()[0];
              const spec=scSpec||cat.specialties[0]?.id;
              const list=lendersBySpecialty(files,cat.category,spec,{cutover:BARRETT_CUTOVER});
              const thin=list.length<=12;
              const isDpa=cat.category==="dpa";
              const cov=specDetailCoverage(dpaDetails,cat.category);
              const tried=list.filter(x=>x.tried), rest=list.filter(x=>!x.tried);
              // NO convertir esto en componente. Definido dentro del render, un
              // componente cambia de identidad en cada tecla y React desmonta el
              // input — el cursor se pierde y hay que hacer clic por cada letra.
              // Como función simple no crea frontera de componente.
              const field=(k,label,{type,opts,w}={})=>{
                const d=dpaDraft||{};
                const set=v=>setDpaDraft({...d,[k]:v});
                return (
                  <div key={k} style={{minWidth:w||96}}>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{label}</div>
                    {opts?(
                      <select value={d[k]??""} onChange={e=>set(e.target.value||null)}
                        style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
                          padding:"5px 7px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:"100%"}}>
                        <option value="">—</option>
                        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ):(
                      <input value={d[k]??""} inputMode={type==="num"?"decimal":undefined}
                        onChange={e=>set(e.target.value)}
                        style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
                          padding:"5px 7px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:"100%"}}/>
                    )}
                  </div>
                );
              };
              const row=(l)=>{
                const key=l.lenderId+"::"+spec;
                const det=specDetail(dpaDetails,l.lenderId,cat.category,spec);
                const sum=det?specDetailSummary(det,CURRENT_LANG,isDpa):null;
                const open=dpaOpen===key;
                return (
                  <div key={key} style={{borderBottom:"1px solid #21262D"}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:10,padding:"9px 14px",fontSize:"var(--fs-3)"}}>
                      <span style={{flex:1,color:l.tried?"var(--t1)":"var(--t2)"}}>
                        {l.name}
                        {l.siblings.length>0&&(
                          <span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>
                            {"  "}{TX("alsoDoes")} {l.siblings.slice(0,3).map(x=>P(specialtyLabel(x))).join(", ")}
                          </span>
                        )}
                        {sum&&<div style={{fontSize:"var(--fs-2)",color:"#7EC8A4",marginTop:2}}>
                          {sum}
                          {det?.updatedBy&&<span style={{color:"var(--t3)"}}>
                            {"  "}{TX("capturedBy",{who:String(det.updatedBy).split(" ")[0],d:det.updatedAt})}
                          </span>}
                        </div>}
                      </span>
                      {l.tried&&!isAssistant&&(
                        <>
                          <span style={{color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>
                            {TX("closedOf",{a:l.funded,b:l.touched})}
                          </span>
                          <span style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",minWidth:44,textAlign:"right",
                            color:l.pullThrough>=80?"#7EC8A4":l.pullThrough>=50?"#F5A623":"#E85D75"}}>
                            {l.pullThrough}%
                          </span>
                        </>
                      )}
                      <span style={{color:"var(--t3)",fontFamily:"DM Mono",fontSize:"var(--fs-3)",minWidth:54,textAlign:"right"}}>
                        {l.bps?l.bps+" bps":"—"}
                      </span>
                      {(
                        <button className="hov" onClick={()=>{
                            setDpaOpen(open?null:key);
                            setDpaDraft(open?null:{...emptySpecDetail(),...(det||{}),
                              states:(det?.states||[]).join(","),newNote:""});
                          }}
                          style={{background:sum?"#21262D":"rgba(126,200,164,.12)",
                            border:`1px solid ${sum?"#7EC8A4":"#7EC8A488"}`,
                            borderRadius:5,color:"#7EC8A4",fontSize:"var(--fs-2)",padding:"4px 10px",
                            cursor:"pointer",fontFamily:"DM Mono",whiteSpace:"nowrap"}}>
                          {open?"✕":(sum?TX("dpaEdit"):TX("dpaEmpty"))}
                        </button>
                      )}
                    </div>
                    {open&&(
                      <div style={{padding:"11px 14px 14px",background:"#0D1117",borderTop:"1px solid #21262D"}}>
                        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:8}}>
                          {TX("specDetailTitle")}
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:9}}>
                          {isDpa&&field("pct",TX("dpaPct"),{type:"num",w:86})}
                          {isDpa&&field("pctOf",TX("dpaPctOf"),{w:150,opts:[
                            {v:"purchase",l:TX("purchase")},{v:"loan",l:TX("loanAmt")},{v:"down_payment",l:TX("downPay")}]})}
                          {isDpa&&field("structure",TX("dpaStructure"),{w:180,opts:
                            Object.keys(DPA_STRUCTURES).map(k=>({v:k,l:P(DPA_STRUCTURES[k])}))})}
                          {isDpa&&field("forgivenessMonths",TX("dpaForgive"),{type:"num",w:110})}
                          {isDpa&&field("fixesRate",TX("dpaFixesRate"),{w:90,opts:[
                            {v:"true",l:TX("yesShort")},{v:"false",l:TX("noShort")}]})}
                          {field("minFico",TX("dpaMinFico"),{type:"num",w:80})}
                          {field("maxLtv",TX("maxLtv"),{type:"num",w:80})}
                          {field("maxDti",TX("dpaMaxDti"),{type:"num",w:80})}
                          {field("reservesMonths",TX("reserves"),{type:"num",w:110})}
                          {field("states",TX("dpaStates"),{w:120})}
                        </div>
                        {Array.isArray(det?.notes)&&det.notes.length>0&&(
                          <div style={{marginBottom:9}}>
                            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
                              {TX("observations")}
                            </div>
                            {det.notes.slice().reverse().map((n,ni)=>(
                              <div key={ni} style={{borderLeft:"2px solid #21262D",paddingLeft:9,marginBottom:6}}>
                                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
                                  {n.at}{n.by?" · "+String(n.by).split(" ")[0]:""}
                                </div>
                                <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.5}}>{n.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <input value={dpaDraft?.newNote??""}
                          onChange={e=>setDpaDraft({...dpaDraft,newNote:e.target.value})}
                          placeholder={TX("addObservation")}
                          style={{background:"#161B22",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
                            padding:"6px 9px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:"100%",marginBottom:9}}/>
                        <button className="hov" onClick={()=>{
                            const d={...dpaDraft};
                            d.fixesRate = d.fixesRate==="true"?true:d.fixesRate==="false"?false:null;
                            d.states = String(d.states||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
                            onSaveDpa&&onSaveDpa(setSpecDetail(dpaDetails,l.lenderId,cat.category,spec,d,profile.name));
                            setDpaOpen(null); setDpaDraft(null);
                          }}
                          style={{background:"#7EC8A4",color:"#0D1117",border:"none",borderRadius:6,
                            padding:"7px 16px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500,cursor:"pointer"}}>
                          {TX("dpaSave")}
                        </button>
                        <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:7,lineHeight:1.5}}>{TX("specDetailHint")}</div>
                      </div>
                    )}
                  </div>
                );
              };
              return (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {cat.specialties.map(sp=>(
                      <button key={sp.id} className="hov" onClick={()=>setScSpec(sp.id)}
                        style={{background:spec===sp.id?"#7EC8A4":"transparent",
                          border:`1px solid ${spec===sp.id?"#7EC8A4":sp.lenders<=12?"#F5A62366":"#30363D"}`,
                          color:spec===sp.id?"#0D1117":sp.lenders<=12?"#F5A623":"var(--t2)",
                          borderRadius:5,padding:"4px 9px",fontSize:"var(--fs-2)",fontFamily:"DM Mono",cursor:"pointer"}}>
                        {P(specialtyLabel(sp.id))} <span style={{opacity:.6}}>{sp.lenders}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#7EC8A4"}}>
                      {TX("specQ",{p:P(specialtyLabel(spec))})}
                    </span>
                    <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{list.length} lenders</span>
                    {cov&&<span style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginLeft:"auto"}}>
                      {TX("specCoverage",{f:cov.filled,t:cov.total})}</span>}
                  </div>
                  {(
                    <div style={{background:"rgba(126,200,164,.08)",border:"1px solid #7EC8A455",
                      borderRadius:8,padding:"10px 14px",fontSize:"var(--fs-3)",color:"#7EC8A4",lineHeight:1.55}}>
                      <span className="act">{isDpa?TX("dpaFillHere"):TX("specFillHere")}</span>
                    </div>
                  )}
                  {thin&&(
                    <div style={{background:"rgba(245,166,35,.08)",border:"1px solid #F5A62344",borderRadius:8,
                      padding:"10px 14px",fontSize:"var(--fs-3)",color:"#F5A623",lineHeight:1.55}}>{TX("specThin")}</div>
                  )}
                  <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
                    {tried.length>0&&<div style={{background:"#0D1117",padding:"8px 14px",fontSize:"var(--fs-2)",
                      color:"#7EC8A4",letterSpacing:"1px",borderBottom:"1px solid #30363D"}}>{TX("proven")}</div>}
                    {tried.map(l=>row(l))}
                    {rest.length>0&&<div style={{background:"#0D1117",padding:"8px 14px",fontSize:"var(--fs-2)",
                      color:"var(--t3)",letterSpacing:"1px",borderTop:tried.length?"1px solid #30363D":"none",
                      borderBottom:"1px solid #21262D"}}>{TX("untried")}</div>}
                    {rest.slice(0,30).map(l=>row(l))}
                    {rest.length>30&&<div style={{padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                      +{rest.length-30}</div>}
                  </div>
                </div>
              );
            })()}

            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:8,padding:"11px 16px",
              fontSize:"var(--fs-2)",color:"var(--t3)",lineHeight:1.6}}>
              {TX("scFaultNote")}
            </div>
          </div>
        );
      })()}

      {/* OVERRIDE & PAYROLL — modelo Barrett por % del NET */}
      {prodTab==="override"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",
          background:"#161B22",border:"1px solid #30363D",borderRadius:8,padding:"10px 14px"}}>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("year")}</span>
          <select value={compYear} onChange={e=>setCompYear(Number(e.target.value))}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
              padding:"5px 8px",fontSize:"var(--fs-3)",fontFamily:"DM Mono"}}>
            {[1,2,3].map(y=><option key={y} value={y}>Año {y} · Paulo {(teamLeadShare(y)*100).toFixed(0)}%</option>)}
          </select>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginLeft:8}}>{TX("filesPerMo")}</span>
          <input type="number" value={filesMo} onChange={e=>setFilesMo(Math.max(1,Number(e.target.value)||1))}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
              padding:"5px 8px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:58}}/>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>
            {TX("costPerFile")} ${Math.round(branchCostPerFile(filesMo)).toLocaleString()} · {TX("seniorCap")} {(ladderCeiling(filesMo,9174,compYear)*100).toFixed(1)}% · {TX("since")} {BARRETT_CUTOVER}
          </span>
        </div>

        {justClaimed&&(
          <div style={{background:"rgba(74,144,217,.1)",border:"1px solid #4A90D9",borderRadius:8,
            padding:"9px 14px",fontSize:"var(--fs-3)",color:"#4A90D9"}}>
            Reclamado para el corte {payrollPeriodLabel(currentPayrollPeriod(),CURRENT_LANG)} — {justClaimed}
          </div>
        )}

        {losWithoutCompRule(files,COMP_ROSTER).length>0&&(
          <div style={{background:"rgba(232,93,117,.08)",border:"1px solid #E85D7555",borderRadius:8,
            padding:"10px 14px",fontSize:"var(--fs-3)",color:"#E85D75",lineHeight:1.5}}>
            Sin regla de compensación: {losWithoutCompRule(files,COMP_ROSTER).join(", ")}.
            Sus archivos se reparten por volumen derivado, que puede no ser su acuerdo real.
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          {[
            {label:TX("currentCut"),value:payrollPeriodLabel(currentPayrollPeriod(),CURRENT_LANG),color:"#4A90D9",sub:TX("barrettCloses"),small:true},
            {label:TX("unclaimed"),value:`${payroll.count}`,color:"#F5A623",sub:TX("fundedFiles")},
            {label:TX("yourShare"),value:`$${payroll.toBM.toLocaleString()}`,color:"#F5A623",sub:TX("yourSplitPlusBranch")},
            {label:TX("blocked"),value:String(payroll.blockedCount),color:payroll.blockedCount?"#E85D75":"var(--t3)",
              sub:`$${payroll.blockedDollars.toLocaleString()}`},
            {label:TX("fromOldCuts"),value:`$${payroll.staleDollars.toLocaleString()}`,color:payroll.staleCount?"#E85D75":"var(--t3)",sub:TX("carriedN",{n:payroll.staleCount})},
          ].map(s=>(
            <div key={s.label} style={{background:"#1a1000",border:`1px solid ${s.color}44`,borderTop:`3px solid ${s.color}`,borderRadius:8,padding:"12px"}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{s.label}</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:s.small?"var(--fs-5)":"var(--fs-9)",color:s.color}}>{s.value}</div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{background:"#161B22",border:"1px solid #F5A62333",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a1000",borderBottom:"2px solid #F5A623",padding:"10px 16px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#F5A623",letterSpacing:"1px"}}>{TX("nextRequest")}</span>
            <span style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{TX("claimOptional")}</span>
              <button className="hov" disabled={picked.size===0} onClick={()=>setShowRequest(true)}
                style={{background:picked.size?"#F5A623":"#21262D",color:picked.size?"#0D1117":"var(--t3)",
                  border:"none",borderRadius:6,padding:"7px 14px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",
                  fontWeight:500,cursor:picked.size?"pointer":"not-allowed"}}>
                {TX("generateRequest")} · {picked.size}
              </button>
            </span>
          </div>
          {payroll.rows.length===0?(
            <div style={{padding:"22px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>
              No hay archivos fondeados sin reclamar.
            </div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  <th style={{padding:"8px 6px 8px 12px",width:24}}>
                    <input type="checkbox"
                      checked={payroll.rows.filter(r=>r.ready).length>0&&picked.size===payroll.rows.filter(r=>r.ready).length}
                      onChange={e=>setPicked(e.target.checked?new Set(payroll.rows.filter(r=>r.ready).map(r=>r.file.id)):new Set())}
                      style={{accentColor:"#F5A623",cursor:"pointer"}}/>
                  </th>
                  {[TX("client"),TX("fundedOn"),TX("cut"),"LO",TX("split"),"NET",TX("yourShare"),""].map((h,i)=>(
                    <th key={i} style={{padding:"8px 12px",textAlign:i<4?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r,i)=>(
                  <tr key={r.file.id||i} style={{borderBottom:"1px solid #21262D",background:r.stale?"rgba(232,93,117,.06)":(i%2===0?"#0D1117":"#161B22")}}>
                    <td style={{padding:"9px 6px 9px 12px"}}>
                      <input type="checkbox" checked={picked.has(r.file.id)} disabled={!r.ready}
                        onChange={()=>{const n=new Set(picked); n.has(r.file.id)?n.delete(r.file.id):n.add(r.file.id); setPicked(n);}}
                        style={{accentColor:"#F5A623",cursor:r.ready?"pointer":"not-allowed",opacity:r.ready?1:.3}}/>
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t1)"}}>
                      {r.file.borrower}
                      {!r.ready&&(
                        <div style={{fontSize:"var(--fs-1)",color:"#E85D75",marginTop:2}}>
                          {TX("blocked")} · {TX("blockedWhy")} {r.blockers.map(x=>P(x)).join(" · ")}
                        </div>
                      )}
                      {r.kind==="referral"&&(
                        <div style={{fontSize:"var(--fs-1)",color:"#A78BFA"}}>
                          {TX("referralFeeOf",{b:r.referral.bps})}{r.referral.banker?` · ${r.referral.banker}`:""}
                          {r.branchPct>0? + " · " + TX("branchPctOf",{n:(r.branchPct*100).toFixed(0)}):" · "+TX("ofTheLo")}
                        </div>
                      )}
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>
                      {r.kind==="referral"?r.referral.date:fundedDate(r.file)}
                    </td>
                    <td style={{padding:"9px 12px",fontSize:"var(--fs-2)",color:r.stale?"#E85D75":"var(--t2)"}}>
                      {payrollPeriodLabel(r.period)}{r.stale?" · "+TX("carried"):""}
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>
                      {r.file.lo||"—"}
                      <span style={{color:r.rosterMissing?"#E85D75":"var(--t3)"}}>
                        {" · "}{r.kind==="referral"?TX("referredShort"):r.rosterMissing?TX("noCompRule"):P(r.split.stageMeta)}
                      </span>
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"DM Mono",fontSize:"var(--fs-3)"}}>
                      {r.kind==="referral"?"—":`${(r.split.shares.lo*100).toFixed(1)}%${r.split.floorApplied?" ⚑":""}`}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>${r.split.net.toLocaleString()}</td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <span style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-6)",color:"#F5A623"}}>${r.split.toBM.toLocaleString()}</span>
                      {r.split.isBM&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("yourLoSplit")}</div>}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <button className="hov" onClick={()=>{
                          onBulkUpdate&&onBulkUpdate([{id:r.file.id,claimState:"claimed",claimedPeriod:currentPayrollPeriod(),claimedAt:today(),claimedBy:profile.name}]);
                          setJustClaimed(`${r.file.borrower} · $${r.split.toBM.toLocaleString()}`);
                          setTimeout(()=>setJustClaimed(null),3500);
                        }}
                        style={{background:"#21262D",border:"1px solid #4A90D9",borderRadius:4,color:"#4A90D9",
                          fontSize:"var(--fs-2)",padding:"4px 9px",cursor:"pointer",fontFamily:"DM Mono"}}>{TX("claim")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#1a1000",borderTop:"2px solid #F5A623"}}>
                  <td colSpan={6} style={{padding:"10px 12px",fontFamily:"Syne",fontWeight:700,color:"#F5A623"}}>{TX("totalFiles",{n:payroll.count})}</td>
                  <td style={{padding:"10px 12px",textAlign:"center",color:"#06D6A0",fontFamily:"DM Mono"}}>${payroll.net.toLocaleString()}</td>
                  <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"#F5A623"}}>${payroll.toBM.toLocaleString()}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          )}
        </div>


        {showRequest&&(()=>{
          const rows=payroll.rows.filter(r=>picked.has(r.file.id));
          const req=buildPayrollRequest(rows,{by:profile.name,
            branch:{name:TX("branchLending"),teamLead:"Paulo Maria",trainer:"Ana M Plasencia"}});
          const text=payrollRequestText(req);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:130,display:"flex",
              alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowRequest(false)}>
              <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"#161B22",
                border:"1px solid #F5A62355",borderRadius:12,width:"100%",maxWidth:700,
                maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column"}}>
                <div style={{padding:"16px 22px 12px",borderBottom:"1px solid #21262D"}}>
                  <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"#F5A623"}}>{TX("payrollRequest")}</div>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:3}}>
                    {req.periodLabel} · {TX("filesTotal",{n:req.fileCount,d:req.total.toLocaleString()})}
                  </div>
                </div>
                <div style={{flex:1,overflow:"auto",padding:"14px 22px"}}>
                  <pre style={{margin:0,fontFamily:"'IBM Plex Mono','DM Mono',monospace",fontSize:"var(--fs-3)",
                    color:"var(--t1)",whiteSpace:"pre",lineHeight:1.65}}>{text}</pre>
                </div>
                {reqError&&(
                  <div style={{margin:"0 22px",background:"rgba(232,93,117,.1)",border:"1px solid #E85D75",
                    borderRadius:6,padding:"9px 12px",fontSize:"var(--fs-3)",color:"#E85D75"}}>
                    {TX("couldNotClose",{e:reqError})}
                  </div>
                )}
                <div style={{padding:"12px 22px",borderTop:"1px solid #21262D",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="hov" onClick={()=>{
                      try{ navigator.clipboard?.writeText(text); }catch(err){ setReqError(TX("errClipboard")); }
                      setCopied(true); setTimeout(()=>setCopied(false),2200);
                    }}
                    style={{flex:1,background:"#21262D",color:copied?"#7EC8A4":"var(--t2)",borderRadius:7,
                      padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-3)",
                      border:`1px solid ${copied?"#7EC8A4":"#30363D"}`,cursor:"pointer"}}>
                    {copied?TX("copied"):TX("copyText")}
                  </button>
                  <button className="hov" onClick={()=>{
                      // Si algo falla aquí, falla a la vista. Un botón de dinero
                      // que no hace nada y no dice por qué es peor que un error.
                      // Cada paso etiquetado: con el código minificado, "Y is not
                      // a function" no dice nada. El nombre del paso sí.
                      let step=TX("stepPrepare");
                      try{
                        step=TX("stepRows");
                        const fileIds=(rows||[]).map(r=>r&&r.file&&r.file.id).filter(Boolean);

                        step=TX("stepPayees");
                        const payees=(req.payees||[]).map(p=>({name:p.name,role:p.role,subtotal:p.subtotal}));

                        step=TX("stepDate");
                        const sentAt=today();

                        step=TX("stepClose");
                        if(typeof onClosePeriod!=="function") throw new Error(TX("errNoClose"));
                        const sinId=rows.filter(r=>!r.file||!r.file.id).length;
                        if(sinId>0) throw new Error(TX("errNoIds",{n:sinId}));
                        const marcados=onClosePeriod(
                          { id:`pr_${Date.now()}`, period:req.period, periodLabel:req.periodLabel,
                            sentAt, by:profile&&profile.name, fileCount:req.fileCount,
                            netTotal:req.netTotal, total:req.total, text, fileIds, payees },
                          rows.map(r=>({id:r.file.id,claimState:"claimed",
                            claimedPeriod:req.period,claimedAt:sentAt,claimedBy:profile.name}))
                        );
                        if(marcados===0) throw new Error(TX("errNoneFound"));

                        step="cerrar la ventana";
                        setReqError(null);
                        setJustClaimed(TX("filesCutTotal",{n:req.fileCount,d:req.total.toLocaleString(),p:req.periodLabel}));
                        setTimeout(()=>setJustClaimed(null),5000);
                        setPicked(new Set());
                        setShowRequest(false);
                      }catch(err){
                        const where=String((err&&err.stack||"").split(String.fromCharCode(10))[1]||"").trim().slice(0,90);
                        setReqError(`al ${step} — ${String(err&&err.message||err)}${where?" · "+where:""}`);
                      }
                    }}
                    style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",
                      fontFamily:"DM Mono",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                    {TX("alreadySent")}
                  </button>
                  <button className="hov" onClick={()=>setShowRequest(false)}
                    style={{flex:1,background:"transparent",color:"var(--t2)",borderRadius:7,padding:"10px 0",
                      fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"1px solid #30363D",cursor:"pointer"}}>CERRAR</button>
                </div>
                <div style={{padding:"0 22px 14px",fontSize:"var(--fs-1)",color:"var(--t3)"}}>
                  <span className="act">{TX("sendYourself")}</span>
                </div>
              </div>
            </div>
          );
        })()}


        {(payrollLog||[]).length>0&&(
          <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#0D1117",borderBottom:"1px solid #30363D",padding:"10px 16px",
              display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--t2)",letterSpacing:"1px"}}>
                REQUESTS ENVIADOS
              </span>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                {TX("inTotal",{n:payrollLog.length,d:payrollLog.reduce((a,x)=>a+(x.total||0),0).toLocaleString()})}
              </span>
            </div>
            {[...payrollLog].reverse().map(entry=>(
              <div key={entry.id} style={{borderBottom:"1px solid #21262D",padding:"10px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:"var(--fs-3)",color:"var(--t1)"}}>
                    {entry.periodLabel}
                    <span style={{color:"var(--t3)"}}> · {TX("sentBy",{d:entry.sentAt,who:String(entry.by||"").split(" ")[0]})}</span>
                  </span>
                  <span style={{display:"flex",gap:8,alignItems:"baseline"}}>
                    <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{TX("nFiles",{n:entry.fileCount})}</span>
                    <span style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-5)",color:"#F5A623"}}>
                      ${(entry.total||0).toLocaleString()}
                    </span>
                    {onDeletePayrollLog&&(
                      <button className="hov" onClick={()=>{
                          if(window.confirm(TX("deleteLogEntry"))) onDeletePayrollLog(entry.id);
                        }}
                        style={{background:"transparent",border:"1px solid #30363D",borderRadius:4,color:"var(--t3)",
                          fontSize:"var(--fs-1)",padding:"3px 7px",cursor:"pointer",fontFamily:"DM Mono"}}>✕</button>
                    )}
                    <button className="hov" onClick={()=>setOpenLog(openLog===entry.id?null:entry.id)}
                      style={{background:"#21262D",border:"1px solid #30363D",borderRadius:4,color:"var(--t2)",
                        fontSize:"var(--fs-1)",padding:"3px 8px",cursor:"pointer",fontFamily:"DM Mono"}}>
                      {openLog===entry.id?TX("close"):TX("view")}
                    </button>
                  </span>
                </div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>
                  {(entry.payees||[]).map(p=>`${String(p.name).split(" ")[0]} $${p.subtotal.toLocaleString()}`).join(" · ")}
                </div>
                {openLog===entry.id&&(
                  <div style={{marginTop:9}}>
                    <pre style={{margin:0,background:"#0D1117",border:"1px solid #21262D",borderRadius:6,
                      padding:"11px 13px",fontFamily:"'IBM Plex Mono','DM Mono',monospace",fontSize:"var(--fs-3)",
                      color:"var(--t2)",whiteSpace:"pre",overflowX:"auto",lineHeight:1.6}}>{entry.text}</pre>
                    <button className="hov" onClick={()=>{navigator.clipboard?.writeText(entry.text);}}
                      style={{marginTop:6,background:"#21262D",border:"1px solid #30363D",borderRadius:5,
                        color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 12px",cursor:"pointer",fontFamily:"DM Mono"}}>
                      COPIAR DE NUEVO
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div style={{padding:"9px 16px",fontSize:"var(--fs-1)",color:"var(--t3)"}}>
              {TX("exactCopy")}
            </div>
          </div>
        )}

        <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:8}}>
            {TX("netSplitYear",{y:compYear,n:filesMo})}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
            {Object.keys(LO_STAGES).map(k=>{
              const demo=loanSplit({loan:417000,bps:220,loStage:k,isBM:k==="bm"},
                {year:compYear,filesPerMonth:filesMo,trainerAssigned:k==="newbie"||k==="intermediate"});
              return (
                <div key={k} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:6,padding:"9px 11px"}}>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontWeight:500}}>{P(LO_STAGES[k])}</div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontFamily:"DM Mono",marginTop:4,lineHeight:1.6}}>
                    LO {(demo.shares.lo*100).toFixed(1)}%
                    {demo.shares.trainer>0?` · trainer ${(demo.shares.trainer*100).toFixed(1)}%`:""}
                    <br/>{demo.isBM
                      ? TX("youKeep",{n:(demo.shares.lo*100).toFixed(0)})
                      : TX("branchKeeps",{n:(demo.shares.branch*100).toFixed(1)})} · Paulo {(demo.shares.paulo*100).toFixed(0)}%
                    <br/><span style={{color:demo.margin<0?"#E85D75":demo.isBM?"#F5A623":"#7EC8A4"}}>
                      {demo.isBM
                        ? TX("yourIncomePerFile",{d:demo.margin.toLocaleString()})
                        : TX("marginPerFile",{d:demo.margin.toLocaleString()})}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:8,lineHeight:1.6}}>
            El Newbie no sube con la escalera — sube al graduar a Intermediate con ${STAGE_THRESHOLDS.intermediate/1e6}M de volumen fondeado.
            Un piso contractual (⚑) nunca se suma a los aumentos de la escalera.
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>MY PERSONAL LO COMP — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>your files only · {BPS_RATE} bps default</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)",fontSize:"var(--fs-3)"}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"#06D6A0",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{fileCompBps(f,BPS_RATE)}</td>
                  <td style={{padding:"10px 14px",color:"#4A90D9",fontWeight:500,fontFamily:"Syne"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid #4A90D9"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#4A90D9"}}>MY TOTAL PERSONAL COMP</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"#4A90D9"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>No personal closed files yet.</div>}
        </div>
      </div>}

      {/* MY COMP TAB */}
      {prodTab==="mycomp"&&isLO&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>MY PERSONAL COMP — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>your closed files only · {BPS_RATE} bps default</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"var(--t1)",fontSize:"var(--fs-3)"}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"#06D6A0",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{fileCompBps(f,BPS_RATE)}</td>
                  <td style={{padding:"10px 14px",color:"#4A90D9",fontWeight:500,fontFamily:"Syne"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid #4A90D9"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#4A90D9"}}>MY TOTAL COMP</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"#4A90D9"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>No personal closed files yet.</div>}
        </div>
      </div>}

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
        <span style={{fontFamily:"DM Mono",color:done?"var(--t3)":c,whiteSpace:"nowrap"}}>
          <b style={{fontWeight:500,letterSpacing:".5px"}}>{s.short}</b>{" "}
          <span style={{color:done?"#30363D":"var(--t2)"}}>{mon(s.date)}</span>
          {done&&<span style={{marginLeft:4,fontSize:"var(--fs-1)"}}>
            {s.outcome==="met"?"✓":s.outcome==="waived"?"⚑":s.outcome==="missed"?"✕":"—"}</span>}
        </span>
        {!done&&(
          <span style={{fontFamily:"DM Mono",color:late?"#E85D75":"var(--t2)",textAlign:"right",whiteSpace:"nowrap"}}>
            {act&&<span style={{color:late?"#E85D75":"var(--t2)"}}>
              {ACTION_VERB[actionStage]||"start"} by {mon(act.startBy)} · </span>}
            <span style={{color:c,fontWeight:500}}>
              {s.daysLeft<0?`${Math.abs(s.daysLeft)}d late`:`${s.daysLeft}d`}</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{borderTop:"1px solid #21262D",paddingTop:8,display:"flex",flexDirection:"column",gap:5}}>
      {row(st.appraisal,"Appraisal Ordered")}
      {row(st.loan,"Submitted to UW")}
      {(coe||st.ctc?.date)&&(
        <div style={{display:"flex",gap:10,fontSize:"var(--fs-2)",color:"var(--t3)",fontFamily:"DM Mono",flexWrap:"wrap",
          borderTop:"1px solid #161B22",paddingTop:5}}>
          {st.ctc?.date&&<span>CTC <span style={{color:LEVEL_COLOR[st.ctc.level]}}>{mon(st.ctc.date)}</span></span>}
          {coe&&<span>COE <span style={{color:LEVEL_COLOR[st.coe.level]}}>{mon(coe)}</span></span>}
          {cd&&<span title={TX("cdIssueTitle")}>
            CD by <span style={{color:"#BD65E8"}}>{mon(cd)}</span></span>}
        </div>
      )}
      {conflicts.length>0&&(
        <div style={{fontSize:"var(--fs-2)",fontFamily:"DM Mono",color:"#E85D75"}}>
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
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"#161B22",border:"1px solid #30363D",
        borderRadius:12,width:"100%",maxWidth:460,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #21262D"}}>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--t1)"}}>{TX("changeLenderTitle")}</div>
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
            <div style={{background:"#0D1117",border:`1px solid ${cost.tooLate?"#E85D75":"#21262D"}`,
              borderRadius:6,padding:"10px 11px",display:"flex",flexDirection:"column",gap:7}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("whatItCosts")}</div>

              {cost.comp&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                    <span style={{color:"var(--t2)"}}>{TX("compensation")}</span>
                    <span style={{color:cost.comp.bps<0?"#E85D75":cost.comp.bps>0?"#7EC8A4":"var(--t2)",fontFamily:"DM Mono"}}>
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
                <div style={{fontSize:"var(--fs-3)",color:"#F5A623",lineHeight:1.45}}>
                  El lock no se transfiere. Sueltas {cost.lockedRate}% y vuelves a lockear
                  al mercado del día. Si la tasa subió, la paga el cliente.
                </div>
              )}

              <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                <span style={{color:"var(--t2)"}}>{TX("landsAt")}</span>
                <span style={{color:"#F5A623",fontFamily:"DM Mono"}}>{cost.landsAt}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-3)"}}>
                <span style={{color:"var(--t2)"}}>{TX("reunderwrite")}</span>
                <span style={{color:"var(--t2)",fontFamily:"DM Mono"}}>{TX("daysN",{n:cost.days.best+"–"+cost.days.worst})}</span>
              </div>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",lineHeight:1.5}}>
                {TX("travelsHint")}</div>

              {cost.tooLate&&(
                <div style={{fontSize:"var(--fs-3)",color:"#E85D75",background:"rgba(232,93,117,.08)",
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
              <div style={{fontSize:"var(--fs-2)",color:isLenderFault(reasonId)?"#F5A623":"var(--t3)",marginTop:5,lineHeight:1.45}}>
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

        <div style={{padding:"12px 22px",borderTop:"1px solid #21262D",display:"flex",gap:8}}>
          <button className="hov" disabled={!ready}
            onClick={()=>onConfirm({lenderId:toId,reasonId,notes,by:profile?.name||null})}
            style={{flex:2,background:ready?"#F5A623":"#21262D",color:ready?"#0D1117":"#30363D",borderRadius:7,
              padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500,border:"none",
              cursor:ready?"pointer":"not-allowed"}}>
            {TX("moveTo")} {to?to.name.toUpperCase().slice(0,16):"…"}
          </button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:7,padding:"10px 0",
              fontFamily:"DM Mono",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>CANCELAR</button>
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
    <div style={{borderTop:"1px solid #21262D",paddingTop:11,display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("backupLender")}</div>
      <select value={backupId} onChange={e=>setBackupId(e.target.value)} style={fs}>
        <option value="">— ninguno —</option>
        {options.map(o=><option key={o.id} value={o.id}>{o.name}{o.lenderPaidBps?` · ${o.lenderPaidBps} bps`:""}</option>)}
      </select>

      {b&&cost&&(
        <div style={{fontSize:"var(--fs-2)",fontFamily:"DM Mono",color:cost.bps<0?"#E85D75":"#7EC8A4"}}>
          {cost.bps===0
            ? TX("movingFree",{name:b.name,n:cost.toCeiling})
            : TX("movingCosts",{b:cost.bps,d:Math.abs(cost.dollars).toLocaleString()})}
          <div style={{color:"var(--t3)",fontSize:"var(--fs-1)",marginTop:2}}>
            {TX("youChargeCap",{a:cost.current,b:cost.toCeiling})}
          </div>
        </div>
      )}

      {b&&v.ready&&(
        <div style={{background:"#0D1117",border:`1px solid ${lc}44`,borderRadius:6,padding:"9px 10px"}}>
          <div style={{fontSize:"var(--fs-3)",color:lc,fontFamily:"DM Mono"}}>
            {v.window==="impossible"
              ? TX("noLongerMakesIt",{d:v.decideByBest})
              : v.window==="best_case_only"
                ? TX("onlyIfNothingFails",{d:v.decideByBest})
                : TX("safeUntil",{d:v.decideByWorst,n:v.daysToWorst})}
          </div>
          <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:2,fontSize:"var(--fs-2)",fontFamily:"DM Mono"}}>
            <div style={{color:v.window==="safe"?"#7EC8A4":"var(--t3)"}}>
              {TX("untilArrivesAnyway",{d:v.decideByWorst,n:v.worstDays})}
            </div>
            <div style={{color:v.window==="best_case_only"?"#F5A623":"var(--t3)"}}>
              {TX("betweenOnlyIfClean",{a:v.decideByWorst,b:v.decideByBest,n:v.bestDays})}
            </div>
            <div style={{color:v.window==="impossible"?"#E85D75":"var(--t3)"}}>
              {TX("afterNoMakes",{d:v.decideByBest})}
            </div>
          </div>
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:5,lineHeight:1.5}}>
            {TX("countedBackFromCd",{d:v.cdDeadline})}
          </div>
          {v.expiresBeforeContingency&&(
            <div style={{fontSize:"var(--fs-2)",color:"#F5A623",marginTop:6,lineHeight:1.45}}>
              {TX("cushionBefore",{n:v.gapDays,d:v.loanContingency})}
            </div>
          )}
        </div>
      )}

      <button className="hov" onClick={onChangeLender} disabled={!file.lenderId}
        style={{background:"rgba(245,166,35,.1)",color:file.lenderId?"#F5A623":"#30363D",borderRadius:6,
          padding:"8px 0",fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:`1px solid ${file.lenderId?"#F5A623":"#21262D"}`,
          cursor:file.lenderId?"pointer":"not-allowed"}}>{TX("changeLender")}</button>

      {(file.lenderHistory||[]).length>0&&(
        <div style={{marginTop:2}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
            HISTORIAL · {lenderChangeCount(file)} cambio{lenderChangeCount(file)===1?"":"s"}
            {lenderFaultChanges(file)>0&&<span style={{color:"#F5A623"}}> · {lenderFaultChanges(file)} por el lender</span>}
          </div>
          {(file.lenderHistory||[]).slice().reverse().map((h,i)=>(
            <div key={i} style={{fontSize:"var(--fs-2)",color:"var(--t2)",marginBottom:5,lineHeight:1.5}}>
              <span style={{color:"var(--t3)"}}>{h.at}</span>{" · "}
              <span style={{color:"var(--t2)"}}>{h.fromName||"—"} → {h.toName}</span>
              {h.compDeltaDollars!=null&&<span style={{color:h.compDeltaBps<0?"#E85D75":"#7EC8A4"}}>
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
  const draft={...file,leadOrigin:origin,financedFeePct:feePct===""?null:Number(feePct),
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
    financedFeePct:feePct===""?null:Number(feePct),
    leadClass:leadOrigin(origin)?.klass==="pending"?(file.leadClass||null):leadOrigin(origin)?.klass,
  }); },[sig,origin]);

  // El roster tiene que aplicarse aquí igual que en payroll. Sin él, un archivo
  // del BM se repartía al 50% de newbie — un número de dinero equivocado en
  // pantalla, que es el peor tipo de error de todos.
  const enriched=withLoContext(draft,allFiles||[],COMP_ROSTER);
  const pay=payoutBreakdown(enriched,{year:COMP_YEAR,filesPerMonth:BRANCH_FILES_MO,
    trainerAssigned:!!(COMP_ROSTER[file.lo]?.trainer),
    names:{branch:"Del Valle Lending",teamLead:"Paulo Maria",trainer:"Trainer"}});
  if(!pay.gross) return null;
  const rows=isAdmin?pay.rows:pay.rows.filter(r=>r.id==="lo"&&mine);

  return (
    <div style={{background:"rgba(6,214,160,.04)",border:"1px solid #06D6A033",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#06D6A0",letterSpacing:"1px"}}>
          {isAdmin?TX("fileComp"):TX("yourComp")}
        </span>
        <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("savesWithSave")}</span>
      </div>

      <div>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{TX("clientOrigin")}</div>
        {isAdmin?(
          <select value={origin} onChange={e=>setOrigin(e.target.value)}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
              padding:"6px 9px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:"100%"}}>
            {LEAD_ORIGINS.map(o=><option key={o.id} value={o.id}>{P(o)}</option>)}
          </select>
        ):(
          <div style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>{P(leadOrigin(origin))||"—"}</div>
        )}
        {pay.split.inHouseApplied&&(
          <div style={{fontSize:"var(--fs-2)",color:"#F5A623",marginTop:4}}>
            Lead de la sucursal · {(IN_HOUSE_REDUCTION*100).toFixed(0)} puntos menos que producción propia
          </div>
        )}
        {pay.split.leadPending&&isAdmin&&(
          <div style={{fontSize:"var(--fs-2)",color:"#BD65E8",marginTop:4}}>
            {TX("leadPending")}
          </div>
        )}
        {isAdmin&&PN(leadOrigin(origin))&&!pay.split.leadPending&&(
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:3}}>{PN(leadOrigin(origin))}</div>
        )}
      </div>

      {financedFeeAmount(draft)>0&&(
        <div style={{borderTop:"1px solid #21262D",paddingTop:9,fontSize:"var(--fs-3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--t2)",marginBottom:3}}>
            <span>{TX("baseLoan")}</span>
            <span style={{fontFamily:"DM Mono"}}>${(Number(draft.loan)||0).toLocaleString()}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:3}}>
            <span style={{color:"var(--t2)"}}>+ {P(financedFeeMeta(draft))}</span>
            <span style={{display:"flex",alignItems:"center",gap:6}}>
              {isAdmin?(
                <input value={feePct} inputMode="decimal"
                  onChange={e=>setFeePct(e.target.value.replace(/[^\d.]/g,""))}
                  style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:4,color:"var(--t2)",
                    padding:"2px 5px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:44,textAlign:"right"}}/>
              ):<span style={{color:"var(--t3)",fontSize:"var(--fs-3)"}}>{financedFeePct(draft)}</span>}
              <span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>%</span>
              <span style={{color:"var(--t2)",fontFamily:"DM Mono",minWidth:74,textAlign:"right"}}>
                ${financedFeeAmount(draft).toLocaleString()}
              </span>
            </span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",color:"var(--t2)",
            borderTop:"1px solid #21262D",paddingTop:5}}>
            <span>{TX("compBasis")}</span>
            <span style={{fontFamily:"DM Mono"}}>${compBasisAmount(draft).toLocaleString()}</span>
          </div>
          {isAdmin&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:5,lineHeight:1.5}}>{TX("financedHint")}</div>}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-4)",borderTop:"1px solid #21262D",paddingTop:9}}>
        <span style={{color:"var(--t2)"}}>{TX("grossComm")}{isAdmin?` · ${fileCompBps(draft)} bps`:""}
          {effBps!==null&&effBps!==Number(file.bps)?<span style={{color:"#F5A623"}}> · sin guardar</span>:null}</span>
        <span style={{color:"var(--t1)",fontFamily:"DM Mono"}}>${pay.gross.toLocaleString()}</span>
      </div>

      <div style={{borderTop:"1px solid #21262D",paddingTop:8}}>
        <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:6}}>
          {TX("adjustments")}
        </div>
        {fees.map((fee,i)=>(
          <div key={fee.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <input type="checkbox" checked={fee.on} disabled={!isAdmin}
              onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,on:e.target.checked}:x))}
              style={{accentColor:"#E85D75",cursor:isAdmin?"pointer":"not-allowed"}}/>
            <span style={{fontSize:"var(--fs-3)",color:fee.on?"var(--t1)":"var(--t3)",flex:1}}>{P(fee)}</span>
            <input inputMode="numeric" value={fee.amount} disabled={!isAdmin||!fee.on}
              onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,amount:Number(e.target.value.replace(/[^\d]/g,""))||0}:x))}
              style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,
                color:fee.on?"#E85D75":"#30363D",padding:"4px 7px",fontSize:"var(--fs-3)",
                fontFamily:"DM Mono",width:76,textAlign:"right"}}/>
          </div>
        ))}
        {extras.map((e,i)=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <button className="hov" disabled={!isAdmin}
              onClick={()=>setExtras(extras.map((x,j)=>j===i?{...x,kind:x.kind==="fee"?"credit":"fee"}:x))}
              title={e.kind==="fee"?TX("toCredit"):TX("toFee")}
              style={{background:"transparent",border:"none",width:15,padding:0,
                color:ADJUSTMENT_KINDS[e.kind].color,fontSize:"var(--fs-6)",fontFamily:"DM Mono",
                cursor:isAdmin?"pointer":"default"}}>{e.kind==="fee"?"−":"+"}</button>
            <input value={e.label} disabled={!isAdmin} placeholder={e.kind==="credit"?TX("creditName"):TX("adjName")}
              onChange={ev=>setExtras(extras.map((x,j)=>j===i?{...x,label:ev.target.value}:x))}
              style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:5,color:"var(--t1)",
                padding:"4px 7px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",flex:1}}/>
            <input inputMode="numeric" value={e.amount} disabled={!isAdmin}
              onChange={ev=>setExtras(extras.map((x,j)=>j===i?{...x,amount:Number(ev.target.value.replace(/[^\d]/g,""))||0}:x))}
              style={{background:"#0D1117",borderRadius:5,
                border:`1px solid ${e.kind==="credit"?"#7EC8A455":"#30363D"}`,
                color:ADJUSTMENT_KINDS[e.kind].color,
                padding:"4px 7px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",width:76,textAlign:"right"}}/>
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
            style={{background:"transparent",border:"1px dashed #30363D",borderRadius:5,color:"var(--t2)",
              fontSize:"var(--fs-2)",fontFamily:"DM Mono",padding:"5px 0",width:"100%",cursor:"pointer",marginTop:2}}>
            {TX("otherAdj")}
          </button>
        )}
        {!isAdmin&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
          Registrados con el archivo.
        </div>}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
        borderTop:"1px solid #21262D",paddingTop:8}}>
        <span style={{fontSize:"var(--fs-4)",color:"var(--t1)",fontWeight:500}}>NET</span>
        <span style={{fontSize:"var(--fs-6)",color:"#06D6A0",fontFamily:"DM Mono"}}>${pay.net.toLocaleString()}</span>
      </div>
      {unnamed&&(
        <div style={{fontSize:"var(--fs-2)",color:"#E85D75"}}>
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

      <div style={{borderTop:"1px solid #21262D",paddingTop:8}}>
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
                <span style={{fontSize:"var(--fs-3)",color:own?"#06D6A0":"var(--t2)"}}>
                  {r.who}<span style={{color:"var(--t3)"}}> · {(r.pct*100).toFixed(1)}%</span>
                </span>
                <span style={{fontFamily:"Syne",fontWeight:800,fontSize:own?"var(--fs-6)":"var(--fs-5)",
                  color:own?"#06D6A0":"var(--t1)"}}>${r.amount.toLocaleString()}</span>
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
    <div style={{background:"rgba(74,144,217,.06)",border:`1px solid ${conf.some(c=>c.sev==="critical")?"#E85D7555":"#30363D"}`,
      borderRadius:6,padding:"7px 9px",marginTop:9,display:"flex",flexDirection:"column",gap:4}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
        <span style={{fontSize:"var(--fs-3)",color:l?"#4A90D9":"var(--t3)",fontFamily:"DM Mono",fontWeight:500,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {lenderNameOf(file)||"sin lender"}
        </span>
        <span style={{display:"flex",gap:6,alignItems:"baseline",flexShrink:0}}>
          {file.rate&&<span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"DM Mono"}}>{Number(file.rate).toFixed(3)}%</span>}
          <span style={{fontSize:"var(--fs-1)",color:lc,border:`1px solid ${lc}66`,borderRadius:3,padding:"1px 5px",
            fontFamily:"DM Mono",letterSpacing:".5px"}}>{ls.state==="locked"?"LOCKED":"FLOAT"}</span>
        </span>
      </div>
      <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontFamily:"DM Mono",display:"flex",gap:8,flexWrap:"wrap"}}>
        {ch&&<span style={{color:ch.color}}>{P(ch).toLowerCase()}</span>}
        {bk&&bv.ready&&<span style={{color:bv.level==="critical"?"#E85D75":bv.level==="warn"?"#F5A623":"var(--t2)"}}>
          respaldo {bk.name.split(" ")[0]} · viable to {mon(bv.decideByWorst)}</span>}
        {ls.state==="float"&&ls.mustLockBy&&(
          <span style={{color:ls.level==="critical"?"#E85D75":"var(--t2)"}}>
            lock by {mon(ls.mustLockBy)}{ls.daysLeft!==null?` · ${ls.daysLeft<0?`${Math.abs(ls.daysLeft)}d late`:`${ls.daysLeft}d`}`:""}
          </span>
        )}
        {ls.state==="locked"&&ls.expires&&(
          <span style={{color:ls.coversClose?"var(--t2)":"#E85D75"}}>
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
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>{TX("lenderLock")}</span>
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
                style={{flex:1,background:on?`${c.color}18`:"#0D1117",border:`1px solid ${on?c.color:"var(--t4)"}`,
                  borderRadius:6,padding:"8px 6px",cursor:"pointer",fontFamily:"DM Mono",textAlign:"left"}}>
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
          <div style={{fontSize:"var(--fs-2)",color:"#F5A623",marginTop:5,lineHeight:1.5}}>
            {TX("hiddenByChannel",{
              n:hidden.length,
              list:hidden.slice(0,4).map(x=>x.name).join(", ")
                   + (hidden.length>4?TX("andNMore",{n:hidden.length-4}):"")
            })}
          </div>
        )}
        {l&&(
          <div style={{marginTop:6,display:"flex",gap:8,flexWrap:"wrap",fontSize:"var(--fs-2)",fontFamily:"DM Mono"}}>
            {l.contacts?.[0]?.ae&&<span style={{color:"var(--t2)"}}>AE {l.contacts[0].ae}</span>}
            {l.contacts?.[0]?.phone&&<a href={`tel:${l.contacts[0].phone.replace(/[^\d+]/g,"")}`}
              style={{color:"#4A90D9",textDecoration:"none"}}>{l.contacts[0].phone}</a>}
            {l.guidelines&&<a href={l.guidelines} target="_blank" rel="noreferrer"
              style={{color:"#BD65E8",textDecoration:"none"}}>{TX("guidelines")}</a>}
          </div>
        )}
      </div>

      {/* COMPENSATION — editable where it legitimately varies by loan,
          read-only where the comp plan determines it. */}
      {isAdmin&&lenderId&&(
        <div style={{background:"#0D1117",border:`1px solid ${comp.overCeiling?"#E85D75":"#21262D"}`,
          borderRadius:6,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
            <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("compensation")}</span>
            <span style={{fontSize:"var(--fs-1)",color:comp.meta.editable?"#7EC8A4":"var(--t2)"}}>{P(comp.meta)}</span>
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
                <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontFamily:"DM Mono",width:66,textAlign:"right"}}>{ln.bps??"—"}</span>
              )}
              <span style={{fontSize:"var(--fs-1)",color:"var(--t3)",width:22}}>bps</span>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontFamily:"DM Mono",width:74,textAlign:"right"}}>
                {ln.dollars!==null?`$${ln.dollars.toLocaleString()}`:"—"}
              </span>
            </div>
          ))}

          <div style={{borderTop:"1px solid #21262D",paddingTop:7,display:"flex",
            justifyContent:"space-between",alignItems:"baseline"}}>
            <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>Total</span>
            <span style={{fontSize:"var(--fs-5)",color:comp.overCeiling?"#E85D75":"#F5A623",fontFamily:"DM Mono"}}>
              {comp.totalBps??"—"} bps{comp.totalDollars!==null?` · $${comp.totalDollars.toLocaleString()}`:""}
            </span>
          </div>

          {/* room left under the ceiling, shown as a bar so it reads at a glance */}
          <div>
            <div style={{height:4,background:"#21262D",borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.min(100,comp.pctOfCeiling??0)}%`,
                background:comp.overCeiling?"#E85D75":comp.pctOfCeiling>=95?"#F5A623":"#7EC8A4"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4}}>
              <span>{PN(comp.meta)}</span>
              <span style={{color:comp.overCeiling?"#E85D75":"var(--t3)"}}>
                {comp.remainingBps>0?TX("ceilingLeftN",{n:comp.ceilingBps,r:comp.remainingBps}):TX("ceilingLeft",{n:comp.ceilingBps})}
              </span>
            </div>
          </div>

          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
            {comp.totalBps!=null
              ? TX("willWriteBps",{n:comp.totalBps})
              : "Sin dato — los reportes usan el default de la sucursal."}
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
        <div style={{background:"#0D1117",border:`1px solid ${ls.level==="critical"?"#E85D7544":"#F5A62333"}`,
          borderRadius:6,padding:"9px 10px"}}>
          {ls.mustLockBy?(
            <>
              <div style={{fontSize:"var(--fs-3)",color:ls.level==="critical"?"#E85D75":"#F5A623",fontFamily:"DM Mono"}}>
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
                <div key={t.term} style={{display:"flex",gap:8,fontSize:"var(--fs-2)",fontFamily:"DM Mono",
                  color:t.covers?"#7EC8A4":"#E85D75"}}>
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
            <div style={{gridColumn:"1/-1",background:"#0D1117",
              border:`1px solid ${ls.coversClose?"#7EC8A433":"#E85D7544"}`,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:"var(--fs-3)",fontFamily:"DM Mono",color:ls.coversClose?"#7EC8A4":"#E85D75"}}>
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
        <div key={i} style={{fontSize:"var(--fs-3)",color:c.sev==="critical"?"#E85D75":"#F5A623",background:"#0D1117",
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
          style={{...fs,borderColor:typing?"#F5A623":"#30363D"}}/>
        {typing&&<div style={{fontSize:"var(--fs-1)",color:"#F5A623",marginTop:3}}>{TX("typingYear")}</div>}
        {!typing&&hint&&<div style={{fontSize:"var(--fs-1)",color:"var(--t4)",marginTop:3}}>{hint}</div>}
      </div>
    );
  };

  return (
    <div style={{background:"rgba(232,93,117,.04)",border:"1px solid #E85D7533",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#E85D75",letterSpacing:"1px"}}>{TX("contingencies")}</span>
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
        <div style={{fontSize:"var(--fs-2)",color:basis==="business"?"#F5A623":"var(--t2)",paddingBottom:8}}>
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
      <div style={{borderLeft:"2px solid #E85D75",paddingLeft:10}}>
        {field("contractAccepted",TX("contractAccepted"),TX("anchorHint"))}
      </div>

      {/* CONTRACT — deposit at risk */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"#E85D75",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          {TX("fromContract")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {field("appraisalContingency",TX("appraisal"))}
          {field("loanContingency",TX("loanCont"))}
        </div>
      </div>

      {/* DELIVERY CHAIN */}
      <div>
        <div style={{fontSize:"var(--fs-2)",color:"#F5A623",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          {TX("deliveryChain")}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {field("ctcTarget","CTC")}
          {field("coe","COE")}
          {field("fundingDate",TX("funding"))}
        </div>
        {cd&&(
          <div style={{marginTop:8,background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",
            borderRadius:6,padding:"8px 10px",fontSize:"var(--fs-3)",color:"#BD65E8",fontFamily:"DM Mono"}}>
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
          <div style={{fontSize:"var(--fs-2)",color:"#E85D75",letterSpacing:"1px",fontWeight:500}}>
            ⚠ {conflicts.length} {conflicts.length===1?TX("conflicts"):TX("conflictsPl")}
          </div>
          {conflicts.map((c,i)=>(
            <div key={i} style={{fontSize:"var(--fs-3)",color:c.sev==="critical"?"#E85D75":"#F5A623",
              background:"#0D1117",border:`1px solid ${c.sev==="critical"?"#E85D7544":"#F5A62344"}`,
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
              <div key={r.id} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:5,padding:"8px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:"var(--fs-2)",color:LEVEL_COLOR[r.level],fontWeight:500,minWidth:38}}>{r.short}</span>
                  <span style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>{r.date}</span>
                  {r.contractDays!==null&&<span style={{fontSize:"var(--fs-1)",color:r.contractDays<0?"#E85D75":"#30363D"}}>
                    {r.contractDays} {TX("contractDaysOf",{b:r.basis==="business"?TX("bizShort"):TX("calShort")})}
                    {r.contractDays<0?" ⚠":""}</span>}
                  <span style={{fontSize:"var(--fs-2)",color:r.outcomeMeta.color,marginLeft:"auto"}}>
                    {P(r.outcomeMeta)}{ext>0?` ·${ext}×`:""}
                  </span>
                  <button className="hov" onClick={()=>setOpenId(openId===r.id?null:r.id)}
                    style={{background:"#21262D",border:"1px solid #30363D",borderRadius:4,color:"var(--t2)",
                      fontSize:"var(--fs-1)",padding:"3px 7px",cursor:"pointer",fontFamily:"DM Mono"}}>
                    {openId===r.id?"✕":TX("record")}
                  </button>
                </div>
                {r.depositAtRisk&&(
                  <div style={{fontSize:"var(--fs-2)",color:"#E85D75",marginTop:5}}>
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
                        <div style={{fontSize:"var(--fs-1)",color:"#F5A623",marginBottom:3}}>
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
                      style={{background:outcomeById(oc).requiresNewDate&&!ocDate?"#161B22":"#21262D",
                        color:outcomeById(oc).requiresNewDate&&!ocDate?"#30363D":"#7EC8A4",borderRadius:5,
                        padding:"7px 0",fontSize:"var(--fs-3)",fontFamily:"DM Mono",
                        border:`1px solid ${outcomeById(oc).requiresNewDate&&!ocDate?"#21262D":"#7EC8A4"}`,
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
            style={{background:"transparent",border:"none",color:"#4A90D9",fontSize:"var(--fs-2)",
              fontFamily:"DM Mono",cursor:"pointer",padding:0}}>
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
                  <div key={r.stage} style={{display:"flex",gap:8,fontSize:"var(--fs-2)",fontFamily:"DM Mono",
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
        <div style={{borderTop:"1px solid #21262D",paddingTop:8}}>
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
// "Conventional arriba, FHA DPA abajo" sin que nadie lo notara.
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
      style={{background:activo?(color||"#7EC8A4"):"transparent",
        color:activo?"#0D1117":(color||"var(--t2)"),
        border:`1px solid ${activo?(color||"#7EC8A4"):"#30363D"}`,borderRadius:5,
        padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",
        cursor:readOnly?"default":"pointer"}}>{label}</button>
  );

  return (
    <div style={{background:on?"rgba(126,200,164,.05)":"transparent",
      border:`1px solid ${on?"#7EC8A433":"#21262D"}`,borderRadius:8,
      padding:on?"12px 14px":"9px 14px",
      display:"flex",flexDirection:"column",gap:on?11:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:on?"var(--fs-5)":"var(--fs-3)",
          color:on?"#7EC8A4":"var(--t2)",letterSpacing:"1px"}}>{L2("dpaBlock")}</span>
        {on&&<span style={{fontSize:"var(--fs-3)",color:"#7EC8A4",fontFamily:"DM Mono"}}>{dpaLabel(file,lang)}</span>}
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
          <div style={{fontSize:"var(--fs-1)",color:"#F5A623"}}>{L2("dpaIncomplete")}</div>
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
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",
          color:abiertos.length?"#E85D75":"#7EC8A4",letterSpacing:"1px"}}>{TX("findings")}</span>
        {abiertos.length>0&&(
          <span style={{background:"#E85D75",color:"#0D1117",borderRadius:10,padding:"1px 8px",
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
          <div key={f.id} style={{background:"#0D1117",borderLeft:"2px solid #E85D75",
            borderRadius:"0 5px 5px 0",padding:"8px 10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{P(gate1Item(f.item))}</span>
              <span style={{fontSize:"var(--fs-2)",color:w?.color||"var(--t2)"}}>{P(w)}</span>
            </div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t1)",lineHeight:1.5,margin:"3px 0"}}>{f.text}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{fontSize:"var(--fs-1)",color:edad>=7?"#E85D75":"var(--t3)"}}>
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
                  style={{background:"#21262D",border:"1px solid #7EC8A4",borderRadius:4,color:"#7EC8A4",
                    fontSize:"var(--fs-1)",padding:"3px 9px",cursor:"pointer",fontFamily:"DM Mono"}}>
                  {TX("findingResolve")}
                </button>
              ):(
                <span style={{fontSize:"var(--fs-1)",color:"var(--t4)",fontFamily:"DM Mono"}}>
                  {TX("findingNotYours",{w:P(waitingMeta(f.waitingOn))})}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {!open?(
        <button className="hov" onClick={()=>setOpen(true)}
          style={{background:"transparent",border:"1px dashed #30363D",borderRadius:5,color:"var(--t2)",
            fontSize:"var(--fs-3)",fontFamily:"DM Mono",padding:"7px 0",width:"100%",cursor:"pointer"}}>
          {TX("findingAdd")}
        </button>
      ):(
        <div style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:6,
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
                    style={{background:on?m.color:"transparent",color:on?"#0D1117":m.color,
                      border:`1px solid ${m.color}`,borderRadius:5,padding:"4px 9px",fontSize:"var(--fs-2)",
                      fontFamily:"DM Mono",cursor:"pointer"}}>{P(m)}</button>
                );
              })}
            </div>
          </div>
          {!text.trim()&&<div style={{fontSize:"var(--fs-1)",color:"#F5A623"}}>{TX("findingNeedsText")}</div>}
          <div style={{display:"flex",gap:7}}>
            <button className="hov" disabled={!text.trim()}
              onClick={()=>{
                const n=addFinding(file,{item,text,waitingOn:waiting,by:profile?.name||null});
                onSave({findings:n.findings, gate1:n.gate1});
                setText(""); setOpen(false);
              }}
              style={{flex:2,background:text.trim()?"#E85D75":"#161B22",
                color:text.trim()?"#0D1117":"#30363D",borderRadius:6,padding:"8px 0",
                fontFamily:"DM Mono",fontSize:"var(--fs-3)",fontWeight:500,border:"none",
                cursor:text.trim()?"pointer":"not-allowed"}}>{TX("findingSave")}</button>
            <button className="hov" onClick={()=>{setOpen(false);setText("");}}
              style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:6,padding:"8px 0",
                fontFamily:"DM Mono",fontSize:"var(--fs-3)",border:"none",cursor:"pointer"}}>{TX("cancel")}</button>
          </div>
        </div>
      )}

      {cerrados.length>0&&(
        <div style={{borderTop:"1px solid #21262D",paddingTop:8}}>
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

function DetailModal({file,profile,allFiles,L,lang,onSetLang,onClose,onSave,onDelete,onAdvance,onCloseFile,onReopen,onPrep,onArchive,onRestore,onContinuePrep,isClosed}){
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
  const [tab, setTab] = useState("file");
  // Whatever the sub-panels are currently showing, ready for the single SAVE.
  const panelDrafts = useRef({});
  // Los bps que el bloque de lender tiene escritos pero aún no guardados. Con
  // solo el ref, el bloque de compensación seguía mostrando el valor viejo —
  // dos bloques en la misma pantalla con dos cifras de dinero distintas.
  const [pendingBps,setPendingBps] = useState(null);
  const [showChange,setShowChange]=useState(false);
  const [chkBusy,setChkBusy]=useState(false);
  const [newNote,setNewNote]=useState("");
  const [showAllNotes,setShowAllNotes]=useState(false);
  const entries=noteEntries(file);
  const [closing,setClosing]=useState(file.closing||"");
  const [stage,setStage]=useState(file.stage);
  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan||""));
  const [bps,setBps]=useState(String(file.bps||""));
  const [loAssigned,setLoAssigned]=useState(file.lo||"Jose Del Valle");
  const [referralPartner,setReferralPartner]=useState(file.referralPartner||"");
  const [processor,setProcessor]=useState(processorId(file));
  const [chkDraft,setChkDraft]=useState(!!file.brokerCheckReceived);
  const [compDraft,setCompDraft]=useState(()=>({...(file.compliance||{})}));
  const [phone,setPhone]=useState(file.phone||"");
  const [email,setEmail]=useState(file.email||"");
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
  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",padding:"8px 10px",fontSize:"var(--fs-5)",fontFamily:"'IBM Plex Sans',system-ui,-apple-system,sans-serif",width:"100%"};

  // Live fee calculations for referred-out files
  const finalLoanForCalc = parseInt(outFinalLoan)||parseInt(loanAmt)||file.loan||0;
  const feeEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * REFERRAL_FEE_BPS / 10000) : 0;
  const wouldHaveEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * (parseInt(bps)||BPS_RATE) / 10000) : 0;
  const lostComp = wouldHaveEarned - feeEarned;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      {/* De 480px a casi toda la pantalla. Los dieciocho bloques cabian
          en una columna angosta solo a costa de un scroll interminable;
          con ancho de verdad caben en dos columnas y cinco solapas. */}
      <div className="fi" style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:1240,height:"calc(100vh - 32px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* ENCABEZADO — cada dato con su etiqueta. Antes decia
            "FHA $450,655 eLend Jose Martha" de corrido y habia que
            adivinar quien era quien. */}
        <div style={{padding:"14px 22px 12px",display:"flex",justifyContent:"space-between",
          alignItems:"flex-start",gap:20,flexWrap:"wrap",flexShrink:0}}>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.4px"}}>
              {file.borrower}
              {isInbound&&<span title="Inbound referral" style={{marginLeft:9,fontSize:"var(--fs-4)",color:"#FFD166"}}>🤝</span>}
            </div>
            <div style={{display:"flex",gap:26,marginTop:11,flexWrap:"wrap"}}>
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
          <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
            {!inPrep&&!isReferredOut&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{TX("hdStage")}</div>
                <div style={{fontSize:"var(--fs-4)",color:ph.color}}>{stage}</div>
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:2}}>
                  {daysInStage(file)===null?"—":`${daysInStage(file)}d`}
                  {(()=>{const c=stageClock(file.stage,file);return c?` · ${TX("hdCeiling",{n:c.late})}`:"";})()}
                </div>
              </div>
            )}
            {closing&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)",marginBottom:3}}>{TX("hdClosing")}</div>
                <div style={{fontSize:"var(--fs-4)",color:"#F5A623"}}>{md(closing)}</div>
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
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"var(--t3)",
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
          <div style={{padding:"9px 22px",borderTop:"1px solid #21262D",
            display:"flex",alignItems:"center",gap:11,flexShrink:0,justifyContent:"flex-end"}}>
            <span style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>
              {daysInStage(file)===null?"—":`${daysInStage(file)}d`}
              {(()=>{const c=stageClock(file.stage,file);return c?` · ${TX("hdCeiling",{n:c.late})}`:"";})()}
            </span>
            <span style={{fontSize:"var(--fs-1)",letterSpacing:"1.3px",color:"var(--t3)"}}>{TX("hdStage")}</span>
            <select value={stage} onChange={e=>{setStage(e.target.value);
                onSave(stagePatch(file, e.target.value));}}
              style={{background:"#0D1117",border:`1px solid ${ph.color}`,borderRadius:6,
                color:ph.color,padding:"7px 11px",fontSize:"var(--fs-4)",fontFamily:"DM Mono",
                minWidth:280,cursor:"pointer"}}>
              {ALL_STAGES.map((s,i)=><option key={i} value={s.stage} style={{color:s.phase.color,background:"#0D1117"}}>[{s.phase.short}] {s.stage}</option>)}
              <optgroup label="── Bank-to-Bank Referral ──">
                <option value={REFERRED_OUT_STAGE} style={{color:"#A78BFA",background:"#0D1117"}}>🔀 REFERRED OUT — EXTERNAL BANK</option>
              </optgroup>
            </select>
          </div>
        )}

        {/* SOLAPAS — estiradas a todo el ancho, en cinco partes iguales.
            La activa lleva fondo Y barra dorada: solo con el subrayado se
            perdian entre el resto del texto. */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",
          borderTop:"1px solid #21262D",borderBottom:"1px solid #21262D",
          background:"#0A0E13",flexShrink:0}}>
          {/* Sin contadores. Un numero rojo sin explicacion asusta pero no
              informa — vuelven cuando la guia enseñe que significan. */}
          {[
            ["loan",  TX("tabLoan")],
            ["lender",TX("tabLender")],
            ["dates", TX("tabDates")],
            ["money", TX("tabMoney")],
            ["file",  TX("tabFile")],
          ].map(([id,label],i)=>{
            const on=tab===id;
            return (
              <button key={id} className="hov" onClick={()=>setTab(id)}
                style={{background:on?"#171D26":"transparent",border:"none",cursor:"pointer",
                  color:on?"#F5A623":"var(--t2)",fontSize:"var(--fs-3)",fontFamily:"Syne",
                  fontWeight:on?800:500,letterSpacing:"1.6px",padding:"12px 0",
                  textAlign:"center",borderRight:i<4?"1px solid #21262D":"none",
                  boxShadow:on?"inset 0 -2px 0 #F5A623":"none",
                  transition:"color .12s"}}>
                {label}
              </button>
            );
          })}
        </div>

        {/* CUERPO — retícula fija 53/47. Los bloques se reparten por
            solapa; dentro de cada una, las columnas se llenan solas y en
            móvil se apilan. */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 22px",display:"grid",
          gridTemplateColumns:"53% 47%",gap:14,alignItems:"start",alignContent:"start"}}>
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
              <div style={{fontSize:"var(--fs-1)",color:"#F5A623",marginTop:4,lineHeight:1.5}}>
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
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BPS COMP <span style={{color:"#F5A623"}}>{TX("reportedByDash")}</span></div>
              <input value={bps} onChange={e=>setBps(e.target.value)} placeholder="150" style={{...fs2,color:"#F5A623"}}/>
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
            <select value={loAssigned} onChange={e=>setLoAssigned(e.target.value)} style={fs2}>
              {LO_LIST.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}
            </select>
          </div>
          {!inPrep && !isReferredOut && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("processor")}</div>
              {isAdmin?(
                <select value={processor} onChange={e=>setProcessor(e.target.value)} style={fs2}>
                  {PROCESSOR_IDS.map(id=>(
                    <option key={id} value={id}>{PROCESSORS[id].full}</option>
                  ))}
                </select>
              ):(
                <div style={{fontSize:"var(--fs-4)",color:processorOf(file).color}}>{processorOf(file).full}</div>
              )}
              {isRegistered(file)&&(
                <div style={{fontSize:"var(--fs-2)",color:"#7EC8A4",marginTop:4}}>
                  {L("registeredOn",{d:registeredAt(file)})}
                  {registeredBy(file)?L("registeredBy",{who:String(registeredBy(file)).split(" ")[0]}):""}
                  {registrationCount(file)>1?` · ${L("registerTimes",{n:registrationCount(file)})}`:""}
                </div>
              )}
              {/* El lender cambió y el archivo volvió a Tina. Dorado: se
                  avecina un trabajo, nada está roto todavía. */}
              {needsReRegistration(file)&&(
                <div style={{fontSize:"var(--fs-2)",color:"#F5A623",marginTop:4,lineHeight:1.5}}>
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
              {registerBlocked(file)&&(isAdmin||isAssistant)&&(
                <div title={TX("registerNoLenderHint")}
                  style={{marginTop:7,width:"100%",background:"transparent",
                    color:"#F5A623",borderRadius:6,padding:"8px 0",fontFamily:"DM Mono",
                    fontSize:"var(--fs-3)",border:"1px dashed #F5A62366",textAlign:"center",
                    cursor:"default"}}>
                  {TX("registerNoLender")}
                </div>
              )}
              {registerReady(file)&&(isAdmin||isAssistant)&&(
                <button className="hov"
                  onClick={()=>{
                    if(!confirm(TX("registerConfirm",{p:processorOf(file).full}))) return;
                    const n=stampRegistration(file,profile?.name||null);
                    setStage(n.stage);
                    onSave({stage:n.stage, stageEnteredAt:n.stageEnteredAt, daysInStage:0,
                      stageLog:n.stageLog, fileOpenedAt:n.fileOpenedAt,
                      registrations:n.registrations, registeredAt:n.registeredAt,
                      registeredBy:n.registeredBy, processor:n.processor});
                  }}
                  title={TX("registerHint")}
                  style={{marginTop:7,width:"100%",background:"rgba(126,200,164,.1)",
                    color:"#7EC8A4",borderRadius:6,padding:"8px 0",fontFamily:"DM Mono",
                    fontSize:"var(--fs-3)",border:"1px solid #7EC8A4",cursor:"pointer"}}>
                  {TX("register")}
                </button>
              )}
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,lineHeight:1.5}}>
                {L("processorHint")}
                {PROCESSORS[processor]?.external?" · "+L("processorExternal"):""}
              </div>
            </div>
          )}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("referralPartner")}</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)}
              list="socios-conocidos" placeholder={TX("partnerPlaceholder")} style={fs2}/>
            <datalist id="socios-conocidos">
              {knownPartners(allFiles||[]).map(n=><option key={n} value={n}/>)}
            </datalist>
            {referralPartner.trim()&&!knownPartners(allFiles||[]).some(n=>canonicalPartner(n)===canonicalPartner(referralPartner))&&(
              <div style={{fontSize:"var(--fs-1)",color:"#F5A623",marginTop:4}}>{TX("newPartner")}</div>
            )}
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={fs2}/>
          </div>
          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="borrower@email.com" style={fs2}/>
          </div>
        </div>

        {/* LENDER — chosen at Full Application; the channel gates the list */}
        {tab==="lender" && !inPrep && !isReferredOut && (atOrPastFullApp(stage) || hasLenderData(file)) && (
          <div style={{gridColumn:"1/-1"}}>
          <LenderPanel file={file} profile={profile}
            onDraft={p=>{panelDrafts.current.lender=p; setPendingBps(p.bps ?? null);}}
            onChangeLender={()=>setShowChange(true)}/>
          </div>
        )}


        {/* ADMISION — el LO las sabe al precalificar. La procesadora las
            completa si faltan, pero la captura nace aqui. */}
        {tab==="file" && !inPrep && !isReferredOut && (
          <div style={{background:"rgba(189,101,232,.04)",border:"1px solid #BD65E833",
            borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10,
            gridRow:"span 3"}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#BD65E8",
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
            diciendo "Jose revisó esto" cuando quien revisó fue Tina.
            El LO ve el estado; el detalle vive en PROCESAMIENTO. */}
        {tab==="file" && !inPrep && !isReferredOut && (
          <div style={{background:"rgba(126,200,164,.04)",border:"1px solid #7EC8A433",
            borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:9}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-4)",
                color:"#7EC8A4",letterSpacing:"1px"}}>{TX("procStatus")}</span>
              <span style={{marginLeft:"auto",fontSize:"var(--fs-1)",
                color:"var(--t4)"}}>{TX("procReadOnly")}</span>
            </div>

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
                  <span style={{color:color||"var(--t2)",fontFamily:"DM Mono",flex:1}}>{valor}</span>
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
                style={{marginTop:2,width:"100%",background:"#21262D",
                  color:chkBusy?"var(--t4)":"var(--t2)",borderRadius:5,padding:"9px 0",
                  fontFamily:"DM Mono",fontSize:"var(--fs-2)",border:"1px solid #30363D",
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
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#4A90D9",letterSpacing:"1px"}}>
                {TX("compliance")}
              </span>
              <span style={{marginLeft:"auto",fontSize:"var(--fs-2)",
                color:docsDone({compliance:compDraft})===PAYROLL_DOCS.length&&chkDraft?"#7EC8A4":"var(--t2)"}}>
                {TX("docsOf",{a:docsDone({compliance:compDraft}),b:PAYROLL_DOCS.length})}
              </span>
            </div>

            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:"var(--fs-3)",
              color:chkDraft?"#7EC8A4":"var(--t1)",cursor:"pointer"}}>
              <input type="checkbox" checked={chkDraft} onChange={e=>setChkDraft(e.target.checked)}
                style={{accentColor:"#7EC8A4",cursor:"pointer"}}/>
              {TX("checkReceived")}
            </label>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:-4,marginLeft:21}}>{TX("checkWhere")}</div>

            <div style={{borderTop:"1px solid #21262D",paddingTop:8}}>
              {PAYROLL_DOCS.map(d=>(
                <label key={d.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:"var(--fs-3)",
                  color:compDraft[d.id]?"#7EC8A4":"var(--t2)",cursor:"pointer",marginBottom:5}}>
                  <input type="checkbox" checked={!!compDraft[d.id]}
                    onChange={e=>setCompDraft({...compDraft,[d.id]:e.target.checked})}
                    style={{accentColor:"#7EC8A4",cursor:"pointer"}}/>
                  {P(d)}
                </label>
              ))}
            </div>
            <div className="sys">{TX("complianceHint")}</div>
          </div>
        )}

        {/* CONTINGENCIES — captured at Full Application, anchored to the contract */}
        {tab==="dates" && !inPrep && !isReferredOut && (atOrPastFullApp(stage) || hasContingencies(file)) && (
          <div style={{gridColumn:"1/-1"}}>
            <ContingencyPanel file={file} profile={profile} onSave={onSave}
              onDraft={p=>{panelDrafts.current.dates=p;}}/>
          </div>
        )}

        {/* INBOUND REFERRAL SECTION — when file came from another banker */}
        {tab==="loan" && isInbound && (
          <div style={{background:"rgba(255,209,102,.06)",border:"1px solid #FFD16644",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#FFD166",letterSpacing:"1px"}}>🤝 INBOUND — REFERRING BANKER</span>
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
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"#FFD166",fontSize:"var(--fs-3)",fontFamily:"DM Mono",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {inBankerEmail && (
                  <a href={`mailto:${inBankerEmail}`}
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"#FFD166",fontSize:"var(--fs-3)",fontFamily:"DM Mono",textDecoration:"none"}}>
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
              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#7EC8A4",letterSpacing:"1px"}}>⏸ IN PREPARATION</div>
              <div style={{fontSize:"var(--fs-4)",color:"var(--t1)"}}>{r.label}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>
                Review {p.reviewOn||"—"} · <span style={{color:dtr<=0?"#E85D75":"var(--t3)"}}>{dtr>0?`in ${dtr}d`:dtr===0?"today":`${Math.abs(dtr)}d overdue`}</span>
              </div>
              <div style={{fontSize:"var(--fs-3)",color:locked?"#E85D75":"var(--t3)"}}>
                {age}d in preparation / {PREP_MAX_DAYS} max{p.reschedules>0?` · rescheduled ${p.reschedules}×`:""}
              </div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>Returns to: <span style={{color:"var(--t2)"}}>{p.prevStage||"Lead Inquiry"}</span></div>
              {p.note&&<div style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontStyle:"italic",borderTop:"1px solid #21262D",paddingTop:7}}>{p.note}</div>}
            </div>
          );
        })()}

        {/* OUTBOUND REFERRAL SECTION — when stage = REFERRED OUT */}
        {tab==="loan" && isReferredOut && (
          <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #A78BFA44",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#A78BFA",letterSpacing:"1px"}}>🔀 OUTBOUND — RECEIVING BANKER</span>
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
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"#A78BFA",fontSize:"var(--fs-3)",fontFamily:"DM Mono",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {outBankerEmail && (
                  <a href={`mailto:${outBankerEmail}`}
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"#A78BFA",fontSize:"var(--fs-3)",fontFamily:"DM Mono",textDecoration:"none"}}>
                    ✉ Email banker
                  </a>
                )}
              </div>
            )}
            {/* Live fee calc — admin only */}
            {isAdmin && outStatus === "Closed (Funded)" && (
              <div style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:6,padding:12,marginTop:4}}>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:8}}>COMP CALCULATION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>FEE EARNED ({REFERRAL_FEE_BPS} BPS)</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#F5A623"}}>${feeEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>WOULD HAVE ({parseInt(bps)||BPS_RATE} BPS)</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t2)"}}>${wouldHaveEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>LOST COMP</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#E85D75"}}>${lostComp.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="dates" && (isClosed && isAdmin ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(6,214,160,.06)",border:"1px solid #06D6A044",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"#06D6A0",letterSpacing:"1px",marginBottom:5,fontWeight:500}}>ACTUAL CLOSE DATE <span style={{color:"var(--t3)"}}>· editable</span></div>
              <input type="date" value={closedAt} onChange={e=>setClosedAt(e.target.value)}
                style={{background:"transparent",border:"none",color:"#06D6A0",fontSize:"var(--fs-5)",fontFamily:"DM Mono",width:"100%",fontWeight:500}}/>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>The month this counts toward production</div>
            </div>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:"var(--fs-5)",fontFamily:"DM Mono",width:"100%"}}/>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>Original target date</div>
            </div>
          </div>
        ) : !isReferredOut ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>{L("closingDate")}</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"var(--t1)",fontSize:"var(--fs-5)",fontFamily:"DM Mono",width:"100%"}}/>
            </div>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{isClosed ? "CLOSED" : "DAYS IN STAGE"}</div>
              {/* Syne's zero is indistinguishable from a lowercase o at this
                  size — "0d" rendered as "od". Numbers go in DM Mono, which
                  is what the rest of the app already uses for data. */}
              <div style={{fontSize:isClosed?"var(--fs-6)":"var(--fs-10)",
                fontFamily:isClosed?"Syne":"'IBM Plex Sans',system-ui,-apple-system,sans-serif",
                fontWeight:isClosed?800:500,letterSpacing:isClosed?0:"-0.5px",
                color:isClosed?"#06D6A0":(stageUrgency(file).level==="late"?"#E85D75":stageUrgency(file).level==="watch"?"#F5A623":"var(--t1)")}}>
                {isClosed ? file.closedAt : (
                  daysInStage(file)===null ? "—" : <>
                    {daysInStage(file)}
                    <span style={{fontSize:"var(--fs-5)",color:"var(--t3)",marginLeft:1}}>d</span>
                  </>
                )}
              </div>
              {!isClosed && (()=>{ const c=stageClock(file.stage,file); return (
                <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:4,letterSpacing:"0.5px"}}>
                  {c ? `target ${c.warn}d · ceiling ${c.late}d` : ""}
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
              NOTES <span style={{color:"var(--t4)"}}>· STATUS · BLOCKER · NEXT</span>
            </div>
            <div style={{
              fontSize:"var(--fs-2)",
              color: newNote.length > 200 ? "#E85D75" : newNote.length > 100 ? "#F5A623" : "var(--t3)",
              fontFamily:"DM Mono",
              letterSpacing:"0.5px"
            }}>
              {newNote.length}{newNote.length > 200 ? " · "+L("tooLong") : newNote.length > 100 ? " · "+L("keepShort") : ""}
            </div>
          </div>
          <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} rows={2}
            placeholder={isReferredOut ? L("noteFromBanker") : L("notePlaceholder")}
            style={{background:"#0D1117",border:`1px solid ${newNote.length>200?"#E85D75":"#30363D"}`,borderRadius:6,color:"var(--t1)",padding:"8px 10px",fontSize:"var(--fs-4)",fontFamily:"DM Mono",width:"100%",resize:"none"}}/>
          <button className="hov" disabled={!newNote.trim()}
            onClick={()=>{ onSave({noteLog:addNoteEntry(file,newNote,profile?.name||null,file.stage).noteLog}); setNewNote(""); }}
            style={{marginTop:6,width:"100%",background:newNote.trim()?"rgba(126,200,164,.1)":"#161B22",
              color:newNote.trim()?"#7EC8A4":"#30363D",borderRadius:6,padding:"7px 0",fontFamily:"DM Mono",
              fontSize:"var(--fs-3)",border:`1px solid ${newNote.trim()?"#7EC8A4":"#21262D"}`,
              cursor:newNote.trim()?"pointer":"not-allowed"}}>{L("addUpdate")}</button>

          {entries.length>0&&(
            <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
              {(showAllNotes?entries:entries.slice(0,2)).map((n,i)=>(
                <div key={i} style={{borderLeft:`2px solid ${i===0?"#7EC8A4":"#21262D"}`,paddingLeft:9}}>
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
                  style={{background:"transparent",border:"none",color:"#4A90D9",fontSize:"var(--fs-2)",
                    fontFamily:"DM Mono",cursor:"pointer",padding:0,textAlign:"left"}}>
                  {showAllNotes?L("seeLast2"):L("seeAll",{n:entries.length})}
                </button>
              )}
            </div>
          )}
          <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginTop:6,letterSpacing:"0.5px"}}>
            {L("noteHint")}
          </div>
          <div style={{fontSize:"var(--fs-1)",color:"#F5A623",marginTop:3,letterSpacing:"0.5px"}}>
            {L("notesEnglishOnly")}
          </div>
        </div>

        {tab==="file" && (file.lastEditedBy || (file.history && file.history.length > 0)) && (
          <div style={{background:"#0D1117",borderRadius:8,padding:12,border:"1px solid #21262D"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{L("activity")}</div>
              <button onClick={()=>setShowHistory(s=>!s)}
                style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:"var(--fs-2)",fontFamily:"DM Mono",cursor:"pointer",letterSpacing:"1px"}}>
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
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #21262D",display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {[...file.history].reverse().map((h,i)=>(
                  <div key={i} style={{fontSize:"var(--fs-3)",color:"var(--t2)",display:"flex",gap:8}}>
                    <span style={{color:"var(--t3)",minWidth:75,fontSize:"var(--fs-2)"}}>{timeAgo(h.at)}</span>
                    <span style={{color:"var(--t1)",fontWeight:500,minWidth:90}}>{h.name?.split(" ")[0] || "?"}</span>
                    <span style={{flex:1}}>
                      {h.action==="created" && "created file"}
                      {h.action==="edited" && `edited ${h.fields?.join(", ") || "fields"}`}
                      {h.action==="stage_advanced" && <>advanced to <span style={{color:"#F5A623"}}>{h.to}</span></>}
                      {h.action==="closed" && <span style={{color:"#06D6A0"}}>marked as closed</span>}
                      {h.action==="reopened" && <span style={{color:"#F5A623"}}>reopened file</span>}
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
        <div style={{padding:"11px 22px",borderTop:"1px solid #21262D",background:"#10141A",
          flexShrink:0,display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
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
                    padding:"8px 14px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",
                    cursor:"pointer",whiteSpace:"nowrap"}}>{label}</button>
              );
            };

            return (<>
              <button className="hov" onClick={salvar}
                style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 22px",
                  fontFamily:"DM Mono",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                {L("save")}
              </button>

              {archivedFile?(
                btn("restore",TX("restoreBtn"),"#7EC8A4",onRestore,{on:true})
              ):isClosed?(
                btn("reopen",TX("reopenBtn"),"var(--t2)",onReopen,{on:true})
              ):isReferredOut?(
                btn("pull",TX("pullBack"),"#A78BFA",()=>{
                  if(confirm(TX("pullBackAsk",{n:file.borrower}))){
                    onSave(stagePatch(file, "Lead Inquiry", {referredOut:null}));
                    onClose();
                  }
                },{on:true})
              ):inPrep?(<>
                {btn("continue",TX("continueBtn"),"#4A90D9",onContinuePrep,{on:true})}
                {btn("resched",TX("reschedBtn"),"#F5A623",onPrep,{on:!prepLocked(file),
                  why_es:`Pasó el tope de ${PREP_MAX_DAYS} días — devuélvelo o archívalo`,
                  why_en:`Past the ${PREP_MAX_DAYS}-day cap — return it or archive it`})}
                {btn("arch",TX("archBtn"),"var(--t2)",onArchive,{on:true})}
              </>):(<>
                {btn("advance",L("advance")+" →","var(--t2)",onAdvance,A.advance)}
                {btn("close",L("closeFile")+" ✓","#06D6A0",
                  ()=>{if(confirm(TX("closeAsk",{n:file.borrower})))onCloseFile();},A.close)}
                {btn("refer",TX("referBtn"),"#A78BFA",()=>{
                  if(confirm(TX("referAsk",{n:file.borrower}))){
                    setStage(REFERRED_OUT_STAGE);
                    onSave(stagePatch(file, REFERRED_OUT_STAGE));
                  }
                },A.refer)}
                {btn("prep",TX("prepBtn"),"#7EC8A4",onPrep,A.prep)}
                {btn("arch",TX("archBtn"),"var(--t2)",onArchive,A.archive)}
              </>)}

              <div style={{flex:1,minWidth:12}}/>

              {/* IDIOMA — el toggle vivia solo en la barra principal, que
                  el archivo tapa por completo. Martha y Tina abrian su
                  cola y no tenian como cambiarlo sin cerrar todo.
                  Cambia la preferencia de quien lo toca, no del archivo:
                  un archivo en ingles y el siguiente en espanol confunde
                  mas de lo que ayuda. */}
              {onSetLang&&(
                <div style={{display:"flex",border:"1px solid #30363D",borderRadius:6,overflow:"hidden"}}>
                  {["es","en"].map(l=>(
                    <button key={l} className="hov" onClick={()=>onSetLang(l)}
                      title={TX("langHint")}
                      style={{background:lang===l?"#F5A623":"transparent",
                        color:lang===l?"#0D1117":"var(--t2)",border:"none",padding:"7px 11px",
                        fontSize:"var(--fs-2)",fontFamily:"DM Mono",cursor:"pointer"}}>
                      {l.toUpperCase()}
                    </button>))}
                </div>
              )}

              {isAdmin&&(<>
                <div style={{width:1,height:22,background:"#21262D",margin:"0 4px"}}/>
                <button className="hov"
                  onClick={()=>{if(confirm(TX("deleteAsk")))onDelete();}}
                  title={TX("deleteHint")}
                  style={{background:"transparent",color:"#E85D75",border:"none",borderRadius:6,
                    padding:"8px 14px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",cursor:"pointer"}}>
                  {TX("delBtn")}
                </button>
              </>)}
            </>);
          })()}
        </div>
      </div>
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

function AddModal({profile, onClose, onAdd, existingFiles}){
  const [borrower,setBorrower]=useState("");
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
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",flexShrink:0}}>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)"}}>NEW FILE</div>
          {isAssistant && (
            <div style={{fontSize:"var(--fs-3)",color:"#F5A623",marginTop:4,letterSpacing:"0.5px"}}>
              ⚠ Assistant view — please confirm the LOAN OFFICER below before adding.
            </div>
          )}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:14}}>

          {/* INBOUND REFERRAL TOGGLE — at top so it's visible */}
          <label style={{
            display:"flex",alignItems:"center",gap:10,
            background: isInbound ? "rgba(255,209,102,.08)" : "#0D1117",
            border: isInbound ? "1px solid #FFD16655" : "1px solid #21262D",
            borderRadius:8, padding:"10px 12px", cursor:"pointer"
          }}>
            <input type="checkbox" checked={isInbound} onChange={e=>setIsInbound(e.target.checked)}
              style={{accentColor:"#FFD166",width:16,height:16,cursor:"pointer"}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:"var(--fs-4)",color: isInbound ? "#FFD166" : "var(--t1)",fontFamily:"Syne",fontWeight:700,letterSpacing:"0.5px"}}>
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
              <div style={{fontSize:"var(--fs-3)",color:"#FFD166",fontFamily:"Syne",fontWeight:700,letterSpacing:"1px",marginBottom:2}}>REFERRING BANKER</div>
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
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
                  <input type="tel" value={inBankerPhone} onChange={e=>setInBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
                  <input type="email" value={inBankerEmail} onChange={e=>setInBankerEmail(e.target.value)} placeholder="banker@company.com" style={IS}/>
                </div>
              </div>
            </div>
          )}

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>BORROWER NAME *</div>
            <input value={borrower} onChange={e=>setBorrower(e.target.value)} placeholder="Full legal name" style={IS} autoFocus/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={IS}/>
            </div>
            <div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="borrower@email.com" style={IS}/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>LOAN AMOUNT</div>
              <input value={loan} onChange={e=>setLoan(e.target.value)} placeholder="350000" style={IS}/>
            </div>
            <div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>LOAN TYPE</div>
              <select value={type} onChange={e=>setType(e.target.value)} style={IS}>
                {LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>STARTING STAGE</div>
            <select value={stage} onChange={e=>setStage(e.target.value)} style={IS}>
              {ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
              LOAN OFFICER {isAssistant && <span style={{color:"#F5A623"}}>· assigning on behalf of</span>}
            </div>
            <select value={lo} onChange={e=>setLo(e.target.value)} style={IS}>
              {LO_LIST.map(l=><option key={l.name} value={l.name}>{l.name} · {l.role}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>REFERRAL PARTNER</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)} placeholder="Agent name, CPA, Smart Bee, walk-in..." style={IS}/>
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
            <input type="date" value={closing} onChange={e=>setClosing(e.target.value)} style={IS}/>
          </div>

          <div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:5}}>
              NOTES <span style={{color:"var(--t4)"}}>· STATUS · BLOCKER · NEXT</span>
            </div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Subm 4/12 · UW queue · review by 4/15" style={IS}/>
          </div>

        </div>

        <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8}}>
          <button className="hov" onClick={()=>{
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
            };
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
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:"pointer"}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function HelpModal({profile, onClose}){
  // El contenido vive en helpContent.js. Los números que también conoce el
  // motor se le pasan desde aquí, así la guía no puede quedar desfasada.
  const [lang,setLang]=useState("es");
  const [secId,setSecId]=useState("start");
  const [q,setQ]=useState("");
  const sections=helpSections({
    stages:LO_STAGES, thresholds:STAGE_THRESHOLDS, inHousePoints:IN_HOUSE_REDUCTION,
  });
  const T=o=>typeof o==="object"&&o?(o[lang]??o.es??o.en??""):o;
  const hits=searchHelp(sections,q,lang);
  const sec=sections.find(x=>x.id===secId)||sections[0];
  const shown=hits?hits.map(h=>h.article):sec.articles;

  const TONE={gold:["#F5A623","rgba(245,166,35,.08)"],green:["#7EC8A4","rgba(126,200,164,.07)"],
              red:["#E85D75","rgba(232,93,117,.08)"],blue:["#4A90D9","rgba(74,144,217,.08)"]};

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
            <span style={{color:"#F5A623",fontFamily:"DM Mono",flexShrink:0}}>{i+1}</span><span>{x}</span>
          </div>))}
      </div>);
    if(k==="table") return (
      <table key={bi} style={{width:"100%",borderCollapse:"collapse",margin:"0 0 12px",fontSize:"var(--fs-4)"}}>
        <thead><tr>{(b.head[lang]||b.head.es).map((h,i)=>(
          <th key={i} style={{textAlign:"left",padding:"7px 10px",background:"#0D1117",color:"var(--t3)",
            fontSize:"var(--fs-2)",letterSpacing:"1px",fontWeight:500,borderBottom:"1px solid #30363D"}}>{h}</th>))}</tr></thead>
        <tbody>{b.rows.map((r,i)=>(
          <tr key={i}>{r.map((cell,j)=>(
            <td key={j} style={{padding:"8px 10px",borderBottom:"1px solid #21262D",
              color:j===0?"var(--t1)":"var(--t2)"}}>{T(cell)}</td>))}</tr>))}</tbody>
      </table>);
    if(k==="kv") return (
      <div key={bi} style={{margin:"0 0 10px"}}>
        {b.rows.map((r,i)=>(
          <div key={i} style={{borderTop:"1px solid #21262D",padding:"9px 0"}}>
            <div style={{fontSize:"var(--fs-4)",color:"var(--t1)",marginBottom:2}}>{T(r[0])}</div>
            <div style={{fontSize:"var(--fs-4)",color:"var(--t2)",lineHeight:1.65}}>{T(r[1])}</div>
          </div>))}
      </div>);
    return null;
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"#161B22",
        border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:880,
        maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

        <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #21262D",display:"flex",
          justifyContent:"space-between",alignItems:"flex-start",gap:12,flexShrink:0}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--t1)",letterSpacing:"-0.5px"}}>
              {TX("guideTitle")}
            </div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t3)",letterSpacing:"1px",marginTop:3}}>
              DEL VALLE LENDING CO. · BARRETT FINANCIAL GROUP · NMLS 181106
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",border:"1px solid #30363D",borderRadius:6,overflow:"hidden"}}>
              {["es","en"].map(l=>(
                <button key={l} className="hov" onClick={()=>setLang(l)}
                  style={{background:lang===l?"#F5A623":"transparent",color:lang===l?"#0D1117":"var(--t2)",
                    border:"none",padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",cursor:"pointer"}}>
                  {l.toUpperCase()}
                </button>))}
            </div>
            <button onClick={onClose} style={{background:"transparent",border:"none",color:"var(--t3)",
              fontSize:"var(--fs-8)",cursor:"pointer",padding:"0 0 0 4px"}}>✕</button>
          </div>
        </div>

        <div style={{padding:"11px 22px",borderBottom:"1px solid #21262D",background:"#0D1117",
          display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",flexShrink:0,
          maxHeight:120,overflowY:"auto"}}>
          <input value={q} onChange={e=>setQ(e.target.value)}
            placeholder={TX("searchGuide")}
            style={{background:"#161B22",border:"1px solid #30363D",borderRadius:6,color:"var(--t1)",
              padding:"6px 10px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",flex:"1 1 200px",minWidth:150}}/>
          {!hits&&sections.map(x=>(
            <button key={x.id} className="hov" onClick={()=>setSecId(x.id)}
              style={{background:secId===x.id?x.color:"var(--t4)",color:secId===x.id?"#0D1117":"var(--t2)",
                borderRadius:6,padding:"5px 10px",fontSize:"var(--fs-3)",fontFamily:"DM Mono",fontWeight:500,
                border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>
              {x.icon} {T(x)}
            </button>))}
          {hits&&(
            <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",fontFamily:"DM Mono"}}>
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
              borderBottom:i<shown.length-1?"1px solid #21262D":"none"}}>
              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",marginBottom:10}}>
                {T(a)}
              </div>
              {(a.blocks||[]).map((b,j)=>block(b,j))}
            </div>))}
        </div>

        <div style={{padding:"10px 22px",borderTop:"1px solid #21262D",background:"#0D1117",
          fontSize:"var(--fs-2)",color:"var(--t3)",flexShrink:0}}>
          {TX("guideLive")}
        </div>
      </div>
    </div>
  );
}

function _HelpModalLegacy({profile, onClose}){
  const [tab, setTab] = useState("notes");
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  const isAssistant = profile?.role === "assistant";

  const tabs = [
    {id:"notes", label:"📝 Notes Format", color:"#F5A623"},
    {id:"abbrev", label:"📖 Abbreviations", color:"#4A90D9"},
    {id:"workflow", label:"🔄 Daily Workflow", color:"#06D6A0"},
    {id:"refs", label:"🏦 Bank Referrals", color:"#A78BFA"},
    {id:"roles", label:"👥 Roles & Access", color:"#BD65E8"},
    {id:"faq", label:"❓ FAQ", color:"#E85D75"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:720,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--t1)",letterSpacing:"-0.5px"}}>HELP & BEST PRACTICES</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t3)",letterSpacing:"1px",marginTop:3}}>PIPELINE · DEL VALLE LENDING CO. · BARRETT FINANCIAL GROUP</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"var(--t3)",fontSize:"var(--fs-9)",cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
        </div>

        <div style={{padding:"12px 24px",borderBottom:"1px solid #21262D",display:"flex",gap:6,flexWrap:"wrap",flexShrink:0,background:"#0D1117"}}>
          {tabs.map(t=>(
            <button key={t.id} className="hov" onClick={()=>setTab(t.id)}
              style={{
                background: tab===t.id ? t.color : "#21262D",
                color: tab===t.id ? "#0D1117" : "var(--t2)",
                borderRadius:6, padding:"6px 12px", fontSize:"var(--fs-3)", fontFamily:"DM Mono", fontWeight:500,
                border:"none", cursor:"pointer"
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {tab==="notes" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:"var(--fs-5)",color:"var(--t1)",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-7)",color:"#F5A623",marginBottom:8}}>The STATUS · BLOCKER · NEXT format</div>
                <div style={{color:"var(--t2)"}}>
                  Every loan note follows three short pieces, separated by the <span style={{color:"#F5A623"}}>·</span> character.
                  Goal: anyone scanning the pipeline can understand a file in 3 seconds.
                </div>
              </div>
              <div style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:8,padding:14}}>
                <div style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:10,fontSize:"var(--fs-4)"}}>
                  <div style={{color:"#F5A623",fontWeight:500}}>STATUS</div>
                  <div style={{color:"var(--t2)"}}>One phrase about where the file substantively is right now (not just the stage name).</div>
                  <div style={{color:"#F5A623",fontWeight:500}}>BLOCKER</div>
                  <div style={{color:"var(--t2)"}}>The single thing holding it up. If clean, write "<span style={{color:"#06D6A0"}}>none</span>" or "<span style={{color:"#06D6A0"}}>clean</span>".</div>
                  <div style={{color:"#F5A623",fontWeight:500}}>NEXT</div>
                  <div style={{color:"var(--t2)"}}>The immediate next action — what + who + by when.</div>
                </div>
              </div>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",marginBottom:10}}>EXAMPLES BY STAGE</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {stage:"Submitted to UW", note:"Subm 4/12 · UW queue · review by 4/15"},
                    {stage:"Conditional Approval", note:"CA 4/14 · 3 conds (PS, VOE, GL) · Bo upload by 4/19"},
                    {stage:"Condition Clearing", note:"Conds in · BS rejected (stale) · Maria reupload by 4/18"},
                    {stage:"Clear to Close", note:"CTC 4/17 · title prelim pending · COE 4/25"},
                  ].map(ex=>(
                    <div key={ex.stage} style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,padding:"8px 12px",background:"#0D1117",borderRadius:6,fontSize:"var(--fs-4)",alignItems:"center"}}>
                      <div style={{color:"var(--t3)",fontSize:"var(--fs-2)",letterSpacing:"1px"}}>{ex.stage.toUpperCase()}</div>
                      <div style={{color:"#06D6A0",fontFamily:"DM Mono"}}>{ex.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="abbrev" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:"var(--fs-5)",color:"var(--t1)"}}>
              <div style={{color:"var(--t2)",lineHeight:1.6}}>
                Standard abbreviations everyone on the team uses. Stick to these so notes stay scannable and consistent.
              </div>
              {[
                {title:"Documents", color:"#4A90D9", items:[
                  ["PS","Paystubs"],["W2","W-2 forms"],["BS","Bank statements"],["TR","Tax returns"],
                  ["VOE","Verification of Employment"],["VOR","Verification of Rent"],["VOD","Verification of Deposit"],
                  ["GL","Gift letter"],["TC","Title commitment"],["HOI","Homeowner's insurance"],
                  ["CD","Closing disclosure"],["LE","Loan estimate"],["AppR","Appraisal report"],
                ]},
                {title:"Stages & Actions", color:"#F5A623", items:[
                  ["Subm","Submitted"],["CA","Conditional Approval"],["CTC","Clear to Close"],
                  ["COE","Close of Escrow / closing date"],["Reissue","Reissue disclosures"],
                  ["Locked","Rate locked"],["Floating","Rate floating"],
                  ["UW","Underwriting / Underwriter"],["Conds","Conditions"],
                ]},
                {title:"People", color:"#BD65E8", items:[
                  ["LO","Loan Officer"],["LP","Loan Processor"],["TC","Title Coordinator"],
                  ["UW","Underwriter"],["Bo","Borrower"],["CB","Co-borrower"],
                  ["RA","Real estate agent"],
                ]},
              ].map(group=>(
                <div key={group.title}>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:group.color,marginBottom:8,letterSpacing:"1px"}}>{group.title.toUpperCase()}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
                    {group.items.map(([abbr,full])=>(
                      <div key={abbr} style={{display:"flex",gap:10,padding:"6px 10px",background:"#0D1117",borderRadius:5,fontSize:"var(--fs-4)",alignItems:"center"}}>
                        <span style={{color:group.color,fontFamily:"DM Mono",fontWeight:500,minWidth:55}}>{abbr}</span>
                        <span style={{color:"var(--t2)"}}>{full}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==="workflow" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:"var(--fs-5)",color:"var(--t1)",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-7)",color:"#06D6A0",marginBottom:8}}>Daily morning routine (5 min)</div>
                <ol style={{color:"var(--t2)",paddingLeft:18,lineHeight:1.8}}>
                  <li>Open the pipeline. Check the <strong style={{color:"#E85D75"}}>CRITICAL</strong> count at the top — files closing in ≤3 days.</li>
                  <li>Check phase tabs (PQ, HH, PR, UW, CP, CL, PC) — any phase with too many files in <strong style={{color:"#F5A623"}}>STALE</strong> status (5d+) needs attention.</li>
                  <li>Click any file showing CRITICAL or STALE → read its note → decide today's action.</li>
                  <li>Update notes for any file you touched yesterday so today's note reflects current state.</li>
                </ol>
              </div>
            </div>
          )}

          {tab==="refs" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:"var(--fs-5)",color:"var(--t1)",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-7)",color:"#A78BFA",marginBottom:8}}>🏦 Bank-to-Bank Referrals</div>
                <div style={{color:"var(--t2)"}}>
                  When the branch can't place a file (product, credit, niche), refer it out to another banker and track everything.
                  When other bankers send you deals, tag the inbound so you can measure reciprocity at year end.
                </div>
              </div>

              <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #A78BFA44",borderRadius:8,padding:14}}>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#A78BFA",marginBottom:8}}>🔀 Outbound — Referring a file OUT</div>
                <ol style={{color:"var(--t2)",paddingLeft:18,lineHeight:1.8,fontSize:"var(--fs-4)"}}>
                  <li>Open the file → change STAGE to <strong style={{color:"#A78BFA"}}>REFERRED OUT — EXTERNAL BANK</strong></li>
                  <li>Fill in the receiving banker's name, company, phone, and email</li>
                  <li>Select a REFERRAL REASON (credit, product, property type, etc.)</li>
                  <li>Set STATUS to "Pending at Banker" while you wait for outcome</li>
                  <li>Once the deal closes, update STATUS to "Closed (Funded)" + enter FINAL LOAN AMOUNT at banker + CLOSE DATE</li>
                  <li>Your <strong style={{color:"#F5A623"}}>{REFERRAL_FEE_BPS} bps referral fee</strong> auto-calculates. Lost comp shows alongside.</li>
                </ol>
              </div>

              <div style={{background:"rgba(255,209,102,.06)",border:"1px solid #FFD16644",borderRadius:8,padding:14}}>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"#FFD166",marginBottom:8}}>🤝 Inbound — A banker sends YOU a file</div>
                <ol style={{color:"var(--t2)",paddingLeft:18,lineHeight:1.8,fontSize:"var(--fs-4)"}}>
                  <li>Click <strong style={{color:"#F5A623"}}>+ NEW FILE</strong> as usual</li>
                  <li>At the top, check the box <strong style={{color:"#FFD166"}}>"This is an inbound referral from another banker"</strong></li>
                  <li>Fill in the referring banker's name, company, phone, and email</li>
                  <li>Continue with normal borrower info → ADD TO PIPELINE</li>
                  <li>The file lives in <strong style={{color:"#FFD166"}}>🤝 INBOUND</strong> tab + the normal pipeline (it has a 🤝 badge on its card)</li>
                  <li>Process and close normally — you earn your full comp on inbound closed deals</li>
                </ol>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--t1)",marginBottom:8}}>Year-end view</div>
                <div style={{color:"var(--t2)",fontSize:"var(--fs-4)",lineHeight:1.7}}>
                  Production → <strong style={{color:"#F5A623"}}>🏦 BANK REFERRALS</strong> tab shows:
                </div>
                <ul style={{color:"var(--t2)",paddingLeft:18,lineHeight:1.8,fontSize:"var(--fs-4)",marginTop:6}}>
                  <li>Outbound totals: # sent out, $ fees earned, $ lost comp</li>
                  <li>Inbound totals: # received, $ closed, $ comp earned</li>
                  <li>Reciprocity table: per-banker balance (who's sending who what)</li>
                  <li>Year-end comp impact summary (admin only)</li>
                </ul>
              </div>
            </div>
          )}

          {tab==="roles" && (
            <div style={{display:"flex",flexDirection:"column",gap:16,fontSize:"var(--fs-5)",color:"var(--t1)",lineHeight:1.6}}>
              <div style={{color:"var(--t2)"}}>
                You are signed in as <strong style={{color:profile.color}}>{profile.name}</strong> with role <strong style={{color:profile.color,textTransform:"uppercase"}}>{profile.role}</strong>.
              </div>
              {[
                {role:"Admin", color:"#4A90D9", who:"Jose Del Valle (Branch Manager)", can:[
                  "Create, edit, advance, close, reopen, and DELETE any file",
                  "See the OVERRIDE & COMP dashboard (reparto Barrett por % del NET, cortes del 1 y el 15)",
                  "Set the gross bps and the per-file adjustments that produce the NET",
                  "Restore the entire pipeline from a backup file",
                  "View the My Personal LO Comp report",
                  "See all LOs' production data on the Team Production tab",
                  "See the year-end LOST COMP from outbound bank referrals",
                ]},
                {role:"LO (Loan Officer)", color:"#BD65E8", who:"Ana M Plasencia, Marelis Pinales", can:[
                  "Create, edit, advance, and close any file in the branch",
                  "See the FULL pipeline (all LOs' files visible for collaboration)",
                  "View MY COMP tab — your personal commission breakdown for closed files",
                  "Track bank referrals (outbound + inbound)",
                  "Cannot see other LOs' personal comp",
                  "Cannot edit BPS rates (set by admin)",
                ]},
                {role:"Assistant", color:"#F5A623", who:"Laura de Armas", can:[
                  "Create, edit, and advance files",
                  "Update notes, closing dates, stage progression",
                  "See the full pipeline and team production stats (counts/volume)",
                  "Cannot see ANY compensation data (BPS, override, personal comp, referral fee detail)",
                  "Cannot delete files",
                ]},
              ].map(r=>(
                <div key={r.role} style={{
                  background: profile.role.toLowerCase() === r.role.split(" ")[0].toLowerCase() ? `${r.color}15` : "#0D1117",
                  border: `1px solid ${profile.role.toLowerCase() === r.role.split(" ")[0].toLowerCase() ? r.color : "#21262D"}`,
                  borderRadius:8, padding:14
                }}>
                  <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:6}}>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-6)",color:r.color}}>{r.role.toUpperCase()}</div>
                    <div style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{r.who}</div>
                  </div>
                  <ul style={{color:"var(--t2)",paddingLeft:18,lineHeight:1.7,fontSize:"var(--fs-4)"}}>
                    {r.can.map((c,i)=><li key={i}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab==="faq" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,fontSize:"var(--fs-5)",color:"var(--t1)"}}>
              {[
                {q:"How do I refer a file out to another banker?",
                 a:"Open the file → change STAGE to 'REFERRED OUT — EXTERNAL BANK' (the last option in the stage dropdown). A purple banker info section appears. Fill in banker name, company, phone, email, reason, and status. Save."},
                {q:"How do I track an inbound referral from a banker?",
                 a:"Click '+ NEW FILE'. At the top, check 'This is an inbound referral from another banker'. Fill in the referring banker's info. Add the borrower normally. The file gets a 🤝 badge in the pipeline and shows up under the 🤝 INBOUND tab."},
                {q:"How does the 50 bps referral fee calculate?",
                 a:"When you mark a referred-out file as 'Closed (Funded)' and enter the final loan amount at the banker, the system auto-calculates 50 bps × that loan amount. You'll see this on the BANK REFERRALS dashboard."},
                {q:"What does 'lost comp' mean on the dashboard?",
                 a:"For each referred-out closed deal: lost comp = (your normal bps × loan) − (50 bps referral fee). It shows what you would have earned closing it in house. Use it to decide which products are worth adding."},
                {q:"What's the difference between Referral Partner and Bank Referral?",
                 a:"Referral Partner = the source who sent you the borrower (Smart Bee client, agent, CPA, family member). Tracked on the existing REFERRAL PARTNERS tab. Bank Referral = formal bank-to-bank deal flow with another mortgage banker. Tracked on the new BANK REFERRALS tab. Both can coexist on the same file."},
                {q:"I made a change but don't see SAVED — did it save?",
                 a:"Watch the top-right corner of the header. You'll see ● SAVING… briefly, then ✓ SAVED in green for 2 seconds."},
                {q:"I forgot my password.",
                 a:"On the login screen, type your email, then click FORGOT? next to the password label. Click SEND RESET LINK."},
              ].map((item,i)=>(
                <div key={i} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:8,padding:14}}>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:"var(--fs-5)",color:"#E85D75",marginBottom:6}}>Q: {item.q}</div>
                  <div style={{color:"var(--t2)",fontSize:"var(--fs-4)",lineHeight:1.6}}>{item.a}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        <div style={{padding:"12px 24px",borderTop:"1px solid #21262D",background:"#0D1117",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>
            v2.1 · DEL VALLE LENDING CO. · BANK REFERRALS
          </div>
          <button onClick={onClose} className="hov"
            style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 18px",fontFamily:"DM Mono",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
            GOT IT ✓
          </button>
        </div>

      </div>
    </div>
  );
}
