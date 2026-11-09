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
import { today, okDate, orderState, findingsOf, openFindings, cdSentAt } from "./pipelineCore";

// ─── 1. IDENTIDAD DEL ARCHIVO DE ENTRENAMIENTO ─────────────────────
// El id lleva el uid adentro para que dos personas puedan entrenar el
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
// primer día se convierte en susto. El paso del teléfono explica el
// aviso en vez de provocarlo.
//
// Sin prefijo "TRAINING —": la ficha ya lo dice con el borde punteado
// y con la etiqueta, y esas dos el trainee no las puede borrar. El
// nombre sí es editable, así que era la señal más débil de las tres —
// y encima repetía la palabra dos veces en la misma ficha.
export function trainingSampleName(profile) {
  const first = String(profile?.name || "").trim().split(/\s+/)[0] || "Sample";
  return `Maria ${first}`;
}

// ─── 1B. DATOS DE PRÁCTICA ─────────────────────────────────────────
// El archivo de práctica nacía con nombre y nada más: FECHAS, el CD y
// DINERO no tenían qué mostrar, y la persona leía sobre un bloque vacío.
// Ahora nace con un contrato de ejemplo, que es lo único que la persona
// no tiene de dónde sacar. Lo que sí puede hacer —el monto, la etapa, la
// nota— lo hace ella: son pasos con acción.
//
// Todas las fechas salen de HOY y van hacia adelante (salvo la aceptación,
// tres días atrás, que es lo normal en un archivo recién abierto). Así
// ninguna contingencia nace vencida y el tablero no se pinta de rojo.
export function addDays(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export const practiceClosing = () => addDays(today(), 35);

export function seedPractice(file) {
  const coe = okDate(file?.closing) || practiceClosing();
  return {
    ...file,
    closing: coe,
    contingencies: {
      contractSignal: addDays(today(), -4),
      contractAccepted: addDays(today(), -3),
      appraisalContingency: addDays(today(), 14),
      loanContingency: addDays(today(), 21),
      ctcTarget: addDays(coe, -7),
      coe,
      fundingDate: addDays(coe, 1),
      capturedAt: today(),
    },
  };
}

// ─── 2. EL CATÁLOGO DE PASOS ───────────────────────────────────────
// Pasos CON ACCIÓN: llevan `hacer` (qué tiene que hacer la persona) y
// `listo(ctx)` (cómo sabe el sistema que ya lo hizo). Mientras no esté
// hecho, Siguiente se queda apagado. Leer no es lo mismo que hacer: estos
// son los cinco o seis movimientos que, si no se practican, se olvidan.
// `ctx` es lo que se está mirando: el formulario en NUEVO ARCHIVO, el
// archivo de práctica en la ventana y en procesamiento.
// `field` corresponde al atributo data-tour del bloque en AddModal.
// `owner` limita el paso a un rol: null = todos lo ven.
// `concept` marca los pasos que enseñan en vez de llenar un campo —
// son los que hacen que esto sea entrenamiento y no un dictado.
//
// Los textos nombran los botones con la MISMA palabra que dice la pantalla
// en cada idioma (NUEVO ARCHIVO, AGREGAR AL PIPELINE, GUARDAR, AVANZAR…).
// Antes el español decía NEW FILE, SAVE, ADVANCE, PREP: el trainee buscaba
// un botón que no existía. `coherencia.mjs` revisa que cada nombre en
// mayúsculas de los pasos exista como texto de un botón en ese idioma.
//
// Ningún paso es solo el nombre del campo ("Teléfono.", "Correo."): cada
// uno dice para qué sirve, o se juntó con el siguiente. Y ningún paso
// promete algo que la pantalla no hace: el aviso de duplicado se explica,
// no se anuncia, porque con datos de práctica no salta.
export const TOUR_STEPS = [
  { id: 1, field: null, concept: true,
    en: "This is NEW FILE. Every loan in the branch starts here. This one is for practice: it has a dotted border on the board and never counts in production.",
    es: "Esto es NUEVO ARCHIVO. Todo préstamo de la sucursal empieza aquí. Este es de práctica: en el tablero lleva borde punteado y nunca cuenta en producción." },

  { id: 2, field: null, concept: true,
    en: "Nothing is saved until the gold button at the bottom, ADD TO PIPELINE. Close with CANCEL and you lose nothing.",
    es: "Nada se guarda hasta el botón dorado de abajo, AGREGAR AL PIPELINE. Si cierras con CANCELAR, no pierdes nada." },

  { id: 3, field: "inbound",
    en: "Inbound referral — leave it off. You only check it when another banker sends you the client; that is how reciprocity gets measured at year end.",
    es: "Referido de otro banquero — déjalo apagado. Solo lo marcas cuando otro banquero te manda al cliente; así se mide la reciprocidad a fin de año." },

  { id: 4, field: "borrower",
    en: "Borrower name. It comes with a practice name; on a real file it is the full legal name, the way it will read on the note.",
    es: "Nombre del cliente. Ya viene con un nombre de práctica; en un archivo real va el nombre legal completo, como se va a leer en el pagaré." },

  { id: 5, field: "phone", concept: true,
    en: "Phone and email. Besides reaching the client, they are how the system spots a duplicate: if either already exists on another file, a warning shows up when you add it. Leave them blank and it cannot protect you.",
    es: "Teléfono y correo. Además de servir para localizar al cliente, son como el sistema detecta un duplicado: si alguno ya existe en otro archivo, al agregar sale un aviso. Si los dejas en blanco, no puede protegerte." },

  { id: 6, field: "amount",
    en: "Loan amount — no commas, no dollar sign. Just the number.",
    es: "Monto del préstamo — sin comas, sin signo de dólar. Solo el número.",
    hacer: { es: "Escribe un monto, por ejemplo 350000.", en: "Type an amount, for example 350000." },
    listo: c => parseInt(c?.loan, 10) > 0 },

  { id: 7, field: "type",
    en: "Loan type. This drives the document checklist and the clock. DPA gets more days in UW than FHA.",
    es: "Tipo de préstamo. De aquí salen la lista de documentos y el reloj. DPA tiene más días en UW que FHA." },

  { id: 8, field: "stage", concept: true,
    en: "Starting stage — where the file really is today, not where you want it. The clock starts here: pick wrong and every deadline after it is wrong.",
    es: "Etapa inicial — dónde está el archivo hoy de verdad, no dónde lo quieres. El reloj arranca de aquí: si escoges mal, toda fecha límite después sale mal.",
    hacer: { es: "Escoge [PR] Full Application. Con esa etapa tu archivo entra a la cola de procesamiento y las partes dos y tres tienen con qué trabajar.",
             en: "Pick [PR] Full Application. At that stage your file enters the processing queue, so parts two and three have something to work with." },
    listo: c => c?.stage === "Full Application" },

  { id: 9, field: "stage", concept: true,
    en: "The letters in brackets are the phase: PQ pre-qual, HH house hunt, PR processing, UW underwriting, CP close prep, CL closing, PC post-close. They are the same filters at the top of the board.",
    es: "Las letras entre corchetes son la fase: PQ precalificación, HH búsqueda de casa, PR procesamiento, UW underwriting, CP preparación de cierre, CL cierre, PC post-cierre. Son los mismos filtros de arriba del tablero." },

  { id: 10, field: "lo",
    en: "Loan officer — whose file this is. That name decides whose volume it counts toward in PRODUCTION.",
    es: "Loan officer — de quién es el archivo. Ese nombre decide a quién se le cuenta el volumen en PRODUCCIÓN." },

  { id: 11, field: "lo", owner: "assistant",
    en: "You're assigning on behalf of someone. The amber warning at the top is there on purpose — confirm the name.",
    es: "Estás asignando en nombre de otra persona. El aviso ámbar de arriba está a propósito — confirma el nombre." },

  { id: 12, field: "partner", concept: true,
    en: "Referral partner — agent, CPA, walk-in. This field is the whole scorecard: blank means the partner gets no credit at year end.",
    es: "Socio referidor — agente, contador, cliente que llegó solo. Este campo es todo el scorecard: en blanco, el socio no recibe crédito a fin de año." },

  { id: 13, field: "closing", concept: true,
    en: "Expected closing date (COE). Once you are inside 7 days, it outranks every other clock. It comes with a practice date five weeks out; along with it, the file gets a sample contract so DATES has something to show.",
    es: "Fecha de cierre esperada (COE). Cuando faltan 7 días o menos, manda sobre todos los demás relojes. Ya viene con una fecha de práctica a cinco semanas; junto con ella, el archivo recibe un contrato de ejemplo para que FECHAS tenga qué mostrar." },

  { id: 14, field: "note", concept: true,
    en: "Notes, always in three parts: STATUS · BLOCKER · NEXT. Example: Subm 4/12 · UW queue · review by 4/15. The note answers \"who am I waiting on\" — it is not a diary.",
    es: "Notas, siempre en tres partes: ESTADO · BLOQUEO · SIGUIENTE, y en inglés, por regla de la sucursal: Martha no lee español. Ejemplo: Subm 4/12 · UW queue · review by 4/15. La nota contesta \"a quién estoy esperando\" — no es un diario.",
    hacer: { es: "Escribe una nota de práctica en inglés, con sus tres partes.", en: "Write a practice note with its three parts." },
    listo: c => String(c?.note || "").trim().length >= 10 },

  // El último paso es el botón mismo: no lleva TERMINAR, se termina
  // agregando. Antes había dos pasos después de este que nadie veía,
  // porque al agregar la ventana se cierra.
  { id: 15, field: "submit", fin: "submit",
    en: "Press ADD TO PIPELINE. Your practice file lands on the board with a dotted border. Open it to start part two: the file window.",
    es: "Presiona AGREGAR AL PIPELINE. Tu archivo de práctica queda en el tablero con borde punteado. Ábrelo para seguir con la segunda parte: la ventana del archivo." },
];

// ─── EL RECORRIDO DEL MODAL DEL ARCHIVO ────────────────────────────
// NEW FILE son cinco minutos de la vida de un prestamo. Este modal son
// las siguientes seis semanas.
//
// `tab` hace que el recorrido cambie de solapa solo. `roles` limita un
// paso a ciertos puestos: DINERO no lo ve procesamiento, asi que esos
// pasos se saltan y el contador se ajusta. Eran 39; se juntaron los que
// decian media idea cada uno, sin quitar ningun concepto.
export const DETAIL_STEPS = [
  { id: 1, tab: "file", concept: true,
    en: "This is the file. Everything you can change about a loan lives in this window. Six tabs across the top, in the order you work a file: LOAN, LENDER, DATES, MONEY, DOCUMENTS, FILE.",
    es: "Esto es el archivo. Todo lo que se puede cambiar de un préstamo vive en esta ventana. Seis solapas arriba, en el orden en que se trabaja: PRÉSTAMO, LENDER, FECHAS, DINERO, DOCUMENTOS, EXPEDIENTE." },
  { id: 2, tab: "file", concept: true,
    en: "It opens on FILE on purpose — the notes are here, and what happened is the first thing anyone wants to read.",
    es: "Abre en EXPEDIENTE a propósito — aquí están las notas, y qué pasó es lo primero que uno quiere leer." },
  { id: 3, tab: "file", concept: true,
    en: "One rule holds in all six tabs: on the LEFT is what you capture, on the RIGHT is what the system works out. Learn it once and six screens explain themselves.",
    es: "Una regla se cumple en las seis solapas: a la IZQUIERDA lo que capturas, a la DERECHA lo que el sistema deriva. Apréndela una vez y seis pantallas se explican solas." },

  { id: 4, tab: "file",
    en: "The notes. Each update is a new entry with its date and its author: what happened, who said it, and what comes next. Three lines is enough.",
    es: "Las notas. Cada actualización es una entrada nueva con su fecha y su autor: qué pasó, quién lo dijo y qué sigue. Tres líneas bastan.",
    hacer: { es: "Escribe una actualización en inglés y presiona + AGREGAR ACTUALIZACIÓN.",
             en: "Write an update and press + ADD UPDATE." },
    listo: f => (f?.noteLog || []).some(n => n && n.at && !n.legacy) },
  { id: 5, tab: "file", concept: true,
    en: "A note that only says \"pending\" forces someone to call you to find out pending on what.",
    es: "Una nota que solo dice \"pendiente\" obliga a alguien a llamarte para saber pendiente de qué." },
  { id: 6, tab: "file", concept: true,
    en: "+ ADD UPDATE saves instantly, without waiting for SAVE: a note is an event, not a field. And never delete what came before — if something was written wrong, add a new entry correcting it. The full history is what lets you rebuild a file that fell apart.",
    es: "+ AGREGAR ACTUALIZACIÓN guarda al instante, sin esperar a GUARDAR: una nota es un evento, no un campo. Y nunca borres lo anterior — si algo salió mal escrito, escribe una entrada nueva corrigiéndolo. El historial completo es lo que permite reconstruir un archivo que se cayó." },

  { id: 7, tab: "loan",
    en: "LOAN — the client, the product and the amount. This is the identity of the file.",
    es: "PRÉSTAMO — el cliente, el producto y el monto. Esta es la identidad del archivo." },
  { id: 8, tab: "loan",
    en: "The stage. This is the field that gets touched most, and it drives every clock on the card.",
    es: "La etapa. Es el campo que más se toca, y de él salen todos los relojes de la tarjeta." },
  { id: 9, tab: "loan", concept: true,
    en: "ADVANCE moves to the next stage and resets that stage's clock. The file's total age is never reset — that is the number you quote the agent.",
    es: "AVANZAR mueve a la siguiente etapa y reinicia el reloj de esa etapa. La edad total del archivo nunca se reinicia — ese es el número que le citas al agente." },
  { id: 10, tab: "loan", concept: true,
    en: "PREPARATION takes the file out of the averages without deleting it, for live clients who are not ready yet; it comes back on its review date. It is not for a file that is merely slow: if you or someone you can push is the holdup, it stays active.",
    es: "PREPARACIÓN saca el archivo de los promedios sin borrarlo, para clientes vivos que todavía no están listos; regresa en su fecha de revisión. No es para un archivo que solo está lento: si depende de ti o de alguien a quien puedes empujar, sigue activo." },
  { id: 11, tab: "loan",
    en: "ARCHIVE removes it from counts and averages, and it can be restored. REFER OUT sends it to another banker and records the fee.",
    es: "ARCHIVAR lo saca de conteos y promedios, y se puede restaurar. REFERIR lo manda a otro banquero y registra el fee." },

  { id: 12, tab: "lender",
    en: "LENDER — the channel comes first, because it decides which lenders you can even see.",
    es: "LENDER — el canal va primero, porque decide qué lenders puedes siquiera ver." },
  { id: 13, tab: "lender", concept: true,
    en: "Broker has about 180 lenders; correspondent only 16. Pick correspondent and most of them disappear — the system tells you which ones were left out.",
    es: "En broker hay unos 180 lenders; en correspondent solo 16. Escoges correspondent y la mayoría desaparece — el sistema te dice cuáles quedaron fuera." },
  { id: 14, tab: "lender", concept: true,
    en: "Floating has a deadline: the CD carries the final rate, so the system works out from the closing date the last day you can float. And a lock that expires before closing gives the savings back in the extension — the system tells you which terms reach closing.",
    es: "Flotar tiene fecha límite: el CD lleva la tasa final, así que el sistema calcula desde la fecha de cierre el último día para flotar. Y un lock que vence antes del cierre devuelve lo ganado en la extensión — el sistema te dice qué plazos llegan al cierre." },
  { id: 15, tab: "lender",
    en: "If the lender is not in the catalog, the last option in the menu lets you type it in by hand.",
    es: "Si el lender no está en el catálogo, la última opción del menú te deja escribirlo a mano." },

  { id: 16, tab: "dates",
    en: "DATES — five contingencies, and all of them hang from one: the contract acceptance date.",
    es: "FECHAS — cinco contingencias, y todas cuelgan de una sola: la fecha de aceptación del contrato." },
  { id: 17, tab: "dates", concept: true,
    en: "Appraisal and Loan come from the contract. If they pass unresolved, the client's deposit is exposed. That is not the same as being late to a CTC.",
    es: "Tasación y Préstamo son del contrato. Si se pasan sin resolver, el depósito del cliente queda expuesto. No es lo mismo que llegar tarde a un CTC." },
  { id: 18, tab: "dates", concept: true,
    en: "The engine works backward from each date — using the ceiling, not the average — and gives you the deadline to start each prior stage. That is the list on the card.",
    es: "El motor calcula hacia atrás desde cada fecha —usando el techo, no el promedio— y te da la fecha tope para empezar cada etapa previa. Esa es la lista que sale en la tarjeta." },
  { id: 19, tab: "dates",
    en: "Close each contingency with an outcome: met, waived, extended, missed or N/A. Like a note, it saves on its own.",
    es: "Cierra cada contingencia con un resultado: cumplida, renunciada, extendida, incumplida o no aplica. Como la nota, guarda sola.",
    hacer: { es: "Registra un resultado en cualquiera de las contingencias del contrato de ejemplo, por ejemplo Tasación → cumplida.",
             en: "Record an outcome on any contingency of the sample contract, for example Appraisal → met." },
    listo: f => Object.values(f?.contingencyResults || {}).some(x => x && x.outcome && x.outcome !== "pending") },
  { id: 20, tab: "dates",
    en: "Further down: the CD block, in purple. The lender issues it — here you confirm when it went out.",
    es: "Más abajo: el bloque del CD, en morado. Lo emite el lender — aquí se confirma cuándo salió.",
    hacer: { es: "Escribe la fecha de hoy como envío del CD. Guarda sola, igual que la nota.",
             en: "Enter today's date as the CD sent date. It saves itself, like the note." },
    listo: f => !!cdSentAt(f) },
  { id: 21, tab: "dates", concept: true,
    en: "Electronic means the client receives it the same day; by mail, the law presumes receipt three business days later. From receipt, three business days run before signing is allowed — if the signing falls earlier, the block says so in purple.",
    es: "Electrónico: el cliente lo recibe el mismo día; por correo, la ley presume el recibo tres días hábiles después. Desde el recibo corren tres días hábiles antes de poder firmar — si la firma cae antes, el bloque lo marca en morado." },
  { id: 22, tab: "dates", roles: ["lo", "admin"],
    en: "The fees are yours to review, and nobody else's. A CD that went out with nobody checking the fees is the file that blows up at signing.",
    es: "Los fees son tuyos y de nadie más. Un CD que salió y cuyos fees nadie miró es el archivo que revienta el día de la firma." },

  { id: 23, tab: "money", roles: ["lo", "admin"], concept: true,
    en: "MONEY — the chain runs gross, adjustments, NET, then your percentage. Your split applies to the NET, not the gross; on most files they are the same, but when the branch absorbs a fee, it comes out first.",
    es: "DINERO — la cadena va bruto, ajustes, NET y después tu porcentaje. Tu split se aplica al NET, no al bruto; casi siempre son iguales, pero cuando la sucursal absorbe un cargo, sale primero." },
  { id: 24, tab: "money", roles: ["lo", "admin"],
    en: "Every adjustment shows with its name and its amount. There is never an unlabeled deduction.",
    es: "Cada ajuste aparece con su nombre y su monto. Nunca hay un descuento sin etiqueta." },

  { id: 25, tab: "docs",
    en: "DOCUMENTS — the submission checklist. You do not build it: it derives from the product, how income is documented, and the contract terms.",
    es: "DOCUMENTOS — la lista de sometimiento. No la armas tú: se deriva del producto, de cómo se documenta el ingreso y de los términos del contrato." },
  { id: 26, tab: "docs", concept: true,
    en: "Each document carries a moment: PTA prior to approval, PTC prior to closing, PTF prior to funding. The moment is what tells you how hard to chase it today.",
    es: "Cada documento lleva su momento: PTA antes de la aprobación, PTC antes del cierre, PTF antes de fondear. El momento es lo que te dice con cuánta fuerza perseguirlo hoy." },
  { id: 27, tab: "docs",
    en: "It also flags risk: a deposit over half the monthly income, a six-month employment gap, a P&L past the quarter. Each one cites its source.",
    es: "También marca riesgos: un depósito sobre la mitad del ingreso mensual, un hueco de empleo de seis meses, un P&L pasado el trimestre. Cada uno cita su fuente." },

  { id: 28, concept: true,
    en: "One gold SAVE at the bottom saves the whole window at once. The only two exceptions are the note and the contingency outcome — both are events, and they save themselves.",
    es: "Un solo GUARDAR dorado abajo guarda toda la ventana de una vez. Las dos únicas excepciones son la nota y el resultado de contingencia — los dos son eventos, y guardan solos." },
  { id: 29, concept: true,
    en: "ADVANCE will sometimes stop you: eight rules ask for the data that had to be captured at that stage — the 1003, the registration, the CD. Only one warns instead of blocking: the client's signature on the disclosures, because it depends on them, not on you.",
    es: "A veces AVANZAR te va a frenar: ocho reglas piden el dato que debía capturarse en esa etapa — el 1003, el registro, el CD. Solo una avisa en vez de frenar: la firma del cliente en las divulgaciones, porque depende de él y no de ti." },
  { id: 30, concept: true,
    en: "If you are truly stuck, only the Branch Manager can unlock it, and has to write why. Going backward is always free: correcting a mistake is never blocked.",
    es: "Si de verdad te trabas, solo el Branch Manager desbloquea y tiene que escribir por qué. Hacia atrás siempre se puede: corregir un error nunca se bloquea." },
  { id: 31, concept: true,
    en: "And up top you may see BACKFILL with a number. That is yours: data left blank on files that already went past the point where it had to be captured. Leave blank what you do not know — an invented date is worse than an empty cell.",
    es: "Y arriba puede que veas RELLENAR con un número. Ese es tuyo: datos en blanco de archivos que ya pasaron el punto donde debían capturarse. Deja en blanco lo que no sepas — una fecha inventada es peor que una celda vacía." },
];

// ─── EL RECORRIDO DE PROCESAMIENTO ─────────────────────────────────
// El tercero: el dia de trabajo de Tina, Laura y Martha.
//
// Uno solo para los tres puestos. `roles` limita los pasos que no son de
// todos, y `stepsFor` ajusta el contador. Las sub-solapas se nombran como
// dice la pantalla: HITOS (no "LISTA") y FECHAS TOPE DERIVADAS.
//
// `tab` mueve la sub-solapa del archivo; `field` señala un bloque de la
// cola por su atributo data-tour.
export const PROCESSING_STEPS = [
  { id: 1, concept: true,
    es: "Esta pantalla no es el tablero. El tablero contesta cómo va cada archivo. Esta contesta qué hago hoy.",
    en: "This screen is not the board. The board answers how each file is doing. This one answers what do I do today." },
  { id: 2, concept: true, field: "cola",
    es: "A la izquierda, la cola: manda el orden del día. A la derecha, el archivo que escojas de la cola: ahí se trabaja.",
    en: "On the left, the queue: it sets the order of the day. On the right, whichever file you pick from the queue: that is where the work happens." },
  { id: 3, concept: true, field: "cola",
    es: "La cola NO está ordenada por etapa. Está agrupada por tipo de trabajo — pedir una tasación y perseguir una condición son dos trabajos distintos aunque los dos archivos estén a la misma distancia del cierre.",
    en: "The queue is NOT ordered by stage. It is grouped by kind of work — ordering an appraisal and chasing a condition are two different jobs even when both files sit the same distance from closing." },

  { id: 4, concept: true, field: "grupo-blocked",
    es: "Bloqueado, en rojo, siempre primero: hay un hallazgo abierto y el archivo no se mueve hasta resolverlo. Va arriba porque es el único grupo donde el trabajo es de otra persona — de quien estás esperando.",
    en: "Blocked, in red, always first: there is an open finding and the file does not move until it is resolved. It sits on top because it is the only group where the work is someone else's — whoever you are waiting on." },
  { id: 5, field: "grupo-new",
    es: "Nuevos · sin ordenar. Recién registrados. Título, HOI y tasación de un tiro.",
    en: "New · nothing ordered. Just registered. Title, HOI and appraisal in one shot." },
  { id: 6, field: "grupo-vendor",
    es: "Esperando vendor. Pedido hecho, todavía no llega. Aquí no se trabaja: se vigila.",
    en: "Waiting on vendor. Ordered, not received yet. Nothing gets worked here: it gets watched." },
  { id: 7, field: "grupo-ready_uw",
    es: "Listos para someter. Llegaron los pedidos y el archivo sigue sin someterse. Este grupo no debería tener a nadie dos días seguidos.",
    en: "Ready to submit. The orders are in and the file has not been submitted. Nobody should sit in this group two days running." },
  { id: 8, field: "grupo-in_uw",
    es: "En underwriting. En manos del underwriter.",
    en: "In underwriting. With the underwriter." },
  { id: 9, field: "grupo-conditions", roles: ["assistant", "admin"],
    es: "Condiciones abiertas. Aprobado, esperando al cliente. Este grupo es tuyo: tú repartes las condiciones y persigues hasta el Clear to Close.",
    en: "Open conditions. Approved, waiting on the borrower. This group is yours: you split the conditions and chase them to Clear to Close." },
  { id: 10, field: "grupo-closing",
    es: "Camino al cierre. CD, CTC, firma y fondeo.",
    en: "Heading to closing. CD, CTC, signing and funding." },
  { id: 11, concept: true, field: "cola",
    es: "Si tu día no tiene un orden, este es: de arriba hacia abajo. Nunca empieces por lo que te parezca más fácil.",
    en: "If your day has no order, this is it: top to bottom. Never start with whatever looks easiest." },
  { id: 12, field: "vencidas",
    es: "La línea roja de arriba son las tareas vencidas. Se toca y filtra la cola a solo lo vencido.",
    en: "The red line up top is the overdue tasks. Tap it and the queue filters down to only what is overdue." },
  { id: 13, field: "colas", roles: ["admin"],
    es: "El selector de cola: puedes pararte en la de Laura o en la de Martha.",
    en: "The queue picker: you can stand in Laura's queue or in Martha's." },
  { id: 14, concept: true, field: "colas",
    es: "Solo editas tu propia cola. Un archivo de otra procesadora lo ves entero y no lo tocas — la cola es de quien tiene el archivo asignado, no del que llega primero.",
    en: "You only edit your own queue. A file in another processor's queue is fully visible and not editable — the queue belongs to whoever the file is assigned to, not to whoever gets there first." },

  { id: 15, tab: "orders",
    es: "Siete sub-solapas, cada una con su contador. El número en rojo —HALLAZGOS y FECHAS TOPE DERIVADAS— es lo que está roto; el dorado es lo que falta.",
    en: "Seven sub-tabs, each with its own counter. The number in red —FINDINGS and DERIVED DEADLINES— is what is broken; the gold one is what is missing." },
  { id: 16, tab: "orders",
    es: "PEDIDOS. Cinco: título y fees, HOI quote, HOI binder, tasación, docs de condominio.",
    en: "ORDERS. Five of them: title and fees, HOI quote, HOI binder, appraisal, condo docs." },
  { id: 17, tab: "orders",
    hacer: { es: "Presiona ORDENAR TODO en tu archivo de práctica.", en: "Press ORDER ALL on your practice file." },
    listo: f => orderState(f, "title").state !== "pending" && orderState(f, "hoi_quote").state !== "pending",
    es: "ORDENAR TODO estampa de un tiro los tres que casi siempre van juntos: título, HOI quote y tasación.",
    en: "ORDER ALL stamps in one shot the three that almost always go together: title, HOI quote and appraisal." },
  { id: 18, tab: "orders", concept: true,
    es: "La tasación NO se puede pedir hasta que el cliente firme las divulgaciones. El botón nace apagado y dice por qué. Es ley, no una regla de la sucursal — 12 CFR 1026.19(a)(1)(iv).",
    en: "The appraisal CANNOT be ordered until the client signs the disclosures. The button starts disabled and says why. That is the law, not a branch rule — 12 CFR 1026.19(a)(1)(iv)." },
  { id: 19, tab: "orders", concept: true,
    es: "Rojo si el vendor pasó SU PROPIA fecha prometida; dorado si solo lleva una semana esperando. Una promesa rota pesa más que una espera larga.",
    en: "Red if the vendor blew ITS OWN promised date; gold if it has only been waiting a week. A broken promise weighs more than a long wait." },
  { id: 20, tab: "intake",
    es: "ADMISIÓN. La captura el LO al precalificar. Tú la completas si falta algo — pero es dato del cliente, no lo inventes.",
    en: "INTAKE. The LO captures it at pre-qual. You complete it if something is missing — but it is the client's data, do not invent it." },

  { id: 21, tab: "findings", concept: true,
    es: "HALLAZGOS. Arriba, la reja del 1003: doce puntos. Puedes marcarlos, pero el dueño de esa reja es el LO: lo normal es que llegue en 12 de 12 y que tú levantes un hallazgo si algo no cuadra.",
    en: "FINDINGS. Up top, the 1003 grid: twelve items. You can mark them, but that grid belongs to the LO: normally it arrives at 12 of 12 and your job is to raise a finding when something does not add up." },
  { id: 22, tab: "findings",
    hacer: { es: "Levanta un hallazgo de práctica: + LEVANTAR HALLAZGO, escoge el punto, escribe qué no cuadra y a quién esperas.",
             en: "Raise a practice finding: + RAISE A FINDING, pick the item, write what does not add up and who you are waiting on." },
    listo: f => findingsOf(f).length > 0,
    es: "Un hallazgo retira la marca verde de ese punto y manda el archivo a BLOQUEADO. Lleva escrito a quién esperas: el LO, el cliente, procesamiento, el lender o título.",
    en: "A finding pulls the green mark off that item and sends the file to BLOCKED. It carries who you are waiting on: the LO, the client, processing, the lender or title." },
  { id: 23, tab: "findings",
    hacer: { es: "Resuelve el hallazgo que acabas de levantar.", en: "Resolve the finding you just raised." },
    listo: f => findingsOf(f).length > 0 && openFindings(f).length === 0,
    es: "Resolver no borra: marca. El punto vuelve a pendiente, no a verde — quien lo verificó tiene que volver a mirarlo.",
    en: "Resolving does not erase: it records. The item goes back to pending, not to green — whoever verified it has to look again." },

  { id: 24, tab: "docs", concept: true,
    es: "DOCUMENTOS. La lista se deriva sola del producto, del ingreso y del contrato. Cada documento lleva su momento —PTA antes de la aprobación, PTC antes del cierre, PTF antes del fondeo— y eso te dice con cuánta fuerza perseguirlo hoy.",
    en: "DOCUMENTS. The list derives itself from the product, the income and the contract. Each document carries its moment —PTA prior to approval, PTC prior to closing, PTF prior to funding— and that tells you how hard to chase it today." },

  { id: 25, tab: "checklist",
    es: "HITOS. Divulgaciones enviadas y firmadas, los números de préstamo que devuelve Arive, el resultado de underwriting y los hitos.",
    en: "MILESTONES. Disclosures sent and signed, the loan numbers Arive returns, the underwriting outcome and the milestones." },
  { id: 26, tab: "checklist", roles: ["assistant", "admin"],
    es: "La fecha de envío de las divulgaciones vive aquí. Es plazo de ley y el envío es nuestro.",
    en: "The disclosures sent date lives here. It is a statutory deadline and sending is on us." },
  { id: 27, tab: "checklist",
    es: "El resultado de underwriting son tres, no una fecha: aprobado, suspendido, denegado.",
    en: "The underwriting outcome is one of three, not a date: approved, suspended, denied." },

  { id: 28, tab: "dates",
    es: "FECHAS TOPE DERIVADAS. Calculadas hacia atrás desde el contrato usando el techo, no el promedio.",
    en: "DERIVED DEADLINES. Worked backward from the contract using the ceiling, not the average." },
  { id: 29, concept: true, tab: "checklist",
    es: "El papel de Barrett sale de aquí, de salida y no de entrada: se trabaja en pantalla y se imprime al final.",
    en: "The Barrett sheet comes out of here, on the way out and not on the way in: the work happens on screen and prints at the end." },
  { id: 30, concept: true, tab: "notes",
    es: "Nunca devuelvas un archivo sin una nota que diga qué pasó. Y nunca borres lo anterior — si algo salió mal escrito, escribe una entrada nueva corrigiéndolo.",
    en: "Never hand a file back without a note saying what happened. And never delete what came before — if something was written wrong, write a new entry correcting it." },
];

// Los pasos con `owner` o `roles` solo le salen a esos puestos, y el
// contador se ajusta. El mismo recorrido sirve a todos sin escribir cuatro.
export function stepsFor(profile, catalog = TOUR_STEPS) {
  const role = profile?.role || "lo";
  return catalog.filter(s => {
    if (s.owner) return s.owner === role;      // un solo puesto
    if (s.roles) return s.roles.includes(role); // varios puestos
    return true;
  });
}

// ─── 3. PUNTO DE RETOMAR ───────────────────────────────────────────
// Quince minutos sin interrupción en temporada no existen. Si a alguien
// lo llaman en el paso 9 y pierde los 9, no vuelve. Se guarda en el
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

// Que el recorrido este cerrado tambien se recuerda, y por el mismo motivo
// que el paso: el de PROCESAMIENTO vivia en estado local de la pantalla, asi
// que cerrarlo duraba hasta salir. Cambiar a la vista de pipeline y volver lo
// abria de nuevo, y habia que cerrarlo otra vez cada vez.
const KEY_OFF = (uid, which) => "tour:off:" + (which || "newfile") + ":" + (uid || "anon");

export function readSkip(uid, which) {
  try { return window.localStorage.getItem(KEY_OFF(uid, which)) === "1"; } catch { return false; }
}

export function writeSkip(uid, which, off) {
  try {
    if (off) window.localStorage.setItem(KEY_OFF(uid, which), "1");
    else window.localStorage.removeItem(KEY_OFF(uid, which));
  } catch { /* modo privado */ }
}

// Empezar de nuevo reinicia LAS TRES partes. Antes solo reiniciaba la
// primera: la ventana del archivo y procesamiento retomaban en el paso
// donde se habian quedado, sobre un archivo de practica recien nacido.
const PARTES = ["newfile", "detail", "processing"];
export function resetAllTours(uid) {
  PARTES.forEach(w => { clearProgress(uid, w); writeSkip(uid, w, false); });
}

// ─── 3B. AVANCE PARA EL ADMIN ──────────────────────────────────────
// El paso de cada quien vive en su navegador (arriba). Esto es otra cosa:
// un resumen en Firestore para que el admin vea en HERRAMIENTAS quién va
// en qué parte y quién terminó. tour.jsx no conoce Firebase: App.jsx le
// pasa la función que escribe, y si no la pasó —o la regla no está
// publicada— el recorrido funciona igual, solo que nadie se entera.
let reporter = null;
export function setTrainingReporter(fn) { reporter = typeof fn === "function" ? fn : null; }
export function reportTraining(profile, parts) {
  if (!reporter || !profile?.uid) return;
  try { reporter(profile, parts); } catch { /* el recorrido no depende de esto */ }
}
export const TRAINING_PARTS = PARTES;

export function useTour(profile, active, which = "newfile") {
  const uid = profile?.uid;
  const CATALOGO = { detail: DETAIL_STEPS, processing: PROCESSING_STEPS, newfile: TOUR_STEPS };
  const steps = stepsFor(profile, CATALOGO[which] || TOUR_STEPS);
  const [idx, setIdx] = useState(() => Math.min(readProgress(uid, which), steps.length - 1));

  useEffect(() => { if (active) writeProgress(uid, idx, which); }, [uid, idx, active, which]);
  // Al admin le llega cada cambio de paso. Un paso es una escritura: en un
  // recorrido de 31 pasos son 31, nada para Firestore.
  useEffect(() => {
    if (!active) return;
    reportTraining(profile, { [which]: { idx: idx + 1, total: steps.length, at: new Date().toISOString() } });
  }, [uid, idx, active, which, steps.length]);

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
// El borde era dorado de 2px. El dorado es el color de marca y esta en toda
// la pantalla —los grupos de la cola, los botones, los avisos—, asi que el
// resaltado se perdia entre lo demas. Y no habia scroll: si el bloque
// siguiente estaba fuera de vista, dar a Siguiente no movia nada visible y
// parecia que el recorrido no respondia.
//
// Cuatro cosas que se suman, porque ninguna sola alcanza:
//   1. Blanco, no dorado. Es el unico color que el sistema NO usa para
//      significar nada, asi que se lee como atencion y no como estado.
//   2. Todo lo demas se apaga. El contraste lo hace el resto, no el borde.
//   3. Un pulso en CADA paso. El ojo caza el movimiento, no el color — que
//      es justo lo que faltaba cuando dos bloques estan pegados.
//   4. Se desplaza hasta el bloque. Era la causa real de "no pasa nada".
const limpiar = n => { n.classList.remove("tour-on", "tour-off"); };

// Lo que dice el bloque resaltado, para que el panel lo nombre. Sale del
// propio DOM y por eso ya viene en el idioma de quien mira: no hace falta
// escribir treinta etiquetas nuevas ni mantenerlas en dos idiomas.
function etiquetaDe(n) {
  // Sin las opciones de los menus: en un <select> el textContent trae
  // todas las etapas pegadas ("ETAPA INICIAL[PQ] Lead Inquiry[PQ]…").
  const copia = n.cloneNode(true);
  copia.querySelectorAll("option, optgroup, select, textarea").forEach(x => x.remove());
  const crudo = (copia.textContent || "").replace(/\s+/g, " ").trim();
  if (!crudo) return null;
  return crudo.length > 42 ? crudo.slice(0, 42).trimEnd() + "…" : crudo;
}

export function useTourHighlight(fieldId, active) {
  const [donde, setDonde] = useState(null);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const nodes = [...document.querySelectorAll("[data-tour]")];
    if (!active) { nodes.forEach(limpiar); setDonde(null); return undefined; }
    let objetivo = null;
    nodes.forEach(n => {
      limpiar(n);
      if (fieldId && n.getAttribute("data-tour") === fieldId) objetivo = n;
      else n.classList.add("tour-off");
    });
    if (objetivo) {
      // Reflujo forzado: sin esto quitar y volver a poner la clase en el
      // mismo cuadro no reinicia la animacion, y el paso siguiente no pulsa.
      void objetivo.offsetWidth;
      objetivo.classList.add("tour-on");
      try { objetivo.scrollIntoView({ behavior: "smooth", block: "center" }); }
      catch { objetivo.scrollIntoView(); }
      setDonde(etiquetaDe(objetivo));
    } else {
      // Un paso sin ancla no apaga la pantalla: son los de concepto, y ahi
      // se lee el panel, no se busca nada.
      nodes.forEach(limpiar);
      setDonde(null);
    }
    return () => nodes.forEach(limpiar);
  }, [fieldId, active]);
  return donde;
}

// ─── 5. EL PANEL ───────────────────────────────────────────────────
// `T` en vez de `t`: la letra suelta tapa el helper bilingüe y ESLint
// lo marca. Es el mismo tropiezo que ya costó una entrega.
// `onExit` esconde el panel; NUNCA cierra la ventana. Antes, en el archivo,
// "Saltar recorrido" era onClose: quien solo queria dejar de leer perdia la
// ventana entera. `onFinish` es el boton TERMINAR del ultimo paso; si no se
// da, hace lo mismo que saltar. Un paso con `fin` (el de AGREGAR AL
// PIPELINE) no lleva TERMINAR: se termina haciendo la accion.
export function TourPanel({ profile, lang, tour, onExit, onFinish, ctx }) {
  const { idx, next, back, steps, step } = tour;
  // En NEW FILE el ancla es un campo; en el modal es la solapa.
  const donde = useTourHighlight(step?.field || step?.tab, true);
  if (!step) return null;

  const T = k => (lang === "en" ? k.en : k.es);
  const pct = Math.round(((idx + 1) / steps.length) * 100);
  const last = idx === steps.length - 1;
  // Un paso con acción no deja seguir hasta que el sistema vea la acción
  // hecha. Se mira el dato, no un clic: si la persona ya lo había hecho
  // antes de llegar al paso, el paso sale ya cumplido.
  const conAccion = typeof step.listo === "function";
  const hecho = conAccion ? !!step.listo(ctx) : true;

  const btn = {
    fontFamily: "var(--ff-mono)", fontSize: "var(--fs-3)", borderRadius: 5,
    padding: "6px 14px", cursor: "pointer", border: "none",
  };

  return (
    <div style={{
      background: "var(--s1)", border: "1px solid var(--gold)", borderRadius: 8,
      padding: "12px 14px", marginBottom: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <span style={{ fontSize: "var(--fs-2)", color: "var(--gold)", letterSpacing: "1px", fontFamily: "var(--ff-mono)" }}>
          {T({ en: `STEP ${idx + 1} OF ${steps.length}`, es: `PASO ${idx + 1} DE ${steps.length}` })}
          {step.concept && <span style={{ color: "var(--t3)", marginLeft: 8 }}>
            {T({ en: "· CONCEPT", es: "· CONCEPTO" })}
          </span>}
        </span>
        <button onClick={onExit} style={{ ...btn, background: "transparent", color: "var(--t3)", padding: "2px 0" }}>
          {T({ en: "Hide tour", es: "Ocultar recorrido" })}
        </button>
      </div>

      <div style={{ fontSize: "var(--fs-4)", color: "var(--t1)", lineHeight: 1.6, marginBottom: donde ? 6 : 10 }}>
        {T(step)}
      </div>
      {conAccion && (
        <div data-tour-accion={hecho ? "hecho" : "pendiente"} style={{
          fontSize: "var(--fs-3)", lineHeight: 1.5, marginBottom: 8, borderRadius: 6, padding: "7px 10px",
          background: hecho ? "rgba(6,214,160,.08)" : "rgba(255,255,255,.06)",
          border: `1px solid ${hecho ? "var(--ok)" : "#FFFFFF"}`,
          color: hecho ? "var(--ok)" : "var(--t1)" }}>
          <span style={{ fontFamily: "var(--ff-mono)", fontSize: "var(--fs-2)", letterSpacing: "1px", marginRight: 6 }}>
            {hecho ? T({ en: "✓ DONE", es: "✓ HECHO" }) : T({ en: "▸ YOUR TURN", es: "▸ TE TOCA" })}
          </span>
          {hecho ? T({ en: "Now press Next.", es: "Ahora presiona Siguiente." }) : T(step.hacer)}
        </div>
      )}
      {donde && (
        <div style={{ fontSize: "var(--fs-2)", color: "var(--t3)", marginBottom: 10,
          fontFamily: "var(--ff-mono)", display: "flex", gap: 6, alignItems: "baseline" }}>
          <span style={{ color: "#FFFFFF" }}>▸</span>
          <span>{T({ en: "Pointing at", es: "Señalando" })}: {donde}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {!last && (
          <button onClick={hecho ? next : undefined} disabled={!hecho}
            title={hecho ? undefined : T({ en: "Do the step first", es: "Primero haz el paso" })}
            style={{ ...btn, background: hecho ? "var(--gold)" : "var(--s2)", color: hecho ? "var(--bg)" : "var(--t4)",
              cursor: hecho ? "pointer" : "not-allowed" }}>
            {T({ en: "Next", es: "Siguiente" })}
          </button>
        )}
        {last && !step.fin && (
          <button onClick={hecho ? (onFinish || onExit) : undefined} disabled={!hecho}
            style={{ ...btn, background: hecho ? "var(--ok)" : "var(--s2)", color: hecho ? "var(--bg)" : "var(--t4)",
              cursor: hecho ? "pointer" : "not-allowed" }}>
            {T({ en: "Finish", es: "Terminar" })}
          </button>
        )}
        {idx > 0 && (
          <button onClick={back} style={{ ...btn, background: "transparent", color: "var(--t2)", border: "1px solid var(--bd)" }}>
            {T({ en: "Back", es: "Atrás" })}
          </button>
        )}
        <div style={{ flex: 1, height: 3, background: "var(--s2)", borderRadius: 2, marginLeft: 6 }}>
          <div style={{ width: pct + "%", height: 3, background: "var(--gold)", borderRadius: 2 }} />
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

// Con el recorrido oculto queda esta tira, para volver a abrirlo sin tener
// que reiniciar el entrenamiento. Mismo texto que el boton de procesamiento.
export function TourReopen({ lang, onOpen }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button className="hov" onClick={onOpen}
        style={{ background: "transparent", color: "var(--gold)", border: "1px solid var(--gold)",
          borderRadius: 5, padding: "4px 10px", fontSize: "var(--fs-2)",
          fontFamily: "var(--ff-mono)", cursor: "pointer" }}>
        {lang === "en" ? "▸ TOUR" : "▸ RECORRIDO"}
      </button>
    </div>
  );
}
