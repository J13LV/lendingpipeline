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
//
//  Lo que NO viene por parámetro hay que revisarlo contra el motor. Esta
//  pasada corrigió cuatro desfases ya abiertos: las fases son SIETE y
//  decía seis (faltaba Close Prep), las señales son SEIS y decía cuatro
//  (faltaban azul y morado), las contingencias son CINCO y el título
//  decía seis, y no existía el rol Processor. Comparados contra PHASES,
//  SIGNALS, CONTINGENCIES y TEAM.
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
          { k:"note", tone:"green",
            es:"¿Prefieres practicar antes de tocar un archivo real? El botón ENTRENAMIENTO, arriba junto a NEW FILE, te lleva por la captura paso a paso con un archivo de práctica que nunca toca producción.",
            en:"Would you rather practice before touching a real file? The TRAINING button, up top next to NEW FILE, walks you through capture step by step with a practice file that never touches production." },
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
        id: "relleno",
        es: "El relleno · por qué te sale un número",
        en: "Backfill · why you get a number",
        blocks: [
          { k:"lead",
            es:"El botón RELLENAR de arriba muestra lo que quedó en blanco en archivos que ya pasaron por el punto donde ese dato debía capturarse. El número que ves es el tuyo, no el de todos.",
            en:"The BACKFILL button up top shows what was left blank on files that already passed the point where that data had to be captured. The number you see is yours, not everyone's." },
          { k:"p",
            es:"No dice «todavía no lo has hecho». Dice «pasaste por ahí y quedó vacío». Por eso la lista es corta y toda verdadera: un archivo recién abierto no aparece.",
            en:"It does not say \"you have not done it yet\". It says \"you went past it and it is blank\". That is why the list is short and all of it true: a file just opened does not appear." },
          { k:"p",
            es:"Cada hueco lleva dueño con nombre, no con rol. El de la tasación es de quien procesa ESE archivo; el del 1003 es del Loan Officer de ESE archivo.",
            en:"Each gap carries an owner by name, not by role. The appraisal one belongs to whoever processes THAT file; the 1003 one to THAT file's Loan Officer." },
          { k:"table",
            head:{ es:["Pestaña","Qué contiene"], en:["Tab","What it holds"] },
            rows:[
              [{es:"PENDIENTES",en:"PENDING"},
               {es:"Desde el 13 de julio, el corte con Barrett. Esto sí se te quedó, y este es el número que va a la reunión.",
                en:"Since July 13, the Barrett cutover. This one really was missed, and this is the number that goes to the meeting."}],
              [{es:"ANTES DEL 13 JUL",en:"BEFORE JUL 13"},
               {es:"Lo de antes. El sistema nunca lo pidió, así que no es de nadie. Sin contador y sin reclamo.",
                en:"Everything before. The system never asked for it, so it is nobody's fault. No counter, no claim."}],
            ] },
          { k:"p",
            es:"Hay dos formas de cerrar un hueco. Los que son una fecha se escriben ahí mismo. Los que no —el 1003, el lender, el socio referidor— traen un botón que abre el archivo en la solapa donde viven.",
            en:"There are two ways to close a gap. The ones that are a date get typed right there. The ones that are not — the 1003, the lender, the referral partner — come with a button that opens the file on the tab where they live." },
          { k:"note", tone:"red",
            es:"Deja en blanco lo que no sepas. Una fecha inventada es peor que una celda vacía: la celda vacía se ve y se puede arreglar; la fecha inventada se ve correcta para siempre.",
            en:"Leave blank what you do not know. An invented date is worse than an empty cell: the empty cell is visible and can be fixed; the invented date looks correct forever." },
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
          { k:"p",
            es:"Qué pestañas te tocan a ti está en Roles y acceso.",
            en:"Which tabs you get is in Roles and access." },
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
          { k:"lead",
            es:"Barrett paga con un periodo de atraso. Lo que fondeas hoy no se deposita en el próximo corte, sino en el siguiente.",
            en:"Barrett pays one period behind. What you fund today does not deposit on the next cut, but on the one after." },
          { k:"table",
            head:{ es:["Fondeas entre","Se deposita"], en:["You fund between","Deposits on"] },
            rows:[
              [{es:"1 y 15 de agosto",en:"August 1–15"},{es:"1 de septiembre",en:"September 1"}],
              [{es:"16 y 31 de agosto",en:"August 16–31"},{es:"15 de septiembre",en:"September 15"}],
            ] },
          { k:"note", tone:"gold",
            es:"Un préstamo que fondea el 5 de agosto cobra el 1 de septiembre: casi un mes después. Cuenta con eso al planificar, y al explicárselo a alguien que entra nuevo.",
            en:"A loan funding August 5 pays September 1: nearly a month later. Plan around that, and explain it to anyone joining." },
          { k:"p",
            es:"Cada archivo muestra su fecha de depósito en la lista de payroll. No hay que calcularla.",
            en:"Every file shows its deposit date on the payroll list. There is nothing to calculate." },
          { k:"p",
            es:"Un archivo que no entró en un corte no se pierde: queda en la lista del siguiente.",
            en:"A file that missed a cut is not lost: it stays on the list for the next one." },
        ],
      },

      {
        id: "requisitos",
        es: "Fondear no es cobrar", en: "Funding is not getting paid",
        blocks: [
          { k:"lead",
            es:"Barrett paga cuando se cumplen tres cosas: el préstamo fondeó, llegó el cheque, y los documentos están en Arive. Faltando una, el archivo no entra al corte.",
            en:"Barrett pays when three things are true: the loan funded, the check arrived, and the documents are in Arive. Missing one, the file does not enter the cut." },
          { k:"p",
            es:"Los cinco documentos son los mismos para casi todos los productos:",
            en:"The five documents are the same for almost every product:" },
          { k:"list",
            es:["Commission Worksheet","Initial Disclosures firmadas","Closing Package firmado",
                "Barrett Disclosures firmadas","Los documentos que pida el lender"],
            en:["Commission Worksheet","Signed Initial Disclosures","Signed Closing Package",
                "Signed Barrett Disclosures","Whatever documents the lender requires"] },
          { k:"note", tone:"red",
            es:"Deben estar cargados en Arive PARA CUANDO EL PRÉSTAMO FONDEA, no después. Subirlos tarde mueve el pago al corte siguiente — otras dos semanas.",
            en:"They must be uploaded in Arive BY THE TIME THE LOAN FUNDS, not after. Uploading late pushes the payment to the next cut — another two weeks." },
          { k:"p",
            es:"En el pipeline, cada archivo tiene el bloque azul REQUISITOS PARA COBRAR con las cinco casillas y la del cheque. Lo que no está completo sale en rojo en la lista de payroll y no se puede meter en el request.",
            en:"In the pipeline, each file has the blue PAYROLL REQUIREMENTS block with the five boxes and the check box. Anything incomplete shows red on the payroll list and cannot go into the request." },
        ],
      },

      {
        id: "donde-buscar",
        es: "Dónde encontrar cada cosa en Arive",
        en: "Where to find each thing in Arive",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"¿Llegó el cheque?",en:"Did the check arrive?"},
               {es:"Arive → Audits & Dates. Aparece como Broker Check Received. Si no se ve, escríbele a Payroll.",
                en:"Arive → Audits & Dates. It shows as Broker Check Received. If it is not there, message Payroll."}],
              [{es:"Commission Worksheet",en:"Commission Worksheet"},
               {es:"Arive → menú izquierdo → Disclosure Forms → ARIVE Forms → Other Forms → BFG – Commission Worksheet.",
                en:"Arive → left menu → Disclosure Forms → ARIVE Forms → Other Forms → BFG – Commission Worksheet."}],
              [{es:"Preguntas de payroll",en:"Payroll questions"},
               {es:"El Employee Portal tiene un FAQ de payroll con las dudas más comunes.",
                en:"The Employee Portal has a payroll FAQ with the most common questions."}],
            ] },
        ],
      },

      {
        id: "extra-payroll",
        es: "Extra Payroll · cobrar fuera de ciclo",
        en: "Extra Payroll · getting paid off-cycle",
        blocks: [
          { k:"p",
            es:"Barrett procesa pagos fuera del ciclo normal. Sirve cuando un archivo fondeó justo después de un corte y esperar el siguiente sale caro.",
            en:"Barrett processes payments outside the normal cycle. It helps when a file funded right after a cut and waiting for the next one is costly." },
          { k:"p",
            es:"La solicitud se manda por un formulario de Google, y las fechas mandan: si entra después de la 1PM del jueves señalado, pasa al ciclo siguiente.",
            en:"The request goes through a Google form, and the dates rule: if it comes in after 1PM on the stated Thursday, it moves to the following cycle." },
          { k:"note", tone:"gold",
            es:"Las mismas dos condiciones aplican: Barrett debe tener el cheque y el archivo debe estar completo. El Extra Payroll adelanta la fecha, no salta los requisitos.",
            en:"The same two conditions apply: Barrett must have the check and the file must be complete. Extra Payroll moves the date up, it does not skip the requirements." },
          { k:"p",
            es:"Las fechas exactas cambian cada mes y vienen en el correo de payroll. Pídeselas al Branch Manager si no lo tienes.",
            en:"The exact dates change monthly and come in the payroll email. Ask the Branch Manager if you do not have it." },
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
        es: "Las siete fases", en: "The seven phases",
        blocks: [
          { k:"p",
            es:"El tablero se lee de izquierda a derecha. Cada fase agrupa las etapas que pertenecen al mismo momento del préstamo, y cada una tiene su color y su código de dos letras.",
            en:"The board reads left to right. Each phase groups the stages belonging to the same moment of the loan, and each has its own color and two-letter code." },
          { k:"table",
            head:{ es:["Fase","Qué pasa ahí"], en:["Phase","What happens there"] },
            rows:[
              ["Pre-Qual · PQ", {es:"Del primer contacto a la precalificación",en:"From first contact to pre-qualification"}],
              ["House Hunt · HH",{es:"Buscando casa, hasta que hay contrato aceptado",en:"House hunting, until a contract is accepted"}],
              ["Processing · PR",{es:"Aplicación, documentos, título, tasación, seguro",en:"Application, documents, title, appraisal, insurance"}],
              ["Underwriting · UW",{es:"De la sumisión al Clear to Close",en:"From submission to Clear to Close"}],
              ["Close Prep · CP",{es:"Del Clear to Close a la firma programada",en:"From Clear to Close to the scheduled signing"}],
              ["Closing · CL", {es:"CD, firma y fondeo",en:"CD, signing and funding"}],
              ["Post-Close · PC",{es:"Grabación y entrega de llaves",en:"Recording and key delivery"}],
            ] },
          { k:"note", tone:"blue",
            es:"Los nombres de etapa se quedan en inglés a propósito. Son los mismos que usa Arive y los mismos que usan los lenders; traducirlos rompería la correspondencia con el resto de tu día.",
            en:"Stage names stay in English on purpose. They are the ones Arive uses and the ones lenders use; translating them would break the match with the rest of your day." },
        ],
      },
      {
        id: "colores",
        es: "Las seis señales", en: "The six signals",
        blocks: [
          { k:"p",
            es:"Seis colores, un significado cada uno, iguales en toda la aplicación. El rojo es raro a propósito — por eso se cree cuando aparece.",
            en:"Six colors, one meaning each, the same everywhere in the app. Red is rare on purpose — that is what makes it believable when it shows up." },
          { k:"table",
            head:{ es:["Color","Significa","Qué te pide"], en:["Color","Means","What it asks of you"] },
            rows:[
              [{es:"Rojo",en:"Red"},{es:"Vencido o roto",en:"Overdue or broken"},
               {es:"Actúa hoy. Una fecha pasó y sigue sin hacerse.",en:"Act today. A date passed and it still is not done."}],
              [{es:"Dorado",en:"Gold"},{es:"Se avecina",en:"Coming up"},
               {es:"Dentro de siete días. Hay tiempo, pero ya es tuyo.",en:"Inside seven days. There is time, but it is on you now."}],
              [{es:"Verde",en:"Green"},{es:"Hecho",en:"Done"},
               {es:"Cumplido, recibido, resuelto, cerrado. Nada que hacer.",en:"Met, received, cleared, closed. Nothing to do."}],
              [{es:"Azul",en:"Blue"},{es:"Dato del sistema",en:"System data"},
               {es:"Algo que el pipeline calculó o trajo. Ni bueno ni malo.",en:"Something the pipeline calculated or pulled. Neither good nor bad."}],
              [{es:"Morado",en:"Purple"},{es:"Legal",en:"Legal"},
               {es:"Solo TRID, el CD y los plazos de ley. Un solo uso, por eso siempre se reconoce.",en:"TRID, the CD and statutory waiting periods only. One use, so it is always recognizable."}],
              [{es:"Gris",en:"Gray"},{es:"Estancado",en:"Idle"},
               {es:"Nadie lo está moviendo, o el campo no aplica.",en:"Nobody is moving it, or the field does not apply."}],
            ] },
          { k:"p",
            es:"En la tarjeta verás además las palabras CRITICAL, WARN y STALE. Son la misma escala dicha con texto: CRITICAL es rojo, WARN es dorado, STALE es gris.",
            en:"On the card you will also see the words CRITICAL, WARN and STALE. They are the same scale in text: CRITICAL is red, WARN is gold, STALE is gray." },
          { k:"p",
            es:"El techo de cada etapa no es un número inventado: sale del objetivo del producto repartido entre las etapas que faltan. Un FHA con DPA tiene techos distintos a un Conventional.",
            en:"Each stage's ceiling is not an invented number: it comes from the product's target spread across the remaining stages. An FHA with DPA has different ceilings than a Conventional." },
        ],
      },
      {
        id: "relojes",
        es: "Los cuatro relojes", en: "The four clocks",
        blocks: [
          { k:"lead",
            es:"Un archivo siempre tiene exactamente un reloj corriendo. Cuál, depende de dónde está.",
            en:"A file always has exactly one clock running. Which one depends on where it is." },
          { k:"p",
            es:"Pre-Qual · tres días hábiles. Es la promesa que la sucursal le hace a un agente: un lead que entra se decide en tres días hábiles. El reloj es de la fase completa, no de cada etapa, y cuenta desde que el lead entró — pasar de Credit Pull a Income Verification no te compra tiempo. Un lead que entra el viernes vence el miércoles, así que nadie trabaja el fin de semana para sostener la promesa.",
            en:"Pre-Qual · three business days. This is the promise the branch makes to an agent: a lead that comes in gets decided in three business days. The clock is on the whole phase, not on each stage, and it counts from when the lead first arrived — moving from Credit Pull to Income Verification does not buy you time. A lead that lands Friday is due Wednesday, so nobody works the weekend to keep the promise." },
          { k:"p",
            es:"House Hunt · la ventana de 60 días de APG. Contacto cada siete días, alternando cliente y agente. Al día 30 se revisan presupuesto y expectativas. Al día 45 quedan quince y hay que llamar al agente. Al día 60 se cumplió el plazo y el agente puede perder al cliente.",
            en:"House Hunt · the 60-day APG window. Contact every seven days, alternating client and agent. At day 30 you review budget and expectations. At day 45 fifteen days remain and you call the agent. At day 60 the window is up and the agent may lose the client." },
          { k:"p",
            es:"De Under Contract en adelante · el reloj de etapa. Cada etapa lleva su meta y su techo, y la tarjeta dice a quién estás esperando: el equipo, el cliente, el vendor, o por ley. Cuando el vendor tiene cara conocida lo dice con nombre — el tasador, título, el underwriter.",
            en:"From Under Contract onward · the stage clock. Each stage carries its target and its ceiling, and the card says who you are waiting on: the team, the client, the vendor, or the law. When the vendor has a known face it says which — the appraiser, title, the underwriter." },
          { k:"note", tone:"gold",
            es:"Los mismos días en rojo significan cosas distintas según a quién esperas. Once días en Condition Clearing es un cliente que no manda documentos: hay que llamarlo a él. Cuatro días en Submitted to UW es nuestro, y esa sí es conversación interna. Lee la línea de espera antes de decidir a quién llamar.",
            en:"The same red days mean different things depending on who you are waiting on. Eleven days in Condition Clearing is a client who has not sent documents: call the client. Four days in Submitted to UW is ours, and that one is an internal conversation. Read the wait line before deciding who to chase." },
          { k:"p",
            es:"A siete días del cierre · manda el COE. Cuando la fecha de cierre está a siete días o menos, gana sobre todo otro reloj y la tarjeta muestra COE en vez de la etapa. El depósito depende de esa fecha, así que nada más puede ser el titular.",
            en:"Inside seven days of closing · the COE takes over. Once the closing date is seven days out or less, it outranks every other clock and the card shows COE instead of the stage. The deposit depends on that date, so nothing else gets to be the headline." },
        ],
      },
      {
        id: "puertas",
        es: "Las seis puertas", en: "The six gates",
        blocks: [
          { k:"lead",
            es:"Seis momentos donde el sistema no te deja salir de una etapa sin el dato que debía capturarse ahí.",
            en:"Six moments where the system will not let you leave a stage without the data that had to be captured there." },
          { k:"p",
            es:"La regla que decide si frena o solo avisa no es la importancia del dato: es si el dato SE PUEDE SABER en ese momento. Bloquear pidiendo algo que todavía no existe produce datos inventados, y eso es peor que el hueco.",
            en:"What decides whether it blocks or only warns is not how important the data is: it is whether the data CAN BE KNOWN at that moment. Blocking for something that does not exist yet produces invented data, and that is worse than the gap." },
          { k:"table",
            head:{ es:["Al salir de","Se exige","Frena"], en:["Leaving","Required","Blocks"] },
            rows:[
              ["Under Contract", {es:"El 1003 en 12 de 12",en:"The 1003 at 12 of 12"}, {es:"sí",en:"yes"}],
              ["Under Contract", {es:"Fechas de tasación y préstamo",en:"Appraisal and loan contingency dates"}, {es:"sí",en:"yes"}],
              ["Full Application", {es:"Registrado con el lender",en:"Registered with the lender"}, {es:"sí",en:"yes"}],
              ["Initial Disclosures Sent", {es:"Fecha de envío",en:"Sent date"}, {es:"sí",en:"yes"}],
              ["Initial Disclosures Sent", {es:"Firma del cliente",en:"Client signature"}, {es:"solo avisa",en:"warns only"}],
              ["Appraisal Ordered", {es:"Tasación marcada como pedida",en:"Appraisal marked as ordered"}, {es:"sí",en:"yes"}],
              ["CD Issued", {es:"Fecha de salida del CD",en:"CD sent date"}, {es:"sí",en:"yes"}],
              ["CD Issued", {es:"Fees revisados por el LO",en:"Fees reviewed by the LO"}, {es:"sí",en:"yes"}],
            ] },
          { k:"note", tone:"gold",
            es:"La firma del cliente es la única que solo avisa. La firma depende de él, no de ti, y bloquearte ahí te obligaría a inventar una fecha.",
            en:"The client's signature is the only one that merely warns. The signature depends on them, not on you, and blocking there would force you to invent a date." },
          { k:"p",
            es:"Hacia atrás no hay puertas. Mover un archivo a una etapa anterior es corregir un error, y bloquear una corrección deja el archivo mintiendo más tiempo.",
            en:"There are no gates going backward. Moving a file to an earlier stage is correcting a mistake, and blocking a correction leaves the file lying for longer." },
          { k:"note", tone:"red",
            es:"Solo el Branch Manager desbloquea, y tiene que escribir la razón. Queda en el historial del archivo con su nombre y su fecha, y se puede contar cuántas veces hizo falta.",
            en:"Only the Branch Manager can override, and must write the reason. It stays in the file's history with their name and date, and how often it was needed can be counted." },
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
          { k:"note", tone:"blue",
            es:"Preparación es la que más se malinterpreta. Un archivo ahí no está muerto ni atrasado — su reloj está detenido a propósito.",
            en:"Preparation is the one people get wrong. A file there is not dead and not late — its clock is stopped on purpose." },
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
            es:"El botón dorado de abajo guarda todo el modal a la vez: datos, lender, lock, compensación y las fechas de contingencia. No hay botones de guardar por bloque.",
            en:"The gold button at the bottom saves the whole modal at once: data, lender, lock, compensation and the contingency dates. There are no per-block save buttons." },
          { k:"p",
            es:"Las únicas dos acciones con botón propio son agregar una nota y registrar el resultado de una contingencia. Las dos son eventos con fecha y autor, no campos que se editan.",
            en:"The only two actions with their own button are adding a note and recording a contingency outcome. Both are events with a date and author, not fields you edit." },
        ],
      },
      {
        id: "entrenamiento",
        es: "El archivo de entrenamiento", en: "The training file",
        blocks: [
          { k:"lead",
            es:"El botón ENTRENAMIENTO, arriba junto a NEW FILE, te lleva por la captura de un archivo paso a paso.",
            en:"The TRAINING button, up top next to NEW FILE, walks you through capturing a file step by step." },
          { k:"p",
            es:"Se reconoce por el borde punteado dorado y la etiqueta TRAINING en la tarjeta. Es tuyo y de nadie más: no aparece en el tablero de tus compañeros.",
            en:"You recognize it by the dashed gold border and the TRAINING tag on the card. It is yours and nobody else's: it does not appear on your teammates' board." },
          { k:"note", tone:"green",
            es:"Nunca toca producción, ni el scorecard, ni la cola de nadie. Practica sin miedo — no puedes ensuciar los números del año.",
            en:"It never touches production, the scorecard, or anyone's queue. Practice freely — you cannot dirty the year's numbers." },
          { k:"p",
            es:"El archivo se queda contigo y crece: la semana que viene lo avanzas de etapa y ves los relojes correr de verdad. Si te enredas, el mismo botón lo borra y siembras otro. El recorrido recuerda en qué paso ibas, así que puedes atender una llamada y volver.",
            en:"The file stays with you and grows: next week you advance it a stage and watch the clocks run for real. If you get tangled, the same button deletes it and you start another. The walkthrough remembers which step you were on, so you can take a call and come back." },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  {
    id: "prep", icon: "⏸", color: "#7EC8A4",
    es: "Preparación y seguimiento", en: "Preparation and follow-up",
    articles: [
      {
        id: "fase1",
        es: "Fase 1 · de la llamada a la precalificación",
        en: "Phase 1 · from the call to pre-qualification",
        blocks: [
          { k:"p",
            es:"Las cinco etapas de Pre-Qual son el embudo real: Lead Inquiry, Needs Assessment, Credit Pull, Income Verification y Pre-Qualification. Aquí es donde se decide si hay préstamo o no.",
            en:"The five Pre-Qual stages are the real funnel: Lead Inquiry, Needs Assessment, Credit Pull, Income Verification and Pre-Qualification. This is where it is decided whether there is a loan at all." },
          { k:"note", tone:"gold",
            es:"Un archivo en fase 1 tiene reloj corriendo igual que uno en underwriting. Si el cliente no está listo, el reloj no lo va a poner listo — solo va a pintar el tablero de rojo y a ensuciar tus promedios.",
            en:"A phase 1 file has a clock running just like one in underwriting. If the client is not ready, the clock will not make them ready — it will only turn the board red and dirty your averages." },
          { k:"p",
            es:"Para eso está Preparación.",
            en:"That is what Preparation is for." },
        ],
      },
      {
        id: "cuando-prep",
        es: "Cuándo mandar a Preparación", en: "When to send to Preparation",
        blocks: [
          { k:"lead",
            es:"Cuando el cliente está vivo pero le falta algo que toma tiempo, y ese tiempo no depende de ti.",
            en:"When the client is alive but needs something that takes time, and that time does not depend on you." },
          { k:"p",
            es:"No es archivar ni descartar. Es sacarlo del tablero activo hasta la fecha en que de verdad se puede retomar. En Preparación el archivo no cuenta en los promedios ni en los conteos de urgencia — porque medir a alguien que espera un ciclo de crédito no dice nada de tu operación.",
            en:"It is not archiving or discarding. It is taking it off the active board until the date it can genuinely be picked up again. In Preparation the file does not count toward averages or urgency counts — because measuring someone waiting on a credit cycle says nothing about your operation." },
          { k:"note", tone:"red",
            es:"Lo que NO se manda a Preparación: un archivo que solo está lento. Si depende de ti o de un tercero al que puedes empujar, sigue activo. Preparación no es un lugar para esconder trabajo atrasado.",
            en:"What does NOT go to Preparation: a file that is merely slow. If it depends on you or on a third party you can push, it stays active. Preparation is not a place to hide backlog." },
        ],
      },
      {
        id: "razones-prep",
        es: "Las siete razones y por qué cada plazo",
        en: "The seven reasons and why each interval",
        blocks: [
          { k:"p",
            es:"Al mandar a Preparación se escoge una razón, y cada una trae su propia fecha de revisión. Los plazos no son redondos por casualidad.",
            en:"When sending to Preparation you pick a reason, and each carries its own review date. The intervals are not round by accident." },
          { k:"table",
            head:{ es:["Razón","Revisión","Por qué"], en:["Reason","Review","Why"] },
            rows:[
              [{es:"Reparación de crédito",en:"Credit repair"},{es:"30 días",en:"30 days"},
               {es:"El crédito se reporta en ciclo mensual. Antes desperdicias el pull, después desperdicias el mes.",
                en:"Credit reports on a monthly cycle. Earlier wastes the pull, later wastes the month."}],
              [{es:"Ahorro / reservas",en:"Saving / reserves"},{es:"90 días",en:"90 days"},
               {es:"Llamar cada 30 días a alguien que está ahorrando solo produce \"todavía no\" y desgasta la relación.",
                en:"Calling a saver every 30 days only produces \"not yet\" and wears out the relationship."}],
              [{es:"Taxes por presentar",en:"Taxes to be filed"},{es:"fecha real",en:"real date"},
               {es:"Hay una fecha de presentación en el calendario. Úsala, no adivines 30/60/90.",
                en:"There is a real filing date on the calendar. Use it — don't guess at 30/60/90."}],
              [{es:"Trabajo o ingreso nuevo",en:"New job / income"},{es:"fecha real",en:"real date"},
               {es:"Primer día de trabajo más 30 días de talones. Es una fecha calculada, no una estimación.",
                en:"First day of work plus 30 days of pay stubs. A calculated date, not an estimate."}],
              [{es:"Faltan documentos",en:"Missing documents"},{es:"30 días",en:"30 days"},"—"],
              [{es:"Compra la próxima temporada",en:"Buying next season"},{es:"fecha real",en:"real date"},
               {es:"El mes que el cliente te dijo, no el que te conviene.",en:"The month the client actually told you, not the one that suits you."}],
              [{es:"Otro",en:"Other"},{es:"30 días",en:"30 days"},"—"],
            ] },
          { k:"note", tone:"green",
            es:"La diferencia entre 30 y 90 días no es administrativa: es la diferencia entre una llamada que aporta y una llamada que molesta. Un cliente al que llamas cuatro veces para oír lo mismo deja de contestar.",
            en:"The difference between 30 and 90 days is not administrative: it is the difference between a call that helps and a call that annoys. A client you call four times to hear the same thing stops answering." },
        ],
      },
      {
        id: "due-review",
        es: "El contador DUE REVIEW", en: "The DUE REVIEW counter",
        blocks: [
          { k:"lead",
            es:"Es el número que te dice a quién le toca llamada hoy.",
            en:"It is the number that tells you who is due for a call today." },
          { k:"p",
            es:"Cuando un archivo en Preparación llega a su fecha de revisión, entra a DUE REVIEW y el contador se pone rojo. Está siempre visible arriba, incluso si nunca abres esa vista — a propósito.",
            en:"When a Preparation file reaches its review date, it enters DUE REVIEW and the counter turns red. It is always visible up top, even if you never open that view — on purpose." },
          { k:"p",
            es:"Un cliente en Preparación sin fecha de revisión no está esperando: está perdido. Ese contador existe para que no puedas olvidarte de alguien que sí quería comprar.",
            en:"A client in Preparation with no review date is not waiting: they are lost. That counter exists so you cannot forget someone who genuinely wanted to buy." },
        ],
      },
      {
        id: "que-hacer",
        es: "Qué hacer cuando toca revisión", en: "What to do when a review is due",
        blocks: [
          { k:"steps",
            es:["Llama. La revisión es una llamada, no una mirada al tablero.",
                "Escribe una entrada de nota con lo que te dijo el cliente, aunque sea que sigue igual.",
                "Si ya está listo, sácalo de Preparación y ponlo en la etapa que le toca.",
                "Si no, pon la fecha de revisión nueva con lo que él te dijo — no con lo que tú supones.",
                "Si dejó de responder o ya compró con otro, archívalo con su razón."],
            en:["Call. A review is a phone call, not a glance at the board.",
                "Write a note entry with what the client said, even if it is that nothing changed.",
                "If they are ready, take them out of Preparation and set the right stage.",
                "If not, set the new review date from what they told you — not from what you assume.",
                "If they stopped answering or already bought elsewhere, archive with the reason."] },
          { k:"note", tone:"gold",
            es:"La nota de cada revisión es lo que convierte Preparación en un activo. Seis meses después, \"esperando taxes de 2025, dijo marzo\" vale mucho más que un archivo con fecha y sin historia.",
            en:"The note on each review is what turns Preparation into an asset. Six months later, \"waiting on 2025 taxes, said March\" is worth far more than a file with a date and no story." },
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
        es: "Las cinco fechas", en: "The five dates",
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
        es: "Tres definiciones de día hábil", en: "Three definitions of business day",
        blocks: [
          { k:"note", tone:"gold",
            es:"Para el CD, la Regulación Z excluye domingos y feriados federales. EL SÁBADO CUENTA. Contar lunes a viernes le regala al cliente un día que no existe y el CD sale tarde.",
            en:"For the CD, Regulation Z excludes Sundays and federal holidays. SATURDAY COUNTS. Counting Monday to Friday gives the borrower a day that does not exist and the CD goes out late." },
          { k:"p",
            es:"Para el contrato es distinto: Florida cuenta días hábiles de lunes a viernes. Nevada y Texas cuentan calendario. La misma contingencia de 21 días vence el 18 de agosto en Nevada y el 26 en Florida.",
            en:"For the contract it is different: Florida counts business days Monday to Friday. Nevada and Texas count calendar days. The same 21-day contingency expires August 18 in Nevada and August 26 in Florida." },
          { k:"p",
            es:"Y el estándar de tres días de Pre-Qual usa la vara del contrato —lunes a viernes menos feriados— no la de TRID. Son tres definiciones para tres cosas distintas, y confundirlas mueve fechas reales.",
            en:"And the Pre-Qual three-day standard uses the contract's yardstick — Monday to Friday minus holidays — not TRID's. Three definitions for three different things, and mixing them moves real dates." },
          { k:"p",
            es:"El sistema conoce los feriados federales por regla, no por lista. Incluye el corrimiento: feriado en sábado se observa el viernes, en domingo el lunes.",
            en:"The system knows federal holidays by rule, not by list. That includes the shift: a holiday on Saturday is observed Friday, on Sunday the following Monday." },
        ],
      },
      {
        id: "el-cd",
        es: "El CD · dos actos, dos dueños", en: "The CD · two acts, two owners",
        blocks: [
          { k:"lead",
            es:"El CD lo emite el lender y va electrónico casi siempre. Aquí no se captura un envío: se confirma uno.",
            en:"The lender issues the CD and it goes electronic nearly always. Here you are not capturing a send: you are confirming one." },
          { k:"p",
            es:"El bloque vive en la solapa FECHAS, debajo de las contingencias. La fecha de salida la captura quien vea primero el correo del lender — el Asistente, el Loan Officer o el Branch Manager.",
            en:"The block lives in the DATES tab, below the contingencies. The sent date is captured by whoever sees the lender's email first — the Assistant, the Loan Officer or the Branch Manager." },
          { k:"kv",
            rows:[
              [{es:"Electrónico",en:"Electronic"},
               {es:"Con confirmación de recibo, el cliente recibe el mismo día y el reloj arranca ahí.",
                en:"With confirmed receipt, the client receives it the same day and the clock starts there."}],
              [{es:"Correo postal",en:"Mail"},
               {es:"La ley presume el recibo tres días hábiles después de mandarlo. Ese presunto es el que se puede defender.",
                en:"The law presumes receipt three business days after sending. That presumed date is the defensible one."}],
            ] },
          { k:"note", tone:"legal",
            es:"Desde el recibo corren tres días hábiles antes de poder firmar, y aquí el sábado cuenta. Si la firma cae antes, el sistema lo dice en morado: ese cierre rompe el plazo de la Regulación Z.",
            en:"Three business days run from receipt before signing is allowed, and here Saturday counts. If the signing falls earlier, the system says so in purple: that closing breaks the Regulation Z waiting period." },
          { k:"lead",
            es:"El segundo acto es de otro dueño: los fees los revisa el Loan Officer, y nadie más.",
            en:"The second act has a different owner: the fees are reviewed by the Loan Officer, and nobody else." },
          { k:"p",
            es:"Un CD que salió y cuyos fees nadie miró es el archivo que revienta el día de la firma — con el cliente, con la comisión, o con un dato del lender. Por eso son dos campos y no uno: con uno solo, eso queda invisible.",
            en:"A CD that went out with nobody checking the fees is the file that blows up at signing — with the client, with the commission, or with a lender figure. That is why there are two fields and not one: with a single field, it stays invisible." },
          { k:"note", tone:"red",
            es:"No se sale de CD Issued sin las dos cosas. Es la puerta más defendible de todas: los dos datos existen y están a la mano cuando se piden.",
            en:"You cannot leave CD Issued without both. It is the most defensible gate of all: both pieces of data exist and are at hand when asked for." },
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
    id: "scorecard", icon: "◆", color: "#4A90D9",
    es: "Scorecard de lenders", en: "Lender scorecard",
    articles: [
      {
        id: "para-que",
        es: "Para qué sirve", en: "What it is for",
        blocks: [
          { k:"lead",
            es:"Contesta dos preguntas que antes había que preguntarle a alguien: a quién le mando este archivo, y con quién nos está yendo bien de verdad.",
            en:"It answers two questions that used to require asking someone: who should get this file, and who is actually working out for us." },
          { k:"p",
            es:"Está en PRODUCTION → Scorecard de lenders, y lo ve todo el equipo. La tabla se arma sola con los archivos: al escoger lender en un archivo, ya cuenta aquí. Nadie la mantiene a mano.",
            en:"It lives under PRODUCTION → Lender scorecard, and the whole team sees it. The table builds itself from files: choosing a lender on a file already counts here. Nobody maintains it by hand." },
        ],
      },
      {
        id: "tres-vistas",
        es: "Las tres vistas", en: "The three views",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"Por lender",en:"By lender"},
               {es:"El resumen general de cada uno: cuántos archivos tocó, cuántos cerró, qué parte de tu volumen carga.",
                en:"The overall summary of each one: how many files it touched, how many it closed, what share of your volume it carries."}],
              [{es:"Por producto",en:"By product"},
               {es:"El mismo lender puede ser excelente en FHA y malo en DSCR. Aquí se ve separado.",
                en:"The same lender can be excellent at FHA and bad at DSCR. Here it is broken out."}],
              [{es:"Por especialidad",en:"By specialty"},
               {es:"La más útil en el día a día: 88 especialidades leídas del catálogo. ITIN, bank statement, FICO 500, Chenoa, HELOC con DSCR.",
                en:"The most useful day to day: 88 specialties read from the catalog. ITIN, bank statement, FICO 500, Chenoa, DSCR HELOC."}],
            ] },
        ],
      },
      {
        id: "leer-columnas",
        es: "Cómo leer las columnas", en: "How to read the columns",
        blocks: [
          { k:"kv",
            rows:[
              [{es:"Toca",en:"Touched"},{es:"Archivos que pasaron por ese lender: cerrados, activos y los que se fueron.",en:"Files that went through that lender: closed, active and those that left."}],
              [{es:"Pull-through",en:"Pull-through"},{es:"Qué porcentaje de lo que tocó terminó cerrando. Es la medida principal.",en:"What percentage of what it touched ended up closing. This is the main measure."}],
              [{es:"Tu volumen",en:"Your volume"},{es:"Qué parte de tu volumen fondeado vive ahí. En ámbar sobre 40%.",en:"What share of your funded volume sits there. Amber above 40%."}],
              [{es:"Salidas",en:"Exits"},{es:"Archivos que se movieron a otro lender.",en:"Files that moved to another lender."}],
              [{es:"Por su culpa",en:"Its own call"},{es:"De esas salidas, cuántas fueron decisión del lender.",en:"Of those exits, how many were the lender's own decision."}],
            ] },
          { k:"note", tone:"gold",
            es:"La columna que hace el trabajo es POR SU CULPA. Un archivo que se fue porque el prestatario no calificaba se habría ido de cualquier lender — eso no mide al lender. Uno que se fue por un overlay suyo, sí.",
            en:"The column doing the work is ITS OWN CALL. A file that left because the borrower did not qualify would have left any lender — that does not measure the lender. One that left over its own overlay does." },
          { k:"p",
            es:"Por eso importa escoger bien el motivo al cambiar de lender. Sin ese dato, \"nos tumbaron tres archivos\" y \"esos clientes no calificaban en ningún lado\" se ven igual en el reporte.",
            en:"That is why picking the right reason when changing lenders matters. Without it, \"they killed three files\" and \"those borrowers did not qualify anywhere\" look identical in the report." },
        ],
      },
      {
        id: "probados",
        es: "Probados y sin probar", en: "Proven and untried",
        blocks: [
          { k:"p",
            es:"En las vistas por producto y por especialidad la lista sale partida en dos.",
            en:"In the product and specialty views the list comes split in two." },
          { k:"list",
            es:["Probados — tienes historial con ellos en eso. Salen ordenados por pull-through.",
                "Sin probar — el catálogo dice que lo hacen, pero nunca has cerrado ahí. Ordenados por lo que pagan."],
            en:["Proven — you have history with them on that. Sorted by pull-through.",
                "Untried — the catalog says they do it, but you have never closed there. Sorted by what they pay."] },
          { k:"note", tone:"blue",
            es:"Que un lender ofrezca algo no es evidencia de nada. La lista de sin probar es dónde buscar cuando necesitas una opción nueva, no una recomendación.",
            en:"A lender offering something is evidence of nothing. The untried list is where to look when you need a new option, not a recommendation." },
        ],
      },
      {
        id: "escasez",
        es: "Cuando una especialidad tiene pocos lenders",
        en: "When a specialty has few lenders",
        blocks: [
          { k:"p",
            es:"Las especialidades salen ordenadas de más escasa a más común, y las de doce lenders o menos se marcan en ámbar. Ese orden es a propósito: lo escaso es lo que limita tus opciones, no lo abundante.",
            en:"Specialties are sorted from scarcest to most common, and those with twelve lenders or fewer are marked amber. That order is deliberate: scarcity is what limits your options, not abundance." },
          { k:"note", tone:"gold",
            es:"Si una especialidad escasa es parte de tu mezcla, consigue un segundo nombre probado antes de necesitarlo. Buscar alternativa con el archivo en la mano y el reloj corriendo es la peor forma de escoger lender.",
            en:"If a scarce specialty is part of your mix, get a second proven name before you need it. Hunting for an alternative with the file in hand and the clock running is the worst way to pick a lender." },
        ],
      },
      {
        id: "capturar",
        es: "Capturar detalle y overlays", en: "Capturing detail and overlays",
        blocks: [
          { k:"lead",
            es:"El catálogo dice qué hace cada lender. No dice cómo lo hace. Esa parte la escribe el equipo.",
            en:"The catalog says what each lender does. It does not say how. That part the team writes." },
          { k:"p",
            es:"En la vista por especialidad, cada lender tiene un botón para capturar sus mínimos: FICO, LTV, DTI, reservas y estados. En DPA se agregan porcentaje, si se perdona, grant o segunda, y si fija la tasa.",
            en:"In the specialty view, each lender has a button to capture its minimums: FICO, LTV, DTI, reserves and states. For DPA it adds percentage, whether it is forgiven, grant or second, and whether it fixes the rate." },
          { k:"p",
            es:"Debajo hay un campo de observaciones. Ahí va lo que aprendes trabajando: overlays que no están en la guía, condiciones raras, cómo respondieron. Cada observación queda con su fecha y su autor, y se suman — no se reemplazan.",
            en:"Below there is an observations field. That is where what you learn while working goes: overlays not in the guidelines, odd conditions, how they responded. Each observation is stamped with date and author, and they accumulate — they do not replace each other." },
          { k:"note", tone:"green",
            es:"Que se sumen es el punto. \"Exigen 2 meses de reservas\" en agosto y \"ya no las piden\" en noviembre son dos datos: juntos te dicen que el lender cambió de criterio. Si el segundo borrara al primero, esa información se pierde.",
            en:"Accumulating is the point. \"They require 2 months reserves\" in August and \"they no longer ask\" in November are two data points: together they tell you the lender changed its criteria. If the second erased the first, that information is lost." },
          { k:"p",
            es:"Cualquiera del equipo puede escribir. Si un dato sale mal, se sabe de quién viene y se corrige.",
            en:"Anyone on the team can write. If something is wrong, you know who wrote it and it gets corrected." },
        ],
      },
      {
        id: "desde-cuando",
        es: "Desde cuándo cuenta", en: "Since when it counts",
        blocks: [
          { k:"p",
            es:"El scorecard cuenta desde el corte con Barrett. Lo anterior era PRMG y se rige por otras reglas.",
            en:"The scorecard counts from the Barrett cutover. What came before was PRMG and follows different rules." },
          { k:"note", tone:"blue",
            es:"Con dos o tres archivos por lender los porcentajes engañan. Por eso las filas con menos de tres dicen \"pocos datos todavía\" en vez de dar un veredicto que no se sostiene. Empieza a valer en unos meses — y solo si el equipo registra el motivo cada vez que mueve un archivo.",
            en:"With two or three files per lender the percentages mislead. That is why rows with fewer than three say \"not enough data yet\" instead of giving a verdict that does not hold. It starts being useful in a few months — and only if the team records the reason every time a file moves." },
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
  // Un articulo por PUESTO, no por persona: el asiento no cambia cuando
  // cambia quien lo ocupa. Los tres son visibles para todos a proposito —
  // quien solo conoce su pedazo entrega el archivo y se desentiende.
  {
    id: "seats", icon: "◈", color: "#F5A623",
    es: "Tu puesto, fase por fase", en: "Your seat, phase by phase",
    articles: [

      {
        id: "puesto-lo",
        es: "El Loan Officer", en: "The Loan Officer",
        blocks: [
          { k:"lead",
            es:"Abre el archivo y lo cierra. Las fases 1, 2, 6 y 7 son suyas; el medio es del Asistente y del Procesador.",
            en:"Opens the file and closes it. Phases 1, 2, 6 and 7 are theirs; the middle belongs to the Assistant and the Processor." },
          { k:"table",
            head:{ es:["Fase","Quién trabaja","Qué pasa"], en:["Phase","Who works it","What happens"] },
            rows:[
              ["1 · Pre-Qual", {es:"Loan Officer",en:"Loan Officer"}, {es:"Suya de punta a punta. El reloj es de la fase completa: tres días hábiles desde que entró el lead. Cambiar de etapa no compra tiempo.",en:"Theirs end to end. The clock is on the whole phase: three business days from when the lead arrived. Moving between stages buys no time."}],
              ["2 · House Hunt", {es:"Loan Officer",en:"Loan Officer"}, {es:"Contacto cada 7 días alternando cliente y agente. En Under Contract completa la VERIFICACIÓN DEL 1003 y junta los documentos.",en:"Contact every 7 days, alternating client and agent. At Under Contract they complete the 1003 VERIFICATION and gather the documents."}],
              ["3 · Processing", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"No es suya. Pero si el agente pregunta por qué nada avanza, casi siempre es la tasación esperando el pago del cliente.",en:"Not theirs. But when the agent asks why nothing is moving, it is usually the appraisal waiting on the client's payment."}],
              ["4 · Underwriting", {es:"Procesador · Asistente",en:"Processor · Assistant"}, {es:"No es suya, y aun así el cliente le llama. Abrir el archivo y leer la línea de espera antes de contestar.",en:"Not theirs, and the client calls them anyway. Open the file and read the wait line before answering."}],
              ["5 · Close Prep", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"No es suya. El CD tiene que llegarle al cliente 3 días hábiles antes de firmar, y el sábado cuenta.",en:"Not theirs. The CD must reach the client 3 business days before signing, and Saturday counts."}],
              ["6 · Closing", {es:"Loan Officer · Procesador",en:"Loan Officer · Processor"}, {es:"Signing es suya: espera al cliente, que tiene que presentarse. El Procesador fondea y graba; el LO entrega las llaves.",en:"Signing is theirs: it waits on the client, who has to show up. The Processor funds and records; the LO delivers the keys."}],
              ["7 · Post-Close", {es:"Loan Officer",en:"Loan Officer"}, {es:"Suya de punta a punta: bienvenida a 3 días, reseña dentro de 7, seguimiento a 30, después el cultivo largo.",en:"Theirs end to end: welcome within 3 days, review within 7, follow-up at 30, then the long nurture."}],
            ] },
          { k:"list",
            es:["Nunca entrega con el 1003 en menos de 12 de 12. El reloj de 48 horas del Asistente arranca con la entrega y cuenta como culpa del equipo.","Nunca estima una fecha de contingencia. Se captura la del contrato, aunque parezca rara.","Nunca mete un archivo lento en Preparación. Eso es para tiempo que no controla, no para trabajo atrasado.","Nunca borra una nota. Se escribe una entrada nueva corrigiéndola."],
            en:["Never hands off with the 1003 under 12 of 12. The Assistant's 48-hour clock starts on handoff and counts as the team's fault.","Never estimates a contingency date. Enter what the contract says, even if it looks odd.","Never parks a slow file in Preparation. That is for time they do not control, not for backlog.","Never deletes a note. Add a new entry correcting it."] },
          { k:"p",
            es:"Busca en la guía: Los cuatro relojes · Preparación y seguimiento · El contador DUE REVIEW · Tu compensación.",
            en:"Search the guide: The four clocks · Preparation and follow-up · The DUE REVIEW counter · Your compensation." },
        ],
      },

      {
        id: "puesto-asistente",
        es: "El Asistente", en: "The Assistant",
        blocks: [
          { k:"lead",
            es:"Dueño de ocho de las dieciocho etapas con reloj: del registro con el lender hasta que salen los documentos de cierre.",
            en:"Owns eight of the eighteen timed stages: from registering with the lender through to the closing docs being drawn." },
          { k:"table",
            head:{ es:["Fase","Quién trabaja","Qué pasa"], en:["Phase","Who works it","What happens"] },
            rows:[
              ["1 · Pre-Qual", {es:"Loan Officer",en:"Loan Officer"}, {es:"No la toca. Lo que le llega ya trae crédito, ingreso y precalificación hechos.",en:"Not touched. What reaches them already has credit, income and a pre-qual behind it."}],
              ["2 · House Hunt", {es:"Loan Officer",en:"Loan Officer"}, {es:"Ahí nace su archivo. Su reloj arranca cuando el contador del 1003 llega a 12 de 12, no antes.",en:"This is where their file is born. Their clock starts when the 1003 counter hits 12 of 12, not before."}],
              ["3 · Processing", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"Full Application: captura las cinco fechas del contrato y registra con el lender, 48 horas desde el 1003 completo. Después Initial Disclosures, y las órdenes pasan al Procesador.",en:"Full Application: capture the five contract dates and register with the lender, 48 hours from a complete 1003. Then Initial Disclosures, and the orders go to the Processor."}],
              ["4 · Underwriting", {es:"Procesador · Asistente",en:"Processor · Assistant"}, {es:"El Procesador somete. Cuando baja el Conditional Approval vuelve al Asistente: reparte condiciones en 1 día y persigue al cliente hasta el Clear to Close.",en:"The Processor submits. When the Conditional Approval comes down it returns to the Assistant: split conditions in 1 day and chase the client to Clear to Close."}],
              ["5 · Close Prep", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"Emite el CD y programa la firma. Closing Docs Drawn es su última etapa.",en:"Issue the CD and book the signing. Closing Docs Drawn is their last stage."}],
              ["6 · Closing", {es:"Loan Officer · Procesador",en:"Loan Officer · Processor"}, {es:"Ya soltó. La firma es del LO y el fondeo del Procesador.",en:"Already let go. The signing is the LO's and the funding the Processor's."}],
              ["7 · Post-Close", {es:"Loan Officer",en:"Loan Officer"}, {es:"Nada suyo.",en:"Nothing theirs."}],
            ] },
          { k:"list",
            es:["Nunca arranca con el 1003 a medias. Si el contador no dice 12 de 12, el archivo se devuelve al Loan Officer.","Nunca cambia lender, tasa ni lock. Eso es del Loan Officer.","Nunca cuenta el CD de lunes a viernes. Regulación Z excluye domingos y feriados; el sábado cuenta.","Nunca borra una nota. Se escribe una entrada nueva corrigiéndola."],
            en:["Never starts on a half-done 1003. If the counter does not read 12 of 12, hand the file back to the Loan Officer.","Never changes lender, rate or lock. That belongs to the Loan Officer.","Never counts the CD Monday to Friday. Regulation Z excludes Sundays and holidays; Saturday counts.","Never deletes a note. Add a new entry correcting it."] },
          { k:"p",
            es:"Busca en la guía: Los cuatro relojes · Las seis señales · Las cinco fechas · Tres definiciones de día hábil.",
            en:"Search the guide: The four clocks · The six signals · The five dates · Three definitions of business day." },
        ],
      },

      {
        id: "puesto-procesador",
        es: "El Procesador", en: "The Processor",
        blocks: [
          { k:"lead",
            es:"Ocho etapas van a quien tenga asignado el archivo — se abre y se mira el campo del procesador. Doc Collection es del procesador interno, y solo por excepción.",
            en:"Eight stages belong to whichever Processor is assigned the file — open it and check the processor field. Doc Collection is the internal Processor's, and exceptions only." },
          { k:"table",
            head:{ es:["Fase","Quién trabaja","Qué pasa"], en:["Phase","Who works it","What happens"] },
            rows:[
              ["1 · Pre-Qual", {es:"Loan Officer",en:"Loan Officer"}, {es:"Procesamiento no empieza aquí. El primer archivo llega en la fase 3, después de que el Asistente lo registró.",en:"Processing does not start here. The first file arrives in phase 3, after the Assistant has registered it."}],
              ["2 · House Hunt", {es:"Loan Officer",en:"Loan Officer"}, {es:"Nada llega hasta que el Asistente registró el archivo con el lender.",en:"Nothing arrives until the Assistant has registered the file with the lender."}],
              ["3 · Processing", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"Título 2 días · Tasación 6 — de 5 a 7 en Las Vegas, y no se mueve hasta que el cliente paga · Seguro 2, el cliente escoge la póliza. La tasación marca el paso de la fase.",en:"Title 2 days · Appraisal 6 — 5 to 7 in Las Vegas, and it does not move until the client pays · Insurance 2, the client picks the policy. The appraisal sets the pace."}],
              ["4 · Underwriting", {es:"Procesador · Asistente",en:"Processor · Assistant"}, {es:"Submitted to UW en 1 día, UW Review en 3, 5 si es DPA. El Conditional Approval pasa al Asistente.",en:"Submitted to UW in 1 day, UW Review in 3, 5 if DPA. The Conditional Approval goes to the Assistant."}],
              ["5 · Close Prep", {es:"Asistente · Procesador",en:"Assistant · Processor"}, {es:"Final Verifications es suya: 1 día, y es la última mirada antes de sacar los documentos. Tarde aquí y se mueve la fecha de firma.",en:"Final Verifications is theirs: 1 day, and the last look before the docs are drawn. Late here and the signing date moves."}],
              ["6 · Closing", {es:"Loan Officer · Procesador",en:"Loan Officer · Processor"}, {es:"El LO corre la firma. Funded es del Procesador en 1 día y Recorded 2 días después — esa es su última etapa.",en:"The LO runs the signing. Funded is the Processor's in 1 day and Recorded 2 days after — that is their last stage."}],
              ["7 · Post-Close", {es:"Loan Officer",en:"Loan Officer"}, {es:"Nada suyo.",en:"Nothing theirs."}],
            ] },
          { k:"list",
            es:["Nunca pide la tasación antes de que el cliente pague. No se mueve, y el reloj de 6 días corre igual.","Nunca cambia lender, tasa ni lock. Eso es del Loan Officer.","Nunca devuelve un archivo sin nota. El Asistente lo retoma por lo que quedó escrito, no de memoria.","Nunca borra una nota. Se escribe una entrada nueva corrigiéndola."],
            en:["Never orders the appraisal before the client has paid. It will not move, and the six-day clock runs anyway.","Never changes lender, rate or lock. That belongs to the Loan Officer.","Never hands a file back without a note. The Assistant picks it up from what was written, not from memory.","Never deletes a note. Add a new entry correcting it."] },
          { k:"p",
            es:"Busca en la guía: Los cuatro relojes · Las seis señales · Las cinco fechas · Tres definiciones de día hábil. La cola de Processing tiene pantalla propia.",
            en:"Search the guide: The four clocks · The six signals · The five dates · Three definitions of business day. Processing has its own screen." },
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
              [{es:"Originador · LO",en:"Loan Officer · LO"},
               {es:"Ve todo el pipeline del equipo. Edita sus archivos: lender, tasa, lock, notas, etapas y contingencias. Ve su propia compensación por archivo.",
                en:"Sees the whole team pipeline. Edits their files: lender, rate, lock, notes, stages and contingencies. Sees their own compensation per file."}],
              [{es:"Asistente",en:"Assistant"},
               {es:"Ve y edita archivos y registra con el lender. No arranca hasta que el 1003 del Loan Officer esté en 12 de 12; si ve algo mal, levanta un hallazgo. Trabaja desde Processing, donde vive su cola. No ve compensación.",
                en:"Views and edits files and registers with the lender. Does not start until the Loan Officer's 1003 reads 12 of 12; if something looks wrong, raises a finding. Works from Processing, where their queue lives. Does not see compensation."}],
              [{es:"Procesador",en:"Processor"},
               {es:"Trabaja desde Processing: título, tasación, seguro, sumisión y verificaciones finales. Ve el pipeline completo. No ve compensación ni los tableros de producción.",
                en:"Works from Processing: title, appraisal, insurance, submission and final verifications. Sees the whole pipeline. Does not see compensation or the production dashboards."}],
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
        id: "que-pestanas",
        es: "Qué pestañas ves tú", en: "Which tabs you see",
        blocks: [
          { k:"p",
            es:"No todos ven las mismas pestañas, y es a propósito. Esta es la repartición completa.",
            en:"Not everyone sees the same tabs, and that is deliberate. This is the full split." },
          { k:"table",
            head:{ es:["Pestaña","BM","LO","Asistente","Procesador"],
                   en:["Tab","BM","LO","Assistant","Processor"] },
            rows:[
              [{es:"El tablero y sus seis vistas",en:"The board and its six views"},"·","·","·","·"],
              ["Processing","·","—","·","·"],
              ["Production · Scorecard","·","·","·","·"],
              ["Production · Mix","·","·","—","·"],
              ["Production · Team, Monthly, Referrals","·","·","—","—"],
              ["Production · My Comp","·","·","—","—"],
              ["Production · Override & Comp","·","—","—","—"],
            ] },
          { k:"note", tone:"green",
            es:"Vas a ver que existen pestañas que no puedes abrir. No es un error ni una desconfianza: nadie ve la compensación de nadie, ni siquiera entre originadores. My Comp muestra tus archivos cerrados y nada más.",
            en:"You will see tabs you cannot open. It is not an error and not distrust: nobody sees anyone else's compensation, not even between loan officers. My Comp shows your own closed files and nothing more." },
          { k:"p",
            es:"El Mix se comparte con procesamiento a propósito. Saber que la mitad de los archivos son DPA explica por qué la cola se ve como se ve.",
            en:"Mix is shared with processing on purpose. Knowing half the files are DPA explains why the queue looks the way it does." },
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
              ["PTA / PTC / PTF",{es:"Los tres momentos de un documento: antes de registrar, antes del Clear to Close, antes de fondear.",en:"The three moments of a document: prior to registration, prior to Clear to Close, prior to funding."}],
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
              [{es:"Veo una pestaña que no puedo abrir.",en:"I see a tab I cannot open."},
               {es:"Es normal. Cada rol tiene su repartición y está en Roles y acceso. Nadie ve la compensación de nadie.",en:"That is normal. Each role has its own split and it is listed in Roles and access. Nobody sees anyone else's compensation."}],
              [{es:"¿Cómo practico sin dañar nada?",en:"How do I practice without breaking anything?"},
               {es:"Con el botón ENTRENAMIENTO. El archivo que crea es tuyo, se reconoce por el borde punteado, y nunca entra a producción ni al scorecard.",en:"With the TRAINING button. The file it creates is yours, recognizable by the dashed border, and never enters production or the scorecard."}],
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
      // El titulo de la seccion entra al indice: alguien que busca el nombre
      // de la seccion —"puesto", "tablero", "glosario"— no encontraba nada.
      // Y el titulo del articulo se indexa en los dos idiomas, para que
      // buscar "seat" con la app en español tambien caiga aqui.
      const hay = [a[lang] || a.es, a.es, a.en, sec[lang] || sec.es, sec.en,
                   ...(a.blocks || []).flatMap(b => [
        flat(b[lang] ?? b.es), flat(b.en),
        ...(b.rows || []).flat().map(flat),
        ...((b.head && (b.head[lang] || b.head.es)) || []),
      ])].join(" ").toLowerCase();
      if (hay.includes(q)) out.push({ section: sec, article: a });
    }
  }
  return out;
}
