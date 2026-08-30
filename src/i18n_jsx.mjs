// Auditoría bilingüe extendida · quinta verificación de entrega.
//
// `check_i18n.mjs` revisa que cada clave del diccionario tenga par ES/EN.
// Eso no atrapa lo contrario: texto de pantalla que nunca llegó al
// diccionario. Los 24 que se corrigieron el 31 de agosto llevaban meses
// ahí, incluidos los mensajes de error del login — lo primero que ve
// alguien que se equivoca de contraseña el primer día.
//
// Dos cosas NO son violación y se descartan:
//   · líneas con `es:` y `en:` — ya son un par bilingüe, aunque viva inline
//   · VALORES GUARDADOS — se comparan contra datos escritos en Firestore.
//     Traducirlos rompe archivos existentes. Se muestran, no se guardan
//     traducidos, así que su traducción es una tabla de despliegue aparte.
import { readFileSync } from "fs";

const ARCHIVOS = ["App.jsx", "processing.jsx", "tour.jsx"];

// Valores que viven en Firestore. Cambiarlos rompe archivos ya escritos.
const GUARDADOS = [
  "Withdrawn by Borrower", "Pending at Banker", "Closed (Funded)", "Fell Through",
  "Clear to Close", "Inbound referral", "Went with another lender",
  "Referred out (transition)", "Client changed mind", "Property and disclosures",
  "Laura de Armas", "Jose Del Valle", "Ana M Plasencia", "Marelis Pinales",
];

const RUIDO = /var\(|#[0-9a-fA-F]{3,}|[0-9]+px|rgba|solid |inset |DM Mono|Syne|IBM Plex|application\/|text\/|image\/|,\s*sans|nowrap|flex-|space-between|inline-block|Content-Type|http|\.json|\.docx/;

let total = 0;
for (const f of ARCHIVOS) {
  readFileSync(f, "utf8").split("\n").forEach((ln, i) => {
    // Un par bilingüe en la misma línea o en la de al lado no es violación.
    if (/\bes:\s*"/.test(ln) || /\ben:\s*"/.test(ln)) return;
    const limpia = ln.replace(/\/\/.*$/, "");
    for (const m of limpia.matchAll(/"([A-Z][a-z]+ [a-z]{2,}[^"]{6,})"/g)) {
      if (RUIDO.test(m[0])) continue;
      if (GUARDADOS.includes(m[1])) continue;
      console.log(`  ${f}:${i + 1}  ${m[1].slice(0, 64)}`);
      total++;
    }
  });
}
console.log(total
  ? `\n5/5 i18n JSX: ${total} cadena(s) fuera del diccionario`
  : "5/5 i18n JSX: OK — nada de pantalla fijo en el JSX");
process.exit(total ? 1 : 0);
