// ═══════════════════════════════════════════════════════════════════
//  idioma.js · el idioma vigente y los cuatro traductores
//
//  Vivía al principio de App.jsx. Sale aquí para que las pantallas en su
//  propio archivo (production.jsx) lean el MISMO idioma sin importar App.
//  `CURRENT_LANG` es un enlace vivo: quien lo importa ve el valor nuevo en
//  cuanto App llama a fijarIdioma().
// ═══════════════════════════════════════════════════════════════════
import { tr, PL_ES } from "./ui";

// Idioma vigente, a nivel de módulo. El motor devuelve {es, en} en 84 lugares
// y la interfaz leía siempre `.es`. Pasar `lang` por props a los seis paneles
// anidados sería más frágil que un valor de sesión: hay un usuario por pestaña.
export let CURRENT_LANG = "es";
export function fijarIdioma(l) { CURRENT_LANG = l; }
export const P = o => (o && typeof o === "object" && !Array.isArray(o))
  ? (o[CURRENT_LANG] ?? o.es ?? o.en ?? "") : o;
export const TX = (k, v) => tr(k, CURRENT_LANG, v);
// Rótulos de Producción: el inglés es la llave; en español se traduce si
// está en PL_ES y si no, sale tal cual.
export const PL = s => (CURRENT_LANG === "es" && PL_ES[s]) || s;
// Las notas del motor viven como note_es / note_en.
export const PN = o => o ? (o["note_" + CURRENT_LANG] ?? o.note_es ?? o.note_en ?? "") : "";
