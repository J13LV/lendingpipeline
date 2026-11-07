// Firestore falso · solo para render.mjs

export const getFirestore = () => ({ type: "stub-db" });

// Una referencia es solo su ruta. Con eso basta para que doc() y
// collection() se puedan anidar sin que nada se queje.
export const collection = (db, path) => ({ path, type: "collection" });
export const doc = (parent, id) =>
  ({ path: (parent?.path ? parent.path + "/" : "") + (id ?? ""), id, type: "doc" });

// onSnapshot DEBE devolver la funcion para desuscribirse: App.jsx la guarda
// y la llama al desmontar. Si devolviera undefined, el useEffect reventaria
// al limpiar — justo el tipo de fallo que esta prueba busca.
export const onSnapshot = () => () => {};

export const setDoc = async () => {};
export const deleteDoc = async () => {};

// La migracion hace `const previo = await getDocs(LOANS); if (!previo.empty)`.
// Vacio y true: asi la prueba toma el camino del pipeline nuevo en vez de
// intentar migrar nada.
export const getDocs = async () => ({ empty: true, size: 0, docs: [], forEach() {} });

// El lote acumula y commit() no hace nada. Se devuelve `this` en set y
// delete porque el encadenado es legal en la API real.
export const writeBatch = () => ({
  set() { return this; },
  delete() { return this; },
  async commit() {},
});
