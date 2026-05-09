import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
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
// Maps Firebase Auth UIDs to internal profile data + role.
// To add/remove team members: create a new Auth user in Firebase Console,
// copy their UID, and add them to this list with role: "admin" | "lo" | "assistant"
const TEAM = {
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

// ─── AUDIT HELPERS ───
// Stamp a file with edit metadata + log an entry to its history (capped at 20 entries)
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

// Format a relative timestamp like "2h ago" / "3d ago" / "just now"
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
      // onAuthStateChanged listener in App() will pick this up
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

// LO_LIST derives from TEAM (admin + lo roles) so the production dashboard
// and detail modals stay in sync when team members are added/removed.
const LO_LIST = Object.entries(TEAM)
  .filter(([_,p]) => p.role === "admin" || p.role === "lo")
  .map(([uid,p]) => ({
    uid,
    name: p.name,
    nmls: p.nmls,
    role: p.role === "admin" ? "BM/MLO" : "LO",
    color: p.color,
  }));

// Excluded loan types from override (per PRMG Pay Plan 02/02/2026)
const OVERRIDE_EXCLUDED = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite","CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)"];
const OVERRIDE_BPS = 25;

const SAMPLE = [
  { id:"f1", lo:"Jose Del Valle", borrower:"Ariel Villalobos", loan:385000, type:"Conventional", stage:"Condition Clearing", daysInStage:3, closing:"2026-04-14", note:"Waiting on updated pay stubs", bps:null, closedAt:null },
  { id:"f2", lo:"Jose Del Valle", borrower:"Maria Santos", loan:420000, type:"FHA", stage:"Appraisal Ordered", daysInStage:6, closing:"2026-04-28", note:"", bps:null, closedAt:null },
  { id:"f3", lo:"Jose Del Valle", borrower:"James Ortega", loan:295000, type:"VA", stage:"Under Contract", daysInStage:2, closing:"2026-05-10", note:"Agent: Anamary APG", bps:null, closedAt:null },
  { id:"f4", lo:"Jose Del Valle", borrower:"Linda Park", loan:510000, type:"Conventional", stage:"Submitted to UW", daysInStage:1, closing:"2026-04-22", note:"", bps:null, closedAt:null },
  { id:"f5", lo:"Jose Del Valle", borrower:"Carlos Mendez", loan:340000, type:"FHA", stage:"Pre-Qualification", daysInStage:0, closing:"2026-05-20", note:"Smart Bee referral", bps:null, closedAt:null },
  { id:"f6", lo:"Jose Del Valle", borrower:"Angela Torres", loan:275000, type:"Conventional", stage:"CD Issued", daysInStage:1, closing:"2026-04-09", note:"3-day wait ends 4/9", bps:null, closedAt:null },
  { id:"f7", lo:"Jose Del Valle", borrower:"David Kim", loan:460000, type:"Conventional", stage:"Doc Collection", daysInStage:4, closing:"2026-05-02", note:"Self-employed — need 2yr biz returns", bps:null, closedAt:null },
  { id:"f8", lo:"Jose Del Valle", borrower:"Rosa Jimenez", loan:318000, type:"FHA", stage:CLOSED_STAGE, daysInStage:0, closing:"2026-03-15", note:"Smooth close. Smart Bee referral.", bps:null, closedAt:"2026-03-15" },
  { id:"f9", lo:"Jose Del Valle", borrower:"Tony Reyes", loan:425000, type:"Conventional", stage:CLOSED_STAGE, daysInStage:0, closing:"2026-03-28", note:"APG Realty. Requested Google review.", bps:null, closedAt:"2026-03-28" },
];

function getPhase(stageName) {
  if (stageName === CLOSED_STAGE) return { id:99, label:"Closed", short:"✓", color:"#06D6A0", bg:"#00281e", stages:[CLOSED_STAGE] };
  return PHASES.find(p => p.stages.includes(stageName)) || PHASES[0];
}
function daysTil(d) { return d ? Math.ceil((new Date(d)-new Date())/86400000) : null; }
function urgency(f) {
  if (f.stage===CLOSED_STAGE) return "closed";
  const d=daysTil(f.closing);
  if(d!==null&&d<=3)return"critical";
  if(d!==null&&d<=7)return"warning";
  if(f.daysInStage>=5)return"stale";
  return"normal";
}

const IS = { background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"9px 12px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%" };

export default function App() {
  const [currentUser, setCurrentUser] = useState(null); // Firebase Auth user object
  const [authReady, setAuthReady] = useState(false);    // Has Firebase finished checking auth state?
  const [files,setFiles]=useState([]);
  const [view,setView]=useState("active");
  const [activePhase,setActivePhase]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const [detail,setDetail]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | saved | error

  // Subscribe to Firebase Auth state — fires whenever user logs in/out
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      // Reset pipeline data when user changes (login/logout)
      if (!user) {
        setFiles([]);
        setLoaded(false);
      }
    });
    return () => unsub();
  }, []);

  // Build profile from currentUser. profile.uid is what we attach to audit log entries.
  const profile = currentUser
    ? { uid: currentUser.uid, email: currentUser.email, ...getProfile(currentUser.uid) }
    : null;
  const isAdmin     = profile?.role === "admin";
  const isLO        = profile?.role === "lo";
  const isAssistant = profile?.role === "assistant";

  useEffect(()=>{
    // Only subscribe to Firestore once the user is authenticated
    if (!currentUser) return;
    // Real-time listener — all devices sync automatically
    const unsub = onSnapshot(PIPELINE_DOC, (snap) => {
      if(snap.exists()){
        const data = snap.data();
        if(data.files && data.files.length > 0){
          setFiles(data.files);
          setLoaded(true);
        } else {
          // Firebase empty — check localStorage for migration
          try {
            const local = localStorage.getItem("pipe_v3");
            if(local){
              const parsed = JSON.parse(local);
              if(parsed && parsed.length > 0){
                setFiles(parsed);
                // Push local data up to Firebase immediately
                setDoc(PIPELINE_DOC, {files: parsed}, {merge:true});
                setLoaded(true);
                return;
              }
            }
          } catch{}
          // First-time user — seed sample data
          setFiles(SAMPLE);
          setDoc(PIPELINE_DOC, {files: SAMPLE}, {merge:true});
          setLoaded(true);
        }
      } else {
        // No Firebase doc yet — migrate from localStorage
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
        // First-time user, no local data — seed sample
        setFiles(SAMPLE);
        setDoc(PIPELINE_DOC, {files: SAMPLE}, {merge:true});
        setLoaded(true);
      }
    }, ()=>{
      // Firebase error — fall back to localStorage
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
    // Save to Firebase — all devices update instantly
    setSaveStatus("saving");
    setDoc(PIPELINE_DOC, {files}, {merge:true}).then(()=>{
      // Also save a local backup mirror — belt and suspenders
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus(s=>s==="saved"?"idle":s), 2000);
    }).catch(()=>{
      // Fallback to localStorage if Firebase fails
      try{localStorage.setItem("pipe_v3",JSON.stringify(files));}catch{}
      setSaveStatus("error");
    });
  },[files,loaded]);

  // Export current pipeline as a JSON backup file (download to user's computer)
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
    a.download = `pipeline-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import a JSON backup file and replace current pipeline (with confirmation)
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
    // Reset the input so the same file can be re-selected later if needed
    event.target.value = "";
  }

  // Loading screen while Firebase Auth is initializing
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

  // Not signed in → show login
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

  const active=files.filter(f=>f.stage!==CLOSED_STAGE);
  const closed=files.filter(f=>f.stage===CLOSED_STAGE);

  const display=(view==="closed"?closed:active)
    .filter(f=>!search||f.borrower.toLowerCase().includes(search.toLowerCase()))
    .filter(f=>!activePhase||getPhase(f.stage).id===activePhase);

  // All file mutations stamp the change with the current user via stampEdit().
  const advance=id=>setFiles(p=>p.map(f=>{
    if(f.id!==id)return f;
    const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);
    const n=ALL_STAGES[i+1];
    if(!n)return f;
    return stampEdit({...f, stage:n.stage, daysInStage:0}, profile, "stage_advanced", {from:f.stage, to:n.stage});
  }));
  const closeFile=id=>{
    setFiles(p=>p.map(f=>{
      if(f.id!==id) return f;
      // Use the file's closing date as the actual funded date.
      // Falls back to today if no closing date was ever set.
      const fundedDate = f.closing || new Date().toISOString().split("T")[0];
      return stampEdit({...f, stage:CLOSED_STAGE, closedAt:fundedDate, daysInStage:0}, profile, "closed", {from:f.stage, closedAt:fundedDate});
    }));
    setDetail(null);
  };
  const reopenFile=id=>{
    setFiles(p=>p.map(f=>f.id===id
      ? stampEdit({...f, stage:"Welcome Sent", closedAt:null, daysInStage:0}, profile, "reopened")
      : f));
    setDetail(null);
  };
  const updateFile=(id,patch)=>setFiles(p=>p.map(f=>{
    if(f.id!==id)return f;
    // Compute a human-readable list of which fields changed
    const changedFields = Object.keys(patch).filter(k=>JSON.stringify(f[k])!==JSON.stringify(patch[k]));
    if(changedFields.length===0)return f;
    return stampEdit({...f, ...patch}, profile, "edited", {fields:changedFields});
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
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Save status indicator — quietly shows the user that data is persisting */}
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

          {/* User pill + logout */}
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

      {/* TAB BAR */}
      <div style={{background:"#161B22",borderBottom:"1px solid #21262D",padding:"10px 24px",display:"flex",gap:8,alignItems:"center",overflowX:"auto"}}>
        {[["ACTIVE PIPELINE",active.length,"active","#4A90D9"],["CLOSED FILES",closed.length,"closed","#06D6A0"]].map(([l,c,v,col])=>(
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


        {/* PRODUCTION DASHBOARD */}
        {view==="production"&&<ProductionDashboard profile={profile} files={files} closed={closed} active={active}/>}

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
                              <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",lineHeight:1.2}}>{f.borrower}</div>
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
                            <span>{f.daysInStage}d in stage</span>
                            {f.closing&&<span style={{color:cd!==null&&cd<=3?"#E85D75":cd!==null&&cd<=7?"#F5A623":"#484F58"}}>
                              {cd===0?"CLOSING TODAY":cd!==null&&cd>0?`Close in ${cd}d`:cd!==null?"PAST DUE":f.closing}
                            </span>}
                          </div>
                          {f.note&&<div style={{fontSize:10,color:"#6E7681",borderTop:"1px solid #21262D",paddingTop:6,fontStyle:"italic"}}>{f.note}</div>}
                          {f.lastEditedBy&&<div style={{fontSize:9,color:"#484F58",letterSpacing:"0.5px",borderTop:f.note?"none":"1px solid #21262D",paddingTop:f.note?0:6}}>
                            Edited by {f.lastEditedBy.name?.split(" ")[0]||"?"} · {timeAgo(f.lastEditedAt)}
                          </div>}
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
        isClosed={detail.stage===CLOSED_STAGE}
      />}
      {showAdd&&<AddModal profile={profile} onClose={()=>setShowAdd(false)} onAdd={f=>{
        const stamped = stampEdit(f, profile, "created");
        setFiles(p=>[...p, {...stamped, createdBy:{uid:profile.uid,name:profile.name}, createdAt:new Date().toISOString()}]);
        setShowAdd(false);
      }}/>}
      {showHelp&&<HelpModal profile={profile} onClose={()=>setShowHelp(false)}/>}
    </div>
  );
}


function ProductionDashboard({profile, files, closed, active}){
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  const [prodTab,setProdTab]=useState("team"); // team | override | referrals | mycomp

  const thisMonth=new Date().toISOString().slice(0,7);
  const closedThisMonth=closed.filter(f=>f.closedAt&&f.closedAt.startsWith(thisMonth));

  // Volume calcs
  const closedVol=closed.reduce((s,f)=>s+(f.loan||0),0);
  const activeVol=active.reduce((s,f)=>s+(f.loan||0),0);
  const monthVol=closedThisMonth.reduce((s,f)=>s+(f.loan||0),0);

  // Per-LO stats (volume + count) — no comp shown
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

  // Override calc (25 bps, excludes HELOC/2nd products per PRMG pay plan)
  const isEligible=f=>!OVERRIDE_EXCLUDED.includes(f.type);
  const overrideComp=f=>isEligible(f)?Math.round((f.loan||0)*OVERRIDE_BPS/10000):0;
  const totalOverride=closed.reduce((s,f)=>s+overrideComp(f),0);
  const monthOverride=closedThisMonth.reduce((s,f)=>s+overrideComp(f),0);
  const eligibleVol=closed.filter(isEligible).reduce((s,f)=>s+(f.loan||0),0);

  // Per-LO override
  const loOverride=LO_LIST.map(lo=>{
    const loClosed=closed.filter(f=>f.lo===lo.name);
    const loEligible=loClosed.filter(isEligible);
    const loVol=loEligible.reduce((s,f)=>s+(f.loan||0),0);
    return {...lo, eligibleVol:loVol, override:Math.round(loVol*OVERRIDE_BPS/10000),
      closedCount:loClosed.length, excludedCount:loClosed.filter(f=>!isEligible(f)).length};
  });

  // Personal LO comp (own files only, 150 bps default)
  const myComp=f=>Math.round((f.loan||0)*(f.bps||BPS_RATE)/10000);
  const myClosedFiles = closed.filter(f=>f.lo===profile.name);
  const myTotalComp = myClosedFiles.reduce((s,f)=>s+myComp(f),0);

  // Referral partner tracker
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

  // ─── MONTHLY PRODUCTION ───
  // Bucket closed files by month (using closedAt). Build a 12-month rolling window
  // ending with the current month. Also group by year for annual breakdown.
  const monthlyMap = {};
  closed.forEach(f=>{
    if(!f.closedAt) return;
    const month = f.closedAt.slice(0,7); // YYYY-MM
    if(!monthlyMap[month]) monthlyMap[month] = {month, units:0, volume:0, files:[]};
    monthlyMap[month].units++;
    monthlyMap[month].volume += (f.loan||0);
    monthlyMap[month].files.push(f);
  });
  // Build last 12 months (oldest → newest, fill in zeros for empty months)
  const last12Months = [];
  const today = new Date();
  for(let i=11; i>=0; i--){
    const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    last12Months.push(monthlyMap[key] || {month:key, units:0, volume:0, files:[]});
  }
  const maxUnits = Math.max(1, ...last12Months.map(m=>m.units));
  const maxVolume = Math.max(1, ...last12Months.map(m=>m.volume));
  // Annual totals
  const yearlyMap = {};
  Object.values(monthlyMap).forEach(m=>{
    const yr = m.month.slice(0,4);
    if(!yearlyMap[yr]) yearlyMap[yr] = {year:yr, units:0, volume:0};
    yearlyMap[yr].units += m.units;
    yearlyMap[yr].volume += m.volume;
  });
  const yearlyList = Object.values(yearlyMap).sort((a,b)=>b.year.localeCompare(a.year));
  // Best/worst month in last 12
  const bestMonth = last12Months.reduce((best,m)=>m.units>best.units?m:best, last12Months[0]);
  const worstMonth = last12Months.filter(m=>m.units>0).reduce((worst,m)=>m.units<worst.units?m:worst, last12Months.find(m=>m.units>0)||last12Months[0]);
  function monthLabel(m){
    const [y,mm] = m.split("-");
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[parseInt(mm)-1]} '${y.slice(2)}`;
  }

  // LO colors — pull from TEAM so colors stay consistent everywhere
  const loColors = LO_LIST.map(lo=>lo.color||"#4A90D9");

  return(
    <div className="fi" style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* BRANCH STATS — always visible */}
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

      {/* INNER TAB BAR — role-based */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
          ["team","🏆 TEAM PRODUCTION"],
          ["monthly","📅 MONTHLY"],
          ["referrals","🤝 REFERRAL PARTNERS"],
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
      </div>}

      {/* MONTHLY PRODUCTION TAB */}
      {prodTab==="monthly"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Headline stats */}
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

        {/* 12-month UNITS bar chart */}
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

        {/* 12-month VOLUME bar chart */}
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

        {/* Monthly detail table */}
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

        {/* Annual summary */}
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

      {/* REFERRAL PARTNERS TAB */}
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

      {/* OVERRIDE & COMP TAB — manager only */}
      {prodTab==="override"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Override summary */}
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

        {/* Override by LO */}
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

        {/* My personal LO comp — dynamic to current admin */}
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

      {/* MY COMP TAB — for LOs to see their own comp without seeing team-wide override */}
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


function DetailModal({file,profile,onClose,onSave,onDelete,onAdvance,onCloseFile,onReopen,isClosed}){
  const isAdmin = profile?.role === "admin";
  const isAssistant = profile?.role === "assistant";
  const [showHistory, setShowHistory] = useState(false);
  const [note,setNote]=useState(file.note);
  const [closing,setClosing]=useState(file.closing);
  const [stage,setStage]=useState(file.stage);
  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan));
  const [bps,setBps]=useState(String(file.bps||""));
  const [loAssigned,setLoAssigned]=useState(file.lo||"Jose Del Valle");
  const [referralPartner,setReferralPartner]=useState(file.referralPartner||"");
  const [closedAt,setClosedAt]=useState(file.closedAt||"");
  const [lo,setLo]=useState(file.lo||JOSE_LO);
  const ph=getPhase(stage);
  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* HEADER — stays pinned at top */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>{file.borrower}</div>
            <div style={{fontSize:12,color:"#8B949E"}}>{loanType} · ${parseInt(loanAmt||0).toLocaleString()}</div>
            {isClosed&&<div style={{marginTop:4,fontSize:11,color:"#06D6A0",fontWeight:500}}>✓ CLOSED — {file.closedAt}</div>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#484F58",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
        </div>

        {/* SCROLLABLE BODY — form fields, stage, dates, notes, activity */}
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
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN OFFICER</div>
            <input value={lo} onChange={e=>setLo(e.target.value)} placeholder="Jose Del Valle" style={fs2}/>
          </div>
          {isAdmin && (
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"#484F58",marginTop:2}}>
                Leave BPS blank to use branch default ({BPS_RATE} bps) · FL = 175 · NHF/NV = 150 · HELOC = flat fee
              </div>
            </div>
          )}
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LO ASSIGNED</div>
            <select value={loAssigned} onChange={e=>setLoAssigned(e.target.value)} style={fs2}>
              {LO_LIST.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>REFERRAL PARTNER</div>
            <input value={referralPartner} onChange={e=>setReferralPartner(e.target.value)} placeholder="Agent name, CPA, SmartBee, walk-in..." style={fs2}/>
          </div>
        </div>
        {!isClosed&&<div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>STAGE</div>
          <select value={stage} onChange={e=>{setStage(e.target.value);onSave({stage:e.target.value,daysInStage:0});}}
            style={{background:"#0D1117",border:`1px solid ${ph.color}`,borderRadius:6,color:ph.color,padding:"8px 10px",fontSize:13,fontFamily:"DM Mono",width:"100%"}}>
            {ALL_STAGES.map((s,i)=><option key={i} value={s.stage} style={{color:s.phase.color,background:"#0D1117"}}>[{s.phase.short}] {s.stage}</option>)}
          </select>
        </div>}
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
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>CLOSING DATE</div>
              <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
                style={{background:"transparent",border:"none",color:"#E6EDF3",fontSize:13,fontFamily:"DM Mono",width:"100%"}}/>
            </div>
            <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>{isClosed ? "CLOSED" : "DAYS IN STAGE"}</div>
              <div style={{fontSize:isClosed?14:24,fontFamily:"Syne",fontWeight:800,color:isClosed?"#06D6A0":(file.daysInStage>=5?"#E85D75":"#E6EDF3")}}>{isClosed ? file.closedAt : file.daysInStage}</div>
            </div>
          </div>
        )}
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
            placeholder={`Subm 4/12 · UW queue · review by 4/15`}
            style={{background:"#0D1117",border:`1px solid ${note.length > 200 ? "#E85D75" : "#30363D"}`,borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:12,fontFamily:"DM Mono",width:"100%",resize:"none"}}/>
          <div style={{fontSize:9,color:"#484F58",marginTop:4,letterSpacing:"0.5px"}}>
            Need help? Click <span style={{color:"#8B949E"}}>❓ HELP</span> at top for the full notes guide & abbreviations.
          </div>
        </div>

        {/* Activity / audit trail */}
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

        {/* FOOTER — pinned at bottom, always reachable */}
        <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="hov" onClick={()=>{
            // Only include bps in the patch if user is admin (to avoid clobbering it with empty value)
            const patch = {note,closing,type:loanType,loan:parseInt(loanAmt)||file.loan,lo:lo||JOSE_LO,referralPartner};
            if(isAdmin) patch.bps = parseInt(bps)||null;
            // If admin edited the close date on a closed file, include it
            if(isAdmin && isClosed && closedAt) patch.closedAt = closedAt;
            onSave(patch);
            onClose();
          }}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>SAVE</button>
          {isClosed?(
            <button className="hov" onClick={onReopen}
              style={{flex:2,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>REOPEN FILE</button>
          ):(
            <>
              <button className="hov" onClick={onAdvance}
                style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>ADVANCE →</button>
              <button className="hov" onClick={()=>{if(confirm(`Close ${file.borrower}?`))onCloseFile();}}
                style={{flex:1,background:"rgba(6,214,160,.1)",color:"#06D6A0",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #06D6A0",cursor:"pointer"}}>CLOSE ✓</button>
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
  // Default LO to the current user if they're admin/lo, otherwise Jose
  const defaultLo = (profile?.role === "admin" || profile?.role === "lo") ? profile.name : JOSE_LO;
  const [lo,setLo]=useState(defaultLo);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:440,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",flexShrink:0}}>
          <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>NEW FILE</div>
        </div>

        {/* SCROLLABLE BODY */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            ["BORROWER NAME *","text",borrower,setBorrower,"Full legal name","1/-1"],
            ["LOAN AMOUNT","text",loan,setLoan,"350000","auto"],
            ["LOAN TYPE","select",type,setType,null,"auto"],
            ["STARTING STAGE","select2",stage,setStage,null,"1/-1"],
            ["LOAN OFFICER","text",lo,setLo,"Jose Del Valle","1/-1"],
            ["REFERRAL PARTNER","text",referralPartner,setReferralPartner,"Agent name, CPA, Smart Bee, walk-in...","1/-1"],
            ["EXPECTED CLOSING DATE","date",closing,setClosing,null,"1/-1"],
            ["NOTES","text",note,setNote,"Subm 4/12 · UW queue · review by 4/15","1/-1"],
          ].map(([l,t,v,sv,ph,gc])=>(
            <div key={l} style={{gridColumn:gc}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>{l}</div>
              {t==="select"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}</select>
              :t==="select2"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}</select>:t==="loSelect"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{LO_LIST.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}</select>
              :<input type={t==="date"?"date":"text"} value={v} onChange={e=>sv(e.target.value)} placeholder={ph||""} style={IS}/>}
            </div>
          ))}
        </div>
        </div>
        {/* END SCROLLABLE BODY */}

        {/* FOOTER — pinned at bottom */}
        <div style={{padding:"14px 24px",borderTop:"1px solid #21262D",background:"#161B22",flexShrink:0,display:"flex",gap:8}}>
          <button className="hov" onClick={()=>{if(borrower.trim())onAdd({id:`f${Date.now()}`,borrower:borrower.trim(),loan:parseInt(loan)||0,type,stage,daysInStage:0,closing,note,bps:null,lo:lo||JOSE_LO,referralPartner:referralPartner.trim()||null,closedAt:null});}}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"none",cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
// ─── HELP MODAL ───
// In-app reference guide. Tabbed layout: notes format, abbreviations, role-specific
// workflows, and FAQs. Content adapts based on user's role.
function HelpModal({profile, onClose}){
  const [tab, setTab] = useState("notes");
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  const isAssistant = profile?.role === "assistant";

  const tabs = [
    {id:"notes", label:"📝 Notes Format", color:"#F5A623"},
    {id:"abbrev", label:"📖 Abbreviations", color:"#4A90D9"},
    {id:"workflow", label:"🔄 Daily Workflow", color:"#06D6A0"},
    {id:"roles", label:"👥 Roles & Access", color:"#BD65E8"},
    {id:"faq", label:"❓ FAQ", color:"#E85D75"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,width:"100%",maxWidth:720,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

        {/* HEADER */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #21262D",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:"#E6EDF3",letterSpacing:"-0.5px"}}>HELP & BEST PRACTICES</div>
            <div style={{fontSize:11,color:"#484F58",letterSpacing:"1px",marginTop:3}}>PIPELINE · MORTGAGE BY DELVALLE · PRMG 541-A</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#484F58",fontSize:20,cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
        </div>

        {/* TAB BAR */}
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

        {/* SCROLLABLE BODY */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {/* NOTES FORMAT TAB */}
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
                    {stage:"Doc Collection", note:"Need 2yr biz returns · Bo on vacation · resume 4/22"},
                    {stage:"Appraisal Ordered", note:"Appr ordered 4/10 · pending sched · expected by 4/20"},
                  ].map(ex=>(
                    <div key={ex.stage} style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:10,padding:"8px 12px",background:"#0D1117",borderRadius:6,fontSize:12,alignItems:"center"}}>
                      <div style={{color:"#484F58",fontSize:10,letterSpacing:"1px"}}>{ex.stage.toUpperCase()}</div>
                      <div style={{color:"#06D6A0",fontFamily:"DM Mono"}}>{ex.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:14,color:"#E6EDF3",marginBottom:10}}>RULES OF THUMB</div>
                <ul style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>Keep notes <strong style={{color:"#F5A623"}}>under 100 characters</strong> when possible. Counter turns yellow at 100, red at 200.</li>
                  <li>Use <strong style={{color:"#E6EDF3"}}>dates</strong>, not "yesterday" or "last week" — dates won't get stale.</li>
                  <li>Always include a <strong style={{color:"#E6EDF3"}}>NEXT action with a deadline</strong>. "Waiting" is not an action.</li>
                  <li>If you need long context, put it in the <strong style={{color:"#E6EDF3"}}>Activity log</strong> via stage advances or use a separate document.</li>
                  <li>Notes are for <strong style={{color:"#E6EDF3"}}>scanning</strong>, not storytelling.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ABBREVIATIONS TAB */}
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
                  ["Redisc","Redisclose"],["Locked","Rate locked"],["Floating","Rate floating"],
                  ["UW","Underwriting / Underwriter"],["Conds","Conditions"],
                ]},
                {title:"People", color:"#BD65E8", items:[
                  ["LO","Loan Officer"],["LP","Loan Processor"],["TC","Title Coordinator"],
                  ["UW","Underwriter"],["Bo","Borrower"],["CB","Co-borrower"],
                  ["RA","Real estate agent"],["LA","Listing agent"],["BA","Buyer's agent"],
                ]},
                {title:"Status", color:"#06D6A0", items:[
                  ["Clean","No blockers"],["Pending","Waiting on someone"],["Blocked","Stuck, needs intervention"],
                  ["Rejected","Doc/cond rejected, needs redo"],["Stale","Doc expired, need fresh"],
                  ["Cleared","Condition satisfied"],["Funded","Loan funded"],["Recorded","Recorded with county"],
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

          {/* WORKFLOW TAB */}
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

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#06D6A0",marginBottom:8}}>Adding a new file</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>Click <strong style={{color:"#F5A623"}}>+ NEW FILE</strong> at the top.</li>
                  <li>Required: Borrower name. Everything else can be filled in later.</li>
                  <li><strong>Always fill in REFERRAL PARTNER</strong> if you know it — this feeds the leaderboard.</li>
                  <li>Set the starting STAGE based on where the file actually is (most new files start at "Lead Inquiry" or "Pre-Qualification").</li>
                  <li>Click ADD TO PIPELINE.</li>
                </ol>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#06D6A0",marginBottom:8}}>Advancing a file through stages</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>Two ways to advance: click the <strong style={{color:"#E6EDF3"}}>ADVANCE →</strong> button on the card to go to the next stage, OR open the file and select a specific stage from the dropdown.</li>
                  <li>The "days in stage" counter resets to 0 every time you advance — useful for catching files that are sitting too long.</li>
                  <li><strong>Always update the note</strong> when you advance a stage so the new note reflects the new reality.</li>
                </ol>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#06D6A0",marginBottom:8}}>Closing a file</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>When the loan funds, click <strong style={{color:"#06D6A0"}}>CLOSE ✓</strong> on the card or in the file detail.</li>
                  <li>The file moves to CLOSED FILES tab and counts toward your monthly production.</li>
                  <li>If you closed by accident, open the file from the CLOSED FILES tab and click <strong style={{color:"#F5A623"}}>REOPEN FILE</strong>.</li>
                </ol>
              </div>

              <div>
                <div style={{fontFamily:"Syne",fontWeight:700,fontSize:16,color:"#06D6A0",marginBottom:8}}>Weekly backup (Friday EOD)</div>
                <ol style={{color:"#8B949E",paddingLeft:18,lineHeight:1.8}}>
                  <li>Click <strong style={{color:"#E6EDF3"}}>↓ BACKUP</strong> at the top right. A JSON file downloads automatically.</li>
                  <li>Move the file to a Google Drive folder named <strong>Pipeline Backups</strong>.</li>
                  <li>That's it. Five seconds of work, total disaster recovery.</li>
                </ol>
              </div>

            </div>
          )}

          {/* ROLES TAB */}
          {tab==="roles" && (
            <div style={{display:"flex",flexDirection:"column",gap:16,fontSize:13,color:"#E6EDF3",lineHeight:1.6}}>
              <div style={{color:"#8B949E"}}>
                You are signed in as <strong style={{color:profile.color}}>{profile.name}</strong> with role <strong style={{color:profile.color,textTransform:"uppercase"}}>{profile.role}</strong>.
                Here's what each role can do:
              </div>

              {[
                {role:"Admin", color:"#4A90D9", who:"Jose Del Valle (Branch Manager)", can:[
                  "Create, edit, advance, close, reopen, and DELETE any file",
                  "See the OVERRIDE & COMP dashboard (25 bps branch override calc)",
                  "Edit the BPS comp on any file (controls LO commission)",
                  "Restore the entire pipeline from a backup file",
                  "View the My Personal LO Comp report",
                  "See all LOs' production data on the Team Production tab",
                ]},
                {role:"LO (Loan Officer)", color:"#BD65E8", who:"Ana M Plasencia, Marelis Pinales", can:[
                  "Create, edit, advance, and close any file in the branch",
                  "See the FULL pipeline (all LOs' files visible for collaboration)",
                  "View MY COMP tab — your personal commission breakdown for closed files",
                  "Cannot see other LOs' personal comp",
                  "Cannot edit BPS rates (set by admin)",
                  "Cannot delete files (ask Jose to delete)",
                  "Cannot restore the pipeline from a backup",
                ]},
                {role:"Assistant", color:"#F5A623", who:"Laura de Armas", can:[
                  "Create, edit, and advance files",
                  "Update notes, closing dates, stage progression",
                  "See the full pipeline and team production stats (counts/volume)",
                  "Cannot see ANY compensation data (BPS, override, personal comp)",
                  "Cannot delete files",
                  "Cannot restore the pipeline from a backup",
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

          {/* FAQ TAB */}
          {tab==="faq" && (
            <div style={{display:"flex",flexDirection:"column",gap:14,fontSize:13,color:"#E6EDF3"}}>
              {[
                {q:"I made a change but don't see SAVED — did it save?",
                 a:"Watch the top-right corner of the header. You'll see ● SAVING… briefly, then ✓ SAVED in green for 2 seconds. If you see ⚠ SAVE FAILED in red, your internet may be down — the change is still safe on your computer and will retry when you reconnect."},
                {q:"How do I see who edited a file last?",
                 a:"Open any loan and scroll to the ACTIVITY section near the bottom. You'll see 'Last edited by [name] · [time ago]' plus a 'SHOW ALL' link to expand the full history (last 20 actions)."},
                {q:"I forgot my password.",
                 a:"On the login screen, type your email, then click FORGOT? next to the password label. Click SEND RESET LINK. You'll get an email with a reset link in 1-2 minutes (check spam if not seen). Set a new password and sign in."},
                {q:"How do I switch users on the same computer?",
                 a:"Click SIGN OUT in the top-right header. Confirm the prompt. The login screen reappears — sign in with the other account's email + password."},
                {q:"What's the difference between CLOSE and DELETE?",
                 a:"CLOSE ✓ marks a loan as funded — moves it to the CLOSED FILES tab, counts toward production stats, and stays in your records. DELETE ✕ permanently removes the file (admin only) — use this only for test entries or files entered by mistake."},
                {q:"What's a Critical/Warning/Stale loan?",
                 a:"CRITICAL = closing in 3 days or less (red border). WARNING = closing in 7 days or less (orange). STALE = sitting in the same stage 5+ days (gray). These are visual cues so you know which files need attention today."},
                {q:"How do I add a referral partner to track who sends business?",
                 a:"On any new or existing file, fill in the REFERRAL PARTNER field with the source name (e.g., 'Smart Bee Client', 'APG Realty Group', 'Anamary Plasencia'). The Production → Referral Partners tab automatically builds a leaderboard. Be consistent with naming so the leaderboard groups correctly."},
                {q:"My pipeline disappeared / data looks wrong.",
                 a:"First, refresh the browser with Ctrl+Shift+R. If still wrong, ask Jose — he can restore from the most recent weekly backup using the ↑ RESTORE button (admin only). All your work since the last backup will need to be re-entered, so this is a last resort."},
                {q:"Who do I ask if something breaks?",
                 a:"Send Jose a screenshot of the issue and what you were doing right before it broke. Most issues are 5-minute fixes."},
              ].map((item,i)=>(
                <div key={i} style={{background:"#0D1117",border:"1px solid #21262D",borderRadius:8,padding:14}}>
                  <div style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#E85D75",marginBottom:6}}>Q: {item.q}</div>
                  <div style={{color:"#8B949E",fontSize:12,lineHeight:1.6}}>{item.a}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div style={{padding:"12px 24px",borderTop:"1px solid #21262D",background:"#0D1117",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px"}}>
            v2.0 · DEL VALLE LENDING CO.
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
