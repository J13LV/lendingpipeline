// Firebase falso · solo para render.mjs
//
// Esta carpeta existe porque render.mjs monta la aplicacion de verdad para
// cachar pantallas en blanco. Montarla con el Firebase real intentaria
// conectarse a la nube desde una prueba, que es lento, frágil y escribiria
// en la base de produccion.
//
// Regla de estos seis archivos: NO fingen el comportamiento, solo la FORMA.
// Devuelven lo minimo que el codigo necesita para no reventar. Si un dia
// una prueba necesita que Firestore devuelva datos, se cambia aqui — nunca
// en App.jsx.

export const initializeApp = () => ({ name: "[stub]", options: {} });
