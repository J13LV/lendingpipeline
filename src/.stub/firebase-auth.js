// Auth falso · solo para render.mjs

export const getAuth = () => ({ currentUser: null });

// Igual que onSnapshot: hay que devolver la funcion de desuscripcion.
// Ademas NO se llama al callback. Llamarlo con un usuario dispararia la
// carga del pipeline dentro de la prueba; render.mjs monta DetailModal
// directo y le pasa el perfil a mano.
export const onAuthStateChanged = () => () => {};

export const signInWithEmailAndPassword = async () => ({ user: { uid: "stub" } });
export const signOut = async () => {};
export const sendPasswordResetEmail = async () => {};
