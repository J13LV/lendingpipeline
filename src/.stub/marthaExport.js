// Export de Martha falso · solo para render.mjs
//
// El de verdad baja ExcelJS de un CDN al primer clic. En una prueba eso
// serian ~950 KB por red para algo que nadie va a abrir.
//
// App.jsx solo importa downloadMarthaSheet. Si algun dia importa algo mas,
// esta prueba se cae al compilar y hay que agregarlo aqui — que es
// exactamente lo que debe pasar.

export const downloadMarthaSheet = async () => 0;
