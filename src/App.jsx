import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import {
  stageUrgency, stageClock, daysInStage, fileAge, stampStage, today,
  daysBetween, addDays as addDaysISO,
  // ─── 2B-1 contingencies ───
  CONTINGENCIES, CONTINGENCY_OUTCOMES, CONTRACT_DAY_BASIS,
  contingencyById, outcomeById, allContingencyStatus, contingencyStatus,
  contingencyConflicts, contingencyHeadline, hasContingencies,
  derivedStageDeadlines, upcomingDeadlines, recordContingencyOutcome,
  contingencyExtensionCount, cdIssueDeadline, cdMailDeadline,
  federalHolidayName, contractDaysBetween, isValidISO, okDate,
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
const PIPELINE_DOC = doc(db, "pipeline", "main");

// ─── TEAM ROSTER ───
const TEAM = {
  // Jose has two accounts during the PRMG → Barrett transition. Both point to
  // the same person and the same admin rights. The PRMG one gets disabled in
  // Firebase once the new login is confirmed working.
  "a7gM7SK7GhUuomyL8apuw68PptA2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  "vllTjiE2Aba8CKIC3UWGxMdzBcM2": { name: "Jose Del Valle",     short: "Jose",     role: "admin",     nmls: "2686066", color: "#4A90D9" },
  "iXcEzyc2nTTy2CJirLUz1FJ1oye2": { name: "Ana M Plasencia",    short: "Ana",      role: "lo",        nmls: "2683283", color: "#BD65E8" },
  "0dpbvxe4RZUmCDhm03Zne6JSKE32": { name: "Marelis Pinales",    short: "Marelis",  role: "lo",        nmls: "",        color: "#06D6A0" },
  "Hj0KI0wmGfTHinHxxx8mrdLx5jw2": { name: "Laura de Armas",     short: "Laura",    role: "assistant", nmls: "",        color: "#F5A623" },
};
function getProfile(uid){ return TEAM[uid] || { name:"Unknown User", short:"Unknown", role:"assistant", nmls:"", color:"#8B949E" }; }

const BPS_RATE = 150;
const OVERRIDE_RATE = 0.0025;
const JOSE_LO = "Jose Del Valle";
const EXCLUDED_TYPES = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite",
  "CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)",
  "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
  "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist","CO CHFA FHA Streamline"];

// ─── BANK-TO-BANK REFERRAL CONSTANTS ───
// When a file can't be done at PRMG (product limits, credit, etc.), Jose refers
// it to another banker and earns a referral fee. We also track inbound deals
// where another banker sent us business.
const REFERRED_OUT_STAGE = "REFERRED OUT — EXTERNAL BANK";
const REFERRAL_FEE_BPS = 50; // bps earned on referred-out closed deals
const REFERRAL_REASONS = [
  "Credit Score Too Low",
  "DTI / Income Issue",
  "Product Not Offered at PRMG",
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
function stampEdit(file, profile, action, extra={}){
  const entry = {
    uid: profile.uid,
    name: profile.name,
    action: action,
    at: new Date().toISOString(),
    ...extra,
  };
  const newHistory = [...(file.history||[]), entry].slice(-20);
  return {
    ...file,
    lastEditedBy: { uid: profile.uid, name: profile.name },
    lastEditedAt: entry.at,
    history: newHistory,
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
      alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono','Courier New',monospace", padding:20
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        .shake{animation:shake .5s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn .4s ease;}
        input:focus{outline:none;}
      `}</style>
      <div className="fade" style={{
        background:"#161B22", border:"1px solid #30363D", borderRadius:16,
        padding:"40px 36px", width:"100%", maxWidth:420,
        display:"flex", flexDirection:"column", alignItems:"center", gap:22
      }}>
        <div style={{
          width:56, height:56, borderRadius:"50%",
          background:"linear-gradient(135deg,#C8922A,#F5A623)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"Syne", fontWeight:800, fontSize:22, color:"#0D1117"
        }}>DV</div>

        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Syne", fontWeight:800, fontSize:22, color:"#E6EDF3", letterSpacing:"-0.5px"}}>
            PIPELINE
          </div>
          <div style={{fontSize:11, color:"#484F58", letterSpacing:"2px", marginTop:4}}>
            MORTGAGE BY DELVALLE · PRMG 541-A
          </div>
        </div>

        {resetSent ? (
          <div style={{width:"100%", display:"flex", flexDirection:"column", gap:12, textAlign:"center"}}>
            <div style={{color:"#06D6A0", fontSize:14, lineHeight:1.5}}>
              ✓ Reset email sent to:<br/>
              <strong style={{color:"#E6EDF3"}}>{email}</strong>
            </div>
            <div style={{fontSize:12, color:"#8B949E", lineHeight:1.5}}>
              Check your inbox (and spam folder). Click the link to set a new password, then come back and sign in.
            </div>
            <button onClick={()=>{setResetSent(false);setResetMode(false);setError("");}}
              style={{background:"#21262D", color:"#8B949E", borderRadius:8, padding:"10px 0",
                fontFamily:"DM Mono", fontSize:12, border:"1px solid #30363D", cursor:"pointer", marginTop:4}}>
              ← BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <div className={shake ? "shake" : ""} style={{width:"100%", display:"flex", flexDirection:"column", gap:14}}>
            <div>
              <div style={{fontSize:11, color:"#484F58", letterSpacing:"1px", marginBottom:6}}>EMAIL</div>
              <input
                type="email"
                value={email}
                autoComplete="username"
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && (resetMode ? sendReset() : attempt())}
                placeholder="you@prmg.net"
                autoFocus
                disabled={busy}
                style={{
                  background:"#0D1117",
                  border: error ? "1px solid #E85D75" : "1px solid #30363D",
                  borderRadius:8, padding:"12px 14px",
                  color:"#E6EDF3", fontSize:14,
                  fontFamily:"'DM Mono','Courier New',monospace",
                  width:"100%", transition:"border .15s",
                  opacity: busy ? 0.6 : 1,
                }}
              />
            </div>

            {!resetMode && (
              <div>
                <div style={{fontSize:11, color:"#484F58", letterSpacing:"1px", marginBottom:6, display:"flex", justifyContent:"space-between"}}>
                  <span>PASSWORD</span>
                  <button onClick={()=>{setResetMode(true);setError("");}}
                    style={{background:"transparent", border:"none", color:"#F5A623", fontSize:11, fontFamily:"DM Mono", cursor:"pointer", letterSpacing:"1px"}}>
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
                    color:"#E6EDF3", fontSize:14,
                    fontFamily:"'DM Mono','Courier New',monospace",
                    width:"100%", transition:"border .15s",
                    opacity: busy ? 0.6 : 1,
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{fontSize:12, color:"#E85D75", lineHeight:1.4}}>{error}</div>
            )}

            <button
              onClick={resetMode ? sendReset : attempt}
              disabled={busy}
              style={{
                width:"100%", background: busy ? "#8B6914" : "#C8922A", color:"#0D1117",
                borderRadius:8, padding:"13px 0", fontFamily:"DM Mono",
                fontSize:13, fontWeight:500, border:"none", cursor: busy ? "wait" : "pointer",
                transition:"opacity .15s", marginTop:4
              }}
              onMouseOver={e => !busy && (e.target.style.opacity=".85")}
              onMouseOut={e => e.target.style.opacity="1"}
            >
              {busy ? "WORKING…" : resetMode ? "SEND RESET LINK →" : "SIGN IN →"}
            </button>

            {resetMode && (
              <button onClick={()=>{setResetMode(false);setError("");}}
                style={{background:"transparent", border:"none", color:"#8B949E", fontSize:11, fontFamily:"DM Mono", cursor:"pointer", letterSpacing:"1px"}}>
                ← BACK TO SIGN IN
              </button>
            )}
          </div>
        )}

        <div style={{fontSize:11, color:"#30363D", textAlign:"center", lineHeight:1.5}}>
          Authorized personnel only · PRMG Branch 541-A<br/>
          All activity is logged.
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
const LOAN_TYPE_GROUPS = [
  { group: "Standard", types: ["Conventional","FHA","VA","USDA","Non-QM","Jumbo"] },
  { group: "NV — DPA", types: [
    "NV HIP Conventional","NV HIP FHA","NV Rural Home at Last FHA","NV Rural Home at Last Conv","Chenoa Fund FHA","NHF Grant FHA","NHF Grant Conv","NHF Grant VA","NHF Grant USDA"
  ]},
  { group: "FL — DPA", types: [
    "FL Housing FHA","FL Housing Conventional","FL Housing VA",
    "FL Hometown Heroes FHA","FL Hometown Heroes Conv","FL Hometown Heroes VA",
    "FL County HFA FHA","FL County HFA Conv","FL County HFA VA","FL County HFA USDA"
  ]},
  { group: "TX — DPA", types: [
    "TX TSAHC Heroes FHA","TX TSAHC Heroes Conv","TX TSAHC Heroes VA",
    "TX TDHCA FHA + MCC","TX TDHCA Conventional",
    "TX SETH FHA","TX SETH Conv (No Income Cap)","TX Veterans Land Board (TVLB)"
  ]},
  { group: "AZ — DPA", types: [
    "AZ Home in Five Conv","AZ Home in Five FHA","AZ Home in Five Platinum",
    "AZ IDA Pima FHA","AZ IDA Pima Conv"
  ]},
  { group: "CO — DPA", types: [
    "CO CHFA FirstGen Plus FHA","CO CHFA FirstStep Plus FHA","CO CHFA SmartStep Plus FHA",
    "CO CHFA Preferred Plus Conv","CO Denver MetroDPA FHA","CO Denver MetroDPA Conv"
  ]},
  { group: "Refi", types: [
    "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
    "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist","CO CHFA FHA Streamline"
  ]},
  { group: "HELOC & Second", types: [
    "Lightning Equity Hybrid HELOC","Symmetry HELOC",
    "CE Second Elite","CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)"
  ]},
];
const LOAN_TYPES = LOAN_TYPE_GROUPS.flatMap(g => g.types);

const LO_LIST = Object.entries(TEAM)
  .filter(([_,p]) => p.role === "admin" || p.role === "lo")
  .map(([uid,p]) => ({
    uid,
    name: p.name,
    nmls: p.nmls,
    role: p.role === "admin" ? "BM/MLO" : "LO",
    color: p.color,
  }));

const OVERRIDE_EXCLUDED = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite","CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)"];
const OVERRIDE_BPS = 25;

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

const IS = { background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"9px 12px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%" };

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [files,setFiles]=useState([]);
  const [view,setView]=useState("active");
  const [activePhase,setActivePhase]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
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
  const isAssistant = profile?.role === "assistant";

  useEffect(()=>{
    if (!currentUser) return;
    const unsub = onSnapshot(PIPELINE_DOC, (snap) => {
      if(snap.exists()){
        const data = snap.data();
        if(data.files && data.files.length > 0){
          setFiles(data.files);
          setLoaded(true);
        } else {
          try {
            const local = localStorage.getItem("pipe_v3");
            if(local){
              const parsed = JSON.parse(local);
              if(parsed && parsed.length > 0){
                setFiles(parsed);
                setDoc(PIPELINE_DOC, {files: parsed}, {merge:true});
                setLoaded(true);
                return;
              }
            }
          } catch{}
          setFiles(SAMPLE);
          setDoc(PIPELINE_DOC, {files: SAMPLE}, {merge:true});
          setLoaded(true);
        }
      } else {
        try {
          const local = localStorage.getItem("pipe_v3");
          if(local){
            const parsed = JSON.parse(local);
            if(parsed && parsed.length > 0){
              setFiles(parsed);
              setDoc(PIPELINE_DOC, {files: parsed}, {merge:true});
              setLoaded(true);
              return;
            }
          }
        } catch{}
        setFiles(SAMPLE);
        setDoc(PIPELINE_DOC, {files: SAMPLE}, {merge:true});
        setLoaded(true);
      }
    }, ()=>{
      try {
        const local = localStorage.getItem("pipe_v3");
        if(local) setFiles(JSON.parse(local));
      } catch{}
      setLoaded(true);
      setSaveStatus("error");
    });
    return ()=>unsub();
  },[currentUser]);

  useEffect(()=>{
    if(!loaded || !currentUser)return;
    setSaveStatus("saving");
    setDoc(PIPELINE_DOC, {files}, {merge:true}).then(()=>{
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(s=>s==="saved"?"idle":s), 2000);
    }).catch(()=>{
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("error");
    });
  },[files,loaded]);

  function exportBackup(){
    const payload = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      branch: "PRMG 541-A",
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
        fontFamily:"'DM Mono','Courier New',monospace", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
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
        fontFamily:"'DM Mono','Courier New',monospace", gap:18
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
          .spinner{width:40px;height:40px;border:3px solid #21262D;border-top-color:#F5A623;border-radius:50%;animation:spin .8s linear infinite;}
          .pulse{animation:pulse 1.4s ease-in-out infinite;}
        `}</style>
        <div className="spinner"/>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3",letterSpacing:"-0.5px"}}>
            LOADING PIPELINE
          </div>
          <div className="pulse" style={{fontSize:11,color:"#484F58",letterSpacing:"2px",marginTop:6}}>
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
      if(f.stage===REFERRED_OUT_STAGE) return f; // can't close a referred-out file at PRMG
      const fundedDate = f.closing || today();
      return stampEdit({...f, stage:CLOSED_STAGE, closedAt:fundedDate, daysInStage:0}, profile, "closed", {from:f.stage, closedAt:fundedDate});
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
    <div style={{fontFamily:"'DM Mono','Courier New',monospace",background:"#0D1117",minHeight:"100vh",color:"#E6EDF3"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:#161B22;}::-webkit-scrollbar-thumb{background:#30363D;border-radius:2px;}
        .hov{transition:all .15s;cursor:pointer;border:none;}
        .hov:hover{opacity:.85;transform:translateY(-1px);}
        .card{transition:transform .15s,box-shadow .15s;cursor:pointer;}
        .card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.5)!important;}
        input,select,textarea{outline:none;}
        input::placeholder,textarea::placeholder{color:#484F58;}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fi{animation:fi .2s ease;}
        tr.row:hover td{background:rgba(255,255,255,.03)!important;}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#161B22",borderBottom:"1px solid #21262D",padding:"14px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,letterSpacing:"-0.5px"}}>PIPELINE</div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"2px",marginTop:1}}>MORTGAGE BY DELVALLE</div>
        </div>
        <div style={{display:"flex",gap:20,marginLeft:8}}>
          {[["ACTIVE",active.length,"#4A90D9"],["CLOSED",closed.length,"#06D6A0"],["CRITICAL",crit,"#E85D75"],["VOLUME",`$${(vol/1e6).toFixed(1)}M`,"#F5A623"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:c}}>{v}</div>
              <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px"}}>{l}</div>
            </div>
          ))}
          {/* Always visible. A hidden list never gets opened; a number up here does. */}
          <div className="hov" onClick={()=>{setView("review");setActivePhase(null);}}
            title="Preparation files whose review date has arrived"
            style={{textAlign:"center",cursor:"pointer",padding:"0 10px",borderLeft:"1px solid #30363D"}}>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:dueReview.length>0?"#E85D75":"#484F58"}}>
              {dueReview.length}
            </div>
            <div style={{fontSize:9,color:dueReview.length>0?"#E85D75":"#484F58",letterSpacing:"1px"}}>DUE REVIEW</div>
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {saveStatus !== "idle" && (
            <div style={{
              fontSize:10, letterSpacing:"1px", padding:"4px 10px", borderRadius:12,
              background: saveStatus==="saving" ? "#21262D" : saveStatus==="saved" ? "rgba(6,214,160,.1)" : "rgba(232,93,117,.15)",
              color: saveStatus==="saving" ? "#8B949E" : saveStatus==="saved" ? "#06D6A0" : "#E85D75",
              border: "1px solid " + (saveStatus==="saving" ? "#30363D" : saveStatus==="saved" ? "#06D6A0" : "#E85D75"),
              fontFamily:"DM Mono"
            }}>
              {saveStatus==="saving" ? "● SAVING…" : saveStatus==="saved" ? "✓ SAVED" : "⚠ SAVE FAILED"}
            </div>
          )}
          <input placeholder="Search borrower..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:6,padding:"7px 12px",color:"#E6EDF3",fontSize:12,width:170}}/>
          <button className="hov" onClick={exportBackup}
            title="Download a JSON backup of your entire pipeline. Save it to Google Drive weekly."
            style={{background:"#21262D",color:"#8B949E",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:11,border:"1px solid #30363D"}}>
            ↓ BACKUP
          </button>
          {isAdmin && (
            <label className="hov"
              title="Admin only — restore your pipeline from a JSON backup file"
              style={{background:"#21262D",color:"#8B949E",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:11,border:"1px solid #30363D",cursor:"pointer"}}>
              ↑ RESTORE
              <input type="file" accept="application/json,.json" onChange={importBackup} style={{display:"none"}}/>
            </label>
          )}
          <button className="hov" onClick={()=>setShowAdd(true)}
            style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 16px",fontFamily:"DM Mono",fontSize:12,fontWeight:500}}>
            + NEW FILE
          </button>

          <button className="hov" onClick={()=>setShowHelp(true)}
            title="Help & best practices"
            style={{background:"transparent",color:"#8B949E",borderRadius:6,padding:"8px 10px",fontFamily:"DM Mono",fontSize:11,border:"1px solid #30363D",cursor:"pointer"}}>
            ❓ HELP
          </button>

          <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:12,marginLeft:4,borderLeft:"1px solid #30363D"}}>
            <div style={{
              width:32, height:32, borderRadius:"50%",
              background: profile.color, color:"#0D1117",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"Syne", fontWeight:800, fontSize:11
            }}>
              {profile.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1.2}}>
              <span style={{fontSize:11,color:"#E6EDF3",fontFamily:"Syne",fontWeight:700}}>{profile.short}</span>
              <span style={{fontSize:9,color:profile.color,letterSpacing:"1px",textTransform:"uppercase"}}>{profile.role}</span>
            </div>
            <button className="hov"
              onClick={()=>{
                if(confirm("Sign out?")) signOut(auth);
              }}
              title="Sign out"
              style={{background:"transparent",color:"#484F58",borderRadius:6,padding:"6px 8px",fontFamily:"DM Mono",fontSize:10,border:"1px solid #30363D",cursor:"pointer"}}>
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
          [`🔔 DUE REVIEW`,dueReview.length,"review",dueReview.length>0?"#E85D75":"#484F58"],
          ["🗄 ARCHIVED",archived.length,"archived","#6E7681"],
        ].map(([l,c,v,col])=>(
          <button key={v} className="hov" onClick={()=>{setView(v);setActivePhase(null);}}
            style={{background:view===v?col:"#21262D",color:view===v?"#0D1117":col,borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:"DM Mono",fontWeight:500,whiteSpace:"nowrap"}}>
            {l} · {c}
          </button>
        ))}
        <button className="hov" onClick={()=>{setView("production");setActivePhase(null);}}
          style={{background:view==="production"?"#BD65E8":"#21262D",color:view==="production"?"#0D1117":"#BD65E8",borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:"DM Mono",fontWeight:500,whiteSpace:"nowrap"}}>
          📊 PRODUCTION
        </button>
        {view==="active"&&<>
          <div style={{width:1,height:20,background:"#30363D",margin:"0 4px"}}/>
          <button className="hov" onClick={()=>setActivePhase(null)}
            style={{background:!activePhase?"#E6EDF3":"transparent",color:!activePhase?"#0D1117":"#8B949E",borderRadius:20,padding:"4px 12px",fontSize:11,fontFamily:"DM Mono",border:"1px solid #30363D",whiteSpace:"nowrap"}}>
            ALL · {active.length}
          </button>
          {phaseCounts.map(p=>(
            <button key={p.id} className="hov" onClick={()=>setActivePhase(activePhase===p.id?null:p.id)}
              style={{background:activePhase===p.id?p.color:"transparent",color:activePhase===p.id?"#0D1117":p.color,borderRadius:20,padding:"4px 12px",fontSize:11,fontFamily:"DM Mono",border:`1px solid ${p.color}`,whiteSpace:"nowrap"}}>
              {p.short} · {p.count}
            </button>
          ))}
        </>}
        <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:10,color:"#484F58",whiteSpace:"nowrap"}}>
          <span style={{color:"#E85D75"}}>● CRITICAL ≤3d</span>
          <span style={{color:"#F5A623"}}>● WARNING ≤7d</span>
          <span style={{color:"#484F58"}}>● STALE 5d+</span>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{padding:"20px 24px"}}>

        {view==="production"&&<ProductionDashboard
          profile={profile}
          files={files}
          closed={closed}
          active={active}
          referredOut={referredOut}
          inbound={inbound}
          onOpenFile={setDetail}
          onBulkUpdate={(updates)=>{
            setFiles(prev=>prev.map(f=>{
              const u = updates.find(x=>x.id===f.id);
              if(!u) return f;
              const cleanLo = typeof u.lo === "string" ? u.lo.trim() : u.lo;
              return stampEdit({...f, lo:cleanLo}, profile, "edited", {fields:["lo"]});
            }));
          }}
        />}

        {/* REFERRED OUT TABLE */}
        {view==="referred"&&<div className="fi">
          <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#A78BFA"}}>🔀 REFERRED OUT — {referredOut.length} TOTAL</span>
            <span style={{fontSize:11,color:"#484F58"}}>Files sent to external bankers. Click any row to view details + track outcome.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"#30363D",fontSize:13}}>
            No referred-out files yet.<br/><br/>
            <span style={{fontSize:11}}>To refer a file: open any active loan → change STAGE to "REFERRED OUT — EXTERNAL BANK" → fill in receiving banker details.</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #A78BFA"}}>
                  {["BORROWER","LOAN TYPE","AMOUNT","REFERRED TO","REASON","STATUS","FEE EARNED"].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
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
                      <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"#A78BFA",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${(f.loan/1000).toFixed(0)}K</td>
                      <td style={{padding:"11px 14px",color:"#E6EDF3",background:i%2===0?"#0D1117":"#161B22"}}>
                        {ro.bankerName||"—"}<br/>
                        <span style={{fontSize:10,color:"#484F58"}}>{ro.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:"#8B949E",fontSize:11,background:i%2===0?"#0D1117":"#161B22"}}>{ro.reason||"—"}</td>
                      <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                        <span style={{
                          fontSize:10,padding:"3px 7px",borderRadius:4,
                          background: ro.status==="Closed (Funded)" ? "rgba(6,214,160,.15)" :
                                      ro.status==="Fell Through" ? "rgba(232,93,117,.15)" :
                                      ro.status==="Withdrawn by Borrower" ? "rgba(139,148,158,.15)" :
                                      "rgba(245,166,35,.15)",
                          color: ro.status==="Closed (Funded)" ? "#06D6A0" :
                                 ro.status==="Fell Through" ? "#E85D75" :
                                 ro.status==="Withdrawn by Borrower" ? "#8B949E" :
                                 "#F5A623",
                        }}>{ro.status||"Pending"}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:isFunded?"#06D6A0":"#484F58",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#FFD166"}}>🤝 INBOUND REFERRALS — {inbound.length} TOTAL</span>
            <span style={{fontSize:11,color:"#484F58"}}>Files sent TO us by external bankers. They follow normal pipeline stages.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"#30363D",fontSize:13}}>
            No inbound referrals yet.<br/><br/>
            <span style={{fontSize:11}}>To add an inbound: click "+ NEW FILE" → check "This is an inbound referral" at the top.</span>
          </div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #FFD166"}}>
                  {["BORROWER","LOAN TYPE","AMOUNT","REFERRED BY","STAGE","CLOSING"].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>{
                  const rb = f.referringBanker || {};
                  return (
                    <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                      <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                      <td style={{padding:"11px 14px",color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                      <td style={{padding:"11px 14px",color:"#FFD166",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${(f.loan/1000).toFixed(0)}K</td>
                      <td style={{padding:"11px 14px",color:"#E6EDF3",background:i%2===0?"#0D1117":"#161B22"}}>
                        {rb.bankerName||"—"}<br/>
                        <span style={{fontSize:10,color:"#484F58"}}>{rb.bankerCompany||""}</span>
                      </td>
                      <td style={{padding:"11px 14px",color:getPhase(f.stage).color,fontWeight:500,fontSize:11,background:i%2===0?"#0D1117":"#161B22"}}>{f.stage}</td>
                      <td style={{padding:"11px 14px",color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.closedAt||f.closing||"—"}</td>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#06D6A0"}}>CLOSED FILES — {closed.length} TOTAL</span>
            <span style={{fontSize:11,color:"#484F58"}}>All funded loans. Click any row to view or reopen.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"#30363D",fontSize:13}}>No closed files yet.</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #06D6A0"}}>
                  {["BORROWER","TYPE","LOAN AMOUNT","CLOSED DATE","NOTES",""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"#06D6A0",fontWeight:500,background:i%2===0?"#0D1117":"#161B22"}}>${f.loan.toLocaleString()}</td>
                    <td style={{padding:"11px 14px",color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.closedAt||f.closing}</td>
                    <td style={{padding:"11px 14px",color:"#484F58",fontStyle:"italic",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",background:i%2===0?"#0D1117":"#161B22"}}>{f.note||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();reopenFile(f.id);}}
                        style={{background:"#21262D",color:"#8B949E",borderRadius:5,padding:"4px 10px",fontSize:10,fontFamily:"DM Mono"}}>REOPEN</button>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:view==="review"?"#E85D75":"#7EC8A4"}}>
              {view==="review" ? `🔔 DUE REVIEW — ${dueReview.length}` : `⏸ PREPARATION — ${prep.length}`}
            </span>
            <span style={{fontSize:11,color:"#484F58"}}>
              {view==="review"
                ? "The review date arrived. Decide: continue, reschedule, or archive."
                : "Alive but not buyable yet. No stage clock — these wait against a review date."}
            </span>
          </div>
          {display.length===0?(
            <div style={{padding:40,textAlign:"center",color:"#30363D",fontSize:13}}>
              {view==="review"
                ? "Nothing due today. ✓"
                : <>No files in Preparation.<br/><br/><span style={{fontSize:11}}>To send one here: open any active file → ⏸ PREP → pick a reason and a review date.</span></>}
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
                        <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",lineHeight:1.2}}>{f.borrower}</div>
                        <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>{f.type} · ${(f.loan/1000).toFixed(0)}k</div>
                        {f.lo&&<div style={{fontSize:10,color:"#484F58",marginTop:1}}>{f.lo.split(" ")[0]}</div>}
                      </div>
                      {locked
                        ? <span style={{background:"#E85D75",color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:9,fontWeight:500,whiteSpace:"nowrap"}}>DECIDE NOW</span>
                        : due && <span style={{background:"#F5A623",color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500}}>DUE</span>}
                    </div>

                    <div style={{background:"rgba(126,200,164,.07)",border:"1px solid #7EC8A433",borderRadius:6,padding:"7px 9px"}}>
                      <div style={{fontSize:11,color:"#7EC8A4",fontWeight:500}}>{r.label}</div>
                      <div style={{fontSize:10,color:"#8B949E",marginTop:3}}>
                        Review {p.reviewOn||"—"}
                        {" · "}
                        <span style={{color:due?"#E85D75":"#484F58"}}>
                          {dtr>0?`in ${dtr}d`:dtr===0?"today":`${Math.abs(dtr)}d overdue`}
                        </span>
                      </div>
                    </div>

                    <div style={{fontSize:10,color:locked?"#E85D75":"#484F58"}}>
                      {age}d in preparation
                      <span style={{color:"#30363D"}}> / {PREP_MAX_DAYS} max</span>
                      {(p.reschedules>0)&&<span style={{color:"#30363D"}}> · rescheduled {p.reschedules}×</span>}
                    </div>
                    <div style={{height:3,background:"#21262D",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min(100,(age/PREP_MAX_DAYS)*100)}%`,background:locked?"#E85D75":age/PREP_MAX_DAYS>0.75?"#F5A623":"#7EC8A4"}}/>
                    </div>

                    {(p.note||f.note)&&<div style={{fontSize:10,color:"#6E7681",borderTop:"1px solid #21262D",paddingTop:6,fontStyle:"italic"}}>{p.note||f.note}</div>}
                    {locked&&<div style={{fontSize:10,color:"#E85D75",lineHeight:1.4}}>
                      Past {PREP_MAX_DAYS} days — the credit report has expired. Return it or archive it; it can't be rescheduled again.
                    </div>}

                    <div style={{display:"flex",gap:6,marginTop:2,flexWrap:"wrap"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();if(confirm(`Bring ${f.borrower} back to the active pipeline?\n\nStage returns to "${p.prevStage||"Lead Inquiry"}" and the stage clock starts today.`))continueFromPrep(f.id);}}
                        style={{flex:1,background:"rgba(74,144,217,.1)",border:"1px solid #4A90D9",borderRadius:5,color:"#4A90D9",fontSize:10,padding:"5px 8px",whiteSpace:"nowrap"}}>
                        ✓ CONTINUE
                      </button>
                      <button className="hov" disabled={locked} onClick={e=>{e.stopPropagation();if(!locked)setPrepFor(f);}}
                        title={locked?`Locked at ${PREP_MAX_DAYS} days`:"Set a new review date"}
                        style={{flex:1,background:locked?"#161B22":"rgba(245,166,35,.1)",border:`1px solid ${locked?"#21262D":"#F5A623"}`,borderRadius:5,color:locked?"#30363D":"#F5A623",fontSize:10,padding:"5px 8px",whiteSpace:"nowrap",cursor:locked?"not-allowed":"pointer"}}>
                        ↻ RESCHEDULE
                      </button>
                      <button className="hov" onClick={e=>{e.stopPropagation();setArchiveFor(f);}}
                        style={{background:"rgba(110,118,129,.12)",border:"1px solid #30363D",borderRadius:5,color:"#8B949E",fontSize:10,padding:"5px 10px",whiteSpace:"nowrap"}}>
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
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#8B949E"}}>🗄 ARCHIVED — {archived.length}</span>
            <span style={{fontSize:11,color:"#484F58"}}>Out of every count and every average. Nothing was deleted — restore any row.</span>
          </div>
          {display.length===0?<div style={{padding:40,textAlign:"center",color:"#30363D",fontSize:13}}>Nothing archived yet.</div>:(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"2px solid #30363D"}}>
                  {["BORROWER","TYPE","AMOUNT","LAST STAGE","REASON","ARCHIVED",""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.map((f,i)=>(
                  <tr key={f.id} className="row" style={{borderBottom:"1px solid #21262D",cursor:"pointer"}} onClick={()=>setDetail(f)}>
                    <td style={{padding:"11px 14px",fontFamily:"Syne",fontWeight:700,color:"#8B949E",background:i%2===0?"#0D1117":"#161B22"}}>{f.borrower}</td>
                    <td style={{padding:"11px 14px",color:"#6E7681",background:i%2===0?"#0D1117":"#161B22"}}>{f.type}</td>
                    <td style={{padding:"11px 14px",color:"#6E7681",background:i%2===0?"#0D1117":"#161B22"}}>${((f.loan||0)/1000).toFixed(0)}K</td>
                    <td style={{padding:"11px 14px",color:"#6E7681",fontSize:11,background:i%2===0?"#0D1117":"#161B22"}}>{isPrep(f)?(f.prep?.prevStage||"Preparation"):f.stage}</td>
                    <td style={{padding:"11px 14px",color:"#6E7681",fontSize:11,background:i%2===0?"#0D1117":"#161B22"}}>{f.archiveReason||"—"}</td>
                    <td style={{padding:"11px 14px",color:"#484F58",fontSize:11,background:i%2===0?"#0D1117":"#161B22"}}>{f.archivedAt||"—"}</td>
                    <td style={{padding:"11px 14px",background:i%2===0?"#0D1117":"#161B22"}}>
                      <button className="hov" onClick={e=>{e.stopPropagation();restoreFile(f.id);}}
                        style={{background:"#21262D",color:"#7EC8A4",borderRadius:5,padding:"4px 10px",fontSize:10,fontFamily:"DM Mono"}}>↩ RESTORE</button>
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
                  <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:phase.color,letterSpacing:"1px"}}>PHASE {phase.id} — {phase.label.toUpperCase()}</span>
                  <span style={{background:phase.color,color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:500}}>{pf.length}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:5,flexWrap:"wrap"}}>
                    {phase.stages.map((s,i)=><span key={i} style={{fontSize:10,color:"#484F58",background:"#0D1117",borderRadius:4,padding:"2px 6px"}}>{s}</span>)}
                  </div>
                </div>
                {pf.length===0?(
                  <div style={{padding:"18px",color:"#30363D",fontSize:12,textAlign:"center"}}>No active files in this phase</div>
                ):(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12,padding:12}}>
                    {pf.map(f=>{
                      const u=urgency(f);
                      const ph=getPhase(f.stage);
                      const si=ph.stages.indexOf(f.stage);
                      const cd=daysTil(f.closing);
                      const uc=u==="critical"?"#E85D75":u==="warning"?"#F5A623":u==="stale"?"#484F58":"#21262D";
                      return(
                        <div key={f.id} className="card" onClick={()=>setDetail(f)}
                          style={{background:"#0D1117",border:`1px solid ${uc}`,borderRadius:8,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",lineHeight:1.2}}>
                                {f.borrower}
                                {f.isInbound && <span title="Inbound referral" style={{marginLeft:6,fontSize:10,color:"#FFD166"}}>🤝</span>}
                              </div>
                              <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>{f.type} · ${(f.loan/1000).toFixed(0)}k</div>
                              {f.lo&&<div style={{fontSize:10,color:"#484F58",marginTop:1}}>{f.lo.split(" ")[0]}{f.referralPartner?` · ${f.referralPartner.split(" ")[0]}`:""}</div>}
                            </div>
                            {u!=="normal"&&<span style={{background:uc,color:"#0D1117",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:500}}>
                              {u==="critical"?"CRITICAL":u==="warning"?"WARN":"STALE"}
                            </span>}
                          </div>
                          <div style={{display:"flex",gap:3}}>
                            {ph.stages.map((_,i)=><div key={i} style={{height:4,flex:1,borderRadius:2,background:i<=si?ph.color:"#21262D"}}/>)}
                          </div>
                          <div style={{fontSize:11,color:ph.color,fontWeight:500}}>{f.stage}</div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#484F58"}}>
                            <span title={`File age: ${fileAge(f) ?? "—"} days`}>
                              {daysInStage(f)===null ? "— in stage" : `${daysInStage(f)}d in stage`}
                              {fileAge(f)!==null && <span style={{color:"#30363D"}}> · {fileAge(f)}d total</span>}
                            </span>
                            {f.closing&&<span style={{color:cd!==null&&cd<=3?"#E85D75":cd!==null&&cd<=7?"#F5A623":"#484F58"}}>
                              {cd===0?"CLOSING TODAY":cd!==null&&cd>0?`Close in ${cd}d`:cd!==null?"PAST DUE":f.closing}
                            </span>}
                          </div>
                          <ContingencyStrip file={f}/>
                          {f.note&&<div style={{fontSize:10,color:"#6E7681",borderTop:"1px solid #21262D",paddingTop:6,fontStyle:"italic"}}>{f.note}</div>}
                          {f.lastEditedBy&&<div style={{fontSize:9,color:"#484F58",letterSpacing:"0.5px",borderTop:f.note?"none":"1px solid #21262D",paddingTop:f.note?0:6}}>
                            Edited by {f.lastEditedBy.name?.split(" ")[0]||"?"} · {timeAgo(f.lastEditedAt)}
                          </div>}
                          {(f.phone || f.email) && (
                            <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                              {f.phone && (
                                <a href={`tel:${f.phone.replace(/[^\d+]/g,"")}`} onClick={e=>e.stopPropagation()}
                                  title={`Call ${f.phone}`}
                                  style={{background:"rgba(74,144,217,.08)",border:"1px solid #4A90D944",borderRadius:4,padding:"3px 7px",color:"#4A90D9",fontSize:10,fontFamily:"DM Mono",textDecoration:"none"}}>
                                  📱 {f.phone}
                                </a>
                              )}
                              {f.email && (
                                <a href={`mailto:${f.email}`} onClick={e=>e.stopPropagation()}
                                  title={`Email ${f.email}`}
                                  style={{background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",borderRadius:4,padding:"3px 7px",color:"#BD65E8",fontSize:10,fontFamily:"DM Mono",textDecoration:"none"}}>
                                  ✉
                                </a>
                              )}
                            </div>
                          )}
                          <div style={{display:"flex",gap:6,marginTop:2}}>
                            <button className="hov" onClick={e=>{e.stopPropagation();advance(f.id);}}
                              style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid #21262D",borderRadius:5,color:"#8B949E",fontSize:10,padding:"5px 0"}}>
                              ADVANCE →
                            </button>
                            <button className="hov" onClick={e=>{e.stopPropagation();if(confirm(`Mark ${f.borrower} as CLOSED?`))closeFile(f.id);}}
                              style={{background:"rgba(6,214,160,.1)",border:"1px solid #06D6A0",borderRadius:5,color:"#06D6A0",fontSize:10,padding:"5px 10px"}}>
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

      {detail&&<DetailModal file={detail} profile={profile} onClose={()=>setDetail(null)}
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
      {showAdd&&<AddModal profile={profile} onClose={()=>setShowAdd(false)} onAdd={f=>{
        const stamped = stampEdit(f, profile, "created");
        setFiles(p=>[...p, {...stamped, createdBy:{uid:profile.uid,name:profile.name}, createdAt:new Date().toISOString()}]);
        setShowAdd(false);
      }}/>}
      {prepFor&&<PrepModal file={prepFor} onClose={()=>setPrepFor(null)}
        onConfirm={(payload)=>{sendToPrep(prepFor.id,payload);setPrepFor(null);}}/>}
      {archiveFor&&<ArchiveModal file={archiveFor} onClose={()=>setArchiveFor(null)}
        onConfirm={(reason)=>{archiveFile(archiveFor.id,reason);setArchiveFor(null);}}/>}
      {showHelp&&<HelpModal profile={profile} onClose={()=>setShowHelp(false)}/>}
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

  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"9px 11px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};
  const daysOut = reviewOn ? Math.ceil((new Date(reviewOn+"T00:00:00")-new Date(new Date().toDateString()))/86400000) : null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()}
        style={{background:"#161B22",border:"1px solid #7EC8A455",borderRadius:12,width:"100%",maxWidth:430,maxHeight:"calc(100vh - 40px)",overflowY:"auto",padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:17,color:"#7EC8A4"}}>
            {isReschedule?"↻ RESCHEDULE":"⏸ SEND TO PREPARATION"}
          </div>
          <div style={{fontSize:12,color:"#8B949E",marginTop:3}}>{file.borrower}</div>
          {!isReschedule&&<div style={{fontSize:11,color:"#484F58",marginTop:6,lineHeight:1.5}}>
            Leaves the active board and stops the stage clock. It is not closed and not archived — it comes back on the review date.
          </div>}
        </div>

        <div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>WHY IS THIS CLIENT WAITING?</div>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={fs}>
            {PREP_REASONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {r.why&&<div style={{fontSize:10,color:"#6E7681",marginTop:6,lineHeight:1.5,fontStyle:"italic"}}>{r.why}</div>}
        </div>

        <div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>
            REVIEW ON {r.mode==="date"&&<span style={{color:"#F5A623"}}>— pick the real date</span>}
          </div>
          <input type="date" value={reviewOn} onChange={e=>setReviewOn(e.target.value)} style={fs}/>
          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            {[30,60,90].map(d=>(
              <button key={d} className="hov" onClick={()=>setReviewOn(addDaysISO(today(),d))}
                style={{background:"#21262D",border:"1px solid #30363D",borderRadius:5,color:"#8B949E",fontSize:11,padding:"5px 12px",fontFamily:"DM Mono"}}>
                +{d}d
              </button>
            ))}
            {daysOut!==null&&<span style={{fontSize:10,color:daysOut>PREP_MAX_DAYS?"#E85D75":"#484F58",alignSelf:"center",marginLeft:4}}>
              {daysOut}d out{daysOut>PREP_MAX_DAYS?` — past the ${PREP_MAX_DAYS}-day cap`:""}
            </span>}
          </div>
        </div>

        <div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>WHAT HAS TO HAPPEN BEFORE THEY COME BACK?</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
            placeholder="e.g. collections paid off, 2025 taxes filed, 3 months of statements"
            style={{...fs,resize:"vertical"}}/>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none"}}>CANCEL</button>
          <button className="hov"
            disabled={!reviewOn}
            onClick={()=>{ if(reviewOn) onConfirm({reason, reviewOn, note}); }}
            style={{flex:2,background:reviewOn?"#7EC8A4":"#21262D",color:reviewOn?"#0D1117":"#484F58",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:reviewOn?"pointer":"not-allowed"}}>
            {reviewOn?(isReschedule?"RESCHEDULE":"SEND TO PREPARATION"):"PICK A REVIEW DATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ARCHIVE MODAL ───
function ArchiveModal({file, onClose, onConfirm}){
  const [reason,setReason]=useState(ARCHIVE_REASONS[0]);
  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"9px 11px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:120,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" onClick={e=>e.stopPropagation()}
        style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:400,padding:22,display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:17,color:"#E6EDF3"}}>🗄 ARCHIVE</div>
          <div style={{fontSize:12,color:"#8B949E",marginTop:3}}>{file.borrower}</div>
          <div style={{fontSize:11,color:"#484F58",marginTop:6,lineHeight:1.5}}>
            Nothing is deleted. The file leaves every count and every average, and can be restored from the ARCHIVED tab.
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>REASON</div>
          <select value={reason} onChange={e=>setReason(e.target.value)} style={fs}>
            {ARCHIVE_REASONS.map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none"}}>CANCEL</button>
          <button className="hov" onClick={()=>onConfirm(reason)}
            style={{flex:2,background:"#30363D",color:"#E6EDF3",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none"}}>ARCHIVE</button>
        </div>
      </div>
    </div>
  );
}


function ProductionDashboard({profile, files, closed, active, referredOut, inbound, onOpenFile, onBulkUpdate}){
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  const [prodTab,setProdTab]=useState("team");
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

  const isEligible=f=>!OVERRIDE_EXCLUDED.includes(f.type);
  const overrideComp=f=>isEligible(f)?Math.round((f.loan||0)*OVERRIDE_BPS/10000):0;
  const totalOverride=closed.reduce((s,f)=>s+overrideComp(f),0);
  const monthOverride=closedThisMonth.reduce((s,f)=>s+overrideComp(f),0);
  const eligibleVol=closed.filter(isEligible).reduce((s,f)=>s+(f.loan||0),0);

  const loOverride=LO_LIST.map(lo=>{
    const loClosed=closed.filter(f=>f.lo===lo.name);
    const loEligible=loClosed.filter(isEligible);
    const loVol=loEligible.reduce((s,f)=>s+(f.loan||0),0);
    return {...lo, eligibleVol:loVol, override:Math.round(loVol*OVERRIDE_BPS/10000),
      closedCount:loClosed.length, excludedCount:loClosed.filter(f=>!isEligible(f)).length};
  });

  const myComp=f=>Math.round((f.loan||0)*(f.bps||BPS_RATE)/10000);
  const myClosedFiles = closed.filter(f=>f.lo===profile.name);
  const myTotalComp = myClosedFiles.reduce((s,f)=>s+myComp(f),0);

  const refMap={};
  files.forEach(f=>{
    if(!f.referralPartner)return;
    const key=f.referralPartner;
    if(!refMap[key])refMap[key]={name:key,total:0,closed:0,active:0,vol:0};
    refMap[key].total++;
    if(f.stage===CLOSED_STAGE){refMap[key].closed++;refMap[key].vol+=(f.loan||0);}
    else refMap[key].active++;
  });
  const topRefs=Object.values(refMap).sort((a,b)=>b.total-a.total);

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
  // What PRMG would have earned at full BPS comp
  const outboundWouldHaveEarned = outboundFunded.reduce((s,f)=>{
    const ro = f.referredOut||{};
    const finalAmt = parseInt(ro.finalLoanAmount)||f.loan||0;
    return s + Math.round(finalAmt * (f.bps||BPS_RATE) / 10000);
  }, 0);
  const outboundLostComp = outboundWouldHaveEarned - outboundFeesEarned;

  // Inbound: deals other bankers sent to us
  const inboundList = inbound || [];
  const inboundClosed = inboundList.filter(f=>f.stage===CLOSED_STAGE);
  const inboundActive = inboundList.filter(f=>f.stage!==CLOSED_STAGE && f.stage!==REFERRED_OUT_STAGE);
  const inboundFundedVol = inboundClosed.reduce((s,f)=>s+(f.loan||0), 0);
  const inboundActiveVol = inboundActive.reduce((s,f)=>s+(f.loan||0), 0);
  // Comp earned on inbound closed deals (full BPS)
  const inboundCompEarned = inboundClosed.reduce((s,f)=>s+Math.round((f.loan||0)*(f.bps||BPS_RATE)/10000), 0);

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
  const today = new Date();
  for(let i=11; i>=0; i--){
    const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
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
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>{s.label}</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* INNER TAB BAR — now includes BANK REFERRALS */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
          ["team","🏆 TEAM PRODUCTION"],
          ["monthly","📅 MONTHLY"],
          ["referrals","🤝 REFERRAL PARTNERS"],
          ["bankrefs","🏦 BANK REFERRALS"],
          isLO && ["mycomp","💵 MY COMP"],
          isAdmin && ["override","💰 OVERRIDE & COMP"],
        ].filter(Boolean).map(([t,l])=>(
          <button key={t} className="hov" onClick={()=>setProdTab(t)}
            style={{background:prodTab===t?"#F5A623":"#21262D",color:prodTab===t?"#0D1117":"#8B949E",borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:"DM Mono",fontWeight:500}}>
            {l}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:10,color:"#484F58",letterSpacing:"1px",alignSelf:"center"}}>
          {isAdmin ? "ADMIN VIEW · ALL DATA VISIBLE" : isLO ? "LO VIEW · YOUR COMP ONLY" : "ASSISTANT VIEW · NO COMP"}
        </div>
      </div>

      {/* TEAM PRODUCTION TAB */}
      {prodTab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {loStats.map((lo,i)=>(
            <div key={lo.name} style={{background:"#161B22",border:`1px solid ${loColors[i]}44`,borderRadius:10,overflow:"hidden"}}>
              <div style={{background:`${loColors[i]}18`,borderBottom:`2px solid ${loColors[i]}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:loColors[i],display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne",fontWeight:800,fontSize:13,color:"#0D1117",flexShrink:0}}>
                  {lo.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:loColors[i]}}>{lo.name}</div>
                  <div style={{fontSize:10,color:"#484F58"}}>{lo.role}</div>
                </div>
              </div>
              <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {l:"CLOSED",v:lo.closedCount,c:loColors[i]},
                  {l:"ACTIVE",v:lo.activeCount,c:"#F5A623"},
                  {l:"THIS MO",v:lo.monthCount,c:"#BD65E8"},
                ].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"#0D1117",borderRadius:6,padding:"8px 4px"}}>
                    <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:9,color:"#484F58",letterSpacing:"0.5px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"0 14px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{background:"#0D1117",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:"#484F58",marginBottom:2}}>FUNDED VOL</div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#06D6A0"}}>${(lo.closedVol/1000).toFixed(0)}K</div>
                </div>
                <div style={{background:"#0D1117",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:"#484F58",marginBottom:2}}>PIPELINE</div>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#4A90D9"}}>${(lo.activeVol/1000).toFixed(0)}K</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {orphanFiles.length > 0 && (
          <div style={{background:"#161B22",border:"1px solid #E85D7544",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"rgba(232,93,117,.08)",borderBottom:"2px solid #E85D75",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#E85D75",letterSpacing:"1px"}}>⚠ UNASSIGNED LO FILES</span>
              <span style={{background:"#E85D75",color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:500}}>{orphanFiles.length}</span>
              <span style={{fontSize:11,color:"#8B949E",marginLeft:6,flex:1,minWidth:200}}>won't show in production stats until fixed · click any row to open & fix manually</span>
              {isAdmin && autoFixableCount > 0 && (
                <button className="hov" onClick={()=>setShowAutoFixPreview(true)}
                  style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"7px 14px",fontFamily:"DM Mono",fontSize:11,fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ AUTO-FIX {autoFixableCount}
                </button>
              )}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["BORROWER","TYPE","LOAN","STAGE","CURRENT LO VALUE","SUGGESTED FIX"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":i===2?"center":"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orphanFiles.map((f,i)=>(
                  <tr key={f.id} className="row" onClick={()=>onOpenFile && onOpenFile(f)}
                    style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22",cursor:"pointer"}}>
                    <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3"}}>{f.borrower}</td>
                    <td style={{padding:"10px 14px",color:"#8B949E"}}>{f.type}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>${(f.loan/1000).toFixed(0)}K</td>
                    <td style={{padding:"10px 14px",color:"#8B949E"}}>{f.stage}</td>
                    <td style={{padding:"10px 14px",color:"#E85D75",fontWeight:500,fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                    <td style={{padding:"10px 14px"}}>
                      {f._suggestedLo ? (
                        <span style={{color:"#06D6A0",fontWeight:500}}>→ {f._suggestedLo}</span>
                      ) : (
                        <span style={{color:"#484F58",fontStyle:"italic"}}>no match · fix manually</span>
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
                  <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#F5A623"}}>✨ AUTO-FIX PREVIEW</div>
                  <div style={{fontSize:11,color:"#8B949E",marginTop:4,lineHeight:1.5}}>
                    Review the suggested LO assignments below. Click APPLY to update all {autoFixableCount} files at once.
                  </div>
                </div>
                <button onClick={()=>setShowAutoFixPreview(false)} style={{background:"transparent",border:"none",color:"#484F58",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #30363D"}}>
                      {["BORROWER","CURRENT","→","NEW LO"].map((h,i)=>(
                        <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orphanFiles.filter(f=>f._suggestedLo).map((f,i)=>(
                      <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                        <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3"}}>{f.borrower}</td>
                        <td style={{padding:"10px 14px",color:"#E85D75",fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                        <td style={{padding:"10px 14px",color:"#484F58",textAlign:"center"}}>→</td>
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
                  style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ APPLY {autoFixableCount} FIXES
                </button>
                <button className="hov" onClick={()=>setShowAutoFixPreview(false)}
                  style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>
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
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>BEST MONTH (12MO)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#06D6A0"}}>{bestMonth.units > 0 ? monthLabel(bestMonth.month) : "—"}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>{bestMonth.units} units · ${(bestMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #E85D7544",borderTop:"3px solid #E85D75",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>SLOWEST MONTH</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E85D75"}}>{worstMonth.units > 0 ? monthLabel(worstMonth.month) : "—"}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>{worstMonth.units} units · ${(worstMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #4A90D944",borderTop:"3px solid #4A90D9",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>12-MO TOTAL UNITS</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#4A90D9"}}>{last12Months.reduce((s,m)=>s+m.units,0)}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>loans funded</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #F5A62344",borderTop:"3px solid #F5A623",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>12-MO TOTAL VOLUME</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#F5A623"}}>${(last12Months.reduce((s,m)=>s+m.volume,0)/1e6).toFixed(2)}M</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>funded</div>
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#4A90D9",letterSpacing:"1px"}}>UNITS CLOSED · LAST 12 MONTHS</div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>peak: {maxUnits} unit{maxUnits===1?"":"s"}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.units>0 ? Math.max(8, (m.units/maxUnits)*100) : 0;
              const isBest = m.units===maxUnits && m.units>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:10,fontFamily:"DM Mono",color:isBest?"#06D6A0":"#8B949E",fontWeight:isBest?500:400,minHeight:12}}>
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
                  <div style={{fontSize:9,color:isCurrent?"#4A90D9":"#484F58",fontFamily:"DM Mono",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#F5A623",letterSpacing:"1px"}}>FUNDED VOLUME · LAST 12 MONTHS</div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>peak: ${(maxVolume/1000).toFixed(0)}K</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.volume>0 ? Math.max(8, (m.volume/maxVolume)*100) : 0;
              const isBest = m.volume===maxVolume && m.volume>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:9,fontFamily:"DM Mono",color:isBest?"#F5A623":"#8B949E",fontWeight:isBest?500:400,minHeight:12,whiteSpace:"nowrap"}}>
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
                  <div style={{fontSize:9,color:isCurrent?"#4A90D9":"#484F58",fontFamily:"DM Mono",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px"}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#4A90D9",letterSpacing:"1px"}}>MONTHLY DETAIL · 12-MONTH ROLLING</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["MONTH","UNITS","VOLUME","AVG LOAN"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last12Months].reverse().map((m,i)=>(
                <tr key={m.month} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3"}}>{monthLabel(m.month)}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.units>0?"#06D6A0":"#30363D",fontWeight:500}}>{m.units}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.volume>0?"#F5A623":"#30363D",fontWeight:500}}>${(m.volume/1000).toFixed(0)}K</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"#8B949E"}}>{m.units>0?`$${(m.volume/m.units/1000).toFixed(0)}K`:"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {yearlyList.length > 0 && (
          <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#261535",borderBottom:"2px solid #BD65E8",padding:"10px 16px"}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#BD65E8",letterSpacing:"1px"}}>ANNUAL SUMMARY</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["YEAR","UNITS","VOLUME","AVG LOAN"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyList.map((y,i)=>(
                  <tr key={y.year} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                    <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#BD65E8"}}>{y.year}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>{y.units}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#F5A623",fontWeight:500}}>${(y.volume/1e6).toFixed(2)}M</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"#8B949E"}}>${(y.volume/y.units/1000).toFixed(0)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* REFERRAL PARTNERS TAB (existing — sources of business) */}
      {prodTab==="referrals"&&<div>
        {topRefs.length===0?<div style={{padding:32,textAlign:"center",color:"#30363D",fontSize:13}}>No referral partners tracked yet. Add partner names to your files to see them here.</div>:(
          <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#1a2e25",borderBottom:"2px solid #06D6A0",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#06D6A0",letterSpacing:"1px"}}>REFERRAL PARTNER LEADERBOARD</span>
              <span style={{background:"#06D6A0",color:"#0D1117",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:500}}>{topRefs.length}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["#","REFERRAL PARTNER","TOTAL FILES","CLOSED","ACTIVE","FUNDED VOLUME"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":"center",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRefs.map((ref,i)=>(
                  <tr key={ref.name} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                    <td style={{padding:"10px 14px",color:i===0?"#F5A623":i===1?"#8B949E":i===2?"#CD7F32":"#484F58",fontFamily:"Syne",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"10px 14px",color:"#E6EDF3",fontFamily:"Syne",fontWeight:700,fontSize:12}}>{ref.name}</td>
                    <td style={{padding:"10px 14px",textAlign:"center"}}>
                      <span style={{background:"#21262D",color:"#E6EDF3",borderRadius:12,padding:"2px 10px",fontSize:12,fontWeight:500}}>{ref.total}</span>
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
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>REFERRED OUT (TOTAL)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#A78BFA"}}>{(referredOut||[]).length}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>${(outboundTotalVol/1000).toFixed(0)}K orig. volume</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>OUTBOUND FUNDED</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#06D6A0"}}>{outboundFunded.length}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>${(outboundFundedVol/1000).toFixed(0)}K closed at banker</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #F5A62344",borderTop:"3px solid #F5A623",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>FEES EARNED (50 BPS)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>on referred-out funded</div>
          </div>
          {isAdmin && (
            <div style={{background:"#161B22",border:"1px solid #E85D7544",borderTop:"3px solid #E85D75",borderRadius:8,padding:12}}>
              <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>LOST COMP (GROSS)</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</div>
              <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>vs. {BPS_RATE} bps PRMG comp</div>
            </div>
          )}
        </div>

        {/* Inbound metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"#161B22",border:"1px solid #FFD16644",borderTop:"3px solid #FFD166",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>INBOUND (TOTAL)</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#FFD166"}}>{inboundList.length}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>from external bankers</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>INBOUND CLOSED</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#06D6A0"}}>{inboundClosed.length}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>${(inboundFundedVol/1000).toFixed(0)}K funded</div>
          </div>
          <div style={{background:"#161B22",border:"1px solid #4A90D944",borderTop:"3px solid #4A90D9",borderRadius:8,padding:12}}>
            <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>INBOUND ACTIVE</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#4A90D9"}}>{inboundActive.length}</div>
            <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>${(inboundActiveVol/1000).toFixed(0)}K in pipeline</div>
          </div>
          {isAdmin && (
            <div style={{background:"#161B22",border:"1px solid #06D6A044",borderTop:"3px solid #06D6A0",borderRadius:8,padding:12}}>
              <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>COMP FROM INBOUND</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</div>
              <div style={{fontSize:11,color:"#8B949E",marginTop:2}}>{BPS_RATE} bps on closed</div>
            </div>
          )}
        </div>

        {/* Reciprocity table */}
        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1f1830",borderBottom:"2px solid #A78BFA",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#A78BFA",letterSpacing:"1px"}}>🏦 BANKER RECIPROCITY</span>
            <span style={{fontSize:11,color:"#8B949E"}}>who's sending what · spot imbalances</span>
          </div>
          {bankerReciprocity.length === 0 ? (
            <div style={{padding:24,textAlign:"center",color:"#30363D",fontSize:12}}>
              No banker referrals tracked yet.<br/>
              <span style={{fontSize:10,marginTop:6,display:"block"}}>Refer a file out OR add an inbound referral to populate this table.</span>
            </div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                  {["BANKER","COMPANY","SENT TO THEM","THEY SENT US","VOLUME OUT","VOLUME IN","BALANCE"].map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":"center",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bankerReciprocity.map((b,i)=>{
                  const netCount = b.receivedIn - b.sentOut;
                  const netLabel = netCount > 0 ? `+${netCount} (favoring you)` : netCount < 0 ? `${netCount} (favoring them)` : "even";
                  const netColor = netCount > 0 ? "#06D6A0" : netCount < 0 ? "#E85D75" : "#8B949E";
                  return (
                    <tr key={b.name} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                      <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3"}}>{b.name}</td>
                      <td style={{padding:"10px 14px",color:"#8B949E",fontSize:11}}>{b.company || "—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#A78BFA",fontWeight:500}}>{b.sentOut}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#FFD166",fontWeight:500}}>{b.receivedIn}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#A78BFA",fontSize:11}}>${(b.sentOutVol/1000).toFixed(0)}K</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"#FFD166",fontSize:11}}>${(b.receivedInVol/1000).toFixed(0)}K</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:netColor,fontWeight:500,fontSize:11}}>{netLabel}</td>
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
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#F5A623",letterSpacing:"1px"}}>💰 YEAR-END COMP IMPACT</span>
            </div>
            <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>OUTBOUND — WHAT YOU WOULD HAVE EARNED AT PRMG</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:18,color:"#8B949E"}}>${outboundWouldHaveEarned.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#484F58",marginTop:3}}>{BPS_RATE} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>WHAT YOU EARNED IN REFERRAL FEES</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:18,color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#484F58",marginTop:3}}>{REFERRAL_FEE_BPS} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>NET LOST COMP (OUTBOUND)</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:18,color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#484F58",marginTop:3}}>opportunity cost</div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>INBOUND COMP EARNED</div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:18,color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#484F58",marginTop:3}}>{BPS_RATE} bps × ${(inboundFundedVol/1000).toFixed(0)}K</div>
              </div>
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid #21262D",background:"#0D1117",fontSize:11,color:"#8B949E",lineHeight:1.6}}>
              <strong style={{color:"#F5A623"}}>Read it:</strong> Outbound is what PRMG can't do that you sent away — you got <strong style={{color:"#F5A623"}}>${outboundFeesEarned.toLocaleString()}</strong> in referral fees but missed <strong style={{color:"#E85D75"}}>${outboundLostComp.toLocaleString()}</strong> in PRMG comp. Inbound is what bankers send your way — you earned <strong style={{color:"#06D6A0"}}>${inboundCompEarned.toLocaleString()}</strong> from those. Use this to negotiate product expansion at PRMG, or to evaluate broker/correspondent options.
            </div>
          </div>
        )}

      </div>}

      {/* OVERRIDE & COMP TAB */}
      {prodTab==="override"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          {[
            {label:"ELIGIBLE VOLUME",value:`$${(eligibleVol/1e6).toFixed(2)}M`,color:"#F5A623",sub:"excl. HELOC, 2nd TD"},
            {label:"TOTAL OVERRIDE",value:`$${totalOverride.toLocaleString()}`,color:"#F5A623",sub:`${OVERRIDE_BPS} bps all time`},
            {label:"THIS MONTH",value:`$${monthOverride.toLocaleString()}`,color:"#F5A623",sub:"override due"},
            {label:"SUBMIT BY",value:"15th",color:"#E85D75",sub:"prior month production"},
          ].map(s=>(
            <div key={s.label} style={{background:"#1a1000",border:`1px solid #F5A62344`,borderTop:`3px solid #F5A623`,borderRadius:8,padding:"12px"}}>
              <div style={{fontSize:9,color:"#484F58",letterSpacing:"1px",marginBottom:3}}>{s.label}</div>
              <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:s.color}}>{s.value}</div>
              <div style={{fontSize:10,color:"#484F58",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{background:"#161B22",border:"1px solid #F5A62333",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a1000",borderBottom:"2px solid #F5A623",padding:"10px 16px"}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#F5A623",letterSpacing:"1px"}}>OVERRIDE BREAKDOWN BY LO — {OVERRIDE_BPS} BPS</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["LO","CLOSED LOANS","ELIGIBLE VOL","EXCLUDED","OVERRIDE EARNED"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loOverride.map((lo,i)=>(
                <tr key={lo.name} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:12,color:loColors[i]}}>{lo.name}</div>
                    <div style={{fontSize:10,color:"#484F58"}}>{lo.role}</div>
                  </td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"#E6EDF3",fontWeight:500}}>{lo.closedCount}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>${(lo.eligibleVol/1000).toFixed(0)}K</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:lo.excludedCount>0?"#E85D75":"#484F58"}}>{lo.excludedCount}</td>
                  <td style={{padding:"10px 14px",textAlign:"center"}}>
                    <span style={{fontFamily:"Syne",fontWeight:800,fontSize:14,color:"#F5A623"}}>${lo.override.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:"#1a1000",borderTop:"2px solid #F5A623"}}>
                <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#F5A623"}}>TOTAL OVERRIDE</td>
                <td style={{padding:"10px 14px",textAlign:"center",color:"#8B949E"}}>{closed.length}</td>
                <td style={{padding:"10px 14px",textAlign:"center",color:"#06D6A0",fontWeight:500}}>${(eligibleVol/1000).toFixed(0)}K</td>
                <td style={{padding:"10px 14px",textAlign:"center",color:"#484F58"}}>{closed.filter(f=>!isEligible(f)).length}</td>
                <td style={{padding:"10px 14px",textAlign:"center",fontFamily:"Syne",fontWeight:800,fontSize:16,color:"#F5A623"}}>${totalOverride.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#4A90D9",letterSpacing:"1px"}}>MY PERSONAL LO COMP — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:11,color:"#484F58"}}>your files only · {BPS_RATE} bps default</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3",fontSize:11}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"#8B949E",fontSize:11}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"#06D6A0",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"#484F58"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"#8B949E",fontSize:11}}>{f.bps||BPS_RATE}</td>
                  <td style={{padding:"10px 14px",color:"#4A90D9",fontWeight:500,fontFamily:"Syne"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid #4A90D9"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#4A90D9"}}>MY TOTAL PERSONAL COMP</td>
                  <td style={{padding:"10px 14px",color:"#484F58",fontSize:11}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:800,fontSize:16,color:"#4A90D9"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"#30363D",fontSize:12}}>No personal closed files yet.</div>}
        </div>
      </div>}

      {/* MY COMP TAB */}
      {prodTab==="mycomp"&&isLO&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#4A90D9",letterSpacing:"1px"}}>MY PERSONAL COMP — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:11,color:"#484F58"}}>your closed files only · {BPS_RATE} bps default</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#161B22",borderBottom:"1px solid #30363D"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:10,color:"#484F58",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid #21262D",background:i%2===0?"#0D1117":"#161B22"}}>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#E6EDF3",fontSize:11}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"#8B949E",fontSize:11}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"#06D6A0",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"#484F58"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"#8B949E",fontSize:11}}>{f.bps||BPS_RATE}</td>
                  <td style={{padding:"10px 14px",color:"#4A90D9",fontWeight:500,fontFamily:"Syne"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid #4A90D9"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#4A90D9"}}>MY TOTAL COMP</td>
                  <td style={{padding:"10px 14px",color:"#484F58",fontSize:11}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:800,fontSize:16,color:"#4A90D9"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"#30363D",fontSize:12}}>No personal closed files yet.</div>}
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
const LEVEL_COLOR = { critical:"#E85D75", warn:"#F5A623", normal:"#7EC8A4", done:"#484F58", missing:"#30363D" };

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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,fontSize:10}}>
        <span style={{fontFamily:"DM Mono",color:done?"#484F58":c,whiteSpace:"nowrap"}}>
          <b style={{fontWeight:500,letterSpacing:".5px"}}>{s.short}</b>{" "}
          <span style={{color:done?"#30363D":"#8B949E"}}>{mon(s.date)}</span>
          {done&&<span style={{marginLeft:4,fontSize:8.5}}>
            {s.outcome==="met"?"✓":s.outcome==="waived"?"⚑":s.outcome==="missed"?"✕":"—"}</span>}
        </span>
        {!done&&(
          <span style={{fontFamily:"DM Mono",color:late?"#E85D75":"#6E7681",textAlign:"right",whiteSpace:"nowrap"}}>
            {act&&<span style={{color:late?"#E85D75":"#8B949E"}}>
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
        <div style={{display:"flex",gap:10,fontSize:9.5,color:"#484F58",fontFamily:"DM Mono",flexWrap:"wrap",
          borderTop:"1px solid #161B22",paddingTop:5}}>
          {st.ctc?.date&&<span>CTC <span style={{color:LEVEL_COLOR[st.ctc.level]}}>{mon(st.ctc.date)}</span></span>}
          {coe&&<span>COE <span style={{color:LEVEL_COLOR[st.coe.level]}}>{mon(coe)}</span></span>}
          {cd&&<span title="Último día para emitir el CD — 3 días hábiles antes del cierre, por ley">
            CD by <span style={{color:"#BD65E8"}}>{mon(cd)}</span></span>}
        </div>
      )}
      {conflicts.length>0&&(
        <div style={{fontSize:9.5,fontFamily:"DM Mono",color:"#E85D75"}}>
          ⚠ {conflicts.length} {conflicts.length===1?"conflicto de fechas":"conflictos de fechas"}
        </div>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ───
function ContingencyPanel({file,profile,onSave}){
  const box = file.contingencies||{};
  const [state,setState]=useState(file.state||"NV");
  const [d,setD]=useState({
    contractAccepted:box.contractAccepted||"", appraisalContingency:box.appraisalContingency||"",
    loanContingency:box.loanContingency||"", ctcTarget:box.ctcTarget||"",
    coe:box.coe||file.closing||"", fundingDate:box.fundingDate||"",
  });
  const [openId,setOpenId]=useState(null);
  const [oc,setOc]=useState("met"); const [ocDate,setOcDate]=useState(""); const [ocNote,setOcNote]=useState("");
  const [showDerived,setShowDerived]=useState(false);

  const fs={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",
    padding:"7px 9px",fontSize:12,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};

  // Preview against what is being typed, not against what was last saved.
  const draft={...file,state,contingencies:{...box,...d}};
  const rows=allContingencyStatus(draft);
  const conflicts=contingencyConflicts(draft);
  const derived=Object.values(derivedStageDeadlines(draft)).sort((a,b)=>a.startBy<b.startBy?-1:1);
  const cd=d.coe?cdIssueDeadline(d.coe):null;
  const basis=CONTRACT_DAY_BASIS[state];

  const save=()=>{
    onSave({state,contingencies:{...box,...Object.fromEntries(
      Object.entries(d).map(([k,v])=>[k,okDate(v)])),capturedAt:today()}});
  };
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
        <div style={{fontSize:9.5,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>{label}</div>
        <input type="date" value={d[key]} onChange={e=>setD({...d,[key]:e.target.value})}
          style={{...fs,borderColor:typing?"#F5A623":"#30363D"}}/>
        {typing&&<div style={{fontSize:9,color:"#F5A623",marginTop:3}}>escribiendo el año…</div>}
        {!typing&&hint&&<div style={{fontSize:9,color:"#30363D",marginTop:3}}>{hint}</div>}
      </div>
    );
  };

  return (
    <div style={{background:"rgba(232,93,117,.04)",border:"1px solid #E85D7533",borderRadius:8,
      padding:14,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#E85D75",letterSpacing:"1px"}}>⏱ CONTINGENCIAS</span>
        <span style={{fontSize:9.5,color:"#6E7681"}}>
          el reloj corre desde la aceptación del contrato, no desde hoy
        </span>
      </div>

      {/* STATE — decides whether the contract counts calendar or business days */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10,alignItems:"end"}}>
        <div>
          <div style={{fontSize:9.5,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>ESTADO</div>
          <select value={state} onChange={e=>setState(e.target.value)} style={fs}>
            {US_STATES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{fontSize:10,color:basis==="business"?"#F5A623":"#6E7681",paddingBottom:8}}>
          {basis==="business"
            ? "FL cuenta DÍAS HÁBILES en el contrato — la misma contingencia da otra fecha"
            : `${state} cuenta días de calendario en el contrato`}
        </div>
      </div>

      {/* THE ANCHOR */}
      <div style={{borderLeft:"2px solid #E85D75",paddingLeft:10}}>
        {field("contractAccepted","FECHA DE ACEPTACIÓN DEL CONTRATO",
          "Todo se cuenta desde aquí. Si el archivo pasó días en Under Contract, ya se gastaron.")}
      </div>

      {/* CONTRACT — deposit at risk */}
      <div>
        <div style={{fontSize:9.5,color:"#E85D75",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          DEL CONTRATO · el depósito está en riesgo
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {field("appraisalContingency","TASACIÓN")}
          {field("loanContingency","PRÉSTAMO")}
        </div>
      </div>

      {/* DELIVERY CHAIN */}
      <div>
        <div style={{fontSize:9.5,color:"#F5A623",letterSpacing:"1px",marginBottom:6,fontWeight:500}}>
          CADENA DE ENTREGA · credibilidad y per diem
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {field("ctcTarget","CTC")}
          {field("coe","COE")}
          {field("fundingDate","FONDEO")}
        </div>
        {cd&&(
          <div style={{marginTop:8,background:"rgba(189,101,232,.08)",border:"1px solid #BD65E844",
            borderRadius:6,padding:"8px 10px",fontSize:10.5,color:"#BD65E8",fontFamily:"DM Mono"}}>
            CD debe estar RECIBIDO el {cd} — 3 días hábiles antes del cierre, por ley.
            <div style={{color:"#8B949E",fontSize:9.5,marginTop:3}}>
              Cuenta sábados y salta domingos y feriados federales. Si se manda por correo, sale el {cdMailDeadline(d.coe)}.
            </div>
          </div>
        )}
      </div>

      <button className="hov" onClick={save}
        style={{background:"#E85D75",color:"#0D1117",borderRadius:6,padding:"9px 0",fontFamily:"DM Mono",
          fontSize:11.5,fontWeight:500,border:"none",cursor:"pointer"}}>GUARDAR FECHAS</button>

      {/* CONFLICTS */}
      {conflicts.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:9.5,color:"#E85D75",letterSpacing:"1px",fontWeight:500}}>
            ⚠ {conflicts.length} {conflicts.length===1?"CONFLICTO":"CONFLICTOS"}
          </div>
          {conflicts.map((c,i)=>(
            <div key={i} style={{fontSize:10.5,color:c.sev==="critical"?"#E85D75":"#F5A623",
              background:"#0D1117",border:`1px solid ${c.sev==="critical"?"#E85D7544":"#F5A62344"}`,
              borderRadius:5,padding:"7px 9px",lineHeight:1.45}}>{c.es}</div>
          ))}
        </div>
      )}

      {/* RESULTS PER CONTINGENCY */}
      {rows.some(r=>r.date)&&(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontSize:9.5,color:"#484F58",letterSpacing:"1px"}}>RESULTADO POR CONTINGENCIA</div>
          {rows.filter(r=>r.date).map(r=>{
            const ext=contingencyExtensionCount(file,r.id);
            return (
              <div key={r.id} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:5,padding:"8px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:LEVEL_COLOR[r.level],fontWeight:500,minWidth:38}}>{r.short}</span>
                  <span style={{fontSize:10.5,color:"#8B949E"}}>{r.date}</span>
                  {r.contractDays!==null&&<span style={{fontSize:9,color:r.contractDays<0?"#E85D75":"#30363D"}}>
                    {r.contractDays} días {r.basis==="business"?"hábiles":"cal."} del contrato
                    {r.contractDays<0?" ⚠":""}</span>}
                  <span style={{fontSize:9.5,color:r.outcomeMeta.color,marginLeft:"auto"}}>
                    {r.outcomeMeta.es}{ext>0?` ·${ext}×`:""}
                  </span>
                  <button className="hov" onClick={()=>setOpenId(openId===r.id?null:r.id)}
                    style={{background:"#21262D",border:"1px solid #30363D",borderRadius:4,color:"#8B949E",
                      fontSize:9,padding:"3px 7px",cursor:"pointer",fontFamily:"DM Mono"}}>
                    {openId===r.id?"✕":"REGISTRAR"}
                  </button>
                </div>
                {r.depositAtRisk&&(
                  <div style={{fontSize:9.5,color:"#E85D75",marginTop:5}}>
                    Venció sin registrar resultado. El depósito está expuesto.
                  </div>
                )}
                {openId===r.id&&(
                  <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:7}}>
                    <select value={oc} onChange={e=>setOc(e.target.value)} style={fs}>
                      {CONTINGENCY_OUTCOMES.filter(o=>o.id!=="pending").map(o=>
                        <option key={o.id} value={o.id}>{o.es}</option>)}
                    </select>
                    {outcomeById(oc).requiresNewDate&&(
                      <div>
                        <div style={{fontSize:9,color:"#F5A623",marginBottom:3}}>
                          Fecha nueva — requiere addendum firmado
                        </div>
                        <input type="date" value={ocDate} onChange={e=>setOcDate(e.target.value)} style={fs}/>
                      </div>
                    )}
                    {outcomeById(oc).note_es&&(
                      <div style={{fontSize:9.5,color:outcomeById(oc).color}}>{outcomeById(oc).note_es}</div>
                    )}
                    <input value={ocNote} onChange={e=>setOcNote(e.target.value)}
                      placeholder="Nota — qué pasó, quién lo confirmó" style={fs}/>
                    <button className="hov" onClick={()=>record(r.id)}
                      disabled={outcomeById(oc).requiresNewDate&&!ocDate}
                      style={{background:outcomeById(oc).requiresNewDate&&!ocDate?"#161B22":"#21262D",
                        color:outcomeById(oc).requiresNewDate&&!ocDate?"#30363D":"#7EC8A4",borderRadius:5,
                        padding:"7px 0",fontSize:10.5,fontFamily:"DM Mono",
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
            style={{background:"transparent",border:"none",color:"#4A90D9",fontSize:10,
              fontFamily:"DM Mono",cursor:"pointer",padding:0}}>
            {showDerived?"▾":"▸"} FECHAS TOPE DERIVADAS ({derived.length} etapas)
          </button>
          {showDerived&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:9,color:"#30363D",marginBottom:3,lineHeight:1.5}}>
                Calculadas hacia atrás desde cada contingencia, con el techo de cada etapa —
                el peor caso, no el promedio.
              </div>
              {derived.map(r=>{
                const late=r.startBy<today();
                return (
                  <div key={r.stage} style={{display:"flex",gap:8,fontSize:10,fontFamily:"DM Mono",
                    color:late?"#E85D75":"#8B949E",alignItems:"baseline"}}>
                    <span style={{minWidth:70,color:late?"#E85D75":"#E6EDF3"}}>{r.startBy}</span>
                    <span style={{flex:1}}>{r.stage}{r.legal?" ⚖":""}</span>
                    <span style={{color:"#484F58",fontSize:9}}>{r.owner||""}</span>
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
          <div style={{fontSize:9.5,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>HISTORIAL</div>
          {(file.contingencyLog||[]).slice().reverse().map((e,i)=>(
            <div key={i} style={{fontSize:10,color:"#6E7681",display:"flex",gap:7,marginBottom:3}}>
              <span style={{color:"#484F58",minWidth:70}}>{e.at}</span>
              <span style={{color:outcomeById(e.outcome).color,minWidth:70}}>
                {contingencyById(e.id)?.short} {outcomeById(e.outcome).es}
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
  );
}

function DetailModal({file,profile,onClose,onSave,onDelete,onAdvance,onCloseFile,onReopen,onPrep,onArchive,onRestore,onContinuePrep,isClosed}){
  const isAdmin = profile?.role === "admin";
  const isAssistant = profile?.role === "assistant";
  const [showHistory, setShowHistory] = useState(false);
  const [note,setNote]=useState(file.note||"");
  const [closing,setClosing]=useState(file.closing||"");
  const [stage,setStage]=useState(file.stage);
  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan||""));
  const [bps,setBps]=useState(String(file.bps||""));
  const [loAssigned,setLoAssigned]=useState(file.lo||"Jose Del Valle");
  const [referralPartner,setReferralPartner]=useState(file.referralPartner||"");
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
  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};

  // Live fee calculations for referred-out files
  const finalLoanForCalc = parseInt(outFinalLoan)||parseInt(loanAmt)||file.loan||0;
  const feeEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * REFERRAL_FEE_BPS / 10000) : 0;
  const wouldHaveEarned = outStatus === "Closed (Funded)" ? Math.round(finalLoanForCalc * (parseInt(bps)||BPS_RATE) / 10000) : 0;
  const lostComp = wouldHaveEarned - feeEarned;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>
              {file.borrower}
              {isInbound && <span title="Inbound referral" style={{marginLeft:8,fontSize:12,color:"#FFD166"}}>🤝 INBOUND</span>}
            </div>
            <div style={{fontSize:12,color:"#8B949E"}}>{loanType} · ${parseInt(loanAmt||0).toLocaleString()}</div>
            {isClosed&&<div style={{marginTop:4,fontSize:11,color:"#06D6A0",fontWeight:500}}>✓ CLOSED — {file.closedAt}</div>}
            {isReferredOut&&<div style={{marginTop:4,fontSize:11,color:"#A78BFA",fontWeight:500}}>🔀 REFERRED OUT — {ro.bankerCompany||"external bank"}</div>}
            {(phone || email) && (
              <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
                {phone && (
                  <a href={`tel:${phone.replace(/[^\d+]/g,"")}`} className="hov"
                    title="Tap to call"
                    style={{background:"rgba(74,144,217,.1)",border:"1px solid #4A90D955",borderRadius:5,padding:"4px 9px",color:"#4A90D9",fontSize:11,fontFamily:"DM Mono",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                    📱 {phone}
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="hov"
                    title="Tap to email"
                    style={{background:"rgba(189,101,232,.1)",border:"1px solid #BD65E855",borderRadius:5,padding:"4px 9px",color:"#BD65E8",fontSize:11,fontFamily:"DM Mono",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                    ✉ {email}
                  </a>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#484F58",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN TYPE</div>
            <select value={loanType} onChange={e=>setLoanType(e.target.value)} style={fs2}>
              {LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(lt=><option key={lt}>{lt}</option>)}</optgroup>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN AMOUNT</div>
            <input value={loanAmt} onChange={e=>setLoanAmt(e.target.value)} placeholder="350000" style={fs2}/>
          </div>
          {isAdmin && (
            <div>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BPS COMP <span style={{color:"#F5A623"}}>· admin</span></div>
              <input value={bps} onChange={e=>setBps(e.target.value)} placeholder="150" style={{...fs2,color:"#F5A623"}}/>
            </div>
          )}
          {isAdmin && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"#484F58",marginTop:2}}>
                Leave BPS blank to use branch default ({BPS_RATE} bps) · FL = 175 · NHF/NV = 150 · HELOC = flat fee
              </div>
            </div>
          )}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN OFFICER</div>
            <select value={loAssigned} onChange={e=>setLoAssigned(e.target.value)} style={fs2}>
              {LO_LIST.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>REFERRAL PARTNER</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)} placeholder="Agent name, CPA, SmartBee, walk-in..." style={fs2}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={fs2}/>
          </div>
          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="borrower@email.com" style={fs2}/>
          </div>
        </div>

        {/* CONTINGENCIES — captured at Full Application, anchored to the contract */}
        {!inPrep && !isReferredOut && (atOrPastFullApp(stage) || hasContingencies(file)) && (
          <ContingencyPanel file={file} profile={profile} onSave={onSave}/>
        )}

        {/* INBOUND REFERRAL SECTION — when file came from another banker */}
        {isInbound && (
          <div style={{background:"rgba(255,209,102,.06)",border:"1px solid #FFD16644",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#FFD166",letterSpacing:"1px"}}>🤝 INBOUND — REFERRING BANKER</span>
              <span style={{fontSize:10,color:"#8B949E"}}>who sent you this deal</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                <input value={inBankerName} onChange={e=>setInBankerName(e.target.value)} placeholder="John Doe" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                <input value={inBankerCompany} onChange={e=>setInBankerCompany(e.target.value)} placeholder="XYZ Mortgage" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>📱 BANKER PHONE</div>
                <input type="tel" value={inBankerPhone} onChange={e=>setInBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>✉ BANKER EMAIL</div>
                <input type="email" value={inBankerEmail} onChange={e=>setInBankerEmail(e.target.value)} placeholder="banker@company.com" style={fs2}/>
              </div>
            </div>
            {(inBankerPhone || inBankerEmail) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                {inBankerPhone && (
                  <a href={`tel:${inBankerPhone.replace(/[^\d+]/g,"")}`}
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"#FFD166",fontSize:11,fontFamily:"DM Mono",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {inBankerEmail && (
                  <a href={`mailto:${inBankerEmail}`}
                    style={{background:"rgba(255,209,102,.1)",border:"1px solid #FFD16655",borderRadius:5,padding:"4px 9px",color:"#FFD166",fontSize:11,fontFamily:"DM Mono",textDecoration:"none"}}>
                    ✉ Email banker
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {inPrep&&(()=>{
          const p=file.prep||{}; const r=prepReasonById(p.reason);
          const dtr=prepDaysToReview(file); const age=prepAge(file); const locked=prepLocked(file);
          return(
            <div style={{background:"rgba(126,200,164,.06)",border:"1px solid #7EC8A444",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#7EC8A4",letterSpacing:"1px"}}>⏸ IN PREPARATION</div>
              <div style={{fontSize:12,color:"#E6EDF3"}}>{r.label}</div>
              <div style={{fontSize:11,color:"#8B949E"}}>
                Review {p.reviewOn||"—"} · <span style={{color:dtr<=0?"#E85D75":"#484F58"}}>{dtr>0?`in ${dtr}d`:dtr===0?"today":`${Math.abs(dtr)}d overdue`}</span>
              </div>
              <div style={{fontSize:11,color:locked?"#E85D75":"#484F58"}}>
                {age}d in preparation / {PREP_MAX_DAYS} max{p.reschedules>0?` · rescheduled ${p.reschedules}×`:""}
              </div>
              <div style={{fontSize:11,color:"#484F58"}}>Returns to: <span style={{color:"#8B949E"}}>{p.prevStage||"Lead Inquiry"}</span></div>
              {p.note&&<div style={{fontSize:11,color:"#6E7681",fontStyle:"italic",borderTop:"1px solid #21262D",paddingTop:7}}>{p.note}</div>}
            </div>
          );
        })()}

        {!isClosed&&!inPrep&&<div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>STAGE</div>
          <select value={stage} onChange={e=>{setStage(e.target.value);onSave({stage:e.target.value, stageEnteredAt:today(), daysInStage:0});}}
            style={{background:"#0D1117",border:`1px solid ${ph.color}`,borderRadius:6,color:ph.color,padding:"8px 10px",fontSize:13,fontFamily:"DM Mono",width:"100%"}}>
            {ALL_STAGES.map((s,i)=><option key={i} value={s.stage} style={{color:s.phase.color,background:"#0D1117"}}>[{s.phase.short}] {s.stage}</option>)}
            <optgroup label="── Bank-to-Bank Referral ──">
              <option value={REFERRED_OUT_STAGE} style={{color:"#A78BFA",background:"#0D1117"}}>🔀 REFERRED OUT — EXTERNAL BANK</option>
            </optgroup>
          </select>
        </div>}

        {/* OUTBOUND REFERRAL SECTION — when stage = REFERRED OUT */}
        {isReferredOut && (
          <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #A78BFA44",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#A78BFA",letterSpacing:"1px"}}>🔀 OUTBOUND — RECEIVING BANKER</span>
              <span style={{fontSize:10,color:"#8B949E"}}>who you sent this deal to</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                <input value={outBankerName} onChange={e=>setOutBankerName(e.target.value)} placeholder="Jane Smith" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                <input value={outBankerCompany} onChange={e=>setOutBankerCompany(e.target.value)} placeholder="ABC Mortgage" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>📱 BANKER PHONE</div>
                <input type="tel" value={outBankerPhone} onChange={e=>setOutBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={fs2}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>✉ BANKER EMAIL</div>
                <input type="email" value={outBankerEmail} onChange={e=>setOutBankerEmail(e.target.value)} placeholder="banker@company.com" style={fs2}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>REFERRAL REASON</div>
                <select value={outReason} onChange={e=>setOutReason(e.target.value)} style={fs2}>
                  <option value="">-- Select reason --</option>
                  {REFERRAL_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>STATUS</div>
                <select value={outStatus} onChange={e=>setOutStatus(e.target.value)} style={fs2}>
                  {REFERRAL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>CLOSE DATE (AT BANKER)</div>
                <input type="date" value={outCloseDate} onChange={e=>setOutCloseDate(e.target.value)} style={fs2}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>FINAL LOAN AMOUNT AT BANKER <span style={{color:"#484F58",fontWeight:400}}>· (may differ from original)</span></div>
                <input value={outFinalLoan} onChange={e=>setOutFinalLoan(e.target.value)} placeholder={String(file.loan||"350000")} style={fs2}/>
              </div>
            </div>
            {(outBankerPhone || outBankerEmail) && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                {outBankerPhone && (
                  <a href={`tel:${outBankerPhone.replace(/[^\d+]/g,"")}`}
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"#A78BFA",fontSize:11,fontFamily:"DM Mono",textDecoration:"none"}}>
                    📱 Call banker
                  </a>
                )}
                {outBankerEmail && (
                  <a href={`mailto:${outBankerEmail}`}
                    style={{background:"rgba(167,139,250,.1)",border:"1px solid #A78BFA55",borderRadius:5,padding:"4px 9px",color:"#A78BFA",fontSize:11,fontFamily:"DM Mono",textDecoration:"none"}}>
                    ✉ Email banker
                  </a>
                )}
              </div>
            )}
            {/* Live fee calc — admin only */}
            {isAdmin && outStatus === "Closed (Funded)" && (
              <div style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:6,padding:12,marginTop:4}}>
                <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:8}}>COMP CALCULATION</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:9,color:"#484F58",marginBottom:2}}>FEE EARNED ({REFERRAL_FEE_BPS} BPS)</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:15,color:"#F5A623"}}>${feeEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#484F58",marginBottom:2}}>WOULD HAVE ({parseInt(bps)||BPS_RATE} BPS)</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:15,color:"#8B949E"}}>${wouldHaveEarned.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#484F58",marginBottom:2}}>LOST COMP</div>
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:15,color:"#E85D75"}}>${lostComp.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isClosed && isAdmin ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(6,214,160,.06)",border:"1px solid #06D6A044",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#06D6A0",letterSpacing:"1px",marginBottom:5,fontWeight:500}}>ACTUAL CLOSE DATE <span style={{color:"#484F58"}}>· editable</span></div>
              <input type="date" value={closedAt} onChange={e=>setClosedAt(e.target.value)}
                style={{background:"transparent",border:"none",color:"#06D6A0",fontSize:13,fontFamily:"DM Mono",width:"100%",fontWeight:500}}/>
              <div style={{fontSize:9,color:"#484F58",marginTop:4,letterSpacing:"0.5px"}}>The month this counts toward production</div>
            </div>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"#8B949E",fontSize:13,fontFamily:"DM Mono",width:"100%"}}/>
              <div style={{fontSize:9,color:"#484F58",marginTop:4,letterSpacing:"0.5px"}}>Original target date</div>
            </div>
          </div>
        ) : !isReferredOut ? (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>CLOSING DATE</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"#E6EDF3",fontSize:13,fontFamily:"DM Mono",width:"100%"}}/>
            </div>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>{isClosed ? "CLOSED" : "DAYS IN STAGE"}</div>
              <div style={{fontSize:isClosed?14:24,fontFamily:"Syne",fontWeight:800,color:isClosed?"#06D6A0":(stageUrgency(file).level==="late"?"#E85D75":stageUrgency(file).level==="watch"?"#F5A623":"#E6EDF3")}}>
                {isClosed ? file.closedAt : (daysInStage(file) ?? "—")}
              </div>
              {!isClosed && (()=>{ const c=stageClock(file.stage,file); return (
                <div style={{fontSize:9,color:"#484F58",marginTop:4,letterSpacing:"0.5px"}}>
                  {c ? `target ${c.warn}d · ceiling ${c.late}d` : ""}
                  {fileAge(file)!==null ? ` · ${fileAge(file)}d total` : ""}
                </div>
              );})()}
            </div>
          </div>
        ) : null}

        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>
              NOTES <span style={{color:"#30363D"}}>· STATUS · BLOCKER · NEXT</span>
            </div>
            <div style={{
              fontSize:10,
              color: note.length > 200 ? "#E85D75" : note.length > 100 ? "#F5A623" : "#484F58",
              fontFamily:"DM Mono",
              letterSpacing:"0.5px"
            }}>
              {note.length}{note.length > 200 ? " · too long" : note.length > 100 ? " · keep it short" : ""}
            </div>
          </div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
            placeholder={isReferredOut ? "Status update from receiving banker..." : "Subm 4/12 · UW queue · review by 4/15"}
            style={{background:"#0D1117",border:`1px solid ${note.length > 200 ? "#E85D75" : "#30363D"}`,borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:12,fontFamily:"DM Mono",width:"100%",resize:"none"}}/>
          <div style={{fontSize:9,color:"#484F58",marginTop:4,letterSpacing:"0.5px"}}>
            Need help? Click <span style={{color:"#8B949E"}}>❓ HELP</span> at top for the full notes guide & abbreviations.
          </div>
        </div>

        {(file.lastEditedBy || (file.history && file.history.length > 0)) && (
          <div style={{background:"#0D1117",borderRadius:8,padding:12,border:"1px solid #21262D"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>ACTIVITY</div>
              <button onClick={()=>setShowHistory(s=>!s)}
                style={{background:"transparent",border:"none",color:"#8B949E",fontSize:10,fontFamily:"DM Mono",cursor:"pointer",letterSpacing:"1px"}}>
                {showHistory ? "HIDE ↑" : "SHOW ALL ↓"}
              </button>
            </div>
            {file.lastEditedBy && (
              <div style={{fontSize:11,color:"#8B949E",marginTop:6}}>
                Last edited by <span style={{color:"#E6EDF3",fontWeight:500}}>{file.lastEditedBy.name}</span> · <span style={{color:"#484F58"}}>{timeAgo(file.lastEditedAt)}</span>
              </div>
            )}
            {file.createdBy && (
              <div style={{fontSize:11,color:"#484F58",marginTop:2}}>
                Created by {file.createdBy.name} · {timeAgo(file.createdAt)}
              </div>
            )}
            {showHistory && file.history && file.history.length > 0 && (
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #21262D",display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {[...file.history].reverse().map((h,i)=>(
                  <div key={i} style={{fontSize:11,color:"#8B949E",display:"flex",gap:8}}>
                    <span style={{color:"#484F58",minWidth:75,fontSize:10}}>{timeAgo(h.at)}</span>
                    <span style={{color:"#E6EDF3",fontWeight:500,minWidth:90}}>{h.name?.split(" ")[0] || "?"}</span>
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

        {/* FOOTER */}
        <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="hov" onClick={()=>{
            const patch = {
              note: (note||"").trim(),
              closing,
              type: loanType,
              loan: parseInt(loanAmt) || file.loan,
              lo: (loAssigned || JOSE_LO).trim(),
              referralPartner: (referralPartner||"").trim() || null,
              phone: (phone||"").trim() || null,
              email: (email||"").trim() || null,
            };
            if(isAdmin) patch.bps = parseInt(bps)||null;
            if(isAdmin && isClosed && closedAt) patch.closedAt = closedAt;
            // Persist outbound referral data when stage is REFERRED_OUT
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
            // Persist inbound referring banker
            if(isInbound){
              patch.referringBanker = {
                bankerName: (inBankerName||"").trim(),
                bankerCompany: (inBankerCompany||"").trim(),
                bankerPhone: (inBankerPhone||"").trim(),
                bankerEmail: (inBankerEmail||"").trim(),
              };
            }
            onSave(patch);
            onClose();
          }}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>SAVE</button>
          {archivedFile?(
            <button className="hov" onClick={onRestore}
              style={{flex:2,background:"#21262D",color:"#7EC8A4",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #7EC8A4",cursor:"pointer"}}>↩ RESTORE</button>
          ):inPrep?(
            <>
              <button className="hov" onClick={onContinuePrep}
                style={{flex:1,background:"rgba(74,144,217,.1)",color:"#4A90D9",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #4A90D9",cursor:"pointer"}}>✓ CONTINUE</button>
              <button className="hov" disabled={prepLocked(file)} onClick={onPrep}
                title={prepLocked(file)?`Locked at ${PREP_MAX_DAYS} days — return it or archive it`:"Set a new review date"}
                style={{flex:1,background:prepLocked(file)?"#161B22":"rgba(245,166,35,.1)",color:prepLocked(file)?"#30363D":"#F5A623",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:`1px solid ${prepLocked(file)?"#21262D":"#F5A623"}`,cursor:prepLocked(file)?"not-allowed":"pointer"}}>↻ RESCHEDULE</button>
              <button className="hov" onClick={onArchive}
                style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #30363D",cursor:"pointer"}}>🗄 ARCHIVE</button>
            </>
          ):isClosed?(
            <button className="hov" onClick={onReopen}
              style={{flex:2,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>REOPEN FILE</button>
          ):isReferredOut?(
            <button className="hov" onClick={()=>{
              if(confirm(`Bring ${file.borrower} back into PRMG pipeline? This will reset stage to Lead Inquiry and clear outbound banker data.`)){
                onSave({stage:"Lead Inquiry", stageEnteredAt:today(), daysInStage:0, referredOut: null});
                onClose();
              }
            }}
              style={{flex:2,background:"#21262D",color:"#A78BFA",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #A78BFA",cursor:"pointer"}}>↩ PULL BACK</button>
          ):(
            <>
              <button className="hov" onClick={onAdvance}
                style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>ADVANCE →</button>
              <button className="hov" onClick={()=>{if(confirm(`Close ${file.borrower}?`))onCloseFile();}}
                style={{flex:1,background:"rgba(6,214,160,.1)",color:"#06D6A0",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #06D6A0",cursor:"pointer"}}>CLOSE ✓</button>
              <button className="hov" onClick={()=>{
                if(confirm(`Refer ${file.borrower} to another bank?\n\nThe file moves to REFERRED OUT. You'll fill in the receiving banker's details next.`)){
                  setStage(REFERRED_OUT_STAGE);
                  onSave({stage:REFERRED_OUT_STAGE, stageEnteredAt:today(), daysInStage:0});
                }
              }}
                title="Refer this file out to another banker"
                style={{flex:1,background:"rgba(167,139,250,.1)",color:"#A78BFA",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #A78BFA",cursor:"pointer"}}>🔀 REFER</button>
              <button className="hov" onClick={onPrep}
                title="Client is alive but not ready to buy yet — park it with a review date"
                style={{flex:1,background:"rgba(126,200,164,.1)",color:"#7EC8A4",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #7EC8A4",cursor:"pointer"}}>⏸ PREP</button>
              <button className="hov" onClick={onArchive}
                title="File is dead — remove it from counts and averages without deleting it"
                style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #30363D",cursor:"pointer"}}>🗄 ARCH</button>
            </>
          )}
          {isAdmin && (
            <button className="hov" onClick={()=>{if(confirm("Delete permanently? This cannot be undone."))onDelete();}}
              title="Admin only — permanently delete this file"
              style={{flex:1,background:"#21262D",color:"#E85D75",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>✕ DEL</button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddModal({profile, onClose, onAdd}){
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
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>NEW FILE</div>
          {isAssistant && (
            <div style={{fontSize:11,color:"#F5A623",marginTop:4,letterSpacing:"0.5px"}}>
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
              <div style={{fontSize:12,color: isInbound ? "#FFD166" : "#E6EDF3",fontFamily:"Syne",fontWeight:700,letterSpacing:"0.5px"}}>
                🤝 This is an inbound referral from another banker
              </div>
              <div style={{fontSize:10,color:"#8B949E",marginTop:2}}>
                Tag this file so you can track who sent it your way + measure reciprocity at year end.
              </div>
            </div>
          </label>

          {/* INBOUND BANKER FIELDS — shown only when checkbox is checked */}
          {isInbound && (
            <div style={{background:"rgba(255,209,102,.04)",border:"1px solid #FFD16633",borderRadius:8,padding:14,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:11,color:"#FFD166",fontFamily:"Syne",fontWeight:700,letterSpacing:"1px",marginBottom:2}}>REFERRING BANKER</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BANKER NAME</div>
                  <input value={inBankerName} onChange={e=>setInBankerName(e.target.value)} placeholder="John Doe" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>COMPANY</div>
                  <input value={inBankerCompany} onChange={e=>setInBankerCompany(e.target.value)} placeholder="XYZ Mortgage" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
                  <input type="tel" value={inBankerPhone} onChange={e=>setInBankerPhone(e.target.value)} placeholder="(702) 555-0000" style={IS}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
                  <input type="email" value={inBankerEmail} onChange={e=>setInBankerEmail(e.target.value)} placeholder="banker@company.com" style={IS}/>
                </div>
              </div>
            </div>
          )}

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BORROWER NAME *</div>
            <input value={borrower} onChange={e=>setBorrower(e.target.value)} placeholder="Full legal name" style={IS} autoFocus/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>📱 PHONE</div>
              <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(702) 555-1234" style={IS}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>✉ EMAIL</div>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="borrower@email.com" style={IS}/>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN AMOUNT</div>
              <input value={loan} onChange={e=>setLoan(e.target.value)} placeholder="350000" style={IS}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN TYPE</div>
              <select value={type} onChange={e=>setType(e.target.value)} style={IS}>
                {LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>STARTING STAGE</div>
            <select value={stage} onChange={e=>setStage(e.target.value)} style={IS}>
              {ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>
              LOAN OFFICER {isAssistant && <span style={{color:"#F5A623"}}>· assigning on behalf of</span>}
            </div>
            <select value={lo} onChange={e=>setLo(e.target.value)} style={IS}>
              {LO_LIST.map(l=><option key={l.name} value={l.name}>{l.name} · {l.role}</option>)}
            </select>
          </div>

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>REFERRAL PARTNER</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)} placeholder="Agent name, CPA, Smart Bee, walk-in..." style={IS}/>
          </div>

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>EXPECTED CLOSING DATE</div>
            <input type="date" value={closing} onChange={e=>setClosing(e.target.value)} style={IS}/>
          </div>

          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>
              NOTES <span style={{color:"#30363D"}}>· STATUS · BLOCKER · NEXT</span>
            </div>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Subm 4/12 · UW queue · review by 4/15" style={IS}/>
          </div>

        </div>

        <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8}}>
          <button className="hov" onClick={()=>{
            if(!borrower.trim()){
              alert("Borrower name is required.");
              return;
            }
            const newFile = {
              id:`f${Date.now()}`,
              borrower:borrower.trim(),
              loan:parseInt(loan)||0,
              type,
              stage,
              daysInStage:0,
              stageEnteredAt: today(),
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
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function HelpModal({profile, onClose}){
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
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#E6EDF3",letterSpacing:"-0.5px"}}>HELP & BEST PRACTICES</div>
            <div style={{fontSize:11,color:"#484F58",letterSpacing:"1px",marginTop:3}}>PIPELINE · MORTGAGE BY DELVALLE · PRMG 541-A</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#484F58",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
        </div>

        <div style={{padding:"12px 24px",borderBottom:"1px solid #21262D",display:"flex",gap:6,flexWrap:"wrap",flexShrink:0,background:"#0D1117"}}>
          {tabs.map(t=>(
            <button key={t.id} className="hov" onClick={()=>setTab(t.id)}
              style={{
                background: tab===t.id ? t.color : "#21262D",
                color: tab===t.id ? "#0D1117" : "#8B949E",
                borderRadius:6, padding:"6px 12px", fontSize:11, fontFamily:"DM Mono", fontWeight:500,
                border:"none", cursor:"pointer"
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {tab==="notes" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:13,color:"#E6EDF3",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#F5A623",marginBottom:8}}>The STATUS · BLOCKER · NEXT format</div>
                <div style={{color:"#8B949E"}}>
                  Every loan note follows three short pieces, separated by the <span style={{color:"#F5A623"}}>·</span> character.
                  Goal: anyone scanning the pipeline can understand a file in 3 seconds.
                </div>
              </div>
              <div style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:8,padding:14}}>
                <div style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:10,fontSize:12}}>
                  <div style={{color:"#F5A623",fontWeight:500}}>STATUS</div>
                  <div style={{color:"#8B949E"}}>One phrase about where the file substantively is right now (not just the stage name).</div>
                  <div style={{color:"#F5A623",fontWeight:500}}>BLOCKER</div>
                  <div style={{color:"#8B949E"}}>The single thing holding it up. If clean, write "<span style={{color:"#06D6A0"}}>none</span>" or "<span style={{color:"#06D6A0"}}>clean</span>".</div>
                  <div style={{color:"#F5A623",fontWeight:500}}>NEXT</div>
                  <div style={{color:"#8B949E"}}>The immediate next action — what + who + by when.</div>
                </div>
              </div>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",marginBottom:10}}>EXAMPLES BY STAGE</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {stage:"Submitted to UW", note:"Subm 4/12 · UW queue · review by 4/15"},
                    {stage:"Conditional Approval", note:"CA 4/14 · 3 conds (PS, VOE, GL) · Bo upload by 4/19"},
                    {stage:"Condition Clearing", note:"Conds in · BS rejected (stale) · Maria reupload by 4/18"},
                    {stage:"Clear to Close", note:"CTC 4/17 · title prelim pending · COE 4/25"},
                  ].map(ex=>(
                    <div key={ex.stage} style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,padding:"8px 12px",background:"#0D1117",borderRadius:6,fontSize:12,alignItems:"center"}}>
                      <div style={{color:"#484F58",fontSize:10,letterSpacing:"1px"}}>{ex.stage.toUpperCase()}</div>
                      <div style={{color:"#06D6A0",fontFamily:"DM Mono"}}>{ex.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab==="abbrev" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:13,color:"#E6EDF3"}}>
              <div style={{color:"#8B949E",lineHeight:1.6}}>
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
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:group.color,marginBottom:8,letterSpacing:"1px"}}>{group.title.toUpperCase()}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:6}}>
                    {group.items.map(([abbr,full])=>(
                      <div key={abbr} style={{display:"flex",gap:10,padding:"6px 10px",background:"#0D1117",borderRadius:5,fontSize:12,alignItems:"center"}}>
                        <span style={{color:group.color,fontFamily:"DM Mono",fontWeight:500,minWidth:55}}>{abbr}</span>
                        <span style={{color:"#8B949E"}}>{full}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab==="workflow" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:13,color:"#E6EDF3",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#06D6A0",marginBottom:8}}>Daily morning routine (5 min)</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>Open the pipeline. Check the <strong style={{color:"#E85D75"}}>CRITICAL</strong> count at the top — files closing in ≤3 days.</li>
                  <li>Check phase tabs (PQ, HH, PR, UW, CP, CL, PC) — any phase with too many files in <strong style={{color:"#F5A623"}}>STALE</strong> status (5d+) needs attention.</li>
                  <li>Click any file showing CRITICAL or STALE → read its note → decide today's action.</li>
                  <li>Update notes for any file you touched yesterday so today's note reflects current state.</li>
                </ol>
              </div>
            </div>
          )}

          {tab==="refs" && (
            <div style={{display:"flex",flexDirection:"column",gap:18,fontSize:13,color:"#E6EDF3",lineHeight:1.6}}>
              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#A78BFA",marginBottom:8}}>🏦 Bank-to-Bank Referrals</div>
                <div style={{color:"#8B949E"}}>
                  When PRMG can't handle a file (product, credit, niche), refer it out to another banker and track everything.
                  When other bankers send you deals, tag the inbound so you can measure reciprocity at year end.
                </div>
              </div>

              <div style={{background:"rgba(167,139,250,.06)",border:"1px solid #A78BFA44",borderRadius:8,padding:14}}>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#A78BFA",marginBottom:8}}>🔀 Outbound — Referring a file OUT</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8,fontSize:12}}>
                  <li>Open the file → change STAGE to <strong style={{color:"#A78BFA"}}>REFERRED OUT — EXTERNAL BANK</strong></li>
                  <li>Fill in the receiving banker's name, company, phone, and email</li>
                  <li>Select a REFERRAL REASON (credit, product, property type, etc.)</li>
                  <li>Set STATUS to "Pending at Banker" while you wait for outcome</li>
                  <li>Once the deal closes, update STATUS to "Closed (Funded)" + enter FINAL LOAN AMOUNT at banker + CLOSE DATE</li>
                  <li>Your <strong style={{color:"#F5A623"}}>{REFERRAL_FEE_BPS} bps referral fee</strong> auto-calculates. Lost comp (vs PRMG comp) shows alongside.</li>
                </ol>
              </div>

              <div style={{background:"rgba(255,209,102,.06)",border:"1px solid #FFD16644",borderRadius:8,padding:14}}>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#FFD166",marginBottom:8}}>🤝 Inbound — A banker sends YOU a file</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8,fontSize:12}}>
                  <li>Click <strong style={{color:"#F5A623"}}>+ NEW FILE</strong> as usual</li>
                  <li>At the top, check the box <strong style={{color:"#FFD166"}}>"This is an inbound referral from another banker"</strong></li>
                  <li>Fill in the referring banker's name, company, phone, and email</li>
                  <li>Continue with normal borrower info → ADD TO PIPELINE</li>
                  <li>The file lives in <strong style={{color:"#FFD166"}}>🤝 INBOUND</strong> tab + the normal pipeline (it has a 🤝 badge on its card)</li>
                  <li>Process and close normally — you earn your full PRMG comp on inbound closed deals</li>
                </ol>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",marginBottom:8}}>Year-end view</div>
                <div style={{color:"#8B949E",fontSize:12,lineHeight:1.7}}>
                  Production → <strong style={{color:"#F5A623"}}>🏦 BANK REFERRALS</strong> tab shows:
                </div>
                <ul style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8,fontSize:12,marginTop:6}}>
                  <li>Outbound totals: # sent out, $ fees earned, $ lost comp</li>
                  <li>Inbound totals: # received, $ closed at PRMG, $ comp earned</li>
                  <li>Reciprocity table: per-banker balance (who's sending who what)</li>
                  <li>Year-end comp impact summary (admin only)</li>
                </ul>
              </div>
            </div>
          )}

          {tab==="roles" && (
            <div style={{display:"flex",flexDirection:"column",gap:16,fontSize:13,color:"#E6EDF3",lineHeight:1.6}}>
              <div style={{color:"#8B949E"}}>
                You are signed in as <strong style={{color:profile.color}}>{profile.name}</strong> with role <strong style={{color:profile.color,textTransform:"uppercase"}}>{profile.role}</strong>.
              </div>
              {[
                {role:"Admin", color:"#4A90D9", who:"Jose Del Valle (Branch Manager)", can:[
                  "Create, edit, advance, close, reopen, and DELETE any file",
                  "See the OVERRIDE & COMP dashboard (25 bps branch override calc)",
                  "Edit the BPS comp on any file (controls LO commission)",
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
                    <div style={{fontFamily:"Syne",fontWeight:700,fontSize:15,color:r.color}}>{r.role.toUpperCase()}</div>
                    <div style={{fontSize:11,color:"#484F58"}}>{r.who}</div>
                  </div>
                  <ul style={{color:"#8B949E",paddingLeft:18,lineHeight:1.7,fontSize:12}}>
                    {r.can.map((c,i)=><li key={i}>{c}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab==="faq" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,fontSize:13,color:"#E6EDF3"}}>
              {[
                {q:"How do I refer a file out to another banker?",
                 a:"Open the file → change STAGE to 'REFERRED OUT — EXTERNAL BANK' (the last option in the stage dropdown). A purple banker info section appears. Fill in banker name, company, phone, email, reason, and status. Save."},
                {q:"How do I track an inbound referral from a banker?",
                 a:"Click '+ NEW FILE'. At the top, check 'This is an inbound referral from another banker'. Fill in the referring banker's info. Add the borrower normally. The file gets a 🤝 badge in the pipeline and shows up under the 🤝 INBOUND tab."},
                {q:"How does the 50 bps referral fee calculate?",
                 a:"When you mark a referred-out file as 'Closed (Funded)' and enter the final loan amount at the banker, the system auto-calculates 50 bps × that loan amount. You'll see this on the BANK REFERRALS dashboard."},
                {q:"What does 'lost comp' mean on the dashboard?",
                 a:"For each referred-out closed deal: lost comp = (your normal PRMG bps × loan) − (50 bps referral fee). It shows what you would have earned if PRMG could have done the deal. Use this to make a case for product expansion."},
                {q:"What's the difference between Referral Partner and Bank Referral?",
                 a:"Referral Partner = the source who sent you the borrower (Smart Bee client, agent, CPA, family member). Tracked on the existing REFERRAL PARTNERS tab. Bank Referral = formal bank-to-bank deal flow with another mortgage banker. Tracked on the new BANK REFERRALS tab. Both can coexist on the same file."},
                {q:"I made a change but don't see SAVED — did it save?",
                 a:"Watch the top-right corner of the header. You'll see ● SAVING… briefly, then ✓ SAVED in green for 2 seconds."},
                {q:"I forgot my password.",
                 a:"On the login screen, type your email, then click FORGOT? next to the password label. Click SEND RESET LINK."},
              ].map((item,i)=>(
                <div key={i} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:8,padding:14}}>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#E85D75",marginBottom:6}}>Q: {item.q}</div>
                  <div style={{color:"#8B949E",fontSize:12,lineHeight:1.6}}>{item.a}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        <div style={{padding:"12px 24px",borderTop:"1px solid #21262D",background:"#0D1117",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>
            v2.1 · DEL VALLE LENDING CO. · BANK REFERRALS
          </div>
          <button onClick={onClose} className="hov"
            style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 18px",fontFamily:"DM Mono",fontSize:11,fontWeight:500,border:"none",cursor:"pointer"}}>
            GOT IT ✓
          </button>
        </div>

      </div>
    </div>
  );
}
