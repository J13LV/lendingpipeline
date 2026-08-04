// ═══════════════════════════════════════════════════════════════════
//  CONTENIDO DEL HELP · HELP CONTENT
//
//  Los textos viven aquí, no dentro del componente. Agregar un artículo
//  es escribir texto, no programar.
//
//  REGLA IMPORTANTE: lo que el motor ya sabe no se vuelve a escribir aquí.
//  Etapas, umbrales, puntos de in-house y fechas de corte se reciben como
//  parámetros desde pipelineCore. Si mañana el umbral de Senior cambia de
//  $15M a $12M, esta guía cambia sola. Escrito a mano, quedaría mintiendo
//  hasta que alguien reclamara.
// ═══════════════════════════════════════════════════════════════════

const money = n => "$" + Number(n || 0).toLocaleString();
const M = n => "$" + (Number(n || 0) / 1e6).toLocaleString() + "M";

// Bloques disponibles:
//   p     párrafo
//   lead  párrafo en negrita, para abrir una sección
//   note  caja destacada (tone: gold | green | red | blue)
//   list  viñetas
//   steps lista numerada
//   table encabezados + filas
//   kv    pares etiqueta/valor
export function helpSections(v = {}) {
  const stages = v.stages || {};
  const th = v.thresholds || {};
  const pts = Math.round((v.inHousePoints || 0.10) * 100);

  return [

  // ─────────────────────────────────────────────────────────────────
  {
    id: "start", icon: "▶", color: "#7EC8A4",
    es: "Empezar aquí", en: "Start here",
    articles: [

      {
        id: "que-es",
        es: "Qué es este pipeline", en: "What this pipeline is",
        blocks: [
          { k:"lead",
            es:"Es el registro vivo de cada préstamo de la sucursal, desde la primera llamada hasta el fondeo.",
            en:"It is the live record of every loan in the branch, from first call to funding." },
          { k:"p",
            es:"No es un CRM ni reemplaza a Arive. Arive es donde se origina el préstamo; esto es donde se ve el estado real de todo lo que está en la calle, quién lo tiene, qué falta y qué fecha aprieta.",
            en:"It is not a CRM and does not replace Arive. Arive is where the loan is originated; this is where you see the real status of everything in flight, who has it, what is missing and which date is tight." },
          { k:"p",
            es:"Todo lo que escribas aquí lo ve el equipo al instante. No hay que guardar en dos lugares ni mandar capturas.",
            en:"Everything you write here is visible to the team instantly. No saving in two places, no sending screenshots." },
        ],
      },

      {
        id: "primer-dia",
        es: "Tu primer día", en: "Your first day",
        blocks: [
          { k:"steps",
            es:[
              "Entra con tu correo y la contraseña temporal. Cámbiala desde tu perfil.",
              "Abre ACTIVE PIPELINE. Vas a ver tus archivos y los del equipo.",
              "Abre uno tuyo. Todo lo que se puede editar está dentro de ese modal.",
              "Escribe una actualización en la caja de notas y dale a AGREGAR. Esa es la acción que más vas a repetir.",
              "Baja al bloque verde para ver tu compensación en ese archivo.",
            ],
            en:[
              "Log in with your email and temporary password. Change it from your profile.",
              "Open ACTIVE PIPELINE. You will see your files and the team's.",
              "Open one of yours. Everything editable lives inside that modal.",
              "Write an update in the notes box and hit AGREGAR. That is the action you will repeat most.",
              "Scroll to the green block to see your compensation on that file.",
            ] },
        ],
      },

      {
        id: "tres-reglas",
        es: "Tres reglas que evitan el 90% de los problemas",
        en: "Three rules that prevent 90% of problems",
        blocks: [
          { k:"note", tone:"gold",
            es:"1 · Las fechas se capturan, no se estiman. La fecha de contingencia que va en el sistema es la que dice el contrato, aunque parezca rara. El motor calcula hacia atrás desde ahí, y una fecha aproximada produce un plan aproximado.",
            en:"1 · Dates are captured, not estimated. The contingency date in the system is the one the contract says, even if it looks odd. The engine works backward from it, and an approximate date produces an approximate plan." },
          { k:"note", tone:"gold",
            es:"2 · Cada actualización es una entrada nueva. No borres ni edites lo anterior. El historial con fecha y autor es lo que permite reconstruir qué pasó cuando algo se cae.",
            en:"2 · Every update is a new entry. Do not delete or edit what came before. The dated, attributed history is what lets you reconstruct what happened when something falls apart." },
          { k:"note", tone:"gold",
            es:"3 · Si un número no te cuadra, abre el archivo y pregunta con él a la vista. Todos los cálculos muestran de dónde salen. Discutir de memoria hace perder el doble de tiempo.",
            en:"3 · If a number does not add up, open the file and ask with it in front of you. Every calculation shows where it comes from. Arguing from memory takes twice as long." },
        ],
      },

      {
        id: "quien-ve-que",
        es: "Quién ve qué", en: "Who sees what",
        blocks: [
          { k:"p",
            es:"Todos ven el pipeline completo del equipo: los archivos, sus etapas y sus notas. Eso es a propósito — un archivo atorado lo puede detectar cualquiera.",
            en:"Everyone sees the full team pipeline: files, stages and notes. That is deliberate — anyone can spot a stuck file." },
          { k:"p",
            es:"La compensación es distinta. En tus archivos ves tu monto; no ves lo de nadie más ni el reparto de la sucursal. Los ajustes al NET los fija el Branch Manager.",
            en:"Compensation is different. On your files you see your amount; you do not see anyone else's or the branch split. Adjustments to NET are set by the Branch Manager." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "comp", icon: "$", color: "#06D6A0",
    es: "Tu compensación", en: "Your compensation",
    articles: [

      {
        id: "la-cadena",
        es: "La cadena: de bruto a lo que te llega",
        en: "The chain: from gross to what you get",
        blocks: [
          { k:"p",
            es:"Todo préstamo pasa por los mismos cuatro pasos, en este orden.",
            en:"Every loan goes through the same four steps, in this order." },
          { k:"steps",
            es:["Comisión bruta — lo que paga el lender.",
                "Ajustes — cargos que absorbe la sucursal, o créditos que suman.",
                "NET — el bruto después de los ajustes.",
                "Tu porcentaje, aplicado sobre el NET."],
            en:["Gross commission — what the lender pays.",
                "Adjustments — fees the branch absorbs, or credits that add.",
                "NET — gross after adjustments.",
                "Your percentage, applied to the NET."] },
          { k:"note", tone:"gold",
            es:"El punto que más confusión causa: tu porcentaje se aplica al NET, no al bruto. Si el préstamo pagó 2.00% sobre $400,000, el bruto son $8,000. Si la sucursal absorbió $695 de broker fee, el NET es $7,305. Un split de 70% se calcula sobre $7,305, no sobre $8,000.",
            en:"The point that causes the most confusion: your percentage applies to the NET, not the gross. If the loan paid 2.00% on $400,000, gross is $8,000. If the branch absorbed a $695 broker fee, NET is $7,305. A 70% split is calculated on $7,305, not on $8,000." },
        ],
      },

      {
        id: "ajustes",
        es: "Los ajustes", en: "The adjustments",
        blocks: [
          { k:"p", es:"Hay tres cargos habituales en un préstamo:", en:"There are three usual fees on a loan:" },
          { k:"list",
            es:["Broker fee de Barrett","Underwriting fee del lender","Processing fee"],
            en:["Barrett broker fee","Lender underwriting fee","Processing fee"] },
          { k:"note", tone:"green",
            es:"En la mayoría de los archivos estos los paga el cliente y no tocan la comisión. El NET es igual al bruto y no verás ningún ajuste.",
            en:"On most files the borrower pays these and they never touch the commission. NET equals gross and you will see no adjustments." },
          { k:"p",
            es:"A veces la sucursal absorbe uno para cerrar un trato. Cuando eso pasa, sale del NET, y todos los que participan en ese préstamo lo comparten en proporción a su parte. También existen créditos —un reembolso, un crédito del lender— que suman al NET en vez de restar.",
            en:"Sometimes the branch absorbs one to close a deal. When that happens it comes out of NET, and everyone participating in that loan shares it in proportion to their share. There are also credits — a refund, a lender credit — that add to NET instead of subtracting." },
          { k:"p",
            es:"Cada ajuste aparece en tu archivo con su nombre y su monto. Nunca hay un descuento sin etiqueta.",
            en:"Every adjustment appears in your file with its name and amount. There is never an unlabeled deduction." },
        ],
      },

      {
        id: "etapas",
        es: "Tu porcentaje según tu etapa", en: "Your split by stage",
        blocks: [
          { k:"p",
            es:"Tu split depende de tu etapa, y la etapa la determina tu volumen fondeado. No el calendario, no la antigüedad, no una revisión anual. Tu producción.",
            en:"Your split depends on your stage, and the stage is determined by your funded volume. Not the calendar, not seniority, not an annual review. Your production." },
          { k:"table",
            head:{ es:["Etapa","Tu split","Avanzas al llegar a"], en:["Stage","Your split","You advance at"] },
            rows:[
              [{es:"Newbie",en:"Newbie"},
               Math.round((stages.newbie?.split||.5)*100)+"%",
               {es:M(th.intermediate)+" fondeados", en:M(th.intermediate)+" funded"}],
              [{es:"Intermediate",en:"Intermediate"},
               Math.round((stages.intermediate?.split||.6)*100)+"%",
               {es:M(th.senior)+" fondeados", en:M(th.senior)+" funded"}],
              [{es:"Senior",en:"Senior"},
               Math.round((stages.senior?.split||.7)*100)+"%", "—"],
            ] },
          { k:"note", tone:"green",
            es:"Un split nunca baja. Una vez que subes de etapa, ahí te quedas. La producción se premia, nunca se penaliza.",
            en:"A split never moves down. Once you advance a stage, you stay there. Production is rewarded, never penalized." },
        ],
      },

      {
        id: "atribucion",
        es: "De dónde vino el cliente", en: "Where the client came from",
        blocks: [
          { k:"p",
            es:"Cada archivo lleva registrada la atribución del cliente. Hay dos grupos.",
            en:"Every file records the client's attribution. There are two groups." },
          { k:"kv",
            rows:[
              [{es:"Self-Generated",en:"Self-Generated"},{es:"Tu esfera, tu marketing, tu relación · split completo",en:"Your sphere, your marketing, your relationship · full split"}],
              [{es:"Referral Partner",en:"Referral Partner"},{es:"Un socio referidor tuyo · split completo",en:"A referral partner of yours · full split"}],
              [{es:"In-House Lead",en:"In-House Lead"},{es:"La sucursal te lo asignó · "+pts+" puntos menos",en:"The branch assigned it to you · "+pts+" points less"}],
              [{es:"Smart Bee Client",en:"Smart Bee Client"},{es:"Cliente de la práctica de taxes · "+pts+" puntos menos",en:"Client from the tax practice · "+pts+" points less"}],
            ] },
          { k:"p",
            es:"Cuando la sucursal trae al cliente, aportó la parte más costosa de la transacción. Esos "+pts+" puntos financian la máquina que produjo ese cliente: la base de datos, las campañas, la marca.",
            en:"When the branch brings the client, it supplied the most expensive input in the transaction. Those "+pts+" points fund the engine that produced that client: the database, the campaigns, the brand." },
          { k:"note", tone:"green",
            es:"El Newbie no recibe este descuento. En etapa Newbie el flujo de leads es parte de tu desarrollo, así que cobras "+Math.round((stages.newbie?.split||.5)*100)+"% venga de donde venga.",
            en:"Newbies do not take this reduction. At Newbie stage lead flow is part of your development, so you earn "+Math.round((stages.newbie?.split||.5)*100)+"% regardless of source." },
        ],
      },

      {
        id: "cortes",
        es: "Cuándo se paga", en: "When you get paid",
        blocks: [
          { k:"p",
            es:"Barrett cierra nómina el día 1 y el día 15 de cada mes.",
            en:"Barrett closes payroll on the 1st and the 15th of each month." },
          { k:"p",
            es:"Un préstamo entra al corte según su fecha de fondeo. Lo que fondea el día 14 entra en el corte del 15; lo que fondea el 16 entra en el corte del 1 del mes siguiente.",
            en:"A loan enters a cut based on its funding date. What funds on the 14th goes in the 15th's cut; what funds on the 16th goes in the following month's 1st cut." },
          { k:"p",
            es:"Un archivo que no entró en un corte no se pierde: queda en la lista del siguiente.",
            en:"A file that missed a cut is not lost: it stays on the list for the next one." },
        ],
      },

      {
        id: "donde-ver",
        es: "Dónde ver tu número", en: "Where to see your number",
        blocks: [
          { k:"p",
            es:"Abre cualquier archivo tuyo y baja hasta el bloque verde, TU COMPENSACIÓN EN ESTE ARCHIVO. Ahí está la cadena completa.",
            en:"Open any of your files and scroll to the green block, TU COMPENSACIÓN EN ESTE ARCHIVO. The full chain is there." },
          { k:"list",
            es:["La comisión bruta en dólares","Cada ajuste con su nombre y monto","El NET","Tu porcentaje y tu monto"],
            en:["Gross commission in dollars","Each adjustment with its name and amount","The NET","Your percentage and your amount"] },
          { k:"p",
            es:"Si algo no te cuadra, ese bloque es la fuente. Pregunta con el archivo abierto.",
            en:"If something does not add up, that block is the source. Ask with the file open." },
        ],
      },

      {
        id: "faq-comp",
        es: "Preguntas frecuentes", en: "Common questions",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"¿Por qué mi monto no es mi porcentaje del bruto?",en:"Why isn't my amount my percentage of the gross?"},
               {es:"Porque el split va sobre el NET. Si no hubo ajustes, el NET es igual al bruto y las dos cuentas dan lo mismo.",en:"Because the split is on NET. If there were no adjustments, NET equals gross and both calculations match."}],
              [{es:"¿Puedo cambiar mi porcentaje o los ajustes?",en:"Can I change my percentage or the adjustments?"},
               {es:"No. El lender, la tasa y el lock los manejas tú. La compensación y los ajustes los fija el Branch Manager.",en:"No. Lender, rate and lock are yours to manage. Compensation and adjustments are set by the Branch Manager."}],
              [{es:"¿Cómo sé cuánto volumen llevo para avanzar?",en:"How do I know how much volume I have toward advancing?"},
               {es:"El sistema lo cuenta desde tus archivos fondeados. Pregúntale al Branch Manager en cualquier momento.",en:"The system counts it from your funded files. Ask the Branch Manager at any time."}],
              [{es:"¿Los discount points que paga el cliente salen de mi comisión?",en:"Do discount points paid by the borrower come out of my commission?"},
               {es:"No. Los paga el cliente para comprar tasa. No tocan tu compensación.",en:"No. The borrower pays them to buy the rate. They do not touch your compensation."}],
              [{es:"¿Y si el archivo se refiere a otro banco?",en:"What if the file is referred to another bank?"},
               {es:"El fee de referido es tuyo. La sucursal solo participa si se negoció una parte, y eso queda escrito en el archivo.",en:"The referral fee is yours. The branch participates only if a share was negotiated, and that is recorded on the file."}],
            ] },
        ],
      },
    ],
  },


  // ─────────────────────────────────────────────────────────────────
  {
    id: "board", icon: "▦", color: "#4A90D9",
    es: "El tablero", en: "The board",
    articles: [
      {
        id: "fases",
        es: "Las seis fases", en: "The six phases",
        blocks: [
          { k:"p",
            es:"El tablero se lee de izquierda a derecha. Cada fase agrupa las etapas que pertenecen al mismo momento del préstamo, y cada una tiene su color.",
            en:"The board reads left to right. Each phase groups the stages belonging to the same moment of the loan, and each has its own color." },
          { k:"table",
            head:{ es:["Fase","Qué pasa ahí"], en:["Phase","What happens there"] },
            rows:[
              ["Pre-Qual", {es:"Del primer contacto a la precalificación",en:"From first contact to pre-qualification"}],
              ["House Hunt",{es:"Buscando casa, hasta que hay contrato aceptado",en:"House hunting, until a contract is accepted"}],
              ["Processing",{es:"Aplicación, documentos, título, tasación, seguro",en:"Application, documents, title, appraisal, insurance"}],
              ["Underwriting",{es:"De la sumisión al Clear to Close",en:"From submission to Clear to Close"}],
              ["Closing", {es:"CD, firma y fondeo",en:"CD, signing and funding"}],
              ["Post-Close",{es:"Grabación y entrega de llaves",en:"Recording and key delivery"}],
            ] },
          { k:"note", tone:"blue",
            es:"Los nombres de etapa se quedan en inglés a propósito. Son los mismos que usa Arive y los mismos que usan los lenders; traducirlos rompería la correspondencia con el resto de tu día.",
            en:"Stage names stay in English on purpose. They are the ones Arive uses and the ones lenders use; translating them would break the match with the rest of your day." },
        ],
      },
      {
        id: "colores",
        es: "Qué significan los colores", en: "What the colors mean",
        blocks: [
          { k:"list",
            es:["Rojo · CRITICAL — la etapa lleva más días de su techo, o hay una fecha vencida",
                "Ámbar · WARNING — se acerca al techo, todavía hay margen",
                "Verde — dentro del objetivo",
                "Gris — sin reloj activo, como los archivos cerrados o en preparación"],
            en:["Red · CRITICAL — the stage is past its ceiling, or a date has passed",
                "Amber · WARNING — approaching the ceiling, still room",
                "Green — within target",
                "Gray — no active clock, like closed or preparation files"] },
          { k:"p",
            es:"El techo de cada etapa no es un número inventado: sale del objetivo del producto repartido entre las etapas que faltan. Un FHA con DPA tiene techos distintos a un Conventional.",
            en:"Each stage's ceiling is not an invented number: it comes from the product's target spread across the remaining stages. An FHA with DPA has different ceilings than a Conventional." },
        ],
      },
      {
        id: "vistas",
        es: "Las vistas de arriba", en: "The views up top",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"Pipeline activo",en:"Active pipeline"},{es:"Todo lo que está vivo y en movimiento",en:"Everything alive and moving"}],
              [{es:"Archivos cerrados",en:"Closed files"},{es:"Lo fondeado. Se puede reabrir si hizo falta",en:"What funded. Can be reopened if needed"}],
              [{es:"Referidos afuera",en:"Referred out"},{es:"Lo que no se pudo cerrar aquí y se mandó a otro banco",en:"What could not close here and went to another bank"}],
              [{es:"Referidos recibidos",en:"Inbound"},{es:"Lo que llegó de otro banquero",en:"What came in from another banker"}],
              [{es:"Preparación",en:"Preparation"},{es:"Clientes vivos que todavía no están listos. No cuentan en promedios",en:"Live clients not ready yet. They do not count in averages"}],
              [{es:"Archivados",en:"Archived"},{es:"Fuera de conteos y promedios, restaurables",en:"Out of counts and averages, restorable"}],
            ] },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "file", icon: "▤", color: "#F5A623",
    es: "Trabajar un archivo", en: "Working a file",
    articles: [
      {
        id: "notas",
        es: "Las notas son un registro, no un campo",
        en: "Notes are a log, not a field",
        blocks: [
          { k:"lead",
            es:"Cada actualización es una entrada nueva con su fecha y su autor. No se borra ni se edita lo anterior.",
            en:"Every update is a new entry with its date and author. Nothing before it is deleted or edited." },
          { k:"p",
            es:"Antes la nota era un bloque de texto y nadie sabía qué punta era la nueva: unos escribían arriba y otros abajo. Ahora la tarjeta muestra siempre la última porque tiene la hora.",
            en:"Notes used to be one block of text and nobody knew which end was new: some wrote at the top, others at the bottom. Now the card always shows the latest because it is timestamped." },
          { k:"note", tone:"gold",
            es:"Escribe qué pasó, quién lo dijo y qué sigue. Tres líneas bastan. Una nota que solo dice \"pendiente\" obliga a alguien a llamarte para saber pendiente de qué.",
            en:"Write what happened, who said it and what's next. Three lines is enough. A note that only says \"pending\" forces someone to call you to find out pending on what." },
          { k:"p",
            es:"El botón de agregar guarda al instante. No espera al SAVE, porque es un evento y no un campo.",
            en:"The add button saves instantly. It does not wait for SAVE, because it is an event and not a field." },
        ],
      },
      {
        id: "avanzar",
        es: "Avanzar, cerrar y reabrir", en: "Advance, close and reopen",
        blocks: [
          { k:"list",
            es:["ADVANCE mueve a la siguiente etapa y reinicia el reloj de esa etapa. La edad total del archivo NUNCA se reinicia.",
                "CLOSE pide la fecha real de fondeo. Esa fecha decide en qué corte de payroll entra.",
                "PREP saca el archivo de los promedios sin borrarlo, para clientes vivos que no están listos.",
                "ARCH lo saca de conteos y promedios. Se puede restaurar.",
                "REFER lo manda a otro banquero y registra el fee."],
            en:["ADVANCE moves to the next stage and resets that stage's clock. The file's total age is NEVER reset.",
                "CLOSE asks for the real funding date. That date decides which payroll cut it lands in.",
                "PREP takes the file out of averages without deleting it, for live clients who are not ready.",
                "ARCH removes it from counts and averages. Restorable.",
                "REFER sends it to another banker and records the fee."] },
        ],
      },
      {
        id: "un-save",
        es: "Un solo SAVE", en: "One single SAVE",
        blocks: [
          { k:"p",
            es:"El botón dorado de abajo guarda todo el modal a la vez: datos, lender, lock, compensación y las seis fechas de contingencia. No hay botones de guardar por bloque.",
            en:"The gold button at the bottom saves the whole modal at once: data, lender, lock, compensation and the six contingency dates. There are no per-block save buttons." },
          { k:"p",
            es:"Las únicas dos acciones con botón propio son agregar una nota y registrar el resultado de una contingencia. Las dos son eventos con fecha y autor, no campos que se editan.",
            en:"The only two actions with their own button are adding a note and recording a contingency outcome. Both are events with a date and author, not fields you edit." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "dates", icon: "⏱", color: "#E85D75",
    es: "Contingencias y fechas", en: "Contingencies and dates",
    articles: [
      {
        id: "seis-fechas",
        es: "Las seis fechas", en: "The six dates",
        blocks: [
          { k:"p",
            es:"Se capturan en Full Application y todas cuelgan de una sola: la fecha de aceptación del contrato.",
            en:"They are captured at Full Application and all hang from one: the contract acceptance date." },
          { k:"table",
            head:{ es:["Fecha","Qué arriesga"], en:["Date","What it risks"] },
            rows:[
              [{es:"Tasación",en:"Appraisal"},{es:"Del contrato · el depósito del cliente",en:"From the contract · the client's deposit"}],
              [{es:"Préstamo",en:"Loan"},{es:"Del contrato · el depósito del cliente",en:"From the contract · the client's deposit"}],
              ["CTC",{es:"Cadena de entrega · credibilidad",en:"Delivery chain · credibility"}],
              ["COE",{es:"Cadena de entrega · credibilidad y per diem",en:"Delivery chain · credibility and per diem"}],
              [{es:"Fondeo",en:"Funding"},{es:"Cadena de entrega",en:"Delivery chain"}],
            ] },
          { k:"note", tone:"red",
            es:"Las dos primeras son del contrato. Si se pasan sin resolver, el depósito del cliente queda expuesto. No es lo mismo que llegar tarde a un CTC.",
            en:"The first two come from the contract. If they pass unresolved, the client's deposit is exposed. That is not the same as being late to a CTC." },
        ],
      },
      {
        id: "hacia-atras",
        es: "Por qué el sistema calcula hacia atrás",
        en: "Why the system works backward",
        blocks: [
          { k:"p",
            es:"Una fecha de contingencia sola no te dice qué hacer hoy. \"Pide la tasación antes del miércoles\" sí.",
            en:"A contingency date alone does not tell you what to do today. \"Order the appraisal by Wednesday\" does." },
          { k:"p",
            es:"El motor toma cada contingencia, resta el tiempo que necesita cada etapa previa —usando el techo, no el promedio— y te da la fecha tope para empezar cada una. Esa es la lista que aparece en la tarjeta.",
            en:"The engine takes each contingency, subtracts the time each prior stage needs — using the ceiling, not the average — and gives you the deadline to start each one. That is the list on the card." },
        ],
      },
      {
        id: "dias-habiles",
        es: "Dos definiciones de día hábil", en: "Two definitions of business day",
        blocks: [
          { k:"note", tone:"gold",
            es:"Para el CD, la Regulación Z excluye domingos y feriados federales. EL SÁBADO CUENTA. Contar lunes a viernes le regala al cliente un día que no existe y el CD sale tarde.",
            en:"For the CD, Regulation Z excludes Sundays and federal holidays. SATURDAY COUNTS. Counting Monday to Friday gives the borrower a day that does not exist and the CD goes out late." },
          { k:"p",
            es:"Para el contrato es distinto: Florida cuenta días hábiles de lunes a viernes. Nevada y Texas cuentan calendario. La misma contingencia de 21 días vence el 18 de agosto en Nevada y el 26 en Florida.",
            en:"For the contract it is different: Florida counts business days Monday to Friday. Nevada and Texas count calendar days. The same 21-day contingency expires August 18 in Nevada and August 26 in Florida." },
          { k:"p",
            es:"El sistema conoce los feriados federales por regla, no por lista. Incluye el corrimiento: feriado en sábado se observa el viernes, en domingo el lunes.",
            en:"The system knows federal holidays by rule, not by list. That includes the shift: a holiday on Saturday is observed Friday, on Sunday the following Monday." },
        ],
      },
      {
        id: "resultados",
        es: "Cerrar una contingencia", en: "Closing out a contingency",
        blocks: [
          { k:"p",
            es:"Cada contingencia se cierra con un resultado: cumplida, renunciada, extendida, incumplida o no aplica. Extendida mueve la fecha y guarda la anterior.",
            en:"Each contingency closes with an outcome: met, waived, extended, missed or not applicable. Extended moves the date and keeps the previous one." },
          { k:"note", tone:"red",
            es:"Una contingencia del contrato que venció sin resultado registrado es la alerta más fuerte del sistema. Dice, en texto, que el depósito está expuesto.",
            en:"A contract contingency that passed with no outcome recorded is the loudest alert in the system. It says, in plain text, that the deposit is exposed." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "lender", icon: "◆", color: "#4A90D9",
    es: "Lender y lock", en: "Lender and lock",
    articles: [
      {
        id: "canal",
        es: "El canal va primero", en: "The channel comes first",
        blocks: [
          { k:"p",
            es:"El canal decide qué lenders puedes ver. En broker hay unos 180; en correspondent solo 11. Si escoges correspondent y tu lender no opera ahí, desaparece de la lista — y el sistema te dice cuáles quedaron fuera.",
            en:"The channel decides which lenders you can see. Broker has about 180; correspondent only 11. If you pick correspondent and your lender does not operate there, it disappears from the list — and the system tells you which ones were left out." },
          { k:"p",
            es:"Si el lender no está en el catálogo, la última opción del menú te deja escribirlo a mano.",
            en:"If the lender is not in the catalog, the last option in the menu lets you type it in." },
        ],
      },
      {
        id: "float",
        es: "Flotar tiene fecha límite", en: "Floating has a deadline",
        blocks: [
          { k:"lead",
            es:"El CD lleva la tasa final. No se puede flotar más allá del día en que el CD tiene que salir.",
            en:"The CD carries the final rate. You cannot float past the day the CD has to go out." },
          { k:"p",
            es:"El sistema calcula ese día desde la fecha de cierre y te lo muestra con los días que faltan. No es una regla de la sucursal: es la consecuencia del plazo legal del CD.",
            en:"The system derives that day from the closing date and shows it with the days remaining. It is not a branch rule: it is the consequence of the CD's legal waiting period." },
          { k:"note", tone:"gold",
            es:"Y cuando lockeas, el término lo decide el precio — pero un lock que vence antes del cierre devuelve lo ganado en la extensión. El sistema te dice cuáles de los términos llegan al cierre y cuáles no.",
            en:"And when you lock, price decides the term — but a lock that expires before closing gives the savings back in the extension. The system tells you which terms reach closing and which do not." },
        ],
      },
      {
        id: "respaldo",
        es: "El lender de respaldo", en: "The backup lender",
        blocks: [
          { k:"p",
            es:"Un respaldo no sirve para siempre. Mover un archivo a otro lender significa divulgaciones nuevas y suscripción desde cero, y eso toma tiempo que hay que restar del cierre.",
            en:"A backup does not last forever. Moving a file to another lender means new disclosures and underwriting from scratch, and that takes time you have to subtract from the closing." },
          { k:"p",
            es:"Por eso el sistema muestra tres ventanas: hasta cuándo llega aunque todo se atrase, hasta cuándo llega solo si nada falla, y a partir de cuándo ya no llega.",
            en:"That is why the system shows three windows: until when it makes it even if everything drags, until when it makes it only if nothing fails, and from when it no longer makes it." },
          { k:"note", tone:"red",
            es:"El colchón suele vencer ANTES que la contingencia de préstamo. Dentro de la contingencia va a parecer que hay tiempo, y no lo habrá.",
            en:"The cushion usually expires BEFORE the loan contingency. Inside the contingency it will look like there is time, and there will not be." },
          { k:"p",
            es:"Y el lock no se transfiere: sueltas la tasa y vuelves a lockear al mercado del día. Si subió, la paga el cliente.",
            en:"And the lock does not transfer: you release the rate and re-lock at that day's market. If it rose, the borrower pays." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "referrals", icon: "⇄", color: "#A78BFA",
    es: "Referidos", en: "Referrals",
    articles: [
      {
        id: "salientes",
        es: "Referidos que salen", en: "Referrals that go out",
        blocks: [
          { k:"p",
            es:"Cuando un archivo no se puede cerrar aquí, se manda a otro banco y genera un fee de referido. El fee es del originador; la sucursal solo participa si se negoció una parte, y eso queda escrito en el archivo.",
            en:"When a file cannot close here, it goes to another bank and generates a referral fee. The fee belongs to the originator; the branch participates only if a share was negotiated, and that is recorded on the file." },
          { k:"p",
            es:"Un referido que cerró entra a la lista de payroll como cualquier otra partida. Antes se ganaba y no se reclamaba, porque su fecha vive en otro campo.",
            en:"A referral that closed enters the payroll list like any other item. It used to be earned and never claimed, because its date lives in a different field." },
        ],
      },
      {
        id: "entrantes",
        es: "Referidos que entran", en: "Referrals that come in",
        blocks: [
          { k:"p",
            es:"Un archivo que llega de otro banquero se marca como inbound y lleva registrado quién lo mandó. Se trabaja igual que cualquier otro.",
            en:"A file arriving from another banker is marked inbound and records who sent it. It is worked like any other." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "roles", icon: "◐", color: "#BD65E8",
    es: "Roles y acceso", en: "Roles and access",
    articles: [
      {
        id: "quien-puede",
        es: "Qué puede hacer cada rol", en: "What each role can do",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"Originador",en:"Loan Officer"},
               {es:"Ve todo el pipeline del equipo. Edita sus archivos: lender, tasa, lock, notas, etapas y contingencias. Ve su propia compensación por archivo.",
                en:"Sees the whole team pipeline. Edits their files: lender, rate, lock, notes, stages and contingencies. Sees their own compensation per file."}],
              [{es:"Asistente",en:"Assistant"},
               {es:"Ve y edita archivos para apoyar la operación. No ve compensación.",
                en:"Views and edits files to support operations. Does not see compensation."}],
              [{es:"Branch Manager",en:"Branch Manager"},
               {es:"Todo lo anterior, más el reparto completo, los ajustes al NET, la atribución del cliente, el payroll y los tableros de producción.",
                en:"All of the above, plus the full split, NET adjustments, client attribution, payroll and the production dashboards."}],
            ] },
          { k:"note", tone:"blue",
            es:"El pipeline es visible para todos a propósito: un archivo atorado lo puede detectar cualquiera. La compensación no, porque cada quien solo necesita su propio número.",
            en:"The pipeline is visible to everyone on purpose: anyone can spot a stuck file. Compensation is not, because each person only needs their own number." },
        ],
      },
      {
        id: "historial",
        es: "Todo queda registrado", en: "Everything is logged",
        blocks: [
          { k:"p",
            es:"Cada edición guarda quién la hizo y cuándo. Las notas, los cambios de lender, los resultados de contingencia y los cortes de payroll tienen historial propio.",
            en:"Every edit records who made it and when. Notes, lender changes, contingency outcomes and payroll cuts each keep their own history." },
          { k:"p",
            es:"Eso no es vigilancia: es lo que permite reconstruir qué pasó cuando un archivo se cae o cuando un número no cuadra.",
            en:"That is not surveillance: it is what lets you reconstruct what happened when a file falls apart or a number does not add up." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "glossary", icon: "≡", color: "#8B949E",
    es: "Glosario", en: "Glossary",
    articles: [
      {
        id: "terminos",
        es: "Términos que verás a diario", en: "Terms you will see daily",
        blocks: [
          { k:"kv",
            rows:[
              ["CTC",{es:"Clear to Close. El lender aprobó todo y autoriza cerrar.",en:"Clear to Close. The lender approved everything and authorizes closing."}],
              ["COE",{es:"Close of Escrow. El día del cierre.",en:"Close of Escrow. Closing day."}],
              ["CD",{es:"Closing Disclosure. Lleva la tasa y los costos finales. Por ley el cliente debe recibirla 3 días hábiles antes de firmar.",en:"Closing Disclosure. Carries the final rate and costs. By law the borrower must receive it 3 business days before signing."}],
              ["LE",{es:"Loan Estimate. La estimación inicial de tasa y costos.",en:"Loan Estimate. The initial estimate of rate and costs."}],
              ["TRID",{es:"La regla que fija los plazos del LE y el CD.",en:"The rule that sets the LE and CD timelines."}],
              ["DPA",{es:"Down Payment Assistance. Ayuda para el enganche.",en:"Down Payment Assistance."}],
              ["DTI",{es:"Debt-to-Income. Deuda mensual contra ingreso mensual.",en:"Debt-to-Income. Monthly debt against monthly income."}],
              ["LTV",{es:"Loan-to-Value. Préstamo contra valor de la propiedad.",en:"Loan-to-Value. Loan against property value."}],
              ["bps",{es:"Puntos básicos. 100 bps = 1%. Sobre $400,000, 100 bps son $4,000.",en:"Basis points. 100 bps = 1%. On $400,000, 100 bps is $4,000."}],
              [{es:"Float",en:"Float"},{es:"La tasa no está fija todavía. Se mueve con el mercado.",en:"The rate is not fixed yet. It moves with the market."}],
              [{es:"Lock",en:"Lock"},{es:"La tasa queda fija por un plazo. Si vence antes del cierre, hay que extender y cuesta.",en:"The rate is fixed for a term. If it expires before closing, you extend and it costs."}],
              [{es:"Broker",en:"Broker"},{es:"El préstamo se coloca con un lender externo que lo cierra en su nombre.",en:"The loan is placed with an outside lender who closes it in their name."}],
              [{es:"Correspondent",en:"Correspondent"},{es:"Se cierra en nombre de Barrett y se vende después. Menos lenders, más margen.",en:"Closed in Barrett's name and sold afterward. Fewer lenders, more margin."}],
              [{es:"Bruto y NET",en:"Gross and NET"},{es:"Bruto es lo que paga el lender. NET es el bruto menos los ajustes que absorbe la sucursal. Los splits van sobre el NET.",en:"Gross is what the lender pays. NET is gross minus adjustments the branch absorbs. Splits apply to NET."}],
            ] },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "faq", icon: "?", color: "#E85D75",
    es: "Preguntas frecuentes", en: "Common questions",
    articles: [
      {
        id: "faq-general",
        es: "Lo que más se pregunta", en: "Most asked",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"¿Por qué mi archivo dice CRITICAL si va bien?",en:"Why does my file say CRITICAL if it's going fine?"},
               {es:"Porque lleva más días en esa etapa que su techo, o porque una fecha derivada ya pasó. Abre el archivo: la tarjeta dice cuál.",en:"Because it has more days in that stage than its ceiling, or because a derived date has passed. Open the file: the card says which."}],
              [{es:"Cambié de etapa y la edad del archivo no se reinició.",en:"I changed stage and the file age did not reset."},
               {es:"Correcto. El reloj de etapa se reinicia; la edad total no. Ese es el número que le citas al agente cuando pregunta cuánto lleva el préstamo.",en:"Correct. The stage clock resets; total age does not. That is the number you quote the agent when they ask how long the loan has been working."}],
              [{es:"¿Puedo borrar una nota que escribí mal?",en:"Can I delete a note I wrote badly?"},
               {es:"No. Escribe una entrada nueva corrigiéndola. El historial completo es lo que da valor al registro.",en:"No. Write a new entry correcting it. The complete history is what gives the log its value."}],
              [{es:"Puse una fecha y la pantalla se quedó pensando.",en:"I entered a date and the screen froze."},
               {es:"Mientras escribes el año el campo se pone ámbar y dice que está esperando. Termina de escribir los cuatro dígitos.",en:"While you type the year the field turns amber and says it is waiting. Finish typing all four digits."}],
              [{es:"¿Qué hago si el lender no aparece en la lista?",en:"What if the lender is not in the list?"},
               {es:"Revisa el canal primero: correspondent esconde la mayoría. Si aun así no está, usa la última opción del menú para escribirlo a mano.",en:"Check the channel first: correspondent hides most of them. If it is still missing, use the last menu option to type it in."}],
              [{es:"¿A quién le pregunto si un número no cuadra?",en:"Who do I ask if a number does not add up?"},
               {es:"Al Branch Manager, con el archivo abierto. Todos los cálculos muestran de dónde salen.",en:"The Branch Manager, with the file open. Every calculation shows where it comes from."}],
            ] },
        ],
      },
    ],
  },

  ];
}

// Búsqueda plana sobre todo el contenido, en los dos idiomas.
export function searchHelp(sections, query, lang = "es") {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return null;
  const flat = s => Array.isArray(s) ? s.join(" ") : (typeof s === "object" && s ? (s[lang] || s.es || s.en || "") : String(s ?? ""));
  const out = [];
  for (const sec of sections) {
    for (const a of sec.articles) {
      const hay = [a[lang] || a.es, ...(a.blocks || []).flatMap(b => [
        flat(b[lang] ?? b.es), flat(b.en),
        ...(b.rows || []).flat().map(flat),
        ...((b.head && (b.head[lang] || b.head.es)) || []),
      ])].join(" ").toLowerCase();
      if (hay.includes(q)) out.push({ section: sec, article: a });
    }
  }
  return out;
}
