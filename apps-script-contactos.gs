function doPost(e) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Contactos')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Contactos');

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(['Fecha', 'Nombre', 'Contacto', 'Presupuesto', 'Tipo de propiedad', 'Zona de interés', 'Notas', 'Página']);
  }

  const datos = JSON.parse(e.postData.contents);
  hoja.appendRow([
    new Date(),
    datos.nombre || '',
    datos.contacto || '',
    datos.presupuesto || '',
    datos.tipo || '',
    datos.zona || '',
    datos.notas || '',
    datos.pagina || ''
  ]);

  formatearHoja(hoja);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Deja la hoja legible: encabezado fijo y resaltado, columnas con un
   ancho que alcance para el contenido, texto largo (notas/página) con
   salto de línea en vez de cortado, la fecha con hora legible, y cada
   fila separada con una línea gruesa para diferenciar un cliente del
   siguiente de un vistazo. */
function formatearHoja(hoja) {
  const columnas = 8;
  hoja.setFrozenRows(1);

  const encabezado = hoja.getRange(1, 1, 1, columnas);
  encabezado.setFontWeight('bold').setBackground('#0A0A0A').setFontColor('#FAEEDA');

  const anchos = [140, 160, 190, 170, 150, 170, 320, 260];
  anchos.forEach((ancho, i) => hoja.setColumnWidth(i + 1, ancho));

  const filas = hoja.getLastRow();
  if (filas > 1) {
    hoja.getRange(2, 1, filas - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    hoja.getRange(2, 7, filas - 1, 2).setWrap(true); // Notas y Página
    hoja.setRowHeightsForced(2, filas - 1, 21);
  }

  // Bordes: contorno grueso alrededor de toda la tabla, línea fina entre
  // columnas, y una línea gruesa debajo de cada fila (incluido el
  // encabezado) para separar visualmente un cliente del siguiente.
  const tabla = hoja.getRange(1, 1, filas, columnas);
  tabla.setBorder(true, true, true, true, false, false, '#0A0A0A', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  tabla.setBorder(null, null, null, null, true, false, '#d8d2c2', SpreadsheetApp.BorderStyle.SOLID);
  for (let f = 1; f <= filas; f++) {
    hoja.getRange(f, 1, 1, columnas)
      .setBorder(false, false, true, false, false, false, '#0A0A0A', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }
}
