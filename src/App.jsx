import { useState, useEffect } from "react";

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

const SAMPLE = [
  { id:"f1", borrower:"Ariel Villalobos", loan:385000, type:"Conventional", stage:"Condition Clearing", daysInStage:3, closing:"2026-04-14", note:"Waiting on updated pay stubs", closedAt:null },
  { id:"f2", borrower:"Maria Santos", loan:420000, type:"FHA", stage:"Appraisal Ordered", daysInStage:6, closing:"2026-04-28", note:"", closedAt:null },
  { id:"f3", borrower:"James Ortega", loan:295000, type:"VA", stage:"Under Contract", daysInStage:2, closing:"2026-05-10", note:"Agent: Anamary APG", closedAt:null },
  { id:"f4", borrower:"Linda Park", loan:510000, type:"Conventional", stage:"Submitted to UW", daysInStage:1, closing:"2026-04-22", note:"", closedAt:null },
  { id:"f5", borrower:"Carlos Mendez", loan:340000, type:"FHA", stage:"Pre-Qualification", daysInStage:0, closing:"2026-05-20", note:"Smart Bee referral", closedAt:null },
  { id:"f6", borrower:"Angela Torres", loan:275000, type:"Conventional", stage:"CD Issued", daysInStage:1, closing:"2026-04-09", note:"3-day wait ends 4/9", closedAt:null },
  { id:"f7", borrower:"David Kim", loan:460000, type:"Conventional", stage:"Doc Collection", daysInStage:4, closing:"2026-05-02", note:"Self-employed — need 2yr biz returns", closedAt:null },
  { id:"f8", borrower:"Rosa Jimenez", loan:318000, type:"FHA", stage:CLOSED_STAGE, daysInStage:0, closing:"2026-03-15", note:"Smooth close. Smart Bee referral.", closedAt:"2026-03-15" },
  { id:"f9", borrower:"Tony Reyes", loan:425000, type:"Conventional", stage:CLOSED_STAGE, daysInStage:0, closing:"2026-03-28", note:"APG Realty. Requested Google review.", closedAt:"2026-03-28" },
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
  const [files,setFiles]=useState(SAMPLE);
  const [view,setView]=useState("active");
  const [activePhase,setActivePhase]=useState(null);
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [detail,setDetail]=useState(null);
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{(async()=>{try{const r=await window.storage.get("pipe_v3");if(r?.value)setFiles(JSON.parse(r.value));}catch{}setLoaded(true);})();},[]);
  useEffect(()=>{if(!loaded)return;(async()=>{try{await window.storage.set("pipe_v3",JSON.stringify(files));}catch{}})();},[files,loaded]);

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
          <input placeholder="Search borrower..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{background:"#0D1117",border:"1px solid #30363D",borderRadius:6,padding:"7px 12px",color:"#E6EDF3",fontSize:12,width:170}}/>
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

function DetailModal({file,onClose,onSave,onDelete,onAdvance,onCloseFile,onReopen,isClosed}){
  const [note,setNote]=useState(file.note);
  const [closing,setClosing]=useState(file.closing);
  const [stage,setStage]=useState(file.stage);
  const [loanType,setLoanType]=useState(file.type);
  const [loanAmt,setLoanAmt]=useState(String(file.loan));
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
          <button className="hov" onClick={()=>{onSave({note,closing,type:loanType,loan:parseInt(loanAmt)||file.loan});onClose();}}
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
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fi" style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,padding:24,width:"100%",maxWidth:440,display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"Syne",fontWeight:800,fontSize:18,color:"#E6EDF3"}}>NEW FILE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["BORROWER NAME *","text",borrower,setBorrower,"Full legal name","1/-1"],["LOAN AMOUNT","text",loan,setLoan,"350000","auto"],["LOAN TYPE","select",type,setType,null,"auto"],["STARTING STAGE","select2",stage,setStage,null,"1/-1"],["EXPECTED CLOSING DATE","date",closing,setClosing,null,"1/-1"],["NOTES","text",note,setNote,"Lead source, agent, key info...","1/-1"]].map(([l,t,v,sv,ph,gc])=>(
            <div key={l} style={{gridColumn:gc}}>
              <div style={{fontSize:10,color:"#484F58",letterSpacing:"1px",marginBottom:5}}>{l}</div>
              {t==="select"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{LOAN_TYPE_GROUPS.map(g=><optgroup key={g.group} label={g.group}>{g.types.map(x=><option key={x}>{x}</option>)}</optgroup>)}</select>
              :t==="select2"?<select value={v} onChange={e=>sv(e.target.value)} style={IS}>{ALL_STAGES.map((s,i)=><option key={i} value={s.stage}>[{s.phase.short}] {s.stage}</option>)}</select>
              :<input type={t==="date"?"date":"text"} value={v} onChange={e=>sv(e.target.value)} placeholder={ph||""} style={IS}/>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="hov" onClick={()=>{if(borrower.trim())onAdd({id:`f${Date.now()}`,borrower:borrower.trim(),loan:parseInt(loan)||0,type,stage,daysInStage:0,closing,note,closedAt:null});}}
            style={{flex:2,background:"#F5A623",color:"#0D1117",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12,fontWeight:500}}>ADD TO PIPELINE</button>
          <button className="hov" onClick={onClose}
            style={{flex:1,background:"#21262D",color:"#8B949E",borderRadius:7,padding:"10px 0",fontFamily:"DM Mono",fontSize:12}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
