// ═══════════════════════════════════════════════════════════════════
// PANTALLA DE PROCESAMIENTO
// ═══════════════════════════════════════════════════════════════════
//
// Un LO abre el sistema y piensa "mis archivos". Una procesadora abre y
// piensa "que hago hoy". Son dos productos sobre el mismo dato, y por
// eso esto NO es el tablero con otro filtro: es una cola de trabajo.
//
// Dos paneles, no un modal. Un modal esta bien para un LO que entra
// treinta segundos a ajustar un monto. Una procesadora vive aqui ocho
// horas: necesita la lista y el archivo A LA VEZ, como un correo. Un
// modal la obligaria a cerrar y abrir por cada archivo, y mientras esta
// adentro no ve nada mas.
//
// La regla que no se puede romper: en papel ella marca fuera de orden,
// a medias, mientras habla por telefono. Todo aqui es de TOQUE. Si le
// pedimos escribir fechas a mano, perdimos — el papel es mas rapido que
// cualquier formulario.
// ═══════════════════════════════════════════════════════════════════

import { useState } from "react";
import { tr } from "./ui";
import { downloadChecklist } from "./barrettChecklist";
import {
  ORDERS, ONE_SHOT_ORDERS, orderState, stampOrder, clearOrder, stampOneShot,
  oneShotDone, processingQueue, queueCounts, PROCESSORS, PROCESSOR_IDS,
  processorOf, DEFAULT_PROCESSOR, GATE1_ITEMS, gate1Item, FINDING_WAITING,
  WAITING_IDS, waitingMeta, openFindings, addFinding, resolveFinding, findingAge,
  lenderNameOf, daysBetween, daysInStage, stageClock, today, okDate,
  noteEntries, addNoteEntry, contingencyHeadline, upcomingDeadlines,
  setOrderNote, miLooksWrong, INTAKE_GROUPS, INTAKE_FIELDS, intakeValue, intakeApplies,
  setIntake, intakeCompleteness, dpaReady, allOrderStates, pendingOrders,
  currentRegistration, stampRegistrationDate, setRegistrationField,
  loanNumberInvestor, loanNumberLender, MILESTONES, visibleMilestones,
  milestoneAt, stampMilestone, UW_OUTCOME_IDS, uwOutcomeMeta, uwOutcome,
  uwOutcomeAt, setUwOutcome, clearUwOutcome, signalColor,
  setOrderDue, orderDue, orderPastDue,
  GATE1_VERIFY_IDS, GATE1_STATES, gate1State, gate1At, cycleGate1, gate1Coverage,
} from "./pipelineCore";

// Autocontenido a proposito: recibe `lang` y traduce solo. Asi no
// depende de las variables de modulo de App.jsx y se puede mover.
const mk = lang => ({
  T: (k, v) => tr(k, lang, v),
  P: o => (o && typeof o === "object" && !Array.isArray(o))
    ? (o[lang] ?? o.es ?? o.en ?? "") : o,
});

const md = iso => iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : "—";
// Las notas del motor viven como note_es / note_en.
const PN = (o, lang) => o ? (o["note_" + lang] ?? "") : "";
const C = {
  bg: "#0D1117", card: "#161B22", line: "#21262D", edge: "#30363D",
  dim: "#484F58", mid: "#6E7681", soft: "#8B949E", text: "#E6EDF3",
  gold: "#F5A623", green: "#7EC8A4", red: "#E85D75", ok: "#06D6A0",
};

// ─── UN PEDIDO ─────────────────────────────────────────────────────
// Dos botones por renglon y nada mas. Verde con fecha = hecho. Un
// segundo toque en algo verde lo deshace, porque marcar por error es
// inevitable y no puede costar una llamada.
function OrderRow({ file, def, lang, onSave, readOnly }) {
  const { T, P } = mk(lang);
  const o = orderState(file, def.id);
  const [confirm, setConfirm] = useState(null);

  const chip = (which, hecho, fecha) => {
    const label = which === "req" ? T("orderReq") : T("orderRec");
    const armado = confirm === which;
    if (readOnly) {
      return (
        <span style={{ fontSize: 10, padding: "4px 9px", borderRadius: 4,
          background: hecho ? "rgba(6,214,160,.12)" : "transparent",
          color: hecho ? C.ok : C.dim, fontFamily: "DM Mono" }}>
          {hecho ? `${label} ${md(fecha)}` : label}
        </span>
      );
    }
    return (
      <button className="hov"
        onClick={() => {
          if (hecho) {
            if (!armado) { setConfirm(which); setTimeout(() => setConfirm(null), 3000); return; }
            setConfirm(null);
            onSave(clearOrder(file, def.id, which));
          } else {
            onSave(stampOrder(file, def.id, which, null));
          }
        }}
        title={hecho ? T("orderUndo") : ""}
        style={{
          fontSize: 10, padding: "4px 9px", borderRadius: 4, cursor: "pointer",
          fontFamily: "DM Mono", whiteSpace: "nowrap",
          background: armado ? "rgba(232,93,117,.15)" : hecho ? "rgba(6,214,160,.12)" : "#21262D",
          color: armado ? C.red : hecho ? C.ok : C.soft,
          border: `1px solid ${armado ? C.red : hecho ? C.ok : C.edge}`,
        }}>
        {armado ? T("orderUndoAsk") : hecho ? `${label} ${md(fecha)}` : label}
      </button>
    );
  };

  // Rojo si el vendor paso su PROPIA fecha prometida; dorado si solo lleva
  // una semana esperando. La promesa rota pesa mas que la espera larga.
  const vencido = orderPastDue(file, def.id);
  const tarde = !vencido && o.state === "ordered" && o.days >= 7;
  const [nota, setNota] = useState(o.note || "");
  const [abierta, setAbierta] = useState(false);

  return (
    <div style={{ background: C.card, padding: "8px 11px", borderRadius: 5 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 7, alignItems: "center" }}>
        <span style={{ color: C.text, fontSize: 11 }}>
          {P(def)}
          {o.state === "ordered" && (
            <span style={{ color: vencido ? C.red : tarde ? C.gold : C.dim, fontSize: 9, marginLeft: 7 }}>
              {vencido ? T("orderLate") : T("orderWaiting", { n: o.days })}
            </span>
          )}
        </span>
        {chip("req", !!o.req, o.req)}
        {chip("rec", !!o.rec, o.rec)}
        {!readOnly && (
          <button className="hov" onClick={() => setAbierta(v => !v)}
            title={T("orderNoteHint")}
            style={{ background: "transparent", border: "none", cursor: "pointer",
              color: o.note ? C.gold : C.dim, fontSize: 12, padding: "0 2px" }}>
            {o.note ? "✎" : "+"}
          </button>
        )}
      </div>

      {def.id === "appraisal" && !readOnly && o.req && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
          <span style={{ fontSize: 9, color: C.dim }}>{T("orderDue")}</span>
          <input type="date" value={orderDue(file, def.id) || ""}
            onChange={e => onSave(setOrderDue(file, def.id, e.target.value))}
            title={T("orderDueHint")}
            style={{ background: C.bg, border: `1px solid ${vencido ? C.red : C.edge}`,
              borderRadius: 4, color: vencido ? C.red : C.text, padding: "3px 7px",
              fontSize: 10, fontFamily: "DM Mono" }} />
        </div>
      )}

      {o.note && !abierta && (
        <div style={{ fontSize: 10, color: C.gold, lineHeight: 1.45, marginTop: 5,
          borderLeft: `2px solid ${C.gold}`, paddingLeft: 7 }}>
          {o.note}
          <span style={{ color: C.dim, fontSize: 9 }}>
            {o.noteAt ? `  ${o.noteAt}` : ""}{o.noteBy ? ` · ${String(o.noteBy).split(" ")[0]}` : ""}
          </span>
        </div>
      )}

      {abierta && !readOnly && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input value={nota} onChange={e => setNota(e.target.value)}
            placeholder={T("orderNotePlaceholder")}
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 4,
              color: C.text, padding: "5px 8px", fontSize: 10.5, fontFamily: "DM Mono" }} />
          <button className="hov"
            onClick={() => { onSave(setOrderNote(file, def.id, nota, null)); setAbierta(false); }}
            style={{ background: C.gold, color: C.bg, border: "none", borderRadius: 4,
              padding: "5px 11px", fontSize: 10, fontFamily: "DM Mono", cursor: "pointer" }}>
            {T("save")}
          </button>
        </div>
      )}
    </div>
  );
}

// Un campo numerico NO puede convertir en cada tecla. Al escribir "3.5"
// la cadena pasa por "3." y Number("3.") es 3, asi que el punto se
// borraba solo y nunca se podia llegar al 5. Se guarda el texto mientras
// se escribe y se convierte al salir del campo.
function NumField({ value, onCommit, style }) {
  const [txt, setTxt] = useState(value === null || value === undefined ? "" : String(value));
  const [editing, setEditing] = useState(false);
  const mostrado = editing ? txt : (value === null || value === undefined ? "" : String(value));
  return (
    <input value={mostrado} inputMode="decimal"
      onFocus={() => { setTxt(value === null || value === undefined ? "" : String(value)); setEditing(true); }}
      onChange={e => setTxt(e.target.value.replace(/[^\d.]/g, ""))}
      onBlur={() => { setEditing(false); onCommit(txt); }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      style={style} />
  );
}

// ─── ADMISION ──────────────────────────────────────────────────────
// Dieciocho campos que nadie escribia y la procesadora reconstruia de
// los documentos en cada archivo. Los marcados con ◆ alimentan tambien
// la decision de DPA — se capturan una vez y sirven para las dos cosas.
export function IntakePane({ file, lang, onSave, readOnly }) {
  const { T, P } = mk(lang);
  const cov = intakeCompleteness(file);
  const listoDpa = dpaReady(file);
  const fs = { background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 5,
    color: C.text, padding: "6px 8px", fontSize: 11, fontFamily: "DM Mono", width: "100%" };

  const campo = f => {
    const v = intakeValue(file, f.id);
    const set = val => onSave(setIntake(file, f.id, val));
    if (readOnly) {
      const txt = f.type === "pick" ? P(f.opts.find(o => o.v === v)) || "—"
        : f.type === "yesno" ? (v === "yes" ? T("yesShort") : v === "no" ? T("noShort") : "—")
        : v === null ? "—" : f.type === "money" ? "$" + Number(v).toLocaleString()
        : f.type === "pct" ? v + "%" : String(v);
      return <div style={{ fontSize: 11, color: v === null ? C.dim : C.text }}>{txt}</div>;
    }
    if (f.type === "pick") {
      return (
        <select value={v ?? ""} onChange={e => set(e.target.value || null)} style={fs}>
          <option value="">—</option>
          {f.opts.map(o => <option key={o.v} value={o.v}>{P(o)}</option>)}
        </select>
      );
    }
    if (f.type === "yesno") {
      return (
        <div style={{ display: "flex", gap: 5 }}>
          {[["yes", T("yesShort")], ["no", T("noShort")]].map(([val, lbl]) => (
            <button key={val} className="hov" onClick={() => set(v === val ? null : val)}
              style={{ flex: 1, background: v === val ? C.green : "transparent",
                color: v === val ? C.bg : C.mid, border: `1px solid ${v === val ? C.green : C.edge}`,
                borderRadius: 4, padding: "5px 0", fontSize: 10, fontFamily: "DM Mono",
                cursor: "pointer" }}>{lbl}</button>
          ))}
        </div>
      );
    }
    if (f.type === "money" || f.type === "pct") {
      return <NumField value={v} onCommit={set} style={fs} />;
    }
    return <input value={v ?? ""} onChange={e => set(e.target.value)} style={fs} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: cov.pct === 100 ? C.green : C.soft }}>
          {T("intakeCoverage", { f: cov.filled, t: cov.total })}
        </span>
        <span style={{ fontSize: 9.5, color: listoDpa ? C.green : C.gold, marginLeft: "auto" }}>
          {listoDpa ? T("dpaDataYes") : T("dpaDataNo")}
        </span>
      </div>

      {INTAKE_GROUPS.map(g => {
        const campos = INTAKE_FIELDS.filter(f => f.group === g.id && intakeApplies(file, f.id));
        if (!campos.length) return null;
        return (
          <div key={g.id}>
            <div style={{ fontSize: 9, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
              {P(g).toUpperCase()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
              {campos.map(f => (
                <div key={f.id}>
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 3 }}>
                    {P(f)}{f.dpa ? <span style={{ color: C.gold }}> ◆</span> : ""}
                  </div>
                  {campo(f)}
                  {f.note_es && (
                    <div style={{ fontSize: 8.5, color: C.dim, marginTop: 2, lineHeight: 1.4 }}>
                      {lang === "en" ? f.note_en : f.note_es}
                    </div>
                  )}
                  {f.id === "miPct" && miLooksWrong(file) && (
                    <div style={{ fontSize: 8.5, color: C.red, marginTop: 2, lineHeight: 1.4 }}>
                      {T("miWrong", { n: intakeValue(file, "miPct") })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 9, color: C.dim, lineHeight: 1.5 }}>{T("intakeHintLo")}</div>
    </div>
  );
}

// ─── HITOS, DIVULGACIONES Y RESULTADO DE UW ────────────────────────
// Los doce campos de la forma de Barrett que ningun avance de etapa
// produce. Se exporta porque el mismo bloque tiene que verse en la
// pantalla de procesamiento Y en el archivo completo: si Martha marca
// algo y Jose no lo ve, volvemos a los tres correos por semana.
//
// Sin colores nuevos: gris sin sello, dorado se avecina, verde hecho,
// rojo vencido. Los mismos seis de siempre.
export function MilestonesPane({ file, lang, onSave, readOnly }) {
  const { T, P } = mk(lang);
  const [nota, setNota] = useState("");
  // pdf-lib pesa ~400 KB y se baja al primer clic. Sin aviso, el boton
  // parece muerto en conexion lenta.
  const [imprimiendo, setImprimiendo] = useState(false);
  const [inv, setInv] = useState(loanNumberInvestor(file) || "");
  const [len, setLen] = useState(loanNumberLender(file) || "");
  const reg = currentRegistration(file);
  const res = uwOutcome(file);

  const sello = (hecho, label, onClick, roto) => (
    <button className="hov" disabled={readOnly}
      onClick={readOnly ? undefined : onClick}
      style={{ background: hecho ? "rgba(6,214,160,.12)" : "transparent",
        color: hecho ? C.ok : roto ? C.red : C.soft,
        border: `1px solid ${hecho ? C.ok : roto ? C.red : C.edge}`,
        borderRadius: 4, padding: "4px 9px", fontSize: 10, fontFamily: "DM Mono",
        cursor: readOnly ? "default" : "pointer", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );

  const fs = { background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 4,
    color: C.text, padding: "5px 8px", fontSize: 10.5, fontFamily: "DM Mono", width: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* DIVULGACIONES — el envio ya viene sellado del registro; la firma no */}
      {reg && (
        <div>
          <div style={{ fontSize: 9, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
            {T("discSent").toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, padding: "4px 9px", borderRadius: 4, fontFamily: "DM Mono",
              background: reg.discSentAt ? "rgba(6,214,160,.12)" : "transparent",
              color: reg.discSentAt ? C.ok : C.dim,
              border: `1px solid ${reg.discSentAt ? C.ok : C.edge}` }}>
              {T("discSent")} {md(reg.discSentAt)}
            </span>
            {sello(!!reg.discEsignedAt,
              `${T("discEsigned")} ${reg.discEsignedAt ? md(reg.discEsignedAt) : ""}`.trim(),
              () => onSave(stampRegistrationDate(file, "discEsignedAt")))}
            {sello(!!reg.barrettDiscSentAt,
              `${T("barrettDisc")} ${reg.barrettDiscSentAt ? md(reg.barrettDiscSentAt) : ""}`.trim(),
              () => onSave(stampRegistrationDate(file, "barrettDiscSentAt")))}
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{T("discHint")}</div>
        </div>
      )}

      {/* NUMEROS DEL PRESTAMO — viven en el ciclo, no en el archivo */}
      {reg && !readOnly && (
        <div>
          <div style={{ fontSize: 9, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
            {T("loanNumbers")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 3 }}>{T("loanNoInvestor")}</div>
              <input value={inv} onChange={e => setInv(e.target.value)}
                onBlur={() => onSave(setRegistrationField(file, { loanNumberInvestor: inv }))}
                style={fs} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 3 }}>
                {T("loanNoLender")} <span style={{ color: C.edge }}>· {T("loanNoOne")}</span>
              </div>
              <input value={len} onChange={e => setLen(e.target.value)}
                onBlur={() => onSave(setRegistrationField(file, { loanNumberLender: len }))}
                style={fs} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{T("loanNoHint")}</div>
        </div>
      )}

      {/* RESULTADO DE UW — tres resultados, no una fecha */}
      <div>
        <div style={{ fontSize: 9, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
          {T("uwResult")}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {UW_OUTCOME_IDS.map(id => {
            const m = uwOutcomeMeta(id), on = res === id;
            const col = signalColor(m.signal);
            return (
              <button key={id} className="hov" disabled={readOnly}
                onClick={readOnly ? undefined : () => onSave(setUwOutcome(file,
                  { outcome: id, note: nota, by: file.__who || null }))}
                style={{ background: on ? col : "transparent", color: on ? C.bg : col,
                  border: `1px solid ${col}`, borderRadius: 4, padding: "4px 10px",
                  fontSize: 10, fontFamily: "DM Mono",
                  cursor: readOnly ? "default" : "pointer" }}>
                {P(m)}
              </button>
            );
          })}
          {res && !readOnly && (
            <button className="hov" onClick={() => onSave(clearUwOutcome(file))}
              style={{ background: "transparent", border: "none", color: C.dim,
                fontSize: 9.5, fontFamily: "DM Mono", cursor: "pointer" }}>
              {T("uwClear")}
            </button>
          )}
        </div>
        {res ? (
          <div style={{ fontSize: 10, color: signalColor(uwOutcomeMeta(res).signal), marginTop: 5 }}>
            {T("uwResultOn", { o: P(uwOutcomeMeta(res)), d: md(uwOutcomeAt(file)) })}
            {file.uwResult?.note ? ` · ${file.uwResult.note}` : ""}
            {PN(uwOutcomeMeta(res), lang) ? (
              <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{PN(uwOutcomeMeta(res), lang)}</div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: C.dim, marginTop: 5 }}>{T("uwResultNone")}</div>
        )}
        {!readOnly && !res && (
          <input value={nota} onChange={e => setNota(e.target.value)}
            placeholder={T("uwResultNote")} style={{ ...fs, marginTop: 6 }} />
        )}
        <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{T("uwResultHint")}</div>
      </div>

      {/* HITOS SUELTOS */}
      <div>
        <div style={{ fontSize: 9, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
          {T("milestones")}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {visibleMilestones(file).map(m => {
            const at = milestoneAt(file, m.id);
            return sello(!!at, `${P(m)} ${at ? md(at) : ""}`.trim(),
              () => onSave(stampMilestone(file, m.id)));
          })}
        </div>
        <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{T("milestonesHint")}</div>
      </div>

      {/* EL PAPEL. Sale de salida, no de entrada: se trabaja en pantalla y
          se imprime para respaldo. Con la forma de Barrett tal cual, sin
          nuestra marca, porque quien lo revisa es Barrett. */}
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <button className="hov" disabled={imprimiendo}
          onClick={async () => {
            setImprimiendo(true);
            try { await downloadChecklist(file); }
            catch { alert(T("chkFailed")); }
            finally { setImprimiendo(false); }
          }}
          title={T("chkHint")}
          style={{ width: "100%", background: "#21262D",
            color: imprimiendo ? C.dim : C.soft, borderRadius: 5,
            padding: "8px 0", fontFamily: "DM Mono", fontSize: 10.5,
            border: `1px solid ${C.edge}`, cursor: imprimiendo ? "wait" : "pointer" }}>
          {imprimiendo ? T("chkBusy") : T("chkPrint")}
        </button>
        <div style={{ fontSize: 9, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>{T("chkHint")}</div>
      </div>
    </div>
  );
}

// ─── HALLAZGOS, VERSION COMPACTA ───────────────────────────────────
// ─── HALLAZGOS, VERSION COMPACTA ───────────────────────────────────
// Arriba, los doce puntos con su estado. Abajo, lo que salio mal. Es el
// mismo tema —la pagina 2 del checklist de Barrett— y por eso vive en una
// sola solapa: marcar limpio y levantar un problema son la misma revision
// con dos resultados.
function Gate1Grid({ file, lang, onSave, who, readOnly }) {
  const { T, P } = mk(lang);
  const cov = gate1Coverage(file);
  const TONO = { pending: C.mid, verified: C.ok, na: C.dim, finding: C.red };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: C.soft, letterSpacing: "1px" }}>{T("gate1Title")}</span>
        <span style={{ fontSize: 9.5, color: cov.pending === 0 ? C.ok : C.soft, marginLeft: "auto" }}>
          {cov.pending === 0 && cov.findings === 0
            ? T("gate1AllDone", { t: cov.total })
            : T("gate1Coverage", { d: cov.done, t: cov.total, p: cov.pending })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))", gap: 4 }}>
        {GATE1_VERIFY_IDS.map(id => {
          const st = gate1State(file, id);
          const col = TONO[st];
          const at = gate1At(file, id);
          const bloqueado = st === "finding";
          return (
            <button key={id} className="hov" disabled={readOnly}
              onClick={readOnly || bloqueado ? undefined : () => onSave(cycleGate1(file, id, who))}
              title={bloqueado ? T("gate1Blocked") : ""}
              style={{
                background: st === "verified" ? "rgba(6,214,160,.10)"
                  : st === "finding" ? "rgba(232,93,117,.10)" : "transparent",
                border: `1px solid ${st === "pending" ? C.edge : col}`,
                borderRadius: 4, padding: "5px 8px", textAlign: "left",
                cursor: readOnly || bloqueado ? "default" : "pointer",
                fontFamily: "DM Mono", display: "flex", flexDirection: "column", gap: 1,
              }}>
              <span style={{ fontSize: 10, color: st === "na" ? C.dim : C.text, lineHeight: 1.3 }}>
                {P(gate1Item(id))}
              </span>
              <span style={{ fontSize: 8.5, color: col }}>
                {P(GATE1_STATES[st])}
                {at && st !== "finding" ? ` · ${md(at)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{T("gate1Hint")}</div>
    </div>
  );
}

function Findings({ file, lang, onSave, who, readOnly }) {
  const { T, P } = mk(lang);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("employment_2y");
  const [text, setText] = useState("");
  const [waiting, setWaiting] = useState("lo");
  const abiertos = openFindings(file);
  const fs = { background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 5,
    color: C.text, padding: "6px 8px", fontSize: 11, fontFamily: "DM Mono", width: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Gate1Grid file={file} lang={lang} onSave={onSave} who={who} readOnly={readOnly} />
      {abiertos.map(f => {
        const w = waitingMeta(f.waitingOn), edad = findingAge(f);
        return (
          <div key={f.id} style={{ background: "rgba(232,93,117,.08)",
            borderLeft: `2px solid ${C.red}`, borderRadius: "0 5px 5px 0", padding: "7px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9.5, color: C.soft }}>{P(gate1Item(f.item))}</span>
              <span style={{ fontSize: 9.5, color: w?.color || C.soft }}>{P(w)}</span>
            </div>
            <div style={{ fontSize: 11, color: C.text, lineHeight: 1.45, margin: "3px 0" }}>{f.text}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: edad >= 7 ? C.red : C.dim }}>
                {f.at}{f.by ? " · " + String(f.by).split(" ")[0] : ""}
                {edad !== null ? " · " + T("findingDaysOpen", { n: edad }) : ""}
              </span>
              {!readOnly && (
                <button className="hov" onClick={() => onSave(resolveFinding(file, f.id, { by: who }))}
                  style={{ background: "#21262D", border: `1px solid ${C.green}`, borderRadius: 4,
                    color: C.green, fontSize: 9, padding: "3px 9px", cursor: "pointer", fontFamily: "DM Mono" }}>
                  {T("findingResolve")}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {readOnly ? null : !open ? (
        <button className="hov" onClick={() => setOpen(true)}
          style={{ background: "transparent", border: `1px dashed ${C.edge}`, borderRadius: 5,
            color: C.mid, fontSize: 10, fontFamily: "DM Mono", padding: "6px 0", cursor: "pointer" }}>
          {T("findingAdd")}
        </button>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 5,
          padding: "9px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
          <select value={item} onChange={e => setItem(e.target.value)} style={fs}>
            {GATE1_ITEMS.map(g => <option key={g.id} value={g.id}>{P(g)}</option>)}
          </select>
          <input value={text} onChange={e => setText(e.target.value)}
            placeholder={T("findingWhatPlaceholder")} style={fs} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {WAITING_IDS.map(id => {
              const on = waiting === id, m = FINDING_WAITING[id];
              return (
                <button key={id} className="hov" onClick={() => setWaiting(id)}
                  style={{ background: on ? m.color : "transparent", color: on ? C.bg : m.color,
                    border: `1px solid ${m.color}`, borderRadius: 4, padding: "3px 8px",
                    fontSize: 9.5, fontFamily: "DM Mono", cursor: "pointer" }}>{P(m)}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="hov" disabled={!text.trim()}
              onClick={() => {
                onSave(addFinding(file, { item, text, waitingOn: waiting, by: who }));
                setText(""); setOpen(false);
              }}
              style={{ flex: 2, background: text.trim() ? C.red : C.card,
                color: text.trim() ? C.bg : C.edge, borderRadius: 5, padding: "7px 0",
                fontFamily: "DM Mono", fontSize: 10.5, fontWeight: 500, border: "none",
                cursor: text.trim() ? "pointer" : "not-allowed" }}>{T("findingSave")}</button>
            <button className="hov" onClick={() => { setOpen(false); setText(""); }}
              style={{ flex: 1, background: "#21262D", color: C.soft, borderRadius: 5,
                padding: "7px 0", fontFamily: "DM Mono", fontSize: 10.5, border: "none",
                cursor: "pointer" }}>{T("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EL ARCHIVO ABIERTO ────────────────────────────────────────────
function FilePane({ file, lang, onSave, who, readOnly, onOpenFull }) {
  const { T } = mk(lang);
  const [tab, setTab] = useState("orders");
  const [note, setNote] = useState("");
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  const faltan = coe ? daysBetween(today(), coe) : null;
  const clock = stageClock(file?.stage, file);
  const dias = daysInStage(file);
  const head = contingencyHeadline(file);
  const proximos = upcomingDeadlines(file, 3);

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, color: C.text }}>{file.borrower}</div>
            <div style={{ fontSize: 10, color: C.mid, marginTop: 3 }}>
              {file.type} · {lenderNameOf(file) || T("unassigned")} · {String(file.lo || "").split(" ")[0]}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {coe && <div style={{ fontSize: 11, color: C.gold }}>COE {md(coe)}</div>}
            <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>
              {faltan !== null ? T("closeInDays", { n: faltan }) : ""}
              {dias !== null ? ` · ${T("stageDays", { n: dias })}` : ""}
              {clock ? ` / ${clock.late}d` : ""}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: C.mid, marginTop: 6 }}>{file.stage}</div>
      </div>

      {/* SOLAPAS — un archivo se trabaja por partes, y la procesadora
          no deberia hacer scroll por cinco bloques para llegar al que
          necesita. El contador en la solapa dice si hay algo ahi sin
          tener que entrar. */}
      <div style={{ display: "flex", gap: 14, borderBottom: `1px solid ${C.line}`, paddingBottom: 7 }}>
        {[
          ["orders",   T("orders"),      pendingOrders(file).length],
          ["intake",   T("intake"),      intakeCompleteness(file).total - intakeCompleteness(file).filled],
          ["findings", T("findings"),
            openFindings(file).length + gate1Coverage(file).pending],
          ["checklist", T("milestones"),  0],
          ["dates",    T("derivedDates"), proximos.filter(r => r.overdue).length],
          ["notes",    T("notes"),       noteEntries(file).length],
        ].map(([id, label, n]) => {
          const on = tab === id;
          return (
            <button key={id} className="hov" onClick={() => setTab(id)}
              style={{ background: "transparent", border: "none", cursor: "pointer",
                color: on ? C.gold : C.soft, fontSize: 10.5, fontFamily: "Syne",
                fontWeight: on ? 800 : 500, letterSpacing: "1.2px", padding: "0 0 6px",
                borderBottom: `2px solid ${on ? C.gold : "transparent"}` }}>
              {String(label).replace(/^[^A-Za-zÁ-ú]+/, "")}
              {n > 0 && <span style={{ color: id === "findings" || id === "dates" ? C.red : C.gold }}> {n}</span>}
            </button>
          );
        })}
      </div>

      {tab === "orders" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9.5, color: C.soft, letterSpacing: "1px" }}>{T("orders")}</span>
            {!readOnly && !oneShotDone(file) && (
              <button className="hov" onClick={() => onSave(stampOneShot(file, who))}
                title={T("oneShotHint")}
                style={{ marginLeft: "auto", background: C.gold, color: C.bg, border: "none",
                  borderRadius: 5, padding: "5px 11px", fontFamily: "DM Mono", fontSize: 10,
                  fontWeight: 500, cursor: "pointer" }}>{T("oneShot")}</button>
            )}
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {ORDERS.map(def => (
              <OrderRow key={def.id} file={file} def={def} lang={lang}
                onSave={onSave} readOnly={readOnly} />
            ))}
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 6, lineHeight: 1.5 }}>{T("ordersHint")}</div>
        </div>
      )}

      {tab === "intake" && (
        <IntakePane file={file} lang={lang} onSave={onSave} readOnly={readOnly} />
      )}

      {tab === "findings" && (
        <Findings file={file} lang={lang} onSave={onSave} who={who} readOnly={readOnly} />
      )}

      {tab === "checklist" && (
        <MilestonesPane file={{ ...file, __who: who }} lang={lang}
          onSave={onSave} readOnly={readOnly} />
      )}

      {tab === "dates" && (
        proximos.length === 0
          ? <div style={{ fontSize: 10.5, color: C.dim }}>{T("noDeadlines")}</div>
          : (
            <div>
              {proximos.map(r => (
                <div key={r.stage} style={{ display: "flex", gap: 8, fontSize: 10,
                  fontFamily: "DM Mono", color: r.overdue ? C.red : C.soft, marginBottom: 4 }}>
                  <span style={{ minWidth: 52, color: r.overdue ? C.red : C.text }}>{md(r.startBy)}</span>
                  <span style={{ flex: 1 }}>{r.stage}</span>
                  <span style={{ color: C.dim, fontSize: 9 }}>{r.owner || ""}</span>
                </div>
              ))}
              {head && (
                <div style={{ fontSize: 9.5, color: C.dim, marginTop: 6 }}>
                  {head.short} {md(head.date)}
                </div>
              )}
            </div>
          )
      )}

      {tab === "notes" && (
        <div>
          {noteEntries(file).slice(0, 4).map((n, i) => (
            <div key={i} style={{ borderLeft: `2px solid ${i === 0 ? C.green : C.line}`,
              paddingLeft: 9, marginBottom: 9 }}>
              <div style={{ fontSize: 9, color: C.dim }}>
                {n.legacy ? T("noteLegacy")
                  : `${String(n.at).slice(0, 10)}${n.by ? " · " + n.by : ""}`}
                {n.stage ? ` · ${n.stage}` : ""}
              </div>
              <div style={{ fontSize: 11, color: i === 0 ? C.text : C.soft,
                lineHeight: 1.5, marginTop: 2 }}>{n.text}</div>
            </div>
          ))}
          {!readOnly && (
            <>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder={T("notePlaceholder")}
                style={{ background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 5,
                  color: C.text, padding: "7px 9px", fontSize: 11, fontFamily: "DM Mono", width: "100%" }} />
              <div style={{ fontSize: 9, color: C.gold, marginTop: 4 }}>{T("notesEnglishOnly")}</div>
              <button className="hov" disabled={!note.trim()}
                onClick={() => { onSave(addNoteEntry(file, note, who, file.stage)); setNote(""); }}
                style={{ marginTop: 6, width: "100%", background: note.trim() ? "rgba(126,200,164,.1)" : C.card,
                  color: note.trim() ? C.green : C.edge, borderRadius: 5, padding: "6px 0",
                  fontFamily: "DM Mono", fontSize: 10.5,
                  border: `1px solid ${note.trim() ? C.green : C.line}`,
                  cursor: note.trim() ? "pointer" : "not-allowed" }}>{T("addUpdate")}</button>
            </>
          )}
        </div>
      )}

      {onOpenFull && (
        <button className="hov" onClick={() => onOpenFull(file)}
          style={{ background: "transparent", border: `1px solid ${C.edge}`, borderRadius: 5,
            color: C.mid, fontSize: 10, fontFamily: "DM Mono", padding: "7px 0", cursor: "pointer" }}>
          {T("openFullFile")}
        </button>
      )}
    </div>
  );
}

// ─── LA PANTALLA ───────────────────────────────────────────────────
export default function ProcessingView({ files, profile, lang, onSetLang, onSaveFile, onOpenFull }) {
  const { T, P } = mk(lang);
  const esAdmin = profile?.role === "admin";
  // Una procesadora ve SU cola y nada mas. El admin puede pararse en
  // cualquiera de las dos.
  const propia = profile?.processorId || DEFAULT_PROCESSOR;
  const [quien, setQuien] = useState(esAdmin ? DEFAULT_PROCESSOR : propia);
  const [selId, setSelId] = useState(null);

  const cola = processingQueue(files, quien);
  const conteos = queueCounts(files);
  const planos = cola.flatMap(g => g.files);
  const sel = planos.find(f => f.id === selId) || planos[0] || null;
  // Una procesadora externa no debe editar la cola de la otra, y el
  // admin mira sin tocar cuando no es la suya.
  const readOnly = !esAdmin && quien !== propia;
  const who = profile?.name || null;

  const guardar = next => onSaveFile && onSaveFile(next.id, next);

  return (
    <div className="fi" style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,32%) 1fr", minHeight: 420 }}>

        {/* COLA */}
        <div style={{ borderRight: `1px solid ${C.line}`, background: C.card,
          padding: "12px 10px", maxHeight: 620, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {PROCESSOR_IDS.map(id => {
              const on = quien === id, puede = esAdmin || id === propia;
              if (!puede) return null;
              return (
                <button key={id} className="hov" onClick={() => { setQuien(id); setSelId(null); }}
                  style={{ background: on ? C.gold : "transparent", color: on ? C.bg : C.mid,
                    border: `1px solid ${on ? C.gold : C.edge}`, borderRadius: 5,
                    padding: "4px 10px", fontSize: 10, fontFamily: "DM Mono", cursor: "pointer" }}>
                  {PROCESSORS[id].name.toUpperCase()} {conteos[id] ?? 0}
                </button>
              );
            })}
            {/* Martha y Tina entran directo a su cola: sin esto tendrian
                que salir de la pantalla para cambiar de idioma. */}
            {onSetLang && (
              <div style={{ marginLeft: "auto", display: "flex",
                border: `1px solid ${C.edge}`, borderRadius: 5, overflow: "hidden" }}>
                {["es", "en"].map(l => (
                  <button key={l} className="hov" onClick={() => onSetLang(l)}
                    style={{ background: lang === l ? C.gold : "transparent",
                      color: lang === l ? C.bg : C.mid, border: "none",
                      padding: "4px 8px", fontSize: 9, fontFamily: "DM Mono", cursor: "pointer" }}>
                    {l.toUpperCase()}
                  </button>))}
              </div>
            )}
          </div>

          {cola.length === 0 && (
            <div style={{ color: C.dim, fontSize: 11, padding: "24px 6px", textAlign: "center" }}>
              {T("queueEmpty")}
            </div>
          )}

          {cola.map(g => (
            <div key={g.id} style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 9, color: g.color, letterSpacing: "1px", marginBottom: 5 }}>
                {P(g).toUpperCase()} · {g.files.length}
              </div>
              {g.files.map(f => {
                const on = sel && f.id === sel.id;
                const coe = okDate(f?.contingencies?.coe) || okDate(f?.closing);
                const abiertos = openFindings(f).length;
                return (
                  <div key={f.id} className="hov" onClick={() => setSelId(f.id)}
                    style={{ background: on ? "#1C2530" : C.bg, borderLeft: `2px solid ${g.color}`,
                      padding: "7px 9px", marginBottom: 5, cursor: "pointer",
                      borderRadius: "0 4px 4px 0" }}>
                    <div style={{ color: on ? C.gold : C.text, fontSize: 11,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.borrower}
                    </div>
                    <div style={{ color: C.mid, fontSize: 9, marginTop: 2 }}>
                      {f.type}{coe ? ` · COE ${md(coe)}` : ""}
                      {abiertos ? ` · ⚑ ${abiertos}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ARCHIVO */}
        <div style={{ background: C.bg, maxHeight: 620, overflowY: "auto" }}>
          {sel
            ? <FilePane file={sel} lang={lang} onSave={guardar} who={who}
                readOnly={readOnly} onOpenFull={onOpenFull} />
            : <div style={{ color: C.dim, fontSize: 11, padding: "40px 20px", textAlign: "center" }}>
                {T("queuePick")}
              </div>}
        </div>
      </div>
    </div>
  );
}
