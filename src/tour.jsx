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
//
// Sin prefijo "TRAINING —": la ficha ya lo dice con el borde punteado
// y con la etiqueta, y esas dos el trainee no las puede borrar. El
// nombre sí es editable, así que era la señal más débil de las tres —
// y encima repetía la palabra dos veces en la misma ficha.
export function trainingSampleName(profile) {
  const first = String(profile?.name || "").trim().split(/\s+/)[0] || "Sample";
  return `Maria ${first}`;
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

// ─── EL RECORRIDO DEL MODAL DEL ARCHIVO ────────────────────────────
// NEW FILE son cinco minutos de la vida de un prestamo. Este modal son
// las siguientes seis semanas, y hasta ahora no se enseñaba en ninguna
// parte.
//
// `tab` hace que el recorrido cambie de solapa solo. `roles` limita un
// paso a ciertos puestos: DINERO no lo ve procesamiento, asi que esos
// tres pasos se saltan y el contador se ajusta.
export const DETAIL_STEPS = [
  { id: 1, concept: true,
    en: "This is the file. Everything you can change about a loan lives inside this window.",
    es: "Esto es el archivo. Todo lo que se puede cambiar de un préstamo vive dentro de esta ventana." },
  { id: 2, tab: "file", concept: true,
    en: "Six tabs across the top, in the order you work a file: LOAN, LENDER, DATES, MONEY, DOCUMENTS, FILE.",
    es: "Seis solapas arriba, en el orden en que se trabaja un archivo: PRÉSTAMO, LENDER, FECHAS, DINERO, DOCUMENTOS, EXPEDIENTE." },
  { id: 3, tab: "file", concept: true,
    en: "It opens on FILE on purpose — the notes are here, and what happened is the first thing anyone wants to read.",
    es: "Abre en EXPEDIENTE a propósito — aquí están las notas, y qué pasó es lo primero que uno quiere leer." },
  { id: 4, tab: "file", concept: true,
    en: "One rule holds in all six tabs: on the LEFT is what you capture, on the RIGHT is what the system works out. Learn it once and six screens explain themselves.",
    es: "Una regla se cumple en las seis solapas: a la IZQUIERDA lo que capturas, a la DERECHA lo que el sistema deriva. Apréndela una vez y seis pantallas se explican solas." },

  { id: 5, tab: "file",
    en: "The notes. Each update is a new entry with its date and its author.",
    es: "Las notas. Cada actualización es una entrada nueva con su fecha y su autor." },
  { id: 6, tab: "file",
    en: "Write what happened, who said it, and what comes next. Three lines is enough.",
    es: "Escribe qué pasó, quién lo dijo y qué sigue. Tres líneas bastan." },
  { id: 7, tab: "file", concept: true,
    en: "A note that only says \"pending\" forces someone to call you to find out pending on what.",
    es: "Una nota que solo dice \"pendiente\" obliga a alguien a llamarte para saber pendiente de qué." },
  { id: 8, tab: "file",
    en: "The add button saves instantly. It does not wait for SAVE, because a note is an event and not a field.",
    es: "El botón de agregar guarda al instante. No espera al SAVE, porque una nota es un evento y no un campo." },
  { id: 9, tab: "file", concept: true,
    en: "Never delete what came before. If something was written wrong, write a new entry correcting it — the full history is what lets you reconstruct a file that fell apart.",
    es: "Nunca borres lo anterior. Si algo salió mal escrito, escribe una entrada nueva corrigiéndola — el historial completo es lo que permite reconstruir un archivo que se cayó." },

  { id: 10, tab: "loan",
    en: "LOAN — the client, the product and the amount. This is the identity of the file.",
    es: "PRÉSTAMO — el cliente, el producto y el monto. Esta es la identidad del archivo." },
  { id: 11, tab: "loan",
    en: "The stage. This is the field that gets touched most, and it drives every clock on the card.",
    es: "La etapa. Es el campo que más se toca, y de él salen todos los relojes de la tarjeta." },
  { id: 12, tab: "loan", concept: true,
    en: "ADVANCE moves to the next stage and resets that stage's clock. The file's total age is never reset — that is the number you quote the agent.",
    es: "ADVANCE mueve a la siguiente etapa y reinicia el reloj de esa etapa. La edad total del archivo nunca se reinicia — ese es el número que le citas al agente." },
  { id: 13, tab: "loan",
    en: "PREP takes the file out of the averages without deleting it, for live clients who are not ready yet. It comes back on its review date.",
    es: "PREP saca el archivo de los promedios sin borrarlo, para clientes vivos que todavía no están listos. Regresa en su fecha de revisión." },
  { id: 14, tab: "loan", concept: true,
    en: "PREP is not for a file that is merely slow. If you or someone you can push is the holdup, it stays active.",
    es: "PREP no es para un archivo que solo está lento. Si depende de ti o de alguien a quien puedes empujar, sigue activo." },
  { id: 15, tab: "loan",
    en: "ARCH removes it from counts and averages, and it can be restored. REFER sends it to another banker and records the fee.",
    es: "ARCH lo saca de conteos y promedios, y se puede restaurar. REFER lo manda a otro banquero y registra el fee." },

  { id: 16, tab: "lender",
    en: "LENDER — the channel comes first, because it decides which lenders you can even see.",
    es: "LENDER — el canal va primero, porque decide qué lenders puedes siquiera ver." },
  { id: 17, tab: "lender", concept: true,
    en: "Broker has about 180 lenders; correspondent only 11. Pick correspondent and most of them disappear — the system tells you which ones were left out.",
    es: "En broker hay unos 180 lenders; en correspondent solo 11. Escoges correspondent y la mayoría desaparece — el sistema te dice cuáles quedaron fuera." },
  { id: 18, tab: "lender", concept: true,
    en: "Floating has a deadline. The CD carries the final rate, so you cannot float past the day the CD has to go out — and the system works that day out from the closing date.",
    es: "Flotar tiene fecha límite. El CD lleva la tasa final, así que no se puede flotar más allá del día en que el CD tiene que salir — y el sistema calcula ese día desde la fecha de cierre." },
  { id: 19, tab: "lender", concept: true,
    en: "A lock that expires before closing gives the savings back in the extension. The system tells you which terms reach closing and which do not.",
    es: "Un lock que vence antes del cierre devuelve lo ganado en la extensión. El sistema te dice cuáles términos llegan al cierre y cuáles no." },
  { id: 20, tab: "lender",
    en: "If the lender is not in the catalog, the last option in the menu lets you type it in by hand.",
    es: "Si el lender no está en el catálogo, la última opción del menú te deja escribirlo a mano." },

  { id: 21, tab: "dates",
    en: "DATES — five contingencies, and all of them hang from one: the contract acceptance date.",
    es: "FECHAS — cinco contingencias, y todas cuelgan de una sola: la fecha de aceptación del contrato." },
  { id: 22, tab: "dates", concept: true,
    en: "Appraisal and Loan come from the contract. If they pass unresolved, the client's deposit is exposed. That is not the same as being late to a CTC.",
    es: "Tasación y Préstamo son del contrato. Si se pasan sin resolver, el depósito del cliente queda expuesto. No es lo mismo que llegar tarde a un CTC." },
  { id: 23, tab: "dates", concept: true,
    en: "The engine works backward from each date — using the ceiling, not the average — and gives you the deadline to start each prior stage. That is the list on the card.",
    es: "El motor calcula hacia atrás desde cada fecha —usando el techo, no el promedio— y te da la fecha tope para empezar cada etapa previa. Esa es la lista que sale en la tarjeta." },
  { id: 24, tab: "dates",
    en: "Close each contingency with an outcome: met, waived, extended, missed or N/A. Like a note, it saves on its own.",
    es: "Cierra cada contingencia con un resultado: cumplida, renunciada, extendida, incumplida o no aplica. Como la nota, guarda sola." },

  { id: 25, tab: "dates",
    en: "Scroll down: the CD block, in purple. The lender issues it — here you confirm when it went out.",
    es: "Baja: el bloque del CD, en morado. Lo emite el lender — aquí se confirma cuándo salió." },
  { id: 26, tab: "dates", concept: true,
    en: "Electronic means the client receives it the same day. By mail, the law presumes receipt three business days later — and that presumed date is the one you can defend.",
    es: "Electrónico significa que el cliente lo recibe el mismo día. Por correo postal, la ley presume el recibo tres días hábiles después — y ese presunto es el que se puede defender." },
  { id: 27, tab: "dates", concept: true,
    en: "From receipt, three business days run before signing is allowed. If the signing falls earlier, the block says so in purple: that closing breaks the rule.",
    es: "Desde el recibo corren tres días hábiles antes de poder firmar. Si la firma cae antes, el bloque lo dice en morado: ese cierre rompe la regla." },
  { id: 28, tab: "dates", roles: ["lo", "admin"],
    en: "The fees are yours to review, and nobody else's. A CD that went out with nobody checking the fees is the file that blows up at signing.",
    es: "Los fees son tuyos y de nadie más. Un CD que salió y cuyos fees nadie miró es el archivo que revienta el día de la firma." },

  { id: 29, tab: "money", roles: ["lo", "admin"],
    en: "MONEY — the chain runs gross, then adjustments, then NET, then your percentage.",
    es: "DINERO — la cadena va bruto, después ajustes, después NET, después tu porcentaje." },
  { id: 30, tab: "money", roles: ["lo", "admin"], concept: true,
    en: "Your split applies to the NET, not the gross. On most files nothing is adjusted and the two are the same — but when the branch absorbs a fee, it comes out first.",
    es: "Tu split se aplica al NET, no al bruto. En la mayoría de los archivos no hay ajustes y los dos son iguales — pero cuando la sucursal absorbe un cargo, sale primero." },
  { id: 31, tab: "money", roles: ["lo", "admin"],
    en: "Every adjustment shows with its name and its amount. There is never an unlabeled deduction.",
    es: "Cada ajuste aparece con su nombre y su monto. Nunca hay un descuento sin etiqueta." },

  { id: 32, tab: "docs",
    en: "DOCUMENTS — the submission checklist. You do not build it: it derives from the product, how income is documented, and the contract terms.",
    es: "DOCUMENTOS — la lista de sometimiento. No la armas tú: se deriva del producto, de cómo se documenta el ingreso y de los términos del contrato." },
  { id: 33, tab: "docs", concept: true,
    en: "Each document carries a moment: PTA before registering, PTC before the Clear to Close, PTF before funding. The moment is what tells you how hard to chase it today.",
    es: "Cada documento lleva su momento: PTA antes de registrar, PTC antes del Clear to Close, PTF antes de fondear. El momento es lo que te dice con cuánta fuerza perseguirlo hoy." },
  { id: 34, tab: "docs",
    en: "It also flags risk: a deposit over half the monthly income, a six-month employment gap, a P&L past the quarter. Each one cites its source.",
    es: "También marca riesgos: un depósito sobre la mitad del ingreso mensual, un hueco de empleo de seis meses, un P&L pasado el trimestre. Cada uno cita su fuente." },

  { id: 35, concept: true,
    en: "One gold SAVE at the bottom saves the whole window at once. The only two exceptions are the note and the contingency outcome — both are events, and they save themselves.",
    es: "Un solo SAVE dorado abajo guarda toda la ventana de una vez. Las dos únicas excepciones son la nota y el resultado de contingencia — los dos son eventos, y guardan solos." },

  { id: 36, concept: true,
    en: "ADVANCE will sometimes stop you. Six moments ask for the data that had to be captured at that stage — the 1003, the registration, the CD. It is not a bug: without that data the file looks correct and is not.",
    es: "A veces ADVANCE te va a frenar. Seis momentos piden el dato que debía capturarse en esa etapa — el 1003, el registro, el CD. No es un error: sin ese dato el archivo se ve correcto y no lo está." },
  { id: 37, concept: true,
    en: "Only one warns instead of blocking: the client's signature on the disclosures. It depends on them, not on you, and blocking there would force you to invent a date.",
    es: "Solo una avisa en vez de frenar: la firma del cliente en las divulgaciones. Depende de él, no de ti, y bloquearte ahí te obligaría a inventar una fecha." },
  { id: 38, concept: true,
    en: "If you are truly stuck, only the Branch Manager can unlock it, and has to write why. Going backward is always free: correcting a mistake is never blocked.",
    es: "Si de verdad te trabas, solo el Branch Manager desbloquea y tiene que escribir por qué. Hacia atrás siempre se puede: corregir un error nunca se bloquea." },
  { id: 39, concept: true,
    en: "And up top you may see BACKFILL with a number. That is yours: data left blank on files that already went past the point where it had to be captured. Leave blank what you do not know — an invented date is worse than an empty cell.",
    es: "Y arriba puede que veas RELLENAR con un número. Ese es tuyo: datos en blanco de archivos que ya pasaron el punto donde debían capturarse. Deja en blanco lo que no sepas — una fecha inventada es peor que una celda vacía." },
];

// Los pasos con `owner` solo le salen a ese rol. Tina ve 24; un LO ve
// 23. El mismo recorrido sirve a los cuatro sin escribir cuatro.
export function stepsFor(profile, catalog = TOUR_STEPS) {
  const role = profile?.role || "lo";
  return catalog.filter(s => {
    if (s.owner) return s.owner === role;      // un solo puesto
    if (s.roles) return s.roles.includes(role); // varios puestos
    return true;
  });
}

// ─── 3. PUNTO DE RETOMAR ───────────────────────────────────────────
// Quince minutos sin interrupción en temporada no existen. A Ana la
// llaman en el paso 9; si pierde los 9 no vuelve. Se guarda en el
// navegador y no en Firestore a propósito: el archivo de muestra no
// existe hasta el paso 22, así que no hay documento donde escribirlo
// todavía. Costo: quien cambie de computadora empieza de cero.
const KEY = (uid, which) => "tour:" + (which || "newfile") + ":" + (uid || "anon");

export function readProgress(uid, which) {
  try {
    const v = parseInt(window.localStorage.getItem(KEY(uid, which)), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}

export function writeProgress(uid, idx, which) {
  try { window.localStorage.setItem(KEY(uid, which), String(idx)); } catch { /* modo privado */ }
}

export function clearProgress(uid, which) {
  try { window.localStorage.removeItem(KEY(uid, which)); } catch { /* modo privado */ }
}

export function useTour(profile, active, which = "newfile") {
  const uid = profile?.uid;
  const steps = stepsFor(profile, which === "detail" ? DETAIL_STEPS : TOUR_STEPS);
  const [idx, setIdx] = useState(() => Math.min(readProgress(uid, which), steps.length - 1));

  useEffect(() => { if (active) writeProgress(uid, idx, which); }, [uid, idx, active, which]);

  const next = useCallback(() => setIdx(i => Math.min(i + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setIdx(i => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => { clearProgress(uid, which); setIdx(0); }, [uid, which]);

  return { idx, setIdx, next, back, restart, steps, step: steps[idx] || null };
}

// El recorrido cambia de solapa solo. Pedirle a alguien que busque la
// solapa correcta en el paso 16 es donde se pierde: son seis y estan
// arriba, fuera de donde tiene la vista puesta.
export function useTourTab(step, setTab, active) {
  const wanted = step?.tab;
  useEffect(() => { if (active && wanted) setTab(wanted); }, [wanted, active, setTab]);
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
  // En NEW FILE el ancla es un campo; en el modal es la solapa.
  useTourHighlight(step?.field || step?.tab, true);
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
