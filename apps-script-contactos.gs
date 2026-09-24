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
   salto de línea en vez de cortado, y la fecha con hora legible. */
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
}
