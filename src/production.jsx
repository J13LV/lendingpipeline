// ═══════════════════════════════════════════════════════════════════
//  production.jsx · la pantalla de PRODUCCIÓN
//
//  Salió de App.jsx tal cual. App la carga con React.lazy: el código de
//  scorecards, mezcla, payroll y comp solo se baja cuando alguien abre
//  esta pestaña.
// ═══════════════════════════════════════════════════════════════════
import { useState } from "react";
import { TX, PL, P, CURRENT_LANG } from "./idioma";
import {
  BPS_RATE, LO_LIST, COMP_ROSTER, REFERRAL_FEE_BPS, CLOSED_STAGE, getPhase, fmtLoan, fileSeverity, TRAINER_NAME, REFERRED_OUT_STAGE, LOAN_TYPE_GROUPS,
} from "./catalogo";
import {
  BARRETT_CUTOVER, productsWorked, specialtyLabel, specialtyCatalog, payrollPeriodLabel, fileCompDollars, currentPayrollPeriod, today, overdueReport, losWithoutCompRule, fileCompBps, categoryLabel, baseProductLabel, TASK_SEVERITY, LO_STAGES, DPA_STRUCTURES, teamLeadShare, specDetailSummary, specDetailCoverage, specDetail, setSpecDetail, productionByState, productionByProduct, productionByLo, productionByGroup, productionByDpa, productScorecard, payrollSummary, payrollRequestText, partnerLeaderboard, overdueByOwner, mixVsPlan, loanSplit, lendersBySpecialty, lenderVerdict, lenderScorecard, lenderConcentration, leadStandardReport, ladderCeiling, fundedDate, fileClock, emptySpecDetail, dpaForm, buildPayrollRequest, branchCostPerFile, STAGE_THRESHOLDS,
} from "./pipelineCore";

export default function ProductionDashboard({profile, files, closed, active, referredOut, inbound, onOpenFile, onBulkUpdate, payrollLog, onLogPayroll, onClosePeriod, onDeletePayrollLog, dpaDetails, onSaveDpa}){
  const isAdmin = profile?.role === "admin";
  const isLO = profile?.role === "lo";
  // Igual que la linea 856. Estaban separadas y por eso Laura veia
  // Monthly y Referral Partners y Tina no.
  const isAssistant = profile?.role === "assistant" || profile?.role === "processor";
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
  const [duenoFiltro,setDuenoFiltro]=useState(null);
  const [mtgPhase,setMtgPhase]=useState(null);
  const [prodTab,setProdTab]=useState(isAssistant?"scorecard":"team");
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
      {/* De 150 a 168: con la escala nueva, ocho caracteres de Syne en
          --fs-9 no caben en 150px. */}
      <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(168px,1fr))",gap:10}}>
        {[
          {label:PL("TOTAL FILES"),value:files.length,color:"#4A90D9"},
          {label:PL("CLOSED LOANS"),value:closed.length,color:"#06D6A0"},
          {label:PL("ACTIVE PIPELINE"),value:active.length,color:"#F5A623"},
          {label:PL("CLOSED THIS MONTH"),value:closedThisMonth.length,color:"#BD65E8"},
          {label:PL("PIPELINE VOLUME"),value:`$${(activeVol/1e6).toFixed(2)}M`,color:"#4A90D9"},
          {label:PL("FUNDED VOLUME"),value:`$${(closedVol/1e6).toFixed(2)}M`,color:"#06D6A0"},
          {label:PL("MONTH VOLUME"),value:`$${(monthVol/1000).toFixed(0)}K`,color:"#BD65E8"},
          {label:PL("BRANCH VOLUME"),value:`$${((closedVol+activeVol)/1e6).toFixed(2)}M`,color:"#F5A623"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--s1)",border:`1px solid ${s.color}33`,
            borderTop:`3px solid ${s.color}`,borderRadius:8,padding:"12px",
            // De red: nada se sale de su caja aunque el número crezca.
            // `containerType` va AQUÍ, en la tarjeta: las unidades cqw del
            // número se miden contra su contenedor, no contra sí mismas.
            overflow:"hidden",minWidth:0,containerType:"inline-size"}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",
              marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.label}</div>
            {/* $26.63M en Syne a --fs-9 medía más que la caja y se salía por
                el lado. clamp() lo deja encoger SOLO si no cabe: el día que
                cruces los $100M o alguien baje la escala, el número se ajusta
                en vez de romper la tarjeta. */}
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,
              fontSize:"clamp(var(--fs-6), 15cqw, var(--fs-9))",
              color:s.color,whiteSpace:"nowrap",letterSpacing:"-0.5px"}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* INNER TAB BAR — now includes BANK REFERRALS */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
          !isAssistant && ["team",PL("🏆 TEAM PRODUCTION")],
          ["overdue",TX("overdueTab")],
          !isAssistant && ["monthly",PL("📅 MONTHLY")],
          !isAssistant && ["referrals",PL("🤝 REFERRAL PARTNERS")],
          !isAssistant && ["bankrefs",PL("🏦 BANK REFERRALS")],
          (isLO||isAdmin) && ["mycomp",PL("💵 MY COMP")],
          isAdmin && ["override",PL("💰 OVERRIDE & COMP")],
          ["scorecard",TX("scorecardTab")],
          ["mix",TX("mixTab")],
        ].filter(Boolean).map(([t,l])=>(
          <button key={t} className="hov" onClick={()=>setProdTab(t)}
            style={{background:prodTab===t?"var(--gold)":"var(--s2)",color:prodTab===t?"var(--bg)":"var(--t2)",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",fontWeight:500}}>
            {l}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",alignSelf:"center"}}>
          {prodTab==="mycomp" ? "" : isAdmin ? PL("ADMIN VIEW · ALL DATA VISIBLE") : isLO ? PL("LO VIEW · YOUR COMP ONLY") : PL("ASSISTANT VIEW · NO COMP")}
        </div>
      </div>

      {/* EL ESTÁNDAR DE RESPUESTA */}
      {prodTab==="team"&&(()=>{
        const r=leadStandardReport(files);
        if(!r.total) return null;
        const col=r.pct===null?"var(--t3)":r.pct>=90?"#7EC8A4":r.pct>=70?"#F5A623":"#E85D75";
        return (
          <div style={{background:"var(--s1)",border:`1px solid ${col}44`,
            borderTop:`3px solid ${col}`,borderRadius:10,padding:"14px 18px",
            display:"flex",flexDirection:"column",gap:9}}>
            <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
                color:col,letterSpacing:"1px"}}>{TX("leadReportTitle")}</span>
              <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",
                color:col,marginLeft:"auto"}}>
                {r.pct===null?"—":r.pct+"%"}
              </span>
            </div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>
              {TX("leadCounts",{m:r.met,b:r.broken,o:r.open})}
              {r.avgDays!==null?` · ${TX("leadAvg",{n:r.avgDays})}`:""}
            </div>
            {/* Los que llevan más tiempo, arriba. Es la lista de llamadas. */}
            {r.rows.filter(x=>x.open).slice(0,6).map(x=>(
              <div key={x.file.id} style={{display:"flex",gap:10,alignItems:"baseline",
                fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)"}}>
                <span style={{color:x.met===false?"var(--bad)":"var(--t3)",minWidth:34}}>{x.days}d</span>
                <span style={{color:"var(--t1)",flex:1,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.file.borrower}</span>
                <span style={{color:"var(--t4)",fontSize:"var(--fs-1)"}}>{x.file.lo?.split(" ")[0]||""}</span>
              </div>
            ))}
            <div className="sys">{TX("leadReportLead",{n:r.standard})}</div>
          </div>
        );})()}

      {/* TEAM PRODUCTION TAB */}
      {prodTab==="team"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
          {loStats.map((lo,i)=>(
            <div key={lo.name} className={lo.active?undefined:"ex-miembro"} title={lo.active?undefined:TX("exMemberHint")}
              style={{background:"var(--s1)",border:`1px solid ${loColors[i]}44`,borderRadius:10,overflow:"hidden",order:lo.active?0:1}}>
              <div style={{background:`${loColors[i]}18`,borderBottom:`2px solid ${loColors[i]}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:loColors[i],display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",color:"var(--bg)",flexShrink:0}}>
                  {lo.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:loColors[i]}}>{lo.name}</div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>{lo.role}{!lo.active&&<span className="ex-tag">{TX("exMember")}</span>}</div>
                </div>
              </div>
              <div style={{padding:"12px 14px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {l:PL("CLOSED"),v:lo.closedCount,c:loColors[i]},
                  {l:PL("ACTIVE"),v:lo.activeCount,c:"#F5A623"},
                  {l:PL("THIS MO"),v:lo.monthCount,c:"#BD65E8"},
                ].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"var(--bg)",borderRadius:6,padding:"8px 4px"}}>
                    <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",color:s.c}}>{s.v}</div>
                    <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"0.5px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"0 14px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div style={{background:"var(--bg)",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>{PL("FUNDED VOL")}</div>
                  <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--ok)"}}>${(lo.closedVol/1000).toFixed(0)}K</div>
                </div>
                <div style={{background:"var(--bg)",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",marginBottom:2}}>PIPELINE</div>
                  <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--blue)"}}>${(lo.activeVol/1000).toFixed(0)}K</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {orphanFiles.length > 0 && (
          <div style={{background:"var(--s1)",border:"1px solid #E85D7544",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"rgba(232,93,117,.08)",borderBottom:"2px solid var(--bad)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--bad)",letterSpacing:"1px"}}>{PL("⚠ UNASSIGNED LO FILES")}</span>
              <span style={{background:"var(--bad)",color:"var(--bg)",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{orphanFiles.length}</span>
              <span style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginLeft:6,flex:1,minWidth:200}}>{PL("won't show in production stats until fixed · click any row to open & fix manually")}</span>
              {isAdmin && autoFixableCount > 0 && (
                <button className="hov" onClick={()=>setShowAutoFixPreview(true)}
                  style={{background:"var(--gold)",color:"var(--bg)",borderRadius:6,padding:"7px 14px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ AUTO-FIX {autoFixableCount}
                </button>
              )}
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                  {["BORROWER","TYPE","LOAN","STAGE","CURRENT LO VALUE","SUGGESTED FIX"].map(h=>PL(h)).map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":i===2?"center":"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orphanFiles.map((f,i)=>(
                  <tr key={f.id} className="row" onClick={()=>onOpenFile && onOpenFile(f)}
                    style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)",cursor:"pointer"}}>
                    <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)"}}>{f.borrower}</td>
                    <td style={{padding:"10px 14px",color:"var(--t2)"}}>{f.type}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--ok)",fontWeight:500}}>{fmtLoan(f.loan)}</td>
                    <td style={{padding:"10px 14px",color:"var(--t2)"}}>{f.stage}</td>
                    <td style={{padding:"10px 14px",color:"var(--bad)",fontWeight:500,fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                    <td style={{padding:"10px 14px"}}>
                      {f._suggestedLo ? (
                        <span style={{color:"var(--ok)",fontWeight:500}}>→ {f._suggestedLo}</span>
                      ) : (
                        <span style={{color:"var(--t3)",fontStyle:"italic"}}>{PL("no match · fix manually")}</span>
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
            <div className="fi" style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:12,width:"100%",maxWidth:680,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 24px 16px",borderBottom:"1px solid var(--s2)",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--gold)"}}>{PL("✨ AUTO-FIX PREVIEW")}</div>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:4,lineHeight:1.5}}>
                    Review the suggested LO assignments below. Click APPLY to update all {autoFixableCount} files at once.
                  </div>
                </div>
                <button onClick={()=>setShowAutoFixPreview(false)} style={{background:"transparent",border:"none",color:"var(--t3)",fontSize:"var(--fs-9)",cursor:"pointer",padding:"0 0 0 12px"}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"12px 0"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid var(--bd)"}}>
                      {["BORROWER","CURRENT","→","NEW LO"].map(h=>PL(h)).map((h,i)=>(
                        <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orphanFiles.filter(f=>f._suggestedLo).map((f,i)=>(
                      <tr key={f.id} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                        <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)"}}>{f.borrower}</td>
                        <td style={{padding:"10px 14px",color:"var(--bad)",fontStyle:"italic"}}>{f.lo ? `"${f.lo}"` : "(blank)"}</td>
                        <td style={{padding:"10px 14px",color:"var(--t3)",textAlign:"center"}}>→</td>
                        <td style={{padding:"10px 14px",color:"var(--ok)",fontWeight:500}}>{f._suggestedLo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{padding:"14px 24px",borderTop:"1px solid var(--s2)",background:"var(--s1)",flexShrink:0,display:"flex",gap:8}}>
                <button className="hov" onClick={()=>{
                  const updates = orphanFiles.filter(f=>f._suggestedLo).map(f=>({id:f.id, lo:f._suggestedLo}));
                  if(onBulkUpdate) onBulkUpdate(updates);
                  setShowAutoFixPreview(false);
                }}
                  style={{flex:2,background:"var(--gold)",color:"var(--bg)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",fontWeight:500,border:"none",cursor:"pointer"}}>
                  ✨ APPLY {autoFixableCount} FIXES
                </button>
                <button className="hov" onClick={()=>setShowAutoFixPreview(false)}
                  style={{flex:1,background:"var(--s2)",color:"var(--t2)",borderRadius:7,padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-4)",border:"none",cursor:"pointer"}}>
                  {PL("CANCEL")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>}

      {/* TAREAS VENCIDAS */}
      {prodTab==="overdue"&&(()=>{
        const r=overdueReport(files,{owner:duenoFiltro});
        // Sin filtro, para saber cuantas tiene cada quien.
        const porDueno=[...overdueByOwner(files).entries()].sort((a,b)=>b[1]-a[1]);
        const TONO={deposit:"#E85D75",legal:"#BD65E8",closing:"#E85D75",
          pace:"#F5A623",missing:"#6E7681"};
        return (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* DÓNDE DUELE HOY. Nace de una incongruencia real: el encabezado
                decia nueve criticos y este reporte listaba uno, porque solo
                miraba tareas derivadas vencidas. Un archivo puede estar
                pasado de techo sin tener ninguna fecha derivada vencida.
                Agrupar por fase convierte una lista en un diagnostico. */}
            {(()=>{
              const enProblemas = active
                .map(f=>({f, sev:fileSeverity(f), ph:getPhase(f.stage)}))
                .filter(x=>x.sev==="critical"||x.sev==="warning");
              if(!enProblemas.length){
                return (
                  <div style={{background:"var(--s1)",border:"1px solid var(--bd)",
                    borderRadius:8,padding:"12px 16px"}}>
                    <div className="sys">{TX("mtgNone")}</div>
                  </div>
                );
              }
              const porFase=new Map();
              for(const x of enProblemas){
                const k=x.ph.id;
                if(!porFase.has(k)) porFase.set(k,{ph:x.ph,crit:0,warn:0,items:[]});
                const g=porFase.get(k);
                if(x.sev==="critical") g.crit++; else g.warn++;
                g.items.push(x);
              }
              const fases=[...porFase.values()].sort((a,b)=>b.crit-a.crit||b.warn-a.warn);
              const peor=fases[0];
              const total=enProblemas.length;
              const visibles = mtgPhase==null ? fases : fases.filter(g=>g.ph.id===mtgPhase);

              return (
                <div style={{background:"var(--s1)",border:"1px solid #E85D7544",
                  borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-5)",
                    color:"var(--bad)",letterSpacing:"1px",marginBottom:4}}>{TX("mtgTitle")}</div>
                  <div className="sys" style={{marginBottom:10}}>{TX("mtgLead")}</div>

                  {/* Una fila por fase, ordenadas por donde duele mas. */}
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
                    <button className="hov" onClick={()=>setMtgPhase(null)}
                      style={{background:mtgPhase===null?"var(--bad)":"var(--s2)",
                        color:mtgPhase===null?"var(--bg)":"var(--t2)",border:"none",borderRadius:6,
                        padding:"5px 12px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                      {TX("mtgAll")} · {total}
                    </button>
                    {fases.map(g=>(
                      <button key={g.ph.id} className="hov" onClick={()=>setMtgPhase(x=>x===g.ph.id?null:g.ph.id)}
                        style={{background:mtgPhase===g.ph.id?g.ph.color:"var(--s2)",
                          color:mtgPhase===g.ph.id?"var(--bg)":"var(--t2)",border:`1px solid ${g.ph.color}44`,
                          borderRadius:6,padding:"5px 12px",fontSize:"var(--fs-2)",
                          fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                        {g.ph.label} · {g.crit>0?`${g.crit}🔴`:""}{g.warn>0?` ${g.warn}🟡`:""}
                      </button>
                    ))}
                  </div>

                  {/* El diagnostico, no el conteo: si una fase se lleva la
                      mitad o mas, eso es un problema y no varios. */}
                  {peor && peor.crit+peor.warn >= Math.ceil(total/2) && total>2 && (
                    <div style={{fontSize:"var(--fs-3)",color:"var(--gold)",lineHeight:1.5,
                      marginBottom:12,paddingLeft:10,borderLeft:"2px solid var(--gold)"}}>
                      {TX("mtgWorst",{p:peor.ph.label,n:peor.crit+peor.warn})}
                    </div>
                  )}

                  {visibles.map(g=>{
                    // Dentro de la fase, agrupado por ETAPA: cinco parados en
                    // la misma etapa dicen algo que cinco repartidos no dicen.
                    const porEtapa=new Map();
                    for(const x of g.items){
                      if(!porEtapa.has(x.f.stage)) porEtapa.set(x.f.stage,[]);
                      porEtapa.get(x.f.stage).push(x);
                    }
                    const etapas=[...porEtapa.entries()].sort((a,b)=>b[1].length-a[1].length);
                    return (
                      <div key={g.ph.id} style={{marginBottom:14}}>
                        <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)",
                          color:g.ph.color,letterSpacing:"1px",marginBottom:6}}>
                          {g.ph.label.toUpperCase()} · {TX("mtgCrit",{n:g.crit})} · {TX("mtgWarn",{n:g.warn})}
                        </div>
                        {etapas.map(([etapa,lista])=>(
                          <div key={etapa} style={{marginBottom:8}}>
                            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",
                              letterSpacing:".5px",marginBottom:3}}>
                              {etapa}{lista.length>1?` · ${lista.length}`:""}
                            </div>
                            {lista.map(({f,sev})=>{
                              const ck=fileClock(f);
                              const col=sev==="critical"?"#E85D75":"#F5A623";
                              return (
                                <div key={f.id} className="hov" onClick={()=>onOpenFile&&onOpenFile(f)}
                                  style={{display:"flex",justifyContent:"space-between",
                                    alignItems:"baseline",gap:10,padding:"5px 9px",cursor:"pointer",
                                    borderLeft:`2px solid ${col}`,background:"var(--bg)",
                                    borderRadius:"0 6px 6px 0",marginBottom:3}}>
                                  <span style={{fontSize:"var(--fs-3)",color:"var(--t1)"}}>
                                    {f.borrower}
                                    <span style={{color:"var(--t3)",marginLeft:8,fontSize:"var(--fs-2)"}}>
                                      {String(f.lo||"").split(" ")[0]}
                                    </span>
                                  </span>
                                  <span style={{fontSize:"var(--fs-2)",color:col,
                                    fontFamily:"var(--ff-mono)",whiteSpace:"nowrap"}}>
                                    {ck.applies&&ck.ceiling
                                      ? TX("mtgOverCeil",{d:ck.days,c:ck.ceiling})
                                      : ck.applies&&ck.kind==="coe" ? `COE ${ck.days}d` : ""}
                                    {ck.applies&&ck.waitOn
                                      ? ` · ${TX("mtgWaiting",{w:P(ck.waitOn)})}` : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:8,
              padding:"12px 16px"}}>
              <div className="sys">{TX("overdueLead")}</div>
            </div>

            {/* DE QUIEN SE ESPERA. Es la primera pregunta al abrir esto:
                no "cuantas hay" sino "a quien llamo". Un archivo cuenta una
                vez por persona aunque le deba tres cosas. */}
            {porDueno.length>0&&(
              <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                <button className="hov" onClick={()=>setDuenoFiltro(null)}
                  style={{background:duenoFiltro===null?"var(--bad)":"var(--s2)",
                    color:duenoFiltro===null?"var(--bg)":"var(--t2)",border:"none",
                    borderRadius:6,padding:"5px 12px",fontSize:"var(--fs-2)",
                    fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                  {TX("showAll")} · {overdueReport(files).total}
                </button>
                {porDueno.map(([quien,n])=>(
                  <button key={quien} className="hov"
                    onClick={()=>setDuenoFiltro(duenoFiltro===quien?null:quien)}
                    style={{background:duenoFiltro===quien?"var(--bad)":"var(--s2)",
                      color:duenoFiltro===quien?"var(--bg)":"var(--t2)",border:"none",
                      borderRadius:6,padding:"5px 12px",fontSize:"var(--fs-2)",
                      fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                    {quien} · {n}
                  </button>
                ))}
              </div>
            )}

            {r.total===0?(
              <div style={{background:"var(--s1)",border:"1px solid #7EC8A444",borderRadius:10,
                padding:"26px 16px",textAlign:"center",color:"var(--mint)",
                fontSize:"var(--fs-4)"}}>{TX("overdueClean")}</div>
            ):(<>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",
                  color:"var(--bad)"}}>{r.total}</span>
                <span style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>
                  {TX("overdueFiles",{n:r.total})}
                </span>
                {Object.entries(r.byKind).map(([k,n])=>(
                  <span key={k} style={{marginLeft:0,fontSize:"var(--fs-1)",
                    color:TONO[k],border:`1px solid ${TONO[k]}55`,borderRadius:4,
                    padding:"2px 8px",fontFamily:"var(--ff-mono)"}}>
                    {n} {P(TASK_SEVERITY[k])}
                  </span>
                ))}
              </div>
              <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,
                overflow:"hidden"}}>
                {r.rows.map((x,i)=>(
                  <div key={i} className="hov" onClick={()=>onOpenFile&&onOpenFile(x.file)}
                    style={{display:"flex",gap:12,alignItems:"baseline",padding:"10px 14px",
                      borderBottom:"1px solid var(--s2)",cursor:"pointer",
                      background:i%2?"var(--s1)":"var(--bg)"}}>
                    <span style={{fontSize:"var(--fs-1)",color:TONO[x.kind],minWidth:118,
                      fontFamily:"var(--ff-mono)"}}>{P(TASK_SEVERITY[x.kind])}</span>
                    <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-3)",
                      color:"var(--t1)",minWidth:180}}>
                      {x.file.borrower}
                      {/* Cuantas MAS le deben a este archivo. Sin esto, el
                          reporte parece decir que solo tiene un problema. */}
                      {x.alsoCount>0&&(
                        <span style={{color:"var(--t4)",fontFamily:"var(--ff-mono)",
                          fontSize:"var(--fs-1)",fontWeight:400}}>{` +${x.alsoCount}`}</span>
                      )}
                    </span>
                    <span style={{fontSize:"var(--fs-2)",color:"var(--t2)",flex:1,
                      lineHeight:1.45}}>{P(x)}</span>
                    {/* Cuanto lleva pasado. Ordena la urgencia dentro de un
                        mismo motivo: doce dias no es lo mismo que uno. */}
                    <span style={{fontSize:"var(--fs-2)",color:x.days>=7?"var(--bad)":"var(--t3)",
                      minWidth:44,textAlign:"right",fontFamily:"var(--ff-mono)"}}>
                      {Number.isFinite(x.days)?`${x.days}d`:""}
                    </span>
                    <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",minWidth:96,
                      textAlign:"right",fontFamily:"var(--ff-mono)"}}>{P(x.owner)}</span>
                  </div>
                ))}
              </div>
              <div className="sys">{TX("overdueOpenHint")}</div>
            </>)}
          </div>
        );})()}

      {/* MONTHLY TAB */}
      {prodTab==="monthly"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"var(--s1)",border:"1px solid #06D6A044",borderTop:"3px solid var(--ok)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("BEST MONTH (12MO)")}</div>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--ok)"}}>{bestMonth.units > 0 ? monthLabel(bestMonth.month) : "—"}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{bestMonth.units} {PL("units")} · ${(bestMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #E85D7544",borderTop:"3px solid var(--bad)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("SLOWEST MONTH")}</div>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--bad)"}}>{worstMonth.units > 0 ? monthLabel(worstMonth.month) : "—"}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{worstMonth.units} {PL("units")} · ${(worstMonth.volume/1000).toFixed(0)}K</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #4A90D944",borderTop:"3px solid var(--blue)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("12-MO TOTAL UNITS")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--blue)"}}>{last12Months.reduce((s,m)=>s+m.units,0)}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{PL("loans funded")}</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #F5A62344",borderTop:"3px solid var(--gold)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("12-MO TOTAL VOLUME")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-8)",color:"var(--gold)"}}>${(last12Months.reduce((s,m)=>s+m.volume,0)/1e6).toFixed(2)}M</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{PL("funded")}</div>
          </div>
        </div>

        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>{PL("UNITS CLOSED · LAST 12 MONTHS")}</div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{PL("peak:")} {maxUnits} {maxUnits===1?PL("unit"):PL("units")}</div>
          </div>
          <div className="barras" style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.units>0 ? Math.max(8, (m.units/maxUnits)*100) : 0;
              const isBest = m.units===maxUnits && m.units>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",color:isBest?"var(--ok)":"var(--t2)",fontWeight:isBest?500:400,minHeight:12}}>
                    {m.units>0 ? m.units : ""}
                  </div>
                  <div style={{
                    width:"100%",
                    height:`${heightPct}%`,
                    background: isBest ? "linear-gradient(180deg,var(--ok),#03A77B)" : isCurrent ? "linear-gradient(180deg,var(--blue),#2D6BAF)" : "var(--bd)",
                    borderRadius:"3px 3px 0 0",
                    transition:"all .2s",
                    minHeight: m.units>0 ? 4 : 0,
                  }}/>
                  <div className="mes-lbl" style={{fontSize:"var(--fs-1)",color:isCurrent?"var(--blue)":"var(--t3)",fontFamily:"var(--ff-mono)",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--gold)",letterSpacing:"1px"}}>{PL("FUNDED VOLUME · LAST 12 MONTHS")}</div>
            <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{PL("peak:")} ${(maxVolume/1000).toFixed(0)}K</div>
          </div>
          <div className="barras" style={{display:"flex",gap:6,alignItems:"flex-end",height:140,paddingTop:8}}>
            {last12Months.map((m,i)=>{
              const heightPct = m.volume>0 ? Math.max(8, (m.volume/maxVolume)*100) : 0;
              const isBest = m.volume===maxVolume && m.volume>0;
              const isCurrent = i===last12Months.length-1;
              return (
                <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:0}}>
                  <div style={{fontSize:"var(--fs-1)",fontFamily:"var(--ff-mono)",color:isBest?"var(--gold)":"var(--t2)",fontWeight:isBest?500:400,minHeight:12,whiteSpace:"nowrap"}}>
                    {m.volume>0 ? `$${(m.volume/1000).toFixed(0)}K` : ""}
                  </div>
                  <div style={{
                    width:"100%",
                    height:`${heightPct}%`,
                    background: isBest ? "linear-gradient(180deg,var(--gold),#C8851A)" : isCurrent ? "linear-gradient(180deg,var(--blue),#2D6BAF)" : "var(--bd)",
                    borderRadius:"3px 3px 0 0",
                    transition:"all .2s",
                    minHeight: m.volume>0 ? 4 : 0,
                  }}/>
                  <div className="mes-lbl" style={{fontSize:"var(--fs-1)",color:isCurrent?"var(--blue)":"var(--t3)",fontFamily:"var(--ff-mono)",letterSpacing:"0.5px",fontWeight:isCurrent?500:400,whiteSpace:"nowrap"}}>
                    {monthLabel(m.month)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid var(--blue)",padding:"10px 16px"}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>{PL("MONTHLY DETAIL · 12-MONTH ROLLING")}</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                {["MONTH","UNITS","VOLUME","AVG LOAN"].map(h=>PL(h)).map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...last12Months].reverse().map((m,i)=>(
                <tr key={m.month} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                  <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)"}}>{monthLabel(m.month)}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.units>0?"var(--ok)":"var(--bd)",fontWeight:500}}>{m.units}</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:m.volume>0?"var(--gold)":"var(--bd)",fontWeight:500}}>${(m.volume/1000).toFixed(0)}K</td>
                  <td style={{padding:"10px 14px",textAlign:"center",color:"var(--t2)"}}>{m.units>0?`$${(m.volume/m.units/1000).toFixed(0)}K`:"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {yearlyList.length > 0 && (
          <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#261535",borderBottom:"2px solid var(--purple)",padding:"10px 16px"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--purple)",letterSpacing:"1px"}}>{PL("ANNUAL SUMMARY")}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                  {["YEAR","UNITS","VOLUME","AVG LOAN"].map(h=>PL(h)).map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i===0?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearlyList.map((y,i)=>(
                  <tr key={y.year} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                    <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--purple)"}}>{y.year}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--ok)",fontWeight:500}}>{y.units}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--gold)",fontWeight:500}}>${(y.volume/1e6).toFixed(2)}M</td>
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
        {topRefs.length===0?<div style={{padding:32,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-5)"}}>{TX("plNoRefPartners")}</div>:(
          <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#1a2e25",borderBottom:"2px solid var(--ok)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--ok)",letterSpacing:"1px"}}>{PL("REFERRAL PARTNER LEADERBOARD")}</span>
              <span style={{background:"var(--ok)",color:"var(--bg)",borderRadius:10,padding:"1px 8px",fontSize:"var(--fs-3)",fontWeight:500}}>{topRefs.length}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                  {["#","REFERRAL PARTNER","TOTAL FILES","CLOSED","ACTIVE","FUNDED VOLUME"].map(h=>PL(h)).map((h,i)=>(
                    <th key={i} style={{padding:"8px 14px",textAlign:i<2?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRefs.map((ref,i)=>(
                  <tr key={ref.name} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                    <td style={{padding:"10px 14px",color:i===0?"var(--gold)":i===1?"var(--t2)":i===2?"#CD7F32":"var(--t3)",fontFamily:"var(--ff-num)",fontWeight:700}}>{i+1}</td>
                    <td style={{padding:"10px 14px",color:"var(--t1)",fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-4)"}}>
                      {ref.name}
                      {ref.merged&&(
                        <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",fontFamily:"var(--ff-mono)",fontWeight:400,marginTop:2}}>
                          {TX("unifies")} {ref.variants.map(v=>v.name+" ("+v.count+")").join(" · ")}
                        </div>
                      )}
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"center"}}>
                      <span style={{background:"var(--s2)",color:"var(--t1)",borderRadius:12,padding:"2px 10px",fontSize:"var(--fs-4)",fontWeight:500}}>{ref.total}</span>
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--ok)",fontWeight:500}}>{ref.closed}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--gold)",fontWeight:500}}>{ref.active}</td>
                    <td style={{padding:"10px 14px",textAlign:"center",color:"var(--ok)",fontWeight:500}}>${(ref.vol/1000).toFixed(0)}K</td>
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
          <div style={{background:"var(--s1)",border:"1px solid #A78BFA44",borderTop:"3px solid var(--violet)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("REFERRED OUT (TOTAL)")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--violet)"}}>{(referredOut||[]).length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(outboundTotalVol/1000).toFixed(0)}K {PL("orig. volume")}</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #06D6A044",borderTop:"3px solid var(--ok)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("OUTBOUND FUNDED")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--ok)"}}>{outboundFunded.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(outboundFundedVol/1000).toFixed(0)}K {PL("closed at banker")}</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #F5A62344",borderTop:"3px solid var(--gold)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("FEES EARNED (50 BPS)")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--gold)"}}>${outboundFeesEarned.toLocaleString()}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{PL("on referred-out funded")}</div>
          </div>
          {isAdmin && (
            <div style={{background:"var(--s1)",border:"1px solid #E85D7544",borderTop:"3px solid var(--bad)",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("LOST COMP (GROSS)")}</div>
              <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--bad)"}}>${outboundLostComp.toLocaleString()}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>vs. {BPS_RATE} {PL("bps of own comp")}</div>
            </div>
          )}
        </div>

        {/* Inbound metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <div style={{background:"var(--s1)",border:"1px solid #FFD16644",borderTop:"3px solid var(--yellow)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("INBOUND (TOTAL)")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--yellow)"}}>{inboundList.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{PL("from external bankers")}</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #06D6A044",borderTop:"3px solid var(--ok)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("INBOUND CLOSED")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--ok)"}}>{inboundClosed.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(inboundFundedVol/1000).toFixed(0)}K {PL("funded")}</div>
          </div>
          <div style={{background:"var(--s1)",border:"1px solid #4A90D944",borderTop:"3px solid var(--blue)",borderRadius:8,padding:12}}>
            <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("INBOUND ACTIVE")}</div>
            <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--blue)"}}>{inboundActive.length}</div>
            <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>${(inboundActiveVol/1000).toFixed(0)}K {PL("in pipeline")}</div>
          </div>
          {isAdmin && (
            <div style={{background:"var(--s1)",border:"1px solid #06D6A044",borderTop:"3px solid var(--ok)",borderRadius:8,padding:12}}>
              <div style={{fontSize:"var(--fs-1)",color:"var(--t3)",letterSpacing:"1px",marginBottom:3}}>{PL("COMP FROM INBOUND")}</div>
              <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-9)",color:"var(--ok)"}}>${inboundCompEarned.toLocaleString()}</div>
              <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:2}}>{BPS_RATE} {PL("bps on closed")}</div>
            </div>
          )}
        </div>

        {/* Reciprocity table */}
        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1f1830",borderBottom:"2px solid var(--violet)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--violet)",letterSpacing:"1px"}}>{PL("🏦 BANKER RECIPROCITY")}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t2)"}}>{PL("who's sending what · spot imbalances")}</span>
          </div>
          {bankerReciprocity.length === 0 ? (
            <div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>
              {TX("plNoBankerRefs")}<br/>
              <span style={{fontSize:"var(--fs-2)",marginTop:6,display:"block"}}>{PL("Refer a file out OR add an inbound referral to populate this table.")}</span>
            </div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
              <thead>
                <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                  {["BANKER","COMPANY","SENT TO THEM","THEY SENT US","VOLUME OUT","VOLUME IN","BALANCE"].map(h=>PL(h)).map((h,i)=>(
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
                    <tr key={b.name} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                      <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)"}}>{b.name}</td>
                      <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{b.company || "—"}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"var(--violet)",fontWeight:500}}>{b.sentOut}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"var(--yellow)",fontWeight:500}}>{b.receivedIn}</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"var(--violet)",fontSize:"var(--fs-3)"}}>${(b.sentOutVol/1000).toFixed(0)}K</td>
                      <td style={{padding:"10px 14px",textAlign:"center",color:"var(--yellow)",fontSize:"var(--fs-3)"}}>${(b.receivedInVol/1000).toFixed(0)}K</td>
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
          <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#1a1000",borderBottom:"2px solid var(--gold)",padding:"10px 16px"}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--gold)",letterSpacing:"1px"}}>{PL("💰 YEAR-END COMP IMPACT")}</span>
            </div>
            <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{PL("OUTBOUND — WHAT YOU WOULD HAVE EARNED IN HOUSE")}</div>
                <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-8)",color:"var(--t2)"}}>${outboundWouldHaveEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{BPS_RATE} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{PL("WHAT YOU EARNED IN REFERRAL FEES")}</div>
                <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-8)",color:"var(--gold)"}}>${outboundFeesEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{REFERRAL_FEE_BPS} bps × ${(outboundFundedVol/1000).toFixed(0)}K</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{PL("NET LOST COMP (OUTBOUND)")}</div>
                <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-8)",color:"var(--bad)"}}>${outboundLostComp.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{PL("opportunity cost")}</div>
              </div>
              <div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:4}}>{PL("INBOUND COMP EARNED")}</div>
                <div style={{fontFamily:"var(--ff-num)",fontWeight:700,fontSize:"var(--fs-8)",color:"var(--ok)"}}>${inboundCompEarned.toLocaleString()}</div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>{BPS_RATE} bps × ${(inboundFundedVol/1000).toFixed(0)}K</div>
              </div>
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid var(--s2)",background:"var(--bg)",fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>
              <strong style={{color:"var(--gold)"}}>{PL("Read it:")}</strong> {TX("brRead1")} <strong style={{color:"var(--gold)"}}>${outboundFeesEarned.toLocaleString()}</strong> {TX("brRead2")} <strong style={{color:"var(--bad)"}}>${outboundLostComp.toLocaleString()}</strong> {TX("brRead3")} <strong style={{color:"var(--ok)"}}>${inboundCompEarned.toLocaleString()}</strong> {TX("brRead4")}
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
          <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,
            padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>{TX("mixNoData")}</div>
        );
        return (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:8,padding:"12px 16px",
              fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>{TX("mixLead")}</div>

            {totF<20&&(
              <div style={{background:"rgba(245,166,35,.08)",border:"1px solid #F5A62344",borderRadius:8,
                padding:"10px 14px",fontSize:"var(--fs-3)",color:"var(--gold)",lineHeight:1.55}}>
                {TX("thinMix",{n:totF})}
              </div>
            )}

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"var(--bg)",padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--gold)",
                letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("byBaseProduct")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid var(--s2)"}}>
                  {th(TX("byBaseProduct"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hAvg"))}{th(TX("hComp"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byProd.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid var(--s2)",background:i%2?"var(--s1)":"var(--bg)"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{P(baseProductLabel(r.key))}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,
                        fontSize:"var(--fs-5)",color:"var(--gold)"}}>{r.unitShare?r.unitShare+"%":"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.comp?money(r.comp):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--blue)",fontFamily:"var(--ff-mono)"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{background:"#1a1000",borderTop:"2px solid var(--gold)"}}>
                  <td style={{padding:"10px 12px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--gold)"}}>{TX("mixTotal",{n:totF})}</td>
                  <td/>
                  <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{money(totV)}</td>
                  <td/><td/>
                  <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,color:"var(--gold)"}}>{money(totC)}</td>
                  <td/>
                </tr></tfoot>
              </table>
            </div>

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"var(--bg)",padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--mint)",
                letterSpacing:"1px",borderBottom:"1px solid var(--bd)",display:"flex",
                justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <span>{TX("byGroup")}</span>
                <span className="act">{TX("planEdit")}</span>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid var(--s2)"}}>
                  {th(TX("byGroup"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hPlan"))}{th(TX("hDelta"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byGrp.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid var(--s2)",background:i%2?"var(--s1)":"var(--bg)"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{r.key}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,
                        fontSize:"var(--fs-5)",color:"var(--gold)"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <input value={mixPlan[r.key]??""} inputMode="numeric"
                          onChange={e=>{const v=e.target.value.replace(/[^\d]/g,"");
                            setMixPlan({...mixPlan,[r.key]:v===""?undefined:Number(v)});}}
                          style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:4,
                            color:"var(--t2)",padding:"3px 6px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",
                            width:46,textAlign:"center"}}/>
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-mono)",
                        color:r.delta===null?"var(--t3)":Math.abs(r.delta)<=5?"var(--mint)":r.delta>0?"var(--blue)":"var(--gold)"}}>
                        {r.delta===null?"—":(r.delta>0?"+":"")+r.delta}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--blue)",fontFamily:"var(--ff-mono)"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"var(--bg)",padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--mint)",
                letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("byDpaMix")}</div>
              {(()=>{const rows=productionByDpa(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE});
                if(!rows.length) return (
                  <div style={{padding:"18px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{TX("noDpaYet")}</div>
                );
                return (
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                    <thead><tr style={{borderBottom:"1px solid var(--s2)"}}>
                      {th(TX("byBaseProduct"),"left")}{th(TX("hPct"))}{th(TX("hForm"))}
                      {th(TX("hClosed"))}{th(TX("hVolume"))}{th(TX("hShare"))}
                      {th(TX("hDays"))}{th(TX("hActive"))}
                    </tr></thead>
                    <tbody>
                      {rows.map((r,i)=>(
                        <tr key={r.key} style={{borderBottom:"1px solid var(--s2)",background:i%2?"var(--s1)":"var(--bg)"}}>
                          <td style={{padding:"10px 12px",color:"var(--t1)"}}>{P(baseProductLabel(r.base))}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:r.dpa?"var(--gold)":"var(--bd)",fontFamily:"var(--ff-mono)"}}>{r.pct?r.pct+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:r.dpa?"var(--mint)":"var(--bd)",fontSize:"var(--fs-3)"}}>{r.dpa?(P(dpaForm(r.form))||"—"):TX("noDpaRow")}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",color:"var(--gold)"}}>{r.unitShare?r.unitShare+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>{r.avgDays??"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--blue)",fontFamily:"var(--ff-mono)"}}>{r.active||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );})()}
            </div>

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"var(--bg)",padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--blue)",
                letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("byState")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid var(--s2)"}}>
                  {th(TX("byState"),"left")}{th(TX("hClosed"))}{th(TX("hVolume"))}
                  {th(TX("hShare"))}{th(TX("hAvg"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {productionByState(files,{cutover:BARRETT_CUTOVER,bpsDefault:BPS_RATE}).map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid var(--s2)",background:i%2?"var(--s1)":"var(--bg)"}}>
                      <td style={{padding:"10px 12px",color:"var(--t1)"}}>{r.key}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",color:"var(--gold)"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--blue)",fontFamily:"var(--ff-mono)"}}>{r.active||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"var(--bg)",padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--purple)",
                letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("byOriginator")}</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                <thead><tr style={{borderBottom:"1px solid var(--s2)"}}>
                  {th("LO","left")}{th(TX("hClosed"))}{th(TX("hVolume"))}{th(TX("hShare"))}
                  {th(TX("hAvg"))}{th(TX("hActive"))}
                </tr></thead>
                <tbody>
                  {byLo.map((r,i)=>(
                    <tr key={r.key} style={{borderBottom:"1px solid var(--s2)",background:i%2?"var(--s1)":"var(--bg)"}}>
                      <td style={{padding:"10px 12px",color:r.funded||r.active?"var(--t1)":"var(--t2)"}}>
                        {r.key}
                        {!r.funded&&!r.active&&<span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>{"  "}{TX("noProduction")}</span>}
                      </td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded||"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.fundedVolume?money(r.fundedVolume):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,
                        fontSize:"var(--fs-5)",color:r.unitShare?"var(--gold)":"var(--t3)"}}>{r.unitShare}%</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>{r.avgLoan?money(r.avgLoan):"—"}</td>
                      <td style={{padding:"10px 12px",textAlign:"center",color:"var(--blue)",fontFamily:"var(--ff-mono)"}}>{r.active||"—"}</td>
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
            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:8,padding:"12px 16px",
              fontSize:"var(--fs-3)",color:"var(--t2)",lineHeight:1.6}}>
              {vista==="lender"?TX("scorecardLead"):vista==="product"?TX("productStrength"):TX("specLead")}
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:6}}>{TX("autoDerived")}</div>
            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {(isAssistant?["spec"]:["lender","product","spec"]).map(v=>(
                <button key={v} className="hov" onClick={()=>setScView(v)}
                  style={{background:scView===v?"var(--gold)":"var(--s2)",color:scView===v?"var(--bg)":"var(--t2)",
                    border:"none",borderRadius:6,padding:"6px 14px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",
                    fontWeight:500,cursor:"pointer"}}>
                  {v==="lender"?TX("byLender"):v==="product"?TX("byProduct"):TX("bySpecialty")}
                </button>
              ))}
              {vista==="spec"&&specialtyCatalog().map(c=>(
                <button key={c.category} className="hov" onClick={()=>{setScCat(c.category);setScSpec(null);}}
                  style={{background:scCat===c.category?"var(--blue)":"var(--s2)",color:scCat===c.category?"var(--bg)":"var(--t2)",
                    border:"none",borderRadius:6,padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                  {P(c.label)} · {c.lenders}
                </button>
              ))}
              {vista==="product"&&productsWorked(files,{cutover:BARRETT_CUTOVER}).map(pw=>(
                <button key={pw.product} className="hov" onClick={()=>setScProduct(pw.product)}
                  style={{background:(scProduct||productsWorked(files,{cutover:BARRETT_CUTOVER})[0]?.product)===pw.product?"var(--blue)":"var(--s2)",
                    color:(scProduct||productsWorked(files,{cutover:BARRETT_CUTOVER})[0]?.product)===pw.product?"var(--bg)":"var(--t2)",
                    border:"none",borderRadius:6,padding:"5px 11px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                  {P(categoryLabel(pw.product))} · {pw.files}
                </button>
              ))}
            </div>

            {vista==="lender"&&(sc.length===0?(
              <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,
                padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>
                {TX("scNoData")}
              </div>
            ):(
              <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
                  <thead>
                    <tr style={{background:"var(--bg)",borderBottom:"1px solid var(--bd)"}}>
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
                        <tr key={r.id} style={{borderBottom:"1px solid var(--s2)",
                          background:i%2===0?"var(--bg)":"var(--s1)"}}>
                          <td style={{padding:"10px 12px",color:"var(--t1)"}}>
                            {r.name}
                            {r.compLost>0&&(
                              <div style={{fontSize:"var(--fs-1)",color:"var(--bad)"}}>
                                −${r.compLost.toLocaleString()} {TX("scCompLost")}
                              </div>
                            )}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.touched}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>{r.funded}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,
                            fontSize:"var(--fs-6)",color:r.pullThrough>=80?"var(--mint)":r.pullThrough>=50?"var(--gold)":"var(--bad)"}}>
                            {r.pullThrough!==null?r.pullThrough+"%":"—"}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-mono)",
                            color:r.sharePct>=40?"var(--gold)":"var(--t2)"}}>{r.sharePct?r.sharePct+"%":"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.exits||"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-mono)",
                            color:r.exitsLender>0?"var(--bad)":"var(--t3)"}}>
                            {r.exitsLender||"—"}{r.exitsLender>0&&r.faultRate!==null?` · ${r.faultRate}%`:""}
                          </td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.avgDaysToClose??"—"}</td>
                          <td style={{padding:"10px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)"}}>{r.avgBps??"—"}</td>
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
                <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,
                  padding:"26px 16px",textAlign:"center",color:"var(--t3)",fontSize:"var(--fs-4)"}}>{TX("noProductData")}</div>
              );
              const list=productScorecard(files,prod,{cutover:BARRETT_CUTOVER});
              const tried=list.filter(x=>x.tried), untried=list.filter(x=>!x.tried).slice(0,12);
              const prodRow=(r,proven)=>(
                <div key={r.lenderId} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,
                  padding:"9px 14px",borderBottom:"1px solid var(--s2)",fontSize:"var(--fs-3)"}}>
                  <span style={{color:proven?"var(--t1)":"var(--t2)",flex:1}}>{r.lenderName}</span>
                  {proven?(
                    <>
                      <span style={{color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>
                        {TX("closedOf",{a:r.funded,b:r.touched})}
                      </span>
                      <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",minWidth:48,textAlign:"right",
                        color:r.pullThrough>=80?"var(--mint)":r.pullThrough>=50?"var(--gold)":"var(--bad)"}}>
                        {r.pullThrough}%
                      </span>
                      <span style={{color:r.exitsLender>0?"var(--bad)":"var(--t3)",fontFamily:"var(--ff-mono)",
                        fontSize:"var(--fs-2)",minWidth:90,textAlign:"right"}}>
                        {r.exitsLender>0?TX("ownCall",{n:r.exitsLender}):""}
                      </span>
                    </>
                  ):null}
                  <span style={{color:"var(--t3)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",minWidth:56,textAlign:"right"}}>
                    {r.avgBps?r.avgBps+" bps":"—"}
                  </span>
                </div>
              );
              return (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--gold)"}}>
                    {TX("productQ",{p:P(categoryLabel(prod))})}
                  </div>
                  <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"var(--bg)",padding:"8px 14px",fontSize:"var(--fs-2)",color:"var(--mint)",
                      letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("proven")}</div>
                    {tried.length===0
                      ? <div style={{padding:"16px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>—</div>
                      : tried.map(r=>prodRow(r,true))}
                  </div>
                  <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"var(--bg)",padding:"8px 14px",fontSize:"var(--fs-2)",color:"var(--t3)",
                      letterSpacing:"1px",borderBottom:"1px solid var(--s2)"}}>{TX("untried")}</div>
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
                        style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
                          padding:"5px 7px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:"100%"}}>
                        <option value="">—</option>
                        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ):(
                      <input value={d[k]??""} inputMode={type==="num"?"decimal":undefined}
                        onChange={e=>set(e.target.value)}
                        style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
                          padding:"5px 7px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:"100%"}}/>
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
                  <div key={key} style={{borderBottom:"1px solid var(--s2)"}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:10,padding:"9px 14px",fontSize:"var(--fs-3)"}}>
                      <span style={{flex:1,color:l.tried?"var(--t1)":"var(--t2)"}}>
                        {l.name}
                        {l.siblings.length>0&&(
                          <span style={{color:"var(--t3)",fontSize:"var(--fs-2)"}}>
                            {"  "}{TX("alsoDoes")} {l.siblings.slice(0,3).map(x=>P(specialtyLabel(x))).join(", ")}
                          </span>
                        )}
                        {sum&&<div style={{fontSize:"var(--fs-2)",color:"var(--mint)",marginTop:2}}>
                          {sum}
                          {det?.updatedBy&&<span style={{color:"var(--t3)"}}>
                            {"  "}{TX("capturedBy",{who:String(det.updatedBy).split(" ")[0],d:det.updatedAt})}
                          </span>}
                        </div>}
                      </span>
                      {l.tried&&!isAssistant&&(
                        <>
                          <span style={{color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>
                            {TX("closedOf",{a:l.funded,b:l.touched})}
                          </span>
                          <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",minWidth:44,textAlign:"right",
                            color:l.pullThrough>=80?"var(--mint)":l.pullThrough>=50?"var(--gold)":"var(--bad)"}}>
                            {l.pullThrough}%
                          </span>
                        </>
                      )}
                      <span style={{color:"var(--t3)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",minWidth:54,textAlign:"right"}}>
                        {l.bps?l.bps+" bps":"—"}
                      </span>
                      {(
                        <button className="hov" onClick={()=>{
                            setDpaOpen(open?null:key);
                            setDpaDraft(open?null:{...emptySpecDetail(),...(det||{}),
                              states:(det?.states||[]).join(","),newNote:""});
                          }}
                          style={{background:sum?"var(--s2)":"rgba(126,200,164,.12)",
                            border:`1px solid ${sum?"var(--mint)":"#7EC8A488"}`,
                            borderRadius:5,color:"var(--mint)",fontSize:"var(--fs-2)",padding:"4px 10px",
                            cursor:"pointer",fontFamily:"var(--ff-mono)",whiteSpace:"nowrap"}}>
                          {open?"✕":(sum?TX("dpaEdit"):TX("dpaEmpty"))}
                        </button>
                      )}
                    </div>
                    {open&&(
                      <div style={{padding:"11px 14px 14px",background:"var(--bg)",borderTop:"1px solid var(--s2)"}}>
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
                              <div key={ni} style={{borderLeft:"2px solid var(--s2)",paddingLeft:9,marginBottom:6}}>
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
                          style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
                            padding:"6px 9px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:"100%",marginBottom:9}}/>
                        <button className="hov" onClick={()=>{
                            const d={...dpaDraft};
                            d.fixesRate = d.fixesRate==="true"?true:d.fixesRate==="false"?false:null;
                            d.states = String(d.states||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
                            onSaveDpa&&onSaveDpa(setSpecDetail(dpaDetails,l.lenderId,cat.category,spec,d,profile.name));
                            setDpaOpen(null); setDpaDraft(null);
                          }}
                          style={{background:"var(--mint)",color:"var(--bg)",border:"none",borderRadius:6,
                            padding:"7px 16px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",fontWeight:500,cursor:"pointer"}}>
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
                        style={{background:spec===sp.id?"var(--mint)":"transparent",
                          border:`1px solid ${spec===sp.id?"var(--mint)":sp.lenders<=12?"#F5A62366":"var(--bd)"}`,
                          color:spec===sp.id?"var(--bg)":sp.lenders<=12?"var(--gold)":"var(--t2)",
                          borderRadius:5,padding:"4px 9px",fontSize:"var(--fs-2)",fontFamily:"var(--ff-mono)",cursor:"pointer"}}>
                        {P(specialtyLabel(sp.id))} <span style={{opacity:.6}}>{sp.lenders}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-6)",color:"var(--mint)"}}>
                      {TX("specQ",{p:P(specialtyLabel(spec))})}
                    </span>
                    <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{list.length} lenders</span>
                    {cov&&<span style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginLeft:"auto"}}>
                      {TX("specCoverage",{f:cov.filled,t:cov.total})}</span>}
                  </div>
                  {(
                    <div style={{background:"rgba(126,200,164,.08)",border:"1px solid #7EC8A455",
                      borderRadius:8,padding:"10px 14px",fontSize:"var(--fs-3)",color:"var(--mint)",lineHeight:1.55}}>
                      <span className="act">{isDpa?TX("dpaFillHere"):TX("specFillHere")}</span>
                    </div>
                  )}
                  {thin&&(
                    <div style={{background:"rgba(245,166,35,.08)",border:"1px solid #F5A62344",borderRadius:8,
                      padding:"10px 14px",fontSize:"var(--fs-3)",color:"var(--gold)",lineHeight:1.55}}>{TX("specThin")}</div>
                  )}
                  <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
                    {tried.length>0&&<div style={{background:"var(--bg)",padding:"8px 14px",fontSize:"var(--fs-2)",
                      color:"var(--mint)",letterSpacing:"1px",borderBottom:"1px solid var(--bd)"}}>{TX("proven")}</div>}
                    {tried.map(l=>row(l))}
                    {rest.length>0&&<div style={{background:"var(--bg)",padding:"8px 14px",fontSize:"var(--fs-2)",
                      color:"var(--t3)",letterSpacing:"1px",borderTop:tried.length?"1px solid var(--bd)":"none",
                      borderBottom:"1px solid var(--s2)"}}>{TX("untried")}</div>}
                    {rest.slice(0,30).map(l=>row(l))}
                    {rest.length>30&&<div style={{padding:"9px 14px",fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                      +{rest.length-30}</div>}
                  </div>
                </div>
              );
            })()}

            <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:8,padding:"11px 16px",
              fontSize:"var(--fs-2)",color:"var(--t3)",lineHeight:1.6}}>
              {TX("scFaultNote")}
            </div>
          </div>
        );
      })()}

      {/* OVERRIDE & PAYROLL — modelo Barrett por % del NET */}
      {prodTab==="override"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",
          background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:8,padding:"10px 14px"}}>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px"}}>{TX("year")}</span>
          <select value={compYear} onChange={e=>setCompYear(Number(e.target.value))}
            style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
              padding:"5px 8px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)"}}>
            {[1,2,3].map(y=><option key={y} value={y}>Año {y} · Paulo {(teamLeadShare(y)*100).toFixed(0)}%</option>)}
          </select>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginLeft:8}}>{TX("filesPerMo")}</span>
          <input type="number" value={filesMo} onChange={e=>setFilesMo(Math.max(1,Number(e.target.value)||1))}
            style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t1)",
              padding:"5px 8px",fontSize:"var(--fs-3)",fontFamily:"var(--ff-mono)",width:58}}/>
          <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>
            {TX("costPerFile")} ${Math.round(branchCostPerFile(filesMo)).toLocaleString()} · {TX("seniorCap")} {(ladderCeiling(filesMo,9174,compYear)*100).toFixed(1)}% · {TX("since")} {BARRETT_CUTOVER}
          </span>
        </div>

        {justClaimed&&(
          <div style={{background:"rgba(74,144,217,.1)",border:"1px solid var(--blue)",borderRadius:8,
            padding:"9px 14px",fontSize:"var(--fs-3)",color:"var(--blue)"}}>
            Reclamado para el corte {payrollPeriodLabel(currentPayrollPeriod(),CURRENT_LANG)} — {justClaimed}
          </div>
        )}

        {losWithoutCompRule(files,COMP_ROSTER).length>0&&(
          <div style={{background:"rgba(232,93,117,.08)",border:"1px solid #E85D7555",borderRadius:8,
            padding:"10px 14px",fontSize:"var(--fs-3)",color:"var(--bad)",lineHeight:1.5}}>
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
              <div style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:s.small?"var(--fs-5)":"var(--fs-9)",color:s.color}}>{s.value}</div>
              <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{background:"var(--s1)",border:"1px solid #F5A62333",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a1000",borderBottom:"2px solid var(--gold)",padding:"10px 16px",
            display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--gold)",letterSpacing:"1px"}}>{TX("nextRequest")}</span>
            <span style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{TX("claimOptional")}</span>
              <button className="hov" disabled={picked.size===0} onClick={()=>setShowRequest(true)}
                style={{background:picked.size?"var(--gold)":"var(--s2)",color:picked.size?"var(--bg)":"var(--t3)",
                  border:"none",borderRadius:6,padding:"7px 14px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
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
                <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                  <th style={{padding:"8px 6px 8px 12px",width:24}}>
                    <input type="checkbox"
                      checked={payroll.rows.filter(r=>r.ready).length>0&&picked.size===payroll.rows.filter(r=>r.ready).length}
                      onChange={e=>setPicked(e.target.checked?new Set(payroll.rows.filter(r=>r.ready).map(r=>r.file.id)):new Set())}
                      style={{accentColor:"var(--gold)",cursor:"pointer"}}/>
                  </th>
                  {[TX("client"),TX("fundedOn"),TX("cut"),"LO",TX("split"),"NET",TX("yourShare"),""].map((h,i)=>(
                    <th key={i} style={{padding:"8px 12px",textAlign:i<4?"left":"center",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r,i)=>(
                  <tr key={r.file.id||i} style={{borderBottom:"1px solid var(--s2)",background:r.stale?"rgba(232,93,117,.06)":(i%2===0?"var(--bg)":"var(--s1)")}}>
                    <td style={{padding:"9px 6px 9px 12px"}}>
                      <input type="checkbox" checked={picked.has(r.file.id)} disabled={!r.ready}
                        onChange={()=>{const n=new Set(picked); n.has(r.file.id)?n.delete(r.file.id):n.add(r.file.id); setPicked(n);}}
                        style={{accentColor:"var(--gold)",cursor:r.ready?"pointer":"not-allowed",opacity:r.ready?1:.3}}/>
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t1)"}}>
                      {r.file.borrower}
                      {!r.ready&&(
                        <div style={{fontSize:"var(--fs-1)",color:"var(--bad)",marginTop:2}}>
                          {TX("blocked")} · {TX("blockedWhy")} {r.blockers.map(x=>P(x)).join(" · ")}
                        </div>
                      )}
                      {r.kind==="referral"&&(
                        <div style={{fontSize:"var(--fs-1)",color:"var(--violet)"}}>
                          {TX("referralFeeOf",{b:r.referral.bps})}{r.referral.banker?` · ${r.referral.banker}`:""}
                          {r.branchPct>0? + " · " + TX("branchPctOf",{n:(r.branchPct*100).toFixed(0)}):" · "+TX("ofTheLo")}
                        </div>
                      )}
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>
                      {r.kind==="referral"?r.referral.date:fundedDate(r.file)}
                    </td>
                    <td style={{padding:"9px 12px",fontSize:"var(--fs-2)",color:r.stale?"var(--bad)":"var(--t2)"}}>
                      {payrollPeriodLabel(r.period)}{r.stale?" · "+TX("carried"):""}
                    </td>
                    <td style={{padding:"9px 12px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>
                      {r.file.lo||"—"}
                      <span style={{color:r.rosterMissing?"var(--bad)":"var(--t3)"}}>
                        {" · "}{r.kind==="referral"?TX("referredShort"):r.rosterMissing?TX("noCompRule"):P(r.split.stageMeta)}
                      </span>
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:"var(--t2)",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)"}}>
                      {r.kind==="referral"?"—":`${(r.split.shares.lo*100).toFixed(1)}%${r.split.floorApplied?" ⚑":""}`}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>${r.split.net.toLocaleString()}</td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-6)",color:"var(--gold)"}}>${r.split.toBM.toLocaleString()}</span>
                      {r.split.isBM&&<div style={{fontSize:"var(--fs-1)",color:"var(--t3)"}}>{TX("yourLoSplit")}</div>}
                    </td>
                    <td style={{padding:"9px 12px",textAlign:"center"}}>
                      <button className="hov" onClick={()=>{
                          onBulkUpdate&&onBulkUpdate([{id:r.file.id,claimState:"claimed",claimedPeriod:currentPayrollPeriod(),claimedAt:today(),claimedBy:profile.name}]);
                          setJustClaimed(`${r.file.borrower} · $${r.split.toBM.toLocaleString()}`);
                          setTimeout(()=>setJustClaimed(null),3500);
                        }}
                        style={{background:"var(--s2)",border:"1px solid var(--blue)",borderRadius:4,color:"var(--blue)",
                          fontSize:"var(--fs-2)",padding:"4px 9px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>{TX("claim")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"#1a1000",borderTop:"2px solid var(--gold)"}}>
                  <td colSpan={6} style={{padding:"10px 12px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--gold)"}}>{TX("totalFiles",{n:payroll.count})}</td>
                  <td style={{padding:"10px 12px",textAlign:"center",color:"var(--ok)",fontFamily:"var(--ff-mono)"}}>${payroll.net.toLocaleString()}</td>
                  <td style={{padding:"10px 12px",textAlign:"center",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--gold)"}}>${payroll.toBM.toLocaleString()}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          )}
        </div>


        {showRequest&&(()=>{
          const rows=payroll.rows.filter(r=>picked.has(r.file.id));
          const req=buildPayrollRequest(rows,{by:profile.name,
            branch:{name:TX("branchLending"),teamLead:"Paulo Maria",trainer:TRAINER_NAME}});
          const text=payrollRequestText(req);
          return (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:130,display:"flex",
              alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowRequest(false)}>
              <div className="fi" onClick={e=>e.stopPropagation()} style={{background:"var(--s1)",
                border:"1px solid #F5A62355",borderRadius:12,width:"100%",maxWidth:700,
                maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column"}}>
                <div style={{padding:"16px 22px 12px",borderBottom:"1px solid var(--s2)"}}>
                  <div style={{fontFamily:"var(--ff-title)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--gold)"}}>{TX("payrollRequest")}</div>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t2)",marginTop:3}}>
                    {req.periodLabel} · {TX("filesTotal",{n:req.fileCount,d:req.total.toLocaleString()})}
                  </div>
                </div>
                <div style={{flex:1,overflow:"auto",padding:"14px 22px"}}>
                  <pre style={{margin:0,fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
                    color:"var(--t1)",whiteSpace:"pre",lineHeight:1.65}}>{text}</pre>
                </div>
                {reqError&&(
                  <div style={{margin:"0 22px",background:"rgba(232,93,117,.1)",border:"1px solid var(--bad)",
                    borderRadius:6,padding:"9px 12px",fontSize:"var(--fs-3)",color:"var(--bad)"}}>
                    {TX("couldNotClose",{e:reqError})}
                  </div>
                )}
                <div style={{padding:"12px 22px",borderTop:"1px solid var(--s2)",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="hov" onClick={()=>{
                      try{ navigator.clipboard?.writeText(text); }catch(err){ setReqError(TX("errClipboard")); }
                      setCopied(true); setTimeout(()=>setCopied(false),2200);
                    }}
                    style={{flex:1,background:"var(--s2)",color:copied?"var(--mint)":"var(--t2)",borderRadius:7,
                      padding:"10px 0",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
                      border:`1px solid ${copied?"var(--mint)":"var(--bd)"}`,cursor:"pointer"}}>
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
                    style={{flex:2,background:"var(--gold)",color:"var(--bg)",borderRadius:7,padding:"10px 0",
                      fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",fontWeight:500,border:"none",cursor:"pointer"}}>
                    {TX("alreadySent")}
                  </button>
                  <button className="hov" onClick={()=>setShowRequest(false)}
                    style={{flex:1,background:"transparent",color:"var(--t2)",borderRadius:7,padding:"10px 0",
                      fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",border:"1px solid var(--bd)",cursor:"pointer"}}>CERRAR</button>
                </div>
                <div style={{padding:"0 22px 14px",fontSize:"var(--fs-1)",color:"var(--t3)"}}>
                  <span className="act">{TX("sendYourself")}</span>
                </div>
              </div>
            </div>
          );
        })()}


        {(payrollLog||[]).length>0&&(
          <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"var(--bg)",borderBottom:"1px solid var(--bd)",padding:"10px 16px",
              display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8}}>
              <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--t2)",letterSpacing:"1px"}}>
                {TX("reqSent")}
              </span>
              <span style={{fontSize:"var(--fs-2)",color:"var(--t3)"}}>
                {TX("inTotal",{n:payrollLog.length,d:payrollLog.reduce((a,x)=>a+(x.total||0),0).toLocaleString()})}
              </span>
            </div>
            {[...payrollLog].reverse().map(entry=>(
              <div key={entry.id} style={{borderBottom:"1px solid var(--s2)",padding:"10px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:"var(--fs-3)",color:"var(--t1)"}}>
                    {entry.periodLabel}
                    <span style={{color:"var(--t3)"}}> · {TX("sentBy",{d:entry.sentAt,who:String(entry.by||"").split(" ")[0]})}</span>
                  </span>
                  <span style={{display:"flex",gap:8,alignItems:"baseline"}}>
                    <span style={{fontSize:"var(--fs-2)",color:"var(--t2)"}}>{TX("nFiles",{n:entry.fileCount})}</span>
                    <span style={{fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-5)",color:"var(--gold)"}}>
                      ${(entry.total||0).toLocaleString()}
                    </span>
                    {onDeletePayrollLog&&(
                      <button className="hov" onClick={()=>{
                          if(window.confirm(TX("deleteLogEntry"))) onDeletePayrollLog(entry.id);
                        }}
                        style={{background:"transparent",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t3)",
                          fontSize:"var(--fs-1)",padding:"3px 7px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>✕</button>
                    )}
                    <button className="hov" onClick={()=>setOpenLog(openLog===entry.id?null:entry.id)}
                      style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t2)",
                        fontSize:"var(--fs-1)",padding:"3px 8px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>
                      {openLog===entry.id?TX("close"):TX("view")}
                    </button>
                  </span>
                </div>
                <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",marginTop:3}}>
                  {(entry.payees||[]).map(p=>`${String(p.name).split(" ")[0]} $${p.subtotal.toLocaleString()}`).join(" · ")}
                </div>
                {openLog===entry.id&&(
                  <div style={{marginTop:9}}>
                    <pre style={{margin:0,background:"var(--bg)",border:"1px solid var(--s2)",borderRadius:6,
                      padding:"11px 13px",fontFamily:"var(--ff-mono)",fontSize:"var(--fs-3)",
                      color:"var(--t2)",whiteSpace:"pre",overflowX:"auto",lineHeight:1.6}}>{entry.text}</pre>
                    <button className="hov" onClick={()=>{navigator.clipboard?.writeText(entry.text);}}
                      style={{marginTop:6,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:5,
                        color:"var(--t2)",fontSize:"var(--fs-2)",padding:"5px 12px",cursor:"pointer",fontFamily:"var(--ff-mono)"}}>
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

        <div style={{background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",marginBottom:8}}>
            {TX("netSplitYear",{y:compYear,n:filesMo})}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:8}}>
            {Object.keys(LO_STAGES).map(k=>{
              const demo=loanSplit({loan:417000,bps:220,loStage:k,isBM:k==="bm"},
                {year:compYear,filesPerMonth:filesMo,trainerAssigned:k==="newbie"||k==="intermediate"});
              return (
                <div key={k} style={{background:"var(--bg)",border:"1px solid var(--s2)",borderRadius:6,padding:"9px 11px"}}>
                  <div style={{fontSize:"var(--fs-3)",color:"var(--t1)",fontWeight:500}}>{P(LO_STAGES[k])}</div>
                  <div style={{fontSize:"var(--fs-2)",color:"var(--t2)",fontFamily:"var(--ff-mono)",marginTop:4,lineHeight:1.6}}>
                    LO {(demo.shares.lo*100).toFixed(1)}%
                    {demo.shares.trainer>0?` · trainer ${(demo.shares.trainer*100).toFixed(1)}%`:""}
                    <br/>{demo.isBM
                      ? TX("youKeep",{n:(demo.shares.lo*100).toFixed(0)})
                      : TX("branchKeeps",{n:(demo.shares.branch*100).toFixed(1)})} · Paulo {(demo.shares.paulo*100).toFixed(0)}%
                    <br/><span style={{color:demo.margin<0?"var(--bad)":demo.isBM?"var(--gold)":"var(--mint)"}}>
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

        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid var(--blue)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>{PL("MY PERSONAL LO COMP")} — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{PL("your files only")} · {BPS_RATE} {PL("bps default")}</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map(h=>PL(h)).map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                  <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)",fontSize:"var(--fs-3)"}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"var(--ok)",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{fileCompBps(f,BPS_RATE)}</td>
                  <td style={{padding:"10px 14px",color:"var(--blue)",fontWeight:500,fontFamily:"var(--ff-num)"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid var(--blue)"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--blue)"}}>{PL("MY TOTAL PERSONAL COMP")}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--blue)"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>{TX("plNoPersonalClosed")}</div>}
        </div>
      </div>}

      {/* MY COMP TAB */}
      {prodTab==="mycomp"&&(isLO||isAdmin)&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"var(--s1)",border:"1px solid var(--s2)",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:"#1a2a3a",borderBottom:"2px solid var(--blue)",padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"var(--ff-title)",fontWeight:700,fontSize:"var(--fs-5)",color:"var(--blue)",letterSpacing:"1px"}}>{PL("MY PERSONAL COMP")} — {profile.name.toUpperCase()}</span>
            <span style={{fontSize:"var(--fs-3)",color:"var(--t3)"}}>{PL("your closed files only")} · {BPS_RATE} {PL("bps default")}</span>
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-4)"}}>
            <thead>
              <tr style={{background:"var(--s1)",borderBottom:"1px solid var(--bd)"}}>
                {["BORROWER","PROGRAM","LOAN AMOUNT","CLOSED","BPS","GROSS COMP"].map(h=>PL(h)).map((h,i)=>(
                  <th key={i} style={{padding:"8px 14px",textAlign:"left",fontSize:"var(--fs-2)",color:"var(--t3)",letterSpacing:"1px",fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myClosedFiles.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:"1px solid var(--s2)",background:i%2===0?"var(--bg)":"var(--s1)"}}>
                  <td style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--t1)",fontSize:"var(--fs-3)"}}>{f.borrower}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{f.type}</td>
                  <td style={{padding:"10px 14px",color:"var(--ok)",fontWeight:500}}>${f.loan.toLocaleString()}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)"}}>{f.closedAt||f.closing}</td>
                  <td style={{padding:"10px 14px",color:"var(--t2)",fontSize:"var(--fs-3)"}}>{fileCompBps(f,BPS_RATE)}</td>
                  <td style={{padding:"10px 14px",color:"var(--blue)",fontWeight:500,fontFamily:"var(--ff-num)"}}>${myComp(f).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {myClosedFiles.length>0&&(
              <tfoot>
                <tr style={{background:"#0a1a2a",borderTop:"2px solid var(--blue)"}}>
                  <td colSpan={4} style={{padding:"10px 14px",fontFamily:"var(--ff-title)",fontWeight:700,color:"var(--blue)"}}>{PL("MY TOTAL COMP")}</td>
                  <td style={{padding:"10px 14px",color:"var(--t3)",fontSize:"var(--fs-3)"}}>{BPS_RATE} bps avg</td>
                  <td style={{padding:"10px 14px",fontFamily:"var(--ff-num)",fontWeight:800,fontSize:"var(--fs-7)",color:"var(--blue)"}}>${myTotalComp.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
          {myClosedFiles.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--t4)",fontSize:"var(--fs-4)"}}>{TX("plNoPersonalClosed")}</div>}
        </div>
      </div>}

    </div>
  );
}
