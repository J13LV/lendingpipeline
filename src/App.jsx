import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

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
const PIPELINE_DOC = doc(db, "pipeline", "main");

const APP_PASSWORD = "DelValle2026";
const AUTH_KEY = "dv_pipeline_auth";
const COMM_PIN = "5414";
const BPS_RATE = 150;
const OVERRIDE_RATE = 0.0025;
const JOSE_LO = "Jose Del Valle";
const EXCLUDED_TYPES = ["Lightning Equity Hybrid HELOC","Symmetry HELOC","CE Second Elite",
  "CE Second Expanded Access (ITIN)","CE Second Classic Elite (Piggyback)",
  "FHA Streamline","FHA Streamline High Balance","VA IRRRL","VA IRRRL High Balance",
  "Fannie RefiNow","Freddie Refi Possible","USDA Streamlined Assist","CO CHFA FHA Streamline"];

function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  function attempt() {
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onAuth();
    } else {
      setError(true);
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 600);
    }
  }

  return (
    <div style={{
      background:"#0D1117", minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono','Courier New',monospace"
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
        padding:"40px 36px", width:"100%", maxWidth:400,
        display:"flex", flexDirection:"column", alignItems:"center", gap:24
      }}>
        {/* Logo mark */}
        <div style={{
          width:56, height:56, borderRadius:"50%",
          background:"linear-gradient(135deg,#C8922A,#F5A623)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"Syne", fontWeight:800, fontSize:22, color:"#0D1117"
        }}>DV</div>

        {/* Title */}
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"Syne", fontWeight:800, fontSize:22, color:"#E6EDF3", letterSpacing:"-0.5px"}}>
            PIPELINE
          </div>
          <div style={{fontSize:11, color:"#484F58", letterSpacing:"2px", marginTop:4}}>
            MORTGAGE BY DELVALLE · PRMG 541-A
          </div>
        </div>

        {/* Input */}
        <div className={shake ? "shake" : ""} style={{width:"100%", display:"flex", flexDirection:"column", gap:8}}>
          <div style={{fontSize:11, color:"#484F58", letterSpacing:"1px"}}>ACCESS PASSWORD</div>
          <input
            type="password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            placeholder="Enter password..."
            autoFocus
            style={{
              background:"#0D1117",
              border: error ? "1px solid #E85D75" : "1px solid #30363D",
              borderRadius:8, padding:"12px 14px",
              color:"#E6EDF3", fontSize:14,
              fontFamily:"'DM Mono','Courier New',monospace",
              width:"100%", transition:"border .15s"
            }}
          />
          {error && (
            <div style={{fontSize:12, color:"#E85D75"}}>Incorrect password. Try again.</div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={attempt}
          style={{
            width:"100%", background:"#C8922A", color:"#0D1117",
            borderRadius:8, padding:"13px 0", fontFamily:"DM Mono",
            fontSize:13, fontWeight:500, border:"none", cursor:"pointer",
            transition:"opacity .15s"
          }}
          onMouseOver={e => e.target.style.opacity=".85"}
          onMouseOut={e => e.target.style.opacity="1"}
        >
          ACCESS PIPELINE →
        </button>

        <div style={{fontSize:11, color:"#30363D", textAlign:"center"}}>
          Authorized personnel only · PRMG Branch 541-A
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

const LO_LIST = [
  { name: "Jose Del Valle",   nmls: "2686066", role: "BM/MLO" },
  { name: "Ana Plasencia",    nmls: "",        role: "LO" },
  { name: "Marelis Pinales",  nmls: "",        role: "LO" },
];

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
  const [authed, setAuthed] = useState(false);
  const [files,setFiles]=useState([]);
  const [view,setView]=useState("active");
  const [commUnlocked,setCommUnlocked]=useState(false);
  const [activePhase,setActivePhase]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [detail,setDetail]=useState(null);
  const [loaded,setLoaded]=useState(false);
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | saved | error

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") setAuthed(true);
  }, []);

  useEffect(()=>{
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
  },[]);

  useEffect(()=>{
    if(!loaded)return;
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

  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

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

  const advance=id=>setFiles(p=>p.map(f=>{if(f.id!==id)return f;const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);const n=ALL_STAGES[i+1];return n?{...f,stage:n.stage,daysInStage:0}:f;}));
  const closeFile=id=>{setFiles(p=>p.map(f=>f.id===id?{...f,stage:CLOSED_STAGE,closedAt:new Date().toISOString().split("T")[0],daysInStage:0}:f));setDetail(null);};
  const reopenFile=id=>{setFiles(p=>p.map(f=>f.id===id?{...f,stage:"Welcome Sent",closedAt:null,daysInStage:0}:f));setDetail(null);};
  const updateFile=(id,patch)=>setFiles(p=>p.map(f=>f.id===id?{...f,...patch}:f));
  const deleteFile=id=>{setFiles(p=>p.filter(f=>f.id!==id));setDetail(null);};

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
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
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
          <label className="hov"
            title="Restore your pipeline from a JSON backup file"
            style={{background:"#21262D",color:"#8B949E",borderRadius:6,padding:"8px 12px",fontFamily:"DM Mono",fontSize:11,border:"1px solid #30363D",cursor:"pointer"}}>
            ↑ RESTORE
            <input type="file" accept="application/json,.json" onChange={importBackup} style={{display:"none"}}/>
          </label>
          <button className="hov" onClick={()=>setShowAdd(true)}
            style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"8px 16px",fontFamily:"DM Mono",fontSize:12,fontWeight:500}}>
            + NEW FILE
          </button>
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
        {view==="production"&&<ProductionDashboard files={files} closed={closed} active={active} commUnlocked={commUnlocked} setCommUnlocked={setCommUnlocked}/>}

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

      {detail&&<DetailModal file={detail} onClose={()=>setDetail(null)}
        onSave={p=>{updateFile(detail.id,p);setDetail(f=>({...f,...p}));}}
        onDelete={()=>deleteFile(detail.id)}
        onAdvance={()=>{advance(detail.id);setDetail(f=>{const i=ALL_STAGES.findIndex(s=>s.stage===f.stage);const n=ALL_STAGES[i+1];return n?{...f,stage:n.stage,daysInStage:0}:f;});}}
        onCloseFile={()=>closeFile(detail.id)}
        onReopen={()=>reopenFile(detail.id)}
        isClosed={detail.stage===CLOSED_STAGE}
      />}
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={f=>{setFiles(p=>[...p,f]);setShowAdd(false);}}/>}
    </div>
  );
}


function ProductionDashboard({files,closed,active,commUnlocked,setCommUnlocked}){
  const [pin,setPin]=useState("");
  const [pinError,setPinError]=useState(false);
  const [showPinModal,setShowPinModal]=useState(false);
  const [prodTab,setProdTab]=useState("team"); // team | override | referrals

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

  // LO colors
  const loColors=["#4A90D9","#BD65E8","#06D6A0"];

  function tryPin(){
    if(pin===COMM_PIN){setCommUnlocked(true);setShowPinModal(false);setPin("");}
    else{setPinError(true);setPin("");}
  }

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

      {/* INNER TAB BAR */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[["team","🏆 TEAM PRODUCTION"],["referrals","🤝 REFERRAL PARTNERS"],commUnlocked&&["override","💰 OVERRIDE & COMP"]].filter(Boolean).map(([t,l])=>(
          <button key={t} className="hov" onClick={()=>setProdTab(t)}
            style={{background:prodTab===t?"#F5A623":"#21262D",color:prodTab===t?"#0D1117":"#8B949E",borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:"DM Mono",fontWeight:500}}>
            {l}
          </button>
        ))}
        {!commUnlocked&&(
          showPinModal?(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input type="password" value={pin} onChange={e=>{setPin(e.target.value);setPinError(false);}} onKeyDown={e=>e.key==="Enter"&&tryPin()}
                placeholder="Manager PIN..." maxLength={6} autoFocus
                style={{background:"#0D1117",border:pinError?"1px solid #E85D75":"1px solid #30363D",borderRadius:6,padding:"6px 10px",color:"#E6EDF3",fontSize:12,fontFamily:"DM Mono",width:130}}/>
              <button className="hov" onClick={tryPin} style={{background:"#F5A623",color:"#0D1117",borderRadius:6,padding:"7px 12px",fontFamily:"DM Mono",fontSize:11,fontWeight:500}}>UNLOCK</button>
              <button className="hov" onClick={()=>{setShowPinModal(false);setPin("");setPinError(false);}} style={{background:"#21262D",color:"#8B949E",borderRadius:6,padding:"7px 10px",fontFamily:"DM Mono",fontSize:11}}>✕</button>
              {pinError&&<span style={{fontSize:11,color:"#E85D75"}}>Wrong PIN</span>}
            </div>
          ):(
            <button className="hov" onClick={()=>setShowPinModal(true)}
              style={{background:"rgba(245,166,35,.08)",border:"1px solid #F5A62366",color:"#F5A623",borderRadius:6,padding:"6px 14px",fontSize:11,fontFamily:"DM Mono",marginLeft:"auto"}}>
              🔒 MANAGER VIEW
            </button>
          )
        )}
        {commUnlocked&&<button className="hov" onClick={()=>{setCommUnlocked(false);setProdTab("team");}} style={{background:"#21262D",color:"#8B949E",borderRadius:6,padding:"6px 10px",fontFamily:"DM Mono",fontSize:11,marginLeft:"auto"}}>LOCK</button>}
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
      {prodTab==="override"&&commUnlocked&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

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

        {/* My personal LO comp */}
        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid #4A90D9",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"Syne",fontWeight:700,fontSize:13,color:"#4A90D9",letterSpacing:"1px"}}>MY PERSONAL LO COMP — JOSE DEL VALLE</span>
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
              {closed.filter(f=>f.lo==="Jose Del Valle").map((f,i)=>(
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
            {closed.filter(f=>f.lo==="Jose Del Valle").length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid #4A90D9"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:700,color:"#4A90D9"}}>MY TOTAL PERSONAL COMP</td>
                  <td style={{padding:"10px 14px",color:"#484F58",fontSize:11}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"Syne",fontWeight:800,fontSize:16,color:"#4A90D9"}}>${closed.filter(f=>f.lo==="Jose Del Valle").reduce((s,f)=>s+myComp(f),0).toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {closed.filter(f=>f.lo==="Jose Del Valle").length===0&&<div style={{padding:24,textAlign:"center",color:"#30363D",fontSize:12}}>No personal closed files yet.</div>}
        </div>

      </div>}

    </div>
  );
}


function DetailModal({file,onClose,onSave,onDelete,onAdvance,onCloseFile,onReopen,isClosed}){
  const [note,setNote]=useState(file.note);
  const [closing,setClosing]=useState(file.closing);
  const [stage,setStage]=useState(file.stage);
  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan));
  const [bps,setBps]=useState(String(file.bps||""));
  const [loAssigned,setLoAssigned]=useState(file.lo||"Jose Del Valle");
  const [referralPartner,setReferralPartner]=useState(file.referralPartner||"");
  const [lo,setLo]=useState(file.lo||JOSE_LO);
  const ph=getPhase(stage);
  const fs2={background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:13,fontFamily:"'DM Mono','Courier New',monospace",width:"100%"};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,padding:24,width:"100%",maxWidth:480,display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>{file.borrower}</div>
            <div style={{fontSize:12,color:"#8B949E"}}>{loanType} · ${parseInt(loanAmt||0).toLocaleString()}</div>
            {isClosed&&<div style={{marginTop:4,fontSize:11,color:"#06D6A0",fontWeight:500}}>✓ CLOSED — {file.closedAt}</div>}
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#484F58",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
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
          <div>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>BPS COMP</div>
            <input value={bps} onChange={e=>setBps(e.target.value)} placeholder="150" style={{...fs2,color:"#F5A623"}}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>LOAN OFFICER</div>
            <input value={lo} onChange={e=>setLo(e.target.value)} placeholder="Jose Del Valle" style={fs2}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:10,color:"#484F58",marginTop:2}}>
              Leave BPS blank to use branch default ({BPS_RATE} bps) · FL = 175 · NHF/NV = 150 · HELOC = flat fee
            </div>
          </div>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>CLOSING DATE</div>
            <input type="date" value={closing} onChange={e=>setClosing(e.target.value)}
              style={{background:"transparent",border:"none",color:"#E6EDF3",fontSize:13,fontFamily:"DM Mono",width:"100%"}}/>
          </div>
          <div style={{background:"#0D1117",borderRadius:8,padding:12}}>
            <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:4}}>DAYS IN STAGE</div>
            <div style={{fontSize:24,fontFamily:"Syne",fontWeight:800,color:file.daysInStage>=5?"#E85D75":"#E6EDF3"}}>{file.daysInStage}</div>
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>NOTES</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Add notes..."
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:6,color:"#E6EDF3",padding:"8px 10px",fontSize:12,fontFamily:"DM Mono",width:"100%",resize:"none"}}/>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="hov" onClick={()=>{onSave({note,closing,type:loanType,loan:parseInt(loanAmt)||file.loan,bps:parseInt(bps)||null,lo:lo||JOSE_LO});onClose();}}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500}}>SAVE</button>
          {isClosed?(
            <button className="hov" onClick={onReopen}
              style={{flex:2,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12}}>REOPEN FILE</button>
          ):(
            <>
              <button className="hov" onClick={onAdvance}
                style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12}}>ADVANCE →</button>
              <button className="hov" onClick={()=>{if(confirm(`Close ${file.borrower}?`))onCloseFile();}}
                style={{flex:1,background:"rgba(6,214,160,.1)",color:"#06D6A0",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,border:"1px solid #06D6A0"}}>CLOSE ✓</button>
            </>
          )}
          <button className="hov" onClick={()=>{if(confirm("Delete permanently?"))onDelete();}}
            style={{flex:1,background:"#21262D",color:"#E85D75",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12}}>✕ DEL</button>
        </div>
      </div>
    </div>
  );
}

function AddModal({onClose,onAdd}){
  const [borrower,setBorrower]=useState("");
  const [loan,setLoan]=useState("");
  const [type,setType]=useState("Conventional");
  const [stage,setStage]=useState("Lead Inquiry");
  const [closing,setClosing]=useState("");
  const [note,setNote]=useState("");
  const [lo,setLo]=useState(JOSE_LO);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,padding:24,width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>NEW FILE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["BORROWER NAME *","text",borrower,setBorrower,"Full legal name","1/-1"],["LOAN AMOUNT","text",loan,setLoan,"350000","auto"],["LOAN TYPE","select",type,setType,null,"auto"],["STARTING STAGE","select2",stage,setStage,null,"1/-1"],["LOAN OFFICER","text",lo,setLo,"Jose Del Valle","1/-1"],["EXPECTED CLOSING DATE","date",closing,setClosing,null,"1/-1"],["NOTES","text",note,setNote,"Lead source, agent, key info...","1/-1"]].map(([l,t,v,sv,ph,gc])=>(
            <div key={l} style={{gridColumn:gc}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>{l}</div>
              {t==="select"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}</select>
              :t==="select2"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}</select>:t==="loSelect"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{LO_LIST.map(lo=><option key={lo.name} value={lo.name}>{lo.name} · {lo.role}</option>)}</select>
              :<input type={t==="date"?"date":"text"} value={v} onChange={e=>sv(e.target.value)} placeholder={ph||""} style={IS}/>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={()=>{if(borrower.trim())onAdd({id:`f${Date.now()}`,borrower:borrower.trim(),loan:parseInt(loan)||0,type,stage,daysInStage:0,closing,note,bps:null,lo:lo||JOSE_LO,closedAt:null});}}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
