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
import {
  ORDERS, ONE_SHOT_ORDERS, orderState, stampOrder, clearOrder, stampOneShot,
  oneShotDone, processingQueue, queueCounts, PROCESSORS, PROCESSOR_IDS,
  processorOf, DEFAULT_PROCESSOR, GATE1_ITEMS, gate1Item, FINDING_WAITING,
  WAITING_IDS, waitingMeta, openFindings, addFinding, resolveFinding, findingAge,
  lenderNameOf, daysBetween, daysInStage, stageClock, today, okDate,
  latestNote, noteEntries, addNoteEntry, contingencyHeadline, upcomingDeadlines,
} from "./pipelineCore";

// Autocontenido a proposito: recibe `lang` y traduce solo. Asi no
// depende de las variables de modulo de App.jsx y se puede mover.
const mk = lang => ({
  T: (k, v) => tr(k, lang, v),
  P: o => (o && typeof o === "object" && !Array.isArray(o))
    ? (o[lang] ?? o.es ?? o.en ?? "") : o,
});

const md = iso => iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}` : "—";
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

  const tarde = o.state === "ordered" && o.days >= 7;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 7,
      alignItems: "center", background: C.card, padding: "8px 11px", borderRadius: 5 }}>
      <span style={{ color: C.text, fontSize: 11 }}>
        {P(def)}
        {o.state === "ordered" && (
          <span style={{ color: tarde ? C.red : C.dim, fontSize: 9, marginLeft: 7 }}>
            {T("orderWaiting", { n: o.days })}
          </span>
        )}
      </span>
      {chip("req", !!o.req, o.req)}
      {chip("rec", !!o.rec, o.rec)}
    </div>
  );
}

// ─── HALLAZGOS, VERSION COMPACTA ───────────────────────────────────
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
  const [note, setNote] = useState("");
  const coe = okDate(file?.contingencies?.coe) || okDate(file?.closing);
  const faltan = coe ? daysBetween(today(), coe) : null;
  const clock = stageClock(file?.stage, file);
  const dias = daysInStage(file);
  const head = contingencyHeadline(file);
  const proximos = upcomingDeadlines(file, 3);
  const ultima = latestNote(file);

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

      <div>
        <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "1px", marginBottom: 7 }}>
          {T("findings")}
        </div>
        <Findings file={file} lang={lang} onSave={onSave} who={who} readOnly={readOnly} />
      </div>

      {proximos.length > 0 && (
        <div>
          <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "1px", marginBottom: 6 }}>
            {T("derivedDates")}
          </div>
          {proximos.map(r => (
            <div key={r.stage} style={{ display: "flex", gap: 8, fontSize: 10,
              fontFamily: "DM Mono", color: r.overdue ? C.red : C.soft, marginBottom: 3 }}>
              <span style={{ minWidth: 52, color: r.overdue ? C.red : C.text }}>{md(r.startBy)}</span>
              <span style={{ flex: 1 }}>{r.stage}</span>
              <span style={{ color: C.dim, fontSize: 9 }}>{r.owner || ""}</span>
            </div>
          ))}
          {head && (
            <div style={{ fontSize: 9.5, color: C.dim, marginTop: 5 }}>
              {head.short} {md(head.date)}
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ fontSize: 9.5, color: C.soft, letterSpacing: "1px", marginBottom: 6 }}>
          {T("notes")} · {noteEntries(file).length}
        </div>
        {ultima && (
          <div style={{ borderLeft: `2px solid ${C.line}`, paddingLeft: 9, marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: C.dim }}>
              {ultima.legacy ? T("noteLegacy")
                : `${String(ultima.at).slice(0, 10)}${ultima.by ? " · " + ultima.by : ""}`}
            </div>
            <div style={{ fontSize: 11, color: C.soft, lineHeight: 1.5, marginTop: 2 }}>{ultima.text}</div>
          </div>
        )}
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
export default function ProcessingView({ files, profile, lang, onSaveFile, onOpenFull }) {
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
          <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
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
