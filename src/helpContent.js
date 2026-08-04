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
