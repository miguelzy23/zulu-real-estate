/* Contactos de zulurealstate.com -> hoja "Contactos".
   Versión 2026-11-25 (filtro de spam: lo sospechoso va a la pestaña "Spam", nada se borra)
   Versión 2026-10-29 (formulario confiable): responde JSON legible desde el navegador, no duplica reintentos
   (mismo "envio_id") y guarda de qué propiedad viene la consulta, sin tocar el mensaje de la persona.
   Después de pegar este código hay que crear una NUEVA VERSIÓN de la implementación (ver CONTACTOS.md). */

const ENCABEZADO = ['Fecha', 'Nombre', 'Contacto', 'Presupuesto', 'Tipo de propiedad', 'Zona de interés', 'Notas', 'Página',
                    'ID propiedad', 'Propiedad', 'Enlace de la propiedad', 'ID de envío', 'Idioma', 'Huella', 'Reemplaza a'];
const COL_ID_ENVIO = 12;
const COL_HUELLA = 14;
const MAX_TEXTO = 2000;
const MAX_SPAM = 500;   // tope de filas en "Spam"; al llenarse, revisarla y borrar filas

function motivoSpam(d) {
  if (d.control) return 'campo trampa';
  const texto = [d.nombre, d.contacto, d.zona, d.notas].join(' ');
  if ((texto.match(/https?:\/\/|www\./gi) || []).length >= 3) return 'varios enlaces';
  return '';
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Texto seguro para la hoja: recorta y evita que algo que parezca una fórmula (empieza con = o @, o con + / - seguido
// de algo que no sea un teléfono) se interprete como tal. Los teléfonos como "+57 300 123 4567" se guardan tal cual.
function limpiar(v) {
  let t = (v === undefined || v === null) ? '' : String(v).slice(0, MAX_TEXTO);
  if (/^[=@]/.test(t) || (/^[+\-]/.test(t) && !/^[+\-][\d\s().\-]*$/.test(t))) t = "'" + t;
  return t;
}

// Abrir la dirección del script en el navegador (GET) sirve para comprobar que está activo; no muestra datos.
function doGet() {
  return responder({ ok: true, servicio: 'contactos', version: '2026-11-25', huella: true });
}

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return responder({ ok: false, error: 'json' });
  }
  if (!datos || typeof datos !== 'object') return responder({ ok: false, error: 'json' });
  const nombre = limpiar(datos.nombre).trim(), contacto = limpiar(datos.contacto).trim();
  if (!nombre || !contacto) return responder({ ok: false, error: 'faltan-datos' });

  const envio = limpiar(datos.envio_id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
  const codigo = envio ? envio.replace(/-/g, '').slice(0, 8).toUpperCase() : '';
  // Huella del contenido que calculó el navegador: distingue un reintento idéntico de uno con datos corregidos.
  const huella = limpiar(datos.huella).replace(/[^0-9A-Za-z]/g, '').slice(0, 24);
  const reemplaza = limpiar(datos.reemplaza).replace(/[^A-Za-z0-9,-]/g, '').slice(0, 200);   // ids anteriores separados por coma

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return responder({ ok: false, error: 'ocupado' });
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName('Contactos') || libro.insertSheet('Contactos');
    asegurarEncabezado(hoja);

    // Spam (campo trampa lleno o 3 enlaces o más): no entra a "Contactos" sino a "Spam", con las MISMAS columnas más el motivo,
    // por si fuera una persona. Solo se responde "ok" si la fila quedó guardada (o ya lo estaba).
    const motivo = motivoSpam(datos);
    const destino = motivo ? libro.getSheetByName('Spam') || libro.insertSheet('Spam') : hoja;
    if (motivo) asegurarEncabezado(destino, ENCABEZADO.concat('Motivo'));

    // Reintento del mismo envío con el MISMO contenido (el navegador no alcanzó a leer la respuesta): no se guarda otra fila.
    // Si el id ya existe pero el contenido es distinto, no se descarta ni se da por repetido: se guarda como fila nueva marcada.
    let correccionDe = '';
    if (envio && destino.getLastRow() > 1) {
      const hallados = destino.getRange(2, COL_ID_ENVIO, destino.getLastRow() - 1, 1).createTextFinder(envio).matchEntireCell(true).findAll();
      for (let i = 0; i < hallados.length; i++) {
        if (String(destino.getRange(hallados[i].getRow(), COL_HUELLA).getValue()) === huella) {
          return responder({ ok: true, repetido: true, codigo: codigo, huella: huella });
        }
      }
      if (hallados.length) correccionDe = envio;
    }

    // "Spam" tiene tope para que un ataque no llene la hoja. Lleno: se responde error (la persona ve que no se guardó y puede usar WhatsApp).
    if (motivo && destino.getLastRow() > MAX_SPAM) return responder({ ok: false, error: 'guardado' });

    const fila = [
      new Date(),
      nombre,
      contacto,
      limpiar(datos.presupuesto),
      limpiar(datos.tipo),
      limpiar(datos.zona),
      limpiar(datos.notas),
      limpiar(datos.pagina),
      limpiar(datos.propiedad_id),
      limpiar(datos.propiedad_titulo),
      limpiar(datos.propiedad_url),
      envio,
      limpiar(datos.idioma),
      huella,
      reemplaza || correccionDe
    ];
    destino.appendRow(motivo ? fila.concat(motivo) : fila);
    SpreadsheetApp.flush();   // confirma la escritura antes de responder ok
    if (!motivo) formatearHoja(hoja);
    return responder({ ok: true, codigo: codigo, huella: huella, correccion: !!(reemplaza || correccionDe) });
  } catch (err) {
    return responder({ ok: false, error: 'guardado' });
  } finally {
    lock.releaseLock();
  }
}

// Crea el encabezado si la hoja es nueva, o agrega las columnas nuevas a una hoja que ya tenía las 8 originales.
function asegurarEncabezado(hoja, titulos) {
  const encabezado = titulos || ENCABEZADO;
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezado);
  } else {
    const actual = hoja.getRange(1, 1, 1, encabezado.length).getValues()[0];
    encabezado.forEach((t, i) => { if (!actual[i]) hoja.getRange(1, i + 1).setValue(t); });
  }
}

/* Deja la hoja legible: encabezado fijo y resaltado, columnas con un
   ancho que alcance para el contenido, texto largo (notas/página) con
   salto de línea en vez de cortado, la fecha con hora legible, y cada
   fila separada con una línea gruesa para diferenciar un cliente del
   siguiente de un vistazo. */
function formatearHoja(hoja) {
  const columnas = ENCABEZADO.length;
  hoja.setFrozenRows(1);

  const encabezado = hoja.getRange(1, 1, 1, columnas);
  encabezado.setFontWeight('bold').setBackground('#0A0A0A').setFontColor('#FAEEDA');

  const anchos = [140, 160, 190, 170, 150, 170, 320, 260, 130, 220, 260, 150, 70, 110, 150];
  anchos.forEach((ancho, i) => hoja.setColumnWidth(i + 1, ancho));

  const filas = hoja.getLastRow();
  if (filas > 1) {
    hoja.getRange(2, 1, filas - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    hoja.getRange(2, 7, filas - 1, 2).setWrap(true); // Notas y Página
    hoja.getRange(2, 10, filas - 1, 2).setWrap(true); // Propiedad y su enlace
    hoja.setRowHeightsForced(2, filas - 1, 21);
  }

  // Bordes: contorno grueso alrededor de toda la tabla, línea fina entre
  // columnas, y una línea gruesa debajo de cada fila (incluido el
  // encabezado) para separar visualmente un cliente del siguiente.
  // Importante: en setBorder, `null` significa "no tocar este lado" y
  // `false` significa "bórralo" — hay que usar `null` en todo lo que no
  // se quiere tocar, o cada llamada borra lo que puso la anterior.
  const tabla = hoja.getRange(1, 1, filas, columnas);
  tabla.setBorder(true, true, true, true, null, null, '#0A0A0A', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  tabla.setBorder(null, null, null, null, true, null, '#d8d2c2', SpreadsheetApp.BorderStyle.SOLID);
  for (let f = 1; f <= filas; f++) {
    hoja.getRange(f, 1, 1, columnas)
      .setBorder(null, null, true, null, null, null, '#0A0A0A', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }
}
