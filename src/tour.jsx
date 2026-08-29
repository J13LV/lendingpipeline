// ═══════════════════════════════════════════════════════════════════
//  RECORRIDO GUIADO · GUIDED TOUR
//
//  Por qué vive en su propio archivo y no dentro de `App.jsx`:
//  App.jsx tiene 7,295 líneas y se despliega con Ctrl+A → pegar. Cada
//  línea que le agrego es riesgo de despliegue. El catálogo y el motor
//  caben aquí completos; App.jsx solo recibe el montaje y los filtros.
//
//  El archivo de muestra es PERSISTENTE: nace en NEW FILE, se queda en
//  el tablero, y crece con la persona a lo largo de las semanas. El
//  reset no lo "poda" — lo borra entero y se siembra otro. Nunca se
//  escribe una fecha hacia atrás, así que el bug de UTC no tiene por
//  dónde entrar.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

// ─── 1. IDENTIDAD DEL ARCHIVO DE ENTRENAMIENTO ─────────────────────
// El id lleva el uid adentro para que Ana y Marelis puedan entrenar el
// mismo martes sin verse. Cada quien ve el suyo y nadie más.
export const TRAINING_PREFIX = "train-";
export const trainingFileId = profile => TRAINING_PREFIX + (profile?.uid || "anon");

// La bandera es la única fuente de verdad. No se pone con un checkbox
// que alguien pueda marcar por error ni olvidar marcar: la pone el
// motor porque el recorrido estaba activo.
export const isTraining = f => !!f?.isTraining;
export const notTraining = f => !f?.isTraining;

// Filtro de aislamiento. Se aplica en los cuatro puntos donde el
// sistema lee `files` en crudo. Un archivo de entrenamiento no entra a
// producción, ni al scorecard, ni a la cola de nadie, ni a las 100 del
// año.
export const excludeTraining = list => (list || []).filter(notTraining);

// Nombre distinto por persona. Si los cuatro capturan "Maria Sample",
// el detector de duplicados dispara sin que nadie lo pidiera y el
// primer día se convierte en susto. La alerta se provoca a propósito
// en el paso 23, cuando ya hay contexto para entenderla.
export function trainingSampleName(profile) {
  const first = String(profile?.name || "").trim().split(/\s+/)[0] || "Sample";
  return `TRAINING — Maria ${first}`;
}

// ─── 2. EL CATÁLOGO DE PASOS ───────────────────────────────────────
// `field` corresponde al atributo data-tour del bloque en AddModal.
// `owner` limita el paso a un rol: null = todos lo ven.
// `concept` marca los pasos que enseñan en vez de llenar un campo —
// son los que hacen que esto sea entrenamiento y no un dictado.
export const TOUR_STEPS = [
  { id: 1, field: null, concept: true,
    en: "This is NEW FILE. Every loan in the branch starts here.",
    es: "Esto es NEW FILE. Todo préstamo de la sucursal empieza aquí." },

  { id: 2, field: null, concept: true,
    en: "Nothing is saved until the gold button at the bottom. You can close this and lose nothing.",
    es: "Nada se guarda hasta el botón dorado de abajo. Puedes cerrar esto y no pierdes nada." },

  { id: 3, field: "inbound",
    en: "Inbound referral toggle — leave it off. You'll only use it when another banker sends you the client.",
    es: "Interruptor de referido entrante — déjalo apagado. Solo lo usas cuando otro banquero te manda al cliente." },

  { id: 4, field: "borrower",
    en: "Borrower name — full legal name, the way it will read on the note.",
    es: "Nombre del cliente — nombre legal completo, como va a leerse en el pagaré." },

  { id: 5, field: "phone",
    en: "Phone.",
    es: "Teléfono." },

  { id: 6, field: "email",
    en: "Email.",
    es: "Correo." },

  { id: 7, field: "phone", concept: true,
    en: "Phone and email are how the system spots a duplicate. Skip them and it can't protect you.",
    es: "El teléfono y el correo son como el sistema detecta un duplicado. Si los saltas, no puede protegerte." },

  { id: 8, field: "amount",
    en: "Loan amount — no commas, no dollar sign. Just the number.",
    es: "Monto del préstamo — sin comas, sin signo de dólar. Solo el número." },

  { id: 9, field: "type",
    en: "Loan type. This drives the document checklist and the clock. DPA gets more days in UW than FHA.",
    es: "Tipo de préstamo. De aquí salen la lista de documentos y el reloj. DPA tiene más días en UW que FHA." },

  { id: 10, field: "stage",
    en: "Starting stage — where the file really is today, not where you want it.",
    es: "Etapa inicial — dónde está el archivo hoy de verdad, no dónde lo quieres." },

  { id: 11, field: "stage", concept: true,
    en: "The clock starts from what you pick here. Pick wrong and every deadline after it is wrong.",
    es: "El reloj arranca de lo que escojas aquí. Si escoges mal, toda fecha límite después sale mal." },

  { id: 12, field: "stage", concept: true,
    en: "Phase codes: PQ, HH, PR, UW, CP, CL, PC.",
    es: "Códigos de fase: PQ, HH, PR, UW, CP, CL, PC." },

  { id: 13, field: "lo",
    en: "Loan officer.",
    es: "Loan officer." },

  { id: 14, field: "lo", owner: "assistant",
    en: "You're assigning on behalf of someone. The amber warning at the top is there on purpose — confirm the name.",
    es: "Estás asignando en nombre de otra persona. El aviso ámbar de arriba está a propósito — confirma el nombre." },

  { id: 15, field: "partner",
    en: "Referral partner — agent, CPA, walk-in.",
    es: "Socio referidor — agente, contador, cliente que llegó solo." },

  { id: 16, field: "partner", concept: true,
    en: "This field is the whole scorecard. Blank here means the partner gets no credit at year end.",
    es: "Este campo es todo el scorecard. En blanco significa que el socio no recibe crédito a fin de año." },

  { id: 17, field: "closing",
    en: "Expected closing date.",
    es: "Fecha de cierre esperada." },

  { id: 18, field: "closing", concept: true,
    en: "The COE outranks every other clock once you're inside 7 days.",
    es: "El COE manda sobre todos los demás relojes cuando el cierre está a 7 días o menos." },

  { id: 19, field: "note",
    en: "Notes — three parts, always: STATUS · BLOCKER · NEXT.",
    es: "Notas — tres partes, siempre: STATUS · BLOCKER · NEXT." },

  { id: 20, field: "note",
    en: "Example: Subm 4/12 · UW queue · review by 4/15",
    es: "Ejemplo: Subm 4/12 · UW queue · review by 4/15" },

  { id: 21, field: "note", concept: true,
    en: "The note answers \"who am I waiting on.\" Not a diary.",
    es: "La nota contesta \"a quién estoy esperando\". No es un diario." },

  { id: 22, field: "submit",
    en: "Press ADD TO PIPELINE.",
    es: "Presiona ADD TO PIPELINE." },

  { id: 23, field: "submit", concept: true,
    en: "The duplicate warning fires. Read it. It doesn't block you — a client can have a second loan, two relatives can share a phone.",
    es: "Salta el aviso de duplicado. Léelo. No te bloquea — un cliente puede tener un segundo préstamo, y dos familiares pueden compartir teléfono." },

  { id: 24, field: null, concept: true,
    en: "Your file is on the board. It stays there. Next lesson picks it up.",
    es: "Tu archivo está en el tablero. Ahí se queda. La próxima lección lo retoma." },
];

// Los pasos con `owner` solo le salen a ese rol. Tina ve 24; un LO ve
// 23. El mismo recorrido sirve a los cuatro sin escribir cuatro.
export function stepsFor(profile) {
  const role = profile?.role || "lo";
  return TOUR_STEPS.filter(s => !s.owner || s.owner === role);
}

// ─── 3. PUNTO DE RETOMAR ───────────────────────────────────────────
// Quince minutos sin interrupción en temporada no existen. A Ana la
// llaman en el paso 9; si pierde los 9 no vuelve. Se guarda en el
// navegador y no en Firestore a propósito: el archivo de muestra no
// existe hasta el paso 22, así que no hay documento donde escribirlo
// todavía. Costo: quien cambie de computadora empieza de cero.
const KEY = uid => "tour:newfile:" + (uid || "anon");

export function readProgress(uid) {
  try {
    const v = parseInt(window.localStorage.getItem(KEY(uid)), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

export function writeProgress(uid, idx) {
  try { window.localStorage.setItem(KEY(uid), String(idx)); } catch { /* modo privado */ }
}

export function clearProgress(uid) {
  try { window.localStorage.removeItem(KEY(uid)); } catch { /* modo privado */ }
}

export function useTour(profile, active) {
  const uid = profile?.uid;
  const steps = stepsFor(profile);
  const [idx, setIdx] = useState(() => Math.min(readProgress(uid), steps.length - 1));

  useEffect(() => { if (active) writeProgress(uid, idx); }, [uid, idx, active]);

  const next = useCallback(() => setIdx(i => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => { clearProgress(uid); setIdx(0); }, [uid]);

  return { idx, setIdx, next, back, restart, steps, step: steps[idx] || null };
}

// ─── 4. RESALTADO DEL CAMPO ────────────────────────────────────────
// El borde dorado se pone por atributo, no envolviendo cada bloque en
// un componente. Envolver los doce campos habría sido doce cambios
// dentro de AddModal; así son doce atributos y un solo efecto.
export function useTourHighlight(fieldId, active) {
  useEffect(() => {
    if (!active) return undefined;
    const nodes = document.querySelectorAll("[data-tour]");
    nodes.forEach(n => {
      const on = fieldId && n.getAttribute("data-tour") === fieldId;
      n.style.outline = on ? "2px solid #F5A623" : "";
      n.style.outlineOffset = on ? "4px" : "";
      n.style.borderRadius = on ? "6px" : "";
    });
    return () => nodes.forEach(n => {
      n.style.outline = "";
      n.style.outlineOffset = "";
      n.style.borderRadius = "";
    });
  }, [fieldId, active]);
}

// ─── 5. EL PANEL ───────────────────────────────────────────────────
// `T` en vez de `t`: la letra suelta tapa el helper bilingüe y ESLint
// lo marca. Es el mismo tropiezo que ya costó una entrega.
export function TourPanel({ profile, lang, tour, onExit }) {
  const { idx, next, back, steps, step } = tour;
  useTourHighlight(step?.field, true);
  if (!step) return null;

  const T = k => (lang === "en" ? k.en : k.es);
  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const last = idx === steps.length - 1;

  const btn = {
    fontFamily: "DM Mono", fontSize: "var(--fs-3)", borderRadius: 5,
    padding: "6px 14px", cursor: "pointer", border: "none",
  };

  return (
    <div style={{
      background: "#161B22", border: "1px solid #F5A623", borderRadius: 8,
      padding: "12px 14px", marginBottom: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: "var(--fs-2)", color: "#F5A623", letterSpacing: "1px", fontFamily: "DM Mono" }}>
          {T({ en: `STEP ${idx + 1} OF ${steps.length}`, es: `PASO ${idx + 1} DE ${steps.length}` })}
          {step.concept && <span style={{ color: "var(--t3)", marginLeft: 8 }}>
            {T({ en: "· CONCEPT", es: "· CONCEPTO" })}
          </span>}
        </span>
        <button onClick={onExit} style={{ ...btn, background: "transparent", color: "var(--t3)", padding: "2px 0" }}>
          {T({ en: "Skip tour", es: "Saltar recorrido" })}
        </button>
      </div>

      <div style={{ fontSize: "var(--fs-4)", color: "var(--t1)", lineHeight: 1.6, marginBottom: 10 }}>
        {T(step)}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {!last && (
          <button onClick={next} style={{ ...btn, background: "#F5A623", color: "#0D1117" }}>
            {T({ en: "Next", es: "Siguiente" })}
          </button>
        )}
        {idx > 0 && (
          <button onClick={back} style={{ ...btn, background: "transparent", color: "var(--t2)", border: "1px solid #30363D" }}>
            {T({ en: "Back", es: "Atrás" })}
          </button>
        )}
        <div style={{ flex: 1, height: 3, background: "#21262D", borderRadius: 2, marginLeft: 6 }}>
          <div style={{ width: pct + "%", height: 3, background: "#F5A623", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ fontSize: "var(--fs-2)", color: "var(--t4)", marginTop: 8 }}>
        {T({
          en: `Training file for ${profile?.name || "you"} — it never touches production.`,
          es: `Archivo de entrenamiento de ${profile?.name || "ti"} — nunca toca producción.`,
        })}
      </div>
    </div>
  );
}
